from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy.orm import Session

from api.core.security import get_password_hash
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.models.department import Department
from api.models.role import Permission, Role
from api.models.supplier import Supplier, SupplierUser
from api.models.tenant import Tenant, TenantSettings
from api.models.user import User

DEMO_PASSWORD = "Aa1234!!"
DEMO_EMAIL_DOMAIN = "buyerasistans.com.tr"

DEMO_PLATFORM_ROLE_SEED = [
    {
        "name": "Platform Operasyon Admin",
        "description": "Platform operasyon ekibinin tam yetkili yöneticisi.",
        "hierarchy_level": 1,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel",
            "read:company", "read:department", "read:project",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Platform Operasyon Yöneticisi",
        "description": "Operasyon süreçlerini yönetir ve koordine eder.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel", "read:company", "read:department", "read:project",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Platform Operasyon Uzmanı",
        "description": "Operasyon destek ve süreç takibi.",
        "hierarchy_level": 3,
        "permissions": [
            "read:personnel", "read:company", "read:department", "read:project",
            "read:quote",
        ],
    },
    {
        "name": "Platform Destek Admin",
        "description": "Destek ekibinin tam yetkili yöneticisi.",
        "hierarchy_level": 1,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel",
            "read:company", "read:department",
            "read:quote",
        ],
    },
    {
        "name": "Platform Destek Yöneticisi",
        "description": "Destek süreçlerini yönetir.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel", "read:company", "read:department",
            "read:quote",
        ],
    },
    {
        "name": "Platform Destek Uzmanı",
        "description": "Kullanıcı destek taleplerini işler.",
        "hierarchy_level": 3,
        "permissions": [
            "read:personnel", "read:company",
            "read:quote",
        ],
    },
    {
        "name": "Platform Finans Admin",
        "description": "Platform finansal işlemlerinin tam yetkili yöneticisi.",
        "hierarchy_level": 1,
        "permissions": [
            "read:personnel", "read:company", "read:department", "read:project",
            "create:quote", "read:quote", "update:quote", "approve:quote",
        ],
    },
    {
        "name": "Platform Finans Yöneticisi",
        "description": "Finansal süreçleri ve raporlamayı yönetir.",
        "hierarchy_level": 2,
        "permissions": [
            "read:company", "read:department", "read:project",
            "read:quote", "update:quote", "approve:quote",
        ],
    },
    {
        "name": "Platform Finans Uzmanı",
        "description": "Finansal veri girişi ve süreç desteği.",
        "hierarchy_level": 3,
        "permissions": [
            "read:company", "read:department",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Platform Denetçi / Finans İzleyici",
        "description": "Salt okunur finansal denetim ve izleme.",
        "hierarchy_level": 99,
        "permissions": [
            "read:company", "read:department", "read:project",
            "read:quote",
        ],
    },
    {
        "name": "Platform Güvenlik Uzmanı",
        "description": "Platform güvenlik politikaları ve denetim.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel", "read:company", "read:department",
            "read:quote",
        ],
    },
    {
        "name": "Platform Raporlama Analisti",
        "description": "Platform geneli raporlama ve veri analizi.",
        "hierarchy_level": 3,
        "permissions": [
            "read:company", "read:department", "read:project",
            "read:quote",
        ],
    },
    {
        "name": "Platform İK Admin",
        "description": "Kariyer modülünün tam yetkili platform İK yöneticisi. İK Yöneticisi ve Uzmanı yetkilendirebilir.",
        "hierarchy_level": 1,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel",
            "read:company", "read:department",
        ],
    },
    {
        "name": "Platform İK Yöneticisi",
        "description": "İK süreçlerini yönetir, iş ilanı oluşturur ve İK uzmanlarını koordine eder.",
        "hierarchy_level": 2,
        "permissions": [
            "read:personnel", "read:company", "read:department",
        ],
    },
    {
        "name": "Platform İK Uzmanı",
        "description": "İş ilanı hazırlama ve aday yönetimi operasyonları.",
        "hierarchy_level": 3,
        "permissions": [
            "read:personnel", "read:company",
        ],
    },
]

DEMO_PARTNER_TENANT = {
    "slug": "demo-stratejik-ortak",
    "legal_name": "Buyera Asistans Demo Stratejik Ortak A.S.",
    "brand_name": "BA Demo Stratejik Ortak",
    "subscription_plan_code": "growth",
}

DEMO_CAREER_TENANT = {
    "slug": "ba-demo-kariyer",          # "kariyer" → inferTenantScope returns "career"
    "legal_name": "BA Demo Kariyer ve İş Piyasası",
    "brand_name": "BA Demo Kariyer",
    "category": "kariyer",
}

DEMO_CAREER_ROLE_SEED = [
    {
        "name": "İşveren Admin",
        "description": "İşveren firmasının tam yetkili yöneticisi. İş ilanı yönetimi ve aday pipeline görünürlüğü.",
        "hierarchy_level": 0,
        "permissions": ["read:personnel", "read:company", "read:department"],
    },
    {
        "name": "İşveren Recruiter",
        "description": "İşveren adına işe alım süreçlerini yürüten recruiter. İlan yönetimi ve aday takibi.",
        "hierarchy_level": 1,
        "permissions": ["read:personnel", "read:company"],
    },
    {
        "name": "Aday",
        "description": "İş arayan kullanıcı. Profil oluşturma, iş ilanına başvuru ve süreç takibi.",
        "hierarchy_level": 2,
        "permissions": ["read:company"],
    },
    {
        "name": "Satın Alma Yeteneği",
        "description": "Satın alma ve tedarik zinciri alanında kariyer hedefleyen yetenek profili.",
        "hierarchy_level": 3,
        "permissions": ["read:company"],
    },
]

DEMO_CHANNEL_TENANT = {
    "slug": "demo-kanal-is-ortagi",
    "legal_name": "Buyera Asistans Demo Kanal İş Ortağı Workspace",
    "brand_name": "BA Demo İş Ortağı",
}

DEMO_SUPPLIER_TENANT = {
    "slug": "demo-tedarikci-firma",   # "tedarikci" → inferTenantScope returns "supplier"
    "legal_name": "BA Demo Tedarikçi Firma A.Ş.",
    "brand_name": "BA Demo Tedarikçi",
    "category": "tedarikci",
    "subscription_plan_code": "starter",
}

DEMO_SUPPLIER_COMPANIES = [
    {
        "name": "BA Demo Tedarikçi Merkez",
        "description": "Tedarikçi ana organizasyon merkezi.",
        "color": "#0f766e",
    },
]

DEMO_SUPPLIER_DEPARTMENTS = [
    {
        "name": "Pazarlama ve Satış",
        "description": "Teklif hazırlama, müşteri iletişimi ve pazarlama operasyonları.",
    },
    {
        "name": "Teknik ve Ürün",
        "description": "Teknik şartname, ürün katalog ve fiyatlandırma.",
    },
]

DEMO_SUPPLIER_ROLE_SEED = [
    {
        "name": "Tedarikçi Admin",
        "description": "Tedarikçi organizasyonunun tam yetki sahibi.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel", "delete:personnel",
            "create:department", "read:department", "update:department", "delete:department",
            "create:company", "read:company", "update:company", "delete:company",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Pazarlama Müdürü",
        "description": "Pazarlama ekibi yönetimi ve teklif stratejisi.",
        "hierarchy_level": 1,
        "permissions": ["read:personnel", "read:company", "read:department", "read:quote", "update:quote"],
    },
    {
        "name": "Pazarlama Müdür Yardımcısı",
        "description": "Pazarlama müdürüne operasyonel destek.",
        "hierarchy_level": 2,
        "permissions": ["read:company", "read:department", "read:quote", "update:quote"],
    },
    {
        "name": "Pazarlama Yöneticisi",
        "description": "Günlük pazarlama ve teklif süreçleri.",
        "hierarchy_level": 3,
        "permissions": ["read:company", "read:department", "read:quote", "update:quote"],
    },
    {
        "name": "Kıdemli Pazarlama Uzmanı",
        "description": "Teklif hazırlama ve müşteri iletişimi.",
        "hierarchy_level": 4,
        "permissions": ["read:company", "read:department", "read:quote", "update:quote"],
    },
    {
        "name": "Pazarlama Uzmanı",
        "description": "Standart teklif hazırlama ve veri girişi.",
        "hierarchy_level": 5,
        "permissions": ["read:company", "read:department", "read:quote"],
    },
    {
        "name": "Teknik Uzman ve Mimar",
        "description": "Teknik şartname değerlendirme ve ürün mimarisi.",
        "hierarchy_level": 6,
        "permissions": ["read:company", "read:department", "read:quote"],
    },
    {
        "name": "Teklif Uzmanı",
        "description": "Teklif akışı uzmanı.",
        "hierarchy_level": 7,
        "permissions": ["read:company", "read:quote", "update:quote"],
    },
    {
        "name": "Özel Tedarikçi Rolü",
        "description": "Tedarikçiye özel esnek rol şablonu.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:quote"],
    },
    {
        "name": "Finans İzleyici",
        "description": "Salt okunur finansal izleme.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:quote"],
    },
    {
        "name": "İK Yöneticisi",
        "description": "Tedarikçi organizasyonu İK yöneticisi.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:department"],
    },
    {
        "name": "İK Uzmanı",
        "description": "Temel İK operasyonları ve iş ilanı desteği.",
        "hierarchy_level": 99,
        "permissions": ["read:company"],
    },
]

DEMO_SUPPLIER_USERS = [
    {
        "email": f"tedarikci_admin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Tedarikçi Admin Demo",
        "role": "supplier_admin",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.admin",
        "approval_limit": 0,
        "department": "Pazarlama ve Satış",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Tedarikçi Admin",
    },
    {
        "email": f"tedarikci_mudur@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Pazarlama Müdürü Demo",
        "role": "pazarlama_muduru",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.marketing_manager",
        "approval_limit": 0,
        "department": "Pazarlama ve Satış",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Pazarlama Müdürü",
    },
    {
        "email": f"tedarikci_yonetici@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Pazarlama Yöneticisi Demo",
        "role": "pazarlama_yoneticisi",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.marketing_supervisor",
        "approval_limit": 0,
        "department": "Pazarlama ve Satış",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Pazarlama Yöneticisi",
    },
    {
        "email": f"tedarikci_uzman@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Pazarlama Uzmanı Demo",
        "role": "pazarlama_uzmani",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.marketing_specialist",
        "approval_limit": 0,
        "department": "Pazarlama ve Satış",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Pazarlama Uzmanı",
    },
    {
        "email": f"tedarikci_teknik@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Teknik Uzman ve Mimar Demo",
        "role": "teknik_uzman_mimar",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.technical_architect",
        "approval_limit": 0,
        "department": "Teknik ve Ürün",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Teknik Uzman ve Mimar",
    },
    {
        "email": f"tedarikci_teklif@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Teklif Uzmanı Demo",
        "role": "teklif_uzmani",
        "system_role": "supplier_user",
        "scope_type": "supplier",
        "role_profile_code": "supplier_tenant.quotation_specialist",
        "approval_limit": 0,
        "department": "Teknik ve Ürün",
        "company": "BA Demo Tedarikçi Merkez",
        "assignment_role": "Teklif Uzmanı",
    },
]

DEMO_PARTNER_COMPANIES = [
    {
        "name": "BA Demo Merkez",
        "description": "Stratejik partner ana organizasyon merkezi.",
        "color": "#1f6f5f",
    },
    {
        "name": "BA Demo Proje Ofisi",
        "description": "Teknik ve operasyon ekiplerinin proje merkezi.",
        "color": "#2f855a",
    },
]

DEMO_PARTNER_DEPARTMENTS = [
    {
        "name": "Yönetim ve Organizasyon",
        "description": "Partner sahipliği, idari koordinasyon ve kurulum yönetimi.",
    },
    {
        "name": "Satın Alma Operasyonları",
        "description": "RFQ, teklif toplama, supplier iletişim ve operasyon yönetimi.",
    },
    {
        "name": "Teknik Ofis ve Şartname",
        "description": "Teknik dosyalar, mimari değerlendirme ve teknik uygunluk kontrolü.",
    },
    {
        "name": "Finans ve Denetim",
        "description": "Bütçe kontrolü, denetim izi ve finansal görünürlük.",
    },
]

DEMO_PARTNER_ROLE_SEED = [
    {
        "name": "Partner Admin",
        "description": "Üst seviye yönetim, tüm organizasyon yetkileri.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel", "delete:personnel",
            "create:department", "read:department", "update:department", "delete:department",
            "create:company", "read:company", "update:company", "delete:company",
            "create:project", "read:project", "update:project", "delete:project",
            "create:role", "read:role", "update:role", "delete:role",
            "create:quote", "read:quote", "update:quote", "delete:quote", "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Direktörü",
        "description": "Stratejik satın alma yönetimi ve onay.",
        "hierarchy_level": 1,
        "permissions": [
            "read:personnel", "read:company", "read:department", "read:project", "read:role",
            "create:project", "update:project", "delete:project",
            "create:quote", "read:quote", "update:quote", "delete:quote", "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Müdürü",
        "description": "Operasyonel satın alma akışlarını, teklifleri ve proje bağlı talepleri yönetir.",
        "hierarchy_level": 2,
        "permissions": [
            "read:company", "read:department", "read:project", "update:project",
            "create:quote", "read:quote", "update:quote", "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Müdür Yardımcısı",
        "description": "Müdür desteği, teklif oluşturma ve sınırlı onay.",
        "hierarchy_level": 3,
        "permissions": [
            "read:company", "read:department", "read:project", "read:personnel",
            "create:quote", "read:quote", "update:quote", "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Yöneticisi",
        "description": "Günlük teklif operasyonu ve limit bazlı onay.",
        "hierarchy_level": 4,
        "permissions": [
            "read:company", "read:department", "read:project",
            "create:quote", "read:quote", "update:quote", "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Kıdemli Uzmanı",
        "description": "Teklif hazırlama ve güncelleme.",
        "hierarchy_level": 5,
        "permissions": [
            "read:company", "read:department", "read:project",
            "create:quote", "read:quote", "update:quote",
        ],
    },
    {
        "name": "Satın Alma Uzman Yardımcısı",
        "description": "Teklif desteği ve veri girişi.",
        "hierarchy_level": 6,
        "permissions": [
            "read:company", "read:department", "read:project",
            "create:quote", "read:quote", "update:quote",
        ],
    },
    {
        "name": "Satın Alma Uzmanı",
        "description": "Teknik olmayan teklif hazırlama.",
        "hierarchy_level": 7,
        "permissions": [
            "read:company", "read:department", "read:project",
            "create:quote", "read:quote", "update:quote",
        ],
    },
    {
        "name": "Proje Mimarı",
        "description": "Teknik şartname, mimari değerlendirme.",
        "hierarchy_level": 8,
        "permissions": [
            "read:company", "read:department", "read:project",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Teknik Uzman",
        "description": "Teknik destek ve uygunluk değerlendirmesi.",
        "hierarchy_level": 9,
        "permissions": [
            "read:company", "read:department", "read:project",
            "read:quote", "update:quote",
        ],
    },
    {
        "name": "Özel Stratejik Partner Rolü",
        "description": "Firmaya özel esnek rol şablonu.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:project", "read:quote"],
    },
    {
        "name": "Finans İzleyici",
        "description": "Salt okunur finansal izleme.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:department", "read:project", "read:quote"],
    },
    {
        "name": "İK Yöneticisi",
        "description": "İş ilanı verme yetkisine sahip İK yöneticisi.",
        "hierarchy_level": 99,
        "permissions": ["read:personnel", "read:company", "read:department"],
    },
    {
        "name": "İK Uzmanı",
        "description": "Temel İK ve iş ilanı operasyonları.",
        "hierarchy_level": 99,
        "permissions": ["read:personnel", "read:company"],
    },
]

DEMO_PLATFORM_USERS = [
    {
        "email": f"superadmin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Super Admin",
        "role": "super_admin",
        "system_role": "super_admin",
        "scope_type": "platform",
        "role_profile_code": "platform.super_admin",
        "approval_limit": 9_999_999,
    },
    {
        "email": f"operasyon_admin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Operasyon Admin",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.ops_admin",
        "approval_limit": 0,
    },
    {
        "email": f"operasyon_yoneticisi@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Operasyon Yöneticisi",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.ops_manager",
        "approval_limit": 0,
    },
    {
        "email": f"operasyon_uzmani@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Operasyon Uzmanı",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.ops_specialist",
        "approval_limit": 0,
    },
    {
        "email": f"destek_admin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Destek Admin",
        "role": "admin",
        "system_role": "platform_support",
        "scope_type": "platform",
        "role_profile_code": "platform.support_admin",
        "approval_limit": 0,
    },
    {
        "email": f"destek_yoneticisi@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Destek Yöneticisi",
        "role": "admin",
        "system_role": "platform_support",
        "scope_type": "platform",
        "role_profile_code": "platform.support_manager",
        "approval_limit": 0,
    },
    {
        "email": f"destek_uzmani@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Destek Uzmanı",
        "role": "admin",
        "system_role": "platform_support",
        "scope_type": "platform",
        "role_profile_code": "platform.support_agent",
        "approval_limit": 0,
    },
    {
        "email": f"finans_admin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Finans Admin",
        "role": "admin",
        "system_role": "finance_officer",
        "scope_type": "platform",
        "role_profile_code": "platform.finance_admin",
        "approval_limit": 0,
    },
    {
        "email": f"finans_yoneticisi@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Finans Yöneticisi",
        "role": "admin",
        "system_role": "finance_officer",
        "scope_type": "platform",
        "role_profile_code": "platform.finance_manager",
        "approval_limit": 0,
    },
    {
        "email": f"finans_uzmani@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Finans Uzmanı",
        "role": "admin",
        "system_role": "finance_officer",
        "scope_type": "platform",
        "role_profile_code": "platform.finance_specialist",
        "approval_limit": 0,
    },
    {
        "email": f"finans_izleyici@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Denetçi / Finans İzleyici",
        "role": "admin",
        "system_role": "finance_officer",
        "scope_type": "platform",
        "role_profile_code": "platform.finance_viewer",
        "approval_limit": 0,
    },
    {
        "email": f"guvenlik_uzmani@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Güvenlik Uzmanı",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.security_specialist",
        "approval_limit": 0,
    },
    {
        "email": f"raporlama_analisti@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Raporlama Analisti",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.reporting_analyst",
        "approval_limit": 0,
    },
]

DEMO_PARTNER_USERS = [
    {
        "email": f"firma_sahip@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Firma Sahibi Demo",
        "role": "partner_admin",
        "system_role": "tenant_owner",
        "scope_type": "partner",
        "role_profile_code": "partner.account_owner",
        "approval_limit": 7_500_000,
        "department": "Yönetim ve Organizasyon",
        "company": "BA Demo Merkez",
        "assignment_role": "Partner Admin",
    },
    {
        "email": f"firma_admin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Partner Admin Demo",
        "role": "partner_admin",
        "system_role": "tenant_admin",
        "scope_type": "partner",
        "role_profile_code": "partner.org_admin",
        "approval_limit": 5_000_000,
        "department": "Yönetim ve Organizasyon",
        "company": "BA Demo Merkez",
        "assignment_role": "Partner Admin",
    },
    {
        "email": f"firma_direktor@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Direktörü Demo",
        "role": "satinalma_direktoru",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_director",
        "approval_limit": 3_000_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Merkez",
        "assignment_role": "Satın Alma Direktörü",
    },
    {
        "email": f"firma_mudur@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Müdürü Demo",
        "role": "satinalma_muduru",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_manager",
        "approval_limit": 1_500_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Merkez",
        "assignment_role": "Satın Alma Müdürü",
    },
    {
        "email": f"firma_mudur_yrd@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Müdür Yardımcısı Demo",
        "role": "satinalma_mudur_yrd",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_manager_asst",
        "approval_limit": 750_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Satın Alma Müdür Yardımcısı",
    },
    {
        "email": f"firma_yonetici@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Yöneticisi Demo",
        "role": "satinalma_yoneticisi",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_supervisor",
        "approval_limit": 500_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Merkez",
        "assignment_role": "Satın Alma Yöneticisi",
    },
    {
        "email": f"firma_kidemli_uzm@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Kıdemli Uzmanı Demo",
        "role": "satinalma_kidemli_uzmani",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_senior",
        "approval_limit": 250_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Satın Alma Kıdemli Uzmanı",
    },
    {
        "email": f"firma_uzman_yrd@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Uzman Yardımcısı Demo",
        "role": "satinalma_uzman_yrd",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_asst",
        "approval_limit": 100_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Satın Alma Uzman Yardımcısı",
    },
    {
        "email": f"firma_uzman@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Uzmanı Demo",
        "role": "satinalma_uzmani",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_specialist",
        "approval_limit": 100_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Merkez",
        "assignment_role": "Satın Alma Uzmanı",
    },
    {
        "email": f"firma_mimar@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Proje Mimarı Demo",
        "role": "proje_mimari",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.project_architect",
        "approval_limit": 250_000,
        "department": "Teknik Ofis ve Şartname",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Proje Mimarı",
    },
    {
        "email": f"firma_teknik@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Teknik Uzman Demo",
        "role": "teknik_uzman",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.technical_specialist",
        "approval_limit": 250_000,
        "department": "Teknik Ofis ve Şartname",
        "company": "BA Demo Merkez",
        "assignment_role": "Teknik Uzman",
    },
    {
        "email": f"firma_finans@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Finans İzleyici Demo",
        "role": "finans_izleyici",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.finance_viewer",
        "approval_limit": 0,
        "department": "Finans ve Denetim",
        "company": "BA Demo Merkez",
        "assignment_role": "Finans İzleyici",
    },
    {
        "email": f"firma_ozel@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Özel Partner Rol Demo",
        "role": "ozel_partner_rolu",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.custom_role",
        "approval_limit": 150_000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Özel Stratejik Partner Rolü",
    },
]

DEMO_CHANNEL_USERS = [
    {
        "email": f"firma_kanal_sahibi@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Hesap Sahibi Demo",
        "role": "kanal_hesap_sahibi",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.account_owner",
        "approval_limit": 0,
    },
    {
        "email": f"firma_ekip_lideri@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Ekip Lideri Demo",
        "role": "kanal_ekip_lideri",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.team_lead",
        "approval_limit": 0,
    },
    {
        "email": f"firma_temsilci@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Temsilcisi Demo",
        "role": "kanal_temsilcisi",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.agent",
        "approval_limit": 0,
    },
    {
        "email": f"firma_kanal_finans@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Finans Demo",
        "role": "kanal_finans",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.finance_viewer",
        "approval_limit": 0,
    },
    {
        "email": f"firma_ozel_kanal@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Özel Kanal Rol Demo",
        "role": "ozel_kanal_rolu",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.custom_role",
        "approval_limit": 0,
    },
]

DEMO_CHANNEL_ROLE_SEED = [
    {
        "name": "Kanal Hesap Sahibi",
        "description": "Kanal workspace hesabının tam yetkili sahibi.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel", "read:personnel", "update:personnel",
            "read:company", "read:department", "read:quote",
        ],
    },
    {
        "name": "Kanal Ekip Lideri",
        "description": "Kanal ekibini yönetir ve operasyonları koordine eder.",
        "hierarchy_level": 1,
        "permissions": [
            "read:personnel", "read:company", "read:department", "read:quote",
        ],
    },
    {
        "name": "Kanal Temsilcisi",
        "description": "Müşteri ilişkileri ve kanal temsili.",
        "hierarchy_level": 2,
        "permissions": ["read:company", "read:department", "read:quote"],
    },
    {
        "name": "Kanal Finans",
        "description": "Kanal finansal görünürlük ve raporlama.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:department", "read:quote"],
    },
    {
        "name": "Özel Kanal Rolü",
        "description": "Kanala özel esnek rol şablonu.",
        "hierarchy_level": 99,
        "permissions": ["read:company", "read:quote"],
    },
    {
        "name": "İK Yöneticisi",
        "description": "Kanal organizasyonu İK yöneticisi.",
        "hierarchy_level": 99,
        "permissions": ["read:personnel", "read:company", "read:department"],
    },
]

DEMO_SUPPLIERS = [
    {
        "company_name": "BA Demo Tedarikçi A",
        "email": f"supplier.a@{DEMO_EMAIL_DOMAIN}",
        "phone": "+90 212 700 00 01",
        "category": "Endüstriyel Malzeme",
        "users": [
            {
                "email": f"supplier.owner.demo@{DEMO_EMAIL_DOMAIN}",
                "name": "Tedarikçi Ana Yönetici Demo",
                "role_profile_code": "supplier.account_owner",
            },
            {
                "email": f"supplier.admin.demo@{DEMO_EMAIL_DOMAIN}",
                "name": "Tedarikçi Yönetici Demo",
                "role_profile_code": "supplier.org_admin",
            },
        ],
    },
    {
        "company_name": "BA Demo Tedarikçi B",
        "email": f"supplier.b@{DEMO_EMAIL_DOMAIN}",
        "phone": "+90 212 700 00 02",
        "category": "Fiyatlandırma ve Maliyet",
        "users": [
            {
                "email": f"supplier.sales.demo@{DEMO_EMAIL_DOMAIN}",
                "name": "Kıdemli Satış Temsilcisi Demo",
                "role_profile_code": "supplier.sales_senior",
            },
            {
                "email": f"supplier.pricing.demo@{DEMO_EMAIL_DOMAIN}",
                "name": "Fiyatlandırma Uzmanı Demo",
                "role_profile_code": "supplier.pricing_specialist",
            },
            {
                "email": f"supplier.custom.demo@{DEMO_EMAIL_DOMAIN}",
                "name": "Özel Tedarikçi Rol Demo",
                "role_profile_code": "supplier.custom_role",
            },
        ],
    },
]


def _new_results() -> dict[str, dict[str, int]]:
    return {
        "created": {
            "platform_users": 0,
            "partner_users": 0,
            "channel_users": 0,
            "supplier_tenant_users": 0,
            "supplier_users": 0,
            "tenants": 0,
            "tenant_settings": 0,
            "companies": 0,
            "departments": 0,
            "roles": 0,
            "assignments": 0,
            "suppliers": 0,
        },
        "updated": {
            "platform_users": 0,
            "partner_users": 0,
            "channel_users": 0,
            "supplier_tenant_users": 0,
            "supplier_users": 0,
            "tenants": 0,
            "tenant_settings": 0,
            "companies": 0,
            "departments": 0,
            "roles": 0,
            "assignments": 0,
            "suppliers": 0,
        },
    }


def _upsert_counter(
    results: dict[str, dict[str, int]], bucket: str, action: str
) -> None:
    results[action][bucket] += 1


def _resolve_permissions(
    db: Session, permission_names: Iterable[str]
) -> list[Permission]:
    names = {name for name in permission_names if name}
    if not names:
        return []
    return db.query(Permission).filter(Permission.name.in_(names)).all()


def _ensure_tenant(db: Session, results: dict[str, dict[str, int]]) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_PARTNER_TENANT["slug"]).first()
    action = "updated" if tenant else "created"
    if tenant is None:
        tenant = Tenant(
            slug=DEMO_PARTNER_TENANT["slug"],
            legal_name=DEMO_PARTNER_TENANT["legal_name"],
            brand_name=DEMO_PARTNER_TENANT["brand_name"],
            subscription_plan_code=DEMO_PARTNER_TENANT["subscription_plan_code"],
            status="active",
            onboarding_status="bootstrap_completed",
            onboarding_payment_status="verified",
            onboarding_approval_status="approved",
            is_active=True,
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.legal_name = DEMO_PARTNER_TENANT["legal_name"]
        tenant.brand_name = DEMO_PARTNER_TENANT["brand_name"]
        tenant.subscription_plan_code = DEMO_PARTNER_TENANT["subscription_plan_code"]
        tenant.status = "active"
        tenant.onboarding_status = "bootstrap_completed"
        tenant.onboarding_payment_status = "verified"
        tenant.onboarding_approval_status = "approved"
        tenant.is_active = True
    _upsert_counter(results, "tenants", action)
    return tenant


def _ensure_supplier_tenant(db: Session, results: dict[str, dict[str, int]]) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_SUPPLIER_TENANT["slug"]).first()
    action = "updated" if tenant else "created"
    if tenant is None:
        tenant = Tenant(
            slug=DEMO_SUPPLIER_TENANT["slug"],
            legal_name=DEMO_SUPPLIER_TENANT["legal_name"],
            brand_name=DEMO_SUPPLIER_TENANT["brand_name"],
            category=DEMO_SUPPLIER_TENANT["category"],
            subscription_plan_code=DEMO_SUPPLIER_TENANT["subscription_plan_code"],
            status="active",
            onboarding_status="bootstrap_completed",
            onboarding_payment_status="not_required",
            onboarding_approval_status="not_required",
            is_active=True,
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.legal_name = DEMO_SUPPLIER_TENANT["legal_name"]
        tenant.brand_name = DEMO_SUPPLIER_TENANT["brand_name"]
        tenant.category = DEMO_SUPPLIER_TENANT["category"]
        tenant.status = "active"
        tenant.is_active = True
    _upsert_counter(results, "tenants", action)
    return tenant


def _ensure_career_tenant(db: Session, results: dict[str, dict[str, int]]) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_CAREER_TENANT["slug"]).first()
    action = "updated" if tenant else "created"
    if tenant is None:
        tenant = Tenant(
            slug=DEMO_CAREER_TENANT["slug"],
            legal_name=DEMO_CAREER_TENANT["legal_name"],
            brand_name=DEMO_CAREER_TENANT["brand_name"],
            category=DEMO_CAREER_TENANT["category"],
            subscription_plan_code="starter",
            status="active",
            onboarding_status="bootstrap_completed",
            onboarding_payment_status="not_required",
            onboarding_approval_status="not_required",
            is_active=True,
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.legal_name = DEMO_CAREER_TENANT["legal_name"]
        tenant.brand_name = DEMO_CAREER_TENANT["brand_name"]
        tenant.category = DEMO_CAREER_TENANT["category"]
        tenant.status = "active"
        tenant.is_active = True
    _upsert_counter(results, "tenants", action)
    return tenant


def _ensure_channel_tenant(db: Session, results: dict[str, dict[str, int]]) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_CHANNEL_TENANT["slug"]).first()
    action = "updated" if tenant else "created"
    if tenant is None:
        tenant = Tenant(
            slug=DEMO_CHANNEL_TENANT["slug"],
            legal_name=DEMO_CHANNEL_TENANT["legal_name"],
            brand_name=DEMO_CHANNEL_TENANT["brand_name"],
            subscription_plan_code="starter",
            status="active",
            onboarding_status="bootstrap_completed",
            onboarding_payment_status="not_required",
            onboarding_approval_status="not_required",
            is_active=True,
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.legal_name = DEMO_CHANNEL_TENANT["legal_name"]
        tenant.brand_name = DEMO_CHANNEL_TENANT["brand_name"]
        tenant.status = "active"
        tenant.is_active = True
    _upsert_counter(results, "tenants", action)
    return tenant


def _ensure_tenant_settings(
    db: Session, tenant: Tenant, results: dict[str, dict[str, int]]
) -> TenantSettings:
    settings = (
        db.query(TenantSettings).filter(TenantSettings.tenant_id == tenant.id).first()
    )
    action = "updated" if settings else "created"
    if settings is None:
        settings = TenantSettings(
            tenant_id=tenant.id,
            primary_color="#16302b",
            secondary_color="#D4AF37",
            smtp_mode="platform_default",
            support_email=f"support@{DEMO_EMAIL_DOMAIN}",
            locale="tr-TR",
            timezone="Europe/Istanbul",
            is_active=True,
        )
        db.add(settings)
    else:
        settings.primary_color = "#16302b"
        settings.secondary_color = "#D4AF37"
        settings.smtp_mode = "platform_default"
        settings.support_email = f"support@{DEMO_EMAIL_DOMAIN}"
        settings.locale = "tr-TR"
        settings.timezone = "Europe/Istanbul"
        settings.is_active = True
    _upsert_counter(results, "tenant_settings", action)
    return settings


def _ensure_company(
    db: Session,
    tenant: Tenant,
    item: dict[str, str],
    owner_user_id: int | None,
    results: dict[str, dict[str, int]],
) -> Company:
    company = (
        db.query(Company)
        .filter(Company.tenant_id == tenant.id, Company.name == item["name"])
        .first()
    )
    action = "updated" if company else "created"
    if company is None:
        company = Company(
            tenant_id=tenant.id,
            name=item["name"],
            description=item["description"],
            color=item["color"],
            created_by_id=owner_user_id,
            is_active=True,
        )
        db.add(company)
        db.flush()
    else:
        company.description = item["description"]
        company.color = item["color"]
        company.created_by_id = owner_user_id
        company.is_active = True
    _upsert_counter(results, "companies", action)
    return company


def _ensure_department(
    db: Session,
    tenant: Tenant,
    item: dict[str, str],
    owner_user_id: int | None,
    results: dict[str, dict[str, int]],
) -> Department:
    department = (
        db.query(Department)
        .filter(Department.tenant_id == tenant.id, Department.name == item["name"])
        .first()
    )
    action = "updated" if department else "created"
    if department is None:
        department = Department(
            tenant_id=tenant.id,
            name=item["name"],
            description=item["description"],
            created_by_id=owner_user_id,
            is_active=True,
        )
        db.add(department)
        db.flush()
    else:
        department.description = item["description"]
        department.created_by_id = owner_user_id
        department.is_active = True
    _upsert_counter(results, "departments", action)
    return department


def _ensure_platform_role(
    db: Session,
    item: dict[str, object],
    owner_user_id: int | None,
    results: dict[str, dict[str, int]],
) -> Role:
    role = (
        db.query(Role)
        .filter(Role.tenant_id.is_(None), Role.name == str(item["name"]))
        .first()
    )
    action = "updated" if role else "created"
    permissions = _resolve_permissions(db, item.get("permissions", []))
    if role is None:
        role = Role(
            tenant_id=None,
            name=str(item["name"]),
            description=str(item["description"]),
            hierarchy_level=int(item["hierarchy_level"]),
            created_by_id=owner_user_id,
            is_active=True,
        )
        role.permissions = permissions
        db.add(role)
        db.flush()
    else:
        role.description = str(item["description"])
        role.hierarchy_level = int(item["hierarchy_level"])
        role.created_by_id = owner_user_id
        role.is_active = True
        role.permissions = permissions
    _upsert_counter(results, "roles", action)
    return role


def _ensure_role(
    db: Session,
    tenant: Tenant,
    item: dict[str, object],
    owner_user_id: int | None,
    results: dict[str, dict[str, int]],
) -> Role:
    role = (
        db.query(Role)
        .filter(Role.tenant_id == tenant.id, Role.name == str(item["name"]))
        .first()
    )
    action = "updated" if role else "created"
    permissions = _resolve_permissions(db, item.get("permissions", []))
    if role is None:
        role = Role(
            tenant_id=tenant.id,
            name=str(item["name"]),
            description=str(item["description"]),
            hierarchy_level=int(item["hierarchy_level"]),
            created_by_id=owner_user_id,
            is_active=True,
        )
        role.permissions = permissions
        db.add(role)
        db.flush()
    else:
        role.description = str(item["description"])
        role.hierarchy_level = int(item["hierarchy_level"])
        role.created_by_id = owner_user_id
        role.is_active = True
        role.permissions = permissions
    _upsert_counter(results, "roles", action)
    return role


def _ensure_user(
    db: Session,
    item: dict[str, object],
    *,
    tenant_id: int | None,
    results: dict[str, dict[str, int]],
    bucket: str,
) -> User:
    hashed_password = get_password_hash(DEMO_PASSWORD)
    user = db.query(User).filter(User.email == str(item["email"])).first()
    action = "updated" if user else "created"
    if user is None:
        user = User(
            email=str(item["email"]),
            work_email=str(item["email"]),
            full_name=str(item["full_name"]),
            hashed_password=hashed_password,
            role=str(item["role"]),
            system_role=str(item["system_role"]),
            scope_type=str(item["scope_type"]),
            role_profile_code=str(item["role_profile_code"]),
            tenant_id=tenant_id,
            approval_limit=int(item.get("approval_limit", 0)),
            is_active=True,
            hidden_from_admin=False,
            invitation_accepted=True,
        )
        db.add(user)
        db.flush()
    else:
        user.work_email = str(item["email"])
        user.full_name = str(item["full_name"])
        user.hashed_password = hashed_password
        user.role = str(item["role"])
        user.system_role = str(item["system_role"])
        user.scope_type = str(item["scope_type"])
        user.role_profile_code = str(item["role_profile_code"])
        user.tenant_id = tenant_id
        user.approval_limit = int(item.get("approval_limit", 0))
        user.is_active = True
        user.hidden_from_admin = False
        user.invitation_accepted = True
        user.invitation_token = None
        user.invitation_token_expires = None
    _upsert_counter(results, bucket, action)
    return user


def _ensure_assignment(
    db: Session,
    user: User,
    company: Company,
    department: Department,
    role: Role,
    results: dict[str, dict[str, int]],
) -> CompanyRole:
    assignment = (
        db.query(CompanyRole)
        .filter(CompanyRole.user_id == user.id, CompanyRole.company_id == company.id)
        .first()
    )
    action = "updated" if assignment else "created"
    if assignment is None:
        assignment = CompanyRole(
            tenant_id=company.tenant_id,
            user_id=user.id,
            company_id=company.id,
            role_id=role.id,
            department_id=department.id,
            is_active=True,
        )
        db.add(assignment)
    else:
        assignment.tenant_id = company.tenant_id
        assignment.role_id = role.id
        assignment.department_id = department.id
        assignment.is_active = True
    user.department_id = department.id
    _upsert_counter(results, "assignments", action)
    return assignment


def _ensure_supplier(
    db: Session,
    item: dict[str, object],
    creator_id: int,
    results: dict[str, dict[str, int]],
) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.email == str(item["email"])).first()
    action = "updated" if supplier else "created"
    if supplier is None:
        supplier = Supplier(
            created_by_id=creator_id,
            company_name=str(item["company_name"]),
            phone=str(item["phone"]),
            email=str(item["email"]),
            category=str(item["category"]),
            is_active=True,
            is_verified=True,
        )
        db.add(supplier)
        db.flush()
    else:
        supplier.created_by_id = creator_id
        supplier.company_name = str(item["company_name"])
        supplier.phone = str(item["phone"])
        supplier.category = str(item["category"])
        supplier.is_active = True
        supplier.is_verified = True
    _upsert_counter(results, "suppliers", action)
    return supplier


def _ensure_supplier_user(
    db: Session,
    supplier: Supplier,
    item: dict[str, str],
    results: dict[str, dict[str, int]],
) -> SupplierUser:
    supplier_user = (
        db.query(SupplierUser).filter(SupplierUser.email == item["email"]).first()
    )
    action = "updated" if supplier_user else "created"
    hashed_password = get_password_hash(DEMO_PASSWORD)
    if supplier_user is None:
        supplier_user = SupplierUser(
            supplier_id=supplier.id,
            name=item["name"],
            email=item["email"],
            work_email=item["email"],
            hashed_password=hashed_password,
            password_set=True,
            email_verified=True,
            is_active=True,
        )
        db.add(supplier_user)
    else:
        supplier_user.supplier_id = supplier.id
        supplier_user.name = item["name"]
        supplier_user.work_email = item["email"]
        supplier_user.hashed_password = hashed_password
        supplier_user.password_set = True
        supplier_user.email_verified = True
        supplier_user.is_active = True
        supplier_user.magic_token = None
        supplier_user.magic_token_expires = None
    _upsert_counter(results, "supplier_users", action)
    return supplier_user


def seed_scope_demo_data(db: Session) -> dict[str, object]:
    results = _new_results()
    tenant = _ensure_tenant(db, results)
    _ensure_tenant_settings(db, tenant, results)
    channel_tenant = _ensure_channel_tenant(db, results)
    _ensure_tenant_settings(db, channel_tenant, results)

    platform_users = {
        str(item["role_profile_code"]): _ensure_user(
            db, item, tenant_id=None, results=results, bucket="platform_users"
        )
        for item in DEMO_PLATFORM_USERS
    }

    superadmin = platform_users["platform.super_admin"]
    for item in DEMO_PLATFORM_ROLE_SEED:
        _ensure_platform_role(db, item, superadmin.id, results)

    companies = {
        item["name"]: _ensure_company(
            db, tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_PARTNER_COMPANIES
    }
    departments = {
        item["name"]: _ensure_department(
            db, tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_PARTNER_DEPARTMENTS
    }
    roles = {
        str(item["name"]): _ensure_role(
            db, tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_PARTNER_ROLE_SEED
    }

    partner_owner = None
    for item in DEMO_PARTNER_USERS:
        user = _ensure_user(
            db, item, tenant_id=tenant.id, results=results, bucket="partner_users"
        )
        _ensure_assignment(
            db,
            user,
            companies[str(item["company"])],
            departments[str(item["department"])],
            roles[str(item["assignment_role"])],
            results,
        )
        if str(item["role_profile_code"]) == "partner.account_owner":
            partner_owner = user

    if partner_owner is not None:
        tenant.owner_user_id = partner_owner.id

    for item in DEMO_CHANNEL_USERS:
        channel_user = _ensure_user(
            db,
            item,
            tenant_id=channel_tenant.id,
            results=results,
            bucket="channel_users",
        )
        if str(item.get("role_profile_code", "")) == "channel.account_owner":
            channel_tenant.owner_user_id = channel_user.id
            db.add(channel_tenant)
            db.flush()

    supplier_creator = platform_users["platform.super_admin"]
    for supplier_item in DEMO_SUPPLIERS:
        supplier = _ensure_supplier(db, supplier_item, supplier_creator.id, results)
        for supplier_user_item in supplier_item["users"]:
            _ensure_supplier_user(db, supplier, supplier_user_item, results)

    # Supplier tenant (platform tenant classified as supplier scope)
    supplier_tenant = _ensure_supplier_tenant(db, results)
    _ensure_tenant_settings(db, supplier_tenant, results)

    supplier_tenant_companies = {
        item["name"]: _ensure_company(
            db, supplier_tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_SUPPLIER_COMPANIES
    }
    supplier_tenant_departments = {
        item["name"]: _ensure_department(
            db, supplier_tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_SUPPLIER_DEPARTMENTS
    }
    supplier_tenant_roles = {
        str(item["name"]): _ensure_role(
            db, supplier_tenant, item, platform_users["platform.super_admin"].id, results
        )
        for item in DEMO_SUPPLIER_ROLE_SEED
    }

    supplier_tenant_owner = None
    for item in DEMO_SUPPLIER_USERS:
        user = _ensure_user(
            db, item, tenant_id=supplier_tenant.id, results=results, bucket="supplier_tenant_users"
        )
        _ensure_assignment(
            db,
            user,
            supplier_tenant_companies[str(item["company"])],
            supplier_tenant_departments[str(item["department"])],
            supplier_tenant_roles[str(item["assignment_role"])],
            results,
        )
        if str(item.get("role_profile_code", "")) == "supplier_tenant.admin":
            supplier_tenant_owner = user

    if supplier_tenant_owner is not None:
        supplier_tenant.owner_user_id = supplier_tenant_owner.id

    db.flush()
    db.commit()

    return {
        "message": "Scope bazli demo omurgasi hazirlandi",
        "password": DEMO_PASSWORD,
        "email_domain": DEMO_EMAIL_DOMAIN,
        "created": results["created"],
        "updated": results["updated"],
        "total": {
            "created": sum(results["created"].values()),
            "updated": sum(results["updated"].values()),
            "accounts": (
                results["created"]["platform_users"]
                + results["updated"]["platform_users"]
                + results["created"]["partner_users"]
                + results["updated"]["partner_users"]
                + results["created"]["channel_users"]
                + results["updated"]["channel_users"]
                + results["created"]["supplier_tenant_users"]
                + results["updated"]["supplier_tenant_users"]
                + results["created"]["supplier_users"]
                + results["updated"]["supplier_users"]
            ),
        },
    }


def seed_role_catalogs(db: Session) -> dict[str, object]:
    """Platform ve tedarikci rol kataloglarini bagımsız olarak oluşturur (idempotent)."""
    results = _new_results()

    # Superadmin user'ı bul (owner_id olarak kullan)
    superadmin = db.query(User).filter(User.email == f"superadmin@{DEMO_EMAIL_DOMAIN}").first()
    owner_id = superadmin.id if superadmin else None

    # Platform rol katalogu
    for item in DEMO_PLATFORM_ROLE_SEED:
        _ensure_platform_role(db, item, owner_id, results)

    # Tedarikçi tenant katalogu
    supplier_tenant = _ensure_supplier_tenant(db, results)
    _ensure_tenant_settings(db, supplier_tenant, results)

    supplier_tenant_companies = {
        item["name"]: _ensure_company(db, supplier_tenant, item, owner_id, results)
        for item in DEMO_SUPPLIER_COMPANIES
    }
    supplier_tenant_departments = {
        item["name"]: _ensure_department(db, supplier_tenant, item, owner_id, results)
        for item in DEMO_SUPPLIER_DEPARTMENTS
    }
    supplier_tenant_roles = {
        str(item["name"]): _ensure_role(db, supplier_tenant, item, owner_id, results)
        for item in DEMO_SUPPLIER_ROLE_SEED
    }

    for item in DEMO_SUPPLIER_USERS:
        user = _ensure_user(
            db, item, tenant_id=supplier_tenant.id, results=results, bucket="supplier_tenant_users"
        )
        _ensure_assignment(
            db,
            user,
            supplier_tenant_companies[str(item["company"])],
            supplier_tenant_departments[str(item["department"])],
            supplier_tenant_roles[str(item["assignment_role"])],
            results,
        )

    # Kanal rol katalogu
    channel_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_CHANNEL_TENANT["slug"]).first()
    if channel_tenant:
        for item in DEMO_CHANNEL_ROLE_SEED:
            _ensure_role(db, channel_tenant, item, owner_id, results)

    # Partner rol katalogu
    partner_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_PARTNER_TENANT["slug"]).first()
    if partner_tenant:
        for item in DEMO_PARTNER_ROLE_SEED:
            _ensure_role(db, partner_tenant, item, owner_id, results)

    # Kariyer rol katalogu
    career_tenant = _ensure_career_tenant(db, results)
    for item in DEMO_CAREER_ROLE_SEED:
        _ensure_role(db, career_tenant, item, owner_id, results)

    db.flush()
    db.commit()

    return {
        "message": "Rol kataloglari olusturuldu",
        "created": results["created"],
        "updated": results["updated"],
        "total": {
            "created": sum(results["created"].values()),
            "updated": sum(results["updated"].values()),
        },
    }


def reset_role_catalogs(db: Session) -> dict[str, object]:
    """Eski demo rollerini siler ve v3 katalogu yeniden yukler (destructive, idempotent)."""
    results = _new_results()
    results["deleted"] = {"roles": 0, "assignments": 0}

    # Demo tenant'ları bul
    partner_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_PARTNER_TENANT["slug"]).first()
    supplier_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_SUPPLIER_TENANT["slug"]).first()
    channel_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_CHANNEL_TENANT["slug"]).first()
    career_tenant = db.query(Tenant).filter(Tenant.slug == DEMO_CAREER_TENANT["slug"]).first()

    demo_tenant_ids = [t.id for t in [partner_tenant, supplier_tenant, channel_tenant, career_tenant] if t]

    # Platform rolleri (SUPER_ADMIN hariç) + demo tenant rolleri topla
    old_platform_roles = (
        db.query(Role)
        .filter(Role.tenant_id.is_(None), Role.name != "SUPER_ADMIN")
        .all()
    )
    old_tenant_roles = (
        db.query(Role).filter(Role.tenant_id.in_(demo_tenant_ids)).all()
        if demo_tenant_ids else []
    )
    all_old = old_platform_roles + old_tenant_roles
    old_ids = [r.id for r in all_old]

    if old_ids:
        deleted_a = db.query(CompanyRole).filter(CompanyRole.role_id.in_(old_ids)).delete(
            synchronize_session=False
        )
        results["deleted"]["assignments"] = deleted_a  # type: ignore[index]
    for role in all_old:
        db.delete(role)
    results["deleted"]["roles"] = len(all_old)  # type: ignore[index]
    db.flush()

    # v3 katalogu yukle
    superadmin = db.query(User).filter(User.email == f"superadmin@{DEMO_EMAIL_DOMAIN}").first()
    owner_id = superadmin.id if superadmin else None

    for item in DEMO_PLATFORM_ROLE_SEED:
        _ensure_platform_role(db, item, owner_id, results)

    if partner_tenant:
        for item in DEMO_PARTNER_ROLE_SEED:
            _ensure_role(db, partner_tenant, item, owner_id, results)

    supplier_tenant2 = _ensure_supplier_tenant(db, results)
    _ensure_tenant_settings(db, supplier_tenant2, results)
    s_companies = {
        item["name"]: _ensure_company(db, supplier_tenant2, item, owner_id, results)
        for item in DEMO_SUPPLIER_COMPANIES
    }
    s_departments = {
        item["name"]: _ensure_department(db, supplier_tenant2, item, owner_id, results)
        for item in DEMO_SUPPLIER_DEPARTMENTS
    }
    s_roles = {
        str(item["name"]): _ensure_role(db, supplier_tenant2, item, owner_id, results)
        for item in DEMO_SUPPLIER_ROLE_SEED
    }
    for item in DEMO_SUPPLIER_USERS:
        user = _ensure_user(
            db, item, tenant_id=supplier_tenant2.id, results=results, bucket="supplier_tenant_users"
        )
        _ensure_assignment(
            db, user,
            s_companies[str(item["company"])],
            s_departments[str(item["department"])],
            s_roles[str(item["assignment_role"])],
            results,
        )

    if channel_tenant:
        for item in DEMO_CHANNEL_ROLE_SEED:
            _ensure_role(db, channel_tenant, item, owner_id, results)

    # Kariyer tenant + 4 rol
    career_tenant2 = _ensure_career_tenant(db, results)
    for item in DEMO_CAREER_ROLE_SEED:
        _ensure_role(db, career_tenant2, item, owner_id, results)

    db.flush()
    db.commit()

    return {
        "message": "Rol katalogu v3 olarak sifirlanip yuklendi",
        "deleted": results["deleted"],
        "created": results["created"],
        "updated": results["updated"],
        "total": {
            "created": sum(results["created"].values()),
            "updated": sum(results["updated"].values()),
        },
    }
