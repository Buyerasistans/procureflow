from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class JobApplicationCreate(BaseModel):
    cover_letter: str | None = None


class JobApplicationStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(shortlisted|interview|offered|rejected)$",
    )
    employer_note: str | None = None


class JobApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    applicant_user_id: int
    talent_profile_id: int
    cover_letter: str | None
    status: str
    ai_match_score: int | None
    employer_note: str | None
    reviewed_by_user_id: int | None
    reviewed_at: datetime | None
    applied_at: datetime
    updated_at: datetime
