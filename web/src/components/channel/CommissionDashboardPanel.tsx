import React from "react";
import type { AdminCommissionDashboard } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";
import "./CommissionDashboardPanel.css";

interface CommissionDashboardPanelProps {
  data: AdminCommissionDashboard | null;
  loading: boolean;
  onRefresh?: () => void;
}

const SUMMARY_CARD_STYLES = [
  {
    label: "Bekleyen",
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    labelColor: "#78350f",
    amountClass: "commission-dashboard-panel__amount--pending",
    value: (data: AdminCommissionDashboard | null, loading: boolean) =>
      loading ? "..." : `${(data?.total_pending ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`,
  },
  {
    label: "Onaylandi",
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    labelColor: "#14532d",
    amountClass: "commission-dashboard-panel__amount--approved",
    value: (data: AdminCommissionDashboard | null, loading: boolean) =>
      loading ? "..." : `${(data?.total_approved ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`,
  },
  {
    label: "Odendi",
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    labelColor: "#1e3a8a",
    amountClass: "commission-dashboard-panel__amount--paid",
    value: (data: AdminCommissionDashboard | null, loading: boolean) =>
      loading ? "..." : `${(data?.total_paid ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`,
  },
  {
    label: "Iptal",
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    labelColor: "#7f1d1d",
    amountClass: "commission-dashboard-panel__amount--cancelled",
    value: (data: AdminCommissionDashboard | null, loading: boolean) =>
      loading ? "..." : `${(data?.total_cancelled ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`,
  },
] as const;

export function CommissionDashboardPanel({
  data,
  loading,
  onRefresh,
}: CommissionDashboardPanelProps) {
  const orgBreakdown = data?.org_breakdown ?? [];
  const referralBreakdown = data?.referral_breakdown ?? [];

  return (
    <SectionCard backgroundColor="#f0fdf4" borderColor="#bbf7d0">
      <SectionHeader
        title="Komisyon Özet Paneli"
        right={
          onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="commission-dashboard-panel__refresh-button"
            >
              Yenile
            </button>
          ) : null
        }
      />

      <div className="commission-dashboard-panel__summary-grid">
        {SUMMARY_CARD_STYLES.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={
              <span className={`commission-dashboard-panel__amount ${card.amountClass}`}>
                {card.value(data, loading)}
              </span>
            }
            borderColor={card.borderColor}
            backgroundColor={card.backgroundColor}
            labelColor={card.labelColor}
          />
        ))}
      </div>

      {!loading && orgBreakdown.length > 0 ? (
        <div>
          <div className="commission-dashboard-panel__section-title">
            Kanal Organizasyon Dagilimi
          </div>
          <div className="commission-dashboard-panel__table-wrap">
            <table className="commission-dashboard-panel__table">
              <thead>
                <tr className="commission-dashboard-panel__table-head-row--org">
                  <th className="commission-dashboard-panel__th">Organizasyon</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Bekleyen</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Onaylandi</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Odendi</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Iptal</th>
                </tr>
              </thead>
              <tbody>
                {orgBreakdown.map((row) => (
                  <tr key={row.org_id} className="commission-dashboard-panel__row">
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--bold">
                      {row.org_name ?? `Org #${row.org_id}`}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--pending">
                      {(row.pending ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--approved">
                      {(row.approved ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--paid">
                      {(row.paid ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--cancelled">
                      {(row.cancelled ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && orgBreakdown.length === 0 ? (
        <div className="commission-dashboard-panel__empty">
          Henuz komisyon verisi bulunmuyor.
        </div>
      ) : null}

      {!loading && referralBreakdown.length > 0 ? (
        <div className="commission-dashboard-panel__referral-section">
          <div className="commission-dashboard-panel__referral-headline">
            Referral Link / Kampanya Takip Tablosu
          </div>
          <div className="commission-dashboard-panel__table-wrap">
            <table className="commission-dashboard-panel__table">
              <thead>
                <tr className="commission-dashboard-panel__table-head-row--referral">
                  <th className="commission-dashboard-panel__th">Org</th>
                  <th className="commission-dashboard-panel__th">Link</th>
                  <th className="commission-dashboard-panel__th">Kampanya</th>
                  <th className="commission-dashboard-panel__th">Hedef</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Tiklama</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Kayit</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Aktivasyon</th>
                  <th className="commission-dashboard-panel__th commission-dashboard-panel__th--right">Net Komisyon</th>
                </tr>
              </thead>
              <tbody>
                {referralBreakdown.slice(0, 30).map((row) => (
                  <tr key={row.link_code} className="commission-dashboard-panel__row--referral">
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__cell--bold">
                      {row.org_name ?? (row.org_id ? `Org #${row.org_id}` : "-")}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__referral-cell--link">
                      {row.link_code}
                    </td>
                    <td className="commission-dashboard-panel__cell">
                      {row.campaign_name ?? (row.campaign_id ? `#${row.campaign_id}` : "Genel")}
                    </td>
                    <td className="commission-dashboard-panel__cell">
                      {row.target_type ?? "mixed"}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__th--right">
                      {row.clicks}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__th--right">
                      {row.signups}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__th--right">
                      {row.activations}
                    </td>
                    <td className="commission-dashboard-panel__cell commission-dashboard-panel__referral-cell--commission">
                      {row.net_commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
