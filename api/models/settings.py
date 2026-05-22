"""Sistem Ayarları"""

from datetime import datetime, UTC
from sqlalchemy import DateTime, String, Text, Boolean, Integer, text
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base


class SystemSettings(Base):
    """Sistem Ayarları (SMTP, Email, vb.)"""

    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # SMTP Ayarları
    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    smtp_from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    smtp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Diğer Ayarlar (gelecek için)
    app_name: Mapped[str] = mapped_column(String(255), default="ProcureFlow")
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    vat_rates_json: Mapped[str] = mapped_column(
        Text, default="[1,10,20]", nullable=False
    )
    public_pricing_json: Mapped[str] = mapped_column(
        Text,
        default='{"strategic_partner":{"plans":[]},"supplier":{"plans":[]}}',
        nullable=False,
    )
    workspace_panels_json: Mapped[str] = mapped_column(
        Text,
        default='{"version":1,"profiles":[]}',
        nullable=False,
    )
    platform_primary_company_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    commercial_request_webhook_url: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    commercial_request_webhook_secret: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Audit
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=datetime.now
    )
    updated_by_id: Mapped[int | None] = mapped_column(nullable=True)
