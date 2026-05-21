import React from "react";
import type { ChannelCommissionReport } from "../../services/profile.service";
import "./CommissionOverviewPanel.css";

interface CommissionOverviewPanelProps {
  report: ChannelCommissionReport | null;
  loading: boolean;
}

export function CommissionOverviewPanel({ report, loading }: CommissionOverviewPanelProps) {
  const totals = report?.totals;
  const eventTypeBreakdown = report?.by_event_type ?? [];

  return (
    <div className="commission-overview-panel">
      <div className="commission-overview-panel__header">
        <h3 className="commission-overview-panel__title">Komisyon Period Raporu</h3>
        <span className="commission-overview-panel__period">
          {loading ? "Yukleniyor..." : report?.period || "30d"}
        </span>
      </div>

      <div className="commission-overview-panel__summary-grid">
        <div className="commission-overview-panel__summary-card">
          <div className="commission-overview-panel__summary-label">Bekleyen</div>
          <strong className="commission-overview-panel__summary-value">
            {(totals?.pending ?? 0).toLocaleString("tr-TR")} ₺
          </strong>
        </div>
        <div className="commission-overview-panel__summary-card">
          <div className="commission-overview-panel__summary-label">Onaylanan</div>
          <strong className="commission-overview-panel__summary-value">
            {(totals?.approved ?? 0).toLocaleString("tr-TR")} ₺
          </strong>
        </div>
        <div className="commission-overview-panel__summary-card">
          <div className="commission-overview-panel__summary-label">Odenen</div>
          <strong className="commission-overview-panel__summary-value">
            {(totals?.paid ?? 0).toLocaleString("tr-TR")} ₺
          </strong>
        </div>
        <div className="commission-overview-panel__summary-card commission-overview-panel__summary-card--net">
          <div className="commission-overview-panel__summary-label commission-overview-panel__summary-label--net">
            Net Tahakkuk
          </div>
          <strong className="commission-overview-panel__summary-value commission-overview-panel__summary-value--net">
            {(totals?.net ?? 0).toLocaleString("tr-TR")} ₺
          </strong>
        </div>
      </div>

      <div className="commission-overview-panel__breakdown">
        <div className="commission-overview-panel__breakdown-meta">
          Rapor kaydi: {report?.entry_count ?? 0}
        </div>
        <div className="commission-overview-panel__breakdown-text">
          {eventTypeBreakdown.length
            ? eventTypeBreakdown
                .slice(0, 3)
                .map((item) => `${item.event_type}: ${item.amount.toLocaleString("tr-TR")} ₺`)
                .join(" | ")
            : "Bu period icin event bazli komisyon dagilimi yok."}
        </div>
      </div>
    </div>
  );
}

export default CommissionOverviewPanel;
