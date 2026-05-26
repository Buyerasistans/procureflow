from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProcurementJobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    category: str | None = None
    employment_type: str = Field(
        default="full_time",
        pattern="^(full_time|part_time|contract|freelance)$",
    )
    location_type: str = Field(
        default="remote",
        pattern="^(remote|onsite|hybrid)$",
    )
    city: str | None = None
    country: str | None = None
    salary_min: Decimal | None = Field(default=None, ge=0)
    salary_max: Decimal | None = Field(default=None, ge=0)
    salary_currency: str = Field(default="TRY", max_length=10)
    salary_period: str = Field(
        default="monthly",
        pattern="^(monthly|annual|daily)$",
    )
    required_skills: list[str] = Field(default_factory=list)
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    status: str = Field(
        default="draft",
        pattern="^(draft|published)$",
    )
    application_deadline: datetime | None = None


class ProcurementJobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    category: str | None = None
    employment_type: str | None = Field(
        default=None,
        pattern="^(full_time|part_time|contract|freelance)$",
    )
    location_type: str | None = Field(
        default=None,
        pattern="^(remote|onsite|hybrid)$",
    )
    city: str | None = None
    country: str | None = None
    salary_min: Decimal | None = Field(default=None, ge=0)
    salary_max: Decimal | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, max_length=10)
    salary_period: str | None = Field(
        default=None,
        pattern="^(monthly|annual|daily)$",
    )
    required_skills: list[str] | None = None
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    status: str | None = Field(
        default=None,
        pattern="^(draft|published|closed|filled)$",
    )
    application_deadline: datetime | None = None


class ProcurementJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int | None
    posted_by_user_id: int
    title: str
    description: str
    category: str | None
    employment_type: str
    location_type: str
    city: str | None
    country: str | None
    salary_min: Decimal | None
    salary_max: Decimal | None
    salary_currency: str
    salary_period: str
    required_skills: list[str] = Field(default_factory=list)
    min_experience_years: int | None
    status: str
    application_deadline: datetime | None
    is_procurement_only: bool
    view_count: int
    application_count: int
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _parse_json_fields(cls, data: object) -> object:
        if hasattr(data, "__dict__"):
            raw = getattr(data, "required_skills_json", None)
            d = {
                **{k: v for k, v in data.__dict__.items() if not k.startswith("_")},
                "required_skills": _safe_parse_list(raw),
            }
            return d
        if isinstance(data, dict):
            data = dict(data)
            data.setdefault(
                "required_skills",
                _safe_parse_list(data.pop("required_skills_json", None)),
            )
        return data


class PaginatedJobsOut(BaseModel):
    total: int
    page: int
    size: int
    items: list[ProcurementJobOut]


def _safe_parse_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []
