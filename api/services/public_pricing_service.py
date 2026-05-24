from __future__ import annotations

import json

from api.models.settings import SystemSettings


LIMIT_KEY_CANONICAL_BY_ALIAS = {
    "max_active_companies": "max_active_companies",
    "active_companies": "max_active_companies",
    "max_active_internal_users": "max_active_internal_users",
    "active_internal_users": "max_active_internal_users",
    "max_active_projects": "max_active_projects",
    "active_projects": "max_active_projects",
    "max_active_private_suppliers": "max_active_private_suppliers",
    "active_private_suppliers": "max_active_private_suppliers",
    "max_active_rfqs": "max_active_rfqs",
    "active_quotes": "max_active_rfqs",
    "max_project_files_total": "max_project_files_total",
    "project_files_total": "max_project_files_total",
    "max_project_file_size_mb": "max_project_file_size_mb",
    "project_file_size_mb": "max_project_file_size_mb",
    "max_monthly_quote_collection": "max_monthly_quote_collection",
    "monthly_quotes": "max_monthly_quote_collection",
    "allow_campaign_listing": "allow_campaign_listing",
    "allow_channel_commission_rules": "allow_channel_commission_rules",
}

STRATEGIC_ADDON_LIMIT_KEY_BY_CODE = {
    "company_slot": "max_active_companies",
    "user_slot": "max_active_internal_users",
    "project_slot": "max_active_projects",
    "supplier_slot": "max_active_private_suppliers",
    "quote_slot": "max_active_rfqs",
    "file_slot": "max_project_files_total",
}


def normalize_limit_key(limit_key: str | None) -> str:
    key = str(limit_key or "").strip().lower()
    return LIMIT_KEY_CANONICAL_BY_ALIAS.get(key, key)


def normalize_limits_dict(limits: dict | None) -> dict:
    if not isinstance(limits, dict):
        return {}
    normalized: dict = {}
    for key, value in limits.items():
        normalized[normalize_limit_key(str(key))] = value
    return normalized


def default_public_pricing_config() -> dict:
    return {
        "strategic_partner": {
            "plans": [
                {
                    "code": "starter",
                    "name": "Baslangic",
                    "price_monthly": 14900,
                    "currency": "TRY",
                    "description": "Kucuk ekipler icin temel satin alma operasyon paketi",
                    "limits": {
                        "max_active_companies": 3,
                        "max_active_internal_users": 10,
                        "max_active_projects": 5,
                        "max_active_private_suppliers": 50,
                        "max_active_rfqs": 25,
                        "max_project_files_total": 100,
                        "max_project_file_size_mb": 20,
                        "allow_campaign_listing": 1,
                        "allow_channel_commission_rules": 1,
                    },
                    "features": [
                        "RFQ (Teklif Isteme Formu) ve teklif toplama",
                        "Temel onay akislari",
                        "Firma, kullanıcı, proje ve tedarikçi limitleri",
                    ],
                },
                {
                    "code": "growth",
                    "name": "Buyume",
                    "price_monthly": 34900,
                    "currency": "TRY",
                    "description": "Buyuyen satin alma ekipleri icin yuksek hacimli paket",
                    "limits": {
                        "max_active_companies": 10,
                        "max_active_internal_users": 50,
                        "max_active_projects": 20,
                        "max_active_private_suppliers": 250,
                        "max_active_rfqs": 100,
                        "max_project_files_total": 500,
                        "max_project_file_size_mb": 50,
                        "allow_campaign_listing": 1,
                        "allow_channel_commission_rules": 1,
                    },
                    "features": [
                        "Ayni hizmet ailesi daha yuksek adetlerle sunulur",
                        "Daha geniş tedarikçi ve teklif hacmi",
                        "Buyuyen ekipler icin genisletilmis dosya limitleri",
                    ],
                },
                {
                    "code": "enterprise",
                    "name": "Kurumsal",
                    "price_monthly": 79900,
                    "currency": "TRY",
                    "description": "Kurumsal operasyon hacmi ve üst seviye yönetim paketi",
                    "limits": {
                        "max_active_companies": 25,
                        "max_active_internal_users": 250,
                        "max_active_projects": 100,
                        "max_active_private_suppliers": 1000,
                        "max_active_rfqs": 500,
                        "max_project_files_total": 2000,
                        "max_project_file_size_mb": 100,
                        "allow_campaign_listing": 1,
                        "allow_channel_commission_rules": 1,
                    },
                    "features": [
                        "Ayni hizmet ailesinin en yuksek hacimli surumu",
                        "Kurumsal ekiplere uygun dosya ve teklif hacmi",
                        "Özel destek ve operasyonel esneklik",
                    ],
                },
            ],
            "addons": [
                {
                    "code": "company_slot",
                    "name": "Ek Firma Limiti",
                    "description": "Paket dışında adet bazlı ek firma hakkı satın alın.",
                    "price_monthly": 2900,
                    "currency": "TRY",
                    "increment": 1,
                    "unit": "firma",
                    "visibility_notes": [
                        "Her ek alim aktif firma kapasitesini 1 firma artirir.",
                        "Paket fiyati yerine tekil alim yapildigi icin birim maliyet ust paketlerden yuksektir.",
                    ],
                },
                {
                    "code": "user_slot",
                    "name": "Ek Kullanıcı Limiti",
                    "description": "Paket disinda ekip kapasitesini adet bazli genisletin.",
                    "price_monthly": 750,
                    "currency": "TRY",
                    "increment": 1,
                    "unit": "kullanıcı",
                    "visibility_notes": [
                        "Her ek alım aktif kullanıcı kapasitesini 1 kullanıcı artırır.",
                        "Tekil alim maliyeti paket gecisinden daha yuksektir.",
                    ],
                },
                {
                    "code": "project_slot",
                    "name": "Ek Proje Limiti",
                    "description": "Aynı anda daha fazla aktif proje yönetmek için ek hak satın alın.",
                    "price_monthly": 1900,
                    "currency": "TRY",
                    "increment": 1,
                    "unit": "proje",
                    "visibility_notes": [
                        "Her ek alim aktif proje kapasitesini 1 proje artirir.",
                        "Tekil proje hakkı, üst pakete göre daha yüksek birim fiyatla gelir.",
                    ],
                },
                {
                    "code": "supplier_slot",
                    "name": "Ek Tedarikçi Limiti",
                    "description": "Özel tedarikçi portföyünüzü adet bazlı büyütün.",
                    "price_monthly": 1200,
                    "currency": "TRY",
                    "increment": 10,
                    "unit": "tedarikçi",
                    "visibility_notes": [
                        "Her ek alım 10 aktif tedarikçi hakkı sağlar.",
                        "Paket gecisi yerine tekil alim tercih edildiginde birim maliyet daha yuksektir.",
                    ],
                },
                {
                    "code": "quote_slot",
                    "name": "Ek Teklif Limiti",
                    "description": "Aylik teklif isteme ve onay hacmini adet bazli artirin.",
                    "price_monthly": 2400,
                    "currency": "TRY",
                    "increment": 10,
                    "unit": "teklif",
                    "visibility_notes": [
                        "Her ek alım 10 tekliflik ek hacim sağlar.",
                        "Hazırlama, toplama ve onay akışında aynı limit havuzu kullanılır.",
                    ],
                },
                {
                    "code": "file_slot",
                    "name": "Ek Dosya Yükleme Limiti",
                    "description": "Proje başına daha fazla doküman yüklemek için ek hak satın alın.",
                    "price_monthly": 900,
                    "currency": "TRY",
                    "increment": 50,
                    "unit": "dosya",
                    "visibility_notes": [
                        "Her ek alım 50 dosyalık kapasite artışı sağlar.",
                        "Tek dosya boyutu limiti paket seviyesinden ayrı yönetilir.",
                    ],
                },
            ],
        },
        "supplier": {
            "plans": [
                {
                    "code": "supplier_free",
                    "name": "Tedarikçi Ücretsiz",
                    "price_monthly": 0,
                    "currency": "TRY",
                    "description": "Platformda gorunurluk ve temel teklif yanitlari",
                    "features": [
                        "Tedarikçi profili",
                        "Temel ihale davet yanıtı",
                        "Aylik performans ozeti",
                    ],
                },
                {
                    "code": "supplier_prime",
                    "name": "Tedarikçi Prime",
                    "price_monthly": 9900,
                    "currency": "TRY",
                    "description": "Kurumsal tedarikçi buyume paketi",
                    "features": [
                        "Çoklu kullanıcı",
                        "API/export imkanlari",
                        "Stratejik partnerlik workshoplari",
                    ],
                },
            ]
        },
    }


def parse_public_pricing_config(raw_json: str | None) -> dict:
    fallback = default_public_pricing_config()
    if not raw_json:
        return fallback

    try:
        data = json.loads(raw_json)
    except Exception:
        return fallback

    if not isinstance(data, dict):
        return fallback

    if "strategic_partner" not in data or "supplier" not in data:
        return fallback

    strategic = data.get("strategic_partner", {})
    supplier = data.get("supplier", {})
    strategic_plans = strategic.get("plans") if isinstance(strategic, dict) else None
    supplier_plans = supplier.get("plans") if isinstance(supplier, dict) else None

    if not isinstance(strategic_plans, list) or not isinstance(supplier_plans, list):
        return fallback

    if len(strategic_plans) == 0 and len(supplier_plans) == 0:
        return fallback

    strategic_block = data.get("strategic_partner")
    if isinstance(strategic_block, dict):
        plans = strategic_block.get("plans")
        if isinstance(plans, list):
            for plan in plans:
                if isinstance(plan, dict):
                    plan["limits"] = normalize_limits_dict(plan.get("limits"))

    return data


def serialize_public_pricing_config(config: dict) -> str:
    return json.dumps(config, ensure_ascii=True)


def ensure_public_pricing_json(settings: SystemSettings) -> None:
    if not getattr(settings, "public_pricing_json", None):
        settings.public_pricing_json = serialize_public_pricing_config(
            default_public_pricing_config()
        )


def get_strategic_partner_addons(config: dict | None) -> list[dict]:
    if not isinstance(config, dict):
        config = default_public_pricing_config()
    strategic = config.get("strategic_partner")
    if not isinstance(strategic, dict):
        return []
    addons = strategic.get("addons")
    return addons if isinstance(addons, list) else []


def get_strategic_partner_addon_definition(
    addon_code: str, config: dict | None = None
) -> dict | None:
    normalized_code = (addon_code or "").strip().lower()
    for addon in get_strategic_partner_addons(config):
        if str(addon.get("code") or "").strip().lower() == normalized_code:
            merged = dict(addon)
            merged.setdefault(
                "limit_key", STRATEGIC_ADDON_LIMIT_KEY_BY_CODE.get(normalized_code)
            )
            merged["limit_key"] = normalize_limit_key(merged.get("limit_key"))
            return merged
    return None
