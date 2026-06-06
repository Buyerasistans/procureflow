"""Panel teması override katmanı — tek satırlık singleton settings tablosu."""

from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class PanelThemeSetting(Base):
    __tablename__ = "panel_theme_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # Boş JSON nesne = tüm segmentler için kod varsayılanı (panel-colors.ts) kullanılır.
    # Sadece değiştirilen segment alanları saklanır (override-only storage).
    segments_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
