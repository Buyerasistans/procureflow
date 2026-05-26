// FILE: web\src\config\navigation.ts
import { getWorkspacePanelNavLabel, hasAdminWorkspaceHome, normalizedBusinessRole, type Permission } from "../auth/permissions";
import type { AuthUser } from "../context/auth-types";

export type NavItem = {
  label: string | ((user: AuthUser) => string);
  to: string;
  permission: Permission;
  visibleFor?: (user: AuthUser) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", permission: "view:dashboard" },
  {
    label: "Teklifler",
    to: "/quotes",
    permission: "view:dashboard",
    visibleFor: (user) => {
      const role = normalizedBusinessRole(user);
      return role !== "channel_owner" && role !== "channel_agent" && role !== "is_ortagi";
    },
  },
  {
    label: (user) => getWorkspacePanelNavLabel(user),
    to: "/admin",
    permission: "view:workspace-panel",
    visibleFor: (user) => hasAdminWorkspaceHome(user),
  },
  { 
    label: "AI Keşif Lab", // Menüde görünecek isim
    to: "/discovery-lab", 
    permission: "view:admin" // Sadece admin yetkisi olanlar (Mimarlar dahil) görsün
  },
  { label: "Raporlar", to: "/reports", permission: "view:reports" },
  {
    label: "İş İlanları",
    to: "/jobs",
    permission: "view:dashboard",
    visibleFor: (user) => {
      const sr = (user?.system_role || "").toLowerCase();
      return (
        sr === "talent_member" ||
        sr === "employer_company_admin" ||
        sr === "referral_partner" ||
        sr === "super_admin"
      );
    },
  },
];

export function getVisibleNavItems(user: AuthUser): NavItem[] {
  return NAV_ITEMS.filter((item) => (item.visibleFor ? item.visibleFor(user) : true));
}