"""Quote Service - Teklif ve revize yönetimi"""

import json
from datetime import datetime, UTC
from typing import Any
from sqlalchemy.orm import Session

from api.models import Quote, SupplierQuote, SupplierQuoteItem


class QuoteService:
    """Teklif (Quote) ve revize işlemleri"""

    @staticmethod
    def _supplier_quote_matches_quote_scope(
        quote: Quote,
        supplier_quote: SupplierQuote,
    ) -> bool:
        if supplier_quote.quote_id != quote.id:
            return False

        parent_quote = getattr(supplier_quote, "quote", None)
        if parent_quote is not None and parent_quote.id != quote.id:
            return False

        if quote.tenant_id is None:
            return True

        if parent_quote is not None and parent_quote.tenant_id not in (
            None,
            quote.tenant_id,
        ):
            return False

        supplier = getattr(supplier_quote, "supplier", None)
        if supplier is not None and supplier.tenant_id not in (None, quote.tenant_id):
            return False

        return True

    @staticmethod
    def _get_supplier_quote_for_quote(
        db: Session,
        quote: Quote,
        supplier_quote_id: int,
    ) -> SupplierQuote | None:
        supplier_quote = (
            db.query(SupplierQuote)
            .filter(
                SupplierQuote.id == supplier_quote_id,
                SupplierQuote.quote_id == quote.id,
            )
            .first()
        )
        if (
            supplier_quote is not None
            and not QuoteService._supplier_quote_matches_quote_scope(
                quote,
                supplier_quote,
            )
        ):
            return None
        return supplier_quote

    @staticmethod
    def request_quote_revision(
        db: Session,
        quote: Quote,
        supplier_quote_id: int,
        reason: str,
        current_user_id: int,
    ) -> dict:
        """
        Tedarikçiden revize teklif isteme

        Args:
            db: Database session
            supplier_quote_id: Revize istenen teklifin ID'si
            reason: Revize nedeni
            current_user_id: İstek yapan kullanıcı

        Returns:
            {"status": "success", "message": "..."}
        """
        supplier_quote = QuoteService._get_supplier_quote_for_quote(
            db,
            quote,
            supplier_quote_id,
        )

        if not supplier_quote:
            return {"status": "error", "message": "Teklif bulunamadı"}

        # Durumu "revize_edildi" olarak güncelle
        supplier_quote.status = "revize_edildi"
        supplier_quote.updated_at = datetime.now(UTC)

        # Notlara revize nedenini ekle
        if supplier_quote.notes:
            supplier_quote.notes += f"\n---\nRevize istendi: {reason}"
        else:
            supplier_quote.notes = f"Revize istendi: {reason}"

        db.commit()

        return {
            "status": "success",
            "message": "Tedarikçiden revize teklif istendi",
            "quote_id": supplier_quote.quote_id,
        }

    @staticmethod
    def submit_revised_quote(
        db: Session,
        quote: Quote,
        original_supplier_quote_id: int,
        revised_prices: list[
            dict
        ],  # [{"quote_item_id": 1, "unit_price": 150, "total_price": 1500}, ...]
        current_user_id: int,
    ) -> dict:
        """
        Tedarikçi tarafından revize teklifin gönderilmesi

        Args:
            db: Database session
            original_supplier_quote_id: Orijinal teklifin ID'si
            revised_prices: Revize edilmiş fiyatlar
            current_user_id: Tedarikçi kullanıcısı

        Returns:
            {"status": "success", "new_supplier_quote_id": ..., "profitability": {...}}
        """
        original_quote = QuoteService._get_supplier_quote_for_quote(
            db,
            quote,
            original_supplier_quote_id,
        )

        if not original_quote:
            return {"status": "error", "message": "Orijinal teklif bulunamadı"}

        # Yeni revision objesi oluştur
        new_revision = SupplierQuote(
            quote_id=original_quote.quote_id,
            supplier_id=original_quote.supplier_id,
            supplier_user_id=original_quote.supplier_user_id,
            revision_number=original_quote.revision_number + 1,
            revision_of_id=original_quote.id,
            is_revised_version=True,
            status="gönderildi",
            submitted_at=datetime.now(UTC),
        )

        db.add(new_revision)
        db.flush()  # ID'yi almak için

        # Revize edilen fiyatları ve karlılığı hesapla
        total_profitability = 0.0
        new_total_amount = 0.0

        for revised_item in revised_prices:
            quote_item_id = revised_item.get("quote_item_id")
            new_unit_price_raw = revised_item.get("unit_price")
            new_total_price_raw = revised_item.get("total_price")

            if (
                quote_item_id is None
                or new_unit_price_raw is None
                or new_total_price_raw is None
            ):
                continue

            new_unit_price = float(new_unit_price_raw)
            new_total_price = float(new_total_price_raw)

            # Orijinal fiyatı bul
            original_item = (
                db.query(SupplierQuoteItem)
                .filter(
                    SupplierQuoteItem.supplier_quote_id == original_quote.id,
                    SupplierQuoteItem.quote_item_id == quote_item_id,
                )
                .first()
            )
            if original_item:
                original_total_price = original_item.total_price

                # Profitability = orijinal - revize (tasarruf)
                item_profitability = float(original_total_price) - new_total_price
                total_profitability += item_profitability

                # Revize fiyatları kaydı oluştur (JSON formatında)
                revision_prices_list = []
                if original_item.revision_prices:
                    revision_prices_list = json.loads(original_item.revision_prices)

                revision_prices_list.append(
                    {
                        "revision_number": new_revision.revision_number,
                        "unit_price": new_unit_price,
                        "total_price": new_total_price,
                    }
                )

                original_item.revision_prices = json.dumps(revision_prices_list)

            # Yeni revision için item oluştur (ilk fiyatları saklı tutt)
            new_item = SupplierQuoteItem(
                supplier_quote_id=new_revision.id,
                quote_item_id=quote_item_id,
                revision_number=new_revision.revision_number,
                unit_price=new_unit_price,
                total_price=new_total_price,
            )
            db.add(new_item)
            new_total_amount += new_total_price

        # Yeni teklifin totals'ını ayarla
        new_revision.total_amount = new_total_amount
        new_revision.final_amount = new_total_amount

        # Profitability'yi kaydet
        if original_quote.total_amount > 0:
            profitability_percent = (
                total_profitability / float(original_quote.total_amount)
            ) * 100
        else:
            profitability_percent = 0

        new_revision.profitability_amount = total_profitability
        new_revision.profitability_percent = profitability_percent

        db.commit()

        return {
            "status": "success",
            "new_supplier_quote_id": new_revision.id,
            "revision_number": new_revision.revision_number,
            "profitability": {
                "amount": float(total_profitability),
                "percent": float(profitability_percent),
            },
            "message": f"Revizyon {new_revision.revision_number} başarıyla gönderildi",
        }

    @staticmethod
    def get_supplier_quotes_grouped_by_supplier(
        db: Session, quote: Quote
    ) -> list[dict]:
        """
        Bir teklif (Quote) için tedarikçi bazında gruplandırılmış teklifleri getir

        Args:
            db: Database session
            quote_id: Quote ID'si

        Returns:
            [
                {
                    "supplier_id": 1,
                    "supplier_name": "Acme Ltd",
                    "quotes": [
                        {
                            "id": 123,
                            "revision_number": 0,
                            "status": "gönderildi",
                            "total_amount": 10000,
                            "profitability_amount": None,
                            "profitability_percent": None,
                            "revisions": [ ... ]
                        }
                    ]
                }
            ]
        """
        supplier_quotes = (
            db.query(SupplierQuote).filter(SupplierQuote.quote_id == quote.id).all()
        )

        # Tedarikçi bazında grupla
        grouped: dict[int, dict[str, Any]] = {}
        for sq in supplier_quotes:
            if not QuoteService._supplier_quote_matches_quote_scope(quote, sq):
                continue
            supplier_id = sq.supplier_id
            if supplier_id not in grouped:
                grouped[supplier_id] = {
                    "supplier_id": supplier_id,
                    "supplier_name": sq.supplier.company_name,
                    "quotes": [],
                }

            # Revizyon olmayan teklifleri bul (orijinal)
            if not sq.is_revised_version:
                quote_data: dict[str, Any] = {
                    "id": sq.id,
                    "revision_number": sq.revision_number,
                    "status": sq.status,
                    "currency": str(getattr(sq, "currency", "TRY") or "TRY").upper(),
                    "total_amount": float(sq.total_amount),
                    "initial_final_amount": float(
                        getattr(sq, "initial_final_amount", None) or 0
                    ),
                    "submitted_at": sq.submitted_at.isoformat()
                    if sq.submitted_at
                    else None,
                    "profitability_amount": float(sq.profitability_amount)
                    if sq.profitability_amount
                    else None,
                    "profitability_percent": float(sq.profitability_percent)
                    if sq.profitability_percent
                    else None,
                    "items": [
                        {
                            "quote_item_id": item.quote_item_id,
                            "line_number": item.quote_item.line_number
                            if item.quote_item
                            else "",
                            "description": item.quote_item.description
                            if item.quote_item
                            else "",
                            "unit": item.quote_item.unit if item.quote_item else "",
                            "quantity": float(item.quote_item.quantity or 0)
                            if item.quote_item
                            else 0,
                            "vat_rate": float(item.quote_item.vat_rate or 20)
                            if item.quote_item
                            else 20,
                            "supplier_unit_price": float(item.unit_price or 0),
                            "supplier_total_price": float(item.total_price or 0),
                            "notes": item.notes or "",
                            "is_group_header": bool(item.quote_item.is_group_header)
                            if item.quote_item
                            else False,
                            "item_notes": item.quote_item.notes
                            if item.quote_item
                            else None,
                        }
                        for item in sq.items
                    ],
                    "revisions": [],
                }

                # Bu teklife ait revizleri bul
                revisions = (
                    db.query(SupplierQuote)
                    .filter(SupplierQuote.revision_of_id == sq.id)
                    .order_by(SupplierQuote.revision_number)
                    .all()
                )

                for rev in revisions:
                    quote_data["revisions"].append(
                        {
                            "id": rev.id,
                            "revision_number": rev.revision_number,
                            "status": rev.status,
                            "currency": str(
                                getattr(rev, "currency", "TRY") or "TRY"
                            ).upper(),
                            "total_amount": float(rev.total_amount),
                            "profitability_amount": float(rev.profitability_amount)
                            if rev.profitability_amount
                            else None,
                            "profitability_percent": float(rev.profitability_percent)
                            if rev.profitability_percent
                            else None,
                            "submitted_at": rev.submitted_at.isoformat()
                            if rev.submitted_at
                            else None,
                            "items": [
                                {
                                    "quote_item_id": item.quote_item_id,
                                    "line_number": item.quote_item.line_number
                                    if item.quote_item
                                    else "",
                                    "description": item.quote_item.description
                                    if item.quote_item
                                    else "",
                                    "unit": item.quote_item.unit
                                    if item.quote_item
                                    else "",
                                    "quantity": float(item.quote_item.quantity or 0)
                                    if item.quote_item
                                    else 0,
                                    "vat_rate": float(item.quote_item.vat_rate or 20)
                                    if item.quote_item
                                    else 20,
                                    "supplier_unit_price": float(item.unit_price or 0),
                                    "supplier_total_price": float(
                                        item.total_price or 0
                                    ),
                                    "notes": item.notes or "",
                                    "is_group_header": bool(
                                        item.quote_item.is_group_header
                                    )
                                    if item.quote_item
                                    else False,
                                    "item_notes": item.quote_item.notes
                                    if item.quote_item
                                    else None,
                                }
                                for item in rev.items
                            ],
                        }
                    )

                grouped[supplier_id]["quotes"].append(quote_data)

        return list(grouped.values())
