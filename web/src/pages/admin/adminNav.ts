import type { AdminTabKey } from "./adminPageMeta";

export type AdminNavItem = {
  key: AdminTabKey;
  label: string;
  icon: string;
  badge?: string;
  count?: number;
  alert?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Genel",
    items: [
      { key: "panel_home", label: "Panel Ana Sayfa", icon: "home" },
      { key: "platform_overview", label: "Platform Genel Bakış", icon: "chart" },
      { key: "platform_analytics", label: "Platform Analitikleri", icon: "analytics" },
    ],
  },
  {
    label: "AI & Keşif",
    items: [
      { key: "discovery_lab_operations", label: "AI Keşif Lab", icon: "lab", badge: "Beta" },
    ],
  },
  {
    label: "Operasyon",
    items: [
      { key: "platform_operations", label: "Platform Operasyonları", icon: "cog" },
      { key: "onboarding_studio", label: "Kurulum Stüdyosu", icon: "studio", alert: true },
      { key: "tenant_governance", label: "Stratejik Partner Yönetimi", icon: "partner" },
      { key: "platform_suppliers", label: "Platform Tedarikçi Havuzu", icon: "supplier" },
      { key: "deployment", label: "Yayınlama", icon: "rocket" },
    ],
  },
  {
    label: "Kariyer & Yetenek",
    items: [
      { key: "kariyer_yonetimi", label: "Kariyer ve İş Piyasası", icon: "briefcase" },
    ],
  },
  {
    label: "Ticari",
    items: [
      { key: "packages", label: "Paket ve Kullanım", icon: "package" },
      { key: "public_pricing", label: "Genel Fiyatlandırma", icon: "price" },
      { key: "campaigns", label: "Kampanyalar & Landing", icon: "megaphone" },
      { key: "commission_admin", label: "Komisyon Yönetimi", icon: "wallet" },
    ],
  },
  {
    label: "Yönetişim",
    items: [
      { key: "companies", label: "Firmalar", icon: "building" },
      { key: "roles", label: "Roller & Yetkiler", icon: "shield" },
      { key: "departments", label: "Departmanlar", icon: "grid" },
      { key: "personnel", label: "Ekip Üyeleri", icon: "users" },
      { key: "projects", label: "Projeler", icon: "folder" },
      { key: "approvals", label: "Onay Akışları", icon: "check" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { key: "reports", label: "Raporlar", icon: "report" },
      { key: "support_tickets", label: "Destek Talepleri", icon: "help" },
      { key: "panel_designer", label: "Panel Tasarımı", icon: "palette" },
      { key: "settings", label: "Ayarlar", icon: "sliders" },
    ],
  },
];

export function navLabelForKey(key: string): string {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.key === key) return item.label;
    }
  }
  return key;
}
