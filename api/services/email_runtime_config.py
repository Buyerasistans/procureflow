from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
import ipaddress
import re

from sqlalchemy import or_

from api.database import SessionLocal
from api.models.email_settings import EmailSettings
from api.models.system_email import SystemEmail


@dataclass
class EmailRuntimeConfig:
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    use_tls: bool
    use_ssl: bool
    from_email: str
    from_name: str
    app_url: str
    mail_domain: str
    use_custom_app_url: bool
    reply_to_email: str
    bounce_email: str
    mailbox_support_email: str
    enable_list_unsubscribe: bool
    enable_strict_from_alignment: bool
    signature_name: str
    signature_title: str
    signature_note: str
    signature_image_url: str


def _extract_domain(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if "://" in raw:
        parsed = urlparse(raw)
        return (parsed.hostname or "").strip().lower()
    return raw.split("/")[0].strip().lower()


def _is_valid_mail_domain(value: str) -> bool:
    candidate = (value or "").strip().lower()
    if not candidate:
        return False
    try:
        ipaddress.ip_address(candidate)
        return False
    except ValueError:
        pass
    if candidate == "localhost":
        return False
    return bool(
        re.fullmatch(
            r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+",
            candidate,
        )
    )


def _mail_for_domain(email_value: str, domain: str, fallback_local: str) -> str:
    local = fallback_local
    if "@" in (email_value or ""):
        local = email_value.split("@", 1)[0].strip() or fallback_local
    elif (email_value or "").strip():
        local = email_value.strip()
    return f"{local}@{domain}"


def get_effective_email_config(
    owner_user_id: int | None = None,
    system_email_id: int | None = None,
) -> EmailRuntimeConfig:
    env_app_url = os.getenv("APP_URL", "http://localhost:5177")
    env_domain = _extract_domain(os.getenv("MAIL_DOMAIN", "")) or _extract_domain(
        env_app_url
    )

    defaults: dict[str, Any] = {
        "smtp_host": os.getenv("SMTP_SERVER", env_domain or "localhost"),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_username": os.getenv("SENDER_EMAIL", ""),
        "smtp_password": os.getenv("SENDER_PASSWORD", ""),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        "use_ssl": os.getenv("SMTP_USE_SSL", "false").lower() == "true",
        "mail_domain": env_domain,
        "app_url": env_app_url,
        "use_custom_app_url": False,
        "from_email": os.getenv("SENDER_EMAIL", "notifications@procureflow.local"),
        "from_name": os.getenv("MAIL_FROM_NAME", "ProcureFlow"),
        "reply_to_email": os.getenv("MAIL_REPLY_TO", ""),
        "bounce_email": os.getenv("MAIL_BOUNCE_EMAIL", ""),
        "mailbox_support_email": os.getenv("MAILBOX_SUPPORT_EMAIL", ""),
        "enable_list_unsubscribe": True,
        "enable_strict_from_alignment": True,
        "signature_name": "",
        "signature_title": "",
        "signature_note": "",
        "signature_image_url": "",
    }

    db = SessionLocal()
    try:
        row = None
        if owner_user_id is not None:
            row = (
                db.query(EmailSettings)
                .filter(EmailSettings.owner_user_id == owner_user_id)
                .first()
            )
        if row is None:
            row = (
                db.query(EmailSettings)
                .filter(EmailSettings.owner_user_id.is_(None))
                .first()
            )
        if row:
            defaults["smtp_host"] = (row.smtp_host or defaults["smtp_host"]).strip()
            defaults["smtp_port"] = int(row.smtp_port or defaults["smtp_port"])
            defaults["smtp_username"] = (
                row.smtp_username or defaults["smtp_username"]
            ).strip()
            defaults["smtp_password"] = (
                row.smtp_password or defaults["smtp_password"]
            ).strip()
            defaults["use_tls"] = bool(row.use_tls)
            defaults["use_ssl"] = bool(row.use_ssl)
            defaults["mail_domain"] = _extract_domain(
                row.mail_domain or defaults["mail_domain"]
            )
            defaults["app_url"] = (row.app_url or defaults["app_url"]).strip()
            defaults["use_custom_app_url"] = bool(row.use_custom_app_url)
            defaults["from_email"] = (row.from_email or defaults["from_email"]).strip()
            defaults["from_name"] = (row.from_name or defaults["from_name"]).strip()
            defaults["reply_to_email"] = (
                row.reply_to_email or defaults["reply_to_email"]
            ).strip()
            defaults["bounce_email"] = (
                row.bounce_email or defaults["bounce_email"]
            ).strip()
            defaults["mailbox_support_email"] = (
                row.mailbox_support_email or defaults["mailbox_support_email"]
            ).strip()
            defaults["enable_list_unsubscribe"] = bool(row.enable_list_unsubscribe)
            defaults["enable_strict_from_alignment"] = bool(
                row.enable_strict_from_alignment
            )

        if system_email_id is not None:
            account_query = db.query(SystemEmail).filter(
                SystemEmail.id == system_email_id,
                SystemEmail.is_active.is_(True),
            )
            if owner_user_id is None:
                account_query = account_query.filter(
                    SystemEmail.owner_user_id.is_(None)
                )
            else:
                account_query = account_query.filter(
                    or_(
                        SystemEmail.owner_user_id == owner_user_id,
                        SystemEmail.owner_user_id.is_(None),
                    )
                )
            account = account_query.order_by(SystemEmail.owner_user_id.asc()).first()
            if account:
                defaults["smtp_username"] = (
                    account.email or defaults["smtp_username"]
                ).strip()
                defaults["smtp_password"] = (
                    account.password or defaults["smtp_password"]
                ).strip()
                defaults["from_email"] = (
                    account.email or defaults["from_email"]
                ).strip()
                defaults["reply_to_email"] = (
                    account.email or defaults["reply_to_email"]
                ).strip()
    except Exception:
        # DB geçici olarak erişilemezse env fallback ile devam et.
        pass
    finally:
        db.close()

    mail_domain = _extract_domain(defaults["mail_domain"])
    if not _is_valid_mail_domain(mail_domain):
        mail_domain = ""

    if defaults["enable_strict_from_alignment"] and mail_domain:
        defaults["from_email"] = _mail_for_domain(
            defaults["from_email"], mail_domain, "notifications"
        )
        if defaults["reply_to_email"]:
            defaults["reply_to_email"] = _mail_for_domain(
                defaults["reply_to_email"], mail_domain, "destek"
            )
        if defaults["bounce_email"]:
            defaults["bounce_email"] = _mail_for_domain(
                defaults["bounce_email"], mail_domain, "destek"
            )
        if defaults["mailbox_support_email"]:
            defaults["mailbox_support_email"] = _mail_for_domain(
                defaults["mailbox_support_email"], mail_domain, "destek"
            )

    app_url = (defaults["app_url"] or env_app_url).strip() or env_app_url
    if defaults["use_custom_app_url"] and mail_domain:
        app_url = f"https://{mail_domain}"

    smtp_username = defaults["smtp_username"] or defaults["from_email"]

    return EmailRuntimeConfig(
        smtp_host=defaults["smtp_host"],
        smtp_port=int(defaults["smtp_port"]),
        smtp_username=smtp_username,
        smtp_password=defaults["smtp_password"],
        use_tls=bool(defaults["use_tls"]),
        use_ssl=bool(defaults["use_ssl"]),
        from_email=defaults["from_email"],
        from_name=defaults["from_name"] or "ProcureFlow",
        app_url=app_url,
        mail_domain=mail_domain,
        use_custom_app_url=bool(defaults["use_custom_app_url"]),
        reply_to_email=defaults["reply_to_email"],
        bounce_email=defaults["bounce_email"],
        mailbox_support_email=defaults["mailbox_support_email"],
        enable_list_unsubscribe=bool(defaults["enable_list_unsubscribe"]),
        enable_strict_from_alignment=bool(defaults["enable_strict_from_alignment"]),
        signature_name=defaults["signature_name"],
        signature_title=defaults["signature_title"],
        signature_note=defaults["signature_note"],
        signature_image_url=defaults["signature_image_url"],
    )


def get_system_email_accounts(owner_user_id: int | None = None) -> list[SystemEmail]:
    db = SessionLocal()
    try:
        query = db.query(SystemEmail).filter(SystemEmail.is_active.is_(True))
        if owner_user_id is None:
            query = query.filter(SystemEmail.owner_user_id.is_(None))
        else:
            query = query.filter(SystemEmail.owner_user_id == owner_user_id)
        return query.order_by(SystemEmail.id.asc()).all()
    finally:
        db.close()
