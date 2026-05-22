from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


# ============================================================================
# TENANT TYPES
# ============================================================================


class TenantTypeOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    trial_days: int
    card_verification_amount: float | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# SUBSCRIPTION PLAN TIERS
# ============================================================================


class SubscriptionPlanTierOut(BaseModel):
    id: int
    tenant_type_id: int
    tier_code: str
    tier_name: str
    description: str | None = None

    trial_days: int
    trial_daily_price: float | None = None

    post_trial_monthly_price: float | None = None
    post_trial_annual_price: float | None = None

    trial_supplier_limit: int | None = None
    trial_project_limit: int | None = None
    trial_user_limit: int | None = None
    trial_transaction_limit: int | None = None

    post_trial_supplier_limit: int | None = None
    post_trial_project_limit: int | None = None
    post_trial_user_limit: int | None = None
    post_trial_transaction_limit: int | None = None

    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionPlanTierCreateIn(BaseModel):
    tenant_type_id: int
    tier_code: str
    tier_name: str
    description: str | None = None

    trial_days: int
    trial_daily_price: float | None = None

    post_trial_monthly_price: float | None = None
    post_trial_annual_price: float | None = None

    trial_supplier_limit: int | None = None
    trial_project_limit: int | None = None
    trial_user_limit: int | None = None
    trial_transaction_limit: int | None = None

    post_trial_supplier_limit: int | None = None
    post_trial_project_limit: int | None = None
    post_trial_user_limit: int | None = None
    post_trial_transaction_limit: int | None = None


# ============================================================================
# PREMIUM FEATURES
# ============================================================================


class PremiumFeatureOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    available_for_tenant_types: str | None = None

    monthly_price: float | None = None
    annual_price: float | None = None

    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PremiumFeatureCreateIn(BaseModel):
    code: str
    name: str
    description: str | None = None
    available_for_tenant_types: str | None = (
        None  # JSON: ["strategic_partner", "supplier"]
    )

    monthly_price: float | None = None
    annual_price: float | None = None
    is_active: bool = True
    display_order: int = 0


class PremiumFeatureUpdateIn(BaseModel):
    name: str
    description: str | None = None
    available_for_tenant_types: str | None = None
    monthly_price: float | None = None
    annual_price: float | None = None
    is_active: bool = True
    display_order: int = 0


# ============================================================================
# TENANT PREMIUM FEATURES
# ============================================================================


class TenantPremiumFeatureOut(BaseModel):
    id: int
    tenant_id: int
    premium_feature_id: int

    activated_at: datetime
    expires_at: datetime | None = None

    billing_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TenantPremiumFeatureActivateIn(BaseModel):
    premium_feature_id: int


class TenantPremiumPurchaseContextOut(BaseModel):
    tenant_id: int
    tenant_name: str
    tenant_slug: str
    active_feature_codes: list[str] = []

    class Config:
        from_attributes = True


# ============================================================================
# CARD VERIFICATION
# ============================================================================


class CardVerificationTransactionOut(BaseModel):
    id: int
    tenant_id: int
    subscription_plan_tier_id: int

    verification_amount: float
    payment_provider_code: str
    provider_transaction_id: str | None = None

    status: str  # pending, captured, refunded, failed

    refund_scheduled_at: datetime | None = None
    refund_completed_at: datetime | None = None
    refund_transaction_id: str | None = None

    failure_reason: str | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CardVerificationInitiateIn(BaseModel):
    tenant_id: int
    subscription_plan_tier_id: int
    payment_provider_code: str  # paytr, iyzico, etc


class CardVerificationCaptureIn(BaseModel):
    verification_transaction_id: int
    provider_transaction_id: str
    card_token: str | None = None


# ============================================================================
# TRIAL PERIODS
# ============================================================================


class TenantTrialPeriodOut(BaseModel):
    id: int
    tenant_id: int
    tenant_type_id: int
    subscription_plan_tier_id: int

    trial_started_at: datetime
    trial_ends_at: datetime
    trial_extended_until: datetime | None = None

    trial_supplier_limit: int | None = None
    trial_project_limit: int | None = None
    trial_user_limit: int | None = None

    post_trial_supplier_limit: int | None = None
    post_trial_project_limit: int | None = None
    post_trial_user_limit: int | None = None

    is_active: bool
    status: str  # active, completed, canceled

    action_on_completion: str
    completed_at: datetime | None = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrialStatusOut(BaseModel):
    tenant_id: int
    trial_days_remaining: int
    trial_ends_at: datetime

    current_limits: dict  # { supplier: 10, project: 5, user: 3 }
    post_trial_limits: dict  # { supplier: 100, project: 50, user: 15 }

    is_trial_active: bool
    can_extend_trial: bool


# ============================================================================
# BUSINESS PARTNER COMMISSION
# ============================================================================


class BusinessPartnerCommissionOut(BaseModel):
    id: int
    business_partner_tenant_id: int
    referred_supplier_tenant_id: int

    initial_commission_percent: float
    post_90days_commission_percent: float

    commission_started_at: datetime
    commission_upgraded_at: datetime | None = None

    active_campaign_bonus_percent: float
    campaign_bonus_started_at: datetime | None = None
    campaign_bonus_ends_at: datetime | None = None

    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessPartnerCommissionCreateIn(BaseModel):
    business_partner_tenant_id: int
    referred_supplier_tenant_id: int

    initial_commission_percent: float
    post_90days_commission_percent: float


class BusinessPartnerCampaignBonusIn(BaseModel):
    business_partner_tenant_id: int
    bonus_percent: float
    starts_at: datetime
    ends_at: datetime


# ============================================================================
# BUSINESS PARTNER LEDGER
# ============================================================================


class BusinessPartnerLedgerOut(BaseModel):
    id: int
    business_partner_tenant_id: int
    transaction_id: int | None = None

    commission_amount: float
    commission_percent: float

    transaction_date: datetime
    billing_period_month: str  # 2026-04

    status: str  # pending, calculated, invoiced, paid
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessPartnerCommissionReportOut(BaseModel):
    """Commission ledger summary by period"""

    business_partner_tenant_id: int
    billing_period_month: str

    total_transactions: int
    total_transaction_amount: float

    total_commission: float
    average_commission_percent: float

    ledger_items: list[BusinessPartnerLedgerOut]
