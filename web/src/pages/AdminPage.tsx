// PAGE: web/src/pages/AdminPage.tsx
import { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DepartmentsTab } from "./admin/DepartmentsTab";
import { PersonnelTab } from "./admin/PersonnelTab";
import { CompaniesTab } from "./admin/CompaniesTab";
import { PackagesTab } from "./admin/PackagesTab";
import { PlatformOperationsTab } from "./admin/PlatformOperationsTab";
import { CommissionAdminTab } from "./admin/commission-admin-tab";
import { SupportTicketAdminTab } from "../components/admin/SupportTicketAdminTab";
import { ScopeWorkspaceHome } from "./admin/ScopeWorkspaceHome";
import { UpgradeExtrasWorkspace } from "./admin/UpgradeExtrasWorkspace";
import { renderTabIconBadge, translateServiceLabel } from "./admin/adminPageMeta";
import type { AdminFocusBannerTone, AdminTabKey, TabConfig } from "./admin/adminPageMeta";
import { useAuth } from "../hooks/useAuth";
import ImpersonationBanner from "../components/ImpersonationBanner";
import { canAccessAdminSurface, canAccessProcurementSettings, canAccessWorkspacePanel, canManageRoleCatalog, canManageTenantGovernance, getUserDisplayRoleLabel, isIkAdminUser, isPlatformStaffUser, isSuperAdminUser, isTenantAdminUser, resolveApprovalRoleLabel } from "../auth/permissions";
import { ProjectsTab } from "../components/ProjectsTab";
import { RoleDepartmentGovernanceTab } from "../components/admin/RoleDepartmentGovernanceTab";
import { OnboardingStudioTab } from "./admin/OnboardingStudioTab";
import { TenantGovernanceTab } from "./admin/TenantGovernanceTab";
import { SuppliersTab } from "../components/SuppliersTab";
import { SupplierProfileTab } from "./admin/SupplierProfileTab";
import { SettingsTab } from "../components/SettingsTab";
import { AdvancedSettingsTab } from "../components/AdvancedSettingsTab";
import { ApprovalDashboard } from "../components/ApprovalDashboard";
import { DataTable, PageHeader, Section, StatCard } from "./admin/AdminTabContent";

import { getAccessToken } from "../lib/token";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getTenants,
  getAdminSuppliers,
  getAdminChannelUsers,
  createTenant,
  updateTenant,
  deleteTenant,
  getSubscriptionCatalog,
  getBillingOverview,
  getCommercialRequests,
  getSubscriptionAddons,
  getCommercialRequestWebhookSettings,
  getCommercialRequestWebhookDeliveries,
  retryBillingWebhookEvent,
  retryCommercialRequestWebhookDelivery,
  getTenantUsers,
  getDepartments,
  getCompanies,
  getRoles,
  getProjects,
  updateTenantSupportWorkflow,
  deleteCompany,
  getDiscoveryLabSessions,
  getDiscoveryLabSummary,
  getDiscoveryLabAnswerAudits,
  getOnboardingStudioSummary,
  verifyTenantOnboardingPayment,
  approveTenantOnboardingActivation,
  rejectTenantOnboardingActivation,
  reviewTenantCategoryRequest,
  requestTenantOnboardingInfo,
  getWorkspacePanelConfig,
  getCatalogRequests,
  createRoleCatalogRequest,
  createDepartmentCatalogRequest,
  reviewCatalogRequest,
  updateWorkspacePanelConfig,
  updateCommercialRequestStatus,
  updateCommercialRequestWebhookSettings,
  updateSubscriptionAddonLifecycle,
} from "../services/admin.service";
import type { BillingOverview, CommercialRequestItem, CommercialRequestWebhookDelivery, CommercialRequestWebhookSettings, SubscriptionAddonAdminItem, TenantUser, Department, Company, Role, Tenant, SubscriptionCatalogSnapshot, DiscoveryLabAnswerAuditSummary, DiscoveryLabSessionSummary, DiscoveryLabSummary, OnboardingStudioSummary, WorkspacePanelConfig, AdminSupplierListItem, Project, CatalogRequest, TenantUsersQueryParams } from "../services/admin.service";
import { useSearchParams } from "react-router-dom";
import { QuoteStatusLabel, normalizeQuoteStatus } from "../types/quote.types";
import { getQuote, getQuoteAuditTrail, getQuoteHistory, getQuotePendingApprovals, getQuotes, type Quote, type QuoteAuditTrail, type QuotePendingApproval, type StatusLog } from "../services/quote.service";
import { getWorkspacePanelQuickLinks, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile, WORKSPACE_PANEL_DATA_TABS, type WorkspacePanelTabKey } from "../admin/workspace-panels";
import { buildPolicyContext, resolveVisiblePanelTabKeys } from "../config/navigation-policy";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";
import "../styles/pages/AdminPage.css";
import AdminShell from "./admin/AdminShell";

type ServiceUsageCard = {
  key: string;
  title: string;
  note?: string | null;
  activeCount?: number | null;
  passiveCount?: number | null;
  usedCount?: number | null;
  limitCount?: number | null;
  remainingCount?: number | null;
  unit?: string | null;
};

type PricingAddon = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  increment?: number;
  unit?: string;
  visibility_notes?: string[];
};

type PricingPlanCard = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  limits?: Record<string, number>;
  features?: string[];
};

type StrategicPricingConfig = {
  plans: PricingPlanCard[];
  addons?: PricingAddon[];
};

type PublicPricingConfig = {
  strategic_partner?: StrategicPricingConfig;
  supplier?: { plans?: Array<Record<string, unknown>> };
};

const RESTORED_QUOTE_INSIGHT_STORAGE_KEY = "admin.discoveryLab.restoredQuoteInsight";
const RESTORED_QUOTE_DEBUG_STORAGE_KEY = "admin.discoveryLab.restoredQuoteDebugEvents";
const FOCUS_TELEMETRY_FILTERS_STORAGE_KEY = "admin.focusTelemetry.filters";
const FOCUS_TELEMETRY_PRESETS_STORAGE_KEY = "admin.focusTelemetry.presets";
const FOCUS_TELEMETRY_ACTION_HISTORY_STORAGE_KEY = "admin.focusTelemetry.actionHistory";
const FOCUS_TELEMETRY_ACTION_HISTORY_FILTERS_STORAGE_KEY = "admin.focusTelemetry.actionHistoryFilters";
const RESTORED_QUOTE_INSIGHT_TTL_MS = 5 * 60 * 1000;
const RESTORED_QUOTE_DEBUG_LIMIT = 6;

const EMPTY_ONBOARDING_STUDIO_SUMMARY: OnboardingStudioSummary = {
  tenant_count: 0,
  onboarding_queue_count: 0,
  owner_pending_count: 0,
  branding_pending_count: 0,
  new_membership_count: 0,
  payment_review_count: 0,
  information_requested_count: 0,
  activation_approval_waiting_count: 0,
  approved_membership_count: 0,
  recent_memberships: [],
  rfq_readiness: {
    quotes_missing_tenant: 0,
    approvals_quote_tenant_mismatch: 0,
    approvals_missing_tenant: 0,
    quotes_project_tenant_mismatch: 0,
    supplier_quote_scope_mismatch: 0,
    supplier_quotes_platform_network_count: 0,
    transition_ready: true,
  },
  supplier_mix: {
    private_count: 0,
    platform_network_count: 0,
  },
};

type RestoreDebugEventType = "restore" | "action" | "lifecycle";

type RestoreDebugEvent = { id: string; label: string; detail: string; type: RestoreDebugEventType; createdAt: number };

type RestoreDebugSeverity = "high" | "medium" | "low";

type FocusTelemetryEvent = {
  id: string;
  label: string;
  detail: string;
  source: string;
  createdAt: number;
  targetQuoteId?: number;
  targetSection?: "status-history" | "full-audit-trail";
};

type FocusTelemetryFilterSnapshot = {
  source: string;
  window: "all" | "15m";
  search: string;
};

type FocusTelemetryPreset = {
  id: string;
  name: string;
  userKey: string;
  createdAt: number;
  filters: FocusTelemetryFilterSnapshot;
};

type FocusTelemetryPresetPackage = {
  version: 1;
  exportedAt: string;
  userKey: string;
  sourceWorkspace: string;
  operatorLabel: string;
  presetHash: string;
  presets: FocusTelemetryPreset[];
};

type FocusTelemetryActionStatus = {
  tone: "success" | "error";
  message: string;
};

type FocusTelemetryActionHistoryItem = {
  id: string;
  tone: "success" | "error";
  scope: "export" | "preset" | "navigation";
  message: string;
  createdAt: number;
};

type FocusTelemetryPresetImportPreview = {
  isValid: boolean;
  versionLabel: string;
  exportedAtLabel: string;
  sourceWorkspaceLabel: string;
  operatorLabel: string;
  presetHash: string;
  presetCount: number;
  acceptedCount: number;
  conflictCount: number;
  newPresetNames: string[];
  overrideNames: string[];
  previewPresetNames: string[];
  selectedReferencePresetName: string | null;
  groupedDiffs: Array<{ presetName: string; kind: "new" | "override"; lines: string[] }>;
  activeFilterSummary: string;
  filterDiffLines: string[];
  summary: string;
  warnings: string[];
};

type FocusTelemetryActionHistoryWindow = "all" | "30m" | "24h";

type FocusTelemetryActionHistoryFilterSnapshot = {
  scope: "all" | "export" | "preset" | "navigation";
  window: FocusTelemetryActionHistoryWindow;
  search: string;
};

type TelemetryPulseTarget = {
  quoteId: number;
  section: "status-history" | "full-audit-trail";
  reason: string;
};

function getDaysSince(dateText: string | null | undefined) {
  if (!dateText) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = String(dateText).slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffMs = utcToday.getTime() - parsed.getTime();
  return Math.floor(diffMs / 86400000);
}

function formatAdminFocusTimestamp(value?: number | null) {
  if (!value) {
    return "Az once";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function getQuoteInsightSectionLabel(section: "status-history" | "full-audit-trail") {
  return section === "status-history" ? "Durum Geçmişi" : "Denetim İzi";
}

type BillingInvoiceStatusBucket = "open" | "paid" | "other";

const BILLING_OPEN_INVOICE_STATUSES = new Set(["open", "unpaid", "past_due", "uncollectible"]);
const BILLING_PAID_INVOICE_STATUSES = new Set(["paid"]);

function getBillingInvoiceStatusMeta(status: string | null | undefined): { bucket: BillingInvoiceStatusBucket; label: string } {
  const normalized = String(status || "").trim().toLowerCase();
  if (BILLING_PAID_INVOICE_STATUSES.has(normalized)) {
    return { bucket: "paid", label: "Odendi" };
  }
  if (BILLING_OPEN_INVOICE_STATUSES.has(normalized)) {
    if (normalized === "past_due") {
      return { bucket: "open", label: "Vadesi Gecti" };
    }
    if (normalized === "uncollectible") {
      return { bucket: "open", label: "Tahsil Edilemedi" };
    }
    if (normalized === "unpaid") {
      return { bucket: "open", label: "Odenmedi" };
    }
    return { bucket: "open", label: "Açık" };
  }

  if (normalized === "draft") {
    return { bucket: "other", label: "Taslak" };
  }
  if (normalized === "void" || normalized === "voided") {
    return { bucket: "other", label: "Iptal" };
  }
  if (!normalized) {
    return { bucket: "other", label: "Bilinmiyor" };
  }

  return { bucket: "other", label: normalized.replace(/_/g, " ") };
}

function formatPartnerLifecycleStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") return "aktif";
  if (normalized === "paused") return "duraklatildi";
  if (!normalized) return "bilinmiyor";
  return normalized.replace(/_/g, " ");
}

function formatPartnerOnboardingStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "draft") return "taslak";
  if (normalized === "active") return "kurulum tamamlandi";
  if (normalized === "pending_activation") return "aktivasyon bekliyor";
  if (normalized === "paused") return "duraklatildi";
  if (!normalized) return "belirtilmedi";
  return normalized.replace(/_/g, " ");
}

function formatOnboardingPaymentStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "not_required") return "odeme gerekmiyor";
  if (normalized === "submitted") return "odeme bildirildi";
  if (normalized === "processing") return "odeme isleniyor";
  if (normalized === "verified") return "odeme dogrulandi";
  if (normalized === "succeeded") return "odeme tamamlandi";
  if (!normalized) return "bilinmiyor";
  return normalized.replace(/_/g, " ");
}

function formatOnboardingApprovalStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "not_required") return "onay gerekmiyor";
  if (normalized === "pending") return "onay bekliyor";
  if (normalized === "needs_info") return "ek bilgi istendi";
  if (normalized === "approved") return "onaylandi";
  if (normalized === "rejected") return "reddedildi";
  if (!normalized) return "bilinmiyor";
  return normalized.replace(/_/g, " ");
}

function formatCategoryRequestStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "pending_support") return "destek incelemesi bekliyor";
  if (normalized === "support_approved") return "destek onayi tamam";
  if (normalized === "final_approved") return "final onaylandi";
  if (normalized === "rejected") return "reddedildi";
  if (!normalized) return "durum yok";
  return normalized.replace(/_/g, " ");
}

function formatActivationDeliveryStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "waiting") return "link bekleniyor";
  if (normalized === "sent") return "mail gönderildi";
  if (normalized === "activated") return "kullanici aktive etti";
  if (normalized === "not_sent") return "gönderilmedi";
  if (!normalized) return "bilinmiyor";
  return normalized.replace(/_/g, " ");
}

function buildFocusTelemetryFilterSnapshot(searchParams: URLSearchParams): FocusTelemetryFilterSnapshot {
  return {
    source: searchParams.get("telemetrySource") || "all",
    window: searchParams.get("telemetryWindow") === "15m" ? "15m" : "all",
    search: searchParams.get("telemetrySearch") || "",
  };
}

function applyFocusTelemetryParams(searchParams: URLSearchParams, snapshot: FocusTelemetryFilterSnapshot) {
  const nextParams = new URLSearchParams(searchParams);
  if (snapshot.source === "all") nextParams.delete("telemetrySource");
  else nextParams.set("telemetrySource", snapshot.source);

  if (snapshot.window === "all") nextParams.delete("telemetryWindow");
  else nextParams.set("telemetryWindow", snapshot.window);

  if (!snapshot.search) nextParams.delete("telemetrySearch");
  else nextParams.set("telemetrySearch", snapshot.search);

  return nextParams;
}

function formatTelemetryFileTimestamp(value: number) {
  return new Date(value).toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function formatTelemetryExportHeader(filters: FocusTelemetryFilterSnapshot, eventCount: number, createdAt: number) {
  return [
    `Disa Aktarim Zamani: ${new Date(createdAt).toISOString()}`,
    `Event Count: ${eventCount}`,
    `Source Filter: ${filters.source}`,
    `Window Filter: ${filters.window}`,
    `Search Query: ${filters.search || "-"}`,
  ];
}

function buildFocusTelemetryPresetUserKey(email?: string | null, id?: number | null) {
  return `${email || "unknown"}::${id || 0}`;
}

function buildFocusTelemetryPresetHash(presets: FocusTelemetryPreset[]) {
  const serialized = JSON.stringify(presets.map((preset) => ({ name: preset.name, filters: preset.filters }))); 
  let hash = 0;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = ((hash << 5) - hash) + serialized.charCodeAt(index);
    hash |= 0;
  }
  return `pf-${Math.abs(hash)}`;
}

function describeFocusTelemetryFilterDiff(current: FocusTelemetryFilterSnapshot, incoming: FocusTelemetryFilterSnapshot) {
  const diffLines: string[] = [];
  if (current.source !== incoming.source) {
    diffLines.push(`Kaynak: ${current.source} -> ${incoming.source}`);
  }
  if (current.window !== incoming.window) {
    diffLines.push(`Zaman: ${current.window} -> ${incoming.window}`);
  }
  if (current.search !== incoming.search) {
    diffLines.push(`Arama: ${current.search || "-"} -> ${incoming.search || "-"}`);
  }
  return diffLines;
}

function isFocusTelemetryActionWithinWindow(createdAt: number, windowFilter: FocusTelemetryActionHistoryWindow) {
  if (windowFilter === "all") {
    return true;
  }
  const thresholdMs = windowFilter === "30m" ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return Date.now() - createdAt <= thresholdMs;
}

function buildFocusTelemetryActionHistoryFilterSnapshot(
  scope: "all" | "export" | "preset" | "navigation",
  windowFilter: FocusTelemetryActionHistoryWindow,
  search: string,
): FocusTelemetryActionHistoryFilterSnapshot {
  return {
    scope,
    window: windowFilter,
    search,
  };
}

function applyFocusTelemetryActionHistoryParams(searchParams: URLSearchParams, snapshot: FocusTelemetryActionHistoryFilterSnapshot) {
  const nextParams = new URLSearchParams(searchParams);
  if (snapshot.scope === "all") nextParams.delete("telemetryHistoryScope");
  else nextParams.set("telemetryHistoryScope", snapshot.scope);

  if (snapshot.window === "all") nextParams.delete("telemetryHistoryWindow");
  else nextParams.set("telemetryHistoryWindow", snapshot.window);

  if (!snapshot.search.trim()) nextParams.delete("telemetryHistorySearch");
  else nextParams.set("telemetryHistorySearch", snapshot.search);

  return nextParams;
}

function formatFocusTelemetryFilterSummary(snapshot: FocusTelemetryFilterSnapshot) {
  return `kaynak=${snapshot.source} • zaman=${snapshot.window} • arama=${snapshot.search || "-"}`;
}

function getFocusTelemetryActionHistoryScopeDistributionLabel(items: FocusTelemetryActionHistoryItem[]) {
  const scopeOrder: Array<FocusTelemetryActionHistoryItem["scope"]> = ["export", "preset", "navigation"];
  const scopeCounts = scopeOrder.reduce<Record<FocusTelemetryActionHistoryItem["scope"], number>>((acc, scope) => {
    acc[scope] = 0;
    return acc;
  }, { export: 0, preset: 0, navigation: 0 });

  items.forEach((item) => {
    scopeCounts[item.scope] += 1;
  });

  return scopeOrder.map((scope) => `${scope}=${scopeCounts[scope]}`).join(" | ");
}

function buildFocusTelemetryPresetImportPreview(raw: string, existingPresets: FocusTelemetryPreset[], currentFilters: FocusTelemetryFilterSnapshot, selectedPresetName?: string | null): FocusTelemetryPresetImportPreview {
  if (!raw.trim()) {
    return {
      isValid: false,
      versionLabel: "-",
      exportedAtLabel: "-",
      sourceWorkspaceLabel: "-",
      operatorLabel: "-",
      presetHash: "-",
      presetCount: 0,
      acceptedCount: 0,
      conflictCount: 0,
      newPresetNames: [],
      overrideNames: [],
      previewPresetNames: [],
      selectedReferencePresetName: null,
      groupedDiffs: [],
      activeFilterSummary: `Secili telemetry filtresi: ${formatFocusTelemetryFilterSummary(currentFilters)}`,
      filterDiffLines: [],
      summary: "Ice aktarim icin paket JSON bekleniyor",
      warnings: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FocusTelemetryPresetPackage>;
    const importedPresets = Array.isArray(parsed.presets)
      ? parsed.presets.filter((preset): preset is FocusTelemetryPreset => Boolean(
        preset
        && preset.id
        && preset.name
        && preset.userKey
        && preset.createdAt
        && preset.filters
      ))
      : [];
    const warnings: string[] = [];
    if (parsed.version !== 1) warnings.push(`Versiyon uyumsuz: ${parsed.version ?? "tanimsiz"}`);
    if (!parsed.exportedAt) warnings.push("exportedAt metadata alani eksik");
    if (!parsed.sourceWorkspace) warnings.push("Calisma alani metadata alani eksik (sourceWorkspace)");
    if (!parsed.operatorLabel) warnings.push("Operator metadata alani eksik (operatorLabel)");
    if (!parsed.presetHash) warnings.push("Özet kodu metadata alanı eksik (presetHash)");
    if (Array.isArray(parsed.presets) && parsed.presets.length !== importedPresets.length) warnings.push("Bazi preset kayitlari gecersiz format nedeniyle yok sayilacak");
    const newPresetNames = importedPresets
      .filter((preset) => !existingPresets.some((item) => item.name.toLowerCase() === preset.name.toLowerCase()))
      .map((preset) => preset.name);
    const overrideNames = importedPresets
      .filter((preset) => existingPresets.some((item) => item.name.toLowerCase() === preset.name.toLowerCase()))
      .map((preset) => preset.name);
    const previewPresetNames = importedPresets.map((preset) => preset.name);
    const groupedDiffs = importedPresets.map((preset) => {
      const existingPreset = existingPresets.find((item) => item.name.toLowerCase() === preset.name.toLowerCase());
      if (!existingPreset) {
        return {
          presetName: preset.name,
          kind: "new" as const,
          lines: [
            `Kaynak: ${preset.filters.source}`,
            `Zaman: ${preset.filters.window}`,
            `Arama: ${preset.filters.search || "-"}`,
          ],
        };
      }
      const differences = describeFocusTelemetryFilterDiff(existingPreset.filters, preset.filters);
      return {
        presetName: preset.name,
        kind: "override" as const,
        lines: differences.length ? differences : ["Filtre farki yok"],
      };
    });
    const filterDiffLines = importedPresets.flatMap((preset) => {
      const existingPreset = existingPresets.find((item) => item.name.toLowerCase() === preset.name.toLowerCase());
      if (!existingPreset) {
        return [`Yeni preset: ${preset.name}`];
      }
      const differences = describeFocusTelemetryFilterDiff(existingPreset.filters, preset.filters);
      if (differences.length === 0) {
        return [`Ezilecek: ${preset.name} (filtre farki yok)`];
      }
      return differences.map((difference) => `${preset.name} - ${difference}`);
    });
    const conflictCount = overrideNames.length;
    if (conflictCount > 0) warnings.push(`${conflictCount} preset mevcut kayitlari override edecek`);
    const representativePreset = importedPresets.find((preset) => preset.name === selectedPresetName) || importedPresets[0];
    const selectedReferencePresetName = representativePreset?.name || null;
    const orderedGroupedDiffs = selectedReferencePresetName
      ? [...groupedDiffs].sort((left, right) => {
        const leftScore = left.presetName === selectedReferencePresetName ? 1 : 0;
        const rightScore = right.presetName === selectedReferencePresetName ? 1 : 0;
        return rightScore - leftScore;
      })
      : groupedDiffs;

    return {
      isValid: parsed.version === 1 && importedPresets.length > 0,
      versionLabel: parsed.version != null ? String(parsed.version) : "tanimsiz",
      exportedAtLabel: parsed.exportedAt || "-",
      sourceWorkspaceLabel: parsed.sourceWorkspace || "-",
      operatorLabel: parsed.operatorLabel || "-",
      presetHash: parsed.presetHash || "-",
      presetCount: Array.isArray(parsed.presets) ? parsed.presets.length : 0,
      acceptedCount: importedPresets.length,
      conflictCount,
      newPresetNames,
      overrideNames,
      previewPresetNames,
      selectedReferencePresetName,
      groupedDiffs: orderedGroupedDiffs,
      activeFilterSummary: representativePreset
        ? `Secili telemetry filtresi: ${formatFocusTelemetryFilterSummary(currentFilters)} | Referans preset (${representativePreset.name}): ${formatFocusTelemetryFilterSummary(representativePreset.filters)}`
        : `Secili telemetry filtresi: ${formatFocusTelemetryFilterSummary(currentFilters)}`,
      filterDiffLines,
      summary: importedPresets.length > 0 ? `${importedPresets.length} preset ice aktarim icin hazir` : "Paket gecerli preset icermiyor",
      warnings,
    };
  } catch {
    return {
      isValid: false,
      versionLabel: "okunamadi",
      exportedAtLabel: "-",
      sourceWorkspaceLabel: "-",
      operatorLabel: "-",
      presetHash: "-",
      presetCount: 0,
      acceptedCount: 0,
      conflictCount: 0,
      newPresetNames: [],
      overrideNames: [],
      previewPresetNames: [],
      selectedReferencePresetName: null,
      groupedDiffs: [],
      activeFilterSummary: `Secili telemetry filtresi: ${formatFocusTelemetryFilterSummary(currentFilters)}`,
      filterDiffLines: [],
      summary: "JSON parse edilemedi",
      warnings: ["Paket gecerli JSON degil"],
    };
  }
}

function getRestoreDebugEventMeta(type: RestoreDebugEventType): {
  label: string;
  severity: RestoreDebugSeverity;
  accent: string;
  background: string;
  border: string;
  severityLabel: string;
  severityColor: string;
  severityBackground: string;
} {
  if (type === "restore") {
    return {
      label: "Restore",
      severity: "high",
      accent: "#1d4ed8",
      background: "#eff6ff",
      border: "#bfdbfe",
      severityLabel: "Yuksek Onem",
      severityColor: "#1d4ed8",
      severityBackground: "#dbeafe",
    };
  }
  if (type === "action") {
    return {
      label: "Aksiyon",
      severity: "medium",
      accent: "#b45309",
      background: "#fff7ed",
      border: "#fed7aa",
      severityLabel: "Operator",
      severityColor: "#b45309",
      severityBackground: "#ffedd5",
    };
  }
  return {
    label: "Yasam Dongusu",
    severity: "low",
    accent: "#6d28d9",
    background: "#f5f3ff",
    border: "#ddd6fe",
    severityLabel: "Izleme",
    severityColor: "#6d28d9",
    severityBackground: "#ede9fe",
  };
}

const ReportsTabContent = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).ReportsTabContent,
}));

function ChannelWorkspaceSeedButton({ onSeeded }: { onSeeded: () => void | Promise<void> }) {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const token = getAccessToken();

  async function handleSeed() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/channel-workspace/seed-defaults`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail || "Seed basarisiz");
      }
      const payload = await res.json().catch(() => ({} as {
        seeded_personnel_emails?: string[];
        seeded_personnel_password?: string;
      }));
      const emails = (payload.seeded_personnel_emails || []).slice(0, 4).join(", ");
      const password = payload.seeded_personnel_password || "Aa1234!!";
      if (emails) {
        setMsg(`Oluşturuldu. Personel: ${emails} | Şifre: ${password}`);
      } else {
        setMsg("Kanal varsayilan rolleri ve departmanlari olusturuldu.");
      }
      await onSeeded();
    } catch (err) {
      setMsg("Hata: " + String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page__seed-button-row">
      <button
        type="button"
        onClick={handleSeed}
        disabled={busy}
        className="admin-page__seed-button"
      >
        {busy ? "Olusturuluyor..." : "Varsayilan Kanal Yapisini Olustur"}
      </button>
      {msg && (
        <span
          className={`admin-page__seed-message ${msg.startsWith("Hata") ? "admin-page__seed-message--error" : "admin-page__seed-message--success"}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}

const ChannelReportsTabContent = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).ChannelReportsTabContent,
}));

const PlatformAnalyticsTab = lazy(async () => ({
  default: (await import("./admin/PlatformAnalyticsTab")).PlatformAnalyticsTab,
}));

const PlatformSuppliersTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).PlatformSuppliersTab,
}));

const PublicPricingTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).PublicPricingTab,
}));

const CampaignsTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).CampaignsTab,
}));

const ChannelPartnersAdminTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).ChannelPartnersAdminTab,
}));

const AiLabAdminTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).AiLabAdminTab,
}));

const WorkspacePanelDesignerTab = lazy(async () => ({
  default: (await import("../components/admin/WorkspacePanelDesignerTab")).WorkspacePanelDesignerTab,
}));

const DeploymentPanel = lazy(async () => ({
  default: (await import("../components/admin/DeploymentPanel")).DeploymentPanel,
}));

const TalentAdminControlPage = lazy(async () => ({
  default: (await import("./TalentAdminControlPage")).default,
}));
const PanelDesignerTab = lazy(async () => ({
  default: (await import("./admin/PanelDesignerTab")).default,
}));
const NavManagerTab = lazy(async () => ({
  default: (await import("./admin/NavManagerTab")).default,
}));

// TODO(data): Phase B — panel_home mock data (replace with API when finans servisi hazır)
const PH_OPS_QUEUE = [
  { code: "setup",   label: "Kurulum Kuyruğu",         count: 4, color: "#b45309", desc: "Onboarding tamamlanmayı bekleyen partner.", cta: "Kuruluma git" },
  { code: "owner",   label: "Sorumlu Aksiyonu",         count: 0, color: "#be123c", desc: "Sorumlu ataması yapılmayan bekleyen kayıt yok.", cta: "İncele" },
  { code: "brand",   label: "Marka Kimliği Eksiği",     count: 5, color: "#7c3aed", desc: "Logo veya görünen ad bilgisi eksik partner.", cta: "Logoları tamamla" },
  { code: "passive", label: "Pasif Stratejik Partner",  count: 0, color: "#0f172a", desc: "Duraklatılmış veya pasif durumdaki partner.", cta: "Geçmişi gör" },
] as const;

const PH_SUPPORT_QUEUE = [
  { code: "open",    label: "Açık Destek Kaydı",        count: 2, color: "#1d4ed8", desc: "Yeni veya işlemde olan destek kayıtları.", cta: "Detaya git" },
  { code: "waiting", label: "Sorumlu Bekleyen Destek",  count: 0, color: "#7c3aed", desc: "Platform ekibinin geri dönüşü beklediği kayıtlar.", cta: "Detaya git" },
  { code: "closed",  label: "Kapanışı Tamamlanan",      count: 4, color: "#15803d", desc: "Çözüldü durumuna alınmış kayıtlar.", cta: "Detaya git" },
  { code: "stale",   label: "Teması Geciken Kayıt",     count: 0, color: "#b45309", desc: "3 gün ve üzeri temas edilmeyen aktif kayıtlar.", cta: "Detaya git" },
] as const;

const PH_SUPPORT_SUMMARY = [
  { code: "orphan", label: "Sorumlusuz Destek Kaydı",     value: "0",                                   color: "#be123c", desc: "Operasyon sorumlusu atanmamış aktif kayıt sayısı.", cta: "Detaya git", isPerson: false },
  { code: "top",    label: "En Yoğun Destek Sorumlusu",  value: "Platform Destek Admin · Destek",       color: "#15803d", desc: "1 aktif kayıt", cta: "Detaya git", isPerson: true },
];

const PH_PRIORITY_TENANTS = [
  { name: "BA Demo Stratejik Ortak",  slug: "demo-stratejik-ortak",                           tags: ["Kurulum: bootstrap completed", "Marka kimliği eksik", "Destek: Çözüldü"] },
  { name: "Kanal Ana Yönetici Demo",  slug: "kanal-ana-yonetici-demo",                        tags: ["Kurulum: bootstrap completed", "Marka kimliği eksik", "Destek: Çözüldü"] },
  { name: "BA Demo İş Ortağı",        slug: "demo-kanal-is-ortagi",                           tags: ["Kurulum: bootstrap completed", "Marka kimliği eksik"] },
  { name: "PİZZA MAX",                slug: "pi-zza-max",                                     tags: ["Kurulum: bootstrap completed"] },
  { name: "OLİMPOS TEKNOLOJİ",        slug: "oli-mpos-teknoloji",                             tags: ["Marka kimliği eksik", "Destek: Çözüldü"] },
];

const PH_ALERTS = [
  { id: 1, level: "critical", title: "Doğan Otomotiv",     desc: "Churn risk · 14 gün hareketsiz · Kurumsal plan ₺14.900/ay",  cta: "Müşteri başarıyı uyar" },
  { id: 2, level: "critical", title: "Polat Tekstil",       desc: "Vade aşımı · ₺4.990 + KDV · 2 gün",                          cta: "Tahsilat süreci başlat" },
  { id: 3, level: "warning",  title: "Kurulum Kuyruğu",     desc: "Egem Makina · Bursa Otomasyon · 2 partner SLA içinde",        cta: "Stüdyoya git" },
  { id: 4, level: "warning",  title: "Tetra Holding",       desc: "Sözleşme süresi 14 gün · yenileme süreci başlatılmalı",      cta: "Yenileme paketi gönder" },
];

const PH_MRR_SERIES = [
  { m: "2025-06", mrr: 820000  }, { m: "2025-07", mrr: 894000  }, { m: "2025-08", mrr: 950000  },
  { m: "2025-09", mrr: 1012000 }, { m: "2025-10", mrr: 1068000 }, { m: "2025-11", mrr: 1102000 },
  { m: "2025-12", mrr: 1140000 }, { m: "2026-01", mrr: 1188000 }, { m: "2026-02", mrr: 1207000 },
  { m: "2026-03", mrr: 1241000 }, { m: "2026-04", mrr: 1252000 }, { m: "2026-05", mrr: 1284500 },
];

const PH_NET_GROWTH_SERIES = [
  { m: "2025-12", newMrr: 102000, churn: 64000 },
  { m: "2026-01", newMrr: 124000, churn: 76000 },
  { m: "2026-02", newMrr: 95000,  churn: 76000 },
  { m: "2026-03", newMrr: 118000, churn: 84000 },
  { m: "2026-04", newMrr: 99000,  churn: 88000 },
  { m: "2026-05", newMrr: 132000, churn: 99500 },
];

const PH_PLAN_DISTRIBUTION = [
  { code: "starter",    label: "Başlangıç", count: 11, percent: 26, color: "#94a3b8" },
  { code: "growth",     label: "Gelişim",   count: 22, percent: 52, color: "#2563eb" },
  { code: "enterprise", label: "Kurumsal",  count: 6,  percent: 14, color: "#7c3aed" },
  { code: "custom",     label: "Özel",      count: 3,  percent: 8,  color: "#D4AF37" },
];

const PH_SYSTEM_HEALTH = {
  metrics: [
    { code: "api",     label: "API",         value: "200 OK",      status: "ok"   },
    { code: "db",      label: "DB",          value: "12ms",        status: "ok"   },
    { code: "mail",    label: "MAIL",        value: "SMTP",        status: "ok"   },
    { code: "webhook", label: "WEBHOOK",     value: "3 kuyruk",    status: "ok"   },
    { code: "uptime",  label: "UPTİME 90G", value: "%99.98",      status: "ok"   },
    { code: "backup",  label: "BACKUP",      value: "06:00 ✓",    status: "ok"   },
    { code: "payment", label: "ÖDEME SAĞ.",  value: "3 aktif",    status: "idle" },
    { code: "cdn",     label: "CDN",         value: "Cloudflare",  status: "idle" },
  ],
  domains: [
    { host: "buyerasistans.com.tr", role: "Ana TR vitrini" },
    { host: "buyerasistans.com",    role: "Global EN" },
    { host: "buyerasistans.online", role: "Kampanya" },
    { host: "buyerasistans.info",   role: "Bilgi merkezi" },
  ],
};

// TODO(data): replace with API
const TE_TIERS = [
  { name: "Platin", min: 800, count: 6,  color: "#0ea5e9", perk: "Öncelikli görev + %0 komisyon" },
  { name: "Altın",  min: 600, count: 22, color: "#D4AF37", perk: "Erken görev erişimi + rozet" },
  { name: "Gümüş",  min: 300, count: 41, color: "#94a3b8", perk: "Standart görev havuzu" },
  { name: "Bronz",  min: 0,   count: 55, color: "#b45309", perk: "Onboarding & değerlendirme" },
] as const;

const TE_SKILLS = [
  { k: "Tedarik Analizi",      n: 44 },
  { k: "Kategori Yönetimi",    n: 38 },
  { k: "Pazarlık & Sözleşme",  n: 33 },
  { k: "Lojistik & Operasyon", n: 26 },
  { k: "Hammadde / Kimya",     n: 19 },
  { k: "Sürdürülebilirlik",    n: 12 },
] as const;

const TE_LEADERS = [
  { name: "Emre Şahin",  rep: 740, tasks: 28, earned: 12400, tier: "Altın"  },
  { name: "Aslı Tan",    rep: 520, tasks: 19, earned: 8700,  tier: "Gümüş"  },
  { name: "Nehir Kılıç", rep: 815, tasks: 34, earned: 16850, tier: "Platin" },
  { name: "Deniz Kaya",  rep: 210, tasks: 7,  earned: 3200,  tier: "Bronz"  },
  { name: "Onur Demir",  rep: 660, tasks: 24, earned: 11200, tier: "Altın"  },
] as const;

const TE_PILLARS = [
  { k: "Yetenek Havuzu",  d: "Bağımsız, KYC doğrulamalı satınalma uzmanları. Stratejik Partnerler bu havuzdan iş ve görev için kaynak bulur.", color: "#1d4ed8" },
  { k: "Katkı Ekonomisi", d: "Mikro görevler (tedarikçi keşfi, RFQ zenginleştirme, referans) ile uzmanlar katkı sağlar ve ödül kazanır.",      color: "#7c3aed" },
  { k: "İtibar & Ödül",   d: "Tamamlanan görevler itibar puanına dönüşür; seviye yükseldikçe görev önceliği ve ödül oranı artar.",              color: "#047857" },
] as const;

const TE_TALENTS_INIT = [
  { id: 101, name: "Emre Şahin",   avail: "full_time", exp: 8, rep: 740, earned: 12400, kyc: "approved", skills: ["kategori yönetimi", "sözleşme"]  },
  { id: 102, name: "Deniz Kaya",   avail: "freelance",  exp: 3, rep: 210, earned: 3200,  kyc: "pending",  skills: ["tedarik", "analiz"]              },
  { id: 103, name: "Aslı Tan",     avail: "part_time",  exp: 5, rep: 520, earned: 8700,  kyc: "approved", skills: ["lojistik", "pazarlık"]           },
  { id: 104, name: "Burak Yılmaz", avail: "freelance",  exp: 2, rep: 60,  earned: 450,   kyc: "pending",  skills: ["hammadde"]                       },
];

const TE_TASKS_MOCK = [
  { id: "T-7", title: "Ambalaj tedarikçisi keşfi — 5 firma", type: "supplier_discovery", reward: 750,  subs: 6  },
  { id: "T-8", title: "Lojistik partner referansı",           type: "partner_referral",   reward: 1500, subs: 2  },
  { id: "T-9", title: "RFQ zenginleştirme (kimya)",           type: "rfq_enrichment",     reward: 400,  subs: 11 },
] as const;

const TE_PAYOUTS_INIT = [
  { id: "P-44", name: "Emre Şahin", amount: 3200, method: "IBAN ••4521", status: "pending"  },
  { id: "P-45", name: "Aslı Tan",   amount: 1800, method: "IBAN ••9087", status: "pending"  },
  { id: "P-46", name: "Deniz Kaya", amount: 950,  method: "IBAN ••3344", status: "approved" },
];

const TE_AVAIL_LABEL: Record<string, string> = {
  full_time:     "Tam zamanlı",
  part_time:     "Yarı zamanlı",
  freelance:     "Freelance",
  not_available: "Müsait değil",
};

const TE_TIER_COLORS: Record<string, string>  = { Platin: "#0ea5e9", Altın: "#D4AF37", Gümüş: "#94a3b8", Bronz: "#b45309" };
const TE_TIER_BG:     Record<string, string>  = { Platin: "#e0f2fe", Altın: "#fef9c3", Gümüş: "#f1f5f9", Bronz: "#fef3c7" };

/* ── Discovery Lab Oturum Yönetimi — statik veriler ─────────────────────── */
type DiscFocusItem = {
  id: string; tenant: string; project: string; file: string;
  stage: string; layers: number; qa: string; owner: string;
  age: string; priority: "critical" | "high" | "normal";
};

const DISC_KPI = {
  openSessions: 18, activeChains: 4, replayCount: 142, anomalies: 3, avgDuration: "3 dk 24 sn",
} as const;

const DISC_FOCUSES: DiscFocusItem[] = [
  { id: "AIL-1142", tenant: "ACME Holding",  project: "Kocaeli Fabrika Genişleme",     file: "kocaeli_fabrika_v3.dwg", stage: "soru-cevap", layers: 6,  qa: "3/5",  owner: "Tuba A.",   age: "4 dk",  priority: "high"     },
  { id: "AIL-1141", tenant: "Tetra Holding", project: "İstanbul Lojistik Üssü",         file: "lojistik_us_v8.dxf",     stage: "replay",     layers: 12, qa: "8/8",  owner: "Mehmet T.", age: "38 dk", priority: "critical" },
  { id: "AIL-1140", tenant: "BorTeknik",     project: "Bursa Otomasyon Üretim Hattı",   file: "bursa_otomasyon.dwg",     stage: "çözüldü",    layers: 8,  qa: "4/4",  owner: "Ali D.",    age: "2 sa",  priority: "normal"   },
  { id: "AIL-1139", tenant: "Nova Lojistik", project: "Soğuk Zincir Depo Modülü",       file: "sogukzincir_v2.dwg",      stage: "metraj",     layers: 4,  qa: "0/3",  owner: "Sema Y.",   age: "4 sa",  priority: "high"     },
  { id: "AIL-1138", tenant: "Zümrüt Kimya",  project: "Reaktör Bina Genişletme",         file: "reaktor_v1.dwg",          stage: "anomali",    layers: 7,  qa: "0/12", owner: "—",         age: "6 sa",  priority: "high"     },
];

const DISC_CHAINS = [
  { name: "cad-layer-extractor-v4",  stages: 4, success: 96, lastRun: "4 dk",  duration: "47 sn", desc: "DWG/DXF'ten katman çıkarımı" },
  { name: "metraj-calculator-v3",     stages: 6, success: 92, lastRun: "8 dk",  duration: "32 sn", desc: "Birim bazlı metraj hesabı"    },
  { name: "ai-question-generator-v2", stages: 5, success: 88, lastRun: "14 dk", duration: "21 sn", desc: "Bilişsel soru üretimi"         },
  { name: "rfq-draft-composer-v1",    stages: 3, success: 94, lastRun: "24 dk", duration: "12 sn", desc: "RFQ taslak oluşturma"         },
];

const DISC_TELEMETRY = [
  { time: "14:42:01", actor: "Tuba A.",   source: "ai-lab",  action: "session-open",  detail: "AIL-1142 · ACME · Kocaeli Fabrika"          },
  { time: "14:38:14", actor: "Sistem",    source: "cron",    action: "replay-batch",  detail: "7 zincir tetiklendi · 142 olay"               },
  { time: "14:24:42", actor: "Mehmet T.", source: "ai-lab",  action: "answer-save",   detail: "AIL-1141 · Q-3 onaylandı · S355J2"            },
  { time: "13:56:18", actor: "Sistem",    source: "model",   action: "anomaly-fire",  detail: "Zümrüt Kimya · katman çıkarımında %18 sapma" },
  { time: "13:42:09", actor: "Sema Y.",   source: "ai-lab",  action: "rfq-transfer",  detail: "AIL-1138 → RFQ-2025-1142 oluşturuldu"         },
  { time: "13:18:55", actor: "Sistem",    source: "export",  action: "csv-export",    detail: "Tuba A. · oturum logu indirildi"               },
];

export default function AdminPage() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const tAdmin = usePublicTranslations("admin_tabs", locale, {
    panel_home: "Panel Ana Sayfa",
    platform_operations: "Platform Operasyonları",
    discovery_lab_operations: "Discovery Lab Operasyonları",
    onboarding_studio: "Kurulum Stüdyosu",
    tenant_governance: "Stratejik Partner Yönetimi",
    packages: "Paket ve Kullanım",
    deployment: "Yayınlama",
    platform_analytics: "Platform Analitikleri",
    platform_suppliers: "Platform Tedarikçi Havuzu",
    public_pricing: "Genel Fiyatlandırma",
    campaigns: "Kampanyalar ve Landing",
    commission_admin: "Komisyon Yönetimi",
    support_tickets: "Destek Talepleri",
    settings: "Ayarlar",
    companies: "Firmalar",
    roles: "Roller ve Yetkiler",
    departments: "Departmanlar",
    personnel: "Personeller",
    projects: "Projeler",
    approvals: "Onay Akışları",
    reports: "Raporlar",
    panel_designer: "Panel Tasarımı",
    personal_theme: "Kişisel Tema",
    partner_settings: "Stratejik Partner Ayarları",
    channel_settings: "İş Ortağı Platform Ayarları",
    channel_partners: "İş Ortakları (Kanal)",
    ai_lab: "AI Keşif Lab",
    nav_management: "Navigasyon Yönetimi",
  });
  const isChannelUser = String(user?.scope_type || "").toLowerCase() === "channel"
    || String(user?.business_role || user?.role || "").toLowerCase() === "channel_owner"
    || String(user?.business_role || user?.role || "").toLowerCase() === "channel_agent";

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isUpgradeExtrasPage = location.pathname === "/admin/yukseltme-ekstra-ozellikler";
  const [activeTab, setActiveTab] = useState<AdminTabKey>("panel_home");
  const [channelCatalogRefreshNonce, setChannelCatalogRefreshNonce] = useState(0);
  const [workspacePanelConfig, setWorkspacePanelConfig] = useState<WorkspacePanelConfig | null>(null);
  const [workspacePanelSaving, setWorkspacePanelSaving] = useState(false);
  const [workspacePanelError, setWorkspacePanelError] = useState<string | null>(null);

  // Personnel state
  const [personnel, setPersonnel] = useState<TenantUser[]>([]);
  // ...

  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  // ...

  // Companies state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [overviewQuotes, setOverviewQuotes] = useState<Quote[]>([]);
  const [overviewQuoteTotal, setOverviewQuoteTotal] = useState(0);
  const [catalogRequests, setCatalogRequests] = useState<CatalogRequest[]>([]);
  const [catalogRequestBusyId, setCatalogRequestBusyId] = useState<number | null>(null);
  const [panelHomeRoleName, setPanelHomeRoleName] = useState("");
  const [panelHomeRoleDescription, setPanelHomeRoleDescription] = useState("");
  const [panelHomeDeptName, setPanelHomeDeptName] = useState("");
  const [panelHomeDeptDescription, setPanelHomeDeptDescription] = useState("");
    const loadCatalogRequestsSafe = useCallback(async (): Promise<CatalogRequest[]> => {
      try {
        if (typeof getCatalogRequests !== "function") {
          return [];
        }
        return await getCatalogRequests();
      } catch {
        return [];
      }
    }, []);

  // ...

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantGovernanceSuppliers, setTenantGovernanceSuppliers] = useState<AdminSupplierListItem[]>([]);
  const [channelUsers, setChannelUsers] = useState<TenantUser[]>([]);
  const [tenantForm, setTenantForm] = useState({
    legal_name: "",
    brand_name: "",
    category: "",
    city: "",
    subscription_plan_code: "starter",
    status: "active",
    onboarding_status: "draft",
    initial_admin_full_name: "",
    initial_admin_email: "",
    initial_admin_personal_phone: "",
  });
  const [editingTenantId, setEditingTenantId] = useState<number | null>(null);
  const [isTenantFormModalOpen, setIsTenantFormModalOpen] = useState(false);
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantMessage, setTenantMessage] = useState<string | null>(null);
  const [subscriptionCatalog, setSubscriptionCatalog] = useState<SubscriptionCatalogSnapshot | null>(null);
  const [publicPricingConfig, setPublicPricingConfig] = useState<PublicPricingConfig | null>(null);
  const [premiumFeatureCatalog, setPremiumFeatureCatalog] = useState<Array<{ id: number; code: string; name: string; description?: string | null; monthly_price?: number | null }>>([]);
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [commercialRequests, setCommercialRequests] = useState<CommercialRequestItem[]>([]);
  const [commercialRequestUpdatingId, setCommercialRequestUpdatingId] = useState<number | null>(null);
  const [commercialRequestStatusFilter, setCommercialRequestStatusFilter] = useState<"all" | "new" | "contacted" | "qualified" | "won" | "lost">("all");
  const [commercialRequestOwnerFilter, setCommercialRequestOwnerFilter] = useState<string>("all");
  const [subscriptionAddons, setSubscriptionAddons] = useState<SubscriptionAddonAdminItem[]>([]);
  const [subscriptionAddonUpdatingId, setSubscriptionAddonUpdatingId] = useState<number | null>(null);
  const [subscriptionAddonExpiryDrafts, setSubscriptionAddonExpiryDrafts] = useState<Record<number, string>>({});
  const [subscriptionAddonStatusFilter, setSubscriptionAddonStatusFilter] = useState<"all" | "active" | "cancelled" | "expired">("all");
  const [subscriptionAddonTenantFilter, setSubscriptionAddonTenantFilter] = useState<string>("all");
  const [commercialRequestWebhookSettings, setCommercialRequestWebhookSettings] = useState<CommercialRequestWebhookSettings | null>(null);
  const [commercialRequestWebhookDraft, setCommercialRequestWebhookDraft] = useState({ webhook_url: "", webhook_secret: "" });
  const [commercialRequestWebhookSaving, setCommercialRequestWebhookSaving] = useState(false);
  const [commercialRequestWebhookDeliveries, setCommercialRequestWebhookDeliveries] = useState<CommercialRequestWebhookDelivery[]>([]);
  const [commercialRequestWebhookDeliveryFilter, setCommercialRequestWebhookDeliveryFilter] = useState<"all" | "delivered" | "failed" | "other">("all");
  const [commercialRequestWebhookRetryingId, setCommercialRequestWebhookRetryingId] = useState<number | null>(null);
  const [selectedCommercialRequestWebhookDeliveryId, setSelectedCommercialRequestWebhookDeliveryId] = useState<number | null>(null);
  const [platformOpsNotes, setPlatformOpsNotes] = useState<Record<number, string>>({});
  const [platformOpsOwners, setPlatformOpsOwners] = useState<Record<number, string>>({});
  const [platformOpsStatuses, setPlatformOpsStatuses] = useState<Record<number, string>>({});
  const [platformOpsResolutionReasons, setPlatformOpsResolutionReasons] = useState<Record<number, string>>({});
  const [platformOpsTouchedAt, setPlatformOpsTouchedAt] = useState<Record<number, string>>({});
  const [platformOpsSavingTenantId, setPlatformOpsSavingTenantId] = useState<number | null>(null);
  const [platformOpsStatusFilter, setPlatformOpsStatusFilter] = useState<"all" | "new" | "in_progress" | "waiting_owner" | "resolved">("all");
  const [platformOpsOwnerFilter, setPlatformOpsOwnerFilter] = useState<string>("all");
  const [phKpiOpen, setPhKpiOpen] = useState(false);
  const [teTalents, setTeTalents] = useState<Array<{ id: number; name: string; avail: string; exp: number; rep: number; earned: number; kyc: string; skills: string[] }>>(() => [...TE_TALENTS_INIT]);
  const [tePayouts, setTePayouts] = useState<Array<{ id: string; name: string; amount: number; method: string; status: string }>>(() => [...TE_PAYOUTS_INIT]);
  const [billingSubscriptionFilter, setBillingSubscriptionFilter] = useState<"all" | "active" | "trialing" | "other">("all");
  const [billingInvoiceFilter, setBillingInvoiceFilter] = useState<"all" | "open" | "paid" | "other">("all");
  const [billingWebhookFilter, setBillingWebhookFilter] = useState<"all" | "processed" | "failed" | "other">("all");
  const [billingWebhookRetryingEventId, setBillingWebhookRetryingEventId] = useState<number | null>(null);
  const [packagePlanFilter, setPackagePlanFilter] = useState<string>("all");
  const [packageRiskFilter, setPackageRiskFilter] = useState<"all" | "pressure" | "breach">("all");
  const [tenantUsageFilter, setTenantUsageFilter] = useState<"all" | "pressure" | "breach">("all");
  const [tenantSortMode, setTenantSortMode] = useState<"risk" | "name">("risk");
  const [tenantCategoryFilter, setTenantCategoryFilter] = useState<string>("all");
  const [, setDiscoveryLabSessions] = useState<DiscoveryLabSessionSummary[]>([]);
  const [discoveryLabSummary, setDiscoveryLabSummary] = useState<DiscoveryLabSummary>({
    total_sessions: 0,
    locked_sessions: 0,
    quote_ready_sessions: 0,
    active_project_count: 0,
    answer_audit_count: 0,
  });
  const [discoveryLabAnswerAudits, setDiscoveryLabAnswerAudits] = useState<DiscoveryLabAnswerAuditSummary[]>([]);
  const [onboardingStudioSummary, setOnboardingStudioSummary] = useState<OnboardingStudioSummary>(EMPTY_ONBOARDING_STUDIO_SUMMARY);
  const [onboardingMembershipActionTenantId, setOnboardingMembershipActionTenantId] = useState<number | null>(null);
  const discoveryLabStatusFilter: "all" | "analyzed" | "technical_locked" = "all";
  const [discoveryLabProjectQuery, setDiscoveryLabProjectQuery] = useState("");
  const [discoveryLabUserQuery, setDiscoveryLabUserQuery] = useState("");
  const [discoveryLabDateFrom, setDiscoveryLabDateFrom] = useState("");
  const [discoveryLabDateTo, setDiscoveryLabDateTo] = useState("");
  const [discoveryLabSearch, setDiscoveryLabSearch] = useState("");
  const [discoveryLabAuditDecisionFilter, setDiscoveryLabAuditDecisionFilter] = useState<"all" | "approved" | "ignored" | "needs_review">("all");
  const [expandedDiscoveryQuoteInsightId, setExpandedDiscoveryQuoteInsightId] = useState<number | null>(null);
  const [discoveryQuoteHistoryById, setDiscoveryQuoteHistoryById] = useState<Record<number, StatusLog[]>>({});
  const [discoveryQuoteAuditTrailById, setDiscoveryQuoteAuditTrailById] = useState<Record<number, QuoteAuditTrail>>({});
  const [discoveryQuotePendingApprovalsById, setDiscoveryQuotePendingApprovalsById] = useState<Record<number, QuotePendingApproval[]>>({});
  const [discoveryQuoteById, setDiscoveryQuoteById] = useState<Record<number, Quote>>({});
  const [discoveryQuoteInsightLoadingId, setDiscoveryQuoteInsightLoadingId] = useState<number | null>(null);
  const [discoveryQuoteInsightErrorById, setDiscoveryQuoteInsightErrorById] = useState<Record<number, string>>({});
  const [restoredQuoteInsight, setRestoredQuoteInsight] = useState<{ quoteId: number; section: "status-history" | "full-audit-trail" } | null>(null);
  const [showRestoredQuoteToast, setShowRestoredQuoteToast] = useState(false);
  const [restoredQuoteToastProgress, setRestoredQuoteToastProgress] = useState(100);
  const [restoredQuoteToastRemainingMs, setRestoredQuoteToastRemainingMs] = useState(4500);
  const [isRestoredQuoteToastPaused, setIsRestoredQuoteToastPaused] = useState(false);
  const [restoredQuoteDebugEvents, setRestoredQuoteDebugEvents] = useState<RestoreDebugEvent[]>([]);
  const [restoredQuoteDebugFilter, setRestoredQuoteDebugFilter] = useState<"all" | RestoreDebugEventType>("all");
  const [restoredQuoteDebugSearchQuery, setRestoredQuoteDebugSearchQuery] = useState("");
  const [restoredQuoteDebugReplayFilter, setRestoredQuoteDebugReplayFilter] = useState<"all" | "last-replay-chain">("all");
  const [restoredQuoteReplayTarget, setRestoredQuoteReplayTarget] = useState<"status-history" | "full-audit-trail">("full-audit-trail");
  const [isRestoredQuoteDebugTimelineHidden, setIsRestoredQuoteDebugTimelineHidden] = useState(false);
  const [focusTelemetryExport, setFocusTelemetryExport] = useState<string | null>(null);
  const [focusTelemetryCsvExport, setFocusTelemetryCsvExport] = useState<string | null>(null);
  const [focusTelemetrySourceFilter, setFocusTelemetrySourceFilter] = useState<string>(buildFocusTelemetryFilterSnapshot(searchParams).source);
  const [focusTelemetryWindowFilter, setFocusTelemetryWindowFilter] = useState<"all" | "15m">(buildFocusTelemetryFilterSnapshot(searchParams).window);
  const [focusTelemetrySearchQuery, setFocusTelemetrySearchQuery] = useState(buildFocusTelemetryFilterSnapshot(searchParams).search);
  const [focusTelemetrySelectedEventId, setFocusTelemetrySelectedEventId] = useState<string | null>(null);
  const [focusTelemetryPresetName, setFocusTelemetryPresetName] = useState("");
  const [focusTelemetryPresets, setFocusTelemetryPresets] = useState<FocusTelemetryPreset[]>([]);
  const [focusTelemetryEditingPresetId, setFocusTelemetryEditingPresetId] = useState<string | null>(null);
  const [focusTelemetryPresetDraftName, setFocusTelemetryPresetDraftName] = useState("");
  const [focusTelemetryPresetPackageText, setFocusTelemetryPresetPackageText] = useState("");
  const [focusTelemetryPreviewPresetName, setFocusTelemetryPreviewPresetName] = useState<string | null>(null);
  const [focusTelemetryActionStatus, setFocusTelemetryActionStatus] = useState<FocusTelemetryActionStatus | null>(null);
  const [focusTelemetryActionHistory, setFocusTelemetryActionHistory] = useState<FocusTelemetryActionHistoryItem[]>([]);
  const [focusTelemetryActionHistoryFilter, setFocusTelemetryActionHistoryFilter] = useState<"all" | "export" | "preset" | "navigation">("all");
  const [focusTelemetryActionHistoryWindow, setFocusTelemetryActionHistoryWindow] = useState<FocusTelemetryActionHistoryWindow>("all");
  const [focusTelemetryActionHistorySearch, setFocusTelemetryActionHistorySearch] = useState("");
  const [telemetryPulseTarget, setTelemetryPulseTarget] = useState<TelemetryPulseTarget | null>(null);
  const [focusTelemetryReturnedEventId, setFocusTelemetryReturnedEventId] = useState<string | null>(null);
  const [focusTelemetryReturnedEventProgress, setFocusTelemetryReturnedEventProgress] = useState(100);
  const [focusTelemetryReturnedEventRemainingMs, setFocusTelemetryReturnedEventRemainingMs] = useState(2200);
  const [isFocusTelemetryReturnPaused, setIsFocusTelemetryReturnPaused] = useState(false);
  const [tenantGovernanceFocus, setTenantGovernanceFocus] = useState<{ tenantId?: number | null; tenantName?: string | null } | null>(null);
  const discoveryQuoteStatusHistoryRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const discoveryQuoteAuditTrailRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const discoveryQuoteCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const focusTelemetryEventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const platformOpsQueueRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const packagePlanRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const addonCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const packageUsageRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const subscriptionUpgradeSectionRef = useRef<HTMLDivElement | null>(null);

  const setAddonCardRef = useCallback((key: string, node: HTMLDivElement | null) => {
    addonCardRefs.current[key] = node;
  }, [addonCardRefs]);

  const setSubscriptionUpgradeSectionRef = useCallback((node: HTMLDivElement | null) => {
    subscriptionUpgradeSectionRef.current = node;
  }, [subscriptionUpgradeSectionRef]);

  const setPackagePlanRef = useCallback((code: string, node: HTMLDivElement | null) => {
    packagePlanRefs.current[code] = node;
  }, [packagePlanRefs]);
  const focusTelemetryPanelRef = useRef<HTMLDivElement | null>(null);
  const focusTelemetryStatusTimeoutRef = useRef<number | null>(null);
  const focusTelemetryAutoRevealKeyRef = useRef<string | null>(null);
  const focusTelemetryPulseTimeoutRef = useRef<number | null>(null);
  const focusTelemetryReturnedEventIntervalRef = useRef<number | null>(null);
  const focusTelemetryReturnedEventLastTickRef = useRef<number | null>(null);
  const focusTelemetryReturnedEventRemainingRef = useRef(2200);
  const restoredQuoteToastRef = useRef<HTMLDivElement | null>(null);
  const restoredQuoteDebugEventCounter = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEditTenantGovernance = canManageTenantGovernance(user);
    useEffect(() => {
      if (searchParams.get("focus") !== "subscription-upgrade") return;
      if (activeTab !== "panel_home") {
        setActiveTab("panel_home");
        return;
      }
      const targetPlan = searchParams.get("packagePlan");
      if (targetPlan && packagePlanRefs.current[targetPlan]) {
        packagePlanRefs.current[targetPlan]?.scrollIntoView?.({ block: "center", behavior: "auto" });
        return;
      }
      subscriptionUpgradeSectionRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
    }, [activeTab, searchParams]);

  const isPlatformStaff = isPlatformStaffUser(user);
  const canAccessAdminWorkspace = canAccessAdminSurface(user);
  const canAccessRoleCatalog = canManageRoleCatalog(user);
  const canViewPlatformGovernance = isPlatformStaff || isSuperAdminUser(user);
  const canViewPackagesTab = isSuperAdminUser(user);
  const canViewSupplierProfileTab = isTenantAdminUser(user) && !canViewPlatformGovernance;
  const canViewKariyerYonetimiTab = isSuperAdminUser(user) || isIkAdminUser(user);
  const canViewSettingsTab = canAccessProcurementSettings(user);
  const showSettingsWorkspaceLinks = !canViewPlatformGovernance && (canViewSettingsTab || isChannelUser);
  const isLocalhostRuntime = typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const canViewDeploymentTab = isLocalhostRuntime && isSuperAdminUser(user);
  const workspaceName = user?.organization_name || user?.platform_name || "Buyera Asistans";
  const mergedWorkspacePanelConfig = useMemo(() => mergeWorkspacePanelConfig(workspacePanelConfig), [workspacePanelConfig]);
  const activeWorkspacePanelProfile = useMemo(() => resolveWorkspacePanelProfile(user, mergedWorkspacePanelConfig), [mergedWorkspacePanelConfig, user]);
  const isRoleManagementOnly = canAccessRoleCatalog && !canAccessAdminWorkspace;
  const canOpenWorkspacePanel = (!isRoleManagementOnly && canAccessWorkspacePanel(user)) || Boolean(activeWorkspacePanelProfile);
  const workspacePanelQuickLinks = useMemo(() => getWorkspacePanelQuickLinks(activeWorkspacePanelProfile), [activeWorkspacePanelProfile]);

  useEffect(() => {
    if (activeTab !== "tenant_governance") return;
    if (!canViewPlatformGovernance) return;
    if (canEditTenantGovernance) return;
    setIsTenantFormModalOpen(true);
  }, [activeTab, canViewPlatformGovernance, canEditTenantGovernance]);

  const telemetryPresetUserKey = buildFocusTelemetryPresetUserKey(user?.email, user?.id);
  const platformOpsDefaultOwner = user?.full_name || user?.email || workspaceName;
  const currentUserRoleLabel = getUserDisplayRoleLabel(user);
  const totalActivePersonnel = personnel.filter((item) => item.is_active).length;
  const totalPassivePersonnel = personnel.length - totalActivePersonnel;
  const totalActiveCompanies = companies.filter((item) => item.is_active).length;
  const totalPassiveCompanies = companies.length - totalActiveCompanies;
  const totalActiveProjects = projects.filter((item) => item.is_active).length;
  const totalPassiveProjects = projects.length - totalActiveProjects;
  const panelHomePlatformMetrics = useMemo(() => {
    const channelTenantIds = new Set(channelUsers.map((user) => user.tenant_id).filter((id): id is number => typeof id === "number"));
    const partnerCompanies = companies.filter((company) => company.tenant_id != null && !channelTenantIds.has(company.tenant_id));
    const channelCompanies = companies.filter((company) => company.tenant_id != null && channelTenantIds.has(company.tenant_id));
    const partnerCompanyIds = new Set(partnerCompanies.map((company) => company.id));
    const channelCompanyIds = new Set(channelCompanies.map((company) => company.id));
    const partnerTenantIds = new Set(partnerCompanies.map((company) => company.tenant_id).filter((id): id is number => typeof id === "number"));
    const channelTenantIdSet = new Set(channelCompanies.map((company) => company.tenant_id).filter((id): id is number => typeof id === "number"));
    const partnerPersonnel = personnel.filter((person) => person.is_active && person.tenant_id != null && partnerTenantIds.has(person.tenant_id));
    const channelPersonnel = personnel.filter((person) => person.is_active && person.tenant_id != null && channelTenantIdSet.has(person.tenant_id));

    const partnerActiveCompanies = partnerCompanies.filter((c) => c.is_active).length;
    const partnerPassiveCompanies = partnerCompanies.filter((c) => !c.is_active).length;
    const channelActiveCompanies = channelCompanies.filter((c) => c.is_active).length;
    const channelPassiveCompanies = channelCompanies.filter((c) => !c.is_active).length;
    const supplierActiveCompanies = tenantGovernanceSuppliers.filter((s) => s.is_active !== false).length;
    const supplierPassiveCompanies = tenantGovernanceSuppliers.filter((s) => s.is_active === false).length;

    const partnerProjects = projects.filter((project) => typeof project.company_id === "number" && partnerCompanyIds.has(project.company_id));
    const channelProjects = projects.filter((project) => typeof project.company_id === "number" && channelCompanyIds.has(project.company_id));
    const companyIdByProjectId = new Map(projects.map((project) => [project.id, project.company_id]));
    const activeQuotes = overviewQuotes.filter((quote) => quote.is_active !== false);

    const partnerQuoteCount = activeQuotes.filter((quote) => {
      const companyId = companyIdByProjectId.get(quote.project_id);
      return typeof companyId === "number" && partnerCompanyIds.has(companyId);
    }).length;
    const channelQuoteCount = activeQuotes.filter((quote) => {
      const companyId = companyIdByProjectId.get(quote.project_id);
      return typeof companyId === "number" && channelCompanyIds.has(companyId);
    }).length;
    const supplierRespondedQuoteCount = activeQuotes.filter((quote) => Number(quote.responded_supplier_count || 0) > 0).length;
    const supplierRevisedQuoteCount = activeQuotes.filter((quote) => {
      const reason = String(quote.transition_reason || "").toLowerCase();
      return Number(quote.version || 1) > 1 || reason.includes("reviz");
    }).length;

    return {
      partnerCompanies: partnerCompanies.length,
      partnerActiveCompanies,
      partnerPassiveCompanies,
      partnerPersonnel: partnerPersonnel.length,
      partnerProjects: partnerProjects.length,
      partnerQuotes: partnerQuoteCount,
      supplierCompanies: tenantGovernanceSuppliers.length,
      supplierActiveCompanies,    // ← bu satırı ekle
      supplierPassiveCompanies,   // ← bu satırı ekle
      supplierRespondedQuotes: supplierRespondedQuoteCount,
      supplierRevisedQuotes: supplierRevisedQuoteCount,
      channelCompanies: channelCompanies.length,
      channelActiveCompanies,
      channelPassiveCompanies,
      channelPersonnel: channelPersonnel.length,
      channelProjects: channelProjects.length,
      channelQuotes: channelQuoteCount,
    };

  }, [channelUsers, companies, overviewQuotes, personnel, projects, tenantGovernanceSuppliers]);
  const currentTenantUsage = useMemo(() => {
    const usageRows = subscriptionCatalog?.tenant_usage || [];
    return usageRows.find((item) => item.tenant_name === workspaceName && item.is_active)
      || usageRows.find((item) => item.tenant_name === workspaceName)
      || usageRows.find((item) => item.is_active)
      || null;
  }, [subscriptionCatalog, workspaceName]);
  const currentTenantPlan = useMemo(() => {
    if (!currentTenantUsage) return null;
    return (subscriptionCatalog?.catalog.plans || []).find((plan) => plan.code === currentTenantUsage.plan_code) || null;
  }, [currentTenantUsage, subscriptionCatalog]);
  const currentPlanLabel = currentTenantUsage?.plan_name || currentTenantPlan?.name || currentTenantUsage?.plan_code || null;
  const strategicPricingPlans = useMemo(() => (publicPricingConfig?.strategic_partner?.plans || []), [publicPricingConfig]);
  const strategicPricingAddons = useMemo(() => (publicPricingConfig?.strategic_partner?.addons || []), [publicPricingConfig]);
  const currentTenantQuoteCount = useMemo(() => {
    const ids = new Set(
      discoveryLabAnswerAudits
        .map((item) => item.quote_id)
        .filter((value): value is number => typeof value === "number"),
    );
    return ids.size || discoveryLabSummary.quote_ready_sessions || 0;
  }, [discoveryLabAnswerAudits, discoveryLabSummary.quote_ready_sessions]);
  const purchasedServiceCards = useMemo<ServiceUsageCard[]>(() => {
    const metricMap = new Map((currentTenantUsage?.metrics || []).map((metric) => [metric.key, metric]));
    const pickMetric = (...keys: string[]) => keys.map((key) => metricMap.get(key)).find(Boolean);
    const activeCompanyMetric = pickMetric("max_active_companies", "active_companies");
    const activeProjectMetric = pickMetric("max_active_projects", "active_projects");
    const activeUserMetric = pickMetric("max_active_internal_users", "active_internal_users");
    const supplierMetric = pickMetric("max_active_private_suppliers", "active_private_suppliers", "private_suppliers");
    const quoteMetric = pickMetric("max_active_rfqs", "active_quotes");
    const fileMetric = pickMetric("max_project_files_total", "project_files_total");
    const fileSizeMetric = pickMetric("max_project_file_size_mb", "project_file_size_mb");
    const activeProjectCount = projects.filter((item) => item.is_active).length;
    const passiveProjectCount = projects.filter((item) => !item.is_active).length;

    const buildRemaining = (used?: number | null, limit?: number | null) => {
      if (limit == null || used == null) return undefined;
      return Math.max(limit - used, 0);
    };

    return [
      {
        key: "metric-companies",
        title: "Firma Yönetimi",
        note: "Pakete dahil aktif firma kapasitesi ve pasif firma dağılımı.",
        activeCount: activeCompanyMetric?.used ?? totalActiveCompanies,
        passiveCount: totalPassiveCompanies,
        usedCount: activeCompanyMetric?.used ?? totalActiveCompanies,
        limitCount: activeCompanyMetric?.limit ?? undefined,
        remainingCount: buildRemaining(activeCompanyMetric?.used ?? totalActiveCompanies, activeCompanyMetric?.limit ?? undefined),
        unit: activeCompanyMetric?.unit || "firma",
      },
      {
        key: "metric-rfq",
        title: translateServiceLabel("RFQ (Teklif İsteme Formu) Yönetimi"),
        note: "Hazırlanabilecek, tedarikçiye çıkılabilecek ve onay akışına alınabilecek toplam teklif sayısı.",
        usedCount: quoteMetric?.used ?? overviewQuoteTotal,
        limitCount: quoteMetric?.limit ?? undefined,
        remainingCount: buildRemaining(quoteMetric?.used ?? overviewQuoteTotal, quoteMetric?.limit ?? undefined),
        unit: quoteMetric?.unit || "teklif",
      },
      {
        key: "metric-supplier-portal",
        title: translateServiceLabel("Tedarikçi Portalı"),
        note: "Pakete bağlı olarak yönetilebilecek aktif tedarikçi sayısı.",
        usedCount: supplierMetric?.used,
        limitCount: supplierMetric?.limit ?? undefined,
        remainingCount: buildRemaining(supplierMetric?.used, supplierMetric?.limit ?? undefined),
        unit: supplierMetric?.unit || "tedarik?i",
      },
      {
        key: "metric-projects",
        title: translateServiceLabel("Proje Yönetimi"),
        note: "Aktif ve pasif proje dağılımı ile planın tanıdığı toplam aktif proje kapasitesi.",
        activeCount: activeProjectMetric?.used ?? activeProjectCount,
        passiveCount: passiveProjectCount,
        usedCount: activeProjectMetric?.used ?? activeProjectCount,
        limitCount: activeProjectMetric?.limit ?? undefined,
        remainingCount: buildRemaining(activeProjectMetric?.used ?? activeProjectCount, activeProjectMetric?.limit ?? undefined),
        unit: activeProjectMetric?.unit || "proje",
      },
      {
        key: "metric-users",
        title: translateServiceLabel("Kullanıcı Yönetimi"),
        note: "Aktif ve pasif ekip dağılımı ile planın tanıdığı toplam aktif kullanıcı kapasitesi.",
        activeCount: activeUserMetric?.used ?? totalActivePersonnel,
        passiveCount: totalPassivePersonnel,
        usedCount: activeUserMetric?.used ?? totalActivePersonnel,
        limitCount: activeUserMetric?.limit ?? undefined,
        remainingCount: buildRemaining(activeUserMetric?.used ?? totalActivePersonnel, activeUserMetric?.limit ?? undefined),
        unit: activeUserMetric?.unit || "kullanici",
      },
      {
        key: "metric-project-files",
        title: translateServiceLabel("Proje Dosya Yukleme"),
        note: fileSizeMetric?.limit ? `Her bir dosya icin ust boyut: ${fileSizeMetric.limit} ${fileSizeMetric.unit || "MB"}.` : "Proje dosya adedi ve dosya boyutu paket limitine baglidir.",
        usedCount: fileMetric?.used,
        limitCount: fileMetric?.limit ?? undefined,
        remainingCount: buildRemaining(fileMetric?.used, fileMetric?.limit ?? undefined),
        unit: fileMetric?.unit || "dosya",
      },
    ].filter((card) => card.usedCount != null || card.limitCount != null || card.activeCount != null);
  }, [currentTenantUsage, overviewQuoteTotal, projects, totalActiveCompanies, totalActivePersonnel, totalPassiveCompanies, totalPassivePersonnel]);
  const packageTierCards = useMemo(() => {
    const normalizeLimitKey = (rawKey: string | null | undefined): string => {
      const key = String(rawKey || "").trim().toLowerCase();
      const map: Record<string, string> = {
        active_companies: "max_active_companies",
        active_internal_users: "max_active_internal_users",
        active_projects: "max_active_projects",
        active_private_suppliers: "max_active_private_suppliers",
        active_quotes: "max_active_rfqs",
        project_files_total: "max_project_files_total",
        project_file_size_mb: "max_project_file_size_mb",
      };
      return map[key] || key;
    };

    const strategicPlans: PricingPlanCard[] = strategicPricingPlans.length > 0
      ? strategicPricingPlans
      : (subscriptionCatalog?.catalog.plans || [])
        .filter((plan) => plan.audience === "strategic_partner")
        .map((plan) => ({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          price_monthly: undefined,
          currency: undefined,
          limits: Object.fromEntries(
            plan.modules
              .filter((module) => module.limit_key && module.limit_value != null)
              .map((module) => [normalizeLimitKey(module.limit_key), Number(module.limit_value)]),
          ),
          features: plan.modules.map((module) => module.name),
        }));

    const normalizeHighlights = (plan: PricingPlanCard) => [
      `Firma limiti: ${plan.limits?.max_active_companies ?? plan.limits?.active_companies ?? "-"} firma`,
      `Kullanıcı limiti: ${plan.limits?.max_active_internal_users ?? plan.limits?.active_internal_users ?? "-"} kullanıcı`,
      `Proje limiti: ${plan.limits?.max_active_projects ?? plan.limits?.active_projects ?? "-"} proje`,
      `Tedarikçi limiti: ${plan.limits?.max_active_private_suppliers ?? plan.limits?.active_private_suppliers ?? "-"} tedarikçi`,
      `Teklif limiti: ${plan.limits?.max_active_rfqs ?? plan.limits?.active_quotes ?? "-"} teklif`,
      `Dosya limiti: ${plan.limits?.max_project_files_total ?? plan.limits?.project_files_total ?? "-"} dosya`,
      `Tek dosya boyutu: ${plan.limits?.max_project_file_size_mb ?? plan.limits?.project_file_size_mb ?? "-"} MB`,
    ];

    return strategicPlans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      currency: plan.currency,
      isCurrent: currentTenantPlan?.code === plan.code,
      highlights: normalizeHighlights(plan),
      features: plan.features || [],
    }));
  }, [currentTenantPlan, strategicPricingPlans, subscriptionCatalog]);
  const currentPackageCard = useMemo(() => packageTierCards.find((plan) => plan.isCurrent) || packageTierCards[0] || null, [packageTierCards]);
  const upgradePackageCards = useMemo(() => {
    if (!currentPackageCard) return packageTierCards;
    const currentIndex = packageTierCards.findIndex((plan) => plan.code === currentPackageCard.code);
    return currentIndex >= 0 ? packageTierCards.slice(currentIndex + 1) : packageTierCards;
  }, [currentPackageCard, packageTierCards]);
  const addonCards = useMemo(() => {
    const configAddons = strategicPricingAddons.map((addon) => ({
      key: addon.code,
      name: addon.name,
      description: addon.description || "",
      priceLabel: addon.price_monthly ? `${addon.price_monthly.toLocaleString("tr-TR")} ${addon.currency || "TRY"} / ay` : "Fiyatlandirma tanimsiz",
      incrementLabel: addon.increment && addon.unit ? `Her alim: +${addon.increment} ${addon.unit}` : null,
      detailLines: addon.visibility_notes || [],
    }));

    const premiumAddons = premiumFeatureCatalog.map((feature) => ({
      key: `premium-${feature.code}`,
      name: feature.name,
      description: feature.description || "",
      priceLabel: feature.monthly_price ? `${Number(feature.monthly_price).toLocaleString("tr-TR")} TRY / ay` : "Fiyatlandirma super admin tarafinda tanimlanir",
      incrementLabel: "Ozellik bazli aktivasyon",
      detailLines: [
        feature.code === "special_listing"
          ? "Özel listeleme aktif olduğunda teklifleriniz daha geniş tedarikçi kitlesine açılır ve tedarikçileri inceleyerek ek teklif toplayabilirsiniz."
          : "Bu ozellik tenant bazinda aktiflestirilir ve paket uzerine eklenir.",
        feature.code === "special_listing"
          ? "Firma vitrinde ozel listeleme alaninda gozukebilir ve gorunurlugu artar."
          : "Birim maliyeti ust pakete gecise gore daha yuksek tutulabilir.",
      ],
    }));

    return [...configAddons, ...premiumAddons].filter((item, index, source) => source.findIndex((candidate) => candidate.name === item.name) === index);
  }, [premiumFeatureCatalog, strategicPricingAddons]);
  const strategicAddonCatalog = useMemo(() => strategicPricingAddons.map((addon) => ({
    code: addon.code,
    name: addon.name,
    description: addon.description || null,
    price_monthly: typeof addon.price_monthly === "number" ? addon.price_monthly : Number(addon.price_monthly || 0),
    currency: addon.currency || "TRY",
    increment: typeof addon.increment === "number" ? addon.increment : Number(addon.increment || 1),
    unit: addon.unit || null,
  })), [strategicPricingAddons]);
  const commercialRequestOwnerOptions = useMemo(() => {
    const values = Array.from(new Set(commercialRequests.map((item) => (item.owner_name || "").trim()).filter(Boolean)));
    return values.sort((left, right) => left.localeCompare(right, "tr"));
  }, [commercialRequests]);
  const commercialRequestSummary = useMemo(() => ({
    all: commercialRequests.length,
    new: commercialRequests.filter((item) => item.status === "new").length,
    contacted: commercialRequests.filter((item) => item.status === "contacted").length,
    qualified: commercialRequests.filter((item) => item.status === "qualified").length,
    won: commercialRequests.filter((item) => item.status === "won").length,
    lost: commercialRequests.filter((item) => item.status === "lost").length,
  }), [commercialRequests]);
  const filteredCommercialRequests = useMemo(() => commercialRequests.filter((item) => {
    const matchesStatus = commercialRequestStatusFilter === "all" || item.status === commercialRequestStatusFilter;
    const ownerName = (item.owner_name || "").trim();
    const matchesOwner = commercialRequestOwnerFilter === "all"
      || (commercialRequestOwnerFilter === "__unassigned__" ? ownerName.length === 0 : ownerName === commercialRequestOwnerFilter);
    return matchesStatus && matchesOwner;
  }), [commercialRequestOwnerFilter, commercialRequestStatusFilter, commercialRequests]);
  const subscriptionAddonTenantOptions = useMemo(() => {
    const values = Array.from(new Set(subscriptionAddons.map((item) => (item.tenant_name || "").trim()).filter(Boolean)));
    return values.sort((left, right) => left.localeCompare(right, "tr"));
  }, [subscriptionAddons]);
  const filteredSubscriptionAddons = useMemo(() => subscriptionAddons.filter((item) => {
    const matchesStatus = subscriptionAddonStatusFilter === "all" || item.status === subscriptionAddonStatusFilter;
    const tenantName = (item.tenant_name || "").trim();
    const matchesTenant = subscriptionAddonTenantFilter === "all" || tenantName === subscriptionAddonTenantFilter;
    return matchesStatus && matchesTenant;
  }), [subscriptionAddonStatusFilter, subscriptionAddonTenantFilter, subscriptionAddons]);

  useEffect(() => {
    let mounted = true;
    void getWorkspacePanelConfig()
      .then((config) => {
        if (!mounted) return;
        setWorkspacePanelConfig(config);
        setWorkspacePanelError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setWorkspacePanelError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSaveWorkspacePanels(nextConfig: WorkspacePanelConfig) {
    try {
      setWorkspacePanelSaving(true);
      const saved = await updateWorkspacePanelConfig(nextConfig);
      setWorkspacePanelConfig(saved);
      setWorkspacePanelError(null);
    } catch (err) {
      setWorkspacePanelError(String(err));
    } finally {
      setWorkspacePanelSaving(false);
    }
  }
  async function handleCommercialRequestStatusUpdate(
    requestId: number,
    status: "contacted" | "qualified" | "won" | "lost",
    options?: { ownerName?: string; markContactedNow?: boolean },
  ) {
    try {
      setCommercialRequestUpdatingId(requestId);
      const updated = await updateCommercialRequestStatus(requestId, {
        status,
        owner_name: options?.ownerName,
        mark_contacted_now: options?.markContactedNow,
      });
      setCommercialRequests((current) => current.map((item) => (
        item.id === requestId
          ? {
            ...item,
            status: updated.status,
            review_note: updated.review_note ?? item.review_note,
            owner_name: updated.owner_name ?? item.owner_name,
            last_contacted_at: updated.last_contacted_at ?? item.last_contacted_at,
            reviewed_at: updated.reviewed_at ?? item.reviewed_at,
          }
          : item
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommercialRequestUpdatingId(null);
    }
  }
  async function handleAssignCommercialRequest(requestId: number) {
    const ownerName = user?.full_name || user?.email || "Platform Ops";
    try {
      setCommercialRequestUpdatingId(requestId);
      const current = commercialRequests.find((item) => item.id === requestId);
      const updated = await updateCommercialRequestStatus(requestId, {
        status: current?.status || "new",
        owner_name: ownerName,
      });
      setCommercialRequests((rows) => rows.map((item) => item.id === requestId ? {
        ...item,
        owner_name: updated.owner_name ?? ownerName,
        reviewed_at: updated.reviewed_at ?? item.reviewed_at,
      } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommercialRequestUpdatingId(null);
    }
  }
  async function handleSubscriptionAddonLifecycle(
    addonId: number,
    payload: { action: string; expires_at?: string; extension_days?: number },
  ) {
    try {
      setSubscriptionAddonUpdatingId(addonId);
      const updated = await updateSubscriptionAddonLifecycle(addonId, payload);
      setSubscriptionAddons((current) => current.map((item) => item.id === addonId ? {
        ...item,
        status: updated.status,
        expires_at: updated.expires_at ?? item.expires_at,
      } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubscriptionAddonUpdatingId(null);
    }
  }
  async function handleSaveCommercialRequestWebhookSettings() {
    try {
      setCommercialRequestWebhookSaving(true);
      const saved = await updateCommercialRequestWebhookSettings({
        webhook_url: commercialRequestWebhookDraft.webhook_url.trim() || null,
        webhook_secret: commercialRequestWebhookDraft.webhook_secret.trim() || undefined,
        clear_webhook_secret: false,
      });
      setCommercialRequestWebhookSettings(saved);
      setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_url: saved.webhook_url || "", webhook_secret: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommercialRequestWebhookSaving(false);
    }
  }
  async function handleClearCommercialRequestWebhookSecret() {
    try {
      setCommercialRequestWebhookSaving(true);
      const saved = await updateCommercialRequestWebhookSettings({
        webhook_url: commercialRequestWebhookDraft.webhook_url.trim() || null,
        clear_webhook_secret: true,
      });
      setCommercialRequestWebhookSettings(saved);
      setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_url: saved.webhook_url || "", webhook_secret: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommercialRequestWebhookSaving(false);
    }
  }
  async function handleRetryCommercialRequestWebhookDelivery(deliveryId: number) {
    try {
      setCommercialRequestWebhookRetryingId(deliveryId);
      const saved = await retryCommercialRequestWebhookDelivery(deliveryId);
      setCommercialRequestWebhookDeliveries((current) => current.map((item) => item.id === deliveryId ? saved : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommercialRequestWebhookRetryingId(null);
    }
  }
  const navigateAdminTab = useCallback((tab: AdminTabKey, nextEntries?: Record<string, string>) => {
    let nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    Object.entries(nextEntries || {}).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    });
    nextParams = applyFocusTelemetryParams(nextParams, {
      source: focusTelemetrySourceFilter,
      window: focusTelemetryWindowFilter,
      search: focusTelemetrySearchQuery,
    });
    nextParams = applyFocusTelemetryActionHistoryParams(nextParams, buildFocusTelemetryActionHistoryFilterSnapshot(
      focusTelemetryActionHistoryFilter,
      focusTelemetryActionHistoryWindow,
      focusTelemetryActionHistorySearch,
    ));
    setActiveTab(tab);
    if (isUpgradeExtrasPage) {
      navigate(`/admin?${nextParams.toString()}`);
      return;
    }
    setSearchParams(nextParams);
  }, [focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow, focusTelemetrySearchQuery, focusTelemetrySourceFilter, focusTelemetryWindowFilter, isUpgradeExtrasPage, navigate, searchParams, setSearchParams]);

  const openTenantGovernanceTab = useCallback((tenantId?: number | null, tenantName?: string | null) => {
    setTenantGovernanceFocus(tenantId || tenantName ? { tenantId, tenantName } : null);
    setTenantUsageFilter("all");
    setTenantSortMode("name");
    const nextParams: Record<string, string> = {};
    if (tenantId != null) nextParams.tenantFocusId = String(tenantId);
    if (tenantName) nextParams.tenantFocusName = tenantName;
    navigateAdminTab("tenant_governance", nextParams);
  }, [navigateAdminTab]);

  const openProjectsTab = useCallback((projectName?: string | null) => {
    setDiscoveryLabProjectQuery(projectName || "");
    const nextParams: Record<string, string> = {};
    if (projectName) nextParams.projectFocusName = projectName;
    navigateAdminTab("projects", nextParams);
  }, [navigateAdminTab]);

  const buildAdminReturnQuery = useCallback((audit: DiscoveryLabAnswerAuditSummary, quoteInsight?: string) => {
    const params = new URLSearchParams({ adminTab: "discovery_lab_operations" });
    if (audit.tenant_id != null) params.set("tenantFocusId", String(audit.tenant_id));
    if (audit.tenant_name) params.set("tenantFocusName", audit.tenant_name);
    if (audit.project_name) params.set("projectFocusName", audit.project_name);
    if (audit.quote_id != null) params.set("quoteFocusId", String(audit.quote_id));
    if (quoteInsight) params.set("quoteInsight", quoteInsight);
    return params.toString();
  }, []);

  const consumeQuoteRestoreParams = useCallback(() => {
    if (!searchParams.get("quoteFocusId") && !searchParams.get("quoteInsight")) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("quoteFocusId");
    nextParams.delete("quoteInsight");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const appendRestoredQuoteDebugEvent = useCallback((type: RestoreDebugEventType, label: string, detail: string) => {
    restoredQuoteDebugEventCounter.current += 1;
    setIsRestoredQuoteDebugTimelineHidden(false);
    setRestoredQuoteDebugEvents((current) => [
      { id: `restore-debug-${restoredQuoteDebugEventCounter.current}`, type, label, detail, createdAt: Date.now() },
      ...current,
    ].slice(0, RESTORED_QUOTE_DEBUG_LIMIT));
  }, []);

  const renderAdminFocusBanner = useCallback((options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel?: string;
    timestamp?: number | null;
    actions?: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId?: string;
  }) => {
    return (
      <div
        data-testid={options.testId}
        className={`admin-page__focus-banner admin-page__focus-banner--${options.tone}`}
      >
        <div className="admin-page__focus-banner-content">
          <div className="admin-page__focus-banner-eyebrow">{options.eyebrow}</div>
          <div className="admin-page__focus-banner-title">{options.title}</div>
          <div className="admin-page__focus-banner-detail">{options.detail}</div>
          {(options.sourceLabel || options.timestamp) ? (
            <div className="admin-page__focus-banner-meta">
              {options.sourceLabel ? (
                <span className="admin-page__focus-banner-chip">
                  Kaynak: {options.sourceLabel}
                </span>
              ) : null}
              {options.timestamp ? (
                <span className="admin-page__focus-banner-chip admin-page__focus-banner-chip--secondary">
                  {formatAdminFocusTimestamp(options.timestamp)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {options.actions?.length ? (
          <div className="admin-page__focus-banner-actions">
            {options.actions.map((action) => action.href ? (
              <Link
                key={`${options.title}-${action.label}`}
                to={action.href}
                className="admin-page__focus-banner-action"
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={`${options.title}-${action.label}`}
                type="button"
                onClick={action.onClick}
                className="admin-page__focus-banner-action"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }, []);

  const clearRestoredQuoteInsight = useCallback(() => {
    setShowRestoredQuoteToast(false);
    setRestoredQuoteToastRemainingMs(4500);
    setIsRestoredQuoteToastPaused(false);
    setRestoredQuoteInsight(null);
    window.localStorage.removeItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
    appendRestoredQuoteDebugEvent("action", "Manuel Temizleme", "Geri yükleme odağı kullanıcı tarafından temizlendi");
  }, [appendRestoredQuoteDebugEvent]);

  const jumpToRestoredQuoteCard = useCallback(() => {
    if (!restoredQuoteInsight) {
      return;
    }
    discoveryQuoteCardRefs.current[restoredQuoteInsight.quoteId]?.scrollIntoView?.({ block: "center", behavior: "auto" });
    appendRestoredQuoteDebugEvent("action", "Atlama Eylemi", `RFQ #${restoredQuoteInsight.quoteId} kartına gidildi`);
  }, [appendRestoredQuoteDebugEvent, restoredQuoteInsight]);

  const removeRestoredQuoteDebugEvent = useCallback((eventId: string) => {
    setRestoredQuoteDebugEvents((current) => {
      const next = current.filter((event) => event.id !== eventId);
      if (next.length === 0) {
        window.localStorage.removeItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY);
      } else {
        window.localStorage.setItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const clearRestoredQuoteDebugEvents = useCallback(() => {
    setIsRestoredQuoteDebugTimelineHidden(true);
    setRestoredQuoteDebugEvents([]);
    setRestoredQuoteDebugFilter("all");
    setRestoredQuoteDebugSearchQuery("");
    setRestoredQuoteDebugReplayFilter("all");
    window.localStorage.removeItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY);
  }, []);

  const sortedDiscoveryLabAnswerAudits = useMemo(() => {
    if (!restoredQuoteInsight) {
      return discoveryLabAnswerAudits;
    }
    const prioritized = discoveryLabAnswerAudits.filter((audit) => audit.quote_id === restoredQuoteInsight.quoteId);
    const remaining = discoveryLabAnswerAudits.filter((audit) => audit.quote_id !== restoredQuoteInsight.quoteId);
    return [...prioritized, ...remaining];
  }, [discoveryLabAnswerAudits, restoredQuoteInsight]);

  const restoredQuoteRiskBadges = useCallback((quoteId: number) => {
    const pendingCount = discoveryQuotePendingApprovalsById[quoteId]?.length || 0;
    const transitionReason = discoveryQuoteById[quoteId]?.transition_reason || "-";
    const latestEvent = discoveryQuoteAuditTrailById[quoteId]?.timeline?.[0]?.title || "-";
    return [
      {
        key: "pending",
        label: `Pending ${pendingCount}`,
        detail: `Pending approval: ${pendingCount}`,
        tone: pendingCount > 0 ? "amber" : "green",
      },
      {
        key: "transition",
        label: transitionReason === "-" ? "Gerekçe yok" : "Gerekçe var",
        detail: `Transition reason: ${transitionReason}`,
        tone: transitionReason === "-" ? "gray" : "blue",
      },
      {
        key: "event",
        label: latestEvent,
        detail: `Son olay: ${latestEvent}`,
        tone: "violet",
      },
    ];
  }, [discoveryQuoteAuditTrailById, discoveryQuoteById, discoveryQuotePendingApprovalsById]);

  const filteredRestoredQuoteDebugEvents = useMemo(() => {
    let nextEvents = restoredQuoteDebugEvents;
    if (restoredQuoteDebugReplayFilter === "last-replay-chain") {
      const replayIndex = nextEvents.findIndex((event) => event.label === "Replay Action");
      nextEvents = replayIndex >= 0 ? nextEvents.slice(0, replayIndex + 1) : [];
    }
    if (restoredQuoteDebugFilter !== "all") {
      nextEvents = nextEvents.filter((event) => event.type === restoredQuoteDebugFilter);
    }
    const query = restoredQuoteDebugSearchQuery.trim().toLowerCase();
    if (!query) {
      return nextEvents;
    }
    return nextEvents.filter((event) => `${event.label} ${event.detail}`.toLowerCase().includes(query));
  }, [restoredQuoteDebugEvents, restoredQuoteDebugFilter, restoredQuoteDebugReplayFilter, restoredQuoteDebugSearchQuery]);

  const activePlatformOpsFocusSummary = useMemo(() => {
    const tokens: string[] = [];
    if (platformOpsStatusFilter !== "all") {
      tokens.push(`Durum: ${platformOpsStatusFilter.replaceAll("_", " ")}`);
    }
    if (platformOpsOwnerFilter !== "all") {
      tokens.push(platformOpsOwnerFilter === "__unassigned__" ? "Owner: Atanmamis" : `Owner: ${platformOpsOwnerFilter}`);
    }
    return tokens;
  }, [platformOpsOwnerFilter, platformOpsStatusFilter]);

  const activePackageFocusSummary = useMemo(() => {
    const tokens: string[] = [];
    if (packagePlanFilter !== "all") {
      const selectedPlan = (subscriptionCatalog?.catalog.plans || []).find((plan) => plan.code === packagePlanFilter);
      tokens.push(`Plan: ${selectedPlan?.name || packagePlanFilter}`);
    }
    if (packageRiskFilter !== "all") {
      tokens.push(packageRiskFilter === "pressure" ? "Risk: Limit Baskisi" : "Risk: Limit Asimi");
    }
    return tokens;
  }, [packagePlanFilter, packageRiskFilter, subscriptionCatalog]);

  const focusTelemetryEvents = useMemo<FocusTelemetryEvent[]>(() => {
    const events: FocusTelemetryEvent[] = [];
    const now = Date.now();
    const tenantFocusName = searchParams.get("tenantFocusName");
    const projectFocusName = searchParams.get("projectFocusName");
    const onboardingPlanFocus = searchParams.get("onboardingPlanFocus");
    if (tenantFocusName) {
      events.push({ id: "platform-overview-tenant", label: "Platform Genel Bakışı Odagi", detail: `Stratejik Partner odagi: ${tenantFocusName}`, source: "platform-overview", createdAt: now });
    }
    if (projectFocusName) {
      events.push({ id: "platform-overview-project", label: "Platform Genel Bakışı Odagi", detail: `Proje odagi: ${projectFocusName}`, source: "platform-overview", createdAt: now - 1 });
    }
    if (onboardingPlanFocus) {
      events.push({ id: "platform-overview-onboarding", label: "Platform Genel Bakışı Odagi", detail: `Onboarding planı: ${String(onboardingPlanFocus).toUpperCase()}`, source: "platform-overview", createdAt: now - 2 });
    }
    if (tenantGovernanceFocus?.tenantId != null || tenantGovernanceFocus?.tenantName) {
      events.push({
        id: "tenant-governance-focus",
        label: "Stratejik Partner Yönetimi Odagi",
        detail: tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`,
        source: "tenant-governance",
        createdAt: now - 3,
      });
    }
    if (activePlatformOpsFocusSummary.length > 0) {
      events.push({ id: "platform-ops-focus", label: "Platform Operasyonları Odagi", detail: activePlatformOpsFocusSummary.join(" - "), source: "platform-operations", createdAt: now - 4 });
    }
    if (activePackageFocusSummary.length > 0) {
      events.push({ id: "packages-focus", label: "Paketler Odagi", detail: activePackageFocusSummary.join(" - "), source: "packages", createdAt: now - 5 });
    }
    if (restoredQuoteInsight) {
      events.push({ id: `restore-focus-${restoredQuoteInsight.quoteId}`, label: "Geri Yükleme Odağı", detail: `RFQ #${restoredQuoteInsight.quoteId} - ${getQuoteInsightSectionLabel(restoredQuoteInsight.section)}`, source: "discovery-lab", createdAt: now - 6, targetQuoteId: restoredQuoteInsight.quoteId, targetSection: restoredQuoteInsight.section });
    }
    return events.sort((left, right) => right.createdAt - left.createdAt);
  }, [activePackageFocusSummary, activePlatformOpsFocusSummary, restoredQuoteInsight, searchParams, tenantGovernanceFocus]);

  const filteredFocusTelemetryEvents = useMemo(() => {
    const now = Date.now();
    const query = focusTelemetrySearchQuery.trim().toLowerCase();
    return focusTelemetryEvents.filter((event) => {
      const matchesSource = focusTelemetrySourceFilter === "all" || event.source === focusTelemetrySourceFilter;
      const matchesWindow = focusTelemetryWindowFilter === "all" || now - event.createdAt <= 15 * 60 * 1000;
      const matchesQuery = !query || `${event.label} ${event.detail} ${event.source}`.toLowerCase().includes(query);
      return matchesSource && matchesWindow && matchesQuery;
    });
  }, [focusTelemetryEvents, focusTelemetrySearchQuery, focusTelemetrySourceFilter, focusTelemetryWindowFilter]);

  const selectedFocusTelemetryEvent = useMemo(() => {
    if (!focusTelemetrySelectedEventId) {
      return filteredFocusTelemetryEvents[0] || null;
    }
    return filteredFocusTelemetryEvents.find((event) => event.id === focusTelemetrySelectedEventId) || filteredFocusTelemetryEvents[0] || null;
  }, [filteredFocusTelemetryEvents, focusTelemetrySelectedEventId]);

  const focusTelemetrySourceCounts = useMemo(() => {
    return filteredFocusTelemetryEvents.reduce<Record<string, number>>((counts, event) => {
      counts[event.source] = (counts[event.source] || 0) + 1;
      return counts;
    }, {});
  }, [filteredFocusTelemetryEvents]);

  const replayChainTargetQuoteId = useMemo(() => {
    if (restoredQuoteDebugReplayFilter !== "last-replay-chain") {
      return null;
    }
    const replayEvent = filteredRestoredQuoteDebugEvents.find((event) => event.label === "Replay Action") || filteredRestoredQuoteDebugEvents[0];
    if (!replayEvent) {
      return null;
    }
    const match = replayEvent.detail.match(/RFQ #(\d+)/i);
    return match ? Number(match[1]) : null;
  }, [filteredRestoredQuoteDebugEvents, restoredQuoteDebugReplayFilter]);

  const replaySummary = useMemo(() => {
    if (replayChainTargetQuoteId == null) {
      return "Son replay zinciri secilmedi";
    }
    const replayEvent = filteredRestoredQuoteDebugEvents.find((event) => event.label === "Replay Action");
    return replayEvent?.detail || `RFQ #${replayChainTargetQuoteId} replay zinciri aktif`;
  }, [filteredRestoredQuoteDebugEvents, replayChainTargetQuoteId]);

  const selectedFocusTelemetryTarget = useMemo(() => {
    if (selectedFocusTelemetryEvent?.targetQuoteId != null) {
      return {
        quoteId: selectedFocusTelemetryEvent.targetQuoteId,
        section: selectedFocusTelemetryEvent.targetSection || restoredQuoteReplayTarget,
        label: selectedFocusTelemetryEvent.label,
        detail: selectedFocusTelemetryEvent.detail,
      };
    }
    if (replayChainTargetQuoteId != null) {
      return {
        quoteId: replayChainTargetQuoteId,
        section: restoredQuoteReplayTarget,
        label: "Replay Zinciri Telemetry",
        detail: replaySummary,
      };
    }
    return null;
  }, [replayChainTargetQuoteId, replaySummary, restoredQuoteReplayTarget, selectedFocusTelemetryEvent]);

  const focusTelemetryFilters = useMemo<FocusTelemetryFilterSnapshot>(() => ({
    source: focusTelemetrySourceFilter,
    window: focusTelemetryWindowFilter,
    search: focusTelemetrySearchQuery,
  }), [focusTelemetrySearchQuery, focusTelemetrySourceFilter, focusTelemetryWindowFilter]);

  const selectedFocusTelemetryActionSourceId = selectedFocusTelemetryEvent?.id || null;

  const focusTelemetryActionHistoryQuerySnapshot = useMemo(() => ({
    scope: searchParams.get("telemetryHistoryScope") || "all",
    window: searchParams.get("telemetryHistoryWindow") || "all",
    search: searchParams.get("telemetryHistorySearch") || "",
  }), [searchParams]);

  const focusTelemetryActionHistoryFilters = useMemo<FocusTelemetryActionHistoryFilterSnapshot>(() => ({
    scope: focusTelemetryActionHistoryFilter,
    window: focusTelemetryActionHistoryWindow,
    search: focusTelemetryActionHistorySearch,
  }), [focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow]);

  const focusTelemetryFilteredActionHistoryForExport = useMemo(() => {
    const normalizedSearch = focusTelemetryActionHistorySearch.trim().toLowerCase();
    return focusTelemetryActionHistory.filter((item) => {
      if (focusTelemetryActionHistoryFilter !== "all" && item.scope !== focusTelemetryActionHistoryFilter) {
        return false;
      }
      if (!isFocusTelemetryActionWithinWindow(item.createdAt, focusTelemetryActionHistoryWindow)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return `${item.scope} ${item.message}`.toLowerCase().includes(normalizedSearch);
    });
  }, [focusTelemetryActionHistory, focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow]);

  const focusTelemetryActionHistoryScopeDistribution = useMemo(
    () => getFocusTelemetryActionHistoryScopeDistributionLabel(focusTelemetryFilteredActionHistoryForExport),
    [focusTelemetryFilteredActionHistoryForExport],
  );

  const focusTelemetryExportMeta = useMemo(() => {
    const createdAt = Date.now();
    const headerLines = [
      ...formatTelemetryExportHeader(focusTelemetryFilters, filteredFocusTelemetryEvents.length, createdAt),
      `Gecmis Kapsami: ${focusTelemetryActionHistoryFilters.scope}`,
      `Gecmis Penceresi: ${focusTelemetryActionHistoryFilters.window}`,
      `Gecmis Aramasi: ${focusTelemetryActionHistoryFilters.search || "-"}`,
      `Gecmis Kayit Sayisi: ${focusTelemetryFilteredActionHistoryForExport.length}`,
      `Gecmis Kapsam Dagilimi: ${focusTelemetryActionHistoryScopeDistribution}`,
      `Source Distribution: ${Object.entries(focusTelemetrySourceCounts).map(([source, count]) => `${source}=${count}`).join(" | ") || "-"}`,
      `Replay Summary: ${replaySummary}`,
    ];
    const filenameStamp = formatTelemetryFileTimestamp(createdAt);
    return {
      createdAt,
      filenameStamp,
      headerLines,
      jsonFilename: `admin-focus-telemetry-${filenameStamp}.json`,
      csvFilename: `admin-focus-telemetry-${filenameStamp}.csv`,
    };
  }, [filteredFocusTelemetryEvents.length, focusTelemetryActionHistoryFilters, focusTelemetryActionHistoryScopeDistribution, focusTelemetryFilteredActionHistoryForExport.length, focusTelemetryFilters, focusTelemetrySourceCounts, replaySummary]);

  const exportFocusTelemetry = useCallback(() => {
    setFocusTelemetryExport(JSON.stringify({
      summary: {
        exportedAt: new Date(focusTelemetryExportMeta.createdAt).toISOString(),
        eventCount: filteredFocusTelemetryEvents.length,
        filters: focusTelemetryFilters,
        historyFilters: focusTelemetryActionHistoryFilters,
        historyRecordCount: focusTelemetryFilteredActionHistoryForExport.length,
        historyScopeDistribution: focusTelemetryActionHistoryScopeDistribution,
        sourceDistribution: focusTelemetrySourceCounts,
        replaySummary,
      },
      events: filteredFocusTelemetryEvents,
    }, null, 2));
  }, [filteredFocusTelemetryEvents, focusTelemetryActionHistoryFilters, focusTelemetryActionHistoryScopeDistribution, focusTelemetryExportMeta.createdAt, focusTelemetryFilteredActionHistoryForExport.length, focusTelemetryFilters, focusTelemetrySourceCounts, replaySummary]);

  const exportFocusTelemetryCsv = useCallback(() => {
    const rows = [
      ["Disa Aktarim Zamani", new Date(focusTelemetryExportMeta.createdAt).toISOString()],
      ["Event Count", String(filteredFocusTelemetryEvents.length)],
      ["Source Filter", focusTelemetryFilters.source],
      ["Window Filter", focusTelemetryFilters.window],
      ["Search Query", focusTelemetryFilters.search || "-"],
      ["Gecmis Kapsami", focusTelemetryActionHistoryFilters.scope],
      ["Gecmis Penceresi", focusTelemetryActionHistoryFilters.window],
      ["Gecmis Aramasi", focusTelemetryActionHistoryFilters.search || "-"],
      ["Gecmis Kayit Sayisi", String(focusTelemetryFilteredActionHistoryForExport.length)],
      ["Gecmis Kapsam Dagilimi", focusTelemetryActionHistoryScopeDistribution],
      ["Source Distribution", Object.entries(focusTelemetrySourceCounts).map(([source, count]) => `${source}=${count}`).join(" | ") || "-"],
      ["Replay Summary", replaySummary],
      [],
      ["label", "detail", "source", "createdAt", "targetQuoteId"],
      ...filteredFocusTelemetryEvents.map((event) => [event.label, event.detail, event.source, String(event.createdAt), event.targetQuoteId != null ? String(event.targetQuoteId) : ""]),
    ];
    setFocusTelemetryCsvExport(rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"));
  }, [filteredFocusTelemetryEvents, focusTelemetryActionHistoryFilters, focusTelemetryActionHistoryScopeDistribution, focusTelemetryExportMeta.createdAt, focusTelemetryFilteredActionHistoryForExport.length, focusTelemetryFilters, focusTelemetrySourceCounts, replaySummary]);

  const copyFocusTelemetryText = useCallback(async (content: string | null) => {
    if (!content) {
      throw new Error("Kopyalanacak telemetry icerigi hazir degil");
    }
    await navigator.clipboard.writeText(content);
  }, []);

  const downloadFocusTelemetryText = useCallback((content: string | null, filename: string, mimeType: string) => {
    if (!content) {
      throw new Error("Indirilecek telemetry icerigi hazir degil");
    }
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const focusTelemetryEventActionsRef = useRef<HTMLDivElement | null>(null);

  const announceFocusTelemetryAction = useCallback((message: string, tone: "success" | "error" = "success", scope: "export" | "preset" | "navigation" = "export") => {
    setFocusTelemetryActionStatus({ message, tone });
    setFocusTelemetryActionHistory((current) => [
      { id: `telemetry-action-${Date.now()}`, tone, scope, message, createdAt: Date.now() },
      ...current,
    ].slice(0, 10));
    if (focusTelemetryStatusTimeoutRef.current) {
      window.clearTimeout(focusTelemetryStatusTimeoutRef.current);
    }
    focusTelemetryStatusTimeoutRef.current = window.setTimeout(() => {
      setFocusTelemetryActionStatus(null);
      focusTelemetryStatusTimeoutRef.current = null;
    }, 2200);
  }, []);

  const previewFocusTelemetryPresetPackage = useMemo(() => buildFocusTelemetryPresetImportPreview(focusTelemetryPresetPackageText, focusTelemetryPresets, focusTelemetryFilters, focusTelemetryPreviewPresetName), [focusTelemetryFilters, focusTelemetryPresetPackageText, focusTelemetryPresets, focusTelemetryPreviewPresetName]);

  const filteredFocusTelemetryActionHistory = useMemo(() => {
    const normalizedSearch = focusTelemetryActionHistorySearch.trim().toLowerCase();
    return focusTelemetryActionHistory.filter((item) => {
      if (focusTelemetryActionHistoryFilter !== "all" && item.scope !== focusTelemetryActionHistoryFilter) {
        return false;
      }
      if (!isFocusTelemetryActionWithinWindow(item.createdAt, focusTelemetryActionHistoryWindow)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return `${item.scope} ${item.message}`.toLowerCase().includes(normalizedSearch);
    });
  }, [focusTelemetryActionHistory, focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow]);

  const restoreFocusTelemetryActionHistoryFilters = useCallback(() => {
    const raw = window.localStorage.getItem(FOCUS_TELEMETRY_ACTION_HISTORY_FILTERS_STORAGE_KEY);
    if (!raw) {
      return null as FocusTelemetryActionHistoryFilterSnapshot | null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FocusTelemetryActionHistoryFilterSnapshot>;
      const scope: FocusTelemetryActionHistoryFilterSnapshot["scope"] = parsed.scope === "export" || parsed.scope === "preset" || parsed.scope === "navigation" ? parsed.scope : "all";
      const windowFilter: FocusTelemetryActionHistoryWindow = parsed.window === "30m" || parsed.window === "24h" ? parsed.window : "all";
      return {
        scope,
        window: windowFilter,
        search: typeof parsed.search === "string" ? parsed.search : "",
      };
    } catch {
      window.localStorage.removeItem(FOCUS_TELEMETRY_ACTION_HISTORY_FILTERS_STORAGE_KEY);
      return null as FocusTelemetryActionHistoryFilterSnapshot | null;
    }
  }, []);

  const focusTelemetryQuickAction = useCallback((eventId: string) => {
    if (!eventId) {
      return;
    }
    setFocusTelemetrySelectedEventId(eventId);
    setFocusTelemetryReturnedEventId(eventId);
    navigateAdminTab("panel_home");
    requestAnimationFrame(() => {
      focusTelemetryPanelRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
      focusTelemetryEventActionsRef.current?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
    });
  }, [navigateAdminTab]);

  const loadFocusTelemetryPresets = useCallback(() => {
    const raw = window.localStorage.getItem(FOCUS_TELEMETRY_PRESETS_STORAGE_KEY);
    if (!raw) {
      return [] as FocusTelemetryPreset[];
    }
    try {
      const parsed = JSON.parse(raw) as FocusTelemetryPreset[];
      return parsed.filter((preset) => preset?.id && preset?.name && preset?.userKey && preset?.filters).filter((preset) => preset.userKey === telemetryPresetUserKey);
    } catch {
      window.localStorage.removeItem(FOCUS_TELEMETRY_PRESETS_STORAGE_KEY);
      return [] as FocusTelemetryPreset[];
    }
  }, [telemetryPresetUserKey]);

  const persistFocusTelemetryPresets = useCallback((nextPresets: FocusTelemetryPreset[]) => {
    const raw = window.localStorage.getItem(FOCUS_TELEMETRY_PRESETS_STORAGE_KEY);
    let allPresets: FocusTelemetryPreset[] = [];
    if (raw) {
      try {
        allPresets = (JSON.parse(raw) as FocusTelemetryPreset[]).filter((preset) => preset?.id && preset?.name && preset?.userKey && preset?.filters);
      } catch {
        allPresets = [];
      }
    }
    const otherUsers = allPresets.filter((preset) => preset.userKey !== telemetryPresetUserKey);
    window.localStorage.setItem(FOCUS_TELEMETRY_PRESETS_STORAGE_KEY, JSON.stringify([...otherUsers, ...nextPresets]));
    setFocusTelemetryPresets(nextPresets);
  }, [telemetryPresetUserKey]);

  const saveFocusTelemetryPreset = useCallback(() => {
    const trimmedName = focusTelemetryPresetName.trim();
    if (!trimmedName) {
      return;
    }
    const nextPreset: FocusTelemetryPreset = {
      id: `telemetry-preset-${Date.now()}`,
      name: trimmedName,
      userKey: telemetryPresetUserKey,
      createdAt: Date.now(),
      filters: focusTelemetryFilters,
    };
    persistFocusTelemetryPresets([nextPreset, ...focusTelemetryPresets.filter((preset) => preset.name.toLowerCase() !== trimmedName.toLowerCase())].slice(0, 6));
    setFocusTelemetryPresetName("");
    announceFocusTelemetryAction(`Preset kaydedildi: ${trimmedName}`, "success", "preset");
  }, [announceFocusTelemetryAction, focusTelemetryFilters, focusTelemetryPresetName, focusTelemetryPresets, persistFocusTelemetryPresets, telemetryPresetUserKey]);

  const applyFocusTelemetryPreset = useCallback((presetId: string) => {
    const preset = focusTelemetryPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setFocusTelemetrySourceFilter(preset.filters.source);
    setFocusTelemetryWindowFilter(preset.filters.window);
    setFocusTelemetrySearchQuery(preset.filters.search);
    setFocusTelemetrySelectedEventId(null);
    announceFocusTelemetryAction(`Preset yuklendi: ${preset.name}`, "success", "preset");
  }, [announceFocusTelemetryAction, focusTelemetryPresets]);

  const startFocusTelemetryPresetRename = useCallback((presetId: string) => {
    const preset = focusTelemetryPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setFocusTelemetryEditingPresetId(presetId);
    setFocusTelemetryPresetDraftName(preset.name);
  }, [focusTelemetryPresets]);

  const commitFocusTelemetryPresetRename = useCallback((presetId: string) => {
    const trimmedName = focusTelemetryPresetDraftName.trim();
    if (!trimmedName) {
      return;
    }
    const nextPresets = focusTelemetryPresets.map((preset) => preset.id === presetId ? { ...preset, name: trimmedName } : preset);
    persistFocusTelemetryPresets(nextPresets);
    setFocusTelemetryEditingPresetId(null);
    setFocusTelemetryPresetDraftName("");
    announceFocusTelemetryAction(`Preset yeniden adlandirildi: ${trimmedName}`, "success", "preset");
  }, [announceFocusTelemetryAction, focusTelemetryPresetDraftName, focusTelemetryPresets, persistFocusTelemetryPresets]);

  const deleteFocusTelemetryPreset = useCallback((presetId: string) => {
    const preset = focusTelemetryPresets.find((item) => item.id === presetId);
    const nextPresets = focusTelemetryPresets.filter((item) => item.id !== presetId);
    persistFocusTelemetryPresets(nextPresets);
    if (focusTelemetryEditingPresetId === presetId) {
      setFocusTelemetryEditingPresetId(null);
      setFocusTelemetryPresetDraftName("");
    }
    announceFocusTelemetryAction(`Preset silindi: ${preset?.name || presetId}`, "success", "preset");
  }, [announceFocusTelemetryAction, focusTelemetryEditingPresetId, focusTelemetryPresets, persistFocusTelemetryPresets]);

  const exportFocusTelemetryPresetPackage = useCallback(() => {
    const payload: FocusTelemetryPresetPackage = {
      version: 1,
      exportedAt: new Date().toISOString(),
      userKey: telemetryPresetUserKey,
      sourceWorkspace: workspaceName,
      operatorLabel: user?.full_name || user?.email || "Bilinmiyor",
      presetHash: buildFocusTelemetryPresetHash(focusTelemetryPresets),
      presets: focusTelemetryPresets,
    };
    const serialized = JSON.stringify(payload, null, 2);
    setFocusTelemetryPresetPackageText(serialized);
    announceFocusTelemetryAction(`Preset paketi hazirlandi: ${focusTelemetryPresets.length} kayit`, "success", "preset");
    return serialized;
  }, [announceFocusTelemetryAction, focusTelemetryPresets, telemetryPresetUserKey, user?.email, user?.full_name, workspaceName]);

  const importFocusTelemetryPresetPackage = useCallback(() => {
    const raw = focusTelemetryPresetPackageText.trim();
    if (!raw) {
      announceFocusTelemetryAction("Ice aktarim icin preset paketi JSON gerekli", "error", "preset");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FocusTelemetryPresetPackage>;
      if (parsed.version !== 1) {
        announceFocusTelemetryAction(`Preset paketi versiyonu desteklenmiyor: ${parsed.version ?? "tanimsiz"}`, "error", "preset");
        return;
      }
      const importedPresets = Array.isArray(parsed.presets)
        ? parsed.presets.filter((preset): preset is FocusTelemetryPreset => Boolean(
          preset
          && preset.id
          && preset.name
          && preset.userKey
          && preset.createdAt
          && preset.filters
        ))
        : [];
      if (!importedPresets.length) {
        announceFocusTelemetryAction("Preset paketinde ice aktarilacak kayit bulunamadi", "error", "preset");
        return;
      }
      const normalized = [...importedPresets, ...focusTelemetryPresets]
        .map((preset) => ({ ...preset, userKey: telemetryPresetUserKey }))
        .sort((left, right) => right.createdAt - left.createdAt);
      const deduped = normalized.filter((preset, index, items) => items.findIndex((item) => item.name.toLowerCase() === preset.name.toLowerCase()) === index).slice(0, 6);
      persistFocusTelemetryPresets(deduped);
      announceFocusTelemetryAction(`Preset paketi ice aktarildi: ${importedPresets.length} kayit`, "success", "preset");
    } catch {
      announceFocusTelemetryAction("Preset paketi JSON okunamadi", "error", "preset");
    }
  }, [announceFocusTelemetryAction, focusTelemetryPresetPackageText, focusTelemetryPresets, persistFocusTelemetryPresets, telemetryPresetUserKey]);

  const restoreFocusTelemetryActionHistory = useCallback(() => {
    const raw = window.localStorage.getItem(FOCUS_TELEMETRY_ACTION_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [] as FocusTelemetryActionHistoryItem[];
    }
    try {
      const parsed = JSON.parse(raw) as FocusTelemetryActionHistoryItem[];
      return parsed
        .filter((item) => item?.id && item?.message && item?.tone && item?.scope && item?.createdAt)
        .slice(0, 10);
    } catch {
      window.localStorage.removeItem(FOCUS_TELEMETRY_ACTION_HISTORY_STORAGE_KEY);
      return [] as FocusTelemetryActionHistoryItem[];
    }
  }, []);

  const restoreQuoteDebugEventsFromStorage = useCallback(() => {
    const raw = window.localStorage.getItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY);
    if (!raw) {
      return [] as RestoreDebugEvent[];
    }
    try {
      const parsed = JSON.parse(raw) as RestoreDebugEvent[];
      return parsed
        .filter((event) => event?.id && event?.label && event?.detail && event?.type && event?.createdAt)
        .slice(0, RESTORED_QUOTE_DEBUG_LIMIT);
    } catch {
      window.localStorage.removeItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY);
      return [] as RestoreDebugEvent[];
    }
  }, []);

  const restoreQuoteInsightFromStorage = useCallback(() => {
    const raw = window.localStorage.getItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { quoteId?: number; section?: string; storedAt?: number };
      if (!parsed.quoteId || (parsed.section !== "status-history" && parsed.section !== "full-audit-trail")) {
        window.localStorage.removeItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
        return null;
      }
      if (!parsed.storedAt || Date.now() - parsed.storedAt > RESTORED_QUOTE_INSIGHT_TTL_MS) {
        window.localStorage.removeItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
        return null;
      }
      return { quoteId: parsed.quoteId, section: parsed.section } as { quoteId: number; section: "status-history" | "full-audit-trail" };
    } catch {
      window.localStorage.removeItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
      return null;
    }
  }, []);

  const toggleDiscoveryQuoteInsights = useCallback(async (quoteId: number) => {
    if (expandedDiscoveryQuoteInsightId === quoteId) {
      setExpandedDiscoveryQuoteInsightId(null);
      return;
    }
    setExpandedDiscoveryQuoteInsightId(quoteId);
    if (discoveryQuoteHistoryById[quoteId] && discoveryQuoteAuditTrailById[quoteId] && discoveryQuotePendingApprovalsById[quoteId] && discoveryQuoteById[quoteId]) {
      return;
    }
    setDiscoveryQuoteInsightLoadingId(quoteId);
    setDiscoveryQuoteInsightErrorById((current) => {
      const next = { ...current };
      delete next[quoteId];
      return next;
    });
    try {
      const [history, auditTrail, pendingApprovals, quoteDetail] = await Promise.all([
        getQuoteHistory(quoteId),
        getQuoteAuditTrail(quoteId),
        getQuotePendingApprovals(quoteId),
        getQuote(quoteId),
      ]);
      setDiscoveryQuoteHistoryById((current) => ({ ...current, [quoteId]: history }));
      setDiscoveryQuoteAuditTrailById((current) => ({ ...current, [quoteId]: auditTrail }));
      setDiscoveryQuotePendingApprovalsById((current) => ({ ...current, [quoteId]: pendingApprovals }));
      setDiscoveryQuoteById((current) => ({ ...current, [quoteId]: quoteDetail }));
    } catch (err) {
      setDiscoveryQuoteInsightErrorById((current) => ({ ...current, [quoteId]: err instanceof Error ? err.message : "RFQ geçmişi yüklenemedi" }));
    } finally {
      setDiscoveryQuoteInsightLoadingId((current) => current === quoteId ? null : current);
    }
  }, [discoveryQuoteAuditTrailById, discoveryQuoteById, discoveryQuoteHistoryById, discoveryQuotePendingApprovalsById, expandedDiscoveryQuoteInsightId]);

  const replayRestoredQuoteInsight = useCallback(() => {
    const replayTarget = restoredQuoteInsight || restoreQuoteInsightFromStorage();
    if (!replayTarget) {
      return;
    }
    const nextTarget = { ...replayTarget, section: restoredQuoteReplayTarget } as { quoteId: number; section: "status-history" | "full-audit-trail" };
    setRestoredQuoteInsight(nextTarget);
    setShowRestoredQuoteToast(true);
    setRestoredQuoteToastRemainingMs(4500);
    setIsRestoredQuoteToastPaused(false);
    void toggleDiscoveryQuoteInsights(nextTarget.quoteId);
    appendRestoredQuoteDebugEvent("action", "Replay Action", `RFQ #${nextTarget.quoteId} ${getQuoteInsightSectionLabel(nextTarget.section)} odagi yeniden calistirildi`);
  }, [appendRestoredQuoteDebugEvent, restoreQuoteInsightFromStorage, restoredQuoteInsight, restoredQuoteReplayTarget, toggleDiscoveryQuoteInsights]);

  const openReplayTelemetryTarget = useCallback(async (quoteId: number, section: "status-history" | "full-audit-trail") => {
    navigateAdminTab("discovery_lab_operations");
    setRestoredQuoteReplayTarget(section);
    setRestoredQuoteInsight({ quoteId, section });
    await toggleDiscoveryQuoteInsights(quoteId);
    if (section === "status-history") {
      discoveryQuoteStatusHistoryRefs.current[quoteId]?.scrollIntoView?.({ block: "center", behavior: "auto" });
    } else {
      discoveryQuoteAuditTrailRefs.current[quoteId]?.scrollIntoView?.({ block: "center", behavior: "auto" });
    }
  }, [navigateAdminTab, toggleDiscoveryQuoteInsights]);

  const tenantOwnerCandidates = useMemo(() => {
    const candidatesByTenant = new Map<number, TenantUser[]>();
    for (const person of personnel) {
      if (!person.tenant_id) continue;
      const isTenantAdmin = isTenantAdminUser(person);
      if (!isTenantAdmin) continue;

      const current = candidatesByTenant.get(person.tenant_id) || [];
      current.push(person);
      candidatesByTenant.set(person.tenant_id, current);
    }
    return candidatesByTenant;
  }, [personnel]);

  const tenantUsageByTenant = useMemo(() => {
    return new Map((subscriptionCatalog?.tenant_usage || []).map((item) => [item.tenant_id, item]));
  }, [subscriptionCatalog]);

  const scoreTenantRisk = useCallback((tenantId: number) => {
      const usage = tenantUsageByTenant.get(tenantId);
      if (!usage) return 0;
      return usage.metrics.reduce((maxScore, metric) => {
        if (metric.limit === null || metric.limit === undefined || metric.limit <= 0) {
          return maxScore;
        }
        const ratio = metric.used / metric.limit;
        if (ratio >= 1) return Math.max(maxScore, 3);
        if (ratio >= 0.8) return Math.max(maxScore, 2);
        if (ratio >= 0.6) return Math.max(maxScore, 1);
        return maxScore;
      }, 0);
    }, [tenantUsageByTenant]);

  const visibleTenants = useMemo(() => {
    const filtered = tenants.filter((tenant) => {
      const normalizedTenantCategory = String(tenant.category || "").trim();
      const matchesFocus = !tenantGovernanceFocus || (
        (tenantGovernanceFocus.tenantId != null && tenant.id === tenantGovernanceFocus.tenantId)
        || (tenantGovernanceFocus.tenantName && String(tenant.brand_name || tenant.legal_name).toLowerCase().includes(String(tenantGovernanceFocus.tenantName).toLowerCase()))
      );
      if (!matchesFocus) return false;
      if (tenantCategoryFilter === "uncategorized") {
        if (normalizedTenantCategory) return false;
      } else if (tenantCategoryFilter !== "all" && normalizedTenantCategory !== tenantCategoryFilter) {
        return false;
      }
      const riskScore = scoreTenantRisk(tenant.id);
      if (tenantUsageFilter === "breach") return riskScore >= 3;
      if (tenantUsageFilter === "pressure") return riskScore >= 2;
      return true;
    });

    return filtered.sort((left, right) => {
      if (tenantSortMode === "name") {
        return (left.brand_name || left.legal_name).localeCompare(right.brand_name || right.legal_name, "tr");
      }
      const riskDiff = scoreTenantRisk(right.id) - scoreTenantRisk(left.id);
      if (riskDiff !== 0) return riskDiff;
      return left.id - right.id;
    });
  }, [scoreTenantRisk, tenantCategoryFilter, tenantGovernanceFocus, tenantSortMode, tenantUsageFilter, tenants]);

  const tenantCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(
      tenants
        .map((tenant) => String(tenant.category || "").trim())
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right, "tr"));
    return categories;
  }, [tenants]);

  const tenantCategorySummary = useMemo(() => {
    const supplierCounts = tenantGovernanceSuppliers.reduce<Record<string, number>>((accumulator, supplier) => {
      const key = String(supplier.category || "").trim();
      if (!key) return accumulator;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const tenantCounts = tenants.reduce<Record<string, number>>((accumulator, tenant) => {
      const key = String(tenant.category || "").trim();
      if (!key) return accumulator;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return Object.keys({ ...tenantCounts, ...supplierCounts })
      .sort((left, right) => left.localeCompare(right, "tr"))
      .map((category) => ({
        category,
        tenantCount: tenantCounts[category] || 0,
        supplierCount: supplierCounts[category] || 0,
      }));
  }, [tenantGovernanceSuppliers, tenants]);

  const packageUsageSummary = useMemo(() => {
    const tenantUsage = subscriptionCatalog?.tenant_usage || [];
    const metrics = tenantUsage.flatMap((item) => item.metrics);
    const atRiskTenants = tenantUsage.filter((item) => scoreTenantRisk(item.tenant_id) >= 2).length;
    const breachedTenants = tenantUsage.filter((item) => scoreTenantRisk(item.tenant_id) >= 3).length;
    const highestUtilization = metrics.reduce((highest, metric) => {
      if (metric.limit === null || metric.limit === undefined || metric.limit <= 0) {
        return highest;
      }
      return Math.max(highest, Math.min(100, Math.round((metric.used / metric.limit) * 100)));
    }, 0);

    return {
      atRiskTenants,
      breachedTenants,
      highestUtilization,
    };
  }, [scoreTenantRisk, subscriptionCatalog]);

  const packagePlanSummary = useMemo(() => {
    const usageRows = subscriptionCatalog?.tenant_usage || [];
    const counts = usageRows.reduce<Record<string, number>>((acc, item) => {
      const key = String(item.plan_code || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return {
      all: usageRows.length,
      counts,
    };
  }, [subscriptionCatalog]);

  const visiblePackageUsageRows = useMemo(() => {
    const usageRows = subscriptionCatalog?.tenant_usage || [];
    return usageRows.filter((item) => {
      const matchesPlan = packagePlanFilter === "all" || item.plan_code === packagePlanFilter;
      const riskScore = scoreTenantRisk(item.tenant_id);
      const matchesRisk = packageRiskFilter === "all"
        || (packageRiskFilter === "pressure" && riskScore >= 2)
        || (packageRiskFilter === "breach" && riskScore >= 3);
      return matchesPlan && matchesRisk;
    });
  }, [packagePlanFilter, packageRiskFilter, scoreTenantRisk, subscriptionCatalog]);

  const jumpToPackageFocusTarget = useCallback(() => {
    if (packagePlanFilter !== "all") {
      packagePlanRefs.current[packagePlanFilter]?.scrollIntoView?.({ block: "center", behavior: "auto" });
      return;
    }
    const firstVisibleUsageRow = visiblePackageUsageRows[0];
    if (!firstVisibleUsageRow) {
      return;
    }
    packageUsageRowRefs.current[firstVisibleUsageRow.tenant_id]?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [packagePlanFilter, visiblePackageUsageRows]);

  const billingSummary = useMemo(() => {
    const subscriptions = billingOverview?.subscriptions || [];
    const invoices = billingOverview?.invoices || [];
    const openInvoices = invoices.filter((item) => getBillingInvoiceStatusMeta(item.status).bucket === "open").length;
    const totalOutstanding = invoices.reduce((sum, item) => {
      return sum + (getBillingInvoiceStatusMeta(item.status).bucket === "open" ? Number(item.total_amount || 0) : 0);
    }, 0);
    const subscriptionStatusCounts = {
      all: subscriptions.length,
      active: subscriptions.filter((item) => item.status === "active").length,
      trialing: subscriptions.filter((item) => item.status === "trialing").length,
      other: subscriptions.filter((item) => item.status !== "active" && item.status !== "trialing").length,
    };
    const invoiceStatusCounts = {
      all: invoices.length,
      open: invoices.filter((item) => getBillingInvoiceStatusMeta(item.status).bucket === "open").length,
      paid: invoices.filter((item) => getBillingInvoiceStatusMeta(item.status).bucket === "paid").length,
      other: invoices.filter((item) => getBillingInvoiceStatusMeta(item.status).bucket === "other").length,
    };
    return {
      openInvoices,
      totalOutstanding,
      subscriptionStatusCounts,
      invoiceStatusCounts,
    };
  }, [billingOverview]);

  const visibleBillingSubscriptions = useMemo(() => {
    const subscriptions = billingOverview?.subscriptions || [];
    if (billingSubscriptionFilter === "all") {
      return subscriptions;
    }
    if (billingSubscriptionFilter === "other") {
      return subscriptions.filter((item) => item.status !== "active" && item.status !== "trialing");
    }
    return subscriptions.filter((item) => item.status === billingSubscriptionFilter);
  }, [billingOverview, billingSubscriptionFilter]);

  const visibleBillingInvoices = useMemo(() => {
    const invoices = billingOverview?.invoices || [];
    if (billingInvoiceFilter === "all") {
      return invoices;
    }
    return invoices.filter((item) => {
      const bucket = getBillingInvoiceStatusMeta(item.status).bucket;
      if (billingInvoiceFilter === "other") {
        return bucket === "other";
      }
      return bucket === billingInvoiceFilter;
    });
  }, [billingInvoiceFilter, billingOverview]);

  const visibleBillingWebhooks = useMemo(() => {
    const events = billingOverview?.recent_webhook_events || [];
    if (billingWebhookFilter === "all") {
      return events;
    }
    if (billingWebhookFilter === "other") {
      return events.filter((item) => item.processing_status !== "processed" && item.processing_status !== "failed");
    }
    return events.filter((item) => item.processing_status === billingWebhookFilter);
  }, [billingOverview, billingWebhookFilter]);

  const visibleCommercialRequestWebhookDeliveries = useMemo(() => {
    const deliveries = commercialRequestWebhookDeliveries || [];
    if (commercialRequestWebhookDeliveryFilter === "all") {
      return deliveries;
    }
    if (commercialRequestWebhookDeliveryFilter === "other") {
      return deliveries.filter((item) => item.delivery_status !== "delivered" && item.delivery_status !== "failed");
    }
    return deliveries.filter((item) => item.delivery_status === commercialRequestWebhookDeliveryFilter);
  }, [commercialRequestWebhookDeliveries, commercialRequestWebhookDeliveryFilter]);

  const selectedCommercialRequestWebhookDelivery = useMemo(
    () => commercialRequestWebhookDeliveries.find((item) => item.id === selectedCommercialRequestWebhookDeliveryId) || null,
    [commercialRequestWebhookDeliveries, selectedCommercialRequestWebhookDeliveryId],
  );

  const platformOpsSummary = useMemo(() => {
    const onboardingQueue = tenants.filter((tenant) => {
      const normalized = String(tenant.onboarding_status || "").toLowerCase();
      return normalized !== "active";
    });
    const ownerAttention = tenants.filter((tenant) => !tenant.owner_user_id || !tenant.owner_email);
    const brandingAttention = tenants.filter((tenant) => !tenant.logo_url || !tenant.brand_name);
    const pausedTenants = tenants.filter((tenant) => !tenant.is_active || String(tenant.status || "").toLowerCase() === "paused");
    const highestPriorityTenants = [...tenants]
      .sort((left, right) => {
        const leftScore = (
          (String(left.onboarding_status || "").toLowerCase() !== "active" ? 3 : 0)
          + (!left.owner_user_id || !left.owner_email ? 2 : 0)
          + (!left.logo_url || !left.brand_name ? 1 : 0)
          + (!left.is_active || String(left.status || "").toLowerCase() === "paused" ? 2 : 0)
          + ((platformOpsStatuses[left.id] || left.support_status || "new") === "in_progress" ? 2 : 0)
          + ((platformOpsStatuses[left.id] || left.support_status || "new") === "waiting_owner" ? 2 : 0)
        );
        const rightScore = (
          (String(right.onboarding_status || "").toLowerCase() !== "active" ? 3 : 0)
          + (!right.owner_user_id || !right.owner_email ? 2 : 0)
          + (!right.logo_url || !right.brand_name ? 1 : 0)
          + (!right.is_active || String(right.status || "").toLowerCase() === "paused" ? 2 : 0)
          + ((platformOpsStatuses[right.id] || right.support_status || "new") === "in_progress" ? 2 : 0)
          + ((platformOpsStatuses[right.id] || right.support_status || "new") === "waiting_owner" ? 2 : 0)
        );
        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.id - right.id;
      })
      .slice(0, 5);

    return {
      onboardingQueue,
      ownerAttention,
      brandingAttention,
      pausedTenants,
      highestPriorityTenants,
    };
  }, [platformOpsStatuses, tenants]);

  const platformOpsQueues = useMemo(() => {
    const byOnboarding = tenants.filter((tenant) => String(tenant.onboarding_status || "").toLowerCase() !== "active");
    const byOwner = tenants.filter((tenant) => !tenant.owner_user_id || !tenant.owner_email);
    const byBranding = tenants.filter((tenant) => !tenant.logo_url || !tenant.brand_name);
    const byPaused = tenants.filter((tenant) => !tenant.is_active || String(tenant.status || "").toLowerCase() === "paused");

    return [
      {
        key: "onboarding",
        title: "Kurulum Takibi",
        note: "Kurulumu tamamlanmamis Stratejik Partnerlar once burada ele alinmali.",
        color: "#b45309",
        items: byOnboarding,
        nextStep: "Yönetici davetini ve ilk kurulum adımlarını kontrol et",
      },
      {
        key: "owner",
        title: "Sorumlu Atama Listesi",
        note: "Sorumlu bilgisi eksik Stratejik Partnerlar operasyonel risk yaratir.",
        color: "#dc2626",
        items: byOwner,
        nextStep: "Stratejik Partner Yönetimi sekmesinde sorumlu kisiyi belirle",
      },
      {
        key: "branding",
        title: "Marka Eksikleri",
        note: "Logo veya gorunen ad eksigi olan Stratejik Partnerlar marka kullanimi icin hazir degil.",
        color: "#7c3aed",
        items: byBranding,
        nextStep: "Logo, gorunen ad ve Stratejik Partner kimligini guncelle",
      },
      {
        key: "paused",
        title: "Duraklatilan Stratejik Partnerlar",
        note: "Pasif veya duraklatilmis Stratejik Partnerlar icin ticari veya operasyonel takip gerekir.",
        color: "#475569",
        items: byPaused,
        nextStep: "Abonelik, faturalama ve destek notlarini dogrula",
      },
    ];
  }, [tenants]);

  const platformOpsStatusSummary = useMemo(() => {
    const counts = {
      all: tenants.length,
      new: 0,
      in_progress: 0,
      waiting_owner: 0,
      resolved: 0,
    };

    for (const tenant of tenants) {
      const status = (platformOpsStatuses[tenant.id] || tenant.support_status || "new") as "new" | "in_progress" | "waiting_owner" | "resolved";
      counts[status] += 1;
    }

    return counts;
  }, [platformOpsStatuses, tenants]);

  const platformOpsOverviewSummary = useMemo(() => {
    const resolvedWithReason = tenants.filter((tenant) => {
      const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
      return status === "resolved" && String(tenant.support_resolution_reason || "").trim().length > 0;
    }).length;
    const ownerWaiting = tenants.filter((tenant) => (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "waiting_owner").length;
    const activeWork = tenants.filter((tenant) => {
      const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
      return status === "new" || status === "in_progress" || status === "waiting_owner";
    }).length;
    const staleContact = tenants.filter((tenant) => {
      const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
      const touchedAt = platformOpsTouchedAt[tenant.id] || tenant.support_last_contacted_at || tenant.updated_at || tenant.created_at;
      return status !== "resolved" && getDaysSince(touchedAt) >= 3;
    }).length;
    const unassignedOwner = tenants.filter((tenant) => {
      const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
      const ownerName = String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim();
      return status !== "resolved" && ownerName.length === 0;
    }).length;
    const ownerLoads = tenants.reduce<Record<string, number>>((accumulator, tenant) => {
      const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
      const ownerName = String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim();
      if (status === "resolved" || ownerName.length === 0) {
        return accumulator;
      }
      accumulator[ownerName] = (accumulator[ownerName] || 0) + 1;
      return accumulator;
    }, {});
    const busiestOwnerEntry = Object.entries(ownerLoads).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0], "tr");
    })[0];
    const busiestOwnerNameRaw = busiestOwnerEntry?.[0] || "";
    const busiestOwnerName = busiestOwnerNameRaw.includes("@") ? "Platform Ops" : (busiestOwnerNameRaw || "Platform Ops");

    return {
      activeWork,
      ownerWaiting,
      resolvedWithReason,
      staleContact,
      unassignedOwner,
      busiestOwnerName,
      busiestOwnerLoad: busiestOwnerEntry?.[1] || 0,
    };
  }, [platformOpsOwners, platformOpsStatuses, platformOpsTouchedAt, tenants]);

  const platformStaffOwnerOptions = useMemo(() => {
    return personnel
      .filter((person) => {
        const systemRole = String(person.system_role || '').toLowerCase();
        const businessRole = String(person.role || '').toLowerCase();
        return systemRole === 'super_admin' || businessRole === 'super_admin';
      })
      .map((person) => String(person.full_name || person.email || '').trim())
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
      .sort((left, right) => left.localeCompare(right, 'tr'));
  }, [personnel]);

  const platformOpsOwnerOptions = useMemo(() => {
    const selfOwner = String(user?.full_name || user?.email || "").trim();
    const assignedOwners = tenants
      .map((tenant) => String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim())
      .filter((owner) => owner.length > 0);
    const allCandidates = selfOwner
      ? [selfOwner, ...platformStaffOwnerOptions, ...assignedOwners]
      : [...platformStaffOwnerOptions, ...assignedOwners];
    const uniqueOwners = Array.from(new Set(allCandidates)).sort((left, right) => left.localeCompare(right, "tr"));

    return [
      { value: "all", label: "Tum Sorumlular" },
      { value: "__unassigned__", label: "Sorumlusu Atanmamis Kayitlar" },
      ...uniqueOwners.map((owner) => ({ value: owner, label: owner })),
    ];
  }, [platformOpsOwners, platformStaffOwnerOptions, tenants, user?.email, user?.full_name]);

  const visiblePlatformOpsQueues = useMemo(() => {
    const result = platformOpsQueues.map((queue) => ({
      ...queue,
      items: queue.items.filter((tenant) => {
        const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
        const ownerName = String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim();
        const matchesStatus = platformOpsStatusFilter === "all" || status === platformOpsStatusFilter;
        const matchesOwner = platformOpsOwnerFilter === "all"
          || (platformOpsOwnerFilter === "__unassigned__" ? ownerName.length === 0 : ownerName === platformOpsOwnerFilter);
        return matchesStatus && matchesOwner;
      }),
    }));
    return result;
  }, [platformOpsOwnerFilter, platformOpsOwners, platformOpsQueues, platformOpsStatusFilter, platformOpsStatuses]);

  const jumpToPlatformOpsFocusTarget = useCallback(() => {
    const firstVisibleQueue = visiblePlatformOpsQueues.find((queue) => queue.items.length > 0);
    if (!firstVisibleQueue) {
      return;
    }
    platformOpsQueueRefs.current[firstVisibleQueue.key]?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [visiblePlatformOpsQueues]);

  useEffect(() => {
    setPlatformOpsStatuses((current) => {
      const next = { ...current };
      for (const tenant of tenants) {
        if (!next[tenant.id]) {
          next[tenant.id] = tenant.support_status || "new";
        }
      }
      return next;
    });
    setPlatformOpsOwners((current) => {
      const next = { ...current };
      for (const tenant of tenants) {
        if (!next[tenant.id]) {
          next[tenant.id] = tenant.support_owner_name || tenant.owner_full_name || tenant.owner_email || "Platform Destek";
        }
      }
      return next;
    });
    setPlatformOpsTouchedAt((current) => {
      const next = { ...current };
      for (const tenant of tenants) {
        if (!next[tenant.id]) {
          next[tenant.id] = String(tenant.updated_at || tenant.created_at || "").slice(0, 10) || "2026-04-15";
        }
      }
      return next;
    });
    setPlatformOpsNotes((current) => {
      const next = { ...current };
      for (const tenant of tenants) {
        if (!next[tenant.id] && tenant.support_notes) {
          next[tenant.id] = tenant.support_notes;
        }
      }
      return next;
    });
    setPlatformOpsResolutionReasons((current) => {
      const next = { ...current };
      for (const tenant of tenants) {
        if (!next[tenant.id] && tenant.support_resolution_reason) {
          next[tenant.id] = tenant.support_resolution_reason;
        }
      }
      return next;
    });
  }, [tenants]);

  async function handleSavePlatformOpsNote(tenantId: number) {
    try {
      setPlatformOpsSavingTenantId(tenantId);
      if ((platformOpsStatuses[tenantId] || "new") === "resolved" && !(platformOpsResolutionReasons[tenantId] || "").trim()) {
        setError("Cozulen destek kaydi icin kapanis nedeni girin");
        setPlatformOpsSavingTenantId(null);
        return;
      }
      await updateTenantSupportWorkflow(tenantId, {
        support_status: platformOpsStatuses[tenantId] || "new",
        support_owner_name: platformOpsOwners[tenantId] || null,
        support_notes: platformOpsNotes[tenantId] || null,
        support_resolution_reason: (platformOpsResolutionReasons[tenantId] || "").trim() || null,
        support_last_contacted_at: platformOpsTouchedAt[tenantId] ? `${platformOpsTouchedAt[tenantId]}T00:00:00Z` : null,
      });
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setPlatformOpsSavingTenantId(null);
    }
  }

  const tabConfigs: TabConfig[] = useMemo(() => {
    const _normalizedBizRole = String(user?.business_role || user?.role || "").toLowerCase();
    const _userScopeType = String(user?.scope_type || "").toLowerCase();
    const isChannelUser = _userScopeType === "channel" || _normalizedBizRole === "channel_owner" || _normalizedBizRole === "channel_agent";

    if (isRoleManagementOnly) {
      return [
        {
          key: "roles",
          label: tAdmin.roles,
          icon: "ROL",
          description: "Rol hiyerarşisini, izin dağılımını ve alt rol yönetimini bu alandan yönetin.",
        },
      ];
    }

    const baseTabs: TabConfig[] = [
        {
          key: "panel_home",
          label: canViewPlatformGovernance ? (activeWorkspacePanelProfile?.title || tAdmin.panel_home) : currentUserRoleLabel,
        icon: "ADM",
        description: canViewPlatformGovernance ? (activeWorkspacePanelProfile?.description || "Bu role ait panel özetini ve hızlı yönlendirmeleri görüntüleyin.") : "",
      },
      ...(canViewPlatformGovernance
        ? [
            {
              key: "platform_operations" as const,
              label: tAdmin.platform_operations,
              icon: "OPS",
              description: "Platform destek ve operatör ekipleri için Stratejik Partner triage kuyruklarını yönetin.",
            },
            {
              key: "discovery_lab_operations" as const,
              label: tAdmin.discovery_lab_operations,
              icon: "LAB",
              description: "Discovery Lab yanıt denetimi, Stratejik Partner kırılımı ve RFQ bağlantılarını detaylı olarak izleyin.",
            },
            {
              key: "onboarding_studio" as const,
              label: tAdmin.onboarding_studio,
              icon: "KUR",
              description: "Plan seçimi, Stratejik Partner açılışı ve ilk aktivasyon akışlarını tek yüzeyde toplayın.",
            },
            {
              key: "tenant_governance" as const,
              label: tAdmin.tenant_governance,
              icon: "SPY",
              description: "Müşteri Stratejik Partner oluşumu, kurulum olgunluğu ve operasyonel hazırlık durumunu yönetin.",
            },
            ...(canViewPackagesTab
              ? [
                  {
                    key: "packages" as const,
                    label: tAdmin.packages,
                    icon: "PKT",
                    description: "Plan kataloğu, modül dağılımı ve Stratejik Partner limitlerini super admin seviyesinde izleyin.",
                  },
                ]
              : []),
            ...(canViewDeploymentTab
              ? [{
                  key: "deployment" as AdminTabKey,
                  label: tAdmin.deployment,
                  icon: "DPL",
                  description: "Canlı domainler (.com.tr/.com/.info/.online) için hosting kurulum, dağıtım ve dosya gönderimi işlemleri.",
                }]
              : []),
            {
              key: "platform_analytics" as const,
              label: tAdmin.platform_analytics,
              icon: "ANL",
              description: "Tenant sayısı, kullanıcı dağılımı, plan dağılımı ve platform geneli operasyon metriklerini izleyin.",
            },
            {
              key: "platform_suppliers" as const,
              label: tAdmin.platform_suppliers,
              icon: "TED",
              description: "Tüm tenant'lara açık platform geneli tedarikçi havuzunu yönetin.",
            },
            {
              key: "public_pricing" as const,
              label: tAdmin.public_pricing,
              icon: "FYT",
              description: "Public webde yayınlanan stratejik partner ve tedarikçi planlarını yönetin.",
            },
            {
              key: "campaigns" as const,
              label: tAdmin.campaigns,
              icon: "KMP",
              description: "Platform duyurularını, kampanyalarını ve landing sayfa içeriklerini yönetin.",
            },
            {
              key: "commission_admin" as const,
              label: tAdmin.commission_admin,
              icon: "KOM",
              description: "Kanal komisyon ledger kayıtlarını görüntüleyin, onaylayın ve ödeme durumunu yönetin.",
            },
            {
              key: "channel_partners" as const,
              label: tAdmin.channel_partners,
              icon: "KNL",
              description: "Acente ve broker iş ortaklarının organizasyon kaydını ve komisyon sözleşmelerini yönetin.",
            },
            {
              key: "ai_lab" as const,
              label: tAdmin.ai_lab,
              icon: "AIC",
              description: "AI destekli mimari proje analizi, metraj çıkarımı ve RFQ üretim istatistiklerini izleyin.",
            },
            {
              key: "support_tickets" as const,
              label: tAdmin.support_tickets,
              icon: "DST",
              description: "Tenant kullanıcılarının destek taleplerini görüntüleyin, atayın ve kapatın.",
            },
            ...(canViewSettingsTab
              ? [
                  {
                    key: "settings" as const,
                    label: tAdmin.settings,
                    icon: "AYR",
                    description: "Platform gönderim, genel sistem ve üst seviye ayarlarını yönetin.",
                  },
                ]
              : []),
          ]
        : []),
      {
        key: "companies",
        label: tAdmin.companies,
        icon: "FRM",
        description: canViewPlatformGovernance
          ? "Platformdaki müşteri firmalarını ve yapılarını izleyin."
          : "Kendi Stratejik Partner yapınıza ait firma ve bağlı yapıları yönetin.",
      },
      {
        key: "roles",
        label: tAdmin.roles,
        icon: "ROL",
        description: canViewPlatformGovernance
          ? "Platform ve Stratejik Partner geçiş süreci için rol yapısını izleyin."
          : "Kendi ekip rollerinizi ve yetki dağılımlarını yönetin.",
      },
      {
        key: "departments",
        label: tAdmin.departments,
        icon: "DEP",
        description: "İş akışlarının geçtiği departman ve alt açılımları yönetin.",
      },
      {
        key: "personnel",
        label: tAdmin.personnel,
        icon: "PRS",
        description: canViewPlatformGovernance
          ? "Stratejik Partner kullanıcılarını ve oluşum kurallarını denetleyin."
          : "Ekibinizi, atamaları ve iletişim bilgilerini yönetin.",
      },
      {
        key: "projects",
        label: tAdmin.projects,
        icon: "PRJ",
        description: "RFQ ve satın alma operasyonlarının bağlandığı projeleri yönetin.",
      },
      {
        key: "approvals",
        label: tAdmin.approvals,
        icon: "ONY",
        description: "Teklif ve karar süreçlerindeki onay bekleyen kayıtları yönetin.",
      },
      {
        key: "reports",
        label: tAdmin.reports,
        icon: "RPR",
        description: canViewPlatformGovernance
          ? "Platform genelinde teklif karşılaştırma ve performans raporlarını görüntüleyin."
          : "RFQ karşılaştırma ve satın alma performans raporlarınızı görüntüleyin.",
      },
      ...(showSettingsWorkspaceLinks
        ? [
            {
              key: "settings" as const,
              label: isChannelUser ? tAdmin.channel_settings : tAdmin.partner_settings,
              icon: "AYR",
              description: isChannelUser
                ? "İş Ortağı kimliği, e-posta gönderici hesapları ve çalışma alanı ayarlarınızı yönetin."
                : "Stratejik Partner kimliği, e-posta gönderici hesapları ve çalışma alanı ayarlarınızı yönetin.",
            },
          ]
        : []),
    ];

    if (canViewKariyerYonetimiTab) {
      baseTabs.push({
        key: "kariyer_yonetimi" as const,
        label: "Kariyer ve İş Piyasası",
        icon: "ILN",
        description: "İş ilanları, talent profilleri ve işveren hesaplarını merkezi olarak yönetin.",
      });
    }

    if (canViewSupplierProfileTab) {
      baseTabs.push({
        key: "supplier_profile" as const,
        label: "Tedarikçi Profilim",
        icon: "TED",
        description: "Firmanızın tedarikçi kaydını bu Stratejik Partner hesabıyla ilişkilendirin (Dual-Role).",
      });
    }

    if (isSuperAdminUser(user) || activeWorkspacePanelProfile?.allow_user_self_customization) {
      baseTabs.push({
        key: "panel_designer",
        label: isSuperAdminUser(user) ? tAdmin.panel_designer : tAdmin.personal_theme,
        icon: "PNT",
        description: isSuperAdminUser(user)
          ? "Tüm rol panellerini, görülecek sekmeleri ve yeni rol profillerini bu alandan yönetin."
          : "Kendi panel tema renklerini ve metinlerini bu alandan düzenleyin.",
      });
    }

    const panelPolicyContext = user
      ? buildPolicyContext(user)
      : { is_authenticated: false, permissions: [] };
    const policyVisibleTabKeys = new Set(resolveVisiblePanelTabKeys(panelPolicyContext, {
      is_role_management_only: isRoleManagementOnly,
      can_view_platform_governance: canViewPlatformGovernance,
      can_view_packages_tab: canViewPackagesTab,
      can_view_deployment_tab: canViewDeploymentTab,
      can_view_settings_tab: canViewSettingsTab,
      show_settings_workspace_links: showSettingsWorkspaceLinks,
      can_use_panel_designer: Boolean(isSuperAdminUser(user) || activeWorkspacePanelProfile?.allow_user_self_customization),
      can_view_supplier_profile_tab: canViewSupplierProfileTab,
      can_view_kariyer_yonetimi_tab: canViewKariyerYonetimiTab,
    }) as AdminTabKey[]);
    const policyFilteredTabs = baseTabs.filter((tab) => policyVisibleTabKeys.has(tab.key));

    if (!activeWorkspacePanelProfile || isSuperAdminUser(user)) {
      return policyFilteredTabs;
    }

    const allowedTabs = new Set(activeWorkspacePanelProfile.allowed_tabs as AdminTabKey[]);
    return policyFilteredTabs.filter((tab) => allowedTabs.has(tab.key) || tab.key === "panel_home" || tab.key === "panel_designer" || tab.key === "supplier_profile" || tab.key === "kariyer_yonetimi");
  }, [activeWorkspacePanelProfile, canViewDeploymentTab, canViewKariyerYonetimiTab, canViewPackagesTab, canViewPlatformGovernance, canViewSettingsTab, canViewSupplierProfileTab, currentUserRoleLabel, isRoleManagementOnly, showSettingsWorkspaceLinks, tAdmin, user]);

  const shouldLoadAdminWorkspaceData = useMemo(
    () => tabConfigs.some((item) => WORKSPACE_PANEL_DATA_TABS.has(item.key as WorkspacePanelTabKey)),
    [tabConfigs]
  );
  const showUpgradeExtrasWorkspace = Boolean(shouldLoadAdminWorkspaceData && isUpgradeExtrasPage && activeTab === "panel_home");
  const canUseSelfPanelDesigner = Boolean(activeWorkspacePanelProfile?.allow_user_self_customization);

  const handleCreateRoleCatalogRequest = useCallback(async (payload: { name: string; description?: string }) => {
    try {
      if (typeof createRoleCatalogRequest !== "function") {
        throw new Error("Rol talep servisi bu ortamda hazir degil.");
      }
      const created = await createRoleCatalogRequest(payload);
      setCatalogRequests((current) => [created, ...current]);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleCreateDepartmentCatalogRequest = useCallback(async (payload: { name: string; description?: string }) => {
    try {
      if (typeof createDepartmentCatalogRequest !== "function") {
        throw new Error("Departman talep servisi bu ortamda hazir degil.");
      }
      const created = await createDepartmentCatalogRequest(payload);
      setCatalogRequests((current) => [created, ...current]);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleReviewCatalogRequest = useCallback(async (requestId: number, decision: "approved" | "rejected") => {
    try {
      if (typeof reviewCatalogRequest !== "function") {
        throw new Error("Katalog talep onay servisi bu ortamda hazir degil.");
      }
      setCatalogRequestBusyId(requestId);
      await reviewCatalogRequest(requestId, { decision });
      const [requestRows, deptRows, roleRows] = await Promise.all([
        loadCatalogRequestsSafe(),
        getDepartments(),
        getRoles(),
      ]);
      setCatalogRequests(requestRows);
      setDepartments(deptRows);
      setRoles(roleRows);
    } catch (err) {
      setError(String(err));
    } finally {
      setCatalogRequestBusyId(null);
    }
  }, [loadCatalogRequestsSafe]);

  const currentUserTenantId = typeof (user as { tenant_id?: number } | null)?.tenant_id === "number"
    ? (user as { tenant_id?: number }).tenant_id ?? null
    : null;
  const currentUserId = typeof user?.id === "number" ? user.id : null;
  const currentUserEmail = String(user?.email || "").toLowerCase();

  const channelTeamPersonnel = useMemo(() => {
    if (!isChannelUser) return personnel;

    const normalize = (value: unknown) => String(value || "").toLowerCase();
    const normalizedCurrentUserEmail = normalize(currentUserEmail);

    const isChannelMember = (row: TenantUser) => {
      const role = normalize(row.role);
      const systemRole = normalize(row.system_role);
      return role === "channel_owner"
        || role === "channel_agent"
        || role === "channel_user"
        || systemRole.startsWith("channel_");
    };

    let rows = personnel.filter((row) => isChannelMember(row));
    if (typeof currentUserTenantId === "number") {
      rows = rows.filter((row) => row.tenant_id === currentUserTenantId);
    }

    if (currentUserId != null && !rows.some((row) => row.id === currentUserId)) {
      const me = personnel.find((row) => row.id === currentUserId || normalize(row.email) === normalizedCurrentUserEmail);
      if (me) rows = [me, ...rows];
    }

    const seen = new Set<number>();
    return rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [currentUserEmail, currentUserId, currentUserTenantId, isChannelUser, personnel]);

  // Load data
  const loadData = useCallback(async function loadData() {
    if (isRoleManagementOnly || !shouldLoadAdminWorkspaceData) {
      setLoading(false);
      return;
    }

    const hasCatalogSurface = canAccessAdminWorkspace || canAccessRoleCatalog || canViewPlatformGovernance;
    if (!hasCatalogSurface) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const p1 = getTenantUsers();
      const p2 = getDepartments().catch(() => [] as Department[]);
      const p3 = getCompanies().catch(() => [] as Company[]);
      const p4 = getRoles().catch(() => [] as Role[]);
      const p5 = (() => { try { return typeof getProjects === "function" ? getProjects() : Promise.resolve([] as Project[]); } catch { return Promise.resolve([] as Project[]); } })();
      const p6 = loadCatalogRequestsSafe();
      const _safeAdminSuppliers = (() => { try { return typeof getAdminSuppliers === "function" ? getAdminSuppliers({ filter_active: false }) : Promise.resolve([]); } catch { return Promise.resolve([]); } })();
      const p7 = canViewPlatformGovernance
        ? Promise.allSettled([
            getTenants(),
            _safeAdminSuppliers,
            getDiscoveryLabSessions({
              limit: 5,
              statusFilter: discoveryLabStatusFilter,
              projectQuery: discoveryLabProjectQuery.trim() || undefined,
              userQuery: discoveryLabUserQuery.trim() || undefined,
              dateFrom: discoveryLabDateFrom || undefined,
              dateTo: discoveryLabDateTo || undefined,
              search: discoveryLabSearch.trim() || undefined,
            }),
            getDiscoveryLabSummary({
              statusFilter: discoveryLabStatusFilter,
              projectQuery: discoveryLabProjectQuery.trim() || undefined,
              userQuery: discoveryLabUserQuery.trim() || undefined,
              dateFrom: discoveryLabDateFrom || undefined,
              dateTo: discoveryLabDateTo || undefined,
              search: discoveryLabSearch.trim() || undefined,
            }),
            getDiscoveryLabAnswerAudits({
              limit: 20,
              projectQuery: discoveryLabProjectQuery.trim() || undefined,
              userQuery: discoveryLabUserQuery.trim() || undefined,
              decision: discoveryLabAuditDecisionFilter === "all" ? undefined : discoveryLabAuditDecisionFilter,
              search: discoveryLabSearch.trim() || undefined,
            }),
            getOnboardingStudioSummary(),
          ])
        : Promise.resolve(null);
      const p8 = canAccessAdminWorkspace ? getSubscriptionCatalog() : Promise.resolve(null);
      const p9 = typeof globalThis.fetch === "function" && typeof import.meta.env.VITE_API_URL === "string" && import.meta.env.VITE_API_URL.length > 0 && canAccessAdminWorkspace
        ? fetch(`${import.meta.env.VITE_API_URL}/api/v1/admin/public-pricing-config`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
          }).then(async (response) => {
            if (!response.ok) return null;
            return response.json() as Promise<PublicPricingConfig>;
          }).catch(() => null)
        : Promise.resolve(null);
      const p10 = typeof globalThis.fetch === "function" && typeof import.meta.env.VITE_API_URL === "string" && import.meta.env.VITE_API_URL.length > 0 && canAccessAdminWorkspace
        ? fetch(`${import.meta.env.VITE_API_URL}/api/v1/onboarding/premium-features`).then(async (response) => {
            if (!response.ok) return [];
            return response.json() as Promise<Array<{ id: number; code: string; name: string; description?: string | null; monthly_price?: number | null }>>;
          }).catch(() => [])
        : Promise.resolve([]);
      const p11 = canViewPackagesTab ? getBillingOverview() : Promise.resolve(null);
      const p12 = canAccessAdminWorkspace
        ? getQuotes(1, 1).then((response) => Number(response.total ?? response.count ?? 0)).catch(() => 0)
        : Promise.resolve(0);
      const p13 = canViewPlatformGovernance && (activeTab === "platform_overview" || activeTab === "panel_home")
        ? getQuotes(1, 100).then((response) => response.items || []).catch(() => [] as Quote[])
        : Promise.resolve([] as Quote[]);
      const [personnelData, deptData, companyData, rolesData, projectData, catalogRequestData, governanceResults, subscriptionData, publicPricingResponse, premiumFeatureResponse, billingData, quoteTotal, overviewQuoteItems] = await Promise.all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13]);
      setPersonnel(personnelData);
      setDepartments(deptData);
      setCompanies(companyData);
      setRoles(rolesData);
      setProjects(projectData);
      setOverviewQuotes(overviewQuoteItems);
      setOverviewQuoteTotal(quoteTotal);
      setCatalogRequests(catalogRequestData);
      
      if (canViewPlatformGovernance && governanceResults) {
        const [tenantResult, supplierResult, discoveryLabResult, discoveryLabSummaryResult, discoveryLabAuditResult, onboardingStudioResult] = governanceResults;
        setTenants(tenantResult.status === "fulfilled" ? tenantResult.value : []);
        setTenantGovernanceSuppliers(supplierResult.status === "fulfilled" ? supplierResult.value : []);
        try { if (typeof getAdminChannelUsers === "function") { const cUsers = await getAdminChannelUsers(); setChannelUsers(cUsers); } } catch { /* kanal kullanicilari yuklenemedi */ }
        setDiscoveryLabSessions(discoveryLabResult.status === "fulfilled" ? discoveryLabResult.value : []);
        setDiscoveryLabSummary(
          discoveryLabSummaryResult.status === "fulfilled"
            ? discoveryLabSummaryResult.value
            : { total_sessions: 0, locked_sessions: 0, quote_ready_sessions: 0, active_project_count: 0, answer_audit_count: 0 },
        );
        setDiscoveryLabAnswerAudits(discoveryLabAuditResult.status === "fulfilled" ? discoveryLabAuditResult.value : []);
        const nextOnboardingStudioSummary: OnboardingStudioSummary = onboardingStudioResult.status === "fulfilled"
          ? onboardingStudioResult.value as OnboardingStudioSummary
          : EMPTY_ONBOARDING_STUDIO_SUMMARY;
        setOnboardingStudioSummary(nextOnboardingStudioSummary);

        const governanceError = governanceResults.find((result) => result.status === "rejected");
        if (governanceError && governanceError.status === "rejected") {
          const message = governanceError.reason instanceof Error ? governanceError.reason.message : String(governanceError.reason);
          console.warn("Admin governance partial load failure", message);
        }
      }
      if (canAccessAdminWorkspace) {
        const normalizedPremiumFeatureCatalog = Array.isArray(premiumFeatureResponse)
          ? premiumFeatureResponse
          : [];
        setSubscriptionCatalog(subscriptionData as SubscriptionCatalogSnapshot | null);
        setPublicPricingConfig(publicPricingResponse as PublicPricingConfig | null);
        setPremiumFeatureCatalog(normalizedPremiumFeatureCatalog as Array<{ id: number; code: string; name: string; description?: string | null; monthly_price?: number | null }>);
      }
      if (canViewPackagesTab) {
        setBillingOverview(billingData);
        const [commercialRequestData, subscriptionAddonData, webhookSettingsData, webhookDeliveryData] = await Promise.all([
          typeof getCommercialRequests === "function" ? getCommercialRequests() : Promise.resolve([] as CommercialRequestItem[]),
          typeof getSubscriptionAddons === "function" ? getSubscriptionAddons() : Promise.resolve([] as SubscriptionAddonAdminItem[]),
          typeof getCommercialRequestWebhookSettings === "function" ? getCommercialRequestWebhookSettings() : Promise.resolve(null as CommercialRequestWebhookSettings | null),
          typeof getCommercialRequestWebhookDeliveries === "function" ? getCommercialRequestWebhookDeliveries() : Promise.resolve([] as CommercialRequestWebhookDelivery[]),
        ]);
        setCommercialRequests(commercialRequestData);
        setSubscriptionAddons(subscriptionAddonData);
        setSubscriptionAddonExpiryDrafts(Object.fromEntries(subscriptionAddonData.map((item: SubscriptionAddonAdminItem) => [item.id, item.expires_at ? String(item.expires_at).slice(0, 10) : ""])));
        if (webhookSettingsData) {
          setCommercialRequestWebhookSettings(webhookSettingsData as CommercialRequestWebhookSettings);
          setCommercialRequestWebhookDraft({ webhook_url: (webhookSettingsData as CommercialRequestWebhookSettings).webhook_url || "", webhook_secret: "" });
        }
        setCommercialRequestWebhookDeliveries(webhookDeliveryData as CommercialRequestWebhookDelivery[]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, canAccessAdminWorkspace, canAccessRoleCatalog, canViewPackagesTab, canViewPlatformGovernance, discoveryLabAuditDecisionFilter, discoveryLabDateFrom, discoveryLabDateTo, discoveryLabProjectQuery, discoveryLabSearch, discoveryLabStatusFilter, discoveryLabUserQuery, isRoleManagementOnly, loadCatalogRequestsSafe, shouldLoadAdminWorkspaceData]);

  const reloadPersonnel = useCallback(async (params?: TenantUsersQueryParams) => {
    try {
      const data = await getTenantUsers(params);
      setPersonnel(data);
    } catch {
      // sessiz hata - ana loadData hata yonetimiyle ayni veri kaynagi
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const resolvedTab = tab === "mail" ? "settings" : tab;
    const tenantFocusId = searchParams.get("tenantFocusId");
    const tenantFocusName = searchParams.get("tenantFocusName");
    const projectFocusName = searchParams.get("projectFocusName");
    const telemetrySnapshot = buildFocusTelemetryFilterSnapshot(searchParams);
    if (resolvedTab && tabConfigs.some((item) => item.key === resolvedTab)) {
      setActiveTab(resolvedTab as AdminTabKey);
    } else if (isRoleManagementOnly) {
      setActiveTab("roles");
    } else if (tabConfigs.some((item) => item.key === "panel_home")) {
      setActiveTab("panel_home");
    } else if (canViewPlatformGovernance) {
      setActiveTab("panel_home");
    }
    if (tenantFocusId || tenantFocusName) {
      setTenantGovernanceFocus({
        tenantId: tenantFocusId ? Number(tenantFocusId) : null,
        tenantName: tenantFocusName || null,
      });
    } else {
      setTenantGovernanceFocus(null);
    }
    if (projectFocusName) {
      setDiscoveryLabProjectQuery(projectFocusName);
    }
    setFocusTelemetrySourceFilter(telemetrySnapshot.source);
    setFocusTelemetryWindowFilter(telemetrySnapshot.window);
    setFocusTelemetrySearchQuery(telemetrySnapshot.search);
  }, [searchParams, tabConfigs, canViewPlatformGovernance, isRoleManagementOnly]);

  useEffect(() => {
    const quoteFocusId = Number(searchParams.get("quoteFocusId") || 0);
    const effectiveQuoteFocusId = quoteFocusId || restoredQuoteInsight?.quoteId || 0;
    if (activeTab !== "discovery_lab_operations" || !effectiveQuoteFocusId || expandedDiscoveryQuoteInsightId === effectiveQuoteFocusId) {
      return;
    }
    void toggleDiscoveryQuoteInsights(effectiveQuoteFocusId);
  }, [activeTab, expandedDiscoveryQuoteInsightId, restoredQuoteInsight, searchParams, toggleDiscoveryQuoteInsights]);

  useEffect(() => {
    const quoteFocusId = Number(searchParams.get("quoteFocusId") || 0);
    const quoteInsight = searchParams.get("quoteInsight");
    if (activeTab !== "discovery_lab_operations") {
      setShowRestoredQuoteToast(false);
      return;
    }
    if (restoredQuoteDebugEvents.length === 0) {
      const restoredDebugEvents = restoreQuoteDebugEventsFromStorage();
      if (restoredDebugEvents.length) {
        setIsRestoredQuoteDebugTimelineHidden(false);
        setRestoredQuoteDebugEvents(restoredDebugEvents);
      }
    }
    if (!quoteFocusId || (quoteInsight !== "status-history" && quoteInsight !== "full-audit-trail")) {
      const restoredFromStorage = restoreQuoteInsightFromStorage();
      if (restoredFromStorage) {
        setRestoredQuoteInsight(restoredFromStorage);
        setRestoredQuoteReplayTarget(restoredFromStorage.section);
        window.localStorage.removeItem(RESTORED_QUOTE_INSIGHT_STORAGE_KEY);
        appendRestoredQuoteDebugEvent("restore", "Storage Restore", `RFQ #${restoredFromStorage.quoteId} yeniden yuklendi`);
      }
      return;
    }
    setRestoredQuoteInsight({ quoteId: quoteFocusId, section: quoteInsight });
    setRestoredQuoteReplayTarget(quoteInsight);
    appendRestoredQuoteDebugEvent("restore", "Query Restore", `RFQ #${quoteFocusId} ${quoteInsight} odagi ile acildi`);
  }, [activeTab, appendRestoredQuoteDebugEvent, restoreQuoteDebugEventsFromStorage, restoreQuoteInsightFromStorage, restoredQuoteDebugEvents.length, searchParams]);

  useEffect(() => {
    if (!restoredQuoteInsight || expandedDiscoveryQuoteInsightId !== restoredQuoteInsight.quoteId) {
      return;
    }
    const targetRef = restoredQuoteInsight.section === "status-history"
      ? discoveryQuoteStatusHistoryRefs.current[restoredQuoteInsight.quoteId]
      : discoveryQuoteAuditTrailRefs.current[restoredQuoteInsight.quoteId];
    targetRef?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
    consumeQuoteRestoreParams();
    appendRestoredQuoteDebugEvent("lifecycle", "Bolum Odagi", `RFQ #${restoredQuoteInsight.quoteId} paneli odaklandi`);
  }, [appendRestoredQuoteDebugEvent, consumeQuoteRestoreParams, expandedDiscoveryQuoteInsightId, restoredQuoteInsight, discoveryQuoteHistoryById, discoveryQuoteAuditTrailById]);

  useEffect(() => {
    if (!restoredQuoteInsight) {
      return;
    }
    window.localStorage.setItem(
      RESTORED_QUOTE_INSIGHT_STORAGE_KEY,
      JSON.stringify({
        quoteId: restoredQuoteInsight.quoteId,
        section: restoredQuoteInsight.section,
        storedAt: Date.now(),
      }),
    );
  }, [appendRestoredQuoteDebugEvent, restoredQuoteInsight]);

  useEffect(() => {
    if (restoredQuoteDebugEvents.length === 0) {
      window.localStorage.removeItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(RESTORED_QUOTE_DEBUG_STORAGE_KEY, JSON.stringify(restoredQuoteDebugEvents));
  }, [restoredQuoteDebugEvents]);

  useEffect(() => {
    setFocusTelemetryPresets(loadFocusTelemetryPresets());

    setFocusTelemetryActionHistory(restoreFocusTelemetryActionHistory());
  }, [loadFocusTelemetryPresets, restoreFocusTelemetryActionHistory]);

  useEffect(() => {
    const restoredSnapshot = restoreFocusTelemetryActionHistoryFilters();
    const queryScope = focusTelemetryActionHistoryQuerySnapshot.scope === "export" || focusTelemetryActionHistoryQuerySnapshot.scope === "preset" || focusTelemetryActionHistoryQuerySnapshot.scope === "navigation" ? focusTelemetryActionHistoryQuerySnapshot.scope : "all";
    const queryWindow = focusTelemetryActionHistoryQuerySnapshot.window === "30m" || focusTelemetryActionHistoryQuerySnapshot.window === "24h" ? focusTelemetryActionHistoryQuerySnapshot.window : "all";
    const querySearch = focusTelemetryActionHistoryQuerySnapshot.search;
    if (focusTelemetryActionHistoryQuerySnapshot.scope !== "all" || focusTelemetryActionHistoryQuerySnapshot.window !== "all" || querySearch) {
      setFocusTelemetryActionHistoryFilter(queryScope);
      setFocusTelemetryActionHistoryWindow(queryWindow);
      setFocusTelemetryActionHistorySearch(querySearch);
      return;
    }
    if (!restoredSnapshot) {
      return;
    }
    setFocusTelemetryActionHistoryFilter(restoredSnapshot.scope);
    setFocusTelemetryActionHistoryWindow(restoredSnapshot.window);
    setFocusTelemetryActionHistorySearch(restoredSnapshot.search);
  }, [focusTelemetryActionHistoryQuerySnapshot.search, focusTelemetryActionHistoryQuerySnapshot.scope, focusTelemetryActionHistoryQuerySnapshot.window, restoreFocusTelemetryActionHistoryFilters]);

  useEffect(() => {
    if (focusTelemetryActionHistory.length === 0) {
      window.localStorage.removeItem(FOCUS_TELEMETRY_ACTION_HISTORY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(FOCUS_TELEMETRY_ACTION_HISTORY_STORAGE_KEY, JSON.stringify(focusTelemetryActionHistory));
  }, [focusTelemetryActionHistory]);

  useEffect(() => {
    const snapshot = buildFocusTelemetryActionHistoryFilterSnapshot(
      focusTelemetryActionHistoryFilter,
      focusTelemetryActionHistoryWindow,
      focusTelemetryActionHistorySearch,
    );
    if (snapshot.scope === "all" && snapshot.window === "all" && !snapshot.search.trim()) {
      window.localStorage.removeItem(FOCUS_TELEMETRY_ACTION_HISTORY_FILTERS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(FOCUS_TELEMETRY_ACTION_HISTORY_FILTERS_STORAGE_KEY, JSON.stringify(snapshot));
  }, [focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow]);

  useEffect(() => {
    if (activeTab !== "platform_overview" && activeTab !== "panel_home") {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (focusTelemetryActionHistoryFilter === "all") nextParams.delete("telemetryHistoryScope");
    else nextParams.set("telemetryHistoryScope", focusTelemetryActionHistoryFilter);
    if (focusTelemetryActionHistoryWindow === "all") nextParams.delete("telemetryHistoryWindow");
    else nextParams.set("telemetryHistoryWindow", focusTelemetryActionHistoryWindow);
    if (!focusTelemetryActionHistorySearch.trim()) nextParams.delete("telemetryHistorySearch");
    else nextParams.set("telemetryHistorySearch", focusTelemetryActionHistorySearch);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams);
    }
  }, [activeTab, focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow, searchParams, setSearchParams]);

  useEffect(() => {
    if (!focusTelemetryReturnedEventId) {
      setFocusTelemetryReturnedEventProgress(100);
      setFocusTelemetryReturnedEventRemainingMs(2200);
      setIsFocusTelemetryReturnPaused(false);
      focusTelemetryReturnedEventRemainingRef.current = 2200;
      focusTelemetryReturnedEventLastTickRef.current = null;
      return;
    }
    requestAnimationFrame(() => {
      focusTelemetryEventCardRefs.current[focusTelemetryReturnedEventId]?.scrollIntoView?.({ block: "center", behavior: "auto" });
    });
    setIsFocusTelemetryReturnPaused(false);
    focusTelemetryReturnedEventRemainingRef.current = 2200;
    setFocusTelemetryReturnedEventRemainingMs(2200);
    setFocusTelemetryReturnedEventProgress(100);
  }, [focusTelemetryReturnedEventId]);

  useEffect(() => {
    if (!focusTelemetryReturnedEventId || isFocusTelemetryReturnPaused) {
      if (focusTelemetryReturnedEventIntervalRef.current) {
        window.clearInterval(focusTelemetryReturnedEventIntervalRef.current);
        focusTelemetryReturnedEventIntervalRef.current = null;
      }
      focusTelemetryReturnedEventLastTickRef.current = null;
      return;
    }
    if (focusTelemetryReturnedEventIntervalRef.current) {
      window.clearInterval(focusTelemetryReturnedEventIntervalRef.current);
    }
    focusTelemetryReturnedEventLastTickRef.current = Date.now();
    focusTelemetryReturnedEventIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const lastTick = focusTelemetryReturnedEventLastTickRef.current ?? now;
      const elapsed = now - lastTick;
      focusTelemetryReturnedEventLastTickRef.current = now;
      focusTelemetryReturnedEventRemainingRef.current = Math.max(0, focusTelemetryReturnedEventRemainingRef.current - elapsed);
      const nextRemaining = focusTelemetryReturnedEventRemainingRef.current;
      const nextProgress = Math.max(0, (nextRemaining / 2200) * 100);
      setFocusTelemetryReturnedEventRemainingMs(nextRemaining);
      setFocusTelemetryReturnedEventProgress(nextProgress);
      if (nextProgress <= 0 && focusTelemetryReturnedEventIntervalRef.current) {
        window.clearInterval(focusTelemetryReturnedEventIntervalRef.current);
        focusTelemetryReturnedEventIntervalRef.current = null;
        setFocusTelemetryReturnedEventId(null);
      }
    }, 100);

    return () => {
      if (focusTelemetryReturnedEventIntervalRef.current) {
        window.clearInterval(focusTelemetryReturnedEventIntervalRef.current);
        focusTelemetryReturnedEventIntervalRef.current = null;
      }
    };
  }, [focusTelemetryReturnedEventId, isFocusTelemetryReturnPaused]);

  useEffect(() => {
    return () => {
      if (focusTelemetryStatusTimeoutRef.current) {
        window.clearTimeout(focusTelemetryStatusTimeoutRef.current);
      }
      if (focusTelemetryPulseTimeoutRef.current) {
        window.clearTimeout(focusTelemetryPulseTimeoutRef.current);
      }
      if (focusTelemetryReturnedEventIntervalRef.current) {
        window.clearInterval(focusTelemetryReturnedEventIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!filteredFocusTelemetryEvents.length) {
      setFocusTelemetrySelectedEventId(null);
      return;
    }
    if ((activeTab === "platform_overview" || activeTab === "panel_home") && replayChainTargetQuoteId != null) {
      const replayTargetEvent = filteredFocusTelemetryEvents.find((event) => event.targetQuoteId === replayChainTargetQuoteId && event.targetSection === restoredQuoteReplayTarget)
        || filteredFocusTelemetryEvents.find((event) => event.targetQuoteId === replayChainTargetQuoteId);
      if (replayTargetEvent) {
        setFocusTelemetrySelectedEventId(replayTargetEvent.id);
        return;
      }
    }
    if (focusTelemetrySelectedEventId && filteredFocusTelemetryEvents.some((event) => event.id === focusTelemetrySelectedEventId)) {
      return;
    }
    setFocusTelemetrySelectedEventId(filteredFocusTelemetryEvents[0].id);
  }, [activeTab, filteredFocusTelemetryEvents, focusTelemetrySelectedEventId, replayChainTargetQuoteId, restoredQuoteReplayTarget]);

  useEffect(() => {
    const hasQueryTelemetry = searchParams.has("telemetrySource") || searchParams.has("telemetryWindow") || searchParams.has("telemetrySearch");
    const isDefaultSnapshot = focusTelemetryFilters.source === "all" && focusTelemetryFilters.window === "all" && !focusTelemetryFilters.search;
    if (!hasQueryTelemetry && isDefaultSnapshot && window.localStorage.getItem(FOCUS_TELEMETRY_FILTERS_STORAGE_KEY)) {
      return;
    }
    window.localStorage.setItem(FOCUS_TELEMETRY_FILTERS_STORAGE_KEY, JSON.stringify(focusTelemetryFilters));
  }, [focusTelemetryFilters, searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    const currentSource = nextParams.get("telemetrySource") || "all";
    const currentWindow = nextParams.get("telemetryWindow") || "all";
    const currentSearch = nextParams.get("telemetrySearch") || "";
    let changed = false;

    if (focusTelemetrySourceFilter !== currentSource) {
      changed = true;
      if (focusTelemetrySourceFilter === "all") nextParams.delete("telemetrySource");
      else nextParams.set("telemetrySource", focusTelemetrySourceFilter);
    }
    if (focusTelemetryWindowFilter !== currentWindow) {
      changed = true;
      if (focusTelemetryWindowFilter === "all") nextParams.delete("telemetryWindow");
      else nextParams.set("telemetryWindow", focusTelemetryWindowFilter);
    }
    if (focusTelemetrySearchQuery !== currentSearch) {
      changed = true;
      if (!focusTelemetrySearchQuery) nextParams.delete("telemetrySearch");
      else nextParams.set("telemetrySearch", focusTelemetrySearchQuery);
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [focusTelemetrySearchQuery, focusTelemetrySourceFilter, focusTelemetryWindowFilter, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeTab !== "platform_overview" && activeTab !== "panel_home") {
      return;
    }
    const hasTelemetryParams = searchParams.has("telemetrySource") || searchParams.has("telemetryWindow") || searchParams.has("telemetrySearch");
    if (hasTelemetryParams) {
      return;
    }
    const raw = window.localStorage.getItem(FOCUS_TELEMETRY_FILTERS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FocusTelemetryFilterSnapshot>;
      const snapshot: FocusTelemetryFilterSnapshot = {
        source: parsed.source || "all",
        window: parsed.window === "15m" ? "15m" : "all",
        search: parsed.search || "",
      };
      if (snapshot.source === "all" && snapshot.window === "all" && !snapshot.search) {
        return;
      }
      setFocusTelemetrySourceFilter(snapshot.source);
      setFocusTelemetryWindowFilter(snapshot.window);
      setFocusTelemetrySearchQuery(snapshot.search);
    } catch {
      window.localStorage.removeItem(FOCUS_TELEMETRY_FILTERS_STORAGE_KEY);
    }
  }, [activeTab, searchParams]);

  useEffect(() => {
    if (searchParams.get("focus") !== "subscription-addon") return;
    if (activeTab !== "panel_home") {
      setActiveTab("panel_home");
      return;
    }
    const targetAddon = searchParams.get("addonKey");
    if (targetAddon && addonCardRefs.current[targetAddon]) {
      addonCardRefs.current[targetAddon]?.scrollIntoView?.({ block: "center", behavior: "auto" });
      return;
    }
    subscriptionUpgradeSectionRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [activeTab, searchParams]);

  useEffect(() => {
    if (restoredQuoteDebugReplayFilter !== "last-replay-chain" || replayChainTargetQuoteId == null) {
      return;
    }
    if (restoredQuoteInsight?.quoteId === replayChainTargetQuoteId && restoredQuoteInsight.section === restoredQuoteReplayTarget) {
      return;
    }
    setRestoredQuoteInsight({ quoteId: replayChainTargetQuoteId, section: restoredQuoteReplayTarget });
    void toggleDiscoveryQuoteInsights(replayChainTargetQuoteId);
  }, [replayChainTargetQuoteId, restoredQuoteDebugReplayFilter, restoredQuoteInsight, restoredQuoteReplayTarget, toggleDiscoveryQuoteInsights]);

  useEffect(() => {
    if (activeTab !== "discovery_lab_operations" || !selectedFocusTelemetryTarget) {
      focusTelemetryAutoRevealKeyRef.current = null;
      return;
    }
    const nextRevealKey = `${selectedFocusTelemetryTarget.quoteId}:${selectedFocusTelemetryTarget.section}`;
    if (focusTelemetryAutoRevealKeyRef.current === nextRevealKey) {
      return;
    }
    focusTelemetryAutoRevealKeyRef.current = nextRevealKey;
    setTelemetryPulseTarget({
      quoteId: selectedFocusTelemetryTarget.quoteId,
      section: selectedFocusTelemetryTarget.section,
        reason: `Telemetry seçimi bu bölümü hedefledi: ${getQuoteInsightSectionLabel(selectedFocusTelemetryTarget.section)}`,
    });
    if (focusTelemetryPulseTimeoutRef.current) {
      window.clearTimeout(focusTelemetryPulseTimeoutRef.current);
    }
    focusTelemetryPulseTimeoutRef.current = window.setTimeout(() => {
      setTelemetryPulseTarget(null);
      focusTelemetryPulseTimeoutRef.current = null;
    }, 2200);
    announceFocusTelemetryAction(`Discovery Lab odagi acildi: RFQ #${selectedFocusTelemetryTarget.quoteId}`, "success", "navigation");
    void toggleDiscoveryQuoteInsights(selectedFocusTelemetryTarget.quoteId).then(() => {
      requestAnimationFrame(() => {
        const sectionRef = selectedFocusTelemetryTarget.section === "status-history"
          ? discoveryQuoteStatusHistoryRefs.current[selectedFocusTelemetryTarget.quoteId]
          : discoveryQuoteAuditTrailRefs.current[selectedFocusTelemetryTarget.quoteId];
        sectionRef?.scrollIntoView?.({ block: "center", behavior: "auto" });
      });
    });
  }, [activeTab, announceFocusTelemetryAction, selectedFocusTelemetryTarget, toggleDiscoveryQuoteInsights]);

  useEffect(() => {
    if (!restoredQuoteInsight) {
      setShowRestoredQuoteToast(false);
      setRestoredQuoteToastProgress(100);
      setRestoredQuoteToastRemainingMs(4500);
      setIsRestoredQuoteToastPaused(false);
      return;
    }
    setShowRestoredQuoteToast(true);
    setRestoredQuoteToastRemainingMs(4500);
    appendRestoredQuoteDebugEvent("lifecycle", "Bildirim Acildi", `RFQ #${restoredQuoteInsight.quoteId} bildirimi gosterildi`);
  }, [appendRestoredQuoteDebugEvent, restoredQuoteInsight]);

  useEffect(() => {
    if (!showRestoredQuoteToast) {
      return;
    }
    const focusHandle = window.setTimeout(() => {
      restoredQuoteToastRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusHandle);
    };
  }, [showRestoredQuoteToast]);

  useEffect(() => {
    setRestoredQuoteToastProgress(Math.max(0, (restoredQuoteToastRemainingMs / 4500) * 100));
    if (!showRestoredQuoteToast || isRestoredQuoteToastPaused || restoredQuoteToastRemainingMs <= 0) {
      if (restoredQuoteToastRemainingMs <= 0) {
        setShowRestoredQuoteToast(false);
      }
      return;
    }
    const intervalId = window.setInterval(() => {
      setRestoredQuoteToastRemainingMs((current) => Math.max(0, current - 100));
    }, 100);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRestoredQuoteToastPaused, restoredQuoteToastRemainingMs, showRestoredQuoteToast]);

  useEffect(() => {
    if (!restoredQuoteInsight) {
      return;
    }
    if (activeTab !== "discovery_lab_operations" || expandedDiscoveryQuoteInsightId == null) {
      return;
    }
    if (expandedDiscoveryQuoteInsightId !== restoredQuoteInsight.quoteId) {
      setRestoredQuoteInsight(null);
    }
  }, [activeTab, expandedDiscoveryQuoteInsightId, restoredQuoteInsight]);

  function resetTenantForm() {
    setTenantForm({
      legal_name: "",
      brand_name: "",
      category: "",
      city: "",
      subscription_plan_code: "starter",
      status: "active",
      onboarding_status: "draft",
      initial_admin_full_name: "",
      initial_admin_email: "",
      initial_admin_personal_phone: "",
    });
    setEditingTenantId(null);
  }

  function openNewTenantModal() {
    resetTenantForm();
    setTenantMessage(null);
    setIsTenantFormModalOpen(true);
  }

  function closeTenantModal() {
    setIsTenantFormModalOpen(false);
    resetTenantForm();
  }

  async function handleSubmitTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantForm.legal_name.trim()) {
      setTenantMessage("Stratejik Partner icin resmi firma adi zorunlu.");
      return;
    }

    try {
      setTenantSaving(true);
      setTenantMessage(null);
      if (editingTenantId) {
        await updateTenant(editingTenantId, {
          legal_name: tenantForm.legal_name,
          brand_name: tenantForm.brand_name,
          category: tenantForm.category,
          city: tenantForm.city,
          subscription_plan_code: tenantForm.subscription_plan_code,
          status: tenantForm.status,
          onboarding_status: tenantForm.onboarding_status,
        });
        setTenantMessage("Stratejik Partner kaydi guncellendi.");
      } else {
        const created = await createTenant({
          legal_name: tenantForm.legal_name,
          brand_name: tenantForm.brand_name,
          category: tenantForm.category,
          city: tenantForm.city,
          subscription_plan_code: tenantForm.subscription_plan_code,
          status: tenantForm.status,
          onboarding_status: tenantForm.onboarding_status,
          initial_admin:
            tenantForm.initial_admin_full_name.trim() && tenantForm.initial_admin_email.trim()
              ? {
                  full_name: tenantForm.initial_admin_full_name,
                  email: tenantForm.initial_admin_email,
                  personal_phone: tenantForm.initial_admin_personal_phone || undefined,
                }
              : undefined,
        });
        setTenantMessage(
          created.initial_admin_email_sent
            ? "Stratejik Partner super admin onaylı olarak açıldı. İlk yöneticiye şifre belirleme e-postası gönderildi."
            : "Stratejik Partner super admin onaylı olarak açıldı. İlk yönetici için şifre belirleme e-postası gönderilememiş olabilir."
        );
      }
      closeTenantModal();
      await loadData();
    } catch (err) {
      setTenantMessage(String(err));
    } finally {
      setTenantSaving(false);
    }
  }

  function handleEditTenant(tenant: Tenant) {
    setEditingTenantId(tenant.id);
    setTenantForm({
      legal_name: tenant.legal_name,
      brand_name: tenant.brand_name || "",
      category: tenant.category || "",
      city: tenant.city || "",
      subscription_plan_code: tenant.subscription_plan_code || "starter",
      status: tenant.status,
      onboarding_status: tenant.onboarding_status,
      initial_admin_full_name: tenant.owner_full_name || "",
      initial_admin_email: tenant.owner_email || "",
      initial_admin_personal_phone: "",
    });
    setTenantMessage(null);
    setIsTenantFormModalOpen(true);
  }

  function handleStartOnboardingTemplate(planCode: string) {
    const presets: Record<string, { legalName: string; brandName: string; city: string; adminEmail: string }> = {
      starter: {
        legalName: "Starter Müşteri Ltd.",
        brandName: "Starter Workspace",
        city: "Istanbul",
        adminEmail: "owner@starter.test",
      },
      growth: {
        legalName: "Growth Operasyon A.S.",
        brandName: "Growth Workspace",
        city: "Ankara",
        adminEmail: "owner@growth.test",
      },
      enterprise: {
        legalName: "Enterprise Tenant A.S.",
        brandName: "Enterprise Workspace",
        city: "Izmir",
        adminEmail: "owner@enterprise.test",
      },
    }
    const preset = presets[planCode] || presets.starter
    setEditingTenantId(null);
    setTenantForm({
      legal_name: preset.legalName,
      brand_name: preset.brandName,
      category: "",
      city: preset.city,
      subscription_plan_code: planCode,
      status: "active",
      onboarding_status: "draft",
      initial_admin_full_name: "İlk Stratejik Partner Admin",
      initial_admin_email: preset.adminEmail,
      initial_admin_personal_phone: "+90 555 000 00 00",
    });
    setTenantMessage(`${planCode} sarti ile hizli kurulum taslagi Stratejik Partner formuna tasindi.`);
    setIsTenantFormModalOpen(true);
    setActiveTab("tenant_governance");
                      navigateAdminTab("tenant_governance", { onboardingPlanFocus: planCode });
  }

  async function handleCreateDraftTenant(planCode: string) {
    if (!canEditTenantGovernance) {
      handleStartOnboardingTemplate(planCode);
      return;
    }

    try {
      setTenantSaving(true);
      setTenantMessage(null);
      const created = await createTenant({
        legal_name: planCode === "enterprise" ? "Enterprise Draft Tenant A.S." : `${planCode.toUpperCase()} Draft Tenant Ltd.`,
        brand_name: planCode === "enterprise" ? "Enterprise Draft Workspace" : `${planCode.toUpperCase()} Draft`,
        city: "Istanbul",
        subscription_plan_code: planCode,
        status: "active",
        onboarding_status: "draft",
        initial_admin: {
          full_name: "İlk Stratejik Partner Admin",
          email: `draft-${planCode}@procureflow.test`,
          personal_phone: "+90 555 000 00 00",
        },
      });
      setTenantForm({
        legal_name: created.legal_name,
        brand_name: created.brand_name || "",
        category: created.category || "",
        city: created.city || "",
        subscription_plan_code: created.subscription_plan_code || planCode,
        status: created.status,
        onboarding_status: created.onboarding_status,
        initial_admin_full_name: created.owner_full_name || "İlk Stratejik Partner Admin",
        initial_admin_email: created.owner_email || `draft-${planCode}@procureflow.test`,
        initial_admin_personal_phone: "+90 555 000 00 00",
      });
      setIsTenantFormModalOpen(true);
      setTenantMessage(`${created.legal_name} taslak Stratejik Partner olarak olusturuldu.`);
      setActiveTab("tenant_governance");
      navigateAdminTab("tenant_governance", { onboardingPlanFocus: planCode });
      await loadData();
    } catch (err) {
      setTenantMessage(String(err));
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleVerifyOnboardingPayment(tenantId: number) {
    try {
      setOnboardingMembershipActionTenantId(tenantId);
      await verifyTenantOnboardingPayment(tenantId);
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setOnboardingMembershipActionTenantId(null);
    }
  }

  async function handleApproveOnboardingMembership(tenantId: number) {
    try {
      setOnboardingMembershipActionTenantId(tenantId);
      await approveTenantOnboardingActivation(tenantId);
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setOnboardingMembershipActionTenantId(null);
    }
  }

  async function handleRejectOnboardingMembership(tenantId: number) {
    const note = window.prompt("Red nedeni / operasyon notu");
    if (note === null) {
      return;
    }

    try {
      setOnboardingMembershipActionTenantId(tenantId);
      await rejectTenantOnboardingActivation(tenantId, note);
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setOnboardingMembershipActionTenantId(null);
    }
  }

  async function handleRequestOnboardingInfo(tenantId: number) {
    const note = window.prompt("Hangi bilgi / dekont guncellemesi isteniyor?");
    if (note === null) {
      return;
    }

    try {
      setOnboardingMembershipActionTenantId(tenantId);
      await requestTenantOnboardingInfo(tenantId, note);
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setOnboardingMembershipActionTenantId(null);
    }
  }

  async function handleReviewTenantCategory(
    tenantId: number,
    categoryName: string,
    decision: "support_approved" | "final_approved" | "rejected"
  ) {
    const note = decision === "rejected"
      ? window.prompt("Kategori talebi neden reddediliyor?")
      : window.prompt("Kategori inceleme notu (opsiyonel)") ?? "";
    if (note === null) {
      return;
    }

    try {
      setOnboardingMembershipActionTenantId(tenantId);
      await reviewTenantCategoryRequest(tenantId, {
        category_name: categoryName,
        decision,
        note: note.trim() || undefined,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOnboardingMembershipActionTenantId(null);
    }
  }

  async function handleTenantStatusAction(tenant: Tenant, nextStatus: "active" | "paused") {
    try {
      setTenantSaving(true);
      setTenantMessage(null);
      await updateTenant(tenant.id, {
        status: nextStatus,
        is_active: nextStatus === "active",
      });
      setTenantMessage(nextStatus === "active" ? "Stratejik Partner yeniden aktif edildi." : "Stratejik Partner pasife alindi.");
      await loadData();
    } catch (err) {
      setTenantMessage(String(err));
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleDeleteTenant(tenant: Tenant) {
    if (tenant.is_active) {
      setTenantMessage("Tenant silinmeden once pasife alinmalidir.");
      return;
    }
    if (!window.confirm(`${tenant.brand_name || tenant.legal_name} ve bagli tum tenant kayitlari silinsin mi?`)) {
      return;
    }

    try {
      setTenantSaving(true);
      setTenantMessage(null);
      const result = await deleteTenant(tenant.id);
      setTenantMessage(result.message || "Stratejik Partner kaydi silindi.");
      await loadData();
    } catch (err) {
      setTenantMessage(String(err));
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleReassignTenantOwner(tenant: Tenant, ownerUserIdRaw: string) {
    const ownerUserId = Number(ownerUserIdRaw);
    if (!ownerUserId || Number.isNaN(ownerUserId)) {
      setTenantMessage("Geçerli bir Stratejik Partner yöneticisi seçin.");
      return;
    }

    try {
      setTenantSaving(true);
      setTenantMessage(null);
      await updateTenant(tenant.id, { owner_user_id: ownerUserId });
      setTenantMessage("Stratejik Partner yöneticisi güncellendi.");
      await loadData();
    } catch (err) {
      setTenantMessage(String(err));
    } finally {
      setTenantSaving(false);
    }
  }

  async function handleRetryBillingWebhookEvent(eventId: number) {
    try {
      setBillingWebhookRetryingEventId(eventId);
      setError(null);
      await retryBillingWebhookEvent(eventId);
      await loadData();
    } catch (err) {
      setError(String(err));
    } finally {
      setBillingWebhookRetryingEventId(null);
    }
  }

  // Check admin access
  if (!canOpenWorkspacePanel && !canAccessRoleCatalog) {
    return (
      <div className="admin-page__access-denied">
        Bu sayfaya erişim için yönetim yetkisi gerekir
      </div>
    );
  }

  // Handler fonksiyonlar yeni tab bilesenlerine tasindi

  if (loading) {
    return <div className="admin-page__loading">Çalışma alanı yükleniyor...</div>;
  }

  const panelMenuStyle = activeWorkspacePanelProfile?.menu_style || "pill";
  const menuRowClassName =
    panelMenuStyle === "accordion" || panelMenuStyle === "drawer"
      ? "admin-page__tabs-row admin-page__tabs-row--stacked"
      : "admin-page__tabs-row";
  const tabButtonClassName = (tabKey: AdminTabKey) => [
    "admin-page__tab-button",
    activeTab === tabKey ? "admin-page__tab-button--active" : "",
    panelMenuStyle === "tabs" ? "admin-page__tab-button--tabs" : "",
    panelMenuStyle === "accordion" || panelMenuStyle === "drawer" ? "admin-page__tab-button--drawer" : "",
  ].filter(Boolean).join(" ");
  const upgradeExtrasTabClassName = [
    "admin-page__tab-link",
    isUpgradeExtrasPage ? "admin-page__tab-link--active" : "",
  ].filter(Boolean).join(" ");

  const _shellMode = canAccessAdminSurface(user);

  const _adminNode = (
    <div className="admin-page">
      <ImpersonationBanner />

      {/* ScopeWorkspaceHome - panel_home en uste */}
      {activeTab === "panel_home" && (
        <section className="admin-page__section">
          {workspacePanelError ? (
            <div className="admin-page__notice admin-page__notice--error">
              Panel profili okunurken hata alindi: {workspacePanelError}
            </div>
          ) : null}
          <ScopeWorkspaceHome
            hideTopSummarySection
            hideBottomSections={canViewPlatformGovernance}
            user={user}
            currentUserRoleLabel={currentUserRoleLabel}
            title={activeWorkspacePanelProfile?.hero_title || currentUserRoleLabel}
            description={activeWorkspacePanelProfile?.hero_description || "Bu role ait hizli linkler, scope kapsami ve onay kuyrugu bu ana sayfada toplanır."}
            platformMetrics={panelHomePlatformMetrics}
            topNotice={activeWorkspacePanelProfile?.top_notice || null}
            headerInfo={activeWorkspacePanelProfile?.header_info || null}
            footerInfo={activeWorkspacePanelProfile?.footer_info || null}
            headerBgColor={activeWorkspacePanelProfile?.header_bg_color || null}
            headerTextColor={activeWorkspacePanelProfile?.header_text_color || null}
            footerBgColor={activeWorkspacePanelProfile?.footer_bg_color || null}
            footerTextColor={activeWorkspacePanelProfile?.footer_text_color || null}
            heroTextColor={activeWorkspacePanelProfile?.hero_text_color || null}
            heroMutedTextColor={activeWorkspacePanelProfile?.hero_muted_text_color || null}
            accentColor={activeWorkspacePanelProfile?.accent_color || null}
            secondaryAccentColor={activeWorkspacePanelProfile?.secondary_accent_color || null}
            accentOpacity={activeWorkspacePanelProfile?.accent_opacity ?? null}
            secondaryAccentOpacity={activeWorkspacePanelProfile?.secondary_accent_opacity ?? null}
            primaryAccentStop={activeWorkspacePanelProfile?.primary_accent_stop ?? null}
            secondaryAccentStart={activeWorkspacePanelProfile?.secondary_accent_start ?? null}
            glowIntensity={activeWorkspacePanelProfile?.glow_intensity ?? null}
            quickLinks={workspacePanelQuickLinks}
            requests={catalogRequests}
            requestBusyId={catalogRequestBusyId}
            onCreateRoleRequest={handleCreateRoleCatalogRequest}
            onCreateDepartmentRequest={handleCreateDepartmentCatalogRequest}
            onReviewRequest={handleReviewCatalogRequest}
          />
        </section>
      )}

      {!_shellMode && (
      <section className="admin-page__card admin-page__card--padded">
        <div className={menuRowClassName}>
          {tabConfigs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-testid={`admin-tab-${tab.key}`}
              onClick={() => {
                navigateAdminTab(tab.key);
              }}
              className={tabButtonClassName(tab.key)}
            >
              <span className="admin-page__tab-button-inner">
                {renderTabIconBadge(tab.icon, activeTab === tab.key)}
                <span>{tab.label}</span>
              </span>
            </button>
          ))}
          <Link
            to="/admin/yukseltme-ekstra-ozellikler?tab=panel_home"
            data-testid="admin-tab-upgrade-extras"
            className={upgradeExtrasTabClassName}
          >
            <span className="admin-page__tab-link-inner">
              {renderTabIconBadge("PKG", isUpgradeExtrasPage)}
              <span>Yukseltme / Ekstra Ozellikler</span>
            </span>
          </Link>
        </div>
      </section>
      )}

      {activeTab === "panel_home" && (() => {
        const _scope = String(user?.scope_type || "").toLowerCase();
        const isPlat = _scope === "platform";
        const requestSummaryTop = {
          pending: catalogRequests.filter((item) => item.review_status === "pending_review").length,
          approved: catalogRequests.filter((item) => item.review_status === "approved").length,
          rejected: catalogRequests.filter((item) => item.review_status === "rejected").length,
        };
        const quickLinkTone = isPlat ? "navy" : _scope === "channel" ? "amber" : _scope === "supplier" ? "red" : "blue";
        return (
          <div className="ph-page">
            {/* ── Platform Yönetim Alanı — audience cards + approval strip ── */}
            {isPlat && panelHomePlatformMetrics ? (
              <>
                <div className="ph-section">
                  <div className="ph-section__head">
                    <div>
                      <div className="ph-section__title">Platform Yönetim Alanı</div>
                      <div className="ph-section__sub">Aktif kitle dağılımı ve onay durumu</div>
                    </div>
                  </div>
                  <div className="ph-aud-grid">
                    {([
                      {
                        code: "strategic", label: "Stratejik Partner", color: "#1d4ed8", bg: "#eef4ff",
                        subLabel: `${panelHomePlatformMetrics.partnerActiveCompanies} aktif · ${panelHomePlatformMetrics.partnerPassiveCompanies} pasif`,
                        metrics: [
                          { k: "Firma",     v: panelHomePlatformMetrics.partnerCompanies },
                          { k: "Personel",  v: panelHomePlatformMetrics.partnerPersonnel },
                          { k: "Proje",     v: panelHomePlatformMetrics.partnerProjects },
                          { k: "Aylık RFQ", v: panelHomePlatformMetrics.partnerQuotes },
                        ],
                        ctaKey: "tenant_governance",
                      },
                      {
                        code: "supplier", label: "Tedarikçi", color: "#be123c", bg: "#fff1f1",
                        subLabel: `${panelHomePlatformMetrics.supplierActiveCompanies} aktif · ${panelHomePlatformMetrics.supplierPassiveCompanies} pasif`,
                        metrics: [
                          { k: "Firma",             v: panelHomePlatformMetrics.supplierCompanies },
                          { k: "Yanıtlanan Teklif", v: panelHomePlatformMetrics.supplierRespondedQuotes },
                          { k: "Revize Teklif",     v: panelHomePlatformMetrics.supplierRevisedQuotes },
                        ],
                        ctaKey: "platform_suppliers",
                      },
                      {
                        code: "channel", label: "İş Ortağı", color: "#047857", bg: "#ecfdf5",
                        subLabel: `${panelHomePlatformMetrics.channelActiveCompanies} aktif · ${panelHomePlatformMetrics.channelPassiveCompanies} pasif`,
                        metrics: [
                          { k: "Firma",      v: panelHomePlatformMetrics.channelCompanies },
                          { k: "Personel",   v: panelHomePlatformMetrics.channelPersonnel },
                          { k: "Proje",      v: panelHomePlatformMetrics.channelProjects },
                          { k: "Hak ediş",   v: panelHomePlatformMetrics.channelQuotes },
                        ],
                        ctaKey: "channel_partners",
                      },
                    ] as const).map((a) => (
                      <div key={a.code} className="ph-aud-card" style={{ "--aud": a.color, "--aud-bg": a.bg } as React.CSSProperties}>
                        <div className="ph-aud-card__head">
                          <span className="ph-aud-card__title">{a.label}</span>
                          <span className="ph-aud-card__badge">{a.subLabel}</span>
                        </div>
                        <div className="ph-aud-card__body">
                          {a.metrics.map((m) => (
                            <div key={m.k} className="ph-aud-card__row">
                              <span>{m.k}</span>
                              <b>{m.v}</b>
                            </div>
                          ))}
                        </div>
                        <div className="ph-aud-card__foot">
                          <button type="button" className="ph-aud-card__cta" onClick={() => navigateAdminTab(a.ctaKey)}>
                            Yönet →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Approval strip */}
                  <div className="ph-approval-strip">
                    {[
                      { label: "Bekleyen Talep", value: requestSummaryTop.pending,            cls: "warn", sub: "Son 24 saatte hareketsiz" },
                      { label: "Onaylanan",       value: requestSummaryTop.approved,           cls: "ok",   sub: "▲ %12 · son 7 gün" },
                      { label: "Reddedilen",      value: requestSummaryTop.rejected,           cls: "bad",  sub: "▼ %3 · son 7 gün" },
                      { label: "Hızlı Link",      value: workspacePanelQuickLinks.length,      cls: "blue", sub: "Sabitlenmiş kısayollar" },
                    ].map((c) => (
                      <div key={c.label} className={`ph-appr-card ph-appr-card--${c.cls}`}>
                        <div className="ph-appr-card__label">{c.label}</div>
                        <div className="ph-appr-card__value">{c.value}</div>
                        <div className="ph-appr-card__sub">{c.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Collapsible KPI strip ── */}
                <div className={`ph-kpi-collapse${phKpiOpen ? " ph-kpi-collapse--open" : ""}`}>
                  <button type="button" className="ph-kpi-collapse__toggle" onClick={() => setPhKpiOpen((c) => !c)}>
                    <span className="ph-kpi-collapse__title">Finans &amp; Sağlık Özeti</span>
                    <span className="ph-kpi-collapse__summary">
                      <span>MRR <b>₺1.284K</b></span>
                      <span>ARR <b>₺15.4M</b></span>
                      <span>Partner <b>42</b></span>
                      <span>Churn <b>%1.4</b></span>
                      <span>SLA <b>%99.98</b></span>
                    </span>
                    <span className="ph-kpi-collapse__chevron">{phKpiOpen ? "▲" : "▼"}</span>
                  </button>
                  {phKpiOpen && (
                    <div className="ph-kpi-grid">
                      {[
                        { label: "Aylık Tekrarlayan Gelir (MRR)", value: "₺1.284.500", delta: "+%12.3", accent: "blue" },
                        { label: "Yıllık Gelir (ARR)",            value: "₺15.4M",     delta: "+%14.8", accent: "gold" },
                        { label: "Aktif Partner",                  value: "42",          delta: "+4",     accent: "" },
                        { label: "Churn (30 gün)",                 value: "%1.4",        delta: "▼ %0.3", accent: "green" },
                        { label: "SLA Sağlık",                     value: "%99.98",      sub: "Son 30 gün · hedef ≥%99.9", accent: "green" },
                      ].map((k) => (
                        <div key={k.label} className={`ph-kpi-card${k.accent ? ` ph-kpi-card--${k.accent}` : ""}`}>
                          <div className="ph-kpi-card__label">{k.label}</div>
                          <div className="ph-kpi-card__value">{k.value}</div>
                          {"delta" in k && k.delta && <div className="ph-kpi-card__delta">{k.delta}</div>}
                          {"sub" in k && k.sub && <div className="ph-kpi-card__sub">{k.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Operasyonel Uyarılar ── */}
                <div className="ph-section">
                  <div className="ph-section__head">
                    <div>
                      <div className="ph-section__title">Operasyonel Uyarılar</div>
                      <div className="ph-section__sub">Anlık aksiyon gerektiren kuyruklar</div>
                    </div>
                    <button type="button" className="ph-lnk" onClick={() => navigateAdminTab("platform_operations")}>Tümünü gör →</button>
                  </div>
                  <div className="ph-ops-grid">
                    {PH_OPS_QUEUE.map((o) => (
                      <div key={o.code} className="ph-ops-card" style={{ "--ops": o.color } as React.CSSProperties}>
                        <div className="ph-ops-card__label">{o.label}</div>
                        <div className="ph-ops-card__value">{o.count}</div>
                        <div className="ph-ops-card__desc">{o.desc}</div>
                        <button type="button" className="ph-ops-card__cta">{o.cta} →</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Destek Kuyruğu ── */}
                <div className="ph-section">
                  <div className="ph-section__head">
                    <div>
                      <div className="ph-section__title">Destek Kuyruğu</div>
                      <div className="ph-section__sub">Platform desteği · gelen ticket durumları</div>
                    </div>
                  </div>
                  <div className="ph-ops-grid">
                    {PH_SUPPORT_QUEUE.map((s) => (
                      <div key={s.code} className="ph-ops-card" style={{ "--ops": s.color } as React.CSSProperties}>
                        <div className="ph-ops-card__label">{s.label}</div>
                        <div className="ph-ops-card__value">{s.count}</div>
                        <div className="ph-ops-card__desc">{s.desc}</div>
                        <button type="button" className="ph-ops-card__cta">{s.cta} →</button>
                      </div>
                    ))}
                  </div>
                  <div className="ph-sup-summary">
                    {PH_SUPPORT_SUMMARY.map((s) => (
                      <div key={s.code} className="ph-sup-card" style={{ "--sup": s.color } as React.CSSProperties}>
                        <div className="ph-sup-card__label">{s.label}</div>
                        <div className={`ph-sup-card__value${s.isPerson ? " ph-sup-card__value--person" : ""}`}>{s.value}</div>
                        <div className="ph-sup-card__desc">{s.desc}</div>
                        <button type="button" className="ph-sup-card__cta">{s.cta} →</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Operasyon Kuyruğu ── */}
                <div className="ph-section">
                  <div className="ph-section__head">
                    <div>
                      <div className="ph-section__title">Operasyon Kuyruğu · Platform destek öncelikleri</div>
                      <div className="ph-section__sub">Müdahale önceliği yüksek Stratejik Partner kayıtları tek görünümde.</div>
                    </div>
                  </div>
                  <div className="ph-priority-list">
                    {PH_PRIORITY_TENANTS.map((t) => (
                      <div key={t.slug} className="ph-priority-row">
                        <div className="ph-priority-row__main">
                          <div className="ph-priority-row__name">{t.name}</div>
                          <div className="ph-priority-row__tags">
                            {t.tags.map((tag, i) => (
                              <span key={i} className={`ph-priority-tag${
                                tag.includes("Kurulum") ? " ph-tag-blue"  :
                                tag.includes("Marka")   ? " ph-tag-amber" :
                                tag.includes("Destek")  ? " ph-tag-green" : ""
                              }`}>{tag}</span>
                            ))}
                          </div>
                        </div>
                        <div className="ph-priority-row__slug">{t.slug}</div>
                        <button type="button" className="ph-row-act" title="Detay">↗</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── MRR Trendi + Uyarılar — 2:1 split ── */}
                <div className="ph-split-2-1">
                  <div className="ph-section">
                    <div className="ph-section__head">
                      <div>
                        <div className="ph-section__title">MRR Trendi</div>
                        <div className="ph-section__sub">Son 12 ay · net büyüme = yeni − churn</div>
                      </div>
                      <div className="ph-legend">
                        <span className="ph-legend-dot ph-legend-dot--mrr" />MRR
                      </div>
                    </div>
                    <div className="ph-mrr-chart">
                      <svg viewBox="0 0 480 120" className="ph-mrr-svg" preserveAspectRatio="none">
                        {PH_MRR_SERIES.map((d, i) => {
                          const maxMrr = 1284500;
                          const barH = Math.round((d.mrr / maxMrr) * 100);
                          const x = 2 + i * 40;
                          return (
                            <rect key={d.m} x={x} y={110 - barH} width={34} height={barH} rx={3}
                              fill="#2563eb" opacity={i === PH_MRR_SERIES.length - 1 ? 1 : 0.5} />
                          );
                        })}
                      </svg>
                      <div className="ph-mrr-labels">
                        {PH_MRR_SERIES.map((d) => (
                          <span key={d.m}>{d.m.slice(5)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="ph-mrr-stats">
                      <div><span>Bu ay yeni</span><b className="ph-pos">+₺132.000</b></div>
                      <div><span>Bu ay churn</span><b className="ph-neg">−₺99.500</b></div>
                      <div><span>Net büyüme</span><b className="ph-pos">+₺32.500</b></div>
                      <div><span>Büyüme oranı</span><b className="ph-pos">+%2.6</b></div>
                    </div>
                  </div>

                  <div className="ph-section">
                    <div className="ph-section__head">
                      <div>
                        <div className="ph-section__title">Operasyonel Uyarılar</div>
                        <div className="ph-section__sub">Bekleyen {PH_ALERTS.length}</div>
                      </div>
                      <button type="button" className="ph-lnk">Tümünü gör →</button>
                    </div>
                    <div className="ph-alert-list">
                      {PH_ALERTS.map((a) => (
                        <div key={a.id} className={`ph-alert-row ph-alert-row--${a.level}`}>
                          <div className="ph-alert-row__dot" />
                          <div className="ph-alert-row__body">
                            <div className="ph-alert-row__title">{a.title}</div>
                            <div className="ph-alert-row__desc">{a.desc}</div>
                          </div>
                          <button type="button" className="ph-alert-row__cta">{a.cta}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Non-platform: compact summary strip */
              <section className="admin-page__card admin-page__card--large admin-page__card--stacked">
                <div className="admin-page__summary-grid">
                  {[
                    { label: "Bekleyen Talep", value: requestSummaryTop.pending, tone: "amber" },
                    { label: "Onaylanan",       value: requestSummaryTop.approved, tone: "green" },
                    { label: "Reddedilen",      value: requestSummaryTop.rejected, tone: "red-dark" },
                    { label: "Hizli Link",      value: workspacePanelQuickLinks.length, tone: quickLinkTone },
                  ].map((item) => (
                    <div key={item.label} className={`admin-page__summary-card admin-page__tone--${item.tone}`}>
                      <div className="admin-page__summary-label">{item.label}</div>
                      <div className="admin-page__summary-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        );
      })()}

      {shouldLoadAdminWorkspaceData && !canViewPlatformGovernance && (
        <section className="admin-page__grid admin-page__grid--compact">
          <div className="admin-page__summary-grid">
          {[
            { label: "Firma", value: companies.length, note: `${totalActiveCompanies} aktif / ${totalPassiveCompanies} pasif`, tone: "blue" },
            { label: "Proje", value: projects.length, note: `${totalActiveProjects} aktif / ${totalPassiveProjects} pasif`, tone: "teal" },
            { label: "Teklif", value: overviewQuoteTotal || currentTenantQuoteCount, note: "Toplam teklif kaydi", tone: "violet" },
            { label: "Personel", value: personnel.length, note: `${totalActivePersonnel} aktif personel`, tone: "red" },
          ].map((item) => (
            <div key={item.label} className={`admin-page__overview-card admin-page__tone--${item.tone}`}>
              <div className="admin-page__overview-label">{item.label}</div>
              <div className="admin-page__overview-value">{item.value}</div>
              <div className="admin-page__overview-note">{item.note}</div>
            </div>
          ))}
          </div>
        </section>
      )}


      {activeTab === "platform_overview" && (
        <div className="atc-page--header">
          <PageHeader
            eyebrow="Genel"
            title="Platform Genel Bakış"
            sub="Finans, partner sağlığı ve operasyon metrikleri"
          />
          <div className="kpi-grid">
            {/* TODO(data): MRR — finans/fatura servisi gerekli */}
            <StatCard label="MRR" value="—" sub="TODO(data): finans servisi" accent="blue" />
            {/* TODO(data): ARR — finans/fatura servisi gerekli */}
            <StatCard label="ARR" value="—" sub="TODO(data): finans servisi" accent="gold" />
            <StatCard
              label="Aktif Partner"
              value={tenants.filter((t) => t.is_active).length}
              sub={`${tenants.filter((t) => !t.is_active).length} pasif kayıt`}
            />
            {/* TODO(data): Churn — abonelik geçmişi servisi gerekli */}
            <StatCard label="Churn (30 gün)" value="—" unit="%" sub="TODO(data): abonelik servisi" accent="green" />
            {/* TODO(data): SLA — izleme/uptime servisi gerekli */}
            <StatCard label="SLA Sağlık" value="—" unit="%" sub="TODO(data): izleme servisi" accent="green" />
          </div>
        </div>
      )}

      {activeTab === "platform_overview" && canViewPlatformGovernance && (
        <section className="admin-page__grid">
          {(searchParams.get("tenantFocusName") || searchParams.get("projectFocusName") || searchParams.get("onboardingPlanFocus")) ? renderAdminFocusBanner({
            eyebrow: "Yönetici Odağı",
            title: searchParams.get("tenantFocusName")
              ? `Platform genel bakış odağı: ${searchParams.get("tenantFocusName")}`
              : searchParams.get("projectFocusName")
                ? `Platform genel bakış odağı: ${searchParams.get("projectFocusName")}`
                : `Platform genel bakış odağı: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} planı`,
            detail: searchParams.get("tenantFocusName")
              ? "Platform genel bakış kartları seçili Stratejik Partner bağlamına göre izleniyor."
              : searchParams.get("projectFocusName")
                ? "Discovery Lab izleme kartları seçili proje bağlamına göre okunuyor."
                : "Onboarding odağı platform genel bakış seviyesinde korunuyor.",
            tone: "amber",
            sourceLabel: "Platform genel bakış bağlantısı",
            timestamp: Date.now(),
            actions: [
              searchParams.get("tenantFocusName") ? { label: "Stratejik Partner Yönetimine Git", onClick: () => navigateAdminTab("tenant_governance", { tenantFocusId: searchParams.get("tenantFocusId") || "", tenantFocusName: searchParams.get("tenantFocusName") || "" }) } : undefined,
              searchParams.get("projectFocusName") ? { label: "Discovery Lab'a Git", onClick: () => navigateAdminTab("discovery_lab_operations", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
              searchParams.get("projectFocusName") ? { label: "Projelere Git", onClick: () => navigateAdminTab("projects", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
              searchParams.get("onboardingPlanFocus") ? { label: "Onboarding'e Git", onClick: () => navigateAdminTab("onboarding_studio", { onboardingPlanFocus: searchParams.get("onboardingPlanFocus") || "" }) } : undefined,
              { label: "Odağı Temizle", onClick: () => navigateAdminTab("panel_home") },
            ].filter(Boolean) as Array<{ label: string; onClick?: () => void; href?: string }>,
            testId: "admin-focus-banner-platform-overview",
          }) : null}
          <div className="admin-page__metric-grid">
            {[
              {
                label: "Kurulum Kuyruğu",
                value: platformOpsSummary.onboardingQueue.length,
                note: "Etkin olmayan kurulum durumundaki kiracı sayısı",
                tone: "amber",
                onClick: () => navigateAdminTab("onboarding_studio", { onboardingPlanFocus: "pending" }),
              },
              {
                label: "Sorumlu Aksiyonu",
                value: platformOpsSummary.ownerAttention.length,
                note: "Sorumlu ataması veya sorumlu e-posta bilgisi eksik kayıtlar",
                tone: "red",
                onClick: () => navigateAdminTab("tenant_governance"),
              },
              {
                label: "Marka Kimliği Eksiği",
                value: platformOpsSummary.brandingAttention.length,
                note: "Logo veya görünen ad bilgisi eksik kiracılar",
                tone: "violet",
                onClick: () => navigateAdminTab("tenant_governance"),
              },
              {
                label: "Pasif Stratejik Partner",
                value: platformOpsSummary.pausedTenants.length,
                note: "Duraklatılmış veya pasif durumdaki Stratejik Partnerler",
                tone: "slate",
                onClick: () => navigateAdminTab("tenant_governance"),
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={`admin-page__metric-button admin-page__tone--${card.tone}`}
              >
                <div className="admin-page__metric-label">{card.label}</div>
                <div className="admin-page__metric-value">{card.value}</div>
                <div className="admin-page__metric-note">{card.note}</div>
                <div className="admin-page__metric-link">İlgili alana git →</div>
              </button>
            ))}
          </div>

          <div className="admin-page__metric-grid">
            {[
              {
                label: "Açık Destek Kaydı",
                value: platformOpsOverviewSummary.activeWork,
                note: "Yeni, işlemde veya sorumlu yanıtı bekleyen destek kayıtları",
                tone: "blue",
                onClick: () => navigateAdminTab("support_tickets"),
              },
              {
                label: "Sorumlu Bekleyen Destek",
                value: platformOpsOverviewSummary.ownerWaiting,
                note: "Platform ekibinin sorumlu geri dönüşü beklediği kayıtlar",
                tone: "violet",
                onClick: () => navigateAdminTab("support_tickets"),
              },
              {
                label: "Kapanışı Tamamlanan",
                value: platformOpsOverviewSummary.resolvedWithReason,
                note: "Çözüldü durumuna alınıp kapanış nedeni girilen kayıtlar",
                tone: "green",
                onClick: () => navigateAdminTab("support_tickets"),
              },
              {
                label: "Teması Geciken Kayıt",
                value: platformOpsOverviewSummary.staleContact,
                note: "Üç gün ve üzeri temas edilmeyen aktif destek kayıtları",
                tone: "amber",
                onClick: () => navigateAdminTab("support_tickets"),
              },
              {
                label: "Sorumlusuz Destek Kaydı",
                value: platformOpsOverviewSummary.unassignedOwner,
                note: "Aktif kayıtlarda operasyon sorumlusu atanmamış Stratejik Partner sayısı",
                tone: "red",
                onClick: () => navigateAdminTab("support_tickets"),
              },
              {
                label: "En Yoğun Destek Sorumlusu",
                value: platformOpsOverviewSummary.busiestOwnerName,
                note: `${platformOpsOverviewSummary.busiestOwnerLoad} aktif kayıt`,
                tone: "teal",
                onClick: () => navigateAdminTab("support_tickets"),
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={`admin-page__metric-button admin-page__tone--${card.tone}`}
              >
                <div className="admin-page__metric-label">{card.label}</div>
                <div className="admin-page__metric-value">{card.value}</div>
                <div className="admin-page__metric-note">{card.note}</div>
                <div className="admin-page__metric-link">Detaya git →</div>
              </button>
            ))}
          </div>

          <div className="admin-page__single-column-grid">
            <div className="admin-page__panel-card">
              <div className="admin-page__panel-eyebrow">Operasyon Kuyruğu</div>
              <div className="admin-page__panel-title">Platform destek öncelikleri</div>
              <div className="admin-page__panel-lead">
                Bu liste, müdahale önceliği yüksek Stratejik Partner kayıtlarını tek görünümde toplar ve operasyon ekibine günlük aksiyon sırası verir.
              </div>
              <div className="admin-page__panel-copy">
                Önce sorumlu geri dönüşü bekleyen destek kayıtları, ardından kurulum ve marka kimliği eksikleri; son adımda pasif yaşam döngüsü riskleri değerlendirilir.
              </div>
              <div className="admin-page__panel-copy">{tenants.slice(0, 3).map((tenant) => tenant.brand_name || tenant.legal_name).filter(Boolean).join(" • ") || "Örnek kiracı listesi"}</div>
              <div className="admin-page__item-stack">
                {platformOpsSummary.highestPriorityTenants.length === 0 ? (
                  <div className="admin-page__empty-state">
                    Açık operasyon kuyruğu oluşturan Stratejik Partner kaydı bulunmuyor.
                  </div>
                ) : (
                  platformOpsSummary.highestPriorityTenants.map((tenant) => {
                    const tags = [
                      String(tenant.onboarding_status || "").toLowerCase() !== "active" ? `Kurulum: ${formatPartnerOnboardingStatus(tenant.onboarding_status)}` : null,
                      !tenant.owner_user_id || !tenant.owner_email ? "Sorumlu bilgisi eksik" : null,
                      !tenant.logo_url || !tenant.brand_name ? "Marka kimliği eksik" : null,
                      !tenant.is_active || String(tenant.status || "").toLowerCase() === "paused" ? `Durum: ${formatPartnerLifecycleStatus(tenant.status)}` : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "in_progress" ? "Destek: İşlemde" : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "waiting_owner" ? "Destek: Sorumlu bekleniyor" : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "resolved" ? "Destek: Çözüldü" : null,
                    ].filter(Boolean);

                    return (
                      <div key={`ops-${tenant.id}`} className="admin-page__mini-card">
                        <div className="admin-page__space-between-row">
                          <div className="admin-page__mini-card-title">{tenant.brand_name || tenant.legal_name}</div>
                          <span className="admin-page__muted-small">{tenant.slug}</span>
                        </div>
                        <div className="admin-page__chip-row">
                          {tags.map((tag) => (
                            <span key={`${tenant.id}-${tag}`} className="admin-page__neutral-chip">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div ref={focusTelemetryPanelRef} className="admin-page__panel-card admin-page__panel-card--stacked">
              <div className="admin-page__panel-eyebrow">Yönetici Odak Telemetrisi</div>
              <div className="admin-page__panel-title">Paylaşılan focus olay listesi</div>
              <div className="admin-page__link-description">Platform genel bakış, filtre odakları ve geri yükleme davranışları tek listede toplanır.</div>
              <div className="admin-page__wrap-row">
                {focusTelemetryExportMeta.headerLines.map((line) => (
                  <span key={line} className="admin-page__soft-chip">
                    {line}
                  </span>
                ))}
              </div>
              <div className="admin-page__form-row">
                <label className="admin-page__field admin-page__field--wide">
                  Preset Adı
                  <input aria-label="Telemetry Preset Adı" value={focusTelemetryPresetName} onChange={(event) => setFocusTelemetryPresetName(event.target.value)} placeholder="örnek: Merkez Replay" className="admin-page__control" />
                </label>
                <button type="button" onClick={saveFocusTelemetryPreset} className="admin-page__pill-button">
                  Preset Kaydet
                </button>
                <button type="button" onClick={exportFocusTelemetryPresetPackage} className="admin-page__pill-button admin-page__pill-button--blue">
                  Preset Paketi Hazırla
                </button>
                <button type="button" onClick={importFocusTelemetryPresetPackage} className="admin-page__pill-button admin-page__pill-button--violet">
                  Preset Paketini İçe Aktar
                </button>
                {focusTelemetryPresets.map((preset) => (
                  <div key={preset.id} className="admin-page__chip-row">
                    {focusTelemetryEditingPresetId === preset.id ? (
                      <>
                        <input aria-label={`Preset Yeniden Adlandır ${preset.name}`} value={focusTelemetryPresetDraftName} onChange={(event) => setFocusTelemetryPresetDraftName(event.target.value)} className="admin-page__control admin-page__field--narrow" />
                        <button type="button" onClick={() => commitFocusTelemetryPresetRename(preset.id)} className="admin-page__pill-button admin-page__pill-button--blue">
                          Kaydet
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => applyFocusTelemetryPreset(preset.id)} className="admin-page__pill-button admin-page__pill-button--soft">
                        Preset: {preset.name}
                      </button>
                    )}
                    <button type="button" onClick={() => startFocusTelemetryPresetRename(preset.id)} className="admin-page__pill-button admin-page__pill-button--amber">
                      Yeniden Adlandır
                    </button>
                    <button type="button" onClick={() => deleteFocusTelemetryPreset(preset.id)} className="admin-page__pill-button admin-page__pill-button--red">
                      Preseti Sil
                    </button>
                  </div>
                ))}
              </div>
              <div className="admin-page__form-row">
                <label className="admin-page__field">
                  Kaynak Filtresi
                  <select aria-label="Telemetry Kaynak Filtresi" value={focusTelemetrySourceFilter} onChange={(event) => setFocusTelemetrySourceFilter(event.target.value)} className="admin-page__control">
                    <option value="all">Tüm Kaynaklar</option>
                    <option value="platform-overview">Platform Genel Bakışı</option>
                    <option value="tenant-governance">Stratejik Partner Yönetimi</option>
                    <option value="platform-operations">Platform Operasyonları</option>
                    <option value="packages">Paketler</option>
                    <option value="discovery-lab">Discovery Lab</option>
                  </select>
                </label>
                <label className="admin-page__field admin-page__field--narrow">
                  Zaman Penceresi
                  <select aria-label="Telemetry Zaman Filtresi" value={focusTelemetryWindowFilter} onChange={(event) => setFocusTelemetryWindowFilter(event.target.value as "all" | "15m")} className="admin-page__control">
                    <option value="all">Tum Zaman</option>
                    <option value="15m">Son 15 Dakika</option>
                  </select>
                </label>
                <label className="admin-page__field admin-page__field--wide">
                  Telemetry Arama
                  <input aria-label="Telemetry Arama" value={focusTelemetrySearchQuery} onChange={(event) => setFocusTelemetrySearchQuery(event.target.value)} placeholder="platform, restore, RFQ ara" className="admin-page__control" />
                </label>
              </div>
              <label className="admin-page__field">
                Preset Paketi JSON
                <textarea aria-label="Telemetry Preset Paketi" value={focusTelemetryPresetPackageText} onChange={(event) => setFocusTelemetryPresetPackageText(event.target.value)} placeholder="Preset paketi JSON burada hazirlanir veya ice aktarim icin yapistirilir" className="admin-page__control admin-page__textarea" />
              </label>
              <div className={`admin-page__preview-card${previewFocusTelemetryPresetPackage.isValid ? "" : " admin-page__preview-card--invalid"}`}>
                <div className="admin-page__subsection-title">On Ayar Paketi Onizlemesi</div>
                {previewFocusTelemetryPresetPackage.previewPresetNames.length > 1 ? (
                  <div className="admin-page__subsection-grid">
                    <div className="admin-page__subsection-title admin-page__subsection-title--xs admin-page__subsection-title--muted">Referans on ayar secimi</div>
                    <div className="admin-page__chip-row">
                      {previewFocusTelemetryPresetPackage.previewPresetNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setFocusTelemetryPreviewPresetName(name)}
                          className={`admin-page__pill-button admin-page__pill-button--xs ${
                            focusTelemetryPreviewPresetName === name || (!focusTelemetryPreviewPresetName && previewFocusTelemetryPresetPackage.previewPresetNames[0] === name)
                              ? "admin-page__pill-button--active-blue"
                              : ""
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="admin-page__preview-summary">
                  {previewFocusTelemetryPresetPackage.activeFilterSummary}
                </div>
                <div className="admin-page__wrap-row">
                  <span className="admin-page__tag-chip">Versiyon: {previewFocusTelemetryPresetPackage.versionLabel}</span>
                  <span className="admin-page__tag-chip">Disa Aktarim Zamani: {previewFocusTelemetryPresetPackage.exportedAtLabel}</span>
                  <span className="admin-page__tag-chip">Calisma Alani: {previewFocusTelemetryPresetPackage.sourceWorkspaceLabel}</span>
                  <span className="admin-page__tag-chip">Operator: {previewFocusTelemetryPresetPackage.operatorLabel}</span>
                  <span className="admin-page__tag-chip">Özet Kodu: {previewFocusTelemetryPresetPackage.presetHash}</span>
                  <span className="admin-page__tag-chip">Kayit: {previewFocusTelemetryPresetPackage.acceptedCount}/{previewFocusTelemetryPresetPackage.presetCount}</span>
                  <span className="admin-page__tag-chip">Cakisma: {previewFocusTelemetryPresetPackage.conflictCount}</span>
                </div>
                <div className={`admin-page__status-text ${previewFocusTelemetryPresetPackage.isValid ? "admin-page__status-text--success" : "admin-page__status-text--warning"}`}>{previewFocusTelemetryPresetPackage.summary}</div>
                {previewFocusTelemetryPresetPackage.newPresetNames.length ? (
                  <div className="admin-page__subsection-grid">
                    <div className="admin-page__subsection-title admin-page__subsection-title--xs admin-page__subsection-title--green">Yeni eklenecek presetler</div>
                    <div className="admin-page__chip-row">
                      {previewFocusTelemetryPresetPackage.newPresetNames.map((name) => (
                        <span key={name} className="admin-page__tag-chip admin-page__tag-chip--success">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.overrideNames.length ? (
                  <div className="admin-page__subsection-grid">
                    <div className="admin-page__subsection-title admin-page__subsection-title--xs admin-page__subsection-title--orange">Gecersiz kilinacak on ayarlar</div>
                    <div className="admin-page__chip-row">
                      {previewFocusTelemetryPresetPackage.overrideNames.map((name) => (
                        <span key={name} className="admin-page__tag-chip admin-page__tag-chip--warning">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.filterDiffLines.length ? (
                  <div className="admin-page__subsection-grid">
                    <div className="admin-page__subsection-title admin-page__subsection-title--xs">Filtre farklari</div>
                    {previewFocusTelemetryPresetPackage.groupedDiffs.map((group) => (
                      <div
                        key={`${group.kind}-${group.presetName}`}
                        className={`admin-page__diff-card ${
                          previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName
                            ? "admin-page__diff-card--selected"
                            : group.kind === "new"
                              ? "admin-page__diff-card--new"
                              : "admin-page__diff-card--override"
                        }`}
                      >
                        <div
                          className={`admin-page__diff-title ${
                            previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName
                              ? "admin-page__diff-title--selected"
                              : group.kind === "new"
                                ? "admin-page__diff-title--new"
                                : "admin-page__diff-title--override"
                          }`}
                        >
                          {group.presetName} • {group.kind === "new" ? "Yeni kayit" : "Override"}
                          {previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName ? " • Secili referans" : ""}
                        </div>
                        {group.lines.map((line) => (
                          <div key={`${group.presetName}-${line}`} className="admin-page__text-xs-muted">{line}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.warnings.length ? (
                  <div className="admin-page__subsection-grid">
                    {previewFocusTelemetryPresetPackage.warnings.map((warning) => (
                      <div key={warning} className="admin-page__text-xs-warning">{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="admin-page__history-card">
                <div className="admin-page__space-between-row">
                  <div className="admin-page__subsection-title">Telemetri Eylem Tarihcesi</div>
                  <div className="admin-page__chip-row">
                    {[
                      { key: "all", label: "Tum" },
                      { key: "export", label: "Export" },
                      { key: "preset", label: "Preset" },
                      { key: "navigation", label: "Navigation" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFocusTelemetryActionHistoryFilter(item.key as "all" | "export" | "preset" | "navigation")}
                        className={`admin-page__pill-button admin-page__pill-button--sm ${focusTelemetryActionHistoryFilter === item.key ? "admin-page__pill-button--active-blue" : ""}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="admin-page__form-row admin-page__form-row--sm">
                  <label className="admin-page__field admin-page__field--narrow">
                    Zaman Penceresi
                    <select aria-label="Aksiyon Tarihcesi Zaman Penceresi" value={focusTelemetryActionHistoryWindow} onChange={(event) => setFocusTelemetryActionHistoryWindow(event.target.value as FocusTelemetryActionHistoryWindow)} className="admin-page__control">
                      <option value="all">Tum Zaman</option>
                      <option value="30m">Son 30 Dakika</option>
                      <option value="24h">Son 24 Saat</option>
                    </select>
                  </label>
                  <label className="admin-page__field admin-page__field--wide">
                    Aksiyon Arama
                    <input aria-label="Aksiyon Tarihcesi Arama" value={focusTelemetryActionHistorySearch} onChange={(event) => setFocusTelemetryActionHistorySearch(event.target.value)} placeholder="preset, export, navigation ara" className="admin-page__control" />
                  </label>
                </div>
                {filteredFocusTelemetryActionHistory.length === 0 ? (
                  <div className="admin-page__text-sm-muted">Bu filtre icin kayitli operator aksiyonu yok.</div>
                ) : filteredFocusTelemetryActionHistory.map((item) => (
                  <div key={item.id} className="admin-page__history-item">
                    <div className="admin-page__space-between-row">
                      <span className={`admin-page__history-scope ${item.tone === "error" ? "admin-page__history-scope--error" : ""}`}>{item.scope}</span>
                      <span className="admin-page__text-xs-muted">{formatAdminFocusTimestamp(item.createdAt)}</span>
                    </div>
                    <div className="admin-page__text-sm-body">{item.message}</div>
                  </div>
                ))}
              </div>
              <div className="admin-page__grid admin-page__grid--sm">
                {filteredFocusTelemetryEvents.length === 0 ? (
                  <div className="admin-page__empty-state">
                    Aktif focus olayi yok.
                  </div>
                ) : filteredFocusTelemetryEvents.map((event) => (
                  <div ref={(node) => { focusTelemetryEventCardRefs.current[event.id] = node; }} data-testid={`telemetry-event-card-${event.id}`} key={event.id} onMouseEnter={() => {
                    if (focusTelemetryReturnedEventId === event.id) {
                      setIsFocusTelemetryReturnPaused(true);
                    }
                  }} onMouseLeave={() => {
                    if (focusTelemetryReturnedEventId === event.id) {
                      setIsFocusTelemetryReturnPaused(false);
                    }
                  }} onFocusCapture={() => {
                    if (focusTelemetryReturnedEventId === event.id) {
                      setIsFocusTelemetryReturnPaused(true);
                    }
                  }} onBlurCapture={(eventTarget) => {
                    if (focusTelemetryReturnedEventId !== event.id) {
                      return;
                    }
                    const nextFocused = eventTarget.relatedTarget as Node | null;
                    if (!eventTarget.currentTarget.contains(nextFocused)) {
                      setIsFocusTelemetryReturnPaused(false);
                    }
                  }} className={`admin-page__event-card ${
                    focusTelemetrySelectedEventId === event.id
                      ? "admin-page__event-card--selected"
                      : replayChainTargetQuoteId != null && event.targetQuoteId === replayChainTargetQuoteId
                        ? "admin-page__event-card--replay"
                        : focusTelemetryReturnedEventId === event.id
                          ? "admin-page__event-card--returned"
                          : selectedFocusTelemetryTarget?.quoteId != null && event.targetQuoteId === selectedFocusTelemetryTarget.quoteId
                            ? "admin-page__event-card--quote-target"
                            : ""
                  }`}>
                    {focusTelemetryReturnedEventId === event.id ? (
                      <div className="admin-page__return-panel">
                        <div className="admin-page__return-badge">
                          {isFocusTelemetryReturnPaused ? "Geri donus hedefi - fade-out duraklatildi" : "Geri donus hedefi - fade-out aktif"}
                        </div>
                        <div className="admin-page__return-timer">
                          Kalan sure: {(focusTelemetryReturnedEventRemainingMs / 1000).toFixed(1)} sn
                        </div>
                        <progress data-testid={`telemetry-return-progress-${event.id}`} className="admin-page__return-progress" value={focusTelemetryReturnedEventProgress} max={100} />
                      </div>
                    ) : null}
                    <div className="admin-page__space-between-row">
                      <div className="admin-page__event-title">{event.label}</div>
                      <div className="admin-page__text-xs-muted">{formatAdminFocusTimestamp(event.createdAt)}</div>
                    </div>
                    <div className="admin-page__event-detail">{event.detail}</div>
                    <div className="admin-page__wrap-row">
                      <span className="admin-page__event-source">Kaynak: {event.source}</span>
                      {event.targetSection ? (
                        <span className={`admin-page__section-chip ${event.targetSection === "status-history" ? "admin-page__section-chip--blue" : "admin-page__section-chip--violet"}`}>
                          Hedef: {getQuoteInsightSectionLabel(event.targetSection)}
                        </span>
                      ) : null}
                    </div>
                    {event.targetQuoteId != null ? (
                      <div className="admin-page__end-row">
                        <button type="button" onClick={() => setFocusTelemetrySelectedEventId(event.id)} className="admin-page__pill-button admin-page__pill-button--sm admin-page__pill-button--blue">
                          Event'i Sec
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, event.targetSection || "full-audit-trail")} className="admin-page__pill-button admin-page__pill-button--sm admin-page__pill-button--amber">
                          RFQ #{event.targetQuoteId} Kartina Git
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, "status-history")} className="admin-page__pill-button admin-page__pill-button--sm admin-page__pill-button--blue">
                          Durum gecmisi ac
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, "full-audit-trail")} className="admin-page__pill-button admin-page__pill-button--sm admin-page__pill-button--violet">
                          Denetim izi ac
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {selectedFocusTelemetryTarget ? (
                <div ref={focusTelemetryEventActionsRef} className="admin-page__quick-actions">
                  <div className="admin-page__quick-actions-title">Telemetri Hizli Eylemleri</div>
                  <div className="admin-page__quick-actions-label">{selectedFocusTelemetryTarget.label}</div>
                  <div className="admin-page__event-detail">{selectedFocusTelemetryTarget.detail}</div>
                  <div className="admin-page__wrap-row">
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, "status-history")} className="admin-page__pill-button admin-page__pill-button--blue">
                      Hizli Eylem - Durum gecmisi
                    </button>
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, "full-audit-trail")} className="admin-page__pill-button admin-page__pill-button--violet">
                      Hizli Eylem - Denetim izi
                    </button>
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, selectedFocusTelemetryTarget.section)} className="admin-page__pill-button admin-page__pill-button--amber">
                      Hizli Eylem - Discovery Lab satirina git
                    </button>
                  </div>
                </div>
              ) : null}
              {focusTelemetryActionStatus ? (
                <div aria-live="polite" className={`admin-page__notice-inline ${focusTelemetryActionStatus.tone === "error" ? "admin-page__notice-inline--error" : "admin-page__notice-inline--success"}`}>
                  {focusTelemetryActionStatus.message}
                </div>
              ) : null}
              <div className="admin-page__wrap-row">
                <button type="button" onClick={exportFocusTelemetry} className="admin-page__pill-button">
                  Telemetry Export Hazirla
                </button>
                <button type="button" onClick={exportFocusTelemetryCsv} className="admin-page__pill-button">
                  CSV Özet Hazırla
                </button>
                <button type="button" onClick={() => {
                  void copyFocusTelemetryText(focusTelemetryExport)
                    .then(() => announceFocusTelemetryAction("JSON export panoya kopyalandi", "success", "export"))
                    .catch(() => announceFocusTelemetryAction("JSON export panoya kopyalanamadi", "error", "export"));
                }} className="admin-page__pill-button">
                  JSON Kopyala
                </button>
                <button type="button" onClick={() => {
                  try {
                    downloadFocusTelemetryText(focusTelemetryExport, focusTelemetryExportMeta.jsonFilename, "application/json");
                    announceFocusTelemetryAction(`JSON export indirildi: ${focusTelemetryExportMeta.jsonFilename}`, "success", "export");
                  } catch {
                    announceFocusTelemetryAction("JSON export indirilemedi", "error", "export");
                  }
                }} className="admin-page__pill-button">
                  JSON Indir ({focusTelemetryExportMeta.jsonFilename})
                </button>
                <button type="button" onClick={() => {
                  void copyFocusTelemetryText(focusTelemetryCsvExport)
                    .then(() => announceFocusTelemetryAction("CSV export panoya kopyalandi", "success", "export"))
                    .catch(() => announceFocusTelemetryAction("CSV export panoya kopyalanamadi", "error", "export"));
                }} className="admin-page__pill-button">
                  CSV Kopyala
                </button>
                <button type="button" onClick={() => {
                  try {
                    downloadFocusTelemetryText(focusTelemetryCsvExport, focusTelemetryExportMeta.csvFilename, "text/csv");
                    announceFocusTelemetryAction(`CSV export indirildi: ${focusTelemetryExportMeta.csvFilename}`, "success", "export");
                  } catch {
                    announceFocusTelemetryAction("CSV export indirilemedi", "error", "export");
                  }
                }} className="admin-page__pill-button">
                  CSV Indir ({focusTelemetryExportMeta.csvFilename})
                </button>
              </div>
              {focusTelemetryExport ? (
                <textarea readOnly aria-label="Focus Telemetry Export" value={focusTelemetryExport} className="admin-page__export-textarea" />
              ) : null}
              {focusTelemetryCsvExport ? (
                <textarea readOnly aria-label="Focus Telemetry CSV Export" value={focusTelemetryCsvExport} className="admin-page__export-textarea admin-page__export-textarea--compact" />
              ) : null}
            </div>
          </div>

        </section>
      )}

      {/* ── Platform Genel Bakış: Finansal Detay + Sistem Sağlığı + Grafikler ── */}
      {activeTab === "platform_overview" && canViewPlatformGovernance && (
        <div className="ph-page">
          {/* LTV / CAC / LTV:CAC */}
          <div className="ph-section">
            <div className="ph-section__head">
              <div>
                <div className="ph-section__title">Finansal Detay</div>
                <div className="ph-section__sub">Birim ekonomi ve müşteri yaşam döngüsü</div>
              </div>
            </div>
            <div className="ph-ltv-grid">
              <div className="ph-kpi-card ph-kpi-card--blue">
                <div className="ph-kpi-card__label">LTV (ort)</div>
                <div className="ph-kpi-card__value">₺89.400</div>
                <div className="ph-kpi-card__delta">+%4.2</div>
              </div>
              <div className="ph-kpi-card ph-kpi-card--green">
                <div className="ph-kpi-card__label">CAC</div>
                <div className="ph-kpi-card__value">₺11.200</div>
                <div className="ph-kpi-card__delta">▼%3.1 (iyileşme)</div>
              </div>
              <div className="ph-kpi-card ph-kpi-card--green">
                <div className="ph-kpi-card__label">LTV:CAC</div>
                <div className="ph-kpi-card__value">7.98×</div>
                <div className="ph-kpi-card__sub">Hedef ≥ 3×</div>
              </div>
            </div>
          </div>

          {/* Sistem Sağlığı */}
          <div className="ph-section">
            <div className="ph-section__head">
              <div>
                <div className="ph-section__title">Sistem Sağlığı</div>
                <div className="ph-section__sub">Anlık platform telemetrisi · 30 sn güncellenir</div>
              </div>
              <button type="button" className="ph-lnk">Status sayfası →</button>
            </div>
            <div className="ph-syshealth-grid">
              {PH_SYSTEM_HEALTH.metrics.map((m) => (
                <div key={m.code} className={`ph-syshealth-card ph-syshealth-card--${m.status}`}>
                  <div className="ph-syshealth-card__label">{m.label}</div>
                  <div className="ph-syshealth-card__value">
                    <span className={`ph-syshealth-dot ph-syshealth-dot--${m.status}`} />
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="ph-syshealth-domains-head">ÇOKLU DOMAIN</div>
            <div className="ph-syshealth-domains">
              {PH_SYSTEM_HEALTH.domains.map((d) => (
                <div key={d.host} className="ph-syshealth-domain">
                  <div className="ph-syshealth-domain__host">{d.host}</div>
                  <div className="ph-syshealth-domain__role">
                    <span className="ph-syshealth-domain__dot" />{d.role}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MRR Detayı + Plan Dağılımı — 1:1 */}
          <div className="ph-split-1-1">
            <div className="ph-section">
              <div className="ph-section__head">
                <div>
                  <div className="ph-section__title">MRR Detayı · 12 ay</div>
                </div>
                <div className="ph-legend">
                  <span className="ph-legend-dot ph-legend-dot--mrr" />MRR
                </div>
              </div>
              <div className="ph-mrr-chart">
                <svg viewBox="0 0 480 120" className="ph-mrr-svg" preserveAspectRatio="none">
                  {PH_MRR_SERIES.map((d, i) => {
                    const maxMrr = 1284500;
                    const barH = Math.round((d.mrr / maxMrr) * 100);
                    const x = 2 + i * 40;
                    return (
                      <rect key={d.m} x={x} y={110 - barH} width={34} height={barH} rx={3}
                        fill="#2563eb" opacity={i === PH_MRR_SERIES.length - 1 ? 1 : 0.5} />
                    );
                  })}
                </svg>
                <div className="ph-mrr-labels">
                  {PH_MRR_SERIES.map((d) => <span key={d.m}>{d.m.slice(5)}</span>)}
                </div>
              </div>
            </div>

            <div className="ph-section">
              <div className="ph-section__head">
                <div>
                  <div className="ph-section__title">Plan Dağılımı</div>
                </div>
              </div>
              <div className="ph-plan-dist">
                {PH_PLAN_DISTRIBUTION.map((p) => {
                  const maxPct = Math.max(...PH_PLAN_DISTRIBUTION.map((x) => x.percent));
                  return (
                    <div key={p.code} className="ph-plan-row" style={{ "--plan-color": p.color, "--plan-w": `${(p.percent / maxPct) * 100}%` } as React.CSSProperties}>
                      <div className="ph-plan-row__label">
                        <span className="ph-plan-row__dot" />
                        {p.label}
                      </div>
                      <div className="ph-plan-row__bar-wrap">
                        <div className="ph-plan-row__bar" />
                      </div>
                      <div className="ph-plan-row__meta">
                        <b>{p.count}</b> <span>(%{p.percent})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Aylık Net Büyüme Bileşenleri */}
          <div className="ph-section">
            <div className="ph-section__head">
              <div>
                <div className="ph-section__title">Aylık Net Büyüme Bileşenleri</div>
                <div className="ph-section__sub">Yeni vs. churn — son 6 ay</div>
              </div>
            </div>
            <div className="ph-bars-grid">
              {(() => {
                const maxVal = Math.max(...PH_NET_GROWTH_SERIES.map((d) => Math.max(d.newMrr, d.churn)));
                return PH_NET_GROWTH_SERIES.map((d) => (
                  <div key={d.m} className="ph-bars-col" style={{ "--new-h": `${(d.newMrr / maxVal) * 100}%`, "--churn-h": `${(d.churn / maxVal) * 100}%` } as React.CSSProperties}>
                    <div className="ph-bars-stack">
                      <div className="ph-bar ph-bar--new">
                        <span>+{(d.newMrr / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="ph-bar ph-bar--churn">
                        <span>−{(d.churn / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="ph-bars-label">{d.m.slice(5)}</div>
                  </div>
                ));
              })()}
            </div>
            <div className="ph-bars-legend">
              <span><span className="ph-legend-dot ph-legend-dot--new" />Yeni MRR</span>
              <span><span className="ph-legend-dot ph-legend-dot--churn" />Churn MRR</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "panel_home" && canViewPlatformGovernance && (() => {
        const _scope = String(user?.scope_type || "").toLowerCase();
        const _bRole = String(user?.business_role || user?.role || "").toLowerCase();
        const isChannel = _scope === "channel" || _bRole === "channel_owner" || _bRole === "channel_agent";
        const canReviewCatalog = canViewPlatformGovernance || _scope === "platform";
        const canRequestCatalog = isTenantAdminUser(user) || isChannel || _scope === "partner";
        const requestSummaryBottom = {
          pending: catalogRequests.filter((r) => r.review_status === "pending_review").length,
          approved: catalogRequests.filter((r) => r.review_status === "approved").length,
          rejected: catalogRequests.filter((r) => r.review_status === "rejected").length,
        };
        const bgPrimaryTone = _scope === "platform" ? "navy" : isChannel ? "amber" : "green";
        return (
          <>
            <section className="admin-page__split-grid">
              <div className="admin-page__card admin-page__card--large admin-page__card--stacked">
                <div>
                  <div className="admin-page__section-title">Rol / Departman Onay Masasi</div>
                  <div className="admin-page__section-heading">Scope ayrışmalı katalog yönetimi</div>
                  <div className="admin-page__section-copy">
                    Tenant ekipleri yeni rol ve departman ihtiyacını talep olarak açar. Platform tarafı talepleri merkezi kuyrukta inceler, onaylanan kayıt gerçek katalog varlığına dönüşür.
                  </div>
                </div>
                {canRequestCatalog ? (
                  <div className="admin-page__catalog-form-grid">
                    <form onSubmit={(e) => { e.preventDefault(); if (!panelHomeRoleName.trim()) return; void handleCreateRoleCatalogRequest({ name: panelHomeRoleName.trim(), description: panelHomeRoleDescription.trim() || undefined }).then(() => { setPanelHomeRoleName(""); setPanelHomeRoleDescription(""); }); }} className="admin-page__catalog-form">
                      <div className="admin-page__form-title">Yeni rol talebi</div>
                      <input value={panelHomeRoleName} onChange={(e) => setPanelHomeRoleName(e.target.value)} placeholder="Ornek: Partner Teknik Lider" className="admin-page__form-control" />
                      <textarea value={panelHomeRoleDescription} onChange={(e) => setPanelHomeRoleDescription(e.target.value)} placeholder="Bu rol hangi ihtiyacı çözüyor?" rows={3} className="admin-page__form-control admin-page__form-textarea" />
                      <button type="submit" className={`admin-page__submit-button admin-page__submit-button--primary admin-page__tone--${bgPrimaryTone}`}>Rol talebini gönder</button>
                    </form>
                    <form onSubmit={(e) => { e.preventDefault(); if (!panelHomeDeptName.trim()) return; void handleCreateDepartmentCatalogRequest({ name: panelHomeDeptName.trim(), description: panelHomeDeptDescription.trim() || undefined }).then(() => { setPanelHomeDeptName(""); setPanelHomeDeptDescription(""); }); }} className="admin-page__catalog-form">
                      <div className="admin-page__form-title">Yeni departman talebi</div>
                      <input value={panelHomeDeptName} onChange={(e) => setPanelHomeDeptName(e.target.value)} placeholder="Ornek: Kanal Performans ve Hakediş" className="admin-page__form-control" />
                      <textarea value={panelHomeDeptDescription} onChange={(e) => setPanelHomeDeptDescription(e.target.value)} placeholder="Bu departman hangi iş hattını ayırıyor?" rows={3} className="admin-page__form-control admin-page__form-textarea" />
                      <button type="submit" className="admin-page__submit-button">Departman talebini gönder</button>
                    </form>
                  </div>
                ) : (
                  <div className="admin-page__info-box">
                    Bu profil için katalog talebi açma alanı kapalı. Yine de scope bazlı istek kuyruğunu izleyebilir ve sonuçlarını takip edebilirsiniz.
                  </div>
                )}
                <div className="admin-page__list-stack">
                  {catalogRequests.length === 0 ? (
                    <div className="admin-page__empty-state">Gosterilecek katalog talebi yok.</div>
                  ) : catalogRequests.map((item) => (
                    <div key={item.id} className="admin-page__catalog-item">
                      <div className="admin-page__space-between-row">
                        <div>
                          <div className="admin-page__form-title">{item.proposed_name}</div>
                          <div className="admin-page__request-meta">{item.entity_type === "role" ? "Rol talebi" : "Departman talebi"} • {item.requested_by_name || item.requested_by_email || `Kullanıcı #${item.requested_by_user_id}`}</div>
                        </div>
                        <span className={`admin-page__status-badge admin-page__status-badge--${item.review_status === "approved" ? "approved" : item.review_status === "rejected" ? "rejected" : "pending"}`}>
                          {item.review_status === "approved" ? "Onaylandi" : item.review_status === "rejected" ? "Reddedildi" : "Inceleniyor"}
                        </span>
                      </div>
                      {item.proposed_description ? <div className="admin-page__link-description">{item.proposed_description}</div> : null}
                      <div className="admin-page__wrap-row admin-page__text-sm-muted">
                        <span>Olusturma: {new Date(item.created_at).toLocaleString("tr-TR")}</span>
                        {item.reviewed_at ? <span>Karar: {new Date(item.reviewed_at).toLocaleString("tr-TR")}</span> : null}
                      </div>
                      {canReviewCatalog && item.review_status === "pending_review" ? (
                        <div className="admin-page__button-row admin-page__button-row--nowrap">
                          <button type="button" disabled={catalogRequestBusyId === item.id} onClick={() => void handleReviewCatalogRequest(item.id, "approved")} className="admin-page__decision-button admin-page__decision-button--approve">Onayla</button>
                          <button type="button" disabled={catalogRequestBusyId === item.id} onClick={() => void handleReviewCatalogRequest(item.id, "rejected")} className="admin-page__decision-button admin-page__decision-button--reject">Reddet</button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-page__card admin-page__card--large admin-page__card--stacked">
                <div className="admin-page__section-title">Bu scope icin operasyon ilkeleri</div>
                {[
                  "Stratejik Partner girisi kendi renk ve tonuyla ayriliyor; bu sayede yanlis kabuga dusme riski azalir.",
                  "Super admin tum scope'lari gorebilir fakat review ve izleme katmani scope sinyalini korur.",
                  "Aktif / pasif yasam dongusu yeni katalog taleplerinde de korunur; onaylanmayan kayit canli listeye dusmez.",
                  "Scope ana sayfasi agir tek ekran yerine hizli kartlar ve acilir islem bloklariyla tasinacak sekilde kurgulandi.",
                ].map((item) => (
                  <div key={item} className="admin-page__principle-card">{item}</div>
                ))}
                <div className="admin-page__mini-stat-grid">
                  {[
                    { label: "Bekleyen", value: requestSummaryBottom.pending, tone: "amber" },
                    { label: "Onaylanan", value: requestSummaryBottom.approved, tone: "green" },
                    { label: "Reddedilen", value: requestSummaryBottom.rejected, tone: "red-dark" },
                  ].map((s) => (
                    <div key={s.label} className={`admin-page__mini-stat admin-page__tone--${s.tone}`}>
                      <div className="admin-page__mini-stat-label">{s.label}</div>
                      <div className="admin-page__mini-stat-value">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="admin-page__card admin-page__card--large admin-page__card--stacked">
              <div className="admin-page__section-title">Hizli Linkler</div>
              <div className="admin-page__metric-grid">
                {workspacePanelQuickLinks.map((item) => (
                  <a key={item.href} href={item.href} className="admin-page__quick-link-card">
                    <div className="admin-page__quick-link-title">{item.label}</div>
                    <div className="admin-page__link-description">{item.description}</div>
                    <div className={`admin-page__link-arrow admin-page__tone--${bgPrimaryTone}`}>Ac →</div>
                  </a>
                ))}
              </div>
            </section>
          </>
        );
      })()}

      {activeTab === "discovery_lab_operations" && canViewPlatformGovernance && (
        <div className="atc-page--header">
          <PageHeader eyebrow="AI & Keşif" title="Discovery Lab Operasyonları" sub="Answer audit ve RFQ bağlantı merkezi — Discovery Lab operasyon masası" />
          <div className="kpi-grid">
            <StatCard label="Toplam Oturum" value={discoveryLabSummary.total_sessions} accent="blue" />
            <StatCard label="Quote Hazır" value={discoveryLabSummary.quote_ready_sessions} accent="green" />
            <StatCard label="Kilitli Oturum" value={discoveryLabSummary.locked_sessions} accent="warn" />
            <StatCard label="Aktif Proje" value={discoveryLabSummary.active_project_count} accent="violet" />
            <StatCard label="Toplam Audit" value={discoveryLabSummary.answer_audit_count} />
          </div>
        </div>
      )}

      {activeTab === "discovery_lab_operations" && canViewPlatformGovernance && (
        <section className="admin-page__grid">
          <div className="admin-page__panel-card admin-page__panel-card--stacked">
            <div className="admin-page__discovery-title">Discovery Lab Operasyon Masası</div>
            <div className="admin-page__large-heading">Answer audit ve RFQ bağlantı merkezi</div>
            <div className="admin-page__plain-muted">Stratejik Partner, proje, kullanıcı ve karar kırılımı ile Discovery Lab cevaplarını ve oluşan RFQ bağlantılarını izleyin.</div>
            {showRestoredQuoteToast && restoredQuoteInsight ? (
              <div
                ref={restoredQuoteToastRef}
                data-testid="restored-quote-toast"
                data-paused={isRestoredQuoteToastPaused ? "true" : "false"}
                tabIndex={0}
                role="status"
                aria-live="polite"
                onMouseEnter={() => setIsRestoredQuoteToastPaused(true)}
                onMouseLeave={() => setIsRestoredQuoteToastPaused(false)}
                onFocus={() => setIsRestoredQuoteToastPaused(true)}
                onBlur={() => setIsRestoredQuoteToastPaused(false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    clearRestoredQuoteInsight();
                  }
                }}
                className={`admin-page__restore-toast ${restoredQuoteInsight.section === "status-history" ? "" : "admin-page__restore-toast--paused"}`}
              >
                <div className="admin-page__restore-toast-content">
                  <div className="admin-page__restore-toast-title">Geri Dönüş Restore</div>
                  <div className="admin-page__restore-toast-detail">RFQ #{restoredQuoteInsight.quoteId} içinde {getQuoteInsightSectionLabel(restoredQuoteInsight.section)} odağı geri yüklendi.</div>
                  <progress data-testid="restored-quote-toast-progress" className="admin-page__wide-progress" value={restoredQuoteToastProgress} max={100} />
                </div>
                <div className="admin-page__wrap-row">
                  <button
                    type="button"
                    onClick={jumpToRestoredQuoteCard}
                    className="admin-page__ghost-button"
                  >
                    RFQ #{restoredQuoteInsight.quoteId} Odağına Git
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRestoredQuoteToast(false)}
                    className="admin-page__ghost-button admin-page__ghost-button--muted"
                  >
                    Bildirimi Kapat
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="admin-page__compact-metric-grid">
            {[
              { label: "Toplam Audit", value: discoveryLabSummary.answer_audit_count, note: "Kayıt altına alınan tüm cevaplar", tone: "blue" },
              { label: "RFQ Bağlı Audit", value: discoveryLabAnswerAudits.filter((item) => item.quote_id).length, note: "Quote/RFQ ile çaprazlanan cevaplar", tone: "navy" },
              { label: "Stratejik Partner Bağlı Audit", value: discoveryLabAnswerAudits.filter((item) => item.tenant_id).length, note: "Stratejik Partner bağlamına çözülmüş kayıtlar", tone: "teal" },
              { label: "İnceleme Bekleyen", value: discoveryLabAnswerAudits.filter((item) => item.decision === "needs_review").length, note: "Operasyonel geri dönüş gerektiren cevaplar", tone: "amber" },
            ].map((card) => (
              <div key={card.label} className={`admin-page__overview-card admin-page__tone--${card.tone}`}>
                <div className="admin-page__overview-label">{card.label}</div>
                <div className="admin-page__overview-value">{card.value}</div>
                <div className="admin-page__overview-note">{card.note}</div>
              </div>
            ))}
          </div>

          {restoredQuoteDebugEvents.length && !isRestoredQuoteDebugTimelineHidden ? (
            <div className="admin-page__timeline-card">
              <div className="admin-page__space-between-row">
                <div className="admin-page__section-title">Geri Yukleme Zaman Cizelgesi</div>
                <div className="admin-page__wrap-row">
                  {[
                    { key: "all", label: "Tüm Event" },
                    { key: "restore", label: "Restore" },
                    { key: "action", label: "Aksiyon" },
                    { key: "lifecycle", label: "Yaşam Döngüsü" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      data-testid={`restore-debug-filter-${filter.key}`}
                      onClick={() => setRestoredQuoteDebugFilter(filter.key as "all" | RestoreDebugEventType)}
                      className={`admin-page__pill-button admin-page__pill-button--sm ${restoredQuoteDebugFilter === filter.key ? "admin-page__pill-button--active-violet" : ""}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-page__space-between-row">
                <label className="admin-page__inline-field">
                  Timeline arama
                  <input
                    aria-label="Restore Timeline Arama"
                    value={restoredQuoteDebugSearchQuery}
                    onChange={(event) => setRestoredQuoteDebugSearchQuery(event.target.value)}
                    placeholder="RFQ, replay veya toast ara"
                    className="admin-page__control"
                  />
                </label>
                <div className="admin-page__wrap-row">
                  {[
                    { key: "all", label: "Tum Zincir" },
                    { key: "last-replay-chain", label: "Son Replay Zinciri" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      data-testid={`restore-debug-replay-filter-${filter.key}`}
                      onClick={() => setRestoredQuoteDebugReplayFilter(filter.key as "all" | "last-replay-chain")}
                      className={`admin-page__pill-button admin-page__pill-button--sm ${restoredQuoteDebugReplayFilter === filter.key ? "admin-page__pill-button--active-teal" : ""}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-page__grid admin-page__grid--sm">
                {filteredRestoredQuoteDebugEvents.map((event, index) => (
                  <div key={`${event.id}-${index}`} className={`admin-page__restore-event admin-page__restore-event--${event.type}`}>
                    <div className="admin-page__subsection-grid">
                      <div className="admin-page__wrap-row">
                        <span className={`admin-page__restore-badge admin-page__restore-badge--${event.type}`}>
                          {getRestoreDebugEventMeta(event.type).label}
                        </span>
                        <span className={`admin-page__restore-badge admin-page__restore-severity--${event.type}`}>
                          {getRestoreDebugEventMeta(event.type).severityLabel}
                        </span>
                        <span className="admin-page__event-title">{event.label}</span>
                      </div>
                      <span className="admin-page__text-xs-muted">{formatAdminFocusTimestamp(event.createdAt)}</span>
                    </div>
                    <div className="admin-page__wrap-row">
                      <span className="admin-page__event-detail">{event.detail}</span>
                      <button
                        type="button"
                        data-testid={`restore-debug-remove-${index}`}
                        onClick={() => removeRestoredQuoteDebugEvent(event.id)}
                        className="admin-page__danger-mini-button"
                      >
                        Satiri Sil
                      </button>
                    </div>
                  </div>
                ))}
                {filteredRestoredQuoteDebugEvents.length === 0 ? (
                  <div className="admin-page__empty-state">
                    Seçili filtre için debug olayı bulunmuyor.
                  </div>
                ) : null}
              </div>
              <div className="admin-page__space-between-row">
                <div className="admin-page__wrap-row">
                  <div className="admin-page__text-sm-muted">Son restore akışını seçilen bölüme göre yeniden tetikleyin.</div>
                  <label className="admin-page__inline-field">
                    Replay hedefi
                    <select
                      aria-label="Restore Replay Hedefi"
                      value={restoredQuoteReplayTarget}
                      onChange={(event) => setRestoredQuoteReplayTarget(event.target.value as "status-history" | "full-audit-trail")}
                      className="admin-page__control"
                    >
                      <option value="status-history">Durum geçmişi</option>
                      <option value="full-audit-trail">Denetim izi</option>
                    </select>
                  </label>
                </div>
                <div className="admin-page__wrap-row">
                  <button
                    type="button"
                    onClick={clearRestoredQuoteDebugEvents}
                    className="admin-page__pill-button"
                  >
                    Timeline Temizle
                  </button>
                  <button
                    type="button"
                    onClick={replayRestoredQuoteInsight}
                    className="admin-page__pill-button admin-page__pill-button--active-violet"
                  >
                    Geri Yukleme Tekrari • {getQuoteInsightSectionLabel(restoredQuoteReplayTarget)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="admin-page__panel-card admin-page__panel-card--stacked">
            <div className="admin-page__grid admin-page__grid--sm">
              <div className="admin-page__wrap-row">
                <input
                  aria-label="Discovery Lab Proje Filtresi"
                  value={discoveryLabProjectQuery}
                  onChange={(event) => setDiscoveryLabProjectQuery(event.target.value)}
                  placeholder="Proje ara"
                  className="admin-page__control"
                />
                <input
                  aria-label="Discovery Lab Kullanıcı Filtresi"
                  value={discoveryLabUserQuery}
                  onChange={(event) => setDiscoveryLabUserQuery(event.target.value)}
                  placeholder="Kullanıcı ara"
                  className="admin-page__control"
                />
                <input
                  aria-label="Discovery Lab Kayıt Arama"
                  value={discoveryLabSearch}
                  onChange={(event) => setDiscoveryLabSearch(event.target.value)}
                  placeholder="Kayıt ara"
                  className="admin-page__control"
                />
              </div>
              <div className="admin-page__wrap-row">
                {(["all", "needs_review", "approved", "ignored"] as const).map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    onClick={() => setDiscoveryLabAuditDecisionFilter(decision)}
                    className={`admin-page__pill-button admin-page__pill-button--sm ${discoveryLabAuditDecisionFilter === decision ? "admin-page__pill-button--active-teal" : ""}`}
                  >
                    {decision === "all" ? "Tüm Kararlar" : decision === "needs_review" ? "İnceleme" : decision === "approved" ? "Onaylandı" : "Göz Ardı"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const from = new Date(now);
                    from.setDate(from.getDate() - 7);
                    setDiscoveryLabDateFrom(from.toISOString());
                    setDiscoveryLabDateTo(now.toISOString());
                  }}
                  className="admin-page__pill-button admin-page__pill-button--sm"
                >
                  Son 7 Gün
                </button>
              </div>
            </div>
            <div className="admin-page__space-between-row">
              <div>
                <div className="admin-page__discovery-title">Filtrelenmiş Audit Kayıtları</div>
                <div className="admin-page__panel-title">Stratejik Partner ve RFQ bağlı detay listesi</div>
                {restoredQuoteInsight ? renderAdminFocusBanner({
                  eyebrow: "Admin Focus",
                  title: `Admin geri dönüş odağı: RFQ ${getQuoteInsightSectionLabel(restoredQuoteInsight.section)}`,
                  detail: `Geri dönüş odağı geçici olarak listenin üstüne taşındı: RFQ #${restoredQuoteInsight.quoteId} - replay hedefi ${getQuoteInsightSectionLabel(restoredQuoteReplayTarget)}`,
                  tone: restoredQuoteInsight.section === "status-history" ? "blue" : "violet",
                  sourceLabel: "Quote return",
                  timestamp: filteredRestoredQuoteDebugEvents[0]?.createdAt || Date.now(),
                  actions: [
                    { label: `RFQ #${restoredQuoteInsight.quoteId} odağına git`, onClick: jumpToRestoredQuoteCard },
                    { label: "Odağı Temizle", onClick: clearRestoredQuoteInsight },
                  ],
                  testId: "admin-focus-banner-rfq",
                }) : null}
              </div>
              <div className="admin-page__link-description">{sortedDiscoveryLabAnswerAudits.length} kayıt yüklendi</div>
            </div>

            <div className="admin-page__list-stack">
              {discoveryLabAnswerAudits.length === 0 ? (
                <div className="admin-page__empty-state">
                  Filtreye uyan Discovery Lab yanıt denetimi kaydı bulunmuyor.
                </div>
              ) : (
                sortedDiscoveryLabAnswerAudits.map((audit) => (
                  <div
                    key={`ops-audit-${audit.id}`}
                    data-testid={audit.quote_id ? `rfq-audit-card-${audit.quote_id}` : undefined}
                    ref={(node) => {
                      if (audit.quote_id != null) {
                        discoveryQuoteCardRefs.current[audit.quote_id] = node;
                      }
                    }}
                    className={`admin-page__audit-card ${
                      restoredQuoteInsight?.quoteId === audit.quote_id
                        ? `admin-page__audit-card--restored ${restoredQuoteInsight?.section === "status-history" ? "" : "admin-page__audit-card--restored-violet"}`
                        : selectedFocusTelemetryTarget?.quoteId === audit.quote_id
                          ? "admin-page__audit-card--selected"
                          : replayChainTargetQuoteId === audit.quote_id
                            ? "admin-page__audit-card--replay"
                            : ""
                    }`}
                  >
                    <div className="admin-page__space-between-row">
                      <div className="admin-page__subsection-grid">
                        <div className="admin-page__form-title">{audit.question_text || `Soru ${audit.question_id}`}</div>
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <div className="admin-page__wrap-row">
                            {restoredQuoteRiskBadges(audit.quote_id!).map((badge) => (
                              <span key={`${audit.quote_id}-${badge.key}`} className={`admin-page__pill-chip admin-page__pill-chip--${badge.tone}`}>
                                {badge.label}: {badge.detail.replace(/^.*?:\s*/, "")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="admin-page__wrap-row">
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <span className={`admin-page__pill-chip ${restoredQuoteInsight?.section === "status-history" ? "admin-page__pill-chip--blue" : "admin-page__pill-chip--violet"}`}>
                            Geri Dönüş Odağı
                          </span>
                        ) : null}
                        {replayChainTargetQuoteId === audit.quote_id ? (
                          <span className="admin-page__pill-chip admin-page__pill-chip--orange">
                            Replay Zinciri
                          </span>
                        ) : null}
                        {selectedFocusTelemetryTarget?.quoteId === audit.quote_id ? (
                          <span className="admin-page__pill-chip admin-page__pill-chip--blue">
                            Telemetry Seçimi
                          </span>
                        ) : null}
                        {replayChainTargetQuoteId === audit.quote_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              const matchingEvent = focusTelemetryEvents.find((event) => event.targetQuoteId === audit.quote_id && event.targetSection === restoredQuoteReplayTarget) || focusTelemetryEvents.find((event) => event.targetQuoteId === audit.quote_id);
                              if (matchingEvent) {
                                focusTelemetryQuickAction(matchingEvent.id);
                                return;
                              }
                              focusTelemetryPanelRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
                            }}
                            className="admin-page__mini-pill-button admin-page__mini-pill-button--orange"
                          >
                            Telemetry'ye Git
                          </button>
                        ) : null}
                        {audit.quote_id ? (
                          <span className={`admin-page__quote-status-chip admin-page__quote-status-chip--${normalizeQuoteStatus(audit.quote_status)}`}>
                            RFQ Durumu: {QuoteStatusLabel[normalizeQuoteStatus(audit.quote_status)]}
                          </span>
                        ) : null}
                        <span className={`admin-page__pill-chip admin-page__pill-chip--${audit.decision === "approved" ? "green" : audit.decision === "ignored" ? "slate" : "amber"}`}>
                          {audit.decision || "answered"}
                        </span>
                      </div>
                    </div>
                    <div className="admin-page__audit-answer">{audit.answer_text}</div>
                    {audit.rationale ? <div className="admin-page__text-xs-muted">Gerekçe: {audit.rationale}</div> : null}
                    <div className="admin-page__wrap-row admin-page__text-xs-muted">
                      <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                      <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                      <span>Session: {audit.session_id || "-"}</span>
                      <span>Dosya: {audit.source_filename || "-"}</span>
                      <span>Aktör: {audit.created_by_email || "Bilinmiyor"}</span>
                    </div>
                    <div className="admin-page__wrap-row">
                      {audit.tenant_id ? (
                        <button
                          type="button"
                          onClick={() => openTenantGovernanceTab(audit.tenant_id, audit.tenant_name)}
                          className="admin-page__audit-button admin-page__audit-button--teal"
                        >
                          Stratejik Partner Yönetimine Git
                        </button>
                      ) : null}
                      {audit.project_id ? (
                        <button
                          type="button"
                          onClick={() => openProjectsTab(audit.project_name)}
                          className="admin-page__audit-button admin-page__audit-button--indigo"
                        >
                          Proje Akışını Aç
                        </button>
                      ) : null}
                    </div>
                    <div className="admin-page__space-between-row">
                      <div className="admin-page__text-xs-muted">Kayıt Zamanı: {String(audit.created_at || "")}</div>
                      {audit.quote_id ? (
                        <div className="admin-page__wrap-row">
                          <a href={`/quotes/${audit.quote_id}`} className="admin-page__audit-link admin-page__audit-link--blue">
                            RFQ #{audit.quote_id}
                          </a>
                          <a href={`/quotes/${audit.quote_id}/comparison?${buildAdminReturnQuery(audit)}`} className="admin-page__audit-link admin-page__audit-link--violet">
                            RFQ Karşılaştırma
                          </a>
                          <a href={`/quotes/${audit.quote_id}/edit?${buildAdminReturnQuery(audit)}`} className="admin-page__audit-link admin-page__audit-link--amber">
                            RFQ Akışına Git
                          </a>
                          <a href={`/quotes/${audit.quote_id}?insight=status-history&${buildAdminReturnQuery(audit, "status-history")}`} className="admin-page__audit-link admin-page__audit-link--soft-blue">
                            RFQ Durum Geçmişi
                          </a>
                          <a href={`/quotes/${audit.quote_id}?insight=full-audit-trail&${buildAdminReturnQuery(audit, "full-audit-trail")}`} className="admin-page__audit-link admin-page__audit-link--soft-violet">
                            RFQ Denetim İzi Sayfası
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleDiscoveryQuoteInsights(audit.quote_id!)}
                            className="admin-page__audit-button admin-page__audit-button--slate"
                          >
                            {expandedDiscoveryQuoteInsightId === audit.quote_id ? "RFQ Geçmişini Gizle" : "RFQ Geçmişini Aç"}
                          </button>
                        </div>
                      ) : (
                        <span className="admin-page__text-xs-soft">RFQ bağlantısı yok</span>
                      )}
                    </div>
                    {audit.quote_id && expandedDiscoveryQuoteInsightId === audit.quote_id ? (
                      <div className="admin-page__inline-card">
                        {discoveryQuoteInsightLoadingId === audit.quote_id ? (
                          <div className="admin-page__text-sm-muted">RFQ durum geçmişi ve denetim izi yükleniyor...</div>
                        ) : null}
                        {discoveryQuoteInsightErrorById[audit.quote_id] ? (
                          <div className="admin-page__text-sm-error">{discoveryQuoteInsightErrorById[audit.quote_id]}</div>
                        ) : null}
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <div className={`admin-page__insight-focus ${restoredQuoteInsight.section === "status-history" ? "admin-page__insight-focus--blue" : "admin-page__insight-focus--violet"}`}>
                            <span>Admin geri dönüş odağı: {restoredQuoteInsight.section === "status-history" ? "RFQ durum geçmişi" : "RFQ denetim izi"}</span>
                            <button
                              type="button"
                              onClick={clearRestoredQuoteInsight}
                              className={`admin-page__mini-pill-button ${restoredQuoteInsight.section === "status-history" ? "admin-page__mini-pill-button--blue" : "admin-page__mini-pill-button--violet"}`}
                            >
                              Odağı Temizle
                            </button>
                          </div>
                        ) : null}
                        {discoveryQuoteById[audit.quote_id] || discoveryQuotePendingApprovalsById[audit.quote_id]?.length ? (
                          <div className="admin-page__subsection-grid">
                            <div className="admin-page__subsection-title admin-page__subsection-title--muted">RFQ Karar Özeti</div>
                            <div className="admin-page__wrap-row">
                              <span className="admin-page__text-xs-body">Transition reason: {discoveryQuoteById[audit.quote_id]?.transition_reason || "-"}</span>
                              <span className="admin-page__text-xs-body">Pending approval: {discoveryQuotePendingApprovalsById[audit.quote_id]?.length || 0}</span>
                            </div>
                            {discoveryQuotePendingApprovalsById[audit.quote_id]?.length ? (
                              <div className="admin-page__compact-stack">
                                {discoveryQuotePendingApprovalsById[audit.quote_id].slice(0, 3).map((approval, index) => (
                                  <div key={`pending-approval-${audit.quote_id}-${index}`} className="admin-page__compact-row-card">
                                    <div className="admin-page__text-xs-strong">{resolveApprovalRoleLabel(approval) || "Onay"}</div>
                                    <div className="admin-page__text-xs-muted">{approval.status || "beklemede"}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {discoveryQuoteHistoryById[audit.quote_id]?.length ? (
                          <div
                            data-testid={`rfq-status-history-panel-${audit.quote_id}`}
                            ref={(node) => {
                              discoveryQuoteStatusHistoryRefs.current[audit.quote_id!] = node;
                            }}
                            className={`admin-page__quote-insight-section ${
                              telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history"
                                ? "admin-page__quote-insight-section--pulse-blue"
                                : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "status-history"
                                  ? "admin-page__quote-insight-section--restored-blue"
                                  : ""
                            }`}
                          >
                            <div className="admin-page__subsection-title admin-page__subsection-title--muted">RFQ Durum Gecmisi</div>
                            {telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? (
                              <div className="admin-page__wrap-row">
                                <div className="admin-page__pill-chip admin-page__pill-chip--blue">
                                  {telemetryPulseTarget.reason}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectedFocusTelemetryActionSourceId && focusTelemetryQuickAction(selectedFocusTelemetryActionSourceId)}
                                  disabled={!selectedFocusTelemetryActionSourceId}
                                  className="admin-page__mini-pill-button admin-page__mini-pill-button--blue"
                                >
                                  Telemetry eventine don
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTelemetryPulseTarget(null);
                                    setFocusTelemetrySelectedEventId(null);
                                  }}
                                  className="admin-page__mini-pill-button admin-page__mini-pill-button--soft-blue"
                                >
                                  Secimi temizle
                                </button>
                              </div>
                            ) : null}
                            {discoveryQuoteHistoryById[audit.quote_id].map((entry) => (
                              <div key={`quote-history-${audit.quote_id}-${entry.id}`} className="admin-page__timeline-card">
                                <div className="admin-page__space-between-row">
                                  <div className="admin-page__text-strong">{entry.from_status || "-"} {"->"} {entry.to_status || "-"}</div>
                                  <div className="admin-page__text-xs-muted">{entry.changed_by_name || entry.changed_by || "Sistem"} - {entry.changed_at || entry.created_at || "-"}</div>
                                </div>
                                {entry.approval_details?.length ? (
                                  <div className="admin-page__compact-stack">
                                    <div className="admin-page__text-xs-body-strong">Onay Adimlari</div>
                                    {entry.approval_details.map((approval) => (
                                      <div key={`approval-${entry.id}-${approval.level}`} className="admin-page__compact-row-card admin-page__compact-row-card--white">
                                        <div className="admin-page__text-xs-strong">Seviye {approval.level} - {resolveApprovalRoleLabel(approval) || "-"}</div>
                                        <div className="admin-page__text-xs-muted">{approval.status}{approval.comment ? ` - ${approval.comment}` : ""}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {discoveryQuoteAuditTrailById[audit.quote_id] ? (
                          <div
                            data-testid={`rfq-audit-trail-panel-${audit.quote_id}`}
                            ref={(node) => {
                              discoveryQuoteAuditTrailRefs.current[audit.quote_id!] = node;
                            }}
                            className={`admin-page__quote-insight-section ${
                              telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail"
                                ? "admin-page__quote-insight-section--pulse-violet"
                                : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "full-audit-trail"
                                  ? "admin-page__quote-insight-section--restored-violet"
                                  : ""
                            }`}
                          >
                            <div className="admin-page__subsection-title admin-page__subsection-title--muted">RFQ Denetim İzi</div>
                            {telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? (
                              <div className="admin-page__wrap-row">
                                <div className="admin-page__pill-chip admin-page__pill-chip--violet">
                                  {telemetryPulseTarget.reason}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectedFocusTelemetryActionSourceId && focusTelemetryQuickAction(selectedFocusTelemetryActionSourceId)}
                                  disabled={!selectedFocusTelemetryActionSourceId}
                                  className="admin-page__mini-pill-button admin-page__mini-pill-button--violet"
                                >
                                  Telemetry eventine don
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTelemetryPulseTarget(null);
                                    setFocusTelemetrySelectedEventId(null);
                                  }}
                                  className="admin-page__mini-pill-button admin-page__mini-pill-button--soft-violet"
                                >
                                  Secimi temizle
                                </button>
                              </div>
                            ) : null}
                            <div className="admin-page__text-sm-body">
                              Toplam olay: {discoveryQuoteAuditTrailById[audit.quote_id].total_events} - Güncel durum: {discoveryQuoteAuditTrailById[audit.quote_id].current_status}
                            </div>
                            {discoveryQuoteAuditTrailById[audit.quote_id].summary ? (
                              <div className="admin-page__wrap-row">
                                <span className="admin-page__text-xs-body">Durum değişikliği: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.status_changes ?? 0}</span>
                                <span className="admin-page__text-xs-body">Onay seviyesi: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.approval_levels ?? 0}</span>
                                <span className="admin-page__text-xs-body">Tedarikçi yanıtı: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.suppliers_responded ?? 0}</span>
                              </div>
                            ) : null}
                            {discoveryQuoteAuditTrailById[audit.quote_id].timeline.slice(0, 5).map((event, index) => (
                              <div key={`quote-audit-${audit.quote_id}-${index}`} className="admin-page__timeline-card admin-page__timeline-card--compact">
                                <div className="admin-page__text-strong">{event.title}</div>
                                <div className="admin-page__text-xs-muted">{event.type} - {String(event.actor || "Sistem")} - {String(event.timestamp || "-")}</div>
                                {event.details && Object.keys(event.details).length ? (
                                  <div className="admin-page__text-xs-muted">
                                    {Object.entries(event.details).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(" - ")}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "discovery_lab_operations" && canViewPlatformGovernance && (
        <>
          <div className="disc-band">AI Lab Oturum Yönetimi</div>
          <div className="kpi-grid">
            <StatCard label="Açık Oturum" value={DISC_KPI.openSessions} delta={12} trend="up" accent="blue" />
            <StatCard label="Aktif Zincir" value={DISC_KPI.activeChains} sub="Production zincirleri" />
            <StatCard label="Replay (30g)" value={DISC_KPI.replayCount} delta={28} trend="up" accent="green" />
            <StatCard label="Anomali" value={DISC_KPI.anomalies} sub="Son 24 saat" accent="warn" />
            <StatCard label="Ort. Oturum Süresi" value={DISC_KPI.avgDuration} delta={2.1} trend="down" accent="green" />
          </div>
          <Section title="Aktif AI Lab Oturumları" sub={`${DISC_FOCUSES.length} açık oturum · CAD analizi + soru-cevap döngüsü`} padded={false}>
            <DataTable
              rows={DISC_FOCUSES as unknown as Record<string, unknown>[]}
              columns={[
                { key: "id", label: "Oturum", render: (r) => { const item = r as unknown as DiscFocusItem; return (<div><code className="disc-code">{item.id}</code><div className="cell-tenant__sub disc-mt">{item.file}</div></div>); }},
                { key: "tenant", label: "Partner & Proje", render: (r) => { const item = r as unknown as DiscFocusItem; return (<div><b className="cell-tenant__name">{item.tenant}</b><div className="cell-tenant__sub">{item.project}</div></div>); }},
                { key: "stage", label: "Aşama", render: (r) => { const item = r as unknown as DiscFocusItem; return <span className={`disc-stage disc-stage--${item.stage.replace(/\s+/g, "-")}`}>{item.stage}</span>; }},
                { key: "layers", label: "Katman", align: "right", render: (r) => <b className="cell-num">{String((r as unknown as DiscFocusItem).layers)}</b> },
                { key: "qa", label: "Soru/Cevap", align: "right", render: (r) => <span className="cell-num">{String((r as unknown as DiscFocusItem).qa)}</span> },
                { key: "owner", label: "Sorumlu", render: (r) => { const item = r as unknown as DiscFocusItem; return item.owner === "—" ? <span className="cell-muted">Atanmadı</span> : <b>{item.owner}</b>; }},
                { key: "age", label: "Yaş", render: (r) => <span className="cell-muted">{String((r as unknown as DiscFocusItem).age)}</span> },
                { key: "priority", label: "Öncelik", render: (r) => { const item = r as unknown as DiscFocusItem; return <span className={`disc-prio disc-prio--${item.priority}`}>{item.priority === "critical" ? "KRİTİK" : item.priority === "high" ? "YÜKSEK" : "NORMAL"}</span>; }},
              ]}
            />
          </Section>
          <div className="split-1-1">
            <Section title="Replay Zincirleri" sub="CAD analizi + AI üretim zincirleri">
              <div className="disc-chains">
                {DISC_CHAINS.map((c) => (
                  <div key={c.name} className="disc-chain">
                    <div className="disc-chain__head">
                      <div><code className="disc-code">{c.name}</code><div className="disc-chain__desc">{c.desc}</div></div>
                      <span className={`disc-chain__success disc-chain__success--${c.success >= 90 ? "high" : c.success >= 80 ? "mid" : "low"}`}>{c.success}%</span>
                    </div>
                    <div className="disc-chain__bar"><div className={`disc-chain__fill disc-chain__fill--${c.success >= 90 ? "high" : c.success >= 80 ? "mid" : "low"}`} style={{ "--fill-w": c.success + "%" } as React.CSSProperties}></div></div>
                    <div className="disc-chain__meta"><span><b>{c.stages}</b> aşama</span><span><b>{c.duration}</b> ort. süre</span><span>Son: <b>{c.lastRun}</b></span></div>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Operasyon Telemetrisi" sub="Son operatör + sistem aksiyonları">
              <div className="disc-tel-wrap">
                <table className="disc-tel">
                  <thead><tr><th>Zaman</th><th>Aktör</th><th>Kaynak</th><th>Aksiyon</th><th>Detay</th></tr></thead>
                  <tbody>
                    {DISC_TELEMETRY.map((e, idx) => (
                      <tr key={idx}>
                        <td className="cell-muted disc-tel__mono">{e.time}</td>
                        <td><b>{e.actor}</b></td>
                        <td><span className="tier-pill">{e.source}</span></td>
                        <td><span className="pay-pill pay-pending">{e.action}</span></td>
                        <td className="cell-muted">{e.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </>
      )}

      {activeTab === "platform_operations" && canViewPlatformGovernance && (
        <PlatformOperationsTab
          activePlatformOpsFocusSummary={activePlatformOpsFocusSummary}
          renderAdminFocusBanner={renderAdminFocusBanner}
          navigateAdminTab={navigateAdminTab}
          jumpToPlatformOpsFocusTarget={jumpToPlatformOpsFocusTarget}
          setPlatformOpsStatusFilter={setPlatformOpsStatusFilter}
          setPlatformOpsOwnerFilter={setPlatformOpsOwnerFilter}
          platformOpsStatusSummary={platformOpsStatusSummary}
          platformOpsStatusFilter={platformOpsStatusFilter}
          platformOpsOwnerFilter={platformOpsOwnerFilter}
          platformOpsOwnerOptions={platformOpsOwnerOptions}
          visiblePlatformOpsQueues={visiblePlatformOpsQueues}
          allTenants={tenants}
          platformOpsQueueRefs={platformOpsQueueRefs}
          platformOpsOwners={platformOpsOwners}
          setPlatformOpsOwners={setPlatformOpsOwners}
          platformOpsDefaultOwner={platformOpsDefaultOwner}
          setPlatformOpsTouchedAt={setPlatformOpsTouchedAt}
          platformOpsStatuses={platformOpsStatuses}
          setPlatformOpsStatuses={setPlatformOpsStatuses}
          formatPartnerLifecycleStatus={formatPartnerLifecycleStatus}
          formatPartnerOnboardingStatus={formatPartnerOnboardingStatus}
          platformOpsTouchedAt={platformOpsTouchedAt}
          platformOpsNotes={platformOpsNotes}
          setPlatformOpsNotes={setPlatformOpsNotes}
          platformOpsResolutionReasons={platformOpsResolutionReasons}
          setPlatformOpsResolutionReasons={setPlatformOpsResolutionReasons}
          handleSavePlatformOpsNote={handleSavePlatformOpsNote}
          platformOpsSavingTenantId={platformOpsSavingTenantId}
          setActiveTab={setActiveTab}
          canViewPackagesTab={canViewPackagesTab}
        />
      )}

      {activeTab === "onboarding_studio" && canViewPlatformGovernance && (
        <OnboardingStudioTab
          onboardingStudioSummary={onboardingStudioSummary}
          searchParams={searchParams}
          renderAdminFocusBanner={renderAdminFocusBanner}
          navigateAdminTab={navigateAdminTab}
          handleStartOnboardingTemplate={handleStartOnboardingTemplate}
          handleCreateDraftTenant={handleCreateDraftTenant}
          tenantGovernanceSuppliers={tenantGovernanceSuppliers}
          formatOnboardingApprovalStatus={formatOnboardingApprovalStatus}
          formatOnboardingPaymentStatus={formatOnboardingPaymentStatus}
          formatPartnerOnboardingStatus={formatPartnerOnboardingStatus}
          formatActivationDeliveryStatus={formatActivationDeliveryStatus}
          formatCategoryRequestStatus={formatCategoryRequestStatus}
          onboardingMembershipActionTenantId={onboardingMembershipActionTenantId}
          handleReviewTenantCategory={handleReviewTenantCategory}
          handleVerifyOnboardingPayment={handleVerifyOnboardingPayment}
          handleApproveOnboardingMembership={handleApproveOnboardingMembership}
          handleRequestOnboardingInfo={handleRequestOnboardingInfo}
          handleRejectOnboardingMembership={handleRejectOnboardingMembership}
        />
      )}

      {activeTab === "tenant_governance" && canViewPlatformGovernance && (
        <div className="atc-page--header">
          <PageHeader eyebrow="Yönetişim" title="Tenant Yönetişimi" sub="Stratejik partner açılışı, onboarding şablonları ve yaşam döngüsü yönetimi" />
        </div>
      )}

      {activeTab === "tenant_governance" && canViewPlatformGovernance && (
        <TenantGovernanceTab
          canEditTenantGovernance={canEditTenantGovernance}
          tenantMessage={tenantMessage}
          openNewTenantModal={openNewTenantModal}
          tenantSaving={tenantSaving}
          handleStartOnboardingTemplate={handleStartOnboardingTemplate}
          isTenantFormModalOpen={isTenantFormModalOpen}
          handleSubmitTenant={handleSubmitTenant}
          closeTenantModal={closeTenantModal}
          editingTenantId={editingTenantId}
          tenantForm={tenantForm}
          setTenantForm={setTenantForm}
          tenantGovernanceFocus={tenantGovernanceFocus}
          renderAdminFocusBanner={renderAdminFocusBanner}
          setTenantGovernanceFocus={setTenantGovernanceFocus}
          setTenantUsageFilter={setTenantUsageFilter}
          tenantUsageFilter={tenantUsageFilter}
          tenantCategoryFilter={tenantCategoryFilter}
          setTenantCategoryFilter={setTenantCategoryFilter}
          tenantCategoryOptions={tenantCategoryOptions}
          tenantSortMode={tenantSortMode}
          setTenantSortMode={setTenantSortMode}
          tenantCategorySummary={tenantCategorySummary}
          tenants={tenants}
          visibleTenants={visibleTenants}
          tenantUsageByTenant={tenantUsageByTenant}
          tenantGovernanceSuppliers={tenantGovernanceSuppliers}
          formatPartnerLifecycleStatus={formatPartnerLifecycleStatus}
          tenantOwnerCandidates={tenantOwnerCandidates}
          handleReassignTenantOwner={handleReassignTenantOwner}
          handleEditTenant={handleEditTenant}
          handleTenantStatusAction={handleTenantStatusAction}
          handleDeleteTenant={handleDeleteTenant}
          companies={companies}
          subscriptionCatalog={subscriptionCatalog}
          navigateAdminTab={(tab, tenantId) =>
            navigateAdminTab(tab as AdminTabKey, tenantId != null ? { tenantFocusId: String(tenantId) } : undefined)
          }
        />
      )}

      {activeTab === "packages" && canViewPackagesTab && (
        <PackagesTab />
      )}

      {error && <div className="admin-page__error-banner">{error}</div>}

      {activeTab === "personnel" && (
        <PersonnelTab
          personnel={isChannelUser ? channelTeamPersonnel : personnel}
          roles={roles}
          companies={companies}
          tenants={tenants}
          loadData={loadData}
          reloadPersonnel={reloadPersonnel}
          readOnly={isPlatformStaff}
          isChannelUser={isChannelUser}
        />
      )}

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <section className="admin-page__subsection-grid">
          <div className={`admin-page__channel-info ${isChannelUser ? "admin-page__channel-info--channel" : "admin-page__channel-info--platform"}`}>
            <div className="admin-page__channel-info-title">
              {isChannelUser ? "Kanal Departmanları" : "Departmanlar nasıl kullanılmalı?"}
            </div>
            <div className="admin-page__channel-info-copy">
              {isChannelUser
                ? "İş ortağı organizasyonunuza ait varsayılan departmanlar aşağıda listelenmiştir. Müşteriler, Operasyon, Satış ve Finans birimlerinizi buradan yönetin."
                : "Varsayılan satın alma departmanları ilk aktivasyonda otomatik açılır. Yeni departman eklerken şirketinizde farklı kategori, uzmanlık veya operasyon hattı varsa ayrı görünürlük ve sahiplik oluşturmak için ekleyin."}
            </div>
            {isChannelUser && (
              <div className="admin-page__text-xs-muted">Henüz departman yoksa aşağıdaki butonu kullanarak varsayılan kanal departmanlarını oluşturabilirsiniz.</div>
            )}
          </div>
          {isChannelUser && departments.length === 0 && (
            <ChannelWorkspaceSeedButton
              onSeeded={async () => {
                await loadData();
                setChannelCatalogRefreshNonce((prev) => prev + 1);
              }}
            />
          )}
          <DepartmentsTab
            departments={departments}
            loadData={loadData}
            readOnly={isPlatformStaff}
            catalogRequests={catalogRequests}
            requestBusyId={catalogRequestBusyId}
            onCreateDepartmentRequest={handleCreateDepartmentCatalogRequest}
            onReviewRequest={handleReviewCatalogRequest}
          />
        </section>
      )}

      {/* Companies Tab */}
      {activeTab === "companies" && (
        <>
          {isChannelUser && (
            <div className="admin-page__channel-info admin-page__channel-info--channel admin-page__channel-info--spaced">
              <div className="admin-page__channel-info-title">İş Ortağı Firma Görünümü</div>
              <div className="admin-page__channel-info-copy">
                Bu ekranda iş ortağı organizasyonunuza ait firma kaydını ve bağlı yapıları görüntülüyorsunuz. Yönlendirdiğiniz müşterilerin firma kayıtları platformdaki katılım süreçlerine göre burada gözükecektir.
              </div>
            </div>
          )}
          <CompaniesTab
            companies={companies}
            loadData={loadData}
            readOnly={isPlatformStaff}
            suppliers={tenantGovernanceSuppliers}
            channelUsers={channelUsers}
            personnel={personnel}
            tenants={tenants}
            handleDeleteCompany={async (id: number) => {
              if (!confirm("Firmayı silmek istediğinize emin misiniz?")) return;
              try {
                await deleteCompany(id);
                await loadData();
              } catch (err) {
                alert("Silme hatası: " + String(err));
              }
            }}
          />
        </>
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <section className="admin-page__subsection-grid">
          <div className={`admin-page__channel-info ${isChannelUser ? "admin-page__channel-info--channel" : "admin-page__channel-info--platform"}`}>
            <div className="admin-page__channel-info-title">
              {isChannelUser ? "Kanal Rolleri" : "Rol ve departman governance merkezi"}
            </div>
            <div className="admin-page__channel-info-copy">
              {isChannelUser
                ? "Kanal organizasyonunuzdaki roller aşağıda listelenmiştir. Hesap sahibi, ekip lideri, temsilci, finans ve denetçi rollerini ekibinize atayabilirsiniz."
                : "Super admin bu ekranda platform, stratejik partner, tedarikçi ve iş ortağı bölümlerini tek yerden yönetir. Yetkili personel rol/departman ekleyebilir, düzenleyebilir ve silebilir."}
            </div>
            {isChannelUser && (
              <div className="admin-page__text-xs-muted">Henüz rol yoksa varsayılan kanal rollerini oluşturmak için aşağıdaki butonu kullanın.</div>
            )}
          </div>
          {isChannelUser && roles.filter(r => r.tenant_id != null).length === 0 && (
            <ChannelWorkspaceSeedButton
              onSeeded={async () => {
                await loadData();
                setChannelCatalogRefreshNonce((prev) => prev + 1);
              }}
            />
          )}
          <RoleDepartmentGovernanceTab
            key={`channel-governance-${channelCatalogRefreshNonce}`}
            tenants={tenants}
            canManage={canAccessRoleCatalog}
            isSuperAdmin={isSuperAdminUser(user)}
            currentUser={user}
            suppliers={tenantGovernanceSuppliers}
          />
        </section>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <section className="admin-page__subsection-grid">
          {searchParams.get("projectFocusName") ? (
            renderAdminFocusBanner({
              eyebrow: "Admin Focus",
              title: `Proje odagi: ${searchParams.get("projectFocusName")}`,
              detail: "Projects listesi bu arama terimiyle acildi ve odak korunuyor.",
              tone: "violet",
              sourceLabel: "Project deep-link",
              timestamp: Date.now(),
              actions: [{ label: "Odağı Temizle", onClick: () => navigateAdminTab("projects") }],
              testId: "admin-focus-banner-project",
            })
          ) : null}
          <ProjectsTab readOnly={isPlatformStaff} initialSearchTerm={searchParams.get("projectFocusName") || ""} />
        </section>
      )}

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && (
        <div className="atc-page--header">
          <PageHeader eyebrow="Tedarik" title="Tedarikçiler" sub="Özel ve global tedarikçi listesi, mail hesapları ve kategori etiketleri" />
        </div>
      )}

      {activeTab === "suppliers" && (
        <SuppliersTab />
      )}

      {/* Supplier Profile Tab (Dual-Role) */}
      {activeTab === "supplier_profile" && canViewSupplierProfileTab && (
        <SupplierProfileTab
          tenantName={user?.organization_name ?? user?.platform_name ?? null}
          tenantId={typeof user?.tenant_id === "number" ? user.tenant_id : null}
          linkedSupplierId={null}
          dualRoleStatus="none"
          onRequestDualRole={async (_supplierId) => {
            // TODO: call PATCH /api/suppliers/{supplierId}/request-dual-role
          }}
        />
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <ApprovalDashboard
          apiUrl={import.meta.env.VITE_API_URL || "http://localhost:8000"}
          authToken={getAccessToken() || ""}
        />
      )}

      {/* Navigasyon Yönetimi Tab */}
      {activeTab === "nav_management" && isSuperAdminUser(user) && (
        <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
          <NavManagerTab />
        </Suspense>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && <SettingsTab onNavigate={(tab) => navigateAdminTab(tab as AdminTabKey)} />}

      {/* panel_designer: super admin → PanelDesignerTab; self-customizers → WorkspacePanelDesignerTab */}
      {activeTab === "panel_designer" && isSuperAdminUser(user) && (
        <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
          <PanelDesignerTab onNavigate={(tab) => navigateAdminTab(tab as AdminTabKey)} />
        </Suspense>
      )}
      {activeTab === "panel_designer" && !isSuperAdminUser(user) && canUseSelfPanelDesigner && (
        <div className="atc-page--header">
          <PageHeader eyebrow="Platform" title="Panel Tasarımcısı" sub="Rol bazlı panel şablonlarını, sekme görünürlüğünü ve renk temalarını düzenleyin" />
        </div>
      )}
      {activeTab === "panel_designer" && !isSuperAdminUser(user) && canUseSelfPanelDesigner && (
        <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
          <WorkspacePanelDesignerTab
            key={JSON.stringify(mergedWorkspacePanelConfig)}
            config={mergedWorkspacePanelConfig}
            sourceConfig={workspacePanelConfig || undefined}
            currentUser={user}
            personnel={personnel}
            mode="self"
            lockedProfile={activeWorkspacePanelProfile}
            saving={workspacePanelSaving}
            onSave={handleSaveWorkspacePanels}
          />
        </Suspense>
      )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            {isChannelUser ? <ChannelReportsTabContent /> : <ReportsTabContent />}
          </Suspense>
        )}

        {activeTab === "mail" && (
          <div className="atc-page--header">
            <PageHeader eyebrow="Sistem" title="E-posta & Gelişmiş Ayarlar" sub="E-posta profilleri, API anahtarları, yedek ve bildirim ayarları" />
          </div>
        )}

        {activeTab === "mail" && (
          <AdvancedSettingsTab />
        )}

        {/* Deployment Tab */}
        {activeTab === "deployment" && canViewDeploymentTab && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <DeploymentPanel />
          </Suspense>
        )}

        {/* Platform Analytics Tab */}
        {activeTab === "platform_analytics" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <PlatformAnalyticsTab />
          </Suspense>
        )}

        {/* Platform Suppliers Tab */}
        {activeTab === "platform_suppliers" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <PlatformSuppliersTab />
          </Suspense>
        )}

        {/* Public Pricing Tab */}
        {activeTab === "public_pricing" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <PublicPricingTab />
          </Suspense>
        )}

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <CampaignsTab />
          </Suspense>
        )}

        {/* Commission Admin Tab */}
        {activeTab === "commission_admin" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <CommissionAdminTab />
          </Suspense>
        )}

        {/* Channel Partners Admin Tab */}
        {activeTab === "channel_partners" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <ChannelPartnersAdminTab />
          </Suspense>
        )}

        {/* AI Lab Admin Tab */}
        {activeTab === "ai_lab" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <AiLabAdminTab />
          </Suspense>
        )}

        {/* Yetenek Ekosistemi Tab */}
        {activeTab === "talent_ecosystem" && (() => {
          const teMoney = (n: number) => "₺" + Number(n || 0).toLocaleString("tr-TR");
          const teInitials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2);
          const teKycPending = teTalents.filter((t) => t.kyc === "pending").length;
          const tePendingPay = tePayouts.filter((p) => p.status !== "paid").reduce((s, p) => s + p.amount, 0);
          const teLeaders = [...TE_LEADERS].sort((a, b) => b.rep - a.rep);
          const teMaxSkill = Math.max(...TE_SKILLS.map((s) => s.n));
          function teSetKyc(id: number, status: string) {
            setTeTalents((prev) => prev.map((t) => t.id === id ? { ...t, kyc: status } : t));
          }
          function teAdvancePayout(id: string) {
            setTePayouts((prev) => prev.map((p) => p.id !== id ? p : { ...p, status: p.status === "pending" ? "approved" : "paid" }));
          }
          return (
            <div className="ph-page">
              <PageHeader
                eyebrow="Kariyer & Yetenek · Ekosistem"
                title="Yetenek Ekosistemi"
                sub="Bağımsız satınalma uzmanları ağı, katkı ekonomisi ve itibar/ödül sistemi. Stratejik Partnerlerin görev ve kaynak bulduğu, uzmanların katkıyla kazandığı platform ekosistemi."
              />

              {/* KPI strip — reuse ph-kpi-grid */}
              <div className="ph-kpi-grid">
                <div className="ph-kpi-card ph-kpi-card--blue">
                  <div className="ph-kpi-card__label">Yetenek Profili</div>
                  <div className="ph-kpi-card__value">124</div>
                  <div className="ph-kpi-card__sub">kayıtlı uzman · +12 / ay</div>
                </div>
                <div className="ph-kpi-card ph-kpi-card--green">
                  <div className="ph-kpi-card__label">KYC Onaylı</div>
                  <div className="ph-kpi-card__value">96</div>
                  <div className="ph-kpi-card__sub">%77 doğrulanmış</div>
                </div>
                <div className="ph-kpi-card ph-kpi-card--violet">
                  <div className="ph-kpi-card__label">Aktif Katkıcı</div>
                  <div className="ph-kpi-card__value">58</div>
                  <div className="ph-kpi-card__sub">son 30 günde görev aldı</div>
                </div>
                <div className="ph-kpi-card ph-kpi-card--gold">
                  <div className="ph-kpi-card__label">Katkı Ekonomisi</div>
                  <div className="ph-kpi-card__value">₺186K</div>
                  <div className="ph-kpi-card__sub">dağıtılan ödül · 12 ay</div>
                </div>
                <div className="ph-kpi-card">
                  <div className="ph-kpi-card__label">Ortalama İtibar</div>
                  <div className="ph-kpi-card__value">512</div>
                  <div className="ph-kpi-card__sub">1000 üzerinden</div>
                </div>
              </div>

              {/* 3 Pillars */}
              <div className="te-pillars">
                {TE_PILLARS.map((p) => (
                  <div key={p.k} className="te-pillar" style={{ "--tc": p.color } as React.CSSProperties}>
                    <b>{p.k}</b>
                    <span>{p.d}</span>
                  </div>
                ))}
              </div>

              {/* İtibar Seviyeleri + Beceri Kapsamı */}
              <div className="ph-split-1-1">
                <div className="ph-section">
                  <div className="ph-section__head">
                    <span className="ph-section__title">İtibar Seviyeleri</span>
                    <span className="ph-section__sub">görev başarımına göre kademe ve ayrıcalıklar</span>
                  </div>
                  <div className="te-tiers">
                    {TE_TIERS.map((t) => (
                      <div key={t.name} className="te-tier" style={{ "--tc": t.color } as React.CSSProperties}>
                        <div className="te-tier__top">
                          <span className="te-tier__dot" />
                          <b>{t.name}</b>
                          <em>{t.count} uzman</em>
                        </div>
                        <div className="te-tier__min">İtibar ≥ {t.min}</div>
                        <div className="te-tier__perk">{t.perk}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ph-section">
                  <div className="ph-section__head">
                    <span className="ph-section__title">Beceri & Kategori Kapsamı</span>
                    <span className="ph-section__sub">havuzdaki uzmanlık dağılımı</span>
                  </div>
                  <div className="te-skills">
                    {TE_SKILLS.map((s) => (
                      <div key={s.k} className="te-skill">
                        <div className="te-skill__hd"><span>{s.k}</span><b>{s.n}</b></div>
                        <div className="te-skill__bar">
                          <i style={{ "--skill-w": `${Math.round(s.n / teMaxSkill * 100)}%` } as React.CSSProperties} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="ph-section">
                <div className="ph-section__head">
                  <span className="ph-section__title">En İyi Katkıcılar</span>
                  <span className="ph-section__sub">itibar ve katkı bazlı sıralama</span>
                </div>
                <div className="te-board">
                  {teLeaders.map((l, i) => (
                    <div key={l.name} className="te-leader">
                      <span className={`te-rank${i < 3 ? " te-rank--top" : ""}`}>{i + 1}</span>
                      <span className="te-av">{teInitials(l.name)}</span>
                      <div className="te-leader__meta">
                        <b>{l.name}</b>
                        <span>{l.tasks} görev tamamlandı</span>
                      </div>
                      <span className="te-tier-badge" style={{ "--tc": TE_TIER_COLORS[l.tier], "--tg": TE_TIER_BG[l.tier] } as React.CSSProperties}>{l.tier}</span>
                      <div className="te-leader__num"><b>{l.rep}</b><span>itibar</span></div>
                      <div className="te-leader__num"><b>{teMoney(l.earned)}</b><span>kazanç</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KYC Kuyruğu + Görevler | Ödeme Kuyruğu */}
              <div className="te-split">
                <div className="te-split__col">
                  <div className="ph-section">
                    <div className="ph-section__head">
                      <span className="ph-section__title">Yetenek & KYC Onay Kuyruğu</span>
                      <span className="ph-section__sub">{teKycPending} uzman doğrulama bekliyor</span>
                    </div>
                    <div className="te-table-wrap">
                      <table className="te-table">
                        <thead>
                          <tr>
                            <th>Uzman</th><th>Müsaitlik</th><th>İtibar</th><th>Kazanç</th><th>KYC</th><th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {teTalents.map((t) => (
                            <tr key={t.id}>
                              <td>
                                <div className="te-tname">
                                  <span className="te-av te-av--sm">{teInitials(t.name)}</span>
                                  <div>
                                    <b>{t.name}</b>
                                    <span className="te-muted">{t.exp} yıl · {t.skills.join(", ")}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="te-muted">{TE_AVAIL_LABEL[t.avail] ?? t.avail}</td>
                              <td className="te-mono">{t.rep}</td>
                              <td className="te-mono">{teMoney(t.earned)}</td>
                              <td>
                                <span className={`te-badge te-badge--${t.kyc === "approved" ? "ok" : t.kyc === "rejected" ? "err" : "wait"}`}>
                                  {t.kyc === "approved" ? "Onaylı" : t.kyc === "rejected" ? "Red" : "Bekliyor"}
                                </span>
                              </td>
                              <td>
                                {t.kyc === "pending" && (
                                  <span className="te-actrow">
                                    <button type="button" className="te-act te-act--ok" onClick={() => teSetKyc(t.id, "approved")}>Onayla</button>
                                    <button type="button" className="te-act te-act--danger" onClick={() => teSetKyc(t.id, "rejected")}>Red</button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="ph-section">
                    <div className="ph-section__head">
                      <span className="ph-section__title">Katkı Görevleri</span>
                      <span className="ph-section__sub">platform mikro görevleri</span>
                    </div>
                    <div className="te-tasks">
                      {TE_TASKS_MOCK.map((t) => (
                        <div key={t.id} className="te-task">
                          <div className="te-task__l">
                            <b>{t.title}</b>
                            <span className="te-muted">{t.type} · {t.subs} katkı</span>
                          </div>
                          <div className="te-task__r">
                            <span className="te-reward">{teMoney(t.reward)}</span>
                            <span className="te-badge te-badge--ok">Aktif</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ödeme kuyruğu */}
                <div className="te-payout-panel">
                  <div className="te-payout-panel__hd">
                    Ödül & Ödeme Kuyruğu
                    <span className="te-payout-panel__count">{tePayouts.filter((p) => p.status !== "paid").length}</span>
                  </div>
                  <div className="te-payout-list">
                    {tePayouts.map((p) => (
                      <div key={p.id} className="te-payout">
                        <div className="te-payout__top">
                          <b>{p.name}</b>
                          <span className={`te-badge te-badge--${p.status === "paid" ? "ok" : p.status === "approved" ? "info" : "wait"}`}>
                            {p.status === "paid" ? "Ödendi" : p.status === "approved" ? "Onaylı" : "Bekliyor"}
                          </span>
                        </div>
                        <div className="te-payout__mid">
                          <span className="te-mono">{teMoney(p.amount)}</span>
                          <span className="te-muted">{p.method}</span>
                        </div>
                        {p.status !== "paid" && (
                          <button type="button" className="te-act te-act--ok te-act--full" onClick={() => teAdvancePayout(p.id)}>
                            {p.status === "pending" ? "Onayla" : "Ödemeyi tamamla"}
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="te-paysum">Bekleyen toplam <b>{teMoney(tePendingPay)}</b></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Kariyer Yönetimi Tab */}
        {activeTab === "kariyer_yonetimi" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <TalentAdminControlPage jobsOnly />
          </Suspense>
        )}

        {/* Support Tickets Tab */}
        {activeTab === "support_tickets" && (
          <Suspense fallback={<div className="admin-page__tab-loading">Tab yukleniyor...</div>}>
            <SupportTicketAdminTab />
          </Suspense>
        )}

      {showUpgradeExtrasWorkspace && (
        <UpgradeExtrasWorkspace
          searchParams={searchParams}
          currentPlanLabel={currentPlanLabel}
          purchasedServiceCards={purchasedServiceCards}
          addonCards={addonCards}
          setAddonCardRef={setAddonCardRef}
          setSubscriptionUpgradeSectionRef={setSubscriptionUpgradeSectionRef}
          currentPackageCard={currentPackageCard}
          upgradePackageCards={upgradePackageCards}
          packageTierCards={packageTierCards}
          setPackagePlanRef={setPackagePlanRef}
        />
      )}
    </div>
  );

  if (_shellMode) {
    return (
      <AdminShell
        activeKey={activeTab}
        onNavigate={(key) => navigateAdminTab(key as AdminTabKey)}
        user={user}
        tabKeys={isSuperAdminUser(user) ? undefined : tabConfigs.map((t) => t.key)}
      >
        {_adminNode}
      </AdminShell>
    );
  }
  return _adminNode;
}
