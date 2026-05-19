import React from "react";
import type { ChannelCommissionReport } from "../../services/profile.service";

interface CommissionOverviewPanelProps {
  report: ChannelCommissionReport | null;
  loading: boolean;
}

export function CommissionOverviewPanel({ report, loading }: CommissionOverviewPanelProps) {
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #dcfce7", paddingTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Komisyon Period Raporu</h3>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {loading ? "Yukleniyor..." : report?.period || "30d"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, backgroundColor: "#ffffff" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Bekleyen</div>
          <strong>{(report?.totals.pending ?? 0).toLocaleString("tr-TR")} ₺</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, backgroundColor: "#ffffff" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Onaylanan</div>
          <strong>{(report?.totals.approved ?? 0).toLocaleString("tr-TR")} ₺</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, backgroundColor: "#ffffff" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Odenen</div>
          <strong>{(report?.totals.paid ?? 0).toLocaleString("tr-TR")} ₺</strong>
        </div>
        <div style={{ border: "1px solid #c7f9cc", borderRadius: 10, padding: 10, backgroundColor: "#f0fdf4" }}>
          <div style={{ fontSize: 12, color: "#166534" }}>Net Tahakkuk</div>
          <strong>{(report?.totals.net ?? 0).toLocaleString("tr-TR")} ₺</strong>
        </div>
      </div>
      <div style={{ border: "1px dashed #bbf7d0", borderRadius: 10, padding: 10, backgroundColor: "#f8fff9" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          Rapor kaydi: {report?.entry_count ?? 0}
        </div>
        <div style={{ fontSize: 13, color: "#334155" }}>
          {report?.by_event_type.length
            ? report.by_event_type
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
