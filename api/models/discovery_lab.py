from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base


class DiscoveryLabSession(Base):
    __tablename__ = "discovery_lab_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="analyzed", nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    created_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    selected_project_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    selected_project_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False)
    ai_report_json: Mapped[str] = mapped_column(Text, nullable=False)
    bom_json: Mapped[str] = mapped_column(Text, nullable=False)
    procurement_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    procurement_quote_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    events: Mapped[list["DiscoveryLabEvent"]] = relationship(
        "DiscoveryLabEvent", back_populates="session", cascade="all, delete-orphan"
    )
    answer_audits: Mapped[list["DiscoveryLabAnswerAudit"]] = relationship(
        "DiscoveryLabAnswerAudit",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class DiscoveryLabEvent(Base):
    __tablename__ = "discovery_lab_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_ref_id: Mapped[int] = mapped_column(
        ForeignKey("discovery_lab_sessions.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_key: Mapped[str] = mapped_column(String(255), nullable=False)
    decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    session: Mapped[DiscoveryLabSession] = relationship(
        "DiscoveryLabSession", back_populates="events"
    )


class DiscoveryLabAnswerAudit(Base):
    __tablename__ = "discovery_lab_answer_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_ref_id: Mapped[int] = mapped_column(
        ForeignKey("discovery_lab_sessions.id"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    question_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    decision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    created_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    session: Mapped[DiscoveryLabSession] = relationship(
        "DiscoveryLabSession", back_populates="answer_audits"
    )
