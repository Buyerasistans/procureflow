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
      { key: "ai_lab", label: "AI Keşif Lab", icon: "lab", badge: "Beta" },
      // TODO(data): count'ı backend'den al
      { key: "discovery_lab_operations", label: "Discovery Lab Operasyonları", icon: "studio", count: 9 },
    ],
  },
  {
    label: "Operasyon",
    items: [
      // TODO(data): count'ları backend'den al
      { key: "platform_operations", label: "Platform Operasyonları", icon: "cog", count: 12 },
      { key: "onboarding_studio", label: "Kurulum Stüdyosu", icon: "studio", count: 7, alert: true },
      { key: "tenant_governance", label: "Stratejik Partner Yönetimi", icon: "partner", count: 42 },
      { key: "platform_suppliers", label: "Platform Tedarikçi Havuzu", icon: "supplier", count: 318 },
      { key: "deployment", label: "Yayınlama", icon: "rocket" },
    ],
  },
  {
    label: "Kariyer",
    items: [
      { key: "kariyer_yonetimi", label: "Kariyer ve İş Piyasası", icon: "briefcase" },
      { key: "talent_ecosystem", label: "Yetenek Ekosistemi", icon: "users" },
    ],
  },
  {
    label: "Ticari",
    items: [
      { key: "packages", label: "Paket ve Kullanım", icon: "package" },
      { key: "public_pricing", label: "Genel Fiyatlandırma", icon: "price" },
      { key: "campaigns", label: "Kampanyalar & Landing", icon: "megaphone" },
      // TODO(data): count'ları backend'den al
      { key: "channel_partners", label: "İş Ortakları (Kanal)", icon: "link", count: 3 },
      { key: "commission_admin", label: "Komisyon Yönetimi", icon: "wallet", count: 18 },
    ],
  },
  {
    label: "Yönetim",
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
      // TODO(data): count'ı backend'den al
      { key: "support_tickets", label: "Destek Talepleri", icon: "help", count: 3 },
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
