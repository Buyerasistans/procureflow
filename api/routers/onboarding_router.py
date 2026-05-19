# routers/onboarding_router.py
"""
Public self-serve onboarding endpoints.
No authentication required — accessible to prospective customers.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import inspect, or_, func, case
from sqlalchemy.orm import Session

from api.core.deps import get_db
from api.core.security import get_password_hash
from api.models.tenant import Tenant, TenantSettings
from api.models.settings import SystemSettings
from api.models.payment import PaymentTransaction
from api.models.user import User
from api.models.company import Company
from api.models.role import Role
from api.models.assignment import CompanyRole
from api.models.system_email import SystemEmail
from api.models.email_settings import EmailSettings
from api.models.channel import ChannelReferralEvent, ChannelReferralLink
from api.services.billing_service import ensure_tenant_subscription_for_plan
from api.services.email_service import get_email_service
from api.services.public_pricing_service import (
    ensure_public_pricing_json,
    parse_public_pricing_config,
)
from api.services.subscription_service import (
    build_subscription_catalog,
    validate_subscription_plan_code,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class OnboardingPlanModuleOut(BaseModel):
    code: str
    name: str
    description: str
    enabled: bool
    limit_key: str | None = None
    limit_value: int | None = None
    unit: str | None = None


class OnboardingPlanOut(BaseModel):
    code: str
    name: str
    description: str
    audience: str
    price_monthly: int | None = None
    currency: str | None = None
    requires_payment: bool = False
    is_default: bool = False
    modules: list[OnboardingPlanModuleOut]


class OnboardingCatalogOut(BaseModel):
    plans: list[OnboardingPlanOut]


class PublicPricingConfigOut(BaseModel):
    strategic_partner: dict
    supplier: dict


class OnboardingRegisterRequest(BaseModel):
    plan_code: str = Field(..., min_length=2, max_length=50)
    legal_name: str = Field(
        ..., min_length=2, max_length=255, description="Firma ticari unvani"
    )
    brand_name: str | None = Field(
        default=None, max_length=255, description="Marka adi (opsiyonel)"
    )
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Ilk admin kullanicisinin tam adi",
    )
    email: EmailStr = Field(..., description="Ilk admin kullanicisinin is e-postasi")
    phone: str | None = Field(default=None, max_length=32)
    payment_transaction_id: int | None = Field(
        default=None,
        description="Ucretli planlar icin /payment/initiate ile olusan islem numarasi",
    )
    referral_code: str | None = Field(
        default=None,
        max_length=64,
        description="Opsiyonel referral kodu (CH-XXXX)",
    )


class OnboardingRegisterOut(BaseModel):
    tenant_id: int
    tenant_slug: str
    legal_name: str
    brand_name: str | None
    plan_code: str
    admin_email: str
    admin_full_name: str
    payment_verified: bool
    invitation_sent: bool
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _slugify(value: str) -> str:
    normalized = value.strip().lower()
    for src, dst in [
        ("ı", "i"),
        ("ğ", "g"),
        ("ü", "u"),
        ("ş", "s"),
        ("ö", "o"),
        ("ç", "c"),
    ]:
        normalized = normalized.replace(src, dst)
    return (
        "-".join(
            p
            for p in "".join(ch if ch.isalnum() else "-" for ch in normalized).split(
                "-"
            )
            if p
        )
        or "tenant"
    )


def _ensure_unique_slug(db: Session, slug: str) -> str:
    base = slug[:110]
    candidate = base
    suffix = 1
    while db.query(Tenant).filter(Tenant.slug == candidate).first() is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _build_public_plan_price_lookup(db: Session) -> dict[str, dict[str, int | str]]:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(app_name="ProcureFlow")
        db.add(settings)
        db.flush()

    ensure_public_pricing_json(settings)
    config = parse_public_pricing_config(settings.public_pricing_json)

    lookup: dict[str, dict[str, int | str]] = {}
    for audience_key in ("strategic_partner", "supplier"):
        audience_block = config.get(audience_key, {})
        plans = (
            audience_block.get("plans", []) if isinstance(audience_block, dict) else []
        )
        if not isinstance(plans, list):
            continue
        for plan in plans:
            if not isinstance(plan, dict):
                continue
            code = str(plan.get("code") or "").strip()
            if not code:
                continue
            raw_price = plan.get("price_monthly", 0)
            try:
                price_monthly = int(raw_price)
            except (TypeError, ValueError):
                price_monthly = 0
            lookup[code] = {
                "price_monthly": max(price_monthly, 0),
                "currency": str(plan.get("currency") or "TRY"),
            }

    return lookup


def _derive_mail_domain(db: Session) -> str:
    default_profile = (
        db.query(EmailSettings)
        .filter(EmailSettings.owner_user_id.is_(None))
        .order_by(EmailSettings.id.asc())
        .first()
    )
    candidate = ""
    if default_profile:
        candidate = (default_profile.mail_domain or "").strip().lower()
        if not candidate:
            from_email = (default_profile.from_email or "").strip().lower()
            if "@" in from_email:
                candidate = from_email.split("@", 1)[1]

    return candidate or "buyerasistans.com.tr"


def _ensure_unique_system_email_address(db: Session, desired_email: str) -> str:
    local_part, _, domain = desired_email.partition("@")
    local_part = local_part.strip().lower()
    domain = domain.strip().lower()
    candidate = f"{local_part}@{domain}"
    suffix = 1
    while (
        db.query(SystemEmail).filter(SystemEmail.email == candidate).first() is not None
    ):
        candidate = f"{local_part}{suffix}@{domain}"
        suffix += 1
    return candidate


def _generate_mailbox_password() -> str:
    return f"PF!{secrets.token_urlsafe(10)}A9"


def _channel_referral_tables_ready(db: Session) -> bool:
    inspector = inspect(db.bind)
    return inspector.has_table("channel_referral_links") and inspector.has_table(
        "channel_referral_events"
    )


def _normalize_referral_code(value: str | None) -> str | None:
    normalized = str(value or "").strip().upper()
    return normalized or None


def _track_onboarding_referral_signup(
    db: Session,
    *,
    referral_code: str | None,
    actor_user_id: int,
    target_scope: str,
) -> bool:
    normalized_code = _normalize_referral_code(referral_code)
    if not normalized_code:
        return False
    if not _channel_referral_tables_ready(db):
        return False

    link = (
        db.query(ChannelReferralLink)
        .filter(
            ChannelReferralLink.link_code == normalized_code,
            ChannelReferralLink.is_active == True,
        )
        .first()
    )
    if not link:
        return False

    event_type = "partner_signup" if target_scope == "partner" else "supplier_signup"
    db.add(
        ChannelReferralEvent(
            referral_link_id=link.id,
            event_type=event_type,
            actor_user_id=actor_user_id,
            source_scope="public",
            target_scope=target_scope,
            amount_base=None,
        )
    )
    return True


def _create_onboarding_mailboxes(
    db: Session,
    *,
    tenant_id: int,
    owner_user_id: int,
    company_name: str,
) -> list[dict[str, str]]:
    domain = _derive_mail_domain(db)
    base_alias = _slugify(company_name).replace("-", "")[:16] or "firma"
    base_alias = "".join(ch for ch in base_alias if ch.isalnum()) or "firma"

    desired_primary = f"{base_alias}@{domain}"
    desired_quote = f"teklif_{base_alias}@{domain}"

    primary_email = _ensure_unique_system_email_address(db, desired_primary)
    quote_email = _ensure_unique_system_email_address(db, desired_quote)

    primary_password = _generate_mailbox_password()
    quote_password = _generate_mailbox_password()

    mailboxes = [
        {
            "email": primary_email,
            "password": primary_password,
            "description": "Onboarding otomatik firma mailbox hesabı",
        },
        {
            "email": quote_email,
            "password": quote_password,
            "description": "Onboarding otomatik teklif mailbox hesabı",
        },
    ]

    for mailbox in mailboxes:
        db.add(
            SystemEmail(
                email=mailbox["email"],
                password=mailbox["password"],
                tenant_id=tenant_id,
                owner_user_id=owner_user_id,
                description=mailbox["description"],
                is_active=True,
            )
        )

    return mailboxes


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/plans", response_model=OnboardingCatalogOut)
def list_onboarding_plans(db: Session = Depends(get_db)):
    """
    Herkese acik plan katalogu.
    Kayit formunda plan secimi icin kullanilir.
    """
    catalog = build_subscription_catalog()
    price_lookup = _build_public_plan_price_lookup(db)
    plans_out: list[OnboardingPlanOut] = []
    for plan in catalog.plans:
        price_data = price_lookup.get(plan.code, {})
        price_monthly = int(price_data.get("price_monthly", 0) or 0)
        currency = str(price_data.get("currency") or "TRY")
        modules_out = [
            OnboardingPlanModuleOut(
                code=m.code,
                name=m.name,
                description=m.description,
                enabled=m.enabled,
                limit_key=getattr(m, "limit_key", None),
                limit_value=getattr(m, "limit_value", None),
                unit=getattr(m, "unit", None),
            )
            for m in plan.modules
        ]
        plans_out.append(
            OnboardingPlanOut(
                code=plan.code,
                name=plan.name,
                description=plan.description,
                audience=plan.audience,
                price_monthly=price_monthly,
                currency=currency,
                requires_payment=price_monthly > 0,
                is_default=getattr(plan, "is_default", False),
                modules=modules_out,
            )
        )
    return OnboardingCatalogOut(plans=plans_out)


@router.get("/public-pricing", response_model=PublicPricingConfigOut)
def get_public_pricing(
    db: Session = Depends(get_db),
):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(app_name="ProcureFlow")
        db.add(settings)
        db.flush()

    ensure_public_pricing_json(settings)
    db.commit()
    db.refresh(settings)
    return parse_public_pricing_config(settings.public_pricing_json)


@router.post(
    "/register",
    response_model=OnboardingRegisterOut,
    status_code=status.HTTP_201_CREATED,
)
async def register_tenant(
    payload: OnboardingRegisterRequest,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
):
    """
    Self-serve tenant kaydi.
    Yeni firma + ilk admin kullanicisi olusturur ve aktivasyon e-postasi gonderir.
    Rate limiting ve CAPTCHA entegrasyonu icin API gateway katmaninda uygulanmalidir.
    """
    # Plan dogrulama
    try:
        plan_code = validate_subscription_plan_code(payload.plan_code)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # Ucretli planlar icin odeme zorunlulugu
    payment_verified = False
    price_lookup = _build_public_plan_price_lookup(db)
    selected_plan_price = int(
        price_lookup.get(plan_code, {}).get("price_monthly", 0) or 0
    )
    selected_plan_currency = str(
        price_lookup.get(plan_code, {}).get("currency") or "TRY"
    )

    if selected_plan_price > 0:
        if payload.payment_transaction_id is None:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Ucretli plan secimi icin odeme adimi tamamlanmalidir.",
            )

        txn = db.get(PaymentTransaction, payload.payment_transaction_id)
        if not txn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gecersiz odeme islemi.",
            )

        if (txn.transaction_type or "").lower() != "subscription":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Odeme islemi abonelik tipi degil.",
            )

        if (txn.status or "").lower() not in {"processing", "succeeded"}:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Odeme islemi tamamlanmadi veya basarisiz.",
            )

        txn_currency = (txn.currency or "TRY").upper()
        if txn_currency != selected_plan_currency.upper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Odeme para birimi secilen plan ile uyusmuyor.",
            )

        try:
            required_amount = Decimal(selected_plan_price)
            paid_amount = Decimal(txn.amount)
        except (InvalidOperation, TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Odeme tutari dogrulanamadi.",
            )

        if paid_amount < required_amount:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Odeme tutari secilen plan tutarindan dusuk.",
            )

        payment_verified = True

    # E-posta cakisma kontrolu
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing and not existing.hidden_from_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi ile kayitli bir hesap zaten mevcut.",
        )

    # Tenant olustur
    slug = _ensure_unique_slug(db, _slugify(payload.brand_name or payload.legal_name))
    tenant = Tenant(
        slug=slug,
        legal_name=payload.legal_name,
        brand_name=payload.brand_name,
        subscription_plan_code=plan_code,
        status="active",
        onboarding_status="pending_activation",
        is_active=True,
    )
    db.add(tenant)
    db.flush()

    ensure_tenant_subscription_for_plan(
        db, tenant, subscription_plan_code=plan_code, status_value="active"
    )
    db.add(
        TenantSettings(
            tenant_id=tenant.id,
            smtp_mode="platform_default",
            locale="tr-TR",
            timezone="Europe/Istanbul",
            is_active=True,
        )
    )

    # Ilk admin kullanicisi
    placeholder_pw = secrets.token_urlsafe(24)
    invitation_token = secrets.token_urlsafe(32)
    invitation_expires = datetime.now(timezone.utc) + timedelta(hours=48)

    admin_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(placeholder_pw),
        role="admin",
        system_role="tenant_admin",
        approval_limit=300000,
        personal_phone=payload.phone,
        is_active=True,
        hidden_from_admin=False,
        tenant_id=tenant.id,
        invitation_token=invitation_token,
        invitation_token_expires=invitation_expires,
        invitation_accepted=False,
    )
    db.add(admin_user)
    db.flush()
    tenant.owner_user_id = admin_user.id

    # Varsayilan firma + yonetici atamasi (magic link sonrasi role/firma baglantisi hazir olsun)
    default_company = Company(
        name=payload.brand_name or payload.legal_name,
        trade_name=payload.legal_name,
        color="#1d4ed8",
        phone=payload.phone,
        is_active=True,
        is_primary=True,
        tenant_id=tenant.id,
        created_by_id=admin_user.id,
    )
    db.add(default_company)
    db.flush()

    admin_role = (
        db.query(Role)
        .filter(
            or_(Role.tenant_id == tenant.id, Role.tenant_id.is_(None)),
            func.lower(func.coalesce(Role.name, "")) == "admin",
        )
        .order_by(case((Role.tenant_id == tenant.id, 0), else_=1), Role.id.asc())
        .first()
    )
    if admin_role is not None:
        db.add(
            CompanyRole(
                tenant_id=tenant.id,
                user_id=admin_user.id,
                company_id=default_company.id,
                role_id=admin_role.id,
                is_active=True,
            )
        )

    # Opsiyonel referral attribution: click -> signup zincirini tamamlar.
    audience = str(plan_code).strip().lower()
    target_scope = "partner" if audience == "strategic_partner" else "supplier"
    _track_onboarding_referral_signup(
        db,
        referral_code=payload.referral_code,
        actor_user_id=int(admin_user.id),
        target_scope=target_scope,
    )

    db.commit()
    db.refresh(tenant)
    db.refresh(admin_user)

    # Davet e-postasi
    invitation_sent = False
    try:
        invitation_sent = email_service.send_internal_user_invitation(
            to_email=admin_user.email,
            full_name=admin_user.full_name,
            activation_token=admin_user.invitation_token,
            company_name=tenant.brand_name or tenant.legal_name,
            owner_user_id=None,
        )
    except Exception:
        invitation_sent = False

    message = (
        "Kaydınız alındı. Aktivasyon bağlantısı e-posta adresinize gönderildi."
        if invitation_sent
        else "Kaydınız alındı. Aktivasyon bağlantısı sistem yöneticiniz tarafından iletilecektir."
    )
    message += " Is maili olusturma ve mailbox bilgileri aktivasyon sonrasi otomatik gonderilecektir."

    return OnboardingRegisterOut(
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        legal_name=tenant.legal_name,
        brand_name=tenant.brand_name,
        plan_code=plan_code,
        admin_email=admin_user.email,
        admin_full_name=admin_user.full_name,
        payment_verified=payment_verified,
        invitation_sent=invitation_sent,
        message=message,
    )
