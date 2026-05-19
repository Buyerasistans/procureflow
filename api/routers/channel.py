"""Channel scope API router."""

from __future__ import annotations

from datetime import timedelta
import os
import re
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from api.core.deps import get_current_user
from api.core.time import utcnow
from api.database import get_db
from api.models.channel import (
    ChannelOrganization,
    ChannelMember,
    CommissionContract,
    CommissionLedger,
    ChannelReferral,
    ChannelReferralLink,
    ChannelReferralEvent,
)
from api.models.campaign import (
    CampaignProgram,
    CampaignParticipant,
    CampaignRewardGrant,
)
from api.models.user import User
from api.services.channel_commission_service import (
    build_commission_report_for_owner,
    recalculate_commissions_for_owner,
)

router = APIRouter(prefix="/channel", tags=["channel"])
PUBLIC_REFERRAL_BASE_URL = (
    os.getenv("PUBLIC_REFERRAL_BASE_URL") or "https://buyerasistans.com.tr"
).rstrip("/")


# ---------------------------------------------------------------------------
# Schemas (satır içi — ileride api/schemas/channel.py'ye taşınabilir)
# ---------------------------------------------------------------------------


class ChannelOrgCreate(BaseModel):
    name: str
    slug: str
    tax_number: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website: str | None = None
    address: str | None = None
    account_owner_user_id: int | None = None


class ChannelOrgRead(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool

    class Config:
        from_attributes = True


class CommissionContractCreate(BaseModel):
    channel_org_id: int
    contract_type: str = "commission"
    commission_rate_partner: float | None = None
    commission_rate_supplier: float | None = None
    fixed_amount_per_unit: float | None = None
    target_count: int | None = None
    currency: str = "TRY"


class LedgerEntryRead(BaseModel):
    id: int
    event_type: str
    amount: float
    currency: str
    status: str

    class Config:
        from_attributes = True


class ChannelProfileSummaryOut(BaseModel):
    owner_user_id: int
    partner_type: str
    display_name: str
    level_code: str
    star_score: float
    performance_score: float
    total_team_size: int
    active_team_size: int
    last_30d_new_customers: int
    commission_pending: float
    commission_approved: float
    commission_paid: float
    commission_net_current_month: float


class ChannelReferralLinkOut(BaseModel):
    link_id: int
    link_code: str
    short_url: str | None
    qr_url: str | None
    campaign_id: int | None
    target_type: str
    is_active: bool


class ChannelReferralLinkCreate(BaseModel):
    campaign_id: int | None = None
    target_type: str = "mixed"
    landing_path: str | None = None
    short_url: str | None = None


class ChannelConversionMetricsOut(BaseModel):
    clicks: int
    signups: int
    activations: int
    converted_partner_count: int
    converted_supplier_count: int
    supplier_to_partner_count: int
    funnel_ratio_click_to_signup: float
    funnel_ratio_signup_to_activation: float
    funnel_ratio_activation_to_partner: float
    referral_breakdown: list["ChannelConversionByLinkOut"]
    daily_trend: list["ChannelConversionDailyOut"]


class ChannelConversionDailyOut(BaseModel):
    day: str
    clicks: int
    signups: int
    activations: int


class ChannelConversionByLinkOut(BaseModel):
    link_code: str
    target_type: str | None
    clicks: int
    signups: int
    activations: int
    net_commission: float


class ChannelReferralEventCreate(BaseModel):
    referral_link_id: int
    event_type: str
    source_scope: str | None = None
    target_scope: str | None = None
    amount_base: float | None = None


class ChannelCommissionTotalsOut(BaseModel):
    pending: float
    approved: float
    paid: float
    net: float


class ChannelCommissionByEventOut(BaseModel):
    event_type: str
    amount: float


class ChannelCommissionDailyOut(BaseModel):
    day: str
    net_amount: float


class ChannelCommissionReportOut(BaseModel):
    period: str
    totals: ChannelCommissionTotalsOut
    by_event_type: list[ChannelCommissionByEventOut]
    daily_trend: list[ChannelCommissionDailyOut]
    entry_count: int


class ChannelCommissionRecalcOut(BaseModel):
    period: str
    generated_entries: int
    skipped_existing: int
    skipped_missing_amount: int
    skipped_missing_contract: int


class TeamHierarchyNodeOut(BaseModel):
    user_id: int
    display_name: str
    email: str
    role_profile_code: str
    depth: int
    parent_user_id: int | None
    is_active: bool
    joined_at: str
    referral_count: int


class TeamHierarchyOut(BaseModel):
    root_user_id: int
    total_members: int
    active_members: int
    nodes: list[TeamHierarchyNodeOut]


class CampaignRuleChannelOut(BaseModel):
    id: int
    threshold_count: int
    reward_type: str
    reward_value_json: str | None
    sort_order: int
    is_active: bool


class CampaignChannelOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    audience_type: str
    trigger_event: str
    status: str
    is_public: bool
    starts_at: str | None
    ends_at: str | None
    rules: list[CampaignRuleChannelOut]
    # Katılımcı verisi (bu kullanıcı)
    my_progress_count: int
    my_last_event_at: str | None
    # Kazanılan ödüller (granted + applied)
    my_grants: list[str]  # reward_type listesi


class ChannelCampaignListOut(BaseModel):
    total: int
    active_count: int
    joined_count: int
    campaigns: list[CampaignChannelOut]


class SocialShareItemOut(BaseModel):
    channel: str
    label: str
    share_url: str


class ChannelSocialLinksOut(BaseModel):
    source_link_code: str | None
    source_short_url: str | None
    share_message: str
    items: list[SocialShareItemOut]


class TeamPerformanceRowOut(BaseModel):
    user_id: int
    display_name: str
    role_profile_code: str
    is_active: bool
    referral_count: int
    referral_last_30d: int
    commission_total: float
    score_last_30d: float


class TeamPerformanceOut(BaseModel):
    period: str
    total_members: int
    rows: list[TeamPerformanceRowOut]


def _is_channel_user(current_user: User) -> bool:
    scope = str(getattr(current_user, "scope_type", "") or "").strip().lower()
    role = (
        str(
            getattr(current_user, "business_role", None)
            or getattr(current_user, "role", "")
            or ""
        )
        .strip()
        .lower()
    )
    return scope == "channel" or role.startswith("channel_")


def _resolve_channel_org_id(db: Session, current_user: User) -> int | None:
    owner_org_id = (
        db.query(ChannelOrganization.id)
        .filter(
            ChannelOrganization.account_owner_user_id == current_user.id,
            ChannelOrganization.is_active == True,
        )
        .scalar()
    )
    if owner_org_id is not None:
        return int(owner_org_id)

    member_org_id = (
        db.query(ChannelMember.channel_org_id)
        .filter(
            ChannelMember.user_id == current_user.id, ChannelMember.is_active == True
        )
        .scalar()
    )
    if member_org_id is not None:
        return int(member_org_id)
    return None


def _referral_tables_ready(db: Session) -> bool:
    inspector = inspect(db.bind)
    return inspector.has_table("channel_referral_links") and inspector.has_table(
        "channel_referral_events"
    )


def _resolve_referral_owner_user_id(db: Session, current_user: User) -> int:
    org_id = _resolve_channel_org_id(db, current_user)
    if org_id is None:
        return int(current_user.id)
    org = db.get(ChannelOrganization, org_id)
    if org and org.account_owner_user_id:
        return int(org.account_owner_user_id)
    return int(current_user.id)


def _parse_period_days(period_value: str) -> int:
    matched = re.fullmatch(r"(\d+)d", str(period_value or "30d").strip().lower())
    if not matched:
        return 30
    return max(1, min(int(matched.group(1)), 365))


def _build_public_referral_url(
    link_code: str | None, target_type: str | None
) -> str | None:
    code = str(link_code or "").strip().upper()
    if not code:
        return None
    target = str(target_type or "mixed").strip().lower()
    if target == "partner":
        return f"{PUBLIC_REFERRAL_BASE_URL}/strategic_partner/{code}"
    if target == "supplier":
        return f"{PUBLIC_REFERRAL_BASE_URL}/supplier/{code}"
    return f"{PUBLIC_REFERRAL_BASE_URL}/r/{code}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/organizations", response_model=list[ChannelOrgRead])
def list_channel_organizations(db: Session = Depends(get_db)):
    return (
        db.query(ChannelOrganization)
        .filter(ChannelOrganization.is_active == True)
        .all()
    )


@router.post(
    "/organizations", response_model=ChannelOrgRead, status_code=status.HTTP_201_CREATED
)
def create_channel_organization(
    payload: ChannelOrgCreate, db: Session = Depends(get_db)
):
    existing = (
        db.query(ChannelOrganization)
        .filter(ChannelOrganization.slug == payload.slug)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bu slug zaten kullanımda.")
    org = ChannelOrganization(**payload.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("/organizations/{org_id}", response_model=ChannelOrgRead)
def get_channel_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.get(ChannelOrganization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Channel organizasyonu bulunamadı.")
    return org


@router.post("/contracts", status_code=status.HTTP_201_CREATED)
def create_commission_contract(
    payload: CommissionContractCreate, db: Session = Depends(get_db)
):
    org = db.get(ChannelOrganization, payload.channel_org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Channel organizasyonu bulunamadı.")
    contract = CommissionContract(**payload.model_dump())
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return {"id": contract.id, "message": "Sözleşme oluşturuldu."}


@router.get("/organizations/{org_id}/ledger", response_model=list[LedgerEntryRead])
def get_ledger(org_id: int, db: Session = Depends(get_db)):
    entries = (
        db.query(CommissionLedger)
        .filter(CommissionLedger.channel_org_id == org_id)
        .order_by(CommissionLedger.created_at.desc())
        .all()
    )
    return entries


@router.get("/profile/summary", response_model=ChannelProfileSummaryOut)
def get_channel_profile_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    org_id = _resolve_channel_org_id(db, current_user)
    role = (
        str(
            getattr(current_user, "business_role", None)
            or getattr(current_user, "role", "")
            or ""
        )
        .strip()
        .lower()
    )
    level_code = "channel.account_owner" if role == "channel_owner" else "channel.agent"

    if org_id is None:
        display_name = (current_user.full_name or "").strip() or current_user.email
        return ChannelProfileSummaryOut(
            owner_user_id=current_user.id,
            partner_type="individual",
            display_name=display_name,
            level_code=level_code,
            star_score=0.0,
            performance_score=0.0,
            total_team_size=1,
            active_team_size=1 if bool(getattr(current_user, "is_active", True)) else 0,
            last_30d_new_customers=0,
            commission_pending=0.0,
            commission_approved=0.0,
            commission_paid=0.0,
            commission_net_current_month=0.0,
        )

    org = db.get(ChannelOrganization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Channel organizasyonu bulunamadi.")

    total_team_size = (
        db.query(func.count(ChannelMember.id))
        .filter(ChannelMember.channel_org_id == org_id)
        .scalar()
        or 0
    )
    active_team_size = (
        db.query(func.count(ChannelMember.id))
        .filter(ChannelMember.channel_org_id == org_id, ChannelMember.is_active == True)
        .scalar()
        or 0
    )

    thirty_days_ago = utcnow() - timedelta(days=30)
    last_30d_new_customers = (
        db.query(func.count(ChannelReferral.id))
        .filter(
            ChannelReferral.channel_org_id == org_id,
            ChannelReferral.created_at >= thirty_days_ago,
        )
        .scalar()
        or 0
    )

    def _sum_ledger(status_value: str) -> float:
        amount = (
            db.query(func.coalesce(func.sum(CommissionLedger.amount), 0))
            .filter(
                CommissionLedger.channel_org_id == org_id,
                CommissionLedger.status == status_value,
            )
            .scalar()
        )
        return float(amount or 0)

    now = utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    net_current_month_amount = (
        db.query(func.coalesce(func.sum(CommissionLedger.amount), 0))
        .filter(
            CommissionLedger.channel_org_id == org_id,
            CommissionLedger.status.in_(["approved", "paid"]),
            CommissionLedger.created_at >= month_start,
        )
        .scalar()
    )
    commission_net_current_month = float(net_current_month_amount or 0)

    performance_score = min(
        100.0,
        float(active_team_size) * 10.0 + float(last_30d_new_customers) * 5.0,
    )
    star_score = min(5.0, round(performance_score / 20.0, 1))
    partner_type = "corporate" if (org.tax_number or "").strip() else "individual"

    return ChannelProfileSummaryOut(
        owner_user_id=current_user.id,
        partner_type=partner_type,
        display_name=org.name,
        level_code=level_code,
        star_score=star_score,
        performance_score=performance_score,
        total_team_size=int(total_team_size),
        active_team_size=int(active_team_size),
        last_30d_new_customers=int(last_30d_new_customers),
        commission_pending=_sum_ledger("pending"),
        commission_approved=_sum_ledger("approved"),
        commission_paid=_sum_ledger("paid"),
        commission_net_current_month=commission_net_current_month,
    )


@router.get("/profile/referral-links", response_model=list[ChannelReferralLinkOut])
def get_channel_referral_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    if not _referral_tables_ready(db):
        return []

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    links = (
        db.query(ChannelReferralLink)
        .filter(ChannelReferralLink.owner_user_id == owner_user_id)
        .order_by(ChannelReferralLink.created_at.desc())
        .all()
    )
    response: list[ChannelReferralLinkOut] = []
    for item in links:
        short_url = (
            _build_public_referral_url(
                item.link_code,
                item.target_type,
            )
            or item.short_url
        )
        qr_url = (
            f"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data={quote(short_url)}"
            if short_url
            else None
        )
        response.append(
            ChannelReferralLinkOut(
                link_id=item.id,
                link_code=item.link_code,
                short_url=short_url,
                qr_url=qr_url,
                campaign_id=item.campaign_id,
                target_type=item.target_type,
                is_active=bool(item.is_active),
            )
        )
    return response


@router.post(
    "/profile/referral-links",
    response_model=ChannelReferralLinkOut,
    status_code=status.HTTP_201_CREATED,
)
def create_channel_referral_link(
    payload: ChannelReferralLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )
    if not _referral_tables_ready(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral link altyapisi henuz aktif degil.",
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    while True:
        link_code = f"CH-{secrets.token_urlsafe(6).replace('-', '').replace('_', '').upper()[:10]}"
        exists = (
            db.query(ChannelReferralLink.id)
            .filter(ChannelReferralLink.link_code == link_code)
            .first()
        )
        if not exists:
            break

    link = ChannelReferralLink(
        owner_user_id=owner_user_id,
        created_by_user_id=int(current_user.id),
        campaign_id=payload.campaign_id,
        link_code=link_code,
        short_url=payload.short_url,
        landing_path=payload.landing_path,
        target_type=payload.target_type,
        is_active=True,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    short_url = (
        _build_public_referral_url(
            link.link_code,
            link.target_type,
        )
        or link.short_url
    )
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data={quote(short_url)}"
    return ChannelReferralLinkOut(
        link_id=link.id,
        link_code=link.link_code,
        short_url=short_url,
        qr_url=qr_url,
        campaign_id=link.campaign_id,
        target_type=link.target_type,
        is_active=bool(link.is_active),
    )


@router.post("/profile/referral-events", status_code=status.HTTP_201_CREATED)
def create_channel_referral_event(
    payload: ChannelReferralEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )
    if not _referral_tables_ready(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Referral event altyapisi henuz aktif degil.",
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    link = (
        db.query(ChannelReferralLink)
        .filter(
            ChannelReferralLink.id == payload.referral_link_id,
            ChannelReferralLink.owner_user_id == owner_user_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Referral link bulunamadi.")

    event = ChannelReferralEvent(
        referral_link_id=link.id,
        event_type=payload.event_type,
        actor_user_id=int(current_user.id),
        source_scope=payload.source_scope,
        target_scope=payload.target_scope,
        amount_base=payload.amount_base,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"id": event.id, "message": "Referral event kaydedildi."}


@router.get("/profile/conversion-metrics", response_model=ChannelConversionMetricsOut)
def get_channel_conversion_metrics(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )
    if not _referral_tables_ready(db):
        return ChannelConversionMetricsOut(
            clicks=0,
            signups=0,
            activations=0,
            converted_partner_count=0,
            converted_supplier_count=0,
            supplier_to_partner_count=0,
            funnel_ratio_click_to_signup=0.0,
            funnel_ratio_signup_to_activation=0.0,
            funnel_ratio_activation_to_partner=0.0,
            referral_breakdown=[],
            daily_trend=[],
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    days = _parse_period_days(period)
    start_at = utcnow() - timedelta(days=days)

    rows = (
        db.query(
            ChannelReferralEvent.event_type,
            ChannelReferralEvent.target_scope,
            func.count(ChannelReferralEvent.id),
        )
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            ChannelReferralLink.owner_user_id == owner_user_id,
            ChannelReferralEvent.occurred_at >= start_at,
        )
        .group_by(ChannelReferralEvent.event_type, ChannelReferralEvent.target_scope)
        .all()
    )

    daily_rows = (
        db.query(
            func.date(ChannelReferralEvent.occurred_at),
            ChannelReferralEvent.event_type,
            func.count(ChannelReferralEvent.id),
        )
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            ChannelReferralLink.owner_user_id == owner_user_id,
            ChannelReferralEvent.occurred_at >= start_at,
        )
        .group_by(
            func.date(ChannelReferralEvent.occurred_at), ChannelReferralEvent.event_type
        )
        .all()
    )

    by_link_rows = (
        db.query(
            ChannelReferralLink.link_code,
            ChannelReferralLink.target_type,
            ChannelReferralEvent.event_type,
            func.count(ChannelReferralEvent.id),
        )
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            ChannelReferralLink.owner_user_id == owner_user_id,
            ChannelReferralEvent.occurred_at >= start_at,
        )
        .group_by(
            ChannelReferralLink.link_code,
            ChannelReferralLink.target_type,
            ChannelReferralEvent.event_type,
        )
        .all()
    )

    by_link_net_rows = (
        db.query(
            ChannelReferralLink.link_code,
            func.coalesce(func.sum(CommissionLedger.amount), 0),
        )
        .join(
            ChannelReferralEvent,
            ChannelReferralEvent.id == CommissionLedger.reference_id,
        )
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            CommissionLedger.reference_type == "channel_referral_event",
            CommissionLedger.created_at >= start_at,
            CommissionLedger.status.in_(["approved", "paid"]),
            ChannelReferralLink.owner_user_id == owner_user_id,
        )
        .group_by(ChannelReferralLink.link_code)
        .all()
    )

    clicks = 0
    signups = 0
    activations = 0
    converted_partner_count = 0
    converted_supplier_count = 0
    supplier_to_partner_count = 0

    for event_type, target_scope, count in rows:
        event_type_key = str(event_type or "").strip().lower()
        target_scope_key = str(target_scope or "").strip().lower()
        value = int(count or 0)
        if event_type_key == "click":
            clicks += value
        if event_type_key in {"signup", "partner_signup", "supplier_signup"}:
            signups += value
        if event_type_key in {
            "activation",
            "partner_activation",
            "supplier_activation",
        }:
            activations += value
        if target_scope_key == "partner" or event_type_key == "partner_signup":
            converted_partner_count += value
        if target_scope_key == "supplier" or event_type_key == "supplier_signup":
            converted_supplier_count += value
        if event_type_key == "supplier_to_partner":
            supplier_to_partner_count += value

    trend_map: dict[str, dict[str, int]] = {}
    for day_value, event_type, count in daily_rows:
        day_key = str(day_value)
        trend_map.setdefault(day_key, {"clicks": 0, "signups": 0, "activations": 0})
        event_type_key = str(event_type or "").strip().lower()
        value = int(count or 0)
        if event_type_key == "click":
            trend_map[day_key]["clicks"] += value
        if event_type_key in {"signup", "partner_signup", "supplier_signup"}:
            trend_map[day_key]["signups"] += value
        if event_type_key in {
            "activation",
            "partner_activation",
            "supplier_activation",
        }:
            trend_map[day_key]["activations"] += value

    daily_trend = [
        ChannelConversionDailyOut(
            day=day,
            clicks=vals["clicks"],
            signups=vals["signups"],
            activations=vals["activations"],
        )
        for day, vals in sorted(trend_map.items(), key=lambda item: item[0])
    ]

    by_link_map: dict[str, ChannelConversionByLinkOut] = {}
    for link_code, target_type, event_type, count in by_link_rows:
        key = str(link_code or "")
        if not key:
            continue
        if key not in by_link_map:
            by_link_map[key] = ChannelConversionByLinkOut(
                link_code=key,
                target_type=str(target_type) if target_type is not None else None,
                clicks=0,
                signups=0,
                activations=0,
                net_commission=0.0,
            )
        event_type_key = str(event_type or "").strip().lower()
        value = int(count or 0)
        if event_type_key == "click":
            by_link_map[key].clicks += value
        if event_type_key in {"signup", "partner_signup", "supplier_signup"}:
            by_link_map[key].signups += value
        if event_type_key in {
            "activation",
            "partner_activation",
            "supplier_activation",
        }:
            by_link_map[key].activations += value

    for link_code, net_amount in by_link_net_rows:
        key = str(link_code or "")
        if not key:
            continue
        if key not in by_link_map:
            by_link_map[key] = ChannelConversionByLinkOut(
                link_code=key,
                target_type=None,
                clicks=0,
                signups=0,
                activations=0,
                net_commission=0.0,
            )
        by_link_map[key].net_commission = float(net_amount or 0)

    referral_breakdown = sorted(
        by_link_map.values(),
        key=lambda row: (row.signups, row.clicks, row.link_code),
        reverse=True,
    )

    ratio_click_to_signup = (
        round((float(signups) / float(clicks) * 100.0), 1) if clicks > 0 else 0.0
    )
    ratio_signup_to_activation = (
        round((float(activations) / float(signups) * 100.0), 1) if signups > 0 else 0.0
    )
    ratio_activation_to_partner = (
        round((float(converted_partner_count) / float(activations) * 100.0), 1)
        if activations > 0
        else 0.0
    )

    return ChannelConversionMetricsOut(
        clicks=clicks,
        signups=signups,
        activations=activations,
        converted_partner_count=converted_partner_count,
        converted_supplier_count=converted_supplier_count,
        supplier_to_partner_count=supplier_to_partner_count,
        funnel_ratio_click_to_signup=ratio_click_to_signup,
        funnel_ratio_signup_to_activation=ratio_signup_to_activation,
        funnel_ratio_activation_to_partner=ratio_activation_to_partner,
        referral_breakdown=referral_breakdown,
        daily_trend=daily_trend,
    )


@router.post(
    "/profile/commission-recalculate", response_model=ChannelCommissionRecalcOut
)
def recalculate_channel_commissions(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )
    if not _referral_tables_ready(db):
        return ChannelCommissionRecalcOut(
            period=period,
            generated_entries=0,
            skipped_existing=0,
            skipped_missing_amount=0,
            skipped_missing_contract=0,
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    days = _parse_period_days(period)
    result = recalculate_commissions_for_owner(
        db,
        owner_user_id=owner_user_id,
        period_days=days,
    )
    return ChannelCommissionRecalcOut(period=f"{days}d", **result)


@router.get("/profile/commission-report", response_model=ChannelCommissionReportOut)
def get_channel_commission_report(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    days = _parse_period_days(period)
    report = build_commission_report_for_owner(
        db,
        owner_user_id=owner_user_id,
        period_days=days,
    )
    return ChannelCommissionReportOut(**report)


# ---------------------------------------------------------------------------
# Team Hierarchy
# ---------------------------------------------------------------------------

_ROLE_DEPTH: dict[str, int] = {
    "channel.account_owner": 0,
    "channel.team_lead": 1,
    "channel.agent": 2,
    "channel.junior_agent": 3,
}


@router.get("/profile/team-hierarchy", response_model=TeamHierarchyOut)
def get_channel_team_hierarchy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    org_id = _resolve_channel_org_id(db, current_user)
    if org_id is None:
        display = (str(current_user.full_name or "").strip()) or str(current_user.email)
        return TeamHierarchyOut(
            root_user_id=int(current_user.id),
            total_members=1,
            active_members=1,
            nodes=[
                TeamHierarchyNodeOut(
                    user_id=int(current_user.id),
                    display_name=display,
                    email=str(current_user.email),
                    role_profile_code="channel.account_owner",
                    depth=0,
                    parent_user_id=None,
                    is_active=True,
                    joined_at=utcnow().isoformat(),
                    referral_count=0,
                )
            ],
        )

    org = db.get(ChannelOrganization, org_id)
    root_user_id = (
        int(org.account_owner_user_id)
        if org and org.account_owner_user_id
        else int(current_user.id)
    )

    # Tüm org üyeleri + kullanıcı bilgileri
    member_rows: list[tuple[ChannelMember, User]] = (
        db.query(ChannelMember, User)
        .join(User, User.id == ChannelMember.user_id)
        .filter(ChannelMember.channel_org_id == org_id)
        .all()
    )

    # channel_member.id → user_id haritası (referral sayısı için)
    member_id_to_user_id: dict[int, int] = {
        int(m.id): int(m.user_id) for m, _ in member_rows
    }

    referral_counts: dict[int, int] = {}
    if member_id_to_user_id:
        ref_rows = (
            db.query(
                ChannelReferral.channel_member_id,
                func.count(ChannelReferral.id),
            )
            .filter(
                ChannelReferral.channel_org_id == org_id,
                ChannelReferral.channel_member_id.in_(
                    list(member_id_to_user_id.keys())
                ),
            )
            .group_by(ChannelReferral.channel_member_id)
            .all()
        )
        for mid, cnt in ref_rows:
            if mid and mid in member_id_to_user_id:
                referral_counts[member_id_to_user_id[mid]] = int(cnt or 0)

    # Derinliğe göre sırala; en üstteki (depth=0) önce gelir
    sorted_rows = sorted(
        member_rows,
        key=lambda pair: _ROLE_DEPTH.get(str(pair[0].role_profile_code or ""), 2),
    )

    depth_to_user_id: dict[int, int] = {}
    nodes: list[TeamHierarchyNodeOut] = []

    for member, user in sorted_rows:
        role = str(member.role_profile_code or "channel.agent")
        depth = _ROLE_DEPTH.get(role, 2)

        if depth == 0:
            parent_uid = None
        else:
            parent_uid = None
            for d in range(depth - 1, -1, -1):
                if d in depth_to_user_id:
                    parent_uid = depth_to_user_id[d]
                    break

        display = (str(user.full_name or "").strip()) or str(user.email)
        joined_str = (
            member.joined_at.isoformat() if member.joined_at else utcnow().isoformat()
        )

        nodes.append(
            TeamHierarchyNodeOut(
                user_id=int(user.id),
                display_name=display,
                email=str(user.email),
                role_profile_code=role,
                depth=depth,
                parent_user_id=parent_uid,
                is_active=bool(member.is_active),
                joined_at=joined_str,
                referral_count=referral_counts.get(int(user.id), 0),
            )
        )
        depth_to_user_id[depth] = int(user.id)

    # account_owner org üyesi değilse kök node olarak ekle
    existing_ids = {n.user_id for n in nodes}
    if root_user_id not in existing_ids:
        root_user_obj = db.get(User, root_user_id)
        if root_user_obj:
            display = (str(root_user_obj.full_name or "").strip()) or str(
                root_user_obj.email
            )
            nodes.insert(
                0,
                TeamHierarchyNodeOut(
                    user_id=root_user_id,
                    display_name=display,
                    email=str(root_user_obj.email),
                    role_profile_code="channel.account_owner",
                    depth=0,
                    parent_user_id=None,
                    is_active=bool(getattr(root_user_obj, "is_active", True)),
                    joined_at=utcnow().isoformat(),
                    referral_count=referral_counts.get(root_user_id, 0),
                ),
            )

    total = len(nodes)
    active = sum(1 for n in nodes if n.is_active)

    return TeamHierarchyOut(
        root_user_id=root_user_id,
        total_members=total,
        active_members=active,
        nodes=nodes,
    )


# ---------------------------------------------------------------------------
# Campaign Panel
# ---------------------------------------------------------------------------


def _campaign_tables_ready(db: Session) -> bool:
    inspector = inspect(db.bind)
    return inspector.has_table("campaign_programs")


def _build_share_items(*, link_url: str, message: str) -> list[SocialShareItemOut]:
    encoded_url = quote(link_url)
    encoded_text = quote(message)
    subject = quote("ProcureFlow daveti")
    body = quote(f"{message}\n\n{link_url}")
    return [
        SocialShareItemOut(
            channel="whatsapp",
            label="WhatsApp",
            share_url=f"https://wa.me/?text={quote(f'{message} {link_url}')}",
        ),
        SocialShareItemOut(
            channel="linkedin",
            label="LinkedIn",
            share_url=f"https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}",
        ),
        SocialShareItemOut(
            channel="x",
            label="X",
            share_url=f"https://x.com/intent/tweet?text={encoded_text}&url={encoded_url}",
        ),
        SocialShareItemOut(
            channel="facebook",
            label="Facebook",
            share_url=f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}",
        ),
        SocialShareItemOut(
            channel="telegram",
            label="Telegram",
            share_url=f"https://t.me/share/url?url={encoded_url}&text={encoded_text}",
        ),
        SocialShareItemOut(
            channel="email",
            label="E-posta",
            share_url=f"mailto:?subject={subject}&body={body}",
        ),
    ]


@router.get("/profile/campaigns", response_model=ChannelCampaignListOut)
def get_channel_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Channel kullanicisinin katilabilecegi / katildigi aktif kampanyalari dondurur."""
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    if not _campaign_tables_ready(db):
        return ChannelCampaignListOut(
            total=0, active_count=0, joined_count=0, campaigns=[]
        )

    org_id = _resolve_channel_org_id(db, current_user)

    # audience_type = "channel" olan public kampanyalar
    programs = (
        db.query(CampaignProgram)
        .filter(
            CampaignProgram.audience_type == "channel",
            CampaignProgram.is_public == True,
            CampaignProgram.status.in_(["active", "live", "draft"]),
        )
        .order_by(CampaignProgram.created_at.desc())
        .all()
    )

    # Bu kullanici icin katilimci kayitlari (owner_type=channel_org veya user)
    owner_type_map = {}
    if org_id:
        owner_type_map["channel_org"] = org_id
    owner_type_map["user"] = int(current_user.id)

    participant_map: dict[int, CampaignParticipant] = {}
    for otype, oid in owner_type_map.items():
        rows = (
            db.query(CampaignParticipant)
            .filter(
                CampaignParticipant.owner_type == otype,
                CampaignParticipant.owner_id == oid,
            )
            .all()
        )
        for row in rows:
            if row.campaign_id not in participant_map:
                participant_map[row.campaign_id] = row

    grant_map: dict[int, list[str]] = {}
    for otype, oid in owner_type_map.items():
        rows = (
            db.query(CampaignRewardGrant)
            .filter(
                CampaignRewardGrant.owner_type == otype,
                CampaignRewardGrant.owner_id == oid,
                CampaignRewardGrant.status.in_(["granted", "applied"]),
            )
            .all()
        )
        for row in rows:
            grant_map.setdefault(row.campaign_id, [])
            grant_map[row.campaign_id].append(row.reward_type)

    result: list[CampaignChannelOut] = []
    for prog in programs:
        participant = participant_map.get(prog.id)
        rules = sorted(
            [r for r in (prog.rules or []) if r.is_active],
            key=lambda r: r.sort_order,
        )
        result.append(
            CampaignChannelOut(
                id=prog.id,
                code=prog.code,
                name=prog.name,
                description=prog.description,
                audience_type=prog.audience_type,
                trigger_event=prog.trigger_event,
                status=prog.status,
                is_public=prog.is_public,
                starts_at=prog.starts_at.isoformat() if prog.starts_at else None,
                ends_at=prog.ends_at.isoformat() if prog.ends_at else None,
                rules=[
                    CampaignRuleChannelOut(
                        id=r.id,
                        threshold_count=r.threshold_count,
                        reward_type=r.reward_type,
                        reward_value_json=r.reward_value_json,
                        sort_order=r.sort_order,
                        is_active=r.is_active,
                    )
                    for r in rules
                ],
                my_progress_count=participant.progress_count if participant else 0,
                my_last_event_at=(
                    participant.last_event_at.isoformat()
                    if participant and participant.last_event_at
                    else None
                ),
                my_grants=grant_map.get(prog.id, []),
            )
        )

    active_count = sum(1 for p in result if p.status in {"active", "live"})
    joined_count = sum(1 for p in result if p.my_progress_count > 0)

    return ChannelCampaignListOut(
        total=len(result),
        active_count=active_count,
        joined_count=joined_count,
        campaigns=result,
    )


@router.get("/profile/social-links", response_model=ChannelSocialLinksOut)
def get_channel_social_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    display_name = (str(current_user.full_name or "").strip()) or str(
        current_user.email
    )

    source_link: ChannelReferralLink | None = None
    if _referral_tables_ready(db):
        source_link = (
            db.query(ChannelReferralLink)
            .filter(
                ChannelReferralLink.owner_user_id == owner_user_id,
                ChannelReferralLink.is_active == True,
            )
            .order_by(ChannelReferralLink.created_at.desc())
            .first()
        )

    short_url = None
    link_code = None
    if source_link is not None:
        link_code = source_link.link_code
        short_url = (
            _build_public_referral_url(
                source_link.link_code,
                source_link.target_type,
            )
            or source_link.short_url
        )

    message = (
        "Satin Alma Asistaninizin size sagladigi kolayliklari denemek icin "
        f"linkimi kullanabilirsiniz. - {display_name}"
    )
    if short_url:
        items = _build_share_items(link_url=short_url, message=message)
    else:
        items = []

    return ChannelSocialLinksOut(
        source_link_code=link_code,
        source_short_url=short_url,
        share_message=message,
        items=items,
    )


@router.get("/profile/team-performance", response_model=TeamPerformanceOut)
def get_channel_team_performance(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    org_id = _resolve_channel_org_id(db, current_user)
    if org_id is None:
        return TeamPerformanceOut(period="30d", total_members=0, rows=[])

    days = _parse_period_days(period)
    start_at = utcnow() - timedelta(days=days)

    member_rows: list[tuple[ChannelMember, User]] = (
        db.query(ChannelMember, User)
        .join(User, User.id == ChannelMember.user_id)
        .filter(ChannelMember.channel_org_id == org_id)
        .all()
    )
    if not member_rows:
        return TeamPerformanceOut(period=f"{days}d", total_members=0, rows=[])

    member_id_to_user_id: dict[int, int] = {
        int(m.id): int(m.user_id) for m, _ in member_rows
    }

    referral_total_map: dict[int, int] = {}
    referral_recent_map: dict[int, int] = {}
    if member_id_to_user_id:
        ref_total_rows = (
            db.query(ChannelReferral.channel_member_id, func.count(ChannelReferral.id))
            .filter(
                ChannelReferral.channel_org_id == org_id,
                ChannelReferral.channel_member_id.in_(
                    list(member_id_to_user_id.keys())
                ),
            )
            .group_by(ChannelReferral.channel_member_id)
            .all()
        )
        for mid, cnt in ref_total_rows:
            if mid and mid in member_id_to_user_id:
                referral_total_map[member_id_to_user_id[mid]] = int(cnt or 0)

        ref_recent_rows = (
            db.query(ChannelReferral.channel_member_id, func.count(ChannelReferral.id))
            .filter(
                ChannelReferral.channel_org_id == org_id,
                ChannelReferral.channel_member_id.in_(
                    list(member_id_to_user_id.keys())
                ),
                ChannelReferral.created_at >= start_at,
            )
            .group_by(ChannelReferral.channel_member_id)
            .all()
        )
        for mid, cnt in ref_recent_rows:
            if mid and mid in member_id_to_user_id:
                referral_recent_map[member_id_to_user_id[mid]] = int(cnt or 0)

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    member_user_ids = [int(u.id) for _, u in member_rows]
    commission_map: dict[int, float] = {uid: 0.0 for uid in member_user_ids}

    if _referral_tables_ready(db):
        event_amount_rows = (
            db.query(
                ChannelReferralEvent.actor_user_id,
                func.coalesce(func.sum(ChannelReferralEvent.amount_base), 0),
            )
            .join(
                ChannelReferralLink,
                ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
            )
            .filter(
                ChannelReferralLink.owner_user_id == owner_user_id,
                ChannelReferralEvent.actor_user_id.in_(member_user_ids),
                ChannelReferralEvent.occurred_at >= start_at,
            )
            .group_by(ChannelReferralEvent.actor_user_id)
            .all()
        )
        for uid, amount in event_amount_rows:
            commission_map[int(uid)] = float(amount or 0)

    rows: list[TeamPerformanceRowOut] = []
    for member, user in member_rows:
        uid = int(user.id)
        recent_ref = referral_recent_map.get(uid, 0)
        commission_total = commission_map.get(uid, 0.0)
        score = min(100.0, float(recent_ref) * 10.0 + (commission_total / 1000.0) * 5.0)
        display = (str(user.full_name or "").strip()) or str(user.email)

        rows.append(
            TeamPerformanceRowOut(
                user_id=uid,
                display_name=display,
                role_profile_code=str(member.role_profile_code or "channel.agent"),
                is_active=bool(member.is_active),
                referral_count=referral_total_map.get(uid, 0),
                referral_last_30d=recent_ref,
                commission_total=round(commission_total, 2),
                score_last_30d=round(score, 1),
            )
        )

    rows.sort(
        key=lambda item: (item.score_last_30d, item.referral_last_30d), reverse=True
    )
    return TeamPerformanceOut(period=f"{days}d", total_members=len(rows), rows=rows)


# ---------------------------------------------------------------------------
# Sprint-5: Gamification & Performance Scoring
# ---------------------------------------------------------------------------

LEVEL_THRESHOLDS = [
    (50, "L3", 3, 1.2),
    (25, "L2", 2, 0.8),
    (10, "L1", 1, 0.4),
    (0, "L0", 0, 0.0),
]

BADGE_DEFINITIONS = [
    ("first_referral", "Ilk Referans", lambda r, _a, _s: r >= 1),
    ("referral_10", "10 Referans", lambda r, _a, _s: r >= 10),
    ("referral_25", "25 Referans", lambda r, _a, _s: r >= 25),
    ("team_builder", "Ekip Kurucusu", lambda _r, a, _s: a >= 3),
    ("top_performer", "En Iyi Performans", lambda _r, _a, s: s >= 80.0),
]


class BadgeOut(BaseModel):
    code: str
    label: str
    earned: bool


class GamificationOut(BaseModel):
    owner_user_id: int
    level_code: str
    level_index: int
    star_score: float
    performance_score: float
    performance_factor: float
    grace_period_remaining: int
    total_referrals: int
    active_team_size: int
    badges: list[BadgeOut]


@router.get("/profile/gamification", response_model=GamificationOut)
def get_channel_gamification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kullanicinin seviye, rozet ve performans faktorunu dondurur."""
    if not _is_channel_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu endpoint yalnizca is ortagi kullanicilari icindir.",
        )

    owner_user_id = _resolve_referral_owner_user_id(db, current_user)
    org_id = _resolve_channel_org_id(db, current_user)

    # Toplam referral
    total_referrals = 0
    active_team_size = 0
    if _referral_tables_ready(db):
        total_referrals = (
            db.query(func.count(ChannelReferralLink.id))
            .filter(ChannelReferralLink.owner_user_id == owner_user_id)
            .scalar()
            or 0
        )

    if org_id is not None:
        active_team_size = (
            db.query(func.count(ChannelMember.id))
            .filter(
                ChannelMember.channel_org_id == org_id, ChannelMember.is_active == True
            )
            .scalar()
            or 0
        )

    # Performans skoru (ayni formul summary endpoint ile tutarli)
    performance_score = min(
        100.0,
        float(active_team_size) * 10.0 + float(total_referrals) * 5.0,
    )
    star_score = min(5.0, round(performance_score / 20.0, 1))

    # Seviye ve faktor
    level_code = "L0"
    level_index = 0
    performance_factor = 0.0
    for threshold, lc, li, pf in LEVEL_THRESHOLDS:
        if total_referrals >= threshold:
            level_code = lc
            level_index = li
            performance_factor = pf
            break

    # Rozetler
    badges = [
        BadgeOut(
            code=code,
            label=label,
            earned=condition(
                int(total_referrals), int(active_team_size), performance_score
            ),
        )
        for code, label, condition in BADGE_DEFINITIONS
    ]

    return GamificationOut(
        owner_user_id=owner_user_id,
        level_code=level_code,
        level_index=level_index,
        star_score=star_score,
        performance_score=round(performance_score, 1),
        performance_factor=performance_factor,
        grace_period_remaining=0,
        total_referrals=int(total_referrals),
        active_team_size=int(active_team_size),
        badges=badges,
    )


# ---------------------------------------------------------------------------
# Sprint-5: Public referral landing info (no-auth)
# ---------------------------------------------------------------------------


class PublicReferralInfoOut(BaseModel):
    link_code: str
    is_active: bool
    org_name: str | None
    target_type: str | None
    landing_path: str | None


@router.get("/public/r/{link_code}", response_model=PublicReferralInfoOut)
def get_public_referral_info(link_code: str, db: Session = Depends(get_db)):
    """Referral landing sayfasi icin public endpoint — auth gerektirmez.
    Tiklama eventi de kayit eder."""
    if not _referral_tables_ready(db):
        raise HTTPException(status_code=404, detail="Referral link bulunamadi.")

    link = (
        db.query(ChannelReferralLink)
        .filter(ChannelReferralLink.link_code == link_code)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Referral link bulunamadi.")

    # Tiklama eventi kaydet
    if bool(link.is_active):
        click_event = ChannelReferralEvent(
            referral_link_id=link.id,
            event_type="click",
            actor_user_id=None,
            source_scope="public",
            target_scope=link.target_type or "mixed",
            amount_base=None,
        )
        db.add(click_event)
        db.commit()

    org_name: str | None = None
    if link.owner_user_id:
        org = (
            db.query(ChannelOrganization)
            .filter(ChannelOrganization.account_owner_user_id == link.owner_user_id)
            .first()
        )
        if org:
            org_name = org.name

    return PublicReferralInfoOut(
        link_code=str(link.link_code),
        is_active=bool(link.is_active),
        org_name=org_name,
        target_type=link.target_type,
        landing_path=link.landing_path,
    )
