"""Panel rol profili API — Faz 3.

GET  /admin/panel-profiles               → tüm profilleri döner (yetkili admin)
GET  /admin/panel-profiles/me            → sadece mevcut kullanıcının profili (tüm auth türleri)
PUT  /admin/panel-profiles/{biz}/{sys}   → profil yazar (super_admin VEYA panel_design.edit)
GET  /admin/panel-profiles/audit         → son N değişiklik (yetkili admin)
"""

from __future__ import annotations

import json
import re
from datetime import datetime, UTC
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.orm import Session

from api.core.authz import can_access_admin_surface, has_panel_design_permission, is_super_admin
from api.core.deps import get_current_user, get_db
from api.models import User
from api.models.panel_profile import PanelProfile
from api.models.panel_profile_audit_log import PanelProfileAuditLog

router = APIRouter(prefix="/admin", tags=["panel-profiles"])

# ---------------------------------------------------------------------------
# Renk yardımcıları (panel_theme_router.py ile aynı formül)
# ---------------------------------------------------------------------------

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _is_valid_hex(v: str) -> bool:
    return bool(_HEX_RE.match(v))


def _linearize(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _relative_luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0
    return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b)


def _contrast_ratio(c1: str, c2: str) -> float:
    l1, l2 = _relative_luminance(c1), _relative_luminance(c2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class QuickLink(BaseModel):
    label: str = ""
    href: str = "/"
    desc: str = ""


class PanelProfilePutRequest(BaseModel):
    category: str = ""
    title: str = ""
    navLabel: str = ""
    wsLabel: str = ""
    heroTitle: str = ""
    heroDesc: str = ""
    color: str
    color2: str
    color2Mix: float = 0.18
    syncTopbar: bool = False
    accent: str
    textColor: str
    selfEdit: bool = False
    vitrinEdit: bool = False
    menuStyle: str = "pill"
    glow: float = 0.45
    opacity: float = 0.85
    fontTitle: int = 26
    fontBody: int = 13
    tabs: list[str] = []
    quickLinks: list[QuickLink] = []
    users: int = 0

    @field_validator("color", "color2", "accent", "textColor", mode="before")
    @classmethod
    def validate_hex(cls, v: Any) -> Any:
        if not isinstance(v, str) or not _is_valid_hex(v):
            raise ValueError(f"Geçersiz hex renk kodu: {v!r}. Beklenen format: #RRGGBB")
        return v.upper()

    @field_validator("color2Mix", "glow", "opacity", mode="before")
    @classmethod
    def clamp_float(cls, v: Any) -> float:
        val = float(v)
        return max(0.0, min(1.0, val))

    @model_validator(mode="after")
    def validate_contrast(self) -> "PanelProfilePutRequest":
        ratio = _contrast_ratio(self.textColor, self.accent)
        if ratio < 4.5:
            raise ValueError(
                f"textColor ({self.textColor}) ile accent ({self.accent}) arasındaki kontrast "
                f"oranı {ratio:.2f}:1 — WCAG AA için ≥4.5:1 gerekli."
            )
        return self


class PanelProfileEntry(BaseModel):
    businessRole: str
    systemRole: str | None
    profile: dict[str, Any]
    updatedByEmail: str | None
    updatedAt: str | None


class PanelProfileListResponse(BaseModel):
    profiles: list[PanelProfileEntry]
    canEdit: bool


class PanelProfileAuditEntry(BaseModel):
    id: int
    changedByEmail: str
    changedAt: str
    businessRole: str
    systemRole: str | None
    oldValue: dict[str, Any] | None
    newValue: dict[str, Any] | None


# ---------------------------------------------------------------------------
# Yetki bağımlılıkları
# ---------------------------------------------------------------------------

def _require_any_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not can_access_admin_surface(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin yetkisi gerekli",
        )
    return current_user


def _require_panel_design_edit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if not can_access_admin_surface(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin yetkisi gerekli",
        )
    if not has_panel_design_permission(current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="panel_design.edit yetkisi gerekli (Super Admin veya yetkili admin)",
        )
    return current_user


# ---------------------------------------------------------------------------
# Yardımcı: DB kaydını PanelProfileEntry'e dönüştür
# ---------------------------------------------------------------------------

def _entry_from_record(rec: PanelProfile) -> PanelProfileEntry:
    try:
        profile_data: dict[str, Any] = json.loads(rec.profile_json)
    except (json.JSONDecodeError, TypeError):
        profile_data = {}
    return PanelProfileEntry(
        businessRole=rec.business_role,
        systemRole=rec.system_role,
        profile=profile_data,
        updatedByEmail=rec.updated_by_email or None,
        updatedAt=rec.updated_at.isoformat() if rec.updated_at else None,
    )


# ---------------------------------------------------------------------------
# Uçlar
# ---------------------------------------------------------------------------

@router.get("/panel-profiles/me", response_model=dict)
def get_my_panel_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Mevcut kullanıcının kendi rol panel profilini döner (tüm auth türleri erişebilir).

    Önce (business_role × system_role) tam eşleşmesi aranır; bulunamazsa
    business_role bazlı ilk kayda düşülür (channel_owner gibi sys uyuşmazlıkları için).
    """
    biz: str = getattr(current_user, "business_role", None) or getattr(current_user, "role", None) or ""
    sys: str = getattr(current_user, "system_role", None) or ""

    if not biz:
        return {}

    # 1) Tam eşleşme
    record = (
        db.query(PanelProfile)
        .filter(
            PanelProfile.business_role == biz,
            PanelProfile.system_role == sys,
        )
        .first()
    )
    # 2) sys uyuşmazlığı fallback (ör. channel_owner/tenant_owner ↔ tenant_member şablonu)
    if not record:
        record = (
            db.query(PanelProfile)
            .filter(PanelProfile.business_role == biz)
            .first()
        )

    if record and record.profile_json:
        try:
            return json.loads(record.profile_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


@router.get("/panel-profiles", response_model=PanelProfileListResponse)
def list_panel_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_any_admin),
) -> PanelProfileListResponse:
    """Kayıtlı tüm panel profillerini döner.

    DB'de kaydı olmayan roller için frontend kod varsayılanlarını kullanır.
    """
    records = (
        db.query(PanelProfile)
        .order_by(PanelProfile.business_role, PanelProfile.system_role)
        .all()
    )
    can_edit = has_panel_design_permission(current_user, db)
    return PanelProfileListResponse(
        profiles=[_entry_from_record(r) for r in records],
        canEdit=can_edit,
    )


@router.put("/panel-profiles/{biz}/{sys}", response_model=PanelProfileEntry)
def put_panel_profile(
    biz: str,
    sys: str,
    body: PanelProfilePutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_panel_design_edit),
) -> PanelProfileEntry:
    """Rol profili günceller veya oluşturur.

    Yetki: super_admin VEYA panel_design.edit.
    Doğrulama: hex format, textColor–accent WCAG AA kontrast ≥4.5:1.
    """
    # Mevcut kaydı bul veya yeni oluştur
    record = (
        db.query(PanelProfile)
        .filter(
            PanelProfile.business_role == biz,
            PanelProfile.system_role == sys,
        )
        .first()
    )

    old_json: str | None = record.profile_json if record else None
    changed_at = datetime.now(UTC)
    new_data = body.model_dump(mode="json")
    new_json = json.dumps(new_data, ensure_ascii=False)

    # Değişiklik varsa audit log yaz
    old_data: dict[str, Any] | None = None
    if old_json:
        try:
            old_data = json.loads(old_json)
        except (json.JSONDecodeError, TypeError):
            old_data = None

    if old_json != new_json:
        db.add(PanelProfileAuditLog(
            changed_by_id=current_user.id,
            changed_by_email=current_user.email or "",
            changed_at=changed_at,
            business_role=biz,
            system_role=sys,
            old_value=old_json,
            new_value=new_json,
        ))

    if record is None:
        record = PanelProfile(
            business_role=biz,
            system_role=sys,
        )
        db.add(record)

    record.profile_json = new_json
    record.updated_by_id = current_user.id
    record.updated_by_email = current_user.email or ""
    record.updated_at = changed_at

    db.commit()
    db.refresh(record)

    _ = old_data  # suppress unused warning; old_data is written to audit log above
    return _entry_from_record(record)


@router.get("/panel-profiles/audit", response_model=list[PanelProfileAuditEntry])
def get_panel_profile_audit(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_any_admin),
) -> list[PanelProfileAuditEntry]:
    """Son N panel profil değişikliğini döner. Her admin okuyabilir."""
    _ = is_super_admin(current_user)  # authz import kullanımı
    logs = (
        db.query(PanelProfileAuditLog)
        .order_by(PanelProfileAuditLog.changed_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        PanelProfileAuditEntry(
            id=log.id,
            changedByEmail=log.changed_by_email,
            changedAt=log.changed_at.isoformat(),
            businessRole=log.business_role,
            systemRole=log.system_role,
            oldValue=json.loads(log.old_value) if log.old_value else None,
            newValue=json.loads(log.new_value) if log.new_value else None,
        )
        for log in logs
    ]
