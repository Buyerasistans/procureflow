"""Support ticket modeli — tenant kullanıcılarının platform personeline ilettiği destek talepleri."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base

if TYPE_CHECKING:
    from api.models.tenant import Tenant
    from api.models.user import User


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # İlişkiler
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_to_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    # Ticket içeriği
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sınıflandırma
    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=False,
        comment="billing | onboarding | technical | account | general",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="medium",
        nullable=False,
        comment="low | medium | high | urgent",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="open",
        nullable=False,
        comment="open | in_progress | waiting_response | resolved | closed",
    )

    # Kaynak: kim/neden açtı
    source: Mapped[str] = mapped_column(
        String(50),
        default="tenant_portal",
        nullable=False,
        comment="tenant_portal | platform_ops | post_activation | help_center",
    )

    # Platform notları
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SLA
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Görünürlük
    is_visible_to_tenant: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", foreign_keys=[tenant_id])
    created_by_user: Mapped["User"] = relationship(
        "User", foreign_keys=[created_by_user_id]
    )
    assigned_to_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[assigned_to_user_id]
    )
