"""Supplier Response - Tedarikçi Yanıtları API"""

import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.core.authz import can_access_procurement_settings
from api.core.deps import get_any_user, get_current_supplier_user, get_current_user
from api.database import get_db
from api.models import (
    PremiumFeature,
    Quote,
    Supplier,
    SupplierQuote,
    SupplierQuoteItem,
    SupplierUser,
    TenantPremiumFeature,
    User,
)
from api.routers.quotes import (
    _build_plan_name_map,
    _resolve_entitlement_summary,
    _resolve_listing_scope,
)
from api.services.subscription_service import normalize_subscription_plan_code
from api.services.email_service import get_email_service

router = APIRouter(prefix="/supplier-quotes", tags=["supplier-quotes"])


_CLOSED_SUPPLIER_STATUSES = {
    "onaylandı",
    "reddedildi",
    "kapatildi",
    "kapatıldı",
    "kapatildi_yuksek_fiyat",
    "kapatıldı_yüksek_fiyat",
}


def _ensure_supplier_quote_editable(
    supplier_quote: SupplierQuote, quote: Quote
) -> None:
    quote_status = (
        quote.status.value
        if getattr(quote, "status", None) is not None and hasattr(quote.status, "value")
        else str(getattr(quote, "status", "")).lower()
    )
    supplier_status = str(supplier_quote.status or "").lower()

    if quote_status in {"approved", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail="Bu teklif kapanmış durumda. Düzenleme veya gönderim yapılamaz.",
        )

    if supplier_status in _CLOSED_SUPPLIER_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="Bu tedarikçi teklifi kapatılmış durumda. Düzenleme yapılamaz.",
        )


def _is_postgresql(db: Session) -> bool:
    bind = getattr(db, "bind", None)
    dialect = getattr(bind, "dialect", None)
    return getattr(dialect, "name", None) == "postgresql"


def _parse_quote_item_meta(notes: str | None) -> dict:
    if not notes:
        return {"detail": "", "image_url": ""}
    try:
        parsed = json.loads(notes)
        if isinstance(parsed, dict):
            return {
                "detail": str(parsed.get("detail") or ""),
                "image_url": str(parsed.get("image_url") or ""),
            }
    except Exception:
        pass
    return {"detail": str(notes), "image_url": ""}
    db.commit()


def _normalize_currency(value: str | None) -> str:
    raw = str(value or "TRY").strip().upper()
    if raw == "TL" or raw == "TRL":
        return "TRY"
    if raw == "USDT":
        return "USD"
    if raw not in {"TRY", "USD", "EUR"}:
        return "TRY"
    return raw


def _get_supplier_quote_price_rules(db: Session) -> dict:
    try:
        row = (
            db.execute(
                text("""
            SELECT max_markup_percent, max_discount_percent, tolerance_amount, block_on_violation
            FROM supplier_quote_price_rules
            ORDER BY id DESC
            LIMIT 1
        """)
            )
            .mappings()
            .first()
        )
    except Exception:
        row = None

    if row is None:
        return {
            "max_markup_percent": 25.0,
            "max_discount_percent": 35.0,
            "tolerance_amount": 0.0,
            "block_on_violation": True,
        }
    return {
        "max_markup_percent": float(row["max_markup_percent"]),
        "max_discount_percent": float(row["max_discount_percent"]),
        "tolerance_amount": float(row["tolerance_amount"]),
        "block_on_violation": bool(row["block_on_violation"]),
    }


def _validate_supplier_quote_price_rules(
    db: Session, quote: Quote, final_amount: float
) -> dict:
    rules = _get_supplier_quote_price_rules(db)
    baseline = float(quote.total_amount or 0)
    if baseline <= 0:
        return {"ok": True, "rules": rules, "violations": [], "allowed_range": None}

    min_allowed = (baseline * (1 - (rules["max_discount_percent"] / 100.0))) - rules[
        "tolerance_amount"
    ]
    max_allowed = (baseline * (1 + (rules["max_markup_percent"] / 100.0))) + rules[
        "tolerance_amount"
    ]

    violations: list[str] = []
    if final_amount < min_allowed:
        violations.append("Teklif tutarı izin verilen minimum değerin altında")
    if final_amount > max_allowed:
        violations.append("Teklif tutarı izin verilen maksimum değerin üstünde")

    return {
        "ok": len(violations) == 0,
        "rules": rules,
        "violations": violations,
        "allowed_range": {
            "min": round(min_allowed, 2),
            "max": round(max_allowed, 2),
            "baseline": baseline,
        },
    }


# ============ SCHEMAS ============


class SupplierQuoteItemUpdate(BaseModel):
    """Tedarikçi tarafından gönderilen fiyat"""

    quote_item_id: int
    unit_price: float
    total_price: float
    notes: str | None = None


class SupplierQuoteSubmit(BaseModel):
    """Tedarikçi teklif sunumu"""

    currency: str = "TRY"
    total_amount: float
    discount_percent: float = 0
    discount_amount: float = 0
    final_amount: float
    payment_terms: str | None = None
    delivery_time: int | None = None  # Gün sayısı
    warranty: str | None = None
    items: list[SupplierQuoteItemUpdate]


class SupplierResponseOut(BaseModel):
    """Tedarikçi yanıtı"""

    id: int
    quote_id: int
    supplier_id: int
    status: str
    currency: str
    total_amount: float
    discount_percent: float
    discount_amount: float
    final_amount: float
    payment_terms: str | None
    delivery_time: int | None
    warranty: str | None
    submitted_at: datetime | None
    created_at: datetime


class SupplierQuotePriceRulesUpdate(BaseModel):
    max_markup_percent: float
    max_discount_percent: float
    tolerance_amount: float = 0
    block_on_violation: bool = True


# ============ ENDPOINTS ============


@router.get("/price-rules", response_model=dict)
def get_supplier_quote_price_rules(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not can_access_procurement_settings(current_user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    return _get_supplier_quote_price_rules(db)


@router.get("/exchange-rates/tcmb", response_model=dict)
def get_tcmb_effective_sell_rates(
    current_user=Depends(get_any_user),
):
    """TCMB günlük efektif satış kurlarını döner (USD/TRY ve EUR/TRY)."""
    try:
        with urllib.request.urlopen(
            "https://www.tcmb.gov.tr/kurlar/today.xml", timeout=8
        ) as response:
            raw = response.read()
        root = ET.fromstring(raw)

        rates: dict[str, float] = {}
        for cur in root.findall("Currency"):
            code = (cur.attrib.get("CurrencyCode") or "").upper()
            if code not in {"USD", "EUR"}:
                continue

            banknote_sell = (cur.findtext("BanknoteSelling") or "").strip()
            forex_sell = (cur.findtext("ForexSelling") or "").strip()
            chosen = banknote_sell or forex_sell
            if not chosen:
                continue

            # TCMB XML virgül kullanır: 38,2456
            normalized = chosen.replace(" ", "")
            if "," in normalized:
                normalized = normalized.replace(".", "").replace(",", ".")
            rates[code] = float(normalized)

        if "USD" not in rates or "EUR" not in rates:
            raise HTTPException(
                status_code=502,
                detail="TCMB kur verisi alınamadı (USD/EUR eksik)",
            )

        return {
            "source": "TCMB_EFEKTIF_SATIS",
            "base": "TRY",
            "usd_try": rates["USD"],
            "eur_try": rates["EUR"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"TCMB kur servisine erişilemedi: {exc}"
        )


@router.put("/price-rules", response_model=dict)
def update_supplier_quote_price_rules(
    payload: SupplierQuotePriceRulesUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not can_access_procurement_settings(current_user):
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")

    if (
        payload.max_markup_percent < 0
        or payload.max_discount_percent < 0
        or payload.tolerance_amount < 0
    ):
        raise HTTPException(
            status_code=400, detail="Kural değerleri 0'dan küçük olamaz"
        )

    db.execute(
        text("""
        INSERT INTO supplier_quote_price_rules (
            max_markup_percent, max_discount_percent, tolerance_amount,
            block_on_violation, updated_by, updated_at
        ) VALUES (
            :max_markup_percent, :max_discount_percent, :tolerance_amount,
            :block_on_violation, :updated_by, :updated_at
        )
    """),
        {
            "max_markup_percent": payload.max_markup_percent,
            "max_discount_percent": payload.max_discount_percent,
            "tolerance_amount": payload.tolerance_amount,
            "block_on_violation": payload.block_on_violation,
            "updated_by": getattr(current_user, "id", None),
            "updated_at": datetime.now(UTC).isoformat(),
        },
    )
    db.commit()
    return {"status": "success", "rules": _get_supplier_quote_price_rules(db)}


@router.get("/me")
def get_my_quotes(
    db: Session = Depends(get_db),
    current_user: SupplierUser = Depends(get_current_supplier_user),
):
    """Tedarikçinin kendisine gönderilen teklifleri listele"""

    supplier_quotes = (
        db.query(SupplierQuote)
        .filter(SupplierQuote.supplier_id == current_user.supplier_id)
        .all()
    )
    tenant_ids: set[int] = set()
    quote_rows_by_id: dict[int, Quote] = {}
    for sq in supplier_quotes:
        quote = db.query(Quote).filter(Quote.id == sq.quote_id).first()
        if quote is None:
            continue
        quote_rows_by_id[int(quote.id)] = quote
        if quote.tenant_id is not None:
            tenant_ids.add(int(quote.tenant_id))

    premium_codes_by_tenant: dict[int, list[str]] = {}
    if tenant_ids:
        premium_rows = (
            db.query(TenantPremiumFeature, PremiumFeature)
            .join(
                PremiumFeature,
                PremiumFeature.id == TenantPremiumFeature.premium_feature_id,
            )
            .filter(
                TenantPremiumFeature.tenant_id.in_(tenant_ids),
                TenantPremiumFeature.billing_status == "active",
                PremiumFeature.is_active.is_(True),
            )
            .all()
        )
        for activation, feature in premium_rows:
            premium_codes_by_tenant.setdefault(int(activation.tenant_id), []).append(
                str(feature.code)
            )

    plan_name_map = _build_plan_name_map()
    result = []
    for sq in supplier_quotes:
        quote = (
            quote_rows_by_id.get(int(sq.quote_id))
            or db.query(Quote).filter(Quote.id == sq.quote_id).first()
        )
        items = (
            db.query(SupplierQuoteItem)
            .filter(SupplierQuoteItem.supplier_quote_id == sq.id)
            .all()
        )
        normalized_plan_code = normalize_subscription_plan_code(
            getattr(getattr(quote, "tenant", None), "subscription_plan_code", None)
            if quote
            else None
        )
        premium_feature_codes = (
            premium_codes_by_tenant.get(int(quote.tenant_id), [])
            if quote and quote.tenant_id is not None
            else []
        )
        (
            entitlement_status,
            entitlement_summary,
            platform_network_listing_enabled,
            premium_listing_enabled,
        ) = _resolve_entitlement_summary(
            normalized_plan_code,
            premium_feature_codes,
        )
        (
            listing_scope,
            listing_scope_label,
            private_supplier_count,
            platform_network_supplier_count,
            invited_supplier_count,
            responded_supplier_count,
        ) = (
            _resolve_listing_scope(quote)
            if quote
            else ("draft_unpublished", "Yayinlanmadi", 0, 0, 0, 0)
        )

        result.append(
            {
                "id": sq.id,
                "supplier_id": sq.supplier_id,
                "quote_id": sq.quote_id,
                "quote_title": quote.title if quote else "Bilinmiyor",
                "quote_company": quote.company_name if quote else None,
                "published_by_tenant_name": (
                    getattr(getattr(quote, "tenant", None), "brand_name", None)
                    or getattr(getattr(quote, "tenant", None), "legal_name", None)
                    or quote.company_name
                )
                if quote
                else None,
                "listing_scope": listing_scope,
                "listing_scope_label": listing_scope_label,
                "private_supplier_count": private_supplier_count,
                "platform_network_supplier_count": platform_network_supplier_count,
                "invited_supplier_count": invited_supplier_count,
                "responded_supplier_count": responded_supplier_count,
                "package_plan_code": normalized_plan_code,
                "package_plan_name": plan_name_map.get(
                    normalized_plan_code, normalized_plan_code
                ),
                "active_premium_feature_codes": premium_feature_codes,
                "entitlement_status": entitlement_status,
                "entitlement_summary": entitlement_summary,
                "platform_network_listing_enabled": platform_network_listing_enabled,
                "premium_listing_enabled": premium_listing_enabled,
                "quote_status": (
                    quote.status.value
                    if quote
                    and getattr(quote, "status", None) is not None
                    and hasattr(quote.status, "value")
                    else (str(getattr(quote, "status", "")) if quote else None)
                ),
                "selected_supplier_id": (
                    getattr(quote, "selected_supplier_id", None) if quote else None
                ),
                "status": sq.status,
                "currency": _normalize_currency(getattr(sq, "currency", "TRY")),
                "total_amount": float(sq.total_amount or 0),
                "final_amount": float(sq.final_amount or 0),
                "created_at": sq.created_at,
                "submitted_at": sq.submitted_at,
                "items": [
                    {
                        "id": item.id,
                        "quote_item_id": item.quote_item_id,
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
                        "original_unit_price": float(item.quote_item.unit_price or 0)
                        if item.quote_item
                        else 0,
                        "supplier_unit_price": float(item.unit_price or 0),
                        "supplier_total_price": float(item.total_price or 0),
                        "notes": item.notes or "",
                        "is_group_header": bool(item.quote_item.is_group_header)
                        if item.quote_item
                        else False,
                        "line_number": item.quote_item.line_number
                        if item.quote_item
                        else "",
                        "item_detail": _parse_quote_item_meta(
                            item.quote_item.notes if item.quote_item else None
                        )["detail"],
                        "item_image_url": _parse_quote_item_meta(
                            item.quote_item.notes if item.quote_item else None
                        )["image_url"],
                    }
                    for item in items
                ],
            }
        )

    return result


@router.get("/{supplier_quote_id}")
def get_supplier_quote(
    supplier_quote_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_any_user),
):
    """Tedarikçi teklifini getir (taslak/yanıtlandı)"""

    supplier_quote = (
        db.query(SupplierQuote).filter(SupplierQuote.id == supplier_quote_id).first()
    )
    if not supplier_quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    # Supplier user ise sadece kendi teklifini görebilir
    if isinstance(current_user, SupplierUser):
        if supplier_quote.supplier_id != current_user.supplier_id:
            raise HTTPException(status_code=403, detail="Yetkisiz erişim")

    # Quote ve items al
    quote = db.query(Quote).filter(Quote.id == supplier_quote.quote_id).first()
    items = (
        db.query(SupplierQuoteItem)
        .filter(SupplierQuoteItem.supplier_quote_id == supplier_quote_id)
        .all()
    )

    return {
        "id": supplier_quote.id,
        "quote_id": supplier_quote.quote_id,
        "quote_title": quote.title if quote else None,
        "supplier_id": supplier_quote.supplier_id,
        "supplier_name": supplier_quote.supplier.company_name
        if supplier_quote.supplier
        else None,
        "status": supplier_quote.status,
        "currency": _normalize_currency(getattr(supplier_quote, "currency", "TRY")),
        "total_amount": float(supplier_quote.total_amount or 0),
        "discount_percent": float(supplier_quote.discount_percent or 0),
        "discount_amount": float(supplier_quote.discount_amount or 0),
        "final_amount": float(supplier_quote.final_amount or 0),
        "payment_terms": supplier_quote.payment_terms,
        "delivery_time": supplier_quote.delivery_time,
        "warranty": supplier_quote.warranty,
        "submitted_at": supplier_quote.submitted_at,
        "created_at": supplier_quote.created_at,
        "items": [
            {
                "id": item.id,
                "quote_item_id": item.quote_item_id,
                "description": item.quote_item.description if item.quote_item else None,
                "unit": item.quote_item.unit if item.quote_item else None,
                "quantity": float(item.quote_item.quantity or 0)
                if item.quote_item
                else 0,
                "vat_rate": float(item.quote_item.vat_rate or 20)
                if item.quote_item
                else 20,
                "original_unit_price": float(item.quote_item.unit_price or 0)
                if item.quote_item
                else 0,
                "supplier_unit_price": float(item.unit_price or 0),
                "supplier_total_price": float(item.total_price or 0),
                "notes": item.notes,
                "is_group_header": bool(item.quote_item.is_group_header)
                if item.quote_item
                else False,
                "line_number": item.quote_item.line_number if item.quote_item else "",
                "item_detail": _parse_quote_item_meta(
                    item.quote_item.notes if item.quote_item else None
                )["detail"],
                "item_image_url": _parse_quote_item_meta(
                    item.quote_item.notes if item.quote_item else None
                )["image_url"],
            }
            for item in items
        ],
    }


@router.post("/{supplier_quote_id}/draft-save")
def save_draft(
    supplier_quote_id: int,
    data: SupplierQuoteSubmit,
    db: Session = Depends(get_db),
    current_user=Depends(get_any_user),
):
    """Tedarikçi draft'ı kaydet (henüz gönderme)"""

    supplier_quote = (
        db.query(SupplierQuote).filter(SupplierQuote.id == supplier_quote_id).first()
    )

    if not supplier_quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    # Supplier user ise sadece kendi teklifini düzenleyebilir
    if isinstance(current_user, SupplierUser):
        if supplier_quote.supplier_id != current_user.supplier_id:
            raise HTTPException(status_code=403, detail="Yetkisiz erişim")

    quote = db.query(Quote).filter(Quote.id == supplier_quote.quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    if not data.items:
        raise HTTPException(
            status_code=400, detail="Kaydetmek için en az bir kalem gereklidir"
        )
    _ensure_supplier_quote_editable(supplier_quote, quote)

    price_check = _validate_supplier_quote_price_rules(
        db, quote, float(data.final_amount or 0)
    )
    if (not price_check["ok"]) and price_check["rules"]["block_on_violation"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Fiyat kontrol kuralları ihlali",
                "violations": price_check["violations"],
                "allowed_range": price_check["allowed_range"],
            },
        )

    try:
        # Fiyat bilgilerini güncelle
        supplier_quote.total_amount = data.total_amount
        supplier_quote.discount_percent = data.discount_percent
        supplier_quote.discount_amount = data.discount_amount
        supplier_quote.final_amount = data.final_amount
        supplier_quote.currency = _normalize_currency(getattr(data, "currency", "TRY"))
        supplier_quote.payment_terms = data.payment_terms
        supplier_quote.delivery_time = data.delivery_time
        supplier_quote.warranty = data.warranty

        # Items güncelle
        for item_data in data.items:
            item = (
                db.query(SupplierQuoteItem)
                .filter(
                    SupplierQuoteItem.supplier_quote_id == supplier_quote_id,
                    SupplierQuoteItem.quote_item_id == item_data.quote_item_id,
                )
                .first()
            )

            if item:
                item.unit_price = item_data.unit_price
                item.total_price = item_data.total_price
                item.notes = item_data.notes

        supplier_quote.status = "tasarı"
        db.commit()

        return {
            "status": "success",
            "message": "Taslak kaydedildi",
            "price_check": price_check,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{supplier_quote_id}/submit")
def submit_response(
    supplier_quote_id: int,
    data: SupplierQuoteSubmit,
    db: Session = Depends(get_db),
    current_user=Depends(get_any_user),
    email_service=Depends(get_email_service),
):
    """Tedarikçi teklifini gönder (final yanıt)"""

    supplier_quote = (
        db.query(SupplierQuote).filter(SupplierQuote.id == supplier_quote_id).first()
    )

    if not supplier_quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    # Supplier user ise sadece kendi teklifini gönderebilir
    if isinstance(current_user, SupplierUser):
        if supplier_quote.supplier_id != current_user.supplier_id:
            raise HTTPException(status_code=403, detail="Yetkisiz erişim")

    quote = db.query(Quote).filter(Quote.id == supplier_quote.quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    if not data.items:
        raise HTTPException(
            status_code=400, detail="Göndermek için en az bir kalem gereklidir"
        )
    _ensure_supplier_quote_editable(supplier_quote, quote)

    price_check = _validate_supplier_quote_price_rules(
        db, quote, float(data.final_amount or 0)
    )
    if (not price_check["ok"]) and price_check["rules"]["block_on_violation"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Fiyat kontrol kuralları ihlali",
                "violations": price_check["violations"],
                "allowed_range": price_check["allowed_range"],
            },
        )

    try:
        is_revision_submit = str(supplier_quote.status or "").lower() == "revize_edildi"
        next_revision_number = int(supplier_quote.revision_number or 0) + (
            1 if is_revision_submit else 0
        )

        # İlk gönderimde initial_final_amount'u sakla (revize sonra değiştirmez)
        if not is_revision_submit:
            supplier_quote.initial_final_amount = data.final_amount

        # Fiyat bilgilerini güncelle
        supplier_quote.total_amount = data.total_amount
        supplier_quote.discount_percent = data.discount_percent
        supplier_quote.discount_amount = data.discount_amount
        supplier_quote.final_amount = data.final_amount
        supplier_quote.currency = _normalize_currency(getattr(data, "currency", "TRY"))
        supplier_quote.payment_terms = data.payment_terms
        supplier_quote.delivery_time = data.delivery_time
        supplier_quote.warranty = data.warranty

        # Items güncelle
        for item_data in data.items:
            item = (
                db.query(SupplierQuoteItem)
                .filter(
                    SupplierQuoteItem.supplier_quote_id == supplier_quote_id,
                    SupplierQuoteItem.quote_item_id == item_data.quote_item_id,
                )
                .first()
            )

            if item:
                if is_revision_submit:
                    previous_unit_price = float(item.unit_price or 0)
                    previous_total_price = float(item.total_price or 0)
                    new_unit_price = float(item_data.unit_price or 0)
                    new_total_price = float(item_data.total_price or 0)

                    if (
                        previous_unit_price != new_unit_price
                        or previous_total_price != new_total_price
                    ):
                        revision_log: list[dict] = []
                        if item.revision_prices:
                            try:
                                parsed = json.loads(item.revision_prices)
                                if isinstance(parsed, list):
                                    revision_log = parsed
                            except Exception:
                                revision_log = []

                        revision_log.append(
                            {
                                "revision_number": next_revision_number,
                                "previous_unit_price": previous_unit_price,
                                "previous_total_price": previous_total_price,
                                "new_unit_price": new_unit_price,
                                "new_total_price": new_total_price,
                                "updated_at": datetime.now(UTC).isoformat(),
                            }
                        )
                        item.revision_prices = json.dumps(
                            revision_log, ensure_ascii=False
                        )
                        item.revision_number = next_revision_number

                item.unit_price = item_data.unit_price
                item.total_price = item_data.total_price
                item.notes = item_data.notes

        if is_revision_submit:
            supplier_quote.revision_number = next_revision_number

        # Durumu güncelle
        supplier_quote.status = "yanıtlandı"
        supplier_quote.submitted_at = datetime.now(UTC)
        supplier_quote.supplier_user_id = (
            current_user.id if isinstance(current_user, SupplierUser) else None
        )

        db.commit()

        # Email gönder - öncelik atanan satın alma sorumlusunda, yoksa oluşturan kullanıcıda
        supplier = (
            db.query(Supplier).filter(Supplier.id == supplier_quote.supplier_id).first()
        )

        notify_user = None
        if getattr(quote, "assigned_to_id", None):
            notify_user = (
                db.query(User)
                .filter(User.id == quote.assigned_to_id, User.is_active)
                .first()
            )
        if not notify_user:
            notify_user = (
                db.query(User)
                .filter(User.id == quote.created_by_id, User.is_active)
                .first()
            )

        if notify_user and notify_user.email:
            try:
                email_service.send_supplier_response_to_admin(
                    to_email=notify_user.email,
                    admin_name=getattr(notify_user, "full_name", None)
                    or getattr(notify_user, "username", "")
                    or "Yetkili",
                    supplier_company=supplier.company_name if supplier else "Tedarikçi",
                    quote_title=quote.title,
                    final_amount=float(data.final_amount),
                    revision_number=next_revision_number,
                    discount_percent=float(data.discount_percent or 0),
                    discount_amount=float(data.discount_amount or 0),
                    delivery_time=data.delivery_time,
                    payment_terms=data.payment_terms,
                    warranty=data.warranty,
                    owner_user_id=notify_user.id,
                )
            except Exception:
                pass  # Email hatası işlemi durdurmaz

        return {
            "status": "success",
            "message": "Teklif başarıyla gönderildi",
            "submitted_at": supplier_quote.submitted_at,
            "price_check": price_check,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{supplier_quote_id}/decline")
def decline_supplier_quote(
    supplier_quote_id: int,
    reason: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_any_user),
):
    """Tedarikçinin teklifi cevaplamayı reddetmesi."""
    supplier_quote = (
        db.query(SupplierQuote).filter(SupplierQuote.id == supplier_quote_id).first()
    )

    if not supplier_quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    if isinstance(current_user, SupplierUser):
        if supplier_quote.supplier_id != current_user.supplier_id:
            raise HTTPException(status_code=403, detail="Yetkisiz erişim")

    quote = db.query(Quote).filter(Quote.id == supplier_quote.quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    _ensure_supplier_quote_editable(supplier_quote, quote)

    supplier_quote.status = "reddedildi"
    if reason:
        existing = str(supplier_quote.notes or "").strip()
        supplier_quote.notes = f"{existing}\nReddedilme nedeni: {reason}".strip()
    supplier_quote.updated_at = datetime.now(UTC)
    db.commit()

    return {
        "status": "success",
        "message": "Teklif cevaplamayı reddetme işlemi kaydedildi",
        "supplier_quote_id": supplier_quote_id,
    }


@router.get("/quote/{quote_id}/responses")
def get_all_supplier_responses(
    quote_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    """Teklif için tüm tedarikçi yanıtlarını getir"""

    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    # Sadece quote creator'u görebilir
    if quote.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim")

    responses = db.query(SupplierQuote).filter(SupplierQuote.quote_id == quote_id).all()

    result = []
    for response in responses:
        supplier = response.supplier
        result.append(
            {
                "id": response.id,
                "supplier_id": response.supplier_id,
                "supplier_name": getattr(supplier, "company_name", None)
                or "Bilinmiyor",
                "supplier_phone": getattr(supplier, "phone", None),
                "supplier_email": getattr(supplier, "email", None),
                "status": response.status,
                "total_amount": float(response.total_amount or 0),
                "discount_percent": float(response.discount_percent or 0),
                "discount_amount": float(response.discount_amount or 0),
                "final_amount": float(response.final_amount or 0),
                "payment_terms": response.payment_terms,
                "delivery_time": response.delivery_time,
                "warranty": response.warranty,
                "submitted_at": response.submitted_at,
                "created_at": response.created_at,
                "items_count": len(response.items) if response.items else 0,
            }
        )

    return result
