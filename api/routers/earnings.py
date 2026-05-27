from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.core.authz import can_approve_payout, is_talent_member
from api.core.deps import get_current_user, get_db
from api.core.time import utcnow
from api.models import User
from api.models.talent import EarningsLedger, PayoutRequest, TalentProfile
from api.schemas.earnings import (
    EarningsLedgerOut,
    PaginatedEarningsOut,
    PaginatedPayoutRequestsOut,
    PayoutRequestCreate,
    PayoutRequestOut,
    PayoutRequestStatusUpdate,
)

# Single router — full paths defined per-endpoint (spans /talent/me and /admin prefixes)
router = APIRouter(tags=["earnings"])

# Valid admin-side payout status transitions
_PAYOUT_TRANSITIONS: dict[str, set[str]] = {
    "pending":    {"approved", "rejected"},
    "approved":   {"processing"},
    "processing": {"paid"},
    "paid":       set(),
    "rejected":   set(),
}


def _err(code: str, message: str) -> dict:
    return {"code": code, "message": message, "request_id": str(uuid.uuid4())}


def _require_talent_profile(user: User, db: Session) -> TalentProfile:
    profile = db.query(TalentProfile).filter(TalentProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_err(
                "TALENT_PROFILE_REQUIRED",
                "Bu işlem için önce talent profili oluşturulmalı (POST /talent/register)",
            ),
        )
    return profile


# ---------------------------------------------------------------------------
# GET /talent/me/earnings
# ---------------------------------------------------------------------------


@router.get("/talent/me/earnings", response_model=PaginatedEarningsOut)
def get_my_earnings(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedEarningsOut:
    """Giriş yapmış talent üyesinin kazanç ledger kayıtlarını döndürür (immutable log)."""
    if not is_talent_member(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("EARNINGS_FORBIDDEN", "Kazanç geçmişine erişim yalnızca talent üyelerine açık"),
        )

    profile = _require_talent_profile(current_user, db)

    q = (
        db.query(EarningsLedger)
        .filter(EarningsLedger.talent_profile_id == profile.id)
        .order_by(EarningsLedger.created_at.desc())
    )
    total = q.count()
    offset = (page - 1) * size
    rows = q.offset(offset).limit(size).all()

    return PaginatedEarningsOut(
        total=total,
        page=page,
        size=size,
        items=[EarningsLedgerOut.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# POST /talent/me/payout-request
# ---------------------------------------------------------------------------


@router.post(
    "/talent/me/payout-request",
    response_model=PayoutRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_payout_request(
    payload: PayoutRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayoutRequestOut:
    """Ödeme talebi oluşturur.

    Aynı anda yalnızca bir pending talep olabilir (409).
    Tutar sıfırdan büyük olmalı (schema gt=0 ile zorunlu).
    Bank details response'ta maskelenmiş döner.
    """
    if not is_talent_member(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("PAYOUT_FORBIDDEN", "Ödeme talebi yalnızca talent üyeleri oluşturabilir"),
        )

    profile = _require_talent_profile(current_user, db)

    # Duplicate pending check
    existing_pending = (
        db.query(PayoutRequest)
        .filter(
            PayoutRequest.talent_profile_id == profile.id,
            PayoutRequest.status == "pending",
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_err(
                "PAYOUT_PENDING_EXISTS",
                f"Bekleyen bir ödeme talebiniz zaten mevcut (id: {existing_pending.id})",
            ),
        )

    payout = PayoutRequest(
        user_id=current_user.id,
        talent_profile_id=profile.id,
        amount=payload.amount,
        currency=payload.currency,
        payment_method=payload.payment_method,
        bank_details_json=(
            json.dumps(payload.bank_details, ensure_ascii=False)
            if payload.bank_details is not None
            else None
        ),
        status="pending",
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return PayoutRequestOut.model_validate(payout)


# ---------------------------------------------------------------------------
# GET /admin/payout-requests
# ---------------------------------------------------------------------------


@router.get("/admin/payout-requests", response_model=PaginatedPayoutRequestsOut)
def list_payout_requests(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaginatedPayoutRequestsOut:
    """Ödeme taleplerini listeler. Default: pending önce (created_at asc)."""
    if not can_approve_payout(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("PAYOUT_ADMIN_FORBIDDEN", "Ödeme taleplerini görüntüleme yetkiniz yok"),
        )

    q = db.query(PayoutRequest)
    if status_filter:
        q = q.filter(PayoutRequest.status == status_filter)
    else:
        # Default: pending önce, sonra diğerleri (created_at asc within group)
        q = q.order_by(
            (PayoutRequest.status != "pending").asc(),
            PayoutRequest.created_at.asc(),
        )

    if status_filter:
        q = q.order_by(PayoutRequest.created_at.asc())

    total = q.count()
    offset = (page - 1) * size
    rows = q.offset(offset).limit(size).all()

    return PaginatedPayoutRequestsOut(
        total=total,
        page=page,
        size=size,
        items=[PayoutRequestOut.model_validate(r) for r in rows],
    )


# ---------------------------------------------------------------------------
# PATCH /admin/payout-requests/{payout_id}
# ---------------------------------------------------------------------------


@router.patch("/admin/payout-requests/{payout_id}", response_model=PayoutRequestOut)
def update_payout_status(
    payout_id: int,
    payload: PayoutRequestStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayoutRequestOut:
    """Ödeme talebi durum geçişi. Zincir: pending→approved→processing→paid; ya da pending→rejected."""
    if not can_approve_payout(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_err("PAYOUT_REVIEW_FORBIDDEN", "Ödeme talebini güncelleme yetkiniz yok"),
        )

    payout = db.query(PayoutRequest).filter(PayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_err("PAYOUT_NOT_FOUND", "Ödeme talebi bulunamadı"),
        )

    current_status = payout.status
    target_status = payload.status
    allowed = _PAYOUT_TRANSITIONS.get(current_status, set())

    if target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_err(
                "INVALID_PAYOUT_TRANSITION",
                f"'{current_status}' → '{target_status}' geçişi geçersiz. "
                f"İzin verilen: {sorted(allowed) or 'yok (terminal durum)'}",
            ),
        )

    payout.status = target_status  # type: ignore[assignment]
    payout.reviewer_user_id = current_user.id  # type: ignore[assignment]
    payout.reviewed_at = utcnow()  # type: ignore[assignment]

    if target_status == "paid":
        payout.paid_at = utcnow()  # type: ignore[assignment]

    if payload.rejection_reason is not None:
        payout.rejection_reason = payload.rejection_reason  # type: ignore[assignment]

    db.commit()
    db.refresh(payout)
    return PayoutRequestOut.model_validate(payout)
