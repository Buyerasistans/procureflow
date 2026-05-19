from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.core.authz import can_manage_tenant_governance, can_read_admin_catalog
from api.core.deps import get_current_user, get_db
from api.models.user import User
from api.schemas.campaign import (
    CampaignApplyGrantIn,
    CampaignEventIn,
    CampaignProgramCreate,
    CampaignProgramOut,
    CampaignRewardGrantOut,
)
from api.services.campaign_service import (
    apply_campaign_reward_grant,
    create_campaign_program,
    list_campaign_programs,
    record_campaign_event,
)

router = APIRouter(prefix="/admin/campaigns", tags=["campaigns"])


def require_campaign_reader(current_user: User = Depends(get_current_user)):
    if not can_read_admin_catalog(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu kampanya ekranini goruntuleme yetkiniz yok",
        )
    return current_user


def require_campaign_manager(current_user: User = Depends(get_current_user)):
    if not can_manage_tenant_governance(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu kampanya islemini sadece super admin yapabilir",
        )
    return current_user


@router.get("", response_model=list[CampaignProgramOut])
def get_campaign_programs(
    db: Session = Depends(get_db), _: User = Depends(require_campaign_reader)
):
    return list_campaign_programs(db)


@router.post("", response_model=CampaignProgramOut, status_code=status.HTTP_201_CREATED)
def post_campaign_program(
    payload: CampaignProgramCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_campaign_manager),
):
    return create_campaign_program(
        db,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        audience_type=payload.audience_type,
        trigger_event=payload.trigger_event,
        status=payload.status,
        is_public=payload.is_public,
        rules=[item.model_dump() for item in payload.rules],
    )


@router.post("/events")
def post_campaign_event(
    payload: CampaignEventIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_campaign_manager),
):
    try:
        return record_campaign_event(
            db,
            campaign_id=payload.campaign_id,
            owner_type=payload.owner_type,
            owner_id=payload.owner_id,
            event_type=payload.event_type,
            quantity=payload.quantity,
            source_reference=payload.source_reference,
            metadata_json=payload.metadata_json,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/apply-grant", response_model=CampaignRewardGrantOut)
def post_apply_campaign_grant(
    payload: CampaignApplyGrantIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_campaign_manager),
):
    try:
        return apply_campaign_reward_grant(
            db, grant_id=payload.grant_id, current_user_id=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
