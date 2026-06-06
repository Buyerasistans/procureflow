import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { pdChromeBg } from "../../admin/panel-designer.helpers";
import { publishPanelProfile } from "../../admin/panel-colors";
import { putPanelProfile } from "../../services/admin.service";
import "./panelDesignerTab.css";

// ── Tab catalogue ────────────────────────────────────────────────
const PD_TABS = [
  { key: "panel_home",               label: "Panel Ana Sayfa",            short: "home",       group: "Genel" },
  { key: "platform_overview",        label: "Platform Genel Bakış",       short: "overview",   group: "Genel" },
  { key: "platform_analytics",       label: "Platform Analitikleri",      short: "analytics",  group: "Genel" },
  { key: "ai_lab",                   label: "AI Keşif Lab",               short: "ai-lab",     group: "AI & Keşif" },
  { key: "discovery_lab_operations", label: "Discovery Lab Operasyonları",short: "disc-ops",   group: "AI & Keşif" },
  { key: "platform_operations",      label: "Platform Operasyonları",     short: "plt-ops",    group: "Operasyon" },
  { key: "onboarding_studio",        label: "Kurulum Stüdyosu",           short: "studio",     group: "Operasyon" },
  { key: "tenant_governance",        label: "Stratejik Partner Yön.",     short: "gov",        group: "Operasyon" },
  { key: "platform_suppliers",       label: "Platform Tedarikçi Havuzu",  short: "supp-pool",  group: "Operasyon" },
  { key: "deployment",               label: "Yayınlama",                  short: "deploy",     group: "Operasyon" },
  { key: "kariyer_yonetimi",         label: "Kariyer ve İş Piyasası",     short: "career",     group: "Kariyer" },
  { key: "talent_ecosystem",         label: "Yetenek Ekosistemi",         short: "talent",     group: "Kariyer" },
  { key: "packages",                 label: "Paket ve Kullanım",          short: "packages",   group: "Ticari" },
  { key: "public_pricing",           label: "Genel Fiyatlandırma",        short: "pricing",    group: "Ticari" },
  { key: "campaigns",                label: "Kampanyalar ve Landing",     short: "campaigns",  group: "Ticari" },
  { key: "commission_admin",         label: "Komisyon Yönetimi",          short: "commission", group: "Ticari" },
  { key: "companies",                label: "Firmalar",                   short: "companies",  group: "Yönetişim" },
  { key: "roles",                    label: "Roller ve Yetkiler",         short: "roles",      group: "Yönetişim" },
  { key: "departments",              label: "Departmanlar",               short: "depts",      group: "Yönetişim" },
  { key: "personnel",                label: "Ekip Üyeleri",               short: "personnel",  group: "Yönetişim" },
  { key: "projects",                 label: "Projeler",                   short: "projects",   group: "Yönetişim" },
  { key: "suppliers",                label: "Tedarikçiler",               short: "suppliers",  group: "Yönetişim" },
  { key: "approvals",                label: "Onay Akışları",              short: "approvals",  group: "Yönetişim" },
  { key: "reports",                  label: "Raporlar",                   short: "reports",    group: "Sistem" },
  { key: "support_tickets",          label: "Destek Talepleri",           short: "support",    group: "Sistem" },
  { key: "panel_designer",           label: "Panel Tasarımı",             short: "designer",   group: "Sistem" },
  { key: "settings",                 label: "Ayarlar",                    short: "settings",   group: "Sistem" },
] as const;

type PdTabKey = typeof PD_TABS[number]["key"];

// ── Role labels & templates ──────────────────────────────────────
const PD_ROLE_LABELS: Record<string, string> = {
  super_admin: "Süper Admin", platform_support: "Platform Destek", platform_operator: "Platform Operasyon",
  admin: "Admin", manager: "Yönetici",
  satinalma_direktoru: "Satın Alma Direktörü", satinalma_muduru: "Satın Alma Müdürü",
  satinalma_mudur_yrd: "Satın Alma Müdür Yrd.", satinalma_yoneticisi: "Satın Alma Yöneticisi",
  satinalma_kidemli_uzmani: "Kıdemli Satın Alma Uzmanı", satinalma_uzman_yrd: "Satın Alma Uzman Yrd.",
  satinalma_uzmani: "Satın Alma Uzmanı", satinalmaci: "Satın Almacı",
  proje_mimari: "Proje Mimarı", teknik_uzman: "Teknik Uzman",
  channel_owner: "Kanal Sahibi", kanal_ekip_lideri: "Kanal Ekip Lideri",
  channel_agent: "Kanal Temsilcisi", kanal_finans: "Kanal Finans",
  supplier_admin: "Tedarikçi Yönetici", supplier_user: "Tedarikçi Kullanıcı",
  pazarlama_muduru: "Pazarlama Müdürü", pazarlama_mudur_yrd: "Pazarlama Müdür Yrd.",
  pazarlama_yoneticisi: "Pazarlama Yöneticisi",
  pazarlama_kidemli_uzmani: "Kıdemli Pazarlama Uzmanı", pazarlama_uzmani: "Pazarlama Uzmanı",
  teknik_uzman_mimar: "Teknik Uzman & Mimar", tedarikci_finans_izleyici: "Tedarikçi Finans İzleyici",
  destek_admin: "Destek Admin", destek_yoneticisi: "Destek Yöneticisi", destek_uzmani: "Destek Uzmanı",
  guvenlik_uzmani: "Güvenlik Uzmanı", raporlama_analisti: "Raporlama Analisti",
  operasyon_admin: "Operasyon Admin", operasyon_yoneticisi: "Operasyon Yöneticisi", operasyon_uzmani: "Operasyon Uzmanı",
  finans_admin: "Finans Admin", finans_yoneticisi: "Finans Yöneticisi", finans_uzmani: "Finans Uzmanı",
  employer_company_admin: "İşveren Şirket Admin", employer_recruiter: "İşveren Recruiter",
  ik_admin: "İK Admin", ik_yoneticisi: "İK Yöneticisi", ik_uzmani: "İK Uzmanı",
  hr_manager: "HR Manager", hr_specialist: "HR Specialist",
  tenant_owner: "Partner Sahibi", tenant_admin: "Partner Admin", tenant_member: "Partner Üyesi",
  finance_officer: "Finans Sorumlusu",
};

const PD_ROLE_TEMPLATES: Array<{ biz: string; sys: string; category: string }> = [
  { biz: "super_admin",          sys: "super_admin",        category: "Platform" },
  { biz: "platform_support",     sys: "platform_support",   category: "Platform" },
  { biz: "platform_operator",    sys: "platform_operator",  category: "Platform" },
  { biz: "destek_admin",         sys: "platform_support",   category: "Platform" },
  { biz: "destek_yoneticisi",    sys: "platform_support",   category: "Platform" },
  { biz: "destek_uzmani",        sys: "platform_support",   category: "Platform" },
  { biz: "guvenlik_uzmani",      sys: "platform_support",   category: "Platform" },
  { biz: "raporlama_analisti",   sys: "platform_support",   category: "Platform" },
  { biz: "operasyon_admin",      sys: "platform_operator",  category: "Platform" },
  { biz: "operasyon_yoneticisi", sys: "platform_operator",  category: "Platform" },
  { biz: "operasyon_uzmani",     sys: "platform_operator",  category: "Platform" },
  { biz: "finans_admin",         sys: "finance_officer",    category: "Platform" },
  { biz: "finans_yoneticisi",    sys: "finance_officer",    category: "Platform" },
  { biz: "finans_uzmani",        sys: "finance_officer",    category: "Platform" },
  { biz: "admin",                sys: "tenant_owner",       category: "Stratejik Partner" },
  { biz: "admin",                sys: "tenant_admin",       category: "Stratejik Partner" },
  { biz: "manager",              sys: "tenant_member",      category: "Stratejik Partner" },
  { biz: "satinalma_direktoru",      sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_muduru",         sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_mudur_yrd",      sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_yoneticisi",     sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_kidemli_uzmani", sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_uzman_yrd",      sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalma_uzmani",         sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "satinalmaci",              sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "proje_mimari",             sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "teknik_uzman",             sys: "tenant_member",  category: "Stratejik Partner" },
  { biz: "channel_owner",     sys: "tenant_member", category: "Kanal İş Ortağı" },
  { biz: "kanal_ekip_lideri", sys: "tenant_member", category: "Kanal İş Ortağı" },
  { biz: "channel_agent",     sys: "tenant_member", category: "Kanal İş Ortağı" },
  { biz: "kanal_finans",      sys: "tenant_member", category: "Kanal İş Ortağı" },
  { biz: "supplier_admin",            sys: "supplier_user", category: "Tedarikçi" },
  { biz: "supplier_user",             sys: "supplier_user", category: "Tedarikçi" },
  { biz: "pazarlama_muduru",          sys: "supplier_user", category: "Tedarikçi" },
  { biz: "pazarlama_mudur_yrd",       sys: "supplier_user", category: "Tedarikçi" },
  { biz: "pazarlama_yoneticisi",      sys: "supplier_user", category: "Tedarikçi" },
  { biz: "pazarlama_kidemli_uzmani",  sys: "supplier_user", category: "Tedarikçi" },
  { biz: "pazarlama_uzmani",          sys: "supplier_user", category: "Tedarikçi" },
  { biz: "teknik_uzman_mimar",        sys: "supplier_user", category: "Tedarikçi" },
  { biz: "tedarikci_finans_izleyici", sys: "supplier_user", category: "Tedarikçi" },
  { biz: "employer_company_admin", sys: "employer_company_admin", category: "Kariyer" },
  { biz: "employer_recruiter",     sys: "employer_recruiter",     category: "Kariyer" },
  { biz: "ik_admin",               sys: "ik_admin",               category: "Kariyer" },
  { biz: "ik_yoneticisi",          sys: "ik_admin",               category: "Kariyer" },
  { biz: "ik_uzmani",              sys: "ik_admin",               category: "Kariyer" },
  { biz: "hr_manager",             sys: "tenant_member",          category: "Kariyer" },
  { biz: "hr_specialist",          sys: "tenant_member",          category: "Kariyer" },
];

// ── Segment definitions ──────────────────────────────────────────
const SEGMENT_DEFS = [
  { key: "platform",  label: "Platform",          color: "#3A4F86", cat: "Platform"          },
  { key: "strategic", label: "Stratejik Partner",  color: "#134E37", cat: "Stratejik Partner" },
  { key: "supplier",  label: "Tedarikçi",          color: "#0E7490", cat: "Tedarikçi"         },
  { key: "channel",   label: "İş Ortağı",          color: "#7C2D12", cat: "Kanal İş Ortağı"   },
  { key: "employer",  label: "Kariyer",             color: "#5B21B6", cat: "Kariyer"           },
] as const;

// ── Types ────────────────────────────────────────────────────────
type PdQuickLink = { label: string; href: string; desc: string };
type PdProfile = {
  id: string; biz: string; sys: string; category: string;
  title: string; navLabel: string; wsLabel: string; heroTitle: string; heroDesc: string;
  color: string;      // 1. renk — navbar/topbar zemin
  color2: string;     // 2. renk — parıltı
  color2Mix: number;  // 0–0.6 parıltı oranı
  syncTopbar: boolean;
  accent: string; textColor: string;
  selfEdit: boolean; vitrinEdit: boolean;
  menuStyle: string; glow: number; opacity: number;
  fontTitle: number; fontBody: number;
  tabs: string[]; quickLinks: PdQuickLink[]; users: number;
};

function deriveCategory(biz: string, sys: string): string {
  return PD_ROLE_TEMPLATES.find((r) => r.biz === biz && r.sys === sys)?.category ?? "Platform";
}

function fillMissing(raw: Record<string, unknown>): PdProfile {
  const biz   = String(raw.biz   ?? "");
  const sys   = String(raw.sys   ?? "");
  const color = String(raw.color ?? "#1e293b");
  return {
    id:         String(raw.id ?? "p-" + Date.now()),
    biz, sys,
    category:   String(raw.category || deriveCategory(biz, sys)),
    title:      String(raw.title      ?? biz),
    navLabel:   String(raw.navLabel   ?? biz),
    wsLabel:    String(raw.wsLabel    ?? biz + " Alanı"),
    heroTitle:  String(raw.heroTitle  ?? biz),
    heroDesc:   String(raw.heroDesc   ?? ""),
    color,
    color2:     String(raw.color2    ?? color),
    color2Mix:  typeof raw.color2Mix === "number" ? raw.color2Mix : 0.18,
    syncTopbar: raw.syncTopbar === true,
    accent:     String(raw.accent    ?? "#3b82f6"),
    textColor:  String(raw.textColor ?? "#f8fafc"),
    selfEdit:   raw.selfEdit  === true,
    vitrinEdit: raw.vitrinEdit === true,
    menuStyle:  String(raw.menuStyle ?? "pill"),
    glow:       typeof raw.glow      === "number" ? raw.glow      : 0.45,
    opacity:    typeof raw.opacity   === "number" ? raw.opacity   : 0.85,
    fontTitle:  typeof raw.fontTitle === "number" ? raw.fontTitle : 26,
    fontBody:   typeof raw.fontBody  === "number" ? raw.fontBody  : 13,
    tabs:       Array.isArray(raw.tabs)       ? (raw.tabs as string[])       : ["panel_home"],
    quickLinks: Array.isArray(raw.quickLinks) ? (raw.quickLinks as PdQuickLink[]) : [],
    users:      typeof raw.users === "number" ? raw.users : 0,
  };
}

// ── Role label helper ────────────────────────────────────────────
function pdRoleLabel(code: string): string {
  return PD_ROLE_LABELS[code] || code;
}

// ── Segment-level color defaults ─────────────────────────────────
const _SEG_CLR: Record<string, { color: string; color2: string; accent: string; textColor: string; tabs: string[] }> = {
  "Platform":           { color: "#1d2b4a", color2: "#3A4F86", accent: "#3b82f6", textColor: "#f8fafc",  tabs: ["panel_home","platform_overview","platform_operations","companies","roles","departments","personnel","reports","settings"] },
  "Stratejik Partner":  { color: "#112a25", color2: "#D4AF37", accent: "#D4AF37", textColor: "#f8fafc",  tabs: ["panel_home","companies","roles","departments","personnel","projects","suppliers","approvals","reports","settings"] },
  "Tedarikçi":          { color: "#0c4a6e", color2: "#38bdf8", accent: "#38bdf8", textColor: "#f0f9ff",  tabs: ["panel_home"] },
  "Kanal İş Ortağı":   { color: "#2f1a0d", color2: "#f59e0b", accent: "#f59e0b", textColor: "#fff7ed",  tabs: ["panel_home"] },
  "Kariyer":            { color: "#312e81", color2: "#6366f1", accent: "#6366f1", textColor: "#eef2ff",  tabs: ["panel_home"] },
};

// ── Special-case overrides for key roles ─────────────────────────
const _PROFILE_OV: Record<string, Partial<PdProfile>> = {
  "super_admin|super_admin": {
    title: "Super Admin Paneli", navLabel: "Süper Admin", wsLabel: "Platform Kontrol Merkezi",
    heroTitle: "Süper Admin Paneli",
    heroDesc: "Platform genelindeki tüm yönetim alanları, stratejik partner yönetimi ve panel tasarımı bu panelden yönetilir.",
    color: "#1d2b4a", color2: "#3A4F86", accent: "#dc2626", textColor: "#f8fafc",
    glow: 0.5, opacity: 0.92, fontTitle: 28,
    tabs: ["panel_home","platform_overview","platform_operations","discovery_lab_operations","ai_lab","onboarding_studio","tenant_governance","platform_suppliers","deployment","platform_analytics","kariyer_yonetimi","talent_ecosystem","packages","public_pricing","campaigns","commission_admin","companies","roles","departments","personnel","projects","suppliers","approvals","reports","support_tickets","settings","panel_designer"],
    quickLinks: [
      { label: "Genel Bakış",    href: "/dashboard",                    desc: "Genel çalışma alanına dön" },
      { label: "Tüm Tenants",    href: "/admin?tab=tenant_governance",  desc: "Stratejik partner yönetimi" },
      { label: "Panel Tasarımı", href: "/admin?tab=panel_designer",     desc: "Rol panellerini düzenle" },
    ],
    users: 2,
  },
  "platform_support|platform_support": {
    title: "Platform Destek Paneli", navLabel: "Destek", wsLabel: "Platform Destek Alanı",
    heroTitle: "Platform Destek Paneli",
    heroDesc: "Destek kuyrukları, tenant governance ve discovery odaklarını destek perspektifinden yönetin.",
    color: "#0c2745", color2: "#0ea5e9", accent: "#0ea5e9", textColor: "#f0f9ff",
    tabs: ["panel_home","platform_overview","platform_operations","onboarding_studio","tenant_governance","companies","personnel","reports","support_tickets","settings"],
    quickLinks: [
      { label: "Destek Kuyruğu",  href: "/admin?tab=support_tickets",   desc: "Açık ticket'lar" },
      { label: "Tenant Yönetimi", href: "/admin?tab=tenant_governance", desc: "Partner sorunları" },
    ],
    users: 6,
  },
  "admin|tenant_owner": {
    title: "Stratejik Partner Admin Paneli", navLabel: "Ortak Admin", wsLabel: "Stratejik Partner Sahiplik Alanı",
    heroTitle: "Stratejik Partner Admin Paneli",
    heroDesc: "Firma, ekip üyesi, rol, proje ve tedarikçi operasyonlarını tenant odaklı olarak yönetin.",
    color: "#112a25", color2: "#D4AF37", accent: "#D4AF37", textColor: "#f8fafc",
    quickLinks: [
      { label: "Genel Bakış", href: "/dashboard", desc: "Genel çalışma alanına dön" },
      { label: "Teklifler",   href: "/quotes",    desc: "Teklif süreçlerini aç" },
      { label: "Raporlar",    href: "/reports",   desc: "Rol bazlı raporları aç" },
    ],
    users: 4,
  },
  "admin|tenant_admin": {
    title: "Tenant Admin Paneli", navLabel: "Admin", wsLabel: "Tenant Yönetim Alanı",
    heroTitle: "Tenant Admin Paneli",
    heroDesc: "Kendi tenant yapınızın ekip üyesi, rol, departman ve operasyon alanlarını yönetin.",
    color: "#1e293b", color2: "#22c55e", accent: "#22c55e", textColor: "#f8fafc",
    quickLinks: [
      { label: "Genel Bakış", href: "/dashboard", desc: "Genel çalışma alanına dön" },
      { label: "Teklifler",   href: "/quotes",    desc: "Teklif süreçlerini aç" },
    ],
    users: 28,
  },
  "channel_owner|tenant_member": {
    title: "Kanal Sahibi Paneli", navLabel: "Kanal Sahibi", wsLabel: "Kanal Partner Alanı",
    heroTitle: "Kanal Sahibi Paneli",
    heroDesc: "Kanal programı, partner yönlendirmeleri ve panel erişimleri bu profilden yönetilir.",
    quickLinks: [
      { label: "İş Ortağı Programı", href: "/is-ortagi-programi", desc: "Kanal programı akışları" },
      { label: "Programa Başvuru",   href: "/is-ortagi-basvuru",  desc: "Kanal başvuru" },
    ],
    users: 18,
  },
  "supplier_admin|supplier_user": {
    title: "Tedarikçi Admin Paneli", navLabel: "Tedarikçi Admin", wsLabel: "Tedarikçi Yönetim Alanı",
    heroTitle: "Tedarikçi Admin Paneli",
    heroDesc: "Tedarikçi ekibinizin teklif, belge ve finans akışlarını bu panelden yönetin.",
    quickLinks: [
      { label: "Tedarikçi Workspace", href: "/supplier/workspace?tab=offers", desc: "Teklif & belge" },
      { label: "Tedarikçi Dashboard", href: "/supplier/dashboard",            desc: "Tedarikçi özet" },
    ],
    users: 124,
  },
  "employer_company_admin|employer_company_admin": {
    title: "İşveren Admin Paneli", navLabel: "İşveren Admin", wsLabel: "İşveren Çalışma Alanı",
    heroTitle: "İşveren Admin Paneli",
    heroDesc: "İş ilanlarınızı oluşturun, başvuruları takip edin ve satın alma pozisyonlarını yönetin.",
    glow: 0.5, opacity: 0.92,
    quickLinks: [
      { label: "İş İlanları", href: "/jobs",     desc: "Açık ilanlar" },
      { label: "Yeni İlan",   href: "/jobs/new", desc: "Pozisyon yayınla" },
    ],
    users: 42,
  },
};

// ── Default profiles — tüm roller PD_ROLE_TEMPLATES'tan üretilir ─
const PD_DEFAULT_PROFILES: PdProfile[] = PD_ROLE_TEMPLATES.map((tpl, idx) => {
  const ov  = _PROFILE_OV[`${tpl.biz}|${tpl.sys}`] ?? {};
  const def = _SEG_CLR[tpl.category] ?? _SEG_CLR["Platform"];
  const lbl = pdRoleLabel(tpl.biz);
  const base: PdProfile = {
    id:         "p-" + (idx + 1),
    biz: tpl.biz, sys: tpl.sys, category: tpl.category,
    title:      lbl + " Paneli",
    navLabel:   lbl,
    wsLabel:    lbl + " Alanı",
    heroTitle:  lbl + " Paneli",
    heroDesc:   lbl + " için ayrı çalışma alanı.",
    color: def.color, color2: def.color2, color2Mix: 0.18, syncTopbar: false,
    accent: def.accent, textColor: def.textColor,
    selfEdit: false, vitrinEdit: false,
    menuStyle: "pill", glow: 0.45, opacity: 0.85, fontTitle: 26, fontBody: 13,
    tabs: [...def.tabs],
    quickLinks: [{ label: "Genel Bakış", href: "/dashboard", desc: "Genel alana dön" }],
    users: 0,
  };
  return { ...base, ...ov };
});

// ── Main component ───────────────────────────────────────────────
export default function PanelDesignerTab({
  onNavigate,
  canEdit = true,
}: {
  onNavigate?: (tab: string) => void;
  canEdit?: boolean;
} = {}) {
  const [profiles, setProfiles] = useState<PdProfile[]>(() => {
    try {
      const saved = localStorage.getItem("pf_panel_profiles");
      if (saved) return (JSON.parse(saved) as Record<string, unknown>[]).map(fillMissing);
    } catch { /* use defaults */ }
    return structuredClone(PD_DEFAULT_PROFILES);
  });
  const [activeIdx, setActiveIdx]       = useState(0);
  const [rightTab, setRightTab]         = useState<"settings" | "preview">("settings");
  const [expandedSegs, setExpandedSegs] = useState<Set<string>>(
    () => new Set(SEGMENT_DEFS.map((s) => s.key)),
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewMode, setPreviewMode]   = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dirty, setDirty]               = useState(false);

  const active = profiles[activeIdx] ?? profiles[0];

  function update(field: keyof PdProfile, value: unknown) {
    setProfiles((prev) => {
      const next = [...prev];
      next[activeIdx] = { ...next[activeIdx], [field]: value };
      return next;
    });
    setDirty(true);
  }

  function toggleTab(tabKey: string) {
    if (tabKey === "panel_home") return;
    update("tabs", active.tabs.includes(tabKey)
      ? active.tabs.filter((t) => t !== tabKey)
      : [...active.tabs, tabKey]);
  }

  function toggleMatrixCell(profIdx: number, tabKey: string) {
    if (tabKey === "panel_home") return;
    setProfiles((prev) => {
      const next = [...prev];
      const p = next[profIdx];
      next[profIdx] = { ...p, tabs: p.tabs.includes(tabKey) ? p.tabs.filter((t) => t !== tabKey) : [...p.tabs, tabKey] };
      return next;
    });
    setDirty(true);
  }

  function addProfile(tpl: { biz: string; sys: string; category: string }) {
    const newProf: PdProfile = {
      id: "p-" + Date.now(),
      biz: tpl.biz, sys: tpl.sys, category: tpl.category,
      title: pdRoleLabel(tpl.biz) + " Paneli",
      navLabel: pdRoleLabel(tpl.biz),
      wsLabel: pdRoleLabel(tpl.biz) + " Alanı",
      heroTitle: pdRoleLabel(tpl.biz) + " Paneli",
      heroDesc: pdRoleLabel(tpl.biz) + " için ayrı çalışma alanı.",
      color: "#1e293b", color2: "#3b82f6", color2Mix: 0.18, syncTopbar: false,
      accent: "#3b82f6", textColor: "#f8fafc", selfEdit: false, vitrinEdit: false,
      menuStyle: "pill", glow: 0.45, opacity: 0.85, fontTitle: 26, fontBody: 13,
      tabs: ["panel_home"],
      quickLinks: [{ label: "Genel Bakış", href: "/dashboard", desc: "Genel alana dön" }],
      users: 0,
    };
    setProfiles((prev) => {
      const next = [...prev, newProf];
      setActiveIdx(next.length - 1);
      return next;
    });
    setShowAddModal(false);
    setDirty(true);
  }

  function duplicateProfile(idx: number) {
    const copy: PdProfile = { ...structuredClone(profiles[idx]), id: "p-" + Date.now(), title: profiles[idx].title + " (kopya)", users: 0 };
    setProfiles((prev) => {
      const next = [...prev, copy];
      setActiveIdx(next.length - 1);
      return next;
    });
    setDirty(true);
  }

  function deleteProfile(idx: number) {
    if (!confirm(`"${profiles[idx].title}" profili silinecek. Emin misin?`)) return;
    setProfiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx(Math.max(0, Math.min(activeIdx - (idx < activeIdx ? 1 : 0), next.length - 1)));
      return next;
    });
    setDirty(true);
  }

  function addQuickLink() {
    update("quickLinks", [...active.quickLinks, { label: "Yeni link", href: "/", desc: "Açıklama" }]);
  }
  function updateQuickLink(idx: number, field: keyof PdQuickLink, value: string) {
    const ql = [...active.quickLinks];
    ql[idx] = { ...ql[idx], [field]: value };
    update("quickLinks", ql);
  }
  function deleteQuickLink(idx: number) {
    update("quickLinks", active.quickLinks.filter((_, i) => i !== idx));
  }

  function toggleSeg(key: string) {
    setExpandedSegs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save() {
    try { localStorage.setItem("pf_panel_profiles", JSON.stringify(profiles)); } catch { /* storage full */ }

    const active = profiles[activeIdx];
    if (active && canEdit) {
      try {
        await putPanelProfile(active.biz, active.sys, {
          category:   active.category,
          title:      active.title,
          navLabel:   active.navLabel,
          wsLabel:    active.wsLabel,
          heroTitle:  active.heroTitle,
          heroDesc:   active.heroDesc,
          color:      active.color,
          color2:     active.color2,
          color2Mix:  active.color2Mix,
          syncTopbar: active.syncTopbar,
          accent:     active.accent,
          textColor:  active.textColor,
          selfEdit:   active.selfEdit,
          vitrinEdit: active.vitrinEdit,
          menuStyle:  active.menuStyle,
          glow:       active.glow,
          opacity:    active.opacity,
          fontTitle:  active.fontTitle,
          fontBody:   active.fontBody,
          tabs:       active.tabs,
          quickLinks: active.quickLinks,
          users:      active.users,
        });
        publishPanelProfile({ biz: active.biz, sys: active.sys, profile: active });
      } catch {
        // localStorage kayıt başarıldı; server hatası sessiz geçer
      }
    }

    setDirty(false);
  }

  function reset() {
    if (!confirm("Tüm profiller varsayılana sıfırlanacak. Emin misin?")) return;
    try { localStorage.removeItem("pf_panel_profiles"); } catch { /* ignore */ }
    setProfiles(structuredClone(PD_DEFAULT_PROFILES));
    setActiveIdx(0);
    setDirty(false);
  }

  const profilesBySegment = useMemo<Map<string, { list: PdProfile[]; indices: number[] }>>(() => {
    const map = new Map<string, { list: PdProfile[]; indices: number[] }>();
    SEGMENT_DEFS.forEach((s) => map.set(s.key, { list: [], indices: [] }));
    profiles.forEach((p, i) => {
      const seg = SEGMENT_DEFS.find((s) => s.cat === p.category);
      const key = seg?.key ?? "platform";
      const entry = map.get(key) ?? { list: [], indices: [] };
      entry.list.push(p);
      entry.indices.push(i);
      map.set(key, entry);
    });
    return map;
  }, [profiles]);

  return (
    <div className="pd-root">
      {/* ── Header ── */}
      <div className="pd-hdr">
        <div>
          <span className="pd-hdr__eyebrow">Sistem · Panel Tasarımı</span>
          <h1 className="pd-hdr__title">Her rol için ayrı çalışma alanı</h1>
          <p className="pd-hdr__sub">
            business_role × system_role kombinasyonu için ayrı bir profil. Renk, tipografi, sekme erişimi ve hızlı linkler —
            değişiklikler kaydedildiğinde ilgili roldeki tüm kullanıcılara anında yansır.
          </p>
        </div>
        <div className="pd-hdr__actions">
          {onNavigate && (
            <button type="button" className="pd-hdr-btn" onClick={() => onNavigate("nav_management")}>
              Navigasyon Yönetimi
            </button>
          )}
          <button type="button" className="pd-hdr-btn" onClick={reset}>
            <RefreshCcw size={14} /> Varsayılana sıfırla
          </button>
          <button
            type="button"
            className={`pd-hdr-btn pd-hdr-btn--primary${dirty ? " pd-hdr-btn--unsaved" : ""}`}
            onClick={save}
            disabled={!dirty || !canEdit}
          >
            <Save size={14} /> {dirty ? "● Kaydet ve Yayınla" : "✓ Kaydedildi"}
          </button>
        </div>
      </div>

      {/* ── 2-column: segment tree | tabbed right panel ── */}
      <div className="pd-layout">
        {/* ── Left: Segment tree ── */}
        <aside className="pd-sidebar">
          <div className="pd-sidebar__head">
            <h3>Rol Profilleri</h3>
            <span className="pd-count">{profiles.length}</span>
          </div>

          <div className="pd-seg-tree">
            {SEGMENT_DEFS.map((seg) => {
              const entry    = profilesBySegment.get(seg.key) ?? { list: [], indices: [] };
              const expanded = expandedSegs.has(seg.key);
              return (
                <div key={seg.key} className="pd-seg-item">
                  <button
                    type="button"
                    className="pd-seg-hdr"
                    style={{ "--pd-seg-color": seg.color } as CSSProperties}
                    onClick={() => toggleSeg(seg.key)}
                  >
                    <span className="pd-seg-hdr__dot" />
                    <span className="pd-seg-hdr__label">{seg.label}</span>
                    <span className="pd-count pd-count--sm">{entry.list.length}</span>
                    <span className="pd-seg-hdr__chevron">
                      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  </button>

                  {expanded && entry.list.length === 0 && (
                    <div className="pd-seg-empty">Profil yok</div>
                  )}

                  {expanded && entry.list.map((p, localIdx) => {
                    const globalIdx = entry.indices[localIdx];
                    return (
                      <div
                        key={p.id}
                        className={`pd-profile-row${globalIdx === activeIdx ? " on" : ""}`}
                        onClick={() => setActiveIdx(globalIdx)}
                      >
                        <div
                          className="pd-profile-row__dot"
                          style={{ "--pd-color": p.color, "--pd-accent": p.accent } as CSSProperties}
                        >
                          {p.biz.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="pd-profile-row__meta">
                          <b>{p.title}</b>
                          <span>{p.users} kullanıcı</span>
                        </div>
                        <div className="pd-profile-row__actions">
                          <button
                            type="button"
                            title="Kopyala"
                            onClick={(e) => { e.stopPropagation(); duplicateProfile(globalIdx); }}
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            title="Sil"
                            className="pd-profile-row__del"
                            onClick={(e) => { e.stopPropagation(); deleteProfile(globalIdx); }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <button type="button" className="pd-add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Yeni rol profili ekle
          </button>
        </aside>

        {/* ── Right: Tabbed editor / preview ── */}
        <section className="pd-right-panel">
          <div className="pd-right-tabs">
            {active && (
              <>
                <span
                  className="pd-role-badge"
                  style={{ "--pd-badge-bg": SEGMENT_DEFS.find((s) => s.cat === active.category)?.color ?? "#64748b" } as CSSProperties}
                >
                  {active.category.toUpperCase()} / {active.navLabel.toUpperCase()}
                </span>
                <span className="pd-right-tab-title">{active.title}</span>
                <span className="pd-right-tab-codes">{active.biz} · {active.sys}</span>
              </>
            )}
            <div className="pd-right-tabs__spacer" />
            <button
              type="button"
              className={`pd-right-tab-btn${rightTab === "settings" ? " on" : ""}`}
              onClick={() => setRightTab("settings")}
            >
              Ayarlar
            </button>
            <button
              type="button"
              className={`pd-right-tab-btn${rightTab === "preview" ? " on" : ""}`}
              onClick={() => setRightTab("preview")}
            >
              Önizleme
            </button>
          </div>

          {active && rightTab === "settings" && (
            <div className="pd-editor">
              <div className="pd-editor__body">
                <PdEditor
                  profile={active}
                  canEdit={canEdit}
                  onUpdate={update}
                  onToggleTab={toggleTab}
                  onAddQL={addQuickLink}
                  onUpdateQL={updateQuickLink}
                  onDeleteQL={deleteQuickLink}
                />
              </div>
            </div>
          )}

          {active && rightTab === "preview" && (
            <div className="pd-preview-outer">
              <PdPreview
                profile={active}
                mode={previewMode}
                onModeChange={setPreviewMode}
              />
            </div>
          )}
        </section>
      </div>

      {/* ── Role × Tab matrix ── */}
      <PdMatrix profiles={profiles} onToggle={toggleMatrixCell} />

      {showAddModal && (
        <AddProfileModal
          existingProfiles={profiles}
          onClose={() => setShowAddModal(false)}
          onSelect={addProfile}
        />
      )}
    </div>
  );
}

// ── Quick segment swatches ────────────────────────────────────────
const SEG_QUICK = [
  { key: "platform",  color: "#3A4F86", color2: "#8fb3da", label: "Platform"  },
  { key: "strategic", color: "#134E37", color2: "#D4AF37", label: "Stratejik" },
  { key: "supplier",  color: "#0E7490", color2: "#38bdf8", label: "Tedarikçi" },
  { key: "channel",   color: "#7C2D12", color2: "#f59e0b", label: "İş Ortağı" },
  { key: "employer",  color: "#5B21B6", color2: "#6366f1", label: "Kariyer"   },
  { key: "seeker",    color: "#9F1239", color2: "#fb7185", label: "Aday"      },
] as const;

// ── Mini chrome preview ──────────────────────────────────────────
function MiniChrome({ color, color2, mix, label }: { color: string; color2: string; mix: number; label: string }) {
  const topBg  = pdChromeBg("top",  color, color2, mix);
  const sideBg = pdChromeBg("side", color, color2, mix);
  return (
    <div className="pd-mini-chrome">
      <div className="pd-mini-chrome__top" style={{ "--pd-mc-top": topBg } as CSSProperties}>
        <span className="pd-mini-chrome__brand">BUYERASISTANS✓</span>
        <span className="pd-mini-chrome__panel-name">{label}</span>
        <span className="pd-mini-chrome__greet">Hoş geldiniz</span>
      </div>
      <div className="pd-mini-chrome__body">
        <div className="pd-mini-chrome__side" style={{ "--pd-mc-side": sideBg } as CSSProperties}>
          <div className="pd-mini-chrome__nav-item pd-mini-chrome__nav-item--active" />
          <div className="pd-mini-chrome__nav-item" />
          <div className="pd-mini-chrome__nav-item" />
          <div className="pd-mini-chrome__nav-item" />
        </div>
        <div className="pd-mini-chrome__content" />
      </div>
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────
function PdSwitch({
  id, label, checked, onChange, disabled = false,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="pd-switch-row">
      <label htmlFor={id} className="pd-switch-lbl">{label}</label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked ? "true" : "false"}
        aria-label={label}
        disabled={disabled}
        className={`pd-switch${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="pd-switch__knob" />
      </button>
    </div>
  );
}

// ── Color field ──────────────────────────────────────────────────
function ColorField({
  label, value, onChange, disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const fieldId = `pd-cf-${label.replace(/\s/g, "-")}`;
  return (
    <div className="pd-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="pd-color">
        <input
          type="color"
          aria-label={`${label} renk seçici`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <input
          type="text"
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────
type PdEditorProps = {
  profile: PdProfile;
  canEdit: boolean;
  onUpdate: (field: keyof PdProfile, value: unknown) => void;
  onToggleTab: (key: string) => void;
  onAddQL: () => void;
  onUpdateQL: (idx: number, field: keyof PdQuickLink, value: string) => void;
  onDeleteQL: (idx: number) => void;
};

function PdEditor({
  profile, canEdit, onUpdate, onToggleTab, onAddQL, onUpdateQL, onDeleteQL,
}: PdEditorProps) {
  const disabled = !canEdit;

  const tabsByGroup = useMemo<Record<string, typeof PD_TABS[number][]>>(() => {
    const grouped: Record<string, typeof PD_TABS[number][]> = {};
    PD_TABS.forEach((t) => { (grouped[t.group] = grouped[t.group] || []).push(t); });
    return grouped;
  }, []);

  return (
    <>
      {/* 1. Navbar & Üst Başlık */}
      <div className="pd-grp">
        <div className="pd-grp-h">Navbar & Üst Başlık</div>

        {/* syncTopbar — en üstte */}
        <div className="pd-sync-toggle">
          <div>
            <div className="pd-sync-toggle__lbl">Navbar ve üst başlığı bu panel rengiyle eşitle</div>
            <div className="pd-sync-toggle__desc">Tik işaretliyken sol menü + en üstteki başlık bu panelin rengini alır — panelde renk bütünlüğü sağlanır.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Navbar ve üst başlığı bu panel rengiyle eşitle"
            aria-checked={profile.syncTopbar}
            disabled={disabled}
            className={`pd-switch${profile.syncTopbar ? " on" : ""}`}
            onClick={() => onUpdate("syncTopbar", !profile.syncTopbar)}
          >
            <span className="pd-switch__knob" />
          </button>
        </div>

        {/* Mini chrome önizlemesi */}
        <MiniChrome color={profile.color} color2={profile.color2} mix={profile.color2Mix} label={profile.navLabel} />

        {/* Renk seçiciler */}
        <div className="pd-row-2">
          <ColorField label="1. renk · panel zemini" value={profile.color}  onChange={(v) => onUpdate("color",  v)} disabled={disabled} />
          <ColorField label="2. renk · parıltı"      value={profile.color2} onChange={(v) => onUpdate("color2", v)} disabled={disabled} />
        </div>

        {/* Oran slider + hızlı segment renkleri */}
        <div className="pd-slider-swatch">
          <div className="pd-field">
            <label htmlFor="pd-color2-mix">2. renk oranı ({(profile.color2Mix * 100).toFixed(0)}%)</label>
            <input
              id="pd-color2-mix"
              type="range" min={0} max={0.6} step={0.02}
              value={profile.color2Mix}
              onChange={(e) => onUpdate("color2Mix", Number(e.target.value))}
              disabled={disabled}
            />
          </div>
          <div className="pd-seg-swatches">
            <span className="pd-seg-swatches__lbl">Hızlı segment renkleri (1. + 2.)</span>
            <div className="pd-seg-swatches__row">
              {SEG_QUICK.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.label}
                  className={`pd-swatch-btn pd-swatch-btn--${s.key}${profile.color === s.color ? " on" : ""}`}
                  disabled={disabled}
                  onClick={() => { onUpdate("color", s.color); onUpdate("color2", s.color2); }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Yetki & Düzenleme */}
      <div className="pd-grp">
        <div className="pd-grp-h">Yetki & Düzenleme</div>
        <div className="pd-perm-row">
          <div className="pd-perm-row__body">
            <div className="pd-perm-row__lbl">Rol sahibi kendi panelini düzenleyebilsin</div>
            <div className="pd-perm-row__desc">Süper Admin bu yetkiyi panel adminlerine; panel adminleri de kendi alt rollerine devredebilir.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Rol sahibi kendi panelini düzenleyebilsin"
            aria-checked={profile.selfEdit}
            disabled={disabled}
            className={`pd-switch${profile.selfEdit ? " on" : ""}`}
            onClick={() => onUpdate("selfEdit", !profile.selfEdit)}
          >
            <span className="pd-switch__knob" />
          </button>
        </div>
        <div className="pd-perm-row">
          <div className="pd-perm-row__body">
            <div className="pd-perm-row__lbl">
              Vitrin sayfası düzenleme yetkisi
              <span className="pd-tag-ileri">ileri sürüm</span>
            </div>
            <div className="pd-perm-row__desc">Panel adminleri firma vitrin sayfalarını düzenleyebilir — yetkiyi Süper Admin verir.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Vitrin sayfası düzenleme yetkisi"
            aria-checked={profile.vitrinEdit}
            disabled={disabled}
            className={`pd-switch${profile.vitrinEdit ? " on" : ""}`}
            onClick={() => onUpdate("vitrinEdit", !profile.vitrinEdit)}
          >
            <span className="pd-switch__knob" />
          </button>
        </div>
        {!canEdit && (
          <div className="pd-read-only-note">
            Düzenleme için <b>panel_design.edit</b> yetkisi gereklidir.
          </div>
        )}
      </div>

      {/* 3. Tanım */}
      <div className="pd-grp">
        <div className="pd-grp-h">Tanım & Başlıklar</div>
        <div className="pd-row-2">
          <div className="pd-field">
            <label htmlFor="pd-nav-label">nav_label</label>
            <input id="pd-nav-label" value={profile.navLabel} onChange={(e) => onUpdate("navLabel", e.target.value)} disabled={disabled} />
          </div>
          <div className="pd-field">
            <label htmlFor="pd-ws-label">workspace_label</label>
            <input id="pd-ws-label" value={profile.wsLabel} onChange={(e) => onUpdate("wsLabel", e.target.value)} disabled={disabled} />
          </div>
        </div>
        <div className="pd-field">
          <label htmlFor="pd-hero-title">hero_title</label>
          <input id="pd-hero-title" value={profile.heroTitle} onChange={(e) => onUpdate("heroTitle", e.target.value)} disabled={disabled} />
        </div>
        <div className="pd-field">
          <label htmlFor="pd-hero-desc">hero_description</label>
          <textarea id="pd-hero-desc" rows={2} value={profile.heroDesc} onChange={(e) => onUpdate("heroDesc", e.target.value)} disabled={disabled} />
        </div>
      </div>

      {/* 4. Vurgu & Tema */}
      <div className="pd-grp">
        <div className="pd-grp-h">Vurgu & Tema</div>
        <div className="pd-row-2">
          <ColorField label="accent_color" value={profile.accent}    onChange={(v) => onUpdate("accent", v)}    disabled={disabled} />
          <ColorField label="text_color"   value={profile.textColor} onChange={(v) => onUpdate("textColor", v)} disabled={disabled} />
        </div>
        <div className="pd-row-2">
          <div className="pd-field">
            <label htmlFor="pd-menu-style">menu_style</label>
            <select id="pd-menu-style" value={profile.menuStyle} onChange={(e) => onUpdate("menuStyle", e.target.value)} disabled={disabled}>
              <option value="pill">pill (Rozet Menü)</option>
              <option value="accordion">accordion (Açılır/Kapanır)</option>
              <option value="drawer">drawer (Yandan Çekmece)</option>
              <option value="tabs">tabs (Klasik Sekme)</option>
            </select>
          </div>
          <div className="pd-field">
            <label htmlFor="pd-glow">glow_intensity ({profile.glow.toFixed(2)})</label>
            <input id="pd-glow" type="range" min={0} max={1} step={0.05} value={profile.glow} onChange={(e) => onUpdate("glow", Number(e.target.value))} disabled={disabled} />
          </div>
        </div>
        <div className="pd-field">
          <label htmlFor="pd-opacity">accent_opacity ({profile.opacity.toFixed(2)})</label>
          <input id="pd-opacity" type="range" min={0} max={1} step={0.05} value={profile.opacity} onChange={(e) => onUpdate("opacity", Number(e.target.value))} disabled={disabled} />
        </div>
      </div>

      {/* 5. Tipografi */}
      <div className="pd-grp">
        <div className="pd-grp-h">Tipografi</div>
        <div className="pd-row-2">
          <div className="pd-field">
            <label htmlFor="pd-font-title">hero başlık ({profile.fontTitle}px)</label>
            <input id="pd-font-title" type="range" min={20} max={40} step={1} value={profile.fontTitle} onChange={(e) => onUpdate("fontTitle", Number(e.target.value))} disabled={disabled} />
          </div>
          <div className="pd-field">
            <label htmlFor="pd-font-body">body ({profile.fontBody}px)</label>
            <input id="pd-font-body" type="range" min={11} max={16} step={1} value={profile.fontBody} onChange={(e) => onUpdate("fontBody", Number(e.target.value))} disabled={disabled} />
          </div>
        </div>
      </div>

      {/* 6. Görünür Sekmeler */}
      <div className="pd-grp">
        <div className="pd-grp-h">
          Görünür Sekmeler · allowed_tabs ({profile.tabs.length}/{PD_TABS.length})
        </div>
        {Object.entries(tabsByGroup).map(([groupName, tabs]) => (
          <div key={groupName} className="pd-tab-group">
            <div className="pd-tab-group__name">{groupName}</div>
            <div className="pd-tab-grid-3">
              {tabs.map((t) => {
                const on     = profile.tabs.includes(t.key);
                const locked = (t.key as PdTabKey) === "panel_home";
                return (
                  <label
                    key={t.key}
                    className={`pd-tab-check${on ? " on" : ""}${locked ? " locked" : ""}${disabled && !locked ? " disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked || disabled}
                      onChange={() => onToggleTab(t.key)}
                    />
                    <span>{t.label}</span>
                    {locked && <span className="pd-lock">🔒</span>}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 7. Hızlı Erişim */}
      <div className="pd-grp">
        <div className="pd-grp-h">Hızlı Erişim · quick_links ({profile.quickLinks.length})</div>
        {profile.quickLinks.map((ql, i) => (
          <div key={i} className="pd-ql-row">
            <input placeholder="label" value={ql.label} onChange={(e) => onUpdateQL(i, "label", e.target.value)} disabled={disabled} />
            <input placeholder="href"  value={ql.href}  onChange={(e) => onUpdateQL(i, "href",  e.target.value)} disabled={disabled} />
            <input placeholder="desc"  value={ql.desc}  onChange={(e) => onUpdateQL(i, "desc",  e.target.value)} disabled={disabled} />
            {!disabled && <button type="button" onClick={() => onDeleteQL(i)}>×</button>}
          </div>
        ))}
        {!disabled && (
          <button type="button" className="pd-add-ql" onClick={onAddQL}>
            + Yeni hızlı erişim linki
          </button>
        )}
      </div>
    </>
  );
}

// ── Live preview ─────────────────────────────────────────────────
type PvMode = "desktop" | "tablet" | "mobile";

function readNavLayoutMode(): "single" | "top" | "dual" {
  try {
    const raw = localStorage.getItem("pf_nav_config");
    if (!raw) return "single";
    const cfg = JSON.parse(raw) as { layoutMode?: string };
    if (cfg.layoutMode === "top" || cfg.layoutMode === "dual") return cfg.layoutMode;
  } catch { /* ignore */ }
  return "single";
}
function readNavItemPlacement(key: string): string {
  try {
    const raw = localStorage.getItem("pf_nav_config");
    if (!raw) return "side";
    const cfg = JSON.parse(raw) as { items?: Record<string, { placement?: string }> };
    return cfg.items?.[key]?.placement || "side";
  } catch { return "side"; }
}

function PdPreview({
  profile, mode, onModeChange,
}: {
  profile: PdProfile; mode: PvMode; onModeChange: (m: PvMode) => void;
}) {
  const layoutMode = readNavLayoutMode();
  const visibleTabs = PD_TABS.filter((t) => profile.tabs.includes(t.key));

  const sideTabs = layoutMode === "top"
    ? []
    : layoutMode === "single"
      ? visibleTabs
      : visibleTabs.filter((t) => { const p = readNavItemPlacement(t.key); return p === "side" || p === "both"; });

  const topTabs = layoutMode === "single"
    ? []
    : layoutMode === "top"
      ? visibleTabs
      : visibleTabs.filter((t) => { const p = readNavItemPlacement(t.key); return p === "top" || p === "both"; });

  const glowHex   = Math.floor(profile.glow * 255).toString(16).padStart(2, "0");
  const topChrome = pdChromeBg("top",  profile.color, profile.color2, profile.color2Mix);
  const sideChrome = pdChromeBg("side", profile.color, profile.color2, profile.color2Mix);

  return (
    <div className="pd-preview-wrap pd-preview-wrap--tab">
      <div className="pd-preview-head">
        <b>Canlı Önizleme</b>
        <span className="pd-pv-mode">{layoutMode === "top" ? "Üst nav" : layoutMode === "dual" ? "İkili" : "Sol nav"}</span>
        <div className="pd-mode-toggle">
          {(["desktop", "tablet", "mobile"] as const).map((m) => (
            <button type="button" key={m} className={mode === m ? "on" : ""} onClick={() => onModeChange(m)}>
              {m === "desktop" ? "Desktop" : m === "tablet" ? "Tablet" : "Mobil"}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`pd-preview-frame pd-preview-frame--${mode}`}
        style={{
          "--pd-color":       profile.color,
          "--pd-accent":      profile.accent,
          "--pd-text":        profile.textColor,
          "--pd-font-title":  profile.fontTitle + "px",
          "--pd-font-body":   profile.fontBody  + "px",
          "--pd-opacity":     String(profile.opacity),
          "--pd-color-ee":    profile.color + "ee",
          "--pd-accent-glow": profile.accent + glowHex,
          "--pd-accent-22":   profile.accent + "22",
        } as CSSProperties}
      >
        <div className="pd-mock-strip" style={{ background: topChrome }}>
          <span>Tenant: ACME · Plan: Enterprise</span>
          <span>Q2 2026</span>
        </div>

        {topTabs.length > 0 && (
          <div className="pd-mock-topnav" style={{ background: topChrome }}>
            {topTabs.slice(0, 7).map((t, idx) => (
              <span key={t.key} className={idx === 0 ? "pd-topnav-tab pd-topnav-tab--active" : "pd-topnav-tab"}>
                {t.label}
              </span>
            ))}
            {topTabs.length > 7 && <span className="pd-mock-more">+{topTabs.length - 7}</span>}
          </div>
        )}

        <div className="pd-mock-shell">
          {sideTabs.length > 0 && (
            <div className="pd-mock-sidenav" style={{ background: sideChrome }}>
              {sideTabs.slice(0, 11).map((t, idx) => (
                <span key={t.key} className={idx === 0 ? "pd-sn pd-sn--active" : "pd-sn"}>
                  {t.label}
                </span>
              ))}
              {sideTabs.length > 11 && <span className="pd-sn pd-sn--more">+{sideTabs.length - 11}</span>}
            </div>
          )}
          <div className="pd-mock-main">
            <div className="pd-mock-hero">
              <div className="pd-mock-hero__inner">
                <div className="pd-mock-eyebrow">{profile.navLabel}</div>
                <h2>{profile.heroTitle}</h2>
                <p>{profile.heroDesc}</p>
              </div>
              <div className="pd-mock-user">
                <span className="pd-mock-user__greeting">Hoş geldiniz</span>
                <b>A. Yılmaz</b>
              </div>
            </div>
            <div className="pd-mock-body">
              <div className="pd-mock-section-title">İçerik · {visibleTabs.length} modül</div>
              <div className="pd-mock-modules">
                {visibleTabs.slice(0, 12).map((t) => (
                  <div key={t.key} className="pd-mock-module">
                    <div className="pd-mock-module__title">{t.label}</div>
                    <div className="pd-mock-module__btn">Aç →</div>
                  </div>
                ))}
              </div>
              {profile.quickLinks.length > 0 && (
                <>
                  <div className="pd-mock-section-title pd-mock-section-title--mt">Hızlı Erişim</div>
                  <div className="pd-mock-links">
                    {profile.quickLinks.map((ql, i) => (
                      <div key={i} className="pd-mock-link">
                        <b className="pd-mock-link__label">{ql.label}</b>
                        <span>{ql.href} · {ql.desc}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pd-effect-note">
        <b>{profile.users || 0} kullanıcıyı etkiler.</b>{" "}
        Bu profili kullanan tüm{" "}
        <code>{profile.biz}/{profile.sys}</code> kullanıcıları kaydetince anında yeni görünüme geçer.
      </div>
    </div>
  );
}

// ── Role × Tab matrix ────────────────────────────────────────────
function PdMatrix({
  profiles, onToggle,
}: {
  profiles: PdProfile[];
  onToggle: (profIdx: number, tabKey: string) => void;
}) {
  const [groupFilter, setGroupFilter] = useState("all");
  const groups      = useMemo(() => ["all", ...Array.from(new Set(PD_TABS.map((t) => t.group)))], []);
  const visibleTabs = groupFilter === "all" ? [...PD_TABS] : PD_TABS.filter((t) => t.group === groupFilter);

  return (
    <div className="pd-matrix">
      <div className="pd-matrix__head">
        <div>
          <h3>Rol × Sekme Erişim Matrisi</h3>
          <p>Her hücre tıklanabilir — ✓ ekler, · kaldırır. <b>Panel Ana Sayfa</b> tüm rollerde kilitli.</p>
        </div>
        <div className="pd-matrix__filters">
          {groups.map((g) => (
            <button
              type="button"
              key={g}
              className={`pd-matrix__filter${groupFilter === g ? " on" : ""}`}
              onClick={() => setGroupFilter(g)}
            >
              {g === "all" ? "Tümü" : g}
            </button>
          ))}
        </div>
      </div>
      <div className="pd-matrix__table-wrap">
        <table className="pd-matrix__table">
          <thead>
            <tr>
              <th>Rol Profili</th>
              {visibleTabs.map((t) => (
                <th key={t.key}>
                  <div className="pd-matrix__th-label">{t.label.split(" ")[0]}</div>
                  <div className="pd-matrix__th-code">{t.short}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, idx) => (
              <tr key={p.id}>
                <td className="pd-matrix__role">
                  <b>{p.title}</b>
                  <span>{p.biz} · {p.sys}</span>
                </td>
                {visibleTabs.map((t) => {
                  const has    = p.tabs.includes(t.key);
                  const locked = (t.key as PdTabKey) === "panel_home";
                  return (
                    <td
                      key={t.key}
                      className={`pd-matrix__cell${has ? " on" : ""}${locked ? " locked" : ""}`}
                      onClick={() => onToggle(idx, t.key)}
                      title={locked ? "Bu sekme her rolde zorunlu" : has ? "Kaldır" : "Ekle"}
                    >
                      {has ? "✓" : locked ? "🔒" : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Add profile modal ────────────────────────────────────────────
function AddProfileModal({
  existingProfiles, onClose, onSelect,
}: {
  existingProfiles: PdProfile[];
  onClose: () => void;
  onSelect: (tpl: { biz: string; sys: string; category: string }) => void;
}) {
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("all");
  const existingKeys = useMemo(
    () => new Set(existingProfiles.map((p) => `${p.biz}:${p.sys}`)),
    [existingProfiles],
  );
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(PD_ROLE_TEMPLATES.map((r) => r.category)))],
    [],
  );
  const filtered = PD_ROLE_TEMPLATES.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (!search) return true;
    return (pdRoleLabel(r.biz) + " " + r.biz + " " + r.sys).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="pd-modal-bg" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pd-modal__head">
          <div>
            <h3>Yeni rol profili ekle</h3>
            <p>Rolü ara veya kategoriye göre filtrele · ✓ olanlar zaten ekli</p>
          </div>
          <button type="button" className="pd-modal__x" onClick={onClose}>×</button>
        </div>

        <div className="pd-modal__filters">
          <div className="pd-modal__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Rol ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="pd-modal__cats">
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                className={category === c ? "on" : ""}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "Tümü" : c}
              </button>
            ))}
          </div>
        </div>

        <div className="pd-modal__list">
          {filtered.length === 0 ? (
            <div className="pd-modal__empty">Aramayla eşleşen rol bulunamadı.</div>
          ) : (
            filtered.map((r) => {
              const existing = existingKeys.has(`${r.biz}:${r.sys}`);
              return (
                <button
                  type="button"
                  key={`${r.biz}:${r.sys}`}
                  className={`pd-modal__item${existing ? " pd-modal__item--existing" : ""}`}
                  disabled={existing}
                  onClick={() => onSelect(r)}
                >
                  <div className="pd-modal__item-l">
                    <div className="pd-modal__item-cat">{r.category}</div>
                    <div className="pd-modal__item-name">{pdRoleLabel(r.biz)}</div>
                    <div className="pd-modal__item-codes">{r.biz} · {r.sys}</div>
                  </div>
                  <div className="pd-modal__item-r">
                    {existing
                      ? <span className="pd-modal__item-tag">✓ Ekli</span>
                      : <span className="pd-modal__item-tag pd-modal__item-tag--add">+ Ekle</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
