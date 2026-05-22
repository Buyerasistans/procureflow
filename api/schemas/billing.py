from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BillingWebhookIngestOut(BaseModel):
    provider: str
    provider_event_id: str
    event_type: str
    processing_status: str
    tenant_id: int | None = None
    tenant_subscription_id: int | None = None
    duplicate: bool = False


class BillingWebhookRetryOut(BaseModel):
    id: int
    provider: str
    provider_event_id: str
    event_type: str
    processing_status: str
    tenant_id: int | None = None
    tenant_subscription_id: int | None = None
    retried: bool = True
    error_message: str | None = None


class TenantSubscriptionOut(BaseModel):
    id: int
    tenant_id: int
    subscription_plan_id: int | None = None
    subscription_plan_code: str
    billing_provider: str | None = None
    provider_customer_id: str | None = None
    provider_subscription_id: str | None = None
    status: str
    billing_cycle: str
    seats_purchased: int
    trial_ends_at: datetime | None = None
    current_period_starts_at: datetime | None = None
    current_period_ends_at: datetime | None = None
    cancel_at_period_end: bool
    canceled_at: datetime | None = None
    metadata_json: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BillingWebhookEventOut(BaseModel):
    id: int
    tenant_id: int | None = None
    tenant_subscription_id: int | None = None
    provider: str
    event_type: str
    provider_event_id: str
    processing_status: str
    processed_at: datetime | None = None
    error_message: str | None = None
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BillingInvoiceOut(BaseModel):
    id: int
    tenant_id: int
    tenant_subscription_id: int | None = None
    provider_invoice_id: str | None = None
    invoice_number: str | None = None
    status: str
    currency: str
    subtotal_amount: float | None = None
    tax_amount: float | None = None
    total_amount: float | None = None
    due_at: datetime | None = None
    paid_at: datetime | None = None
    hosted_invoice_url: str | None = None
    invoice_pdf_url: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BillingOverviewOut(BaseModel):
    subscriptions: list[TenantSubscriptionOut]
    invoices: list[BillingInvoiceOut]
    recent_webhook_events: list[BillingWebhookEventOut]
