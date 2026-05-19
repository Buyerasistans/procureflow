from datetime import datetime
import sqlalchemy
from sqlalchemy import String, DateTime, Table, ForeignKey
from sqlalchemy import String, DateTime, Table, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base
from api.core.time import utcnow

# Association table for Role-Permission many-to-many relationship
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    sqlalchemy.Column(
        "role_id", sqlalchemy.Integer, ForeignKey("roles.id"), primary_key=True
    ),
    sqlalchemy.Column(
        "permission_id",
        sqlalchemy.Integer,
        ForeignKey("permissions.id"),
        primary_key=True,
    ),
)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), default="general", nullable=False
    )  # global, project, etc
    tooltip: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )

    roles: Mapped[list["Role"]] = relationship(
        secondary="role_permissions", back_populates="permissions"
    )

    def __repr__(self):
        return f"<Permission {self.name}>"


class Role(Base):
    __tablename__ = "roles"

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("roles.id"), nullable=True, index=True
    )
    hierarchy_level: Mapped[int] = mapped_column(default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permissions", back_populates="roles"
    )
    company_roles: Mapped[list["CompanyRole"]] = relationship(
        "CompanyRole", back_populates="role"
    )
    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="roles")

    # Self-referential relationship for role hierarchy
    parent: Mapped["Role | None"] = relationship(
        "Role", remote_side="Role.id", foreign_keys="Role.parent_id", backref="children"
    )

    def __repr__(self):
        return f"<Role {self.name}>"
