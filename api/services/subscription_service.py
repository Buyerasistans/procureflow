from __future__ import annotations

import json
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from api.core.time import utcnow
from api.models.company import Company
from api.models.payment import PaymentTransaction, TenantSubscriptionAddon
from api.models.project import Project
from api.models.project_file import ProjectFile
from api.models.quote import Quote
from api.models.supplier import Supplier
from api.models.tenant import Tenant
from api.models.user import User
from api.services.public_pricing_service import get_strategic_partner_addon_definition
from api.schemas.subscription import (
    SubscriptionCatalogOut,
    SubscriptionCatalogSnapshotOut,
    SubscriptionModuleOut,
    SubscriptionTenantUsageMetricOut,
    SubscriptionTenantUsageOut,
)

DEFAULT_SUBSCRIPTION_PLAN_CODE = "starter"

CANONICAL_LIMIT_KEY_BY_ALIAS: dict[str, str] = {
    "max_active_companies": "max_active_companies",
    "active_companies": "max_active_companies",
    "max_active_projects": "max_active_projects",
    "active_projects": "max_active_projects",
    "max_active_internal_users": "max_active_internal_users",
    "active_internal_users": "max_active_internal_users",
    "max_active_private_suppliers": "max_active_private_suppliers",
    "active_private_suppliers": "max_active_private_suppliers",
    "max_active_rfqs": "max_active_rfqs",
    "active_quotes": "max_active_rfqs",
    "max_monthly_quote_collection": "max_monthly_quote_collection",
    "monthly_quotes": "max_monthly_quote_collection",
    "max_project_files_total": "max_project_files_total",
    "project_files_total": "max_project_files_total",
    "max_project_file_size_mb": "max_project_file_size_mb",
    "project_file_size_mb": "max_project_file_size_mb",
    "allow_campaign_listing": "allow_campaign_listing",
    "allow_channel_commission_rules": "allow_channel_commission_rules",
}


def normalize_limit_key(limit_key: str | None) -> str:
    key = str(limit_key or "").strip().lower()
    return CANONICAL_LIMIT_KEY_BY_ALIAS.get(key, key)


def iter_limit_key_aliases(limit_key: str | None) -> list[str]:
    normalized = normalize_limit_key(limit_key)
    aliases = [
        alias
        for alias, canonical in CANONICAL_LIMIT_KEY_BY_ALIAS.items()
        if canonical == normalized
    ]
    return aliases or [normalized]


def _append_policy_flag_modules(catalog: SubscriptionCatalogOut) -> None:
    policy_by_audience: dict[str, list[dict[str, object]]] = {
        "strategic_partner": [
            {
                "code": "campaign_listing_policy",
                "name": "Kampanya Vitrin Yetkisi",
                "description": "Kampanya bazli one cikarma/listeleme policy'sinin plan seviyesinde acik olup olmadigini belirler.",
                "enabled": True,
                "limit_key": "allow_campaign_listing",
                "limit_value": 1,
                "unit": "flag",
            },
            {
                "code": "channel_commission_policy",
                "name": "Kanal Komisyon Kurali",
                "description": "Channel/hak edis komisyon kurallarinin plan seviyesinde tanimli olup olmadigini belirtir.",
                "enabled": True,
                "limit_key": "allow_channel_commission_rules",
                "limit_value": 1,
                "unit": "flag",
            },
        ],
        "supplier": [
            {
                "code": "campaign_listing_policy",
                "name": "Kampanya Vitrin Yetkisi",
                "description": "Tedarikci paketi icin kampanya vitrini/one cikarma policy'sinin acikligini belirtir.",
                "enabled": True,
                "limit_key": "allow_campaign_listing",
                "limit_value": 1,
                "unit": "flag",
            },
            {
                "code": "channel_commission_policy",
                "name": "Kanal Komisyon Kurali",
                "description": "Tedarikci paketi icin channel komisyon/odeme policy'sinin aktifligini belirtir.",
                "enabled": True,
                "limit_key": "allow_channel_commission_rules",
                "limit_value": 0,
                "unit": "flag",
            },
        ],
        "business_partner": [
            {
                "code": "campaign_listing_policy",
                "name": "Kampanya Vitrin Yetkisi",
                "description": "Is ortagi paketi icin kampanya vitrini policy'sinin acikligini belirtir.",
                "enabled": True,
                "limit_key": "allow_campaign_listing",
                "limit_value": 0,
                "unit": "flag",
            },
            {
                "code": "channel_commission_policy",
                "name": "Kanal Komisyon Kurali",
                "description": "Is ortagi paketi icin kanal komisyon policy'sinin acikligini belirtir.",
                "enabled": True,
                "limit_key": "allow_channel_commission_rules",
                "limit_value": 1,
                "unit": "flag",
            },
        ],
    }

    for plan in catalog.plans:
        existing_keys = set()
        for module in plan.modules:
            module.limit_key = normalize_limit_key(module.limit_key)
            if module.limit_key:
                existing_keys.add(module.limit_key)

        for module_payload in policy_by_audience.get(plan.audience, []):
            normalized_limit_key = normalize_limit_key(
                str(module_payload.get("limit_key") or "")
            )
            if not normalized_limit_key or normalized_limit_key in existing_keys:
                continue
            module_data = dict(module_payload)
            module_data["limit_key"] = normalized_limit_key
            plan.modules.append(SubscriptionModuleOut(**module_data))
            existing_keys.add(normalized_limit_key)


def build_subscription_catalog() -> SubscriptionCatalogOut:
    catalog = SubscriptionCatalogOut(
        plans=[
            {
                "code": "starter",
                "name": "Başlangıç",
                "description": "Kucuk ekipler icin temel teklif isteme, tedarikci, proje, kullanici ve dosya yonetimi paketi.",
                "audience": "strategic_partner",
                "is_default": True,
                "modules": [
                    {
                        "code": "rfq_core",
                        "name": "RFQ (Teklif Isteme Formu) Yonetimi",
                        "description": "Teklif isteme, teklif toplama ve onay akislarini standart hacimde acik tutar.",
                        "enabled": True,
                        "limit_key": "active_quotes",
                        "limit_value": 25,
                        "unit": "teklif",
                    },
                    {
                        "code": "supplier_portal",
                        "name": "Tedarikci Portali",
                        "description": "Tedarikci daveti ve cevap toplama akislarini baslangic hacminde acik tutar.",
                        "enabled": True,
                        "limit_key": "active_private_suppliers",
                        "limit_value": 50,
                        "unit": "tedarikci",
                    },
                    {
                        "code": "company_limit",
                        "name": "Firma Yonetimi",
                        "description": "Paket dahilinde aktif tutulabilecek firma sayisini belirler.",
                        "enabled": True,
                        "limit_key": "active_companies",
                        "limit_value": 3,
                        "unit": "firma",
                    },
                    {
                        "code": "project_limit",
                        "name": "Proje Yonetimi",
                        "description": "Ayni anda yonetilebilecek aktif proje adedini sinirlar.",
                        "enabled": True,
                        "limit_key": "active_projects",
                        "limit_value": 5,
                        "unit": "proje",
                    },
                    {
                        "code": "user_limit",
                        "name": "Kullanici Yonetimi",
                        "description": "Aktif ic kullanici sayisini kontrollu baslangic hacminde tutar.",
                        "enabled": True,
                        "limit_key": "active_internal_users",
                        "limit_value": 10,
                        "unit": "kullanici",
                    },
                    {
                        "code": "project_file_limit",
                        "name": "Proje Dosya Yukleme",
                        "description": "Proje basina yuklenebilecek toplam dosya adedini belirler.",
                        "enabled": True,
                        "limit_key": "project_files_total",
                        "limit_value": 100,
                        "unit": "dosya",
                    },
                    {
                        "code": "project_file_size_limit",
                        "name": "Proje Dosya Boyutu",
                        "description": "Tek bir proje dosyasi icin izin verilen en yuksek boyutu belirler.",
                        "enabled": True,
                        "limit_key": "project_file_size_mb",
                        "limit_value": 20,
                        "unit": "MB",
                    },
                ],
            },
            {
                "code": "growth",
                "name": "Büyüme",
                "description": "Buyuyen satin alma ekipleri icin ayni hizmetlerin daha yuksek hacimli surumu.",
                "audience": "strategic_partner",
                "modules": [
                    {
                        "code": "rfq_core",
                        "name": "RFQ (Teklif Isteme Formu) Yonetimi",
                        "description": "Teklif isteme, teklif toplama ve onay akislarini buyuyen ekip hacminde acik tutar.",
                        "enabled": True,
                        "limit_key": "active_quotes",
                        "limit_value": 100,
                        "unit": "teklif",
                    },
                    {
                        "code": "supplier_portal",
                        "name": "Tedarikci Portali",
                        "description": "Tedarikci daveti ve cevap toplama akislarini genisletilmis portfoy hacminde tutar.",
                        "enabled": True,
                        "limit_key": "active_private_suppliers",
                        "limit_value": 250,
                        "unit": "tedarikci",
                    },
                    {
                        "code": "company_limit",
                        "name": "Firma Yonetimi",
                        "description": "Buyuyen organizasyonlarda yonetilebilecek aktif firma kapasitesini genisletir.",
                        "enabled": True,
                        "limit_key": "active_companies",
                        "limit_value": 10,
                        "unit": "firma",
                    },
                    {
                        "code": "project_limit",
                        "name": "Proje Yonetimi",
                        "description": "Ayni anda yonetilebilecek aktif proje adedini buyume seviyesine tasir.",
                        "enabled": True,
                        "limit_key": "active_projects",
                        "limit_value": 20,
                        "unit": "proje",
                    },
                    {
                        "code": "user_limit",
                        "name": "Kullanici Yonetimi",
                        "description": "Aktif ic kullanici kapasitesini buyuyen ekipler icin genisletir.",
                        "enabled": True,
                        "limit_key": "active_internal_users",
                        "limit_value": 50,
                        "unit": "kullanici",
                    },
                    {
                        "code": "project_file_limit",
                        "name": "Proje Dosya Yukleme",
                        "description": "Proje basina dosya yukleme adedini daha yuksek hacme tasir.",
                        "enabled": True,
                        "limit_key": "project_files_total",
                        "limit_value": 500,
                        "unit": "dosya",
                    },
                    {
                        "code": "project_file_size_limit",
                        "name": "Proje Dosya Boyutu",
                        "description": "Tek dosya boyutu icin daha yuksek yukleme siniri saglar.",
                        "enabled": True,
                        "limit_key": "project_file_size_mb",
                        "limit_value": 50,
                        "unit": "MB",
                    },
                ],
            },
            {
                "code": "enterprise",
                "name": "Kurumsal",
                "description": "Kurumsal ekipler icin ayni hizmetlerin en yuksek hacimli surumu.",
                "audience": "strategic_partner",
                "modules": [
                    {
                        "code": "rfq_core",
                        "name": "RFQ (Teklif Isteme Formu) Yonetimi",
                        "description": "Teklif isteme, teklif toplama ve onay akislarini kurumsal hacimde acik tutar.",
                        "enabled": True,
                        "limit_key": "active_quotes",
                        "limit_value": 500,
                        "unit": "teklif",
                    },
                    {
                        "code": "supplier_portal",
                        "name": "Tedarikci Portali",
                        "description": "Tedarikci agini kurumsal olcekte yonetmek icin daha yuksek ust limit saglar.",
                        "enabled": True,
                        "limit_key": "active_private_suppliers",
                        "limit_value": 1000,
                        "unit": "tedarikci",
                    },
                    {
                        "code": "company_limit",
                        "name": "Firma Yonetimi",
                        "description": "Kurumsal olcekte aktif firma kapasitesini genisletir.",
                        "enabled": True,
                        "limit_key": "active_companies",
                        "limit_value": 25,
                        "unit": "firma",
                    },
                    {
                        "code": "project_limit",
                        "name": "Proje Yonetimi",
                        "description": "Aktif proje kapasitesini kurumsal olcekte genisletir.",
                        "enabled": True,
                        "limit_key": "active_projects",
                        "limit_value": 100,
                        "unit": "proje",
                    },
                    {
                        "code": "user_limit",
                        "name": "Kullanici Yonetimi",
                        "description": "Aktif kullanici kapasitesini kurumsal organizasyonlar icin genisletir.",
                        "enabled": True,
                        "limit_key": "active_internal_users",
                        "limit_value": 250,
                        "unit": "kullanici",
                    },
                    {
                        "code": "project_file_limit",
                        "name": "Proje Dosya Yukleme",
                        "description": "Proje basina yuklenebilecek dosya adedini kurumsal hacme tasir.",
                        "enabled": True,
                        "limit_key": "project_files_total",
                        "limit_value": 2000,
                        "unit": "dosya",
                    },
                    {
                        "code": "project_file_size_limit",
                        "name": "Proje Dosya Boyutu",
                        "description": "Tek dosya boyutunu kurumsal seviye ust limite cikarir.",
                        "enabled": True,
                        "limit_key": "project_file_size_mb",
                        "limit_value": 100,
                        "unit": "MB",
                    },
                ],
            },
            {
                "code": "supplier_free",
                "name": "Tedarikçi Ücretsiz",
                "description": "Alıcılarla buluşmak ve teklif sunmak için ücretsiz tedarikçi hesabı.",
                "audience": "supplier",
                "is_default": True,
                "modules": [
                    {
                        "code": "rfq_response",
                        "name": "Teklif Yanıtlama",
                        "description": "Alıcılardan gelen ihale davetlerine teklif gönderebilirsiniz.",
                        "enabled": True,
                    },
                    {
                        "code": "supplier_profile",
                        "name": "Tedarikçi Profili",
                        "description": "Firma profili, kategori ve belgelerinizi yönetin.",
                        "enabled": True,
                    },
                    {
                        "code": "quote_limit",
                        "name": "Aylık Teklif Limiti",
                        "description": "Aylık ücretsiz teklif gönderim hakkı.",
                        "enabled": True,
                        "limit_key": "monthly_quotes",
                        "limit_value": 10,
                        "unit": "teklif",
                    },
                ],
            },
            {
                "code": "supplier_prime",
                "name": "Tedarikçi Prime",
                "description": "Öncelikli ihale daveti, öncü rozet ve sınırsız teklif ile büyüyün.",
                "audience": "supplier",
                "modules": [
                    {
                        "code": "priority_rfq",
                        "name": "Öncelikli İhale Daveti",
                        "description": "Yeni ihalelerde öncelikli bildirim ve erken teklif hakkı.",
                        "enabled": True,
                    },
                    {
                        "code": "prime_badge",
                        "name": "Prime Rozeti",
                        "description": "Alıcıların aramasında öne çıkın ve güven etiketini kullanın.",
                        "enabled": True,
                    },
                    {
                        "code": "quote_limit",
                        "name": "Sınırsız Teklif",
                        "description": "Aylık teklif limiti yok.",
                        "enabled": True,
                        "limit_key": "monthly_quotes",
                        "limit_value": 9999,
                        "unit": "teklif",
                    },
                ],
            },
            {
                "code": "business_partner_free",
                "name": "Is Ortagi Programi",
                "description": "Referans bazli komisyon modeli ile ucretsiz is ortagi kaydi.",
                "audience": "business_partner",
                "is_default": True,
                "modules": [
                    {
                        "code": "referral_tracking",
                        "name": "Referans Takibi",
                        "description": "Getirilen musteri ve islem akisini panelden takip edin.",
                        "enabled": True,
                    },
                    {
                        "code": "commission_ledger",
                        "name": "Komisyon Defteri",
                        "description": "Komisyon hareketleri, hak edis ve odeme kayitlarini izleyin.",
                        "enabled": True,
                    },
                ],
            },
        ]
    )
    _append_policy_flag_modules(catalog)
    return catalog


def _plan_name_map() -> dict[str, str]:
    return {plan.code: plan.name for plan in build_subscription_catalog().plans}


def normalize_subscription_plan_code(plan_code: str | None) -> str:
    normalized = (plan_code or DEFAULT_SUBSCRIPTION_PLAN_CODE).strip().lower()
    return normalized or DEFAULT_SUBSCRIPTION_PLAN_CODE


def validate_subscription_plan_code(plan_code: str | None) -> str:
    normalized = normalize_subscription_plan_code(plan_code)
    valid_codes = {plan.code for plan in build_subscription_catalog().plans}
    if normalized not in valid_codes:
        raise ValueError("Gecersiz subscription_plan_code")
    return normalized


def get_plan_limit(plan_code: str | None, limit_key: str) -> int | None:
    normalized = normalize_subscription_plan_code(plan_code)
    normalized_limit_key = normalize_limit_key(limit_key)
    for plan in build_subscription_catalog().plans:
        if plan.code != normalized:
            continue
        for module in plan.modules:
            if (
                module.enabled
                and normalize_limit_key(module.limit_key) == normalized_limit_key
            ):
                return module.limit_value
        return None
    return None


def get_active_subscription_addon_increment(
    db: Session, tenant_id: int | None, limit_key: str
) -> int:
    if tenant_id is None:
        return 0

    limit_key_aliases = iter_limit_key_aliases(limit_key)
    rows = (
        db.query(TenantSubscriptionAddon)
        .filter(
            TenantSubscriptionAddon.tenant_id == tenant_id,
            TenantSubscriptionAddon.limit_key.in_(limit_key_aliases),
            TenantSubscriptionAddon.status == "active",
        )
        .all()
    )
    active_rows = [
        row for row in rows if row.expires_at is None or row.expires_at > utcnow()
    ]
    return sum(max(int(row.total_increment or 0), 0) for row in active_rows)


def get_effective_plan_limit(
    db: Session, tenant: Tenant | None, limit_key: str
) -> int | None:
    if tenant is None:
        return None
    base_limit = get_plan_limit(tenant.subscription_plan_code, limit_key)
    addon_increment = get_active_subscription_addon_increment(db, tenant.id, limit_key)
    if base_limit is None:
        return addon_increment or None
    return base_limit + addon_increment


def activate_subscription_addons_for_payment(
    db: Session,
    txn: PaymentTransaction | None,
    *,
    tenant_id: int | None = None,
) -> list[TenantSubscriptionAddon]:
    if txn is None:
        return []

    resolved_tenant_id = tenant_id or getattr(txn, "tenant_id", None)
    if resolved_tenant_id is None:
        return []

    addon_code: str | None = None
    quantity = 1
    addon_name: str | None = None
    if (
        str(getattr(txn, "reference_type", "") or "").strip().lower()
        == "subscription_addon"
    ):
        addon_code = str(getattr(txn, "reference_id", "") or "").strip().lower() or None

    raw_payload = getattr(txn, "provider_response_raw", None)
    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None
        request_context = (
            parsed.get("request_context") if isinstance(parsed, dict) else None
        )
        extra = (
            request_context.get("extra") if isinstance(request_context, dict) else None
        )
        if isinstance(extra, dict):
            addon_code = (
                str(extra.get("addon_code") or addon_code or "").strip().lower()
                or addon_code
            )
            addon_name = str(extra.get("addon_name") or "").strip() or addon_name
            raw_quantity = extra.get("quantity")
            if isinstance(raw_quantity, int) and raw_quantity > 0:
                quantity = raw_quantity

    if not addon_code:
        return []

    addon_definition = get_strategic_partner_addon_definition(addon_code)
    if not addon_definition:
        return []

    existing = (
        db.query(TenantSubscriptionAddon)
        .filter(TenantSubscriptionAddon.payment_transaction_id == txn.id)
        .all()
    )
    if existing:
        return existing

    increment_per_unit = int(addon_definition.get("increment") or 1)
    allocation = TenantSubscriptionAddon(
        tenant_id=resolved_tenant_id,
        addon_code=addon_code,
        addon_name=addon_name or str(addon_definition.get("name") or addon_code),
        limit_key=normalize_limit_key(str(addon_definition.get("limit_key") or "")),
        quantity=quantity,
        increment_per_unit=increment_per_unit,
        total_increment=quantity * increment_per_unit,
        status="active",
        payment_transaction_id=txn.id,
        activated_at=utcnow(),
        expires_at=utcnow() + timedelta(days=30),
    )
    if not allocation.limit_key:
        return []
    db.add(allocation)
    db.flush()
    return [allocation]


def build_subscription_catalog_snapshot(db: Session) -> SubscriptionCatalogSnapshotOut:
    catalog = build_subscription_catalog()
    plan_name_map = _plan_name_map()
    tenant_rows = (
        db.query(Tenant).order_by(Tenant.created_at.desc(), Tenant.id.desc()).all()
    )
    tenant_usage: list[SubscriptionTenantUsageOut] = []

    for tenant in tenant_rows:
        normalized_plan_code = normalize_subscription_plan_code(
            tenant.subscription_plan_code
        )
        quote_count = (
            db.query(Quote)
            .filter(Quote.tenant_id == tenant.id, Quote.deleted_at.is_(None))
            .count()
        )
        supplier_count = (
            db.query(Supplier)
            .filter(
                Supplier.tenant_id == tenant.id,
                Supplier.is_active.is_(True),
            )
            .count()
        )
        active_company_count = (
            db.query(Company)
            .filter(
                Company.tenant_id == tenant.id,
                Company.is_active.is_(True),
            )
            .count()
        )
        active_project_count = (
            db.query(Project)
            .filter(
                Project.tenant_id == tenant.id,
                Project.is_active.is_(True),
            )
            .count()
        )
        active_user_count = (
            db.query(User)
            .filter(
                User.tenant_id == tenant.id,
                User.is_active.is_(True),
                User.hidden_from_admin.is_(False),
                User.system_role != "supplier_user",
            )
            .count()
        )
        project_file_count = (
            db.query(ProjectFile)
            .join(Project, Project.id == ProjectFile.project_id)
            .filter(Project.tenant_id == tenant.id)
            .count()
        )
        tenant_usage.append(
            SubscriptionTenantUsageOut(
                tenant_id=tenant.id,
                tenant_name=tenant.brand_name or tenant.legal_name,
                plan_code=normalized_plan_code,
                plan_name=plan_name_map.get(normalized_plan_code, normalized_plan_code),
                status=tenant.status,
                is_active=tenant.is_active,
                metrics=[
                    SubscriptionTenantUsageMetricOut(
                        key="max_active_companies",
                        label="Aktif Firma",
                        used=active_company_count,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_active_companies"
                        ),
                        unit="firma",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_active_projects",
                        label="Aktif Proje",
                        used=active_project_count,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_active_projects"
                        ),
                        unit="proje",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_active_internal_users",
                        label="Aktif Kullanici",
                        used=active_user_count,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_active_internal_users"
                        ),
                        unit="kullanici",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_active_private_suppliers",
                        label="Aktif Ozel Tedarikci",
                        used=supplier_count,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_active_private_suppliers"
                        ),
                        unit="tedarikci",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_active_rfqs",
                        label="Teklif Isteme ve Onay",
                        used=quote_count,
                        limit=get_effective_plan_limit(db, tenant, "max_active_rfqs"),
                        unit="teklif",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_project_files_total",
                        label="Proje Dosya Yukleme",
                        used=project_file_count,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_project_files_total"
                        ),
                        unit="dosya",
                    ),
                    SubscriptionTenantUsageMetricOut(
                        key="max_project_file_size_mb",
                        label="Maksimum Dosya Boyutu",
                        used=0,
                        limit=get_effective_plan_limit(
                            db, tenant, "max_project_file_size_mb"
                        ),
                        unit="MB",
                    ),
                ],
            )
        )

    return SubscriptionCatalogSnapshotOut(catalog=catalog, tenant_usage=tenant_usage)


def enforce_active_project_limit(db: Session, tenant: Tenant | None) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    limit_value = get_effective_plan_limit(db, tenant, "max_active_projects")
    if limit_value is None:
        return

    active_project_count = (
        db.query(Project)
        .filter(Project.tenant_id == tenant.id, Project.is_active.is_(True))
        .count()
    )
    if active_project_count >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Aktif proje limiti asildi. "
                f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                f"Limit: {limit_value} aktif proje."
            ),
        )


def enforce_active_internal_user_limit(db: Session, tenant: Tenant | None) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    limit_value = get_effective_plan_limit(db, tenant, "max_active_internal_users")
    if limit_value is None:
        return

    active_user_count = (
        db.query(User)
        .filter(
            User.tenant_id == tenant.id,
            User.is_active.is_(True),
            User.hidden_from_admin.is_(False),
            User.system_role != "supplier_user",
        )
        .count()
    )
    if active_user_count >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Aktif kullanici limiti asildi. "
                f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                f"Limit: {limit_value} aktif kullanici."
            ),
        )


def enforce_active_private_supplier_limit(db: Session, tenant: Tenant | None) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    limit_value = get_effective_plan_limit(db, tenant, "max_active_private_suppliers")
    if limit_value is None:
        return

    active_supplier_count = (
        db.query(Supplier)
        .filter(
            Supplier.tenant_id == tenant.id,
            Supplier.is_active.is_(True),
        )
        .count()
    )
    if active_supplier_count >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Aktif tedarikci limiti asildi. "
                f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                f"Limit: {limit_value} aktif tedarikci."
            ),
        )


def enforce_active_company_limit(db: Session, tenant: Tenant | None) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    limit_value = get_effective_plan_limit(db, tenant, "max_active_companies")
    if limit_value is None:
        return

    active_company_count = (
        db.query(Company)
        .filter(
            Company.tenant_id == tenant.id,
            Company.is_active.is_(True),
        )
        .count()
    )
    if active_company_count >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Aktif firma limiti asildi. "
                f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                f"Limit: {limit_value} aktif firma."
            ),
        )


def enforce_active_quote_limit(db: Session, tenant: Tenant | None) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    limit_value = get_effective_plan_limit(db, tenant, "max_active_rfqs")
    if limit_value is None:
        return

    quote_count = (
        db.query(Quote)
        .filter(Quote.tenant_id == tenant.id, Quote.deleted_at.is_(None))
        .count()
    )
    if quote_count >= limit_value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Teklif limiti asildi. "
                f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                f"Limit: {limit_value} teklif."
            ),
        )


def enforce_project_file_limits(
    db: Session,
    tenant: Tenant | None,
    project_id: int,
    file_size_bytes: int,
) -> None:
    if tenant is None or not tenant.subscription_plan_code:
        return

    total_limit = get_effective_plan_limit(db, tenant, "max_project_files_total")
    size_limit_mb = get_effective_plan_limit(db, tenant, "max_project_file_size_mb")

    if total_limit is not None:
        file_count = (
            db.query(ProjectFile).filter(ProjectFile.project_id == project_id).count()
        )
        if file_count >= total_limit:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Proje dosya limiti asildi. "
                    f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                    f"Limit: {total_limit} dosya."
                ),
            )

    if size_limit_mb is not None:
        size_limit_bytes = size_limit_mb * 1024 * 1024
        if file_size_bytes > size_limit_bytes:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Dosya boyutu plan limitini asiyor. "
                    f"Mevcut plan: {normalize_subscription_plan_code(tenant.subscription_plan_code)}. "
                    f"Limit: {size_limit_mb} MB."
                ),
            )
