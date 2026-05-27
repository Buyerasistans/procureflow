"""
Rol Katalogu v2 Migration — Kesinleşen Hedef Katalog
=====================================================
Çalıştırma:
  python scripts/migrate_role_catalog_v2.py           # dry-run (sadece yazdır)
  python scripts/migrate_role_catalog_v2.py --apply   # gerçekten uygula
"""
from __future__ import annotations

import argparse
import sys
from typing import Any

import psycopg
from psycopg.rows import dict_row

DB_URL = "postgresql://postgres:96578097@localhost:5432/procureflow"
DEMO_DOMAIN = "buyerasistans.com.tr"
DEMO_PASSWORD_HASH = None  # bcrypt hash hesaplanacak, aşağıda

# --------------------------------------------------------------------------- #
# ──────────────────────────────  KATALOG  ──────────────────────────────────  #
# --------------------------------------------------------------------------- #

PLATFORM_USERS = [
    # (email, full_name, role_code, system_role, scope_type, role_profile_code, approval_limit)
    # Super Admin → DOKUNMA
    (f"operasyon_admin@{DEMO_DOMAIN}",      "Platform Operasyon Admin",      "admin", "platform_operator", "platform", "platform.ops_admin",       0),
    (f"operasyon_yoneticisi@{DEMO_DOMAIN}", "Platform Operasyon Yöneticisi", "admin", "platform_operator", "platform", "platform.ops_manager",      0),
    (f"operasyon_uzmani@{DEMO_DOMAIN}",     "Platform Operasyon Uzmanı",     "admin", "platform_operator", "platform", "platform.ops_specialist",   0),
    (f"destek_admin@{DEMO_DOMAIN}",         "Platform Destek Admin",         "admin", "platform_support",  "platform", "platform.support_admin",    0),
    (f"destek_yoneticisi@{DEMO_DOMAIN}",    "Platform Destek Yöneticisi",    "admin", "platform_support",  "platform", "platform.support_manager",  0),
    (f"destek_uzmani@{DEMO_DOMAIN}",        "Platform Destek Uzmanı",        "admin", "platform_support",  "platform", "platform.support_agent",    0),
    (f"finans_admin@{DEMO_DOMAIN}",         "Platform Finans Admin",         "admin", "finance_officer",   "platform", "platform.finance_admin",    0),
    (f"finans_yoneticisi@{DEMO_DOMAIN}",    "Platform Finans Yöneticisi",    "admin", "finance_officer",   "platform", "platform.finance_manager",  0),
    (f"finans_uzmani@{DEMO_DOMAIN}",        "Platform Finans Uzmanı",        "admin", "finance_officer",   "platform", "platform.finance_specialist", 0),
    (f"finans_izleyici@{DEMO_DOMAIN}",      "Platform Denetçi/Finans İzleyici", "admin", "finance_officer","platform", "platform.finance_viewer",   0),
    (f"guvenlik_uzmani@{DEMO_DOMAIN}",      "Platform Güvenlik Uzmanı",      "admin", "platform_operator", "platform", "platform.security_specialist", 0),
    (f"raporlama_analisti@{DEMO_DOMAIN}",   "Platform Raporlama Analisti",   "admin", "platform_operator", "platform", "platform.reporting_analyst", 0),
]

# Mevcut email → yeni email (sadece @buyerasistans.com.tr olanlar)
PLATFORM_EMAIL_RENAMES = {
    f"portaladmin@{DEMO_DOMAIN}": f"operasyon_admin@{DEMO_DOMAIN}",
    f"support@{DEMO_DOMAIN}":     f"destek_admin@{DEMO_DOMAIN}",
    f"finance@{DEMO_DOMAIN}":     f"finans_admin@{DEMO_DOMAIN}",
}

# --------------------------------------------------------------------------- #
# SP (Stratejik Partner) — Standart Rol Şablonu                               #
# --------------------------------------------------------------------------- #
SP_ROLE_CATALOG = [
    # (name, hierarchy_level, description, permissions, role_code)
    ("Partner Admin",                  0,  "Üst seviye yönetim, tüm yetkiler.",
     ["create:personnel","read:personnel","update:personnel","delete:personnel",
      "create:department","read:department","update:department","delete:department",
      "create:company","read:company","update:company","delete:company",
      "create:project","read:project","update:project","delete:project",
      "create:role","read:role","update:role","delete:role",
      "create:quote","read:quote","update:quote","delete:quote","approve:quote"],
     "partner_admin"),
    ("Satın Alma Direktörü",           1,  "Stratejik satın alma yönetimi ve onay.",
     ["read:personnel","read:company","read:department","read:project","read:role",
      "create:project","update:project","delete:project",
      "create:quote","read:quote","update:quote","delete:quote","approve:quote"],
     "satinalma_direktoru"),
    ("Satın Alma Müdürü",              2,  "Operasyonel satın alma akışları ve teklif yönetimi.",
     ["read:company","read:department","read:project",
      "update:project",
      "create:quote","read:quote","update:quote","approve:quote"],
     "satinalma_muduru"),
    ("Satın Alma Müdür Yardımcısı",    3,  "Müdür desteği, teklif oluşturma ve sınırlı onay.",
     ["read:company","read:department","read:project","read:personnel",
      "create:quote","read:quote","update:quote","approve:quote"],
     "satinalma_mudur_yrd"),
    ("Satın Alma Yöneticisi",          4,  "Günlük teklif operasyonu ve limit bazlı onay.",
     ["read:company","read:department","read:project",
      "create:quote","read:quote","update:quote","approve:quote"],
     "satinalma_yoneticisi"),
    ("Satın Alma Kıdemli Uzmanı",      5,  "Teklif hazırlama ve güncelleme.",
     ["read:company","read:department","read:project",
      "create:quote","read:quote","update:quote"],
     "satinalma_kidemli_uzmani"),
    ("Satın Alma Uzman Yardımcısı",    6,  "Teklif desteği ve veri girişi.",
     ["read:company","read:department","read:project",
      "create:quote","read:quote","update:quote"],
     "satinalma_uzman_yrd"),
    ("Satın Alma Uzmanı",              7,  "Teknik olmayan teklif hazırlama.",
     ["read:company","read:department","read:project",
      "create:quote","read:quote","update:quote"],
     "satinalma_uzmani"),
    ("Proje Mimarı",                   8,  "Teknik şartname, mimari değerlendirme.",
     ["read:company","read:department","read:project",
      "read:quote","update:quote"],
     "proje_mimari"),
    ("Teknik Uzman",                   9,  "Teknik destek ve uygunluk değerlendirmesi.",
     ["read:company","read:department","read:project",
      "read:quote","update:quote"],
     "teknik_uzman"),
    ("Özel Stratejik Partner Rolü",   99,  "Firmaya özel esnek rol şablonu.",
     ["read:company","read:project","read:quote"],
     "ozel_partner_rolu"),
    ("Finans İzleyici",               99,  "Salt okunur finansal izleme.",
     ["read:company","read:department","read:project","read:quote"],
     "finans_izleyici"),
]

# --------------------------------------------------------------------------- #
# Tedarikçi — Standart Rol Şablonu                                             #
# --------------------------------------------------------------------------- #
SUPPLIER_ROLE_CATALOG = [
    ("Tedarikçi Admin",               0,  "Tedarikçi tarafı üst yönetim.",
     ["create:personnel","read:personnel","update:personnel","delete:personnel",
      "create:company","read:company","update:company",
      "create:quote","read:quote","update:quote","delete:quote"],
     "tedarikci_admin"),
    ("Pazarlama Müdürü",              1,  "Teklif ve pazarlama operasyonları yönetimi.",
     ["read:company","read:personnel",
      "create:quote","read:quote","update:quote","delete:quote"],
     "pazarlama_muduru"),
    ("Pazarlama Müdür Yardımcısı",    2,  "Teklif desteği ve müdür yardımı.",
     ["read:company","read:personnel",
      "create:quote","read:quote","update:quote"],
     "pazarlama_mudur_yrd"),
    ("Pazarlama Yöneticisi",          3,  "Günlük teklif operasyonu.",
     ["read:company",
      "create:quote","read:quote","update:quote"],
     "pazarlama_yoneticisi"),
    ("Kıdemli Pazarlama Uzmanı",      4,  "Teklif hazırlama ve müşteri iletişimi.",
     ["read:company",
      "create:quote","read:quote","update:quote"],
     "kidemli_pazarlama_uzmani"),
    ("Pazarlama Uzmanı",              5,  "Temel teklif hazırlama.",
     ["read:company",
      "create:quote","read:quote","update:quote"],
     "pazarlama_uzmani"),
    ("Teknik Uzman ve Mimar",         6,  "Teknik şartname ve uygunluk değerlendirmesi.",
     ["read:company",
      "read:quote","update:quote"],
     "teknik_uzman_mimar"),
    ("Teklif Uzmanı",                 7,  "Teklif gönderme, revize ve görüntüleme — kritik akış rolü.",
     ["read:quote","update:quote","create:quote"],
     "teklif_uzmani"),
    ("Özel Tedarikçi Rolü",          99,  "Tedarikçiye özel esnek rol şablonu.",
     ["read:quote"],
     "ozel_tedarikci_rolu"),
    ("Finans İzleyici",              99,  "Salt okunur finansal izleme.",
     ["read:company","read:quote"],
     "finans_izleyici"),
]

# --------------------------------------------------------------------------- #
# Kanal (İş Ortağı) — Standart Rol Şablonu                                    #
# --------------------------------------------------------------------------- #
CHANNEL_ROLE_CATALOG = [
    ("Kanal Hesap Sahibi",    0,  "Kanal organizasyonu üst yönetimi.",
     ["create:personnel","read:personnel","update:personnel","delete:personnel",
      "create:company","read:company","update:company","delete:company",
      "create:department","read:department","update:department","delete:department",
      "create:role","read:role","update:role","delete:role"],
     "kanal_hesap_sahibi"),
    ("Kanal Ekip Lideri",     1,  "Ekip yönetimi ve koordinasyon.",
     ["create:personnel","read:personnel","update:personnel",
      "read:company","read:department","read:role"],
     "kanal_ekip_lideri"),
    ("Kanal Temsilcisi",      2,  "Temel görüntüleme yetkisi.",
     ["read:company","read:department","read:personnel"],
     "kanal_temsilcisi"),
    ("Kanal Finans",          3,  "Finansal görünürlük.",
     ["read:company","read:department","read:personnel"],
     "kanal_finans"),
    ("Özel Kanal Rolü",      99,  "Kanala özel esnek rol şablonu.",
     ["read:company","read:department","read:personnel"],
     "ozel_kanal_rolu"),
]

# --------------------------------------------------------------------------- #
# Tenant → rol katalog tipi + email prefix                                     #
# --------------------------------------------------------------------------- #
TENANT_CONFIG = {
    "BA Demo Stratejik Ortak": {
        "catalog":        "sp",
        "email_prefix":   "firma",
        "scope_type":     "partner",
        "user_map": {
            # eski email → (yeni email suffix, tam ad, role_code, system_role, approval)
            f"partner.owner.demo@{DEMO_DOMAIN}":           ("firma_sahip",        "Firma Sahibi Demo",              "partner_admin", "tenant_owner",  7_500_000),
            f"partner.admin.demo@{DEMO_DOMAIN}":           ("firma_admin",         "Partner Admin Demo",             "partner_admin", "tenant_admin",  5_000_000),
            f"partner.procurement.lead1@{DEMO_DOMAIN}":   ("firma_mudur",         "Satın Alma Müdürü Demo",         "satinalma_muduru", "tenant_member", 1_500_000),
            f"partner.procurement.lead2@{DEMO_DOMAIN}":   ("firma_direktor",      "Satın Alma Direktörü Demo",      "satinalma_direktoru", "tenant_member", 3_000_000),
            f"partner.tech.demo1@{DEMO_DOMAIN}":           ("firma_mimar",         "Proje Mimarı Demo 1",            "proje_mimari", "tenant_member", 250_000),
            f"partner.tech.demo2@{DEMO_DOMAIN}":           ("firma_teknik",        "Teknik Uzman Demo",              "teknik_uzman", "tenant_member", 250_000),
            f"partner.audit.demo@{DEMO_DOMAIN}":           ("firma_finans",        "Finans İzleyici Demo",           "finans_izleyici", "tenant_member", 0),
            f"partner.custom.demo@{DEMO_DOMAIN}":          ("firma_ozel",          "Özel Partner Rol Demo",          "ozel_partner_rolu", "tenant_member", 150_000),
        },
        "new_users": [
            # (email_suffix, full_name, role_code, system_role, approval_limit, assignment_role_name)
            ("firma_mudur_yrd",    "Satın Alma Müdür Yardımcısı Demo", "satinalma_mudur_yrd",    "tenant_member", 750_000,  "Satın Alma Müdür Yardımcısı"),
            ("firma_yonetici",     "Satın Alma Yöneticisi Demo",        "satinalma_yoneticisi",   "tenant_member", 500_000,  "Satın Alma Yöneticisi"),
            ("firma_kidemli_uzm",  "Satın Alma Kıdemli Uzmanı Demo",    "satinalma_kidemli_uzmani","tenant_member",250_000, "Satın Alma Kıdemli Uzmanı"),
            ("firma_uzman_yrd",    "Satın Alma Uzman Yardımcısı Demo",  "satinalma_uzman_yrd",    "tenant_member", 100_000,  "Satın Alma Uzman Yardımcısı"),
            ("firma_uzman",        "Satın Alma Uzmanı Demo",            "satinalma_uzmani",       "tenant_member", 100_000,  "Satın Alma Uzmanı"),
        ],
        "role_renames": {
            "Partner Ana Yonetici":          "Partner Admin",
            "Partner Yoneticisi":            None,  # None = pasife çek
            "Satin Alma Muduru":             "Satın Alma Müdürü",
            "Teknik Uzman ve Mimar":         "Proje Mimarı",
            "Denetci ve Finansal Izleyici":  "Finans İzleyici",
            "Ozel Partner Rolu":             "Özel Stratejik Partner Rolü",
            # Tam Türkçe isimler (encoding fixed)
            "Partner Ana Yönetici":          "Partner Admin",
            "Partner Yöneticisi":            None,
            "Satın Alma Müdürü":             "Satın Alma Müdürü",
            "Teknik Uzman ve Mimar":         "Proje Mimarı",
            "Denetçi ve Finansal İzleyici":  "Finans İzleyici",
            "Özel Partner Rolü":             "Özel Stratejik Partner Rolü",
        },
    },

    "BA Demo Is Ortagi": {
        "catalog":        "channel",
        "email_prefix":   "firma",
        "scope_type":     "channel",
        "user_map": {
            f"channel.owner.demo@{DEMO_DOMAIN}":   ("firma_kanal_sahibi",  "Kanal Hesap Sahibi Demo", "kanal_hesap_sahibi", "tenant_member", 0),
            f"channel.lead.demo@{DEMO_DOMAIN}":    ("firma_ekip_lideri",   "Kanal Ekip Lideri Demo",  "kanal_ekip_lideri",  "tenant_member", 0),
            f"channel.agent.demo@{DEMO_DOMAIN}":   ("firma_temsilci",      "Kanal Temsilcisi Demo",   "kanal_temsilcisi",   "tenant_member", 0),
            f"channel.finance.demo@{DEMO_DOMAIN}":(  "firma_kanal_finans",  "Kanal Finans Demo",       "kanal_finans",       "tenant_member", 0),
            f"channel.audit.demo@{DEMO_DOMAIN}":   ("firma_ozel_kanal",    "Özel Kanal Rol Demo",     "ozel_kanal_rolu",    "tenant_member", 0),
        },
        "new_users": [],
        "role_renames": {
            "Kanal Finans Görüntüleyici":  "Kanal Finans",
            "Kanal Finans Görüntüleyici": "Kanal Finans",
            "Kanal Denetçisi":             "Özel Kanal Rolü",
            "Kanal Denetçisi":        "Özel Kanal Rolü",
        },
    },

    "Kanal Ana Yonetici Demo": {
        "catalog":        "channel",
        "email_prefix":   "kanal",
        "scope_type":     "channel",
        "user_map": {
            f"channel.kanal-ana-yonetici-demo-kisisel-is-ortagi-workspace.audit@{DEMO_DOMAIN}":   ("kanal_ozel_kanal",   "Özel Kanal Rol Demo",     "ozel_kanal_rolu",    "tenant_member", 0),
            f"channel.kanal-ana-yonetici-demo-kisisel-is-ortagi-workspace.finance@{DEMO_DOMAIN}": ("kanal_kanal_finans", "Kanal Finans Demo",        "kanal_finans",       "tenant_member", 0),
            f"channel.kanal-ana-yonetici-demo-kisisel-is-ortagi-workspace.agent@{DEMO_DOMAIN}":   ("kanal_temsilci",     "Kanal Temsilcisi Demo",    "kanal_temsilcisi",   "tenant_member", 0),
            f"channel.kanal-ana-yonetici-demo-kisisel-is-ortagi-workspace.lead@{DEMO_DOMAIN}":    ("kanal_ekip_lideri",  "Kanal Ekip Lideri Demo",   "kanal_ekip_lideri",  "tenant_member", 0),
        },
        "new_users": [
            ("kanal_sahibi", "Kanal Hesap Sahibi Demo", "kanal_hesap_sahibi", "tenant_member", 0, "Kanal Hesap Sahibi"),
        ],
        "role_renames": {
            "Kanal Finans Görüntüleyici": "Kanal Finans",
            "Kanal Denetçisi":            "Özel Kanal Rolü",
        },
    },

    "OLİMPOS TEKNOLOJİ": {
        "catalog":        "sp",
        "email_prefix":   "olimpos",
        "scope_type":     "partner",
        "user_map":       {},  # Mevcut kullanıcı emaillerine dokunma
        "new_users": [
            ("olimpos_admin",       "OLİMPOS Partner Admin",               "partner_admin",           "tenant_admin",  5_000_000, "Partner Admin"),
            ("olimpos_direktor",    "OLİMPOS Satın Alma Direktörü",        "satinalma_direktoru",     "tenant_member", 3_000_000, "Satın Alma Direktörü"),
            ("olimpos_mudur",       "OLİMPOS Satın Alma Müdürü",           "satinalma_muduru",        "tenant_member", 1_500_000, "Satın Alma Müdürü"),
            ("olimpos_mudur_yrd",   "OLİMPOS Satın Alma Müdür Yardımcısı","satinalma_mudur_yrd",     "tenant_member",   750_000, "Satın Alma Müdür Yardımcısı"),
            ("olimpos_yonetici",    "OLİMPOS Satın Alma Yöneticisi",       "satinalma_yoneticisi",    "tenant_member",   500_000, "Satın Alma Yöneticisi"),
            ("olimpos_kidemli_uzm", "OLİMPOS Satın Alma Kıdemli Uzmanı",   "satinalma_kidemli_uzmani","tenant_member",   250_000, "Satın Alma Kıdemli Uzmanı"),
            ("olimpos_uzman_yrd",   "OLİMPOS Satın Alma Uzman Yardımcısı", "satinalma_uzman_yrd",     "tenant_member",   100_000, "Satın Alma Uzman Yardımcısı"),
            ("olimpos_uzman",       "OLİMPOS Satın Alma Uzmanı",           "satinalma_uzmani",        "tenant_member",   100_000, "Satın Alma Uzmanı"),
            ("olimpos_mimar",       "OLİMPOS Proje Mimarı",                "proje_mimari",            "tenant_member",   250_000, "Proje Mimarı"),
            ("olimpos_teknik",      "OLİMPOS Teknik Uzman",                "teknik_uzman",            "tenant_member",   250_000, "Teknik Uzman"),
            ("olimpos_ozel",        "OLİMPOS Özel Partner Rolü",           "ozel_partner_rolu",       "tenant_member",   100_000, "Özel Stratejik Partner Rolü"),
            ("olimpos_finans",      "OLİMPOS Finans İzleyici",             "finans_izleyici",         "tenant_member",         0, "Finans İzleyici"),
        ],
        "role_renames": {
            "Satın Alma Admin":  "Partner Admin",
            "Satin Alma Admin":  "Partner Admin",
        },
    },

    "Poseydon": {
        "catalog":        "sp",
        "email_prefix":   "poseydon",
        "scope_type":     "partner",
        "user_map":       {},
        "new_users": [
            ("poseydon_admin",       "Poseydon Partner Admin",               "partner_admin",           "tenant_admin",  5_000_000, "Partner Admin"),
            ("poseydon_direktor",    "Poseydon Satın Alma Direktörü",        "satinalma_direktoru",     "tenant_member", 3_000_000, "Satın Alma Direktörü"),
            ("poseydon_mudur",       "Poseydon Satın Alma Müdürü",           "satinalma_muduru",        "tenant_member", 1_500_000, "Satın Alma Müdürü"),
            ("poseydon_mudur_yrd",   "Poseydon Satın Alma Müdür Yardımcısı","satinalma_mudur_yrd",     "tenant_member",   750_000, "Satın Alma Müdür Yardımcısı"),
            ("poseydon_yonetici",    "Poseydon Satın Alma Yöneticisi",       "satinalma_yoneticisi",    "tenant_member",   500_000, "Satın Alma Yöneticisi"),
            ("poseydon_kidemli_uzm", "Poseydon Satın Alma Kıdemli Uzmanı",   "satinalma_kidemli_uzmani","tenant_member",   250_000, "Satın Alma Kıdemli Uzmanı"),
            ("poseydon_uzman_yrd",   "Poseydon Satın Alma Uzman Yardımcısı", "satinalma_uzman_yrd",     "tenant_member",   100_000, "Satın Alma Uzman Yardımcısı"),
            ("poseydon_uzman",       "Poseydon Satın Alma Uzmanı",           "satinalma_uzmani",        "tenant_member",   100_000, "Satın Alma Uzmanı"),
            ("poseydon_mimar",       "Poseydon Proje Mimarı",                "proje_mimari",            "tenant_member",   250_000, "Proje Mimarı"),
            ("poseydon_teknik",      "Poseydon Teknik Uzman",                "teknik_uzman",            "tenant_member",   250_000, "Teknik Uzman"),
            ("poseydon_ozel",        "Poseydon Özel Partner Rolü",           "ozel_partner_rolu",       "tenant_member",   100_000, "Özel Stratejik Partner Rolü"),
            ("poseydon_finans",      "Poseydon Finans İzleyici",             "finans_izleyici",         "tenant_member",         0, "Finans İzleyici"),
        ],
        "role_renames": {
            "Satın Alma Admin":    "Partner Admin",
            "Satin Alma Admin":    "Partner Admin",
            "Satın Alma Personeli": None,   # katalogda yok → pasife çek
        },
    },

    "PİZZA MAX": {
        "catalog":        "sp",
        "email_prefix":   "pizzamax",
        "scope_type":     "partner",
        "user_map": {
            f"yorpas.direktor@{DEMO_DOMAIN}":       ("pizzamax_direktor",   "PİZZA MAX Satın Alma Direktörü",  "satinalma_direktoru",  "tenant_member", 3_000_000),
            f"bereket.uzman@{DEMO_DOMAIN}":         ("pizzamax_uzman",      "PİZZA MAX Satın Alma Uzmanı",     "satinalma_uzmani",     "tenant_member",   100_000),
            f"pizzamax.mudur@{DEMO_DOMAIN}":        ("pizzamax_mudur",      "PİZZA MAX Satın Alma Müdürü",     "satinalma_muduru",     "tenant_member", 1_500_000),
            f"komagene.yonetici@{DEMO_DOMAIN}":     ("pizzamax_yonetici",   "PİZZA MAX Satın Alma Yöneticisi", "satinalma_yoneticisi", "tenant_member",   500_000),
            f"schbitzel.satinalmaci@{DEMO_DOMAIN}": ("pizzamax_ozel",       "PİZZA MAX Özel Partner Rolü",     "ozel_partner_rolu",    "tenant_member",   100_000),
        },
        "new_users": [
            ("pizzamax_admin",      "PİZZA MAX Partner Admin",               "partner_admin",           "tenant_admin",  5_000_000, "Partner Admin"),
            ("pizzamax_mudur_yrd",  "PİZZA MAX Satın Alma Müdür Yardımcısı","satinalma_mudur_yrd",     "tenant_member",   750_000, "Satın Alma Müdür Yardımcısı"),
            ("pizzamax_kidemli_uzm","PİZZA MAX Satın Alma Kıdemli Uzmanı",   "satinalma_kidemli_uzmani","tenant_member",   250_000, "Satın Alma Kıdemli Uzmanı"),
            ("pizzamax_uzman_yrd",  "PİZZA MAX Satın Alma Uzman Yardımcısı", "satinalma_uzman_yrd",     "tenant_member",   100_000, "Satın Alma Uzman Yardımcısı"),
            ("pizzamax_mimar",      "PİZZA MAX Proje Mimarı",                "proje_mimari",            "tenant_member",   250_000, "Proje Mimarı"),
            ("pizzamax_teknik",     "PİZZA MAX Teknik Uzman",                "teknik_uzman",            "tenant_member",   250_000, "Teknik Uzman"),
            ("pizzamax_finans",     "PİZZA MAX Finans İzleyici",             "finans_izleyici",         "tenant_member",         0, "Finans İzleyici"),
        ],
        "role_renames": {
            "Satin Alma Admin":          "Partner Admin",
            "SATIN ALAMA DIREKTORU":     None,   # eski slug → pasife çek
            "SATIN ALAMA MUDURU":        None,
            "SATIN ALAMA YONETICISI":    None,
            "SATIN ALAMA UZMANI":        None,
            "Super Admin":               None,   # yanış ekleme → pasife çek
            "super_admin [merged->6:8]": None,
            "Satin Alma Mudur Yardimcisi": "Satın Alma Müdür Yardımcısı",
            "Satin Alma Kidemli Uzmani": "Satın Alma Kıdemli Uzmanı",
            "Satin Alma Uzman Yardimcisi": "Satın Alma Uzman Yardımcısı",
            "satinalma_direktoru":       None,   # eski slug-tabanlı rol → pasife çek (users taşınacak)
            "satinalma_yoneticisi":      None,
            "satinalma_uzmani":          None,
            "satinalmaci":               None,
        },
    },
}

# --------------------------------------------------------------------------- #
# ──────────────────────────────  YARDIMCILAR  ──────────────────────────────  #
# --------------------------------------------------------------------------- #

def get_password_hash(password: str) -> str:
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
        return ctx.hash(password)
    except ImportError:
        import hashlib, secrets
        salt = secrets.token_hex(16)
        h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
        return f"pbkdf2_sha256$260000${salt}${h.hex()}"


def pct(label: str, value: Any, dry: bool) -> None:
    mode = "[DRY-RUN]" if dry else "[UYGULA]"
    print(f"  {mode} {label}")


# --------------------------------------------------------------------------- #
# ──────────────────────────────  MIGRATION  ────────────────────────────────  #
# --------------------------------------------------------------------------- #

def migrate_platform_users(cur: Any, dry: bool) -> None:
    print("\n═══ PLATFORM KULLANICILARI ═══")
    pwd_hash = get_password_hash("Aa1234!!")

    # 1. Email rename
    for old_email, new_email in PLATFORM_EMAIL_RENAMES.items():
        cur.execute("SELECT id, full_name FROM users WHERE email = %s", (old_email,))
        row = cur.fetchone()
        if row:
            pct(f"RENAME  {old_email} → {new_email}  (id={row['id']})", None, dry)
            if not dry:
                cur.execute("UPDATE users SET email = %s, work_email = %s WHERE id = %s",
                            (new_email, new_email, row["id"]))
        else:
            print(f"  [ATLA]  Mevcut değil: {old_email}")

    # 2. Yeni platform kullanıcıları oluştur/güncelle
    for (email, full_name, role_code, system_role, scope_type, profile_code, approval) in PLATFORM_USERS:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        if row:
            pct(f"UPDATE  {email}  (id={row['id']})", None, dry)
            if not dry:
                cur.execute("""
                    UPDATE users SET full_name=%s, role=%s, system_role=%s,
                                     scope_type=%s, role_profile_code=%s,
                                     approval_limit=%s, is_active=TRUE
                    WHERE id=%s
                """, (full_name, role_code, system_role, scope_type, profile_code,
                      approval, row["id"]))
        else:
            pct(f"CREATE  {email}  [{system_role}]", None, dry)
            if not dry:
                cur.execute("""
                    INSERT INTO users (email, work_email, full_name, hashed_password,
                        role, system_role, scope_type, role_profile_code,
                        approval_limit, is_active, invitation_accepted,
                        hide_location, share_on_whatsapp, hidden_from_admin)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,TRUE,FALSE,TRUE,FALSE)
                """, (email, email, full_name, pwd_hash, role_code, system_role,
                      scope_type, profile_code, approval))


def get_catalog(catalog_type: str) -> list[tuple]:
    if catalog_type == "sp":
        return SP_ROLE_CATALOG
    if catalog_type == "supplier":
        return SUPPLIER_ROLE_CATALOG
    if catalog_type == "channel":
        return CHANNEL_ROLE_CATALOG
    return []


def resolve_permissions(cur: Any, perm_names: list[str]) -> list[int]:
    if not perm_names:
        return []
    cur.execute("SELECT id, name FROM permissions WHERE name = ANY(%s)", (perm_names,))
    return [r["id"] for r in cur.fetchall()]


def migrate_tenant(cur: Any, tenant_name: str, cfg: dict, dry: bool) -> None:
    print(f"\n═══ TENANT: {tenant_name} ═══")
    cur.execute("SELECT id FROM tenants WHERE brand_name = %s", (tenant_name,))
    tenant_row = cur.fetchone()
    if not tenant_row:
        print(f"  [ATLA] Tenant bulunamadı: {tenant_name}")
        return
    tenant_id = tenant_row["id"]
    pwd_hash = get_password_hash("Aa1234!!")

    # 1. Rol rename / pasife çek
    role_renames: dict[str, str | None] = cfg.get("role_renames", {})
    for old_name, new_name in role_renames.items():
        cur.execute("SELECT id, name, is_active FROM roles WHERE tenant_id=%s AND name=%s",
                    (tenant_id, old_name))
        role_row = cur.fetchone()
        if not role_row:
            continue
        if new_name is None:
            pct(f"ROL PASIF  [{old_name}]", None, dry)
            if not dry:
                cur.execute("UPDATE roles SET is_active=FALSE WHERE id=%s", (role_row["id"],))
        else:
            # Hedef isimde başka aktif rol var mı?
            cur.execute("SELECT id FROM roles WHERE tenant_id=%s AND name=%s AND id != %s",
                        (tenant_id, new_name, role_row["id"]))
            existing = cur.fetchone()
            if existing:
                pct(f"ROL PASIF (çakışma)  [{old_name}] → [{new_name}] zaten var", None, dry)
                if not dry:
                    cur.execute("UPDATE roles SET is_active=FALSE WHERE id=%s", (role_row["id"],))
            else:
                pct(f"ROL RENAME  [{old_name}] → [{new_name}]", None, dry)
                if not dry:
                    cur.execute("UPDATE roles SET name=%s WHERE id=%s", (new_name, role_row["id"]))

    # 2. Katalog rollerini upsert et
    catalog = get_catalog(cfg["catalog"])
    cur.execute("SELECT id FROM users WHERE system_role IN ('tenant_admin','tenant_owner') "
                "AND tenant_id=%s LIMIT 1", (tenant_id,))
    owner_row = cur.fetchone()
    owner_id = owner_row["id"] if owner_row else None

    for (role_name, hierarchy_level, description, perm_names, _code) in catalog:
        cur.execute("SELECT id FROM roles WHERE tenant_id=%s AND name=%s", (tenant_id, role_name))
        existing = cur.fetchone()
        perm_ids = resolve_permissions(cur, perm_names)

        if existing:
            pct(f"ROL UPDATE  [{role_name}] (Lvl {hierarchy_level})", None, dry)
            if not dry:
                cur.execute("""
                    UPDATE roles SET hierarchy_level=%s, description=%s,
                                     is_active=TRUE, created_by_id=%s
                    WHERE id=%s
                """, (hierarchy_level, description, owner_id, existing["id"]))
                cur.execute("DELETE FROM role_permissions WHERE role_id=%s", (existing["id"],))
                for pid in perm_ids:
                    cur.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (%s,%s)",
                                (existing["id"], pid))
        else:
            pct(f"ROL CREATE  [{role_name}] (Lvl {hierarchy_level})", None, dry)
            if not dry:
                cur.execute("""
                    INSERT INTO roles (tenant_id, name, description, hierarchy_level,
                                       created_by_id, is_active, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,TRUE,NOW(),NOW()) RETURNING id
                """, (tenant_id, role_name, description, hierarchy_level, owner_id))
                new_role_id = cur.fetchone()["id"]
                for pid in perm_ids:
                    cur.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (%s,%s)",
                                (new_role_id, pid))

    # 3. Mevcut kullanıcı email rename
    for old_email, (suffix, full_name, role_code, system_role, approval) in cfg.get("user_map", {}).items():
        new_email = f"{suffix}@{DEMO_DOMAIN}"
        cur.execute("SELECT id FROM users WHERE email=%s", (old_email,))
        row = cur.fetchone()
        if row:
            pct(f"USER RENAME  {old_email} → {new_email}", None, dry)
            if not dry:
                cur.execute("""
                    UPDATE users SET email=%s, work_email=%s, full_name=%s,
                                     role=%s, system_role=%s, approval_limit=%s
                    WHERE id=%s
                """, (new_email, new_email, full_name, role_code, system_role,
                      approval, row["id"]))
        else:
            print(f"  [ATLA]  Mevcut değil: {old_email}")

    # 4. Eksik kullanıcıları oluştur
    for entry in cfg.get("new_users", []):
        suffix, full_name, role_code, system_role, approval, assignment_role = entry
        email = f"{suffix}@{DEMO_DOMAIN}"
        cur.execute("SELECT id FROM users WHERE email=%s", (email,))
        row = cur.fetchone()
        if row:
            pct(f"USER UPDATE  {email}", None, dry)
            if not dry:
                cur.execute("""
                    UPDATE users SET full_name=%s, role=%s, system_role=%s,
                                     scope_type=%s, approval_limit=%s,
                                     tenant_id=%s, is_active=TRUE
                    WHERE id=%s
                """, (full_name, role_code, system_role, cfg["scope_type"],
                      approval, tenant_id, row["id"]))
        else:
            pct(f"USER CREATE  {email}  [{assignment_role}]", None, dry)
            if not dry:
                cur.execute("""
                    INSERT INTO users (email, work_email, full_name, hashed_password,
                        role, system_role, scope_type, approval_limit, tenant_id,
                        is_active, invitation_accepted,
                        hide_location, share_on_whatsapp, hidden_from_admin)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,TRUE,FALSE,TRUE,FALSE)
                """, (email, email, full_name, pwd_hash, role_code, system_role,
                      cfg["scope_type"], approval, tenant_id))


# --------------------------------------------------------------------------- #
# ──────────────────────────────  MAIN  ─────────────────────────────────────  #
# --------------------------------------------------------------------------- #

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Değişiklikleri gerçekten uygula")
    args = parser.parse_args()
    dry = not args.apply

    if dry:
        print("\n★★ DRY-RUN MODU — Hiçbir şey yazılmıyor ★★\n")
    else:
        print("\n★★ UYGULAMA MODU — Değişiklikler DB'ye yazılıyor ★★\n")

    with psycopg.connect(DB_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            migrate_platform_users(cur, dry)
            for tenant_name, cfg in TENANT_CONFIG.items():
                migrate_tenant(cur, tenant_name, cfg, dry)

        if dry:
            conn.rollback()
            print("\n✓ DRY-RUN tamamlandı — rollback yapıldı, DB değişmedi.")
        else:
            conn.commit()
            print("\n✓ Migration başarıyla uygulandı ve commit edildi.")


if __name__ == "__main__":
    main()
