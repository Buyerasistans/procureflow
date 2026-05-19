"""
Rol tabanlı menü görünürlük ve aksiyon matrisi — TEK KAYNAK.

Bu modül, her rol profiline göre hangi permission key'lerinin aktif olduğunu
tanımlar. Backend endpoint'i (/admin/role-permission-matrix) ve frontend
önizleme bileşeni bu kaynaktan beslenmeli; başka yerde tekrar tanımlanmamalı.

Profil anahtarı formatı:  "{business_role}:{system_role}"
Özel anahtar           :  "default" — hiçbir profile uymayan fallback
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Permission key sabit listesi (PERMISSION_CATALOG_TREE ile senkronize)
# ---------------------------------------------------------------------------
ALL_PERMISSION_KEYS: list[str] = [
    "workspace_home",
    "workspace_home.kpi_cards",
    "workspace_home.operation_feed",
    "admin_surface",
    "admin_surface.user_view",
    "admin_surface.user_create",
    "admin_surface.user_edit",
    "admin_surface.user_disable",
    "admin_surface.user_delete",
    "manage_users",
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
    "quote_workspace.comparison",
    "approval_review",
    "tenant_governance_read",
    "tenant_governance_read.list",
    "tenant_governance_read.detail",
    "tenant_governance_write",
    "tenant_governance_write.detail_edit",
    "support_workflow",
    "tenant_identity",
    "shared_email",
]

# ---------------------------------------------------------------------------
# Yetki kümeleri (kısa takma adlar)
# ---------------------------------------------------------------------------
_FULL_ADMIN: list[str] = ALL_PERMISSION_KEYS  # her şey açık

_TENANT_ADMIN_SET: list[str] = [
    "workspace_home",
    "workspace_home.kpi_cards",
    "workspace_home.operation_feed",
    "admin_surface",
    "admin_surface.user_view",
    "admin_surface.user_create",
    "admin_surface.user_edit",
    "admin_surface.user_disable",
    "admin_surface.user_delete",
    "manage_users",
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
    "quote_workspace.comparison",
    "approval_review",
    "tenant_governance_read",
    "tenant_governance_read.list",
    "tenant_governance_read.detail",
]

_PLATFORM_STAFF_SET: list[str] = [
    "workspace_home",
    "workspace_home.kpi_cards",
    "workspace_home.operation_feed",
    "admin_surface",
    "admin_surface.user_view",
    "tenant_governance_read",
    "tenant_governance_read.list",
    "tenant_governance_read.detail",
    "support_workflow",
]

_DIRECTORU_SET: list[str] = [
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
    "quote_workspace.comparison",
    "approval_review",
]

_YONETICISI_SET: list[str] = [
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
    "quote_workspace.comparison",
    "approval_review",
]

_UZMAN_SET: list[str] = [
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
    "quote_workspace.comparison",
]

_SATINALMACI_SET: list[str] = [
    "quote_workspace",
    "quote_workspace.list",
    "quote_workspace.create",
    "quote_workspace.edit",
    "quote_workspace.submit_approval",
]

# ---------------------------------------------------------------------------
# TEK KAYNAK: Rol Matrisi
# Anahtar: "{business_role}:{system_role}"  (boş system_role = "")
# ---------------------------------------------------------------------------
ROLE_PERMISSION_MATRIX: dict[str, list[str]] = {
    # ── Platform Süper Admin ──────────────────────────────────────────────
    "super_admin:super_admin": _FULL_ADMIN,
    # ── Tenant Admin ─────────────────────────────────────────────────────
    "admin:tenant_admin": _TENANT_ADMIN_SET,
    "admin:tenant_owner": _TENANT_ADMIN_SET,
    # ── Platform Personeli ────────────────────────────────────────────────
    "admin:platform_support": _PLATFORM_STAFF_SET,
    "admin:platform_operator": _PLATFORM_STAFF_SET,
    # ── İş Rolleri (system_role = "tenant_member") ────────────────────────
    "satinalma_direktoru:tenant_member": _DIRECTORU_SET,
    "satinalma_direktoru:": _DIRECTORU_SET,
    "satinalma_yoneticisi:tenant_member": _YONETICISI_SET,
    "satinalma_yoneticisi:": _YONETICISI_SET,
    "satinalma_uzmani:tenant_member": _UZMAN_SET,
    "satinalma_uzmani:": _UZMAN_SET,
    "satinalmaci:tenant_member": _SATINALMACI_SET,
    "satinalmaci:": _SATINALMACI_SET,
    # ── Varsayılan (tanımlanmayan profil) ─────────────────────────────────
    "default": [],
}


def resolve_profile_key(business_role: str, system_role: str) -> str:
    """
    Önce kesin eşleşme dener; bulamazsa business_role ile system_role='' dener;
    son olarak 'default' döner.
    """
    exact = f"{business_role}:{system_role}"
    if exact in ROLE_PERMISSION_MATRIX:
        return exact
    fallback = f"{business_role}:"
    if fallback in ROLE_PERMISSION_MATRIX:
        return fallback
    return "default"


def get_enabled_keys(business_role: str, system_role: str) -> list[str]:
    """Verilen rol profiline göre aktif permission key listesini döner."""
    profile_key = resolve_profile_key(business_role.lower(), system_role.lower())
    return ROLE_PERMISSION_MATRIX[profile_key]


def build_matrix_response() -> list[dict]:
    """
    /admin/role-permission-matrix endpoint'i için tam matris yanıtı üretir.
    Her profil için {profile, business_role, system_role, enabled_keys} döner.
    """
    rows = []
    for profile_key, enabled_keys in ROLE_PERMISSION_MATRIX.items():
        if profile_key == "default":
            continue
        parts = profile_key.split(":", 1)
        rows.append(
            {
                "profile": profile_key,
                "business_role": parts[0],
                "system_role": parts[1] if len(parts) > 1 else "",
                "enabled_keys": enabled_keys,
            }
        )
    return rows
