from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.core.authz import (
    can_access_talent_admin,
    can_access_talent_dashboard,
    can_review_talent_profile,
    is_talent_member,
)
from api.core.deps import get_current_user, get_db
from api.models import User
from api.models.talent import TalentProfile
from api.schemas.talent import (
    PaginatedTalentProfilesOut,
    TalentKycStatusUpdate,
    TalentProfileCreate,
    TalentProfileOut,
    TalentProfileUpdate,
    TalentPublicProfileOut,
)

router = APIRouter(prefix="/talent", tags=["talent"])


def _err(code: str, message: str) -> dict:
    return {"code": code, "message": message, "request_id": str(uuid.uuid4())}


def _get_profile_or_404(user: User, db: Session) -> TalentProfile:
    profile = (
        db.query(TalentProfile).filter(TalentProfile.user_id == user.id).first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("TALENT_PROFILE_NOT_FOUND", "Talent profili bulunamadı"),
        )
    return profile


@router.get("/me", response_model=TalentProfileOut)
def get_my_talent_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TalentProfileOut:
    """Giriş yapmış kullanıcının talent profilini döndürür."""
    if not can_access_talent_dashboard(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("TALENT_ACCESS_DENIED", "Talent paneline erişim yetkiniz yok"),
        )
    profile = _get_profile_or_404(current_user, db)
    return TalentProfileOut.model_validate(profile)


@router.post("/register", response_model=TalentProfileOut, status_code=status.HTTP_201_CREATED)
def register_talent_profile(
    payload: TalentProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TalentProfileOut:
    """Kullanıcı için talent profili oluşturur. Zaten profil varsa 409 döndürür.

    Kayıt başarılı olursa system_role otomatik olarak talent_member atanır.
    """
    existing = (
        db.query(TalentProfile).filter(TalentProfile.user_id == current_user.id).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_err(
                "TALENT_ALREADY_REGISTERED",
                "Bu kullanıcı için zaten bir talent profili mevcut",
            ),
        )

    profile = TalentProfile(
        user_id=current_user.id,
        availability=payload.availability,
        experience_years=payload.experience_years,
        linkedin_url=payload.linkedin_url,
        bio=payload.bio,
        skills_json=json.dumps(payload.skills, ensure_ascii=False) if payload.skills else None,
        category_expertise_json=(
            json.dumps(payload.category_expertise, ensure_ascii=False)
            if payload.category_expertise
            else None
        ),
        is_public=payload.is_public,
    )
    db.add(profile)

    # Rolü talent_member olarak güncelle — mevcut rol korunursa üzerine yazma
    if not is_talent_member(current_user):
        current_user.system_role = "talent_member"  # type: ignore[assignment]

    db.commit()
    db.refresh(profile)
    return TalentProfileOut.model_validate(profile)


@router.patch("/me", response_model=TalentProfileOut)
def update_my_talent_profile(
    payload: TalentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TalentProfileOut:
    """Talent profilini kısmen günceller. Profil sahibi olmak zorunlu."""
    if not can_access_talent_dashboard(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("TALENT_ACCESS_DENIED", "Talent paneline erişim yetkiniz yok"),
        )
    profile = _get_profile_or_404(current_user, db)

    if payload.availability is not None:
        profile.availability = payload.availability  # type: ignore[assignment]
    if payload.experience_years is not None:
        profile.experience_years = payload.experience_years  # type: ignore[assignment]
    if payload.linkedin_url is not None:
        profile.linkedin_url = payload.linkedin_url  # type: ignore[assignment]
    if payload.bio is not None:
        profile.bio = payload.bio  # type: ignore[assignment]
    if payload.skills is not None:
        profile.skills_json = json.dumps(payload.skills, ensure_ascii=False)  # type: ignore[assignment]
    if payload.category_expertise is not None:
        profile.category_expertise_json = json.dumps(payload.category_expertise, ensure_ascii=False)  # type: ignore[assignment]
    if payload.is_public is not None:
        profile.is_public = payload.is_public  # type: ignore[assignment]

    db.commit()
    db.refresh(profile)
    return TalentProfileOut.model_validate(profile)


# ---------------------------------------------------------------------------
# GET /talent/public/{profile_id}  — kimlik doğrulama gerekmez
# ---------------------------------------------------------------------------


@router.get("/public/{profile_id}", response_model=TalentPublicProfileOut)
def get_public_talent_profile(
    profile_id: int,
    db: Session = Depends(get_db),
) -> TalentPublicProfileOut:
    """
    Herkese açık talent profil görünümü.
    Sadece is_public=True ve kyc_status='approved' olan profiller görünür.
    Hassas bilgiler (user_id, linkedin, earnings) döndürülmez.
    """
    profile = db.query(TalentProfile).filter(
        TalentProfile.id == profile_id,
        TalentProfile.is_public.is_(True),
        TalentProfile.kyc_status == "approved",
        TalentProfile.is_active.is_(True),
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("TALENT_PROFILE_NOT_FOUND", "Profil bulunamadı veya herkese açık değil"),
        )

    return TalentPublicProfileOut.model_validate(profile)


# ---------------------------------------------------------------------------
# GET /talent/admin/profiles
# ---------------------------------------------------------------------------


@router.get("/admin/profiles", response_model=PaginatedTalentProfilesOut)
def list_talent_profiles_admin(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    kyc_status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedTalentProfilesOut:
    """Tüm talent profillerini listeler. Yalnızca platform admin/staff erişebilir."""
    if not can_access_talent_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("TALENT_ADMIN_FORBIDDEN", "Talent yönetim paneline erişim yetkiniz yok"),
        )

    q = db.query(TalentProfile)
    if kyc_status:
        q = q.filter(TalentProfile.kyc_status == kyc_status)
    q = q.order_by(TalentProfile.created_at.desc())

    total = q.count()
    offset = (page - 1) * size
    rows = q.offset(offset).limit(size).all()

    return PaginatedTalentProfilesOut(
        total=total,
        page=page,
        size=size,
        items=[TalentProfileOut.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# PATCH /talent/admin/profiles/{profile_id}/kyc
# ---------------------------------------------------------------------------


@router.patch("/admin/profiles/{profile_id}/kyc", response_model=TalentProfileOut)
def update_talent_kyc_status(
    profile_id: int,
    payload: TalentKycStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TalentProfileOut:
    """Talent profili KYC durumunu günceller. Yalnızca reviewer yetkisi olanlara açık."""
    if not can_review_talent_profile(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("KYC_REVIEW_FORBIDDEN", "KYC inceleme yetkiniz yok"),
        )

    profile = db.query(TalentProfile).filter(TalentProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("TALENT_PROFILE_NOT_FOUND", "Talent profili bulunamadı"),
        )

    profile.kyc_status = payload.kyc_status  # type: ignore[assignment]
    if payload.kyc_notes is not None:
        profile.kyc_notes = payload.kyc_notes  # type: ignore[assignment]

    db.commit()
    db.refresh(profile)
    return TalentProfileOut.model_validate(profile)
