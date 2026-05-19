"""
Channel scope models — iş geliştirme ortakları (acente/broker) için.

Channel: Partner veya tedarikçi getiren, komisyon veya sabit ücret karşılığı
çalışan dış iş geliştirme tarafları.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.user import User


# ---------------------------------------------------------------------------
# ChannelOrganization — channel firması / bireysel acente
# ---------------------------------------------------------------------------


class ChannelOrganization(Base):
    __tablename__ = "channel_organizations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    tax_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Hesap sahibi (account_owner profilli kullanıcı)
    account_owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # İlişkiler
    account_owner: Mapped["User | None"] = relationship(
        "User", foreign_keys=[account_owner_user_id], uselist=False
    )
    members: Mapped[list["ChannelMember"]] = relationship(
        "ChannelMember", back_populates="organization", cascade="all, delete-orphan"
    )
    commission_contracts: Mapped[list["CommissionContract"]] = relationship(
        "CommissionContract", back_populates="channel_organization"
    )
    referrals: Mapped[list["ChannelReferral"]] = relationship(
        "ChannelReferral", back_populates="channel_organization"
    )
    referral_links: Mapped[list["ChannelReferralLink"]] = relationship(
        "ChannelReferralLink",
        primaryjoin="ChannelOrganization.account_owner_user_id == foreign(ChannelReferralLink.owner_user_id)",
        viewonly=True,
    )


# ---------------------------------------------------------------------------
# ChannelMember — channel organizasyonu üyeleri
# ---------------------------------------------------------------------------


class ChannelMember(Base):
    __tablename__ = "channel_members"
    __table_args__ = (
        UniqueConstraint("channel_org_id", "user_id", name="uq_channel_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    channel_org_id: Mapped[int] = mapped_column(
        ForeignKey("channel_organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Profil: channel.account_owner | channel.team_lead | channel.agent | channel.junior_agent
    role_profile_code: Mapped[str] = mapped_column(
        String(100), default="channel.agent", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # İlişkiler
    organization: Mapped["ChannelOrganization"] = relationship(
        "ChannelOrganization", back_populates="members"
    )
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


# ---------------------------------------------------------------------------
# CommissionContract — platform ↔ channel hakediş sözleşmesi
# ---------------------------------------------------------------------------


class CommissionContract(Base):
    __tablename__ = "commission_contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    channel_org_id: Mapped[int] = mapped_column(
        ForeignKey("channel_organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Sözleşme tipi: "commission" | "fixed_per_count"
    contract_type: Mapped[str] = mapped_column(
        String(30), default="commission", nullable=False
    )

    # Komisyon modu (contract_type == "commission")
    commission_rate_partner: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
        comment="Partner getirme komisyonu (örn: 0.0500 = %5)",
    )
    commission_rate_supplier: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4), nullable=True, comment="Tedarikçi getirme komisyonu"
    )

    # Sabit+Sayı modu (contract_type == "fixed_per_count")
    fixed_amount_per_unit: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        nullable=True,
        comment="Hedef sayısı tutulunca ödenecek sabit tutar (TL)",
    )
    target_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Ödemeyi tetikleyen hedefteki adet"
    )
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)

    # Geçerlilik
    valid_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # İlişkiler
    channel_organization: Mapped["ChannelOrganization"] = relationship(
        "ChannelOrganization", back_populates="commission_contracts"
    )
    ledger_entries: Mapped[list["CommissionLedger"]] = relationship(
        "CommissionLedger", back_populates="contract"
    )


# ---------------------------------------------------------------------------
# CommissionLedger — hakediş tahakkuk kayıtları
# ---------------------------------------------------------------------------


class CommissionLedger(Base):
    __tablename__ = "commission_ledger"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contract_id: Mapped[int] = mapped_column(
        ForeignKey("commission_contracts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    channel_org_id: Mapped[int] = mapped_column(
        ForeignKey("channel_organizations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Tetikleyen olay
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="partner_signup | supplier_signup | target_reached | manual_adjustment",
    )
    reference_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="İlgili kayıt id (referral_id, tenant_id vs.)"
    )
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)

    # Ödeme durumu: pending | approved | paid | cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # İlişkiler
    contract: Mapped["CommissionContract"] = relationship(
        "CommissionContract", back_populates="ledger_entries"
    )


# ---------------------------------------------------------------------------
# ChannelReferral — getirilen partner/supplier attribution kaydı
# ---------------------------------------------------------------------------


class ChannelReferral(Base):
    __tablename__ = "channel_referrals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    channel_org_id: Mapped[int] = mapped_column(
        ForeignKey("channel_organizations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    channel_member_id: Mapped[int | None] = mapped_column(
        ForeignKey("channel_members.id", ondelete="SET NULL"), nullable=True
    )

    # Getirilen taraf
    referred_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="partner | supplier"
    )
    referred_tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True
    )
    referred_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Attribution kalıcı — değişmez
    attribution_locked: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    referral_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # İlişkiler
    channel_organization: Mapped["ChannelOrganization"] = relationship(
        "ChannelOrganization", back_populates="referrals"
    )
    channel_member: Mapped["ChannelMember | None"] = relationship(
        "ChannelMember", foreign_keys=[channel_member_id]
    )


class ChannelReferralLink(Base):
    __tablename__ = "channel_referral_links"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    campaign_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    link_code: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    short_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    landing_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_type: Mapped[str] = mapped_column(
        String(30), default="mixed", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_user_id])
    events: Mapped[list["ChannelReferralEvent"]] = relationship(
        "ChannelReferralEvent",
        back_populates="referral_link",
        cascade="all, delete-orphan",
    )


class ChannelReferralEvent(Base):
    __tablename__ = "channel_referral_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    referral_link_id: Mapped[int] = mapped_column(
        ForeignKey("channel_referral_links.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    source_scope: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_scope: Mapped[str | None] = mapped_column(String(30), nullable=True)
    amount_base: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    referral_link: Mapped["ChannelReferralLink"] = relationship(
        "ChannelReferralLink", back_populates="events"
    )
