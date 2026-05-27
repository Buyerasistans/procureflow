import React from "react";
import type {
  ChannelCommissionReport,
  ChannelConversionMetrics,
} from "../../services/profile.service";
import { ConversionFunnelPanel } from "./ConversionFunnelPanel";
import { CommissionOverviewPanel } from "./CommissionOverviewPanel";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";
import "./ConversionOverviewPanel.css";

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
  const referralBreakdown = conversionMetrics?.referral_breakdown ?? [];

  return (
    <SectionCard borderColor="#dcfce7" marginBottom={20}>
      <div className="conversion-overview-panel">
        <SectionHeader
          title="Ag ve Donusum"
          right={
            <div className="conversion-overview-panel__header-actions">
              <span className="conversion-overview-panel__header-period">
                {conversionLoading ? "Yukleniyor..." : "Son 30 gun"}
              </span>
              <button
                type="button"
                onClick={onCommissionSync}
                disabled={commissionSyncLoading}
                className={`conversion-overview-panel__sync-button ${
                  commissionSyncLoading ? "conversion-overview-panel__sync-button--loading" : ""
                }`}
              >
                {commissionSyncLoading ? "Hesaplaniyor..." : "Komisyonu Senkronize Et"}
              </button>
            </div>
          }
        />

        <div className="conversion-overview-panel__metrics-grid">
          <StatCard label="Tiklama" value={(conversionMetrics?.clicks ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Kayit" value={(conversionMetrics?.signups ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Aktivasyon" value={(conversionMetrics?.activations ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Partnere Donusen" value={(conversionMetrics?.converted_partner_count ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Tedarikçiye Dönüşen" value={(conversionMetrics?.converted_supplier_count ?? 0).toLocaleString("tr-TR")} />
          <StatCard label="Tedarikçiden Partnere" value={(conversionMetrics?.supplier_to_partner_count ?? 0).toLocaleString("tr-TR")} />
        </div>

        <ConversionFunnelPanel data={conversionMetrics} />

        <div>
          <div className="conversion-overview-panel__section-title">
            Link Bazli Donusum Kirilimi
          </div>
          {!conversionMetrics || referralBreakdown.length === 0 ? (
            <p className="conversion-overview-panel__empty">
              Henuz link bazli veri yok.
            </p>
          ) : (
            <div className="conversion-overview-panel__table-shell">
              <table className="conversion-overview-panel__table">
                <thead className="conversion-overview-panel__thead">
                  <tr>
                    <th className="conversion-overview-panel__th">Link</th>
                    <th className="conversion-overview-panel__th">Hedef</th>
                    <th className="conversion-overview-panel__th conversion-overview-panel__th--right">Tiklama</th>
                    <th className="conversion-overview-panel__th conversion-overview-panel__th--right">Kayit</th>
                    <th className="conversion-overview-panel__th conversion-overview-panel__th--right">Aktivasyon</th>
                    <th className="conversion-overview-panel__th conversion-overview-panel__th--right">Net Komisyon</th>
                    <th className="conversion-overview-panel__th conversion-overview-panel__th--right">Kayit Basina Komisyon</th>
                  </tr>
                </thead>
                <tbody>
                  {referralBreakdown.slice(0, 8).map((row) => (
                    <tr key={row.link_code} className="conversion-overview-panel__tr">
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--link">
                        {row.link_code}
                      </td>
                      <td className="conversion-overview-panel__td">{row.target_type || "mixed"}</td>
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--right">{row.clicks}</td>
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--right">{row.signups}</td>
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--right">{row.activations}</td>
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--right conversion-overview-panel__td--commission">
                        {row.net_commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="conversion-overview-panel__td conversion-overview-panel__td--right conversion-overview-panel__td--commission">
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

        <ConversionFunnelPanel data={conversionMetrics} />
        <CommissionOverviewPanel report={commissionReport} loading={commissionLoading} />
      </div>
    </SectionCard>
  );
}

export default ConversionOverviewPanel;
