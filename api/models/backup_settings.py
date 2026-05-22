"""Backup Configuration Model"""

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base


class BackupSettings(Base):
    __tablename__ = "backup_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Backup scheduling
    enable_automatic_backup: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    backup_frequency: Mapped[str] = mapped_column(
        String(50), default="daily", nullable=False
    )
    # VALUES: hourly, every_2_hours, daily, weekly, monthly

    backup_time: Mapped[str] = mapped_column(
        String(5), default="02:00", nullable=False
    )  # HH:MM

    # Backup location
    backup_location: Mapped[str] = mapped_column(String(500), nullable=True)

    # Retention
    keep_last_n_backups: Mapped[int] = mapped_column(default=5, nullable=False)

    # Compression
    compress_backups: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Encryption
    encrypt_backups: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    encryption_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Last backup info
    last_backup_at: Mapped[str | None] = mapped_column(String(100), nullable=True)

    class Config:
        from_attributes = True
