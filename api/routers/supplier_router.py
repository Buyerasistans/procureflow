"""Tedarikçi (Supplier) Yönetimi API Endpoints"""

import json
import logging
import os
import uuid
import smtplib
from decimal import Decimal
from html import escape
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Body,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import FileResponse
from sqlalchemy import or_, text, func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import secrets
from threading import Lock

from api.database import get_db
from api.core.authz import (
    GLOBAL_PROCUREMENT_MANAGER_ROLES,
    is_admin_like,
    is_global_procurement_manager,
    normalized_role,
    normalized_system_role,
)
from api.models import (
    Supplier,
    SupplierUser,
    User,
    ProjectSupplier,
    Project,
    Quote,
    SupplierQuote,
    ProjectFile,
)
from api.models.report import Contract
from api.schemas.supplier import (
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    SupplierUserCreate,
    SupplierUserUpdate,
    SupplierUserOut,
)
from api.core.deps import get_current_user, get_current_supplier_user
from api.core.security import get_password_hash
from api.services.email_service import get_email_service
from api.services.sms_service import get_sms_service
from api.services.subscription_service import enforce_active_private_supplier_limit
from api.services.work_mailbox_service import ensure_supplier_user_work_mailbox
from api.models.tenant import Tenant
from api.models.company import Company
from api.models.payment import TenantSubscriptionAddon

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/suppliers", tags=["suppliers"])
_SUPPLIER_FINANCE_SCHEMA_LOCK = Lock()
_SUPPLIER_FINANCE_SCHEMA_READY = False


def _normalize_category_items(values: object) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        candidate_values = [values]
    elif isinstance(values, (list, tuple, set)):
        candidate_values = list(values)
    else:
        candidate_values = [values]

    normalized: list[str] = []
    seen: set[str] = set()
    for item in candidate_values:
        text_value = str(item).strip()
        if not text_value:
            continue
        lowered = text_value.casefold()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(text_value[:255])
    return normalized


def _set_supplier_category_fields(
    supplier: Supplier,
    *,
    category_tags: list[str] | None = None,
    partner_category_tags: list[str] | None = None,
    category: str | None = None,
) -> None:
    next_category_tags = (
        category_tags if category_tags is not None else supplier.category_tags
    )
    next_partner_category_tags = (
        partner_category_tags
        if partner_category_tags is not None
        else supplier.partner_category_tags
    )
    fallback_category = str(category or supplier.category or "").strip()

    supplier.category_tags_json = (
        json.dumps(next_category_tags, ensure_ascii=False)
        if next_category_tags
        else None
    )
    supplier.partner_category_tags_json = (
        json.dumps(next_partner_category_tags, ensure_ascii=False)
        if next_partner_category_tags
        else None
    )

    effective_tags: list[str] = []
    seen: set[str] = set()
    for item in [*next_category_tags, *next_partner_category_tags]:
        lowered = item.casefold()
        if lowered in seen:
            continue
        seen.add(lowered)
        effective_tags.append(item)

    if effective_tags:
        supplier.category = effective_tags[0]
    else:
        supplier.category = fallback_category or None


def _serialize_supplier(supplier: Supplier) -> dict:
    inviter_company_name: str | None = None
    if supplier.tenant is not None and getattr(supplier.tenant, "companies", None):
        tenant_companies = [c for c in supplier.tenant.companies if c.is_active]
        if tenant_companies:
            tenant_companies.sort(
                key=lambda c: (0 if c.is_primary else 1, c.name.lower())
            )
            inviter_company_name = tenant_companies[0].name

    special_listing_active = False

    return {
        "id": supplier.id,
        "created_by_id": supplier.created_by_id,
        "company_name": supplier.company_name,
        "company_title": supplier.company_title,
        "tax_number": supplier.tax_number,
        "registration_number": supplier.registration_number,
        "phone": supplier.phone,
        "email": supplier.email,
        "website": supplier.website,
        "address": supplier.address,
        "city": supplier.city,
        "address_district": supplier.address_district,
        "postal_code": supplier.postal_code,
        "category": supplier.category,
        "category_tags": supplier.category_tags,
        "partner_category_tags": supplier.partner_category_tags,
        "effective_category_tags": supplier.effective_category_tags,
        "invoice_name": supplier.invoice_name,
        "invoice_address": supplier.invoice_address,
        "invoice_city": supplier.invoice_city,
        "invoice_district": supplier.invoice_district,
        "invoice_postal_code": supplier.invoice_postal_code,
        "reference_score": _num_to_float(supplier.reference_score),
        "notes": supplier.notes,
        "is_active": supplier.is_active,
        "is_verified": supplier.is_verified,
        "logo_url": supplier.logo_url,
        "created_at": supplier.created_at,
        "updated_at": supplier.updated_at,
        "source_type": supplier.source_type,
        "tenant_id": supplier.tenant_id,
        "tenant_name": (
            supplier.tenant.brand_name or supplier.tenant.legal_name
            if supplier.tenant
            else None
        ),
        "inviter_company_name": inviter_company_name,
        "special_listing_active": special_listing_active,
    }


def _can_bypass_supplier_scope(current_user: User) -> bool:
    return normalized_system_role(current_user) == "super_admin"


def _is_global_supplier_manager(current_user: User) -> bool:
    return is_global_procurement_manager(current_user)


def _is_postgresql(db: Session) -> bool:
    bind = getattr(db, "bind", None)
    dialect = getattr(bind, "dialect", None)
    return getattr(dialect, "name", None) == "postgresql"


def _num_to_float(value: object | None) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float, Decimal, str)):
        return float(value)
    return 0.0


def _ensure_supplier_default_user_table(db: Session) -> None:
    if _is_postgresql(db):
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_default_users (
                supplier_id INTEGER PRIMARY KEY,
                supplier_user_id INTEGER NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        )
    else:
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_default_users (
                supplier_id INTEGER PRIMARY KEY,
                supplier_user_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
    db.commit()


def _get_default_user_id(db: Session, supplier_id: int) -> int | None:
    _ensure_supplier_default_user_table(db)
    row = (
        db.execute(
            text("""
            SELECT supplier_user_id
            FROM supplier_default_users
            WHERE supplier_id = :supplier_id
            LIMIT 1
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .first()
    )
    if not row:
        return None
    return int(row["supplier_user_id"])


def _set_default_user_id(db: Session, supplier_id: int, supplier_user_id: int) -> None:
    _ensure_supplier_default_user_table(db)
    db.execute(
        text("""
            INSERT INTO supplier_default_users (supplier_id, supplier_user_id, updated_at)
            VALUES (:supplier_id, :supplier_user_id, :updated_at)
            ON CONFLICT(supplier_id) DO UPDATE SET
                supplier_user_id = excluded.supplier_user_id,
                updated_at = excluded.updated_at
        """),
        {
            "supplier_id": supplier_id,
            "supplier_user_id": supplier_user_id,
            "updated_at": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    )
    db.commit()


def _create_default_supplier_user_for_invite(
    db: Session,
    supplier: Supplier,
    *,
    email_service,
) -> tuple[SupplierUser, bool]:
    existing_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.email == supplier.email, SupplierUser.is_active)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Bu e-mail ile kayıtlı aktif bir tedarikçi kullanıcısı zaten mevcut",
        )

    magic_token = secrets.token_urlsafe(32)
    magic_token_expires = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)
    supplier_user = SupplierUser(
        supplier_id=supplier.id,
        name=(supplier.company_name or "Firma Yetkilisi").strip()[:255],
        email=supplier.email,
        phone=supplier.phone,
        magic_token=magic_token,
        magic_token_expires=magic_token_expires,
        is_active=True,
        email_verified=False,
        password_set=False,
    )
    db.add(supplier_user)
    db.flush()

    _ensure_supplier_default_user_table(db)
    db.execute(
        text(
            """
            INSERT INTO supplier_default_users (supplier_id, supplier_user_id, updated_at)
            VALUES (:supplier_id, :supplier_user_id, :updated_at)
            ON CONFLICT(supplier_id) DO UPDATE SET
                supplier_user_id = excluded.supplier_user_id,
                updated_at = excluded.updated_at
        """
        ),
        {
            "supplier_id": supplier.id,
            "supplier_user_id": supplier_user.id,
            "updated_at": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    )

    email_sent = False
    try:
        email_sent = email_service.send_magic_link(
            to_email=supplier_user.email,
            supplier_name=supplier.company_name,
            supplier_user_name=supplier_user.name,
            magic_token=magic_token,
            company_name="ProcureFlow",
            owner_user_id=supplier.created_by_id,
        )
    except Exception:
        logger.exception("[SUPPLIER_INVITE] Magic link email could not be sent")
        email_sent = False

    return supplier_user, email_sent


# ============ SUPPLIER CRUD ============


def _current_tenant_id(current_user: User) -> int | None:
    return getattr(current_user, "tenant_id", None)


def _current_tenant(db: Session, current_user: User) -> Tenant | None:
    tenant_id = _current_tenant_id(current_user)
    if tenant_id is None:
        return None
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def _require_private_supplier_tenant_scope(current_user: User) -> None:
    if _current_tenant_id(current_user) is not None or _can_bypass_supplier_scope(
        current_user
    ):
        return

    if normalized_system_role(current_user) in {
        "tenant_owner",
        "tenant_admin",
        "tenant_member",
    }:
        raise HTTPException(
            status_code=400,
            detail="Tenant kapsamı olmayan kullanıcı private tedarikçi oluşturamaz. Önce tenant bootstrap akışını tamamlayın.",
        )


def _ensure_supplier_scope(
    supplier: Supplier,
    current_user: User,
    *,
    detail: str = "Bu tedarikci üzerinde yetkiniz yok",
) -> None:
    if _can_bypass_supplier_scope(current_user):
        return

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None and supplier.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail=detail)

    if (
        tenant_id is None
        and supplier.created_by_id
        and supplier.created_by_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail=detail)


def _ensure_supplier_creator_access(
    supplier: Supplier,
    current_user: User,
    *,
    detail: str,
) -> None:
    if _can_bypass_supplier_scope(current_user):
        return

    if supplier.created_by_id and supplier.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail=detail)


def _apply_supplier_visibility_filter(
    query,
    current_user: User,
    *,
    allow_global_manager_unscoped: bool = False,
    source_type: str | None = None,
):
    tenant_id = _current_tenant_id(current_user)
    normalized_source_type = (source_type or "").strip().lower() or None

    if normalized_source_type == "platform_network":
        return query.filter(Supplier.tenant_id.is_(None))

    if tenant_id is not None:
        if normalized_source_type == "all":
            return query.filter(
                or_(Supplier.tenant_id == tenant_id, Supplier.tenant_id.is_(None))
            )
        return query.filter(Supplier.tenant_id == tenant_id)

    if allow_global_manager_unscoped and is_global_procurement_manager(current_user):
        if normalized_source_type == "private":
            return query.filter(Supplier.tenant_id.is_not(None))
        return query

    if normalized_source_type == "private":
        return query.filter(
            Supplier.created_by_id == current_user.id,
            Supplier.tenant_id.is_(None),
        )

    return query.filter(Supplier.created_by_id == current_user.id)


def _get_visible_supplier_or_404(
    db: Session,
    supplier_id: int,
    current_user: User,
    *,
    detail: str = "Bu tedarikciyi kullanma yetkiniz yok",
    allow_platform_network_for_tenant: bool = False,
) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    if _can_bypass_supplier_scope(current_user):
        return supplier

    tenant_id = _current_tenant_id(current_user)
    if tenant_id is not None:
        if supplier.tenant_id == tenant_id:
            return supplier
        if allow_platform_network_for_tenant and supplier.tenant_id is None:
            return supplier
        raise HTTPException(status_code=403, detail=detail)

    if is_global_procurement_manager(current_user):
        return supplier

    if supplier.created_by_id and supplier.created_by_id == current_user.id:
        return supplier

    raise HTTPException(status_code=403, detail=detail)


@router.post("", response_model=SupplierOut)
def create_supplier(
    supplier_data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Yeni tedarikçi ekle (Personel tarafından)"""
    # Email benzersizliği kontrol et
    existing = db.query(Supplier).filter(Supplier.email == supplier_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-mail zaten kayıtlı")
    existing_supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.email == supplier_data.email, SupplierUser.is_active)
        .first()
    )
    if existing_supplier_user:
        raise HTTPException(
            status_code=400,
            detail="Bu e-mail ile kayıtlı aktif bir tedarikçi kullanıcısı zaten mevcut",
        )

    _require_private_supplier_tenant_scope(current_user)

    enforce_active_private_supplier_limit(db, _current_tenant(db, current_user))

    normalized_category_tags = _normalize_category_items(
        supplier_data.category_tags or supplier_data.category
    )
    normalized_partner_category_tags = _normalize_category_items(
        supplier_data.partner_category_tags
    )

    supplier = Supplier(
        created_by_id=current_user.id,
        tenant_id=_current_tenant_id(current_user),
        **supplier_data.model_dump(exclude={"category_tags", "partner_category_tags"}),
    )
    _set_supplier_category_fields(
        supplier,
        category_tags=normalized_category_tags,
        partner_category_tags=normalized_partner_category_tags,
        category=supplier_data.category,
    )

    db.add(supplier)
    db.flush()
    _create_default_supplier_user_for_invite(
        db,
        supplier,
        email_service=email_service,
    )
    db.commit()
    db.refresh(supplier)
    return _serialize_supplier(supplier)


@router.get("", response_model=list[SupplierOut])
def list_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    filter_active: bool = True,
    source_type: str | None = None,
):
    """Tedarikçileri listele (Personel tarafından girilen)"""
    try:
        query = db.query(Supplier)

        if filter_active:
            query = query.filter(Supplier.is_active)

        query = _apply_supplier_visibility_filter(
            query,
            current_user,
            allow_global_manager_unscoped=True,
            source_type=source_type,
        )

        suppliers = query.order_by(Supplier.company_name).all()

        tenant_ids = sorted(
            {int(s.tenant_id) for s in suppliers if s.tenant_id is not None}
        )
        special_tenant_ids: set[int] = set()
        if tenant_ids:
            special_rows = (
                db.query(TenantSubscriptionAddon.tenant_id)
                .filter(
                    TenantSubscriptionAddon.tenant_id.in_(tenant_ids),
                    TenantSubscriptionAddon.status == "active",
                    func.lower(func.coalesce(TenantSubscriptionAddon.addon_code, ""))
                    == "special_listing",
                )
                .all()
            )
            special_tenant_ids = {
                int(row.tenant_id) for row in special_rows if row.tenant_id is not None
            }

        inviter_company_name_by_tenant_id: dict[int, str] = {}
        if tenant_ids:
            companies = (
                db.query(Company)
                .filter(Company.tenant_id.in_(tenant_ids), Company.is_active == True)
                .order_by(
                    Company.tenant_id.asc(),
                    Company.is_primary.desc(),
                    Company.name.asc(),
                )
                .all()
            )
            for company in companies:
                if company.tenant_id is None:
                    continue
                tenant_key = int(company.tenant_id)
                if tenant_key not in inviter_company_name_by_tenant_id:
                    inviter_company_name_by_tenant_id[tenant_key] = company.name

        rows: list[dict] = []
        for supplier in suppliers:
            payload = _serialize_supplier(supplier)
            tenant_id = supplier.tenant_id
            if tenant_id is not None:
                payload["special_listing_active"] = int(tenant_id) in special_tenant_ids
                payload["inviter_company_name"] = inviter_company_name_by_tenant_id.get(
                    int(tenant_id)
                )
            rows.append(payload)

        return rows
    except Exception as e:
        import traceback

        print(f"[ERROR] GET /suppliers error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Tedarikçiler yüklenirken hata: {str(e)}"
        )


@router.get("/{supplier_id:int}", response_model=SupplierOut)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tedarikçi detayını getir"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")
    _ensure_supplier_scope(
        supplier, current_user, detail="Bu tedarikciyi goruntuleme yetkiniz yok"
    )
    return _serialize_supplier(supplier)


@router.put("/{supplier_id:int}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tedarikçi bilgilerini güncelle"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_scope(
        supplier, current_user, detail="Bu tedarikciyi guncelleme yetkiniz yok"
    )

    # Email unique kontrol (email değiştirilirse)
    if supplier_data.email and supplier_data.email != supplier.email:
        existing = (
            db.query(Supplier)
            .filter(Supplier.email == supplier_data.email, Supplier.id != supplier_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Bu e-mail zaten kayıtlı")

    update_values = supplier_data.model_dump(exclude_unset=True)
    normalized_category_tags = None
    normalized_partner_category_tags = None
    if "category_tags" in update_values:
        normalized_category_tags = _normalize_category_items(
            update_values.pop("category_tags")
        )
    if "partner_category_tags" in update_values:
        normalized_partner_category_tags = _normalize_category_items(
            update_values.pop("partner_category_tags")
        )

    for field, value in update_values.items():
        if hasattr(supplier, field):
            setattr(supplier, field, value)

    if (
        normalized_category_tags is not None
        or normalized_partner_category_tags is not None
    ):
        _set_supplier_category_fields(
            supplier,
            category_tags=normalized_category_tags,
            partner_category_tags=normalized_partner_category_tags,
            category=update_values.get("category"),
        )

    # updated_at alanını güncelle
    supplier.updated_at = datetime.now(ZoneInfo("UTC"))

    db.commit()
    db.refresh(supplier)
    return _serialize_supplier(supplier)


@router.delete("/{supplier_id:int}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tedarikçiyi sil (pasif yap)"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_scope(
        supplier, current_user, detail="Bu tedarikciyi silme yetkiniz yok"
    )

    supplier.is_active = False
    db.commit()

    return {"status": "success", "message": "Tedarikçi devre dışı bırakıldı"}


@router.get("/{supplier_id:int}/management", response_model=dict)
def get_supplier_management_detail(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
    sms_service=Depends(get_sms_service),
):
    """Admin için tedarikçi detay yönetim ekranı verisi."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_scope(
        supplier, current_user, detail="Bu tedarikciyi goruntuleme yetkiniz yok"
    )

    payment_payload = _get_supplier_payment_payload(db, supplier.id)
    default_user_id = _get_default_user_id(db, supplier.id)
    users = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.supplier_id == supplier.id,
            SupplierUser.is_active,
        )
        .order_by(SupplierUser.id.asc())
        .all()
    )

    _ensure_supplier_guarantees_table(db)
    _notify_expired_guarantees(
        db=db,
        supplier_id=supplier.id,
        email_service=email_service,
        sms_service=sms_service,
    )
    guarantees = (
        db.execute(
            text("""
            SELECT id, title, guarantee_type, amount, currency, issued_at, expires_at, status
            FROM supplier_guarantees
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier.id},
        )
        .mappings()
        .all()
    )

    return {
        "supplier": {
            "id": supplier.id,
            "company_name": supplier.company_name,
            "company_title": supplier.company_title,
            "tax_number": supplier.tax_number,
            "registration_number": supplier.registration_number,
            "phone": supplier.phone,
            "email": supplier.email,
            "website": supplier.website,
            "address": supplier.address,
            "city": supplier.city,
            "address_district": supplier.address_district,
            "postal_code": supplier.postal_code,
            "invoice_name": supplier.invoice_name,
            "invoice_address": supplier.invoice_address,
            "invoice_city": supplier.invoice_city,
            "invoice_district": supplier.invoice_district,
            "invoice_postal_code": supplier.invoice_postal_code,
            "tax_office": supplier.tax_office,
            "notes": supplier.notes,
            "category": supplier.category,
            "category_tags": supplier.category_tags,
            "partner_category_tags": supplier.partner_category_tags,
            "effective_category_tags": supplier.effective_category_tags,
            "logo_url": supplier.logo_url,
            "payment_accounts": payment_payload["payment_accounts"],
            "accepts_checks": payment_payload["accepts_checks"],
            "preferred_check_term": payment_payload["preferred_check_term"],
        },
        "users": [
            {
                "id": item.id,
                "name": item.name,
                "email": item.email,
                "phone": item.phone,
                "email_verified": item.email_verified,
                "is_default": item.id == default_user_id,
            }
            for item in users
        ],
        "users_count": len(users),
        "default_user_id": default_user_id,
        "guarantees": [
            {
                "id": int(item["id"]),
                "title": item["title"],
                "guarantee_type": item["guarantee_type"],
                "amount": float(item["amount"]) if item["amount"] is not None else None,
                "currency": item["currency"],
                "issued_at": item["issued_at"],
                "expires_at": item["expires_at"],
                "status": item["status"],
            }
            for item in guarantees
        ],
    }


@router.put("/{supplier_id:int}/management", response_model=dict)
def update_supplier_management_detail(
    supplier_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından tedarikçi detay güncelleme (ödeme/çek dahil)."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_scope(
        supplier, current_user, detail="Bu tedarikciyi guncelleme yetkiniz yok"
    )

    next_email = payload.get("email")
    if (
        next_email
        and str(next_email).strip().lower() != str(supplier.email or "").strip().lower()
    ):
        existing = (
            db.query(Supplier)
            .filter(
                Supplier.email == str(next_email).strip(),
                Supplier.id != supplier_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Bu e-mail zaten kayıtlı")

    update_fields = {
        "company_name": payload.get("company_name"),
        "company_title": payload.get("company_title"),
        "tax_number": payload.get("tax_number"),
        "registration_number": payload.get("registration_number"),
        "phone": payload.get("phone"),
        "email": payload.get("email"),
        "website": payload.get("website"),
        "address": payload.get("address"),
        "city": payload.get("city"),
        "address_district": payload.get("address_district"),
        "postal_code": payload.get("postal_code"),
        "invoice_name": payload.get("invoice_name"),
        "invoice_address": payload.get("invoice_address"),
        "invoice_city": payload.get("invoice_city"),
        "invoice_district": payload.get("invoice_district"),
        "invoice_postal_code": payload.get("invoice_postal_code"),
        "tax_office": payload.get("tax_office"),
        "notes": payload.get("notes"),
        "category": payload.get("category"),
        "is_active": payload.get("is_active") if "is_active" in payload else None,
    }
    for field, value in update_fields.items():
        if value is not None and hasattr(supplier, field):
            setattr(supplier, field, value)

    if "category_tags" in payload or "partner_category_tags" in payload:
        _set_supplier_category_fields(
            supplier,
            category_tags=_normalize_category_items(payload.get("category_tags"))
            if "category_tags" in payload
            else None,
            partner_category_tags=_normalize_category_items(
                payload.get("partner_category_tags")
            )
            if "partner_category_tags" in payload
            else None,
            category=payload.get("category"),
        )

    _ensure_supplier_payment_tables(db)
    payment_accounts = payload.get("payment_accounts")
    if payment_accounts is not None:
        if not isinstance(payment_accounts, list):
            raise HTTPException(
                status_code=400, detail="Ödeme hesapları liste formatında olmalıdır"
            )

        normalized_accounts: list[dict] = []
        for item in payment_accounts:
            if not isinstance(item, dict):
                raise HTTPException(status_code=400, detail="Geçersiz hesap kaydı")

            bank_name = str(item.get("bank_name") or "").strip()
            iban = str(item.get("iban") or "").replace(" ", "").upper()
            account_type = str(item.get("account_type") or "").strip().lower()
            bank_key = str(item.get("bank_key") or "").strip().lower() or None

            if not bank_name:
                raise HTTPException(status_code=400, detail="Banka adı zorunludur")
            if not iban or len(iban) < 15 or len(iban) > 34 or not iban.isalnum():
                raise HTTPException(status_code=400, detail="Geçerli bir IBAN girin")
            if account_type not in {"tl", "doviz"}:
                raise HTTPException(
                    status_code=400, detail="Hesap tipi TL veya Döviz olmalıdır"
                )

            normalized_accounts.append(
                {
                    "bank_key": bank_key,
                    "bank_name": bank_name,
                    "iban": iban,
                    "account_type": account_type,
                }
            )

        db.execute(
            text(
                "DELETE FROM supplier_payment_accounts WHERE supplier_id = :supplier_id"
            ),
            {"supplier_id": supplier.id},
        )
        for account in normalized_accounts:
            db.execute(
                text("""
                    INSERT INTO supplier_payment_accounts (supplier_id, bank_key, bank_name, iban, account_type)
                    VALUES (:supplier_id, :bank_key, :bank_name, :iban, :account_type)
                """),
                {
                    "supplier_id": supplier.id,
                    **account,
                },
            )

    accepts_checks = payload.get("accepts_checks")
    preferred_check_term = payload.get("preferred_check_term")
    if accepts_checks is not None or preferred_check_term is not None:
        accepts_checks_bool = bool(accepts_checks)
        preferred_term = str(preferred_check_term or "").strip() or None

        if not accepts_checks_bool:
            preferred_term = None

        db.execute(
            text("""
                INSERT INTO supplier_check_settings (supplier_id, accepts_checks, preferred_term, updated_at)
                VALUES (:supplier_id, :accepts_checks, :preferred_term, :updated_at)
                ON CONFLICT(supplier_id) DO UPDATE SET
                    accepts_checks = excluded.accepts_checks,
                    preferred_term = excluded.preferred_term,
                    updated_at = excluded.updated_at
            """),
            {
                "supplier_id": supplier.id,
                "accepts_checks": 1 if accepts_checks_bool else 0,
                "preferred_term": preferred_term,
                "updated_at": datetime.now(ZoneInfo("UTC")).isoformat(),
            },
        )

    supplier.updated_at = datetime.now(ZoneInfo("UTC"))
    db.commit()
    return {"status": "success", "message": "Tedarikçi güncellendi"}


@router.post("/{supplier_id:int}/guarantees", response_model=dict)
def create_supplier_guarantee(
    supplier_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından teminat kaydı ekler."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için teminat ekleme yetkiniz yok",
    )

    title = str(payload.get("title") or "").strip()
    guarantee_type = str(payload.get("guarantee_type") or "").strip()
    amount = payload.get("amount")
    currency = str(payload.get("currency") or "TRY").strip().upper() or "TRY"
    issued_at = str(payload.get("issued_at") or "").strip() or None
    expires_at = str(payload.get("expires_at") or "").strip() or None

    if not title or not guarantee_type:
        raise HTTPException(
            status_code=400, detail="Teminat başlığı ve türü zorunludur"
        )

    _ensure_supplier_guarantees_table(db)
    db.execute(
        text("""
            INSERT INTO supplier_guarantees (supplier_id, title, guarantee_type, amount, currency, issued_at, expires_at, status)
            VALUES (:supplier_id, :title, :guarantee_type, :amount, :currency, :issued_at, :expires_at, 'active')
        """),
        {
            "supplier_id": supplier_id,
            "title": title,
            "guarantee_type": guarantee_type,
            "amount": amount,
            "currency": currency,
            "issued_at": issued_at,
            "expires_at": expires_at,
        },
    )
    db.commit()
    return {"status": "success", "message": "Teminat eklendi"}


@router.delete("/{supplier_id:int}/guarantees/{guarantee_id}", response_model=dict)
def delete_supplier_guarantee(
    supplier_id: int,
    guarantee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından teminat kaydı siler."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için teminat silme yetkiniz yok",
    )

    _ensure_supplier_guarantees_table(db)
    db.execute(
        text("""
            DELETE FROM supplier_guarantees
            WHERE id = :guarantee_id AND supplier_id = :supplier_id
        """),
        {"guarantee_id": guarantee_id, "supplier_id": supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Teminat silindi"}


@router.put("/{supplier_id:int}/guarantees/{guarantee_id}", response_model=dict)
def update_supplier_guarantee(
    supplier_id: int,
    guarantee_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından teminat kaydı günceller."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için teminat güncelleme yetkiniz yok",
    )

    _ensure_supplier_guarantees_table(db)
    row = (
        db.execute(
            text("""
            SELECT id FROM supplier_guarantees
            WHERE id = :guarantee_id AND supplier_id = :supplier_id
            LIMIT 1
        """),
            {"guarantee_id": guarantee_id, "supplier_id": supplier_id},
        )
        .mappings()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Teminat bulunamadı")

    title = str(payload.get("title") or "").strip()
    guarantee_type = str(payload.get("guarantee_type") or "").strip()
    amount = payload.get("amount")
    currency = str(payload.get("currency") or "TRY").strip().upper() or "TRY"
    issued_at = str(payload.get("issued_at") or "").strip() or None
    expires_at = str(payload.get("expires_at") or "").strip() or None
    status_value = str(payload.get("status") or "active").strip().lower() or "active"

    if not title or not guarantee_type:
        raise HTTPException(
            status_code=400, detail="Teminat başlığı ve türü zorunludur"
        )
    if status_value not in {"active", "expired", "cancelled"}:
        raise HTTPException(status_code=400, detail="Geçersiz teminat durumu")

    db.execute(
        text("""
            UPDATE supplier_guarantees
            SET title = :title,
                guarantee_type = :guarantee_type,
                amount = :amount,
                currency = :currency,
                issued_at = :issued_at,
                expires_at = :expires_at,
                status = :status
            WHERE id = :guarantee_id AND supplier_id = :supplier_id
        """),
        {
            "title": title,
            "guarantee_type": guarantee_type,
            "amount": amount,
            "currency": currency,
            "issued_at": issued_at,
            "expires_at": expires_at,
            "status": status_value,
            "guarantee_id": guarantee_id,
            "supplier_id": supplier_id,
        },
    )
    db.commit()
    return {"status": "success", "message": "Teminat güncellendi"}


# ============ SUPPLIER USER (Magic Link) ============


@router.post("/{supplier_id:int}/users", response_model=SupplierUserOut)
def create_supplier_user(
    supplier_id: int,
    user_data: SupplierUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Tedarikçi firma kullanıcısı ekle (Magic link gönderilecek)"""
    from sqlalchemy.exc import IntegrityError

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    # Sadece ekleyen kişi veya super admin kullanıcı ekleyebilsin
    # created_by_id null ise super admin ekleyebilir
    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Sadece ekleyen kişi kullanıcı ekleyebilir",
    )

    # Email benzersizliği (sadece aktif kullanıcılar kontrol edilecek)
    existing = (
        db.query(SupplierUser)
        .filter(SupplierUser.email == user_data.email, SupplierUser.is_active)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-mail zaten kayıtlı")

    # Magic token oluştur (24 saat geçerli)
    magic_token = secrets.token_urlsafe(32)
    magic_token_expires = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)

    supplier_user = SupplierUser(
        supplier_id=supplier_id,
        magic_token=magic_token,
        magic_token_expires=magic_token_expires,
        **user_data.model_dump(),
    )

    try:
        db.add(supplier_user)
        db.commit()
        db.refresh(supplier_user)
    except IntegrityError as e:
        db.rollback()
        if "email" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Bu e-mail adı zaten veritabanında kayıtlı. Lütfen silinmiş kayıtları temizleyin.",
            )
        raise HTTPException(status_code=400, detail=f"Veritabanı hatası: {str(e)}")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Kullanıcı oluşturma hatası: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Kullanıcı oluşturma hatası: {str(e)}"
        )

    if _get_default_user_id(db, supplier_id) is None:
        _set_default_user_id(db, supplier_id, supplier_user.id)

    # Magic link e-mail gönder (hata olsa da user oluşturulmuş kabul edilir)
    email_sent = False
    try:
        email_sent = email_service.send_magic_link(
            to_email=supplier_user.email,
            supplier_name=supplier.company_name,
            supplier_user_name=supplier_user.name,
            magic_token=magic_token,
            company_name="ProcureFlow",
            owner_user_id=supplier.created_by_id,
        )
        if email_sent:
            print(
                f"[INFO] ✅ Magic link emaili başarıyla gönderildi: {supplier_user.email}"
            )
        else:
            print(f"[WARNING] ⚠️ Magic link emaili gönderilemedi: {supplier_user.email}")
    except Exception as e:
        print(f"[ERROR] ❌ Email gönderme exception: {str(e)}")
        # Email göndermesi fail olsa bile user oluşturulmuş kabul edilir

    result = SupplierUserOut.model_validate(supplier_user, from_attributes=True)
    result.is_default = _get_default_user_id(db, supplier_id) == supplier_user.id
    return result


@router.get("/{supplier_id:int}/users", response_model=list[SupplierUserOut])
def list_supplier_users(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tedarikçi firma kullanıcılarını listele (silinmiş olanlar db'den silinmiş olur)"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    # Sadece mevcut kullanıcıları listele (silinmiş olanlar db'den completely kaldırıldı)
    users = db.query(SupplierUser).filter(SupplierUser.supplier_id == supplier_id).all()
    default_user_id = _get_default_user_id(db, supplier_id)
    response: list[SupplierUserOut] = []
    for item in users:
        row = SupplierUserOut.model_validate(item, from_attributes=True)
        row.is_default = default_user_id == item.id
        response.append(row)
    return response


@router.put("/{supplier_id:int}/users/{user_id}", response_model=SupplierUserOut)
def update_supplier_user(
    supplier_id: int,
    user_id: int,
    user_data: SupplierUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Tedarikçi firma kullanıcısını güncelle"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.id == user_id, SupplierUser.supplier_id == supplier_id)
        .first()
    )

    if not supplier_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    default_user_id = _get_default_user_id(db, supplier_id)
    if default_user_id == supplier_user.id:
        raise HTTPException(status_code=400, detail="Varsayılan yetkili değiştirilemez")

    # Sadece ekleyen kişi veya super admin güncelleyebilsin
    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Sadece ekleyen kişi güncelleyebilir",
    )

    # Email unique kontrol (email değiştirilirse, sadece aktif kullanıcılar)
    if user_data.email and user_data.email != supplier_user.email:
        existing = (
            db.query(SupplierUser)
            .filter(
                SupplierUser.email == user_data.email,
                SupplierUser.id != user_id,
                SupplierUser.is_active,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Bu e-mail zaten kayıtlı")

    # Güncellemeleri yapla
    payload = user_data.model_dump(exclude_unset=True)
    if "name" in payload:
        supplier_user.name = payload["name"]
    if "email" in payload:
        supplier_user.email = payload["email"]
        supplier_user.work_email = payload.get("work_email") or payload["email"]
    if "phone" in payload:
        supplier_user.phone = payload["phone"]
    if "is_active" in payload:
        supplier_user.is_active = bool(payload["is_active"])

    db.commit()
    db.refresh(supplier_user)

    result = SupplierUserOut.model_validate(supplier_user, from_attributes=True)
    result.is_default = False
    return result


@router.delete("/{supplier_id:int}/users/{user_id}")
def delete_supplier_user(
    supplier_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tedarikçi firma kullanıcısını sil (completely remove from database)"""
    try:
        supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

        supplier_user = (
            db.query(SupplierUser)
            .filter(SupplierUser.id == user_id, SupplierUser.supplier_id == supplier_id)
            .first()
        )

        if not supplier_user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        default_user_id = _get_default_user_id(db, supplier_id)
        if default_user_id == supplier_user.id:
            raise HTTPException(status_code=400, detail="Varsayılan yetkili silinemez")

        # Hard delete: Veritabanından tamamen sil (email tekrar kullanılabilir hale gelir)
        user_email = supplier_user.email
        db.delete(supplier_user)
        db.commit()

        print(f"[INFO] Kullanıcı silindi: {user_email} (ID: {user_id})")
        return {"status": "success", "message": "Kullanıcı başarıyla silindi"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Kullanıcı silme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Silme hatası: {str(e)}")


@router.post(
    "/{supplier_id:int}/users/{user_id}/resend-magic-link", response_model=dict
)
def resend_supplier_user_magic_link(
    supplier_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Tedarikçi kullanıcı için magic link'i yeniden üretip tekrar gönder."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.id == user_id, SupplierUser.supplier_id == supplier_id)
        .first()
    )
    if not supplier_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Magic link tekrar gönderme yetkiniz yok",
    )

    if not supplier_user.is_active:
        raise HTTPException(
            status_code=400, detail="Pasif kullanıcı için magic link gönderilemez"
        )

    if supplier_user.email_verified and supplier_user.password_set:
        raise HTTPException(
            status_code=409, detail="Kullanıcı kaydı tamamlanmış; magic link pasif"
        )

    magic_token = secrets.token_urlsafe(32)
    magic_token_expires = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)
    supplier_user.magic_token = magic_token
    supplier_user.magic_token_expires = magic_token_expires

    db.commit()
    db.refresh(supplier_user)

    email_sent = False
    try:
        email_sent = email_service.send_magic_link(
            to_email=supplier_user.email,
            supplier_name=supplier.company_name,
            supplier_user_name=supplier_user.name,
            magic_token=magic_token,
            company_name="ProcureFlow",
            owner_user_id=supplier.created_by_id,
        )
    except Exception:
        logger.exception("[SUPPLIER_MAGIC] Magic link yeniden gonderilemedi")
        email_sent = False

    return {
        "status": "success" if email_sent else "warning",
        "message": (
            "Magic link yeniden gönderildi"
            if email_sent
            else "Magic link yenilendi ancak e-posta gönderilemedi"
        ),
        "magic_link_sent": email_sent,
    }


@router.post("/{supplier_id:int}/users/{user_id}/set-default", response_model=dict)
def set_default_supplier_user(
    supplier_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Varsayılan şirket yetkilisini yalnızca admin belirleyebilir."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Varsayılan yetkiliyi sadece admin belirleyebilir",
    )

    supplier_user = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.id == user_id,
            SupplierUser.supplier_id == supplier_id,
            SupplierUser.is_active,
        )
        .first()
    )
    if not supplier_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    _set_default_user_id(db, supplier_id, supplier_user.id)
    return {
        "status": "success",
        "message": "Varsayılan yetkili güncellendi",
        "default_user_id": supplier_user.id,
    }


# ============ PROJECT-SUPPLIER ASSIGNMENT ============


@router.post("/projects/{project_id}/suppliers", response_model=dict)
def add_suppliers_to_project(
    project_id: int,
    supplier_ids: list[int] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Projeye tedarikçileri ekle ve davet maileri gönder"""
    print("\n[ENDPOINT] add_suppliers_to_project called")
    print(f"[ENDPOINT] project_id={project_id}, supplier_ids={supplier_ids}")
    print(f"[ENDPOINT] email_service={email_service}, type={type(email_service)}")
    current_role = normalized_role(current_user)
    print(f"[ENDPOINT] current_user.role={current_role}")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    # Yetki kontrol: global rol veya projeye atanmış satın alma sorumlusu
    is_project_member = any(p.id == project_id for p in current_user.projects)
    if not _is_global_supplier_manager(current_user) and not is_project_member:
        raise HTTPException(
            status_code=403,
            detail=f"Yetkiniz yok. Gerekli rol: {', '.join(sorted(GLOBAL_PROCUREMENT_MANAGER_ROLES))}. Mevcut rol: {current_role}",
        )

    assigned_count = 0
    email_failed_count = 0

    print(
        f"[ENDPOINT] Starting supplier assignment loop: {len(supplier_ids)} suppliers"
    )
    logger.info(
        f"[ASSIGNMENT] Starting assignment for {len(supplier_ids)} suppliers to project {project_id}"
    )

    for supplier_id in supplier_ids:
        print(f"[ENDPOINT] Processing supplier_id={supplier_id}")
        supplier = _get_visible_supplier_or_404(
            db,
            supplier_id,
            current_user,
            detail="Bu tedarikciyi projeye ekleme yetkiniz yok",
            allow_platform_network_for_tenant=True,
        )

        print(f"[ENDPOINT] Found supplier: {supplier.company_name} ({supplier.email})")

        # STEP 1: Zaten atanmış mı kontrol et
        existing = (
            db.query(ProjectSupplier)
            .filter(
                ProjectSupplier.project_id == project_id,
                ProjectSupplier.supplier_id == supplier_id,
            )
            .first()
        )

        if not existing:
            # İlk kez atanıyor - ProjectSupplier kaydı oluştur
            project_supplier = ProjectSupplier(
                project_id=project_id,
                supplier_id=supplier_id,
                assigned_by_id=current_user.id,
            )
            db.add(project_supplier)
            db.commit()
            db.refresh(project_supplier)
            assigned_count += 1
            print(
                f"[ENDPOINT] ✓ Supplier assigned to project. assigned_count={assigned_count}"
            )
        else:
            # Zaten atanmış, ama tekrar davet gönderebiliriz
            print(
                "[ENDPOINT] Supplier already assigned to project - will resend invitation"
            )
            project_supplier = existing

        # STEP 2: SupplierUser varsa güncelleyelim, yoksa oluşturalım
        supplier_user = (
            db.query(SupplierUser)
            .filter(SupplierUser.supplier_id == supplier_id)
            .first()
        )

        if not supplier_user:
            # İlk kez user oluşturuluyor
            print(f"[ENDPOINT] Creating SupplierUser for {supplier.company_name}")
            magic_token = secrets.token_urlsafe(32)
            magic_token_expires = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)

            supplier_user = SupplierUser(
                supplier_id=supplier_id,
                name=supplier.company_name,  # Default olarak firma adı kullan
                email=supplier.email,
                magic_token=magic_token,
                magic_token_expires=magic_token_expires,
                is_active=True,
            )
            db.add(supplier_user)
            try:
                db.commit()
                db.refresh(supplier_user)
                print(f"[ENDPOINT] ✓ SupplierUser created: {supplier_user.email}")
            except Exception as e:
                db.rollback()
                print(f"[ENDPOINT] ⚠️  SupplierUser create failed: {str(e)}")
                # Continue anyway, email server might still work
        else:
            # User zaten var - magic token'ı refresh edelim (tekrar davet için)
            print("[ENDPOINT] SupplierUser exists - refreshing magic token")
            if not supplier_user.password_set:
                # Henüz password set etmemiş, token'ı yenile
                magic_token = secrets.token_urlsafe(32)
                supplier_user.magic_token = magic_token
                supplier_user.magic_token_expires = datetime.now(
                    ZoneInfo("UTC")
                ) + timedelta(hours=24)
                db.commit()
                db.refresh(supplier_user)
                print("[ENDPOINT] ✓ Magic token refreshed")
            else:
                # Password set edilmiş - tekrar davet yollanamazız
                print("[ENDPOINT] ⚠️  User already registered, cannot resend magic link")

        # STEP 3: Email gönder (şifre durumuna göre different email)
        try:
            print(f"[EMAIL] Processing email for {supplier.email}")

            # Şifre set edilmiş mi kontrol et
            if not supplier_user.password_set:
                # Password set edilmemiş - magic link gönder
                print("[EMAIL] Password not set - sending magic link email")
                result = email_service.send_magic_link(
                    to_email=supplier_user.email,
                    supplier_name=supplier.company_name,
                    supplier_user_name=supplier_user.name,
                    magic_token=supplier_user.magic_token,
                    company_name="ProcureFlow",
                    owner_user_id=supplier.created_by_id,
                )
                email_type = "📝 Magic Link (Registration)"
            else:
                # Password set edilmiş - normal davet gönder
                print(
                    "[EMAIL] Password already set - sending normal project invitation"
                )
                result = email_service.send_project_invitation(
                    to_email=supplier.email,
                    supplier_name=supplier.company_name,
                    project_name=project.name,
                    company_name="ProcureFlow",
                )
                email_type = "📧 Project Invitation"

            print(f"[EMAIL] Result ({email_type}): {result}")
            logger.info(
                f"[ASSIGNMENT] Email result for {supplier.email}: {result} ({email_type})"
            )

            if result:
                project_supplier.invitation_sent = True
                project_supplier.invitation_sent_at = datetime.now(ZoneInfo("UTC"))
                db.commit()
                logger.info(f"[EMAIL] ✅ Email sent successfully ({email_type})")
            else:
                logger.warning(f"[EMAIL] Email send returned False ({email_type})")
                email_failed_count += 1
        except Exception as e:
            logger.exception(
                f"[EMAIL] Error sending email to {supplier.email}: {str(e)}"
            )
            print(f"[EMAIL] ❌ Error: {str(e)}")
            email_failed_count += 1

    result_msg = f"{assigned_count} tedarikçi projeye eklendi"
    if email_failed_count > 0:
        result_msg += f", {email_failed_count} email gönderilemedi"
    else:
        result_msg += ", tüm emailler gönderildi"

    logger.info(
        f"[ASSIGNMENT] Complete: assigned={assigned_count}, email_failed={email_failed_count}"
    )
    print(f"[ENDPOINT] Task completed: {result_msg}")

    return {
        "status": "success" if email_failed_count == 0 else "partial_success",
        "assigned": assigned_count,
        "email_failed": email_failed_count,
        "message": result_msg,
    }


@router.get("/projects/{project_id}/suppliers", response_model=list[dict])
def get_project_suppliers(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Projeye atanan tedarikçileri getir"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    # Yetki kontrol
    is_project_member = any(p.id == project_id for p in current_user.projects)
    if not _is_global_supplier_manager(current_user) and not is_project_member:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    project_suppliers = (
        db.query(ProjectSupplier).filter(ProjectSupplier.project_id == project_id).all()
    )

    result = []
    for ps in project_suppliers:
        result.append(
            {
                "id": ps.id,
                "supplier_id": ps.supplier_id,
                "supplier_name": ps.supplier.company_name,
                "supplier_email": ps.supplier.email,
                "source_type": ps.supplier.source_type,
                "category": ps.supplier.category,
                "category_tags": ps.supplier.category_tags,
                "partner_category_tags": ps.supplier.partner_category_tags,
                "effective_category_tags": ps.supplier.effective_category_tags,
                "is_active": ps.is_active,
                "invitation_sent": ps.invitation_sent,
                "invitation_sent_at": ps.invitation_sent_at,
                "assigned_at": ps.assigned_at,
            }
        )

    return result


@router.delete("/project-suppliers/{project_supplier_id}")
def remove_supplier_from_project(
    project_supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Projedeki tedarikçiyi kaldır"""
    project_supplier = (
        db.query(ProjectSupplier)
        .filter(ProjectSupplier.id == project_supplier_id)
        .first()
    )

    if not project_supplier:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")

    project = project_supplier.project
    is_project_member = any(p.id == project.id for p in current_user.projects)
    if not _is_global_supplier_manager(current_user) and not is_project_member:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    db.delete(project_supplier)
    db.commit()

    return {"status": "success", "message": "Tedarikçi projeden kaldırıldı"}


@router.post("/projects/{project_id}/suppliers/{supplier_id}/resend-invite")
def resend_supplier_invitation(
    project_id: int,
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Kendisine daha önce davet yollanmış olan tedarikçiye yeniden davet gönder"""

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")

    # Yetki kontrol
    is_project_member = any(p.id == project_id for p in current_user.projects)
    if not _is_global_supplier_manager(current_user) and not is_project_member:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    supplier = _get_visible_supplier_or_404(
        db,
        supplier_id,
        current_user,
        detail="Bu tedarikciye davetiye yeniden gonderme yetkiniz yok",
        allow_platform_network_for_tenant=True,
    )

    # ProjectSupplier kaydı var mı?
    project_supplier = (
        db.query(ProjectSupplier)
        .filter(
            ProjectSupplier.project_id == project_id,
            ProjectSupplier.supplier_id == supplier_id,
        )
        .first()
    )
    if not project_supplier:
        raise HTTPException(status_code=404, detail="Bu tedarikçi bu projeye atanmamış")

    # SupplierUser var mı?
    supplier_user = (
        db.query(SupplierUser).filter(SupplierUser.supplier_id == supplier_id).first()
    )

    if not supplier_user:
        raise HTTPException(
            status_code=400,
            detail="Bu tedarikçi için kullanıcı kaydı yok. Lütfen tekrar 'Davetiye Yolla' yapınız",
        )

    # Şifre durumuna göre email gönderme stratejisini belirle
    if not supplier_user.password_set:
        # Magic token'ı yenile
        magic_token = secrets.token_urlsafe(32)
        supplier_user.magic_token = magic_token
        supplier_user.magic_token_expires = datetime.now(ZoneInfo("UTC")) + timedelta(
            hours=24
        )
        db.commit()
        db.refresh(supplier_user)
        print(f"[RESEND] Refreshed magic token for supplier {supplier_id}")

        # Magic link email gönder
        email_type = "📝 Magic Link (Registration)"
        result = email_service.send_magic_link(
            to_email=supplier_user.email,
            supplier_name=supplier.company_name,
            supplier_user_name=supplier_user.name,
            magic_token=magic_token,
            company_name="ProcureFlow",
            owner_user_id=supplier.created_by_id,
        )
    else:
        # Password set edilmiş - normal project invitation gönder
        print("[RESEND] User already registered - sending project invitation")
        email_type = "📧 Project Invitation"
        result = email_service.send_project_invitation(
            to_email=supplier.email,
            supplier_name=supplier.company_name,
            project_name=project.name,
            company_name="ProcureFlow",
        )

    # Email gönder
    try:
        print(f"[RESEND_EMAIL] Sending {email_type} to {supplier.email}")
        if result:
            project_supplier.invitation_sent = True
            project_supplier.invitation_sent_at = datetime.now(ZoneInfo("UTC"))
            db.commit()
            logger.info(
                f"[RESEND] Email sent successfully to {supplier.email} ({email_type})"
            )
            return {
                "status": "success",
                "message": f"{supplier.company_name} adresine ({supplier.email}) davet yeniden gönderildi",
            }
        else:
            logger.warning(f"[RESEND] Email send returned False for {supplier.email}")
            return {
                "status": "partial_success",
                "message": "Email sunucusuna gönderilemedi. Lütfen tekrar deneyin.",
            }
    except Exception as e:
        logger.exception(f"[RESEND] Error sending email to {supplier.email}: {str(e)}")
        return {"status": "error", "message": f"Email göndermede hata: {str(e)}"}


# ============ SUPPLIER REGISTRATION (Magic Link) ============


@router.post("/verify-token")
def verify_magic_token(data: dict, db: Session = Depends(get_db)):
    """Magic token'ı doğrula ve firma bilgisini döndür"""
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token gerekli")

    supplier_user = (
        db.query(SupplierUser).filter(SupplierUser.magic_token == token).first()
    )

    if not supplier_user:
        raise HTTPException(status_code=404, detail="Token bulunamadı")

    # Token süresinin geçip geçmemesini kontrol et
    if supplier_user.magic_token_expires:
        expires = supplier_user.magic_token_expires
        expires_naive = (
            expires.replace(tzinfo=None)
            if hasattr(expires, "tzinfo") and expires.tzinfo
            else expires
        )
        if datetime.now() > expires_naive:
            raise HTTPException(status_code=400, detail="Token süresi dolmuş")

    supplier = supplier_user.supplier

    return {
        "company_name": supplier.company_name,
        "user_name": supplier_user.name,
        "email": supplier_user.email,
    }


@router.post("/register")
def register_supplier_user(
    data: dict,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
):
    """Tedarikçi kullanıcısı şifresi belirle ve active et"""
    from api.core.security import get_password_hash

    token = data.get("token")
    password = data.get("password")

    if not token or not password:
        raise HTTPException(status_code=400, detail="Token ve şifre gerekli")

    supplier_user = (
        db.query(SupplierUser).filter(SupplierUser.magic_token == token).first()
    )

    if not supplier_user:
        raise HTTPException(status_code=404, detail="Token bulunamadı")

    # Token süresinin geçip geçmemesini kontrol et
    if supplier_user.magic_token_expires:
        expires = supplier_user.magic_token_expires
        expires_naive = (
            expires.replace(tzinfo=None)
            if hasattr(expires, "tzinfo") and expires.tzinfo
            else expires
        )
        if datetime.now() > expires_naive:
            raise HTTPException(status_code=400, detail="Token süresi dolmuş")

    # Şifreyi hash'le ve kaydet
    supplier_user.hashed_password = get_password_hash(password)
    supplier_user.password_set = True
    supplier_user.email_verified = True
    supplier_user.is_active = True
    supplier_user.magic_token = None  # Token'ı sil (bir daha kullanılamaz)
    supplier_user.magic_token_expires = None

    work_mailbox_credentials = None
    try:
        work_mailbox_credentials = ensure_supplier_user_work_mailbox(db, supplier_user)
    except Exception:
        logger.exception("[SUPPLIER_REGISTER] Auto work mailbox provisioning failed")

    db.commit()
    db.refresh(supplier_user)

    if work_mailbox_credentials is not None:
        try:
            email_service.send_custom_email(
                to_email=supplier_user.email,
                subject="ProcureFlow Is Maili Bilgileriniz",
                body=(
                    "Merhaba,\n\n"
                    "Kaydiniz tamamlandi. Platform varsayilan SMTP/POP3/IMAP ayarlari icin otomatik bir is maili olusturuldu.\n\n"
                    f"Is maili: {work_mailbox_credentials['work_email']}\n"
                    f"Sifre: {work_mailbox_credentials['password']}\n\n"
                    "Not: Sisteme giris her zaman uye oldugunuz kisisel e-posta ve sifreniz ile yapilir.\n"
                    "Ozel SMTP/POP3/IMAP ayarlarinizi tanimlarsaniz mailbox islemleri bu ozel profil uzerinden calisir."
                ),
                owner_user_id=None,
            )
        except Exception:
            logger.exception("[SUPPLIER_REGISTER] Work mailbox credential email failed")

    return {
        "status": "success",
        "message": "Kaydınız tamamlandı. Lütfen giriş yapın.",
        "supplier_user_id": supplier_user.id,
    }


# ============ SUPPLIER DASHBOARD ============


@router.get("/my-firms", response_model=list[dict])
def get_my_supplier_firms(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Kullanıcının yetkili olduğu tedarikçi firmalarını listele.
    Şu an her kullanıcı bir firmaya bağlıdır; ileride çoklu firma desteği için liste döner."""
    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        return []
    return [
        {
            "id": supplier.id,
            "company_name": supplier.company_name or "",
            "email": supplier.email,
            "phone": supplier.phone,
            "logo_url": supplier.logo_url,
            "city": supplier.city,
            "is_current": True,
        }
    ]


@router.get("/dashboard/projects")
def get_supplier_dashboard_projects(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi paneli - atanmış projeleri getir"""
    # Bu tedarikçiye atanmış projeleri getir
    project_suppliers = (
        db.query(ProjectSupplier)
        .filter(
            ProjectSupplier.supplier_id == supplier_user.supplier_id,
            ProjectSupplier.is_active,
        )
        .all()
    )

    projects = []
    for ps in project_suppliers:
        project = ps.project

        supplier_quotes = (
            db.query(SupplierQuote)
            .join(Quote, Quote.id == SupplierQuote.quote_id)
            .filter(
                SupplierQuote.supplier_id == supplier_user.supplier_id,
                Quote.project_id == project.id,
            )
            .order_by(Quote.created_at.desc(), SupplierQuote.created_at.desc())
            .all()
        )

        latest_supplier_quote = supplier_quotes[0] if supplier_quotes else None
        latest_quote = latest_supplier_quote.quote if latest_supplier_quote else None

        project_files = (
            db.query(ProjectFile)
            .filter(ProjectFile.project_id == project.id)
            .order_by(ProjectFile.created_at.desc())
            .all()
        )

        company = project.company

        projects.append(
            {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "status": "active" if project.is_active else "inactive",
                "company": {
                    "id": company.id if company else None,
                    "name": company.name if company else "Firma bilgisi yok",
                    "logo_url": company.logo_url if company else None,
                },
                "quote": {
                    "id": latest_quote.id if latest_quote else None,
                    "title": latest_quote.title
                    if latest_quote
                    else "Teklif henüz oluşturulmadı",
                    "description": latest_quote.description if latest_quote else None,
                    "status": (
                        latest_quote.status.value
                        if latest_quote
                        and getattr(latest_quote, "status", None) is not None
                        and hasattr(latest_quote.status, "value")
                        else None
                    ),
                },
                "supplier_quote": {
                    "id": latest_supplier_quote.id if latest_supplier_quote else None,
                    "status": latest_supplier_quote.status
                    if latest_supplier_quote
                    else None,
                    "submitted": bool(
                        latest_supplier_quote
                        and str(latest_supplier_quote.status or "").lower()
                        == "yanıtlandı"
                    ),
                },
                "project_files": [
                    {
                        "id": f.id,
                        "name": f.original_filename,
                        "size": int(f.file_size or 0),
                        "file_type": f.file_type,
                    }
                    for f in project_files
                ],
                "quote_submitted": latest_supplier_quote is not None,
                "assigned_at": ps.assigned_at,
            }
        )

    return projects


# ============ SUPPLIER PROFILE (Tedarikçi Portal) ============


@router.post("/profile/logo", response_model=dict)
async def upload_supplier_logo(
    file: UploadFile = File(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi logosu yükle - dosya upload"""
    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    # Dosya tipi kontrolü
    allowed_types = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Sadece resim dosyaları yüklenebilir (JPEG, PNG, GIF, WebP, SVG)",
        )

    # Dosya boyutu kontrolü (2MB max)
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo dosyası 2MB'dan büyük olamaz")

    # Kayıt dizini
    upload_dir = os.path.join("uploads", "logos")
    os.makedirs(upload_dir, exist_ok=True)

    # Benzersiz dosya adı
    ext = os.path.splitext(file.filename or "logo.png")[1].lower() or ".png"
    filename = f"supplier_{supplier.id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(upload_dir, filename)

    # Eski logoyu sil
    if supplier.logo_url:
        old_path = supplier.logo_url.lstrip("/")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    # Yeni logoyu kaydet
    with open(file_path, "wb") as f:
        f.write(content)

    # DB'yi güncelle
    logo_url = f"/api/v1/suppliers/logo/{filename}"
    supplier.logo_url = logo_url
    supplier.updated_at = datetime.now(ZoneInfo("UTC"))
    db.commit()

    return {"status": "success", "logo_url": logo_url}


@router.get("/logo/{filename}")
def get_supplier_logo(filename: str):
    """Logo dosyasını sun - public endpoint"""
    # Güvenlik: path traversal önle
    safe_name = os.path.basename(filename)
    file_path = os.path.join("uploads", "logos", safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Logo bulunamadı")
    return FileResponse(file_path)


def _ensure_supplier_payment_tables(db: Session) -> None:
    if _is_postgresql(db):
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_payment_accounts (
                id BIGSERIAL PRIMARY KEY,
                supplier_id INTEGER NOT NULL,
                bank_key TEXT,
                bank_name TEXT NOT NULL,
                iban TEXT NOT NULL,
                account_type TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        )
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_check_settings (
                supplier_id INTEGER PRIMARY KEY,
                accepts_checks BOOLEAN DEFAULT FALSE,
                preferred_term TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        )
    else:
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_payment_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_id INTEGER NOT NULL,
                bank_key TEXT,
                bank_name TEXT NOT NULL,
                iban TEXT NOT NULL,
                account_type TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_check_settings (
                supplier_id INTEGER PRIMARY KEY,
                accepts_checks INTEGER DEFAULT 0,
                preferred_term TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
    db.commit()


def _get_supplier_payment_payload(db: Session, supplier_id: int) -> dict:
    _ensure_supplier_payment_tables(db)

    accounts = (
        db.execute(
            text("""
            SELECT id, bank_key, bank_name, iban, account_type
            FROM supplier_payment_accounts
            WHERE supplier_id = :supplier_id
            ORDER BY id ASC
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .all()
    )

    check_settings = (
        db.execute(
            text("""
            SELECT accepts_checks, preferred_term
            FROM supplier_check_settings
            WHERE supplier_id = :supplier_id
            LIMIT 1
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .first()
    )

    return {
        "payment_accounts": [
            {
                "id": int(account["id"]),
                "bank_key": account["bank_key"],
                "bank_name": account["bank_name"],
                "iban": account["iban"],
                "account_type": account["account_type"],
            }
            for account in accounts
        ],
        "accepts_checks": bool(check_settings["accepts_checks"])
        if check_settings
        else False,
        "preferred_check_term": str(check_settings["preferred_term"])
        if check_settings and check_settings["preferred_term"]
        else None,
    }


def _ensure_supplier_guarantees_table(db: Session) -> None:
    if _is_postgresql(db):
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_guarantees (
                id BIGSERIAL PRIMARY KEY,
                supplier_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                guarantee_type TEXT NOT NULL,
                amount DOUBLE PRECISION,
                currency TEXT DEFAULT 'TRY',
                issued_at TEXT,
                expires_at TEXT,
                status TEXT DEFAULT 'active',
                expired_notified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        )
    else:
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_guarantees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                guarantee_type TEXT NOT NULL,
                amount REAL,
                currency TEXT DEFAULT 'TRY',
                issued_at TEXT,
                expires_at TEXT,
                status TEXT DEFAULT 'active',
                expired_notified INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
    db.commit()


def _notify_expired_guarantees(
    db: Session, supplier_id: int, email_service, sms_service
) -> None:
    guarantees = (
        db.execute(
            text("""
            SELECT id, title, expires_at, expired_notified
            FROM supplier_guarantees
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .all()
    )

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    admin_user = (
        db.query(User).filter(User.id == supplier.created_by_id).first()
        if supplier
        else None
    )
    now = datetime.now(ZoneInfo("UTC"))

    for item in guarantees:
        expires_at_raw = item["expires_at"]
        if not expires_at_raw or int(item["expired_notified"] or 0) == 1:
            continue
        try:
            expires_at_dt = datetime.fromisoformat(str(expires_at_raw))
        except Exception:
            continue

        if now <= expires_at_dt:
            continue

        subject_title = str(item["title"])
        deadline_text = expires_at_dt.strftime("%d.%m.%Y")

        if supplier and supplier.email:
            email_service.send_quote_notification(
                to_email=supplier.email,
                supplier_name=supplier.company_name,
                quote_title=subject_title,
                deadline=deadline_text,
                quote_url=f"{email_service.app_url}/supplier/workspace?tab=guarantees",
                owner_user_id=getattr(admin_user, "id", None),
            )
        if admin_user and admin_user.email:
            email_service.send_quote_notification(
                to_email=admin_user.email,
                supplier_name=supplier.company_name if supplier else "Tedarikçi",
                quote_title=f"Teminat Süresi Doldu - {subject_title}",
                deadline=deadline_text,
                quote_url=f"{email_service.app_url}/admin",
                owner_user_id=admin_user.id,
            )

        if supplier and getattr(sms_service, "enabled", False):
            sms_text = f"{supplier.company_name} teminat suresi doldu: {subject_title} ({deadline_text})"
            sms_targets: list[str] = []
            if supplier.phone:
                sms_targets.append(supplier.phone)
            if admin_user and getattr(admin_user, "phone", None):
                sms_targets.append(str(admin_user.phone))
            for target in sms_targets:
                sms_service.send_sms(target, sms_text)

        db.execute(
            text("""
                UPDATE supplier_guarantees
                SET status = 'expired', expired_notified = 1
                WHERE id = :id
            """),
            {"id": int(item["id"])},
        )

    db.commit()


@router.get("/profile", response_model=dict)
def get_supplier_profile(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi profil bilgilerini getir"""
    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")
    payment_payload = _get_supplier_payment_payload(db, supplier.id)
    default_user_id = _get_default_user_id(db, supplier.id)
    company_users = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.supplier_id == supplier.id,
            SupplierUser.is_active,
        )
        .order_by(SupplierUser.id.asc())
        .all()
    )

    return {
        "supplier": {
            "id": supplier.id,
            "company_name": supplier.company_name,
            "email": supplier.email,
            "phone": supplier.phone,
            "website": supplier.website,
            "category": supplier.category,
            "category_tags": supplier.category_tags,
            "partner_category_tags": supplier.partner_category_tags,
            "effective_category_tags": supplier.effective_category_tags,
            "address": supplier.address,
            "city": supplier.city,
            "address_district": supplier.address_district,
            "postal_code": supplier.postal_code,
            "logo_url": supplier.logo_url,
            "tax_number": supplier.tax_number,
            "tax_office": supplier.tax_office,
            "registration_number": supplier.registration_number,
            "invoice_name": supplier.invoice_name,
            "invoice_address": supplier.invoice_address,
            "invoice_city": supplier.invoice_city,
            "invoice_district": supplier.invoice_district,
            "invoice_postal_code": supplier.invoice_postal_code,
            "notes": supplier.notes,
            "payment_accounts": payment_payload["payment_accounts"],
            "accepts_checks": payment_payload["accepts_checks"],
            "preferred_check_term": payment_payload["preferred_check_term"],
            "authorized_users": [
                {
                    "id": item.id,
                    "name": item.name,
                    "email": item.email,
                    "phone": item.phone,
                    "is_default": item.id == default_user_id,
                }
                for item in company_users
            ],
            "authorized_users_count": len(company_users),
            "default_user_id": default_user_id,
        },
        "user": {
            "id": supplier_user.id,
            "name": supplier_user.name,
            "email": supplier_user.email,
            "work_email": supplier_user.work_email,
            "phone": supplier_user.phone,
            "created_at": supplier_user.created_at,
            "email_verified": supplier_user.email_verified,
        },
    }


@router.put("/profile", response_model=dict)
def update_supplier_profile(
    update_data: dict,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi profil bilgilerini güncelle"""
    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    # Supplier bilgileri güncelle (email, phone, logo vb)
    supplier_updates = {
        "website": update_data.get("supplier_website"),
        "address": update_data.get("address"),
        "city": update_data.get("city"),
        "address_district": update_data.get("address_district"),
        "postal_code": update_data.get("postal_code"),
        "tax_number": update_data.get("tax_number"),
        "tax_office": update_data.get("tax_office"),
        "registration_number": update_data.get("registration_number"),
        "invoice_name": update_data.get("invoice_name"),
        "invoice_address": update_data.get("invoice_address"),
        "invoice_city": update_data.get("invoice_city"),
        "invoice_district": update_data.get("invoice_district"),
        "invoice_postal_code": update_data.get("invoice_postal_code"),
        "notes": update_data.get("notes"),
    }

    for key, value in supplier_updates.items():
        if value is not None:
            setattr(supplier, key, value)

    if "category_tags" in update_data:
        _set_supplier_category_fields(
            supplier,
            category_tags=_normalize_category_items(update_data.get("category_tags")),
        )

    supplier.updated_at = datetime.now(ZoneInfo("UTC"))

    # SupplierUser bilgileri güncelle (name, phone)
    if "user_name" in update_data and update_data.get("user_name") is not None:
        supplier_user.name = str(update_data.get("user_name"))
    if "user_work_email" in update_data:
        supplier_user.work_email = (
            str(update_data.get("user_work_email") or "").strip().lower() or None
        )
    if "user_phone" in update_data and update_data.get("user_phone") is not None:
        supplier_user.phone = update_data.get("user_phone")

    _ensure_supplier_payment_tables(db)
    payment_accounts = update_data.get("payment_accounts")
    if payment_accounts is not None:
        if not isinstance(payment_accounts, list):
            raise HTTPException(
                status_code=400, detail="Ödeme hesapları liste formatında olmalıdır"
            )

        normalized_accounts: list[dict] = []
        for item in payment_accounts:
            if not isinstance(item, dict):
                raise HTTPException(status_code=400, detail="Geçersiz hesap kaydı")

            bank_name = str(item.get("bank_name") or "").strip()
            iban = str(item.get("iban") or "").replace(" ", "").upper()
            account_type = str(item.get("account_type") or "").strip().lower()
            bank_key = str(item.get("bank_key") or "").strip().lower() or None

            if not bank_name:
                raise HTTPException(status_code=400, detail="Banka adı zorunludur")
            if not iban or len(iban) < 15 or len(iban) > 34 or not iban.isalnum():
                raise HTTPException(status_code=400, detail="Geçerli bir IBAN girin")
            if account_type not in {"tl", "doviz"}:
                raise HTTPException(
                    status_code=400, detail="Hesap tipi TL veya Döviz olmalıdır"
                )

            normalized_accounts.append(
                {
                    "bank_key": bank_key,
                    "bank_name": bank_name,
                    "iban": iban,
                    "account_type": account_type,
                }
            )

        db.execute(
            text(
                "DELETE FROM supplier_payment_accounts WHERE supplier_id = :supplier_id"
            ),
            {"supplier_id": supplier.id},
        )
        for account in normalized_accounts:
            db.execute(
                text("""
                    INSERT INTO supplier_payment_accounts (supplier_id, bank_key, bank_name, iban, account_type)
                    VALUES (:supplier_id, :bank_key, :bank_name, :iban, :account_type)
                """),
                {
                    "supplier_id": supplier.id,
                    **account,
                },
            )

    accepts_checks = update_data.get("accepts_checks")
    preferred_check_term = update_data.get("preferred_check_term")
    if accepts_checks is not None or preferred_check_term is not None:
        accepts_checks_bool = bool(accepts_checks)
        preferred_term = str(preferred_check_term or "").strip() or None

        if not accepts_checks_bool:
            preferred_term = None

        db.execute(
            text("""
                INSERT INTO supplier_check_settings (supplier_id, accepts_checks, preferred_term, updated_at)
                VALUES (:supplier_id, :accepts_checks, :preferred_term, :updated_at)
                ON CONFLICT(supplier_id) DO UPDATE SET
                    accepts_checks = excluded.accepts_checks,
                    preferred_term = excluded.preferred_term,
                    updated_at = excluded.updated_at
            """),
            {
                "supplier_id": supplier.id,
                "accepts_checks": 1 if accepts_checks_bool else 0,
                "preferred_term": preferred_term,
                "updated_at": datetime.now(ZoneInfo("UTC")).isoformat(),
            },
        )

    supplier_user.updated_at = datetime.now(ZoneInfo("UTC"))

    db.commit()

    return {"status": "success", "message": "Profil başarıyla güncellendi"}


@router.put("/profile/users/{user_id}", response_model=dict)
def update_supplier_profile_user(
    user_id: int,
    user_data: dict,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Varsayılan yetkili kendi şirketindeki diğer yetkilileri güncelleyebilir."""
    default_user_id = _get_default_user_id(db, supplier_user.supplier_id)
    if default_user_id != supplier_user.id:
        raise HTTPException(
            status_code=403,
            detail="Sadece varsayılan yetkili kullanıcıları düzenleyebilir",
        )

    target_user = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.id == user_id,
            SupplierUser.supplier_id == supplier_user.supplier_id,
            SupplierUser.is_active,
        )
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if target_user.id == default_user_id:
        raise HTTPException(status_code=400, detail="Varsayılan yetkili değiştirilemez")

    next_name = str(user_data.get("name") or "").strip()
    next_email = str(user_data.get("email") or "").strip().lower()
    next_phone = str(user_data.get("phone") or "").strip() or None
    if not next_name or not next_email:
        raise HTTPException(status_code=400, detail="Ad ve e-posta zorunludur")

    existing = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.email == next_email,
            SupplierUser.id != target_user.id,
            SupplierUser.is_active,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Bu e-posta başka bir kullanıcıda kayıtlı"
        )

    target_user.name = next_name
    target_user.email = next_email
    target_user.phone = next_phone
    target_user.updated_at = datetime.now(ZoneInfo("UTC"))
    db.commit()

    return {
        "status": "success",
        "message": "Kullanıcı güncellendi",
    }


@router.delete("/profile/users/{user_id}", response_model=dict)
def delete_supplier_profile_user(
    user_id: int,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Varsayılan yetkili kendi şirketindeki varsayılan olmayan kullanıcıları silebilir."""
    default_user_id = _get_default_user_id(db, supplier_user.supplier_id)
    if default_user_id != supplier_user.id:
        raise HTTPException(
            status_code=403, detail="Sadece varsayılan yetkili kullanıcı silebilir"
        )

    target_user = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.id == user_id,
            SupplierUser.supplier_id == supplier_user.supplier_id,
            SupplierUser.is_active,
        )
        .first()
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if target_user.id == default_user_id:
        raise HTTPException(status_code=400, detail="Varsayılan yetkili silinemez")

    db.delete(target_user)
    db.commit()
    return {
        "status": "success",
        "message": "Kullanıcı silindi",
    }


def _ensure_supplier_documents_table(db: Session) -> None:
    if _is_postgresql(db):
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_documents (
                id BIGSERIAL PRIMARY KEY,
                supplier_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_url TEXT NOT NULL,
                file_size INTEGER,
                content_type TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        )
    else:
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_url TEXT NOT NULL,
                file_size INTEGER,
                content_type TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
    db.commit()


@router.post("/profile/documents/{category}", response_model=dict)
async def upload_supplier_document(
    category: str,
    file: UploadFile = File(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi doküman yükleme (sertifika, şirket evrakı, personel evrakı)."""
    allowed_categories = {
        "certificates",
        "company_docs",
        "personnel_docs",
        "guarantee_docs",
    }
    if category not in allowed_categories:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")

    allowed_content_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    }
    allowed_exts = {".pdf", ".jpeg", ".jpg", ".png", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if (file.content_type not in allowed_content_types) and (ext not in allowed_exts):
        raise HTTPException(
            status_code=400,
            detail="Sadece PDF, JPEG, PNG ve WEBP dosyaları yüklenebilir",
        )

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")

    upload_dir = os.path.join("uploads", "supplier_docs", str(supplier.id), category)
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "document.bin")[1].lower() or ".bin"
    stored_filename = f"doc_{supplier.id}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(upload_dir, stored_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/api/v1/suppliers/documents/file/{stored_filename}?supplier_id={supplier.id}&category={category}"

    _ensure_supplier_documents_table(db)
    db.execute(
        text("""
            INSERT INTO supplier_documents (
                supplier_id, category, original_filename, stored_filename,
                file_path, file_url, file_size, content_type
            )
            VALUES (
                :supplier_id, :category, :original_filename, :stored_filename,
                :file_path, :file_url, :file_size, :content_type
            )
        """),
        {
            "supplier_id": supplier.id,
            "category": category,
            "original_filename": file.filename or stored_filename,
            "stored_filename": stored_filename,
            "file_path": file_path,
            "file_url": file_url,
            "file_size": len(content),
            "content_type": file.content_type,
        },
    )
    db.commit()

    row = db.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()

    return {
        "status": "success",
        "document": {
            "id": row["id"] if row else None,
            "category": category,
            "original_filename": file.filename or stored_filename,
            "file_url": file_url,
            "created_at": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    }


@router.get("/profile/documents", response_model=dict)
def list_supplier_documents(
    category: str | None = None,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçiye ait yüklenen dokümanları listele."""
    _ensure_supplier_documents_table(db)

    sql = """
        SELECT id, category, original_filename, stored_filename, file_url,
               file_size, content_type, created_at
        FROM supplier_documents
        WHERE supplier_id = :supplier_id
    """
    params: dict[str, object] = {"supplier_id": supplier_user.supplier_id}
    if category:
        sql += " AND category = :category"
        params["category"] = category
    sql += " ORDER BY id DESC"

    rows = db.execute(text(sql), params).mappings().all()
    docs = [dict(r) for r in rows]
    return {"documents": docs}


@router.delete("/profile/documents/{document_id}", response_model=dict)
def delete_supplier_profile_document(
    document_id: int,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Tedarikçi kendi dokümanını siler."""
    _ensure_supplier_documents_table(db)
    doc = (
        db.execute(
            text("""
            SELECT id, file_path
            FROM supplier_documents
            WHERE id = :document_id AND supplier_id = :supplier_id
            LIMIT 1
        """),
            {"document_id": document_id, "supplier_id": supplier_user.supplier_id},
        )
        .mappings()
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Doküman bulunamadı")

    file_path = str(doc["file_path"] or "")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.execute(
        text("""
            DELETE FROM supplier_documents
            WHERE id = :document_id AND supplier_id = :supplier_id
        """),
        {"document_id": document_id, "supplier_id": supplier_user.supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Doküman silindi"}


@router.get("/{supplier_id:int}/documents", response_model=dict)
def list_supplier_documents_admin(
    supplier_id: int,
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından tedarikçi dokümanlarını listele."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi dokümanlarını görüntüleme yetkiniz yok",
    )

    _ensure_supplier_documents_table(db)
    sql = """
        SELECT id, category, original_filename, stored_filename, file_url,
               file_size, content_type, created_at
        FROM supplier_documents
        WHERE supplier_id = :supplier_id
    """
    params: dict[str, object] = {"supplier_id": supplier_id}
    if category:
        sql += " AND category = :category"
        params["category"] = category
    sql += " ORDER BY id DESC"

    rows = db.execute(text(sql), params).mappings().all()
    return {"documents": [dict(r) for r in rows]}


@router.post("/{supplier_id:int}/documents/{category}", response_model=dict)
async def upload_supplier_document_admin(
    supplier_id: int,
    category: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından tedarikçi dokümanı yükleme."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için doküman yükleme yetkiniz yok",
    )

    allowed_categories = {
        "certificates",
        "company_docs",
        "personnel_docs",
        "guarantee_docs",
    }
    if category not in allowed_categories:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")

    allowed_content_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    }
    allowed_exts = {".pdf", ".jpeg", ".jpg", ".png", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if (file.content_type not in allowed_content_types) and (ext not in allowed_exts):
        raise HTTPException(
            status_code=400,
            detail="Sadece PDF, JPEG, PNG ve WEBP dosyaları yüklenebilir",
        )

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")

    upload_dir = os.path.join("uploads", "supplier_docs", str(supplier.id), category)
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "document.bin")[1].lower() or ".bin"
    stored_filename = f"doc_{supplier.id}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(upload_dir, stored_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"/api/v1/suppliers/documents/file/{stored_filename}?supplier_id={supplier.id}&category={category}"

    _ensure_supplier_documents_table(db)
    db.execute(
        text("""
            INSERT INTO supplier_documents (
                supplier_id, category, original_filename, stored_filename,
                file_path, file_url, file_size, content_type
            )
            VALUES (
                :supplier_id, :category, :original_filename, :stored_filename,
                :file_path, :file_url, :file_size, :content_type
            )
        """),
        {
            "supplier_id": supplier.id,
            "category": category,
            "original_filename": file.filename or stored_filename,
            "stored_filename": stored_filename,
            "file_path": file_path,
            "file_url": file_url,
            "file_size": len(content),
            "content_type": file.content_type,
        },
    )
    db.commit()

    row = db.execute(text("SELECT last_insert_rowid() AS id")).mappings().first()
    return {
        "status": "success",
        "document": {
            "id": row["id"] if row else None,
            "category": category,
            "original_filename": file.filename or stored_filename,
            "file_url": file_url,
            "created_at": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    }


@router.delete("/{supplier_id:int}/documents/{document_id}", response_model=dict)
def delete_supplier_document_admin(
    supplier_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin tarafından tedarikçi dokümanı sil."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi dokümanlarını silme yetkiniz yok",
    )

    _ensure_supplier_documents_table(db)
    doc = (
        db.execute(
            text("""
            SELECT id, file_path
            FROM supplier_documents
            WHERE id = :document_id AND supplier_id = :supplier_id
            LIMIT 1
        """),
            {"document_id": document_id, "supplier_id": supplier_id},
        )
        .mappings()
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Doküman bulunamadı")

    file_path = str(doc["file_path"] or "")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    db.execute(
        text("""
            DELETE FROM supplier_documents
            WHERE id = :document_id AND supplier_id = :supplier_id
        """),
        {"document_id": document_id, "supplier_id": supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Doküman silindi"}


@router.post("/{supplier_id:int}/contact-email", response_model=dict)
async def send_supplier_contact_email_admin(
    supplier_id: int,
    to_email: str = Form(...),
    subject: str = Form(...),
    body: str = Form(""),
    cc: str | None = Form(None),
    attachments: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    email_service=Depends(get_email_service),
):
    """Admin panelinden tedarikçiye e-posta gönder (opsiyonel eklerle)."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için e-posta gönderme yetkiniz yok",
    )

    payload_attachments: list[tuple[str, str, bytes]] = []
    total_size = 0
    for upload in attachments or []:
        content = await upload.read()
        total_size += len(content)
        if total_size > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=400, detail="Toplam ek boyutu 20MB sınırını aşamaz"
            )
        filename = (upload.filename or "ek").strip() or "ek"
        content_type = upload.content_type or "application/octet-stream"
        payload_attachments.append((filename, content_type, content))

    email_sent = email_service.send_custom_email(
        to_email=to_email,
        subject=subject,
        body=body,
        cc=cc,
        attachments=payload_attachments,
    )
    if not email_sent:
        raise HTTPException(status_code=500, detail="E-posta gönderilemedi")

    return {"status": "success", "message": "E-posta gönderildi"}


@router.get("/{supplier_id:int}/documents/file/{filename}")
def download_supplier_document_file_admin(
    supplier_id: int,
    filename: str,
    category: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin tarafından supplier doküman dosyasını indir/aç."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu dosyaya erişim izniniz yok",
    )

    safe_name = os.path.basename(filename)
    file_path = os.path.join(
        "uploads", "supplier_docs", str(supplier_id), category, safe_name
    )
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    return FileResponse(file_path)


@router.get("/documents/file/{filename}")
def download_supplier_document_file(
    filename: str,
    supplier_id: int,
    category: str,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
):
    """Supplier doküman dosyasını güvenli şekilde indir."""
    if supplier_user.supplier_id != supplier_id:
        raise HTTPException(status_code=403, detail="Bu dosyaya erişim izniniz yok")

    safe_name = os.path.basename(filename)
    file_path = os.path.join(
        "uploads", "supplier_docs", str(supplier_id), category, safe_name
    )
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    return FileResponse(file_path)


@router.get("/profile/contracts", response_model=dict)
def list_supplier_contracts(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Supplier'ın yaptığı sözleşmeleri listele."""
    contracts = (
        db.query(Contract)
        .filter(Contract.supplier_id == supplier_user.supplier_id)
        .order_by(Contract.created_at.desc())
        .all()
    )

    return {
        "contracts": [
            {
                "id": c.id,
                "quote_id": c.quote_id,
                "contract_number": c.contract_number,
                "status": c.status,
                "final_amount": _num_to_float(c.final_amount)
                if c.final_amount is not None
                else None,
                "created_at": c.created_at,
            }
            for c in contracts
        ]
    }


def _ensure_supplier_finance_tables(db: Session) -> None:
    global _SUPPLIER_FINANCE_SCHEMA_READY

    if _SUPPLIER_FINANCE_SCHEMA_READY:
        return

    with _SUPPLIER_FINANCE_SCHEMA_LOCK:
        if _SUPPLIER_FINANCE_SCHEMA_READY:
            return

        if _is_postgresql(db):
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_invoices (
                    id BIGSERIAL PRIMARY KEY,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    invoice_number TEXT,
                    invoice_date TEXT,
                    amount DOUBLE PRECISION NOT NULL,
                    currency TEXT DEFAULT 'TRY',
                    file_path TEXT,
                    file_url TEXT,
                    notes TEXT,
                    created_by_user_id INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            )
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_payments (
                    id BIGSERIAL PRIMARY KEY,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    payment_date TEXT,
                    amount DOUBLE PRECISION NOT NULL,
                    currency TEXT DEFAULT 'TRY',
                    method TEXT,
                    notes TEXT,
                    created_by_user_id INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            )
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_photos (
                    id BIGSERIAL PRIMARY KEY,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_url TEXT NOT NULL,
                    description TEXT,
                    created_by_user_id INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            )
        else:
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_invoices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    invoice_number TEXT,
                    invoice_date TEXT,
                    amount REAL NOT NULL,
                    currency TEXT DEFAULT 'TRY',
                    file_path TEXT,
                    file_url TEXT,
                    notes TEXT,
                    created_by_user_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    payment_date TEXT,
                    amount REAL NOT NULL,
                    currency TEXT DEFAULT 'TRY',
                    method TEXT,
                    notes TEXT,
                    created_by_user_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS supplier_finance_photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id INTEGER NOT NULL,
                    contract_id INTEGER,
                    title TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_url TEXT NOT NULL,
                    description TEXT,
                    created_by_user_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )

        db.commit()
        _SUPPLIER_FINANCE_SCHEMA_READY = True


def _build_supplier_finance_summary(db: Session, supplier_id: int) -> dict:
    _ensure_supplier_finance_tables(db)

    signed_contracts = (
        db.query(Contract)
        .filter(
            Contract.supplier_id == supplier_id,
            Contract.status.in_(["signed", "completed"]),
        )
        .order_by(Contract.created_at.desc())
        .all()
    )

    invoices = (
        db.execute(
            text("""
            SELECT id, supplier_id, contract_id, title, invoice_number, invoice_date,
                   amount, currency, file_url, notes, created_at
            FROM supplier_finance_invoices
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .all()
    )

    payments = (
        db.execute(
            text("""
            SELECT id, supplier_id, contract_id, title, payment_date,
                   amount, currency, method, notes, created_at
            FROM supplier_finance_payments
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .all()
    )

    photos = (
        db.execute(
            text("""
            SELECT id, supplier_id, contract_id, title, file_url, description, created_at
            FROM supplier_finance_photos
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier_id},
        )
        .mappings()
        .all()
    )

    contract_total = sum(_num_to_float(c.final_amount) for c in signed_contracts)
    invoice_total = float(sum(float(r["amount"] or 0) for r in invoices))
    payment_total = float(sum(float(r["amount"] or 0) for r in payments))

    alerts: list[str] = []
    if contract_total > 0 and invoice_total > (contract_total + 0.01):
        alerts.append("Fatura toplamı sözleşme toplamını aşıyor.")
    if contract_total > 0 and payment_total > (contract_total + 0.01):
        alerts.append("Ödeme toplamı sözleşme toplamını aşıyor.")
    if abs(invoice_total - payment_total) > 0.01:
        alerts.append("Fatura toplamı ile ödeme toplamı arasında fark var.")

    return {
        "contracts": [
            {
                "id": c.id,
                "quote_id": c.quote_id,
                "contract_number": c.contract_number,
                "status": c.status,
                "final_amount": _num_to_float(c.final_amount)
                if c.final_amount is not None
                else 0,
                "signed_at": c.signed_at,
                "created_at": c.created_at,
            }
            for c in signed_contracts
        ],
        "invoices": [dict(r) for r in invoices],
        "payments": [dict(r) for r in payments],
        "photos": [dict(r) for r in photos],
        "totals": {
            "contract_total": contract_total,
            "invoice_total": invoice_total,
            "payment_total": payment_total,
            "delta_invoice_vs_contract": round(invoice_total - contract_total, 2),
            "delta_payment_vs_contract": round(payment_total - contract_total, 2),
            "delta_payment_vs_invoice": round(payment_total - invoice_total, 2),
        },
        "alerts": alerts,
    }


def _apply_finance_filters(
    rows: list[dict],
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    date_key: str = "created_at",
) -> list[dict]:
    query_l = (query or "").strip().lower()

    def _in_date_range(row: dict) -> bool:
        value = row.get(date_key) or row.get("created_at")
        if not (date_from or date_to):
            return True
        if not value:
            return False
        date_text = str(value)[:10]
        if date_from and date_text < date_from:
            return False
        if date_to and date_text > date_to:
            return False
        return True

    filtered = []
    for row in rows:
        if query_l:
            haystack = " ".join(str(v or "") for v in row.values()).lower()
            if query_l not in haystack:
                continue
        if not _in_date_range(row):
            continue
        filtered.append(row)
    return filtered


def _require_supplier_access_for_finance(
    db: Session, supplier_id: int, current_user: User
) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")
    _ensure_supplier_creator_access(
        supplier,
        current_user,
        detail="Bu tedarikçi için yetkiniz yok",
    )
    return supplier


@router.get("/profile/finance-summary", response_model=dict)
def get_supplier_finance_summary(
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    summary = _build_supplier_finance_summary(db, supplier_user.supplier_id)
    summary["invoices"] = _apply_finance_filters(
        summary["invoices"],
        query=query,
        date_from=date_from,
        date_to=date_to,
        date_key="invoice_date",
    )
    summary["payments"] = _apply_finance_filters(
        summary["payments"],
        query=query,
        date_from=date_from,
        date_to=date_to,
        date_key="payment_date",
    )
    summary["photos"] = _apply_finance_filters(
        summary["photos"], query=query, date_from=date_from, date_to=date_to
    )
    return summary


@router.post("/profile/finance/invoices", response_model=dict)
async def create_supplier_finance_invoice(
    title: str = Form(...),
    amount: float = Form(...),
    contract_id: int | None = Form(None),
    invoice_number: str | None = Form(None),
    invoice_date: str | None = Form(None),
    currency: str = Form("TRY"),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tutar 0'dan büyük olmalıdır")

    file_path = None
    file_url = None
    if file:
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")
        ext = os.path.splitext(file.filename or "invoice.bin")[1].lower() or ".bin"
        folder = os.path.join(
            "uploads", "supplier_finance", str(supplier_user.supplier_id), "invoices"
        )
        os.makedirs(folder, exist_ok=True)
        stored = f"invoice_{supplier_user.supplier_id}_{uuid.uuid4().hex[:12]}{ext}"
        file_path = os.path.join(folder, stored)
        with open(file_path, "wb") as out:
            out.write(content)
        file_url = (
            f"/uploads/supplier_finance/{supplier_user.supplier_id}/invoices/{stored}"
        )

    db.execute(
        text("""
            INSERT INTO supplier_finance_invoices (
                supplier_id, contract_id, title, invoice_number, invoice_date,
                amount, currency, file_path, file_url, notes, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :invoice_number, :invoice_date,
                :amount, :currency, :file_path, :file_url, :notes, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_user.supplier_id,
            "contract_id": contract_id,
            "title": title,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "amount": amount,
            "currency": currency.upper() if currency else "TRY",
            "file_path": file_path,
            "file_url": file_url,
            "notes": notes,
            "created_by_user_id": supplier_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "Fatura kaydedildi"}


@router.post("/profile/finance/payments", response_model=dict)
def create_supplier_finance_payment(
    payload: dict = Body(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tutar 0'dan büyük olmalıdır")

    db.execute(
        text("""
            INSERT INTO supplier_finance_payments (
                supplier_id, contract_id, title, payment_date, amount,
                currency, method, notes, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :payment_date, :amount,
                :currency, :method, :notes, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_user.supplier_id,
            "contract_id": payload.get("contract_id"),
            "title": payload.get("title") or "Ödeme",
            "payment_date": payload.get("payment_date"),
            "amount": amount,
            "currency": (payload.get("currency") or "TRY").upper(),
            "method": payload.get("method"),
            "notes": payload.get("notes"),
            "created_by_user_id": supplier_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "Ödeme kaydedildi"}


@router.post("/profile/finance/photos", response_model=dict)
async def create_supplier_finance_photo(
    title: str = Form(...),
    contract_id: int | None = Form(None),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")

    ext = os.path.splitext(file.filename or "photo.bin")[1].lower() or ".bin"
    folder = os.path.join(
        "uploads", "supplier_finance", str(supplier_user.supplier_id), "photos"
    )
    os.makedirs(folder, exist_ok=True)
    stored = f"photo_{supplier_user.supplier_id}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(folder, stored)
    with open(file_path, "wb") as out:
        out.write(content)
    file_url = f"/uploads/supplier_finance/{supplier_user.supplier_id}/photos/{stored}"

    db.execute(
        text("""
            INSERT INTO supplier_finance_photos (
                supplier_id, contract_id, title, file_path, file_url,
                description, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :file_path, :file_url,
                :description, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_user.supplier_id,
            "contract_id": contract_id,
            "title": title,
            "file_path": file_path,
            "file_url": file_url,
            "description": description,
            "created_by_user_id": supplier_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "İş fotoğrafı kaydedildi"}


@router.get("/{supplier_id:int}/finance-summary", response_model=dict)
def get_supplier_finance_summary_admin(
    supplier_id: int,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    summary = _build_supplier_finance_summary(db, supplier_id)
    summary["invoices"] = _apply_finance_filters(
        summary["invoices"],
        query=query,
        date_from=date_from,
        date_to=date_to,
        date_key="invoice_date",
    )
    summary["payments"] = _apply_finance_filters(
        summary["payments"],
        query=query,
        date_from=date_from,
        date_to=date_to,
        date_key="payment_date",
    )
    summary["photos"] = _apply_finance_filters(
        summary["photos"], query=query, date_from=date_from, date_to=date_to
    )
    return summary


@router.post("/{supplier_id:int}/finance/invoices", response_model=dict)
async def create_supplier_finance_invoice_admin(
    supplier_id: int,
    title: str = Form(...),
    amount: float = Form(...),
    contract_id: int | None = Form(None),
    invoice_number: str | None = Form(None),
    invoice_date: str | None = Form(None),
    currency: str = Form("TRY"),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)

    _ensure_supplier_finance_tables(db)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tutar 0'dan büyük olmalıdır")

    file_path = None
    file_url = None
    if file:
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")
        ext = os.path.splitext(file.filename or "invoice.bin")[1].lower() or ".bin"
        folder = os.path.join(
            "uploads", "supplier_finance", str(supplier_id), "invoices"
        )
        os.makedirs(folder, exist_ok=True)
        stored = f"invoice_{supplier_id}_{uuid.uuid4().hex[:12]}{ext}"
        file_path = os.path.join(folder, stored)
        with open(file_path, "wb") as out:
            out.write(content)
        file_url = f"/uploads/supplier_finance/{supplier_id}/invoices/{stored}"

    db.execute(
        text("""
            INSERT INTO supplier_finance_invoices (
                supplier_id, contract_id, title, invoice_number, invoice_date,
                amount, currency, file_path, file_url, notes, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :invoice_number, :invoice_date,
                :amount, :currency, :file_path, :file_url, :notes, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_id,
            "contract_id": contract_id,
            "title": title,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "amount": amount,
            "currency": currency.upper() if currency else "TRY",
            "file_path": file_path,
            "file_url": file_url,
            "notes": notes,
            "created_by_user_id": current_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "Fatura kaydedildi"}


@router.post("/{supplier_id:int}/finance/payments", response_model=dict)
def create_supplier_finance_payment_admin(
    supplier_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)

    _ensure_supplier_finance_tables(db)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Tutar 0'dan büyük olmalıdır")

    db.execute(
        text("""
            INSERT INTO supplier_finance_payments (
                supplier_id, contract_id, title, payment_date, amount,
                currency, method, notes, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :payment_date, :amount,
                :currency, :method, :notes, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_id,
            "contract_id": payload.get("contract_id"),
            "title": payload.get("title") or "Ödeme",
            "payment_date": payload.get("payment_date"),
            "amount": amount,
            "currency": (payload.get("currency") or "TRY").upper(),
            "method": payload.get("method"),
            "notes": payload.get("notes"),
            "created_by_user_id": current_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "Ödeme kaydedildi"}


@router.post("/{supplier_id:int}/finance/photos", response_model=dict)
async def create_supplier_finance_photo_admin(
    supplier_id: int,
    title: str = Form(...),
    contract_id: int | None = Form(None),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)

    _ensure_supplier_finance_tables(db)
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 20MB'dan büyük olamaz")

    ext = os.path.splitext(file.filename or "photo.bin")[1].lower() or ".bin"
    folder = os.path.join("uploads", "supplier_finance", str(supplier_id), "photos")
    os.makedirs(folder, exist_ok=True)
    stored = f"photo_{supplier_id}_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(folder, stored)
    with open(file_path, "wb") as out:
        out.write(content)
    file_url = f"/uploads/supplier_finance/{supplier_id}/photos/{stored}"

    db.execute(
        text("""
            INSERT INTO supplier_finance_photos (
                supplier_id, contract_id, title, file_path, file_url,
                description, created_by_user_id
            ) VALUES (
                :supplier_id, :contract_id, :title, :file_path, :file_url,
                :description, :created_by_user_id
            )
        """),
        {
            "supplier_id": supplier_id,
            "contract_id": contract_id,
            "title": title,
            "file_path": file_path,
            "file_url": file_url,
            "description": description,
            "created_by_user_id": current_user.id,
        },
    )
    db.commit()
    return {"status": "success", "message": "İş fotoğrafı kaydedildi"}


@router.put("/profile/finance/invoices/{invoice_id}", response_model=dict)
def update_supplier_finance_invoice(
    invoice_id: int,
    payload: dict = Body(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_invoices
            SET title = COALESCE(:title, title),
                invoice_number = COALESCE(:invoice_number, invoice_number),
                invoice_date = COALESCE(:invoice_date, invoice_date),
                amount = COALESCE(:amount, amount),
                currency = COALESCE(:currency, currency),
                notes = COALESCE(:notes, notes)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": invoice_id,
            "supplier_id": supplier_user.supplier_id,
            "title": payload.get("title"),
            "invoice_number": payload.get("invoice_number"),
            "invoice_date": payload.get("invoice_date"),
            "amount": payload.get("amount"),
            "currency": payload.get("currency"),
            "notes": payload.get("notes"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Fatura güncellendi"}


@router.delete("/profile/finance/invoices/{invoice_id}", response_model=dict)
def delete_supplier_finance_invoice(
    invoice_id: int,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_invoices WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": invoice_id, "supplier_id": supplier_user.supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Fatura silindi"}


@router.put("/profile/finance/payments/{payment_id}", response_model=dict)
def update_supplier_finance_payment(
    payment_id: int,
    payload: dict = Body(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_payments
            SET title = COALESCE(:title, title),
                payment_date = COALESCE(:payment_date, payment_date),
                amount = COALESCE(:amount, amount),
                currency = COALESCE(:currency, currency),
                method = COALESCE(:method, method),
                notes = COALESCE(:notes, notes)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": payment_id,
            "supplier_id": supplier_user.supplier_id,
            "title": payload.get("title"),
            "payment_date": payload.get("payment_date"),
            "amount": payload.get("amount"),
            "currency": payload.get("currency"),
            "method": payload.get("method"),
            "notes": payload.get("notes"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Ödeme güncellendi"}


@router.delete("/profile/finance/payments/{payment_id}", response_model=dict)
def delete_supplier_finance_payment(
    payment_id: int,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_payments WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": payment_id, "supplier_id": supplier_user.supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Ödeme silindi"}


@router.put("/profile/finance/photos/{photo_id}", response_model=dict)
def update_supplier_finance_photo(
    photo_id: int,
    payload: dict = Body(...),
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_photos
            SET title = COALESCE(:title, title),
                description = COALESCE(:description, description)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": photo_id,
            "supplier_id": supplier_user.supplier_id,
            "title": payload.get("title"),
            "description": payload.get("description"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Fotoğraf güncellendi"}


@router.delete("/profile/finance/photos/{photo_id}", response_model=dict)
def delete_supplier_finance_photo(
    photo_id: int,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_photos WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": photo_id, "supplier_id": supplier_user.supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Fotoğraf silindi"}


@router.put("/{supplier_id:int}/finance/invoices/{invoice_id}", response_model=dict)
def update_supplier_finance_invoice_admin(
    supplier_id: int,
    invoice_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_invoices
            SET title = COALESCE(:title, title),
                invoice_number = COALESCE(:invoice_number, invoice_number),
                invoice_date = COALESCE(:invoice_date, invoice_date),
                amount = COALESCE(:amount, amount),
                currency = COALESCE(:currency, currency),
                notes = COALESCE(:notes, notes)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": invoice_id,
            "supplier_id": supplier_id,
            "title": payload.get("title"),
            "invoice_number": payload.get("invoice_number"),
            "invoice_date": payload.get("invoice_date"),
            "amount": payload.get("amount"),
            "currency": payload.get("currency"),
            "notes": payload.get("notes"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Fatura güncellendi"}


@router.delete("/{supplier_id:int}/finance/invoices/{invoice_id}", response_model=dict)
def delete_supplier_finance_invoice_admin(
    supplier_id: int,
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_invoices WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": invoice_id, "supplier_id": supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Fatura silindi"}


@router.put("/{supplier_id:int}/finance/payments/{payment_id}", response_model=dict)
def update_supplier_finance_payment_admin(
    supplier_id: int,
    payment_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_payments
            SET title = COALESCE(:title, title),
                payment_date = COALESCE(:payment_date, payment_date),
                amount = COALESCE(:amount, amount),
                currency = COALESCE(:currency, currency),
                method = COALESCE(:method, method),
                notes = COALESCE(:notes, notes)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": payment_id,
            "supplier_id": supplier_id,
            "title": payload.get("title"),
            "payment_date": payload.get("payment_date"),
            "amount": payload.get("amount"),
            "currency": payload.get("currency"),
            "method": payload.get("method"),
            "notes": payload.get("notes"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Ödeme güncellendi"}


@router.delete("/{supplier_id:int}/finance/payments/{payment_id}", response_model=dict)
def delete_supplier_finance_payment_admin(
    supplier_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_payments WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": payment_id, "supplier_id": supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Ödeme silindi"}


@router.put("/{supplier_id:int}/finance/photos/{photo_id}", response_model=dict)
def update_supplier_finance_photo_admin(
    supplier_id: int,
    photo_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text("""
            UPDATE supplier_finance_photos
            SET title = COALESCE(:title, title),
                description = COALESCE(:description, description)
            WHERE id = :id AND supplier_id = :supplier_id
        """),
        {
            "id": photo_id,
            "supplier_id": supplier_id,
            "title": payload.get("title"),
            "description": payload.get("description"),
        },
    )
    db.commit()
    return {"status": "success", "message": "Fotoğraf güncellendi"}


@router.delete("/{supplier_id:int}/finance/photos/{photo_id}", response_model=dict)
def delete_supplier_finance_photo_admin(
    supplier_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_supplier_access_for_finance(db, supplier_id, current_user)
    _ensure_supplier_finance_tables(db)
    db.execute(
        text(
            "DELETE FROM supplier_finance_photos WHERE id = :id AND supplier_id = :supplier_id"
        ),
        {"id": photo_id, "supplier_id": supplier_id},
    )
    db.commit()
    return {"status": "success", "message": "Fotoğraf silindi"}


@router.get("/finance-mismatches", response_model=dict)
def list_finance_mismatches_for_dashboard(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_supplier_finance_tables(db)
    suppliers_q = _apply_supplier_visibility_filter(
        db.query(Supplier).filter(Supplier.is_active),
        current_user,
    )

    suppliers = suppliers_q.order_by(Supplier.id.desc()).limit(200).all()
    rows: list[dict] = []
    for s in suppliers:
        summary = _build_supplier_finance_summary(db, s.id)
        if summary.get("alerts"):
            rows.append(
                {
                    "supplier_id": s.id,
                    "supplier_name": s.company_name,
                    "alerts": summary.get("alerts", []),
                    "totals": summary.get("totals", {}),
                }
            )

    rows.sort(
        key=lambda x: abs(float(x["totals"].get("delta_payment_vs_invoice") or 0)),
        reverse=True,
    )
    return {"items": rows[: max(1, min(limit, 50))]}


def _ensure_supplier_email_change_table(db: Session) -> None:
    if _is_postgresql(db):
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_email_changes (
                id BIGSERIAL PRIMARY KEY,
                supplier_user_id INTEGER NOT NULL,
                supplier_id INTEGER NOT NULL,
                old_email TEXT NOT NULL,
                new_email TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                used_at TEXT
            )
        """)
        )
    else:
        db.execute(
            text("""
            CREATE TABLE IF NOT EXISTS supplier_email_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_user_id INTEGER NOT NULL,
                supplier_id INTEGER NOT NULL,
                old_email TEXT NOT NULL,
                new_email TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                used_at TEXT
            )
        """)
        )
    db.commit()


@router.get("/profile/guarantees", response_model=dict)
def list_supplier_guarantees(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
    sms_service=Depends(get_sms_service),
):
    """Tedarikçinin teminat kayıtlarını döner ve süresi dolanları bir kez bildirir."""
    _ensure_supplier_guarantees_table(db)

    _notify_expired_guarantees(
        db=db,
        supplier_id=supplier_user.supplier_id,
        email_service=email_service,
        sms_service=sms_service,
    )

    refreshed = (
        db.execute(
            text("""
            SELECT id, title, guarantee_type, amount, currency, issued_at, expires_at, status
            FROM supplier_guarantees
            WHERE supplier_id = :supplier_id
            ORDER BY id DESC
        """),
            {"supplier_id": supplier_user.supplier_id},
        )
        .mappings()
        .all()
    )

    return {
        "guarantees": [
            {
                "id": int(item["id"]),
                "title": item["title"],
                "guarantee_type": item["guarantee_type"],
                "amount": float(item["amount"]) if item["amount"] is not None else None,
                "currency": item["currency"],
                "issued_at": item["issued_at"],
                "expires_at": item["expires_at"],
                "status": item["status"],
            }
            for item in refreshed
        ]
    }


@router.post("/profile/email-change/request", response_model=dict)
def request_supplier_email_change(
    payload: dict,
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
):
    """E-posta değişikliği için doğrulama maili gönderir."""
    new_email_raw = str(payload.get("new_email") or "").strip().lower()
    if not new_email_raw:
        raise HTTPException(status_code=400, detail="Yeni e-posta zorunludur")
    if new_email_raw == supplier_user.email:
        raise HTTPException(
            status_code=400, detail="Yeni e-posta mevcut adres ile aynı"
        )

    existing = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.email == new_email_raw,
            SupplierUser.id != supplier_user.id,
            SupplierUser.is_active,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Bu e-posta başka bir kullanıcıda kayıtlı"
        )

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    _ensure_supplier_email_change_table(db)

    db.execute(
        text("""
            DELETE FROM supplier_email_changes
            WHERE supplier_user_id = :supplier_user_id AND used_at IS NULL
        """),
        {"supplier_user_id": supplier_user.id},
    )

    token = secrets.token_urlsafe(36)
    expires_at = datetime.now(ZoneInfo("UTC")) + timedelta(hours=24)
    db.execute(
        text("""
            INSERT INTO supplier_email_changes (
                supplier_user_id, supplier_id, old_email, new_email, token, expires_at
            ) VALUES (
                :supplier_user_id, :supplier_id, :old_email, :new_email, :token, :expires_at
            )
        """),
        {
            "supplier_user_id": supplier_user.id,
            "supplier_id": supplier.id,
            "old_email": supplier_user.email,
            "new_email": new_email_raw,
            "token": token,
            "expires_at": expires_at.isoformat(),
        },
    )
    db.commit()

    email_sent = email_service.send_supplier_email_change_magic_link(
        to_email=new_email_raw,
        supplier_name=supplier.company_name,
        supplier_user_name=supplier_user.name,
        token=token,
    )

    if not email_sent:
        raise HTTPException(status_code=500, detail="Doğrulama e-postası gönderilemedi")

    return {
        "status": "pending_verification",
        "message": "Yeni e-posta adresine doğrulama linki gönderildi",
        "new_email": new_email_raw,
    }


@router.post("/profile/email-change/confirm", response_model=dict)
def confirm_supplier_email_change(
    payload: dict,
    db: Session = Depends(get_db),
):
    """E-posta değişikliğini token ile onaylar."""
    token = str(payload.get("token") or "").strip()
    new_password = str(payload.get("new_password") or "")
    if not token:
        raise HTTPException(status_code=400, detail="Token zorunludur")

    _ensure_supplier_email_change_table(db)
    row = (
        db.execute(
            text("""
            SELECT id, supplier_user_id, supplier_id, old_email, new_email, expires_at, used_at
            FROM supplier_email_changes
            WHERE token = :token
            LIMIT 1
        """),
            {"token": token},
        )
        .mappings()
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Geçersiz onay bağlantısı")
    if row["used_at"]:
        raise HTTPException(status_code=400, detail="Bu bağlantı daha önce kullanılmış")

    expires_at = datetime.fromisoformat(str(row["expires_at"]))
    if datetime.now(ZoneInfo("UTC")) > expires_at:
        raise HTTPException(status_code=400, detail="Onay bağlantısının süresi dolmuş")

    supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.id == int(row["supplier_user_id"]))
        .first()
    )
    supplier = db.query(Supplier).filter(Supplier.id == int(row["supplier_id"])).first()
    if not supplier_user or not supplier:
        raise HTTPException(status_code=404, detail="Kullanıcı bilgisi bulunamadı")

    new_email = str(row["new_email"]).lower()
    existing = (
        db.query(SupplierUser)
        .filter(
            SupplierUser.email == new_email,
            SupplierUser.id != supplier_user.id,
            SupplierUser.is_active,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Bu e-posta artık başka bir kullanıcı tarafından kullanılıyor",
        )

    supplier_user.email = new_email
    supplier_user.email_verified = True
    if new_password:
        supplier_user.hashed_password = get_password_hash(new_password)
        supplier_user.password_set = True
    supplier_user.updated_at = datetime.now(ZoneInfo("UTC"))

    supplier.email = new_email
    supplier.updated_at = datetime.now(ZoneInfo("UTC"))

    db.execute(
        text("""
            UPDATE supplier_email_changes
            SET used_at = :used_at
            WHERE id = :id
        """),
        {"id": int(row["id"]), "used_at": datetime.now(ZoneInfo("UTC")).isoformat()},
    )
    db.commit()

    return {
        "status": "success",
        "message": "E-posta adresiniz doğrulandı ve güncellendi. Lütfen tekrar giriş yapın.",
        "new_email": new_email,
    }


@router.get("/profile/email-change/status", response_model=dict)
def get_supplier_email_change_status(
    supplier_user: SupplierUser = Depends(get_current_supplier_user),
    db: Session = Depends(get_db),
):
    """Aktif e-posta değişiklik talebi durumunu döner."""
    _ensure_supplier_email_change_table(db)
    row = (
        db.execute(
            text("""
            SELECT new_email, expires_at
            FROM supplier_email_changes
            WHERE supplier_user_id = :supplier_user_id
              AND used_at IS NULL
            ORDER BY id DESC
            LIMIT 1
        """),
            {"supplier_user_id": supplier_user.id},
        )
        .mappings()
        .first()
    )

    pending_email = None
    pending = False
    if row:
        expires_at = datetime.fromisoformat(str(row["expires_at"]))
        if datetime.now(ZoneInfo("UTC")) <= expires_at:
            pending = True
            pending_email = str(row["new_email"])

    return {
        "pending": pending,
        "pending_email": pending_email,
        "email_verified": bool(supplier_user.email_verified),
        "current_email": supplier_user.email,
    }
