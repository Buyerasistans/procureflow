from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.billing import (
        BillingInvoice,
        BillingWebhookEvent,
        TenantSubscription,
    )
    from api.models.company import Company
    from api.models.department import Department
    from api.models.email_settings import EmailSettings
    from api.models.project import Project
    from api.models.quote import Quote
    from api.models.role import Role
    from api.models.supplier import Supplier
    from api.models.system_email import SystemEmail
    from api.models.user import User


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(
        String(120), unique=True, nullable=False, index=True
    )
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_category_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_requests_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    tax_office: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    subscription_plan_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    onboarding_status: Mapped[str] = mapped_column(
        String(50), default="draft", nullable=False
    )
    onboarding_payment_status: Mapped[str] = mapped_column(
        String(50), default="not_required", nullable=False
    )
    onboarding_payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    onboarding_payment_reference_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True, index=True
    )
    onboarding_payment_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    onboarding_approval_status: Mapped[str] = mapped_column(
        String(50), default="not_required", nullable=False
    )
    onboarding_rejected_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    onboarding_rejected_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    onboarding_approved_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    onboarding_approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    onboarding_activation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_tracking_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    onboarding_tracking_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    onboarding_decision_timeline_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    support_status: Mapped[str] = mapped_column(
        String(50), default="new", nullable=False
    )
    support_owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_resolution_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_last_contacted_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    settings: Mapped["TenantSettings | None"] = relationship(
        "TenantSettings",
        back_populates="tenant",
        uselist=False,
        cascade="all, delete-orphan",
    )
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="tenant",
        foreign_keys="User.tenant_id",
    )
    owner_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[owner_user_id],
    )
    onboarding_approved_by_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[onboarding_approved_by_user_id],
    )
    onboarding_rejected_by_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[onboarding_rejected_by_user_id],
    )
    companies: Mapped[list["Company"]] = relationship(
        "Company", back_populates="tenant"
    )
    departments: Mapped[list["Department"]] = relationship(
        "Department", back_populates="tenant"
    )
    roles: Mapped[list["Role"]] = relationship("Role", back_populates="tenant")
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="tenant")
    suppliers: Mapped[list["Supplier"]] = relationship(
        "Supplier", foreign_keys="Supplier.tenant_id", back_populates="tenant"
    )
    linked_as_supplier: Mapped["Supplier | None"] = relationship(
        "Supplier",
        foreign_keys="Supplier.linked_tenant_id",
        back_populates="linked_tenant",
        uselist=False,
    )
    quotes: Mapped[list["Quote"]] = relationship("Quote", back_populates="tenant")
    subscriptions: Mapped[list["TenantSubscription"]] = relationship(
        "TenantSubscription", back_populates="tenant", cascade="all, delete-orphan"
    )
    billing_invoices: Mapped[list["BillingInvoice"]] = relationship(
        "BillingInvoice", back_populates="tenant", cascade="all, delete-orphan"
    )
    billing_webhook_events: Mapped[list["BillingWebhookEvent"]] = relationship(
        "BillingWebhookEvent", back_populates="tenant"
    )
    email_settings: Mapped[list["EmailSettings"]] = relationship(
        "EmailSettings", back_populates="tenant"
    )
    system_emails: Mapped[list["SystemEmail"]] = relationship(
        "SystemEmail", back_populates="tenant"
    )


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, unique=True, index=True
    )
    primary_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    secondary_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    smtp_mode: Mapped[str] = mapped_column(
        String(50), default="platform_default", nullable=False
    )
    default_system_email_id: Mapped[int | None] = mapped_column(
        ForeignKey("system_emails.id"), nullable=True
    )
    custom_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    support_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    locale: Mapped[str] = mapped_column(String(20), default="tr-TR", nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(100), default="Europe/Istanbul", nullable=False
    )
    quote_terms_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    approval_policy_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="settings")
