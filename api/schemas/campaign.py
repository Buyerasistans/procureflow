from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CampaignRuleCreate(BaseModel):
    threshold_count: int = Field(..., ge=1)
    reward_type: str
    reward_value_json: str | None = None
    sort_order: int = 0


class CampaignProgramCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=80)
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    audience_type: str
    trigger_event: str
    status: str = "draft"
    is_public: bool = False
    rules: list[CampaignRuleCreate] = Field(default_factory=list)


class CampaignRuleOut(CampaignRuleCreate):
    id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CampaignParticipantOut(BaseModel):
    id: int
    owner_type: str
    owner_id: int
    progress_count: int
    last_event_at: datetime | None = None
    last_evaluated_at: datetime | None = None


class CampaignRewardGrantOut(BaseModel):
    id: int
    campaign_id: int
    rule_id: int
    owner_type: str
    owner_id: int
    reward_type: str
    reward_value_json: str | None = None
    status: str
    application_note: str | None = None
    granted_at: datetime
    applied_at: datetime | None = None


class CampaignProgramOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    audience_type: str
    trigger_event: str
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime
    rules: list[CampaignRuleOut] = Field(default_factory=list)
    participants: list[CampaignParticipantOut] = Field(default_factory=list)
    grants: list[CampaignRewardGrantOut] = Field(default_factory=list)


class CampaignEventIn(BaseModel):
    campaign_id: int
    owner_type: str
    owner_id: int
    event_type: str
    quantity: int = Field(default=1, ge=1)
    source_reference: str | None = None
    metadata_json: str | None = None


class CampaignApplyGrantIn(BaseModel):
    grant_id: int
