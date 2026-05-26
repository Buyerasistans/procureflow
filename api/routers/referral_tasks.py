from __future__ import annotations

import json
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.core.authz import (
    can_publish_referral_task,
    is_talent_ecosystem_member,
    is_talent_member,
    is_super_admin,
    is_platform_staff,
)
from api.core.deps import get_current_user, get_db
from api.core.time import utcnow
from api.models import User
from api.models.talent import ReferralSubmission, ReferralTask, TalentProfile
from api.schemas.referral_tasks import (
    PaginatedTasksOut,
    ReferralSubmissionCreate,
    ReferralSubmissionOut,
    ReferralTaskCreate,
    ReferralTaskOut,
)

router = APIRouter(prefix="/tasks", tags=["referral-tasks"])

_SORT_MAP = {
    "created_at": ReferralTask.created_at,
    "deadline": ReferralTask.deadline,
    "reward_amount": ReferralTask.reward_amount,
    "submission_count": ReferralTask.submission_count,
}


def _err(code: str, message: str) -> dict:
    return {"code": code, "message": message, "request_id": str(uuid.uuid4())}


def _is_broad_admin(user: User) -> bool:
    return is_super_admin(user) or is_platform_staff(user)


# ---------------------------------------------------------------------------
# POST /tasks
# ---------------------------------------------------------------------------


@router.post("", response_model=ReferralTaskOut, status_code=status.HTTP_201_CREATED)
def create_referral_task(
    payload: ReferralTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReferralTaskOut:
    """Yeni referral görevi oluşturur. Yalnızca platform staff / super admin."""
    if not can_publish_referral_task(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("TASK_CREATE_FORBIDDEN", "Referral görevi yalnızca platform staff tarafından oluşturulabilir"),
        )

    task = ReferralTask(
        created_by_user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        task_type=payload.task_type,
        reward_amount=payload.reward_amount,
        reward_currency=payload.reward_currency,
        reward_type=payload.reward_type,
        target_category=payload.target_category,
        instructions_json=(
            json.dumps(payload.instructions, ensure_ascii=False)
            if payload.instructions is not None
            else None
        ),
        max_submissions=payload.max_submissions,
        deadline=payload.deadline,
        status=payload.status,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return ReferralTaskOut.model_validate(task)


# ---------------------------------------------------------------------------
# GET /tasks
# ---------------------------------------------------------------------------


@router.get("", response_model=PaginatedTasksOut)
def list_referral_tasks(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    task_type: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: Literal["asc", "desc"] = Query(default="desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedTasksOut:
    """Referral görevlerini listeler. Minimum güvenli görünürlük: sadece active görevler."""
    if not is_talent_ecosystem_member(current_user) and not _is_broad_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("TASKS_FORBIDDEN", "Referral görevlerine erişim yetkiniz yok"),
        )

    q = db.query(ReferralTask)

    # Broad admin tüm görevleri görür; ecosystem members yalnızca active/closed (tamamlanmış tarih)
    if not _is_broad_admin(current_user):
        q = q.filter(ReferralTask.status == "active")

    if status_filter and _is_broad_admin(current_user):
        q = q.filter(ReferralTask.status == status_filter)
    elif status_filter:
        # Ecosystem member yalnızca active'ı filtreleyebilir — diğer değerleri sil
        if status_filter == "active":
            pass  # already filtered
        else:
            # Return empty — they can't see non-active tasks
            return PaginatedTasksOut(total=0, page=page, size=size, items=[])

    if task_type:
        q = q.filter(ReferralTask.task_type == task_type)

    sort_col = _SORT_MAP.get(sort_by, ReferralTask.created_at)
    q = q.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

    total = q.count()
    offset = (page - 1) * size
    rows = q.offset(offset).limit(size).all()

    return PaginatedTasksOut(
        total=total,
        page=page,
        size=size,
        items=[ReferralTaskOut.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# POST /tasks/{task_id}/submit
# ---------------------------------------------------------------------------


@router.post(
    "/{task_id}/submit",
    response_model=ReferralSubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_referral_task(
    task_id: int,
    payload: ReferralSubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReferralSubmissionOut:
    """Talent üyesi göreve katkı sunar.

    Gereksinimler: is_talent_member, aktif TalentProfile, active görev.
    Görev doluysa (max_submissions) veya süresi geçmişse uygun hata döner.
    Duplicate gönderim uq_task_submitter kısıtı ile 409 döner.
    Başarılı gönderimlerde task.submission_count bir artırılır.
    """
    if not is_talent_member(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("SUBMIT_FORBIDDEN", "Yalnızca talent üyeleri göreve katkı sunabilir"),
        )

    task = db.query(ReferralTask).filter(ReferralTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("TASK_NOT_FOUND", "Referral görevi bulunamadı"),
        )

    if task.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err(
                "TASK_NOT_ACTIVE",
                f"Bu göreve katkı sunulamaz (durum: {task.status})",
            ),
        )

    if task.deadline and task.deadline < utcnow():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err("TASK_EXPIRED", "Bu görevin son başvuru tarihi geçmiş"),
        )

    if task.max_submissions is not None and task.submission_count >= task.max_submissions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err("TASK_FULL", "Bu görev maksimum katkı sayısına ulaştı"),
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
                "Katkı için önce talent profili oluşturulmalı (POST /talent/register)",
            ),
        )

    submission = ReferralSubmission(
        task_id=task_id,
        submitter_user_id=current_user.id,
        talent_profile_id=talent_profile.id,
        submission_content_json=json.dumps(payload.submission_content, ensure_ascii=False),
        status="pending",
    )
    db.add(submission)

    try:
        db.flush()  # catch uq_task_submitter before submission_count increment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_err("DUPLICATE_SUBMISSION", "Bu göreve zaten katkı sundunuz"),
        )

    task.submission_count = (task.submission_count or 0) + 1  # type: ignore[assignment]
    db.commit()
    db.refresh(submission)
    return ReferralSubmissionOut.model_validate(submission)
