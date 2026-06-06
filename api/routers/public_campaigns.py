from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.core.deps import get_db
from api.schemas.campaign import CampaignPublicOut
from api.services.campaign_service import list_public_campaigns

router = APIRouter(prefix="/public/campaigns", tags=["public"])


@router.get("", response_model=list[CampaignPublicOut])
def get_public_campaigns(db: Session = Depends(get_db)):
    return list_public_campaigns(db)
