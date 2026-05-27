from __future__ import annotations

import email
import html
import imaplib
import json
from email.header import decode_header, make_header
from email.utils import parseaddr

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.core.authz import (
    can_access_procurement_settings,
    can_access_quote_workspace,
    is_super_admin,
)
from api.core.deps import get_any_user
from api.core.time import utcnow
from api.database import get_db
from api.models.company import Company
from api.models.email_settings import EmailSettings
from api.models.supplier import Supplier, SupplierUser
from api.models.system_email import SystemEmail
from api.models.system_email_message import SystemEmailMessage
from api.models.tenant import Tenant
from api.models.user import User
from api.services.email_service import get_email_service
from api.services.email_runtime_config import get_effective_email_config


router = APIRouter(prefix="/mail-center", tags=["mail-center"])


class MailCenterSendPayload(BaseModel):
    to_email: str
    subject: str
    body: str
    cc: str | None = None


class MailCenterMessageActionPayload(BaseModel):
    action: str
    is_read: bool | None = None
    is_starred: bool | None = None
    is_important: bool | None = None


class CompanyMailVisibilityPayload(BaseModel):
    enabled: bool


def _ensure_super_admin(current_user: User) -> User:
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu alan sadece super admin icindir",
        )
    return current_user


def _is_supplier_portal_user(principal: User | SupplierUser) -> bool:
    return isinstance(principal, SupplierUser)


def _is_super_admin_identity(principal: User | SupplierUser) -> bool:
    return isinstance(principal, User) and is_super_admin(principal)


def _ensure_mail_center_access(
    current_user: User | SupplierUser,
) -> User | SupplierUser:
    if _is_supplier_portal_user(current_user):
        return current_user
    if not (
        can_access_procurement_settings(current_user)
        or can_access_quote_workspace(current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu alan icin yetkiniz yok",
        )
    return current_user


def _get_account_or_404(db: Session, account_id: int) -> SystemEmail:
    account = db.query(SystemEmail).filter(SystemEmail.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Mail hesab? bulunamad?")
    return account


def _normalized_principal_role(user: User) -> str:
    return str(getattr(user, "role", "") or "").strip().lower()


def _normalized_principal_system_role(user: User) -> str:
    return str(getattr(user, "system_role", "") or "").strip().lower()


def _is_admin_or_owner_mail_delegate(user: User) -> bool:
    role = _normalized_principal_role(user)
    system_role = _normalized_principal_system_role(user)
    return role in {
        "super_admin",
        "admin",
        "channel_owner",
        "owner",
        "tenant_owner",
    } or system_role in {"super_admin", "tenant_owner", "tenant_admin"}


def _get_user_company_ids(user: User) -> set[int]:
    ids = {
        int(company.id)
        for company in getattr(user, "companies", [])
        if getattr(company, "id", None) is not None
    }
    ids.update(
        int(item.company_id)
        for item in getattr(user, "company_roles", [])
        if getattr(item, "company_id", None) is not None
    )
    return ids


def _has_cross_mailbox_visibility_for_user(db: Session, user: User) -> bool:
    if _is_super_admin_identity(user):
        return True
    if user.tenant_id is None or not _is_admin_or_owner_mail_delegate(user):
        return False

    company_ids = _get_user_company_ids(user)
    if not company_ids:
        return False

    enabled = (
        db.query(Company.id)
        .filter(
            Company.tenant_id == user.tenant_id,
            Company.id.in_(company_ids),
            Company.mailbox_team_visibility_enabled.is_(True),
            Company.is_active.is_(True),
        )
        .first()
    )
    return enabled is not None


def _ensure_account_access(
    current_user: User | SupplierUser, account: SystemEmail, db: Session
) -> SystemEmail:
    if _is_super_admin_identity(current_user):
        return account
    if isinstance(current_user, User):
        if account.owner_user_id == current_user.id:
            return account
        account_email = str(account.email or "").strip().lower()
        allowed_emails = {
            str(current_user.email or "").strip().lower(),
            str(current_user.work_email or "").strip().lower(),
        }
        if account_email and account_email in allowed_emails:
            return account
        user_tenant_id = getattr(current_user, "tenant_id", None)
        if (
            user_tenant_id is not None
            and account.tenant_id == user_tenant_id
            and _has_cross_mailbox_visibility_for_user(db, current_user)
        ):
            return account
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu mail hesabina erisim yetkiniz yok",
        )

    supplier = (
        db.query(Supplier).filter(Supplier.id == current_user.supplier_id).first()
    )
    allowed_emails = {
        str(current_user.email or "").strip().lower(),
        str(current_user.work_email or "").strip().lower(),
    }
    account_email = str(account.email or "").strip().lower()
    if account_email and account_email in allowed_emails:
        return account
    if (
        supplier
        and supplier.tenant_id is not None
        and account.tenant_id == supplier.tenant_id
    ):
        return account

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu mail hesabina erisim yetkiniz yok",
    )


def _resolve_owner_user_for_supplier(
    db: Session, supplier_user: SupplierUser
) -> User | None:
    for email_value in [supplier_user.work_email, supplier_user.email]:
        candidate = str(email_value or "").strip().lower()
        if not candidate:
            continue
        user = db.query(User).filter(User.email == candidate).first()
        if user:
            return user
    return None


def _resolve_effective_owner_id(
    db: Session, current_user: User | SupplierUser
) -> int | None:
    if isinstance(current_user, User):
        return current_user.id
    owner = _resolve_owner_user_for_supplier(db, current_user)
    return owner.id if owner else None


def _infer_imap_host(smtp_host: str | None) -> str | None:
    host = str(smtp_host or "").strip().lower()
    if not host:
        return None
    if host == "smtp.gmail.com":
        return "imap.gmail.com"
    if host.startswith("smtp.office365"):
        return "outlook.office365.com"
    if host.startswith("smtp-mail.outlook"):
        return "outlook.office365.com"
    if host.startswith("smtp.yandex"):
        return "imap.yandex.com"
    if host.startswith("smtp.mail.yahoo"):
        return "imap.mail.yahoo.com"
    return None


def _list_accounts_for_principal(
    db: Session, current_user: User | SupplierUser
) -> list[SystemEmail]:
    query = db.query(SystemEmail).filter(SystemEmail.is_active.is_(True))
    if _is_super_admin_identity(current_user):
        return query.order_by(SystemEmail.email.asc()).all()

    if isinstance(current_user, User):
        allowed_emails = [
            item
            for item in {
                str(current_user.email or "").strip().lower(),
                str(current_user.work_email or "").strip().lower(),
            }
            if item
        ]
        user_tenant_id = getattr(current_user, "tenant_id", None)
        filters = [SystemEmail.owner_user_id == current_user.id]
        if user_tenant_id is not None and _has_cross_mailbox_visibility_for_user(
            db, current_user
        ):
            filters.append(SystemEmail.tenant_id == user_tenant_id)
        if allowed_emails:
            filters.append(SystemEmail.email.in_(allowed_emails))
        return query.filter(or_(*filters)).order_by(SystemEmail.email.asc()).all()

    supplier = (
        db.query(Supplier).filter(Supplier.id == current_user.supplier_id).first()
    )
    allowed_emails = [
        item
        for item in {
            str(current_user.email or "").strip().lower(),
            str(current_user.work_email or "").strip().lower(),
        }
        if item
    ]
    if supplier and supplier.tenant_id is not None and allowed_emails:
        return (
            query.filter(
                or_(
                    SystemEmail.tenant_id == supplier.tenant_id,
                    SystemEmail.email.in_(allowed_emails),
                )
            )
            .order_by(SystemEmail.email.asc())
            .all()
        )
    if supplier and supplier.tenant_id is not None:
        return (
            query.filter(SystemEmail.tenant_id == supplier.tenant_id)
            .order_by(SystemEmail.email.asc())
            .all()
        )
    if allowed_emails:
        return (
            query.filter(SystemEmail.email.in_(allowed_emails))
            .order_by(SystemEmail.email.asc())
            .all()
        )
    return []


def _resolve_email_settings_for_account(
    db: Session, account: SystemEmail
) -> EmailSettings | None:
    if account.owner_user_id is not None:
        scoped = (
            db.query(EmailSettings)
            .filter(EmailSettings.owner_user_id == account.owner_user_id)
            .first()
        )
    else:
        scoped = (
            db.query(EmailSettings)
            .filter(EmailSettings.owner_user_id.is_(None))
            .first()
        )
    fallback = (
        db.query(EmailSettings).filter(EmailSettings.owner_user_id.is_(None)).first()
    )
    if scoped is None:
        scoped = fallback
    if scoped is None:
        return None
    effective = get_effective_email_config(
        owner_user_id=account.owner_user_id, system_email_id=account.id
    )
    scoped.smtp_host = scoped.smtp_host or effective.smtp_host
    scoped.smtp_port = scoped.smtp_port or effective.smtp_port
    scoped.imap_host = (
        scoped.imap_host or _infer_imap_host(scoped.smtp_host) or effective.smtp_host
    )
    scoped.imap_port = scoped.imap_port or 993
    scoped.incoming_use_ssl = bool(
        scoped.incoming_use_ssl if scoped.incoming_use_ssl is not None else True
    )
    return scoped


def _upsert_supplier_mailbox_account(db: Session, current_user: SupplierUser) -> None:
    supplier = (
        db.query(Supplier).filter(Supplier.id == current_user.supplier_id).first()
    )
    smtp_settings = (
        db.query(EmailSettings)
        .filter(
            EmailSettings.owner_user_id.is_(None), EmailSettings.smtp_host.isnot(None)
        )
        .first()
    )
    if not smtp_settings or not smtp_settings.smtp_host:
        return

    supplier_email = (
        str(current_user.work_email or current_user.email or "").strip().lower()
    )
    if not supplier_email:
        return

    account = db.query(SystemEmail).filter(SystemEmail.email == supplier_email).first()
    smtp_secret = (smtp_settings.smtp_password or "").strip()
    password_value = smtp_secret or "smtp-profile-configured"
    imap_host_value = (
        smtp_settings.imap_host
        or _infer_imap_host(smtp_settings.smtp_host)
        or smtp_settings.smtp_host
        or ""
    ).strip() or None

    if account is None:
        db.add(
            SystemEmail(
                email=supplier_email,
                password=password_value,
                tenant_id=supplier.tenant_id if supplier else None,
                owner_user_id=None,
                description="Tedarik?i ?? Maili (SMTP)",
                is_active=True,
                imap_host=imap_host_value,
                imap_port=smtp_settings.imap_port,
                imap_username=supplier_email,
                imap_password=smtp_secret,
                imap_use_ssl=bool(
                    smtp_settings.incoming_use_ssl
                    if smtp_settings.incoming_use_ssl is not None
                    else True
                ),
                mailbox_folder="INBOX",
                mailbox_provision_status="manual",
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        return

    account.tenant_id = account.tenant_id or (supplier.tenant_id if supplier else None)
    account.description = account.description or "Tedarik?i ?? Maili (SMTP)"
    account.is_active = True
    if smtp_secret:
        account.password = smtp_secret
        account.imap_password = smtp_secret
    account.imap_host = imap_host_value
    account.imap_port = smtp_settings.imap_port
    account.imap_username = supplier_email
    account.imap_use_ssl = bool(
        smtp_settings.incoming_use_ssl
        if smtp_settings.incoming_use_ssl is not None
        else True
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _upsert_personal_smtp_account(
    db: Session, current_user: User | SupplierUser
) -> None:
    owner_user_id = _resolve_effective_owner_id(db, current_user)
    if owner_user_id is None:
        if isinstance(current_user, SupplierUser):
            _upsert_supplier_mailbox_account(db, current_user)
        return

    owner_user = db.query(User).filter(User.id == owner_user_id).first()
    if owner_user is None:
        return

    smtp_settings = (
        db.query(EmailSettings)
        .filter(
            EmailSettings.owner_user_id == owner_user_id,
            EmailSettings.smtp_host.isnot(None),
        )
        .first()
    )
    if smtp_settings is None:
        smtp_settings = (
            db.query(EmailSettings)
            .filter(
                EmailSettings.owner_user_id.is_(None),
                EmailSettings.smtp_host.isnot(None),
            )
            .first()
        )

    if not smtp_settings or not smtp_settings.smtp_host:
        return

    owner_primary_email = (
        str(owner_user.work_email or owner_user.email or "").strip().lower()
    )
    from_email = (
        owner_primary_email or str(smtp_settings.from_email or "").strip().lower()
    )
    if not from_email:
        return

    settings_scoped_to_owner = smtp_settings.owner_user_id == owner_user_id
    smtp_username_value = (
        str(smtp_settings.smtp_username or "").strip()
        if settings_scoped_to_owner
        else from_email
    ) or from_email

    account = (
        db.query(SystemEmail)
        .filter(
            SystemEmail.owner_user_id == owner_user_id,
            SystemEmail.email == from_email,
        )
        .first()
    )

    global_same_email = (
        db.query(SystemEmail).filter(SystemEmail.email == from_email).first()
    )
    if (
        global_same_email is not None
        and account is None
        and global_same_email.owner_user_id != owner_user_id
    ):
        return

    smtp_secret = (smtp_settings.smtp_password or "").strip()
    password_value = smtp_secret or "smtp-profile-configured"
    if account is None:
        db.add(
            SystemEmail(
                email=from_email,
                password=password_value,
                owner_user_id=owner_user_id,
                description="?? Maili (SMTP)",
                is_active=True,
                imap_host=(
                    smtp_settings.imap_host or smtp_settings.smtp_host or ""
                ).strip()
                or None,
                imap_port=smtp_settings.imap_port,
                imap_username=smtp_username_value,
                imap_password=smtp_secret,
                imap_use_ssl=bool(
                    smtp_settings.incoming_use_ssl
                    if smtp_settings.incoming_use_ssl is not None
                    else True
                ),
                mailbox_folder="INBOX",
                mailbox_provision_status="manual",
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
        return

    account.description = account.description or "?? Maili (SMTP)"
    account.is_active = True
    if smtp_secret:
        account.password = smtp_secret
        account.imap_password = smtp_secret
    account.imap_host = (
        smtp_settings.imap_host or smtp_settings.smtp_host or ""
    ).strip() or None
    account.imap_port = smtp_settings.imap_port
    account.imap_username = smtp_username_value
    account.imap_use_ssl = bool(
        smtp_settings.incoming_use_ssl
        if smtp_settings.incoming_use_ssl is not None
        else True
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _extract_plain_text(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if (
                part.get_content_type() == "text/plain"
                and "attachment" not in str(part.get("Content-Disposition", "")).lower()
            ):
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
        return ""
    payload = msg.get_payload(decode=True) or b""
    charset = msg.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def _extract_html_text(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if (
                part.get_content_type() == "text/html"
                and "attachment" not in str(part.get("Content-Disposition", "")).lower()
            ):
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
        return ""
    if msg.get_content_type() != "text/html":
        return ""
    payload = msg.get_payload(decode=True) or b""
    charset = msg.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def _extract_attachment_metadata(
    msg: email.message.Message,
) -> list[dict[str, str | int]]:
    attachments: list[dict[str, str | int]] = []
    if not msg.is_multipart():
        return attachments
    for part in msg.walk():
        content_disposition = str(part.get("Content-Disposition", "")).lower()
        if "attachment" not in content_disposition:
            continue
        payload = part.get_payload(decode=True) or b""
        attachments.append(
            {
                "filename": _decode_header_value(part.get_filename()) or "attachment",
                "content_type": part.get_content_type() or "application/octet-stream",
                "size": len(payload),
            }
        )
    return attachments


def _compute_thread_key(msg: email.message.Message) -> str:
    references_header = str(msg.get("References") or "").strip()
    in_reply_to = str(msg.get("In-Reply-To") or "").strip()
    external_message_id = str(msg.get("Message-ID") or "").strip()
    if references_header:
        parts = [item.strip() for item in references_header.split() if item.strip()]
        if parts:
            return parts[0]
    if in_reply_to:
        return in_reply_to
    return external_message_id


def _open_mailbox_connection(account: SystemEmail, settings: EmailSettings):
    imap_host = (
        account.imap_host
        or settings.imap_host
        or _infer_imap_host(settings.smtp_host)
        or settings.smtp_host
        or ""
    ).strip()
    if not imap_host:
        raise RuntimeError("IMAP host bulunamad?")
    imap_username = (account.imap_username or account.email or "").strip()
    imap_password = (account.imap_password or account.password or "").strip()
    if not imap_username or not imap_password:
        raise RuntimeError("IMAP kullan?c? ad? veya ?ifresi eksik")
    mailbox_name = (account.mailbox_folder or "INBOX").strip() or "INBOX"
    use_ssl = bool(
        account.imap_use_ssl
        if account.imap_use_ssl is not None
        else settings.incoming_use_ssl
    )
    port = account.imap_port or settings.imap_port or (993 if use_ssl else 143)
    mailbox = (
        imaplib.IMAP4_SSL(imap_host, port)
        if use_ssl
        else imaplib.IMAP4(imap_host, port)
    )
    mailbox.login(imap_username, imap_password)
    mailbox.select(mailbox_name)
    return mailbox


def _diagnose_mailbox_connection(
    account: SystemEmail, settings: EmailSettings | None
) -> dict:
    imap_host = (
        account.imap_host
        or (settings.imap_host if settings else None)
        or _infer_imap_host(settings.smtp_host if settings else None)
        or (settings.smtp_host if settings else None)
        or ""
    ).strip()
    use_ssl = bool(
        account.imap_use_ssl
        if account.imap_use_ssl is not None
        else (
            settings.incoming_use_ssl
            if settings and settings.incoming_use_ssl is not None
            else True
        )
    )
    port = (
        account.imap_port
        or (settings.imap_port if settings else None)
        or (993 if use_ssl else 143)
    )
    username = (account.imap_username or account.email or "").strip()
    password_value = (account.imap_password or account.password or "").strip()

    has_password = bool(password_value)
    status_value = "ok"
    hints: list[str] = []
    connection = {
        "success": False,
        "error_type": None,
        "error_message": None,
    }

    account_email = str(account.email or "").strip().lower()
    host_lower = imap_host.lower()
    is_gmail = account_email.endswith("@gmail.com") or "gmail" in host_lower

    if not imap_host:
        status_value = "error"
        connection["error_type"] = "missing_imap_host"
        connection["error_message"] = "IMAP host bulunamad?"
    elif not username:
        status_value = "error"
        connection["error_type"] = "missing_username"
        connection["error_message"] = "IMAP kullan?c? ad? bulunamad?"
    elif not has_password:
        status_value = "error"
        connection["error_type"] = "missing_password"
        connection["error_message"] = "IMAP ?ifresi bulunamad?"
        if is_gmail:
            hints.append("Gmail i?in app password tan?mlanmad?ysa auth ba?ar?s?z olur.")
    else:
        mailbox = None
        try:
            if use_ssl:
                try:
                    mailbox = imaplib.IMAP4_SSL(imap_host, port, timeout=12)
                except TypeError:
                    mailbox = imaplib.IMAP4_SSL(imap_host, port)
            else:
                try:
                    mailbox = imaplib.IMAP4(imap_host, port, timeout=12)
                except TypeError:
                    mailbox = imaplib.IMAP4(imap_host, port)

            mailbox.login(username, password_value)
            mailbox.select((account.mailbox_folder or "INBOX").strip() or "INBOX")
            connection["success"] = True
            connection["error_type"] = None
            connection["error_message"] = None
        except Exception as exc:
            status_value = "error"
            message = str(exc)
            lowered = message.lower()
            connection["error_type"] = "imap_connection_error"
            connection["error_message"] = message
            if "authenticationfailed" in lowered or "invalid credentials" in lowered:
                if is_gmail:
                    hints.append(
                        "Gmail auth hatas?: 2FA a??k hesapta app password kullan?n."
                    )
                    hints.append(
                        "Gmail IMAP ayar? a??k olmal? ve kullan?c? ad? tam e-posta olmal?."
                    )
                else:
                    hints.append(
                        "Kimlik bilgilerini ve IMAP kullan?c? ad?n? tekrar kontrol edin."
                    )
            if "certificate" in lowered or "ssl" in lowered:
                hints.append(
                    "SSL/TLS sertifika veya port uyumsuzlugu olabilir; 993/SSL degerlerini kontrol edin."
                )
        finally:
            if mailbox is not None:
                try:
                    mailbox.close()
                except Exception:
                    pass
                try:
                    mailbox.logout()
                except Exception:
                    pass

    if is_gmail and has_password and len(password_value.replace(" ", "")) < 16:
        hints.append(
            "Gmail app password genellikle 16 karakterdir; normal hesap ?ifresi ?al??mayabilir."
        )

    return {
        "status": status_value,
        "account_id": account.id,
        "email": account.email,
        "imap_host": imap_host or None,
        "imap_port": port,
        "imap_use_ssl": use_ssl,
        "imap_username": username or None,
        "mailbox_folder": (account.mailbox_folder or "INBOX").strip() or "INBOX",
        "checks": {
            "has_imap_host": bool(imap_host),
            "has_username": bool(username),
            "has_password": has_password,
        },
        "connection": connection,
        "hints": hints,
    }


@router.get("/accounts")
def list_mail_accounts(
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    if not _is_super_admin_identity(current_user):
        try:
            _upsert_personal_smtp_account(db, current_user)
        except Exception:
            db.rollback()

    result: list[dict] = []

    # System Email accounts (super admin eklediği)
    accounts = _list_accounts_for_principal(db, current_user)

    for account in accounts:
        settings = _resolve_email_settings_for_account(db, account)
        inbound_count = (
            db.query(SystemEmailMessage)
            .filter(
                SystemEmailMessage.system_email_id == account.id,
                SystemEmailMessage.direction == "inbound",
            )
            .count()
        )
        unread_count = (
            db.query(SystemEmailMessage)
            .filter(
                SystemEmailMessage.system_email_id == account.id,
                SystemEmailMessage.direction == "inbound",
                SystemEmailMessage.is_read.is_(False),
                SystemEmailMessage.status.notin_(["archived", "spam", "deleted"]),
            )
            .count()
        )
        outbound_count = (
            db.query(SystemEmailMessage)
            .filter(
                SystemEmailMessage.system_email_id == account.id,
                SystemEmailMessage.direction == "outbound",
            )
            .count()
        )
        result.append(
            {
                "id": account.id,
                "email": account.email,
                "description": account.description or "Sistem E-postası",
                "is_active": account.is_active,
                "account_type": "system",
                "imap_host": settings.imap_host if settings else None,
                "imap_port": settings.imap_port if settings else None,
                "imap_username": account.email,
                "imap_use_ssl": settings.incoming_use_ssl if settings else True,
                "mailbox_folder": "INBOX",
                "last_inbox_sync_at": account.last_inbox_sync_at,
                "last_inbox_error": account.last_inbox_error,
                "inbound_count": inbound_count,
                "unread_count": unread_count,
                "outbound_count": outbound_count,
            }
        )

    return result


@router.get("/dashboard-mail-button")
def get_dashboard_mail_button_config(
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    default_settings = (
        db.query(EmailSettings).filter(EmailSettings.owner_user_id.is_(None)).first()
    )
    enabled = (
        True
        if default_settings is None
        else bool(default_settings.dashboard_mail_button_enabled)
    )
    return {"dashboard_mail_button_enabled": enabled}


@router.get("/company-mail-visibility")
def list_company_mail_visibility(
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu alan sadece super admin icindir",
        )
    _ensure_super_admin(current_user)
    tenants = db.query(Tenant.id, Tenant.legal_name, Tenant.brand_name).all()
    tenant_name_by_id = {
        row.id: (row.brand_name or row.legal_name or f"Tenant #{row.id}")
        for row in tenants
    }
    rows = (
        db.query(Company)
        .order_by(
            Company.tenant_id.asc(), Company.is_primary.desc(), Company.name.asc()
        )
        .all()
    )
    return [
        {
            "company_id": row.id,
            "company_name": row.name,
            "tenant_id": row.tenant_id,
            "tenant_name": tenant_name_by_id.get(row.tenant_id)
            if row.tenant_id is not None
            else "Platform",
            "is_primary": bool(row.is_primary),
            "is_active": bool(row.is_active),
            "enabled": bool(row.mailbox_team_visibility_enabled),
        }
        for row in rows
    ]


@router.patch("/company-mail-visibility/{company_id}")
def update_company_mail_visibility(
    company_id: int,
    payload: CompanyMailVisibilityPayload,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    if not isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu alan sadece super admin icindir",
        )
    _ensure_super_admin(current_user)
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Firma bulunamad?")
    company.mailbox_team_visibility_enabled = bool(payload.enabled)
    db.add(company)
    db.commit()
    db.refresh(company)
    return {
        "company_id": company.id,
        "enabled": bool(company.mailbox_team_visibility_enabled),
    }


@router.get("/accounts/{account_id}/messages")
def list_mail_messages(
    account_id: int,
    direction: str = "all",
    limit: int = 50,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    query = db.query(SystemEmailMessage).filter(
        SystemEmailMessage.system_email_id == account_id
    )
    if direction in {"inbound", "outbound"}:
        query = query.filter(SystemEmailMessage.direction == direction)
    rows = (
        query.order_by(SystemEmailMessage.created_at.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return rows


@router.post("/accounts/{account_id}/sync")
def sync_mail_account(
    account_id: int,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    settings = _resolve_email_settings_for_account(db, account)
    if (
        not settings
        or not settings.imap_host
        or not account.email
        or not account.password
    ):
        raise HTTPException(status_code=400, detail="IMAP ayarlari eksik")

    added = 0
    try:
        mailbox = _open_mailbox_connection(account, settings)
        status_code, data = mailbox.search(None, "ALL")
        if status_code != "OK":
            raise RuntimeError("IMAP mailbox aramasi basarisiz")
        message_uids = [item for item in (data[0] or b"").split() if item][-50:]
        for uid in message_uids:
            uid_text = uid.decode("utf-8", errors="ignore")
            exists = (
                db.query(SystemEmailMessage)
                .filter(
                    SystemEmailMessage.system_email_id == account.id,
                    SystemEmailMessage.direction == "inbound",
                    SystemEmailMessage.message_uid == uid_text,
                )
                .first()
            )
            if exists:
                continue
            fetch_status, message_data = mailbox.fetch(uid, "(RFC822)")
            if fetch_status != "OK" or not message_data or not message_data[0]:
                continue
            raw_message = message_data[0][1]
            parsed = email.message_from_bytes(raw_message)
            subject = _decode_header_value(parsed.get("Subject"))
            from_email = parseaddr(parsed.get("From"))[1] or parsed.get("From")
            to_email = parseaddr(parsed.get("To"))[1] or parsed.get("To")
            cc_email = parsed.get("Cc")
            body_text = _extract_plain_text(parsed).strip()
            body_html = _extract_html_text(parsed).strip()
            attachments = _extract_attachment_metadata(parsed)
            snippet = body_text[:280]
            external_message_id = str(parsed.get("Message-ID") or "").strip() or None
            in_reply_to = str(parsed.get("In-Reply-To") or "").strip() or None
            references_header = str(parsed.get("References") or "").strip() or None
            db.add(
                SystemEmailMessage(
                    system_email_id=account.id,
                    direction="inbound",
                    message_uid=uid_text,
                    external_message_id=external_message_id,
                    status="received",
                    subject=subject,
                    from_email=from_email,
                    to_email=to_email,
                    cc_email=cc_email,
                    snippet=snippet,
                    body_text=body_text,
                    body_html=body_html,
                    attachments_json=json.dumps(attachments, ensure_ascii=True),
                    thread_key=_compute_thread_key(parsed) or external_message_id,
                    in_reply_to=in_reply_to,
                    references_header=references_header,
                    received_at=utcnow(),
                    is_read=False,
                )
            )
            added += 1
        mailbox.close()
        mailbox.logout()
        account.last_inbox_sync_at = utcnow().isoformat()
        account.last_inbox_error = None
        db.commit()
        return {
            "status": "success",
            "synced": added,
            "message": f"{added} yeni e-posta senkronlandi",
        }
    except Exception as exc:
        account.last_inbox_error = str(exc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Inbox sync basarisiz: {exc}")


@router.get("/accounts/{account_id}/diagnose")
def diagnose_mail_account(
    account_id: int,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    settings = _resolve_email_settings_for_account(db, account)
    return _diagnose_mailbox_connection(account, settings)


@router.post("/accounts/{account_id}/send-test")
def send_test_mail_from_account(
    account_id: int,
    payload: MailCenterSendPayload,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    sent = email_service.send_custom_email(
        to_email=payload.to_email,
        subject=payload.subject,
        body=payload.body,
        cc=payload.cc,
        owner_user_id=account.owner_user_id,
        system_email_id=account.id,
    )
    if not sent:
        raise HTTPException(status_code=500, detail="E-posta g?nderilemedi")
    message = SystemEmailMessage(
        system_email_id=account.id,
        direction="outbound",
        status="sent",
        subject=payload.subject,
        from_email=account.email,
        to_email=payload.to_email,
        cc_email=payload.cc,
        snippet=(payload.body or "").strip()[:280],
        body_text=payload.body,
        body_html=f"<div style=\"white-space: pre-wrap; font-family: Arial, sans-serif;\">{html.escape(payload.body or '')}</div>",
        thread_key=f"outbound-{account.id}-{int(utcnow().timestamp())}",
        sent_at=utcnow(),
        is_read=True,
    )
    db.add(message)
    db.commit()
    return {"status": "success", "message": "Test e-postas? g?nderildi"}


@router.patch("/accounts/{account_id}/messages/{message_id}")
def update_mail_message(
    account_id: int,
    message_id: int,
    payload: MailCenterMessageActionPayload,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    message = (
        db.query(SystemEmailMessage)
        .filter(
            SystemEmailMessage.id == message_id,
            SystemEmailMessage.system_email_id == account.id,
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Mail mesaj? bulunamad?")

    action = (payload.action or "").strip().lower()
    action_status_map = {
        "archive": "archived",
        "trash": "deleted",
        "delete": "deleted",
        "spam": "spam",
        "restore": "received" if message.direction == "inbound" else "sent",
        "unread": message.status,
        "read": message.status,
        "star": message.status,
        "unstar": message.status,
        "important": message.status,
        "unimportant": message.status,
    }
    if action not in action_status_map:
        raise HTTPException(status_code=400, detail="Gecersiz mail aksiyonu")

    next_status = action_status_map[action]
    if next_status:
        message.status = next_status
    if payload.is_read is not None:
        message.is_read = bool(payload.is_read)
    elif action == "read":
        message.is_read = True
    elif action == "unread":
        message.is_read = False
    else:
        message.is_read = (
            True
            if action in {"archive", "trash", "delete", "spam"}
            else message.is_read
        )

    if payload.is_starred is not None:
        message.is_starred = bool(payload.is_starred)
    elif action == "star":
        message.is_starred = True
    elif action == "unstar":
        message.is_starred = False

    if payload.is_important is not None:
        message.is_important = bool(payload.is_important)
    elif action == "important":
        message.is_important = True
    elif action == "unimportant":
        message.is_important = False

    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get(
    "/accounts/{account_id}/messages/{message_id}/attachments/{attachment_index}"
)
def download_mail_attachment(
    account_id: int,
    message_id: int,
    attachment_index: int,
    disposition: str = Query("attachment"),
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    _ensure_mail_center_access(current_user)
    account = _ensure_account_access(
        current_user, _get_account_or_404(db, account_id), db
    )
    message = (
        db.query(SystemEmailMessage)
        .filter(
            SystemEmailMessage.id == message_id,
            SystemEmailMessage.system_email_id == account.id,
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Mail mesaj? bulunamad?")
    if not message.message_uid:
        raise HTTPException(
            status_code=400, detail="Bu mesaj icin attachment indirilemiyor"
        )

    settings = _resolve_email_settings_for_account(db, account)
    if not settings:
        raise HTTPException(status_code=400, detail="IMAP ayarlari eksik")

    mailbox = None
    try:
        mailbox = _open_mailbox_connection(account, settings)
        fetch_status, message_data = mailbox.fetch(
            message.message_uid.encode("utf-8"), "(RFC822)"
        )
        if fetch_status != "OK" or not message_data or not message_data[0]:
            raise HTTPException(
                status_code=404, detail="Mesaj i?eri?i IMAP ?zerinden al?namad?"
            )
        raw_message = message_data[0][1]
        parsed = email.message_from_bytes(raw_message)
        attachments = []
        for part in parsed.walk():
            content_disposition = str(part.get("Content-Disposition", "")).lower()
            if "attachment" not in content_disposition:
                continue
            attachments.append(part)
        if attachment_index < 0 or attachment_index >= len(attachments):
            raise HTTPException(status_code=404, detail="Attachment bulunamad?")
        attachment_part = attachments[attachment_index]
        filename = (
            _decode_header_value(attachment_part.get_filename())
            or f"attachment-{attachment_index + 1}"
        )
        content_type = attachment_part.get_content_type() or "application/octet-stream"
        payload = attachment_part.get_payload(decode=True) or b""
        header_disposition = "inline" if disposition == "inline" else "attachment"
        return Response(
            content=payload,
            media_type=content_type,
            headers={
                "Content-Disposition": f'{header_disposition}; filename="{filename}"'
            },
        )
    finally:
        if mailbox is not None:
            try:
                mailbox.close()
            except Exception:
                pass
            try:
                mailbox.logout()
            except Exception:
                pass
