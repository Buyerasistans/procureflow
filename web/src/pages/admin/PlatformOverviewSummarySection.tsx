import type { ReactNode } from "react";
import type { AdminTabKey } from "./adminPageMeta";
import "./PlatformOverviewSummarySection.css";

const PLATFORM_OVERVIEW_BANNER_TIMESTAMP = Date.parse("2026-05-05T00:00:00Z");

type PlatformOverviewSummarySectionProps = {
  searchParams: URLSearchParams;
  renderAdminFocusBanner: (config: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: "amber";
    sourceLabel: string;
    timestamp: number;
    actions: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId: string;
  }) => ReactNode;
  navigateAdminTab: (tab: AdminTabKey, params?: Record<string, string>) => void;
  tenants: Array<{ is_active?: boolean }>;
  totalActiveCompanies: number;
  totalPassiveCompanies: number;
  totalActivePersonnel: number;
  totalPassivePersonnel: number;
  totalActiveDepartments: number;
  departments: unknown[];
  totalActiveRoles: number;
  roles: unknown[];
  platformOpsSummary: {
    onboardingQueue: unknown[];
    ownerAttention: unknown[];
    brandingAttention: unknown[];
    pausedTenants: unknown[];
  };
  platformOpsOverviewSummary: {
    activeWork: number;
    ownerWaiting: number;
    resolvedWithReason: number;
    staleContact: number;
    unassignedOwner: number;
    busiestOwnerName: string;
    busiestOwnerLoad: number;
  };
};

type SummaryCard = {
  label: string;
  value: number | string;
  note: string;
  color: string;
  large?: boolean;
};

function renderSummaryCards(cards: SummaryCard[]) {
  return cards.map((card) => (
    <div key={card.label} className="platform-overview-summary-section__card">
      <div className="platform-overview-summary-section__label">{card.label}</div>
      <div
        className={`platform-overview-summary-section__value${card.large ? " platform-overview-summary-section__value--large" : ""} platform-overview-summary-section__value--${card.color}`}
      >
        {card.value}
      </div>
      <div className="platform-overview-summary-section__note">{card.note}</div>
    </div>
  ));
}

export function PlatformOverviewSummarySection(props: PlatformOverviewSummarySectionProps) {
  const {
    searchParams,
    renderAdminFocusBanner,
    navigateAdminTab,
    tenants,
    totalActiveCompanies,
    totalPassiveCompanies,
    totalActivePersonnel,
    totalPassivePersonnel,
    totalActiveDepartments,
    departments,
    totalActiveRoles,
    roles,
    platformOpsSummary,
    platformOpsOverviewSummary,
  } = props;

  return (
    <section className="platform-overview-summary-section">
      {(searchParams.get("tenantFocusName") || searchParams.get("projectFocusName") || searchParams.get("onboardingPlanFocus")) ? renderAdminFocusBanner({
        eyebrow: "Yönetici Odağı",
        title: searchParams.get("tenantFocusName")
          ? `Platform genel bakis odagi: ${searchParams.get("tenantFocusName")}`
          : searchParams.get("projectFocusName")
            ? `Platform genel bakis odagi: ${searchParams.get("projectFocusName")}`
            : `Platform genel bakis odagi: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} plani`,
        detail: searchParams.get("tenantFocusName")
          ? "Platform genel bakis kartlari secili Stratejik Partner baglamina gore izleniyor."
          : searchParams.get("projectFocusName")
            ? "Discovery Lab izleme kartlari secili proje baglamina gore okunuyor."
            : "Onboarding odagi platform genel bakis seviyesinde korunuyor.",
        tone: "amber",
        sourceLabel: "Platform genel bakis baglantisi",
        timestamp: PLATFORM_OVERVIEW_BANNER_TIMESTAMP,
        actions: [
          searchParams.get("tenantFocusName") ? { label: "Stratejik Partner Yönetimine Git", onClick: () => navigateAdminTab("tenant_governance", { tenantFocusId: searchParams.get("tenantFocusId") || "", tenantFocusName: searchParams.get("tenantFocusName") || "" }) } : undefined,
          searchParams.get("projectFocusName") ? { label: "Discovery Lab'a Git", onClick: () => navigateAdminTab("discovery_lab_operations", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
          searchParams.get("projectFocusName") ? { label: "Projects'e Git", onClick: () => navigateAdminTab("projects", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
          searchParams.get("onboardingPlanFocus") ? { label: "Onboarding'e Git", onClick: () => navigateAdminTab("onboarding_studio", { onboardingPlanFocus: searchParams.get("onboardingPlanFocus") || "" }) } : undefined,
          { label: "Odagi Temizle", onClick: () => navigateAdminTab("platform_overview") },
        ].filter(Boolean) as Array<{ label: string; onClick?: () => void; href?: string }>,
        testId: "admin-focus-banner-platform-overview",
      }) : null}

      <div className="platform-overview-summary-section__grid">
        {renderSummaryCards([
          { label: "Aktif Stratejik Partner / Firma", value: tenants.filter((item) => item.is_active).length || totalActiveCompanies, note: `${tenants.filter((item) => !item.is_active).length || totalPassiveCompanies} pasif kayit`, color: "#2563eb", large: true },
          { label: "Aktif Kullanıcı", value: totalActivePersonnel, note: `${totalPassivePersonnel} pasif kayıt`, color: "#059669" },
          { label: "Aktif Departman", value: totalActiveDepartments, note: `${departments.length} toplam departman`, color: "#b45309" },
          { label: "Aktif Rol", value: totalActiveRoles, note: `${roles.length} toplam rol`, color: "#7c3aed" },
        ])}
      </div>

      <div className="platform-overview-summary-section__grid">
        {renderSummaryCards([
          { label: "Onboarding Kuyrugu", value: platformOpsSummary.onboardingQueue.length, note: "Aktif olmayan onboarding durumundaki tenant", color: "#b45309" },
          { label: "Owner Aksiyonu", value: platformOpsSummary.ownerAttention.length, note: "Owner atamasi veya owner e-postasi eksik", color: "#dc2626" },
          { label: "Branding Eksigi", value: platformOpsSummary.brandingAttention.length, note: "Logo veya gorunen ad eksigi olan tenant", color: "#7c3aed" },
          { label: "Pasif Stratejik Partner", value: platformOpsSummary.pausedTenants.length, note: "Duraklatilmis veya pasif Stratejik Partner", color: "#475569" },
        ])}
      </div>

      <div className="platform-overview-summary-section__grid">
        {renderSummaryCards([
          { label: "Açık Destek Kaydı", value: platformOpsOverviewSummary.activeWork, note: "Yeni, işlemde veya owner bekleyen support kayıtları", color: "#1d4ed8" },
          { label: "Owner Bekleyen Destek", value: platformOpsOverviewSummary.ownerWaiting, note: "Platform ekibinin owner geri donusu bekledigi kayitlar", color: "#7c3aed" },
          { label: "Kapanisi Tamamlanan", value: platformOpsOverviewSummary.resolvedWithReason, note: "Cozuldu durumuna alinip kapanis nedeni girilen kayitlar", color: "#15803d" },
          { label: "Temasi Geciken Kayit", value: platformOpsOverviewSummary.staleContact, note: "Uc gun ve uzeri temas edilmeyen aktif destek kayitlari", color: "#b45309" },
          { label: "Ownersiz Destek Kaydi", value: platformOpsOverviewSummary.unassignedOwner, note: "Aktif kayitlarda operasyon sahibi atanmamis Stratejik Partner sayisi", color: "#dc2626" },
          { label: "En Yogun Destek Owner", value: platformOpsOverviewSummary.busiestOwnerName, note: `${platformOpsOverviewSummary.busiestOwnerLoad} aktif kayit`, color: "#0f766e" },
        ])}
      </div>
    </section>
  );
}
