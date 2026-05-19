import { useMemo, useState } from "react";
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from "react";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";
import type { Tenant } from "../../services/admin.service";

type PlatformOpsStatus = "new" | "in_progress" | "waiting_owner" | "resolved";
type PlatformOpsStatusFilter = "all" | PlatformOpsStatus;

type PlatformOpsQueue = {
  key: string;
  title: string;
  note: string;
  color: string;
  items: Tenant[];
  nextStep: string;
};

type PlatformPriorityInfo = {
  score: number;
  severity: "critical" | "high" | "normal" | "low";
  reason: string;
  nextAction: string;
  daysSinceTouchLabel: string;
};

type PlatformOperationsTabProps = {
  activePlatformOpsFocusSummary: string[];
  renderAdminFocusBanner: (options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel: string;
    timestamp?: number;
    actions?: Array<{ label: string; onClick: () => void }>;
    testId?: string;
  }) => ReactNode;
  navigateAdminTab: (tab: AdminTabKey) => void;
  jumpToPlatformOpsFocusTarget: () => void;
  setPlatformOpsStatusFilter: Dispatch<SetStateAction<PlatformOpsStatusFilter>>;
  setPlatformOpsOwnerFilter: Dispatch<SetStateAction<string>>;
  platformOpsStatusSummary: Record<PlatformOpsStatusFilter, number>;
  platformOpsStatusFilter: PlatformOpsStatusFilter;
  platformOpsOwnerFilter: string;
  platformOpsOwnerOptions: Array<{ value: string; label: string }>;
  visiblePlatformOpsQueues: PlatformOpsQueue[];
  allTenants: Tenant[];
  platformOpsQueueRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  platformOpsOwners: Record<number, string>;
  setPlatformOpsOwners: Dispatch<SetStateAction<Record<number, string>>>;
  platformOpsDefaultOwner: string;
  setPlatformOpsTouchedAt: Dispatch<SetStateAction<Record<number, string>>>;
  platformOpsStatuses: Record<number, string>;
  setPlatformOpsStatuses: Dispatch<SetStateAction<Record<number, string>>>;
  formatPartnerLifecycleStatus: (status: string | null | undefined) => string;
  formatPartnerOnboardingStatus: (status: string | null | undefined) => string;
  platformOpsTouchedAt: Record<number, string>;
  platformOpsNotes: Record<number, string>;
  setPlatformOpsNotes: Dispatch<SetStateAction<Record<number, string>>>;
  platformOpsResolutionReasons: Record<number, string>;
  setPlatformOpsResolutionReasons: Dispatch<SetStateAction<Record<number, string>>>;
  handleSavePlatformOpsNote: (tenantId: number) => Promise<void> | void;
  platformOpsSavingTenantId: number | null;
  setActiveTab: Dispatch<SetStateAction<AdminTabKey>>;
  canViewPackagesTab: boolean;
};

export function PlatformOperationsTab({
  activePlatformOpsFocusSummary,
  renderAdminFocusBanner,
  navigateAdminTab,
  jumpToPlatformOpsFocusTarget,
  setPlatformOpsStatusFilter,
  setPlatformOpsOwnerFilter,
  platformOpsStatusSummary,
  platformOpsStatusFilter,
  platformOpsOwnerFilter,
  platformOpsOwnerOptions,
  visiblePlatformOpsQueues,
  allTenants,
  platformOpsQueueRefs,
  platformOpsOwners,
  setPlatformOpsOwners,
  platformOpsDefaultOwner,
  setPlatformOpsTouchedAt,
  platformOpsStatuses,
  setPlatformOpsStatuses,
  formatPartnerLifecycleStatus,
  formatPartnerOnboardingStatus,
  platformOpsTouchedAt,
  platformOpsNotes,
  setPlatformOpsNotes,
  platformOpsResolutionReasons,
  setPlatformOpsResolutionReasons,
  handleSavePlatformOpsNote,
  platformOpsSavingTenantId,
}: PlatformOperationsTabProps) {
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [onlyCriticalVisible, setOnlyCriticalVisible] = useState(false);
  const [emptyStateOwner, setEmptyStateOwner] = useState("");
  const [emptyStateStatus, setEmptyStateStatus] = useState<PlatformOpsStatus>("new");
  const [emptyStateNote, setEmptyStateNote] = useState("");
  const [nowMs] = useState(() => Date.now());
  const hasAnyVisiblePartner = visiblePlatformOpsQueues
    .filter((queue) => queue.key !== "support_status")
    .some((queue) => queue.items.length > 0);
  const resolveSelfOwnerValue = () => {
    const ownerOptions = platformOpsOwnerOptions.filter((opt) => opt.value !== "all");
    const explicitSupport = ownerOptions.find(
      (opt) => /support specialist/i.test(opt.label) || /support specialist/i.test(opt.value),
    );
    return explicitSupport?.value || platformOpsDefaultOwner || ownerOptions[0]?.value || "";
  };

  const prioritizedQueues = useMemo(() => {
    const hasActiveFilter = platformOpsStatusFilter !== "all" || platformOpsOwnerFilter !== "all";
    let queuesToProcess: PlatformOpsQueue[];
    if (hasActiveFilter) {
      const supportStatusItems = allTenants.filter((tenant) => {
        const status = platformOpsStatuses[tenant.id] || tenant.support_status || "new";
        const ownerName = String(platformOpsOwners[tenant.id] || tenant.support_owner_name || "").trim();
        const matchesStatus = platformOpsStatusFilter === "all" || status === platformOpsStatusFilter;
        const matchesOwner = platformOpsOwnerFilter === "all"
          || (platformOpsOwnerFilter === "__unassigned__" ? ownerName.length === 0 : ownerName === platformOpsOwnerFilter);
        return matchesStatus && matchesOwner;
      });
      const supportStatusIds = new Set(supportStatusItems.map((t) => t.id));
      queuesToProcess = [
        ...visiblePlatformOpsQueues.map((queue) => ({
          ...queue,
          items: queue.items.filter((tenant) => !supportStatusIds.has(tenant.id)),
        })),
        {
          key: "support_status",
          title: "Destek Durum Takibi",
          note: "Secili filtrelerle eslesen Stratejik Partner kayitlari.",
          color: "#0369a1",
          items: supportStatusItems,
          nextStep: "Destek durumunu, sorumlusunu ve notlari guncelle",
        },
      ];
    } else {
      queuesToProcess = visiblePlatformOpsQueues;
    }

    return queuesToProcess.map((queue) => {
      const scoredItems = queue.items
        .map((partner) => {
          const status = platformOpsStatuses[partner.id] || partner.support_status || "new";
          const hasOwner = Boolean((platformOpsOwners[partner.id] || "").trim());
          const hasNote = Boolean((platformOpsNotes[partner.id] || "").trim());
          const priority = buildPlatformPriorityInfo({
            queue,
            status,
            hasOwner,
            hasNote,
            onboardingStatus: partner.onboarding_status,
            touchedAt: platformOpsTouchedAt[partner.id],
            nowMs,
          });
          return {
            partner,
            status,
            priority,
          };
        })
        .sort((a, b) => a.partner.id - b.partner.id);

      const criticalCount = scoredItems.filter((item) => item.priority.severity === "critical").length;
      const itemsForView = focusModeEnabled
        ? (onlyCriticalVisible ? scoredItems.filter((item) => item.priority.severity === "critical") : scoredItems)
        : scoredItems;

      return {
        ...queue,
        criticalCount,
        totalCount: scoredItems.length,
        scoredItems,
        itemsForView,
      };
    });
  }, [visiblePlatformOpsQueues, allTenants, platformOpsStatusFilter, platformOpsOwnerFilter, platformOpsStatuses, platformOpsOwners, platformOpsNotes, platformOpsTouchedAt, focusModeEnabled, onlyCriticalVisible, nowMs]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {activePlatformOpsFocusSummary.length > 0 ? renderAdminFocusBanner({
        eyebrow: "Filtre Ozeti",
        title: `Platform operasyon odagi: ${activePlatformOpsFocusSummary.join(" | ")}`,
        detail: "Operasyon kuyruklari secili filtrelere gore daraltildi.",
        tone: "amber",
        sourceLabel: "Platform operasyonlari filtresi",
        timestamp: nowMs,
        actions: [
          { label: "Stratejik Partner Yonetimine Git", onClick: () => navigateAdminTab("tenant_governance") },
          { label: "Kuyruga Git", onClick: jumpToPlatformOpsFocusTarget },
          {
            label: "Filtreyi Temizle",
            onClick: () => {
              setPlatformOpsStatusFilter("all");
              setPlatformOpsOwnerFilter("all");
            },
          },
        ],
        testId: "admin-focus-banner-platform-operations",
      }) : null}
      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Platform Operasyon Masasi</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner triage kuyruklari</div>
        <div style={{ color: "#64748b" }}>Bu alan, onboarding takibi ve owner atama kuyrugu dahil olmak uzere platform ekibinin Stratejik Partner kayitlarini takip etmesi, onceliklendirmesi ve dogru aksiyona yonlenmesi icin hazirlandi.</div>
        <div style={{ color: "#1d4ed8", fontSize: 13, fontWeight: 700 }}>Stratejik Partner Yonetimine Git</div>
        <div style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>Operasyon Sahibi • Destek Durumu • Son Temas • Destek Notu</div>
        {!hasAnyVisiblePartner ? (
          <div style={{ borderRadius: 14, border: "1px dashed #cbd5e1", background: "#f8fafc", padding: "12px 14px", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>Ornek Stratejik Partner Workflow Karti</div>
              <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0f172a", fontSize: 11, fontWeight: 800 }}>
                {emptyStateStatus === "in_progress" ? "Islemde" : emptyStateStatus === "waiting_owner" ? "Yetkili Bekleniyor" : emptyStateStatus === "resolved" ? "Cozuldu" : "Yeni"}
              </span>
            </div>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
              Operasyon Sahibi
              <select
                aria-label="Operasyon Sahibi"
                value={emptyStateOwner}
                onChange={(event) => setEmptyStateOwner(event.target.value)}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
              >
                <option value="">- Sorumlu secin -</option>
                {platformOpsOwnerOptions
                  .filter((opt) => opt.value !== "all")
                  .map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
              Destek Notu
              <textarea
                value={emptyStateNote}
                onChange={(event) => setEmptyStateNote(event.target.value)}
                placeholder="Bu Stratejik Partner icin son destek notunu girin"
                rows={2}
                style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontFamily: "inherit" }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setEmptyStateOwner(resolveSelfOwnerValue())}
                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
              >
                Beni Ata
              </button>
              <button
                type="button"
                onClick={() => setEmptyStateOwner(resolveSelfOwnerValue())}
                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
              >
                Gorunenleri Bana Ata
              </button>
              <button
                type="button"
                onClick={() => setEmptyStateStatus("in_progress")}
                style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", fontWeight: 700, cursor: "pointer" }}
              >
                Gorunenleri Isleme Al
              </button>
            </div>
          </div>
        ) : null}
        <div style={{ borderRadius: 14, border: "1px solid #dbeafe", background: "#f8fbff", padding: "12px 14px", display: "grid", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#1d4ed8" }}>Bu Sayfa Ne Ise Yarar?</div>
          <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
            1) Kurulum, sorumlu atama ve marka gorunurluk listelerini tek panelde toplar.
            2) Her Stratejik Partner icin destek durumu, operasyon sahibi ve notlar kaydedilir.
            3) Cozulen kayitlar kapanis nedeni ile kalici izlenir.
          </div>
        </div>
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
            onClick={() => setPlatformOpsStatusFilter(item.key as PlatformOpsStatusFilter)}
            style={{ borderRadius: 18, border: platformOpsStatusFilter === item.key ? `2px solid ${item.color}` : "1px solid #e5e7eb", background: "white", padding: 16, boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)", display: "grid", gap: 6, textAlign: "left", cursor: "pointer" }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: item.color }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: item.color }}>{item.value}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, borderRadius: 18, border: "1px solid #e2e8f0", background: "#ffffff", padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#334155" }}>Odak ve Filtre Ayarlari</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setFocusModeEnabled((current) => !current);
              if (focusModeEnabled) {
                setOnlyCriticalVisible(false);
              }
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: focusModeEnabled ? "1px solid #b45309" : "1px solid #dbe3ee",
              background: focusModeEnabled ? "#fffbeb" : "#ffffff",
              color: focusModeEnabled ? "#92400e" : "#334155",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Odak Modu: {focusModeEnabled ? "Acik" : "Kapali"}
          </button>
          {focusModeEnabled ? (
            <button
              type="button"
              onClick={() => setOnlyCriticalVisible((current) => !current)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: onlyCriticalVisible ? "1px solid #dc2626" : "1px solid #dbe3ee",
                background: onlyCriticalVisible ? "#fef2f2" : "#ffffff",
                color: onlyCriticalVisible ? "#b91c1c" : "#334155",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Sadece Kritikleri Goster: {onlyCriticalVisible ? "Acik" : "Kapali"}
            </button>
          ) : null}
        </div>
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
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {prioritizedQueues.map((queue) => (
          <div key={queue.key} ref={(node) => { platformOpsQueueRefs.current[queue.key] = node; }} data-testid={`platform-ops-queue-${queue.key}`} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)", display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: queue.color }}>{localizeQueueTitle(queue.title, queue.key)}</div>
              <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, color: queue.color }}>{queue.itemsForView.length}</div>
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{queue.note}</div>
              {focusModeEnabled ? (
                <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", padding: "8px 10px", fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                  Kritik odak: {queue.criticalCount} / {queue.totalCount} Stratejik Partner
                </div>
              ) : null}
            </div>
            {queue.itemsForView.some((item) => !(platformOpsOwners[item.partner.id] || "").trim()) && (
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const visibleTenantIds = queue.itemsForView.slice(0, 4).map((item) => item.partner.id);
                  setPlatformOpsOwners((current) => {
                    const next = { ...current };
                    for (const tenantId of visibleTenantIds) {
                      if (!String(next[tenantId] || "").trim()) {
                        next[tenantId] = resolveSelfOwnerValue();
                      }
                    }
                    return next;
                  });
                  setPlatformOpsTouchedAt((current) => {
                    const next = { ...current };
                    for (const tenantId of visibleTenantIds) {
                      next[tenantId] = today;
                    }
                    return next;
                  });
                }}
                style={{ justifySelf: "start", padding: "8px 12px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
              >
                Gorunenleri Bana Ata
              </button>
            )}
            {queue.itemsForView.some((item) => (platformOpsStatuses[item.partner.id] || item.partner.support_status || "new") !== "in_progress") && (
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const visibleTenantIds = queue.itemsForView.slice(0, 4).map((item) => item.partner.id);
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
                      next[tenantId] = today;
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
              {(queue.itemsForView.length === 0 ? [null] : queue.itemsForView.slice(0, 4)).map((item, index) =>
                item ? (
                  <div key={`${queue.key}-${item.partner.id}`} style={{ borderRadius: 14, background: "#ffffff", border: `1px solid ${severityBorderColor(item.priority.severity)}`, padding: "10px 12px", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.partner.brand_name || item.partner.legal_name}</div>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0f172a", fontSize: 11, fontWeight: 800 }}>
                        {platformOpsStatuses[item.partner.id] === "resolved"
                          ? "Cozuldu"
                          : platformOpsStatuses[item.partner.id] === "in_progress"
                            ? "Islemde"
                            : platformOpsStatuses[item.partner.id] === "waiting_owner"
                              ? "Yetkili Bekleniyor"
                              : "Yeni"}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{item.partner.slug} | {formatPartnerLifecycleStatus(item.partner.status)} | {formatPartnerOnboardingStatus(item.partner.onboarding_status)}</div>
                    <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "8px 10px", display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Oncelik Puani: {item.priority.score}/100 ({priorityLabel(item.priority.severity)})</div>
                      <div style={{ fontSize: 12, color: "#475569" }}><strong>Son temas:</strong> {item.priority.daysSinceTouchLabel}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}><strong>Ne yapiyor:</strong> Bu kart Stratejik Partner operasyon kaydini takip eder.</div>
                      <div style={{ fontSize: 12, color: "#475569" }}><strong>Neden burada:</strong> {item.priority.reason}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}><strong>Ne yapmali:</strong> {item.priority.nextAction}</div>
                    </div>
                    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                      Destek Durumu
                      <select
                        aria-label="Destek Durumu"
                        value={platformOpsStatuses[item.partner.id] || "new"}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPlatformOpsStatuses((current) => ({ ...current, [item.partner.id]: value }));
                        }}
                        style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                      >
                        <option value="new">Yeni</option>
                        <option value="in_progress">Islemde</option>
                        <option value="waiting_owner">Yetkili Bekleniyor</option>
                        <option value="resolved">Cozuldu</option>
                      </select>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                        Operasyon Sahibi
                        <input
                          type="text"
                          aria-label="Operasyon Sahibi"
                          value={platformOpsOwners[item.partner.id] !== undefined ? platformOpsOwners[item.partner.id] : (item.partner.support_owner_name || "")}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPlatformOpsOwners((current) => ({ ...current, [item.partner.id]: value }));
                          }}
                          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white" }}
                        />
                        {!(platformOpsOwners[item.partner.id] !== undefined ? platformOpsOwners[item.partner.id] : (item.partner.support_owner_name || "")).trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlatformOpsOwners((current) => ({ ...current, [item.partner.id]: resolveSelfOwnerValue() }));
                            setPlatformOpsTouchedAt((current) => ({ ...current, [item.partner.id]: new Date().toISOString().slice(0, 10) }));
                          }}
                          style={{ justifySelf: "start", padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                        >
                          Beni Ata
                        </button>
                        )}
                      </label>
                      <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                        Son Temas
                        <div style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontWeight: 600 }}>
                          {platformOpsTouchedAt[item.partner.id] || "—"}
                        </div>
                      </div>
                    </div>
                    <details style={{ borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", padding: "8px 10px" }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#334155" }}>Ek Bilgi ve Notlar</summary>
                      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                          Destek Notu
                          <textarea
                            value={platformOpsNotes[item.partner.id] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPlatformOpsNotes((current) => ({ ...current, [item.partner.id]: value }));
                            }}
                            placeholder="Bu Stratejik Partner icin son destek notunu girin"
                            rows={2}
                            style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontFamily: "inherit" }}
                          />
                        </label>
                        {platformOpsStatuses[item.partner.id] === "resolved" && (
                          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            Kapanis Nedeni
                            <textarea
                              aria-label="Kapanis Nedeni"
                              value={platformOpsResolutionReasons[item.partner.id] || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPlatformOpsResolutionReasons((current) => ({ ...current, [item.partner.id]: value }));
                                setPlatformOpsTouchedAt((current) => ({ ...current, [item.partner.id]: new Date().toISOString().slice(0, 10) }));
                              }}
                              placeholder="Destek kaydinin nasil cozuldugunu yazin"
                              rows={2}
                              style={{ resize: "vertical", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe3ee", color: "#334155", background: "white", fontFamily: "inherit" }}
                            />
                          </label>
                        )}
                      </div>
                    </details>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ color: "#64748b", fontSize: 12 }}>
                        Bu bilgi Stratejik Partner destek gecmisi olarak saklanir.
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleSavePlatformOpsNote(item.partner.id)}
                        disabled={platformOpsSavingTenantId === item.partner.id}
                        style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: "#1d4ed8", color: "white", fontWeight: 700, cursor: "pointer", opacity: platformOpsSavingTenantId === item.partner.id ? 0.7 : 1 }}
                      >
                        {platformOpsSavingTenantId === item.partner.id ? "Kaydediliyor..." : "Destek Notunu Kaydet"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={`${queue.key}-empty-${index}`} style={{ borderRadius: 14, background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>
                    {focusModeEnabled && onlyCriticalVisible
                      ? "Bu kuyrukta kritik seviyede Stratejik Partner yok."
                      : "Bu kuyrukta aktif Stratejik Partner yok."}
                  </div>
                )
              )}
            </div>
            <div style={{ borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe", padding: "10px 12px", color: "#1e3a8a", fontSize: 13 }}>
              Sonraki adim onerisi: {queue.nextStep}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildPlatformPriorityInfo(options: {
  queue: PlatformOpsQueue;
  status: string;
  hasOwner: boolean;
  hasNote: boolean;
  onboardingStatus: string | null | undefined;
  touchedAt?: string;
  nowMs: number;
}): PlatformPriorityInfo {
  const { queue, status, hasOwner, hasNote, onboardingStatus, touchedAt, nowMs } = options;
  const normalizedOnboarding = String(onboardingStatus || "unknown").toLowerCase();

  let score = 30;
  const reasons: string[] = [];

  if (status === "waiting_owner") {
    score += 34;
    reasons.push("Owner aksiyonu bekliyor");
  } else if (status === "new") {
    score += 28;
    reasons.push("Yeni acilmis destek kaydi");
  } else if (status === "in_progress") {
    score += 16;
    reasons.push("Operasyon ekibi islemde");
  } else if (status === "resolved") {
    score += 4;
    reasons.push("Kayit cozulmus durumda");
  }

  if (!hasOwner) {
    score += 20;
    reasons.push("Atanmis operasyon sahibi yok");
  }

  if (!hasNote) {
    score += 10;
    reasons.push("Destek notu eksik");
  }

  if (normalizedOnboarding.includes("blocked") || normalizedOnboarding.includes("bekle") || normalizedOnboarding.includes("pending")) {
    score += 16;
    reasons.push("Onboarding adiminda bekleme var");
  }

  if (queue.key.includes("owner")) {
    score += 6;
  }

  const touchedTimeMs = parseDateToMs(touchedAt);
  const daysSinceTouch = touchedTimeMs === null ? null : Math.max(0, Math.floor((nowMs - touchedTimeMs) / 86400000));

  if (daysSinceTouch === null) {
    score += 14;
    reasons.push("Son temas tarihi yok");
  } else if (daysSinceTouch >= 21) {
    score += 24;
    reasons.push("Son temas 21 gunden eski");
  } else if (daysSinceTouch >= 14) {
    score += 18;
    reasons.push("Son temas 14 gunden eski");
  } else if (daysSinceTouch >= 7) {
    score += 10;
    reasons.push("Son temas 7 gunden eski");
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  let severity: PlatformPriorityInfo["severity"] = "low";
  if (clampedScore >= 75) {
    severity = "critical";
  } else if (clampedScore >= 60) {
    severity = "high";
  } else if (clampedScore >= 40) {
    severity = "normal";
  }

  const nextAction = !hasOwner
    ? "Once operasyon sahibi ata, sonra destek durumunu guncelle."
    : status === "waiting_owner"
      ? "Owner ile teyit al ve kaydi in_progress durumuna cek."
      : status === "new"
        ? "Ilk aksiyon notunu gir ve sureci baslat."
        : status === "resolved"
          ? "Kapanis nedenini kontrol et, eksikse tamamla."
          : "Mevcut adimi notlayarak sureci tamamla.";

  return {
    score: clampedScore,
    severity,
    reason: reasons.join(" | "),
    nextAction,
    daysSinceTouchLabel: formatDaysSinceTouch(daysSinceTouch),
  };
}

function priorityLabel(severity: PlatformPriorityInfo["severity"]): string {
  if (severity === "critical") return "Kritik";
  if (severity === "high") return "Yuksek";
  if (severity === "normal") return "Normal";
  return "Dusuk";
}

function severityBorderColor(severity: PlatformPriorityInfo["severity"]): string {
  if (severity === "critical") return "#fecaca";
  if (severity === "high") return "#fed7aa";
  if (severity === "normal") return "#bfdbfe";
  return "#e2e8f0";
}

function parseDateToMs(value?: string): number | null {
  if (!value || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function formatDaysSinceTouch(days: number | null): string {
  if (days === null) return "Bilinmiyor";
  if (days === 0) return "Bugun";
  if (days === 1) return "1 gun once";
  return `${days} gun once`;
}

function localizeQueueTitle(title: string, key: string): string {
  if (key.includes("owner")) return "Sorumlu Atama Listesi";
  if (key.includes("brand")) return "Marka ve Gorunurluk Listesi";
  if (key.includes("onboard")) return "Kurulum Takip Listesi";
  if (key.includes("triage")) return "Oncelikli Is Listesi";
  return title.replace(/owner/gi, "sorumlu").replace(/triage/gi, "oncelik");
}

