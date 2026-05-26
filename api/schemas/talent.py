from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TalentProfileCreate(BaseModel):
    availability: str = Field(
        default="not_available",
        pattern="^(full_time|part_time|freelance|not_available)$",
    )
    experience_years: int | None = Field(default=None, ge=0, le=60)
    linkedin_url: str | None = None
    bio: str | None = None
    skills: list[str] = Field(default_factory=list)
    category_expertise: list[str] = Field(default_factory=list)
    is_public: bool = False


class TalentProfileUpdate(BaseModel):
    availability: str | None = Field(
        default=None,
        pattern="^(full_time|part_time|freelance|not_available)$",
    )
    experience_years: int | None = Field(default=None, ge=0, le=60)
    linkedin_url: str | None = None
    bio: str | None = None
    skills: list[str] | None = None
    category_expertise: list[str] | None = None
    is_public: bool | None = None


class TalentProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    availability: str
    experience_years: int | None
    linkedin_url: str | None
    bio: str | None
    skills: list[str] = Field(default_factory=list)
    category_expertise: list[str] = Field(default_factory=list)
    kyc_status: str
    reputation_score: int
    total_earned: Decimal
    total_paid_out: Decimal
    is_active: bool
    is_public: bool
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _parse_json_fields(cls, data: object) -> object:
        if hasattr(data, "__dict__"):
            skills_raw = getattr(data, "skills_json", None)
            cat_raw = getattr(data, "category_expertise_json", None)
            d = {
                **{k: v for k, v in data.__dict__.items() if not k.startswith("_")},
                "skills": _safe_parse_list(skills_raw),
                "category_expertise": _safe_parse_list(cat_raw),
            }
            return d
        if isinstance(data, dict):
            data = dict(data)
            data.setdefault("skills", _safe_parse_list(data.pop("skills_json", None)))
            data.setdefault(
                "category_expertise",
                _safe_parse_list(data.pop("category_expertise_json", None)),
            )
        return data


class TalentKycStatusUpdate(BaseModel):
    kyc_status: str = Field(pattern="^(approved|rejected|pending)$")
    kyc_notes: str | None = None


class PaginatedTalentProfilesOut(BaseModel):
    total: int
    page: int
    size: int
    items: list[TalentProfileOut]


def _safe_parse_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []
