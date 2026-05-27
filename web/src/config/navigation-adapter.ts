/**
 * Non-invasive nav comparison adapter — dev/test only.
 *
 * Compares the authenticated top-nav output from the legacy `navigation.ts`
 * resolver against the typed `navigation-policy.ts` resolver.
 *
 * `compareAuthenticatedTopNav` is not wired into any runtime render path.
 * `buildPolicyContext` is re-exported from `navigation-policy.ts` and is used
 * by AppLayout at runtime.
 */
import { hasPermissionForUser } from "../auth/permissions";
import type { AuthUser } from "../context/auth-types";
import { getVisibleNavItems } from "./navigation";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  buildPolicyContext,
  resolveVisibleNavItems,
} from "./navigation-policy";

export interface NavComparisonResult {
  /** Routes from the legacy navigation.ts resolver (dev/test reference only; runtime now uses policy). */
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

// buildPolicyContext is defined in navigation-policy.ts and re-exported for tests.
export { buildPolicyContext } from "./navigation-policy";

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
