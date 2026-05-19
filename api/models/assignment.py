# models/assignment.py
"""User assignment models for roles, companies, and projects"""

from __future__ import annotations

from datetime import datetime
import json
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.company import Company
    from api.models.department import Department
    from api.models.project import Project
    from api.models.role import Permission, Role
    from api.models.user import User


class CompanyRole(Base):
    """User's role and department assignment in a specific company"""

    __tablename__ = "company_roles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id"), nullable=True
    )
    sub_items_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="company_roles")
    company: Mapped["Company"] = relationship()
    role: Mapped["Role"] = relationship()
    department: Mapped["Department | None"] = relationship()

    @property
    def sub_items(self) -> list[str]:
        if not self.sub_items_json:
            return []
        try:
            parsed = json.loads(self.sub_items_json)
        except (TypeError, ValueError):
            return []
        if not isinstance(parsed, list):
            return []
        return [str(item).strip() for item in parsed if str(item).strip()]

    def __repr__(self):
        return f"<CompanyRole user_id={self.user_id} company_id={self.company_id} role_id={self.role_id}>"


class ProjectPermission(Base):
    """Project-based permission assignment for a user"""

    __tablename__ = "project_permissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    permission_id: Mapped[int] = mapped_column(
        ForeignKey("permissions.id"), nullable=False
    )
    granted_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )  # Who granted this
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="project_permissions", foreign_keys=[user_id]
    )
    project: Mapped["Project"] = relationship()
    permission: Mapped["Permission"] = relationship()
    # Note: granted_by_user relationship not included to avoid ambiguous FK paths

    def __repr__(self):
        return f"<ProjectPermission user_id={self.user_id} project_id={self.project_id} perm_id={self.permission_id}>"
