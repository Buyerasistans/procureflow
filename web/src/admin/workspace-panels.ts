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
      { label: "Tedarikçi Workspace", href: "/supplier/workspace?tab=offers", description: "Teklif, belge ve operasyon işlerinizi supplier workspace üzerinden yönetin." },
      { label: "Tedarikçi Dashboard", href: "/supplier/dashboard", description: "Tedarikçi özet ekranına gidin." },
      { label: "Finans Modülü", href: "/supplier/finance", description: "Finans ve ödeme özetlerini inceleyin." },
    ];
  }
  if (businessRole === "channel_owner" || businessRole === "channel_agent") {
    return [
      { label: "İş Ortağı Programı", href: "/is-ortagi-programi", description: "Kanal programı kapsamındaki akışları inceleyin." },
      { label: "Programa Başvuru", href: "/is-ortagi-basvuru", description: "Kanal / komisyon programı başvuru akışını açın." },
      { label: "Public Fiyatlandırma", href: "/fiyatlandirma", description: "Kanal teklif kurgusu için güncel planları görün." },
    ];
  }
  if (businessRole === "manager" || businessRole === "satinalma_direktoru") {
    return [
      { label: "Genel Bakış", href: "/dashboard", description: "Rol özetinizi ve anlık kartları görün." },
      { label: "Teklifler", href: "/quotes", description: "Teklif ve satın alma akışlarına gidin." },
      { label: "Raporlar", href: "/reports", description: "Rol bazlı raporları açın." },
    ];
  }
  if (
    businessRole === "ik_yoneticisi" ||
    businessRole === "ik_uzmani" ||
    businessRole === "hr_manager" ||
    businessRole === "hr_specialist"
  ) {
    return [
      { label: "İş İlanları", href: "/jobs", description: "Yayınladığınız ve açık iş ilanlarını yönetin." },
      { label: "Yeni İlan Oluştur", href: "/jobs/new", description: "Satın alma ve tedarik zinciri pozisyonu yayınlayın." },
      { label: "Kariyer Platformu", href: "/satin-alma-kariyerim", description: "Satın alma kariyer ekosistemini inceleyin." },
    ];
  }
  return [
    { label: "Genel Bakış", href: "/dashboard", description: "Genel çalışma alanına dönün." },
    { label: "Teklifler", href: "/quotes", description: "Teklif süreçlerini açın." },
    { label: "Raporlar", href: "/reports", description: "Yetkiniz varsa raporları inceleyin." },
  ];
}

export const WORKSPACE_PANEL_TAB_OPTIONS: Array<{
  key: WorkspacePanelTabKey;
  label: string;
}> = [
  { key: "panel_home", label: "Panel Ana Sayfa" },
  { key: "panel_designer", label: "Panel Tasarımı" },
  { key: "platform_overview", label: "Platform Genel Bakış" },
  { key: "platform_operations", label: "Platform Operasyonları" },
  { key: "discovery_lab_operations", label: "Discovery Lab Operasyonları" },
  { key: "onboarding_studio", label: "Kurulum Stüdyosu" },
  { key: "tenant_governance", label: "Stratejik Partner Yönetimi" },
  { key: "packages", label: "Paket ve Kullanım" },
  { key: "deployment", label: "Yayınlama" },
  { key: "platform_analytics", label: "Platform Analitikleri" },
  { key: "platform_suppliers", label: "Platform Tedarikçi Havuzu" },
  { key: "public_pricing", label: "Genel Fiyatlandırma" },
  { key: "campaigns", label: "Kampanyalar ve Landing" },
  { key: "commission_admin", label: "Komisyon Yönetimi" },
  { key: "companies", label: "Firmalar" },
  { key: "roles", label: "Roller ve Yetkiler" },
  { key: "departments", label: "Departmanlar" },
  { key: "personnel", label: "Ekip Üyeleri" },
  { key: "projects", label: "Projeler" },
  { key: "suppliers", label: "Tedarikçiler" },
  { key: "approvals", label: "Onay Akışları" },
  { key: "reports", label: "Raporlar" },
  { key: "settings", label: "Ayarlar" },
];

export const WORKSPACE_PANEL_MENU_STYLE_OPTIONS: Array<{
  key: "pill" | "accordion" | "drawer" | "tabs";
  label: string;
  description: string;
}> = [
  { key: "pill", label: "Rozet Menü", description: "Yuvarlak sekmelerle yatay menü." },
  { key: "accordion", label: "Açılır/Kapanır Menü", description: "Başlıklara göre açılan panel menüsü." },
  { key: "drawer", label: "Yandan Çekmece Menüsü", description: "Mobil uyumlu soldan açılan menü." },
  { key: "tabs", label: "Klasik Sekme Menüsü", description: "Basit ve net sekme navigasyonu." },
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
      description: "Platform genelindeki tüm yönetim alanları, tenant governance ve panel tasarımı bu panelden yönetilir.",
      hero_title: "Super Admin Paneli - Platform Kontrol Merkezi",
      hero_description: "Platform operasyonları, stratejik partner geçişi, rol panelleri ve global ayarlar bu panel altında birleştirilir.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "packages", "deployment", "platform_analytics", "platform_suppliers", "public_pricing", "campaigns", "commission_admin", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings", "panel_designer"],
      quick_links: defaultQuickLinksForBusinessRole("super_admin"),
    },
    {
      business_role: "admin",
      system_role: "tenant_owner",
      title: "Stratejik Partner Admin Paneli",
      nav_label: "Ortak Admin",
      workspace_label: "Stratejik Partner Sahiplik Alanı",
      description: "Tenant sahipliği, organizasyon omurgası ve yönetsel operasyonlar için ayrı panel profili.",
      hero_title: "Stratejik Partner Admin Paneli",
      hero_description: "Firma, ekip üyesi, rol, proje ve tedarikçi operasyonlarını tenant odaklı olarak yönetin.",
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("admin"),
    },
    {
      business_role: "admin",
      system_role: "tenant_admin",
      title: "Admin Paneli",
      nav_label: "Admin",
      workspace_label: "Tenant Yönetim Alanı",
      description: "Geleneksel tenant admin çalışma alanı; ekip üyesi, rol ve operasyon sekmeleri bu profilde toplanıyor.",
      hero_title: "Admin Paneli - Tenant Yönetim Alanı",
      hero_description: "Kendi tenant yapınızın ekip üyesi, rol, departman ve operasyon alanlarını yönetin.",
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("admin"),
    },
    {
      business_role: "platform_support",
      system_role: "platform_support",
      title: "Platform Destek Paneli",
      nav_label: "Platform Destek",
      workspace_label: "Platform Destek Alanı",
      description: "Platform destek ekipleri için ayrılmış operasyon ve governance paneli.",
      hero_title: "Platform Destek Paneli",
      hero_description: "Destek kuyrukları, tenant governance ve discovery odaklarını destek perspektifinden yönetin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("platform_support"),
    },
    {
      business_role: "platform_operator",
      system_role: "platform_operator",
      title: "Platform Operasyon Paneli",
      nav_label: "Platform Ops",
      workspace_label: "Platform Operasyon Alanı",
      description: "Platform operasyon ekipleri için ayrılmış tenant ve destek koordinasyon paneli.",
      hero_title: "Platform Operasyon Paneli",
      hero_description: "Operasyon kuyruklarını, tenant akışlarını ve sorun yönetimini platform operasyon perspektifinden yönetin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("platform_operator"),
    },
    {
      business_role: "manager",
      system_role: "tenant_member",
      title: "Yönetici Paneli",
      nav_label: "Yönetici",
      workspace_label: "Yönetici Çalışma Alanı",
      description: "Yönetici rolüne ait ayrı panel; varsayılan olarak özet ve yönlendirme ekranlarını içerir.",
      hero_title: "Yönetici Paneli",
      hero_description: "Ekibinizin onay, teklif ve operasyon akışlarına bu panelden yönlenin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("manager"),
    },
    {
      business_role: "satinalma_direktoru",
      system_role: "tenant_member",
      title: "Satın Alma Direktörü Paneli",
      nav_label: "Direktör",
      workspace_label: "Satin Alma Liderlik Alanı",
      description: "Satin alma direktörlüğü için ayrı panel; varsayılan olarak özet ve yönlendirme deneyimi sunar.",
      hero_title: "Satın Alma Direktörü Paneli",
      hero_description: "Onay, karsilastirma ve teklif akışlarına yönelik liderlik bakışını bu panelden yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("satinalma_direktoru"),
    },
    {
      business_role: "channel_owner",
      system_role: "tenant_member",
      title: "Kanal Sahibi Paneli",
      nav_label: "Kanal Sahibi",
      workspace_label: "Kanal Partner Alanı",
      description: "Kanal hesap sahibine özel panel; yönlendirme ve rol bazli gelecekteki sekme aktivasyonları için hazır.",
      hero_title: "Kanal Sahibi Paneli",
      hero_description: "Kanal programı, partner yönlendirmeleri ve panel erişimleri bu profilden yönetilir.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("channel_owner"),
    },
    {
      business_role: "channel_agent",
      system_role: "tenant_member",
      title: "Kanal Temsilcisi Paneli",
      nav_label: "Kanal Temsilcisi",
      workspace_label: "Kanal Operasyon Alanı",
      description: "Kanal temsilcileri için ayrı panel; varsayilan olarak yönlendirme kartlari gosterir.",
      hero_title: "Kanal Temsilcisi Paneli",
      hero_description: "Kanal operasyonları ve partner kazanımı akışlarına bu panelden ilerleyin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("channel_agent"),
    },
    {
      business_role: "supplier_admin",
      system_role: "supplier_user",
      title: "Tedarikçi Yönetici Paneli",
      nav_label: "Tedarikçi Yöneticisi",
      workspace_label: "Tedarikçi Yönetim Alanı",
      description: "Tedarikçi yöneticileri için ayrı panel; tedarikçi workspace ve finans modüllerine yönlendirme sunar.",
      hero_title: "Tedarikçi Yönetici Paneli",
      hero_description: "Tedarikçi ekibinizin teklif, belge ve finans akışlarını bu panelden yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("supplier_admin"),
    },
    {
      business_role: "supplier_user",
      system_role: "supplier_user",
      title: "Tedarikçi Kullanıcı Paneli",
      nav_label: "Tedarikçi",
      workspace_label: "Tedarikçi Çalışma Alanı",
      description: "Tedarikçi kullanıcılarına özel panel; rol odaklı yönlendirme ve kısıtlı panel kapsamı sunar.",
      hero_title: "Tedarikçi Kullanıcı Paneli",
      hero_description: "Kendi teklif, belge ve iş akışınızı tedarikçi panelinden takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("supplier_user"),
    },
    // ── İK Rolleri ──────────────────────────────────────────────────────────
    {
      business_role: "ik_yoneticisi",
      system_role: "tenant_member",
      title: "İK Yöneticisi Paneli",
      nav_label: "İK Yöneticisi",
      workspace_label: "İnsan Kaynakları Çalışma Alanı",
      description: "İK yöneticileri için kariyer modülü, iş ilanı yönetimi ve operasyon beslemesi.",
      hero_title: "İK Yöneticisi Paneli",
      hero_description: "Satın alma ve tedarik zinciri pozisyonları için iş ilanı oluşturun, yönetin ve kariyer ekosistemini takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ik_yoneticisi"),
    },
    {
      business_role: "ik_uzmani",
      system_role: "tenant_member",
      title: "İK Uzmanı Paneli",
      nav_label: "İK Uzmanı",
      workspace_label: "İnsan Kaynakları Uzman Alanı",
      description: "İK uzmanları için temel kariyer modülü erişimi ve iş ilanı görünümü.",
      hero_title: "İK Uzmanı Paneli",
      hero_description: "Kariyer ilanlarınızı inceleyin ve satın alma pozisyonlarına başvuruları takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ik_uzmani"),
    },
    {
      business_role: "hr_manager",
      system_role: "tenant_member",
      title: "HR Manager Panel",
      nav_label: "HR Manager",
      workspace_label: "Human Resources Workspace",
      description: "HR Manager için kariyer modülü ve iş ilanı yönetimi.",
      hero_title: "HR Manager Panel",
      hero_description: "Post and manage procurement job listings through the career module.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("hr_manager"),
    },
    {
      business_role: "hr_specialist",
      system_role: "tenant_member",
      title: "HR Specialist Panel",
      nav_label: "HR Specialist",
      workspace_label: "Human Resources Specialist Area",
      description: "HR Specialist için temel kariyer erişimi.",
      hero_title: "HR Specialist Panel",
      hero_description: "View and manage procurement career listings.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("hr_specialist"),
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
  { icon: "GUV", label: "Güvenlik" },
  { icon: "WEB", label: "Küre" },
  { icon: "RKT", label: "Roket" },
  { icon: "KLS", label: "Klasör" },
  { icon: "PIN", label: "Sabitle" },
  { icon: "MAP", label: "Harita" },
  { icon: "ANN", label: "Duyuru" },
  { icon: "BLD", label: "Bildirim" },
  { icon: "BLG", label: "Belge" },
  { icon: "ETK", label: "Etiket" },
  { icon: "ARC", label: "Araç" },
  { icon: "TAK", label: "Takım" },
  { icon: "YLD", label: "Yıldız" },
  { icon: "OK", label: "Onay" },
];

export const ACCENT_COLOR_PRESETS: Array<{ color: string; label: string }> = [
  { color: "#0f172a", label: "Gece Mavisi" },
  { color: "#0d9488", label: "Zümrüt" },
  { color: "#6366f1", label: "Indigo" },
  { color: "#f59e0b", label: "Kehribar" },
  { color: "#dc2626", label: "Kırmızı" },
  { color: "#2563eb", label: "Mavi" },
  { color: "#7c3aed", label: "Mor" },
  { color: "#059669", label: "Yeşil" },
  { color: "#d97706", label: "Turuncu" },
  { color: "#0891b2", label: "Camgöbeği" },
  { color: "#64748b", label: "Gri" },
  { color: "#be123c", label: "Şarap" },
  { color: "#16a34a", label: "Canli Yeşil" },
  { color: "#06b6d4", label: "Turkuaz" },
  { color: "#fb7185", label: "Rose" },
  { color: "#84cc16", label: "Lime" },
  { color: "#f97316", label: "Ateş" },
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
