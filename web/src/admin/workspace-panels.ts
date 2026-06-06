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
  | "kariyer_yonetimi"
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
  // ── Tedarikçi ──────────────────────────────────────────────────────────────
  if (
    businessRole === "supplier_admin" || businessRole === "supplier_user" ||
    businessRole === "pazarlama_muduru" || businessRole === "pazarlama_mudur_yrd" ||
    businessRole === "pazarlama_yoneticisi" || businessRole === "pazarlama_kidemli_uzmani" ||
    businessRole === "pazarlama_uzmani" || businessRole === "teknik_uzman_mimar" ||
    businessRole === "teklif_uzmani" || businessRole === "ozel_tedarikci_rolu" ||
    businessRole === "tedarikci_finans_izleyici"
  ) {
    return [
      { label: "Tedarikçi Workspace", href: "/supplier/workspace?tab=offers", description: "Teklif, belge ve operasyon işlerinizi supplier workspace üzerinden yönetin." },
      { label: "Tedarikçi Dashboard", href: "/supplier/dashboard", description: "Tedarikçi özet ekranına gidin." },
      { label: "Finans Modülü", href: "/supplier/finance", description: "Finans ve ödeme özetlerini inceleyin." },
    ];
  }
  // ── Kanal / İş Ortağı ─────────────────────────────────────────────────────
  if (
    businessRole === "channel_owner" || businessRole === "kanal_ekip_lideri" ||
    businessRole === "channel_agent" || businessRole === "kanal_finans" ||
    businessRole === "ozel_kanal_rolu"
  ) {
    return [
      { label: "İş Ortağı Programı", href: "/is-ortagi-programi", description: "Kanal programı kapsamındaki akışları inceleyin." },
      { label: "Programa Başvuru", href: "/is-ortagi-basvuru", description: "Kanal / komisyon programı başvuru akışını açın." },
      { label: "Public Fiyatlandırma", href: "/fiyatlandirma", description: "Kanal teklif kurgusu için güncel planları görün." },
    ];
  }
  // ── Satın Alma Liderlik (Direktör/Müdür) ────────────────────────────────
  if (
    businessRole === "manager" || businessRole === "satinalma_direktoru" ||
    businessRole === "satinalma_muduru" || businessRole === "satinalma_mudur_yrd"
  ) {
    return [
      { label: "Genel Bakış", href: "/dashboard", description: "Rol özetinizi ve anlık kartları görün." },
      { label: "Teklifler", href: "/quotes", description: "Teklif ve satın alma akışlarına gidin." },
      { label: "Raporlar", href: "/reports", description: "Rol bazlı raporları açın." },
    ];
  }
  // ── Satın Alma Uzman / Operasyon ─────────────────────────────────────────
  if (
    businessRole === "satinalma_yoneticisi" || businessRole === "satinalma_kidemli_uzmani" ||
    businessRole === "satinalma_uzman_yrd" || businessRole === "satinalma_uzmani" ||
    businessRole === "satinalmaci" || businessRole === "proje_mimari" ||
    businessRole === "teknik_uzman" || businessRole === "ozel_partner_rolu" ||
    businessRole === "finans_izleyici"
  ) {
    return [
      { label: "Genel Bakış", href: "/dashboard", description: "Genel çalışma alanına dönün." },
      { label: "Teklifler", href: "/quotes", description: "Teklif süreçlerini açın." },
    ];
  }
  // ── İK Rolleri (tüm tenant tipleri) ─────────────────────────────────────
  if (
    businessRole === "ik_yoneticisi" || businessRole === "ik_uzmani" ||
    businessRole === "hr_manager" || businessRole === "hr_specialist"
  ) {
    return [
      { label: "İş İlanları", href: "/jobs", description: "Yayınladığınız ve açık iş ilanlarını yönetin." },
      { label: "Yeni İlan Oluştur", href: "/jobs/new", description: "Satın alma ve tedarik zinciri pozisyonu yayınlayın." },
      { label: "Kariyer Platformu", href: "/satin-alma-kariyerim", description: "Satın alma kariyer ekosistemini inceleyin." },
    ];
  }
  // ── Platform İK Admin ────────────────────────────────────────────────────
  if (businessRole === "ik_admin") {
    return [
      { label: "Kariyer Yönetimi", href: "/admin?tab=kariyer_yonetimi", description: "İş ilanlarını ve aday profillerini yönetin." },
      { label: "İş İlanları", href: "/jobs", description: "Tüm iş ilanlarını görüntüleyin." },
      { label: "Talent Ekosistemi", href: "/admin/talent-ecosystem", description: "Talent ve aday kayıtlarını yönetin." },
    ];
  }
  // ── Stratejik Partner Admin ───────────────────────────────────────────
  if (businessRole === "partner_admin") {
    return [
      { label: "Firmalar", href: "/admin?tab=companies", description: "Tenant firmaları ve organizasyon yapısını yönetin." },
      { label: "Ekip Üyeleri", href: "/admin?tab=personnel", description: "Kullanıcıları, rolleri ve ekip üyelerini yönetin." },
      { label: "Projeler", href: "/admin?tab=projects", description: "Aktif projeler ve atamalar." },
    ];
  }
  // ── İşveren / Kariyer Rolleri ────────────────────────────────────────────
  if (businessRole === "employer_company_admin" || businessRole === "employer_recruiter") {
    return [
      { label: "İş İlanları", href: "/jobs", description: "Yayınladığınız iş ilanlarını yönetin." },
      { label: "Yeni İlan Oluştur", href: "/jobs/new", description: "Yeni bir pozisyon ilanı oluşturun." },
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
  { key: "kariyer_yonetimi", label: "Kariyer ve İş Piyasası" },
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
  "kariyer_yonetimi",
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
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "packages", "deployment", "platform_analytics", "platform_suppliers", "public_pricing", "campaigns", "commission_admin", "kariyer_yonetimi", "companies", "roles", "departments", "personnel", "projects", "suppliers", "approvals", "reports", "settings", "panel_designer"],
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
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "supplier_profile", "approvals", "reports", "settings"],
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
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "supplier_profile", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("admin"),
    },
    {
      business_role: "partner_admin",
      system_role: "tenant_admin",
      title: "Stratejik Partner Admin Paneli",
      nav_label: "Partner Admin",
      workspace_label: "Stratejik Partner Yönetim Alanı",
      description: "Stratejik partner admin rolü için firma, ekip, proje ve tedarikçi yönetim alanı.",
      hero_title: "Stratejik Partner Admin Paneli",
      hero_description: "Firma, ekip üyesi, rol, proje ve tedarikçi operasyonlarını stratejik partner olarak yönetin.",
      allowed_tabs: ["panel_home", "companies", "roles", "departments", "personnel", "projects", "suppliers", "supplier_profile", "approvals", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("partner_admin"),
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
      workspace_label: "Satın Alma Liderlik Alanı",
      description: "Satın alma direktörü için organizasyon genel bakışı, onay yönetimi ve raporlama alanı.",
      hero_title: "Satın Alma Direktörü Paneli",
      hero_description: "Organizasyon yapısını, ekip operasyonlarını, onay akışlarını ve performans raporlarını direktör perspektifinden yönetin.",
      allowed_tabs: ["panel_home", "companies", "personnel", "projects", "suppliers", "supplier_profile", "approvals", "reports"],
      quick_links: [
        { label: "Onay Akışları", href: "/admin?tab=approvals", description: "Bekleyen onayları ve satın alma taleplerinizi yönetin." },
        { label: "Projeler", href: "/admin?tab=projects", description: "Aktif projelerin durumunu direktör bakışıyla takip edin." },
        { label: "Raporlar", href: "/admin?tab=reports", description: "Satın alma ve operasyon raporlarına erişin." },
      ],
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
    // ── Platform İK ──────────────────────────────────────────────────────────
    {
      business_role: "ik_admin",
      system_role: "ik_admin",
      title: "Platform İK Admin Paneli",
      nav_label: "İK Admin",
      workspace_label: "Kariyer ve İş Piyasası Yönetimi",
      description: "Platform İK Admin için kariyer modülü yönetimi, iş ilanı ve aday takip paneli.",
      hero_title: "Platform İK Admin Paneli",
      hero_description: "İş ilanlarını, aday profillerini ve IK kullanıcılarını merkezi olarak yönetin.",
      allowed_tabs: ["panel_home", "kariyer_yonetimi"],
      quick_links: defaultQuickLinksForBusinessRole("ik_admin"),
    },
    {
      business_role: "ik_yoneticisi",
      system_role: "ik_admin",
      title: "Platform İK Yöneticisi Paneli",
      nav_label: "İK Yöneticisi",
      workspace_label: "İK Yönetici Alanı",
      description: "Platform İK Yöneticisi için kariyer modülü operasyonları.",
      hero_title: "Platform İK Yöneticisi Paneli",
      hero_description: "Kariyer ilanlarını ve aday süreçlerini platform düzeyinde yönetin.",
      allowed_tabs: ["panel_home", "kariyer_yonetimi"],
      quick_links: defaultQuickLinksForBusinessRole("ik_yoneticisi"),
    },
    {
      business_role: "ik_uzmani",
      system_role: "ik_admin",
      title: "Platform İK Uzmanı Paneli",
      nav_label: "İK Uzmanı",
      workspace_label: "İK Uzman Alanı",
      description: "Platform İK Uzmanı için kariyer modülü temel erişimi.",
      hero_title: "Platform İK Uzmanı Paneli",
      hero_description: "Kariyer ilanlarını inceleyin ve başvuru süreçlerini takip edin.",
      allowed_tabs: ["panel_home", "kariyer_yonetimi"],
      quick_links: defaultQuickLinksForBusinessRole("ik_uzmani"),
    },
    // ── Platform Operasyon ────────────────────────────────────────────────
    {
      business_role: "operasyon_admin",
      system_role: "platform_operator",
      title: "Platform Operasyon Admin Paneli",
      nav_label: "Ops Admin",
      workspace_label: "Platform Operasyon Yönetimi",
      description: "Platform operasyon yönetimi ve tenant koordinasyonu.",
      hero_title: "Platform Operasyon Admin Paneli",
      hero_description: "Operasyon kuyrukları, tenant akışları ve sistem yönetimini bu panelden koordine edin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("operasyon_admin"),
    },
    {
      business_role: "operasyon_yoneticisi",
      system_role: "platform_operator",
      title: "Platform Operasyon Yöneticisi Paneli",
      nav_label: "Ops Yöneticisi",
      workspace_label: "Operasyon Yönetici Alanı",
      description: "Platform operasyon yöneticisi çalışma alanı.",
      hero_title: "Platform Operasyon Yöneticisi",
      hero_description: "Operasyon süreçlerini ve tenant yönetimini yöneticisi perspektifinden koordine edin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "tenant_governance", "companies", "roles", "departments", "personnel", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("operasyon_yoneticisi"),
    },
    {
      business_role: "operasyon_uzmani",
      system_role: "platform_operator",
      title: "Platform Operasyon Uzmanı Paneli",
      nav_label: "Ops Uzmanı",
      workspace_label: "Operasyon Uzman Alanı",
      description: "Platform operasyon uzmanı temel çalışma alanı.",
      hero_title: "Platform Operasyon Uzmanı",
      hero_description: "Atanan operasyon görevlerini ve tenant akışlarını takip edin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "companies", "personnel", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("operasyon_uzmani"),
    },
    // ── Platform Destek ───────────────────────────────────────────────────
    {
      business_role: "destek_admin",
      system_role: "platform_support",
      title: "Platform Destek Admin Paneli",
      nav_label: "Destek Admin",
      workspace_label: "Platform Destek Yönetimi",
      description: "Platform destek yönetimi ve governance paneli.",
      hero_title: "Platform Destek Admin Paneli",
      hero_description: "Destek kuyrukları, tenant sorunları ve platform governance bu panelden yönetilir.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "discovery_lab_operations", "onboarding_studio", "tenant_governance", "deployment", "companies", "roles", "departments", "personnel", "projects", "reports", "settings"],
      quick_links: defaultQuickLinksForBusinessRole("destek_admin"),
    },
    {
      business_role: "destek_yoneticisi",
      system_role: "platform_support",
      title: "Platform Destek Yöneticisi Paneli",
      nav_label: "Destek Yöneticisi",
      workspace_label: "Destek Yönetici Alanı",
      description: "Platform destek yöneticisi çalışma alanı.",
      hero_title: "Platform Destek Yöneticisi",
      hero_description: "Destek taleplerini ve tenant sorunlarını yönetici perspektifinden ele alın.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_operations", "tenant_governance", "companies", "personnel", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("destek_yoneticisi"),
    },
    {
      business_role: "destek_uzmani",
      system_role: "platform_support",
      title: "Platform Destek Uzmanı Paneli",
      nav_label: "Destek Uzmanı",
      workspace_label: "Destek Uzman Alanı",
      description: "Platform destek uzmanı temel erişim alanı.",
      hero_title: "Platform Destek Uzmanı",
      hero_description: "Destek taleplerini ve kullanıcı sorunlarını takip edin.",
      allowed_tabs: ["panel_home", "platform_overview", "companies", "personnel", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("destek_uzmani"),
    },
    {
      business_role: "guvenlik_uzmani",
      system_role: "platform_support",
      title: "Platform Güvenlik Uzmanı Paneli",
      nav_label: "Güvenlik",
      workspace_label: "Güvenlik İzleme Alanı",
      description: "Platform güvenlik uzmanı izleme ve denetim alanı.",
      hero_title: "Platform Güvenlik Uzmanı",
      hero_description: "Platform güvenlik akışlarını ve erişim kayıtlarını takip edin.",
      allowed_tabs: ["panel_home", "platform_overview", "roles", "personnel", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("guvenlik_uzmani"),
    },
    {
      business_role: "raporlama_analisti",
      system_role: "platform_support",
      title: "Platform Raporlama Analisti Paneli",
      nav_label: "Analiz",
      workspace_label: "Raporlama ve Analitik Alanı",
      description: "Platform raporlama analisti veri ve analitik çalışma alanı.",
      hero_title: "Platform Raporlama Analisti",
      hero_description: "Platform metriklerini ve operasyon analizlerini bu alandan yönetin.",
      allowed_tabs: ["panel_home", "platform_overview", "platform_analytics", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("raporlama_analisti"),
    },
    // ── Platform Finans ───────────────────────────────────────────────────
    {
      business_role: "finans_admin",
      system_role: "finance_officer",
      title: "Platform Finans Admin Paneli",
      nav_label: "Finans Admin",
      workspace_label: "Platform Finans Yönetimi",
      description: "Platform finans yönetimi, ödeme onayı ve komisyon paneli.",
      hero_title: "Platform Finans Admin Paneli",
      hero_description: "Ödeme talepleri, komisyon yönetimi ve fiyatlandırma akışlarını bu panelden koordine edin.",
      allowed_tabs: ["panel_home", "platform_overview", "public_pricing", "commission_admin", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("finans_admin"),
    },
    {
      business_role: "finans_yoneticisi",
      system_role: "finance_officer",
      title: "Platform Finans Yöneticisi Paneli",
      nav_label: "Finans Yöneticisi",
      workspace_label: "Finans Yönetici Alanı",
      description: "Platform finans yöneticisi çalışma alanı.",
      hero_title: "Platform Finans Yöneticisi",
      hero_description: "Finans akışlarını ve ödeme süreçlerini yönetici perspektifinden takip edin.",
      allowed_tabs: ["panel_home", "public_pricing", "commission_admin", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("finans_yoneticisi"),
    },
    {
      business_role: "finans_uzmani",
      system_role: "finance_officer",
      title: "Platform Finans Uzmanı Paneli",
      nav_label: "Finans Uzmanı",
      workspace_label: "Finans Uzman Alanı",
      description: "Platform finans uzmanı temel çalışma alanı.",
      hero_title: "Platform Finans Uzmanı",
      hero_description: "Finans işlemlerini ve komisyon verilerini takip edin.",
      allowed_tabs: ["panel_home", "commission_admin", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("finans_uzmani"),
    },
    {
      business_role: "finans_izleyici",
      system_role: "moderator_compliance",
      title: "Platform Denetçi / Finans İzleyici Paneli",
      nav_label: "Denetçi",
      workspace_label: "Denetim ve İzleme Alanı",
      description: "Platform denetçi ve finans izleyici sadece okuma erişimi.",
      hero_title: "Platform Denetçi Paneli",
      hero_description: "Finansal akışları ve uyum verilerini salt okunur modda izleyin.",
      allowed_tabs: ["panel_home", "platform_overview", "reports"],
      quick_links: defaultQuickLinksForBusinessRole("finans_izleyici"),
    },
    // ── Stratejik Partner Hiyerarşisi (tüm satın alma rolleri) ─────────────
    // ── Lvl 2: Satın Alma Müdürü ─────────────────────────────────────────
    {
      business_role: "satinalma_muduru",
      system_role: "tenant_member",
      title: "Satın Alma Müdürü Paneli",
      nav_label: "Müdür",
      workspace_label: "Satın Alma Müdür Alanı",
      description: "Satın alma müdürü için ekip yönetimi, proje takibi, tedarikçi ilişkileri ve onay yönetimi.",
      hero_title: "Satın Alma Müdürü Paneli",
      hero_description: "Ekibinizin proje ve tedarikçi operasyonlarını yönetin, onay akışlarını koordine edin ve raporları takip edin.",
      allowed_tabs: ["panel_home", "personnel", "projects", "suppliers", "approvals", "reports"],
      quick_links: [
        { label: "Ekip Üyeleri", href: "/admin?tab=personnel", description: "Ekibinizin üyelerini ve görev atamalarını yönetin." },
        { label: "Projeler", href: "/admin?tab=projects", description: "Aktif satın alma projelerini müdür bakışıyla takip edin." },
        { label: "Onay Akışları", href: "/admin?tab=approvals", description: "Bekleyen onay taleplerini inceleyin ve karara bağlayın." },
      ],
    },
    // ── Lvl 3: Satın Alma Müdür Yardımcısı ───────────────────────────────
    {
      business_role: "satinalma_mudur_yrd",
      system_role: "tenant_member",
      title: "Satın Alma Müdür Yardımcısı Paneli",
      nav_label: "Müdür Yrd.",
      workspace_label: "Satın Alma Müdür Yrd. Alanı",
      description: "Satın alma müdür yardımcısı için ekip koordinasyonu, proje ve tedarikçi yönetimi.",
      hero_title: "Satın Alma Müdür Yardımcısı Paneli",
      hero_description: "Proje süreçlerini, tedarikçi ilişkilerini ve onay akışlarını müdür yardımcısı olarak koordine edin.",
      allowed_tabs: ["panel_home", "personnel", "projects", "suppliers", "approvals", "reports"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Satın alma projelerini inceleyin ve koordine edin." },
        { label: "Tedarikçiler", href: "/admin?tab=suppliers", description: "Tedarikçi listesini ve ilişkilerini yönetin." },
        { label: "Onay Akışları", href: "/admin?tab=approvals", description: "Onay bekleyen talepleri görüntüleyin ve yönetin." },
      ],
    },
    // ── Lvl 4: Satın Alma Yöneticisi ─────────────────────────────────────
    {
      business_role: "satinalma_yoneticisi",
      system_role: "tenant_member",
      title: "Satın Alma Yöneticisi Paneli",
      nav_label: "Yönetici",
      workspace_label: "Satın Alma Yönetici Alanı",
      description: "Satın alma yöneticisi için proje operasyonları, tedarikçi ve onay yönetimi.",
      hero_title: "Satın Alma Yöneticisi Paneli",
      hero_description: "Satın alma projelerini, tedarikçi süreçlerini ve onay akışlarını yönetici rolüyle takip edin.",
      allowed_tabs: ["panel_home", "projects", "suppliers", "approvals", "reports"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Satın alma projelerini ve süreçlerini yönetin." },
        { label: "Tedarikçiler", href: "/admin?tab=suppliers", description: "Tedarikçi listesini ve teklif süreçlerini takip edin." },
        { label: "Onay Akışları", href: "/admin?tab=approvals", description: "Onay süreçlerini yönetici perspektifinden koordine edin." },
      ],
    },
    // ── Lvl 5: Satın Alma Kıdemli Uzmanı ─────────────────────────────────
    {
      business_role: "satinalma_kidemli_uzmani",
      system_role: "tenant_member",
      title: "Satın Alma Kıdemli Uzmanı Paneli",
      nav_label: "Kıdemli Uzman",
      workspace_label: "Satın Alma Kıdemli Uzman Alanı",
      description: "Satın alma kıdemli uzmanı için proje, tedarikçi ve onay akışı çalışma alanı.",
      hero_title: "Satın Alma Kıdemli Uzmanı Paneli",
      hero_description: "Proje ve tedarikçi operasyonlarını kıdemli uzman olarak yönetin, onay süreçlerine katkıda bulunun.",
      allowed_tabs: ["panel_home", "projects", "suppliers", "approvals"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Sorumlu olduğunuz satın alma projelerini takip edin." },
        { label: "Tedarikçiler", href: "/admin?tab=suppliers", description: "Tedarikçi değerlendirme ve teklif süreçlerini yönetin." },
        { label: "Teklifler", href: "/quotes", description: "Aktif teklif ve RFQ süreçlerinize erişin." },
      ],
    },
    // ── Lvl 6: Satın Alma Uzman Yardımcısı ───────────────────────────────
    {
      business_role: "satinalma_uzman_yrd",
      system_role: "tenant_member",
      title: "Satın Alma Uzman Yardımcısı Paneli",
      nav_label: "Uzman Yrd.",
      workspace_label: "Satın Alma Uzman Yrd. Alanı",
      description: "Satın alma uzman yardımcısı için proje ve tedarikçi çalışma alanı.",
      hero_title: "Satın Alma Uzman Yardımcısı Paneli",
      hero_description: "Proje süreçlerine ve tedarikçi operasyonlarına uzman yardımcısı olarak katkı sağlayın.",
      allowed_tabs: ["panel_home", "projects", "suppliers"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Dahil olduğunuz satın alma projelerini takip edin." },
        { label: "Tedarikçiler", href: "/admin?tab=suppliers", description: "Tedarikçi listesini görüntüleyin ve iletişime geçin." },
        { label: "Teklifler", href: "/quotes", description: "Teklif süreçlerinizi inceleyin." },
      ],
    },
    // ── Lvl 7: Satın Alma Uzmanı ─────────────────────────────────────────
    {
      business_role: "satinalma_uzmani",
      system_role: "tenant_member",
      title: "Satın Alma Uzmanı Paneli",
      nav_label: "Uzman",
      workspace_label: "Satın Alma Uzman Alanı",
      description: "Satın alma uzmanı için proje bazlı operasyon çalışma alanı.",
      hero_title: "Satın Alma Uzmanı Paneli",
      hero_description: "Satın alma projelerini ve teklif süreçlerini uzman olarak yürütün.",
      allowed_tabs: ["panel_home", "projects"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Aktif satın alma projelerini takip edin." },
        { label: "Teklifler", href: "/quotes", description: "Teklif ve RFQ süreçlerinizi yönetin." },
      ],
    },
    // ── Genel satınalmacı (legacy / fallback) ─────────────────────────────
    {
      business_role: "satinalmaci",
      system_role: "tenant_member",
      title: "Satın Almacı Paneli",
      nav_label: "Satın Almacı",
      workspace_label: "Satın Almacı Çalışma Alanı",
      description: "Satın almacı temel çalışma alanı.",
      hero_title: "Satın Almacı Paneli",
      hero_description: "Günlük satın alma görevlerinizi ve teklif süreçlerinizi bu alandan takip edin.",
      allowed_tabs: ["panel_home", "projects"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Aktif projeleri görüntüleyin." },
        { label: "Teklifler", href: "/quotes", description: "Teklif süreçlerinize erişin." },
      ],
    },
    // ── Lvl 8: Proje Mimarı ───────────────────────────────────────────────
    {
      business_role: "proje_mimari",
      system_role: "tenant_member",
      title: "Proje Mimarı Paneli",
      nav_label: "Proje Mimarı",
      workspace_label: "Proje Mimar Alanı",
      description: "Proje mimarı için teknik proje yönetimi ve tedarikçi değerlendirme alanı.",
      hero_title: "Proje Mimarı Paneli",
      hero_description: "Teknik proje süreçlerini yönetin, tedarikçi çözümlerini değerlendirin ve teklif akışlarını koordine edin.",
      allowed_tabs: ["panel_home", "projects", "suppliers"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Mimari ve teknik proje süreçlerini yönetin." },
        { label: "Tedarikçiler", href: "/admin?tab=suppliers", description: "Teknik çözüm sunan tedarikçileri değerlendirin." },
        { label: "Teklifler", href: "/quotes", description: "Teknik teklif ve RFQ süreçlerine erişin." },
      ],
    },
    // ── Lvl 9: Teknik Uzman ───────────────────────────────────────────────
    {
      business_role: "teknik_uzman",
      system_role: "tenant_member",
      title: "Teknik Uzman Paneli",
      nav_label: "Teknik Uzman",
      workspace_label: "Teknik Uzman Alanı",
      description: "Teknik uzman için proje odaklı çalışma alanı.",
      hero_title: "Teknik Uzman Paneli",
      hero_description: "Teknik proje süreçleri ve tedarik operasyonlarını uzman perspektifinden takip edin.",
      allowed_tabs: ["panel_home", "projects"],
      quick_links: [
        { label: "Projeler", href: "/admin?tab=projects", description: "Dahil olduğunuz teknik projeleri görüntüleyin." },
        { label: "Teklifler", href: "/quotes", description: "Teknik teklif süreçlerine erişin." },
      ],
    },
    // ── Lvl ★: Özel Stratejik Partner Rolü ───────────────────────────────
    {
      business_role: "ozel_partner_rolu",
      system_role: "tenant_member",
      title: "Özel Stratejik Partner Paneli",
      nav_label: "Özel Rol",
      workspace_label: "Özel Partner Alanı",
      description: "Özel stratejik partner rolü; Panel Tasarımı ile kişiselleştirilebilir yönlendirme paneli.",
      hero_title: "Özel Stratejik Partner Paneli",
      hero_description: "Size atanan özel rol kapsamındaki akışlara bu alandan erişin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ozel_partner_rolu"),
    },
    // ── Lvl ★: Finans İzleyici (stratejik partner) ───────────────────────
    {
      business_role: "finans_izleyici",
      system_role: "tenant_member",
      title: "Finans İzleyici Paneli",
      nav_label: "Finans İzleyici",
      workspace_label: "Finans İzleme Alanı",
      description: "Stratejik partner finans izleyici: salt okunur raporlama erişimi.",
      hero_title: "Finans İzleyici Paneli",
      hero_description: "Finansal akışları ve satın alma raporlarını izleyici perspektifinden takip edin.",
      allowed_tabs: ["panel_home", "reports"],
      quick_links: [
        { label: "Raporlar", href: "/admin?tab=reports", description: "Finansal ve operasyon raporlarını salt okunur modda inceleyin." },
        { label: "Genel Bakış", href: "/dashboard", description: "Genel çalışma alanı özetine gidin." },
      ],
    },
    // ── Kanal Hiyerarşisi ─────────────────────────────────────────────────
    {
      business_role: "kanal_ekip_lideri",
      system_role: "tenant_member",
      title: "Kanal Ekip Lideri Paneli",
      nav_label: "Ekip Lideri",
      workspace_label: "Kanal Ekip Lider Alanı",
      description: "Kanal ekip lideri için yönlendirme ve koordinasyon paneli.",
      hero_title: "Kanal Ekip Lideri Paneli",
      hero_description: "Ekip temsilcilerinizin aktivitelerini ve kanal programını bu panelden koordine edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("kanal_ekip_lideri"),
    },
    {
      business_role: "kanal_finans",
      system_role: "tenant_member",
      title: "Kanal Finans Paneli",
      nav_label: "Kanal Finans",
      workspace_label: "Kanal Finans Alanı",
      description: "Kanal finans rolü için yönlendirme paneli.",
      hero_title: "Kanal Finans Paneli",
      hero_description: "Kanal finansal süreçleri ve komisyon akışlarını bu alandan takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("kanal_finans"),
    },
    {
      business_role: "ozel_kanal_rolu",
      system_role: "tenant_member",
      title: "Özel Kanal Rolü Paneli",
      nav_label: "Özel Kanal",
      workspace_label: "Özel Kanal Alanı",
      description: "Özel kanal rolü için yönlendirme paneli.",
      hero_title: "Özel Kanal Rolü Paneli",
      hero_description: "Size atanan özel kanal rolü kapsamındaki akışlara bu alandan erişin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ozel_kanal_rolu"),
    },
    // ── Tedarikçi Hiyerarşisi ────────────────────────────────────────────
    {
      business_role: "pazarlama_muduru",
      system_role: "supplier_user",
      title: "Pazarlama Müdürü Paneli",
      nav_label: "Paz. Müdürü",
      workspace_label: "Pazarlama Liderlik Alanı",
      description: "Tedarikçi pazarlama müdürü yönetim alanı.",
      hero_title: "Pazarlama Müdürü Paneli",
      hero_description: "Tedarikçi pazarlama operasyonlarını müdür perspektifinden yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("pazarlama_muduru"),
    },
    {
      business_role: "pazarlama_mudur_yrd",
      system_role: "supplier_user",
      title: "Pazarlama Müdür Yrd. Paneli",
      nav_label: "Paz. Müdür Yrd.",
      workspace_label: "Pazarlama Müdür Yrd. Alanı",
      description: "Tedarikçi pazarlama müdür yardımcısı alanı.",
      hero_title: "Pazarlama Müdür Yardımcısı Paneli",
      hero_description: "Pazarlama süreçlerini müdür yardımcısı olarak koordine edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("pazarlama_mudur_yrd"),
    },
    {
      business_role: "pazarlama_yoneticisi",
      system_role: "supplier_user",
      title: "Pazarlama Yöneticisi Paneli",
      nav_label: "Paz. Yöneticisi",
      workspace_label: "Pazarlama Yönetici Alanı",
      description: "Tedarikçi pazarlama yöneticisi operasyon alanı.",
      hero_title: "Pazarlama Yöneticisi Paneli",
      hero_description: "Tedarikçi tekliflerini ve pazarlama akışlarını yönetici rolüyle takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("pazarlama_yoneticisi"),
    },
    {
      business_role: "pazarlama_kidemli_uzmani",
      system_role: "supplier_user",
      title: "Kıdemli Pazarlama Uzmanı Paneli",
      nav_label: "Kıd. Paz. Uzmanı",
      workspace_label: "Kıdemli Pazarlama Uzman Alanı",
      description: "Tedarikçi kıdemli pazarlama uzmanı alanı.",
      hero_title: "Kıdemli Pazarlama Uzmanı Paneli",
      hero_description: "Pazarlama ve teklif operasyonlarını kıdemli uzman olarak yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("pazarlama_kidemli_uzmani"),
    },
    {
      business_role: "pazarlama_uzmani",
      system_role: "supplier_user",
      title: "Pazarlama Uzmanı Paneli",
      nav_label: "Paz. Uzmanı",
      workspace_label: "Pazarlama Uzman Alanı",
      description: "Tedarikçi pazarlama uzmanı temel çalışma alanı.",
      hero_title: "Pazarlama Uzmanı Paneli",
      hero_description: "Tedarikçi pazarlama görevlerini uzman olarak yürütün.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("pazarlama_uzmani"),
    },
    {
      business_role: "teknik_uzman_mimar",
      system_role: "supplier_user",
      title: "Teknik Uzman ve Mimar Paneli",
      nav_label: "Teknik/Mimar",
      workspace_label: "Teknik Uzman Alanı",
      description: "Tedarikçi teknik uzman ve mimar çalışma alanı.",
      hero_title: "Teknik Uzman ve Mimar Paneli",
      hero_description: "Teknik süreçler ve çözüm mimarisini tedarikçi perspektifinden yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("teknik_uzman_mimar"),
    },
    {
      business_role: "ozel_tedarikci_rolu",
      system_role: "supplier_user",
      title: "Özel Tedarikçi Rolü Paneli",
      nav_label: "Özel Rol",
      workspace_label: "Özel Tedarikçi Alanı",
      description: "Özel tedarikçi rolü yönlendirme paneli.",
      hero_title: "Özel Tedarikçi Rolü Paneli",
      hero_description: "Size atanan özel tedarikçi rolü kapsamındaki akışlara erişin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ozel_tedarikci_rolu"),
    },
    {
      business_role: "tedarikci_finans_izleyici",
      system_role: "supplier_user",
      title: "Tedarikçi Finans İzleyici Paneli",
      nav_label: "Finans İzleyici",
      workspace_label: "Tedarikçi Finans İzleme",
      description: "Tedarikçi finans izleyici salt okunur alanı.",
      hero_title: "Tedarikçi Finans İzleyici Paneli",
      hero_description: "Tedarikçi finansal akışlarını ve ödeme verilerini izleyici modda takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("tedarikci_finans_izleyici"),
    },
    // ── İşveren / Kariyer Rolleri ─────────────────────────────────────────
    {
      business_role: "employer_company_admin",
      system_role: "employer_company_admin",
      title: "İşveren Admin Paneli",
      nav_label: "İşveren Admin",
      workspace_label: "İşveren Çalışma Alanı",
      description: "İşveren admin için iş ilanı yönetimi ve başvuru takip paneli.",
      hero_title: "İşveren Admin Paneli",
      hero_description: "İş ilanlarınızı oluşturun, başvuruları takip edin ve satın alma pozisyonlarını yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("employer_company_admin"),
    },
    {
      business_role: "employer_recruiter",
      system_role: "employer_recruiter",
      title: "İşveren Recruiter Paneli",
      nav_label: "Recruiter",
      workspace_label: "Recruiter Çalışma Alanı",
      description: "İşveren recruiter için iş ilanı oluşturma ve aday yönetim paneli.",
      hero_title: "İşveren Recruiter Paneli",
      hero_description: "Açık pozisyonlar için ilan oluşturun ve başvuru sürecini yönetin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("employer_recruiter"),
    },
    // ── İK Rolleri (tenant_member — tüm partner/kanal/tedarikçi tipleri) ──
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
    // ── Tedarikçi İK rolleri (supplier_user system_role) ─────────────────
    {
      business_role: "ik_yoneticisi",
      system_role: "supplier_user",
      title: "Tedarikçi İK Yöneticisi Paneli",
      nav_label: "İK Yöneticisi",
      workspace_label: "İnsan Kaynakları Çalışma Alanı",
      description: "Tedarikçi bünyesindeki İK yöneticisi için kariyer modülü erişimi.",
      hero_title: "Tedarikçi İK Yöneticisi Paneli",
      hero_description: "Satın alma ve tedarik pozisyonları için iş ilanı oluşturun ve kariyer ekosistemini takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ik_yoneticisi"),
    },
    {
      business_role: "ik_uzmani",
      system_role: "supplier_user",
      title: "Tedarikçi İK Uzmanı Paneli",
      nav_label: "İK Uzmanı",
      workspace_label: "İnsan Kaynakları Uzman Alanı",
      description: "Tedarikçi bünyesindeki İK uzmanı için temel kariyer modülü erişimi.",
      hero_title: "Tedarikçi İK Uzmanı Paneli",
      hero_description: "Kariyer ilanlarını inceleyin ve başvuruları takip edin.",
      allowed_tabs: ["panel_home"],
      quick_links: defaultQuickLinksForBusinessRole("ik_uzmani"),
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
  if (role === "partner_admin") return "ORT";
  if (role === "admin") return "BIN";
  if (role === "manager" || role === "satinalma_direktoru") return "DOS";
  if (role === "channel_owner" || role === "channel_agent") return "ORT";
  if (role === "supplier_admin" || role === "supplier_user") return "KUT";
  return "HDF";
}

export function defaultAccentColorForBusinessRole(businessRole: string): string {
  const role = normalize(businessRole);
  // Platform (Süper Admin / destek / operasyon / finans / İK admin) — slate
  if (role === "super_admin" || role.startsWith("platform_") ||
      role.startsWith("operasyon_") || role.startsWith("destek_") ||
      role.startsWith("finans_") || role === "ik_admin") return "#3A4F86";
  // Stratejik Partner (tenant) — koyu zümrüt
  if (role === "partner_admin" || role === "admin" || role === "manager" ||
      role.startsWith("satinalma")) return "#134E37";
  // Tedarikçi — petrol
  if (role === "supplier_admin" || role === "supplier_user" ||
      role.startsWith("pazarlama")) return "#0E7490";
  // İş Ortağı (Kanal) — koyu amber
  if (role === "channel_owner" || role === "channel_agent" ||
      role.startsWith("kanal")) return "#7C2D12";
  // Personel Arayan (İşveren / İK) — violet
  if (role === "employer_company_admin" || role === "employer_recruiter" ||
      role === "hr_manager" || role === "hr_specialist") return "#5B21B6";
  // İş Arayan (Aday) — şarap
  if (role === "candidate" || role === "job_seeker") return "#9F1239";
  return "#3A4F86";
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
