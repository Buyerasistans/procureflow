from __future__ import annotations

from api.models import User

PLATFORM_STAFF_SYSTEM_ROLES = {
    "super_admin",
    "platform_support",
    "platform_operator",
    "finance_officer",
}
TENANT_ADMIN_SYSTEM_ROLES = {"tenant_admin", "tenant_owner"}
ADMIN_LIKE_SYSTEM_ROLES = PLATFORM_STAFF_SYSTEM_ROLES | TENANT_ADMIN_SYSTEM_ROLES
PROCUREMENT_SETTINGS_SYSTEM_ROLES = (
    PLATFORM_STAFF_SYSTEM_ROLES | TENANT_ADMIN_SYSTEM_ROLES
)
ADMIN_MANAGED_SYSTEM_ROLES = {"super_admin"} | TENANT_ADMIN_SYSTEM_ROLES
LEGACY_ADMIN_ROLES = {"admin", "super_admin"}
ADMIN_ASSIGNABLE_SYSTEM_ROLES = TENANT_ADMIN_SYSTEM_ROLES | {
    "platform_support",
    "platform_operator",
    "finance_officer",
}

# ---------------------------------------------------------------------------
# Talent Network + Procurement Jobs ekosistemi rolleri
# ---------------------------------------------------------------------------

# Bağımsız satınalma uzmanı — platform genelinde, tenant bağımsız
TALENT_MEMBER_SYSTEM_ROLES = {"talent_member"}

# İşveren tenant yöneticisi — iş ilanı oluşturur, başvuruları yönetir
EMPLOYER_ADMIN_SYSTEM_ROLES = {"employer_company_admin"}

# Referral/kanal iş ortağı — görevlere katkı sunar
REFERRAL_PARTNER_SYSTEM_ROLES = {"referral_partner"}

# Uyum / moderatör — içerik inceleme, ödeme onayı
MODERATOR_COMPLIANCE_SYSTEM_ROLES = {"moderator_compliance"}

# Talent ekosistemindeki tüm üye rolleri
TALENT_ECOSYSTEM_ROLES = (
    TALENT_MEMBER_SYSTEM_ROLES
    | EMPLOYER_ADMIN_SYSTEM_ROLES
    | REFERRAL_PARTNER_SYSTEM_ROLES
    | MODERATOR_COMPLIANCE_SYSTEM_ROLES
)

# Payout onayı verebilecek roller
PAYOUT_APPROVER_SYSTEM_ROLES = PLATFORM_STAFF_SYSTEM_ROLES | MODERATOR_COMPLIANCE_SYSTEM_ROLES

# Talent profilini görebilecek / inceleyebilecek roller
TALENT_REVIEWER_SYSTEM_ROLES = (
    PLATFORM_STAFF_SYSTEM_ROLES
    | MODERATOR_COMPLIANCE_SYSTEM_ROLES
    | EMPLOYER_ADMIN_SYSTEM_ROLES
)

# Atanabilir talent ecosystem rolleri (super admin tarafından)
TALENT_ASSIGNABLE_SYSTEM_ROLES = TALENT_ECOSYSTEM_ROLES
PROCUREMENT_STAFF_ROLES = {
    "satinalmaci",
    "satinalma_uzmani",
    "satinalma_yoneticisi",
    "satinalma_direktoru",
}
GLOBAL_PROCUREMENT_MANAGER_ROLES = {"super_admin", "admin", "satinalma_direktoru"}
PROJECT_CREATE_ROLES = LEGACY_ADMIN_ROLES | {
    "satinalma_direktoru",
    "satinalma_yoneticisi",
    "satinalma_uzmani",
}
PROJECT_GLOBAL_VIEW_ROLES = GLOBAL_PROCUREMENT_MANAGER_ROLES
QUOTE_WORKSPACE_ROLES = PROCUREMENT_STAFF_ROLES | {
    "manager",
    "buyer",
    "channel_owner",
    "channel_agent",
    "supplier_admin",
    "supplier_user",
}
ROLE_MANAGEMENT_BUSINESS_ROLES = {
    "admin",
    "super_admin",
    "channel_owner",
    "satinalma_direktoru",
    "satinalma_yoneticisi",
    "department_manager",
    "company_manager",
    "manager",
}

# Smaller number means higher authority.
BUSINESS_ROLE_PRIORITY = {
    "super_admin": 0,
    "admin": 1,
    "satinalma_direktoru": 2,
    "manager": 3,
    "department_manager": 3,
    "company_manager": 3,
    "satinalma_yoneticisi": 3,
    "satinalma_uzmani": 4,
    "buyer": 4,
    "satinalmaci": 5,
    "employee": 6,
    "user": 6,
}


def normalized_role(user: User) -> str:
    return (getattr(user, "role", "") or "").strip().lower()


def normalized_system_role(user: User) -> str:
    role = normalized_role(user)
    if role == "super_admin":
        return "super_admin"

    explicit = (getattr(user, "system_role", "") or "").strip().lower()
    if role == "admin" and explicit in {"", "tenant_member"}:
        return "tenant_admin"
    if explicit:
        return explicit

    if role == "admin":
        return "tenant_admin"
    return "tenant_member"


def is_super_admin(user: User) -> bool:
    return normalized_system_role(user) == "super_admin"


def is_reserved_workspace_role(role_name: str) -> bool:
    normalized = (role_name or "").strip().lower()
    return normalized in LEGACY_ADMIN_ROLES


def is_platform_staff(user: User) -> bool:
    return normalized_system_role(user) in PLATFORM_STAFF_SYSTEM_ROLES


def is_tenant_admin(user: User) -> bool:
    return (
        normalized_system_role(user) in TENANT_ADMIN_SYSTEM_ROLES
        or normalized_role(user) == "admin"
    )


def is_tenant_owner(user: User) -> bool:
    return normalized_system_role(user) == "tenant_owner"


def is_admin_like(user: User) -> bool:
    return normalized_system_role(user) in ADMIN_LIKE_SYSTEM_ROLES


def can_access_admin_surface(user: User) -> bool:
    return is_super_admin(user) or is_tenant_admin(user)


def can_read_admin_catalog(user: User) -> bool:
    return can_access_admin_surface(user) or is_platform_staff(user)


def is_admin_managed_account(user: User) -> bool:
    return (
        normalized_system_role(user) in ADMIN_MANAGED_SYSTEM_ROLES
        or normalized_role(user) in LEGACY_ADMIN_ROLES
    )


def is_procurement_staff(user: User) -> bool:
    return normalized_role(user) in PROCUREMENT_STAFF_ROLES


def is_global_procurement_manager(user: User) -> bool:
    return is_admin_like(user) or normalized_role(user) == "satinalma_direktoru"


def can_create_project(user: User) -> bool:
    return normalized_role(user) in PROJECT_CREATE_ROLES


def can_view_all_projects(user: User) -> bool:
    return (
        can_read_admin_catalog(user)
        or normalized_role(user) in PROJECT_GLOBAL_VIEW_ROLES
    )


def can_access_procurement_settings(user: User) -> bool:
    return normalized_system_role(
        user
    ) in PROCUREMENT_SETTINGS_SYSTEM_ROLES or is_procurement_staff(user)


def can_access_quote_workspace(user: User) -> bool:
    return (
        can_read_admin_catalog(user) or normalized_role(user) in QUOTE_WORKSPACE_ROLES
    )


def can_manage_tenant_identity_settings(user: User) -> bool:
    return is_super_admin(user) or is_tenant_owner(user)


def can_manage_tenant_governance(user: User) -> bool:
    return is_super_admin(user)


def can_manage_shared_email_profiles(user: User) -> bool:
    return is_super_admin(user)


def can_manage_role_catalog(user: User) -> bool:
    return (
        is_super_admin(user)
        or is_tenant_admin(user)
        or normalized_role(user) in ROLE_MANAGEMENT_BUSINESS_ROLES
    )


def get_business_role_priority(user: User) -> int:
    role = normalized_role(user)
    return BUSINESS_ROLE_PRIORITY.get(role, 999)


# ---------------------------------------------------------------------------
# Talent Network yetkilendirme yardımcıları
# ---------------------------------------------------------------------------


def is_talent_member(user: User) -> bool:
    return normalized_system_role(user) in TALENT_MEMBER_SYSTEM_ROLES


def is_employer_admin(user: User) -> bool:
    return normalized_system_role(user) in EMPLOYER_ADMIN_SYSTEM_ROLES


def is_referral_partner(user: User) -> bool:
    return normalized_system_role(user) in REFERRAL_PARTNER_SYSTEM_ROLES


def is_moderator_compliance(user: User) -> bool:
    return normalized_system_role(user) in MODERATOR_COMPLIANCE_SYSTEM_ROLES


def is_talent_ecosystem_member(user: User) -> bool:
    return normalized_system_role(user) in TALENT_ECOSYSTEM_ROLES


def can_approve_payout(user: User) -> bool:
    """Ödeme talebini onaylama yetkisi."""
    return normalized_system_role(user) in PAYOUT_APPROVER_SYSTEM_ROLES


def can_review_talent_profile(user: User) -> bool:
    """Talent profilini inceleme/KYC onay yetkisi."""
    return (
        is_super_admin(user)
        or normalized_system_role(user) in TALENT_REVIEWER_SYSTEM_ROLES
    )


def can_publish_referral_task(user: User) -> bool:
    """Referral görevi yayınlama yetkisi — sadece platform staff."""
    return is_super_admin(user) or is_platform_staff(user)


def can_post_procurement_job(user: User) -> bool:
    """İş ilanı oluşturma yetkisi."""
    return (
        is_super_admin(user)
        or is_employer_admin(user)
        or is_tenant_admin(user)
        or is_platform_staff(user)
    )


def can_access_talent_dashboard(user: User) -> bool:
    """Talent paneline erişim."""
    return is_talent_member(user) or is_referral_partner(user) or is_super_admin(user)


def can_access_talent_admin(user: User) -> bool:
    """Talent ekosistemi yönetim paneline erişim."""
    return (
        is_super_admin(user)
        or is_moderator_compliance(user)
        or is_platform_staff(user)
    )


def resolve_requested_user_system_role(
    current_user: User,
    requested_role: str,
    requested_system_role: str | None = None,
) -> str:
    normalized = (requested_role or "").strip().lower()
    normalized_requested_system_role = (requested_system_role or "").strip().lower()
    if normalized == "super_admin":
        return "super_admin"
    if is_super_admin(current_user) and normalized == "admin":
        if normalized_requested_system_role in ADMIN_ASSIGNABLE_SYSTEM_ROLES:
            return normalized_requested_system_role
        return "tenant_admin"
    return "tenant_member"
