# FILE: /api/routers/advanced_settings_router.py
import os
import re
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import secrets
import smtplib
import imaplib
import poplib
import ssl
from smtplib import SMTPAuthenticationError, SMTPException, SMTPServerDisconnected
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
import socket
import subprocess
from pathlib import Path
from datetime import timedelta

from api.models import (
    EmailSettings,
    LoggingSettings,
    BackupSettings,
    NotificationSettings,
    APIKey,
    User,
    SystemEmail,
    SystemEmailMessage,
)
from api.models.supplier import SupplierUser
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.database import get_db
from api.core.authz import (
    TENANT_ADMIN_SYSTEM_ROLES,
    can_access_procurement_settings,
    can_access_quote_workspace,
    can_manage_shared_email_profiles,
)
from api.core.deps import get_any_user, get_current_user
from api.core.time import utcnow
from api.services.mailbox_provisioning_service import test_mailbox_provider_connection
from api.services.email_runtime_config import get_effective_email_config

router = APIRouter(prefix="/advanced-settings", tags=["advanced-settings"])

DEFAULT_SMTP_HOST = os.getenv("SMTP_SERVER", "buyerasistans.com.tr").strip().rstrip(".")
DEFAULT_SMTP_PORT = int(os.getenv("SMTP_PORT", "465") or 465)
DEFAULT_IMAP_HOST = os.getenv("MAIL_IMAP_HOST", DEFAULT_SMTP_HOST).strip().rstrip(".")
DEFAULT_IMAP_PORT = int(os.getenv("MAIL_IMAP_PORT", "993") or 993)
DEFAULT_POP3_HOST = os.getenv("MAIL_POP3_HOST", DEFAULT_SMTP_HOST).strip().rstrip(".")
DEFAULT_POP3_PORT = int(os.getenv("MAIL_POP3_PORT", "995") or 995)
DEFAULT_USE_SSL = os.getenv("SMTP_USE_SSL", "true").strip().lower() == "true"
DEFAULT_USE_TLS = os.getenv("SMTP_USE_TLS", "false").strip().lower() == "true"
DEFAULT_INCOMING_USE_SSL = (
    os.getenv("MAIL_INCOMING_USE_SSL", "true").strip().lower() == "true"
)
DEFAULT_MAILBOX_PROVIDER_TYPE = (
    os.getenv("MAILBOX_PROVIDER_TYPE", "plesk").strip().lower() or "none"
)
DEFAULT_MAILBOX_PROVIDER_URL = os.getenv("MAILBOX_PROVIDER_URL", "").strip()
DEFAULT_MAILBOX_PROVIDER_API_URL = os.getenv("MAILBOX_PROVIDER_API_URL", "").strip()
DEFAULT_MAILBOX_PROVIDER_USERNAME = os.getenv("MAILBOX_PROVIDER_USERNAME", "").strip()
DEFAULT_MAILBOX_PROVIDER_PASSWORD = os.getenv("MAILBOX_PROVIDER_PASSWORD", "").strip()
DEFAULT_MAILBOX_PROVIDER_API_TOKEN = os.getenv("MAILBOX_PROVIDER_API_TOKEN", "").strip()
DEFAULT_MAILBOX_PROVIDER_VERIFY_SSL = (
    os.getenv("MAILBOX_PROVIDER_VERIFY_SSL", "true").strip().lower() == "true"
)
DEFAULT_MAILBOX_PROVIDER_AUTO_CREATE = (
    os.getenv("MAILBOX_PROVIDER_AUTO_CREATE", "false").strip().lower() == "true"
)
DEFAULT_MAILBOX_PROVIDER_CUSTOM_ENDPOINT = os.getenv(
    "MAILBOX_PROVIDER_CUSTOM_ENDPOINT", ""
).strip()
PUBLIC_MAIL_PROVIDER_MAP = {
    "gmail.com": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 465,
        "use_ssl": True,
        "use_tls": False,
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
    },
    "googlemail.com": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 465,
        "use_ssl": True,
        "use_tls": False,
        "imap_host": "imap.gmail.com",
        "imap_port": 993,
    },
    "outlook.com": {
        "smtp_host": "smtp-mail.outlook.com",
        "smtp_port": 587,
        "use_ssl": False,
        "use_tls": True,
        "imap_host": "imap-mail.outlook.com",
        "imap_port": 993,
    },
    "hotmail.com": {
        "smtp_host": "smtp-mail.outlook.com",
        "smtp_port": 587,
        "use_ssl": False,
        "use_tls": True,
        "imap_host": "imap-mail.outlook.com",
        "imap_port": 993,
    },
    "live.com": {
        "smtp_host": "smtp-mail.outlook.com",
        "smtp_port": 587,
        "use_ssl": False,
        "use_tls": True,
        "imap_host": "imap-mail.outlook.com",
        "imap_port": 993,
    },
    "msn.com": {
        "smtp_host": "smtp-mail.outlook.com",
        "smtp_port": 587,
        "use_ssl": False,
        "use_tls": True,
        "imap_host": "imap-mail.outlook.com",
        "imap_port": 993,
    },
    "yandex.com": {
        "smtp_host": "smtp.yandex.com",
        "smtp_port": 465,
        "use_ssl": True,
        "use_tls": False,
        "imap_host": "imap.yandex.com",
        "imap_port": 993,
    },
    "yandex.com.tr": {
        "smtp_host": "smtp.yandex.com",
        "smtp_port": 465,
        "use_ssl": True,
        "use_tls": False,
        "imap_host": "imap.yandex.com",
        "imap_port": 993,
    },
    "yahoo.com": {
        "smtp_host": "smtp.mail.yahoo.com",
        "smtp_port": 465,
        "use_ssl": True,
        "use_tls": False,
        "imap_host": "imap.mail.yahoo.com",
        "imap_port": 993,
    },
    "icloud.com": {
        "smtp_host": "smtp.mail.me.com",
        "smtp_port": 587,
        "use_ssl": False,
        "use_tls": True,
        "imap_host": "imap.mail.me.com",
        "imap_port": 993,
    },
}


def _extract_mail_domain(*values: str | None) -> str:
    for value in values:
        raw = (value or "").strip().lower()
        if "@" in raw:
            return raw.split("@", 1)[1]
    return ""


def _apply_public_provider_defaults(settings: EmailSettings) -> None:
    domain = _extract_mail_domain(settings.smtp_username, settings.from_email)
    preset = PUBLIC_MAIL_PROVIDER_MAP.get(domain)
    if not preset:
        return
    if not (settings.smtp_host or "").strip():
        settings.smtp_host = preset["smtp_host"]
    if not settings.smtp_port:
        settings.smtp_port = int(preset["smtp_port"])
    if not (settings.imap_host or "").strip():
        settings.imap_host = preset["imap_host"]
    if not settings.imap_port:
        settings.imap_port = int(preset["imap_port"])
    settings.use_ssl = bool(preset["use_ssl"])
    settings.use_tls = bool(preset["use_tls"])
    settings.incoming_use_ssl = True
    if settings.mailbox_provider_type == "none":
        settings.mailbox_provider_url = None
        settings.mailbox_provider_api_url = None
        settings.mailbox_provider_username = None
        settings.mailbox_provider_password = None
        settings.mailbox_provider_api_token = None
        settings.mailbox_provider_custom_endpoint = None
        settings.mailbox_provider_auto_create = False


def _build_default_email_settings(owner_user_id: int | None) -> dict:
    return {
        "owner_user_id": owner_user_id,
        "smtp_host": DEFAULT_SMTP_HOST,
        "smtp_port": DEFAULT_SMTP_PORT,
        "imap_host": DEFAULT_IMAP_HOST,
        "imap_port": DEFAULT_IMAP_PORT,
        "pop3_host": DEFAULT_POP3_HOST,
        "pop3_port": DEFAULT_POP3_PORT,
        "smtp_username": "",
        "smtp_password": "",
        "incoming_use_ssl": DEFAULT_INCOMING_USE_SSL,
        "from_email": "noreply@procureflow.com",
        "from_name": "ProcureFlow",
        "use_tls": DEFAULT_USE_TLS,
        "use_ssl": DEFAULT_USE_SSL,
        "enable_email_notifications": False,
        "dashboard_mail_button_enabled": True,
        "mail_domain": "",
        "app_url": "",
        "use_custom_app_url": False,
        "reply_to_email": "",
        "bounce_email": "",
        "mailbox_support_email": "",
        "enable_list_unsubscribe": True,
        "enable_strict_from_alignment": True,
        "mailbox_provider_type": DEFAULT_MAILBOX_PROVIDER_TYPE,
        "mailbox_provider_url": DEFAULT_MAILBOX_PROVIDER_URL,
        "mailbox_provider_api_url": DEFAULT_MAILBOX_PROVIDER_API_URL,
        "mailbox_provider_username": DEFAULT_MAILBOX_PROVIDER_USERNAME,
        "mailbox_provider_password": DEFAULT_MAILBOX_PROVIDER_PASSWORD,
        "mailbox_provider_api_token": DEFAULT_MAILBOX_PROVIDER_API_TOKEN,
        "mailbox_provider_verify_ssl": DEFAULT_MAILBOX_PROVIDER_VERIFY_SSL,
        "mailbox_provider_auto_create": DEFAULT_MAILBOX_PROVIDER_AUTO_CREATE,
        "mailbox_provider_custom_endpoint": DEFAULT_MAILBOX_PROVIDER_CUSTOM_ENDPOINT,
    }


def _inherit_default_email_profile(db: Session, owner_user_id: int | None) -> dict:
    defaults = _build_default_email_settings(owner_user_id)
    if owner_user_id is None:
        return defaults

    system_default = (
        db.query(EmailSettings).filter(EmailSettings.owner_user_id.is_(None)).first()
    )
    if not system_default:
        return defaults

    defaults.update(
        {
            "smtp_host": system_default.smtp_host or defaults["smtp_host"],
            "smtp_port": system_default.smtp_port or defaults["smtp_port"],
            "imap_host": system_default.imap_host or defaults["imap_host"],
            "imap_port": system_default.imap_port or defaults["imap_port"],
            "pop3_host": system_default.pop3_host or defaults["pop3_host"],
            "pop3_port": system_default.pop3_port or defaults["pop3_port"],
            "incoming_use_ssl": bool(system_default.incoming_use_ssl),
            "use_tls": bool(system_default.use_tls),
            "use_ssl": bool(system_default.use_ssl),
            "dashboard_mail_button_enabled": bool(
                system_default.dashboard_mail_button_enabled
            ),
            "from_name": system_default.from_name or defaults["from_name"],
            "reply_to_email": system_default.reply_to_email or "",
            "bounce_email": system_default.bounce_email or "",
            "mailbox_support_email": system_default.mailbox_support_email or "",
            "enable_list_unsubscribe": bool(system_default.enable_list_unsubscribe),
            "enable_strict_from_alignment": bool(
                system_default.enable_strict_from_alignment
            ),
            "mailbox_provider_type": system_default.mailbox_provider_type
            or defaults["mailbox_provider_type"],
            "mailbox_provider_url": system_default.mailbox_provider_url or "",
            "mailbox_provider_api_url": system_default.mailbox_provider_api_url or "",
            "mailbox_provider_username": system_default.mailbox_provider_username or "",
            "mailbox_provider_password": system_default.mailbox_provider_password or "",
            "mailbox_provider_api_token": system_default.mailbox_provider_api_token
            or "",
            "mailbox_provider_verify_ssl": bool(
                system_default.mailbox_provider_verify_ssl
            ),
            "mailbox_provider_auto_create": bool(
                system_default.mailbox_provider_auto_create
            ),
            "mailbox_provider_custom_endpoint": system_default.mailbox_provider_custom_endpoint
            or "",
            "signature_name": system_default.signature_name or "",
            "signature_title": system_default.signature_title or "",
            "signature_note": system_default.signature_note or "",
            "signature_image_url": system_default.signature_image_url or "",
        }
    )
    return defaults


def _serialize_email_settings(
    settings: EmailSettings, current_user: User, *, include_sensitive: bool = True
) -> dict:
    effective = asdict(get_effective_email_config(owner_user_id=settings.owner_user_id))
    is_shared_profile_admin = can_manage_shared_email_profiles(current_user)
    return {
        "id": settings.id,
        "owner_user_id": settings.owner_user_id,
        "smtp_host": settings.smtp_host or effective["smtp_host"],
        "smtp_port": settings.smtp_port or effective["smtp_port"],
        "imap_host": settings.imap_host or effective["smtp_host"],
        "imap_port": settings.imap_port or 993,
        "pop3_host": settings.pop3_host,
        "pop3_port": settings.pop3_port,
        "smtp_username": settings.smtp_username,
        "smtp_password": settings.smtp_password if include_sensitive else "",
        "incoming_use_ssl": settings.incoming_use_ssl,
        "from_email": settings.from_email,
        "from_name": settings.from_name,
        "use_tls": settings.use_tls,
        "use_ssl": settings.use_ssl,
        "enable_email_notifications": settings.enable_email_notifications,
        "dashboard_mail_button_enabled": bool(settings.dashboard_mail_button_enabled),
        "mail_domain": settings.mail_domain if is_shared_profile_admin else "",
        "app_url": settings.app_url if is_shared_profile_admin else "",
        "use_custom_app_url": settings.use_custom_app_url
        if is_shared_profile_admin
        else False,
        "reply_to_email": settings.reply_to_email,
        "bounce_email": settings.bounce_email,
        "mailbox_support_email": settings.mailbox_support_email,
        "enable_list_unsubscribe": settings.enable_list_unsubscribe,
        "enable_strict_from_alignment": settings.enable_strict_from_alignment,
        "mailbox_provider_type": settings.mailbox_provider_type,
        "mailbox_provider_url": settings.mailbox_provider_url,
        "mailbox_provider_api_url": settings.mailbox_provider_api_url,
        "mailbox_provider_username": settings.mailbox_provider_username,
        "mailbox_provider_password": settings.mailbox_provider_password
        if include_sensitive
        else "",
        "mailbox_provider_api_token": settings.mailbox_provider_api_token
        if include_sensitive
        else "",
        "mailbox_provider_verify_ssl": settings.mailbox_provider_verify_ssl,
        "mailbox_provider_auto_create": settings.mailbox_provider_auto_create,
        "mailbox_provider_custom_endpoint": settings.mailbox_provider_custom_endpoint,
        "signature_name": settings.signature_name,
        "signature_title": settings.signature_title,
        "signature_note": settings.signature_note,
        "signature_image_url": settings.signature_image_url,
        "updated_at": getattr(settings, "updated_at", None),
    }


def _serialize_email_settings_for_supplier(settings: EmailSettings) -> dict:
    effective = asdict(get_effective_email_config(owner_user_id=settings.owner_user_id))
    return {
        "id": settings.id,
        "owner_user_id": settings.owner_user_id,
        "smtp_host": settings.smtp_host or effective["smtp_host"],
        "smtp_port": settings.smtp_port or effective["smtp_port"],
        "imap_host": settings.imap_host or effective["smtp_host"],
        "imap_port": settings.imap_port or 993,
        "pop3_host": settings.pop3_host,
        "pop3_port": settings.pop3_port,
        "smtp_username": settings.smtp_username,
        "smtp_password": "",
        "incoming_use_ssl": settings.incoming_use_ssl,
        "from_email": settings.from_email,
        "from_name": settings.from_name,
        "use_tls": settings.use_tls,
        "use_ssl": settings.use_ssl,
        "enable_email_notifications": settings.enable_email_notifications,
        "dashboard_mail_button_enabled": bool(settings.dashboard_mail_button_enabled),
        "mail_domain": "",
        "app_url": "",
        "use_custom_app_url": False,
        "reply_to_email": settings.reply_to_email,
        "bounce_email": settings.bounce_email,
        "mailbox_support_email": settings.mailbox_support_email,
        "enable_list_unsubscribe": settings.enable_list_unsubscribe,
        "enable_strict_from_alignment": settings.enable_strict_from_alignment,
        "mailbox_provider_type": settings.mailbox_provider_type,
        "mailbox_provider_url": settings.mailbox_provider_url,
        "mailbox_provider_api_url": settings.mailbox_provider_api_url,
        "mailbox_provider_username": settings.mailbox_provider_username,
        "mailbox_provider_password": "",
        "mailbox_provider_api_token": "",
        "mailbox_provider_verify_ssl": settings.mailbox_provider_verify_ssl,
        "mailbox_provider_auto_create": settings.mailbox_provider_auto_create,
        "mailbox_provider_custom_endpoint": settings.mailbox_provider_custom_endpoint,
        "signature_name": settings.signature_name,
        "signature_title": settings.signature_title,
        "signature_note": settings.signature_note,
        "signature_image_url": settings.signature_image_url,
        "updated_at": getattr(settings, "updated_at", None),
    }


def _ensure_admin(current_user: User) -> User:
    """Admin check function"""
    if not can_access_procurement_settings(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gerekli",
        )
    return current_user


def _ensure_email_settings_access(current_user: User) -> User:
    if not (
        can_access_procurement_settings(current_user)
        or can_access_quote_workspace(current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için e-posta ayarları yetkisi gerekli",
        )
    return current_user


def _ensure_email_settings_write_access(
    current_user: User, target_owner_id: int | None = None
) -> User:
    """Check write access for email settings. Own profile requires quote_workspace access, system profile requires procurement access."""
    # If updating own profile
    if target_owner_id == current_user.id:
        if not can_access_quote_workspace(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kendi profil e-posta ayarlarını güncellemek için erişim yetkisi gerekli",
            )
        return current_user

    # If updating system profile or other profiles
    if not can_access_procurement_settings(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sistem e-posta ayarlarını güncellemek için yönetici yetkisi gerekli",
        )
    return current_user


def _resolve_email_profile_owner(
    current_user: User, owner_user_id: int | None = None
) -> int | None:
    if can_manage_shared_email_profiles(current_user):
        return owner_user_id
    return current_user.id


def _resolve_email_profile_owner_for_read(
    current_user: User, owner_user_id: int | None = None
) -> int | None:
    if can_manage_shared_email_profiles(current_user):
        return owner_user_id
    # Super admin disindaki kullanici, owner_user_id=None verirse varsayilan sistemi salt-okur gorur.
    if owner_user_id is None:
        return None
    return current_user.id


def _get_or_create_settings(
    db: Session,
    model_class,
    setting_type: str = "default",
    owner_user_id: int | None = None,
):
    """Generic function to get or create singleton settings"""
    settings_query = db.query(model_class)
    if model_class == EmailSettings:
        if owner_user_id is None:
            settings_query = settings_query.filter(
                EmailSettings.owner_user_id.is_(None)
            )
        else:
            settings_query = settings_query.filter(
                EmailSettings.owner_user_id == owner_user_id
            )
    settings = settings_query.first()
    if not settings:
        if model_class == EmailSettings:
            settings = EmailSettings(
                **_inherit_default_email_profile(db, owner_user_id)
            )
        elif model_class == LoggingSettings:
            settings = LoggingSettings(
                log_level="INFO",
                log_retention_days=30,
                enable_file_logging=True,
                enable_database_logging=False,
                enable_syslog=False,
                log_api_requests=False,
                log_database_queries=False,
                log_user_actions=True,
            )
        elif model_class == BackupSettings:
            settings = BackupSettings(
                enable_automatic_backup=True,
                backup_frequency="daily",
                backup_time="02:00",
                backup_location="/backups",
                keep_last_n_backups=7,
                compress_backups=True,
                encrypt_backups=False,
            )
        elif model_class == NotificationSettings:
            settings = NotificationSettings(
                notify_on_quote_created=True,
                notify_on_quote_response=True,
                notify_on_quote_approved=True,
                notify_on_quote_rejected=False,
                notify_on_contract_created=True,
                notify_on_contract_signed=True,
                notify_on_system_errors=True,
                notify_on_maintenance=False,
                enable_daily_digest=False,
                digest_time="09:00",
            )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


# ============================================================================
# EMAIL SETTINGS ENDPOINTS
# ============================================================================


@router.get("/email", response_model=dict)
async def get_email_settings(
    owner_user_id: int | None = None,
    current_user: User | SupplierUser = Depends(get_any_user),
    db: Session = Depends(get_db),
):
    """Get email (SMTP) settings - Admin only"""
    if isinstance(current_user, SupplierUser):
        settings = _get_or_create_settings(db, EmailSettings, owner_user_id=None)
        return _serialize_email_settings_for_supplier(settings)
    _ensure_email_settings_access(current_user)
    resolved_owner_id = _resolve_email_profile_owner_for_read(
        current_user, owner_user_id
    )
    settings = _get_or_create_settings(
        db, EmailSettings, owner_user_id=resolved_owner_id
    )
    return _serialize_email_settings(settings, current_user)


@router.get("/email/profiles", response_model=list[dict])
async def list_email_profiles(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    _ensure_email_settings_access(current_user)
    if not can_manage_shared_email_profiles(current_user):
        default_settings = _get_or_create_settings(
            db, EmailSettings, owner_user_id=None
        )
        settings = _get_or_create_settings(
            db, EmailSettings, owner_user_id=current_user.id
        )
        return [
            {
                "owner_user_id": None,
                "label": "Varsayılan Sistem SMTP (salt okunur)",
                "kind": "default",
                "from_email": default_settings.from_email,
            },
            {
                "owner_user_id": current_user.id,
                "label": "Kendi SMTP profilim",
                "kind": "personal",
                "from_email": settings.from_email,
            },
        ]

    rows = db.query(EmailSettings).all()
    users = {
        row.id: row
        for row in db.query(User)
        .filter(User.system_role.in_(tuple(TENANT_ADMIN_SYSTEM_ROLES)))
        .all()
    }
    profiles: list[dict] = []
    default_row = next((row for row in rows if row.owner_user_id is None), None)
    if default_row is None:
        default_row = _get_or_create_settings(db, EmailSettings, owner_user_id=None)
    profiles.append(
        {
            "owner_user_id": None,
            "label": "Varsayılan Sistem SMTP",
            "kind": "default",
            "from_email": default_row.from_email,
        }
    )
    for admin_id, admin_user in users.items():
        row = next((item for item in rows if item.owner_user_id == admin_id), None)
        company_names = [
            name
            for (name,) in db.query(Company.name)
            .join(CompanyRole, CompanyRole.company_id == Company.id)
            .filter(CompanyRole.user_id == admin_id, CompanyRole.is_active.is_(True))
            .distinct()
            .order_by(Company.name.asc())
            .all()
        ]
        company_suffix = f" ({', '.join(company_names)})" if company_names else ""
        profiles.append(
            {
                "owner_user_id": admin_id,
                "label": f"Firma SMTP: {admin_user.full_name}{company_suffix}",
                "kind": "personal",
                "from_email": row.from_email if row else "",
            }
        )
    return profiles


@router.put("/email", response_model=dict)
async def update_email_settings(
    data: dict = Body(...),
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update email (SMTP) settings - Own profile requires quote_workspace access, system profile requires procurement access"""
    resolved_owner_id = _resolve_email_profile_owner(current_user, owner_user_id)
    _ensure_email_settings_write_access(current_user, resolved_owner_id)
    settings = _get_or_create_settings(
        db, EmailSettings, owner_user_id=resolved_owner_id
    )

    # Update fields (hem veritabanı hem .env için toplanacak)
    env_updates = {}
    if "smtp_host" in data:
        settings.smtp_host = data["smtp_host"]
        env_updates["SMTP_SERVER"] = data["smtp_host"]
    if "smtp_port" in data:
        settings.smtp_port = data["smtp_port"]
        env_updates["SMTP_PORT"] = str(data["smtp_port"])
    if "imap_host" in data:
        settings.imap_host = (data["imap_host"] or "").strip()
    if "imap_port" in data:
        settings.imap_port = data["imap_port"]
    if "pop3_host" in data:
        settings.pop3_host = (data["pop3_host"] or "").strip()
    if "pop3_port" in data:
        settings.pop3_port = data["pop3_port"]
    if "smtp_username" in data:
        settings.smtp_username = data["smtp_username"]
        env_updates["SENDER_EMAIL"] = data["smtp_username"]
    if "smtp_password" in data:
        settings.smtp_password = data["smtp_password"]
        env_updates["SENDER_PASSWORD"] = data["smtp_password"]
    if "incoming_use_ssl" in data:
        settings.incoming_use_ssl = bool(data["incoming_use_ssl"])
    if "from_email" in data:
        settings.from_email = data["from_email"]
        # .env'de FROM_EMAIL varsa güncellenebilir
        env_updates["FROM_EMAIL"] = data["from_email"]
    if "from_name" in data:
        settings.from_name = data["from_name"]
        env_updates["MAIL_FROM_NAME"] = data["from_name"]
    if "use_tls" in data:
        settings.use_tls = data["use_tls"]
        env_updates["SMTP_USE_TLS"] = str(data["use_tls"]).lower()
    if "use_ssl" in data:
        settings.use_ssl = data["use_ssl"]
        env_updates["SMTP_USE_SSL"] = str(data["use_ssl"]).lower()
    if "enable_email_notifications" in data:
        settings.enable_email_notifications = data["enable_email_notifications"]
    if "dashboard_mail_button_enabled" in data and can_manage_shared_email_profiles(
        current_user
    ):
        settings.dashboard_mail_button_enabled = bool(
            data["dashboard_mail_button_enabled"]
        )
    if can_manage_shared_email_profiles(current_user):
        if "mail_domain" in data:
            settings.mail_domain = (data["mail_domain"] or "").strip()
            env_updates["MAIL_DOMAIN"] = settings.mail_domain
        if "app_url" in data:
            settings.app_url = (data["app_url"] or "").strip()
            env_updates["APP_URL"] = settings.app_url
        if "use_custom_app_url" in data:
            settings.use_custom_app_url = bool(data["use_custom_app_url"])
    if "reply_to_email" in data:
        settings.reply_to_email = (data["reply_to_email"] or "").strip()
        env_updates["MAIL_REPLY_TO"] = settings.reply_to_email
    if "bounce_email" in data:
        settings.bounce_email = (data["bounce_email"] or "").strip()
        env_updates["MAIL_BOUNCE_EMAIL"] = settings.bounce_email
    if "mailbox_support_email" in data:
        settings.mailbox_support_email = (data["mailbox_support_email"] or "").strip()
        env_updates["MAILBOX_SUPPORT_EMAIL"] = settings.mailbox_support_email
    if "enable_list_unsubscribe" in data:
        settings.enable_list_unsubscribe = bool(data["enable_list_unsubscribe"])
    if "enable_strict_from_alignment" in data:
        settings.enable_strict_from_alignment = bool(
            data["enable_strict_from_alignment"]
        )
    if "mailbox_provider_type" in data:
        settings.mailbox_provider_type = (
            (data["mailbox_provider_type"] or "none").strip().lower()
        )
    if "mailbox_provider_url" in data:
        settings.mailbox_provider_url = (data["mailbox_provider_url"] or "").strip()
        env_updates["MAILBOX_PROVIDER_URL"] = settings.mailbox_provider_url
    if "mailbox_provider_api_url" in data:
        settings.mailbox_provider_api_url = (
            data["mailbox_provider_api_url"] or ""
        ).strip()
        env_updates["MAILBOX_PROVIDER_API_URL"] = settings.mailbox_provider_api_url
    if "mailbox_provider_username" in data:
        settings.mailbox_provider_username = (
            data["mailbox_provider_username"] or ""
        ).strip()
    if "mailbox_provider_password" in data:
        settings.mailbox_provider_password = (
            data["mailbox_provider_password"] or ""
        ).strip()
    if "mailbox_provider_api_token" in data:
        settings.mailbox_provider_api_token = (
            data["mailbox_provider_api_token"] or ""
        ).strip()
    if "mailbox_provider_verify_ssl" in data:
        settings.mailbox_provider_verify_ssl = bool(data["mailbox_provider_verify_ssl"])
    if "mailbox_provider_auto_create" in data:
        settings.mailbox_provider_auto_create = bool(
            data["mailbox_provider_auto_create"]
        )
    if "mailbox_provider_custom_endpoint" in data:
        settings.mailbox_provider_custom_endpoint = (
            data["mailbox_provider_custom_endpoint"] or ""
        ).strip()
    if "signature_name" in data:
        settings.signature_name = (data["signature_name"] or "").strip()
    if "signature_title" in data:
        settings.signature_title = (data["signature_title"] or "").strip()
    if "signature_note" in data:
        settings.signature_note = (data["signature_note"] or "").strip()
    if "signature_image_url" in data:
        settings.signature_image_url = (data["signature_image_url"] or "").strip()

    _apply_public_provider_defaults(settings)

    if hasattr(settings, "updated_at"):
        settings.updated_at = utcnow()
    if hasattr(settings, "updated_by_id"):
        settings.updated_by_id = current_user.id

    db.commit()
    db.refresh(settings)

    # Sadece varsayılan sistem profili .env dosyasını günceller.
    if resolved_owner_id is None:
        try:
            from api.utils.env_writer import update_env_file
            import os

            env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
            update_env_file(env_path, env_updates)
        except Exception as e:
            print(f"[ENV] .env dosyası güncellenemedi: {e}")

    return _serialize_email_settings(settings, current_user)


@router.post("/email/signature-image", response_model=dict)
async def upload_email_signature_image(
    file: UploadFile = File(...),
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_email_settings_access(current_user)
    resolved_owner_id = _resolve_email_profile_owner(current_user, owner_user_id)
    settings = _get_or_create_settings(
        db, EmailSettings, owner_user_id=resolved_owner_id
    )

    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, detail="Sadece resim dosyaları yüklenebilir"
        )

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="İmza görseli 2MB'dan büyük olamaz")

    upload_dir = Path("uploads") / "email_signatures"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "signature.png").suffix.lower() or ".png"
    filename = f"signature_{secrets.token_hex(8)}{ext}"
    file_path = upload_dir / filename
    file_path.write_bytes(content)

    settings.signature_image_url = (
        f"/api/v1/advanced-settings/email/signature-image/{filename}"
    )
    db.commit()
    return {"success": True, "signature_image_url": settings.signature_image_url}


@router.get("/email/signature-image/{filename}")
async def get_email_signature_image(filename: str):
    safe_filename = Path(filename).name
    if not re.fullmatch(r"signature_[0-9a-f]{16}\.(jpg|jpeg|png|gif|webp|svg)", safe_filename):
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")

    base_dir = (Path("uploads") / "email_signatures").resolve()
    file_path = (base_dir / safe_filename).resolve()

    try:
        file_path.relative_to(base_dir)
    except ValueError:
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")
    return FileResponse(file_path)


@router.post("/email/test", response_model=dict)
async def test_email_settings(
    data: dict = Body(...),
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Test email settings by sending a test email - Admin only"""
    _ensure_email_settings_access(current_user)

    # Accept either to_email or from_email
    to_email = data.get("to_email") or data.get("from_email")
    if not to_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="to_email alanı gerekli"
        )

    resolved_owner_id = _resolve_email_profile_owner(current_user, owner_user_id)
    settings = _get_or_create_settings(
        db, EmailSettings, owner_user_id=resolved_owner_id
    )
    effective_settings = {
        "smtp_host": (data.get("smtp_host") or settings.smtp_host or "").strip(),
        "smtp_port": data.get("smtp_port") or settings.smtp_port,
        "imap_host": (data.get("imap_host") or settings.imap_host or "").strip(),
        "imap_port": data.get("imap_port") or settings.imap_port,
        "pop3_host": (data.get("pop3_host") or settings.pop3_host or "").strip(),
        "pop3_port": data.get("pop3_port") or settings.pop3_port,
        "smtp_username": (
            data.get("smtp_username") or settings.smtp_username or ""
        ).strip(),
        "smtp_password": data.get("smtp_password") or settings.smtp_password,
        "from_email": (data.get("from_email") or settings.from_email or "").strip(),
        "from_name": (
            data.get("from_name") or settings.from_name or "ProcureFlow"
        ).strip()
        or "ProcureFlow",
        "use_tls": bool(data.get("use_tls") if "use_tls" in data else settings.use_tls),
        "use_ssl": bool(data.get("use_ssl") if "use_ssl" in data else settings.use_ssl),
    }

    # Provider-specific SSL/TLS override
    smtp_host_lower = str(effective_settings["smtp_host"] or "").lower().strip()
    if "smtp.gmail.com" in smtp_host_lower:
        effective_settings["use_ssl"] = True
        effective_settings["use_tls"] = False
        if effective_settings["smtp_port"] != 465:
            effective_settings["smtp_port"] = 465
    elif any(
        token in smtp_host_lower
        for token in ["smtp-mail.outlook.com", "smtp.office365.com"]
    ):
        effective_settings["use_ssl"] = False
        effective_settings["use_tls"] = True
        if effective_settings["smtp_port"] != 587:
            effective_settings["smtp_port"] = 587
    elif "smtp.yandex.com" in smtp_host_lower or "smtp.yahoo.com" in smtp_host_lower:
        effective_settings["use_ssl"] = True
        effective_settings["use_tls"] = False
        if effective_settings["smtp_port"] != 465:
            effective_settings["smtp_port"] = 465

    if not effective_settings["smtp_host"] or not effective_settings["smtp_port"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP host ve port gerekli",
        )
    if not effective_settings["from_email"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="From email gerekli",
        )
    if effective_settings["use_ssl"] and effective_settings["use_tls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP icin SSL ve TLS ayni anda secilemez. Tek bir baglanti yontemi secin.",
        )

    try:
        print("[EMAIL] Test email gönderme işlemi başlatıldı.")
        msg["Date"] = formatdate(localtime=True)
        from_domain = (effective_settings["from_email"] or "procureflow.local").split(
            "@"
        )[-1]
        msg["Message-ID"] = make_msgid(domain=from_domain)
        msg["X-Mailer"] = "ProcureFlow"
        msg["Content-Language"] = "tr-TR"

        body_plain = (
            "Bu bir test e-postasidir.\n\n"
            "ProcureFlow SMTP ayarlari dogru sekilde yapilandirilmistir.\n"
            "Bu ileti otomatik test amaclidir."
        )
        body_html = """
        <html>
            <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;\">
                <h3 style=\"margin: 0 0 12px;\">ProcureFlow SMTP Test Mesaji</h3>
                <p>Bu bir test e-postasidir.</p>
                <p>SMTP ayarlari dogru sekilde yapilandirilmistir.</p>
                <p style=\"font-size:12px;color:#6b7280;\">Bu ileti otomatik test amaclidir.</p>
            </body>
        </html>
        """
        msg.attach(MIMEText(body_plain, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        # Send email with provider-aware fallback attempts
        print("[EMAIL] SMTP bağlantısı kuruluyor...")
        primary_host = str(effective_settings["smtp_host"] or "").strip().lower()
        fallback_hosts: list[str] = []
        if any(
            token in primary_host for token in ("outlook", "hotmail", "live", "msn")
        ):
            fallback_hosts = ["smtp-mail.outlook.com", "smtp.office365.com"]
        hosts_to_try = [
            effective_settings["smtp_host"],
            *[
                item
                for item in fallback_hosts
                if item != effective_settings["smtp_host"]
            ],
        ]
        login_candidates = [effective_settings["smtp_username"]]
        if (
            effective_settings["from_email"]
            and effective_settings["from_email"] not in login_candidates
        ):
            login_candidates.append(effective_settings["from_email"])

        last_auth_error: Exception | None = None
        sent_ok = False
        for smtp_host in hosts_to_try:
            for login_name in login_candidates:
                server: smtplib.SMTP | smtplib.SMTP_SSL | None = None
                try:
                    print("[EMAIL] SMTP bağlantı denemesi başlatılıyor")
                    if effective_settings["use_ssl"]:
                        server = smtplib.SMTP_SSL(
                            smtp_host,
                            effective_settings["smtp_port"],
                            timeout=20,
                            context=ssl.create_default_context(),
                        )
                        server.ehlo()
                    else:
                        server = smtplib.SMTP(
                            smtp_host,
                            effective_settings["smtp_port"],
                            timeout=20,
                        )
                        server.ehlo()
                        if effective_settings["use_tls"]:
                            print("[EMAIL] TLS başlatılıyor...")
                            server.starttls(context=ssl.create_default_context())
                            server.ehlo()

                    if login_name and effective_settings["smtp_password"]:
                        print("[EMAIL] Login yapılıyor...")
                        server.login(login_name, effective_settings["smtp_password"])
                        print("[EMAIL] Login başarılı")

                    print("[EMAIL] Email gönderiliyor...")
                    server.send_message(msg)
                    server.quit()
                    effective_settings["smtp_host"] = smtp_host
                    effective_settings["smtp_username"] = login_name
                    sent_ok = True
                    break
                except SMTPAuthenticationError as auth_error:
                    last_auth_error = auth_error
                    if server is not None:
                        try:
                            server.quit()
                        except Exception:
                            pass
                    continue
            if sent_ok:
                break

        if not sent_ok:
            if last_auth_error is not None:
                raise last_auth_error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SMTP gonderimi basarisiz. Host, port ve kimlik bilgilerini kontrol edin.",
            )
        print("[EMAIL] Email başarıyla gönderildi")

        # Gelen kutusu (POP3/IMAP) test - optional, başarısız olunca hata verme
        incoming_host = (
            effective_settings["pop3_host"] or effective_settings["imap_host"]
        )
        incoming_port = (
            effective_settings["pop3_port"] or effective_settings["imap_port"]
        )
        incoming_test_success = False
        if (
            incoming_host
            and incoming_port
            and effective_settings["smtp_username"]
            and effective_settings["smtp_password"]
        ):
            try:
                print("[EMAIL] Gelen kutusu baglantisi test ediliyor...")
                if effective_settings["pop3_host"]:
                    pop_client: poplib.POP3 | poplib.POP3_SSL
                    if data.get("incoming_use_ssl", True):
                        pop_client = poplib.POP3_SSL(
                            effective_settings["pop3_host"],
                            int(effective_settings["pop3_port"] or 995),
                            timeout=15,
                        )
                    else:
                        pop_client = poplib.POP3(
                            effective_settings["pop3_host"],
                            int(effective_settings["pop3_port"] or 110),
                            timeout=15,
                        )
                    pop_client.user(effective_settings["smtp_username"])
                    pop_client.pass_(effective_settings["smtp_password"])
                    pop_client.quit()
                elif effective_settings["imap_host"]:
                    imap_client: imaplib.IMAP4 | imaplib.IMAP4_SSL
                    if data.get("incoming_use_ssl", True):
                        imap_client = imaplib.IMAP4_SSL(
                            effective_settings["imap_host"],
                            int(effective_settings["imap_port"] or 993),
                        )
                    else:
                        imap_client = imaplib.IMAP4(
                            effective_settings["imap_host"],
                            int(effective_settings["imap_port"] or 143),
                        )
                    imap_client.login(
                        effective_settings["smtp_username"],
                        effective_settings["smtp_password"],
                    )
                    imap_client.logout()
                print("[EMAIL] Gelen kutusu baglantisi dogrulandi")
                incoming_test_success = True
            except Exception as incoming_error:
                # Log ama hata verme - SMTP başarılı ise bunu skip et
                print(
                    f"[EMAIL] [WARNING] Gelen kutusu baglantisi test edilemedi: {type(incoming_error).__name__}: {str(incoming_error)}"
                )
                incoming_test_success = False

        return {
            "success": True,
            "message": "Gonderme basarili!"
            if not incoming_test_success
            else f"Gonderme ve alma baglantisi dogrulandi. Test email {to_email} adresine gonderildi.",
        }

    except SMTPAuthenticationError as e:
        print(f"[EMAIL] [ERROR] Kimlik doğrulama hatası: {str(e)}")
        error_str = str(e).lower()
        # Check for 535 error (basic authentication disabled)
        if "535" in str(e) or "basic authentication is disabled" in error_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="[HOTMAIL/OUTLOOK - OAUTH2 GEREKLİ] Microsoft, consumer Outlook/Hotmail hesapları için Modern Authentication (OAuth2) gerektiriyor. Bu, ProcureFlow'un şu anda desteklemediği bir protokol. Çözüm: (1) Gmail veya Yahoo gibi başka bir sağlayıcı deneyin, (2) ya da kendi domain e-postanızı kullanın (Exchange/SMTP sunucunuz).",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP kimlik doğrulama başarısız. Kullanıcı adı/e-posta ve şifreyi kontrol edin. Hotmail/Outlook hesaplarında SMTP AUTH açık olmalı; 2FA varsa uygulama parolası kullanılmalı.",
        )
    except socket.gaierror as e:
        print(f"[EMAIL] [ERROR] DNS Hatası: {str(e)}")
        print(f"[EMAIL]    SMTP Host: {settings.smtp_host}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP sunucusu bulunamadı: {effective_settings['smtp_host']}. Domain adını kontrol edin.",
        )
    except socket.timeout as e:
        print(f"[EMAIL] [ERROR] Timeout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail=f"SMTP sunucusuna bağlantı zaman aşımı. Host: {effective_settings['smtp_host']}:{effective_settings['smtp_port']}",
        )
    except ConnectionRefusedError as e:
        print(f"[EMAIL] [ERROR] Bağlantı reddedildi: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP sunucusu bağlantıyı reddetti. Host: {effective_settings['smtp_host']}:{effective_settings['smtp_port']}",
        )
    except SMTPServerDisconnected as e:
        print(f"[EMAIL] [ERROR] Sunucu bağlantısı koptu: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP sunucusu baglantiyi kabul etmedi veya secilen SSL/TLS yontemiyle uyumlu degil.",
        )
    except SMTPException as e:
        print(f"[EMAIL] [ERROR] SMTP Hatası: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP hatası: {str(e)}",
        )
    except (imaplib.IMAP4.error, poplib.error_proto) as e:
        print(f"[EMAIL] [ERROR] Gelen kutusu kimlik/baglanti hatasi: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gelen kutusu baglantisi basarisiz: {str(e)}",
        )
    except (ssl.SSLError, OSError) as e:
        print(f"[EMAIL] [ERROR] SSL/Baglanti hatasi: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSL/TLS baglanti hatasi. Port ve guvenlik tipini kontrol edin; genelde 465+SSL veya 587+TLS kullanilmalidir.",
        )
    except Exception as e:
        print(f"[EMAIL] [ERROR] Beklenmeyen hatası: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Email gönderme hatası: {type(e).__name__} - {str(e)}",
        )


@router.post("/email/provider/test", response_model=dict)
async def test_mailbox_provider_settings(
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_email_settings_access(current_user)
    resolved_owner_id = _resolve_email_profile_owner(current_user, owner_user_id)
    settings = _get_or_create_settings(
        db, EmailSettings, owner_user_id=resolved_owner_id
    )
    result = test_mailbox_provider_connection(settings)
    if result.status in {"provisioned", "warning"}:
        return {"success": True, "message": result.message, "status": result.status}
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.message)


@router.get("/email/health", response_model=dict)
async def get_email_health_summary(
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_email_settings_access(current_user)
    resolved_owner_id = _resolve_email_profile_owner_for_read(
        current_user, owner_user_id
    )

    scoped_email_ids = (
        db.query(SystemEmail.id)
        .filter(SystemEmail.is_active.is_(True))
        .filter(
            SystemEmail.owner_user_id == resolved_owner_id
            if resolved_owner_id is not None
            else SystemEmail.owner_user_id.is_(None)
        )
        .subquery()
    )

    seven_days_ago = utcnow() - timedelta(days=7)
    recent_messages = (
        db.query(SystemEmailMessage)
        .filter(SystemEmailMessage.system_email_id.in_(scoped_email_ids))
        .filter(SystemEmailMessage.created_at >= seven_days_ago)
        .all()
    )

    outbound = [
        item
        for item in recent_messages
        if str(item.direction or "").strip().lower() in {"outbound", "sent"}
    ]

    delivered_statuses = {"sent", "delivered", "success", "queued", "accepted"}
    failed_statuses = {"failed", "error", "rejected", "undelivered", "deferred"}
    bounced_statuses = {"bounced", "hard_bounce", "soft_bounce", "bounce"}
    spam_statuses = {"spam", "junk", "complaint", "abuse"}

    delivered = 0
    failed = 0
    bounced = 0
    spam = 0
    last_error_at = None
    last_error_message = None

    for item in outbound:
        normalized = str(item.status or "").strip().lower()
        if normalized in delivered_statuses:
            delivered += 1
        if normalized in failed_statuses:
            failed += 1
            if last_error_at is None or (
                item.updated_at is not None and item.updated_at > last_error_at
            ):
                last_error_at = item.updated_at
                last_error_message = (
                    item.snippet or item.subject or "Email delivery failed"
                )
        if normalized in bounced_statuses:
            bounced += 1
        if normalized in spam_statuses:
            spam += 1

    outbound_total = len(outbound)
    success_rate = (
        round((delivered / outbound_total) * 100, 2) if outbound_total else 100.0
    )
    bounce_rate = round((bounced / outbound_total) * 100, 2) if outbound_total else 0.0
    spam_rate = round((spam / outbound_total) * 100, 2) if outbound_total else 0.0

    return {
        "outbound_total_7d": outbound_total,
        "delivered_7d": delivered,
        "failed_7d": failed,
        "bounced_7d": bounced,
        "spam_flagged_7d": spam,
        "success_rate_7d": success_rate,
        "bounce_rate_7d": bounce_rate,
        "spam_rate_7d": spam_rate,
        "last_error_at": last_error_at,
        "last_error_message": last_error_message,
    }


# ============================================================================
# LOGGING SETTINGS ENDPOINTS
# ============================================================================


@router.get("/logging", response_model=dict)
async def get_logging_settings(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get logging settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, LoggingSettings)
    return {
        "id": settings.id,
        "log_level": settings.log_level,
        "log_retention_days": settings.log_retention_days,
        "enable_file_logging": settings.enable_file_logging,
        "enable_database_logging": settings.enable_database_logging,
        "enable_syslog": settings.enable_syslog,
        "log_api_requests": settings.log_api_requests,
        "log_database_queries": settings.log_database_queries,
        "log_user_actions": settings.log_user_actions,
        "updated_at": getattr(settings, "updated_at", None),
    }


@router.put("/logging", response_model=dict)
async def update_logging_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update logging settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, LoggingSettings)

    # Update fields
    if "log_level" in data:
        if data["log_level"] not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz log level"
            )
        settings.log_level = data["log_level"]

    if "log_retention_days" in data:
        settings.log_retention_days = max(1, data["log_retention_days"])

    if "enable_file_logging" in data:
        settings.enable_file_logging = data["enable_file_logging"]

    if "enable_database_logging" in data:
        settings.enable_database_logging = data["enable_database_logging"]

    if "enable_syslog" in data:
        settings.enable_syslog = data["enable_syslog"]

    if "log_api_requests" in data:
        settings.log_api_requests = data["log_api_requests"]

    if "log_database_queries" in data:
        settings.log_database_queries = data["log_database_queries"]

    if "log_user_actions" in data:
        settings.log_user_actions = data["log_user_actions"]

    if hasattr(settings, "updated_at"):
        settings.updated_at = utcnow()
    if hasattr(settings, "updated_by_id"):
        settings.updated_by_id = current_user.id

    db.commit()
    db.refresh(settings)

    return {
        "id": settings.id,
        "log_level": settings.log_level,
        "log_retention_days": settings.log_retention_days,
        "enable_file_logging": settings.enable_file_logging,
        "enable_database_logging": settings.enable_database_logging,
        "enable_syslog": settings.enable_syslog,
        "log_api_requests": settings.log_api_requests,
        "log_database_queries": settings.log_database_queries,
        "log_user_actions": settings.log_user_actions,
        "updated_at": getattr(settings, "updated_at", None),
    }


# ============================================================================
# BACKUP SETTINGS ENDPOINTS
# ============================================================================


@router.get("/backup", response_model=dict)
async def get_backup_settings(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get backup settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, BackupSettings)
    return {
        "id": settings.id,
        "enable_automatic_backup": settings.enable_automatic_backup,
        "backup_frequency": settings.backup_frequency,
        "backup_time": settings.backup_time,
        "backup_location": settings.backup_location,
        "keep_last_n_backups": settings.keep_last_n_backups,
        "compress_backups": settings.compress_backups,
        "encrypt_backups": settings.encrypt_backups,
        "last_backup_at": settings.last_backup_at,
        "updated_at": getattr(settings, "updated_at", None),
    }


@router.put("/backup", response_model=dict)
async def update_backup_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update backup settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, BackupSettings)

    # Update fields
    if "enable_automatic_backup" in data:
        settings.enable_automatic_backup = data["enable_automatic_backup"]

    if "backup_frequency" in data:
        if data["backup_frequency"] not in [
            "hourly",
            "every_2_hours",
            "daily",
            "weekly",
            "monthly",
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz yedek sıklığı"
            )
        settings.backup_frequency = data["backup_frequency"]

    if "backup_time" in data:
        settings.backup_time = data["backup_time"]

    if "backup_location" in data:
        settings.backup_location = data["backup_location"]

    if "keep_last_n_backups" in data:
        settings.keep_last_n_backups = max(1, data["keep_last_n_backups"])

    if "compress_backups" in data:
        settings.compress_backups = data["compress_backups"]

    if "encrypt_backups" in data:
        settings.encrypt_backups = data["encrypt_backups"]

    if hasattr(settings, "updated_at"):
        settings.updated_at = utcnow()
    if hasattr(settings, "updated_by_id"):
        settings.updated_by_id = current_user.id

    db.commit()
    db.refresh(settings)

    return {
        "id": settings.id,
        "enable_automatic_backup": settings.enable_automatic_backup,
        "backup_frequency": settings.backup_frequency,
        "backup_time": settings.backup_time,
        "backup_location": settings.backup_location,
        "keep_last_n_backups": settings.keep_last_n_backups,
        "compress_backups": settings.compress_backups,
        "encrypt_backups": settings.encrypt_backups,
        "last_backup_at": settings.last_backup_at,
        "updated_at": getattr(settings, "updated_at", None),
    }


@router.post("/backup/trigger", response_model=dict)
async def trigger_manual_backup(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Trigger manual backup - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, BackupSettings)

    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "auto_full_backup.ps1"
    if not script_path.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Yedek scripti bulunamadı: {script_path}",
        )

    fallback_backup_root = str(
        project_root.parent / "procureflow_full_backups" / "manual"
    )
    configured_location = (settings.backup_location or "").strip()
    if configured_location in ["", "/backups", "\\backups"]:
        configured_location = fallback_backup_root

    command = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        "-Source",
        str(project_root),
        "-BackupRoot",
        configured_location,
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                result.stderr or result.stdout or "Yedekleme komutu başarısız oldu"
            ).strip(),
        )

    target_path = None
    for line in result.stdout.splitlines():
        if line.startswith("TARGET="):
            target_path = line.split("=", 1)[1].strip()
            break

    settings.last_backup_at = utcnow().isoformat()

    if hasattr(settings, "updated_at"):
        settings.updated_at = utcnow()
    if hasattr(settings, "updated_by_id"):
        settings.updated_by_id = current_user.id

    db.commit()
    db.refresh(settings)

    return {
        "success": True,
        "message": "Yedek başarıyla oluşturuldu",
        "last_backup_at": settings.last_backup_at,
        "target_path": target_path,
    }


# ============================================================================
# NOTIFICATION SETTINGS ENDPOINTS
# ============================================================================


@router.get("/notifications", response_model=dict)
async def get_notification_settings(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get notification settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, NotificationSettings)
    return {
        "id": settings.id,
        "notify_on_quote_created": settings.notify_on_quote_created,
        "notify_on_quote_response": settings.notify_on_quote_response,
        "notify_on_quote_approved": settings.notify_on_quote_approved,
        "notify_on_quote_rejected": settings.notify_on_quote_rejected,
        "notify_on_contract_created": settings.notify_on_contract_created,
        "notify_on_contract_signed": settings.notify_on_contract_signed,
        "notify_on_system_errors": settings.notify_on_system_errors,
        "notify_on_maintenance": settings.notify_on_maintenance,
        "enable_daily_digest": settings.enable_daily_digest,
        "digest_time": settings.digest_time,
        "updated_at": getattr(settings, "updated_at", None),
    }


@router.put("/notifications", response_model=dict)
async def update_notification_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification settings - Admin only"""
    _ensure_admin(current_user)
    settings = _get_or_create_settings(db, NotificationSettings)

    # Update boolean fields
    if "notify_on_quote_created" in data:
        settings.notify_on_quote_created = data["notify_on_quote_created"]
    if "notify_on_quote_response" in data:
        settings.notify_on_quote_response = data["notify_on_quote_response"]
    if "notify_on_quote_approved" in data:
        settings.notify_on_quote_approved = data["notify_on_quote_approved"]
    if "notify_on_quote_rejected" in data:
        settings.notify_on_quote_rejected = data["notify_on_quote_rejected"]
    if "notify_on_contract_created" in data:
        settings.notify_on_contract_created = data["notify_on_contract_created"]
    if "notify_on_contract_signed" in data:
        settings.notify_on_contract_signed = data["notify_on_contract_signed"]
    if "notify_on_system_errors" in data:
        settings.notify_on_system_errors = data["notify_on_system_errors"]
    if "notify_on_maintenance" in data:
        settings.notify_on_maintenance = data["notify_on_maintenance"]
    if "enable_daily_digest" in data:
        settings.enable_daily_digest = data["enable_daily_digest"]
    if "digest_time" in data:
        settings.digest_time = data["digest_time"]

    if hasattr(settings, "updated_at"):
        settings.updated_at = utcnow()
    if hasattr(settings, "updated_by_id"):
        settings.updated_by_id = current_user.id

    db.commit()
    db.refresh(settings)

    return {
        "id": settings.id,
        "notify_on_quote_created": settings.notify_on_quote_created,
        "notify_on_quote_response": settings.notify_on_quote_response,
        "notify_on_quote_approved": settings.notify_on_quote_approved,
        "notify_on_quote_rejected": settings.notify_on_quote_rejected,
        "notify_on_contract_created": settings.notify_on_contract_created,
        "notify_on_contract_signed": settings.notify_on_contract_signed,
        "notify_on_system_errors": settings.notify_on_system_errors,
        "notify_on_maintenance": settings.notify_on_maintenance,
        "enable_daily_digest": settings.enable_daily_digest,
        "digest_time": settings.digest_time,
        "updated_at": getattr(settings, "updated_at", None),
    }


# ============================================================================
# API KEY ENDPOINTS
# ============================================================================


@router.get("/api-keys", response_model=list)
async def get_api_keys(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get current user's API keys"""
    keys = db.query(APIKey).filter(APIKey.user_id == current_user.id).all()
    return [
        {
            "id": key.id,
            "name": key.name,
            "key": key.key,
            "is_active": key.is_active,
            "created_at": key.created_at,
            "last_used_at": key.last_used_at,
        }
        for key in keys
    ]


@router.post("/api-keys", response_model=dict)
async def create_api_key(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new API key for current user"""
    name = data.get(
        "name",
        f"API Key {len(db.query(APIKey).filter(APIKey.user_id == current_user.id).all()) + 1}",
    )

    # Generate secure random key
    key_string = f"pk_{secrets.token_urlsafe(32)}"

    api_key = APIKey(
        user_id=current_user.id,
        name=name,
        key=key_string,
        is_active=True,
        created_at=utcnow(),
    )

    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": api_key.key,
        "is_active": api_key.is_active,
        "created_at": api_key.created_at,
        "message": "API anahtarı başarıyla oluşturuldu. Lütfen anahtarı güvenli bir yere kaydedin.",
    }


@router.delete("/api-keys/{key_id}", response_model=dict)
async def revoke_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke (delete) an API key"""
    api_key = (
        db.query(APIKey)
        .filter(APIKey.id == key_id, APIKey.user_id == current_user.id)
        .first()
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="API anahtarı bulunamadı"
        )

    db.delete(api_key)
    db.commit()

    return {"success": True, "message": "API anahtarı başarıyla iptal edildi"}
