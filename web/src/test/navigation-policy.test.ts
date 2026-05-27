import { describe, expect, it } from "vitest";

import { hasPermissionForUser, type Permission, type Role } from "../auth/permissions";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  resolveVisibleNavItems,
  type NavigationVisibilityContext,
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
  // channel personas: known divergence — legacy excludes /quotes via visibleFor callback;
  // policy has no such exclusion yet. Tests document rather than assert parity.
  it("channel_owner: /quotes gorulur sadece policy'de (bilinen sapma)", () => {
    const user = buildUser({
      role: "channel_owner" as Role,
      business_role: "channel_owner",
      system_role: "tenant_member",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.onlyInPolicy).toEqual(["/quotes"]);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.hasDivergence).toBe(true);
  });

  it("channel_agent: /quotes gorulur sadece policy'de (bilinen sapma)", () => {
    const user = buildUser({
      role: "channel_agent" as Role,
      business_role: "channel_agent",
      system_role: "tenant_member",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.onlyInPolicy).toEqual(["/quotes"]);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.hasDivergence).toBe(true);
  });

  it("supplier_admin (system_role=null): legacy ve policy paritesi saglandi", () => {
    const user = buildUser({
      role: "supplier_admin" as Role,
      business_role: "supplier_admin",
      system_role: null,
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
  });

  it("supplier_user (system_role=null): legacy ve policy paritesi saglandi", () => {
    const user = buildUser({
      role: "supplier_user" as Role,
      business_role: "supplier_user",
      system_role: null,
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.onlyInLegacy).toEqual([]);
    expect(result.onlyInPolicy).toEqual([]);
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

  it("employer_recruiter (yeni program rolu): dashboard+quotes paritesi", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "employer_recruiter",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
  });

  it("candidate_user (yeni program rolu): dashboard+quotes paritesi", () => {
    const user = buildUser({
      role: "user",
      business_role: "user",
      system_role: "candidate_user",
    });
    const result = compareAuthenticatedTopNav(user);
    expect(result.hasDivergence).toBe(false);
    expect(result.inBoth).toEqual(["/dashboard", "/quotes"]);
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
