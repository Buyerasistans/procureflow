"""
Payment modelleri — çoklu ödeme sağlayıcı desteği.
Desteklenen sağlayıcılar: iyzico, paytr, havale, paypal, crypto
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.tenant import Tenant
    from api.models.user import User


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Bağlam: subscription | commission | manual
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Ödeme sağlayıcı: iyzico | paytr | havale | paypal | crypto
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)

    # Durum: pending | processing | succeeded | failed | refunded | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sağlayıcıdan gelen ham yanıt (JSON string)
    provider_response_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    receipt_original_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    buyer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant | None"] = relationship("Tenant", foreign_keys=[tenant_id])


class PaymentWebhookEvent(Base):
    """Sağlayıcı webhook bildirimlerinin ham kaydı."""

    __tablename__ = "payment_webhook_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    event_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payload_raw: Mapped[str] = mapped_column(Text, nullable=False)
    signature_valid: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    linked_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_transactions.id", ondelete="SET NULL"), nullable=True
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


class CommercialRequest(Base):
    __tablename__ = "commercial_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    request_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    audience: Mapped[str] = mapped_column(
        String(50), nullable=False, default="strategic"
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="new", index=True
    )
    source_surface: Mapped[str | None] = mapped_column(String(100), nullable=True)
    package_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    package_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    addon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    addon_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    requester_name: Mapped[str] = mapped_column(String(255), nullable=False)
    requester_email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    last_contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant | None"] = relationship("Tenant", foreign_keys=[tenant_id])
    reviewed_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewed_by_user_id]
    )


class CommercialRequestWebhookDelivery(Base):
    __tablename__ = "commercial_request_webhook_deliveries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    commercial_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("commercial_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    delivery_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", index=True
    )
    http_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_attempted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    commercial_request: Mapped["CommercialRequest | None"] = relationship(
        "CommercialRequest", foreign_keys=[commercial_request_id]
    )


class TenantSubscriptionAddon(Base):
    __tablename__ = "tenant_subscription_addons"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    addon_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    addon_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    limit_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    increment_per_unit: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_increment: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="active", index=True
    )
    payment_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_transactions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant | None"] = relationship("Tenant", foreign_keys=[tenant_id])
    payment_transaction: Mapped["PaymentTransaction | None"] = relationship(
        "PaymentTransaction", foreign_keys=[payment_transaction_id]
    )
