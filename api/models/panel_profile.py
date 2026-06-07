"""Panel rol profilleri — business_role × system_role başına tek profil kaydı."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class PanelProfile(Base):
    __tablename__ = "panel_profiles"
    __table_args__ = (
        UniqueConstraint(
            "business_role", "system_role", name="uq_panel_profile_role"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_role: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    system_role: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # Profil verisi JSON olarak saklı; frontend PdProfile alanlarının tamamını içerir.
    profile_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
