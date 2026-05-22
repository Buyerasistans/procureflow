from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.core.deps import get_db
from api.models.public_telemetry import PublicTelemetryEvent

router = APIRouter(prefix="/public", tags=["public-telemetry"])

KNOWN_INTENTS = {"corporate", "global", "campaign", "knowledge"}


class PublicTelemetryIn(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    path: str = Field(..., min_length=1, max_length=255)
    intent: str = Field(default="corporate", max_length=50)
    event_type: str = Field(..., min_length=1, max_length=50)
    event_name: str | None = Field(default=None, max_length=255)
    referrer: str | None = Field(default=None, max_length=500)
    query_string: str | None = Field(default=None, max_length=500)
    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=100)
    metadata: dict[str, str | int | float | bool | None] | None = None


def _clean_host(raw: str) -> str:
    host = (raw or "").strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    return host or "buyerasistans.com.tr"


@router.post("/telemetry", status_code=status.HTTP_202_ACCEPTED)
def post_public_telemetry(
    payload: PublicTelemetryIn,
    request: Request,
    db: Session = Depends(get_db),
):
    event = PublicTelemetryEvent(
        host=_clean_host(payload.host or request.headers.get("host") or ""),
        path=(payload.path or "/")[:255],
        intent=payload.intent if payload.intent in KNOWN_INTENTS else "corporate",
        event_type=(payload.event_type or "unknown")[:50],
        event_name=payload.event_name,
        referrer=payload.referrer,
        query_string=payload.query_string,
        utm_source=payload.utm_source,
        utm_medium=payload.utm_medium,
        utm_campaign=payload.utm_campaign,
        metadata_json=json.dumps(payload.metadata or {}, ensure_ascii=True),
    )
    db.add(event)
    db.commit()
    return {"accepted": True}
