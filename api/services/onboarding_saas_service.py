"""
Onboarding SaaS Services
Handles tenant type selection, plan tiers, card verification, trial periods, etc.
"""

import json

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_

from api.models.onboarding_saas import (
    TenantType,
    SubscriptionPlanTier,
    PremiumFeature,
    TenantPremiumFeature,
    CardVerificationTransaction,
    TenantTrialPeriod,
    BusinessPartnerCommission,
    BusinessPartnerLedger,
)
from api.models.payment import PaymentTransaction
from api.models.tenant import Tenant
from api.schemas.onboarding_saas import (
    TenantTypeOut,
    SubscriptionPlanTierOut,
    PremiumFeatureOut,
    TrialStatusOut,
    BusinessPartnerCommissionOut,
    BusinessPartnerLedgerOut,
    BusinessPartnerCommissionReportOut,
)
from api.core.time import utcnow


# ============================================================================
# TENANT TYPES
# ============================================================================


def get_all_tenant_types(db: Session) -> list[TenantTypeOut]:
    """Get all active tenant types"""
    types = db.query(TenantType).filter(TenantType.is_active == True).all()
    return [TenantTypeOut.model_validate(t) for t in types]


def get_tenant_type_by_code(db: Session, code: str) -> TenantType | None:
    """Get tenant type by code"""
    return db.query(TenantType).filter(TenantType.code == code).first()


# ============================================================================
# SUBSCRIPTION PLAN TIERS
# ============================================================================


def get_tiers_for_tenant_type(
    db: Session, tenant_type_id: int
) -> list[SubscriptionPlanTierOut]:
    """Get all tiers for a specific tenant type"""
    tiers = (
        db.query(SubscriptionPlanTier)
        .filter(
            and_(
                SubscriptionPlanTier.tenant_type_id == tenant_type_id,
                SubscriptionPlanTier.is_active == True,
            )
        )
        .order_by(SubscriptionPlanTier.display_order)
        .all()
    )
    return [SubscriptionPlanTierOut.model_validate(t) for t in tiers]


def get_subscription_plan_tier(
    db: Session, tier_id: int
) -> SubscriptionPlanTier | None:
    """Get subscription tier by ID"""
    return (
        db.query(SubscriptionPlanTier)
        .filter(SubscriptionPlanTier.id == tier_id)
        .first()
    )


# ============================================================================
# CARD VERIFICATION
# ============================================================================


def create_card_verification_transaction(
    db: Session,
    tenant_id: int,
    subscription_plan_tier_id: int,
    payment_provider_code: str,
    verification_amount: float,
) -> CardVerificationTransaction:
    """Create a card verification transaction (10-20 TL)"""

    transaction = CardVerificationTransaction(
        tenant_id=tenant_id,
        subscription_plan_tier_id=subscription_plan_tier_id,
        verification_amount=verification_amount,
        payment_provider_code=payment_provider_code,
        status="pending",
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def capture_card_verification(
    db: Session,
    transaction_id: int,
    provider_transaction_id: str,
) -> CardVerificationTransaction | None:
    """Mark card verification as captured (successful payment)"""

    transaction = (
        db.query(CardVerificationTransaction)
        .filter(CardVerificationTransaction.id == transaction_id)
        .first()
    )

    if not transaction:
        return None

    transaction.status = "captured"
    transaction.provider_transaction_id = provider_transaction_id

    # Schedule automatic refund for 72 hours later
    transaction.refund_scheduled_at = utcnow() + timedelta(hours=72)

    db.commit()
    db.refresh(transaction)
    return transaction


def fail_card_verification(
    db: Session,
    transaction_id: int,
    failure_reason: str,
) -> CardVerificationTransaction | None:
    """Mark card verification as failed"""

    transaction = (
        db.query(CardVerificationTransaction)
        .filter(CardVerificationTransaction.id == transaction_id)
        .first()
    )

    if not transaction:
        return None

    transaction.status = "failed"
    transaction.failure_reason = failure_reason

    db.commit()
    db.refresh(transaction)
    return transaction


def mark_card_refunded(
    db: Session,
    transaction_id: int,
    refund_transaction_id: str,
) -> CardVerificationTransaction | None:
    """Mark card verification amount as refunded"""

    transaction = (
        db.query(CardVerificationTransaction)
        .filter(CardVerificationTransaction.id == transaction_id)
        .first()
    )

    if not transaction:
        return None

    transaction.status = "refunded"
    transaction.refund_transaction_id = refund_transaction_id
    transaction.refund_completed_at = utcnow()

    db.commit()
    db.refresh(transaction)
    return transaction


# ============================================================================
# TRIAL PERIODS
# ============================================================================


def create_trial_period(
    db: Session,
    tenant_id: int,
    tenant_type_id: int,
    subscription_plan_tier_id: int,
) -> TenantTrialPeriod:
    """Create trial period for tenant"""

    tier = (
        db.query(SubscriptionPlanTier)
        .filter(SubscriptionPlanTier.id == subscription_plan_tier_id)
        .first()
    )

    if not tier:
        raise ValueError(f"Tier {subscription_plan_tier_id} not found")

    trial_started_at = utcnow()
    trial_ends_at = trial_started_at + timedelta(days=tier.trial_days)

    trial_period = TenantTrialPeriod(
        tenant_id=tenant_id,
        tenant_type_id=tenant_type_id,
        subscription_plan_tier_id=subscription_plan_tier_id,
        trial_started_at=trial_started_at,
        trial_ends_at=trial_ends_at,
        trial_supplier_limit=tier.trial_supplier_limit,
        trial_project_limit=tier.trial_project_limit,
        trial_user_limit=tier.trial_user_limit,
        post_trial_supplier_limit=tier.post_trial_supplier_limit,
        post_trial_project_limit=tier.post_trial_project_limit,
        post_trial_user_limit=tier.post_trial_user_limit,
        is_active=True,
        status="active",
        action_on_completion="activate_plan",
    )

    db.add(trial_period)
    db.commit()
    db.refresh(trial_period)
    return trial_period


def get_trial_period(db: Session, tenant_id: int) -> TenantTrialPeriod | None:
    """Get active trial period for tenant"""
    return (
        db.query(TenantTrialPeriod)
        .filter(
            and_(
                TenantTrialPeriod.tenant_id == tenant_id,
                TenantTrialPeriod.is_active == True,
                TenantTrialPeriod.status == "active",
            )
        )
        .first()
    )


def get_trial_status(db: Session, tenant_id: int) -> TrialStatusOut | None:
    """Get trial status for tenant"""

    trial = get_trial_period(db, tenant_id)
    if not trial:
        return None

    now = utcnow()
    days_remaining = (trial.trial_ends_at - now).days

    current_limits = {
        "supplier": trial.trial_supplier_limit,
        "project": trial.trial_project_limit,
        "user": trial.trial_user_limit,
    }

    post_trial_limits = {
        "supplier": trial.post_trial_supplier_limit,
        "project": trial.post_trial_project_limit,
        "user": trial.post_trial_user_limit,
    }

    return TrialStatusOut(
        tenant_id=tenant_id,
        trial_days_remaining=max(0, days_remaining),
        trial_ends_at=trial.trial_ends_at,
        current_limits=current_limits,
        post_trial_limits=post_trial_limits,
        is_trial_active=trial.is_active and trial.status == "active",
        can_extend_trial=False,  # TODO: Implement extension logic
    )


def complete_trial_period(
    db: Session,
    trial_period_id: int,
) -> TenantTrialPeriod | None:
    """Mark trial period as completed"""

    trial = (
        db.query(TenantTrialPeriod)
        .filter(TenantTrialPeriod.id == trial_period_id)
        .first()
    )

    if not trial:
        return None

    trial.is_active = False
    trial.status = "completed"
    trial.completed_at = utcnow()

    db.commit()
    db.refresh(trial)
    return trial


# ============================================================================
# PREMIUM FEATURES
# ============================================================================


def get_all_premium_features(db: Session) -> list[PremiumFeatureOut]:
    """Get all active premium features"""
    features = (
        db.query(PremiumFeature)
        .filter(PremiumFeature.is_active == True)
        .order_by(PremiumFeature.display_order)
        .all()
    )
    return [PremiumFeatureOut.model_validate(f) for f in features]


def get_premium_features_for_tenant_type(
    db: Session,
    tenant_type_code: str,
) -> list[PremiumFeatureOut]:
    """Get premium features available for a specific tenant type"""
    import json

    features = db.query(PremiumFeature).filter(PremiumFeature.is_active == True).all()

    result = []
    for f in features:
        if f.available_for_tenant_types:
            try:
                types = json.loads(f.available_for_tenant_types)
                if tenant_type_code in types:
                    result.append(PremiumFeatureOut.model_validate(f))
            except json.JSONDecodeError:
                pass

    return sorted(result, key=lambda x: x.display_order)


def activate_premium_feature(
    db: Session,
    tenant_id: int,
    premium_feature_id: int,
) -> TenantPremiumFeature:
    """Activate a premium feature for tenant"""

    # Check if already active
    existing = (
        db.query(TenantPremiumFeature)
        .filter(
            and_(
                TenantPremiumFeature.tenant_id == tenant_id,
                TenantPremiumFeature.premium_feature_id == premium_feature_id,
                TenantPremiumFeature.billing_status == "active",
            )
        )
        .first()
    )

    if existing and (existing.expires_at is None or existing.expires_at > utcnow()):
        return existing  # Already active

    activation = TenantPremiumFeature(
        tenant_id=tenant_id,
        premium_feature_id=premium_feature_id,
        activated_at=utcnow(),
        billing_status="active",
    )

    db.add(activation)
    db.commit()
    db.refresh(activation)
    return activation


def activate_premium_features_for_payment(
    db: Session,
    txn: PaymentTransaction | None,
    *,
    tenant_id: int | None = None,
) -> list[TenantPremiumFeature]:
    if txn is None:
        return []

    resolved_tenant_id = tenant_id or getattr(txn, "tenant_id", None)
    if resolved_tenant_id is None:
        return []

    premium_feature_ids: set[int] = set()
    if (
        str(getattr(txn, "reference_type", "") or "").strip().lower()
        == "premium_feature"
    ):
        reference_id = getattr(txn, "reference_id", None)
        if isinstance(reference_id, int):
            premium_feature_ids.add(reference_id)

    raw_payload = getattr(txn, "provider_response_raw", None)
    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None
        request_context = (
            parsed.get("request_context") if isinstance(parsed, dict) else None
        )
        extra = (
            request_context.get("extra") if isinstance(request_context, dict) else None
        )
        if isinstance(extra, dict):
            single_id = extra.get("premium_feature_id")
            if isinstance(single_id, int):
                premium_feature_ids.add(single_id)
            many_ids = extra.get("premium_feature_ids")
            if isinstance(many_ids, list):
                premium_feature_ids.update(
                    int(item) for item in many_ids if isinstance(item, int)
                )

    activations: list[TenantPremiumFeature] = []
    for premium_feature_id in sorted(premium_feature_ids):
        activations.append(
            activate_premium_feature(db, resolved_tenant_id, premium_feature_id)
        )
    return activations


def get_tenant_premium_features(
    db: Session, tenant_id: int
) -> list[TenantPremiumFeature]:
    """Get all active premium features for tenant"""
    now = utcnow()
    features = (
        db.query(TenantPremiumFeature)
        .filter(
            and_(
                TenantPremiumFeature.tenant_id == tenant_id,
                TenantPremiumFeature.billing_status == "active",
            )
        )
        .all()
    )

    # Filter out expired features
    active_features = []
    for f in features:
        if f.expires_at is None or f.expires_at > now:
            active_features.append(f)

    return active_features


# ============================================================================
# BUSINESS PARTNER COMMISSION
# ============================================================================


def create_business_partner_commission(
    db: Session,
    business_partner_tenant_id: int,
    referred_supplier_tenant_id: int,
    initial_commission_percent: float,
    post_90days_commission_percent: float,
) -> BusinessPartnerCommission:
    """Create commission contract between business partner and referred supplier"""

    commission = BusinessPartnerCommission(
        business_partner_tenant_id=business_partner_tenant_id,
        referred_supplier_tenant_id=referred_supplier_tenant_id,
        initial_commission_percent=initial_commission_percent,
        post_90days_commission_percent=post_90days_commission_percent,
        commission_started_at=utcnow(),
        is_active=True,
    )

    db.add(commission)
    db.commit()
    db.refresh(commission)
    return commission


def get_business_partner_commissions(
    db: Session,
    business_partner_tenant_id: int,
) -> list[BusinessPartnerCommissionOut]:
    """Get all active commissions for business partner"""

    commissions = (
        db.query(BusinessPartnerCommission)
        .filter(
            and_(
                BusinessPartnerCommission.business_partner_tenant_id
                == business_partner_tenant_id,
                BusinessPartnerCommission.is_active == True,
            )
        )
        .all()
    )

    return [BusinessPartnerCommissionOut.model_validate(c) for c in commissions]


def get_current_commission_rate(
    db: Session,
    business_partner_tenant_id: int,
    referred_supplier_tenant_id: int,
) -> float:
    """Get current commission rate (handles 90-day upgrade)"""

    commission = (
        db.query(BusinessPartnerCommission)
        .filter(
            and_(
                BusinessPartnerCommission.business_partner_tenant_id
                == business_partner_tenant_id,
                BusinessPartnerCommission.referred_supplier_tenant_id
                == referred_supplier_tenant_id,
                BusinessPartnerCommission.is_active == True,
            )
        )
        .first()
    )

    if not commission:
        return 0.0

    now = utcnow()

    # Check if 90 days have passed since commission started
    if commission.commission_upgraded_at:
        # Already upgraded
        percent = commission.post_90days_commission_percent
    elif (now - commission.commission_started_at).days >= 90:
        # Need to upgrade
        commission.commission_upgraded_at = now
        db.commit()
        percent = commission.post_90days_commission_percent
    else:
        # Still in initial period
        percent = commission.initial_commission_percent

    # Add campaign bonus if active
    if (
        commission.active_campaign_bonus_percent
        and commission.campaign_bonus_started_at
        and commission.campaign_bonus_ends_at
    ):
        if (
            commission.campaign_bonus_started_at
            <= now
            <= commission.campaign_bonus_ends_at
        ):
            percent += commission.active_campaign_bonus_percent

    return percent


def add_commission_ledger_entry(
    db: Session,
    business_partner_tenant_id: int,
    transaction_id: int,
    transaction_date: datetime,
    commission_amount: float,
    commission_percent: float,
) -> BusinessPartnerLedger:
    """Add entry to business partner commission ledger"""

    billing_period_month = transaction_date.strftime("%Y-%m")

    ledger_entry = BusinessPartnerLedger(
        business_partner_tenant_id=business_partner_tenant_id,
        transaction_id=transaction_id,
        commission_amount=commission_amount,
        commission_percent=commission_percent,
        transaction_date=transaction_date,
        billing_period_month=billing_period_month,
        status="pending",
    )

    db.add(ledger_entry)
    db.commit()
    db.refresh(ledger_entry)
    return ledger_entry


def get_business_partner_commission_report(
    db: Session,
    business_partner_tenant_id: int,
    billing_period_month: str,  # "2026-04"
) -> BusinessPartnerCommissionReportOut | None:
    """Get commission report for a specific month"""

    ledger_entries = (
        db.query(BusinessPartnerLedger)
        .filter(
            and_(
                BusinessPartnerLedger.business_partner_tenant_id
                == business_partner_tenant_id,
                BusinessPartnerLedger.billing_period_month == billing_period_month,
            )
        )
        .all()
    )

    if not ledger_entries:
        return None

    total_transactions = len(ledger_entries)
    total_transaction_amount = sum(
        e.commission_amount / (e.commission_percent / 100)
        if e.commission_percent > 0
        else 0
        for e in ledger_entries
    )
    total_commission = sum(e.commission_amount for e in ledger_entries)
    avg_commission_percent = (
        sum(e.commission_percent for e in ledger_entries) / len(ledger_entries)
        if ledger_entries
        else 0
    )

    return BusinessPartnerCommissionReportOut(
        business_partner_tenant_id=business_partner_tenant_id,
        billing_period_month=billing_period_month,
        total_transactions=total_transactions,
        total_transaction_amount=total_transaction_amount,
        total_commission=total_commission,
        average_commission_percent=avg_commission_percent,
        ledger_items=[
            BusinessPartnerLedgerOut.model_validate(e) for e in ledger_entries
        ],
    )
