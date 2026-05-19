"""Tedarikçi (Supplier) ve İlgili Modeller"""

import json
from datetime import datetime, UTC
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.database import Base

if TYPE_CHECKING:
    from api.models.user import User
    from api.models.project import Project
    from api.models.quote import Quote, QuoteItem
    from api.models.tenant import Tenant


class Supplier(Base):
    """Tedarikçi Firma"""

    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id"), nullable=True, index=True
    )
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Firma Bilgileri
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tax_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # İletişim
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Adres
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Fatura Bilgileri
    invoice_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # İş Bilgileri
    tax_office: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # Vergi Dairesi
    reference_score: Mapped[float] = mapped_column(Numeric(3, 1), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., "Yazılım", "Donanım", "Hizmet"
    category_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    partner_category_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # Logo/Amblem URL'si

    # Durum
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=datetime.now
    )

    # İlişkiler
    tenant: Mapped["Tenant | None"] = relationship("Tenant", back_populates="suppliers")
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    users: Mapped[list["SupplierUser"]] = relationship(
        "SupplierUser", back_populates="supplier", cascade="all, delete-orphan"
    )
    quotes: Mapped[list["SupplierQuote"]] = relationship(
        "SupplierQuote", back_populates="supplier", cascade="all, delete-orphan"
    )

    @property
    def source_type(self) -> str:
        return "private" if self.tenant_id is not None else "platform_network"

    @staticmethod
    def _parse_category_tags(raw: str | None) -> list[str]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            return []
        if not isinstance(parsed, list):
            return []
        values: list[str] = []
        seen: set[str] = set()
        for item in parsed:
            normalized = str(item).strip()
            if not normalized:
                continue
            lowered = normalized.casefold()
            if lowered in seen:
                continue
            seen.add(lowered)
            values.append(normalized)
        return values

    @property
    def category_tags(self) -> list[str]:
        return self._parse_category_tags(self.category_tags_json)

    @property
    def partner_category_tags(self) -> list[str]:
        return self._parse_category_tags(self.partner_category_tags_json)

    @property
    def effective_category_tags(self) -> list[str]:
        values: list[str] = []
        seen: set[str] = set()
        for item in [*self.category_tags, *self.partner_category_tags]:
            lowered = item.casefold()
            if lowered in seen:
                continue
            seen.add(lowered)
            values.append(item)
        if self.category:
            normalized = str(self.category).strip()
            if normalized and normalized.casefold() not in seen:
                values.append(normalized)
        return values


class SupplierUser(Base):
    """Tedarikçi Firma Kullanıcısı"""

    __tablename__ = "supplier_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    # Kişi Bilgileri
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    work_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Durum
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    password_set: Mapped[bool] = mapped_column(Boolean, default=False)

    # Magic Link
    magic_token: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    magic_token_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Şifre
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # İlişkiler
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="users")
    supplier_quotes: Mapped[list["SupplierQuote"]] = relationship(
        "SupplierQuote", back_populates="supplier_user"
    )


class SupplierQuote(Base):
    """Tedarikçinin Verdiği Teklif"""

    __tablename__ = "supplier_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    supplier_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("supplier_users.id"), nullable=True
    )

    # Revize Sistemi
    revision_number: Mapped[int] = mapped_column(Integer, default=0)
    revision_of_id: Mapped[int | None] = mapped_column(
        ForeignKey("supplier_quotes.id"), nullable=True
    )
    revision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_revised_version: Mapped[bool] = mapped_column(Boolean, default=False)

    # Durum
    status: Mapped[str] = mapped_column(String(50), default="tasarı")

    # Finansal
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="TRY", server_default=text("'TRY'")
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    final_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    initial_final_amount: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )  # İlk gönderim tutarı (revize öncesi)

    # Karlılık (Profitability)
    profitability_amount: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )  # İlk fiyat - revize fiyat
    profitability_percent: Mapped[float | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )  # Karlılık yüzdesi

    # Puanlama
    score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    score_rank: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "Yıl Birincisi", "Yıl İkincisi", vb.

    # Şartlar
    payment_terms: Mapped[str | None] = mapped_column(String(255), nullable=True)
    delivery_time: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warranty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Zaman
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # İlişkiler
    quote: Mapped["Quote"] = relationship("Quote", back_populates="supplier_quotes")
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="quotes")
    supplier_user: Mapped["SupplierUser | None"] = relationship(
        "SupplierUser", back_populates="supplier_quotes"
    )
    items: Mapped[list["SupplierQuoteItem"]] = relationship(
        "SupplierQuoteItem",
        back_populates="supplier_quote",
        cascade="all, delete-orphan",
    )

    # Revize İlişkisi
    revision_of: Mapped["SupplierQuote | None"] = relationship(
        "SupplierQuote",
        remote_side=[id],
        foreign_keys=[revision_of_id],
        backref="revisions",
    )


class SupplierQuoteItem(Base):
    """Tedarikçi Teklifindeki Satır Kalemi"""

    __tablename__ = "supplier_quote_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_quote_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_quotes.id"), nullable=False
    )
    quote_item_id: Mapped[int] = mapped_column(
        ForeignKey("quote_items.id"), nullable=False
    )

    # Revize Bilgisi
    revision_number: Mapped[int] = mapped_column(Integer, default=0)

    # Tedarikçi Fiyatı - İlk Versiyon (korunur)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    # Revizeler (JSON string olarak saklayabiliriz veya ayrı alan)
    revision_prices: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array: [{"revision_number": 1, "unit_price": 150, "total_price": 1500}, ...]

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # İlişkiler
    supplier_quote: Mapped["SupplierQuote"] = relationship(
        "SupplierQuote", back_populates="items"
    )
    quote_item: Mapped["QuoteItem"] = relationship(
        "QuoteItem", back_populates="supplier_item_prices"
    )


class ProjectSupplier(Base):
    """Proje ↔ Tedarikçi Ilişkisi (Many-to-Many)"""

    __tablename__ = "project_suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    # Yetkilendirme Bilgisi
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=text("CURRENT_TIMESTAMP"),
    )

    # Durum
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    invitation_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    invitation_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Notlar
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # İlişkiler
    project: Mapped["Project"] = relationship("Project", back_populates="suppliers")
    supplier: Mapped["Supplier"] = relationship("Supplier")
    assigned_by: Mapped["User"] = relationship("User", foreign_keys=[assigned_by_id])
