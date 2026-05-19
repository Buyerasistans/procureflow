"""Raporlama ve Analiz Modelleri"""

from __future__ import annotations

from sqlalchemy import (
    Text,
    ForeignKey,
    Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from api.database import Base
from api.core.time import utcnow

if TYPE_CHECKING:
    from api.models.quote import Quote
    from api.models.supplier import Supplier, SupplierQuote
    from api.models.user import User


class QuoteComparison(Base):
    """Teklifler karşılaştırması ve raporlama"""

    __tablename__ = "quote_comparisons"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), index=True)
    comparison_type: Mapped[str]  # "price", "delivery", "overall"
    metric_name: Mapped[str]  # "min_price", "max_price", "avg_price", etc
    metric_value: Mapped[float]
    winner_supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id")
    )

    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    # Relationships
    quote: Mapped["Quote"] = relationship("Quote", foreign_keys=[quote_id])
    winner_supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", foreign_keys=[winner_supplier_id]
    )


class SupplierRating(Base):
    """Tedarikçi değerlendirmesi ve puanlaması"""

    __tablename__ = "supplier_ratings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), index=True)
    rated_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Puanlama kriterleri (1-5)
    price_rating: Mapped[int]  # Fiyat puanı
    delivery_rating: Mapped[int]  # Teslimat puanı
    quality_rating: Mapped[int]  # Kalite puanı
    communication_rating: Mapped[int]  # İletişim puanı
    overall_rating: Mapped[float]  # Genel puan (ortalama)

    comment: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])
    quote: Mapped["Quote"] = relationship("Quote", foreign_keys=[quote_id])
    rated_by: Mapped["User"] = relationship("User", foreign_keys=[rated_by_id])


class PriceAnalysis(Base):
    """Fiyat analiz raporu"""

    __tablename__ = "price_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), index=True)

    min_price: Mapped[Numeric] = mapped_column(Numeric(12, 2))
    max_price: Mapped[Numeric] = mapped_column(Numeric(12, 2))
    avg_price: Mapped[Numeric] = mapped_column(Numeric(12, 2))
    median_price: Mapped[Numeric] = mapped_column(Numeric(12, 2))
    price_variance: Mapped[float]  # Fiyat farkı yüzdesi

    cheapest_supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id")
    )
    most_expensive_supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id")
    )

    total_responses: Mapped[int]  # Toplam yanıt sayısı
    submitted_responses: Mapped[int]  # Gönderilen yanıt sayısı

    analysis_date: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    # Relationships
    quote: Mapped["Quote"] = relationship("Quote", foreign_keys=[quote_id])
    cheapest_supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", foreign_keys=[cheapest_supplier_id]
    )
    most_expensive_supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", foreign_keys=[most_expensive_supplier_id]
    )


class Contract(Base):
    """Üretilen sözleşmeler"""

    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id"), index=True)
    supplier_quote_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_quotes.id"), index=True
    )
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)

    contract_type: Mapped[str]  # "standard", "custom"
    contract_number: Mapped[str]  # Sözleşme numarası (benzersiz)

    total_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2))
    discount_percent: Mapped[Optional[float]]
    final_amount: Mapped[Numeric] = mapped_column(Numeric(12, 2))

    payment_terms: Mapped[Optional[str]]  # Ödeme koşulları
    delivery_date: Mapped[Optional[datetime]]  # Teslimat tarihi
    warranty_period: Mapped[Optional[str]]  # Garanti süresi

    status: Mapped[str] = mapped_column(
        default="draft"
    )  # draft, generated, signed, completed, cancelled
    pdf_file_path: Mapped[Optional[str]]  # PDF dosya yolu

    signed_at: Mapped[Optional[datetime]]
    signed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    notes: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    # Relationships
    quote: Mapped["Quote"] = relationship("Quote", foreign_keys=[quote_id])
    supplier_quote: Mapped["SupplierQuote"] = relationship(
        "SupplierQuote", foreign_keys=[supplier_quote_id]
    )
    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])
    signed_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[signed_by_id]
    )
