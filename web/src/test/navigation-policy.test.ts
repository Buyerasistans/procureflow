import { describe, expect, it } from "vitest";

import { hasPermissionForUser, type Permission, type Role } from "../auth/permissions";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  resolveVisibleNavItems,
  type NavigationVisibilityContext,
} from "../config/navigation-policy";
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
