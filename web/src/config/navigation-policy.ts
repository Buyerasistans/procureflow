import { hasPermissionForUser, type Permission } from "../auth/permissions";
import type { AuthUser } from "../context/auth-types";

const KNOWN_PERMISSIONS: Permission[] = [
  "view:dashboard",
  "view:admin",
  "view:workspace-panel",
  "view:reports",
  "manage:users",
];

export type NavigationPlacement = "top_nav" | "panel_tab" | "quick_link" | "page_cta";
export type VisibilityScope = "public" | "authenticated" | "tenant_only" | "platform_only";
export type ResponsiveBehavior = "wrap" | "collapse" | "more_menu";

export type NavigationVisibilityPolicyItem = {
  key: string;
  label: string;
  placement: NavigationPlacement;
  route: string;
  order: number;
  is_enabled: boolean;
  visibility_scope: VisibilityScope;
  allowed_system_roles: string[];
  allowed_tenant_roles: string[];
  /** Tenant/business roles that are explicitly excluded even when other checks would pass. Exclusion takes precedence over allow-lists. */
  excluded_tenant_roles?: string[];
  requires_permissions: Permission[];
  responsive_behavior: ResponsiveBehavior;
};

export type NavigationVisibilityContext = {
  is_authenticated: boolean;
  system_role?: string | null;
  tenant_role?: string | null;
  business_role?: string | null;
  permissions: ReadonlySet<Permission> | readonly Permission[];
  scope?: VisibilityScope | "tenant" | "platform" | string | null;
};

export type PanelTabVisibilityFlags = {
  is_role_management_only: boolean;
  can_view_platform_governance: boolean;
  can_view_packages_tab: boolean;
  can_view_deployment_tab: boolean;
  can_view_settings_tab: boolean;
  show_settings_workspace_links: boolean;
  can_use_panel_designer: boolean;
};

function normalizeRole(value?: string | null): string {
  return String(value || "").toLowerCase();
}

function permissionSetContains(
  permissions: NavigationVisibilityContext["permissions"],
  permission: Permission,
): boolean {
  if (Array.isArray(permissions)) {
    return permissions.includes(permission);
  }

  return (permissions as ReadonlySet<Permission>).has(permission);
}

function matchesAnyRole(allowedRoles: readonly string[], candidateRoles: readonly (string | null | undefined)[]): boolean {
  if (allowedRoles.length === 0) return false;
  const normalizedAllowedRoles = new Set(allowedRoles.map(normalizeRole));
  return candidateRoles.some((role) => normalizedAllowedRoles.has(normalizeRole(role)));
}

function isTenantRoleExcluded(item: NavigationVisibilityPolicyItem, context: NavigationVisibilityContext): boolean {
  if (!item.excluded_tenant_roles || item.excluded_tenant_roles.length === 0) return false;
  const excluded = new Set(item.excluded_tenant_roles.map(normalizeRole));
  return [context.tenant_role, context.business_role].some((role) => excluded.has(normalizeRole(role)));
}

function matchesScope(item: NavigationVisibilityPolicyItem, context: NavigationVisibilityContext): boolean {
  if (item.visibility_scope === "public") return true;
  if (!context.is_authenticated) return false;

  const scope = normalizeRole(context.scope);
  const systemRole = normalizeRole(context.system_role);

  if (item.visibility_scope === "tenant_only") {
    return (
      scope === "tenant" ||
      systemRole === "tenant_owner" ||
      systemRole === "tenant_admin" ||
      systemRole === "tenant_member" ||
      item.allowed_tenant_roles.length > 0
    );
  }

  if (item.visibility_scope === "platform_only") {
    return (
      scope === "platform" ||
      systemRole === "super_admin" ||
      systemRole === "platform_support" ||
      systemRole === "platform_operator" ||
      systemRole === "finance_officer" ||
      systemRole === "moderator_compliance"
    );
  }

  return true;
}

export function isPolicyItemVisible(
  item: NavigationVisibilityPolicyItem,
  context: NavigationVisibilityContext,
): boolean {
  if (!item.is_enabled || !matchesScope(item, context)) return false;
  if (isTenantRoleExcluded(item, context)) return false;

  const hasRoleRestriction = item.allowed_system_roles.length > 0 || item.allowed_tenant_roles.length > 0;
  const systemRoleMatches = matchesAnyRole(item.allowed_system_roles, [context.system_role]);
  const tenantRoleMatches = matchesAnyRole(item.allowed_tenant_roles, [
    context.tenant_role,
    context.business_role,
  ]);

  if (hasRoleRestriction && !systemRoleMatches && !tenantRoleMatches) return false;

  return item.requires_permissions.every((permission) => permissionSetContains(context.permissions, permission));
}

export function resolveVisibleNavItems(
  items: readonly NavigationVisibilityPolicyItem[],
  context: NavigationVisibilityContext,
): NavigationVisibilityPolicyItem[] {
  return items
    .filter((item) => isPolicyItemVisible(item, context))
    .sort((left, right) => left.order - right.order);
}

type PanelTabPolicyGroup =
  | "core"
  | "role_management"
  | "platform"
  | "packages"
  | "deployment"
  | "settings"
  | "panel_designer";

const ADMIN_PANEL_TAB_POLICY_DEFINITIONS: Array<{
  key: string;
  label: string;
  order: number;
  group: PanelTabPolicyGroup;
}> = [
  { key: "panel_home", label: "Panel Ana Sayfa", order: 10, group: "core" },
  { key: "platform_operations", label: "Platform Operasyonları", order: 20, group: "platform" },
  { key: "discovery_lab_operations", label: "Discovery Lab Operasyonları", order: 30, group: "platform" },
  { key: "onboarding_studio", label: "Kurulum Stüdyosu", order: 40, group: "platform" },
  { key: "tenant_governance", label: "Stratejik Partner Yönetimi", order: 50, group: "platform" },
  { key: "packages", label: "Paket ve Kullanım", order: 60, group: "packages" },
  { key: "deployment", label: "Yayınlama", order: 70, group: "deployment" },
  { key: "platform_analytics", label: "Platform Analitikleri", order: 80, group: "platform" },
  { key: "platform_suppliers", label: "Platform Tedarikçi Havuzu", order: 90, group: "platform" },
  { key: "public_pricing", label: "Ödeme ve Fiyatlandırma", order: 100, group: "platform" },
  { key: "campaigns", label: "Kampanya Yönetimi", order: 110, group: "platform" },
  { key: "commission_admin", label: "Komisyon Yönetimi", order: 120, group: "platform" },
  { key: "support_tickets", label: "Destek Talepleri", order: 130, group: "platform" },
  { key: "settings", label: "Ayarlar", order: 140, group: "settings" },
  { key: "companies", label: "Firmalar", order: 150, group: "core" },
  { key: "roles", label: "Roller ve Yetkiler", order: 160, group: "role_management" },
  { key: "departments", label: "Departmanlar", order: 170, group: "core" },
  { key: "personnel", label: "Personeller", order: 180, group: "core" },
  { key: "projects", label: "Projeler", order: 190, group: "core" },
  { key: "approvals", label: "Onay Akışları", order: 200, group: "core" },
  { key: "reports", label: "Raporlar", order: 210, group: "core" },
  { key: "panel_designer", label: "Panel Tasarımı", order: 220, group: "panel_designer" },
];

function isPanelTabGroupEnabled(group: PanelTabPolicyGroup, flags: PanelTabVisibilityFlags): boolean {
  if (flags.is_role_management_only) return group === "role_management";

  switch (group) {
    case "core":
    case "role_management":
      return true;
    case "platform":
      return flags.can_view_platform_governance;
    case "packages":
      return flags.can_view_platform_governance && flags.can_view_packages_tab;
    case "deployment":
      return flags.can_view_platform_governance && flags.can_view_deployment_tab;
    case "settings":
      return flags.can_view_platform_governance
        ? flags.can_view_settings_tab
        : flags.show_settings_workspace_links;
    case "panel_designer":
      return flags.can_use_panel_designer;
    default:
      return false;
  }
}

export function buildAdminPanelTabPolicyItems(
  flags: PanelTabVisibilityFlags,
): NavigationVisibilityPolicyItem[] {
  return ADMIN_PANEL_TAB_POLICY_DEFINITIONS.map((definition) => ({
    key: `panel_tab.admin.${definition.key}`,
    label: definition.label,
    placement: "panel_tab",
    route: `/admin?tab=${definition.key}`,
    order: definition.order,
    is_enabled: isPanelTabGroupEnabled(definition.group, flags),
    visibility_scope: "authenticated",
    allowed_system_roles: [],
    allowed_tenant_roles: [],
    requires_permissions: [],
    responsive_behavior: "wrap",
  }));
}

export function resolveVisiblePanelTabKeys(
  context: NavigationVisibilityContext,
  flags: PanelTabVisibilityFlags,
): string[] {
  return resolveVisibleNavItems(buildAdminPanelTabPolicyItems(flags), context)
    .map((item) => item.route.replace("/admin?tab=", ""));
}

/** Derives a NavigationVisibilityContext from an AuthUser. */
export function buildPolicyContext(user: AuthUser): NavigationVisibilityContext {
  const systemRole = String(user.system_role || "").toLowerCase();
  const permissions = KNOWN_PERMISSIONS.filter((p) => hasPermissionForUser(user, p));
  return {
    is_authenticated: true,
    system_role: user.system_role,
    tenant_role: user.business_role || user.role,
    business_role: user.business_role,
    permissions,
    scope: systemRole.startsWith("platform") || systemRole === "super_admin" ? "platform" : "tenant",
  };
}

export const AUTHENTICATED_TOP_NAV_POLICY_ITEMS: NavigationVisibilityPolicyItem[] = [
  {
    key: "top_nav.app.dashboard",
    label: "Dashboard",
    placement: "top_nav",
    route: "/dashboard",
    order: 10,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: [],
    allowed_tenant_roles: [],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.quotes",
    label: "Teklifler",
    placement: "top_nav",
    route: "/quotes",
    order: 20,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: [],
    allowed_tenant_roles: [],
    excluded_tenant_roles: ["channel_owner", "channel_agent", "is_ortagi"],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.admin_workspace",
    label: "Yönetim Alanı",
    placement: "top_nav",
    route: "/admin",
    order: 30,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: ["super_admin", "platform_support", "platform_operator", "tenant_owner", "tenant_admin"],
    allowed_tenant_roles: ["admin", "super_admin", "manager", "buyer", "channel_owner", "channel_agent", "is_ortagi"],
    requires_permissions: ["view:workspace-panel"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.discovery_lab",
    label: "AI Keşif Lab",
    placement: "top_nav",
    route: "/discovery-lab",
    order: 40,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: [],
    allowed_tenant_roles: [],
    requires_permissions: ["view:admin"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.reports",
    label: "Raporlar",
    placement: "top_nav",
    route: "/reports",
    order: 50,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: [],
    allowed_tenant_roles: [],
    requires_permissions: ["view:reports"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.jobs",
    label: "İş İlanları",
    placement: "top_nav",
    route: "/jobs",
    order: 60,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: ["talent_member", "employer_company_admin", "referral_partner", "super_admin"],
    allowed_tenant_roles: [],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.talent_profile",
    label: "Talent Profilim",
    placement: "top_nav",
    route: "/talent/profile",
    order: 70,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: ["talent_member", "referral_partner", "super_admin"],
    allowed_tenant_roles: [],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.payout_requests",
    label: "Ödeme Talepleri",
    placement: "top_nav",
    route: "/admin/payout-requests",
    order: 80,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: ["super_admin", "platform_support", "platform_operator", "finance_officer", "moderator_compliance"],
    allowed_tenant_roles: [],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
  {
    key: "top_nav.app.talent_ecosystem",
    label: "Talent Ekosistemi",
    placement: "top_nav",
    route: "/admin/talent-ecosystem",
    order: 90,
    is_enabled: true,
    visibility_scope: "authenticated",
    allowed_system_roles: ["super_admin", "platform_support", "platform_operator", "moderator_compliance"],
    allowed_tenant_roles: [],
    requires_permissions: ["view:dashboard"],
    responsive_behavior: "more_menu",
  },
];
