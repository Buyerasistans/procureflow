from __future__ import annotations

import json

from sqlalchemy.orm import Session, selectinload

from api.core.time import utcnow
from api.models.campaign import (
    CampaignEvent,
    CampaignParticipant,
    CampaignProgram,
    CampaignRewardGrant,
    CampaignRule,
)
from api.models.permission_override import UserPermissionOverride


def list_campaign_programs(db: Session) -> list[CampaignProgram]:
    return (
        db.query(CampaignProgram)
        .options(
            selectinload(CampaignProgram.rules),
            selectinload(CampaignProgram.participants),
            selectinload(CampaignProgram.grants),
        )
        .order_by(CampaignProgram.created_at.desc(), CampaignProgram.id.desc())
        .all()
    )


def create_campaign_program(
    db: Session,
    *,
    code: str,
    name: str,
    description: str | None,
    audience_type: str,
    trigger_event: str,
    status: str,
    is_public: bool,
    rules: list[dict],
) -> CampaignProgram:
    program = CampaignProgram(
        code=code.strip().lower(),
        name=name.strip(),
        description=description,
        audience_type=audience_type.strip().lower(),
        trigger_event=trigger_event.strip().lower(),
        status=status.strip().lower(),
        is_public=is_public,
    )
    db.add(program)
    db.flush()
    for item in rules:
        db.add(
            CampaignRule(
                campaign_id=program.id,
                threshold_count=int(item["threshold_count"]),
                reward_type=str(item["reward_type"]).strip().lower(),
                reward_value_json=item.get("reward_value_json"),
                sort_order=int(item.get("sort_order", 0)),
                is_active=True,
            )
        )
    db.commit()
    return (
        db.query(CampaignProgram)
        .options(
            selectinload(CampaignProgram.rules),
            selectinload(CampaignProgram.participants),
            selectinload(CampaignProgram.grants),
        )
        .filter(CampaignProgram.id == program.id)
        .one()
    )


def record_campaign_event(
    db: Session,
    *,
    campaign_id: int,
    owner_type: str,
    owner_id: int,
    event_type: str,
    quantity: int,
    source_reference: str | None,
    metadata_json: str | None,
) -> dict:
    campaign = (
        db.query(CampaignProgram)
        .options(selectinload(CampaignProgram.rules))
        .filter(CampaignProgram.id == campaign_id)
        .first()
    )
    if not campaign:
        raise ValueError("Kampanya bulunamadi")
    if campaign.status not in {"active", "draft"}:
        raise ValueError("Bu kampanya event kabul etmiyor")
    if campaign.trigger_event != event_type.strip().lower():
        raise ValueError("Event tipi kampanya tetikleyicisi ile uyusmuyor")

    now = utcnow()
    event = CampaignEvent(
        campaign_id=campaign.id,
        owner_type=owner_type.strip().lower(),
        owner_id=owner_id,
        event_type=event_type.strip().lower(),
        quantity=quantity,
        source_reference=source_reference,
        metadata_json=metadata_json,
        created_at=now,
    )
    db.add(event)

    participant = (
        db.query(CampaignParticipant)
        .filter(
            CampaignParticipant.campaign_id == campaign.id,
            CampaignParticipant.owner_type == owner_type.strip().lower(),
            CampaignParticipant.owner_id == owner_id,
        )
        .first()
    )
    if not participant:
        participant = CampaignParticipant(
            campaign_id=campaign.id,
            owner_type=owner_type.strip().lower(),
            owner_id=owner_id,
            progress_count=0,
        )
        db.add(participant)
        db.flush()

    participant.progress_count += quantity
    participant.last_event_at = now
    participant.last_evaluated_at = now

    granted_ids: list[int] = []
    active_rules = sorted(
        [rule for rule in campaign.rules if rule.is_active],
        key=lambda rule: (rule.threshold_count, rule.sort_order, rule.id),
    )
    for rule in active_rules:
        if participant.progress_count < rule.threshold_count:
            continue
        existing = (
            db.query(CampaignRewardGrant)
            .filter(
                CampaignRewardGrant.campaign_id == campaign.id,
                CampaignRewardGrant.rule_id == rule.id,
                CampaignRewardGrant.owner_type == participant.owner_type,
                CampaignRewardGrant.owner_id == participant.owner_id,
            )
            .first()
        )
        if existing:
            continue
        grant = CampaignRewardGrant(
            campaign_id=campaign.id,
            rule_id=rule.id,
            owner_type=participant.owner_type,
            owner_id=participant.owner_id,
            reward_type=rule.reward_type,
            reward_value_json=rule.reward_value_json,
            status="granted",
            granted_at=now,
        )
        db.add(grant)
        db.flush()
        granted_ids.append(grant.id)

    db.commit()
    return {
        "campaign_id": campaign.id,
        "owner_type": participant.owner_type,
        "owner_id": participant.owner_id,
        "progress_count": participant.progress_count,
        "new_grant_ids": granted_ids,
    }


def apply_campaign_reward_grant(
    db: Session, *, grant_id: int, current_user_id: int | None
) -> CampaignRewardGrant:
    grant = (
        db.query(CampaignRewardGrant).filter(CampaignRewardGrant.id == grant_id).first()
    )
    if not grant:
        raise ValueError("Odul kaydi bulunamadi")
    if grant.status == "applied":
        return grant

    note = "Reward kaydi uygulandi"
    if grant.reward_type == "permission_override" and grant.owner_type == "user":
        payload = json.loads(grant.reward_value_json or "{}")
        items = payload.get("items", [])
        for item in items:
            existing = (
                db.query(UserPermissionOverride)
                .filter(
                    UserPermissionOverride.user_id == grant.owner_id,
                    UserPermissionOverride.permission_key
                    == str(item.get("permission_key", "")).strip().lower(),
                )
                .first()
            )
            if existing:
                existing.allowed = bool(item.get("allowed", True))
                existing.granted_by_user_id = current_user_id
            else:
                db.add(
                    UserPermissionOverride(
                        user_id=grant.owner_id,
                        permission_key=str(item.get("permission_key", ""))
                        .strip()
                        .lower(),
                        allowed=bool(item.get("allowed", True)),
                        granted_by_user_id=current_user_id,
                    )
                )
        note = "Permission override odulu uygulandi"
    elif grant.reward_type in {
        "quote_bonus",
        "project_visibility",
        "special_list_access",
        "strategic_quote_access",
    }:
        note = f"{grant.reward_type} odulu icin entitlement kaydi uygulandi"

    grant.status = "applied"
    grant.applied_at = utcnow()
    grant.application_note = note
    db.commit()
    db.refresh(grant)
    return grant
