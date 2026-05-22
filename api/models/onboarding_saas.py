from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    pass


class TenantType(Base):
    """Tenant tipi: Stratejik Ortaklık, Tedarikçi, İş Ortağı"""

    __tablename__ = "tenant_types"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trial-related defaults
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    card_verification_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    subscription_tiers: Mapped[list["SubscriptionPlanTier"]] = relationship(
        "SubscriptionPlanTier", back_populates="tenant_type"
    )
    trial_periods: Mapped[list["TenantTrialPeriod"]] = relationship(
        "TenantTrialPeriod", back_populates="tenant_type"
    )


class SubscriptionPlanTier(Base):
    """Her customer type için fiyatlandırma tier'ları (Başlangıç, Gelişim, Kurumsal)"""

    __tablename__ = "subscription_plan_tiers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_type_id: Mapped[int] = mapped_column(
        ForeignKey("tenant_types.id"), nullable=False, index=True
    )

    tier_code: Mapped[str] = mapped_column(String(50), nullable=False)
    tier_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing (trial dönemi)
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False)
    trial_daily_price: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True, default=0
    )

    # Pricing (trial sonrası)
    post_trial_monthly_price: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    post_trial_annual_price: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    # Trial dönemi limitleri
    trial_supplier_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trial_project_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trial_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trial_transaction_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Trial sonrası limitleri
    post_trial_supplier_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    post_trial_project_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_trial_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_trial_transaction_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # Metadata
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant_type: Mapped["TenantType"] = relationship(
        "TenantType", back_populates="subscription_tiers"
    )
    trial_periods: Mapped[list["TenantTrialPeriod"]] = relationship(
        "TenantTrialPeriod", back_populates="subscription_tier"
    )
    card_verifications: Mapped[list["CardVerificationTransaction"]] = relationship(
        "CardVerificationTransaction", back_populates="tier"
    )


class PremiumFeature(Base):
    """Premium features (DWG import, Exclusive Suppliers, vb)"""

    __tablename__ = "premium_features"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Kimin kullanabileceği (Stratejik Ortaklık, Tedarikçi, vs) - JSON list
    available_for_tenant_types: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pricing
    monthly_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    annual_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant_activations: Mapped[list["TenantPremiumFeature"]] = relationship(
        "TenantPremiumFeature", back_populates="feature"
    )


class TenantPremiumFeature(Base):
    """Tenant'ın aktif premium feature'ları"""

    __tablename__ = "tenant_premium_features"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    premium_feature_id: Mapped[int] = mapped_column(
        ForeignKey("premium_features.id"), nullable=False, index=True
    )

    activated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )  # NULL = lifetime

    billing_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )  # active, pending_payment, expired

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    feature: Mapped["PremiumFeature"] = relationship(
        "PremiumFeature", back_populates="tenant_activations"
    )


class CardVerificationTransaction(Base):
    """Kart doğrulama işlemleri (10-20 TL çekip iade)"""

    __tablename__ = "card_verification_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    subscription_plan_tier_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_plan_tiers.id"), nullable=False, index=True
    )

    verification_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_provider_code: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_transaction_id: Mapped[str | None] = mapped_column(
        String(150), nullable=True, unique=True
    )

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending, captured, refunded, failed

    # Otomatik iade planlama
    refund_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    refund_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    refund_transaction_id: Mapped[str | None] = mapped_column(
        String(150), nullable=True, unique=True
    )
    refund_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Error tracking
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tier: Mapped["SubscriptionPlanTier"] = relationship(
        "SubscriptionPlanTier", back_populates="card_verifications"
    )


class TenantTrialPeriod(Base):
    """Trial dönemi takip (15 gün Stratejik Ortaklık, 7 gün Tedarikçi, vb)"""

    __tablename__ = "tenant_trial_periods"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    tenant_type_id: Mapped[int] = mapped_column(
        ForeignKey("tenant_types.id"), nullable=False, index=True
    )
    subscription_plan_tier_id: Mapped[int] = mapped_column(
        ForeignKey("subscription_plan_tiers.id"), nullable=False, index=True
    )

    trial_started_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    trial_extended_until: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # Limitler (Trial dönemi snapshot)
    trial_supplier_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trial_project_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trial_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Limitler (Post-trial snapshot)
    post_trial_supplier_limit: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    post_trial_project_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_trial_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )  # active, completed, canceled

    # Trial bittiğinde ne olacak?
    action_on_completion: Mapped[str] = mapped_column(
        String(50), default="activate_plan"
    )  # activate_plan, send_reminder, cancel

    # Completion tracking
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant_type: Mapped["TenantType"] = relationship(
        "TenantType", back_populates="trial_periods"
    )
    subscription_tier: Mapped["SubscriptionPlanTier"] = relationship(
        "SubscriptionPlanTier", back_populates="trial_periods"
    )


class BusinessPartnerCommission(Base):
    """Business Partner komsiyon yapılandırması"""

    __tablename__ = "business_partner_commissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_partner_tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    referred_supplier_tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )

    # Commission rates (İlk 90 gün yüksek, sonra düşük)
    initial_commission_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False
    )
    post_90days_commission_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False
    )

    # Dates
    commission_started_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    commission_upgraded_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )  # 90 gün bittiğinde

    # Campaign bonus
    active_campaign_bonus_percent: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=0
    )
    campaign_bonus_started_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    campaign_bonus_ends_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )


class BusinessPartnerLedger(Base):
    """Business Partner komisyon hesaplama ledger'ı"""

    __tablename__ = "business_partner_ledger"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_partner_tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_transactions.id"), nullable=True, index=True
    )

    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    commission_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    transaction_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    billing_period_month: Mapped[str] = mapped_column(
        String(7), nullable=False
    )  # 2026-04

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending, calculated, invoiced, paid

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
