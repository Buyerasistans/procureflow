import React from "react";
import type {
  ChannelCommissionReport,
  ChannelConversionMetrics,
} from "../../services/profile.service";
import { ConversionFunnelPanel } from "./ConversionFunnelPanel";
import { CommissionOverviewPanel } from "./CommissionOverviewPanel";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";

interface ConversionOverviewPanelProps {
  conversionMetrics: ChannelConversionMetrics | null;
  conversionLoading: boolean;
  commissionReport: ChannelCommissionReport | null;
  commissionLoading: boolean;
  commissionSyncLoading: boolean;
  onCommissionSync: () => void;
}

export function ConversionOverviewPanel({
  conversionMetrics,
  conversionLoading,
  commissionReport,
  commissionLoading,
  commissionSyncLoading,
  onCommissionSync,
}: ConversionOverviewPanelProps) {
  return (
    <SectionCard borderColor="#dcfce7" marginBottom={20}>
      <SectionHeader
        title="Ag ve Donusum"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              {conversionLoading ? "Yukleniyor..." : "Son 30 gun"}
            </span>
            <button
              type="button"
              onClick={onCommissionSync}
              disabled={commissionSyncLoading}
              style={{
                border: "1px solid #86efac",
                borderRadius: 8,
                backgroundColor: commissionSyncLoading ? "#f1f5f9" : "#f0fdf4",
                color: "#166534",
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 10px",
                cursor: commissionSyncLoading ? "not-allowed" : "pointer",
              }}
            >
              {commissionSyncLoading ? "Hesaplaniyor..." : "Komisyonu Senkronize Et"}
            </button>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <StatCard label="Tiklama" value={conversionMetrics?.clicks ?? 0} />
        <StatCard label="Kayit" value={conversionMetrics?.signups ?? 0} />
        <StatCard label="Aktivasyon" value={conversionMetrics?.activations ?? 0} />
        <StatCard label="Partnere Donusen" value={conversionMetrics?.converted_partner_count ?? 0} />
        <StatCard label="Tedarikciye Donusen" value={conversionMetrics?.converted_supplier_count ?? 0} />
        <StatCard label="Tedarikciden Partnere" value={conversionMetrics?.supplier_to_partner_count ?? 0} />
      </div>

      <div style={{ marginTop: 14 }}>
        <ConversionFunnelPanel data={conversionMetrics} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 8 }}>
          Link Bazli Donusum Kirilimi
        </div>
        {!conversionMetrics || conversionMetrics.referral_breakdown.length === 0 ? (
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
            Henuz link bazli veri yok.
          </p>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflowX: "auto", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f8fafc", color: "#475569" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Link</th>
                  <th style={{ textAlign: "left", padding: "8px 10px" }}>Hedef</th>
                  <th style={{ textAlign: "right", padding: "8px 10px" }}>Tiklama</th>
                  <th style={{ textAlign: "right", padding: "8px 10px" }}>Kayit</th>
                  <th style={{ textAlign: "right", padding: "8px 10px" }}>Aktivasyon</th>
                  <th style={{ textAlign: "right", padding: "8px 10px" }}>Net Komisyon</th>
                  <th style={{ textAlign: "right", padding: "8px 10px" }}>Kayit Basina Komisyon</th>
                </tr>
              </thead>
              <tbody>
                {conversionMetrics.referral_breakdown.slice(0, 8).map((row) => (
                  <tr key={row.link_code} style={{ borderTop: "1px solid #f1f5f9", color: "#334155" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700 }}>{row.link_code}</td>
                    <td style={{ padding: "8px 10px" }}>{row.target_type || "mixed"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{row.clicks}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{row.signups}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{row.activations}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                      {row.net_commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1d4ed8" }}>
                      {(row.signups > 0 ? row.net_commission / row.signups : 0).toLocaleString("tr-TR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CommissionOverviewPanel report={commissionReport} loading={commissionLoading} />
    </SectionCard>
  );
}

export default ConversionOverviewPanel;
