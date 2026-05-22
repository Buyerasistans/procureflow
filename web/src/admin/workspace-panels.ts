import type { AuthUser } from "../context/auth-types";
import type { WorkspacePanelConfig, WorkspacePanelProfile } from "../services/admin.service";

export type WorkspacePanelTabKey =
  | "panel_home"
  | "panel_designer"
  | "platform_overview"
  | "platform_operations"
  | "discovery_lab_operations"
  | "onboarding_studio"
  | "tenant_governance"
  | "packages"
  | "deployment"
  | "platform_analytics"
  | "platform_suppliers"
  | "public_pricing"
  | "campaigns"
  | "commission_admin"
  | "companies"
  | "roles"
  | "departments"
  | "personnel"
  | "projects"
  | "suppliers"
  | "approvals"
  | "reports"
  | "settings";

export type WorkspacePanelQuickLink = {
  label: string;
  href: string;
  description: string;
};

export type WorkspacePanelTheme = {
  accentGradient: string;
  headerBgColor: string | null;
  headerTextColor: string | null;
  footerBgColor: string | null;
  footerTextColor: string | null;
  heroTextColor: string | null;
  heroMutedTextColor: string | null;
  topNotice: string | null;
  headerInfo: string | null;
  footerInfo: string | null;
};

function defaultQuickLinksForBusinessRole(businessRole: string): WorkspacePanelQuickLink[] {
  if (businessRole === "supplier_admin" || businessRole === "supplier_user") {
    return [
      { label: "Tedarikci Workspace", href: "/supplier/workspace?tab=offers", description: "Teklif, belge ve operasyon islerinizi supplier workspace uzerinden yonetin." },
      { label: "Tedarikci Dashboard", href: "/supplier/dashboard", description: "Tedarikci ozet ekranina gidin." },
      { label: "Finans Modulu", href: "/supplier/finance", description: "Finans ve odeme ozetlerini inceleyin." },
    ];
  }
  if (businessRole === "channel_owner" || businessRole === "channel_agent") {
    return [
      { label: "Is Ortagi Programi", href: "/is-ortagi-programi", description: "Kanal programi kapsamindaki akislari inceleyin." },
      { label: "Programa Basvuru", href: "/is-ortagi-basvuru", description: "Kanal / komisyon programi basvuru akisini acin." },
      { label: "Public Fiyatlandirma", href: "/fiyatlandirma", description: "Kanal teklif kurgusu icin guncel planlari gorun." },
    ];
  }
  if (businessRole === "manager" || businessRole === "satinalma_direktoru") {
    return [
      { label: "Genel Bakis", href: "/dashboard", description: "Rol ozetinizi ve anlik kartlari gorun." },
      { label: "Teklifler", href: "/quotes", description: "Teklif ve satin alma akislarina gidin." },
      { label: "Raporlar", href: "/reports", description: "Rol bazli raporlari acin." },
    ];
  }
  return [
    { label: "Genel Bakis", href: "/dashboard", description: "Genel calisma alanina donun." },
    { label: "Teklifler", href: "/quotes", description: "Teklif sureclerini acin." },
    { label: "Raporlar", href: "/reports", description: "Yetkiniz varsa raporlari inceleyin." },
  ];
}

export const WORKSPACE_PANEL_TAB_OPTIONS: Array<{
  key: WorkspacePanelTabKey;
  label: string;
}> = [
  { key: "panel_home", label: "Panel Ana Sayfa" },
  { key: "panel_designer", label: "Panel Tasarimi" },
  { key: "platform_overview", label: "Platform Genel Bakis" },
  { key: "platform_operations", label: "Platform Operasyonlari" },
  { key: "discovery_lab_operations", label: "Discovery Lab Operasyonlari" },
  { key: "onboarding_studio", label: "Kurulum Studyosu" },
  { key: "tenant_governance", label: "Stratejik Partner Yonetimi" },
  { key: "packages", label: "Paket ve Kullanim" },
  { key: "deployment", label: "Yayinlama" },
  { key: "platform_analytics", label: "Platform Analitikleri" },
  { key: "platform_suppliers", label: "Platform Tedarikci Havuzu" },
  { key: "public_pricing", label: "Genel Fiyatlandirma" },
  { key: "campaigns", label: "Kampanyalar ve Landing" },
  { key: "commission_admin", label: "Komisyon Yonetimi" },
  { key: "companies", label: "Firmalar" },
  { key: "roles", label: "Roller ve Yetkiler" },
  { key: "departments", label: "Departmanlar" },
  { key: "personnel", label: "Ekip Uyeleri" },
  { key: "projects", label: "Projeler" },
  { key: "suppliers", label: "Tedarikciler" },
  { key: "approvals", label: "Onay Akislari" },
  { key: "reports", label: "Raporlar" },
  { key: "settings", label: "Ayarlar" },
];

export const WORKSPACE_PANEL_MENU_STYLE_OPTIONS: Array<{
  key: "pill" | "accordion" | "drawer" | "tabs";
  label: string;
  description: string;
}> = [
  { key: "pill", label: "Rozet Menu", description: "Yuvarlak sekmelerle yatay menu." },
  { key: "accordion", label: "Acilir/Kapanir Menu", description: "Basliklara gore acilan panel menusu." },
  { key: "drawer", label: "Yandan Cekmece Menusu", description: "Mobil uyumlu soldan acilan menu." },
  { key: "tabs", label: "Klasik Sekme Menusu", description: "Basit ve net sekme navigasyonu." },
];

export const WORKSPACE_PANEL_DATA_TABS = new Set<WorkspacePanelTabKey>([
  "platform_overview",
  "platform_operations",
  "discovery_lab_operations",
  "onboarding_studio",
  "tenant_governance",
  "packages",
  "deployment",
  "platform_analytics",
  "platform_suppliers",
  "public_pricing",
  "campaigns",
  "companies",
  "roles",
  "departments",
  "personnel",
]);

function normalize(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function buildWorkspacePanelProfileKey(profile: Pick<WorkspacePanelProfile, "business_role" | "system_role">): string {
  return `${normalize(profile.business_role)}:${normalize(profile.system_role)}`;
}

export function buildWorkspacePanelProfileKeyFromParts(businessRole?: string | null, systemRole?: string | null): string {
  return `${normalize(businessRole)}:${normalize(systemRole)}`;
}

export const DEFAULT_WORKSPACE_PANEL_CONFIG: WorkspacePanelConfig = {
  version: 1,
  user_overrides: [],
  profiles: [
    {
      business_role: "super_admin",
      system_role: "super_admin",
      title: "Super Admin Paneli",
      nav_label: "Super Admin",
      workspace_label: "Platform Kontrol Merkezi",
      description: "Platform genelindeki tum yonetim alanlari, tenant governance ve panel tasarimi bu panelden yonetilir.",
      hero_title: "Super Admin Paneli - Platform Kontrol Merkezi",
      hero_description: "Platform operasyonlari, stratejik partner gecisi, rol panelleri ve global ayarlar bu panel altinda birlestirilir.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "packages", "deployment", "platform_analytics", "platform_suppliers", "public_pricing", "campaigns", "commission_admin", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings", "panel_designer"],
      quick_links: defaultQuickLinksForBusinessRole("super_admin"),
    },
    {
      business_role: "admin",
      system_role: "tenant_owner",
      title: "Stratejik Partner Admin Paneli",
      nav_label: "Ortak Admin",
      workspace_label: "Stratejik Partner Sahiplik Alani",
      description: "Tenant sahipligi, organizasyon omurgasi ve yonetsel operasyonlar icin ayri panel profili.",
      hero_title: "Stratejik Partner Admin Paneli",
      hero_description: "Firma, ekip uyesi, rol, proje ve tedarikci operasyonlarini tenant odakli olarak yonetin.",
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("admin"),
    },
    {
      business_role: "admin",
      system_role: "tenant_admin",
      title: "Admin Paneli",
      nav_label: "Admin",
      workspace_label: "Tenant Yonetim Alani",
      description: "Geleneksel tenant admin calisma alani; ekip uyesi, rol ve operasyon sekmeleri bu profilde toplaniyor.",
      hero_title: "Admin Paneli - Tenant Yonetim Alani",
      hero_description: "Kendi tenant yapinizin ekip uyesi, rol, departman ve operasyon alanlarini yonetin.",
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("admin"),
    },
    {
      business_role: "platform_support",
      system_role: "platform_support",
      title: "Platform Destek Paneli",
      nav_label: "Platform Destek",
      workspace_label: "Platform Destek Alani",
      description: "Platform destek ekipleri icin ayrilmis operasyon ve governance paneli.",
      hero_title: "Platform Destek Paneli",
      hero_description: "Destek kuyruklari, tenant governance ve discovery odaklarini destek perspektifinden yonetin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("platform_support"),
    },
    {
      business_role: "platform_operator",
      system_role: "platform_operator",
      title: "Platform Operasyon Paneli",
      nav_label: "Platform Ops",
      workspace_label: "Platform Operasyon Alani",
      description: "Platform operasyon ekipleri icin ayrilmis tenant ve destek koordinasyon paneli.",
      hero_title: "Platform Operasyon Paneli",
      hero_description: "Operasyon kuyruklarini, tenant akislarini ve sorun yonetimini platform operasyon perspektifinden yonetin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("platform_operator"),
    },
    {
      business_role: "manager",
      system_role: "tenant_member",
      title: "Yonetici Paneli",
      nav_label: "Yonetici",
      workspace_label: "Yonetici Calisma Alani",
      description: "Yonetici rolune ait ayri panel; varsayilan olarak ozet ve yonlendirme ekranlarini icerir.",
      hero_title: "Yonetici Paneli",
      hero_description: "Ekibinizin onay, teklif ve operasyon akislarina bu panelden yonlenin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("manager"),
    },
    {
      business_role: "satinalma_direktoru",
      system_role: "tenant_member",
      title: "Satin Alma Direktoru Paneli",
      nav_label: "Direktor",
      workspace_label: "Satin Alma Liderlik Alani",
      description: "Satin alma direktorlugu icin ayri panel; varsayilan olarak ozet ve yonlendirme deneyimi sunar.",
      hero_title: "Satin Alma Direktoru Paneli",
      hero_description: "Onay, karsilastirma ve teklif akislarina yonelik liderlik bakisini bu panelden yonetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("satinalma_direktoru"),
    },
    {
      business_role: "channel_owner",
      system_role: "tenant_member",
      title: "Kanal Sahibi Paneli",
      nav_label: "Kanal Sahibi",
      workspace_label: "Kanal Partner Alani",
      description: "Kanal hesap sahibine ozel panel; yonlendirme ve rol bazli gelecekteki sekme aktivasyonlari icin hazir.",
      hero_title: "Kanal Sahibi Paneli",
      hero_description: "Kanal programi, partner yonlendirmeleri ve panel erisimleri bu profilden yonetilir.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("channel_owner"),
    },
    {
      business_role: "channel_agent",
      system_role: "tenant_member",
      title: "Kanal Temsilcisi Paneli",
      nav_label: "Kanal Temsilcisi",
      workspace_label: "Kanal Operasyon Alani",
      description: "Kanal temsilcileri icin ayri panel; varsayilan olarak yonlendirme kartlari gosterir.",
      hero_title: "Kanal Temsilcisi Paneli",
      hero_description: "Kanal operasyonlari ve partner kazanimi akislarina bu panelden ilerleyin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("channel_agent"),
    },
    {
      business_role: "supplier_admin",
      system_role: "supplier_user",
      title: "Tedarikci Yonetici Paneli",
      nav_label: "Tedarikci Yoneticisi",
      workspace_label: "Tedarikci Yonetim Alani",
      description: "Tedarikci yoneticileri icin ayri panel; tedarikci workspace ve finans modullerine yonlendirme sunar.",
      hero_title: "Tedarikci Yonetici Paneli",
      hero_description: "Tedarikci ekibinizin teklif, belge ve finans akislarini bu panelden yonetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("supplier_admin"),
    },
    {
      business_role: "supplier_user",
      system_role: "supplier_user",
      title: "Tedarikci Kullanici Paneli",
      nav_label: "Tedarikci",
      workspace_label: "Tedarikci Calisma Alani",
      description: "Tedarikci kullanicilarina ozel panel; rol odakli yonlendirme ve kisitli panel kapsami sunar.",
      hero_title: "Tedarikci Kullanici Paneli",
      hero_description: "Kendi teklif, belge ve is akisinizi tedarikci panelinden takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("supplier_user"),
    },
  ],
};

export function mergeWorkspacePanelConfig(config?: WorkspacePanelConfig | null): WorkspacePanelConfig {
  const merged = new Map<string, WorkspacePanelProfile>();
  DEFAULT_WORKSPACE_PANEL_CONFIG.profiles.forEach((item) => {
    merged.set(buildWorkspacePanelProfileKey(item), item);
  });
  (config?.profiles || []).forEach((item) => {
    const key = buildWorkspacePanelProfileKey(item);
    const defaultProfile = merged.get(key);
    const storedTabs = (item.allowed_tabs || []).map((tab) => normalize(tab)).filter(Boolean);
    const defaultTabs = (defaultProfile?.allowed_tabs || []).map((tab) => normalize(tab)).filter(Boolean);
    // Union: stored tabs + any new default tabs not present in stored config
    // This ensures tabs added to defaults after a profile was saved are automatically included.
    const mergedTabs = Array.from(new Set([...storedTabs, ...defaultTabs]));
    merged.set(key, {
      ...item,
      business_role: normalize(item.business_role),
      system_role: normalize(item.system_role) || null,
      allowed_tabs: mergedTabs,
      quick_links: (item.quick_links || []).filter((link) => link.label && link.href && link.description),
    });
  });
  const userOverrides = (config?.user_overrides || [])
    .map((item) => ({
      user_id: typeof item.user_id === "number" ? item.user_id : null,
      user_email: normalize(item.user_email) || null,
      profile_key: normalize(item.profile_key),
      note: item.note || null,
    }))
    .filter((item) => item.profile_key);
  return {
    version: config?.version || 1,
    profiles: Array.from(merged.values()),
    user_overrides: userOverrides,
  };
}

export function resolveWorkspacePanelProfile(
  user: AuthUser | null | undefined,
  config?: WorkspacePanelConfig | null,
): WorkspacePanelProfile | null {
  if (!user) return null;
  const merged = mergeWorkspacePanelConfig(config);
  const businessRole = normalize(user.business_role || user.role);
  const systemRole = normalize(user.system_role);
  const userId = typeof user.id === "number" ? user.id : null;
  const userEmail = normalize(user.email);
  const override = (merged.user_overrides || []).find((item) => {
    if (item.user_id != null && userId != null && item.user_id === userId) return true;
    if (item.user_email && userEmail && item.user_email === userEmail) return true;
    return false;
  });
  if (override?.profile_key) {
    const overrideProfile = merged.profiles.find((item) => buildWorkspacePanelProfileKey(item) === override.profile_key);
    if (overrideProfile) return overrideProfile;
  }
  return (
    merged.profiles.find((item) => normalize(item.business_role) === businessRole && normalize(item.system_role) === systemRole)
    || merged.profiles.find((item) => normalize(item.business_role) === businessRole && !normalize(item.system_role))
    || null
  );
}

export function getWorkspacePanelQuickLinks(
  profile: WorkspacePanelProfile | null,
): WorkspacePanelQuickLink[] {
  const businessRole = normalize(profile?.business_role);
  const configured = (profile?.quick_links || []).filter((link) => link.label && link.href && link.description);
  return configured.length > 0 ? configured : defaultQuickLinksForBusinessRole(businessRole);
}

export const ROLE_ICON_PRESETS: Array<{ icon: string; label: string }> = [
  { icon: "BIN", label: "Bina" },
  { icon: "AYR", label: "Ayar" },
  { icon: "GRF", label: "Grafik" },
  { icon: "SPT", label: "Sepet" },
  { icon: "ORT", label: "Ortak" },
  { icon: "KUT", label: "Kutu" },
  { icon: "FBR", label: "Fabrika" },
  { icon: "HDF", label: "Hedef" },
  { icon: "DOS", label: "Dosya" },
  { icon: "KEY", label: "Anahtar" },
  { icon: "GUV", label: "Guvenlik" },
  { icon: "WEB", label: "Kure" },
  { icon: "RKT", label: "Roket" },
  { icon: "KLS", label: "Klasor" },
  { icon: "PIN", label: "Sabitle" },
  { icon: "MAP", label: "Harita" },
  { icon: "ANN", label: "Duyuru" },
  { icon: "BLD", label: "Bildirim" },
  { icon: "BLG", label: "Belge" },
  { icon: "ETK", label: "Etiket" },
  { icon: "ARC", label: "Arac" },
  { icon: "TAK", label: "Takim" },
  { icon: "YLD", label: "Yildiz" },
  { icon: "OK", label: "Onay" },
];

export const ACCENT_COLOR_PRESETS: Array<{ color: string; label: string }> = [
  { color: "#0f172a", label: "Gece Mavisi" },
  { color: "#0d9488", label: "Zumrut" },
  { color: "#6366f1", label: "Indigo" },
  { color: "#f59e0b", label: "Kehribar" },
  { color: "#dc2626", label: "Kirmizi" },
  { color: "#2563eb", label: "Mavi" },
  { color: "#7c3aed", label: "Mor" },
  { color: "#059669", label: "Yesil" },
  { color: "#d97706", label: "Turuncu" },
  { color: "#0891b2", label: "Camgobegi" },
  { color: "#64748b", label: "Gri" },
  { color: "#be123c", label: "Sarap" },
  { color: "#16a34a", label: "Canli Yesil" },
  { color: "#06b6d4", label: "Turkuaz" },
  { color: "#fb7185", label: "Rose" },
  { color: "#84cc16", label: "Lime" },
  { color: "#f97316", label: "Ates" },
  { color: "#3b82f6", label: "Elektrik Mavi" },
];

export function defaultIconForBusinessRole(businessRole: string): string {
  const role = normalize(businessRole);
  if (role === "super_admin" || role === "platform_support" || role === "platform_operator") return "WEB";
  if (role === "admin") return "BIN";
  if (role === "manager" || role === "satinalma_direktoru") return "DOS";
  if (role === "channel_owner" || role === "channel_agent") return "ORT";
  if (role === "supplier_admin" || role === "supplier_user") return "KUT";
  return "HDF";
}

export function defaultAccentColorForBusinessRole(businessRole: string): string {
  const role = normalize(businessRole);
  if (role === "super_admin" || role === "platform_support" || role === "platform_operator") return "#0f172a";
  if (role === "admin") return "#2563eb";
  if (role === "manager" || role === "satinalma_direktoru") return "#f59e0b";
  if (role === "channel_owner" || role === "channel_agent") return "#6366f1";
  if (role === "supplier_admin" || role === "supplier_user") return "#0d9488";
  return "#64748b";
}

export function resolvedIcon(profile: WorkspacePanelProfile | null): string {
  return profile?.icon || defaultIconForBusinessRole(profile?.business_role || "");
}

export function resolvedAccentColor(profile: WorkspacePanelProfile | null): string {
  return profile?.accent_color || defaultAccentColorForBusinessRole(profile?.business_role || "");
}

export function buildWorkspacePanelTheme(profile: WorkspacePanelProfile | null): WorkspacePanelTheme {
  const accentColor = resolvedAccentColor(profile);
  const secondary = profile?.secondary_accent_color && /^#[0-9A-Fa-f]{6}$/.test(profile.secondary_accent_color)
    ? profile.secondary_accent_color
    : null;
  const opacity = normalizeRange(profile?.accent_opacity, 0.2, 1, 0.85);
  const secondaryOpacity = normalizeRange(profile?.secondary_accent_opacity, 0.2, 1, 0.7);
  const primaryStop = normalizeRange(profile?.primary_accent_stop, 20, 80, 48);
  const secondaryStart = normalizeRange(profile?.secondary_accent_start, 40, 100, 72);
  const accentGradient = secondary
    ? `linear-gradient(95deg, ${hexToRgba(accentColor, opacity)} 0%, ${hexToRgba(accentColor, opacity)} ${primaryStop}%, ${hexToRgba(secondary, secondaryOpacity)} ${secondaryStart}%, ${hexToRgba(secondary, Math.max(0.22, secondaryOpacity - 0.2))} 100%)`
    : `linear-gradient(95deg, ${hexToRgba(accentColor, opacity)} 0%, ${hexToRgba(accentColor, Math.max(0.25, opacity - 0.18))} 100%)`;
  return {
    accentGradient,
    headerBgColor: profile?.header_bg_color || null,
    headerTextColor: profile?.header_text_color || null,
    footerBgColor: profile?.footer_bg_color || null,
    footerTextColor: profile?.footer_text_color || null,
    heroTextColor: profile?.hero_text_color || profile?.header_text_color || null,
    heroMutedTextColor: profile?.hero_muted_text_color || profile?.footer_text_color || null,
    topNotice: profile?.top_notice || null,
    headerInfo: profile?.header_info || null,
    footerInfo: profile?.footer_info || null,
  };
}

function normalizeRange(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return `rgba(15, 23, 42, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
