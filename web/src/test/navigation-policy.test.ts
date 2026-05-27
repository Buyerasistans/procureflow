import { describe, expect, it } from "vitest";

import { hasPermissionForUser, type Permission, type Role } from "../auth/permissions";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  PUBLIC_TOP_NAV_POLICY_ITEMS,
  PUBLIC_NAV_CONTEXT,
  buildPolicyContext,
  resolveVisiblePanelTabKeys,
  resolveVisibleNavItems,
  type NavigationVisibilityContext,
  type PanelTabVisibilityFlags,
} from "../config/navigation-policy";
import { compareAuthenticatedTopNav } from "../config/navigation-adapter";
import { getVisibleNavItems } from "../config/navigation";
import type { AuthUser } from "../context/auth-types";

const KNOWN_PERMISSIONS: Permission[] = [
  "view:dashboard",
  "view:admin",
  "view:workspace-panel",
  "view:reports",
  "manage:users",
];

function buildUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 1,
    email: "test@example.com",
    role: "user",
    business_role: "user",
    system_role: "tenant_member",
    ...overrides,
  };
}

function currentTopNavRoutes(user: AuthUser): string[] {
  return getVisibleNavItems(user)
    .filter((item) => hasPermissionForUser(user, item.permission))
    .map((item) => item.to);
}

function policyContextFromUser(user: AuthUser): NavigationVisibilityContext {
  const systemRole = String(user.system_role || "").toLowerCase();
  const permissions = KNOWN_PERMISSIONS.filter((permission) => hasPermissionForUser(user, permission));

  return {
    is_authenticated: true,
    system_role: user.system_role,
    tenant_role: user.business_role || user.role,
    business_role: user.business_role,
    permissions,
    scope: systemRole.startsWith("platform") || systemRole === "super_admin" ? "platform" : "tenant",
  };
}

function policyTopNavRoutes(user: AuthUser): string[] {
  return resolveVisibleNavItems(AUTHENTICATED_TOP_NAV_POLICY_ITEMS, policyContextFromUser(user))
    .map((item) => item.route);
}

describe("navigation visibility policy parity", () => {
  it("super_admin icin mevcut authenticated top-nav route listesini korur", () => {
    const user = buildUser({
      role: "super_admin",
      business_role: "super_admin",
      system_role: "super_admin",
    });

    expect(policyTopNavRoutes(user)).toEqual(currentTopNavRoutes(user));
  });

  it("platform staff varyantinda mevcut authenticated top-nav route listesini korur", () => {
    const user = buildUser({
      role: "admin" as Role,
      business_role: "admin",
      system_role: "platform_support",
    });

    expect(policyTopNavRoutes(user)).toEqual(currentTopNavRoutes(user));
  });

  it("yetkisiz kullanicida privileged authenticated route'lari gizli tutar", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "tenant_member",
    });

    const resolvedRoutes = policyTopNavRoutes(user);

    expect(resolvedRoutes).toEqual(currentTopNavRoutes(user));
    expect(resolvedRoutes).not.toContain("/admin");
    expect(resolvedRoutes).not.toContain("/discovery-lab");
    expect(resolvedRoutes).not.toContain("/admin/payout-requests");
    expect(resolvedRoutes).not.toContain("/admin/talent-ecosystem");
  });
});

describe("parity adapter: role vocabulary coverage", () => {
  // channel personas: /quotes exclusion resolved in Atomik-4 via excluded_tenant_roles field.
  it("channel_owner: /quotes excluded_tenant_roles ile legacy parity saglandi", () => {
    const user = buildUser({
      role: "channel_owner" as Role,
      business_role: "channel_owner",
      system_role: "tenant_member",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/admin"]);
  });

  it("channel_agent: /quotes excluded_tenant_roles ile legacy parity saglandi", () => {
    const user = buildUser({
      role: "channel_agent" as Role,
      business_role: "channel_agent",
      system_role: "tenant_member",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/admin"]);
  });

  it("supplier_admin (system_role=null): dashboard+quotes paritesi", () => {
    const user = buildUser({
      role: "supplier_admin" as Role,
      business_role: "supplier_admin",
      system_role: null,
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
  });

  it("supplier_admin (system_role=supplier_user): dashboard+quotes paritesi — /admin gizli", () => {
    const user = buildUser({
      role: "supplier_admin" as Role,
      business_role: "supplier_admin",
      system_role: "supplier_user",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
  });

  it("supplier_user (system_role=null): dashboard+quotes paritesi", () => {
    const user = buildUser({
      role: "supplier_user" as Role,
      business_role: "supplier_user",
      system_role: null,
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
  });

  it("supplier_user (system_role=supplier_user): dashboard+quotes paritesi — /admin gizli", () => {
    const user = buildUser({
      role: "supplier_user" as Role,
      business_role: "supplier_user",
      system_role: "supplier_user",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
  });

  it("tenant_admin: dashboard+quotes+admin+discovery-lab+reports paritesi", () => {
    const user = buildUser({
      role: "admin" as Role,
      business_role: "admin",
      system_role: "tenant_admin",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes", "/admin", "/discovery-lab", "/reports"]);
  });

  it("employer_company_admin: dashboard+quotes+jobs paritesi", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "employer_company_admin",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes", "/jobs"]);
  });

  it("employer_recruiter: Atomik-5 policy extension — /jobs eklendi (legacy divergence intentional)", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "employer_recruiter",
    });
    const result = compareAuthenticatedTopNav(user);
    // Intentional: policy adds /jobs for recruiter; legacy has no employer_recruiter logic
    expect(result.hasDivergence).toBe(true);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toContain("/jobs");
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
    expect(policyTopNavRoutes(user)).toContain("/jobs");
    expect(policyTopNavRoutes(user)).not.toContain("/talent/profile");
  });

  it("candidate_user: Atomik-5 policy extension — /jobs + /talent/profile eklendi (legacy divergence intentional)", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "candidate_user",
    });
    const result = compareAuthenticatedTopNav(user);
    // Intentional: policy adds /jobs and /talent/profile for candidate; legacy has no candidate_user logic
    expect(result.hasDivergence).toBe(true);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toContain("/jobs");
    expect(result.onlyInPolicy).toContain("/talent/profile");
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
    expect(policyTopNavRoutes(user)).toContain("/jobs");
    expect(policyTopNavRoutes(user)).toContain("/talent/profile");
  });

  it("super_admin regression: adapter uzerinden parity saglandi", () => {
    const user = buildUser({
      role: "super_admin",
      business_role: "super_admin",
      system_role: "super_admin",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
  });

  it("platform_support regression: adapter uzerinden parity saglandi", () => {
    const user = buildUser({
      role: "admin" as Role,
      business_role: "admin",
      system_role: "platform_support",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
  });
});

describe("public nav policy", () => {
  const EXPECTED_PUBLIC_KEYS = [
    "top_nav.public.home",
    "top_nav.public.offers",
    "top_nav.public.suppliers",
    "top_nav.public.strategic",
    "top_nav.public.partner_program",
    "top_nav.public.employer_register",
    "top_nav.public.candidate_register",
  ];

  const EXPECTED_TR_ROUTES = ["/", "/teklifler", "/tedarikciler", "/stratejik-ortaklik", "/is-ortagi-programi", "/employer/register", "/candidate/register"];

  it("anonim (unauthenticated) context'te tum public nav item'lari gorunur", () => {
    const visibleKeys = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, PUBLIC_NAV_CONTEXT)
      .map((item) => item.key);
    expect(visibleKeys).toEqual(EXPECTED_PUBLIC_KEYS);
  });

  it("public nav item siralamasi hardcoded link siralamasini korur (parity)", () => {
    const resolvedRoutes = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, PUBLIC_NAV_CONTEXT)
      .map((item) => item.route);
    expect(resolvedRoutes).toEqual(EXPECTED_TR_ROUTES);
  });

  it("authenticated tenant_member context'te de public nav item'lari gorunur", () => {
    const tenantCtx: NavigationVisibilityContext = {
      is_authenticated: true,
      system_role: "tenant_member",
      tenant_role: "user",
      permissions: ["view:dashboard"],
      scope: "tenant",
    };
    const visibleKeys = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, tenantCtx)
      .map((item) => item.key);
    expect(visibleKeys).toEqual(EXPECTED_PUBLIC_KEYS);
  });

  it("super_admin context'te de public nav item'lari gorunur", () => {
    const user = buildUser({ role: "super_admin", business_role: "super_admin", system_role: "super_admin" });
    const visibleKeys = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, buildPolicyContext(user))
      .map((item) => item.key);
    expect(visibleKeys).toEqual(EXPECTED_PUBLIC_KEYS);
  });
});

describe("admin panel tab policy", () => {
  const superAdminFlags: PanelTabVisibilityFlags = {
    is_role_management_only: false,
    can_view_platform_governance: true,
    can_view_packages_tab: true,
    can_view_deployment_tab: true,
    can_view_settings_tab: true,
    show_settings_workspace_links: false,
    can_use_panel_designer: true,
  };

  const tenantAdminFlags: PanelTabVisibilityFlags = {
    is_role_management_only: false,
    can_view_platform_governance: false,
    can_view_packages_tab: false,
    can_view_deployment_tab: false,
    can_view_settings_tab: true,
    show_settings_workspace_links: true,
    can_use_panel_designer: false,
  };

  it("super_admin panel tab setini mevcut siralama ile policy uzerinden cozer", () => {
    const user = buildUser({
      role: "super_admin",
      business_role: "super_admin",
      system_role: "super_admin",
    });

    expect(resolveVisiblePanelTabKeys(buildPolicyContext(user), superAdminFlags)).toEqual([
      "panel_home",
      "platform_operations",
      "discovery_lab_operations",
      "onboarding_studio",
      "tenant_governance",
      "packages",
      "deployment",
      "platform_analytics",
      "platform_suppliers",
      "public_pricing",
      "campaigns",
      "commission_admin",
      "support_tickets",
      "settings",
      "companies",
      "roles",
      "departments",
      "personnel",
      "projects",
      "approvals",
      "reports",
      "panel_designer",
    ]);
  });

  it("tenant_admin panel tab setinde platform-only tablari gizler ve settings'i korur", () => {
    const user = buildUser({
      role: "admin" as Role,
      business_role: "admin",
      system_role: "tenant_admin",
    });

    expect(resolveVisiblePanelTabKeys(buildPolicyContext(user), tenantAdminFlags)).toEqual([
      "panel_home",
      "settings",
      "companies",
      "roles",
      "departments",
      "personnel",
      "projects",
      "approvals",
      "reports",
    ]);
  });

  it("role-management-only kullanicida yalniz roller sekmesini cozer", () => {
    const user = buildUser({
      role: "manager",
      business_role: "manager",
      system_role: "tenant_member",
    });

    expect(resolveVisiblePanelTabKeys(buildPolicyContext(user), {
      ...tenantAdminFlags,
      is_role_management_only: true,
      show_settings_workspace_links: false,
    })).toEqual(["roles"]);
  });
});
