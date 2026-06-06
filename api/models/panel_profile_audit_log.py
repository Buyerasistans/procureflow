"""Panel profil değişiklik denetim kayıtları."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class PanelProfileAuditLog(Base):
    __tablename__ = "panel_profile_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    changed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_by_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    business_role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    system_role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
