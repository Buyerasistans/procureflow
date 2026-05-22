"""Approval Workflow Endpoints"""

from enum import Enum

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.core.authz import is_admin_like
from api.core.deps import get_current_user
from api.database import get_db
from api.models import Quote, QuoteApproval, User
from api.services.email_service import get_email_service
from api.services.quote_approval_service import (
    approve_submission_quote,
    build_approval_role_contract,
    ensure_submission_approvals,
    get_business_role_label,
    get_quote_level_approvals,
    get_role_label,
    list_project_business_role_approvers,
    normalize_user_business_role,
    pending_approval_matches_business_role,
    reject_submission_quote,
    resolve_required_business_role,
)

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _current_tenant_id(current_user: User) -> int | None:
    return getattr(current_user, "tenant_id", None)


class ApprovalAction(str, Enum):
    """Onay aksiyonları"""

    APPROVE = "onay"
    REJECT = "red"


class ApprovalCommentRequest(BaseModel):
    """Onay işlemi - yorum"""

    comment: str | None = None


class ApprovalRejectRequest(BaseModel):
    """Red işlemi - zorunlu yorum"""

    comment: str


def _get_quote_or_404(db: Session, quote_id: int) -> Quote:
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    return quote


def _ensure_quote_scope(quote: Quote, current_user: User) -> None:
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and quote.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Bu teklif üzerinde yetkiniz yok")


def _require_quote_tenant_scope(quote: Quote, current_user: User) -> None:
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is None:
        return
    if quote.tenant_id is None:
        raise HTTPException(
            status_code=400,
            detail="Tenant kapsamı eksik quote için approval akışı başlatılamaz. Önce tenant backfill akışını tamamlayın.",
        )


@router.get("/user/pending")
def get_user_pending_approvals(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Kullanıcının onaylaması gereken teklifleri getir"""

    user_role = normalize_user_business_role(current_user)
    if not user_role:
        return []

    query = db.query(QuoteApproval).filter(
        QuoteApproval.supplier_quote_id.is_(None),
        QuoteApproval.status == "beklemede",
    )
    if _current_tenant_id(current_user) is not None:
        query = query.filter(
            QuoteApproval.tenant_id == _current_tenant_id(current_user)
        )
    if not is_admin_like(current_user):
        query = query.filter(pending_approval_matches_business_role(user_role))

    pending_approvals = query.all()

    return [
        {
            "approval_id": approval.id,
            "quote_id": approval.quote.id,
            "quote_title": approval.quote.title,
            "quote_status": approval.quote.status,
            "total_amount": float(approval.quote.total_amount or 0),
            "company_name": approval.quote.company_name,
            "approval_level": approval.approval_level,
            **build_approval_role_contract(approval),
            "requested_at": approval.requested_at,
            "created_at": approval.quote.created_at,
        }
        for approval in pending_approvals
    ]


@router.post("/{quote_id}/request-approvals")
def request_approvals(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Teklif için gönderim onay kayıtlarını oluşturur."""

    quote = _get_quote_or_404(db, quote_id)
    _ensure_quote_scope(quote, current_user)
    _require_quote_tenant_scope(quote, current_user)
    if quote.created_by_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Sadece oluşturan kişi onay talep edebilir"
        )

    try:
        approvals = ensure_submission_approvals(db, quote)
        db.commit()

        if approvals:
            first_approval = approvals[0]
            first_business_role = resolve_required_business_role(first_approval)
            first_business_role_label = get_business_role_label(first_business_role)
            approvers = list_project_business_role_approvers(
                db, quote, first_business_role
            )
            for approver in approvers:
                if approver.email:
                    email_service.send_approval_request(
                        to_email=approver.email,
                        approver_name=approver.full_name or approver.email,
                        quote_title=quote.title,
                        total_amount=float(quote.total_amount or 0),
                        approval_level=f"{first_business_role_label} Onayı",
                        approval_url=f"{email_service.app_url}/approvals?quote_id={quote.id}",
                        company_name="ProcureFlow",
                        owner_user_id=quote.created_by_id,
                    )

        return {
            "status": "success",
            "message": "Onay istekleri oluşturuldu"
            if approvals
            else "Bu teklif için ek gönderim onayı gerekmiyor",
            "approvals": len(approvals),
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{quote_id}/pending")
def get_pending_approvals(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Teklif için beklemede olan onayları getir"""

    quote = _get_quote_or_404(db, quote_id)
    _ensure_quote_scope(quote, current_user)
    approvals = get_quote_level_approvals(db, quote_id)

    return [
        {
            "id": approval.id,
            "level": approval.approval_level,
            **build_approval_role_contract(approval),
            "status": approval.status,
            "requested_at": approval.requested_at,
            "completed_at": approval.completed_at,
            "approver_name": approval.approved_by.full_name
            if approval.approved_by
            else None,
            "comment": approval.comment,
        }
        for approval in approvals
    ]


@router.post("/{quote_id}/approve")
def approve_quote(
    quote_id: int,
    request: ApprovalCommentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Teklifin gönderim onayını tamamlar."""

    quote = _get_quote_or_404(db, quote_id)
    _ensure_quote_scope(quote, current_user)

    try:
        result = approve_submission_quote(db, quote, current_user, request.comment)

        if result.next_approval:
            approvers = list_project_business_role_approvers(
                db, quote, resolve_required_business_role(result.next_approval)
            )
            for approver in approvers:
                if approver.email:
                    email_service.send_approval_request(
                        to_email=approver.email,
                        approver_name=approver.full_name or approver.email,
                        quote_title=quote.title,
                        total_amount=float(quote.total_amount or 0),
                        approval_level=f"{get_business_role_label(resolve_required_business_role(result.next_approval))} Onayı",
                        approval_url=f"{email_service.app_url}/approvals?quote_id={quote.id}",
                        company_name="ProcureFlow",
                        owner_user_id=quote.created_by_id,
                    )
        elif quote.created_by_user and quote.created_by_user.email:
            email_service._send_smtp(
                to_email=quote.created_by_user.email,
                subject=f"{quote.title} - Gönderim Onayı Tamamlandı",
                html_content=f"""
                <html>
                    <body style="font-family: Arial, sans-serif;">
                        <h2>Gönderim Onayı Tamamlandı</h2>
                        <p><strong>{quote.title}</strong> için gerekli gönderim onayları tamamlandı.</p>
                        <p><strong>Toplam Tutar:</strong> ₺{float(quote.total_amount or 0):,.2f}</p>
                        <p>Artık tedarikçilere gönderim yapabilirsiniz.</p>
                    </body>
                </html>
                """,
                owner_user_id=quote.created_by_id,
            )

        db.commit()
        return {
            "status": "success",
            "message": "Gönderim onayı kaydedildi",
            "approval_level": result.pending_approval.approval_level,
            "workflow_completed": result.workflow_completed,
            "next_step": (
                f"Sıradaki onay: {get_business_role_label(resolve_required_business_role(result.next_approval))}"
                if result.next_approval
                else "Tedarikçiye gönderime hazır"
            ),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{quote_id}/reject")
def reject_quote(
    quote_id: int,
    request: ApprovalRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Teklifi gözden geçirme için iade eder."""

    if not request.comment:
        raise HTTPException(status_code=400, detail="Red nedeni yazmanız gerekir")

    quote = _get_quote_or_404(db, quote_id)
    _ensure_quote_scope(quote, current_user)

    try:
        result = reject_submission_quote(db, quote, current_user, request.comment)

        if quote.created_by_user and quote.created_by_user.email:
            email_service._send_smtp(
                to_email=quote.created_by_user.email,
                subject=f"{quote.title} - Teklif Gözden Geçirme İçin İade Edildi",
                html_content=f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <h2>Hata ve Eksikler Var</h2>
                        <p><strong>{quote.title}</strong> teklifi {current_user.full_name or 'Yetkili'} tarafından gözden geçirme için iade edildi.</p>
                        <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <strong>Açıklama:</strong><br>
                            {request.comment}
                        </div>
                        <p>Teklifi düzenleyerek tekrar gönderebilirsiniz.</p>
                    </body>
                </html>
                """,
            )

        db.commit()
        return {
            "status": "success",
            "message": "Hata ve eksikler var, teklif gözden geçirme için iade edildi",
            "approval_level": result.pending_approval.approval_level,
            "quote_status": result.quote_status,
            "reason": request.comment,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
