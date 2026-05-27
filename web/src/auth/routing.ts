import type { AuthUser } from "../context/auth-types";
import { hasAdminWorkspaceHome } from "./permissions";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  buildPolicyContext,
  resolveVisibleNavItems,
} from "../config/navigation-policy";

export function getDefaultRouteForUser(user: AuthUser | null): string {
  if (!user) return "/login";
  if (hasAdminWorkspaceHome(user)) {
    return "/admin";
  }
  const firstAllowed = resolveVisibleNavItems(
    AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
    buildPolicyContext(user),
  )[0];
  return firstAllowed?.route ?? "/dashboard";
}
