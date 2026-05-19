// PAGE: web/src/pages/AdminPage.tsx
import { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DepartmentsTab } from "./admin/DepartmentsTab";
import { PersonnelTab } from "./admin/PersonnelTab";
import { CompaniesTab } from "./admin/CompaniesTab";
import { adminFocusBannerPalette, renderTabIconBadge, translateServiceLabel } from "./admin/adminPageMeta";
import type { AdminFocusBannerTone, AdminTabKey, TabConfig } from "./admin/adminPageMeta";
import { useAuth } from "../hooks/useAuth";
import PremiumFeaturePurchasePanel from "../components/PremiumFeaturePurchasePanel";
import { canAccessAdminSurface, canAccessProcurementSettings, canAccessWorkspacePanel, canManageRoleCatalog, canManageTenantGovernance, getUserDisplayRoleLabel, isPlatformStaffUser, isSuperAdminUser, isTenantAdminUser, resolveApprovalRoleLabel } from "../auth/permissions";
import { ProjectsTab } from "../components/ProjectsTab";
import { RolesTab } from "../components/RolesTab";
import { SuppliersTab } from "../components/SuppliersTab";
import { SettingsTab } from "../components/SettingsTab";
import { ApprovalDashboard } from "../components/ApprovalDashboard";
import { WorkspacePanelDesignerTab } from "../components/admin/WorkspacePanelDesignerTab";
import { getAccessToken } from "../lib/token";
import { Link } from "react-router-dom";
import PublicBrandLogo from "../components/PublicBrandLogo";
import {
  getTenants,
  getAdminSuppliers,
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
  updateWorkspacePanelConfig,
  updateCommercialRequestStatus,
  updateCommercialRequestWebhookSettings,
  updateSubscriptionAddonLifecycle,
} from "../services/admin.service";
import type { BillingOverview, CommercialRequestItem, CommercialRequestWebhookDelivery, CommercialRequestWebhookSettings, SubscriptionAddonAdminItem, TenantUser, Department, Company, Role, Tenant, SubscriptionCatalogSnapshot, DiscoveryLabAnswerAuditSummary, DiscoveryLabSessionSummary, DiscoveryLabSummary, OnboardingStudioSummary, WorkspacePanelConfig, AdminSupplierListItem, Project } from "../services/admin.service";
import { useSearchParams } from "react-router-dom";
import { QuoteStatusColor, QuoteStatusLabel, normalizeQuoteStatus } from "../types/quote.types";
import { getQuote, getQuoteAuditTrail, getQuoteHistory, getQuotePendingApprovals, type Quote, type QuoteAuditTrail, type QuotePendingApproval, type StatusLog } from "../services/quote.service";
import { getWorkspacePanelQuickLinks, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile, WORKSPACE_PANEL_DATA_TABS, type WorkspacePanelTabKey } from "../admin/workspace-panels";

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

function getIsoDateOffset(daysOffset: number) {
  const today = new Date();
  const target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysOffset));
  return target.toISOString().slice(0, 10);
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
  return section === "status-history" ? "Durum Gecmisi" : "Denetim Izi";
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
    return { bucket: "open", label: "Acik" };
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
  if (normalized === "sent") return "mail gonderildi";
  if (normalized === "activated") return "kullanici aktive etti";
  if (normalized === "not_sent") return "gonderilmedi";
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
  return `Kaynak=${snapshot.source} • Zaman=${snapshot.window} • Arama=${snapshot.search || "-"}`;
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
    if (!parsed.presetHash) warnings.push("Ozet kodu metadata alani eksik (presetHash)");
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
      return differences.map((difference) => `${preset.name} • ${difference}`);
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

const PlatformSuppliersTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).PlatformSuppliersTab,
}));

const PublicPricingTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).PublicPricingTab,
}));

const PlatformAnalyticsTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).PlatformAnalyticsTab,
}));

const CampaignsTab = lazy(async () => ({
  default: (await import("./admin/adminSecondaryTabs")).CampaignsTab,
}));

export default function AdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTabKey>("panel_home");
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
  // ...

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantGovernanceSuppliers, setTenantGovernanceSuppliers] = useState<AdminSupplierListItem[]>([]);
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
  const [billingSubscriptionFilter, setBillingSubscriptionFilter] = useState<"all" | "active" | "trialing" | "other">("all");
  const [billingInvoiceFilter, setBillingInvoiceFilter] = useState<"all" | "open" | "paid" | "other">("all");
  const [billingWebhookFilter, setBillingWebhookFilter] = useState<"all" | "processed" | "failed" | "other">("all");
  const [billingWebhookRetryingEventId, setBillingWebhookRetryingEventId] = useState<number | null>(null);
  const [packagePlanFilter, setPackagePlanFilter] = useState<string>("all");
  const [packageRiskFilter, setPackageRiskFilter] = useState<"all" | "pressure" | "breach">("all");
  const [tenantUsageFilter, setTenantUsageFilter] = useState<"all" | "pressure" | "breach">("all");
  const [tenantSortMode, setTenantSortMode] = useState<"risk" | "name">("risk");
  const [tenantCategoryFilter, setTenantCategoryFilter] = useState<string>("all");
  const [discoveryLabSessions, setDiscoveryLabSessions] = useState<DiscoveryLabSessionSummary[]>([]);
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
  const [discoveryLabStatusFilter, setDiscoveryLabStatusFilter] = useState<"all" | "analyzed" | "technical_locked">("all");
  const [discoveryLabProjectQuery, setDiscoveryLabProjectQuery] = useState("");
  const [discoveryLabUserQuery, setDiscoveryLabUserQuery] = useState("");
  const [discoveryLabDateFrom, setDiscoveryLabDateFrom] = useState("");
  const [discoveryLabDateTo, setDiscoveryLabDateTo] = useState("");
  const [discoveryLabSearch, setDiscoveryLabSearch] = useState("");
  const [expandedDiscoverySessionId, setExpandedDiscoverySessionId] = useState<string | null>(null);
  const [expandedDiscoveryAuditId, setExpandedDiscoveryAuditId] = useState<number | null>(null);
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
  const canViewSettingsTab = canAccessProcurementSettings(user);
  const workspaceName = user?.organization_name || user?.platform_name || "Buyera Asistans";
  const mergedWorkspacePanelConfig = useMemo(() => mergeWorkspacePanelConfig(workspacePanelConfig), [workspacePanelConfig]);
  const activeWorkspacePanelProfile = useMemo(() => resolveWorkspacePanelProfile(user, mergedWorkspacePanelConfig), [mergedWorkspacePanelConfig, user]);
  const canOpenWorkspacePanel = canAccessWorkspacePanel(user) || Boolean(activeWorkspacePanelProfile);
  const isRoleManagementOnly = canAccessRoleCatalog && !canAccessAdminWorkspace && !activeWorkspacePanelProfile;
  const workspacePanelQuickLinks = useMemo(() => getWorkspacePanelQuickLinks(activeWorkspacePanelProfile), [activeWorkspacePanelProfile]);
  const telemetryPresetUserKey = buildFocusTelemetryPresetUserKey(user?.email, user?.id);
  const platformOpsDefaultOwner = user?.full_name || user?.email || workspaceName;
  const currentUserRoleLabel = getUserDisplayRoleLabel(user);
  const totalActivePersonnel = personnel.filter((item) => item.is_active).length;
  const totalPassivePersonnel = personnel.length - totalActivePersonnel;
  const totalActiveCompanies = companies.filter((item) => item.is_active).length;
  const totalPassiveCompanies = companies.length - totalActiveCompanies;
  const totalActiveDepartments = departments.filter((item) => item.is_active).length;
  const totalActiveRoles = roles.filter((item) => item.is_active).length;
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
    const activeCompanyMetric = metricMap.get("active_companies");
    const activeProjectMetric = metricMap.get("active_projects");
    const activeUserMetric = metricMap.get("active_internal_users");
    const supplierMetric = metricMap.get("active_private_suppliers") || metricMap.get("private_suppliers");
    const quoteMetric = metricMap.get("active_quotes");
    const fileMetric = metricMap.get("project_files_total");
    const fileSizeMetric = metricMap.get("project_file_size_mb");
    const activeProjectCount = projects.filter((item) => item.is_active).length;
    const passiveProjectCount = projects.filter((item) => !item.is_active).length;

    const buildRemaining = (used?: number | null, limit?: number | null) => {
      if (limit == null || used == null) return undefined;
      return Math.max(limit - used, 0);
    };

    return [
      {
        key: "metric-companies",
        title: "Firma Yonetimi",
        note: "Pakete dahil aktif firma kapasitesi ve pasif firma dagilimi.",
        activeCount: activeCompanyMetric?.used ?? totalActiveCompanies,
        passiveCount: totalPassiveCompanies,
        usedCount: activeCompanyMetric?.used ?? totalActiveCompanies,
        limitCount: activeCompanyMetric?.limit ?? undefined,
        remainingCount: buildRemaining(activeCompanyMetric?.used ?? totalActiveCompanies, activeCompanyMetric?.limit ?? undefined),
        unit: activeCompanyMetric?.unit || "firma",
      },
      {
        key: "metric-rfq",
        title: translateServiceLabel("RFQ (Teklif Isteme Formu) Yonetimi"),
        note: "Hazirlanabilecek, tedarikciye cikilabilecek ve onay akisina alinabilecek toplam teklif sayisi.",
        usedCount: quoteMetric?.used ?? currentTenantQuoteCount,
        limitCount: quoteMetric?.limit ?? undefined,
        remainingCount: buildRemaining(quoteMetric?.used ?? currentTenantQuoteCount, quoteMetric?.limit ?? undefined),
        unit: quoteMetric?.unit || "teklif",
      },
      {
        key: "metric-supplier-portal",
        title: translateServiceLabel("Tedarikci Portali"),
        note: "Pakete bagli olarak yonetilebilecek aktif tedarikci sayisi.",
        usedCount: supplierMetric?.used,
        limitCount: supplierMetric?.limit ?? undefined,
        remainingCount: buildRemaining(supplierMetric?.used, supplierMetric?.limit ?? undefined),
        unit: supplierMetric?.unit || "tedarikci",
      },
      {
        key: "metric-projects",
        title: translateServiceLabel("Proje Yonetimi"),
        note: "Aktif ve pasif proje dagilimi ile planin tanidigi toplam aktif proje kapasitesi.",
        activeCount: activeProjectMetric?.used ?? activeProjectCount,
        passiveCount: passiveProjectCount,
        usedCount: activeProjectMetric?.used ?? activeProjectCount,
        limitCount: activeProjectMetric?.limit ?? undefined,
        remainingCount: buildRemaining(activeProjectMetric?.used ?? activeProjectCount, activeProjectMetric?.limit ?? undefined),
        unit: activeProjectMetric?.unit || "proje",
      },
      {
        key: "metric-users",
        title: translateServiceLabel("Kullanici Yonetimi"),
        note: "Aktif ve pasif ekip dagilimi ile planin tanidigi toplam aktif kullanici kapasitesi.",
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
  }, [currentTenantQuoteCount, currentTenantUsage, projects, totalActiveCompanies, totalActivePersonnel, totalPassiveCompanies, totalPassivePersonnel]);
  const packageTierCards = useMemo(() => {
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
          limits: Object.fromEntries(plan.modules.filter((module) => module.limit_key && module.limit_value != null).map((module) => [String(module.limit_key), Number(module.limit_value)])),
          features: plan.modules.map((module) => module.name),
        }));

    const normalizeHighlights = (plan: PricingPlanCard) => [
      `Firma limiti: ${plan.limits?.active_companies ?? "-"} firma`,
      `Kullanici limiti: ${plan.limits?.active_internal_users ?? "-"} kullanici`,
      `Proje limiti: ${plan.limits?.active_projects ?? "-"} proje`,
      `Tedarikci limiti: ${plan.limits?.active_private_suppliers ?? "-"} tedarikci`,
      `Teklif limiti: ${plan.limits?.active_quotes ?? "-"} teklif`,
      `Dosya limiti: ${plan.limits?.project_files_total ?? "-"} dosya`,
      `Tek dosya boyutu: ${plan.limits?.project_file_size_mb ?? "-"} MB`,
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
          ? "Ozel listeleme aktif oldugunda teklifleriniz daha genis tedarikci kitlesine acilir ve tedarikcileri inceleyerek ek teklif toplayabilirsiniz."
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
    setSearchParams(nextParams);
  }, [focusTelemetryActionHistoryFilter, focusTelemetryActionHistorySearch, focusTelemetryActionHistoryWindow, focusTelemetrySearchQuery, focusTelemetrySourceFilter, focusTelemetryWindowFilter, searchParams, setSearchParams]);

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
    const palette = adminFocusBannerPalette[options.tone];
    return (
      <div
        data-testid={options.testId}
        style={{
          borderRadius: 18,
          border: `1px solid ${palette.border}`,
          background: palette.background,
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: palette.accent }}>{options.eyebrow}</div>
          <div style={{ color: palette.accent, fontWeight: 800 }}>{options.title}</div>
          <div style={{ color: "#475569", fontSize: 12 }}>{options.detail}</div>
          {(options.sourceLabel || options.timestamp) ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              {options.sourceLabel ? (
                <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: palette.soft, color: palette.accent, fontSize: 11, fontWeight: 800 }}>
                  Kaynak: {options.sourceLabel}
                </span>
              ) : null}
              {options.timestamp ? (
                <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", color: "#475569", fontSize: 11, fontWeight: 700, border: `1px solid ${palette.border}` }}>
                  {formatAdminFocusTimestamp(options.timestamp)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {options.actions?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {options.actions.map((action) => action.href ? (
              <Link
                key={`${options.title}-${action.label}`}
                to={action.href}
                style={{ padding: "7px 11px", borderRadius: 999, border: `1px solid ${palette.border}`, background: "white", color: palette.accent, fontWeight: 800, fontSize: 12, textDecoration: "none" }}
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={`${options.title}-${action.label}`}
                type="button"
                onClick={action.onClick}
                style={{ padding: "7px 11px", borderRadius: 999, border: `1px solid ${palette.border}`, background: "white", color: palette.accent, fontWeight: 800, fontSize: 12, cursor: "pointer" }}
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
    appendRestoredQuoteDebugEvent("action", "Manuel Temizleme", "Geri yukleme odagi kullanici tarafindan temizlendi");
  }, [appendRestoredQuoteDebugEvent]);

  const jumpToRestoredQuoteCard = useCallback(() => {
    if (!restoredQuoteInsight) {
      return;
    }
    discoveryQuoteCardRefs.current[restoredQuoteInsight.quoteId]?.scrollIntoView?.({ block: "center", behavior: "auto" });
    appendRestoredQuoteDebugEvent("action", "Atlama Eylemi", `RFQ #${restoredQuoteInsight.quoteId} kartina gidildi`);
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
        background: pendingCount > 0 ? "#fef3c7" : "#dcfce7",
        color: pendingCount > 0 ? "#b45309" : "#166534",
      },
      {
        key: "transition",
        label: transitionReason === "-" ? "Gerekce yok" : "Gerekce var",
        detail: `Transition reason: ${transitionReason}`,
        background: transitionReason === "-" ? "#e5e7eb" : "#dbeafe",
        color: transitionReason === "-" ? "#475569" : "#1d4ed8",
      },
      {
        key: "event",
        label: latestEvent,
        detail: `Son olay: ${latestEvent}`,
        background: "#ede9fe",
        color: "#6d28d9",
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
      events.push({ id: "platform-overview-tenant", label: "Platform Genel Bakisi Odagi", detail: `Stratejik Partner odagi: ${tenantFocusName}`, source: "platform-overview", createdAt: now });
    }
    if (projectFocusName) {
      events.push({ id: "platform-overview-project", label: "Platform Genel Bakisi Odagi", detail: `Proje odagi: ${projectFocusName}`, source: "platform-overview", createdAt: now - 1 });
    }
    if (onboardingPlanFocus) {
      events.push({ id: "platform-overview-onboarding", label: "Platform Genel Bakisi Odagi", detail: `Onboarding plani: ${String(onboardingPlanFocus).toUpperCase()}`, source: "platform-overview", createdAt: now - 2 });
    }
    if (tenantGovernanceFocus?.tenantId != null || tenantGovernanceFocus?.tenantName) {
      events.push({
        id: "tenant-governance-focus",
        label: "Stratejik Partner Yonetimi Odagi",
        detail: tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`,
        source: "tenant-governance",
        createdAt: now - 3,
      });
    }
    if (activePlatformOpsFocusSummary.length > 0) {
      events.push({ id: "platform-ops-focus", label: "Platform Operasyonlari Odagi", detail: activePlatformOpsFocusSummary.join(" • "), source: "platform-operations", createdAt: now - 4 });
    }
    if (activePackageFocusSummary.length > 0) {
      events.push({ id: "packages-focus", label: "Paketler Odagi", detail: activePackageFocusSummary.join(" • "), source: "packages", createdAt: now - 5 });
    }
    if (restoredQuoteInsight) {
      events.push({ id: `restore-focus-${restoredQuoteInsight.quoteId}`, label: "Geri Yukleme Odagi", detail: `RFQ #${restoredQuoteInsight.quoteId} • ${getQuoteInsightSectionLabel(restoredQuoteInsight.section)}`, source: "discovery-lab", createdAt: now - 6, targetQuoteId: restoredQuoteInsight.quoteId, targetSection: restoredQuoteInsight.section });
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
    navigateAdminTab("platform_overview");
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
      setDiscoveryQuoteInsightErrorById((current) => ({ ...current, [quoteId]: err instanceof Error ? err.message : "RFQ gecmisi yuklenemedi" }));
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

  const billingWebhookSummary = useMemo(() => {
    const events = billingOverview?.recent_webhook_events || [];
    return {
      all: events.length,
      processed: events.filter((item) => item.processing_status === "processed").length,
      failed: events.filter((item) => item.processing_status === "failed").length,
      other: events.filter((item) => item.processing_status !== "processed" && item.processing_status !== "failed").length,
    };
  }, [billingOverview]);

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

  const commercialRequestWebhookDeliverySummary = useMemo(() => {
    const deliveries = commercialRequestWebhookDeliveries || [];
    return {
      all: deliveries.length,
      delivered: deliveries.filter((item) => item.delivery_status === "delivered").length,
      failed: deliveries.filter((item) => item.delivery_status === "failed").length,
      other: deliveries.filter((item) => item.delivery_status !== "delivered" && item.delivery_status !== "failed").length,
    };
  }, [commercialRequestWebhookDeliveries]);

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
        title: "Onboarding Takibi",
        note: "Kurulumu tamamlanmamis tenantlar once burada ele alinmali.",
        color: "#b45309",
        items: byOnboarding,
        nextStep: "Stratejik Partner yonetici daveti ve ilk kurulum durumunu kontrol et",
      },
      {
        key: "owner",
        title: "Owner Atama Kuyrugu",
        note: "Owner bilgisi eksik tenantlar governance tarafinda risk yaratir.",
        color: "#dc2626",
        items: byOwner,
        nextStep: "Stratejik Partner Yonetimi sekmesinde yonetici adayini belirle",
      },
      {
        key: "branding",
        title: "Branding Eksikleri",
        note: "Logo veya gorunen ad eksigi olan tenantlar white-label hazir degil.",
        color: "#7c3aed",
        items: byBranding,
        nextStep: "Logo, gorunen ad ve Stratejik Partner kimligini guncelle",
      },
      {
        key: "paused",
        title: "Duraklatilan Tenantlar",
        note: "Pasif veya paused tenantlar icin ticari veya operasyonel takip gerekir.",
        color: "#475569",
        items: byPaused,
        nextStep: "Abonelik, faturalama veya destek notunu super admin ile teyit et",
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

    return {
      activeWork,
      ownerWaiting,
      resolvedWithReason,
      staleContact,
      unassignedOwner,
      busiestOwnerName: busiestOwnerEntry?.[0] || "Atama bekleniyor",
      busiestOwnerLoad: busiestOwnerEntry?.[1] || 0,
    };
  }, [platformOpsOwners, platformOpsStatuses, platformOpsTouchedAt, tenants]);

  const platformOpsOwnerOptions = useMemo(() => {
    const uniqueOwners = Array.from(new Set(
      tenants
        .map((tenant) => String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim())
        .filter((owner) => owner.length > 0)
    )).sort((left, right) => left.localeCompare(right, "tr"));

    return [
      { value: "all", label: "Tum Owner'lar" },
      { value: "__unassigned__", label: "Atanmamis Kayitlar" },
      ...uniqueOwners.map((owner) => ({ value: owner, label: owner })),
    ];
  }, [platformOpsOwners, tenants]);

  const visiblePlatformOpsQueues = useMemo(() => {
    return platformOpsQueues.map((queue) => ({
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
          next[tenant.id] = String(tenant.support_last_contacted_at || tenant.updated_at || tenant.created_at || "").slice(0, 10) || "2026-04-15";
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
    if (isRoleManagementOnly) {
      return [
        {
          key: "roles",
          label: "Roller ve Yetkiler",
          icon: "ROL",
          description: "Rol hiyerarsisini, izin dagilimini ve alt rol yonetimini bu alandan yonetin.",
        },
      ];
    }

    const baseTabs: TabConfig[] = [
      {
        key: "panel_home",
          label: canViewPlatformGovernance ? (activeWorkspacePanelProfile?.title || "Panel Ana Sayfa") : currentUserRoleLabel,
        icon: "ADM",
        description: canViewPlatformGovernance ? (activeWorkspacePanelProfile?.description || "Bu rola ait panel ozetini ve hizli yonlendirmeleri goruntuleyin.") : "",
      },
      ...(canViewPlatformGovernance
        ? [
            {
              key: "platform_overview" as const,
              label: "Platform Genel Bakis",
              icon: "GEN",
              description: "Stratejik Partner gecisi, musteri portfoyu ve platform operasyonlarini ust seviyede izleyin.",
            },
            {
              key: "platform_operations" as const,
              label: "Platform Operasyonlari",
              icon: "OPS",
              description: "Platform destek ve operator ekipleri icin Stratejik Partner triage kuyruklarini yonetin.",
            },
            {
              key: "discovery_lab_operations" as const,
              label: "Discovery Lab Operasyonlari",
              icon: "LAB",
              description: "Discovery Lab yanit denetimi, Stratejik Partner kirilimi ve RFQ baglantilarini detayli olarak izleyin.",
            },
            {
              key: "onboarding_studio" as const,
              label: "Kurulum Studyosu",
              icon: "KUR",
              description: "Plan secimi, Stratejik Partner acilisi ve ilk aktivasyon akislarini tek yuzeyde toplayin.",
            },
            {
              key: "tenant_governance" as const,
              label: "Stratejik Partner Yonetimi",
              icon: "SPY",
              description: "Musteri Stratejik Partner olusumu, kurulum olgunlugu ve operasyonel hazirlik durumunu yonetin.",
            },
            ...(canViewPackagesTab
              ? [
                  {
                    key: "packages" as const,
                    label: "Paket ve Kullanim",
                    icon: "PKT",
                    description: "Plan katalogu, modul dagilimi ve Stratejik Partner limitlerini super admin seviyesinde izleyin.",
                  },
                ]
              : []),
            {
              key: "platform_analytics" as const,
              label: "Platform Analitikleri",
              icon: "ANL",
              description: "Tenant sayisi, kullanici dagilimi, plan dagilimi ve platform geneli operasyon metriklerini izleyin.",
            },
            {
              key: "platform_suppliers" as const,
              label: "Platform Tedarikci Havuzu",
              icon: "TED",
              description: "Tum tenant'lara acik platform geneli tedarikci havuzunu yonetin.",
            },
            {
              key: "public_pricing" as const,
              label: "Public Fiyatlandirma",
              icon: "FYT",
              description: "Public webde yayinlanan stratejik ortak ve tedarikci planlarini yonetin.",
            },
            {
              key: "campaigns" as const,
              label: "Kampanyalar ve Landing",
              icon: "KMP",
              description: "Platform duyurularini, kampanyalarini ve landing sayfa iceriklerini yonetin.",
            },
            ...(canViewSettingsTab
              ? [
                  {
                    key: "settings" as const,
                    label: "Platform Ayarlari",
                    icon: "AYR",
                    description: "Platform gonderim, genel sistem ve ust seviye ayarlari yonetin.",
                  },
                ]
              : []),
          ]
        : []),
      {
        key: "companies",
        label: canViewPlatformGovernance ? "Stratejik Partnerler / Firmalar" : "Firma Yapisi",
        icon: "FRM",
        description: canViewPlatformGovernance
          ? "Platformdaki musteri firmalarini ve yapilarini izleyin."
          : "Kendi Stratejik Partner yapiniza ait firma ve bagli yapilari yonetin.",
      },
      {
        key: "roles",
        label: "Roller ve Yetkiler",
        icon: "ROL",
        description: canViewPlatformGovernance
          ? "Platform ve Stratejik Partner gecis sureci icin rol yapisini izleyin."
          : "Kendi ekip rollerinizi ve yetki dagilimlarini yonetin.",
      },
      {
        key: "departments",
        label: "Departmanlar",
        icon: "DEP",
        description: "Is akislarinin gectigi departman ve alt acilimlari yonetin.",
      },
      {
        key: "personnel",
        label: "Personeller",
        icon: "PRS",
        description: canViewPlatformGovernance
          ? "Stratejik Partner kullanicilarini ve olusum kurallarini denetleyin."
          : "Ekibinizi, atamalari ve iletisim bilgilerini yonetin.",
      },
      {
        key: "projects",
        label: "Projeler",
        icon: "PRJ",
        description: "RFQ ve satin alma operasyonlarinin baglandigi projeleri yonetin.",
      },
      {
        key: "suppliers",
        label: "Tedarikciler",
        icon: "TDK",
        description: "Kendi tedarikci portfoyunuzu ve iliski durumlarini izleyin.",
      },
      {
        key: "approvals",
        label: "Onay Akislari",
        icon: "ONY",
        description: "Teklif ve karar sureclerindeki onay bekleyen kayitlari yonetin.",
      },
      {
        key: "reports",
        label: "Raporlar",
        icon: "RPR",
        description: canViewPlatformGovernance
          ? "Platform genelinde teklif karsilastirma ve performans raporlarini goruntuleyin."
          : "RFQ karsilastirma ve satin alma performans raporlarinizi goruntuleyin.",
      },
      ...(canViewPlatformGovernance || !canViewSettingsTab
        ? []
        : [
            {
              key: "settings" as const,
              label: "Stratejik Partner Ayarlari",
              icon: "AYR",
              description: "Stratejik Partner kimligi, e-posta gonderici hesaplari ve calisma alani ayarlarinizi yonetin.",
            },
          ]),
    ];

    if (isSuperAdminUser(user)) {
      baseTabs.push({
        key: "panel_designer",
        label: "Panel Tasarimi",
        icon: "PNT",
        description: "Tum rol panellerini, gorulecek sekmeleri ve yeni rol profillerini bu alandan yonetin.",
      });
    }

    if (!activeWorkspacePanelProfile) {
      return baseTabs;
    }

    const allowedTabs = new Set(activeWorkspacePanelProfile.allowed_tabs as AdminTabKey[]);
    return baseTabs.filter((tab) => allowedTabs.has(tab.key) || tab.key === "panel_home" || tab.key === "panel_designer");
  }, [activeWorkspacePanelProfile, canViewPackagesTab, canViewPlatformGovernance, canViewSettingsTab, currentUserRoleLabel, isRoleManagementOnly, user]);

  const shouldLoadAdminWorkspaceData = useMemo(
    () => tabConfigs.some((item) => WORKSPACE_PANEL_DATA_TABS.has(item.key as WorkspacePanelTabKey)),
    [tabConfigs]
  );

  const currentTab = tabConfigs.find((tab) => tab.key === activeTab) ?? tabConfigs[0];

  // Load data
  const loadData = useCallback(async function loadData() {
    if (isRoleManagementOnly || !shouldLoadAdminWorkspaceData) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [personnelData, deptData, companyData, rolesData, projectData] = await Promise.all([
        getTenantUsers(),
        getDepartments(),
        getCompanies(),
        getRoles(),
        getProjects(),
      ]);
      setPersonnel(personnelData);
      setDepartments(deptData);
      setCompanies(companyData);
      setRoles(rolesData);
      setProjects(projectData);
      if (canViewPlatformGovernance) {
        const governanceResults = await Promise.allSettled([
          getTenants(),
          getAdminSuppliers(),
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
        ]);
        const [tenantResult, supplierResult, discoveryLabResult, discoveryLabSummaryResult, discoveryLabAuditResult, onboardingStudioResult] = governanceResults;
        setTenants(tenantResult.status === "fulfilled" ? tenantResult.value : []);
        setTenantGovernanceSuppliers(supplierResult.status === "fulfilled" ? supplierResult.value : []);
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
          setError(`Bazi platform verileri yuklenemedi: ${message}`);
        }
      }
      if (canAccessAdminWorkspace) {
        const [subscriptionData, publicPricingResponse, premiumFeatureResponse] = await Promise.all([
          getSubscriptionCatalog(),
          fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/admin/public-pricing-config`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
          }).then(async (response) => {
            if (!response.ok) return null;
            return response.json() as Promise<PublicPricingConfig>;
          }).catch(() => null),
          fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/onboarding/premium-features`).then(async (response) => {
            if (!response.ok) return [];
            return response.json() as Promise<Array<{ id: number; code: string; name: string; description?: string | null; monthly_price?: number | null }>>;
          }).catch(() => []),
        ]);
        setSubscriptionCatalog(subscriptionData);
        setPublicPricingConfig(publicPricingResponse);
        setPremiumFeatureCatalog(premiumFeatureResponse);
      }
      if (canViewPackagesTab) {
        const [billingData, commercialRequestData, subscriptionAddonData, webhookSettingsData, webhookDeliveryData] = await Promise.all([
          getBillingOverview(),
          getCommercialRequests(),
          getSubscriptionAddons(),
          getCommercialRequestWebhookSettings(),
          getCommercialRequestWebhookDeliveries(),
        ]);
        setBillingOverview(billingData);
        setCommercialRequests(commercialRequestData);
        setSubscriptionAddons(subscriptionAddonData);
        setSubscriptionAddonExpiryDrafts(Object.fromEntries(subscriptionAddonData.map((item: SubscriptionAddonAdminItem) => [item.id, item.expires_at ? String(item.expires_at).slice(0, 10) : ""])));
        setCommercialRequestWebhookSettings(webhookSettingsData);
        setCommercialRequestWebhookDraft({ webhook_url: webhookSettingsData.webhook_url || "", webhook_secret: "" });
        setCommercialRequestWebhookDeliveries(webhookDeliveryData);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [canAccessAdminWorkspace, canViewPackagesTab, canViewPlatformGovernance, discoveryLabAuditDecisionFilter, discoveryLabDateFrom, discoveryLabDateTo, discoveryLabProjectQuery, discoveryLabSearch, discoveryLabStatusFilter, discoveryLabUserQuery, isRoleManagementOnly, shouldLoadAdminWorkspaceData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const tenantFocusId = searchParams.get("tenantFocusId");
    const tenantFocusName = searchParams.get("tenantFocusName");
    const projectFocusName = searchParams.get("projectFocusName");
    const telemetrySnapshot = buildFocusTelemetryFilterSnapshot(searchParams);
    if (tab && tabConfigs.some((item) => item.key === tab)) {
      setActiveTab(tab as AdminTabKey);
    } else if (isRoleManagementOnly) {
      setActiveTab("roles");
    } else if (tabConfigs.some((item) => item.key === "panel_home")) {
      setActiveTab("panel_home");
    } else if (canViewPlatformGovernance) {
      setActiveTab("platform_overview");
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
    if (activeTab !== "platform_overview") {
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
    if (activeTab === "platform_overview" && replayChainTargetQuoteId != null) {
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
    if (activeTab !== "platform_overview") {
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
      reason: `Telemetry secimi bu bolumu hedefledi: ${getQuoteInsightSectionLabel(selectedFocusTelemetryTarget.section)}`,
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
            ? "Stratejik Partner super admin onayli olarak acildi. Ilk yoneticiye sifre belirleme e-postasi gonderildi."
            : "Stratejik Partner super admin onayli olarak acildi. Ilk yonetici icin sifre belirleme e-postasi gonderilememis olabilir."
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
        legalName: "Starter Musteri Ltd.",
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
      initial_admin_full_name: "Ilk Stratejik Partner Admin",
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
          full_name: "Ilk Stratejik Partner Admin",
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
        initial_admin_full_name: created.owner_full_name || "Ilk Stratejik Partner Admin",
        initial_admin_email: created.owner_email || `draft-${planCode}@procureflow.test`,
        initial_admin_personal_phone: "+90 555 000 00 00",
      });
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
      setTenantMessage("Gecerli bir Stratejik Partner yoneticisi secin.");
      return;
    }

    try {
      setTenantSaving(true);
      setTenantMessage(null);
      await updateTenant(tenant.id, { owner_user_id: ownerUserId });
      setTenantMessage("Stratejik Partner yoneticisi guncellendi.");
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
      <div style={{ padding: 20, color: "red" }}>
        Bu sayfaya erişim için yönetim yetkisi gerekir
      </div>
    );
  }

  // Handler fonksiyonlar yeni tab bileşenlerine taşındı

  if (loading) {
    return <div style={{ padding: 20 }}>Calisma alani yukleniyor...</div>;
  }

  return (
    <div style={{ padding: 20, display: "grid", gap: 20 }}>
      <section
        style={{
          borderRadius: 28,
          padding: "22px 28px 26px",
          color: "white",
          background: canViewPlatformGovernance
            ? "linear-gradient(135deg, #1d1f3f 0%, #2c4172 55%, #7ca7d8 100%)"
            : "linear-gradient(135deg, #16302b 0%, #294d45 55%, #d8b16a 100%)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", padding: "10px 12px", borderRadius: 18, background: "rgba(8, 20, 18, 0.16)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 12px 24px rgba(7, 18, 16, 0.12)", backdropFilter: "blur(6px)" }}>
            <PublicBrandLogo height={34} maxWidth={176} invert />
          </div>
        </div>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.2, textTransform: "uppercase", color: canViewPlatformGovernance ? "#dbeafe" : "#fef3c7", textAlign: "center" }}>
            {canViewPlatformGovernance ? "Platform Yonetim Alani" : "Stratejik Partner Yonetim Alani"}
          </div>
          <h1 style={{ margin: "10px 0 0", fontSize: 46, lineHeight: 1.02, textAlign: "center", fontWeight: 900 }}>
            {canViewPlatformGovernance ? "Platform Yonetim Paneli" : currentUserRoleLabel}
          </h1>
          <p style={{ margin: "12px auto 0", fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.86)", textAlign: "center", maxWidth: 720 }}>
            {canViewPlatformGovernance
              ? "Bu alan platform gozetimi, tenant yapilari ve ust seviye operasyon yonetimi icin kullanilir."
              : "Bu alan stratejik partner yapinizdaki personel, rol, departman ve satin alma operasyonlarini yonetmeniz icin hazirlandi."}
          </p>
        </div>
      </section>

      <section style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "white", padding: 18, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", gap: 16, alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Calisma Menusu</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>{renderTabIconBadge(currentTab.icon)}<span>{currentTab.label}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 4, borderBottom: "2px solid #e5e7eb", paddingBottom: 12, flexWrap: "wrap", justifyContent: "flex-start" }}>
        {tabConfigs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`admin-tab-${tab.key}`}
            onClick={() => {
              navigateAdminTab(tab.key);
            }}
            style={{
              padding: "10px 16px",
              background: activeTab === tab.key ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" : "#f8fafc",
              color: activeTab === tab.key ? "white" : "#334155",
              border: activeTab === tab.key ? "1px solid #2563eb" : "1px solid #dbe3ee",
              borderRadius: "999px",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? "bold" : "600",
              boxShadow: activeTab === tab.key ? "0 10px 22px rgba(37, 99, 235, 0.18)" : "0 4px 10px rgba(15, 23, 42, 0.05)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {renderTabIconBadge(tab.icon, activeTab === tab.key)}
              <span>{tab.label}</span>
            </span>
          </button>
        ))}
        </div>
      </section>

      {shouldLoadAdminWorkspaceData ? (
        <section style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "Firma", value: companies.length, note: `${tenants.filter((item) => item.is_active).length || totalActiveCompanies} aktif kayit`, color: "#2563eb" },
            { label: "Proje", value: projects.length, note: "Toplam proje sayisi", color: "#0f766e" },
            { label: "Teklif", value: currentTenantQuoteCount, note: "Gorunen teklif sayisi", color: "#7c3aed" },
            { label: "Personel", value: personnel.length, note: `${totalActivePersonnel} aktif personel`, color: "#dc2626" },
          ].map((item) => (
            <div key={item.label} style={{ borderRadius: 20, border: "1px solid #e5e7eb", background: "white", padding: 18, boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.2 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 32, fontWeight: 900, color: item.color }}>{item.value}</div>
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{item.note}</div>
            </div>
          ))}
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { label: "Panel Basligi", value: activeWorkspacePanelProfile?.title || "Rol Paneli", tone: "#2563eb" },
            { label: "Gorunen Sekme", value: String(tabConfigs.length), tone: "#0f766e" },
            { label: "Rol", value: getUserDisplayRoleLabel(user), tone: "#7c3aed" },
            { label: "Calisma Alani", value: activeWorkspacePanelProfile?.workspace_label || workspaceName, tone: "#dc2626" },
          ].map((item) => (
            <div key={item.label} style={{ borderRadius: 20, border: "1px solid #e5e7eb", background: "white", padding: 18, boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.2 }}>{item.label}</div>
              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: item.tone }}>{item.value}</div>
            </div>
          ))}
        </section>
      )}

      {activeTab === "platform_overview" && canViewPlatformGovernance && (
        <section style={{ display: "grid", gap: 16 }}>
          {(searchParams.get("tenantFocusName") || searchParams.get("projectFocusName") || searchParams.get("onboardingPlanFocus")) ? renderAdminFocusBanner({
            eyebrow: "Yonetici Odagi",
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
            timestamp: Date.now(),
            actions: [
              searchParams.get("tenantFocusName") ? { label: "Stratejik Partner Yonetimine Git", onClick: () => navigateAdminTab("tenant_governance", { tenantFocusId: searchParams.get("tenantFocusId") || "", tenantFocusName: searchParams.get("tenantFocusName") || "" }) } : undefined,
              searchParams.get("projectFocusName") ? { label: "Discovery Lab'a Git", onClick: () => navigateAdminTab("discovery_lab_operations", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
              searchParams.get("projectFocusName") ? { label: "Projects'e Git", onClick: () => navigateAdminTab("projects", { projectFocusName: searchParams.get("projectFocusName") || "" }) } : undefined,
              searchParams.get("onboardingPlanFocus") ? { label: "Onboarding'e Git", onClick: () => navigateAdminTab("onboarding_studio", { onboardingPlanFocus: searchParams.get("onboardingPlanFocus") || "" }) } : undefined,
              { label: "Odagi Temizle", onClick: () => navigateAdminTab("platform_overview") },
            ].filter(Boolean) as Array<{ label: string; onClick?: () => void; href?: string }>,
            testId: "admin-focus-banner-platform-overview",
          }) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { label: "Aktif Stratejik Partner / Firma", value: tenants.filter((item) => item.is_active).length || totalActiveCompanies, note: `${tenants.filter((item) => !item.is_active).length || totalPassiveCompanies} pasif kayit`, color: "#2563eb" },
              { label: "Aktif Kullanici", value: totalActivePersonnel, note: `${totalPassivePersonnel} pasif kayit`, color: "#059669" },
              { label: "Aktif Departman", value: totalActiveDepartments, note: `${departments.length} toplam departman`, color: "#b45309" },
              { label: "Aktif Rol", value: totalActiveRoles, note: `${roles.length} toplam rol`, color: "#7c3aed" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { label: "Onboarding Kuyrugu", value: platformOpsSummary.onboardingQueue.length, note: "Aktif olmayan onboarding durumundaki tenant", color: "#b45309" },
              { label: "Owner Aksiyonu", value: platformOpsSummary.ownerAttention.length, note: "Owner atamasi veya owner e-postasi eksik", color: "#dc2626" },
              { label: "Branding Eksigi", value: platformOpsSummary.brandingAttention.length, note: "Logo veya gorunen ad eksigi olan tenant", color: "#7c3aed" },
              { label: "Pasif Stratejik Partner", value: platformOpsSummary.pausedTenants.length, note: "Duraklatilmis veya pasif Stratejik Partner", color: "#475569" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { label: "Acik Destek Kaydi", value: platformOpsOverviewSummary.activeWork, note: "Yeni, islemde veya owner bekleyen support kayitlari", color: "#1d4ed8" },
              { label: "Owner Bekleyen Destek", value: platformOpsOverviewSummary.ownerWaiting, note: "Platform ekibinin owner geri donusu bekledigi kayitlar", color: "#7c3aed" },
              { label: "Kapanisi Tamamlanan", value: platformOpsOverviewSummary.resolvedWithReason, note: "Cozuldu durumuna alinip kapanis nedeni girilen kayitlar", color: "#15803d" },
              { label: "Temasi Geciken Kayit", value: platformOpsOverviewSummary.staleContact, note: "Uc gun ve uzeri temas edilmeyen aktif destek kayitlari", color: "#b45309" },
              { label: "Ownersiz Destek Kaydi", value: platformOpsOverviewSummary.unassignedOwner, note: "Aktif kayitlarda operasyon sahibi atanmamis Stratejik Partner sayisi", color: "#dc2626" },
              { label: "En Yogun Destek Owner", value: platformOpsOverviewSummary.busiestOwnerName, note: `${platformOpsOverviewSummary.busiestOwnerLoad} aktif kayit`, color: "#0f766e" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Odaklari</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner gecis panosu</div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {[
                  "Admin'i personelden ayiran system_role gecisi baslatildi.",
                  "Stratejik Partner omurgasi ve bootstrap scripti eklendi.",
                  "Navigation ve varsayilan yonlendirme system_role bazli calisiyor.",
                  "Siradaki is: Stratejik Partner yonetici yeniden atama ve daha derin yasam dongusu aksiyonlari.",
                ].map((item) => (
                  <div key={item} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#334155" }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Operasyon Kuyrugu</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Platform destek oncelikleri</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {platformOpsSummary.highestPriorityTenants.length === 0 ? (
                  <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
                    Acik operasyon kuyrugu olusturan Stratejik Partner kaydi bulunmuyor.
                  </div>
                ) : (
                  platformOpsSummary.highestPriorityTenants.map((tenant) => {
                    const tags = [
                      String(tenant.onboarding_status || "").toLowerCase() !== "active" ? `Kurulum: ${formatPartnerOnboardingStatus(tenant.onboarding_status)}` : null,
                      !tenant.owner_user_id || !tenant.owner_email ? "Owner eksigi" : null,
                      !tenant.logo_url || !tenant.brand_name ? "Branding eksigi" : null,
                      !tenant.is_active || String(tenant.status || "").toLowerCase() === "paused" ? `Durum: ${formatPartnerLifecycleStatus(tenant.status)}` : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "in_progress" ? "Destek: Islemde" : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "waiting_owner" ? "Destek: Owner bekleniyor" : null,
                      (platformOpsStatuses[tenant.id] || tenant.support_status || "new") === "resolved" ? "Destek: Cozuldu" : null,
                    ].filter(Boolean);

                    return (
                      <div key={`ops-${tenant.id}`} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                          <span style={{ color: "#64748b", fontSize: 12 }}>{tenant.slug}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {tags.map((tag) => (
                            <span key={`${tenant.id}-${tag}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e2e8f0", color: "#334155", fontSize: 11, fontWeight: 700 }}>
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

            <div ref={focusTelemetryPanelRef} style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Yonetici Odak Telemetrisi</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Paylasilan focus olay listesi</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Platform genel bakis, filtre odaklari ve geri yukleme davranislari tek listede toplanir.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {focusTelemetryExportMeta.headerLines.map((line) => (
                  <span key={line} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>
                    {line}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 220 }}>
                  Preset Adi
                  <input aria-label="Telemetry Preset Adi" value={focusTelemetryPresetName} onChange={(event) => setFocusTelemetryPresetName(event.target.value)} placeholder="ornek: Merkez Replay" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }} />
                </label>
                <button type="button" onClick={saveFocusTelemetryPreset} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  Preset Kaydet
                </button>
                <button type="button" onClick={exportFocusTelemetryPresetPackage} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "white", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  Preset Paketi Hazirla
                </button>
                <button type="button" onClick={importFocusTelemetryPresetPackage} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #c7d2fe", background: "white", color: "#4338ca", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  Preset Paketini Ice Aktar
                </button>
                {focusTelemetryPresets.map((preset) => (
                  <div key={preset.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {focusTelemetryEditingPresetId === preset.id ? (
                      <>
                        <input aria-label={`Preset Yeniden Adlandir ${preset.name}`} value={focusTelemetryPresetDraftName} onChange={(event) => setFocusTelemetryPresetDraftName(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", minWidth: 180 }} />
                        <button type="button" onClick={() => commitFocusTelemetryPresetRename(preset.id)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #bfdbfe", background: "white", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                          Kaydet
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => applyFocusTelemetryPreset(preset.id)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #dbe3ee", background: "#f8fafc", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                        Preset: {preset.name}
                      </button>
                    )}
                    <button type="button" onClick={() => startFocusTelemetryPresetRename(preset.id)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #fde68a", background: "white", color: "#b45309", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                      Yeniden Adlandir
                    </button>
                    <button type="button" onClick={() => deleteFocusTelemetryPreset(preset.id)} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #fecaca", background: "white", color: "#b91c1c", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                      Preseti Sil
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 180 }}>
                  Kaynak Filtresi
                  <select aria-label="Telemetry Kaynak Filtresi" value={focusTelemetrySourceFilter} onChange={(event) => setFocusTelemetrySourceFilter(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}>
                    <option value="all">Tum Kaynaklar</option>
                    <option value="platform-overview">Platform Genel Bakisi</option>
                    <option value="tenant-governance">Stratejik Partner Yonetimi</option>
                    <option value="platform-operations">Platform Operasyonlari</option>
                    <option value="packages">Paketler</option>
                    <option value="discovery-lab">Discovery Lab</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 160 }}>
                  Zaman Penceresi
                  <select aria-label="Telemetry Zaman Filtresi" value={focusTelemetryWindowFilter} onChange={(event) => setFocusTelemetryWindowFilter(event.target.value as "all" | "15m")} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}>
                    <option value="all">Tum Zaman</option>
                    <option value="15m">Son 15 Dakika</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 220 }}>
                  Telemetry Arama
                  <input aria-label="Telemetry Arama" value={focusTelemetrySearchQuery} onChange={(event) => setFocusTelemetrySearchQuery(event.target.value)} placeholder="platform, restore, RFQ ara" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }} />
                </label>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                Preset Paketi JSON
                <textarea aria-label="Telemetry Preset Paketi" value={focusTelemetryPresetPackageText} onChange={(event) => setFocusTelemetryPresetPackageText(event.target.value)} placeholder="Preset paketi JSON burada hazirlanir veya ice aktarim icin yapistirilir" style={{ minHeight: 110, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
              </label>
              <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: previewFocusTelemetryPresetPackage.isValid ? "#f8fafc" : "#fff7ed", padding: 12, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>On Ayar Paketi Onizlemesi</div>
                {previewFocusTelemetryPresetPackage.previewPresetNames.length > 1 ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#475569", fontSize: 11, fontWeight: 800 }}>Referans on ayar secimi</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {previewFocusTelemetryPresetPackage.previewPresetNames.map((name) => (
                        <button key={name} type="button" onClick={() => setFocusTelemetryPreviewPresetName(name)} style={{ padding: "4px 8px", borderRadius: 999, border: focusTelemetryPreviewPresetName === name || (!focusTelemetryPreviewPresetName && previewFocusTelemetryPresetPackage.previewPresetNames[0] === name) ? "1px solid #93c5fd" : "1px solid #dbe3ee", background: focusTelemetryPreviewPresetName === name || (!focusTelemetryPreviewPresetName && previewFocusTelemetryPresetPackage.previewPresetNames[0] === name) ? "#eff6ff" : "white", color: focusTelemetryPreviewPresetName === name || (!focusTelemetryPreviewPresetName && previewFocusTelemetryPresetPackage.previewPresetNames[0] === name) ? "#1d4ed8" : "#475569", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "white", padding: "8px 10px", color: "#334155", fontSize: 11, fontWeight: 700 }}>
                  {previewFocusTelemetryPresetPackage.activeFilterSummary}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Versiyon: {previewFocusTelemetryPresetPackage.versionLabel}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Disa Aktarim Zamani: {previewFocusTelemetryPresetPackage.exportedAtLabel}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Calisma Alani: {previewFocusTelemetryPresetPackage.sourceWorkspaceLabel}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Operator: {previewFocusTelemetryPresetPackage.operatorLabel}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Ozet Kodu: {previewFocusTelemetryPresetPackage.presetHash}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Kayit: {previewFocusTelemetryPresetPackage.acceptedCount}/{previewFocusTelemetryPresetPackage.presetCount}</span>
                  <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontSize: 11, fontWeight: 700 }}>Cakisma: {previewFocusTelemetryPresetPackage.conflictCount}</span>
                </div>
                <div style={{ color: previewFocusTelemetryPresetPackage.isValid ? "#166534" : "#9a3412", fontSize: 12, fontWeight: 700 }}>{previewFocusTelemetryPresetPackage.summary}</div>
                {previewFocusTelemetryPresetPackage.newPresetNames.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#166534", fontSize: 11, fontWeight: 800 }}>Yeni eklenecek presetler</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {previewFocusTelemetryPresetPackage.newPresetNames.map((name) => (
                        <span key={name} style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", fontSize: 11, fontWeight: 700 }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.overrideNames.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#7c2d12", fontSize: 11, fontWeight: 800 }}>Gecersiz kilinacak on ayarlar</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {previewFocusTelemetryPresetPackage.overrideNames.map((name) => (
                        <span key={name} style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", fontSize: 11, fontWeight: 700 }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.filterDiffLines.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ color: "#334155", fontSize: 11, fontWeight: 800 }}>Filtre farklari</div>
                    {previewFocusTelemetryPresetPackage.groupedDiffs.map((group) => (
                      <div key={`${group.kind}-${group.presetName}`} style={{ borderRadius: 10, border: previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName ? "2px solid #0ea5e9" : group.kind === "new" ? "1px solid #bbf7d0" : "1px solid #fed7aa", background: previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName ? "#ecfeff" : group.kind === "new" ? "#f0fdf4" : "#fff7ed", padding: "8px 10px", display: "grid", gap: 4 }}>
                        <div style={{ color: previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName ? "#0369a1" : group.kind === "new" ? "#166534" : "#9a3412", fontSize: 11, fontWeight: 800 }}>
                          {group.presetName} • {group.kind === "new" ? "Yeni kayit" : "Override"}
                          {previewFocusTelemetryPresetPackage.selectedReferencePresetName === group.presetName ? " • Secili referans" : ""}
                        </div>
                        {group.lines.map((line) => (
                          <div key={`${group.presetName}-${line}`} style={{ color: "#475569", fontSize: 11 }}>{line}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {previewFocusTelemetryPresetPackage.warnings.length ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    {previewFocusTelemetryPresetPackage.warnings.map((warning) => (
                      <div key={warning} style={{ color: "#9a3412", fontSize: 11 }}>{warning}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Telemetri Eylem Tarihcesi</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { key: "all", label: "Tum" },
                      { key: "export", label: "Export" },
                      { key: "preset", label: "Preset" },
                      { key: "navigation", label: "Navigation" },
                    ].map((item) => (
                      <button key={item.key} type="button" onClick={() => setFocusTelemetryActionHistoryFilter(item.key as "all" | "export" | "preset" | "navigation")} style={{ padding: "5px 9px", borderRadius: 999, border: focusTelemetryActionHistoryFilter === item.key ? "1px solid #93c5fd" : "1px solid #dbe3ee", background: focusTelemetryActionHistoryFilter === item.key ? "#eff6ff" : "white", color: focusTelemetryActionHistoryFilter === item.key ? "#1d4ed8" : "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569", fontWeight: 700, minWidth: 160 }}>
                    Zaman Penceresi
                    <select aria-label="Aksiyon Tarihcesi Zaman Penceresi" value={focusTelemetryActionHistoryWindow} onChange={(event) => setFocusTelemetryActionHistoryWindow(event.target.value as FocusTelemetryActionHistoryWindow)} style={{ padding: "7px 9px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}>
                      <option value="all">Tum Zaman</option>
                      <option value="30m">Son 30 Dakika</option>
                      <option value="24h">Son 24 Saat</option>
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#475569", fontWeight: 700, minWidth: 220 }}>
                    Aksiyon Arama
                    <input aria-label="Aksiyon Tarihcesi Arama" value={focusTelemetryActionHistorySearch} onChange={(event) => setFocusTelemetryActionHistorySearch(event.target.value)} placeholder="preset, export, navigation ara" style={{ padding: "7px 9px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }} />
                  </label>
                </div>
                {filteredFocusTelemetryActionHistory.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 12 }}>Bu filtre icin kayitli operator aksiyonu yok.</div>
                ) : filteredFocusTelemetryActionHistory.map((item) => (
                  <div key={item.id} style={{ display: "grid", gap: 3, borderRadius: 10, border: "1px solid #e2e8f0", background: "white", padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: item.tone === "error" ? "#b91c1c" : "#166534", fontSize: 11, fontWeight: 800 }}>{item.scope}</span>
                      <span style={{ color: "#64748b", fontSize: 11 }}>{formatAdminFocusTimestamp(item.createdAt)}</span>
                    </div>
                    <div style={{ color: "#334155", fontSize: 12 }}>{item.message}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {filteredFocusTelemetryEvents.length === 0 ? (
                  <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "12px 14px", color: "#64748b" }}>
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
                  }} style={{ borderRadius: 14, background: focusTelemetrySelectedEventId === event.id ? "#eff6ff" : replayChainTargetQuoteId != null && event.targetQuoteId === replayChainTargetQuoteId ? "#fff7ed" : focusTelemetryReturnedEventId === event.id ? "#ecfeff" : "#f8fafc", border: focusTelemetrySelectedEventId === event.id ? "1px solid #93c5fd" : replayChainTargetQuoteId != null && event.targetQuoteId === replayChainTargetQuoteId ? "1px solid #fdba74" : focusTelemetryReturnedEventId === event.id ? "1px solid #5eead4" : "1px solid #e2e8f0", padding: "10px 12px", display: "grid", gap: 4, boxShadow: focusTelemetryReturnedEventId === event.id ? "0 0 0 5px rgba(20, 184, 166, 0.14)" : selectedFocusTelemetryTarget?.quoteId != null && event.targetQuoteId === selectedFocusTelemetryTarget.quoteId ? "0 0 0 4px rgba(59, 130, 246, 0.08)" : "none", transform: focusTelemetryReturnedEventId === event.id ? "scale(1.01)" : "scale(1)", transition: "transform 220ms ease, box-shadow 180ms ease, background 180ms ease, border 180ms ease" }}>
                    {focusTelemetryReturnedEventId === event.id ? (
                      <div style={{ display: "grid", gap: 4, width: "fit-content" }}>
                        <div style={{ display: "inline-flex", width: "fit-content", padding: "4px 8px", borderRadius: 999, background: "#ccfbf1", color: "#0f766e", fontSize: 11, fontWeight: 800 }}>
                          {isFocusTelemetryReturnPaused ? "Geri donus hedefi • fade-out duraklatildi" : "Geri donus hedefi • fade-out aktif"}
                        </div>
                        <div style={{ color: "#0f766e", fontSize: 10, fontWeight: 700 }}>
                          Kalan sure: {(focusTelemetryReturnedEventRemainingMs / 1000).toFixed(1)} sn
                        </div>
                        <div style={{ width: 120, height: 4, borderRadius: 999, background: "#99f6e4", overflow: "hidden" }}>
                          <div data-testid={`telemetry-return-progress-${event.id}`} style={{ width: `${focusTelemetryReturnedEventProgress}%`, height: "100%", borderRadius: 999, background: "#14b8a6", opacity: Math.max(0.2, focusTelemetryReturnedEventProgress / 100), transition: "width 100ms linear, opacity 100ms linear" }} />
                        </div>
                      </div>
                    ) : null}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 12 }}>{event.label}</div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>{formatAdminFocusTimestamp(event.createdAt)}</div>
                    </div>
                    <div style={{ color: "#475569", fontSize: 12 }}>{event.detail}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ color: "#64748b", fontSize: 11 }}>Kaynak: {event.source}</span>
                      {event.targetSection ? (
                        <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: event.targetSection === "status-history" ? "#dbeafe" : "#ede9fe", color: event.targetSection === "status-history" ? "#1d4ed8" : "#6d28d9", fontSize: 11, fontWeight: 800 }}>
                          Hedef: {getQuoteInsightSectionLabel(event.targetSection)}
                        </span>
                      ) : null}
                    </div>
                    {event.targetQuoteId != null ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => setFocusTelemetrySelectedEventId(event.id)} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #93c5fd", background: "white", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>
                          Event'i Sec
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, event.targetSection || "full-audit-trail")} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #fdba74", background: "white", color: "#c2410c", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>
                          RFQ #{event.targetQuoteId} Kartina Git
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, "status-history")} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #bfdbfe", background: "white", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>
                          Durum gecmisi ac
                        </button>
                        <button type="button" onClick={() => void openReplayTelemetryTarget(event.targetQuoteId!, "full-audit-trail")} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #ddd6fe", background: "white", color: "#6d28d9", fontWeight: 800, cursor: "pointer", fontSize: 11 }}>
                          Denetim izi ac
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {selectedFocusTelemetryTarget ? (
                <div ref={focusTelemetryEventActionsRef} style={{ borderRadius: 16, border: "1px solid #bfdbfe", background: "#eff6ff", padding: 14, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#1d4ed8" }}>Telemetri Hizli Eylemleri</div>
                  <div style={{ color: "#1e3a8a", fontSize: 13, fontWeight: 700 }}>{selectedFocusTelemetryTarget.label}</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>{selectedFocusTelemetryTarget.detail}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, "status-history")} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #93c5fd", background: "white", color: "#1d4ed8", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                      Hizli Eylem • Durum gecmisi
                    </button>
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, "full-audit-trail")} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #c4b5fd", background: "white", color: "#6d28d9", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                      Hizli Eylem • Denetim izi
                    </button>
                    <button type="button" onClick={() => void openReplayTelemetryTarget(selectedFocusTelemetryTarget.quoteId, selectedFocusTelemetryTarget.section)} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #fdba74", background: "white", color: "#c2410c", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                      Hizli Eylem • Discovery Lab satirina git
                    </button>
                  </div>
                </div>
              ) : null}
              {focusTelemetryActionStatus ? (
                <div aria-live="polite" style={{ borderRadius: 12, border: focusTelemetryActionStatus.tone === "error" ? "1px solid #fecaca" : "1px solid #bbf7d0", background: focusTelemetryActionStatus.tone === "error" ? "#fef2f2" : "#f0fdf4", color: focusTelemetryActionStatus.tone === "error" ? "#b91c1c" : "#166534", padding: "10px 12px", fontSize: 12, fontWeight: 800 }}>
                  {focusTelemetryActionStatus.message}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={exportFocusTelemetry} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  Telemetry Export Hazirla
                </button>
                <button type="button" onClick={exportFocusTelemetryCsv} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  CSV Ozet Hazirla
                </button>
                <button type="button" onClick={() => {
                  void copyFocusTelemetryText(focusTelemetryExport)
                    .then(() => announceFocusTelemetryAction("JSON export panoya kopyalandi", "success", "export"))
                    .catch(() => announceFocusTelemetryAction("JSON export panoya kopyalanamadi", "error", "export"));
                }} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  JSON Kopyala
                </button>
                <button type="button" onClick={() => {
                  try {
                    downloadFocusTelemetryText(focusTelemetryExport, focusTelemetryExportMeta.jsonFilename, "application/json");
                    announceFocusTelemetryAction(`JSON export indirildi: ${focusTelemetryExportMeta.jsonFilename}`, "success", "export");
                  } catch {
                    announceFocusTelemetryAction("JSON export indirilemedi", "error", "export");
                  }
                }} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  JSON Indir ({focusTelemetryExportMeta.jsonFilename})
                </button>
                <button type="button" onClick={() => {
                  void copyFocusTelemetryText(focusTelemetryCsvExport)
                    .then(() => announceFocusTelemetryAction("CSV export panoya kopyalandi", "success", "export"))
                    .catch(() => announceFocusTelemetryAction("CSV export panoya kopyalanamadi", "error", "export"));
                }} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  CSV Kopyala
                </button>
                <button type="button" onClick={() => {
                  try {
                    downloadFocusTelemetryText(focusTelemetryCsvExport, focusTelemetryExportMeta.csvFilename, "text/csv");
                    announceFocusTelemetryAction(`CSV export indirildi: ${focusTelemetryExportMeta.csvFilename}`, "success", "export");
                  } catch {
                    announceFocusTelemetryAction("CSV export indirilemedi", "error", "export");
                  }
                }} style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                  CSV Indir ({focusTelemetryExportMeta.csvFilename})
                </button>
              </div>
              {focusTelemetryExport ? (
                <textarea readOnly aria-label="Focus Telemetry Export" value={focusTelemetryExport} style={{ minHeight: 140, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
              ) : null}
              {focusTelemetryCsvExport ? (
                <textarea readOnly aria-label="Focus Telemetry CSV Export" value={focusTelemetryCsvExport} style={{ minHeight: 120, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
              ) : null}
            </div>
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#0f766e" }}>Discovery Lab Izleme</div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Son teknik aktarim oturumlari</div>
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>Canli upload, karar ve teknik kilit adimlari</div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "all", label: "Tum Durumlar" },
                  { key: "analyzed", label: "Analiz Edildi" },
                  { key: "technical_locked", label: "Teknik Kilit" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDiscoveryLabStatusFilter(item.key as "all" | "analyzed" | "technical_locked")}
                    style={{ padding: "8px 12px", borderRadius: 999, border: discoveryLabStatusFilter === item.key ? "1px solid #0f766e" : "1px solid #dbe3ee", background: discoveryLabStatusFilter === item.key ? "#ecfdf5" : "white", color: discoveryLabStatusFilter === item.key ? "#0f766e" : "#475569", fontWeight: 700, cursor: "pointer" }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 180 }}>
                Proje Filtresi
                <input
                  aria-label="Discovery Lab Proje Filtresi"
                  value={discoveryLabProjectQuery}
                  onChange={(event) => setDiscoveryLabProjectQuery(event.target.value)}
                  placeholder="Proje ara"
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 200 }}>
                Kullanici Filtresi
                <input
                  aria-label="Discovery Lab Kullanici Filtresi"
                  value={discoveryLabUserQuery}
                  onChange={(event) => setDiscoveryLabUserQuery(event.target.value)}
                  placeholder="Olusturan veya onaylayan"
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 150 }}>
                Baslangic Tarihi
                <input
                  aria-label="Discovery Lab Baslangic Tarihi"
                  type="date"
                  value={discoveryLabDateFrom}
                  onChange={(event) => setDiscoveryLabDateFrom(event.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 150 }}>
                Bitis Tarihi
                <input
                  aria-label="Discovery Lab Bitis Tarihi"
                  type="date"
                  value={discoveryLabDateTo}
                  onChange={(event) => setDiscoveryLabDateTo(event.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: 'Bugun', from: getIsoDateOffset(0), to: getIsoDateOffset(0) },
                  { label: 'Son 7 Gun', from: getIsoDateOffset(-6), to: getIsoDateOffset(0) },
                  { label: 'Son 30 Gun', from: getIsoDateOffset(-29), to: getIsoDateOffset(0) },
                  { label: 'Temizle', from: '', to: '' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setDiscoveryLabDateFrom(preset.from);
                      setDiscoveryLabDateTo(preset.to);
                    }}
                    style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #dbe3ee', background: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 220 }}>
                Kayit Arama
                <input
                  aria-label="Discovery Lab Kayit Arama"
                  value={discoveryLabSearch}
                  onChange={(event) => setDiscoveryLabSearch(event.target.value)}
                  placeholder="Dosya, e-posta veya session ara"
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                />
              </label>
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { label: "Filtrelenen Oturum", value: discoveryLabSummary.total_sessions, note: "Secili filtre sonucunda listelenen kayit", color: "#0f766e" },
                { label: "Teknik Kilit", value: discoveryLabSummary.locked_sessions, note: "Aktarima gecen oturum", color: "#166534" },
                { label: "RFQ Hazir", value: discoveryLabSummary.quote_ready_sessions, note: "Teklif kaydi baglanan oturum", color: "#1d4ed8" },
                { label: "Aktif Proje", value: discoveryLabSummary.active_project_count, note: "Gorunen proje kapsami", color: "#7c3aed" },
                { label: "Yanit Audit", value: discoveryLabSummary.answer_audit_count, note: "Kayit altina alinan kullanici cevabi", color: "#0f766e" },
              ].map((card) => (
                <div key={card.label} style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14, display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{card.note}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {discoveryLabSessions.length === 0 ? (
                <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
                  Henuz izlenecek Discovery Lab oturumu bulunmuyor.
                </div>
              ) : (
                discoveryLabSessions.map((session) => (
                  <div key={session.session_id} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{session.source_filename || session.session_id}</div>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: session.status === "technical_locked" ? "#dcfce7" : "#dbeafe", color: session.status === "technical_locked" ? "#166534" : "#1d4ed8", fontSize: 11, fontWeight: 700 }}>
                        {session.status}
                      </span>
                    </div>
                    <div style={{ color: "#334155", fontSize: 13 }}>
                      {session.latest_event_title} · {session.latest_actor || "Discovery Lab"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                      <span>Proje: {session.project_name || "Secim bekliyor"}</span>
                      <span>Teklif: {session.quote_id || "Olusmadi"}</span>
                      <span>Olusturan: {session.created_by_email || "Bilinmiyor"}</span>
                      <span>Onaylayan: {session.confirmed_by_email || "Beklemede"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Session: {session.session_id}</div>
                      <button
                        type="button"
                        onClick={() => setExpandedDiscoverySessionId((current) => current === session.session_id ? null : session.session_id)}
                        style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                      >
                        {expandedDiscoverySessionId === session.session_id ? "Detayi Gizle" : "Detayi Goster"}
                      </button>
                    </div>
                    {expandedDiscoverySessionId === session.session_id && (
                      <div style={{ borderRadius: 12, border: "1px solid #dbeafe", background: "#f8fbff", padding: "10px 12px", display: "grid", gap: 6, color: "#334155", fontSize: 12 }}>
                        <span>Son olay: {session.latest_event_title}</span>
                        <span>Aktor: {session.latest_actor || "Discovery Lab"}</span>
                        <span>Guncellenme: {String(session.updated_at || "")}</span>
                        <span>Proje No: {session.project_id || "-"}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Son Kullanici Yanitlari</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "all", label: "Tum Kararlar" },
                    { key: "needs_review", label: "Inceleme" },
                    { key: "approved", label: "Onay" },
                    { key: "ignored", label: "Pas" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setDiscoveryLabAuditDecisionFilter(item.key as "all" | "approved" | "ignored" | "needs_review")}
                      style={{ padding: "6px 10px", borderRadius: 999, border: discoveryLabAuditDecisionFilter === item.key ? "1px solid #0369a1" : "1px solid #dbe3ee", background: discoveryLabAuditDecisionFilter === item.key ? "#e0f2fe" : "white", color: discoveryLabAuditDecisionFilter === item.key ? "#0369a1" : "#475569", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {discoveryLabAnswerAudits.length === 0 ? (
                <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
                  Filtreye uyan kullanici yaniti kaydi bulunmuyor.
                </div>
              ) : (
                discoveryLabAnswerAudits.slice(0, 5).map((audit) => (
                  <div key={`audit-${audit.id}`} style={{ borderRadius: 14, background: "#f8fbff", border: "1px solid #dbeafe", padding: "12px 14px", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{audit.question_text || `Soru ${audit.question_id}`}</div>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontSize: 11, fontWeight: 700 }}>
                        {audit.decision || "answered"}
                      </span>
                    </div>
                    <div style={{ color: "#334155", fontSize: 13 }}>{audit.answer_text}</div>
                    {audit.rationale ? <div style={{ color: "#64748b", fontSize: 12 }}>Gerekce: {audit.rationale}</div> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                      <span>Session: {audit.session_id || "-"}</span>
                      <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                      <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                      <span>Dosya: {audit.source_filename || "-"}</span>
                      <span>Aktor: {audit.created_by_email || "Bilinmiyor"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedDiscoveryAuditId((current) => current === audit.id ? null : audit.id)}
                        style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                      >
                        {expandedDiscoveryAuditId === audit.id ? "Detayi Gizle" : "Detayi Goster"}
                      </button>
                    </div>
                    {expandedDiscoveryAuditId === audit.id && (
                      <div style={{ borderRadius: 12, border: "1px solid #dbeafe", background: "white", padding: "10px 12px", display: "grid", gap: 6, color: "#334155", fontSize: 12 }}>
                        <span>Question ID: {audit.question_id}</span>
                        <span>Session: {audit.session_id || "-"}</span>
                        <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                        <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                        <span>Quote/RFQ: {audit.quote_id || "-"}</span>
                        <span>Karar: {audit.decision || "answered"}</span>
                        <span>Kayit Zamanı: {String(audit.created_at || "")}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "discovery_lab_operations" && canViewPlatformGovernance && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#0f766e" }}>Discovery Lab Operasyon Masasi</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Answer audit ve RFQ baglanti merkezi</div>
            <div style={{ color: "#64748b" }}>Stratejik Partner, proje, kullanici ve karar kirilimi ile Discovery Lab cevaplarini ve olusan RFQ baglantilarini izleyin.</div>
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
                style={{
                  borderRadius: 16,
                  border: restoredQuoteInsight.section === "status-history" ? "1px solid #93c5fd" : "1px solid #c4b5fd",
                  background: restoredQuoteInsight.section === "status-history" ? "#eff6ff" : "#f5f3ff",
                  color: restoredQuoteInsight.section === "status-history" ? "#1d4ed8" : "#6d28d9",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase" }}>Geri Donus Restore</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>RFQ #{restoredQuoteInsight.quoteId} icinde {getQuoteInsightSectionLabel(restoredQuoteInsight.section)} odagi geri yuklendi.</div>
                  <div style={{ marginTop: 2, width: "100%", maxWidth: 260, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.6)", overflow: "hidden" }}>
                    <div data-testid="restored-quote-toast-progress" style={{ width: `${restoredQuoteToastProgress}%`, height: "100%", borderRadius: 999, background: "currentColor", transition: "width 100ms linear" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={jumpToRestoredQuoteCard}
                    style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid currentColor", background: "white", color: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                  >
                    RFQ #{restoredQuoteInsight.quoteId} Odagina Git
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRestoredQuoteToast(false)}
                    style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid transparent", background: "rgba(255,255,255,0.6)", color: "inherit", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                  >
                    Bildirimi Kapat
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "Toplam Audit", value: discoveryLabSummary.answer_audit_count, note: "Kayit altina alinan tum cevaplar", color: "#0369a1" },
              { label: "RFQ Bagli Audit", value: discoveryLabAnswerAudits.filter((item) => item.quote_id).length, note: "Quote/RFQ ile caprazlanan cevaplar", color: "#1d4ed8" },
              { label: "Stratejik Partner Bagli Audit", value: discoveryLabAnswerAudits.filter((item) => item.tenant_id).length, note: "Stratejik Partner baglamina cozulmus kayitlar", color: "#0f766e" },
              { label: "Inceleme Bekleyen", value: discoveryLabAnswerAudits.filter((item) => item.decision === "needs_review").length, note: "Operasyonel geri donus gerektiren cevaplar", color: "#b45309" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
              </div>
            ))}
          </div>

          {restoredQuoteDebugEvents.length && !isRestoredQuoteDebugTimelineHidden ? (
            <div style={{ borderRadius: 20, background: "#fff", border: "1px solid #e5e7eb", padding: 18, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Geri Yukleme Zaman Cizelgesi</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "all", label: "Tum Event" },
                    { key: "restore", label: "Restore" },
                    { key: "action", label: "Aksiyon" },
                    { key: "lifecycle", label: "Yasam Dongusu" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      data-testid={`restore-debug-filter-${filter.key}`}
                      onClick={() => setRestoredQuoteDebugFilter(filter.key as "all" | RestoreDebugEventType)}
                      style={{ padding: "6px 10px", borderRadius: 999, border: restoredQuoteDebugFilter === filter.key ? "1px solid #6d28d9" : "1px solid #dbe3ee", background: restoredQuoteDebugFilter === filter.key ? "#f5f3ff" : "white", color: restoredQuoteDebugFilter === filter.key ? "#6d28d9" : "#475569", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#475569", fontSize: 12, fontWeight: 700 }}>
                  Timeline arama
                  <input
                    aria-label="Restore Timeline Arama"
                    value={restoredQuoteDebugSearchQuery}
                    onChange={(event) => setRestoredQuoteDebugSearchQuery(event.target.value)}
                    placeholder="RFQ, replay veya toast ara"
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #dbe3ee", background: "white", color: "#334155", minWidth: 220 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "all", label: "Tum Zincir" },
                    { key: "last-replay-chain", label: "Son Replay Zinciri" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      data-testid={`restore-debug-replay-filter-${filter.key}`}
                      onClick={() => setRestoredQuoteDebugReplayFilter(filter.key as "all" | "last-replay-chain")}
                      style={{ padding: "6px 10px", borderRadius: 999, border: restoredQuoteDebugReplayFilter === filter.key ? "1px solid #0f766e" : "1px solid #dbe3ee", background: restoredQuoteDebugReplayFilter === filter.key ? "#ecfeff" : "white", color: restoredQuoteDebugReplayFilter === filter.key ? "#0f766e" : "#475569", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {filteredRestoredQuoteDebugEvents.map((event, index) => (
                  <div key={`${event.id}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderRadius: 12, background: "#f8fafc", border: `1px solid ${getRestoreDebugEventMeta(event.type).border}`, padding: "10px 12px" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: getRestoreDebugEventMeta(event.type).background, color: getRestoreDebugEventMeta(event.type).accent, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>
                          {getRestoreDebugEventMeta(event.type).label}
                        </span>
                        <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 999, background: getRestoreDebugEventMeta(event.type).severityBackground, color: getRestoreDebugEventMeta(event.type).severityColor, fontSize: 10, fontWeight: 800 }}>
                          {getRestoreDebugEventMeta(event.type).severityLabel}
                        </span>
                        <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 800 }}>{event.label}</span>
                      </div>
                      <span style={{ color: "#64748b", fontSize: 11 }}>{formatAdminFocusTimestamp(event.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: "#475569", fontSize: 12 }}>{event.detail}</span>
                      <button
                        type="button"
                        data-testid={`restore-debug-remove-${index}`}
                        onClick={() => removeRestoredQuoteDebugEvent(event.id)}
                        style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                      >
                        Satiri Sil
                      </button>
                    </div>
                  </div>
                ))}
                {filteredRestoredQuoteDebugEvents.length === 0 ? (
                  <div style={{ borderRadius: 12, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "10px 12px", color: "#64748b", fontSize: 12 }}>
                    Secili filtre icin debug olayi bulunmuyor.
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Son restore akisini secilen bolume gore yeniden tetikleyin.</div>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#475569", fontSize: 12, fontWeight: 700 }}>
                    Replay hedefi
                    <select
                      aria-label="Restore Replay Hedefi"
                      value={restoredQuoteReplayTarget}
                      onChange={(event) => setRestoredQuoteReplayTarget(event.target.value as "status-history" | "full-audit-trail")}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #dbe3ee", background: "white", color: "#334155" }}
                    >
                      <option value="status-history">Durum gecmisi</option>
                      <option value="full-audit-trail">Denetim izi</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={clearRestoredQuoteDebugEvents}
                    style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                  >
                    Timeline Temizle
                  </button>
                  <button
                    type="button"
                    onClick={replayRestoredQuoteInsight}
                    style={{ padding: "7px 11px", borderRadius: 999, border: "1px solid #c4b5fd", background: "#f5f3ff", color: "#6d28d9", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                  >
                    Geri Yukleme Tekrari • {getQuoteInsightSectionLabel(restoredQuoteReplayTarget)}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#0f766e" }}>Filtrelenmis Audit Kayitlari</div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner ve RFQ bagli detay listesi</div>
                {restoredQuoteInsight ? renderAdminFocusBanner({
                  eyebrow: "Admin Focus",
                  title: `Admin geri donus odagi: RFQ ${getQuoteInsightSectionLabel(restoredQuoteInsight.section)}`,
                  detail: `Geri donus odagi gecici olarak listenin ustune tasindi: RFQ #${restoredQuoteInsight.quoteId} • replay hedefi ${getQuoteInsightSectionLabel(restoredQuoteReplayTarget)}`,
                  tone: restoredQuoteInsight.section === "status-history" ? "blue" : "violet",
                  sourceLabel: "Quote return",
                  timestamp: filteredRestoredQuoteDebugEvents[0]?.createdAt || Date.now(),
                  actions: [
                    { label: `RFQ #${restoredQuoteInsight.quoteId} odagina git`, onClick: jumpToRestoredQuoteCard },
                    { label: "Odagi Temizle", onClick: clearRestoredQuoteInsight },
                  ],
                  testId: "admin-focus-banner-rfq",
                }) : null}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>{sortedDiscoveryLabAnswerAudits.length} kayit yuklendi</div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {discoveryLabAnswerAudits.length === 0 ? (
                <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
                  Filtreye uyan Discovery Lab yanit denetimi kaydi bulunmuyor.
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
                    style={{
                      borderRadius: 14,
                      background: restoredQuoteInsight?.quoteId === audit.quote_id ? "#fefefe" : selectedFocusTelemetryTarget?.quoteId === audit.quote_id ? "#eff6ff" : replayChainTargetQuoteId === audit.quote_id ? "#fff7ed" : "#f8fbff",
                      border: restoredQuoteInsight?.quoteId === audit.quote_id
                        ? (restoredQuoteInsight?.section === "status-history" ? "1px solid #93c5fd" : "1px solid #c4b5fd")
                        : selectedFocusTelemetryTarget?.quoteId === audit.quote_id
                          ? "1px solid #93c5fd"
                        : replayChainTargetQuoteId === audit.quote_id
                          ? "1px solid #fdba74"
                          : "1px solid #dbeafe",
                      padding: "14px 16px",
                      display: "grid",
                      gap: 8,
                      boxShadow: restoredQuoteInsight?.quoteId === audit.quote_id ? "0 0 0 4px rgba(59, 130, 246, 0.08)" : selectedFocusTelemetryTarget?.quoteId === audit.quote_id ? "0 0 0 4px rgba(59, 130, 246, 0.08)" : replayChainTargetQuoteId === audit.quote_id ? "0 0 0 4px rgba(249, 115, 22, 0.08)" : "none",
                      transform: "scale(1)",
                      transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border 180ms ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{audit.question_text || `Soru ${audit.question_id}`}</div>
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {restoredQuoteRiskBadges(audit.quote_id!).map((badge) => (
                              <span key={`${audit.quote_id}-${badge.key}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: badge.background, color: badge.color, fontSize: 11, fontWeight: 800 }}>
                                {badge.label}: {badge.detail.replace(/^.*?:\s*/, "")}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: restoredQuoteInsight?.section === "status-history" ? "#dbeafe" : "#ede9fe", color: restoredQuoteInsight?.section === "status-history" ? "#1d4ed8" : "#6d28d9", fontSize: 11, fontWeight: 900 }}>
                            Geri Donus Odagi
                          </span>
                        ) : null}
                        {replayChainTargetQuoteId === audit.quote_id ? (
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#ffedd5", color: "#c2410c", fontSize: 11, fontWeight: 900 }}>
                            Replay Zinciri
                          </span>
                        ) : null}
                        {selectedFocusTelemetryTarget?.quoteId === audit.quote_id ? (
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 900 }}>
                            Telemetry Secimi
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
                            style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #fdba74", background: "white", color: "#c2410c", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                          >
                            Telemetry'ye Git
                          </button>
                        ) : null}
                        {audit.quote_id ? (
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: QuoteStatusColor[normalizeQuoteStatus(audit.quote_status)],
                              color: "#0f172a",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            RFQ Durumu: {QuoteStatusLabel[normalizeQuoteStatus(audit.quote_status)]}
                          </span>
                        ) : null}
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: audit.decision === "approved" ? "#dcfce7" : audit.decision === "ignored" ? "#f1f5f9" : "#fef3c7", color: audit.decision === "approved" ? "#166534" : audit.decision === "ignored" ? "#475569" : "#b45309", fontSize: 11, fontWeight: 700 }}>
                          {audit.decision || "answered"}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: "#334155", fontSize: 14 }}>{audit.answer_text}</div>
                    {audit.rationale ? <div style={{ color: "#64748b", fontSize: 12 }}>Gerekce: {audit.rationale}</div> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                      <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                      <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                      <span>Session: {audit.session_id || "-"}</span>
                      <span>Dosya: {audit.source_filename || "-"}</span>
                      <span>Aktor: {audit.created_by_email || "Bilinmiyor"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {audit.tenant_id ? (
                        <button
                          type="button"
                          onClick={() => openTenantGovernanceTab(audit.tenant_id, audit.tenant_name)}
                          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #99f6e4", background: "#ecfeff", color: "#0f766e", fontWeight: 700, cursor: "pointer" }}
                        >
                          Stratejik Partner Yonetimine Git
                        </button>
                      ) : null}
                      {audit.project_id ? (
                        <button
                          type="button"
                          onClick={() => openProjectsTab(audit.project_name)}
                          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontWeight: 700, cursor: "pointer" }}
                        >
                          Proje Akisini Ac
                        </button>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Kayit Zamanı: {String(audit.created_at || "")}</div>
                      {audit.quote_id ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a href={`/quotes/${audit.quote_id}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, textDecoration: "none" }}>
                            RFQ #{audit.quote_id}
                          </a>
                          <a href={`/quotes/${audit.quote_id}/comparison?${buildAdminReturnQuery(audit)}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #d8b4fe", background: "#faf5ff", color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
                            RFQ Karsilastirma
                          </a>
                          <a href={`/quotes/${audit.quote_id}/edit?${buildAdminReturnQuery(audit)}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", fontWeight: 700, textDecoration: "none" }}>
                            RFQ Akisina Git
                          </a>
                          <a href={`/quotes/${audit.quote_id}?insight=status-history&${buildAdminReturnQuery(audit, "status-history")}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#f8fbff", color: "#1d4ed8", fontWeight: 700, textDecoration: "none" }}>
                            RFQ Durum Gecmisi
                          </a>
                          <a href={`/quotes/${audit.quote_id}?insight=full-audit-trail&${buildAdminReturnQuery(audit, "full-audit-trail")}`} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd6fe", background: "#faf5ff", color: "#6d28d9", fontWeight: 700, textDecoration: "none" }}>
                            RFQ Denetim Izi Sayfasi
                          </a>
                          <button
                            type="button"
                            onClick={() => toggleDiscoveryQuoteInsights(audit.quote_id!)}
                            style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 700, cursor: "pointer" }}
                          >
                            {expandedDiscoveryQuoteInsightId === audit.quote_id ? "RFQ Gecmisini Gizle" : "RFQ Gecmisini Ac"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>RFQ baglantisi yok</span>
                      )}
                    </div>
                    {audit.quote_id && expandedDiscoveryQuoteInsightId === audit.quote_id ? (
                      <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "white", padding: 14, display: "grid", gap: 12 }}>
                        {discoveryQuoteInsightLoadingId === audit.quote_id ? (
                          <div style={{ color: "#64748b", fontSize: 13 }}>RFQ durum gecmisi ve denetim izi yukleniyor...</div>
                        ) : null}
                        {discoveryQuoteInsightErrorById[audit.quote_id] ? (
                          <div style={{ color: "#b91c1c", fontSize: 13 }}>{discoveryQuoteInsightErrorById[audit.quote_id]}</div>
                        ) : null}
                        {restoredQuoteInsight?.quoteId === audit.quote_id ? (
                          <div
                            style={{
                              borderRadius: 10,
                              border: restoredQuoteInsight.section === "status-history" ? "1px solid #93c5fd" : "1px solid #c4b5fd",
                              background: restoredQuoteInsight.section === "status-history" ? "#eff6ff" : "#f5f3ff",
                              color: restoredQuoteInsight.section === "status-history" ? "#1d4ed8" : "#6d28d9",
                              padding: "10px 12px",
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: 0.3,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <span>Admin geri donus odagi: {restoredQuoteInsight.section === "status-history" ? "RFQ durum gecmisi" : "RFQ denetim izi"}</span>
                            <button
                              type="button"
                              onClick={clearRestoredQuoteInsight}
                              style={{
                                borderRadius: 999,
                                border: restoredQuoteInsight.section === "status-history" ? "1px solid #93c5fd" : "1px solid #c4b5fd",
                                background: "white",
                                color: restoredQuoteInsight.section === "status-history" ? "#1d4ed8" : "#6d28d9",
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "6px 10px",
                                cursor: "pointer",
                              }}
                            >
                              Odagi Temizle
                            </button>
                          </div>
                        ) : null}
                        {discoveryQuoteById[audit.quote_id] || discoveryQuotePendingApprovalsById[audit.quote_id]?.length ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#475569" }}>RFQ Karar Ozeti</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ color: "#475569", fontSize: 12 }}>Transition reason: {discoveryQuoteById[audit.quote_id]?.transition_reason || "-"}</span>
                              <span style={{ color: "#475569", fontSize: 12 }}>Pending approval: {discoveryQuotePendingApprovalsById[audit.quote_id]?.length || 0}</span>
                            </div>
                            {discoveryQuotePendingApprovalsById[audit.quote_id]?.length ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                {discoveryQuotePendingApprovalsById[audit.quote_id].slice(0, 3).map((approval, index) => (
                                  <div key={`pending-approval-${audit.quote_id}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                                    <div style={{ color: "#0f172a", fontSize: 12, fontWeight: 700 }}>{resolveApprovalRoleLabel(approval) || "Onay"}</div>
                                    <div style={{ color: "#64748b", fontSize: 12 }}>{approval.status || "beklemede"}</div>
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
                            style={{
                              display: "grid",
                              gap: 8,
                              borderRadius: 12,
                              transform: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? "scale(1.02)" : "scale(1)",
                              padding: restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "status-history" ? 10 : 0,
                              border: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? "1px solid #2563eb" : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "status-history" ? "1px solid #93c5fd" : "none",
                              background: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? "#dbeafe" : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "status-history" ? "#f8fbff" : "transparent",
                              boxShadow: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? "0 0 0 6px rgba(37, 99, 235, 0.18)" : "none",
                              transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border 180ms ease",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#475569" }}>RFQ Durum Gecmisi</div>
                            {telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "status-history" ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ display: "inline-flex", width: "fit-content", padding: "4px 8px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800 }}>
                                  {telemetryPulseTarget.reason}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectedFocusTelemetryActionSourceId && focusTelemetryQuickAction(selectedFocusTelemetryActionSourceId)}
                                  disabled={!selectedFocusTelemetryActionSourceId}
                                  style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #93c5fd", background: "white", color: "#1d4ed8", fontSize: 11, fontWeight: 800, cursor: !selectedFocusTelemetryActionSourceId ? "not-allowed" : "pointer", opacity: !selectedFocusTelemetryActionSourceId ? 0.6 : 1 }}
                                >
                                  Telemetry eventine don
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTelemetryPulseTarget(null);
                                    setFocusTelemetrySelectedEventId(null);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #bfdbfe", background: "white", color: "#1d4ed8", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                                >
                                  Secimi temizle
                                </button>
                              </div>
                            ) : null}
                            {discoveryQuoteHistoryById[audit.quote_id].map((entry) => (
                              <div key={`quote-history-${audit.quote_id}-${entry.id}`} style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", display: "grid", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                  <div style={{ color: "#0f172a", fontWeight: 700 }}>{entry.from_status || "-"} {"->"} {entry.to_status || "-"}</div>
                                  <div style={{ color: "#64748b", fontSize: 12 }}>{entry.changed_by_name || entry.changed_by || "Sistem"} • {entry.changed_at || entry.created_at || "-"}</div>
                                </div>
                                {entry.approval_details?.length ? (
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <div style={{ color: "#475569", fontSize: 12, fontWeight: 800 }}>Onay Adimlari</div>
                                    {entry.approval_details.map((approval) => (
                                      <div key={`approval-${entry.id}-${approval.level}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderRadius: 8, background: "white", border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                                        <div style={{ color: "#0f172a", fontSize: 12, fontWeight: 700 }}>Seviye {approval.level} • {resolveApprovalRoleLabel(approval) || "-"}</div>
                                        <div style={{ color: "#64748b", fontSize: 12 }}>{approval.status}{approval.comment ? ` • ${approval.comment}` : ""}</div>
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
                            style={{
                              display: "grid",
                              gap: 8,
                              borderRadius: 12,
                              transform: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? "scale(1.02)" : "scale(1)",
                              padding: restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "full-audit-trail" ? 10 : 0,
                              border: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? "1px solid #6d28d9" : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "full-audit-trail" ? "1px solid #c4b5fd" : "none",
                              background: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? "#f5f3ff" : restoredQuoteInsight?.quoteId === audit.quote_id && restoredQuoteInsight.section === "full-audit-trail" ? "#faf5ff" : "transparent",
                              boxShadow: telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? "0 0 0 6px rgba(109, 40, 217, 0.16)" : "none",
                              transition: "transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border 180ms ease",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#475569" }}>RFQ Denetim Izi</div>
                            {telemetryPulseTarget?.quoteId === audit.quote_id && telemetryPulseTarget.section === "full-audit-trail" ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ display: "inline-flex", width: "fit-content", padding: "4px 8px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9", fontSize: 11, fontWeight: 800 }}>
                                  {telemetryPulseTarget.reason}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectedFocusTelemetryActionSourceId && focusTelemetryQuickAction(selectedFocusTelemetryActionSourceId)}
                                  disabled={!selectedFocusTelemetryActionSourceId}
                                  style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #c4b5fd", background: "white", color: "#6d28d9", fontSize: 11, fontWeight: 800, cursor: !selectedFocusTelemetryActionSourceId ? "not-allowed" : "pointer", opacity: !selectedFocusTelemetryActionSourceId ? 0.6 : 1 }}
                                >
                                  Telemetry eventine don
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTelemetryPulseTarget(null);
                                    setFocusTelemetrySelectedEventId(null);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #ddd6fe", background: "white", color: "#6d28d9", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                                >
                                  Secimi temizle
                                </button>
                              </div>
                            ) : null}
                            <div style={{ color: "#475569", fontSize: 13 }}>
                              Toplam olay: {discoveryQuoteAuditTrailById[audit.quote_id].total_events} • Guncel durum: {discoveryQuoteAuditTrailById[audit.quote_id].current_status}
                            </div>
                            {discoveryQuoteAuditTrailById[audit.quote_id].summary ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ color: "#475569", fontSize: 12 }}>Durum degisikligi: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.status_changes ?? 0}</span>
                                <span style={{ color: "#475569", fontSize: 12 }}>Onay seviyesi: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.approval_levels ?? 0}</span>
                                <span style={{ color: "#475569", fontSize: 12 }}>Tedarikci yaniti: {discoveryQuoteAuditTrailById[audit.quote_id].summary?.suppliers_responded ?? 0}</span>
                              </div>
                            ) : null}
                            {discoveryQuoteAuditTrailById[audit.quote_id].timeline.slice(0, 5).map((event, index) => (
                              <div key={`quote-audit-${audit.quote_id}-${index}`} style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", display: "grid", gap: 4 }}>
                                <div style={{ color: "#0f172a", fontWeight: 700 }}>{event.title}</div>
                                <div style={{ color: "#64748b", fontSize: 12 }}>{event.type} • {String(event.actor || "Sistem")} • {String(event.timestamp || "-")}</div>
                                {event.details && Object.keys(event.details).length ? (
                                  <div style={{ color: "#64748b", fontSize: 12 }}>
                                    {Object.entries(event.details).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(" • ")}
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

      {activeTab === "platform_operations" && canViewPlatformGovernance && (
        <section style={{ display: "grid", gap: 16 }}>
          {activePlatformOpsFocusSummary.length > 0 ? renderAdminFocusBanner({
            eyebrow: "Filter Focus",
            title: `Platform operasyon odagi: ${activePlatformOpsFocusSummary.join(" • ")}`,
            detail: "Operasyon kuyruklari secili filtrelere gore daraltildi.",
            tone: "amber",
            sourceLabel: "Platform operasyonlari filtresi",
            timestamp: Date.now(),
            actions: [
              { label: "Stratejik Partner Yonetimine Git", onClick: () => navigateAdminTab("tenant_governance") },
              { label: "Kuyruga Git", onClick: jumpToPlatformOpsFocusTarget },
              { label: "Filtreyi Temizle", onClick: () => {
                setPlatformOpsStatusFilter("all");
                setPlatformOpsOwnerFilter("all");
              } },
            ],
            testId: "admin-focus-banner-platform-operations",
          }) : null}
          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Operasyon Masasi</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner triage kuyruklari</div>
            <div style={{ color: "#64748b" }}>Bu alan super admin disi platform personelinin Stratejik Partner sorunlarini kategori bazli izlemesi ve ilgili yonetim sekmesine gecmesi icin hazirlandi.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { key: "all", label: "Tum Kayitlar", value: platformOpsStatusSummary.all, color: "#0f172a" },
              { key: "new", label: "Yeni", value: platformOpsStatusSummary.new, color: "#1d4ed8" },
              { key: "in_progress", label: "Islemde", value: platformOpsStatusSummary.in_progress, color: "#c2410c" },
              { key: "waiting_owner", label: "Owner Bekleniyor", value: platformOpsStatusSummary.waiting_owner, color: "#7c3aed" },
              { key: "resolved", label: "Cozuldu", value: platformOpsStatusSummary.resolved, color: "#15803d" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPlatformOpsStatusFilter(item.key as "all" | "new" | "in_progress" | "waiting_owner" | "resolved")}
                style={{ borderRadius: 18, border: platformOpsStatusFilter === item.key ? `2px solid ${item.color}` : "1px solid #e5e7eb", background: "white", padding: 16, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)", display: "grid", gap: 6, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: item.color }}>{item.value}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700, minWidth: 220 }}>
              Owner Filtresi
              <select
                aria-label="Owner Filtresi"
                value={platformOpsOwnerFilter}
                onChange={(event) => setPlatformOpsOwnerFilter(event.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
              >
                {platformOpsOwnerOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {visiblePlatformOpsQueues.map((queue) => (
              <div key={queue.key} ref={(node) => { platformOpsQueueRefs.current[queue.key] = node; }} data-testid={`platform-ops-queue-${queue.key}`} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)", display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: queue.color }}>{queue.title}</div>
                  <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, color: queue.color }}>{queue.items.length}</div>
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{queue.note}</div>
                </div>
                {queue.items.some((tenant) => !(platformOpsOwners[tenant.id] || "").trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      const visibleTenantIds = queue.items.slice(0, 4).map((tenant) => tenant.id);
                      setPlatformOpsOwners((current) => {
                        const next = { ...current };
                        for (const tenantId of visibleTenantIds) {
                          if (!String(next[tenantId] || "").trim()) {
                            next[tenantId] = platformOpsDefaultOwner;
                          }
                        }
                        return next;
                      });
                      setPlatformOpsTouchedAt((current) => {
                        const next = { ...current };
                        for (const tenantId of visibleTenantIds) {
                          next[tenantId] = "2026-04-15";
                        }
                        return next;
                      });
                    }}
                    style={{ justifySelf: "start", padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                  >
                    Gorunenleri Bana Ata
                  </button>
                )}
                {queue.items.some((tenant) => (platformOpsStatuses[tenant.id] || tenant.support_status || "new") !== "in_progress") && (
                  <button
                    type="button"
                    onClick={() => {
                      const visibleTenantIds = queue.items.slice(0, 4).map((tenant) => tenant.id);
                      setPlatformOpsStatuses((current) => {
                        const next = { ...current };
                        for (const tenantId of visibleTenantIds) {
                          next[tenantId] = "in_progress";
                        }
                        return next;
                      });
                      setPlatformOpsTouchedAt((current) => {
                        const next = { ...current };
                        for (const tenantId of visibleTenantIds) {
                          next[tenantId] = "2026-04-15";
                        }
                        return next;
                      });
                    }}
                    style={{ justifySelf: "start", padding: "8px 12px", borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", fontWeight: 700, cursor: "pointer" }}
                  >
                    Gorunenleri Isleme Al
                  </button>
                )}
                <div style={{ display: "grid", gap: 8 }}>
                  {(queue.items.length === 0 ? [null] : queue.items.slice(0, 4)).map((tenant, index) =>
                    tenant ? (
                      <div key={`${queue.key}-${tenant.id}`} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0f172a", fontSize: 11, fontWeight: 800 }}>
                            {platformOpsStatuses[tenant.id] === "resolved"
                              ? "Cozuldu"
                              : platformOpsStatuses[tenant.id] === "in_progress"
                                ? "Islemde"
                                : platformOpsStatuses[tenant.id] === "waiting_owner"
                                  ? "Owner Bekleniyor"
                                  : "Yeni"}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{tenant.slug} • {formatPartnerLifecycleStatus(tenant.status)} • {formatPartnerOnboardingStatus(tenant.onboarding_status)}</div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                          Destek Durumu
                          <select
                            aria-label="Destek Durumu"
                            value={platformOpsStatuses[tenant.id] || "new"}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPlatformOpsStatuses((current) => ({ ...current, [tenant.id]: value }));
                              setPlatformOpsTouchedAt((current) => ({ ...current, [tenant.id]: "2026-04-15" }));
                            }}
                            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                          >
                            <option value="new">Yeni</option>
                            <option value="in_progress">Islemde</option>
                            <option value="waiting_owner">Owner Bekleniyor</option>
                            <option value="resolved">Cozuldu</option>
                          </select>
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            Operasyon Sahibi
                            <input
                              value={platformOpsOwners[tenant.id] || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPlatformOpsOwners((current) => ({ ...current, [tenant.id]: value }));
                                setPlatformOpsTouchedAt((current) => ({ ...current, [tenant.id]: "2026-04-15" }));
                              }}
                              placeholder="Sahip ata"
                              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                            />
                            {!(platformOpsOwners[tenant.id] || "").trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPlatformOpsOwners((current) => ({ ...current, [tenant.id]: platformOpsDefaultOwner }));
                                  setPlatformOpsTouchedAt((current) => ({ ...current, [tenant.id]: "2026-04-15" }));
                                }}
                                style={{ justifySelf: "start", padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                              >
                                Beni Ata
                              </button>
                            )}
                          </label>
                          <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            Son Temas
                            <div style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontWeight: 600 }}>
                              {platformOpsTouchedAt[tenant.id] || "2026-04-15"}
                            </div>
                          </div>
                        </div>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                          Destek Notu
                          <textarea
                            value={platformOpsNotes[tenant.id] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPlatformOpsNotes((current) => ({ ...current, [tenant.id]: value }));
                              setPlatformOpsTouchedAt((current) => ({ ...current, [tenant.id]: "2026-04-15" }));
                            }}
                            placeholder="Bu Stratejik Partner icin son destek notunu girin"
                            rows={2}
                            style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontFamily: "inherit" }}
                          />
                        </label>
                        {platformOpsStatuses[tenant.id] === "resolved" && (
                          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            Kapanis Nedeni
                            <textarea
                              aria-label="Kapanis Nedeni"
                              value={platformOpsResolutionReasons[tenant.id] || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPlatformOpsResolutionReasons((current) => ({ ...current, [tenant.id]: value }));
                                setPlatformOpsTouchedAt((current) => ({ ...current, [tenant.id]: "2026-04-15" }));
                              }}
                              placeholder="Destek kaydinin nasil cozuldugunu yazin"
                              rows={2}
                              style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontFamily: "inherit" }}
                            />
                          </label>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            Kalici Stratejik Partner destek kaydi olarak saklanir.
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSavePlatformOpsNote(tenant.id)}
                            disabled={platformOpsSavingTenantId === tenant.id}
                            style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "#1d4ed8", color: "white", fontWeight: 700, cursor: "pointer", opacity: platformOpsSavingTenantId === tenant.id ? 0.7 : 1 }}
                          >
                            {platformOpsSavingTenantId === tenant.id ? "Kaydediliyor..." : "Destek Notunu Kaydet"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={`${queue.key}-empty-${index}`} style={{ borderRadius: 14, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>
                        Bu kuyrukta aktif Stratejik Partner yok.
                      </div>
                    )
                  )}
                </div>
                <div style={{ borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "10px 12px", color: "#1e3a8a", fontSize: 13 }}>
                  Sonraki adim: {queue.nextStep}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("tenant_governance");
                      navigateAdminTab("tenant_governance");
                    }}
                    style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                  >
                    Stratejik Partner Yonetimine Git
                  </button>
                  {canViewPackagesTab ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("packages");
                        navigateAdminTab("packages");
                      }}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #dbe3ee", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" }}
                    >
                      Paketlere Git
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "onboarding_studio" && canViewPlatformGovernance && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Kurulum Studyosu</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Yeni Stratejik Partner kurulum iskeleti</div>
            <div style={{ color: "#64748b" }}>Plan secimi, Stratejik Partner kaydi, ilk admin aktivasyonu ve ilk kurulum sihirbazi icin operasyon akisini tek ekranda toplar.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Stratejik Partner", value: onboardingStudioSummary.tenant_count, note: "Toplam Stratejik Partner portfoyu", color: "#1d4ed8" },
              { label: "Onboarding Kuyrugu", value: onboardingStudioSummary.onboarding_queue_count, note: "Aktif olmayan kurulum akislari", color: "#b45309" },
              { label: "Owner Eksigi", value: onboardingStudioSummary.owner_pending_count, note: "Sahip atamasi bekleyen Stratejik Partner", color: "#dc2626" },
              { label: "Branding Eksigi", value: onboardingStudioSummary.branding_pending_count, note: "Logo veya brand name eksigi", color: "#7c3aed" },
              { label: "Yeni Uyelik", value: onboardingStudioSummary.new_membership_count, note: "Public onboarding ile gelen yeni basvurular", color: "#0f766e" },
              { label: "Odeme Kontrol", value: onboardingStudioSummary.payment_review_count, note: "Odeme dogrulamasi bekleyen uyelikler", color: "#c2410c" },
              { label: "Bilgi Istendi", value: onboardingStudioSummary.information_requested_count, note: "Ek bilgi veya yeni dekont bekleyen uyelikler", color: "#2563eb" },
              { label: "Onay Bekliyor", value: onboardingStudioSummary.activation_approval_waiting_count, note: "Aktivasyon onayi bekleyen uyelikler", color: "#6d28d9" },
              { label: "Onaylandi", value: onboardingStudioSummary.approved_membership_count, note: "Aktivasyonu tamamlanan yeni uyelikler", color: "#15803d" },
            ].map((item) => (
              <div key={item.label} style={{ borderRadius: 18, background: "white", border: "1px solid #e5e7eb", padding: 16, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)", display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: item.color }}>{item.value}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {searchParams.get("onboardingPlanFocus") ? (
              <div style={{ gridColumn: "1 / -1" }}>
                {renderAdminFocusBanner({
                  eyebrow: "Admin Focus",
                  title: `Onboarding odagi: ${String(searchParams.get("onboardingPlanFocus") || "").toUpperCase()} plani`,
                  detail: "Secilen onboarding planina ait kartlar oncelikli olarak vurgulaniyor.",
                  tone: "blue",
                  sourceLabel: "Onboarding deep-link",
                  timestamp: Date.now(),
                  actions: [{ label: "Odagi Temizle", onClick: () => navigateAdminTab("onboarding_studio") }],
                  testId: "admin-focus-banner-onboarding",
                })}
              </div>
            ) : null}
            {[
              { title: "1. Plan Secimi", note: "Starter, Growth veya Enterprise paketi ile ticari cerceveyi sabitle.", status: "Hazir", color: "#2563eb", action: "starter" },
              { title: "2. Stratejik Partner Kaydi", note: "Stratejik Partner slug, branding ve sahip kullanici adayi ile workspace kaydini ac.", status: "Hazir", color: "#0f766e", action: "growth" },
              { title: "3. Ilk Admin Aktivasyonu", note: "Owner daveti ve ilk yonetici aktivasyonunu tamamla.", status: "Hazir", color: "#b45309", action: "enterprise" },
              { title: "4. Kurulum Sihirbazi", note: "Sirket, departman, roller, proje ve tedarikci tohumlarini adim adim tamamlama akisini kur.", status: "Taslak", color: "#7c3aed", action: null },
            ].filter((card) => {
              const focus = searchParams.get("onboardingPlanFocus");
              if (!focus) return true;
              return card.action === focus || card.action === null;
            }).map((card) => (
              <div key={card.title} style={{ borderRadius: 20, background: "white", border: searchParams.get("onboardingPlanFocus") === card.action ? "2px solid #1d4ed8" : "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: card.color }}>{card.status}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{card.title}</div>
                <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{card.note}</div>
                {card.action ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleStartOnboardingTemplate(card.action)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
                    >
                      Stratejik Partner formuna tasla
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCreateDraftTenant(card.action)}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontWeight: 800, cursor: "pointer" }}
                    >
                      Taslak Stratejik Partner olustur
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#1d4ed8" }}>Yeni Uyelik Onay Masasi</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Odeme kontrolu ve aktivasyon onayi</div>
            <div style={{ color: "#64748b" }}>Public ana sayfadan gelen stratejik ortak ve tedarikci uyelik basvurulari burada takip edilir. Ucretli planlarda EFT dahil tum odemeler dogrulanmadan ve super admin onayi verilmeden aktivasyon tamamlanmaz.</div>
            <div style={{ borderRadius: 16, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "14px 16px", display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8" }}>Kategori ve Eslesme Notu</div>
              <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
                Onboarding sirasinda toplanan kategori bilgisi burada yalnizca bir profil alani olarak durmaz. Super admin ekibi bu veriyi stratejik ortak kapsami, supplier uygunlugu ve kategori eksigi olan basvurulari hizlica ayiklamak icin kullanir.
              </div>
              <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
                Ozellikle supplier ve stratejik ortak basvurularinda kategori uyumu; aktivasyon karari sonrasi hangi havuzun once acilacagini, hangi tenantin ek supplier sourcing ihtiyaci tasidigini ve hangi kayitlarin operasyonel takip gerektirdigini gosterir.
              </div>
            </div>
            {onboardingStudioSummary.recent_memberships.length === 0 ? (
              <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "12px 14px", color: "#64748b" }}>
                Gosterilecek yeni uyelik kaydi yok.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {onboardingStudioSummary.recent_memberships.map((tenant) => {
                  const paymentStatus = String(tenant.onboarding_payment_status || "not_required").toLowerCase();
                  const approvalStatus = String(tenant.onboarding_approval_status || "not_required").toLowerCase();
                  const categoryTags = Array.isArray(tenant.category_tags) ? tenant.category_tags : [];
                  const targetCategoryTags = Array.isArray(tenant.target_category_tags) ? tenant.target_category_tags : [];
                  const categoryRequests = Array.isArray(tenant.category_requests) ? tenant.category_requests : [];
                  const hasPendingCategoryReview = categoryRequests.some((item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()));
                  const normalizedTenantCategory = String(tenant.category || "").trim();
                  const matchingCategoryPool = categoryTags.length > 0 ? categoryTags : normalizedTenantCategory ? [normalizedTenantCategory] : [];
                  const matchingSupplierCount = matchingCategoryPool.length > 0
                    ? tenantGovernanceSuppliers.filter((supplier) => matchingCategoryPool.includes(String(supplier.category || "").trim())).length
                    : 0;
                  const canVerifyPayment = paymentStatus === "submitted" || paymentStatus === "processing";
                  const canApprove = ["pending", "needs_info"].includes(approvalStatus) && ["verified", "succeeded", "not_required"].includes(paymentStatus) && !hasPendingCategoryReview;
                  const canRequestInfo = approvalStatus === "pending" || approvalStatus === "needs_info";
                  const canReject = approvalStatus === "pending" || approvalStatus === "rejected";
                  const decisionGuidance = canVerifyPayment
                    ? "Dekont veya hareket kaniti geldigi icin once odeme dogrulama yapilmali. Dogrulama tamamlanmadan aktivasyon onayi verilmemeli."
                    : hasPendingCategoryReview
                      ? "Listede olmayan kategori talepleri icin once destek ve final onay akisi tamamlanmali. Bu islem bitmeden aktivasyon onayi verilmemeli."
                    : canApprove
                      ? "Odeme gereklilikleri tamamlandi. Kategori uyumu ve tenant sahibi bilgilerinde eksik yoksa aktivasyon onayi verilebilir."
                      : approvalStatus === "needs_info"
                        ? "Kayit ek bilgi bekliyor. Yeni dekont, kategori netlestirmesi veya tenant sahibi teyidi tamamlanana kadar bekletilmeli."
                        : approvalStatus === "rejected"
                          ? "Bu kayit reddedilmis durumda. Yeniden ilerletilecekse once operasyon notu ve karar gerekcesi kontrol edilmeli."
                          : "Kayit ilk inceleme asamasinda. Kategori, plan, odeme ve aktivasyon notlari birlikte kontrol edilerek karar verilmelidir.";
                  const decisionTone = canApprove ? "#dcfce7" : canVerifyPayment ? "#fff7ed" : approvalStatus === "needs_info" ? "#eff6ff" : approvalStatus === "rejected" ? "#fef2f2" : "#f8fafc";
                  const decisionBorder = canApprove ? "#86efac" : canVerifyPayment ? "#fdba74" : approvalStatus === "needs_info" ? "#93c5fd" : approvalStatus === "rejected" ? "#fca5a5" : "#cbd5e1";
                  const decisionColor = canApprove ? "#166534" : canVerifyPayment ? "#9a3412" : approvalStatus === "needs_info" ? "#1d4ed8" : approvalStatus === "rejected" ? "#b91c1c" : "#475569";
                  return (
                    <div key={tenant.id} style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: 14, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenant.owner_email || "owner e-postasi yok"} • {tenant.subscription_plan_code || "starter"} • {String(tenant.subscription_plan_code || "").startsWith("supplier") ? "tedarikci uyeligi" : "stratejik ortak uyeligi"}</div>
                        </div>
                        <span style={{ display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: approvalStatus === "approved" ? "#dcfce7" : "#ede9fe", color: approvalStatus === "approved" ? "#166534" : "#6d28d9", fontSize: 12, fontWeight: 800 }}>
                          {formatOnboardingApprovalStatus(tenant.onboarding_approval_status)}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                        <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Odeme Durumu</div>
                          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatOnboardingPaymentStatus(tenant.onboarding_payment_status)}</div>
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{tenant.onboarding_payment_method || "yontem yok"}</div>
                        </div>
                        <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kurulum Durumu</div>
                          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatPartnerOnboardingStatus(tenant.onboarding_status)}</div>
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{tenant.onboarding_approved_by_name || "super admin karari bekleniyor"}</div>
                        </div>
                        <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Aktivasyon</div>
                          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{formatActivationDeliveryStatus(tenant.activation_delivery_status)}</div>
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                            {tenant.initial_admin_invitation_accepted ? "Ilk admin hesabi aktive edildi" : "Aktivasyon bekleniyor"}
                          </div>
                        </div>
                        <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: "12px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kategori ve Eslesme</div>
                          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(categoryTags.length > 0 ? categoryTags : [normalizedTenantCategory || "Kategori eksik"]).map((item) => (
                              <span key={`${tenant.id}-${item}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: item !== "Kategori eksik" ? "#ecfeff" : "#f8fafc", color: item !== "Kategori eksik" ? "#0f766e" : "#64748b", fontWeight: 700, fontSize: 11 }}>
                                {item}
                              </span>
                            ))}
                            {targetCategoryTags.map((item) => (
                              <span key={`${tenant.id}-target-${item}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eef2ff", color: "#4338ca", fontWeight: 700, fontSize: 11 }}>
                                hedef: {item}
                              </span>
                            ))}
                            <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: matchingSupplierCount > 0 ? "#ecfdf5" : "#fff7ed", color: matchingSupplierCount > 0 ? "#166534" : "#9a3412", fontWeight: 700, fontSize: 11 }}>
                              {matchingSupplierCount > 0 ? `${matchingSupplierCount} supplier eslesiyor` : "Eslesen supplier yok"}
                            </span>
                          </div>
                          <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                            {matchingCategoryPool.length > 0 ? "Aktivasyon sonrasi sourcing havuzu secilen ve hedef kategorilere gore acilabilir." : "Kategori netlesmeden aktivasyon verilirse supplier havuzu zayif acilir."}
                          </div>
                        </div>
                      </div>
                      {categoryRequests.length > 0 ? (
                        <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Kategori Talep Onayi</div>
                          {categoryRequests.map((item) => {
                            const requestStatus = String(item.status || "pending_support").toLowerCase();
                            const statusColor = requestStatus === "final_approved" ? "#166534" : requestStatus === "rejected" ? "#b91c1c" : requestStatus === "support_approved" ? "#1d4ed8" : "#9a3412";
                            const statusBg = requestStatus === "final_approved" ? "#ecfdf5" : requestStatus === "rejected" ? "#fef2f2" : requestStatus === "support_approved" ? "#eff6ff" : "#fff7ed";
                            const isBusy = onboardingMembershipActionTenantId === tenant.id;
                            return (
                              <div key={`${tenant.id}-request-${item.name}-${item.applies_to}`} style={{ borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 12px", display: "grid", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  <div style={{ color: "#0f172a", fontWeight: 800 }}>{item.name}</div>
                                  <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: statusBg, color: statusColor, fontSize: 11, fontWeight: 800 }}>
                                    {formatCategoryRequestStatus(item.status)}
                                  </span>
                                </div>
                                <div style={{ color: "#64748b", fontSize: 12 }}>
                                  {item.applies_to === "target" ? "Hedef kategori talebi" : "Faaliyet kategorisi talebi"}
                                  {item.note ? ` • ${item.note}` : ""}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {requestStatus === "pending_support" ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "support_approved")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                      Destek Onayi Ver
                                    </button>
                                  ) : null}
                                  {["pending_support", "support_approved"].includes(requestStatus) ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "final_approved")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                      Final Onayla
                                    </button>
                                  ) : null}
                                  {!['final_approved', 'rejected'].includes(requestStatus) ? (
                                    <button type="button" disabled={isBusy} onClick={() => void handleReviewTenantCategory(tenant.id, String(item.name || ""), "rejected")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 800, cursor: isBusy ? "not-allowed" : "pointer" }}>
                                      Reddet
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <div style={{ borderRadius: 12, background: decisionTone, border: `1px solid ${decisionBorder}`, padding: "10px 12px", color: decisionColor, fontSize: 12, lineHeight: 1.7 }}>
                        <strong style={{ display: "block", marginBottom: 4 }}>Karar Rehberi</strong>
                        {decisionGuidance}
                      </div>
                      {tenant.onboarding_payment_receipt_url || tenant.onboarding_payment_note || tenant.onboarding_activation_notes ? (
                        <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Operasyon Notlari</div>
                          {tenant.onboarding_payment_receipt_url ? (
                            <a href={tenant.onboarding_payment_receipt_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>
                              {tenant.onboarding_payment_receipt_name || "Dekontu ac"}
                            </a>
                          ) : null}
                          {tenant.onboarding_payment_note ? <div style={{ color: "#475569", fontSize: 12 }}>{tenant.onboarding_payment_note}</div> : null}
                          {tenant.onboarding_activation_notes ? <div style={{ color: "#7c2d12", fontSize: 12 }}>{tenant.onboarding_activation_notes}</div> : null}
                        </div>
                      ) : null}
                      {tenant.onboarding_decision_timeline && tenant.onboarding_decision_timeline.length > 0 ? (
                        <div style={{ borderRadius: 12, background: "white", border: "1px solid #dbe3ee", padding: "10px 12px", display: "grid", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b" }}>Karar Zaman Cizelgesi</div>
                          {tenant.onboarding_decision_timeline.slice().reverse().map((item, index) => (
                            <div key={`${item.at}-${index}`} style={{ paddingLeft: 12, borderLeft: "2px solid #cbd5e1", display: "grid", gap: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{item.actor_name} • {item.action}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>{new Date(item.at).toLocaleString("tr-TR")} • {item.actor_type}</div>
                              {item.note ? <div style={{ fontSize: 12, color: "#334155" }}>{item.note}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={!canVerifyPayment || onboardingMembershipActionTenantId === tenant.id}
                          onClick={() => void handleVerifyOnboardingPayment(tenant.id)}
                          style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fed7aa", background: canVerifyPayment ? "#fff7ed" : "#f8fafc", color: canVerifyPayment ? "#c2410c" : "#94a3b8", fontWeight: 800, cursor: canVerifyPayment ? "pointer" : "not-allowed" }}
                        >
                          Odemeyi Dogrula
                        </button>
                        <button
                          type="button"
                          disabled={!canApprove || onboardingMembershipActionTenantId === tenant.id}
                          onClick={() => void handleApproveOnboardingMembership(tenant.id)}
                          style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: canApprove ? "#1d4ed8" : "#cbd5e1", color: "white", fontWeight: 800, cursor: canApprove ? "pointer" : "not-allowed" }}
                        >
                          Uyelik Aktivasyonunu Onayla
                        </button>
                        <button
                          type="button"
                          disabled={!canRequestInfo || onboardingMembershipActionTenantId === tenant.id}
                          onClick={() => void handleRequestOnboardingInfo(tenant.id)}
                          style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: canRequestInfo ? "#eff6ff" : "#f8fafc", color: canRequestInfo ? "#1d4ed8" : "#94a3b8", fontWeight: 800, cursor: canRequestInfo ? "pointer" : "not-allowed" }}
                        >
                          Ek Bilgi / Yeni Dekont Iste
                        </button>
                        <button
                          type="button"
                          disabled={!canReject || onboardingMembershipActionTenantId === tenant.id}
                          onClick={() => void handleRejectOnboardingMembership(tenant.id)}
                          style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fecaca", background: canReject ? "#fef2f2" : "#f8fafc", color: canReject ? "#b91c1c" : "#94a3b8", fontWeight: 800, cursor: canReject ? "pointer" : "not-allowed" }}
                        >
                          Reddet ve Not Dus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#0f766e" }}>Operasyon Akisi</div>
              {[
                "Stratejik Partner Yonetimi sekmesinden plan ve kurulum durumunu sec.",
                "Ilk admin e-postasini initial_admin alanlari ile ac ve owner atamasini tamamla.",
                "Kurulum durumunu taslak > onboarding > aktif seklinde ilerlet.",
                "Branding, destek kanali ve paket limitleri aktif olmadan canliya gecme.",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#334155" }}>{item}</div>
              ))}
            </div>

            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#7c3aed" }}>RFQ Gecis Hazirligi</div>
              <div style={{ borderRadius: 16, background: onboardingStudioSummary.rfq_readiness.transition_ready ? "#ecfdf5" : "#fff7ed", border: onboardingStudioSummary.rfq_readiness.transition_ready ? "1px solid #bbf7d0" : "1px solid #fed7aa", padding: "12px 14px", color: onboardingStudioSummary.rfq_readiness.transition_ready ? "#166534" : "#9a3412", fontWeight: 800 }}>
                {onboardingStudioSummary.rfq_readiness.transition_ready ? "Stratejik Partner RFQ gecisi icin kritik blokaj gorunmuyor" : "Stratejik Partner RFQ gecisi oncesi veri duzeltme gerekli"}
              </div>
              {[
                "Quotes, quote_approvals ve supplier_quotes Stratejik Partner tutarliligi audit ile izlenir.",
                "Platform network supplier senaryosu Stratejik Partner-private supplier ayrimiyla birlikte korunur.",
                "Stratejik Partner RFQ modeline gecmeden once quote domaini readiness skoru uretir.",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 14, background: "#faf5ff", border: "1px solid #ede9fe", padding: "12px 14px", color: "#4c1d95" }}>{item}</div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {[
                  { label: "Stratejik Partner Eksik Quote", value: onboardingStudioSummary.rfq_readiness.quotes_missing_tenant, color: "#dc2626" },
                  { label: "Stratejik Partner Eksik Approval", value: onboardingStudioSummary.rfq_readiness.approvals_missing_tenant, color: "#ea580c" },
                  { label: "Approval-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.approvals_quote_tenant_mismatch, color: "#9a3412" },
                  { label: "Quote-Proje Uyumsuz", value: onboardingStudioSummary.rfq_readiness.quotes_project_tenant_mismatch, color: "#7c2d12" },
                  { label: "Supplier-Quote Uyumsuz", value: onboardingStudioSummary.rfq_readiness.supplier_quote_scope_mismatch, color: "#7c3aed" },
                  { label: "Platform Agi TedarikciTeklifi", value: onboardingStudioSummary.rfq_readiness.supplier_quotes_platform_network_count, color: "#0f766e" },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: 14, background: "#fff", border: "1px solid #e9d5ff", padding: "12px 14px", display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "14px 16px", display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#0f766e" }}>Tedarikci Kaynak Dengesi</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ borderRadius: 14, background: "white", border: "1px solid #dbeafe", padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase" }}>Ozel Tedarikci</div>
                    <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, color: "#1d4ed8" }}>{onboardingStudioSummary.supplier_mix.private_count}</div>
                  </div>
                  <div style={{ borderRadius: 14, background: "white", border: "1px solid #ddd6fe", padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase" }}>Platform Agi</div>
                    <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, color: "#7c3aed" }}>{onboardingStudioSummary.supplier_mix.platform_network_count}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "tenant_governance" && canViewPlatformGovernance && (
        <section style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 16 }}>
            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Hizli Islem</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Super admin onayli partner acilisi</div>
              </div>
              {!canEditTenantGovernance ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}>Platform destek personeli bu alani izleyebilir; Stratejik Partner olusturma, owner yeniden atama ve yasam dongusu degistirme yetkisi sadece super admin hesabindadir.</div> : null}
              <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: "14px 16px", display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Bu akis onboarding kuyruğuna girmez.</div>
                <div style={{ color: "#475569", fontSize: 13 }}>Super admin buradan stratejik partneri dogrudan aktif olarak acar. Ilk yoneticiye sadece sifre belirleme ve hesap aktivasyon e-postasi gider.</div>
              </div>
              {tenantMessage ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }}>{tenantMessage}</div> : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={openNewTenantModal} disabled={tenantSaving || !canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, cursor: "pointer", opacity: tenantSaving || !canEditTenantGovernance ? 0.6 : 1 }}>
                  Stratejik Partner Ekle
                </button>
                <button type="button" onClick={() => handleStartOnboardingTemplate("starter")} disabled={!canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer", opacity: !canEditTenantGovernance ? 0.6 : 1 }}>
                  Starter Taslagi
                </button>
                <button type="button" onClick={() => handleStartOnboardingTemplate("growth")} disabled={!canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer", opacity: !canEditTenantGovernance ? 0.6 : 1 }}>
                  Growth Taslagi
                </button>
              </div>
            </div>

            {isTenantFormModalOpen ? (
              <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.42)", display: "grid", placeItems: "center", padding: 20, zIndex: 80 }}>
                <div style={{ width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 24, background: "white", border: "1px solid #dbe3ee", boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)", padding: 22, display: "grid", gap: 12 }}>
                  <form onSubmit={handleSubmitTenant} style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Kaydi</div>
                        <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{editingTenantId ? "Stratejik Partner guncelle" : "Yeni Stratejik Partner olustur"}</div>
                        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>Bu kayit super admin onayli olarak acilir ve ilk yoneticiye sadece sifre belirleme e-postasi gider.</div>
                      </div>
                      <button type="button" onClick={closeTenantModal} style={{ border: "1px solid #cbd5e1", background: "white", color: "#334155", borderRadius: 12, padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                        Kapat
                      </button>
                    </div>
                    <input disabled={!canEditTenantGovernance} value={tenantForm.legal_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, legal_name: e.target.value }))} placeholder="Resmi firma adi" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    <input disabled={!canEditTenantGovernance} value={tenantForm.brand_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, brand_name: e.target.value }))} placeholder="Marka / gorunen ad" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    <input disabled={!canEditTenantGovernance} value={tenantForm.category} onChange={(e) => setTenantForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Kategori / uzmanlik alani" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    <input disabled={!canEditTenantGovernance} value={tenantForm.city} onChange={(e) => setTenantForm((prev) => ({ ...prev, city: e.target.value }))} placeholder="Sehir" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase", color: "#8a5b2b", marginTop: 4 }}>Ilk Stratejik Partner Admin</div>
                    <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_full_name} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_full_name: e.target.value }))} placeholder="Ad soyad" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                    <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_email} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_email: e.target.value }))} placeholder="E-posta" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                    <input disabled={!canEditTenantGovernance || editingTenantId !== null} value={tenantForm.initial_admin_personal_phone} onChange={(e) => setTenantForm((prev) => ({ ...prev, initial_admin_personal_phone: e.target.value }))} placeholder="Cep telefonu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance || editingTenantId !== null ? "#f8fafc" : "white", color: !canEditTenantGovernance || editingTenantId !== null ? "#94a3b8" : "#0f172a" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input disabled={!canEditTenantGovernance} value={tenantForm.subscription_plan_code} onChange={(e) => setTenantForm((prev) => ({ ...prev, subscription_plan_code: e.target.value }))} placeholder="Plan kodu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                      <input disabled={!canEditTenantGovernance} value={tenantForm.onboarding_status} onChange={(e) => setTenantForm((prev) => ({ ...prev, onboarding_status: e.target.value }))} placeholder="Onboarding durumu" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    </div>
                    <input disabled={!canEditTenantGovernance} value={tenantForm.status} onChange={(e) => setTenantForm((prev) => ({ ...prev, status: e.target.value }))} placeholder="Status" style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe3ee", background: !canEditTenantGovernance ? "#f8fafc" : "white", color: !canEditTenantGovernance ? "#94a3b8" : "#0f172a" }} />
                    {tenantMessage ? <div style={{ borderRadius: 14, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }}>{tenantMessage}</div> : null}
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button type="button" onClick={closeTenantModal} style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, cursor: "pointer" }}>
                        Vazgec
                      </button>
                      <button type="submit" disabled={tenantSaving || !canEditTenantGovernance} style={{ padding: "12px 16px", borderRadius: 14, border: "none", background: "#1d4ed8", color: "white", fontWeight: 800, cursor: "pointer", opacity: tenantSaving || !canEditTenantGovernance ? 0.6 : 1 }}>
                        {tenantSaving ? "Kaydediliyor..." : editingTenantId ? "Stratejik Partner guncelle" : "Stratejik Partner olustur"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Yonlendirmesi</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner olgunluk siniflari</div>
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {[
                  { label: "draft", note: "Kurulum basladi, Stratejik Partner owner ve branding eksik olabilir." },
                  { label: "onboarding", note: "Ilk admin, branding ve temel organizasyon yapisi kuruluyor." },
                  { label: "aktif", note: "Operasyon kullanima acik, proje ve tedarikci akislari baslayabilir." },
                  { label: "duraklatildi", note: "Abonelik veya operasyon karariyla gecici durdurulmus Stratejik Partner." },
                ].map((item) => (
                  <div key={item.label} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Stratejik Partner Portfoyu</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Musteri olgunluk gorunumu</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>Bu alan artik Stratejik Partner tablosundaki kayitlari dogrudan yonetir.</div>
              {tenantGovernanceFocus ? (
                <div style={{ marginTop: 12 }}>
                  {renderAdminFocusBanner({
                    eyebrow: "Admin Focus",
                    title: `Discovery Lab odagi: ${tenantGovernanceFocus.tenantName || `Stratejik Partner #${tenantGovernanceFocus.tenantId}`}`,
                    detail: "Stratejik Partner portfoyu listesi bu odaga gore daraltildi.",
                    tone: "blue",
                    sourceLabel: "Stratejik Partner deep-link",
                    timestamp: Date.now(),
                    actions: [{ label: "Odagi Temizle", onClick: () => setTenantGovernanceFocus(null) }],
                    testId: "admin-focus-banner-tenant",
                  })}
                </div>
              ) : null}
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "all", label: "Tum Stratejik Partnerler" },
                    { key: "pressure", label: "Limit Baskisi" },
                    { key: "breach", label: "Limit Asimi" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTenantUsageFilter(item.key as "all" | "pressure" | "breach")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: tenantUsageFilter === item.key ? "1px solid #1d4ed8" : "1px solid #dbe3ee",
                        background: tenantUsageFilter === item.key ? "#dbeafe" : "white",
                        color: tenantUsageFilter === item.key ? "#1d4ed8" : "#475569",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13, fontWeight: 700 }}>
                    Kategori
                    <select
                      value={tenantCategoryFilter}
                      onChange={(event) => setTenantCategoryFilter(event.target.value)}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                    >
                      <option value="all">Tum kategoriler</option>
                      <option value="uncategorized">Kategori eksik</option>
                      {tenantCategoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 13, fontWeight: 700 }}>
                    Siralama
                    <select
                      value={tenantSortMode}
                      onChange={(event) => setTenantSortMode(event.target.value as "risk" | "name")}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                    >
                      <option value="risk">Risk onceligi</option>
                      <option value="name">Ada gore</option>
                    </select>
                  </label>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#eff6ff", padding: "12px 14px", display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#1d4ed8" }}>Kategori Kapsami</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#1d4ed8" }}>{tenantCategorySummary.length}</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>Tenant ve tedarikci tarafinda gorulen ortak kategori sayisi</div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #d1fae5", background: "#ecfdf5", padding: "12px 14px", display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#15803d" }}>Kategori Eslesen Tedarikci</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#15803d" }}>{tenantCategorySummary.reduce((sum, item) => sum + item.supplierCount, 0)}</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>Kategoriye sahip supplier portfoyu sinyali</div>
                </div>
                <div style={{ borderRadius: 16, border: "1px solid #fde68a", background: "#fffbeb", padding: "12px 14px", display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#b45309" }}>Kategori Eksigi</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#b45309" }}>{tenants.filter((tenant) => !String(tenant.category || "").trim()).length}</div>
                  <div style={{ color: "#475569", fontSize: 12 }}>Esleme icin henuz kategori atanmamis tenant sayisi</div>
                </div>
              </div>
              {tenantCategorySummary.length > 0 ? (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tenantCategorySummary.slice(0, 8).map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => setTenantCategoryFilter(item.category)}
                      style={{ padding: "7px 11px", borderRadius: 999, border: tenantCategoryFilter === item.category ? "1px solid #0f766e" : "1px solid #dbe3ee", background: tenantCategoryFilter === item.category ? "#ecfeff" : "white", color: tenantCategoryFilter === item.category ? "#0f766e" : "#475569", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                    >
                      {item.category} • {item.tenantCount} tenant / {item.supplierCount} supplier
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "white", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: 14, textAlign: "left" }}>Stratejik Partner</th>
                    <th style={{ padding: 14, textAlign: "left" }}>Durum</th>
                    <th style={{ padding: 14, textAlign: "left" }}>Plan</th>
                    <th style={{ padding: 14, textAlign: "left" }}>Branding</th>
                    <th style={{ padding: 14, textAlign: "left" }}>Stratejik Partner Owner</th>
                    <th style={{ padding: 14, textAlign: "left" }}>Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 18, color: "#64748b", textAlign: "center" }}>
                        Secili filtre icin gosterilecek Stratejik Partner kaydi yok.
                      </td>
                    </tr>
                  ) : (
                    visibleTenants.map((tenant) => {
                      const usage = tenantUsageByTenant.get(tenant.id);
                      const normalizedTenantCategory = String(tenant.category || "").trim();
                      const governancePaymentStatus = String(tenant.onboarding_payment_status || "not_required").toLowerCase();
                      const governanceApprovalStatus = String(tenant.onboarding_approval_status || "not_required").toLowerCase();
                      const governanceOnboardingStatus = String(tenant.onboarding_status || "draft").toLowerCase();
                      const hasPendingCategoryReview = (tenant.category_requests || []).some((item) => !["final_approved", "rejected"].includes(String(item.status || "").toLowerCase()));
                      const governanceLocked = governanceOnboardingStatus !== "active"
                        || governanceApprovalStatus !== "approved"
                        || !["verified", "succeeded", "not_required"].includes(governancePaymentStatus)
                        || hasPendingCategoryReview;
                      const matchingSupplierCount = normalizedTenantCategory
                        ? tenantGovernanceSuppliers.filter((supplier) => String(supplier.category || "").trim() === normalizedTenantCategory).length
                        : 0;
                      const hasLimitPressure = (usage?.metrics || []).some((metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used / metric.limit >= 0.8);
                      const hasLimitBreach = (usage?.metrics || []).some((metric) => metric.limit !== null && metric.limit !== undefined && metric.limit > 0 && metric.used >= metric.limit);
                      return (
                      <tr key={tenant.id} style={{ borderBottom: "1px solid #eef2f7", background: hasLimitBreach ? "#fff7f7" : hasLimitPressure ? "#fffbeb" : "white" }}>
                        <td style={{ padding: 14 }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{tenant.brand_name || tenant.legal_name}</div>
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenant.slug} • {tenant.city || "Sehir eksik"}</div>
                          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: normalizedTenantCategory ? "#ecfeff" : "#f8fafc", color: normalizedTenantCategory ? "#0f766e" : "#64748b", fontWeight: 700, fontSize: 11 }}>
                              {normalizedTenantCategory || "Kategori eksik"}
                            </span>
                            {normalizedTenantCategory ? (
                              <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: matchingSupplierCount > 0 ? "#ecfdf5" : "#fff7ed", color: matchingSupplierCount > 0 ? "#166534" : "#9a3412", fontWeight: 700, fontSize: 11 }}>
                                {matchingSupplierCount > 0 ? `${matchingSupplierCount} tedarikci eslesiyor` : "Eslesen tedarikci yok"}
                              </span>
                            ) : null}
                          </div>
                          {usage ? (
                            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {usage.metrics.map((metric) => {
                                const ratio = metric.limit !== null && metric.limit !== undefined && metric.limit > 0 ? metric.used / metric.limit : 0;
                                const background = ratio >= 1 ? "#fee2e2" : ratio >= 0.8 ? "#fef3c7" : "#eef2ff";
                                const color = ratio >= 1 ? "#991b1b" : ratio >= 0.8 ? "#92400e" : "#3730a3";
                                return (
                                  <span key={`${tenant.id}-${metric.key}`} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background, color, fontWeight: 700, fontSize: 11 }}>
                                    {metric.label}: {metric.used}{metric.limit !== null && metric.limit !== undefined ? `/${metric.limit}` : ""}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: 14 }}>
                          <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: hasLimitBreach ? "#fee2e2" : tenant.is_active ? "#dcfce7" : "#fee2e2", color: hasLimitBreach ? "#991b1b" : tenant.is_active ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                            {formatPartnerLifecycleStatus(tenant.status)}
                          </span>
                          {hasLimitBreach ? <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>Limit asimi var</div> : hasLimitPressure ? <div style={{ marginTop: 8, color: "#92400e", fontSize: 12, fontWeight: 700 }}>Limit yaklasiyor</div> : null}
                        </td>
                        <td style={{ padding: 14, color: "#334155" }}>{tenant.subscription_plan_code || "starter"}</td>
                        <td style={{ padding: 14, color: "#334155" }}>
                          {tenant.logo_url ? "Logo var" : "Logo eksik"}
                        </td>
                        <td style={{ padding: 14 }}>
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ color: "#0f172a", fontWeight: 700 }}>
                              {tenant.owner_full_name || "Owner atanmamis"}
                            </div>
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {tenant.owner_email || "Stratejik Partner admin secilmeli"}
                            </div>
                            {governanceLocked ? (
                              <div style={{ color: "#b45309", fontSize: 12, fontWeight: 700 }}>
                                Odeme dogrulama, kategori onayi ve uyelik aktivasyonu tamamlanana kadar bu kayit salt okunur.
                              </div>
                            ) : null}
                            <select
                              disabled={!canEditTenantGovernance || governanceLocked}
                              value={tenant.owner_user_id ? String(tenant.owner_user_id) : ""}
                              onChange={(event) => void handleReassignTenantOwner(tenant, event.target.value)}
                              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: !canEditTenantGovernance || governanceLocked ? "#f8fafc" : "white" }}
                            >
                              <option value="">Stratejik Partner owner sec</option>
                              {(tenantOwnerCandidates.get(tenant.id) || []).map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.full_name} • {candidate.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: 14 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {canEditTenantGovernance ? <button onClick={() => handleEditTenant(tenant)} disabled={governanceLocked} style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: governanceLocked ? "#e2e8f0" : "#e0e7ff", color: governanceLocked ? "#94a3b8" : "#3730a3", fontWeight: 700, cursor: governanceLocked ? "not-allowed" : "pointer" }}>
                            Duzenle
                            </button> : null}
                            {canEditTenantGovernance ? <button
                              onClick={() => void handleTenantStatusAction(tenant, tenant.is_active ? "paused" : "active")}
                              disabled={tenantSaving || governanceLocked}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 12,
                                border: "none",
                                background: governanceLocked ? "#e2e8f0" : tenant.is_active ? "#fef2f2" : "#ecfdf5",
                                color: governanceLocked ? "#94a3b8" : tenant.is_active ? "#b91c1c" : "#166534",
                                fontWeight: 700,
                                cursor: governanceLocked ? "not-allowed" : "pointer",
                              }}
                            >
                              {tenant.is_active ? "Pasife Al" : "Aktif Et"}
                            </button> : null}
                            {canEditTenantGovernance && !tenant.is_active ? <button
                              onClick={() => void handleDeleteTenant(tenant)}
                              disabled={tenantSaving || governanceLocked}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 12,
                                border: "none",
                                background: governanceLocked ? "#cbd5e1" : "#111827",
                                color: "white",
                                fontWeight: 700,
                                cursor: governanceLocked ? "not-allowed" : "pointer",
                              }}
                            >
                              Sil
                            </button> : null}
                          </div>
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "packages" && canViewPackagesTab && (
        <section style={{ display: "grid", gap: 16 }}>
          {activePackageFocusSummary.length > 0 ? renderAdminFocusBanner({
            eyebrow: "Filter Focus",
            title: `Paket odagi: ${activePackageFocusSummary.join(" • ")}`,
            detail: "Paket katalogu ve kullanim tablolari secili plan ve risk odagina gore daraltildi.",
            tone: "violet",
            sourceLabel: "Paketler filtresi",
            timestamp: Date.now(),
            actions: [
              { label: "Stratejik Partner Yonetimine Git", onClick: () => navigateAdminTab("tenant_governance") },
              { label: "Odak Kartina Git", onClick: jumpToPackageFocusTarget },
              { label: "Filtreyi Temizle", onClick: () => {
                setPackagePlanFilter("all");
                setPackageRiskFilter("all");
              } },
            ],
            testId: "admin-focus-banner-packages",
          }) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { label: "Plan Sayisi", value: subscriptionCatalog?.catalog.plans.length || 0, note: "Aktif katalog plani", color: "#2563eb" },
              { label: "Modul Sayisi", value: subscriptionCatalog?.catalog.plans.reduce((sum, plan) => sum + plan.modules.length, 0) || 0, note: "Tum planlara dagilan modul", color: "#7c3aed" },
              { label: "Varsayilan Plan", value: subscriptionCatalog?.catalog.plans.find((plan) => plan.is_default)?.name || "-", note: "Yeni Stratejik Partner icin acilan plan", color: "#059669" },
              { label: "Stratejik Partner Kullanim Satiri", value: subscriptionCatalog?.tenant_usage.length || 0, note: "Canli limit izleme satiri", color: "#b45309" },
              { label: "Riskteki Stratejik Partner", value: packageUsageSummary.atRiskTenants, note: `${packageUsageSummary.breachedTenants} Stratejik Partner limit asiminda`, color: "#dc2626" },
              { label: "En Yuksek Doluluk", value: `%${packageUsageSummary.highestUtilization}`, note: "Tum Stratejik Partner metriklerinde gorulen tepe oran", color: "#0f766e" },
              { label: "Aktif Abonelik", value: billingOverview?.subscriptions.filter((item) => item.status === "active").length || 0, note: `${billingOverview?.recent_webhook_events.length || 0} webhook olayi`, color: "#1d4ed8" },
              { label: "Acik Fatura", value: billingSummary.openInvoices, note: `${billingSummary.totalOutstanding.toLocaleString("tr-TR")} TRY bekleyen tahsilat`, color: "#b45309" },
            ].map((card) => (
              <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
                <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Plan Katalogu</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Paket ve modul matrisi</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>Bu alan artik hem plan katalogunu hem de Stratejik Partner bazli canli kullanim sayaçlarini birlikte gosterir.</div>
            </div>
            <div style={{ borderRadius: 16, background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)", border: "1px solid #bfdbfe", padding: "14px 16px", display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8" }}>Entitlement Kurali</div>
              <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
                Paketler sadece limit tablosu degildir. Teklif listeleme kapsami, platform supplier agina acilma, ozel listeleme ve kampanya ile one cikma haklari da bu katalog ve premium feature aktivasyonlari ile birlikte degerlendirilmelidir.
              </div>
              <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
                Hedef modelde bir RFQ kaydi; hangi planin limitiyle acildigini, premium ozellik satin alimi olup olmadigini ve supplier tarafinda hangi vitrinde gorunecegini ayni entitlement omurgasindan okumali.
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {(subscriptionCatalog?.catalog.plans || []).map((plan) => (
                <div key={plan.code} ref={(node) => { packagePlanRefs.current[plan.code] = node; }} data-testid={`package-plan-card-${plan.code}`} style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: plan.is_default ? "#eff6ff" : "#f8fafc", padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{plan.name}</div>
                      <div style={{ marginTop: 6, color: "#475569" }}>{plan.description}</div>
                    </div>
                    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                      <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: plan.is_default ? "#dbeafe" : "#e2e8f0", color: plan.is_default ? "#1d4ed8" : "#334155", fontWeight: 700, fontSize: 12 }}>
                        {plan.is_default ? "Varsayilan Plan" : plan.code}
                      </span>
                      <span style={{ color: "#64748b", fontSize: 12 }}>{plan.audience}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    {plan.modules.map((module) => (
                      <div key={module.code} style={{ borderRadius: 16, background: "white", border: "1px solid #dbe3ee", padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{module.name}</div>
                          <span style={{ color: module.enabled ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                            {module.enabled ? "Acilik".replace("Acilik", "Acik") : "Kapali"}
                          </span>
                        </div>
                        <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{module.description}</div>
                        {module.limit_key ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
                            Limit: {module.limit_value} {module.unit || "adet"} • {module.limit_key}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <PremiumFeaturePurchasePanel
              tenants={(subscriptionCatalog?.tenant_usage || []).map((tenantUsage) => ({
                id: tenantUsage.tenant_id,
                name: tenantUsage.tenant_name,
                contactEmail: undefined,
              }))}
              defaultTenantId={visiblePackageUsageRows[0]?.tenant_id || null}
              buyerName={user?.full_name || user?.email || "Platform Ops"}
              buyerEmail={user?.email || "platform@procureflow.dev"}
              allowAdminVerification
              addonCatalog={strategicAddonCatalog}
            />
            <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #fffaf0 0%, #ffffff 50%, #f8fafc 100%)", padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#b45309" }}>Ticari Talep Kuyrugu</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Paket ve add-on talep takibi</div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                  Public paket ve ek hak akislarindan gelen talepler burada takip edilir. Durumu ilerlettiginizde ticari operasyon kuyruğu tek yerden gorunur.
                </div>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {[
                    { key: "all", label: "Tum Talepler", value: commercialRequestSummary.all, color: "#0f172a" },
                    { key: "new", label: "Yeni", value: commercialRequestSummary.new, color: "#b45309" },
                    { key: "contacted", label: "Temas", value: commercialRequestSummary.contacted, color: "#2563eb" },
                    { key: "qualified", label: "Nitelikli", value: commercialRequestSummary.qualified, color: "#7c3aed" },
                    { key: "won", label: "Kazanildi", value: commercialRequestSummary.won, color: "#059669" },
                    { key: "lost", label: "Kaybedildi", value: commercialRequestSummary.lost, color: "#dc2626" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCommercialRequestStatusFilter(item.key as "all" | "new" | "contacted" | "qualified" | "won" | "lost")}
                      style={{ borderRadius: 14, border: commercialRequestStatusFilter === item.key ? `2px solid ${item.color}` : "1px solid #e5e7eb", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={commercialRequestOwnerFilter} onChange={(event) => setCommercialRequestOwnerFilter(event.target.value)} style={{ minWidth: 220, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                    <option value="all">Tum owner'lar</option>
                    <option value="__unassigned__">Atanmamis talepler</option>
                    {commercialRequestOwnerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                  {(commercialRequestStatusFilter !== "all" || commercialRequestOwnerFilter !== "all") ? (
                    <button type="button" onClick={() => { setCommercialRequestStatusFilter("all"); setCommercialRequestOwnerFilter("all"); }} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                      Filtreleri Temizle
                    </button>
                  ) : null}
                </div>
                {(filteredCommercialRequests.length > 0 ? filteredCommercialRequests : []).slice(0, 16).map((request) => (
                  <div key={request.id} style={{ borderRadius: 16, border: "1px solid #f1f5f9", background: "#fff", padding: 14, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{request.company_name || request.requester_name}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{request.requester_email} • {request.request_type === "addon_purchase" ? (request.addon_name || request.addon_code || "Add-on") : request.request_type === "package_upgrade" ? (request.package_name || request.package_code || "Paket") : "Genel demo"}</div>
                        <div style={{ color: "#94a3b8", fontSize: 12 }}>Owner: {request.owner_name || "Atanmamis"} • Son temas: {request.last_contacted_at ? new Date(request.last_contacted_at).toLocaleString("tr-TR") : "-"}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: request.status === "new" ? "#fef3c7" : request.status === "won" ? "#dcfce7" : "#e2e8f0", color: request.status === "new" ? "#92400e" : request.status === "won" ? "#166534" : "#334155", fontSize: 12, fontWeight: 800 }}>
                        {request.status}
                      </span>
                    </div>
                    <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{request.notes || "Ek not girilmemis."}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => void handleAssignCommercialRequest(request.id)}
                        disabled={commercialRequestUpdatingId === request.id}
                        style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontWeight: 700, padding: "8px 10px", cursor: commercialRequestUpdatingId === request.id ? "wait" : "pointer", fontSize: 12 }}
                      >
                        Bana Ata
                      </button>
                      {(["contacted", "qualified", "won", "lost"] as const).map((statusKey) => (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => void handleCommercialRequestStatusUpdate(request.id, statusKey, { markContactedNow: statusKey === "contacted" })}
                          disabled={commercialRequestUpdatingId === request.id || request.status === statusKey}
                          style={{ borderRadius: 10, border: request.status === statusKey ? "1px solid #94a3b8" : "1px solid #cbd5e1", background: request.status === statusKey ? "#f8fafc" : "#fff", color: "#334155", fontWeight: 700, padding: "8px 10px", cursor: commercialRequestUpdatingId === request.id ? "wait" : "pointer", fontSize: 12 }}
                        >
                          {statusKey}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {commercialRequests.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz kayitli ticari talep yok.</div> : null}
                {commercialRequests.length > 0 && filteredCommercialRequests.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Secili filtrelerle eslesen ticari talep bulunamadi.</div> : null}
              </div>
            </div>
            <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #fffaf0 100%)", padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0f766e" }}>Add-on Yasam Dongusu</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Yenileme, iptal ve bitis tarihi yonetimi</div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                  Satin alinmis kapasite add-on'larinin bitis tarihini uzatabilir, belirli bir tarihe cekebilir veya hemen iptal edebilirsiniz.
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={subscriptionAddonStatusFilter} onChange={(event) => setSubscriptionAddonStatusFilter(event.target.value as "all" | "active" | "cancelled" | "expired")} style={{ minWidth: 180, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                    <option value="all">Tum durumlar</option>
                    <option value="active">Aktif</option>
                    <option value="cancelled">Iptal</option>
                    <option value="expired">Suresi dolan</option>
                  </select>
                  <select value={subscriptionAddonTenantFilter} onChange={(event) => setSubscriptionAddonTenantFilter(event.target.value)} style={{ minWidth: 220, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                    <option value="all">Tum tenant'lar</option>
                    {subscriptionAddonTenantOptions.map((tenantName) => <option key={tenantName} value={tenantName}>{tenantName}</option>)}
                  </select>
                  {(subscriptionAddonStatusFilter !== "all" || subscriptionAddonTenantFilter !== "all") ? <button type="button" onClick={() => { setSubscriptionAddonStatusFilter("all"); setSubscriptionAddonTenantFilter("all"); }} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>Filtreleri Temizle</button> : null}
                </div>
                {filteredSubscriptionAddons.slice(0, 16).map((addon) => (
                  <div key={addon.id} style={{ borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", padding: 14, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{addon.addon_name || addon.addon_code}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{addon.tenant_name || `Tenant #${addon.tenant_id}`} • +{addon.total_increment} • {addon.limit_key}</div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: addon.status === "active" ? "#dcfce7" : addon.status === "cancelled" ? "#fee2e2" : "#e2e8f0", color: addon.status === "active" ? "#166534" : addon.status === "cancelled" ? "#b91c1c" : "#334155", fontSize: 12, fontWeight: 800 }}>{addon.status}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: 13 }}>Bitis tarihi: {addon.expires_at ? new Date(addon.expires_at).toLocaleDateString("tr-TR") : "Tanimsiz"}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" onClick={() => void handleSubscriptionAddonLifecycle(addon.id, { action: "renew", extension_days: 30 })} disabled={subscriptionAddonUpdatingId === addon.id} style={{ borderRadius: 10, border: "1px solid #bae6fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, padding: "8px 10px", cursor: subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                        30 Gun Uzat
                      </button>
                      <button type="button" onClick={() => void handleSubscriptionAddonLifecycle(addon.id, { action: addon.status === "active" ? "cancel" : "reactivate" })} disabled={subscriptionAddonUpdatingId === addon.id} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, padding: "8px 10px", cursor: subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                        {addon.status === "active" ? "Hemen Iptal" : "Yeniden Aktif Et"}
                      </button>
                      <input type="date" value={subscriptionAddonExpiryDrafts[addon.id] || ""} onChange={(event) => setSubscriptionAddonExpiryDrafts((current) => ({ ...current, [addon.id]: event.target.value }))} style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 10px", background: "#fff" }} />
                      <button type="button" onClick={() => void handleSubscriptionAddonLifecycle(addon.id, { action: "set_expiry", expires_at: subscriptionAddonExpiryDrafts[addon.id] ? `${subscriptionAddonExpiryDrafts[addon.id]}T23:59:59` : undefined })} disabled={subscriptionAddonUpdatingId === addon.id || !subscriptionAddonExpiryDrafts[addon.id]} style={{ borderRadius: 10, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 700, padding: "8px 10px", cursor: subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                        Bitis Tarihini Kaydet
                      </button>
                    </div>
                  </div>
                ))}
                {subscriptionAddons.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz satin alinmis subscription add-on kaydi yok.</div> : null}
                {subscriptionAddons.length > 0 && filteredSubscriptionAddons.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Secili filtrelerle eslesen add-on kaydi yok.</div> : null}
              </div>
            </div>
            <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 48%, #f8fafc 100%)", padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0369a1" }}>Ticari Webhook Ayari</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>CRM / ticket webhook hedefi</div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                  Yeni ve guncellenen ticari talepleri dis sisteme iletmek icin webhook URL ve gizli anahtar tanimlayin.
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <input value={commercialRequestWebhookDraft.webhook_url} onChange={(event) => setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_url: event.target.value }))} placeholder="https://crm.example.com/hooks/procureflow" style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }} />
                <input value={commercialRequestWebhookDraft.webhook_secret} onChange={(event) => setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_secret: event.target.value }))} placeholder={commercialRequestWebhookSettings?.has_webhook_secret ? "Mevcut secret korunur, degistirmek icin yeni deger girin" : "Webhook secret (opsiyonel)"} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }} />
                <div style={{ color: "#64748b", fontSize: 12 }}>Mevcut durum: {commercialRequestWebhookSettings?.webhook_url ? commercialRequestWebhookSettings.webhook_url : "Webhook kapali"} • Secret: {commercialRequestWebhookSettings?.has_webhook_secret ? "Kayitli" : "Yok"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="button" onClick={() => void handleSaveCommercialRequestWebhookSettings()} disabled={commercialRequestWebhookSaving} style={{ borderRadius: 12, border: "none", background: commercialRequestWebhookSaving ? "#93c5fd" : "#0284c7", color: "#fff", fontWeight: 800, padding: "10px 16px", cursor: commercialRequestWebhookSaving ? "wait" : "pointer" }}>
                    {commercialRequestWebhookSaving ? "Webhook Ayari Kaydediliyor..." : "Webhook Ayarini Kaydet"}
                  </button>
                  <button type="button" onClick={() => void handleClearCommercialRequestWebhookSecret()} disabled={commercialRequestWebhookSaving || !commercialRequestWebhookSettings?.has_webhook_secret} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: commercialRequestWebhookSaving || !commercialRequestWebhookSettings?.has_webhook_secret ? "#e2e8f0" : "#fff", color: "#0f172a", fontWeight: 700, padding: "10px 16px", cursor: commercialRequestWebhookSaving || !commercialRequestWebhookSettings?.has_webhook_secret ? "not-allowed" : "pointer" }}>
                    Secreti Temizle
                  </button>
                </div>
              </div>
            </div>
            <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #fefce8 100%)", padding: 18, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#a16207" }}>Ticari Webhook Teslimati</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Son dispatch denemeleri ve manuel retry</div>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                  Ticari talep create ve update olaylarinin webhook teslimatlari burada izlenir. Basarisiz denemeler ayni kayit uzerinden yeniden tetiklenebilir.
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {[
                    { key: "all", label: "Tum Denemeler", value: commercialRequestWebhookDeliverySummary.all, color: "#0f172a" },
                    { key: "delivered", label: "Teslim", value: commercialRequestWebhookDeliverySummary.delivered, color: "#15803d" },
                    { key: "failed", label: "Hatali", value: commercialRequestWebhookDeliverySummary.failed, color: "#b91c1c" },
                    { key: "other", label: "Diger", value: commercialRequestWebhookDeliverySummary.other, color: "#475569" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCommercialRequestWebhookDeliveryFilter(item.key as "all" | "delivered" | "failed" | "other")}
                      style={{ borderRadius: 14, border: commercialRequestWebhookDeliveryFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    </button>
                  ))}
                </div>
                {visibleCommercialRequestWebhookDeliveries.length === 0 ? (
                  <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz kayitli ticari webhook teslim denemesi yok.</div>
                ) : (
                  visibleCommercialRequestWebhookDeliveries.slice(0, 8).map((delivery) => (
                    <div key={delivery.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{delivery.event_type}</div>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: delivery.delivery_status === "delivered" ? "#dcfce7" : delivery.delivery_status === "failed" ? "#fee2e2" : "#e2e8f0", color: delivery.delivery_status === "delivered" ? "#166534" : delivery.delivery_status === "failed" ? "#991b1b" : "#334155", fontSize: 12, fontWeight: 700 }}>{delivery.delivery_status}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>{delivery.commercial_request_company_name || delivery.commercial_request_requester_email || `Talep #${delivery.commercial_request_id || delivery.id}`}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>HTTP: {delivery.http_status_code || "-"} • Deneme: {delivery.attempt_count} • Son deneme: {delivery.last_attempted_at ? new Date(delivery.last_attempted_at).toLocaleString("tr-TR") : "-"}</div>
                      {delivery.error_message ? <div style={{ color: "#991b1b", fontSize: 12 }}>Hata: {delivery.error_message}</div> : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCommercialRequestWebhookDeliveryId(delivery.id)}
                          style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
                        >
                          Detayi Ac
                        </button>
                        {delivery.delivery_status === "failed" ? (
                          <button
                            type="button"
                            disabled={commercialRequestWebhookRetryingId === delivery.id}
                            onClick={() => { void handleRetryCommercialRequestWebhookDelivery(delivery.id); }}
                            style={{ borderRadius: 10, border: "1px solid #fca5a5", background: commercialRequestWebhookRetryingId === delivery.id ? "#fee2e2" : "#fff1f2", color: "#991b1b", fontWeight: 700, fontSize: 12, padding: "6px 10px", cursor: commercialRequestWebhookRetryingId === delivery.id ? "not-allowed" : "pointer" }}
                          >
                            {commercialRequestWebhookRetryingId === delivery.id ? "Yeniden Gonderiliyor..." : "Webhook'u Yeniden Gonder"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {selectedCommercialRequestWebhookDelivery ? (
              <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.38)", display: "flex", justifyContent: "flex-end", zIndex: 60 }}>
                <div style={{ width: "min(560px, 100vw)", height: "100%", background: "#fff", boxShadow: "-24px 0 60px rgba(15, 23, 42, 0.18)", padding: 22, display: "grid", gap: 14, overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#a16207" }}>Webhook Delivery Detayi</div>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{selectedCommercialRequestWebhookDelivery.event_type}</div>
                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{selectedCommercialRequestWebhookDelivery.commercial_request_company_name || selectedCommercialRequestWebhookDelivery.commercial_request_requester_email || `Talep #${selectedCommercialRequestWebhookDelivery.commercial_request_id || selectedCommercialRequestWebhookDelivery.id}`}</div>
                    </div>
                    <button type="button" onClick={() => setSelectedCommercialRequestWebhookDeliveryId(null)} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, padding: "8px 12px", cursor: "pointer" }}>
                      Kapat
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>Durum</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: selectedCommercialRequestWebhookDelivery.delivery_status === "delivered" ? "#166534" : selectedCommercialRequestWebhookDelivery.delivery_status === "failed" ? "#991b1b" : "#334155" }}>{selectedCommercialRequestWebhookDelivery.delivery_status}</div>
                    </div>
                    <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>HTTP / Deneme</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{selectedCommercialRequestWebhookDelivery.http_status_code || "-"} • {selectedCommercialRequestWebhookDelivery.attempt_count}</div>
                    </div>
                  </div>
                  <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12, display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>Meta</div>
                    <div style={{ color: "#334155", fontSize: 13 }}>Hedef URL: {selectedCommercialRequestWebhookDelivery.target_url || "-"}</div>
                    <div style={{ color: "#334155", fontSize: 13 }}>Son deneme: {selectedCommercialRequestWebhookDelivery.last_attempted_at ? new Date(selectedCommercialRequestWebhookDelivery.last_attempted_at).toLocaleString("tr-TR") : "-"}</div>
                    <div style={{ color: "#334155", fontSize: 13 }}>Teslim zamani: {selectedCommercialRequestWebhookDelivery.delivered_at ? new Date(selectedCommercialRequestWebhookDelivery.delivered_at).toLocaleString("tr-TR") : "-"}</div>
                    {selectedCommercialRequestWebhookDelivery.error_message ? <div style={{ color: "#991b1b", fontSize: 13 }}>Hata: {selectedCommercialRequestWebhookDelivery.error_message}</div> : null}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 700 }}>
                      Webhook Payload
                      <textarea readOnly aria-label="Webhook Payload" value={selectedCommercialRequestWebhookDelivery.payload_raw || "Payload kaydi yok"} style={{ minHeight: 180, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
                    </label>
                    <label style={{ display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 700 }}>
                      Webhook Response Body
                      <textarea readOnly aria-label="Webhook Response Body" value={selectedCommercialRequestWebhookDelivery.response_body || "Response body kaydi yok"} style={{ minHeight: 140, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Canli Limit Izleme</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner bazli kullanim sayaçlari</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>Proje, kullanici ve private supplier limitleri plan bazli olarak ayni ekranda izlenir.</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                {[
                  { key: "all", label: "Tum Planlar", value: packagePlanSummary.all, color: "#0f172a" },
                  ...((subscriptionCatalog?.catalog.plans || []).map((plan) => ({
                    key: plan.code,
                    label: plan.name,
                    value: packagePlanSummary.counts[plan.code] || 0,
                    color: plan.is_default ? "#1d4ed8" : "#475569",
                  }))),
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPackagePlanFilter(item.key)}
                    style={{ borderRadius: 14, border: packagePlanFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                {[
                  { key: "all", label: "Tum Riskler", value: subscriptionCatalog?.tenant_usage.length || 0, color: "#0f172a" },
                  { key: "pressure", label: "Limit Baskisi", value: packageUsageSummary.atRiskTenants, color: "#b45309" },
                  { key: "breach", label: "Limit Asimi", value: packageUsageSummary.breachedTenants, color: "#b91c1c" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPackageRiskFilter(item.key as "all" | "pressure" | "breach")}
                    style={{ borderRadius: 14, border: packageRiskFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                  </button>
                ))}
              </div>
              {visiblePackageUsageRows.length === 0 ? (
                <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#f8fafc", padding: 18, color: "#64748b" }}>
                  Henuz canli kullanim ozeti gosterilecek Stratejik Partner bulunmuyor.
                </div>
              ) : (
                visiblePackageUsageRows.map((tenantUsage) => (
                  <div key={tenantUsage.tenant_id} ref={(node) => { packageUsageRowRefs.current[tenantUsage.tenant_id] = node; }} data-testid={`package-usage-row-${tenantUsage.tenant_id}`} style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{tenantUsage.tenant_name}</div>
                        <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenantUsage.plan_name} • {tenantUsage.status}</div>
                      </div>
                      <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: tenantUsage.is_active ? "#dcfce7" : "#fee2e2", color: tenantUsage.is_active ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                        {tenantUsage.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      {tenantUsage.metrics.map((metric) => {
                        const ratio = metric.limit && metric.limit > 0 ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : null;
                        const isWarning = metric.limit !== null && metric.limit !== undefined && metric.used >= metric.limit;
                        return (
                          <div key={`${tenantUsage.tenant_id}-${metric.key}`} style={{ borderRadius: 16, background: "white", border: isWarning ? "1px solid #fecaca" : "1px solid #dbe3ee", padding: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{metric.label}</div>
                            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: isWarning ? "#b91c1c" : "#0f172a" }}>
                              {metric.used}
                              {metric.limit !== null && metric.limit !== undefined ? ` / ${metric.limit}` : ""}
                            </div>
                            <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                              {metric.unit || "adet"}{ratio !== null ? ` • ${ratio}% doluluk` : " • limitsiz"}
                            </div>
                            {ratio !== null ? (
                              <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${ratio}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    background: ratio >= 100 ? "#dc2626" : ratio >= 80 ? "#d97706" : "#2563eb",
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Billing Operasyonlari</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Abonelik ve webhook akisi</div>
              <div style={{ marginTop: 8, color: "#64748b" }}>Provider tarafindan gelen subscription degisiklikleri ve son webhook olaylari bu panelde izlenir.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Aktif Subscription Kayitlari</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {[
                    { key: "all", label: "Tum Abonelikler", value: billingSummary.subscriptionStatusCounts.all, color: "#0f172a" },
                    { key: "active", label: "Aktif", value: billingSummary.subscriptionStatusCounts.active, color: "#15803d" },
                    { key: "trialing", label: "Deneme", value: billingSummary.subscriptionStatusCounts.trialing, color: "#1d4ed8" },
                    { key: "other", label: "Diger", value: billingSummary.subscriptionStatusCounts.other, color: "#475569" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setBillingSubscriptionFilter(item.key as "all" | "active" | "trialing" | "other")}
                      style={{ borderRadius: 14, border: billingSubscriptionFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    </button>
                  ))}
                </div>
                {visibleBillingSubscriptions.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>Henuz gosterilecek subscription kaydi yok.</div>
                ) : (
                  visibleBillingSubscriptions.slice(0, 6).map((subscription) => (
                    <div key={subscription.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{subscription.subscription_plan_code}</div>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: subscription.status === "active" ? "#dcfce7" : "#e2e8f0", color: subscription.status === "active" ? "#166534" : "#334155", fontSize: 12, fontWeight: 700 }}>{subscription.status}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>Stratejik Partner #{subscription.tenant_id} • {subscription.billing_cycle}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Seat: {subscription.seats_purchased} • Provider: {subscription.billing_provider || "-"}</div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Son Faturalar</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {[
                    { key: "all", label: "Tum Faturalar", value: billingSummary.invoiceStatusCounts.all, color: "#0f172a" },
                    { key: "open", label: "Acik", value: billingSummary.invoiceStatusCounts.open, color: "#b45309" },
                    { key: "paid", label: "Odendi", value: billingSummary.invoiceStatusCounts.paid, color: "#15803d" },
                    { key: "other", label: "Diger", value: billingSummary.invoiceStatusCounts.other, color: "#475569" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setBillingInvoiceFilter(item.key as "all" | "open" | "paid" | "other")}
                      style={{ borderRadius: 14, border: billingInvoiceFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    </button>
                  ))}
                </div>
                {visibleBillingInvoices.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>Henuz fatura kaydi olusmadi.</div>
                ) : (
                  visibleBillingInvoices.slice(0, 6).map((invoice) => {
                    const invoiceStatusMeta = getBillingInvoiceStatusMeta(invoice.status);
                    return (
                    <div key={invoice.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{invoice.invoice_number || invoice.provider_invoice_id || `Invoice #${invoice.id}`}</div>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: invoiceStatusMeta.bucket === "paid" ? "#dcfce7" : invoiceStatusMeta.bucket === "open" ? "#fef3c7" : "#e2e8f0", color: invoiceStatusMeta.bucket === "paid" ? "#166534" : invoiceStatusMeta.bucket === "open" ? "#92400e" : "#334155", fontSize: 12, fontWeight: 700 }}>{invoiceStatusMeta.label}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>Stratejik Partner #{invoice.tenant_id} • {invoice.currency}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Toplam: {Number(invoice.total_amount || 0).toLocaleString("tr-TR")} {invoice.currency}</div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
            <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Son Webhook Olaylari</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {[
                    { key: "all", label: "Tum Olaylar", value: billingWebhookSummary.all, color: "#0f172a" },
                    { key: "processed", label: "Islendi", value: billingWebhookSummary.processed, color: "#15803d" },
                    { key: "failed", label: "Hatali", value: billingWebhookSummary.failed, color: "#b91c1c" },
                    { key: "other", label: "Diger", value: billingWebhookSummary.other, color: "#475569" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setBillingWebhookFilter(item.key as "all" | "processed" | "failed" | "other")}
                      style={{ borderRadius: 14, border: billingWebhookFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                    </button>
                  ))}
                </div>
                {visibleBillingWebhooks.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 13 }}>Henuz webhook olayi alinmadi.</div>
                ) : (
                  visibleBillingWebhooks.slice(0, 6).map((event) => (
                    <div key={event.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{event.event_type}</div>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: event.processing_status === "processed" ? "#dcfce7" : event.processing_status === "failed" ? "#fee2e2" : "#e2e8f0", color: event.processing_status === "processed" ? "#166534" : event.processing_status === "failed" ? "#991b1b" : "#334155", fontSize: 12, fontWeight: 700 }}>{event.processing_status}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>{event.provider} • {event.provider_event_id}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>Stratejik Partner #{event.tenant_id || "-"}</div>
                      {event.processing_status === "failed" && event.error_message ? (
                        <div style={{ color: "#991b1b", fontSize: 12 }}>Hata: {event.error_message}</div>
                      ) : null}
                      {event.processing_status === "failed" ? (
                        <div>
                          <button
                            type="button"
                            disabled={billingWebhookRetryingEventId === event.id}
                            onClick={() => { void handleRetryBillingWebhookEvent(event.id); }}
                            style={{
                              borderRadius: 10,
                              border: "1px solid #fca5a5",
                              background: billingWebhookRetryingEventId === event.id ? "#fee2e2" : "#fff1f2",
                              color: "#991b1b",
                              fontWeight: 700,
                              fontSize: 12,
                              padding: "6px 10px",
                              cursor: billingWebhookRetryingEventId === event.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {billingWebhookRetryingEventId === event.id ? "Yeniden Isleniyor..." : "Yeniden Isle"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
          </div>
        </section>
      )}

      {error && <div style={{ padding: 12, background: "#fecaca", color: "#dc2626", borderRadius: 4, marginBottom: 20 }}>{error}</div>}

      {/* Personnel Tab */}
      {activeTab === "panel_home" && (
        <section style={{ display: "grid", gap: 16 }}>
          {workspacePanelError ? (
            <div style={{ borderRadius: 14, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: "12px 14px" }}>
              Panel profili okunurken hata alindi: {workspacePanelError}
            </div>
          ) : null}
          <section style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "white", padding: 20, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>{renderTabIconBadge("ADM")}<span>{currentUserRoleLabel}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {workspacePanelQuickLinks.map((item) => (
                <a key={item.href} href={item.href} style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "#f8fafc", padding: 16, textDecoration: "none", color: "#0f172a", display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{item.description}</div>
                  <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 800 }}>Git →</div>
                </a>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === "personnel" && (
        <PersonnelTab
          personnel={personnel}
          roles={roles}
          tenants={tenants}
          loadData={loadData}
          readOnly={isPlatformStaff}
        />
      )}

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: "14px 16px", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8" }}>Departmanlar nasıl kullanılmalı?</div>
            <div style={{ color: "#475569", fontSize: 13 }}>Varsayılan satın alma departmanları ilk aktivasyonda otomatik açılır. Yeni departman eklerken şirketinizde farklı kategori, uzmanlık veya operasyon hattı varsa ayrı görünürlük ve sahiplik oluşturmak için ekleyin.</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>Örnek ihtiyaçlar: yeni kategori açılması, merkezi satın alma dışında bölgesel ekip kurulması, teknik ve ticari akışların ayrıştırılması.</div>
          </div>
          <DepartmentsTab
            departments={departments}
            loadData={loadData}
            readOnly={isPlatformStaff}
          />
        </section>
      )}

      {/* Companies Tab */}
      {activeTab === "companies" && (
        <CompaniesTab
          companies={companies}
          loadData={loadData}
          readOnly={isPlatformStaff}
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
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: "14px 16px", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#1d4ed8" }}>Roller ve yetkiler nasıl yönetilmeli?</div>
            <div style={{ color: "#475569", fontSize: 13 }}>Varsayılan satın alma rolleri ilk aktivasyonda otomatik açılır ve tamamen düzenlenebilir kalır. Yeni rol eklerken gerçek onay seviyesi, karar yetkisi veya görev ayrımı varsa ekleyin; mevcut rolleri de şirket yapınıza göre sadeleştirebilir veya silebilirsiniz.</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>Örnek ihtiyaçlar: kategori bazlı yönetici rolü, sadece teklif okuyan destek rolü, müdür yardımcısı ile yönetici arasına ara onay rolü eklenmesi.</div>
          </div>
          <RolesTab />
        </section>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <section style={{ display: "grid", gap: 12 }}>
          {searchParams.get("projectFocusName") ? (
            renderAdminFocusBanner({
              eyebrow: "Admin Focus",
              title: `Proje odagi: ${searchParams.get("projectFocusName")}`,
              detail: "Projects listesi bu arama terimiyle acildi ve odak korunuyor.",
              tone: "violet",
              sourceLabel: "Project deep-link",
              timestamp: Date.now(),
              actions: [{ label: "Odagi Temizle", onClick: () => navigateAdminTab("projects") }],
              testId: "admin-focus-banner-project",
            })
          ) : null}
          <ProjectsTab readOnly={isPlatformStaff} initialSearchTerm={searchParams.get("projectFocusName") || ""} />
        </section>
      )}

      {/* Suppliers Tab */}
      {activeTab === "suppliers" && (
        <SuppliersTab />
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <ApprovalDashboard
          apiUrl={import.meta.env.VITE_API_URL || "http://localhost:8000"}
          authToken={getAccessToken() || ""}
        />
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && <SettingsTab />}

      {activeTab === "panel_designer" && isSuperAdminUser(user) && (
        <WorkspacePanelDesignerTab
          key={JSON.stringify(mergedWorkspacePanelConfig)}
          config={mergedWorkspacePanelConfig}
          saving={workspacePanelSaving}
          onSave={handleSaveWorkspacePanels}
        />
      )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Tab yukleniyor...</div>}>
            <ReportsTabContent />
          </Suspense>
        )}

        {/* Platform Analytics Tab */}
        {activeTab === "platform_analytics" && (
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Tab yukleniyor...</div>}>
            <PlatformAnalyticsTab />
          </Suspense>
        )}

        {/* Platform Suppliers Tab */}
        {activeTab === "platform_suppliers" && (
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Tab yukleniyor...</div>}>
            <PlatformSuppliersTab />
          </Suspense>
        )}

        {/* Public Pricing Tab */}
        {activeTab === "public_pricing" && (
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Tab yukleniyor...</div>}>
            <PublicPricingTab />
          </Suspense>
        )}

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Tab yukleniyor...</div>}>
            <CampaignsTab />
          </Suspense>
        )}

      {shouldLoadAdminWorkspaceData && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginTop: 24, alignItems: "start" }}>
          <div style={{ borderRadius: 24, border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%)", padding: 22, boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Mevcut Hizmetler</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
              {currentPlanLabel || "Aktif plan okunamadi"}
            </div>
            <div style={{ marginTop: 8, color: "#64748b", maxWidth: 720 }}>
              Sectiginiz paketin aktif limitleri asagida hizmet bazinda ozetlenir. Ek paket satin almak istemezseniz soldaki ekstra haklardan adet bazli alim yapabilirsiniz.
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {(purchasedServiceCards.length > 0 ? purchasedServiceCards : [{ key: "default-rights", title: "Standart yonetim haklari" }]).map((card) => (
                <div key={card.key} style={{ borderRadius: 18, border: "1px solid #dbe3ee", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)", padding: 16, display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{card.title}</div>
                  {card.note ? <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{card.note}</div> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {card.activeCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfdf5", color: "#166534", fontSize: 12, fontWeight: 800 }}>Aktif: {card.activeCount}</span> : null}
                    {card.passiveCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 800 }}>Pasif: {card.passiveCount}</span> : null}
                    {card.usedCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>Kullanilan: {card.usedCount} {card.unit || ""}</span> : null}
                    {card.limitCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfdf5", color: "#166534", fontSize: 12, fontWeight: 800 }}>Limit: {card.limitCount} {card.unit || ""}</span> : null}
                    {card.remainingCount != null ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 800 }}>Kalan: {card.remainingCount} {card.unit || ""}</span> : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0", display: "grid", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#8a5b2b" }}>Ekstra Ozellikler</div>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                Paket gecisi yerine ihtiyac duydugunuz kapasiteyi veya ozelligi tek tek satin alabilirsiniz. Birim fiyatlari ust paket gecisinden daha yuksek tutulur.
              </div>
              <div id="subscription-addon" style={{ display: "grid", gap: 12 }}>
                {(addonCards.length > 0 ? addonCards : [
                  {
                    key: "extra-special-listing",
                    name: "Ozel Listeleme",
                    description: "Teklifleriniz daha genis tedarikci agina acilir.",
                    priceLabel: "Fiyatlandirma super admin tarafinda tanimlanir",
                    incrementLabel: "Ozellik bazli aktivasyon",
                    detailLines: [
                      "Ozel listeleme aktif oldugunda tekliflerinizi daha fazla tedarikci gorebilir ve ek teklif alabilirsiniz.",
                      "Firma vitrinde ozel listeleme alaninda gozukebilir.",
                    ],
                  },
                ]).map((addon) => (
                  <div key={addon.key} ref={(node) => { addonCardRefs.current[addon.key] = node; }} style={{ borderRadius: 18, border: searchParams.get("addonKey") === addon.key ? "1px solid #f59e0b" : "1px solid #dbe3ee", boxShadow: searchParams.get("addonKey") === addon.key ? "0 0 0 4px rgba(245, 158, 11, 0.16)" : undefined, background: "linear-gradient(180deg, #fffaf0 0%, #ffffff 100%)", padding: 16, display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{addon.name}</div>
                      <span style={{ padding: "5px 10px", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontSize: 12, fontWeight: 800 }}>{addon.priceLabel}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>{addon.description}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/demo?audience=strategic&intent=addon_purchase&addon=${encodeURIComponent(addon.name)}&addonKey=${encodeURIComponent(addon.key)}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", borderRadius: 10, border: "1px solid #fed7aa", background: "#fff", color: "#9a3412", textDecoration: "none", fontWeight: 800, fontSize: 12 }}>
                        Satin Alma Talebi Olustur
                      </Link>
                    </div>
                    {addon.incrementLabel ? <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>{addon.incrementLabel}</div> : null}
                    <div style={{ display: "grid", gap: 6 }}>
                      {addon.detailLines.map((line) => (
                        <div key={`${addon.key}-${line}`} style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "8px 10px", color: "#334155", fontSize: 12, lineHeight: 1.5 }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div id="subscription-upgrade" ref={subscriptionUpgradeSectionRef} style={{ borderRadius: 24, border: searchParams.get("focus") === "subscription-upgrade" ? "1px solid #60a5fa" : "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", padding: 22, boxShadow: searchParams.get("focus") === "subscription-upgrade" ? "0 0 0 4px rgba(96, 165, 250, 0.18), 0 16px 36px rgba(15, 23, 42, 0.06)" : "0 16px 36px rgba(15, 23, 42, 0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Paket Kademeleri</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Yukseltebileceginiz Paketler</div>
            <div style={{ marginTop: 8, color: "#64748b" }}>
              Mevcut paketiniz en ustte ozetlenir. Altinda sirayla bir ust paketler ve bu paketlere gecis aksiyonu yer alir.
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {currentPackageCard ? (
                <div style={{ borderRadius: 18, padding: 16, background: "#eff6ff", border: "1px solid #93c5fd", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 22 }}>{currentPackageCard.name}</div>
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800 }}>Aktif Paket</span>
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{currentPackageCard.description}</div>
                  <div style={{ color: "#0f766e", fontWeight: 800, fontSize: 13 }}>
                    {currentPackageCard.price_monthly ? `${currentPackageCard.price_monthly.toLocaleString("tr-TR")} ${currentPackageCard.currency || "TRY"} / ay` : "Kuruma ozel fiyatlandirma"}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {currentPackageCard.highlights.map((line) => (
                      <div key={`${currentPackageCard.code}-${line}`} style={{ borderRadius: 12, padding: "8px 10px", background: "#ffffff", border: "1px solid #bfdbfe", fontSize: 12, fontWeight: 700, color: "#334155" }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {(upgradePackageCards.length > 0 ? upgradePackageCards : packageTierCards.filter((plan) => !plan.isCurrent)).map((plan) => (
                <div key={plan.code} ref={(node) => { packagePlanRefs.current[plan.code] = node; }} style={{ borderRadius: 16, padding: 14, background: "#f8fafc", border: searchParams.get("packagePlan") === plan.code ? "1px solid #60a5fa" : "1px solid #e2e8f0", boxShadow: searchParams.get("packagePlan") === plan.code ? "0 0 0 4px rgba(96, 165, 250, 0.16)" : undefined, color: "#334155", display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{plan.name}</div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{plan.description}</div>
                    </div>
                    <div style={{ color: "#0f766e", fontWeight: 800, fontSize: 12 }}>
                      {plan.price_monthly ? `${plan.price_monthly.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay` : "Kuruma ozel"}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {plan.highlights.map((line) => (
                      <div key={`${plan.code}-${line}`} style={{ borderRadius: 12, padding: "8px 10px", background: "#ffffff", border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 700, color: "#334155" }}>
                        {line}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Bir ust hacim katmanina gecis icin hazir.</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to="/fiyatlandirma" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 12, background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>
                        {plan.name} Paketine Yukselt
                      </Link>
                      <Link to={`/demo?audience=strategic&intent=package_upgrade&plan=${encodeURIComponent(plan.name)}&planCode=${encodeURIComponent(plan.code)}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", textDecoration: "none", fontWeight: 800 }}>
                        Yukseltme Talebi Olustur
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Link to="/fiyatlandirma" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 16px", borderRadius: 14, background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", textDecoration: "none", fontWeight: 800, boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)" }}>
                Tum Paketleri ve Fiyatlari Ac
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
