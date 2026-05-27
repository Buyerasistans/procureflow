from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReferralTaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    task_type: str = Field(
        pattern="^(supplier_discovery|partner_referral|rfq_enrichment|category_advisory)$",
    )
    reward_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    reward_currency: str = Field(default="TRY", max_length=10)
    reward_type: str = Field(
        default="fixed",
        pattern="^(fixed|success_based|bonus)$",
    )
    target_category: str | None = None
    instructions: dict | list | None = None
    max_submissions: int | None = Field(default=None, ge=1)
    deadline: datetime | None = None
    status: str = Field(
        default="active",
        pattern="^(active|draft)$",
    )


class ReferralTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_user_id: int
    title: str
    description: str
    task_type: str
    reward_amount: Decimal
    reward_currency: str
    reward_type: str
    target_category: str | None
    instructions: dict | list | None = None
    max_submissions: int | None
    deadline: datetime | None
    status: str
    submission_count: int
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _parse_instructions(cls, data: object) -> object:
        if hasattr(data, "__dict__"):
            raw = getattr(data, "instructions_json", None)
            d = {
                **{k: v for k, v in data.__dict__.items() if not k.startswith("_")},
                "instructions": _safe_parse_json(raw),
            }
            return d
        if isinstance(data, dict):
            data = dict(data)
            data.setdefault("instructions", _safe_parse_json(data.pop("instructions_json", None)))
        return data


class ReferralSubmissionCreate(BaseModel):
    submission_content: dict | list = Field(
        description="Görev tipine göre yapılandırılmış katkı verisi"
    )


class ReferralSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    submitter_user_id: int
    talent_profile_id: int
    submission_content: dict | list | None = None
    status: str
    reviewer_user_id: int | None
    reviewed_at: datetime | None
    review_note: str | None
    approved_reward: Decimal | None
    submitted_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _parse_content(cls, data: object) -> object:
        if hasattr(data, "__dict__"):
            raw = getattr(data, "submission_content_json", None)
            d = {
                **{k: v for k, v in data.__dict__.items() if not k.startswith("_")},
                "submission_content": _safe_parse_json(raw),
            }
            return d
        if isinstance(data, dict):
            data = dict(data)
            data.setdefault(
                "submission_content",
                _safe_parse_json(data.pop("submission_content_json", None)),
            )
        return data


class PaginatedTasksOut(BaseModel):
    total: int
    page: int
    size: int
    items: list[ReferralTaskOut]


def _safe_parse_json(raw: str | None) -> dict | list | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
