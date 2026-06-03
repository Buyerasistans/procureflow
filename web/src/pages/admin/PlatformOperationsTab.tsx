import { useMemo, useState } from "react";
import type { CSSProperties, Dispatch, MutableRefObject, ReactNode, SetStateAction } from "react";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";
import type { Tenant } from "../../services/admin.service";
import { PageHeader, Section, StatCard } from "./AdminTabContent";
import "./PlatformOperationsTab.css";

/* ── SLA & Müdahale bölümü için statik veriler ─────────────────────────── */

type PoInterventionType = "critical" | "high" | "medium" | "low";
type PoEventLevel = "warn" | "info" | "success" | "critical";

const PO_KPI = {
  openIssues: 12,
  slaBreach: 2,
  activeInterventions: 5,
  avgResolution: "3.4 sa",
  mttr: "47 dk",
} as const;

const PO_QUEUES = [
  { code: "tenant",   label: "Partner Müdahalesi",  color: "#1d4ed8", total: 8,  sla: 6,  breach: 0, owner: "Mehmet T." },
  { code: "rfq",      label: "RFQ İncelemesi",      color: "#7c3aed", total: 14, sla: 12, breach: 2, owner: "Tuba A."   },
  { code: "finance",  label: "Finans Doğrulama",    color: "#15803d", total: 5,  sla: 5,  breach: 0, owner: "Ali D."    },
  { code: "supplier", label: "Tedarikçi Onayı",     color: "#0284c7", total: 9,  sla: 8,  breach: 1, owner: "Sema Y."  },
  { code: "security", label: "Güvenlik Bildirimi",  color: "#be123c", total: 2,  sla: 2,  breach: 0, owner: "Ahmet K." },
];

const PO_INTERVENTIONS: Array<{
  id: string; title: string; tenant: string; type: PoInterventionType;
  stage: string; owner: string; age: string; sla: string; action: string;
}> = [
  { id: "INT-1041", title: "Doğan Otomotiv onay zinciri kilitlendi",    tenant: "Doğan Otomotiv", type: "critical", stage: "inceleme",   owner: "Mehmet T.", age: "23 dk", sla: "40 dk", action: "Onay zincirini sıfırla"    },
  { id: "INT-1040", title: "Karaca Üretim · 3 RFQ rakamı negatif",      tenant: "Karaca Üretim",  type: "high",     stage: "doğrulama", owner: "Tuba A.",   age: "1 sa",  sla: "4 sa",  action: "Manuel kontrol başlat"      },
  { id: "INT-1039", title: "Tetra Holding bekleyen 4 EFT dekontu",       tenant: "Tetra Holding",  type: "medium",   stage: "iletim",    owner: "Ali D.",    age: "2 sa",  sla: "8 sa",  action: "Tahsilat aşamasına ilerlet" },
  { id: "INT-1038", title: "Nova Lojistik supplier_admin token expired", tenant: "Nova Lojistik",  type: "low",      stage: "çözüldü",   owner: "Sema Y.",   age: "4 sa",  sla: "tamam", action: "İncelemeye al"              },
];

const PO_EVENTS: Array<{
  time: string; actor: string; source: string; action: string; target: string; level: PoEventLevel;
}> = [
  { time: "14:38:21", actor: "Mehmet T.", source: "tenant_governance", action: "tenant-suspend", target: "Polat Tekstil · vade aşımı",         level: "warn"     },
  { time: "14:32:18", actor: "Sistem",    source: "cron",              action: "sla-check",      target: "14 tenant taranıyor",                  level: "info"     },
  { time: "14:18:09", actor: "Tuba A.",   source: "rfq",               action: "replay-chain",   target: "RFQ-2419 · MetalForm",                 level: "info"     },
  { time: "13:56:41", actor: "Sistem",    source: "webhook",           action: "delivery-fail",  target: "3 webhook · ACME · retry 2",           level: "warn"     },
  { time: "13:42:08", actor: "Ali D.",    source: "finance",           action: "invoice-issue",  target: "Aylık fatura kesimi · 42 tenant",      level: "success"  },
  { time: "13:14:55", actor: "Sema Y.",   source: "support",           action: "ticket-resolve", target: "Konya Gıda onboarding kuyruğu",        level: "success"  },
  { time: "12:50:32", actor: "Sistem",    source: "security",          action: "auth-spike",     target: "12 deneme · IP 78.180.x.x",            level: "critical" },
];

const PO_ASSIGNEES = [
  { name: "Mehmet T.", role: "Senior Operatör",  open: 6, sla: 4.2, score: 96 },
  { name: "Tuba A.",   role: "Operatör",          open: 8, sla: 3.8, score: 88 },
  { name: "Ali D.",    role: "Finans Operatörü",  open: 4, sla: 5.1, score: 92 },
  { name: "Sema Y.",   role: "Destek Operatörü",  open: 5, sla: 4.7, score: 90 },
  { name: "Ahmet K.",  role: "Güvenlik Uzmanı",   open: 2, sla: 2.3, score: 98 },
];

/* ──────────────────────────────────────────────────────────────────────── */

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
  const [interventionFilter, setInterventionFilter] = useState<"all" | PoInterventionType>("all");

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
        const matchesOwner =
          platformOpsOwnerFilter === "all"
            || (platformOpsOwnerFilter === "__unassigned__" ? ownerName.length === 0 : ownerName === platformOpsOwnerFilter);
        return matchesStatus && matchesOwner;
      });

      const supportStatusIds = new Set(supportStatusItems.map((tenant) => tenant.id));
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
        .sort((left, right) => left.partner.id - right.partner.id);

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
  }, [
    allTenants,
    focusModeEnabled,
    onlyCriticalVisible,
    platformOpsNotes,
    platformOpsOwnerFilter,
    platformOpsOwners,
    platformOpsStatusFilter,
    platformOpsStatuses,
    platformOpsTouchedAt,
    visiblePlatformOpsQueues,
    nowMs,
  ]);

  const filteredInterventions = useMemo(
    () => interventionFilter === "all" ? PO_INTERVENTIONS : PO_INTERVENTIONS.filter((i) => i.type === interventionFilter),
    [interventionFilter],
  );

  return (
    <section className="platform-operations-tab">
      <PageHeader
        eyebrow="Operasyon"
        title="Platform Operasyonları"
        sub="Tenant destek kuyruğu, sorumlu atama ve kapanış takibi"
      />
      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Yeni" value={platformOpsStatusSummary.new} sub="Henüz işleme alınmadı" accent="blue" />
        <StatCard label="İşlemde" value={platformOpsStatusSummary.in_progress} sub="Aktif müdahale" accent="warn" />
        <StatCard label="Owner Bekliyor" value={platformOpsStatusSummary.waiting_owner} sub="Geri dönüş bekleniyor" accent="violet" />
        <StatCard label="Çözüldü" value={platformOpsStatusSummary.resolved} sub="Kapanış nedeni girildi" accent="green" />
      </div>
      {activePlatformOpsFocusSummary.length > 0
        ? renderAdminFocusBanner({
            eyebrow: "Filtre Özeti",
            title: `Platform operasyon odagi: ${activePlatformOpsFocusSummary.join(" | ")}`,
            detail: "Operasyon kuyruklari secili filtrelere gore daraltildi.",
            tone: "amber",
            sourceLabel: "Platform operasyonlari filtresi",
            timestamp: nowMs,
            actions: [
              { label: "Stratejik Partner Yönetimine Git", onClick: () => navigateAdminTab("tenant_governance") },
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
          })
        : null}

      <div className="platform-operations-tab__panel">
        <div className="platform-operations-tab__eyebrow">Platform Operasyon Masasi</div>
        <div className="platform-operations-tab__title">Stratejik Partner triage kuyruklari</div>
        <div className="platform-operations-tab__description">
          Bu alan, onboarding takibi ve owner atama kuyrugu dahil olmak uzere platform ekibinin Stratejik Partner kayitlarini takip
          etmesi, onceliklendirmesi ve dogru aksiyona yonlenmesi icin hazirlandi.
        </div>
        <div className="platform-operations-tab__link-note">Stratejik Partner Yönetimine Git</div>
        <div className="platform-operations-tab__meta">Operasyon Sahibi • Destek Durumu • Son Temas • Destek Notu</div>

        {!hasAnyVisiblePartner ? (
          <div className="platform-operations-tab__empty-card">
            <div className="platform-operations-tab__empty-card-header">
              <div className="platform-operations-tab__empty-card-title">Ornek Stratejik Partner Workflow Karti</div>
              <span className="platform-operations-tab__chip">
                {emptyStateStatus === "in_progress"
                  ? "Islemde"
                  : emptyStateStatus === "waiting_owner"
                    ? "Yetkili Bekleniyor"
                    : emptyStateStatus === "resolved"
                      ? "Cozuldu"
                      : "Yeni"}
              </span>
            </div>

            <label className="platform-operations-tab__label">
              Operasyon Sahibi
              <select
                aria-label="Operasyon Sahibi"
                value={emptyStateOwner}
                onChange={(event) => setEmptyStateOwner(event.target.value)}
                className="platform-operations-tab__select"
              >
                <option value="">- Sorumlu secin -</option>
                {platformOpsOwnerOptions
                  .filter((option) => option.value !== "all")
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>

            <label className="platform-operations-tab__label">
              Destek Notu
              <textarea
                value={emptyStateNote}
                onChange={(event) => setEmptyStateNote(event.target.value)}
                placeholder="Bu Stratejik Partner icin son destek notunu girin"
                rows={2}
                className="platform-operations-tab__textarea"
              />
            </label>

            <div className="platform-operations-tab__button-row">
              <button type="button" onClick={() => setEmptyStateOwner(resolveSelfOwnerValue())} className="platform-operations-tab__button platform-operations-tab__button--blue">
                Beni Ata
              </button>
              <button type="button" onClick={() => setEmptyStateOwner(resolveSelfOwnerValue())} className="platform-operations-tab__button platform-operations-tab__button--blue">
                Gorunenleri Bana Ata
              </button>
              <button type="button" onClick={() => setEmptyStateStatus("in_progress")} className="platform-operations-tab__button platform-operations-tab__button--amber">
                Gorunenleri Isleme Al
              </button>
            </div>
          </div>
        ) : null}

        <div className="platform-operations-tab__support-note">
          <div className="platform-operations-tab__inline-label platform-operations-tab__inline-label--blue">Bu Sayfa Ne Ise Yarar?</div>
          <div className="platform-operations-tab__small-text platform-operations-tab__small-text--loose">
            1) Kurulum, sorumlu atama ve marka gorunurluk listelerini tek panelde toplar.
            2) Her Stratejik Partner icin destek durumu, operasyon sahibi ve notlar kaydedilir.
            3) Cozulen kayitlar kapanis nedeni ile kalici izlenir.
          </div>
        </div>
      </div>

      <div className="platform-operations-tab__stats-grid">
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
            className={`platform-operations-tab__stat-card ${platformOpsStatusFilter === item.key ? "platform-operations-tab__stat-card--active" : ""}`}
          >
            <div className={`platform-operations-tab__stat-label platform-operations-tab__stat-label--${item.key}`}>
              {item.label}
            </div>
            <div className={`platform-operations-tab__stat-value platform-operations-tab__stat-value--${item.key}`}>
              {item.value}
            </div>
          </button>
        ))}
      </div>

      <div className="platform-operations-tab__filters">
        <div className="platform-operations-tab__filters-title">Odak ve Filtre Ayarlari</div>

        <div className="platform-operations-tab__filters-row">
          <div className="platform-operations-tab__filters-row--start">
            <button
              type="button"
              onClick={() => {
                setFocusModeEnabled((current) => !current);
                if (focusModeEnabled) {
                  setOnlyCriticalVisible(false);
                }
              }}
              className="platform-operations-tab__button"
            >
              Odak Modu: {focusModeEnabled ? "Açık" : "Kapalı"}
            </button>

            {focusModeEnabled ? (
              <button
                type="button"
                onClick={() => setOnlyCriticalVisible((current) => !current)}
                className="platform-operations-tab__button"
              >
                Sadece Kritikleri Göster: {onlyCriticalVisible ? "Açık" : "Kapalı"}
              </button>
            ) : null}
          </div>

          <label className="platform-operations-tab__label platform-operations-tab__label--owner-filter">
            Owner Filtresi
            <select
              aria-label="Owner Filtresi"
              value={platformOpsOwnerFilter}
              onChange={(event) => setPlatformOpsOwnerFilter(event.target.value)}
              className="platform-operations-tab__select"
            >
              {platformOpsOwnerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="platform-operations-tab__queues-grid">
        {prioritizedQueues.map((queue) => (
          <div
            key={queue.key}
            ref={(node) => {
              platformOpsQueueRefs.current[queue.key] = node;
            }}
            data-testid={`platform-ops-queue-${queue.key}`}
            className="platform-operations-tab__queue-card"
          >
            <div>
              <div className="platform-operations-tab__inline-label platform-operations-tab__inline-label--blue">
                {localizeQueueTitle(queue.title, queue.key)}
              </div>
              <div className={`platform-operations-tab__queue-count platform-operations-tab__queue-count--${queue.key}`}>
                {queue.itemsForView.length}
              </div>
              <div className="platform-operations-tab__queue-note">{queue.note}</div>

              {focusModeEnabled ? (
                <div className="platform-operations-tab__priority-box">
                  Kritik odak: {queue.criticalCount} / {queue.totalCount} Stratejik Partner
                </div>
              ) : null}
            </div>

            {queue.itemsForView.some((item) => !(platformOpsOwners[item.partner.id] || "").trim()) ? (
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
                className="platform-operations-tab__button platform-operations-tab__button--blue"
              >
                Gorunenleri Bana Ata
              </button>
            ) : null}

            {queue.itemsForView.some((item) => (platformOpsStatuses[item.partner.id] || item.partner.support_status || "new") !== "in_progress") ? (
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
                className="platform-operations-tab__button platform-operations-tab__button--amber"
              >
                Gorunenleri Isleme Al
              </button>
            ) : null}

            <div className="platform-operations-tab__queue-actions">
              {(queue.itemsForView.length === 0 ? [null] : queue.itemsForView.slice(0, 4)).map((item, index) =>
                item ? (
                  <div key={`${queue.key}-${item.partner.id}`} className="platform-operations-tab__queue-item">
                    <div className="platform-operations-tab__card-header">
                      <div className="platform-operations-tab__card-title">{item.partner.brand_name || item.partner.legal_name}</div>
                      <span className={`platform-operations-tab__owner-badge platform-operations-tab__badge--${item.priority.severity === "critical" ? "resolved" : item.priority.severity === "high" ? "in-progress" : item.priority.severity === "normal" ? "waiting-owner" : "new"}`}>
                        {platformOpsStatuses[item.partner.id] === "resolved"
                          ? "Cozuldu"
                          : platformOpsStatuses[item.partner.id] === "in_progress"
                            ? "Islemde"
                            : platformOpsStatuses[item.partner.id] === "waiting_owner"
                              ? "Yetkili Bekleniyor"
                              : "Yeni"}
                      </span>
                    </div>

                    <div className="platform-operations-tab__queue-item-body">
                      {item.partner.slug} | {formatPartnerLifecycleStatus(item.partner.status)} | {formatPartnerOnboardingStatus(item.partner.onboarding_status)}
                    </div>

                    <div className={`platform-operations-tab__priority-card platform-operations-tab__priority-card--${item.priority.severity}`}>
                      <div className="platform-operations-tab__priority-title">
                        Oncelik Puani: {item.priority.score}/100 ({priorityLabel(item.priority.severity)})
                      </div>
                      <div className="platform-operations-tab__priority-line">
                        <strong>Son temas:</strong> {item.priority.daysSinceTouchLabel}
                      </div>
                      <div className="platform-operations-tab__priority-line">
                        <strong>Ne yapiyor:</strong> Bu kart Stratejik Partner operasyon kaydini takip eder.
                      </div>
                      <div className="platform-operations-tab__priority-line">
                        <strong>Neden burada:</strong> {item.priority.reason}
                      </div>
                      <div className="platform-operations-tab__priority-line">
                        <strong>Ne yapmali:</strong> {item.priority.nextAction}
                      </div>
                    </div>

                    <label className="platform-operations-tab__label">
                      Destek Durumu
                      <select
                        aria-label="Destek Durumu"
                        value={platformOpsStatuses[item.partner.id] || "new"}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPlatformOpsStatuses((current) => ({ ...current, [item.partner.id]: value }));
                        }}
                        className="platform-operations-tab__select"
                      >
                        <option value="new">Yeni</option>
                        <option value="in_progress">Islemde</option>
                        <option value="waiting_owner">Yetkili Bekleniyor</option>
                        <option value="resolved">Cozuldu</option>
                      </select>
                    </label>

                    <div className="platform-operations-tab__grid-two">
                      <label className="platform-operations-tab__label">
                        Operasyon Sahibi
                        <input
                          type="text"
                          aria-label="Operasyon Sahibi"
                          value={
                            platformOpsOwners[item.partner.id] !== undefined
                              ? platformOpsOwners[item.partner.id]
                              : item.partner.support_owner_name || ""
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            setPlatformOpsOwners((current) => ({ ...current, [item.partner.id]: value }));
                          }}
                          className="platform-operations-tab__input"
                        />
                        {!(platformOpsOwners[item.partner.id] !== undefined ? platformOpsOwners[item.partner.id] : item.partner.support_owner_name || "").trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPlatformOpsOwners((current) => ({ ...current, [item.partner.id]: resolveSelfOwnerValue() }));
                              setPlatformOpsTouchedAt((current) => ({ ...current, [item.partner.id]: new Date().toISOString().slice(0, 10) }));
                            }}
                            className="platform-operations-tab__button platform-operations-tab__button--blue"
                          >
                            Beni Ata
                          </button>
                        ) : null}
                      </label>

                      <div className="platform-operations-tab__grid-auto">
                        <div className="platform-operations-tab__label">Son Temas</div>
                        <div className="platform-operations-tab__priority-card">
                          {platformOpsTouchedAt[item.partner.id] || "—"}
                        </div>
                      </div>
                    </div>

                    <details className="platform-operations-tab__details">
                      <summary className="platform-operations-tab__details-summary">Ek Bilgi ve Notlar</summary>
                      <div className="platform-operations-tab__grid-auto platform-operations-tab__grid-auto--spaced">
                        <label className="platform-operations-tab__label">
                          Destek Notu
                          <textarea
                            value={platformOpsNotes[item.partner.id] || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPlatformOpsNotes((current) => ({ ...current, [item.partner.id]: value }));
                            }}
                            placeholder="Bu Stratejik Partner icin son destek notunu girin"
                            rows={2}
                            className="platform-operations-tab__textarea"
                          />
                        </label>

                        {platformOpsStatuses[item.partner.id] === "resolved" ? (
                          <label className="platform-operations-tab__label">
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
                              className="platform-operations-tab__textarea"
                            />
                          </label>
                        ) : null}
                      </div>
                    </details>

                    <div className="platform-operations-tab__save-row">
                      <div className="platform-operations-tab__helper">Bu bilgi Stratejik Partner destek gecmisi olarak saklanir.</div>
                      <button
                        type="button"
                        onClick={() => void handleSavePlatformOpsNote(item.partner.id)}
                        disabled={platformOpsSavingTenantId === item.partner.id}
                        className="platform-operations-tab__button platform-operations-tab__button--primary"
                      >
                        {platformOpsSavingTenantId === item.partner.id ? "Kaydediliyor..." : "Destek Notunu Kaydet"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={`${queue.key}-empty-${index}`} className="platform-operations-tab__queue-item platform-operations-tab__queue-item--empty">
                    {focusModeEnabled && onlyCriticalVisible
                      ? "Bu kuyrukta kritik seviyede Stratejik Partner yok."
                      : "Bu kuyrukta aktif Stratejik Partner yok."}
                  </div>
                ),
              )}
            </div>

            <div className="platform-operations-tab__queue-footer">
              Sonraki adim onerisi: {queue.nextStep}
            </div>
          </div>
        ))}
      </div>

      <div className="po-band">SLA ve Müdahale Operasyonları</div>

      <div className="kpi-grid">
        <StatCard label="Açık İş" value={PO_KPI.openIssues} delta={4} trend="up" accent="blue" />
        <StatCard label="SLA İhlali" value={PO_KPI.slaBreach} sub="Son 24 saatte" accent="warn" />
        <StatCard label="Aktif Müdahale" value={PO_KPI.activeInterventions} sub="Şu an çalışılıyor" />
        <StatCard label="Ort. Çözüm Süresi" value={PO_KPI.avgResolution} sub="Hedef ≤ 4 sa" accent="green" />
        <StatCard label="MTTR" value={PO_KPI.mttr} sub="Kritik müdahaleler" accent="green" />
      </div>

      <Section title="Operasyon Kuyrukları" sub="Aktif iş yükü ve SLA durumu">
        <div className="po-q-grid">
          {PO_QUEUES.map((q) => {
            const pct = Math.round(((q.total - q.breach) / q.total) * 100);
            return (
              <div key={q.code} className="po-q-card" style={{ "--qc": q.color } as CSSProperties}>
                <div className="po-q-card__head">
                  <div>
                    <div className="po-q-card__label">{q.label}</div>
                    <div className="po-q-card__owner">Sorumlu: <b>{q.owner}</b></div>
                  </div>
                  <div className="po-q-card__count">{q.total}</div>
                </div>
                <div className="po-q-card__bar">
                  <div className="po-q-card__fill" style={{ "--fill-w": pct + "%" } as CSSProperties}></div>
                </div>
                <div className="po-q-card__stats">
                  <span><b>{q.sla}</b> SLA içinde</span>
                  <span className={q.breach > 0 ? "po-q-card__breach" : ""}>
                    {q.breach > 0 ? `▲ ${q.breach} ihlal` : "✓ İhlal yok"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="split-2-1">
        <Section
          title="Aktif Müdahaleler"
          sub={`${PO_INTERVENTIONS.length} kayıt · filtreler sağda`}
          action={
            <div className="po-filter">
              {(["all", "critical", "high", "medium", "low"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={"po-filter__btn" + (interventionFilter === f ? " on" : "")}
                  onClick={() => setInterventionFilter(f)}
                >
                  {f === "all" ? "Tümü" : f === "critical" ? "Kritik" : f === "high" ? "Yüksek" : f === "medium" ? "Orta" : "Düşük"}
                </button>
              ))}
            </div>
          }
        >
          <div className="po-int-list">
            {filteredInterventions.length === 0 ? (
              <div className="po-empty">Bu filtrede müdahale yok.</div>
            ) : (
              filteredInterventions.map((i) => (
                <div key={i.id} className={`po-int po-int--${i.type}`}>
                  <div className="po-int__l">
                    <div className="po-int__id">{i.id}</div>
                    <span className={`po-int__tag po-int__tag--${i.type}`}>
                      {i.type === "critical" ? "KRİTİK" : i.type === "high" ? "YÜKSEK" : i.type === "medium" ? "ORTA" : "DÜŞÜK"}
                    </span>
                  </div>
                  <div className="po-int__body">
                    <div className="po-int__title">{i.title}</div>
                    <div className="po-int__meta">
                      <span>{i.tenant}</span>
                      <span>·</span>
                      <span>Aşama: <b>{i.stage}</b></span>
                      <span>·</span>
                      <span>Sorumlu: <b>{i.owner}</b></span>
                    </div>
                  </div>
                  <div className="po-int__r">
                    <div className="po-int__sla">
                      <div className="po-int__age">{i.age}</div>
                      <div className="po-int__sla-target">SLA: {i.sla}</div>
                    </div>
                    <button type="button" className="po-int__action">{i.action} →</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section title="Operatör Yük Dağılımı" sub="5 operatör · canlı durum">
          <div className="po-assignees">
            {PO_ASSIGNEES.map((a) => (
              <div key={a.name} className="po-assignee">
                <div className="po-assignee__head">
                  <div className="po-assignee__avatar">
                    {a.name.split(" ").map((s) => s[0]).join("")}
                  </div>
                  <div className="po-assignee__meta">
                    <b>{a.name}</b>
                    <span>{a.role}</span>
                  </div>
                  <div className="po-assignee__score">{a.score}</div>
                </div>
                <div className="po-assignee__stats">
                  <div><b>{a.open}</b><span>açık iş</span></div>
                  <div><b>{a.sla} sa</b><span>ort. çözüm</span></div>
                </div>
                <div className="po-assignee__bar">
                  <div
                    className={`po-assignee__fill po-assignee__fill--${a.open > 7 ? "red" : a.open > 4 ? "amber" : "green"}`}
                    style={{ "--fill-w": Math.min(100, a.open * 10) + "%" } as CSSProperties}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Olay Akışı · Canlı" sub="Sistem ve operatör aksiyonları">
        <div className="po-events">
          {PO_EVENTS.map((e, idx) => (
            <div key={idx} className={`po-event po-event--${e.level}`}>
              <div className="po-event__time">{e.time}</div>
              <div className="po-event__dot"></div>
              <div className="po-event__body">
                <div className="po-event__title">
                  <b>{e.actor}</b>
                  <span className="po-event__source">{e.source}</span>
                  <span className="po-event__action">{e.action}</span>
                </div>
                <div className="po-event__target">{e.target}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
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

  const nextAction =
    !hasOwner
      ? "Once operasyon sahibi ata, sonra destek durumunu guncelle."
      : status === "waiting_owner"
        ? "Owner ile teyit al ve kaydi in_progress durumuna cek."
        : status === "new"
          ? "İlk aksiyon notunu gir ve süreci başlat."
          : status === "resolved"
            ? "Kapanis nedenini kontrol et, eksikse tamamla."
            : "Mevcut adımı notlayarak süreci tamamla.";

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
  if (key.includes("triage")) return "Öncelikli İş Listesi";
  return title.replace(/owner/gi, "sorumlu").replace(/triage/gi, "oncelik");
}
