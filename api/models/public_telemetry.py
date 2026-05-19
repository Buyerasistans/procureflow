from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class PublicTelemetryEvent(Base):
    __tablename__ = "public_telemetry_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    host: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    intent: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    event_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    query_string: Mapped[str | None] = mapped_column(String(500), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    utm_medium: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    utm_campaign: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
