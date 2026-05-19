"""
API Routes for Onboarding SaaS System
Tenant types, subscription tiers, trial periods, premium features, business partner commissions
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.user import User
from api.models.onboarding_saas import PremiumFeature
from api.models.tenant import Tenant
from api.core.deps import get_current_user
from api.core.authz import is_super_admin, can_manage_tenant_governance
from api.schemas.onboarding_saas import (
    TenantTypeOut,
    SubscriptionPlanTierOut,
    PremiumFeatureOut,
    PremiumFeatureCreateIn,
    PremiumFeatureUpdateIn,
    TenantPremiumFeatureOut,
    TenantPremiumFeatureActivateIn,
    TenantPremiumPurchaseContextOut,
    TrialStatusOut,
    CardVerificationInitiateIn,
    CardVerificationCaptureIn,
    BusinessPartnerCommissionOut,
    BusinessPartnerCommissionCreateIn,
    BusinessPartnerCampaignBonusIn,
    BusinessPartnerCommissionReportOut,
    BusinessPartnerLedgerOut,
)
from api.services.onboarding_saas_service import (
    get_all_tenant_types,
    get_tenant_type_by_code,
    get_tiers_for_tenant_type,
    get_subscription_plan_tier,
    get_all_premium_features,
    get_premium_features_for_tenant_type,
    activate_premium_feature,
    get_tenant_premium_features as get_tenant_premium_features_service,
    get_trial_status,
    create_trial_period,
    get_business_partner_commissions,
    get_business_partner_commission_report,
    create_business_partner_commission,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# ============================================================================
# Auth Dependencies
# ============================================================================


def require_tenant_owner(current_user: User = Depends(get_current_user)):
    """Check if user is a tenant owner"""
    if not current_user.system_role or current_user.system_role not in (
        "tenant_owner",
        "tenant_admin",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant owner or admin required",
        )
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)):
    """Check if user is super admin"""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin required",
        )
    return current_user


# ============================================================================
# TENANT TYPES & SUBSCRIPTION TIERS
# ============================================================================


@router.get("/tenant-types", response_model=list[TenantTypeOut])
async def list_tenant_types(
    db: Session = Depends(get_db),
):
    """List all available tenant types (public endpoint)"""
    return get_all_tenant_types(db)


@router.get(
    "/tenant-types/{tenant_type_code}/tiers",
    response_model=list[SubscriptionPlanTierOut],
)
async def get_tenant_tiers(
    tenant_type_code: str,
    db: Session = Depends(get_db),
):
    """Get subscription tiers for a specific tenant type (public endpoint)"""

    tenant_type = get_tenant_type_by_code(db, tenant_type_code)
    if not tenant_type:
        raise HTTPException(
            status_code=404, detail=f"Tenant type '{tenant_type_code}' not found"
        )

    tiers = get_tiers_for_tenant_type(db, tenant_type.id)
    return tiers


# ============================================================================
# TRIAL PERIODS
# ============================================================================


@router.get("/trial-status/{tenant_id}", response_model=TrialStatusOut)
async def get_tenant_trial_status(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    """Get trial status for a tenant (authenticated)"""

    # Verify user owns the tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    trial_status = get_trial_status(db, tenant_id)
    if not trial_status:
        raise HTTPException(
            status_code=404, detail="No active trial found for this tenant"
        )

    return trial_status


# ============================================================================
# PREMIUM FEATURES (Public)
# ============================================================================


@router.get("/premium-features", response_model=list[PremiumFeatureOut])
async def list_premium_features(
    tenant_type_code: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    List premium features.
    If tenant_type_code is provided, filter to features available for that type.
    """
    if tenant_type_code:
        return get_premium_features_for_tenant_type(db, tenant_type_code)
    return get_all_premium_features(db)


# ============================================================================
# PREMIUM FEATURES (Authenticated - Tenant)
# ============================================================================


@router.get(
    "/tenant/{tenant_id}/premium-features", response_model=list[TenantPremiumFeatureOut]
)
async def get_tenant_premium_features(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    """Get active premium features for current tenant"""

    # Verify user owns the tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    features = get_tenant_premium_features_service(db, tenant_id)
    return [TenantPremiumFeatureOut.model_validate(f) for f in features]


@router.get(
    "/my-tenant-premium-context", response_model=TenantPremiumPurchaseContextOut
)
async def get_my_tenant_premium_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    tenant = (
        db.query(Tenant)
        .filter(Tenant.owner_user_id == current_user.id)
        .order_by(Tenant.id.asc())
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant bulunamadi")

    active_features = get_tenant_premium_features_service(db, tenant.id)
    active_codes = [
        getattr(item.feature, "code", None)
        for item in active_features
        if getattr(item, "feature", None) is not None
        and getattr(item.feature, "code", None)
    ]
    return TenantPremiumPurchaseContextOut(
        tenant_id=tenant.id,
        tenant_name=tenant.brand_name or tenant.legal_name,
        tenant_slug=tenant.slug,
        active_feature_codes=active_codes,
    )


@router.post(
    "/tenant/{tenant_id}/premium-features/activate",
    response_model=TenantPremiumFeatureOut,
)
async def activate_tenant_premium_feature(
    tenant_id: int,
    payload: TenantPremiumFeatureActivateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    """Activate a premium feature for current tenant (requires payment)"""

    # Verify user owns the tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant or tenant.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Activate the feature
    # In production, this would go through payment before activation
    activated_feature = activate_premium_feature(
        db, tenant_id, payload.premium_feature_id
    )

    return TenantPremiumFeatureOut.model_validate(activated_feature)


# ============================================================================
# BUSINESS PARTNER COMMISSION
# ============================================================================


@router.get(
    "/business-partner/commissions", response_model=list[BusinessPartnerCommissionOut]
)
async def get_bp_commissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    """Get all active commissions for business partner tenant"""

    # Verify user owns a business partner tenant
    tenant = db.query(Tenant).filter(Tenant.owner_user_id == current_user.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    commissions = get_business_partner_commissions(db, tenant.id)
    return commissions


@router.get(
    "/business-partner/commission-report/{billing_period_month}",
    response_model=BusinessPartnerCommissionReportOut,
)
async def get_bp_commission_report(
    billing_period_month: str,  # "2026-04"
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_owner),
):
    """
    Get commission report for a specific month (business partner)
    Format: billing_period_month = "2026-04"
    """

    # Verify user owns a business partner tenant
    tenant = db.query(Tenant).filter(Tenant.owner_user_id == current_user.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    report = get_business_partner_commission_report(db, tenant.id, billing_period_month)
    if not report:
        raise HTTPException(
            status_code=404, detail=f"No commission report for {billing_period_month}"
        )

    return report


@router.post(
    "/business-partner/create-campaign-bonus",
    response_model=BusinessPartnerCommissionOut,
)
async def create_campaign_bonus(
    payload: BusinessPartnerCampaignBonusIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """
    Create campaign bonus for a business partner
    Super admin only
    """

    # Get commission record
    from api.services.onboarding_saas_service import get_business_partner_commissions

    commissions = get_business_partner_commissions(
        db, payload.business_partner_tenant_id
    )
    if not commissions:
        raise HTTPException(
            status_code=404, detail="No commissions found for this business partner"
        )

    # Update first commission with campaign bonus
    commission = commissions[0]
    commission.active_campaign_bonus_percent = payload.bonus_percent
    commission.campaign_bonus_started_at = payload.starts_at
    commission.campaign_bonus_ends_at = payload.ends_at

    db.commit()
    db.refresh(commission)

    return BusinessPartnerCommissionOut.model_validate(commission)


# ============================================================================
# ADMIN: TENANT TYPES & TIERS MANAGEMENT
# ============================================================================


@router.get("/admin/tenant-types", response_model=list[TenantTypeOut])
async def admin_list_tenant_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """List all tenant types (admin)"""
    return get_all_tenant_types(db)


@router.get(
    "/admin/subscription-tiers/{tenant_type_code}",
    response_model=list[SubscriptionPlanTierOut],
)
async def admin_get_tiers_for_type(
    tenant_type_code: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Get all tiers for a tenant type (admin)"""

    tenant_type = get_tenant_type_by_code(db, tenant_type_code)
    if not tenant_type:
        raise HTTPException(
            status_code=404, detail=f"Tenant type '{tenant_type_code}' not found"
        )

    tiers = get_tiers_for_tenant_type(db, tenant_type.id)
    return tiers


@router.get("/admin/premium-features", response_model=list[PremiumFeatureOut])
async def admin_list_premium_features(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """List all premium features (admin)"""
    return get_all_premium_features(db)


@router.post(
    "/admin/premium-features", response_model=PremiumFeatureOut, status_code=201
)
async def admin_create_premium_feature(
    payload: PremiumFeatureCreateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Create a premium feature (admin)"""

    existing = (
        db.query(PremiumFeature).filter(PremiumFeature.code == payload.code).first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Premium feature code zaten mevcut")

    feature = PremiumFeature(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        available_for_tenant_types=payload.available_for_tenant_types,
        monthly_price=payload.monthly_price,
        annual_price=payload.annual_price,
        is_active=payload.is_active,
        display_order=payload.display_order,
    )
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return PremiumFeatureOut.model_validate(feature)


@router.put("/admin/premium-features/{feature_id}", response_model=PremiumFeatureOut)
async def admin_update_premium_feature(
    feature_id: int,
    payload: PremiumFeatureUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Update a premium feature (admin)"""

    feature = db.query(PremiumFeature).filter(PremiumFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Premium feature bulunamadi")

    feature.name = payload.name
    feature.description = payload.description
    feature.available_for_tenant_types = payload.available_for_tenant_types
    feature.monthly_price = payload.monthly_price
    feature.annual_price = payload.annual_price
    feature.is_active = payload.is_active
    feature.display_order = payload.display_order
    db.add(feature)
    db.commit()
    db.refresh(feature)
    return PremiumFeatureOut.model_validate(feature)


@router.delete("/admin/premium-features/{feature_id}", status_code=204)
async def admin_delete_premium_feature(
    feature_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Delete a premium feature (admin)"""

    feature = db.query(PremiumFeature).filter(PremiumFeature.id == feature_id).first()
    if not feature:
        raise HTTPException(status_code=404, detail="Premium feature bulunamadi")

    db.delete(feature)
    db.commit()


@router.get(
    "/admin/business-partner-commissions/{bp_tenant_id}",
    response_model=list[BusinessPartnerCommissionOut],
)
async def admin_get_bp_commissions(
    bp_tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Get all commissions for a business partner (admin)"""

    commissions = get_business_partner_commissions(db, bp_tenant_id)
    return commissions
