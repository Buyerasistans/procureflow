/**
 * Non-invasive nav comparison adapter — dev/test only.
 *
 * Compares the authenticated top-nav output from the legacy `navigation.ts`
 * resolver against the typed `navigation-policy.ts` resolver.
 *
 * Not wired into any runtime render path. Safe to import in tests.
 */
import { hasPermissionForUser, type Permission } from "../auth/permissions";
import type { AuthUser } from "../context/auth-types";
import { getVisibleNavItems } from "./navigation";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  resolveVisibleNavItems,
  type NavigationVisibilityContext,
} from "./navigation-policy";

const KNOWN_PERMISSIONS: Permission[] = [
  "view:dashboard",
  "view:admin",
  "view:workspace-panel",
  "view:reports",
  "manage:users",
];

export interface NavComparisonResult {
  /** Routes from the legacy navigation.ts resolver (runtime source of truth). */
  legacy: string[];
  /** Routes from the typed policy resolver (non-wired candidate). */
  policy: string[];
  /** Routes visible in legacy but not in policy. */
  onlyInLegacy: string[];
  /** Routes visible in policy but not in legacy. */
  onlyInPolicy: string[];
  /** Routes visible in both. */
  inBoth: string[];
  /** True when at least one route differs between legacy and policy. */
  hasDivergence: boolean;
}

/**
 * Derives a NavigationVisibilityContext from an AuthUser using the same
 * permission resolution path as the legacy nav helper.
 */
export function buildPolicyContext(user: AuthUser): NavigationVisibilityContext {
  const systemRole = String(user.system_role || "").toLowerCase();
  const permissions = KNOWN_PERMISSIONS.filter((p) => hasPermissionForUser(user, p));
  return {
    is_authenticated: true,
    system_role: user.system_role,
    tenant_role: user.business_role || user.role,
    business_role: user.business_role,
    permissions,
    scope:
      systemRole.startsWith("platform") || systemRole === "super_admin" ? "platform" : "tenant",
  };
}

/**
 * Returns a comparison result for the authenticated top-nav for the given user.
 *
 * Use this in tests/dev to surface divergences between legacy and policy output.
 * Never call this in a production render path.
 */
export function compareAuthenticatedTopNav(user: AuthUser): NavComparisonResult {
  const legacy = getVisibleNavItems(user)
    .filter((item) => hasPermissionForUser(user, item.permission))
    .map((item) => item.to);

  const policy = resolveVisibleNavItems(
    AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
    buildPolicyContext(user),
  ).map((item) => item.route);

  const legacySet = new Set(legacy);
  const policySet = new Set(policy);

  const onlyInLegacy = legacy.filter((r) => !policySet.has(r));
  const onlyInPolicy = policy.filter((r) => !legacySet.has(r));

  return {
    legacy,
    policy,
    onlyInLegacy,
    onlyInPolicy,
    inBoth: legacy.filter((r) => policySet.has(r)),
    hasDivergence: onlyInLegacy.length > 0 || onlyInPolicy.length > 0,
  };
}
