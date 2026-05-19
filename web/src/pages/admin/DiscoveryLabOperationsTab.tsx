import type { ReactNode, MutableRefObject, RefObject } from "react";
import type { DiscoveryLabAnswerAuditSummary, DiscoveryLabSummary } from "../../services/admin.service";
import type { Quote, QuoteAuditTrail, QuotePendingApproval, StatusLog } from "../../services/quote.service";
import type { ApprovalRoleInfo } from "../../types/approval";
import { QuoteStatusColor, QuoteStatusLabel, normalizeQuoteStatus } from "../../types/quote.types";
import type { AdminFocusBannerTone } from "./adminPageMeta";

// --- Local types (mirrored from AdminPage) ---
type RestoreDebugEventType = "restore" | "action" | "lifecycle";
type RestoreDebugSeverity = "high" | "medium" | "low";
type RestoreDebugEvent = { id: string; label: string; detail: string; type: RestoreDebugEventType; createdAt: number };

export type TelemetryPulseTarget = {
  quoteId: number;
  section: "status-history" | "full-audit-trail";
  reason: string;
};

export type FocusTelemetryEvent = {
  id: string;
  label: string;
  detail: string;
  source: string;
  createdAt: number;
  targetQuoteId?: number;
  targetSection?: "status-history" | "full-audit-trail";
};

// --- Pure helpers (mirrored from AdminPage) ---
function formatAdminFocusTimestamp(value?: number | null) {
  if (!value) return "Az once";
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
    return { label: "Restore", severity: "high", accent: "#1d4ed8", background: "#eff6ff", border: "#bfdbfe", severityLabel: "Yuksek Onem", severityColor: "#1d4ed8", severityBackground: "#dbeafe" };
  }
  if (type === "action") {
    return { label: "Aksiyon", severity: "medium", accent: "#b45309", background: "#fff7ed", border: "#fed7aa", severityLabel: "Operator", severityColor: "#b45309", severityBackground: "#ffedd5" };
  }
  return { label: "Yasam Dongusu", severity: "low", accent: "#6d28d9", background: "#f5f3ff", border: "#ddd6fe", severityLabel: "Bilgi", severityColor: "#6d28d9", severityBackground: "#ede9fe" };
}

// --- Props ---
interface DiscoveryLabOperationsTabProps {
  // Toast
  showRestoredQuoteToast: boolean;
  restoredQuoteInsight: { quoteId: number; section: "status-history" | "full-audit-trail" } | null;
  isRestoredQuoteToastPaused: boolean;
  setIsRestoredQuoteToastPaused: (value: boolean) => void;
  clearRestoredQuoteInsight: () => void;
  restoredQuoteToastRef: RefObject<HTMLDivElement | null>;
  jumpToRestoredQuoteCard: () => void;
  setShowRestoredQuoteToast: (value: boolean) => void;
  restoredQuoteToastProgress: number;
  // Summary data
  discoveryLabSummary: DiscoveryLabSummary;
  discoveryLabAnswerAudits: DiscoveryLabAnswerAuditSummary[];
  sortedDiscoveryLabAnswerAudits: DiscoveryLabAnswerAuditSummary[];
  // Debug timeline
  restoredQuoteDebugEvents: RestoreDebugEvent[];
  isRestoredQuoteDebugTimelineHidden: boolean;
  restoredQuoteDebugFilter: "all" | RestoreDebugEventType;
  setRestoredQuoteDebugFilter: (value: "all" | RestoreDebugEventType) => void;
  restoredQuoteDebugSearchQuery: string;
  setRestoredQuoteDebugSearchQuery: (value: string) => void;
  restoredQuoteDebugReplayFilter: "all" | "last-replay-chain";
  setRestoredQuoteDebugReplayFilter: (value: "all" | "last-replay-chain") => void;
  filteredRestoredQuoteDebugEvents: RestoreDebugEvent[];
  removeRestoredQuoteDebugEvent: (id: string) => void;
  restoredQuoteReplayTarget: "status-history" | "full-audit-trail";
  setRestoredQuoteReplayTarget: (value: "status-history" | "full-audit-trail") => void;
  clearRestoredQuoteDebugEvents: () => void;
  replayRestoredQuoteInsight: () => void;
  // Focus banner
  renderAdminFocusBanner: (options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel?: string;
    timestamp?: number | null;
    actions?: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId?: string;
  }) => ReactNode;
  // Telemetry
  selectedFocusTelemetryTarget: { quoteId: number; section: string; label: string; detail: string } | null;
  replayChainTargetQuoteId: number | null;
  focusTelemetryEvents: FocusTelemetryEvent[];
  focusTelemetryQuickAction: (id: string) => void;
  focusTelemetryPanelRef: RefObject<HTMLDivElement | null>;
  telemetryPulseTarget: TelemetryPulseTarget | null;
  setTelemetryPulseTarget: (value: TelemetryPulseTarget | null) => void;
  selectedFocusTelemetryActionSourceId: string | null;
  setFocusTelemetrySelectedEventId: (value: string | null) => void;
  // Audit card refs
  discoveryQuoteCardRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  discoveryQuoteStatusHistoryRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  discoveryQuoteAuditTrailRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  // Quote insight data
  expandedDiscoveryQuoteInsightId: number | null;
  discoveryQuoteById: Record<number, Quote>;
  discoveryQuotePendingApprovalsById: Record<number, QuotePendingApproval[]>;
  discoveryQuoteInsightLoadingId: number | null;
  discoveryQuoteInsightErrorById: Record<number, string>;
  discoveryQuoteHistoryById: Record<number, StatusLog[]>;
  discoveryQuoteAuditTrailById: Record<number, QuoteAuditTrail>;
  // Actions
  toggleDiscoveryQuoteInsights: (quoteId: number) => void;
  openTenantGovernanceTab: (tenantId?: number | null, tenantName?: string | null) => void;
  openProjectsTab: (projectName?: string | null) => void;
  buildAdminReturnQuery: (audit: DiscoveryLabAnswerAuditSummary, quoteInsight?: string) => string;
  resolveApprovalRoleLabel: (approval: ApprovalRoleInfo) => string | null;
  restoredQuoteRiskBadges: (quoteId: number) => Array<{ key: string; label: string; detail: string; background: string; color: string }>;
}

export function DiscoveryLabOperationsTab({
  showRestoredQuoteToast,
  restoredQuoteInsight,
  isRestoredQuoteToastPaused,
  setIsRestoredQuoteToastPaused,
  clearRestoredQuoteInsight,
  restoredQuoteToastRef,
  jumpToRestoredQuoteCard,
  setShowRestoredQuoteToast,
  restoredQuoteToastProgress,
  discoveryLabSummary,
  discoveryLabAnswerAudits,
  sortedDiscoveryLabAnswerAudits,
  restoredQuoteDebugEvents,
  isRestoredQuoteDebugTimelineHidden,
  restoredQuoteDebugFilter,
  setRestoredQuoteDebugFilter,
  restoredQuoteDebugSearchQuery,
  setRestoredQuoteDebugSearchQuery,
  restoredQuoteDebugReplayFilter,
  setRestoredQuoteDebugReplayFilter,
  filteredRestoredQuoteDebugEvents,
  removeRestoredQuoteDebugEvent,
  restoredQuoteReplayTarget,
  setRestoredQuoteReplayTarget,
  clearRestoredQuoteDebugEvents,
  replayRestoredQuoteInsight,
  renderAdminFocusBanner,
  selectedFocusTelemetryTarget,
  replayChainTargetQuoteId,
  focusTelemetryEvents,
  focusTelemetryQuickAction,
  focusTelemetryPanelRef,
  telemetryPulseTarget,
  setTelemetryPulseTarget,
  selectedFocusTelemetryActionSourceId,
  setFocusTelemetrySelectedEventId,
  discoveryQuoteCardRefs,
  discoveryQuoteStatusHistoryRefs,
  discoveryQuoteAuditTrailRefs,
  expandedDiscoveryQuoteInsightId,
  discoveryQuoteById,
  discoveryQuotePendingApprovalsById,
  discoveryQuoteInsightLoadingId,
  discoveryQuoteInsightErrorById,
  discoveryQuoteHistoryById,
  discoveryQuoteAuditTrailById,
  toggleDiscoveryQuoteInsights,
  openTenantGovernanceTab,
  openProjectsTab,
  buildAdminReturnQuery,
  resolveApprovalRoleLabel,
  restoredQuoteRiskBadges,
}: DiscoveryLabOperationsTabProps) {
  return (
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
  );
}
