from __future__ import annotations

# models/project.py
from typing import TYPE_CHECKING
from sqlalchemy import (
    String,
    Boolean,
    Table,
    Column,
    Integer,
    ForeignKey,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from api.database import Base
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.company import Company
    from api.models.project_file import ProjectFile
    from api.models.quote import Quote
    from api.models.supplier import ProjectSupplier
    from api.models.tenant import Tenant
    from api.models.user import User

# Many-to-many relationship between users and projects
user_projects = Table(
    "user_projects",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True),
)


class Project(Base):
    __tablename__ = "projects"

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_projects_tenant_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    budget: Mapped[float] = mapped_column(Float, nullable=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"),
        nullable=True,
        index=True,
        comment="Projenin tenant bagi",
    )
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True, comment="Proje hangi firmaya ait"
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, comment="Projeyi olusturan kullanici"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Location & Contact
    address: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="Proje adresi"
    )
    latitude: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Google Maps lat"
    )
    longitude: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Google Maps lng"
    )

    # Project Type & Manager
    project_type: Mapped[str] = mapped_column(
        String(20),
        default="merkez",
        nullable=False,
        comment="Proje tipi: 'merkez' veya 'franchise'",
    )
    manager_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Proje yetkilisi adı"
    )
    manager_phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="Proje yetkilisi telefon"
    )
    manager_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Proje yetkilisi e-mail"
    )

    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(back_populates="projects")
    company: Mapped["Company"] = relationship(back_populates="projects")
    personnel: Mapped[list["User"]] = relationship(
        secondary=user_projects, back_populates="projects"
    )
    project_files: Mapped[list["ProjectFile"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    quotes: Mapped[list["Quote"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    suppliers: Mapped[list["ProjectSupplier"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
