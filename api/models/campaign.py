from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base


class CampaignProgram(Base):
    __tablename__ = "campaign_programs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    audience_type: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="supplier | channel"
    )
    trigger_event: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="supplier_referral_activated | partner_referral_activated",
    )
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    rules: Mapped[list["CampaignRule"]] = relationship(
        "CampaignRule", back_populates="campaign", cascade="all, delete-orphan"
    )
    participants: Mapped[list["CampaignParticipant"]] = relationship(
        "CampaignParticipant", back_populates="campaign", cascade="all, delete-orphan"
    )
    events: Mapped[list["CampaignEvent"]] = relationship(
        "CampaignEvent", back_populates="campaign", cascade="all, delete-orphan"
    )
    grants: Mapped[list["CampaignRewardGrant"]] = relationship(
        "CampaignRewardGrant", back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignRule(Base):
    __tablename__ = "campaign_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaign_programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    threshold_count: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="quote_bonus | project_visibility | special_list_access | strategic_quote_access | permission_override",
    )
    reward_value_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    campaign: Mapped["CampaignProgram"] = relationship(
        "CampaignProgram", back_populates="rules"
    )
    grants: Mapped[list["CampaignRewardGrant"]] = relationship(
        "CampaignRewardGrant", back_populates="rule"
    )


class CampaignParticipant(Base):
    __tablename__ = "campaign_participants"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id", "owner_type", "owner_id", name="uq_campaign_participant"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaign_programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="supplier | supplier_user | channel_org | channel_member | user",
    )
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    progress_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_event_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_evaluated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    campaign: Mapped["CampaignProgram"] = relationship(
        "CampaignProgram", back_populates="participants"
    )


class CampaignEvent(Base):
    __tablename__ = "campaign_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaign_programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_type: Mapped[str] = mapped_column(String(30), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source_reference: Mapped[str | None] = mapped_column(
        String(120), nullable=True, index=True
    )
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    campaign: Mapped["CampaignProgram"] = relationship(
        "CampaignProgram", back_populates="events"
    )


class CampaignRewardGrant(Base):
    __tablename__ = "campaign_reward_grants"
    __table_args__ = (
        UniqueConstraint(
            "campaign_id",
            "rule_id",
            "owner_type",
            "owner_id",
            name="uq_campaign_reward_grant",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaign_programs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_id: Mapped[int] = mapped_column(
        ForeignKey("campaign_rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_type: Mapped[str] = mapped_column(String(30), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reward_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reward_value_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="granted",
        nullable=False,
        comment="granted | applied | cancelled",
    )
    application_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    applied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    campaign: Mapped["CampaignProgram"] = relationship(
        "CampaignProgram", back_populates="grants"
    )
    rule: Mapped["CampaignRule"] = relationship("CampaignRule", back_populates="grants")
