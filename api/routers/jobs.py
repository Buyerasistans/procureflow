from __future__ import annotations

import json
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from api.core.authz import (
    can_access_talent_admin,
    can_post_procurement_job,
    is_super_admin,
    is_platform_staff,
)
from api.core.deps import get_current_user, get_db
from api.models import User
from api.models.talent import ProcurementJob
from api.schemas.jobs import (
    PaginatedJobsOut,
    ProcurementJobCreate,
    ProcurementJobOut,
    ProcurementJobUpdate,
    _safe_parse_list,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _err(code: str, message: str) -> dict:
    return {"code": code, "message": message, "request_id": str(uuid.uuid4())}


def _require_write_access(user: User) -> None:
    if not can_post_procurement_job(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("JOBS_WRITE_FORBIDDEN", "İş ilanı oluşturma/düzenleme yetkiniz yok"),
        )


def _is_broad_admin(user: User) -> bool:
    return is_super_admin(user) or is_platform_staff(user)


def _scoped_query(db: Session, user: User):
    """Kullanıcı yetkisine göre job sorgu kapsamını döner."""
    q = db.query(ProcurementJob)
    if _is_broad_admin(user) or can_access_talent_admin(user):
        return q
    if can_post_procurement_job(user):
        # Employer admin: kendi tenant ilanları + published diğerleri
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id:
            from sqlalchemy import or_
            q = q.filter(
                or_(
                    ProcurementJob.tenant_id == tenant_id,
                    ProcurementJob.status == "published",
                )
            )
        else:
            q = q.filter(ProcurementJob.status == "published")
        return q
    # Talent member / referral partner: sadece published
    return q.filter(ProcurementJob.status == "published")


# ---------------------------------------------------------------------------
# POST /jobs
# ---------------------------------------------------------------------------


@router.post("", response_model=ProcurementJobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: ProcurementJobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProcurementJobOut:
    """Yeni iş ilanı oluşturur. `is_procurement_only` backend tarafında zorunlu `True`."""
    _require_write_access(current_user)

    job = ProcurementJob(
        tenant_id=getattr(current_user, "tenant_id", None),
        posted_by_user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        employment_type=payload.employment_type,
        location_type=payload.location_type,
        city=payload.city,
        country=payload.country,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
        salary_period=payload.salary_period,
        required_skills_json=(
            json.dumps(payload.required_skills, ensure_ascii=False)
            if payload.required_skills
            else None
        ),
        min_experience_years=payload.min_experience_years,
        status=payload.status,
        application_deadline=payload.application_deadline,
        is_procurement_only=True,  # always enforced
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return ProcurementJobOut.model_validate(job)


# ---------------------------------------------------------------------------
# GET /jobs  (paginated + filtered + sorted)
# ---------------------------------------------------------------------------

_SORT_MAP = {
    "created_at": ProcurementJob.created_at,
    "updated_at": ProcurementJob.updated_at,
    "id": ProcurementJob.id,
    "title": ProcurementJob.title,
    "application_count": ProcurementJob.application_count,
}


@router.get("", response_model=PaginatedJobsOut)
def list_jobs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    employment_type: str | None = Query(default=None),
    location_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: Literal["asc", "desc"] = Query(default="desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedJobsOut:
    """İş ilanlarını sayfalı, filtrelenmiş ve sıralı döndürür."""
    q = _scoped_query(db, current_user)

    if status_filter:
        q = q.filter(ProcurementJob.status == status_filter)
    if employment_type:
        q = q.filter(ProcurementJob.employment_type == employment_type)
    if location_type:
        q = q.filter(ProcurementJob.location_type == location_type)
    if category:
        q = q.filter(ProcurementJob.category == category)

    sort_col = _SORT_MAP.get(sort_by, ProcurementJob.created_at)
    q = q.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

    total = q.count()
    offset = (page - 1) * size
    rows = q.offset(offset).limit(size).all()

    return PaginatedJobsOut(
        total=total,
        page=page,
        size=size,
        items=[ProcurementJobOut.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# GET /jobs/{id}
# ---------------------------------------------------------------------------


@router.get("/{job_id}", response_model=ProcurementJobOut)
def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProcurementJobOut:
    """Tek iş ilanını döndürür ve görüntüleme sayacını artırır."""
    q = _scoped_query(db, current_user)
    job = q.filter(ProcurementJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("JOB_NOT_FOUND", "İş ilanı bulunamadı veya erişim yetkiniz yok"),
        )
    # view_count increment — fire-and-forget (no commit failure guard needed)
    job.view_count = (job.view_count or 0) + 1  # type: ignore[assignment]
    db.commit()
    db.refresh(job)
    return ProcurementJobOut.model_validate(job)


# ---------------------------------------------------------------------------
# PATCH /jobs/{id}
# ---------------------------------------------------------------------------


@router.patch("/{job_id}", response_model=ProcurementJobOut)
def update_job(
    job_id: int,
    payload: ProcurementJobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProcurementJobOut:
    """İş ilanını kısmen günceller. Poster veya geniş admin gereklidir."""
    _require_write_access(current_user)

    job = db.query(ProcurementJob).filter(ProcurementJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("JOB_NOT_FOUND", "İş ilanı bulunamadı"),
        )

    # Sadece ilanı açan kullanıcı veya broad admin düzenleyebilir
    if not _is_broad_admin(current_user) and job.posted_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("JOB_EDIT_FORBIDDEN", "Yalnızca ilanı açan kullanıcı düzenleyebilir"),
        )

    if payload.title is not None:
        job.title = payload.title  # type: ignore[assignment]
    if payload.description is not None:
        job.description = payload.description  # type: ignore[assignment]
    if payload.category is not None:
        job.category = payload.category  # type: ignore[assignment]
    if payload.employment_type is not None:
        job.employment_type = payload.employment_type  # type: ignore[assignment]
    if payload.location_type is not None:
        job.location_type = payload.location_type  # type: ignore[assignment]
    if payload.city is not None:
        job.city = payload.city  # type: ignore[assignment]
    if payload.country is not None:
        job.country = payload.country  # type: ignore[assignment]
    if payload.salary_min is not None:
        job.salary_min = payload.salary_min  # type: ignore[assignment]
    if payload.salary_max is not None:
        job.salary_max = payload.salary_max  # type: ignore[assignment]
    if payload.salary_currency is not None:
        job.salary_currency = payload.salary_currency  # type: ignore[assignment]
    if payload.salary_period is not None:
        job.salary_period = payload.salary_period  # type: ignore[assignment]
    if payload.required_skills is not None:
        job.required_skills_json = json.dumps(payload.required_skills, ensure_ascii=False)  # type: ignore[assignment]
    if payload.min_experience_years is not None:
        job.min_experience_years = payload.min_experience_years  # type: ignore[assignment]
    if payload.status is not None:
        job.status = payload.status  # type: ignore[assignment]
    if payload.application_deadline is not None:
        job.application_deadline = payload.application_deadline  # type: ignore[assignment]

    # is_procurement_only is NEVER updated — always True
    job.is_procurement_only = True  # type: ignore[assignment]

    db.commit()
    db.refresh(job)
    return ProcurementJobOut.model_validate(job)
