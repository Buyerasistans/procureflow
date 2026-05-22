import type { AdminTabKey } from "../pages/admin/adminPageMeta";

export type WorkspacePanelTabKey = AdminTabKey;

export type WorkspacePanelProfile = {
  key: string;
  title: string;
  description: string;
  workspace_label?: string;
  allowed_tabs: string[];
};

export type WorkspacePanelConfig = {
  profiles: WorkspacePanelProfile[];
};

type WorkspaceUser = {
  role?: string | null;
  business_role?: string | null;
  system_role?: string | null;
  organization_name?: string | null;
  platform_name?: string | null;
} | null | undefined;

const DEFAULT_ALLOWED_TABS: AdminTabKey[] = [
  "panel_home",
  "companies",
  "roles",
  "departments",
  "personnel",
  "projects",
  "suppliers",
  "approvals",
  "reports",
  "settings",
];

export const WORKSPACE_PANEL_DATA_TABS = new Set<WorkspacePanelTabKey>([
  "panel_home",
  "companies",
  "roles",
  "departments",
  "personnel",
  "projects",
  "suppliers",
  "approvals",
  "reports",
  "settings",
  "tenant_governance",
  "packages",
  "platform_analytics",
  "platform_suppliers",
  "public_pricing",
  "campaigns",
]);

export function mergeWorkspacePanelConfig(config?: WorkspacePanelConfig | null): WorkspacePanelConfig {
  return {
    profiles: Array.isArray(config?.profiles) ? config.profiles : [],
  };
}

export function resolveWorkspacePanelProfile(user: WorkspaceUser, config: WorkspacePanelConfig): WorkspacePanelProfile | null {
  const roleKeys = [
    user?.system_role,
    user?.business_role,
    user?.role,
  ].map((value) => String(value || "").toLowerCase()).filter(Boolean);

  const matched = config.profiles.find((profile) => roleKeys.includes(profile.key.toLowerCase()));
  if (matched) {
    return matched;
  }

  if (roleKeys.includes("super_admin")) {
    return {
      key: "super_admin",
      title: "Platform Paneli",
      description: "Platform yonetimi, paketler ve operasyon ozetleri.",
      workspace_label: user?.platform_name || user?.organization_name || "ProcureFlow",
      allowed_tabs: [
        "panel_home",
        "tenant_governance",
        "packages",
        "platform_analytics",
        "platform_suppliers",
        "public_pricing",
        "campaigns",
        "companies",
        "roles",
        "personnel",
        "reports",
        "settings",
        "panel_designer",
      ],
    };
  }

  return {
    key: roleKeys[0] || "default",
    title: "Yonetim Paneli",
    description: "Rolunuze uygun yonetim kisayollari.",
    workspace_label: user?.organization_name || "ProcureFlow",
    allowed_tabs: DEFAULT_ALLOWED_TABS,
  };
}

export function getWorkspacePanelQuickLinks(profile: WorkspacePanelProfile | null) {
  const tabs = profile?.allowed_tabs?.length ? profile.allowed_tabs : DEFAULT_ALLOWED_TABS;
  return tabs
    .filter((tab) => tab !== "panel_home" && tab !== "panel_designer")
    .slice(0, 6)
    .map((tab) => ({
      href: `/admin?tab=${encodeURIComponent(tab)}`,
      label: tab.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      description: "Bu calisma alanina gec.",
    }));
}
