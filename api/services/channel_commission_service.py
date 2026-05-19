"""Channel commission calculation and period reporting service."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from api.core.time import utcnow
from api.models.channel import (
    ChannelReferralEvent,
    ChannelReferralLink,
    ChannelOrganization,
    CommissionContract,
    CommissionLedger,
)

TWOPLACES = Decimal("0.01")
DEFAULT_PARTNER_RATE = Decimal("0.0500")
DEFAULT_SUPPLIER_RATE = Decimal("0.0300")


def _safe_decimal(value: object | None) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _resolve_contract_rates(
    db: Session, org_id: int
) -> tuple[Decimal, Decimal, int | None]:
    contract = (
        db.query(CommissionContract)
        .filter(
            CommissionContract.channel_org_id == org_id,
            CommissionContract.is_active == True,
        )
        .order_by(CommissionContract.valid_from.desc())
        .first()
    )
    if not contract:
        return DEFAULT_PARTNER_RATE, DEFAULT_SUPPLIER_RATE, None

    partner_rate = (
        _safe_decimal(contract.commission_rate_partner) or DEFAULT_PARTNER_RATE
    )
    supplier_rate = (
        _safe_decimal(contract.commission_rate_supplier) or DEFAULT_SUPPLIER_RATE
    )
    return partner_rate, supplier_rate, int(contract.id)


def _resolve_event_rate(
    event: ChannelReferralEvent, partner_rate: Decimal, supplier_rate: Decimal
) -> Decimal:
    event_type = str(event.event_type or "").strip().lower()
    target_scope = str(event.target_scope or "").strip().lower()

    if "partner" in event_type or target_scope == "partner":
        return partner_rate
    if "supplier" in event_type or target_scope == "supplier":
        return supplier_rate
    return supplier_rate


def recalculate_commissions_for_owner(
    db: Session,
    *,
    owner_user_id: int,
    period_days: int,
) -> dict[str, int]:
    since = utcnow() - timedelta(days=max(1, min(period_days, 365)))

    rows = (
        db.query(ChannelReferralEvent, ChannelReferralLink.owner_user_id)
        .join(
            ChannelReferralLink,
            ChannelReferralLink.id == ChannelReferralEvent.referral_link_id,
        )
        .filter(
            ChannelReferralLink.owner_user_id == owner_user_id,
            ChannelReferralEvent.occurred_at >= since,
        )
        .order_by(ChannelReferralEvent.occurred_at.asc())
        .all()
    )

    org = (
        db.query(ChannelOrganization)
        .filter(ChannelOrganization.account_owner_user_id == owner_user_id)
        .first()
    )
    if not org:
        return {
            "generated_entries": 0,
            "skipped_existing": 0,
            "skipped_missing_amount": 0,
            "skipped_missing_contract": 0,
        }

    org_id = int(org.id)
    partner_rate, supplier_rate, contract_id = _resolve_contract_rates(db, org_id)

    generated = 0
    skipped_existing = 0
    skipped_amount = 0
    skipped_missing_contract = 0

    for event, _owner_id in rows:
        exists = (
            db.query(CommissionLedger.id)
            .filter(
                CommissionLedger.reference_type == "channel_referral_event",
                CommissionLedger.reference_id == int(event.id),
            )
            .first()
        )
        if exists:
            skipped_existing += 1
            continue

        amount_base = _safe_decimal(event.amount_base)
        if amount_base <= 0:
            skipped_amount += 1
            continue

        rate = _resolve_event_rate(event, partner_rate, supplier_rate)
        if contract_id is None:
            skipped_missing_contract += 1
            continue

        amount = (amount_base * rate).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

        occurred_at = event.occurred_at or utcnow()
        period_key = occurred_at.strftime("%Y-%m")

        entry = CommissionLedger(
            contract_id=contract_id,
            channel_org_id=org_id,
            event_type="partner_signup" if rate == partner_rate else "supplier_signup",
            reference_id=int(event.id),
            reference_type="channel_referral_event",
            amount=amount,
            currency="TRY",
            status="pending",
            note=f"auto: referral_event_id={event.id}",
            created_at=occurred_at,
        )
        # Keep period key in note for now, since current model has no dedicated column.
        entry.note = f"{entry.note}; period={period_key}"
        db.add(entry)
        generated += 1

    if generated > 0:
        db.commit()

    return {
        "generated_entries": generated,
        "skipped_existing": skipped_existing,
        "skipped_missing_amount": skipped_amount,
        "skipped_missing_contract": skipped_missing_contract,
    }


def build_commission_report_for_owner(
    db: Session,
    *,
    owner_user_id: int,
    period_days: int,
) -> dict[str, object]:
    since = utcnow() - timedelta(days=max(1, min(period_days, 365)))

    org = (
        db.query(ChannelOrganization)
        .filter(ChannelOrganization.account_owner_user_id == owner_user_id)
        .first()
    )
    if not org:
        return {
            "period": f"{period_days}d",
            "totals": {"pending": 0.0, "approved": 0.0, "paid": 0.0, "net": 0.0},
            "by_event_type": [],
            "daily_trend": [],
            "entry_count": 0,
        }

    org_id = int(org.id)

    entries = (
        db.query(CommissionLedger)
        .filter(
            CommissionLedger.channel_org_id == org_id,
            CommissionLedger.created_at >= since,
        )
        .order_by(CommissionLedger.created_at.asc())
        .all()
    )

    totals = {"pending": Decimal("0"), "approved": Decimal("0"), "paid": Decimal("0")}
    by_event_type: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    daily_trend: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for entry in entries:
        status_key = str(entry.status or "pending").strip().lower()
        amount = _safe_decimal(entry.amount)
        if status_key in totals:
            totals[status_key] += amount
        if status_key in {"approved", "paid"}:
            day_key = (entry.created_at or utcnow()).strftime("%Y-%m-%d")
            daily_trend[day_key] += amount

        event_key = str(entry.event_type or "unknown").strip().lower() or "unknown"
        by_event_type[event_key] += amount

    net = totals["approved"] + totals["paid"]

    return {
        "period": f"{period_days}d",
        "totals": {
            "pending": float(totals["pending"]),
            "approved": float(totals["approved"]),
            "paid": float(totals["paid"]),
            "net": float(net),
        },
        "by_event_type": [
            {"event_type": key, "amount": float(value)}
            for key, value in sorted(by_event_type.items(), key=lambda item: item[0])
        ],
        "daily_trend": [
            {"day": key, "net_amount": float(value)}
            for key, value in sorted(daily_trend.items(), key=lambda item: item[0])
        ],
        "entry_count": len(entries),
    }
