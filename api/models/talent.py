"""
Talent Network + Procurement Jobs ekosistemi modelleri.

Module A — Procurement Talent Network (Katkı ile Kazan):
  TalentProfile, ReferralTask, ReferralSubmission, EarningsLedger,
  PayoutRequest, ReputationEvent

Module B — Procurement Jobs (Kariyer Pazarı):
  ProcurementJob, JobApplication
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.user import User
    from api.models.tenant import Tenant


# ---------------------------------------------------------------------------
# TalentProfile — bağımsız satınalma uzmanının profili
# ---------------------------------------------------------------------------


class TalentProfile(Base):
    __tablename__ = "talent_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    # Kimlik / Müsaitlik
    availability: Mapped[str] = mapped_column(
        String(30),
        default="not_available",
        nullable=False,
        comment="full_time | part_time | freelance | not_available",
    )
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Uzmanlık (JSON dizisi)
    skills_json: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment='["satınalma","tedarik","kategori yönetimi"]'
    )
    category_expertise_json: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment='["hammadde","ambalaj","lojistik"]'
    )

    # KYC / Onay durumu
    kyc_status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        comment="pending | approved | rejected",
    )
    kyc_reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    kyc_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    kyc_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Kazanç / İtibar (snapshot — gerçek değer ledger'dan aggregate edilir)
    reputation_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_earned: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    total_paid_out: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Profil herkese görünür mü"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    kyc_reviewer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[kyc_reviewed_by_user_id]
    )
    job_applications: Mapped[list["JobApplication"]] = relationship(
        "JobApplication", back_populates="talent_profile", cascade="all, delete-orphan"
    )
    referral_submissions: Mapped[list["ReferralSubmission"]] = relationship(
        "ReferralSubmission", back_populates="talent_profile", cascade="all, delete-orphan"
    )
    earnings_ledger: Mapped[list["EarningsLedger"]] = relationship(
        "EarningsLedger", back_populates="talent_profile", cascade="all, delete-orphan"
    )
    payout_requests: Mapped[list["PayoutRequest"]] = relationship(
        "PayoutRequest", back_populates="talent_profile", cascade="all, delete-orphan"
    )
    reputation_events: Mapped[list["ReputationEvent"]] = relationship(
        "ReputationEvent", back_populates="talent_profile", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# ProcurementJob — işveren tenant tarafından yayınlanan ilan
# ---------------------------------------------------------------------------


class ProcurementJob(Base):
    __tablename__ = "procurement_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="İşveren tenant — platform geneli ilanlar için NULL",
    )
    posted_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Satınalma rol kategorisi"
    )

    # Çalışma biçimi
    employment_type: Mapped[str] = mapped_column(
        String(30),
        default="full_time",
        nullable=False,
        comment="full_time | part_time | contract | freelance",
    )
    location_type: Mapped[str] = mapped_column(
        String(30),
        default="remote",
        nullable=False,
        comment="remote | onsite | hybrid",
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Maaş aralığı (opsiyonel)
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    salary_currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)
    salary_period: Mapped[str] = mapped_column(
        String(20), default="monthly", nullable=False, comment="monthly | annual | daily"
    )

    # Gereksinimler
    required_skills_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Durum
    status: Mapped[str] = mapped_column(
        String(30),
        default="draft",
        nullable=False,
        comment="draft | published | closed | filled",
    )
    application_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Sadece satınalma ilanı — her zaman True, UI + backend enforce eder
    is_procurement_only: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    application_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship("Tenant", foreign_keys=[tenant_id])
    posted_by: Mapped["User"] = relationship("User", foreign_keys=[posted_by_user_id])
    applications: Mapped[list["JobApplication"]] = relationship(
        "JobApplication", back_populates="job", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# JobApplication — talent → iş başvurusu
# ---------------------------------------------------------------------------


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("job_id", "applicant_user_id", name="uq_job_applicant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("procurement_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    applicant_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    talent_profile_id: Mapped[int] = mapped_column(
        ForeignKey("talent_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pipeline durumu
    status: Mapped[str] = mapped_column(
        String(30),
        default="applied",
        nullable=False,
        comment="applied | shortlisted | interview | offered | rejected | withdrawn",
    )

    # AI eşleşme skoru (placeholder, servis entegrasyonu PHASE 3+)
    ai_match_score: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="0-100 arasında AI eşleşme skoru"
    )

    # Employer notu
    employer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    job: Mapped["ProcurementJob"] = relationship("ProcurementJob", back_populates="applications")
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_user_id])
    talent_profile: Mapped["TalentProfile"] = relationship(
        "TalentProfile", back_populates="job_applications"
    )
    reviewed_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewed_by_user_id]
    )


# ---------------------------------------------------------------------------
# ReferralTask — platform'un yayınladığı mikro görev
# ---------------------------------------------------------------------------


class ReferralTask(Base):
    __tablename__ = "referral_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="supplier_discovery | partner_referral | rfq_enrichment | category_advisory",
    )

    # Ödül
    reward_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    reward_currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)
    reward_type: Mapped[str] = mapped_column(
        String(30),
        default="fixed",
        nullable=False,
        comment="fixed | success_based | bonus",
    )

    # Hedef kategori (opsiyonel)
    target_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    instructions_json: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Görev talimatları JSON"
    )

    # Kapasite ve süre
    max_submissions: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="NULL = sınırsız"
    )
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Durum
    status: Mapped[str] = mapped_column(
        String(30),
        default="active",
        nullable=False,
        comment="active | closed | expired | draft",
    )

    submission_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    submissions: Mapped[list["ReferralSubmission"]] = relationship(
        "ReferralSubmission", back_populates="task", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# ReferralSubmission — talent'ın göreve katkısı
# ---------------------------------------------------------------------------


class ReferralSubmission(Base):
    __tablename__ = "referral_submissions"
    __table_args__ = (
        UniqueConstraint("task_id", "submitter_user_id", name="uq_task_submitter"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey("referral_tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submitter_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    talent_profile_id: Mapped[int] = mapped_column(
        ForeignKey("talent_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Katkı içeriği (görev tipine göre yapılandırılmış JSON)
    submission_content_json: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Görev tipine göre yapılandırılmış katkı verisi"
    )

    # İnceleme
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        comment="pending | approved | rejected | rewarded",
    )
    reviewer_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Onaylanan ödül (task.reward_amount'tan farklı olabilir — success_based durumunda)
    approved_reward: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    task: Mapped["ReferralTask"] = relationship("ReferralTask", back_populates="submissions")
    submitter: Mapped["User"] = relationship("User", foreign_keys=[submitter_user_id])
    talent_profile: Mapped["TalentProfile"] = relationship(
        "TalentProfile", back_populates="referral_submissions"
    )
    reviewer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewer_user_id]
    )


# ---------------------------------------------------------------------------
# EarningsLedger — tüm kazanç/harcama hareketleri (immutable log)
# ---------------------------------------------------------------------------


class EarningsLedger(Base):
    __tablename__ = "earnings_ledger"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    talent_profile_id: Mapped[int] = mapped_column(
        ForeignKey("talent_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Hareket tipi
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="referral_reward | job_placement | bonus | payout | payout_fee | adjustment",
    )

    # Tutar: pozitif = kredi, negatif = borç
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)

    # Hareket sonrası bakiye (snapshot)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Referans
    reference_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="referral_submission | job_application | payout_request | manual",
    )
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Admin hareketi ise kim yaptı
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    talent_profile: Mapped["TalentProfile"] = relationship(
        "TalentProfile", back_populates="earnings_ledger"
    )
    created_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by_user_id]
    )


# ---------------------------------------------------------------------------
# PayoutRequest — talent'ın ödeme talebi
# ---------------------------------------------------------------------------


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    talent_profile_id: Mapped[int] = mapped_column(
        ForeignKey("talent_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="TRY", nullable=False)

    # Ödeme yöntemi
    payment_method: Mapped[str] = mapped_column(
        String(30),
        default="bank_transfer",
        nullable=False,
        comment="bank_transfer | iban",
    )
    # Banka bilgileri maskeli JSON (IBAN son 4 hane görünür)
    bank_details_json: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Hassas banka bilgileri — maskeli saklanır"
    )

    # Durum
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        comment="pending | approved | processing | paid | rejected",
    )
    reviewer_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    talent_profile: Mapped["TalentProfile"] = relationship(
        "TalentProfile", back_populates="payout_requests"
    )
    reviewer: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewer_user_id]
    )


# ---------------------------------------------------------------------------
# ReputationEvent — itibar puanı geçmişi (immutable log)
# ---------------------------------------------------------------------------


class ReputationEvent(Base):
    __tablename__ = "reputation_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    talent_profile_id: Mapped[int] = mapped_column(
        ForeignKey("talent_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="task_completed | task_rejected | job_placed | rating_received | penalty | bonus",
    )

    # Puan değişimi
    score_delta: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Pozitif = artış, negatif = azalış"
    )
    score_after: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Bu event sonrasındaki toplam puan"
    )

    # Referans
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    talent_profile: Mapped["TalentProfile"] = relationship(
        "TalentProfile", back_populates="reputation_events"
    )
