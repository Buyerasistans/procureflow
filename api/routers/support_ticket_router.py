"""Support Ticket Router — Tenant kullanıcıları destek talebi oluşturur ve takip eder."""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.core.deps import get_db, get_current_user
from api.core.authz import (
    is_super_admin,
    is_platform_staff,
    can_access_admin_surface,
    can_read_admin_catalog,
)
from api.core.time import utcnow
from api.models.support_ticket import SupportTicket
from api.models.user import User

router = APIRouter(tags=["support_tickets"])

# ---------------------------------------------------------------------------
# Pydantic şemaları
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"billing", "onboarding", "technical", "account", "general"}
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
VALID_STATUSES = {"open", "in_progress", "waiting_response", "resolved", "closed"}
VALID_SOURCES = {"tenant_portal", "platform_ops", "post_activation", "help_center"}

# SLA süreleri (saat cinsinden) önceliğe göre
SLA_HOURS: dict[str, int] = {
    "urgent": 4,
    "high": 24,
    "medium": 72,
    "low": 168,
}


def _compute_sla(priority: str) -> datetime:
    hours = SLA_HOURS.get(priority, 72)
    return datetime.now(timezone.utc) + timedelta(hours=hours)


class TicketCreate(BaseModel):
    subject: str
    description: str | None = None
    category: str = "general"
    priority: str = "medium"
    source: str = "tenant_portal"


class TicketAdminUpdate(BaseModel):
    status: str | None = None
    assigned_to_user_id: int | None = None
    resolution_note: str | None = None
    priority: str | None = None


def _ticket_to_dict(ticket: SupportTicket) -> dict[str, Any]:
    return {
        "id": ticket.id,
        "tenant_id": ticket.tenant_id,
        "created_by_user_id": ticket.created_by_user_id,
        "assigned_to_user_id": ticket.assigned_to_user_id,
        "subject": ticket.subject,
        "description": ticket.description,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "source": ticket.source,
        "resolution_note": ticket.resolution_note,
        "sla_due_at": ticket.sla_due_at.isoformat() if ticket.sla_due_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        "is_visible_to_tenant": ticket.is_visible_to_tenant,
        "created_at": ticket.created_at.isoformat(),
        "updated_at": ticket.updated_at.isoformat(),
        "created_by_name": (
            ticket.created_by_user.full_name if ticket.created_by_user else None
        ),
        "assigned_to_name": (
            ticket.assigned_to_user.full_name if ticket.assigned_to_user else None
        ),
        "tenant_name": (
            ticket.tenant.brand_name or ticket.tenant.legal_name
            if ticket.tenant
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Tenant endpoint'leri (oturum sahibi kendi tenant'ının ticket'larını yönetir)
# ---------------------------------------------------------------------------


@router.post("/support/tickets", summary="Destek talebi oluştur")
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Oturum açmış kullanıcının tenantı adına destek talebi oluşturur."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aktif bir tenant bulunamadı.",
        )
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Geçersiz kategori. Geçerli değerler: {sorted(VALID_CATEGORIES)}",
        )
    if payload.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Geçersiz öncelik. Geçerli değerler: {sorted(VALID_PRIORITIES)}",
        )
    source = payload.source if payload.source in VALID_SOURCES else "tenant_portal"

    ticket = SupportTicket(
        tenant_id=current_user.tenant_id,
        created_by_user_id=current_user.id,
        subject=payload.subject.strip(),
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        status="open",
        source=source,
        sla_due_at=_compute_sla(payload.priority),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _ticket_to_dict(ticket)


@router.get("/support/tickets", summary="Kendi destek taleplerini listele")
def list_my_tickets(
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Oturum sahibinin tenantına ait (tenant'a görünür) ticket listesi."""
    if not current_user.tenant_id:
        return []
    query = db.query(SupportTicket).filter(
        SupportTicket.tenant_id == current_user.tenant_id,
        SupportTicket.is_visible_to_tenant.is_(True),
    )
    if status_filter and status_filter in VALID_STATUSES:
        query = query.filter(SupportTicket.status == status_filter)
    tickets = query.order_by(SupportTicket.created_at.desc()).limit(100).all()
    return [_ticket_to_dict(t) for t in tickets]


@router.get("/support/tickets/{ticket_id}", summary="Destek talebi detayı")
def get_ticket_detail(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Destek talebi bulunamadı.")
    # Platform personeli her ticket'ı görebilir; tenant kullanıcısı yalnızca kendi tenantınıkini
    if not can_read_admin_catalog(current_user):
        if (
            ticket.tenant_id != current_user.tenant_id
            or not ticket.is_visible_to_tenant
        ):
            raise HTTPException(
                status_code=403, detail="Bu destek talebine erişim izniniz yok."
            )
    return _ticket_to_dict(ticket)


# ---------------------------------------------------------------------------
# Admin endpoint'leri (platform personeli tüm ticket'ları yönetir)
# ---------------------------------------------------------------------------


@router.get("/admin/support/tickets", summary="[Admin] Tüm destek taleplerini listele")
def admin_list_tickets(
    tenant_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    category: str | None = Query(None),
    priority: str | None = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if not can_read_admin_catalog(current_user):
        raise HTTPException(status_code=403, detail="Yetki yetersiz.")
    query = db.query(SupportTicket)
    if tenant_id:
        query = query.filter(SupportTicket.tenant_id == tenant_id)
    if status_filter and status_filter in VALID_STATUSES:
        query = query.filter(SupportTicket.status == status_filter)
    if category and category in VALID_CATEGORIES:
        query = query.filter(SupportTicket.category == category)
    if priority and priority in VALID_PRIORITIES:
        query = query.filter(SupportTicket.priority == priority)
    tickets = query.order_by(SupportTicket.created_at.desc()).limit(limit).all()
    return [_ticket_to_dict(t) for t in tickets]


@router.patch(
    "/admin/support/tickets/{ticket_id}", summary="[Admin] Ticket güncelle / ata"
)
def admin_update_ticket(
    ticket_id: int,
    payload: TicketAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if not can_read_admin_catalog(current_user):
        raise HTTPException(status_code=403, detail="Yetki yetersiz.")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Destek talebi bulunamadı.")

    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=422,
                detail=f"Geçersiz durum. Geçerli değerler: {sorted(VALID_STATUSES)}",
            )
        ticket.status = payload.status
        if payload.status in ("resolved", "closed") and not ticket.resolved_at:
            ticket.resolved_at = utcnow()

    if payload.assigned_to_user_id is not None:
        assignee = db.query(User).filter(User.id == payload.assigned_to_user_id).first()
        if not assignee:
            raise HTTPException(
                status_code=404, detail="Atanacak kullanıcı bulunamadı."
            )
        ticket.assigned_to_user_id = payload.assigned_to_user_id
        if ticket.status == "open":
            ticket.status = "in_progress"

    if payload.resolution_note is not None:
        ticket.resolution_note = payload.resolution_note

    if payload.priority is not None:
        if payload.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=422, detail="Geçersiz öncelik.")
        ticket.priority = payload.priority
        if not ticket.resolved_at:
            ticket.sla_due_at = _compute_sla(payload.priority)

    ticket.updated_at = utcnow()
    db.commit()
    db.refresh(ticket)
    return _ticket_to_dict(ticket)
