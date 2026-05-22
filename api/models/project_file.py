from __future__ import annotations

# models/project_file.py
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.project import Project


class ProjectFile(Base):
    __tablename__ = "project_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )

    # File metadata
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Orijinal dosya adı"
    )
    file_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="MIME type veya file extension"
    )
    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Bytes cinsinden"
    )

    # Storage
    file_path: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="Sunucu depolama yolu"
    )

    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="project_files")
