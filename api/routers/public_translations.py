from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.translation_cache import TranslationCacheEntry

router = APIRouter(prefix="/public/translations", tags=["public-translations"])

SUPPORTED_LOCALES = {
    "tr",
    "en",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "nl",
    "pl",
    "ja",
    "ko",
    "zh",
    "ar",
    "ru",
}

BASE_TRANSLATIONS: dict[str, dict[str, dict[str, str]]] = {
    "public_core": {
        "tr": {
            "home": "Ana Sayfa",
            "offers": "Acik Ihaleler",
            "suppliers": "Tedarikci Havuzu",
            "strategic": "Stratejik Partnerlerimiz",
            "partner_program": "Basarili Is Ortaklarimiz",
            "partnerProgram": "Basarili Is Ortaklarimiz",
            "become_supplier": "Tedarikci Ol",
            "becomeSupplier": "Tedarikci Ol",
            "request_demo": "Demo Talep Et",
            "demo": "Demo Talep Et",
            "sign_in": "Sisteme Giris",
            "signIn": "Sisteme Giris",
            "supplier_login": "Tedarikci Girisi",
            "supplierLogin": "Tedarikci Girisi",
            "partner_login": "Is Ortagi Girisi",
            "partnerLogin": "Is Ortagi Girisi",
            "choose_login": "Giris Secin",
            "chooseLogin": "Giris Secin",
            "strategic_login": "Stratejik Partner Girisi",
            "strategicLogin": "Stratejik Partner Girisi",
            "close": "Kapat",
        },
        "en": {
            "home": "Home",
            "offers": "Open Tenders",
            "suppliers": "Supplier Pool",
            "strategic": "Strategic Partners",
            "partner_program": "Top Channel Partners",
            "partnerProgram": "Top Channel Partners",
            "become_supplier": "Become a Supplier",
            "becomeSupplier": "Become a Supplier",
            "request_demo": "Request Demo",
            "demo": "Request Demo",
            "sign_in": "Sign In",
            "signIn": "Sign In",
            "supplier_login": "Supplier Login",
            "supplierLogin": "Supplier Login",
            "partner_login": "Partner Login",
            "partnerLogin": "Partner Login",
            "choose_login": "Choose Login",
            "chooseLogin": "Choose Login",
            "strategic_login": "Strategic Partner Login",
            "strategicLogin": "Strategic Partner Login",
            "close": "Close",
        },
    },
    "help_center": {
        "tr": {
            "title": "Yardim Merkezi",
            "subtitle": "Nasil yardimci olabiliriz?",
            "articles_tab": "Makaleler",
            "ticket_tab": "Destek Talebi",
            "search_placeholder": "Kilavuzlarda ara...",
            "all_categories": "Tumu",
            "not_found": "Aranan kilavuz bulunamadi.",
            "missing_prompt": "Aradiginizi bulamadin mi?",
            "create_ticket": "Destek Talebi Olustur",
            "view_all_docs": "Tüm Kılavuzları Görüntüle (buyerasistans.info/docs)",
        },
        "en": {
            "title": "Help Center",
            "subtitle": "How can we help you?",
            "articles_tab": "Articles",
            "ticket_tab": "Support Ticket",
            "search_placeholder": "Search guides...",
            "all_categories": "All",
            "not_found": "No guide matched your search.",
            "missing_prompt": "Couldn't find what you need?",
            "create_ticket": "Create Support Ticket",
            "view_all_docs": "View All Guides (buyerasistans.info/docs)",
        },
    },
    "app_shell": {
        "tr": {
            "dashboard": "Dashboard",
            "quotes": "Teklifler",
            "reports": "Raporlar",
            "ai_lab": "AI Kesif Lab",
            "profile": "Profilim",
            "logout": "Çıkış Yap",
            "mail_summary": "Mail hesap ozeti",
            "mail_priority": "Oncelik",
            "dashboard_mail_button": "dashboard mail butonu",
            "active": "Aktif",
            "passive": "Pasif",
            "mailbox_not_found": "Acilabilir mailbox bulunamadi.",
        },
        "en": {
            "dashboard": "Dashboard",
            "quotes": "Quotes",
            "reports": "Reports",
            "ai_lab": "AI Discovery Lab",
            "profile": "My Profile",
            "logout": "Sign Out",
            "mail_summary": "Mailbox Summary",
            "mail_priority": "Priority",
            "dashboard_mail_button": "dashboard mail button",
            "active": "Active",
            "passive": "Passive",
            "mailbox_not_found": "No mailbox account available.",
        },
    },
    "admin_tabs": {
        "tr": {
            "panel_home": "Panel Ana Sayfa",
            "platform_operations": "Platform Operasyonlari",
            "discovery_lab_operations": "Discovery Lab Operasyonlari",
            "onboarding_studio": "Kurulum Studyosu",
            "tenant_governance": "Stratejik Partner Yonetimi",
            "packages": "Paket ve Kullanim",
            "deployment": "Yayinlama",
            "platform_analytics": "Platform Analitikleri",
            "platform_suppliers": "Platform Tedarikci Havuzu",
            "public_pricing": "Genel Fiyatlandirma",
            "campaigns": "Kampanyalar ve Landing",
            "commission_admin": "Komisyon Yonetimi",
            "support_tickets": "Destek Talepleri",
            "settings": "Ayarlar",
            "companies": "Firmalar",
            "roles": "Roller ve Yetkiler",
            "departments": "Departmanlar",
            "personnel": "Personeller",
            "projects": "Projeler",
            "approvals": "Onay Akislari",
            "reports": "Raporlar",
            "panel_designer": "Panel Tasarimi",
            "personal_theme": "Kisisel Tema",
            "partner_settings": "Stratejik Partner Ayarlari",
            "channel_settings": "Is Ortagi Platform Ayarlari",
        },
        "en": {
            "panel_home": "Panel Home",
            "platform_operations": "Platform Operations",
            "discovery_lab_operations": "Discovery Lab Operations",
            "onboarding_studio": "Onboarding Studio",
            "tenant_governance": "Strategic Partner Governance",
            "packages": "Packages and Usage",
            "deployment": "Deployment",
            "platform_analytics": "Platform Analytics",
            "platform_suppliers": "Platform Supplier Pool",
            "public_pricing": "Public Pricing",
            "campaigns": "Campaigns and Landing",
            "commission_admin": "Commission Management",
            "support_tickets": "Support Tickets",
            "settings": "Settings",
            "companies": "Companies",
            "roles": "Roles and Permissions",
            "departments": "Departments",
            "personnel": "Personnel",
            "projects": "Projects",
            "approvals": "Approval Flows",
            "reports": "Reports",
            "panel_designer": "Panel Designer",
            "personal_theme": "Personal Theme",
            "partner_settings": "Strategic Partner Settings",
            "channel_settings": "Channel Platform Settings",
        },
    },
}


def _normalize_locale(locale: str) -> str:
    raw = str(locale or "").strip().lower()
    if not raw:
        return "en"
    if raw.startswith("zh"):
        return "zh"
    if raw.startswith("pt"):
        return "pt"
    if raw.startswith("en"):
        return "en"
    if raw.startswith("tr"):
        return "tr"
    if raw.startswith("de"):
        return "de"
    if raw.startswith("fr"):
        return "fr"
    if raw.startswith("es"):
        return "es"
    if raw.startswith("it"):
        return "it"
    if raw.startswith("nl"):
        return "nl"
    if raw.startswith("pl"):
        return "pl"
    if raw.startswith("ja"):
        return "ja"
    if raw.startswith("ko"):
        return "ko"
    if raw.startswith("ar"):
        return "ar"
    if raw.startswith("ru"):
        return "ru"
    return "en"


@router.get("/{namespace}")
def get_public_translations(
    namespace: str,
    locale: str = Query("en"),
    db: Session = Depends(get_db),
):
    normalized_locale = _normalize_locale(locale)
    if normalized_locale not in SUPPORTED_LOCALES:
        normalized_locale = "en"

    namespace_bundle = BASE_TRANSLATIONS.get(namespace, {})
    default_tr = namespace_bundle.get("tr", {})
    default_en = namespace_bundle.get("en", {})
    base = namespace_bundle.get(normalized_locale) or (
        default_tr if normalized_locale == "tr" else default_en
    )

    entries = (
        db.query(TranslationCacheEntry)
        .filter(
            TranslationCacheEntry.namespace == namespace,
            TranslationCacheEntry.locale == normalized_locale,
        )
        .all()
    )
    overrides = {entry.translation_key: entry.translation_value for entry in entries}

    values: dict[str, str] = {}
    for key in set(
        list(base.keys())
        + list(default_en.keys())
        + list(default_tr.keys())
        + list(overrides.keys())
    ):
        values[key] = (
            overrides.get(key)
            or base.get(key)
            or (
                default_tr.get(key)
                if normalized_locale == "tr"
                else default_en.get(key)
            )
            or key
        )

    return {
        "namespace": namespace,
        "locale": normalized_locale,
        "values": values,
        "source": "cache+base",
    }
