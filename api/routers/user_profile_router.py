"""Kullanıcı Profili API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.core.authz import can_access_procurement_settings
from api.core.deps import get_current_user
from api.models import User
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
    if payload.full_name and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.work_email is not None:
        current_user.work_email = (payload.work_email or "").strip().lower() or None

    db.commit()
    db.refresh(current_user)
    return _serialize_profile(current_user)


@router.post("/profile/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Şifre değiştir"""
    # Eski şifre kontrolü
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Mevcut şifre yanlış"
        )

    # Yeni şifre validasyonu
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre en az 8 karakter olmalı",
        )

    # Aynı şifre kontrolü
    if payload.old_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre eski şifreden farklı olmalı",
        )

    # Şifre güncelle
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    return {"message": "Şifre başarıyla değiştirildi"}


# Admin endpoints
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
