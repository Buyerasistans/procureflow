from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from api.models.billing import (
    BillingInvoice,
    BillingWebhookEvent,
    SubscriptionPlan,
    TenantSubscription,
)
from api.models.tenant import Tenant


def resolve_billing_provider_event_id(payload: dict[str, Any]) -> str:
    return str(payload.get("event_id") or payload.get("id") or "").strip()


def require_billing_webhook_secret(shared_secret: str | None) -> None:
    expected_secret = os.getenv("BILLING_WEBHOOK_SHARED_SECRET", "").strip()
    if expected_secret and shared_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Billing webhook yetkisiz"
        )


def require_billing_webhook_signature(
    provider: str,
    *,
    raw_body: bytes,
    signature_header: str | None,
) -> None:
    normalized_provider = str(provider or "").strip().lower()
    if normalized_provider != "stripe":
        return

    signing_secret = os.getenv("BILLING_WEBHOOK_STRIPE_SIGNATURE_SECRET", "").strip()
    if not signing_secret:
        return

    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Stripe webhook imzasi zorunlu",
        )

    parts: dict[str, str] = {}
    for token in str(signature_header).split(","):
        key, separator, value = token.partition("=")
        if separator:
            parts[key.strip()] = value.strip()

    timestamp = parts.get("t")
    provided_signature = parts.get("v1")
    if not timestamp or not provided_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Stripe webhook imzasi gecersiz",
        )

    signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}".encode("utf-8")
    expected_signature = hmac.new(
        signing_secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, provided_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Stripe webhook imzasi dogrulanamadi",
        )


def _coerce_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _json_dump(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return json.dumps(value, ensure_ascii=True)
    except TypeError:
        return json.dumps(str(value), ensure_ascii=True)


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def ensure_tenant_subscription_for_plan(
    db: Session,
    tenant: Tenant,
    *,
    subscription_plan_code: str,
    billing_provider: str | None = None,
    provider_customer_id: str | None = None,
    provider_subscription_id: str | None = None,
    status_value: str | None = None,
    billing_cycle: str | None = None,
    seats_purchased: int | None = None,
    current_period_starts_at: datetime | None = None,
    current_period_ends_at: datetime | None = None,
    trial_ends_at: datetime | None = None,
    cancel_at_period_end: bool | None = None,
    canceled_at: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> TenantSubscription:
    plan_code = (
        (subscription_plan_code or tenant.subscription_plan_code or "starter")
        .strip()
        .lower()
    )
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == plan_code).first()

    subscription = (
        db.query(TenantSubscription)
        .filter(TenantSubscription.tenant_id == tenant.id)
        .order_by(TenantSubscription.id.desc())
        .first()
    )
    if subscription is None:
        subscription = TenantSubscription(
            tenant_id=tenant.id,
            subscription_plan_code=plan_code,
            status=status_value or ("active" if tenant.is_active else "paused"),
            billing_cycle=billing_cycle or "monthly",
            seats_purchased=seats_purchased or 1,
        )
        db.add(subscription)

    subscription.subscription_plan_code = plan_code
    subscription.subscription_plan_id = getattr(plan, "id", None)
    subscription.billing_provider = billing_provider or subscription.billing_provider
    subscription.provider_customer_id = (
        provider_customer_id or subscription.provider_customer_id
    )
    subscription.provider_subscription_id = (
        provider_subscription_id or subscription.provider_subscription_id
    )
    subscription.status = status_value or subscription.status
    subscription.billing_cycle = billing_cycle or subscription.billing_cycle
    subscription.seats_purchased = seats_purchased or subscription.seats_purchased
    subscription.current_period_starts_at = (
        current_period_starts_at or subscription.current_period_starts_at
    )
    subscription.current_period_ends_at = (
        current_period_ends_at or subscription.current_period_ends_at
    )
    subscription.trial_ends_at = trial_ends_at or subscription.trial_ends_at
    if cancel_at_period_end is not None:
        subscription.cancel_at_period_end = cancel_at_period_end
    subscription.canceled_at = canceled_at or subscription.canceled_at
    subscription.metadata_json = _json_dump(metadata) or subscription.metadata_json

    tenant.subscription_plan_code = plan_code
    db.flush()
    return subscription


def upsert_billing_invoice(
    db: Session,
    tenant: Tenant,
    *,
    tenant_subscription_id: int | None,
    invoice_payload: dict[str, Any],
) -> BillingInvoice:
    provider_invoice_id = (
        str(
            invoice_payload.get("provider_invoice_id")
            or invoice_payload.get("id")
            or ""
        ).strip()
        or None
    )
    invoice = None
    if provider_invoice_id:
        invoice = (
            db.query(BillingInvoice)
            .filter(BillingInvoice.provider_invoice_id == provider_invoice_id)
            .first()
        )
    if invoice is None:
        invoice = BillingInvoice(
            tenant_id=tenant.id,
            tenant_subscription_id=tenant_subscription_id,
            provider_invoice_id=provider_invoice_id,
            status=str(invoice_payload.get("status") or "draft"),
            currency=str(invoice_payload.get("currency") or "TRY"),
        )
        db.add(invoice)

    invoice.tenant_id = tenant.id
    invoice.tenant_subscription_id = tenant_subscription_id
    invoice.provider_invoice_id = provider_invoice_id
    invoice.invoice_number = invoice_payload.get("invoice_number")
    invoice.status = str(invoice_payload.get("status") or invoice.status)
    invoice.currency = str(invoice_payload.get("currency") or invoice.currency or "TRY")
    invoice.subtotal_amount = _coerce_float(invoice_payload.get("subtotal_amount"))
    invoice.tax_amount = _coerce_float(invoice_payload.get("tax_amount"))
    invoice.total_amount = _coerce_float(invoice_payload.get("total_amount"))
    invoice.due_at = _coerce_datetime(invoice_payload.get("due_at"))
    invoice.paid_at = _coerce_datetime(invoice_payload.get("paid_at"))
    invoice.hosted_invoice_url = invoice_payload.get("hosted_invoice_url")
    invoice.invoice_pdf_url = invoice_payload.get("invoice_pdf_url")
    invoice.raw_payload_json = _json_dump(invoice_payload)
    db.flush()
    return invoice


def process_billing_webhook_event(
    db: Session, provider: str, payload: dict[str, Any]
) -> BillingWebhookEvent:
    provider_event_id = resolve_billing_provider_event_id(payload)
    event_type = str(
        payload.get("event_type") or payload.get("type") or "unknown"
    ).strip()
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
        return existing

    tenant_id = payload.get("tenant_id")
    tenant = None
    if tenant_id is not None:
        tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook tenant bulunamadi",
            )

    event = BillingWebhookEvent(
        tenant_id=getattr(tenant, "id", None),
        provider=provider,
        event_type=event_type,
        provider_event_id=provider_event_id,
        processing_status="pending",
        payload_json=_json_dump(payload),
    )
    db.add(event)
    db.flush()

    try:
        if tenant is not None:
            subscription = ensure_tenant_subscription_for_plan(
                db,
                tenant,
                subscription_plan_code=str(
                    payload.get("plan_code")
                    or tenant.subscription_plan_code
                    or "starter"
                ),
                billing_provider=provider,
                provider_customer_id=payload.get("provider_customer_id"),
                provider_subscription_id=payload.get("provider_subscription_id"),
                status_value=payload.get("subscription_status"),
                billing_cycle=payload.get("billing_cycle"),
                seats_purchased=int(payload.get("seats_purchased") or 1),
                current_period_starts_at=_coerce_datetime(
                    payload.get("current_period_starts_at")
                ),
                current_period_ends_at=_coerce_datetime(
                    payload.get("current_period_ends_at")
                ),
                trial_ends_at=_coerce_datetime(payload.get("trial_ends_at")),
                cancel_at_period_end=payload.get("cancel_at_period_end"),
                canceled_at=_coerce_datetime(payload.get("canceled_at")),
                metadata=payload.get("metadata")
                if isinstance(payload.get("metadata"), dict)
                else None,
            )
            event.tenant_subscription_id = subscription.id
            invoice_payload = (
                payload.get("invoice")
                if isinstance(payload.get("invoice"), dict)
                else None
            )
            if invoice_payload:
                upsert_billing_invoice(
                    db,
                    tenant,
                    tenant_subscription_id=subscription.id,
                    invoice_payload=invoice_payload,
                )

        event.processing_status = "processed"
        event.processed_at = datetime.now(UTC)
        db.commit()
        db.refresh(event)
        return event
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        event.processing_status = "failed"
        event.error_message = str(exc)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event


def retry_billing_webhook_event(
    db: Session, event: BillingWebhookEvent
) -> BillingWebhookEvent:
    if not event.payload_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook payload'i bulunamadi",
        )

    try:
        payload = json.loads(event.payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook payload'i gecersiz"
        ) from exc

    tenant = None
    tenant_id = payload.get("tenant_id") or event.tenant_id
    if tenant_id is not None:
        tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook tenant bulunamadi",
            )

    event.processing_status = "pending"
    event.error_message = None
    event.processed_at = None
    db.add(event)
    db.flush()

    try:
        if tenant is not None:
            subscription = ensure_tenant_subscription_for_plan(
                db,
                tenant,
                subscription_plan_code=str(
                    payload.get("plan_code")
                    or tenant.subscription_plan_code
                    or "starter"
                ),
                billing_provider=event.provider,
                provider_customer_id=payload.get("provider_customer_id"),
                provider_subscription_id=payload.get("provider_subscription_id"),
                status_value=payload.get("subscription_status"),
                billing_cycle=payload.get("billing_cycle"),
                seats_purchased=int(payload.get("seats_purchased") or 1),
                current_period_starts_at=_coerce_datetime(
                    payload.get("current_period_starts_at")
                ),
                current_period_ends_at=_coerce_datetime(
                    payload.get("current_period_ends_at")
                ),
                trial_ends_at=_coerce_datetime(payload.get("trial_ends_at")),
                cancel_at_period_end=payload.get("cancel_at_period_end"),
                canceled_at=_coerce_datetime(payload.get("canceled_at")),
                metadata=payload.get("metadata")
                if isinstance(payload.get("metadata"), dict)
                else None,
            )
            event.tenant_id = tenant.id
            event.tenant_subscription_id = subscription.id

            invoice_payload = (
                payload.get("invoice")
                if isinstance(payload.get("invoice"), dict)
                else None
            )
            if invoice_payload:
                upsert_billing_invoice(
                    db,
                    tenant,
                    tenant_subscription_id=subscription.id,
                    invoice_payload=invoice_payload,
                )

        event.processing_status = "processed"
        event.processed_at = datetime.now(UTC)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        event.processing_status = "failed"
        event.error_message = str(exc)
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
