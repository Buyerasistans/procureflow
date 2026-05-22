# api/models/quote.py
from datetime import datetime, UTC
import enum
from typing import TYPE_CHECKING, ClassVar

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
    Enum as SQLEnum,
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base

if TYPE_CHECKING:
    from api.models.project import Project
    from api.models.tenant import Tenant
    from api.models.user import User
    from api.models.supplier import SupplierQuote, SupplierQuoteItem
    from api.models.quote_approval import QuoteApproval


class QuoteStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING = "pending"
    RESPONDED = "responded"
    APPROVED = "approved"
    REJECTED = "rejected"


class Quote(Base):
    """Teklif İsteği (RFQ)"""

    # RFQ gecisi sirasinda bu alanlar compatibility mirror olarak tutuluyor.
    LEGACY_MIRROR_COLUMNS: ClassVar[tuple[str, ...]] = (
        "user_id",
        "amount",
        "created_by",
        "updated_by",
        "deleted_by",
    )
    LEGACY_DROP_READINESS_CHECK_COLUMNS: ClassVar[tuple[str, ...]] = (
        "created_by_id",
        "user_id",
        "total_amount",
        "amount",
        "created_by",
        "updated_by",
        "deleted_by",
    )
    SNAPSHOT_COLUMNS: ClassVar[tuple[str, ...]] = (
        "company_name",
        "company_contact_name",
        "company_contact_phone",
        "company_contact_email",
    )

    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    # Legacy owner mirror; hedef modelde created_by_id tek kaynak olacak.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"), nullable=False, index=True
    )
    # RFQ aggregate icin canonical owner alani.
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Teklif Bilgileri
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[QuoteStatus] = mapped_column(
        SQLEnum(
            QuoteStatus,
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            native_enum=False,
            validate_strings=True,
        ),
        default=QuoteStatus.DRAFT,
    )

    # Firma Bilgileri (RFQ snapshot alanlari; tenant company kaydindan bagimsiz korunur)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    company_contact_email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Finansal (amount legacy mirror, total_amount canonical RFQ toplamidir)
    amount: Mapped[float] = mapped_column(
        Numeric(12, 2), default=0, server_default=text("0")
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="TRL")

    # Versi ve Denetim
    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    transition_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Zaman Bilgileri
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deleted_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Atama
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    assigned_to_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # İlişkiler
    tenant: Mapped["Tenant | None"] = relationship(back_populates="quotes")
    project: Mapped["Project"] = relationship("Project", back_populates="quotes")
    created_by_user: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    items: Mapped[list["QuoteItem"]] = relationship(
        "QuoteItem", back_populates="quote", cascade="all, delete-orphan"
    )
    supplier_quotes: Mapped[list["SupplierQuote"]] = relationship(
        "SupplierQuote", back_populates="quote", cascade="all, delete-orphan"
    )
    approvals: Mapped[list["QuoteApproval"]] = relationship(
        "QuoteApproval", back_populates="quote", cascade="all, delete-orphan"
    )

    @property
    def rfq_id(self) -> int:
        return self.id

    @property
    def canonical_created_by_id(self) -> int:
        return self.created_by_id

    @property
    def canonical_total_amount(self) -> float | None:
        return self.total_amount if self.total_amount is not None else self.amount

    @property
    def company_snapshot(self) -> dict[str, str]:
        return {
            "company_name": self.company_name,
            "company_contact_name": self.company_contact_name,
            "company_contact_phone": self.company_contact_phone,
            "company_contact_email": self.company_contact_email,
        }


def _sync_quote_legacy_columns(target: Quote) -> None:
    if target.user_id is None:
        target.user_id = target.created_by_id

    if target.created_by is None:
        target.created_by = target.created_by_id

    if target.total_amount is None and target.amount is not None:
        target.total_amount = target.amount
    elif target.amount is None and target.total_amount is not None:
        target.amount = target.total_amount
    elif target.amount != target.total_amount:
        target.amount = target.total_amount


@event.listens_for(Quote, "before_insert")
def _quote_before_insert(mapper, connection, target: Quote) -> None:
    _sync_quote_legacy_columns(target)


@event.listens_for(Quote, "before_update")
def _quote_before_update(mapper, connection, target: Quote) -> None:
    _sync_quote_legacy_columns(target)


class QuoteItem(Base):
    """Teklif Kalemi"""

    __tablename__ = "quote_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), nullable=False)

    # Detaylar
    line_number: Mapped[str] = mapped_column(String(50), nullable=False)
    category_code: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    category_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    group_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_group_header: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Birim & Miktar
    unit: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Fiyatlar
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    vat_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=20)
    total_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    # İlişkiler
    quote: Mapped["Quote"] = relationship("Quote", back_populates="items")
    supplier_item_prices: Mapped[list["SupplierQuoteItem"]] = relationship(
        "SupplierQuoteItem", back_populates="quote_item", cascade="all, delete-orphan"
    )
