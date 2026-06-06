"""Kullanıcı Profili API Endpoints"""

import base64
import io
from datetime import datetime, timezone

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.database import get_db
from api.core.authz import can_access_procurement_settings
from api.core.deps import get_current_user
from api.models import User
from api.models.refresh_token import RefreshToken
from api.schemas.user import ProfileOut, ChangePasswordRequest, ProfileUpdate
from api.core.security import get_password_hash, verify_password

router = APIRouter(prefix="/users", tags=["users"])


def _serialize_profile(user: User) -> ProfileOut:
    return ProfileOut.model_validate(user, from_attributes=True)


def _ensure_admin_profile_access(current_user: User) -> None:
    if not can_access_procurement_settings(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sadece admin bu işlemi yapabilir",
        )


@router.get("/profile", response_model=ProfileOut)
def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    """Kendi profilimi getir"""
    return _serialize_profile(current_user)


@router.put("/profile", response_model=ProfileOut)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    """Kendi profilimi güncelle"""
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    if payload.full_name and payload.full_name.strip():
        user.full_name = payload.full_name.strip()
    if payload.work_email is not None:
        user.work_email = (payload.work_email or "").strip().lower() or None
    if payload.personal_phone is not None:
        user.personal_phone = payload.personal_phone.strip() or None
    if payload.company_phone is not None:
        user.company_phone = payload.company_phone.strip() or None
    if payload.company_phone_short is not None:
        user.company_phone_short = payload.company_phone_short.strip() or None
    if payload.address is not None:
        user.address = payload.address.strip() or None
    if payload.hide_location is not None:
        user.hide_location = payload.hide_location
    if payload.share_on_whatsapp is not None:
        user.share_on_whatsapp = payload.share_on_whatsapp
    if payload.photo is not None:
        user.photo = payload.photo.strip() or None
    if payload.login_notifications is not None:
        user.login_notifications = payload.login_notifications

    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


@router.post("/profile/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Şifre değiştir"""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Mevcut şifre yanlış"
        )

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre en az 8 karakter olmalı",
        )

    if payload.old_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre eski şifreden farklı olmalı",
        )

    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    return {"message": "Şifre başarıyla değiştirildi"}


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions")
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Aktif oturumlarımı listele"""
    now = datetime.now(timezone.utc)
    sessions = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.id.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat(),
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Oturumu iptal et"""
    now = datetime.now(timezone.utc)
    session = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.id == session_id,
            RefreshToken.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oturum bulunamadı")
    if session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Oturum zaten iptal edilmiş")
    session.revoked_at = now
    db.commit()
    return {"revoked": True}


# ── 2FA ───────────────────────────────────────────────────────────────────────

@router.post("/2fa/setup")
def setup_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """2FA kurulumunu başlat: gizli anahtar ve QR kodu döner"""
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.totp_enabled = False
    db.commit()

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="BuyerAsistan")

    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "secret": secret,
        "qr_data_url": f"data:image/png;base64,{qr_b64}",
    }


class TotpVerifyRequest(BaseModel):
    code: str


@router.post("/2fa/verify")
def verify_2fa(
    payload: TotpVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """TOTP kodunu doğrula ve 2FA'yı etkinleştir"""
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA kurulumu başlatılmamış")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(payload.code, valid_window=2):
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod")
    user.totp_enabled = True
    db.commit()
    return {"enabled": True}


@router.delete("/2fa/disable")
def disable_2fa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """2FA'yı devre dışı bırak"""
    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    user.totp_enabled = False
    user.totp_secret = None
    db.commit()
    return {"enabled": False}


# ── Admin endpoints ────────────────────────────────────────────────────────────

@router.get("/{user_id}/profile", response_model=ProfileOut)
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    """Admin: Kullanıcı profilini getir"""
    _ensure_admin_profile_access(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı"
        )

    return _serialize_profile(user)


@router.put("/{user_id}/profile", response_model=ProfileOut)
def update_user_profile(
    user_id: int,
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileOut:
    """Admin: Kullanıcı profilini güncelle"""
    _ensure_admin_profile_access(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı"
        )

    if payload.full_name and payload.full_name.strip():
        user.full_name = payload.full_name.strip()
    if payload.work_email is not None:
        user.work_email = (payload.work_email or "").strip().lower() or None

    db.commit()
    db.refresh(user)
    return _serialize_profile(user)
