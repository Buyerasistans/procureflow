from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class TranslationCacheEntry(Base):
    __tablename__ = "translation_cache_entries"
    __table_args__ = (
        Index(
            "ix_translation_cache_locale_namespace_key",
            "locale",
            "namespace",
            "translation_key",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    locale: Mapped[str] = mapped_column(String(16), nullable=False)
    namespace: Mapped[str] = mapped_column(String(64), nullable=False)
    translation_key: Mapped[str] = mapped_column(String(128), nullable=False)
    translation_value: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
