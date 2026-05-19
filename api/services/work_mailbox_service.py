import re
import secrets
import unicodedata
from typing import Any

from sqlalchemy.orm import Session

from api.models.email_settings import EmailSettings
from api.models.system_email import SystemEmail
from api.models.supplier import Supplier, SupplierUser
from api.models.tenant import Tenant
from api.models.user import User
from api.services.mailbox_provisioning_service import provision_mailbox


def _slug_token(value: str | None, *, max_len: int = 18, fallback: str = "user") -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return fallback
    normalized = unicodedata.normalize("NFKD", raw)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    token = re.sub(r"[^a-z0-9]+", "_", ascii_only).strip("_")
    token = re.sub(r"_+", "_", token)
    return (token[:max_len] or fallback).strip("_") or fallback


def _role_alias(role_hint: str | None, system_role: str | None = None) -> str:
    normalized = f"{role_hint or ''} {system_role or ''}".strip().lower()
    if "owner" in normalized:
        return "owner"
    if "supplier" in normalized or "tedarik" in normalized:
        return "supplier"
    if (
        "partner" in normalized
        or "stratejik" in normalized
        or "is_ortagi" in normalized
    ):
        return "partner"
    if "admin" in normalized:
        return "admin"
    return "member"


def _derive_mail_domain(db: Session) -> str:
    default_profile = (
        db.query(EmailSettings)
        .filter(EmailSettings.owner_user_id.is_(None))
        .order_by(EmailSettings.id.asc())
        .first()
    )
    candidate = ""
    if default_profile is not None:
        candidate = (default_profile.mail_domain or "").strip().lower()
        if not candidate:
            from_email = (default_profile.from_email or "").strip().lower()
            if "@" in from_email:
                candidate = from_email.split("@", 1)[1]
    return candidate or "buyerasistans.com.tr"


def _resolve_settings(db: Session, owner_user_id: int | None) -> EmailSettings | None:
    if owner_user_id is not None:
        scoped = (
            db.query(EmailSettings)
            .filter(EmailSettings.owner_user_id == owner_user_id)
            .first()
        )
        if scoped is not None:
            return scoped
    return db.query(EmailSettings).filter(EmailSettings.owner_user_id.is_(None)).first()


def _build_local_part(
    company_name: str | None, person_name: str | None, role_value: str
) -> str:
    company_token = _slug_token(company_name, max_len=20, fallback="firma")
    person_token = _slug_token(person_name, max_len=12, fallback="kullanici")
    combined = f"{company_token}_{person_token}_{role_value}".strip("_")
    return combined[:48].strip("_") or "firma_kullanici_member"


def _build_mailbox_seed_password(local_part: str) -> str:
    prefix = (local_part[:4] or "mail").capitalize()
    return f"{prefix}!{secrets.token_hex(6)}A9#"


def _ensure_unique_email(db: Session, email_address: str) -> str:
    local_part, _, domain = email_address.partition("@")
    local_part = local_part.strip().lower()
    domain = domain.strip().lower()
    candidate = f"{local_part}@{domain}"
    suffix = 1
    while (
        db.query(SystemEmail).filter(SystemEmail.email == candidate).first() is not None
    ):
        candidate = f"{local_part}{suffix}@{domain}"
        suffix += 1
    return candidate


def _persist_work_mailbox(
    db: Session,
    *,
    personal_email: str,
    work_email: str,
    owner_user_id: int | None,
    tenant_id: int | None,
    description: str,
) -> dict[str, Any] | None:
    existing = db.query(SystemEmail).filter(SystemEmail.email == work_email).first()
    if existing is not None:
        return None

    settings = _resolve_settings(db, owner_user_id)
    local_part = work_email.split("@", 1)[0]
    seed_password = _build_mailbox_seed_password(local_part)
    provisioning_result = provision_mailbox(settings, work_email, seed_password)
    effective_password = provisioning_result.effective_password or seed_password

    imap_host_value = None
    imap_port_value = 993
    imap_use_ssl_value = True
    if settings is not None:
        imap_host_value = (
            settings.imap_host or settings.smtp_host or ""
        ).strip() or None
        imap_port_value = settings.imap_port or 993
        imap_use_ssl_value = bool(
            settings.incoming_use_ssl if settings.incoming_use_ssl is not None else True
        )

    db.add(
        SystemEmail(
            email=work_email,
            password=effective_password,
            tenant_id=tenant_id,
            owner_user_id=owner_user_id,
            description=description,
            is_active=True,
            imap_host=imap_host_value,
            imap_port=imap_port_value,
            imap_username=work_email,
            imap_password=effective_password,
            imap_use_ssl=imap_use_ssl_value,
            mailbox_folder="INBOX",
            mailbox_provision_status=provisioning_result.status,
            mailbox_provision_message=provisioning_result.message,
        )
    )

    return {
        "personal_email": personal_email,
        "work_email": work_email,
        "password": effective_password,
        "mailbox_provision_status": provisioning_result.status,
        "mailbox_provision_message": provisioning_result.message,
    }


def ensure_user_work_mailbox(db: Session, user: User) -> dict[str, Any] | None:
    personal_email = str(user.email or "").strip().lower()
    if not personal_email:
        return None

    current_work_email = str(user.work_email or "").strip().lower()
    if current_work_email and current_work_email != personal_email:
        existing_work = (
            db.query(SystemEmail)
            .filter(SystemEmail.email == current_work_email)
            .first()
        )
        if existing_work is not None:
            return None

    tenant_name = None
    if user.tenant_id is not None:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant is not None:
            tenant_name = tenant.brand_name or tenant.legal_name

    domain = _derive_mail_domain(db)
    alias = _build_local_part(
        tenant_name or personal_email,
        user.full_name,
        _role_alias(user.role, user.system_role),
    )
    work_email = _ensure_unique_email(db, f"{alias}@{domain}")

    result = _persist_work_mailbox(
        db,
        personal_email=personal_email,
        work_email=work_email,
        owner_user_id=user.id,
        tenant_id=user.tenant_id,
        description="Auto generated work mailbox",
    )
    if result is not None and (
        not current_work_email or current_work_email == personal_email
    ):
        user.work_email = work_email
    return result


def ensure_supplier_user_work_mailbox(
    db: Session, supplier_user: SupplierUser
) -> dict[str, Any] | None:
    personal_email = str(supplier_user.email or "").strip().lower()
    if not personal_email:
        return None

    current_work_email = str(supplier_user.work_email or "").strip().lower()
    if current_work_email and current_work_email != personal_email:
        existing_work = (
            db.query(SystemEmail)
            .filter(SystemEmail.email == current_work_email)
            .first()
        )
        if existing_work is not None:
            return None

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if supplier is None:
        return None

    domain = _derive_mail_domain(db)
    alias = _build_local_part(
        supplier.company_name, supplier_user.name, _role_alias("supplier", None)
    )
    work_email = _ensure_unique_email(db, f"{alias}@{domain}")

    result = _persist_work_mailbox(
        db,
        personal_email=personal_email,
        work_email=work_email,
        owner_user_id=supplier.created_by_id,
        tenant_id=supplier.tenant_id,
        description="Auto generated supplier work mailbox",
    )
    if result is not None and (
        not current_work_email or current_work_email == personal_email
    ):
        supplier_user.work_email = work_email
    return result
