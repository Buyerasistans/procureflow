import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { isSuperAdminUser, getPersonnelRolePermissionMatrix } from "../auth/permissions";
import "./RoleMatrixPage.css";

type Section = "katalog" | "izinler" | "sekmeler" | "sistem";

// ─── Rol Kataloğu ────────────────────────────────────────────────────────────

type RoleCatalogRow = {
  grup: string;
  label: string;
  businessRole: string;
  systemRole: string;
  emailOrnek: string;
  hazir: "✅" | "🔧" | "⏳";
  aciklama: string;
};

const ROLE_CATALOG: RoleCatalogRow[] = [
  // Platform
  { grup: "Platform", label: "Süper Admin", businessRole: "super_admin", systemRole: "super_admin", emailOrnek: "superadmin@buyerasistans.com.tr", hazir: "✅", aciklama: "Tam yetkili platform sahibi. Tüm tenant, sistem ayarları, paket yönetimi, impersonation." },
  { grup: "Platform", label: "Platform Destek Uzmanı", businessRole: "platform_support", systemRole: "platform_support", emailOrnek: "destek_uzmani@", hazir: "✅", aciklama: "Destek talepleri, tenant inceleme, kullanıcı yardımı. (canViewPlatformGovernance = true)" },
  { grup: "Platform", label: "Platform Operasyon Yöneticisi", businessRole: "platform_operator", systemRole: "platform_operator", emailOrnek: "operasyon_yoneticisi@", hazir: "✅", aciklama: "Operasyonel süreç yönetimi, onboarding studio, discovery lab." },
  { grup: "Platform", label: "Platform Finans Yöneticisi", businessRole: "finance_officer", systemRole: "finance_officer", emailOrnek: "finans_yoneticisi@", hazir: "🔧", aciklama: "Finans izleme ve raporlama. Platform staff grubunda yer alır; özel finans sekmesi henüz tamamlanmadı." },

  // Satın Alma (Portal)
  { grup: "Satın Alma", label: "Tenant Sahibi (Firma Admin)", businessRole: "admin", systemRole: "tenant_owner", emailOrnek: "firma_admin@", hazir: "✅", aciklama: "Firmanın tam sahibi. Branding, tüm sekmeler, tedarikçi profili (dual-role), kimlik ayarları." },
  { grup: "Satın Alma", label: "Tenant Admin", businessRole: "admin", systemRole: "tenant_admin", emailOrnek: "firma_admin@", hazir: "✅", aciklama: "Firma yöneticisi. Kullanıcı, rol, departman, proje, tedarikçi yönetimi. Kimlik ayarı yok." },
  { grup: "Satın Alma", label: "Satın Alma Direktörü", businessRole: "satinalma_direktoru", systemRole: "tenant_member", emailOrnek: "firma_direktor@", hazir: "✅", aciklama: "Tüm projeleri görür, onay verir, ayarlar + rol yönetimine sınırlı erişim." },
  { grup: "Satın Alma", label: "Satın Alma Yöneticisi", businessRole: "satinalma_yoneticisi", systemRole: "tenant_member", emailOrnek: "firma_yonetici@", hazir: "✅", aciklama: "Proje ve onay yönetimi, sınırlı ayar + rol erişimi." },
  { grup: "Satın Alma", label: "Satın Alma Uzmanı", businessRole: "satinalma_uzmani", systemRole: "tenant_member", emailOrnek: "firma_uzman@", hazir: "✅", aciklama: "Teklif workspace, proje takibi. Raporlara sınırlı erişim." },
  { grup: "Satın Alma", label: "Satın Almacı", businessRole: "satinalmaci", systemRole: "tenant_member", emailOrnek: "firma_satinalmaci@", hazir: "✅", aciklama: "Temel satın alma görevleri, teklif workspace." },
  { grup: "Satın Alma", label: "Kullanıcı", businessRole: "user", systemRole: "tenant_member", emailOrnek: "firma_user@", hazir: "✅", aciklama: "Workspace panel temel erişimi, sınırlı görünüm." },

  // İK
  { grup: "İnsan Kaynakları", label: "İK Yöneticisi", businessRole: "ik_yoneticisi", systemRole: "tenant_member", emailOrnek: "firma_ik_yoneticisi@", hazir: "✅", aciklama: "İş ilanı oluşturma, kariyer modülü, IK workspace paneli. (Phase 8 — Atomik-2)" },
  { grup: "İnsan Kaynakları", label: "İK Uzmanı", businessRole: "ik_uzmani", systemRole: "tenant_member", emailOrnek: "firma_ik_uzmani@", hazir: "✅", aciklama: "Temel IK workspace, iş ilanı görüntüleme. (Phase 8 — Atomik-2)" },

  // Kanal
  { grup: "İş Ortağı (Kanal)", label: "Kanal Hesap Sahibi", businessRole: "channel_owner", systemRole: "tenant_member", emailOrnek: "kanal_sahibi@", hazir: "✅", aciklama: "Kanal ekibi yönetimi, workspace panel, channel admin sekmesi." },
  { grup: "İş Ortağı (Kanal)", label: "Kanal Temsilcisi", businessRole: "channel_agent", systemRole: "tenant_member", emailOrnek: "kanal_temsilci@", hazir: "✅", aciklama: "Kanal görevleri, sınırlı workspace panel." },

  // Tedarikçi
  { grup: "Tedarikçi", label: "Tedarikçi Admin", businessRole: "supplier_admin", systemRole: "supplier_user", emailOrnek: "firma_admin@ (tedarikçi)", hazir: "✅", aciklama: "Tedarikçi portalı tam yetki. Teklif sunma, ürün kataloğu, mail merkezi, gelişmiş ayarlar." },
  { grup: "Tedarikçi", label: "Tedarikçi Kullanıcısı", businessRole: "supplier_user", systemRole: "supplier_user", emailOrnek: "firma_uzman@ (tedarikçi)", hazir: "✅", aciklama: "Tedarikçi portalı temel erişim, teklif ve proje görüntüleme." },

  // Talent Ekosistemi
  { grup: "Talent Ekosistemi", label: "Talent Üyesi", businessRole: "talent_member", systemRole: "talent_member", emailOrnek: "—", hazir: "✅", aciklama: "Talent dashboard, görev alma, profil oluşturma, ödeme alabilme." },
  { grup: "Talent Ekosistemi", label: "Aday (Candidate)", businessRole: "candidate_user", systemRole: "candidate_user", emailOrnek: "—", hazir: "✅", aciklama: "İş ilanlarına başvuru, aday profili yönetimi." },
  { grup: "Talent Ekosistemi", label: "İşveren Admin", businessRole: "employer_company_admin", systemRole: "employer_company_admin", emailOrnek: "—", hazir: "✅", aciklama: "İş ilanı oluşturma, aday yönetimi, pipeline görüntüleme. (Phase 8)" },
  { grup: "Talent Ekosistemi", label: "İşe Alım Uzmanı (Recruiter)", businessRole: "employer_recruiter", systemRole: "employer_recruiter", emailOrnek: "—", hazir: "✅", aciklama: "İş ilanı yönetimi, aday inceleme. (Phase 8)" },
  { grup: "Talent Ekosistemi", label: "Referral Partner", businessRole: "referral_partner", systemRole: "referral_partner", emailOrnek: "—", hazir: "✅", aciklama: "Referral görevi yayınlama/alma, talent dashboard." },
  { grup: "Talent Ekosistemi", label: "Uyum Moderatörü", businessRole: "moderator_compliance", systemRole: "moderator_compliance", emailOrnek: "—", hazir: "✅", aciklama: "Talent profil onayı, ödeme onayı, içerik moderasyonu." },
];

// ─── Tab Erişim Matrisi ───────────────────────────────────────────────────────

type TabAccessRow = {
  tabKey: string;
  tabLabel: string;
  sa: boolean;
  plt: boolean;
  tAdm: boolean;
  dir: boolean;
  yon: boolean;
  uzm: boolean;
  ik: boolean;
  kan: boolean;
  ted: boolean;
  tal: boolean;
  note?: string;
};

const TAB_ACCESS: TabAccessRow[] = [
  { tabKey: "panel_home",               tabLabel: "Panel Ana Sayfa",           sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: true,  ik: true,  kan: true,  ted: false, tal: false, note: "Tedarikçi & Talent için ayrı portal" },
  { tabKey: "platform_overview",        tabLabel: "Platform Genel Bakış",      sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "platform_operations",      tabLabel: "Platform Operasyonlar",     sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "discovery_lab_operations", tabLabel: "Discovery Lab",             sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "onboarding_studio",        tabLabel: "Onboarding Studio",         sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "tenant_governance",        tabLabel: "Tenant Yönetimi",           sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "packages",                 tabLabel: "Paket Kataloğu",            sa: true,  plt: false, tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false, note: "Sadece Süper Admin" },
  { tabKey: "deployment",               tabLabel: "Domain Deployment",         sa: true,  plt: false, tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false, note: "SA + localhost ortamı" },
  { tabKey: "platform_analytics",       tabLabel: "Platform Analitik",         sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "platform_suppliers",       tabLabel: "Platform Tedarikçileri",    sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "public_pricing",           tabLabel: "Genel Fiyatlandırma",       sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "campaigns",                tabLabel: "Kampanyalar",               sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "commission_admin",         tabLabel: "Komisyon Yönetimi",         sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "support_tickets",          tabLabel: "Destek Talepleri",          sa: true,  plt: true,  tAdm: false, dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "companies",                tabLabel: "Firmalar",                  sa: true,  plt: true,  tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "roles",                    tabLabel: "Rol Kataloğu",              sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: false, ik: false, kan: false, ted: false, tal: false, note: "canManageRoleCatalog" },
  { tabKey: "departments",              tabLabel: "Departmanlar",              sa: true,  plt: true,  tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "personnel",                tabLabel: "Personel Yönetimi",         sa: true,  plt: true,  tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "projects",                 tabLabel: "Projeler",                  sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: true,  ik: false, kan: false, ted: false, tal: false },
  { tabKey: "suppliers",                tabLabel: "Tedarikçiler",              sa: true,  plt: true,  tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "approvals",                tabLabel: "Onaylar",                   sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "reports",                  tabLabel: "Raporlar",                  sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: true,  ik: false, kan: false, ted: false, tal: false },
  { tabKey: "mail",                     tabLabel: "E-Posta Ayarları",          sa: true,  plt: true,  tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false },
  { tabKey: "settings",                 tabLabel: "Ayarlar",                   sa: true,  plt: true,  tAdm: true,  dir: true,  yon: true,  uzm: false, ik: false, kan: false, ted: false, tal: false, note: "canAccessProcurementSettings" },
  { tabKey: "supplier_profile",         tabLabel: "Tedarikçi Profili (Dual)",  sa: false, plt: false, tAdm: true,  dir: false, yon: false, uzm: false, ik: false, kan: false, ted: false, tal: false, note: "Tenant Admin + dual-role aktif" },
];

const TAB_COL_HEADERS = [
  { key: "sa",   label: "SA" },
  { key: "plt",  label: "Platform Staff" },
  { key: "tAdm", label: "Tenant Admin" },
  { key: "dir",  label: "Direktör" },
  { key: "yon",  label: "Yönetici" },
  { key: "uzm",  label: "Uzman/Almacı" },
  { key: "ik",   label: "İK" },
  { key: "kan",  label: "Kanal" },
  { key: "ted",  label: "Tedarikçi" },
  { key: "tal",  label: "Talent" },
] as const;

// ─── İzin Matrisi ek satırlar (talent ecosystem) ─────────────────────────────
// getPersonnelRolePermissionMatrix() sadece platform+portal+kanal+tedarikçi satırlarını döner.
// Talent ekosistemi rolleri için ayrı sabit tablo kullanıyoruz.

type TalentPermRow = {
  label: string;
  businessRole: string;
  systemRole: string;
  adminSurface: boolean;
  talentDashboard: boolean;
  postJob: boolean;
  reviewTalent: boolean;
  approvePayout: boolean;
  talentAdmin: boolean;
};

const TALENT_PERM_ROWS: TalentPermRow[] = [
  { label: "Talent Üyesi",           businessRole: "talent_member",         systemRole: "talent_member",         adminSurface: false, talentDashboard: true,  postJob: false, reviewTalent: false, approvePayout: false, talentAdmin: false },
  { label: "Aday",                   businessRole: "candidate_user",        systemRole: "candidate_user",        adminSurface: false, talentDashboard: false, postJob: false, reviewTalent: false, approvePayout: false, talentAdmin: false },
  { label: "İşveren Admin",          businessRole: "employer_company_admin",systemRole: "employer_company_admin",adminSurface: false, talentDashboard: false, postJob: true,  reviewTalent: true,  approvePayout: false, talentAdmin: false },
  { label: "İşe Alım Uzmanı",        businessRole: "employer_recruiter",    systemRole: "employer_recruiter",    adminSurface: false, talentDashboard: false, postJob: true,  reviewTalent: true,  approvePayout: false, talentAdmin: false },
  { label: "Referral Partner",       businessRole: "referral_partner",      systemRole: "referral_partner",      adminSurface: false, talentDashboard: true,  postJob: false, reviewTalent: false, approvePayout: false, talentAdmin: false },
  { label: "Uyum Moderatörü",        businessRole: "moderator_compliance",  systemRole: "moderator_compliance",  adminSurface: false, talentDashboard: false, postJob: false, reviewTalent: true,  approvePayout: true,  talentAdmin: true  },
  { label: "Platform Staff (genel)", businessRole: "platform_support",      systemRole: "platform_support",      adminSurface: true,  talentDashboard: false, postJob: true,  reviewTalent: true,  approvePayout: true,  talentAdmin: true  },
  { label: "Süper Admin",            businessRole: "super_admin",           systemRole: "super_admin",           adminSurface: true,  talentDashboard: true,  postJob: true,  reviewTalent: true,  approvePayout: true,  talentAdmin: true  },
];

// ─── Yardımcı: Hazırlık rozeti ───────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  "Platform": "#7c3aed",
  "Satın Alma": "#1d4ed8",
  "İnsan Kaynakları": "#0f766e",
  "İş Ortağı (Kanal)": "#b45309",
  "Tedarikçi": "#15803d",
  "Talent Ekosistemi": "#be185d",
};

function Pill({ yes }: { yes: boolean }) {
  return (
    <span className={`rm-pill ${yes ? "rm-pill--yes" : "rm-pill--no"}`}>
      {yes ? "✓" : "–"}
    </span>
  );
}

// ─── Bölüm 1: Rol Kataloğu ───────────────────────────────────────────────────

function RoleCatalogSection() {
  const groups = useMemo(() => {
    const map = new Map<string, RoleCatalogRow[]>();
    for (const row of ROLE_CATALOG) {
      if (!map.has(row.grup)) map.set(row.grup, []);
      map.get(row.grup)!.push(row);
    }
    return map;
  }, []);

  return (
    <div className="rm-section">
      <p className="rm-section-note">
        Toplam <strong>{ROLE_CATALOG.length}</strong> rol kombinasyonu. Hazırlık: ✅ Tamamlandı · 🔧 Kısmi · ⏳ Planlandı
      </p>
      {[...groups.entries()].map(([grup, rows]) => (
        <div key={grup} className="rm-group-block">
          <div className="rm-group-header" style={{ borderLeftColor: GROUP_COLORS[grup] ?? "#94a3b8" }}>
            <span style={{ color: GROUP_COLORS[grup] ?? "#334155" }}>{grup}</span>
            <span className="rm-group-count">{rows.length} rol</span>
          </div>
          <div className="rm-table-wrap">
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Rol Adı</th>
                  <th>business_role</th>
                  <th>system_role</th>
                  <th>E-posta Örneği</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.businessRole + row.systemRole}>
                    <td className="rm-td-center">{row.hazir}</td>
                    <td className="rm-td-bold">{row.label}</td>
                    <td><code className="rm-code">{row.businessRole}</code></td>
                    <td><code className="rm-code rm-code--sys">{row.systemRole}</code></td>
                    <td className="rm-td-muted">{row.emailOrnek}</td>
                    <td className="rm-td-desc">{row.aciklama}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bölüm 2: İzin Matrisi ───────────────────────────────────────────────────

const PERM_COLS = [
  { key: "adminSurface",           label: "Admin Panel" },
  { key: "manageUsers",            label: "Kullanıcı Yön." },
  { key: "quoteWorkspace",         label: "Teklif Workspace" },
  { key: "reviewApprovals",        label: "Onay İnceleme" },
  { key: "tenantGovernanceRead",   label: "Tenant Yön. (Oku)" },
  { key: "tenantGovernanceWrite",  label: "Tenant Yön. (Yaz)" },
  { key: "supportWorkflow",        label: "Destek Akışı" },
  { key: "tenantIdentitySettings", label: "Kimlik Ayarları" },
  { key: "sharedEmailProfiles",    label: "Ortak E-Posta" },
] as const;

type PermKey = (typeof PERM_COLS)[number]["key"];

const GROUP_LABEL: Record<string, string> = {
  platform: "Platform",
  portal: "Satın Alma (Portal)",
  channel: "Kanal / İş Ortağı",
  supplier: "Tedarikçi",
};

function PermissionMatrixSection({ data }: { data: ReturnType<typeof getPersonnelRolePermissionMatrix> }) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const row of data) {
      if (!map.has(row.group)) map.set(row.group, []);
      map.get(row.group)!.push(row);
    }
    return map;
  }, [data]);

  return (
    <div className="rm-section">
      <p className="rm-section-note">
        Değerler <code>permissions.ts</code> içindeki fonksiyonlardan canlı olarak hesaplanmaktadır.
        Aşağıdaki tablo platform+portal+kanal+tedarikçi rollerini kapsar.
        Talent ekosistemi için alt bölümü inceleyin.
      </p>

      {[...groups.entries()].map(([group, rows]) => (
        <div key={group} className="rm-group-block">
          <div className="rm-group-header">
            <span>{GROUP_LABEL[group] ?? group}</span>
          </div>
          <div className="rm-table-wrap">
            <table className="rm-table rm-table--perm">
              <thead>
                <tr>
                  <th>Rol (business)</th>
                  <th>system_role</th>
                  {PERM_COLS.map((c) => <th key={c.key} className="rm-th-perm">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.businessRole + row.systemRole}>
                    <td className="rm-td-bold">{row.businessRoleLabel || row.businessRole}</td>
                    <td><code className="rm-code rm-code--sys">{row.systemRole}</code></td>
                    {PERM_COLS.map((c) => (
                      <td key={c.key} className="rm-td-center">
                        <Pill yes={Boolean(row[c.key as PermKey])} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="rm-group-block">
        <div className="rm-group-header" style={{ borderLeftColor: "#be185d" }}>
          <span style={{ color: "#be185d" }}>Talent Ekosistemi — Ek İzinler</span>
        </div>
        <div className="rm-table-wrap">
          <table className="rm-table rm-table--perm">
            <thead>
              <tr>
                <th>Rol</th>
                <th>system_role</th>
                <th className="rm-th-perm">Admin Panel</th>
                <th className="rm-th-perm">Talent Dashboard</th>
                <th className="rm-th-perm">İş İlanı Oluştur</th>
                <th className="rm-th-perm">Talent Profil İncele</th>
                <th className="rm-th-perm">Ödeme Onayla</th>
                <th className="rm-th-perm">Talent Admin</th>
              </tr>
            </thead>
            <tbody>
              {TALENT_PERM_ROWS.map((row) => (
                <tr key={row.businessRole}>
                  <td className="rm-td-bold">{row.label}</td>
                  <td><code className="rm-code rm-code--sys">{row.systemRole}</code></td>
                  <td className="rm-td-center"><Pill yes={row.adminSurface} /></td>
                  <td className="rm-td-center"><Pill yes={row.talentDashboard} /></td>
                  <td className="rm-td-center"><Pill yes={row.postJob} /></td>
                  <td className="rm-td-center"><Pill yes={row.reviewTalent} /></td>
                  <td className="rm-td-center"><Pill yes={row.approvePayout} /></td>
                  <td className="rm-td-center"><Pill yes={row.talentAdmin} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Bölüm 3: Panel Sekmeleri ─────────────────────────────────────────────────

function TabAccessSection() {
  const platformTabs = TAB_ACCESS.filter((t) =>
    ["platform_overview","platform_operations","discovery_lab_operations","onboarding_studio",
     "tenant_governance","packages","deployment","platform_analytics","platform_suppliers",
     "public_pricing","campaigns","commission_admin","support_tickets"].includes(t.tabKey)
  );
  const tenantTabs = TAB_ACCESS.filter((t) =>
    ["panel_home","companies","roles","departments","personnel","projects","suppliers",
     "approvals","reports","mail","settings","supplier_profile"].includes(t.tabKey)
  );

  function TabTable({ rows, title }: { rows: TabAccessRow[]; title: string }) {
    return (
      <div className="rm-group-block">
        <div className="rm-group-header"><span>{title}</span></div>
        <div className="rm-table-wrap">
          <table className="rm-table rm-table--perm">
            <thead>
              <tr>
                <th>Sekme</th>
                <th><code className="rm-code rm-code--sm">tab_key</code></th>
                {TAB_COL_HEADERS.map((h) => <th key={h.key} className="rm-th-perm">{h.label}</th>)}
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tabKey}>
                  <td className="rm-td-bold">{row.tabLabel}</td>
                  <td><code className="rm-code">{row.tabKey}</code></td>
                  {TAB_COL_HEADERS.map((h) => (
                    <td key={h.key} className="rm-td-center">
                      <Pill yes={Boolean(row[h.key as keyof TabAccessRow])} />
                    </td>
                  ))}
                  <td className="rm-td-muted rm-td-note">{row.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rm-section">
      <p className="rm-section-note">
        Sütun grupları: <strong>SA</strong> = Süper Admin · <strong>Platform Staff</strong> = platform_support / platform_operator / finance_officer ·
        <strong> Tenant Admin</strong> = tenant_owner + tenant_admin · <strong>Direktör</strong> = satinalma_direktoru ·
        <strong>Yönetici</strong> = satinalma_yoneticisi · <strong>Uzman/Almacı</strong> = satinalma_uzmani + satinalmaci ·
        <strong>İK</strong> = ik_yoneticisi + ik_uzmani · <strong>Kanal</strong> = channel_owner + channel_agent ·
        <strong>Tedarikçi</strong> = supplier_user (ayrı portal) · <strong>Talent</strong> = talent ekosistemi (ayrı panel)
      </p>
      <TabTable title="Platform Sekmeleri (Sadece Platform Staff / SA)" rows={platformTabs} />
      <TabTable title="Tenant Sekmeleri (Tüm Roller)" rows={tenantTabs} />
    </div>
  );
}

// ─── Bölüm 4: system_role Referans Kılavuzu ──────────────────────────────────

type SystemRoleDoc = {
  systemRole: string;
  tr: string;
  katman: "platform" | "tenant" | "supplier" | "talent";
  businessRoleOrnekleri: string[];
  erisimYuzey: string;
  ozellikler: string[];
  kritikNot?: string;
};

const SYSTEM_ROLE_DOCS: SystemRoleDoc[] = [
  {
    systemRole: "super_admin",
    tr: "Süper Admin",
    katman: "platform",
    businessRoleOrnekleri: ["super_admin"],
    erisimYuzey: "Tüm yüzeyler — platform admin + tüm tenant'lar + supplier + talent",
    ozellikler: [
      "Yalnızca 1 kullanıcı: superadmin@buyerasistans.com.tr",
      "isSuperAdminUser() fonksiyonu bu değeri kontrol eder",
      "Impersonation yetkisi: herhangi bir kullanıcı olarak görünüm yapabilir",
      "Paket kataloğu ve domain deployment dahil TÜM sekmeler açık",
      "JWT'de hem business_role hem system_role = 'super_admin' olarak yazılır",
      "Yalnızca platform kodu tarafından atanabilir — UI üzerinden değiştirilemez",
    ],
    kritikNot: "Bu kullanıcıya DOKUNMA. Kilitlenirse platforma erişim tamamen kapanır.",
  },
  {
    systemRole: "platform_support",
    tr: "Platform Destek Personeli",
    katman: "platform",
    businessRoleOrnekleri: ["platform_support"],
    erisimYuzey: "Platform admin paneli — destek ve tenant inceleme sekmeleri",
    ozellikler: [
      "canViewPlatformGovernance = true → tenant listesi ve tenant detaylarını görebilir",
      "Destek talepleri, kullanıcı yardımı işlemleri yapabilir",
      "Finans ve paket yönetimine erişim YOK",
      "Birden fazla kullanıcıya atanabilir (destek_admin, destek_yoneticisi, destek_uzmani)",
      "migrate_role_catalog_v2.py'da platform.support_admin / support_manager / support_agent olarak ayrışır",
    ],
  },
  {
    systemRole: "platform_operator",
    tr: "Platform Operasyon / Güvenlik / Raporlama Personeli",
    katman: "platform",
    businessRoleOrnekleri: ["platform_operator"],
    erisimYuzey: "Platform admin paneli — operasyonel yönetim, discovery lab, onboarding studio",
    ozellikler: [
      "Operasyonel süreç yönetimi: onboarding akışları, discovery lab çalıştırma",
      "Güvenlik uzmanı ve raporlama analisti de bu system_role'ü kullanır",
      "Platform genelinde analitik ve tedarikçi yönetim sekmelerine erişim",
      "Paket kataloğu ve domain deployment sekmeleri kapalı (sadece SA)",
      "platform_support ile aynı system_role değil — operasyonel vs destek ayrımı kasıtlı",
    ],
  },
  {
    systemRole: "finance_officer",
    tr: "Platform Finans Personeli",
    katman: "platform",
    businessRoleOrnekleri: ["finance_officer"],
    erisimYuzey: "Platform admin paneli — finans izleme ve raporlama sekmeleri",
    ozellikler: [
      "Finans admin, finans yöneticisi, finans uzmanı ve finans izleyici bu system_role'ü paylaşır",
      "Komisyon yönetimi ve platform analitik sekmelerine erişim",
      "Tenant finans verilerini okuyabilir",
      "Henüz tam olarak tamamlanmamış özel finans sekmeleri var (hazir: 🔧)",
      "platform_operator'den ayrı tutulmasının nedeni: finans verileri hassas — erişim audit izlenebilir olmalı",
    ],
    kritikNot: "İleride bu rol için ayrı finans dashboard eklenmesi planlanıyor.",
  },
  {
    systemRole: "tenant_owner",
    tr: "Tenant Sahibi (Firma Kurucusu)",
    katman: "tenant",
    businessRoleOrnekleri: ["partner_admin", "admin"],
    erisimYuzey: "Workspace panel — tüm sekmeler + kimlik/marka ayarları",
    ozellikler: [
      "tenant_admin'den tek farkı: tenantIdentitySettings = true (marka, domain, kimlik ayarları)",
      "sharedEmailProfiles yönetimi de tenant_owner'a açık",
      "business_role genellikle 'partner_admin' olarak kaydedilir",
      "Firma başına normalde 1 kişi ataması beklenir (firma kurucu/sahibi)",
      "Tüm kullanıcı ve rol yönetimi yetkisi mevcut",
    ],
  },
  {
    systemRole: "tenant_admin",
    tr: "Tenant Yöneticisi (Firma Admin)",
    katman: "tenant",
    businessRoleOrnekleri: ["admin", "partner_admin"],
    erisimYuzey: "Workspace panel — neredeyse tüm sekmeler (kimlik ayarları hariç)",
    ozellikler: [
      "Kullanıcı, rol, departman, proje, tedarikçi ve onay yönetimi",
      "tenantIdentitySettings = false → marka/domain ayarları kapalı",
      "Birden fazla admin atanabilir, tenant_owner'dan sayıca fazla olabilir",
      "canAccessProcurementSettings = true → genel satın alma ayarları açık",
      "canManageRoleCatalog = true → rol kataloğu yönetimi mümkün",
    ],
  },
  {
    systemRole: "tenant_member",
    tr: "Tenant Üyesi (Firma Çalışanı)",
    katman: "tenant",
    businessRoleOrnekleri: [
      "satinalma_direktoru", "satinalma_muduru", "satinalma_yoneticisi",
      "satinalma_uzmani", "satinalmaci", "user",
      "ik_yoneticisi", "ik_uzmani",
      "channel_owner", "channel_agent",
      "finans_izleyici", "ozel_partner_rolu", "proje_mimari", "teknik_uzman"
    ],
    erisimYuzey: "Workspace panel — business_role'e göre değişen sekme seti",
    ozellikler: [
      "En kalabalık sistem rolü — platforma kayıtlı çalışanların büyük çoğunluğu",
      "Hangi sekmelerin açık olduğu tamamen business_role tarafından belirlenir",
      "Admin paneli sekmeleri (companies, personnel, departments) KAPALI",
      "Proje ve teklif workspace sekmeleri direktör/yönetici/uzman için AÇIK",
      "İK rollerinde (ik_yoneticisi, ik_uzmani) jobs sekmeleri ve kariyer modülü AÇIK",
      "Kanal rollerinde (channel_owner, channel_agent) kanal workspace sekmeleri AÇIK",
    ],
  },
  {
    systemRole: "supplier_user",
    tr: "Tedarikçi Kullanıcısı",
    katman: "supplier",
    businessRoleOrnekleri: ["supplier_admin", "supplier_user"],
    erisimYuzey: "Supplier Portal (/supplier/* rotaları) — workspace paneline erişim YOK",
    ozellikler: [
      "Tamamen ayrı portal: /supplier/dashboard, /supplier/workspace, /supplier/finance",
      "SupplierRoute koruma katmanı ile ayrılmış (ProtectedRoute değil)",
      "supplier_admin: profil, finans, mail merkezi, gelişmiş ayarlar, teklif sunma",
      "supplier_user: temel erişim, teklif ve proje görüntüleme",
      "Tenant workspace paneline HİÇBİR şekilde erişemez",
      "JWT'de tenant_id yoktur — platform genelindedir",
    ],
  },
  {
    systemRole: "candidate_user",
    tr: "Aday (İş Başvurusu Yapan Kullanıcı)",
    katman: "talent",
    businessRoleOrnekleri: ["candidate_user"],
    erisimYuzey: "Kariyer portalı — iş ilanlarına başvuru, aday profil yönetimi",
    ozellikler: [
      "İş ilanlarına başvurabilir, başvuru geçmişini görüntüleyebilir",
      "Aday profili oluşturabilir ve güncelleyebilir",
      "Talent dashboard'a erişim YOK (o employer/talent_member'a ait)",
      "Admin paneline erişim YOK",
      "employer tarafından independent — herhangi bir şirkete bağlı değil",
      "Phase 8 ile eklendi: /candidate/register rotası üzerinden kayıt",
    ],
  },
  {
    systemRole: "employer_company_admin",
    tr: "İşveren Şirket Admini",
    katman: "talent",
    businessRoleOrnekleri: ["employer_company_admin"],
    erisimYuzey: "İşveren paneli — iş ilanı oluşturma, aday yönetimi, pipeline",
    ozellikler: [
      "İş ilanı oluşturabilir, düzenleyebilir, yayınlayabilir",
      "Aday pipeline'ını görüntüleyebilir ve yönetebilir",
      "employer_recruiter'ı da kapsayan üst yetki seviyesi",
      "Phase 8 ile eklendi: /employer/register rotasından kayıt",
      "talent_member'dan farklı: işveren tarafı — iş veriyor, almıyor",
      "Satın alma tenant'larından bağımsız ayrı işveren şirket yapısı",
    ],
  },
  {
    systemRole: "employer_recruiter",
    tr: "İşe Alım Uzmanı (Recruiter)",
    katman: "talent",
    businessRoleOrnekleri: ["employer_recruiter"],
    erisimYuzey: "İşveren paneli — iş ilanı yönetimi, aday inceleme",
    ozellikler: [
      "employer_company_admin'in daha dar yetkili versiyonu",
      "İş ilanı oluşturabilir ve aday inceleyebilir",
      "Şirket ayarları ve pipeline tam yönetimi kapalı",
      "Phase 8 ile eklendi",
      "Birden fazla recruiter aynı işveren şirketi altında çalışabilir",
    ],
  },
  {
    systemRole: "moderator_compliance",
    tr: "Uyum Moderatörü",
    katman: "talent",
    businessRoleOrnekleri: ["moderator_compliance"],
    erisimYuzey: "Talent ekosistemi moderasyon paneli — profil onayı, ödeme onayı, içerik denetimi",
    ozellikler: [
      "Talent profil onayı yapabilir (approvePayout = true)",
      "İçerik moderasyonu: profil içeriklerini onaylayabilir/reddedebilir",
      "reviewTalent = true → talent profil listesini görebilir",
      "Admin paneline (workspace) erişim YOK",
      "platform_support'tan farklı: sadece talent ekosistemi içinde çalışır",
      "Ödeme akışlarında kritik rol — kötüye kullanım riski var, dikkatli atanmalı",
    ],
    kritikNot: "Bu role sahip kullanıcılar ödeme onaylayabilir. Atama işlemi super admin tarafından yapılmalı.",
  },
];

const KATMAN_COLORS: Record<string, string> = {
  platform: "#7c3aed",
  tenant:   "#1d4ed8",
  supplier: "#15803d",
  talent:   "#be185d",
};

const KATMAN_LABELS: Record<string, string> = {
  platform: "Platform",
  tenant:   "Tenant (Firma)",
  supplier: "Tedarikçi",
  talent:   "Talent Ekosistemi",
};

function SystemRoleSection() {
  const byKatman = useMemo(() => {
    const map = new Map<string, SystemRoleDoc[]>();
    for (const doc of SYSTEM_ROLE_DOCS) {
      if (!map.has(doc.katman)) map.set(doc.katman, []);
      map.get(doc.katman)!.push(doc);
    }
    return map;
  }, []);

  return (
    <div className="rm-section">
      <p className="rm-section-note">
        <strong>system_role</strong> = JWT token'a yazılan sınıflandırma değeri. "Bu kullanıcı hangi yüzeye/portala ait?" sorusunu yanıtlar.
        <br />
        <strong>business_role</strong> = Aynı JWT'deki fonksiyonel görev değeri. "Bu kullanıcı ne iş yapıyor?" sorusunu yanıtlar.
        <br />
        İzin kararları <code>permissions.ts</code>'te her iki alan birlikte değerlendirilerek verilir.
        Tek başına <code>system_role</code> veya tek başına <code>business_role</code> yeterli değil.
      </p>

      {[...byKatman.entries()].map(([katman, docs]) => (
        <div key={katman} className="rm-group-block">
          <div className="rm-group-header" style={{ borderLeftColor: KATMAN_COLORS[katman] ?? "#94a3b8" }}>
            <span style={{ color: KATMAN_COLORS[katman] }}>
              {KATMAN_LABELS[katman] ?? katman} — system_role değerleri
            </span>
            <span className="rm-group-count">{docs.length} değer</span>
          </div>

          {docs.map((doc) => (
            <div key={doc.systemRole} className="rm-srdoc">
              <div className="rm-srdoc-header">
                <code className="rm-code rm-code--sys rm-srdoc-code">{doc.systemRole}</code>
                <span className="rm-srdoc-title">{doc.tr}</span>
                {doc.kritikNot && (
                  <span className="rm-srdoc-critical-badge">⚠ KRİTİK</span>
                )}
              </div>

              <div className="rm-srdoc-grid">
                <div>
                  <div className="rm-srdoc-field-label">Erişim Yüzeyi</div>
                  <div className="rm-srdoc-field-text">{doc.erisimYuzey}</div>
                </div>
                <div>
                  <div className="rm-srdoc-field-label">İlişkili business_role örnekleri</div>
                  <div className="rm-srdoc-chips">
                    {doc.businessRoleOrnekleri.map((br) => (
                      <code key={br} className="rm-code rm-srdoc-chip">{br}</code>
                    ))}
                  </div>
                </div>
              </div>

              <ul className="rm-srdoc-features">
                {doc.ozellikler.map((o, i) => <li key={i}>{o}</li>)}
              </ul>

              {doc.kritikNot && (
                <div className="rm-srdoc-warn">⚠ {doc.kritikNot}</div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="rm-group-block">
        <div className="rm-group-header">
          <span>İki Alan Neden Var? — Tasarım Kararı</span>
        </div>
        <div className="rm-design-note">
          <p>
            <strong>system_role</strong>, kullanıcının hangi <em>portala/yüzeye</em> ait olduğunu söyler.
            Örneğin <code className="rm-code rm-code--sys">supplier_user</code> gören sistem,
            bu kullanıcıyı doğrudan Supplier Portal'a yönlendirir — workspace panel'e bakmaz bile.
          </p>
          <p>
            <strong>business_role</strong>, aynı yüzey içinde <em>ne yapabileceğini</em> belirler.
            İki <code className="rm-code">tenant_member</code> aynı panel'e girebilir ama
            biri <code className="rm-code">satinalma_direktoru</code> diğeri <code className="rm-code">user</code> olduğu için
            farklı sekmeler görür.
          </p>
          <p>
            Bu iki alanlı yapı sayesinde tek bir <code>hasPermission()</code> çağrısı hem
            "hangi portal?" hem "ne yapabilir?" sorularını aynı anda yanıtlayabilir.
            Gelecekte yeni bir portal eklemek için sadece yeni bir <code>system_role</code> değeri tanımlamak yeterlidir.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function RoleMatrixPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("katalog");
  const permMatrix = useMemo(() => getPersonnelRolePermissionMatrix(), []);

  if (!isSuperAdminUser(user)) {
    return (
      <div className="rm-guard-error">
        Bu sayfa yalnızca Süper Admin'e açıktır.
      </div>
    );
  }

  const SECTIONS: { key: Section; label: string; count: number | string }[] = [
    { key: "katalog", label: "Rol Kataloğu", count: ROLE_CATALOG.length },
    { key: "izinler", label: "İzin Matrisi", count: "canlı" },
    { key: "sekmeler", label: "Panel Sekmeleri", count: TAB_ACCESS.length },
    { key: "sistem", label: "system_role Kılavuzu", count: SYSTEM_ROLE_DOCS.length },
  ];

  return (
    <div className="rm-page">
      <div className="rm-header">
        <button type="button" className="rm-back-btn" onClick={() => navigate("/admin")}>
          ← Admin Paneline Dön
        </button>
        <div className="rm-title-row">
          <h1 className="rm-title">Rol & İzin Matrisi</h1>
          <span className="rm-badge-dev">Geliştirici Aracı</span>
        </div>
        <p className="rm-subtitle">
          Platformdaki tüm roller, izin fonksiyonları ve panel sekme erişim durumu.
          İzin sütunları <code>permissions.ts</code>'ten canlı hesaplanır.
        </p>
        <nav className="rm-nav">
          {SECTIONS.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`rm-nav-btn ${activeSection === s.key ? "rm-nav-btn--active" : ""}`}
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
              <span className="rm-nav-count">{s.count}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="rm-body">
        {activeSection === "katalog" && <RoleCatalogSection />}
        {activeSection === "izinler" && <PermissionMatrixSection data={permMatrix} />}
        {activeSection === "sekmeler" && <TabAccessSection />}
        {activeSection === "sistem" && <SystemRoleSection />}
      </div>
    </div>
  );
}
