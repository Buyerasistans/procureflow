from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.time import utcnow
from api.database import Base


class OrgCatalogRequest(Base):
    __tablename__ = "org_catalog_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    requested_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    review_status: Mapped[str] = mapped_column(
        String(30), default="pending_review", nullable=False, index=True
    )
    proposed_name: Mapped[str] = mapped_column(String(255), nullable=False)
    proposed_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_parent_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proposed_permission_ids_json: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

    requested_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[requested_by_user_id]
    )
    reviewed_by: Mapped["User | None"] = relationship(
        "User", foreign_keys=[reviewed_by_user_id]
    )
