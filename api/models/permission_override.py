from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base


class UserPermissionOverride(Base):
    __tablename__ = "user_permission_overrides"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "permission_key", name="uq_user_permission_override"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    permission_key: Mapped[str] = mapped_column(String(120), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    granted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    user: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], back_populates="permission_overrides"
    )
    granted_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[granted_by_user_id]
    )


class RolePermissionDelegation(Base):
    __tablename__ = "role_permission_delegations"
    __table_args__ = (
        UniqueConstraint(
            "system_role",
            "business_role",
            "permission_key",
            name="uq_role_permission_delegation",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    system_role: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    business_role: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )
    permission_key: Mapped[str] = mapped_column(String(120), nullable=False)
    can_delegate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    created_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[created_by_user_id]
    )
