"""Panel teması override API — Faz 2.

GET  /admin/panel-theme  → her admin okuyabilir
PUT  /admin/panel-theme  → super_admin VEYA panel_design.edit yetkisi
"""

from __future__ import annotations

import json
import re
from datetime import datetime, UTC
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from api.core.authz import can_access_admin_surface, is_super_admin
from api.core.deps import get_current_user, get_db
from api.models import User
from api.models.assignment import CompanyRole
from api.models.panel_theme_audit_log import PanelThemeAuditLog
from api.models.panel_theme_setting import PanelThemeSetting
from api.models.role import Permission, Role

router = APIRouter(prefix="/admin", tags=["panel-theme"])

# ---------------------------------------------------------------------------
# Geçerli segment anahtarları
# ---------------------------------------------------------------------------

VALID_SEGMENTS = {"platform", "strategic", "supplier", "channel", "employer", "seeker", "system"}

# ---------------------------------------------------------------------------
# Renk yardımcıları
# ---------------------------------------------------------------------------

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _is_valid_hex(value: str) -> bool:
    return bool(_HEX_RE.match(value))


def _hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return r / 255.0, g / 255.0, b / 255.0


def _linearize(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _relative_luminance(hex_color: str) -> float:
    r, g, b = _hex_to_rgb(hex_color)
    return 0.2126 * _linearize(r) + 0.7152 * _linearize(g) + 0.0722 * _linearize(b)


def _contrast_ratio(c1: str, c2: str) -> float:
    l1, l2 = _relative_luminance(c1), _relative_luminance(c2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

_HEX_FIELDS = ("accent", "accentDark", "accentTint", "chipBg", "secondary", "onAccent")


class SegmentOverride(BaseModel):
    accent: str | None = None
    accentDark: str | None = None
    accentTint: str | None = None
    chipBg: str | None = None
    secondary: str | None = None
    onAccent: str | None = None

    @field_validator("accent", "accentDark", "accentTint", "chipBg", "secondary", "onAccent", mode="before")
    @classmethod
    def validate_hex(cls, v: Any) -> Any:
        if v is None:
            return v
        if not isinstance(v, str) or not _is_valid_hex(v):
            raise ValueError(f"Geçersiz hex renk kodu: {v!r}. Beklenen format: #RRGGBB")
        return v.upper()


class PanelThemePutRequest(BaseModel):
    segments: dict[str, SegmentOverride]

    @field_validator("segments")
    @classmethod
    def validate_segment_keys(cls, v: dict) -> dict:
        invalid = set(v.keys()) - VALID_SEGMENTS
        if invalid:
            raise ValueError(f"Geçersiz segment anahtarı: {invalid}. Geçerli: {VALID_SEGMENTS}")
        return v


class PanelThemeResponse(BaseModel):
    version: int
    updatedAt: str | None
    updatedBy: str | None
    segments: dict[str, Any]
    canEdit: bool = True


class AuditLogEntry(BaseModel):
    id: int
    changedByEmail: str
    changedAt: str
    segmentKey: str
    oldValue: dict[str, Any] | None
    newValue: dict[str, Any] | None


# ---------------------------------------------------------------------------
# Singleton yardımcısı
# ---------------------------------------------------------------------------

def _get_or_create_theme(db: Session) -> PanelThemeSetting:
    setting = db.query(PanelThemeSetting).filter(PanelThemeSetting.id == 1).first()
    if setting is None:
        setting = PanelThemeSetting(id=1, segments_json="{}", version=1)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def _has_panel_design_permission_bool(current_user: User, db: Session) -> bool:
    """True iff user is super_admin OR holds panel_design.edit permission."""
    if is_super_admin(current_user):
        return True
    return bool(
        db.query(Permission)
        .join(Permission.roles)
        .join(Role.company_roles)
        .filter(
            CompanyRole.user_id == current_user.id,
            Permission.name == "panel_design.edit",
        )
        .first()
    )


def _build_response(setting: PanelThemeSetting, db: Session, can_edit: bool = True) -> PanelThemeResponse:
    updated_by_email: str | None = None
    if setting.updated_by_id is not None:
        user = db.query(User).filter(User.id == setting.updated_by_id).first()
        if user:
            updated_by_email = user.email

    updated_at_str: str | None = None
    if setting.updated_at is not None:
        updated_at_str = setting.updated_at.isoformat()

    try:
        segments = json.loads(setting.segments_json)
    except (json.JSONDecodeError, TypeError):
        segments = {}

    return PanelThemeResponse(
        version=setting.version,
        updatedAt=updated_at_str,
        updatedBy=updated_by_email,
        segments=segments,
        canEdit=can_edit,
    )


# ---------------------------------------------------------------------------
# Yetki kontrolü
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


def _check_panel_design_permission(current_user: User, db: Session) -> None:
    """super_admin VEYA panel_design.edit iznine sahip olmalı."""
    if is_super_admin(current_user):
        return

    has_perm = (
        db.query(Permission)
        .join(Permission.roles)
        .join(Role.company_roles)
        .filter(
            CompanyRole.user_id == current_user.id,
            Permission.name == "panel_design.edit",
        )
        .first()
    )
    if not has_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="panel_design.edit yetkisi gerekli (Super Admin veya yetkili admin)",
        )


# ---------------------------------------------------------------------------
# Doğrulama
# ---------------------------------------------------------------------------

def _validate_contrast(seg_key: str, override: SegmentOverride) -> None:
    """accent–onAccent WCAG kontrastını doğrula; ikisi de varsa ≥4.5:1 gerekir."""
    accent = override.accent
    on_accent = override.onAccent
    if accent is None or on_accent is None:
        return
    ratio = _contrast_ratio(accent, on_accent)
    if ratio < 4.5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Segment '{seg_key}': accent ({accent}) ile onAccent ({on_accent}) arasındaki "
                f"kontrast oranı {ratio:.2f}:1 — WCAG AA için ≥4.5:1 gerekli."
            ),
        )


# ---------------------------------------------------------------------------
# Uçlar
# ---------------------------------------------------------------------------

@router.get("/panel-theme", response_model=PanelThemeResponse)
def get_panel_theme(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_any_admin),
):
    """Panel teması override'larını döner. Boş segments = kod varsayılanları geçerli."""
    setting = _get_or_create_theme(db)
    can_edit = _has_panel_design_permission_bool(current_user, db)
    return _build_response(setting, db, can_edit=can_edit)


@router.put("/panel-theme", response_model=PanelThemeResponse)
def put_panel_theme(
    body: PanelThemePutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_any_admin),
):
    """Panel teması override'larını günceller.

    Yetki: super_admin VEYA panel_design.edit iznine sahip admin.
    Doğrulama: hex format, accent–onAccent WCAG AA kontrastı ≥4.5:1.
    Boş segments ({}) tüm override'ları sıfırlar (kod varsayılanlarına döner).
    """
    _check_panel_design_permission(current_user, db)

    # Kontrast doğrulaması
    for seg_key, override in body.segments.items():
        _validate_contrast(seg_key, override)

    setting = _get_or_create_theme(db)

    # Audit için eski değerleri oku
    try:
        old_segments: dict[str, dict] = json.loads(setting.segments_json)
    except (json.JSONDecodeError, TypeError):
        old_segments = {}

    # Override-only: None alanları hariç tut
    segments_dict: dict[str, dict] = {}
    for seg_key, override in body.segments.items():
        seg_data = {k: v for k, v in override.model_dump().items() if v is not None}
        if seg_data:
            segments_dict[seg_key] = seg_data

    # Audit log: her değişen segment için bir kayıt
    changed_at = datetime.now(UTC)
    user_email = current_user.email or ""
    all_seg_keys = set(old_segments.keys()) | set(segments_dict.keys())
    for seg_key in all_seg_keys:
        old_val = old_segments.get(seg_key)
        new_val = segments_dict.get(seg_key)
        if old_val != new_val:
            db.add(PanelThemeAuditLog(
                changed_by_id=current_user.id,
                changed_by_email=user_email,
                changed_at=changed_at,
                segment_key=seg_key,
                old_value=json.dumps(old_val, ensure_ascii=False) if old_val is not None else None,
                new_value=json.dumps(new_val, ensure_ascii=False) if new_val is not None else None,
            ))

    setting.segments_json = json.dumps(segments_dict, ensure_ascii=False)
    setting.version += 1
    setting.updated_by_id = current_user.id
    setting.updated_at = changed_at

    db.commit()
    db.refresh(setting)

    return _build_response(setting, db)


@router.get("/panel-theme/audit", response_model=list[AuditLogEntry])
def get_panel_theme_audit(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_any_admin),
):
    """Son N panel teması değişikliğini döner. Her admin okuyabilir."""
    logs = (
        db.query(PanelThemeAuditLog)
        .order_by(PanelThemeAuditLog.changed_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        AuditLogEntry(
            id=log.id,
            changedByEmail=log.changed_by_email,
            changedAt=log.changed_at.isoformat(),
            segmentKey=log.segment_key,
            oldValue=json.loads(log.old_value) if log.old_value else None,
            newValue=json.loads(log.new_value) if log.new_value else None,
        )
        for log in logs
    ]
