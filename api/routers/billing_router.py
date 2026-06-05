from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.core.deps import get_db, get_current_user
from api.models.billing import BillingInvoice, BillingWebhookEvent, TenantSubscription
from api.models.payment import CommercialRequest, TenantSubscriptionAddon
from api.schemas.billing import (
    BillingInvoiceOut,
    BillingOverviewOut,
    BillingWebhookEventOut,
    BillingWebhookIngestOut,
    BillingWebhookRetryOut,
    TenantSubscriptionOut,
)
from api.services.billing_service import (
    process_billing_webhook_event,
    retry_billing_webhook_event,
    require_billing_webhook_secret,
    require_billing_webhook_signature,
    resolve_billing_provider_event_id,
)
from api.routers.admin import require_tenant_governance_manager
from api.models.user import User

router = APIRouter(prefix="/billing", tags=["billing"])


def _require_tenant_manager(current_user: User = Depends(get_current_user)) -> User:
    """tenant_owner, tenant_admin veya satinalma_direktoru rolüne izin verir."""
    if current_user.system_role in ("tenant_owner", "tenant_admin"):
        return current_user
    if current_user.system_role == "tenant_member" and current_user.role == "satinalma_direktoru":
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için yetki gereklidir.")


class AddonStatusOut(BaseModel):
    addon_code: str
    addon_status: str | None
    request_pending: bool


class AddonRequestIn(BaseModel):
    notes: str | None = None


class AddonRequestOut(BaseModel):
    id: int
    addon_code: str
    status: str


@router.post("/webhooks/{provider}", response_model=BillingWebhookIngestOut)
async def ingest_billing_webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    raw_body = await request.body()
    try:
        payload: dict[str, Any] = json.loads(raw_body.decode("utf-8") or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook JSON payload gecersiz",
        ) from exc

    require_billing_webhook_secret(x_webhook_secret)
    require_billing_webhook_signature(
        provider,
        raw_body=raw_body,
        signature_header=stripe_signature,
    )

    provider_event_id = resolve_billing_provider_event_id(payload)
    if not provider_event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="provider_event_id zorunlu"
        )

    existing = (
        db.query(BillingWebhookEvent)
        .filter(BillingWebhookEvent.provider_event_id == provider_event_id)
        .first()
    )
    if existing:
        return BillingWebhookIngestOut(
            provider=existing.provider,
            provider_event_id=existing.provider_event_id,
            event_type=existing.event_type,
            processing_status=existing.processing_status,
            tenant_id=existing.tenant_id,
            tenant_subscription_id=existing.tenant_subscription_id,
            duplicate=True,
        )

    event = process_billing_webhook_event(db, provider, payload)
    return BillingWebhookIngestOut(
        provider=event.provider,
        provider_event_id=event.provider_event_id,
        event_type=event.event_type,
        processing_status=event.processing_status,
        tenant_id=event.tenant_id,
        tenant_subscription_id=event.tenant_subscription_id,
        duplicate=False,
    )


@router.get("/overview", response_model=BillingOverviewOut)
def get_billing_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    subscriptions = (
        db.query(TenantSubscription)
        .order_by(TenantSubscription.updated_at.desc())
        .all()
    )
    invoices = (
        db.query(BillingInvoice)
        .order_by(BillingInvoice.updated_at.desc())
        .limit(20)
        .all()
    )
    webhook_events = (
        db.query(BillingWebhookEvent)
        .order_by(BillingWebhookEvent.received_at.desc())
        .limit(20)
        .all()
    )
    return BillingOverviewOut(
        subscriptions=[
            TenantSubscriptionOut.model_validate(item, from_attributes=True)
            for item in subscriptions
        ],
        invoices=[
            BillingInvoiceOut.model_validate(item, from_attributes=True)
            for item in invoices
        ],
        recent_webhook_events=[
            BillingWebhookEventOut.model_validate(item, from_attributes=True)
            for item in webhook_events
        ],
    )


@router.post("/webhooks/events/{event_id}/retry", response_model=BillingWebhookRetryOut)
def retry_billing_webhook(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_tenant_governance_manager),
):
    event = (
        db.query(BillingWebhookEvent).filter(BillingWebhookEvent.id == event_id).first()
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook olayi bulunamadi"
        )

    retried_event = retry_billing_webhook_event(db, event)
    return BillingWebhookRetryOut(
        id=retried_event.id,
        provider=retried_event.provider,
        provider_event_id=retried_event.provider_event_id,
        event_type=retried_event.event_type,
        processing_status=retried_event.processing_status,
        tenant_id=retried_event.tenant_id,
        tenant_subscription_id=retried_event.tenant_subscription_id,
        retried=True,
        error_message=retried_event.error_message,
    )


@router.get("/my-addon-status", response_model=AddonStatusOut)
def get_my_addon_status(
    addon_code: str = "dual_role_portal",
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_tenant_manager),
):
    """Geçerli tenant için addon durumunu döner (active/pending/None)."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Kullanıcı bir tenant'a bağlı değil.")

    active_addon = (
        db.query(TenantSubscriptionAddon)
        .filter(
            TenantSubscriptionAddon.tenant_id == current_user.tenant_id,
            TenantSubscriptionAddon.addon_code == addon_code,
            TenantSubscriptionAddon.status == "active",
        )
        .first()
    )

    pending_request = (
        db.query(CommercialRequest)
        .filter(
            CommercialRequest.tenant_id == current_user.tenant_id,
            CommercialRequest.addon_code == addon_code,
            CommercialRequest.request_type == "addon_request",
            CommercialRequest.status.in_(["new", "in_review"]),
        )
        .first()
    )

    return AddonStatusOut(
        addon_code=addon_code,
        addon_status="active" if active_addon else None,
        request_pending=bool(pending_request),
    )


@router.post("/my-addon-request", response_model=AddonRequestOut, status_code=status.HTTP_201_CREATED)
def submit_addon_request(
    payload: AddonRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_tenant_manager),
):
    """Tedarikçi Portalı yeteneği için platform onayı bekleyen ticari talep oluşturur."""
    addon_code = "dual_role_portal"

    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Kullanıcı bir tenant'a bağlı değil.")

    active_addon = (
        db.query(TenantSubscriptionAddon)
        .filter(
            TenantSubscriptionAddon.tenant_id == current_user.tenant_id,
            TenantSubscriptionAddon.addon_code == addon_code,
            TenantSubscriptionAddon.status == "active",
        )
        .first()
    )
    if active_addon:
        raise HTTPException(status_code=409, detail="Bu addon zaten aktif.")

    existing_request = (
        db.query(CommercialRequest)
        .filter(
            CommercialRequest.tenant_id == current_user.tenant_id,
            CommercialRequest.addon_code == addon_code,
            CommercialRequest.request_type == "addon_request",
            CommercialRequest.status.in_(["new", "in_review"]),
        )
        .first()
    )
    if existing_request:
        raise HTTPException(status_code=409, detail="Bu addon için zaten bir başvuru beklemede.")

    req = CommercialRequest(
        tenant_id=current_user.tenant_id,
        request_type="addon_request",
        addon_code=addon_code,
        addon_name="Tedarikçi Portalı Yeteneği",
        requester_name=current_user.name or current_user.email,
        requester_email=current_user.email,
        notes=payload.notes,
        status="new",
        audience="strategic",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return AddonRequestOut(id=req.id, addon_code=addon_code, status=req.status)
