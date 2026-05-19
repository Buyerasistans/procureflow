import type { Role } from "./permissions";
import { hasAdminWorkspaceHome, hasPermission, hasPermissionForUser } from "./permissions";
import { getVisibleNavItems } from "../config/navigation";
import type { AuthUser } from "../context/auth-types";

export function getDefaultRouteForRole(role: Role): string {
  const firstAllowed = getVisibleNavItems({ id: 0, email: "", role }).find((item) =>
    hasPermission(role, item.permission)
  );
  return firstAllowed?.to ?? "/dashboard";
}

export function getDefaultRouteForUser(user: AuthUser | null): string {
  if (!user) return "/login";
  if (hasAdminWorkspaceHome(user)) {
    return "/admin";
  }

  const firstAllowed = getVisibleNavItems(user).find((item) =>
    hasPermissionForUser(user, item.permission)
  );
  return firstAllowed?.to ?? "/dashboard";
}