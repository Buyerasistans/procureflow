from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.tenant import Tenant


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    tier: Mapped[str] = mapped_column(String(50), nullable=False, default="starter")
    billing_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    billing_price_id_monthly: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    billing_price_id_yearly: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    monthly_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    yearly_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="TRY")
    limits_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_flags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant_subscriptions: Mapped[list["TenantSubscription"]] = relationship(
        "TenantSubscription", back_populates="plan"
    )


class TenantSubscription(Base):
    __tablename__ = "tenant_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    subscription_plan_id: Mapped[int | None] = mapped_column(
        ForeignKey("subscription_plans.id"), nullable=True, index=True
    )
    subscription_plan_code: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    billing_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    provider_customer_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, index=True
    )
    provider_subscription_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="trialing")
    billing_cycle: Mapped[str] = mapped_column(
        String(20), nullable=False, default="monthly"
    )
    seats_purchased: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_period_starts_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    current_period_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="subscriptions")
    plan: Mapped["SubscriptionPlan | None"] = relationship(
        "SubscriptionPlan", back_populates="tenant_subscriptions"
    )
    invoices: Mapped[list["BillingInvoice"]] = relationship(
        "BillingInvoice",
        back_populates="tenant_subscription",
        cascade="all, delete-orphan",
    )
    webhook_events: Mapped[list["BillingWebhookEvent"]] = relationship(
        "BillingWebhookEvent", back_populates="tenant_subscription"
    )


class BillingInvoice(Base):
    __tablename__ = "billing_invoices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    tenant_subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenant_subscriptions.id"), nullable=True, index=True
    )
    provider_invoice_id: Mapped[str | None] = mapped_column(
        String(120), nullable=True, unique=True
    )
    invoice_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="TRY")
    subtotal_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    hosted_invoice_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    invoice_pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="billing_invoices")
    tenant_subscription: Mapped["TenantSubscription | None"] = relationship(
        "TenantSubscription", back_populates="invoices"
    )


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    tenant_subscription_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenant_subscriptions.id"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    provider_event_id: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True
    )
    processing_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant | None"] = relationship(
        "Tenant", back_populates="billing_webhook_events"
    )
    tenant_subscription: Mapped["TenantSubscription | None"] = relationship(
        "TenantSubscription", back_populates="webhook_events"
    )
