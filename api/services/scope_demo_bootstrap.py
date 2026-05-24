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

DEMO_PARTNER_TENANT = {
    "slug": "demo-stratejik-ortak",
    "legal_name": "Buyera Asistans Demo Stratejik Ortak A.S.",
    "brand_name": "BA Demo Stratejik Ortak",
    "subscription_plan_code": "growth",
}

DEMO_CHANNEL_TENANT = {
    "slug": "demo-kanal-is-ortagi",
    "legal_name": "Buyera Asistans Demo Kanal İş Ortağı Workspace",
    "brand_name": "BA Demo İş Ortağı",
}

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
        "name": "Partner Ana Yönetici",
        "description": "Partner sahipliği, üst seviye yönetim ve tüm organizasyon omurgası.",
        "hierarchy_level": 0,
        "permissions": [
            "create:personnel",
            "read:personnel",
            "update:personnel",
            "delete:personnel",
            "create:department",
            "read:department",
            "update:department",
            "delete:department",
            "create:company",
            "read:company",
            "update:company",
            "delete:company",
            "create:project",
            "read:project",
            "update:project",
            "delete:project",
            "create:role",
            "read:role",
            "update:role",
            "delete:role",
            "create:quote",
            "read:quote",
            "update:quote",
            "delete:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Partner Yöneticisi",
        "description": "Günlük organizasyon yönetimi, ekip, departman ve operasyon koordinasyonu.",
        "hierarchy_level": 1,
        "permissions": [
            "create:personnel",
            "read:personnel",
            "update:personnel",
            "read:department",
            "update:department",
            "read:company",
            "read:project",
            "update:project",
            "read:role",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Satın Alma Müdürü",
        "description": "Operasyonel satın alma akışlarını, teklifleri ve proje bağlı talepleri yönetir.",
        "hierarchy_level": 2,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "update:project",
            "create:quote",
            "read:quote",
            "update:quote",
            "approve:quote",
        ],
    },
    {
        "name": "Teknik Uzman ve Mimar",
        "description": "Teknik dosya, şartname ve uygunluk değerlendirmesini yapar.",
        "hierarchy_level": 3,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "read:quote",
            "update:quote",
        ],
    },
    {
        "name": "Denetçi ve Finansal İzleyici",
        "description": "Salt okunur finansal izleme ve denetim görünürlüğü sağlar.",
        "hierarchy_level": 4,
        "permissions": [
            "read:department",
            "read:company",
            "read:project",
            "read:quote",
        ],
    },
    {
        "name": "Özel Partner Rolü",
        "description": "Partnerin kendi iç operasyonu için sınırlı özel rol şablonu.",
        "hierarchy_level": 5,
        "permissions": [
            "read:company",
            "read:project",
            "read:quote",
        ],
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
        "email": f"portaladmin@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Portal Admini",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.portal_admin",
        "approval_limit": 0,
    },
    {
        "email": f"support@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Destek Temsilcisi",
        "role": "admin",
        "system_role": "platform_support",
        "scope_type": "platform",
        "role_profile_code": "platform.support_agent",
        "approval_limit": 0,
    },
    {
        "email": f"finance@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Platform Finans Sorumlusu",
        "role": "admin",
        "system_role": "platform_operator",
        "scope_type": "platform",
        "role_profile_code": "platform.finance_officer",
        "approval_limit": 0,
    },
]

DEMO_PARTNER_USERS = [
    {
        "email": f"partner.owner.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Partner Ana Yönetici Demo",
        "role": "admin",
        "system_role": "tenant_owner",
        "scope_type": "partner",
        "role_profile_code": "partner.account_owner",
        "approval_limit": 7500000,
        "department": "Yönetim ve Organizasyon",
        "company": "BA Demo Merkez",
        "assignment_role": "Partner Ana Yönetici",
    },
    {
        "email": f"partner.admin.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Partner Yönetici Demo",
        "role": "admin",
        "system_role": "tenant_admin",
        "scope_type": "partner",
        "role_profile_code": "partner.org_admin",
        "approval_limit": 5000000,
        "department": "Yönetim ve Organizasyon",
        "company": "BA Demo Merkez",
        "assignment_role": "Partner Yöneticisi",
    },
    {
        "email": f"partner.procurement.lead1@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Müdürü Demo 1",
        "role": "satinalma_yoneticisi",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_manager",
        "approval_limit": 1500000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Merkez",
        "assignment_role": "Satın Alma Müdürü",
    },
    {
        "email": f"partner.procurement.lead2@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Satın Alma Müdürü Demo 2",
        "role": "satinalma_yoneticisi",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.procurement_manager",
        "approval_limit": 1250000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Satın Alma Müdürü",
    },
    {
        "email": f"partner.tech.demo1@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Teknik Uzman Demo 1",
        "role": "satinalma_uzmani",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.technical_specialist",
        "approval_limit": 250000,
        "department": "Teknik Ofis ve Şartname",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Teknik Uzman ve Mimar",
    },
    {
        "email": f"partner.tech.demo2@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Teknik Uzman Demo 2",
        "role": "satinalma_uzmani",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.technical_specialist",
        "approval_limit": 250000,
        "department": "Teknik Ofis ve Şartname",
        "company": "BA Demo Merkez",
        "assignment_role": "Teknik Uzman ve Mimar",
    },
    {
        "email": f"partner.audit.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Partner Denetçi Demo",
        "role": "satinalmaci",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.auditor",
        "approval_limit": 0,
        "department": "Finans ve Denetim",
        "company": "BA Demo Merkez",
        "assignment_role": "Denetçi ve Finansal İzleyici",
    },
    {
        "email": f"partner.custom.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Özel Partner Rol Demo",
        "role": "satinalmaci",
        "system_role": "tenant_member",
        "scope_type": "partner",
        "role_profile_code": "partner.custom_role",
        "approval_limit": 150000,
        "department": "Satın Alma Operasyonları",
        "company": "BA Demo Proje Ofisi",
        "assignment_role": "Özel Partner Rolü",
    },
]

DEMO_CHANNEL_USERS = [
    {
        "email": f"channel.owner.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Ana Yönetici Demo",
        "role": "channel_owner",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.account_owner",
        "approval_limit": 0,
    },
    {
        "email": f"channel.lead.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Ekip Lideri Demo",
        "role": "channel_agent",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.team_lead",
        "approval_limit": 0,
    },
    {
        "email": f"channel.agent.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Temsilcisi Demo",
        "role": "channel_agent",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.agent",
        "approval_limit": 0,
    },
    {
        "email": f"channel.finance.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Finans İzleyici Demo",
        "role": "channel_agent",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.finance_viewer",
        "approval_limit": 0,
    },
    {
        "email": f"channel.audit.demo@{DEMO_EMAIL_DOMAIN}",
        "full_name": "Kanal Denetçi Demo",
        "role": "channel_agent",
        "system_role": "tenant_member",
        "scope_type": "channel",
        "role_profile_code": "channel.auditor",
        "approval_limit": 0,
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
                + results["created"]["supplier_users"]
                + results["updated"]["supplier_users"]
            ),
        },
    }
