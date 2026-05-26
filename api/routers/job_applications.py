from __future__ import annotations

import uuid
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.core.authz import (
    can_post_procurement_job,
    is_super_admin,
    is_platform_staff,
    is_talent_member,
)
from api.core.deps import get_current_user, get_db
from api.core.time import utcnow
from api.models import User
from api.models.talent import JobApplication, ProcurementJob, TalentProfile
from api.schemas.job_applications import (
    JobApplicationCreate,
    JobApplicationOut,
    JobApplicationStatusUpdate,
)

router = APIRouter(tags=["job-applications"])

# Status transition state machine (employer-side transitions only)
# Talent withdrawal is a separate flow (PHASE 3+)
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "applied":     {"shortlisted", "rejected"},
    "shortlisted": {"interview", "rejected"},
    "interview":   {"offered", "rejected"},
    "offered":     {"rejected"},
    "rejected":    set(),
    "withdrawn":   set(),
}


def _err(code: str, message: str) -> dict:
    return {"code": code, "message": message, "request_id": str(uuid.uuid4())}


def _is_broad_admin(user: User) -> bool:
    return is_super_admin(user) or is_platform_staff(user)


# ---------------------------------------------------------------------------
# POST /jobs/{job_id}/apply
# ---------------------------------------------------------------------------


@router.post(
    "/jobs/{job_id}/apply",
    response_model=JobApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply_to_job(
    job_id: int,
    payload: JobApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobApplicationOut:
    """Talent üyesi iş ilanına başvurur.

    Gereksinimler: is_talent_member, aktif TalentProfile, published job.
    Duplicate başvuru uq_job_applicant kısıtı ile 409 döner.
    Başarılı başvuruda job.application_count bir artırılır.
    """
    if not is_talent_member(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("APPLY_FORBIDDEN", "Yalnızca talent üyeleri iş ilanına başvurabilir"),
        )

    job = db.query(ProcurementJob).filter(ProcurementJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("JOB_NOT_FOUND", "İş ilanı bulunamadı"),
        )
    if job.status != "published":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err("JOB_NOT_PUBLISHED", "Yalnızca yayında olan ilanlara başvurulabilir"),
        )

    talent_profile = (
        db.query(TalentProfile)
        .filter(TalentProfile.user_id == current_user.id)
        .first()
    )
    if not talent_profile:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err(
                "TALENT_PROFILE_REQUIRED",
                "Başvuru için önce talent profili oluşturulmalı (POST /talent/register)",
            ),
        )

    application = JobApplication(
        job_id=job_id,
        applicant_user_id=current_user.id,
        talent_profile_id=talent_profile.id,
        cover_letter=payload.cover_letter,
        status="applied",
    )
    db.add(application)

    try:
        db.flush()  # catch unique violation before application_count increment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_err(
                "DUPLICATE_APPLICATION",
                "Bu iş ilanına zaten başvurdunuz",
            ),
        )

    job.application_count = (job.application_count or 0) + 1  # type: ignore[assignment]
    db.commit()
    db.refresh(application)
    return JobApplicationOut.model_validate(application)


# ---------------------------------------------------------------------------
# GET /jobs/{job_id}/applications
# ---------------------------------------------------------------------------


@router.get(
    "/jobs/{job_id}/applications",
    response_model=list[JobApplicationOut],
)
def list_job_applications(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[JobApplicationOut]:
    """İş ilanının başvurularını listeler. Tenant-aware erişim kontrolü uygulanır."""
    if not can_post_procurement_job(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("APPLICATIONS_FORBIDDEN", "Başvuruları görüntüleme yetkiniz yok"),
        )

    job = db.query(ProcurementJob).filter(ProcurementJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("JOB_NOT_FOUND", "İş ilanı bulunamadı"),
        )

    # Tenant-aware: employer can only see their own tenant's job applications
    if not _is_broad_admin(current_user):
        tenant_id = getattr(current_user, "tenant_id", None)
        if job.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=_err(
                    "APPLICATIONS_TENANT_MISMATCH",
                    "Bu ilanın başvurularına erişim yetkiniz yok",
                ),
            )

    rows = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job_id)
        .order_by(JobApplication.applied_at.desc())
        .all()
    )
    return [JobApplicationOut.model_validate(r) for r in rows]


# ---------------------------------------------------------------------------
# PATCH /applications/{application_id}/status
# ---------------------------------------------------------------------------


@router.patch(
    "/applications/{application_id}/status",
    response_model=JobApplicationOut,
)
def update_application_status(
    application_id: int,
    payload: JobApplicationStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobApplicationOut:
    """Başvuru durumunu günceller. Sadece geçerli geçişlere izin verilir."""
    if not can_post_procurement_job(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("STATUS_UPDATE_FORBIDDEN", "Başvuru durumu güncelleme yetkiniz yok"),
        )

    application = (
        db.query(JobApplication).filter(JobApplication.id == application_id).first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("APPLICATION_NOT_FOUND", "Başvuru bulunamadı"),
        )

    # Tenant-aware ownership check
    if not _is_broad_admin(current_user):
        job = db.query(ProcurementJob).filter(ProcurementJob.id == application.job_id).first()
        tenant_id = getattr(current_user, "tenant_id", None)
        if job and job.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=_err(
                    "STATUS_UPDATE_TENANT_MISMATCH",
                    "Bu başvuruyu güncelleme yetkiniz yok",
                ),
            )

    current_status = application.status
    target_status = payload.status
    allowed = _VALID_TRANSITIONS.get(current_status, set())

    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_err(
                "INVALID_STATUS_TRANSITION",
                f"'{current_status}' → '{target_status}' geçişi geçersiz. "
                f"İzin verilen: {sorted(allowed) or 'yok (terminal durum)'}",
            ),
        )

    application.status = target_status  # type: ignore[assignment]
    application.reviewed_by_user_id = current_user.id  # type: ignore[assignment]
    application.reviewed_at = utcnow()  # type: ignore[assignment]
    if payload.employer_note is not None:
        application.employer_note = payload.employer_note  # type: ignore[assignment]

    db.commit()
    db.refresh(application)
    return JobApplicationOut.model_validate(application)
