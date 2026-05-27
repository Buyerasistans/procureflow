import type { Permission } from "../auth/permissions";

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
    allowed_system_roles: ["super_admin", "platform_support", "platform_operator", "tenant_owner", "tenant_admin", "supplier_user"],
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
