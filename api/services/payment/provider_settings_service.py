from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from api.models.payment_provider import PaymentProviderSetting
from api.services.payment.provider_catalog import PROVIDER_DEFINITIONS


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def _to_dict(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    try:
        raw = json.loads(value)
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if v is not None}


def _from_dict(value: dict[str, str]) -> str:
    return json.dumps(value, ensure_ascii=False)


def get_provider_setting(
    db: Session, provider_code: str
) -> PaymentProviderSetting | None:
    return (
        db.query(PaymentProviderSetting)
        .filter(PaymentProviderSetting.provider_code == provider_code)
        .first()
    )


def _is_ready(
    definition: dict[str, Any], credentials: dict[str, str], installed: bool
) -> bool:
    if not installed:
        return False
    required_keys = [
        field["key"] for field in definition.get("fields", []) if field.get("required")
    ]
    return all(bool(credentials.get(key, "").strip()) for key in required_keys)


def list_admin_provider_settings(db: Session) -> list[dict]:
    rows: list[dict] = []
    for definition in PROVIDER_DEFINITIONS:
        provider_code = definition["code"]
        setting = get_provider_setting(db, provider_code)
        credentials = _to_dict(setting.credentials_json if setting else None)
        installed = bool(definition.get("installed", True))

        fields = []
        for field in definition.get("fields", []):
            key = str(field["key"])
            value = credentials.get(key, "")
            if field.get("secret"):
                fields.append(
                    {
                        "key": key,
                        "label": field.get("label", key),
                        "secret": True,
                        "required": bool(field.get("required", False)),
                        "placeholder": field.get("placeholder"),
                        "value": _mask_secret(value) if value else None,
                        "has_value": bool(value),
                    }
                )
            else:
                fields.append(
                    {
                        "key": key,
                        "label": field.get("label", key),
                        "secret": False,
                        "required": bool(field.get("required", False)),
                        "placeholder": field.get("placeholder"),
                        "value": value or None,
                        "has_value": bool(value),
                    }
                )

        rows.append(
            {
                "code": provider_code,
                "name": definition["name"],
                "country": definition["country"],
                "category": definition["category"],
                "integration_level": definition["integration_level"],
                "supports": definition.get("supports", []),
                "notes": (
                    setting.notes
                    if setting and setting.notes
                    else definition.get("notes", "")
                ),
                "installed": installed,
                "ready": _is_ready(definition, credentials, installed),
                "is_active": bool(setting.is_active)
                if setting
                else bool(definition.get("default_active", False)),
                "fields": fields,
            }
        )
    return rows


def upsert_provider_setting(
    db: Session,
    *,
    provider_code: str,
    is_active: bool | None,
    credentials: dict[str, str] | None,
    notes: str | None,
) -> PaymentProviderSetting:
    definition = next(
        (item for item in PROVIDER_DEFINITIONS if item["code"] == provider_code), None
    )
    if not definition:
        raise ValueError("Desteklenmeyen payment provider")

    setting = get_provider_setting(db, provider_code)
    if not setting:
        setting = PaymentProviderSetting(provider_code=provider_code, is_active=False)
        db.add(setting)
        db.flush()

    current = _to_dict(setting.credentials_json)
    payload = credentials or {}

    fields_by_key = {field["key"]: field for field in definition.get("fields", [])}
    for key, value in payload.items():
        if key not in fields_by_key:
            continue
        field = fields_by_key[key]
        incoming = str(value or "")
        if field.get("secret") and incoming.strip() == "":
            continue
        current[key] = incoming

    setting.credentials_json = _from_dict(current)
    if is_active is not None:
        setting.is_active = bool(is_active)
    if notes is not None:
        setting.notes = notes

    db.commit()
    db.refresh(setting)
    return setting


def list_public_active_providers(db: Session) -> list[dict]:
    admin_rows = list_admin_provider_settings(db)
    public_rows: list[dict] = []
    for item in admin_rows:
        if not item.get("is_active"):
            continue
        public_rows.append(
            {
                "code": item["code"],
                "name": item["name"],
                "country": item["country"],
                "category": item["category"],
                "integration_level": item["integration_level"],
                "supports": item["supports"],
                "installed": item["installed"],
                "ready": item["ready"],
            }
        )
    return public_rows


def get_provider_credentials_for_runtime(
    db: Session, provider_code: str
) -> dict[str, str]:
    setting = get_provider_setting(db, provider_code)
    if not setting:
        return {}
    return _to_dict(setting.credentials_json)
