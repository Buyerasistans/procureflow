from __future__ import annotations

# models/department.py
import re
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy import String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from api.database import Base
from api.models.associations import user_department, company_department
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.company import Company
    from api.models.tenant import Tenant
    from api.models.user import User


class Department(Base):
    __tablename__ = "departments"

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(back_populates="departments")
    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="department",
        foreign_keys="User.department_id",
    )
    companies: Mapped[list["Company"]] = relationship(
        secondary=company_department, back_populates="departments"
    )
    personnel_users: Mapped[list["User"]] = relationship(
        secondary=user_department, back_populates="user_departments"
    )

    @property
    def sub_items(self) -> list[dict[str, int | str]]:
        if not self.description:
            return []

        matches = re.findall(
            r"^-\s*(.+?)(?:\s*\[(?:Aktif|Pasif)\])?$",
            self.description,
            flags=re.MULTILINE,
        )
        return [
            {"id": index + 1, "name": name.strip()}
            for index, name in enumerate(matches)
            if name.strip()
        ]
