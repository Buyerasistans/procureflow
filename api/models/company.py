from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base
from api.models.associations import user_company, company_department
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.department import Department
    from api.models.project import Project
    from api.models.tenant import Tenant
    from api.models.user import User


class Company(Base):
    __tablename__ = "companies"

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_companies_tenant_name"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#3b82f6", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tax_office: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trade_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_info: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hide_location: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_on_whatsapp: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    mailbox_team_visibility_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(back_populates="companies")
    users: Mapped[list["User"]] = relationship(
        secondary=user_company, back_populates="companies"
    )
    departments: Mapped[list["Department"]] = relationship(
        secondary=company_department, back_populates="companies"
    )
    projects: Mapped[list["Project"]] = relationship(back_populates="company")
