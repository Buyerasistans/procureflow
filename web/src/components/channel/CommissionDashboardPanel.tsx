import React from "react";
import type { AdminCommissionDashboard } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";

interface CommissionDashboardPanelProps {
  data: AdminCommissionDashboard | null;
  loading: boolean;
  onRefresh?: () => void;
}

export function CommissionDashboardPanel({
  data,
  loading,
  onRefresh,
}: CommissionDashboardPanelProps) {
  return (
    <SectionCard backgroundColor="#f0fdf4" borderColor="#bbf7d0">
      <SectionHeader
        title="Komisyon Ozet Paneli"
        right={
          onRefresh ? (
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 6,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                cursor: "pointer",
              }}
            >
              Yenile
            </button>
          ) : null
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Bekleyen"
          value={
            <span style={{ fontSize: 18, color: "#d97706" }}>
              {loading ? "..." : `${(data?.total_pending ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}
            </span>
          }
          borderColor="#fde68a"
          backgroundColor="#fffbeb"
          labelColor="#78350f"
        />
        <StatCard
          label="Onaylandi"
          value={
            <span style={{ fontSize: 18, color: "#16a34a" }}>
              {loading ? "..." : `${(data?.total_approved ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}
            </span>
          }
          borderColor="#bbf7d0"
          backgroundColor="#f0fdf4"
          labelColor="#14532d"
        />
        <StatCard
          label="Odendi"
          value={
            <span style={{ fontSize: 18, color: "#2563eb" }}>
              {loading ? "..." : `${(data?.total_paid ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}
            </span>
          }
          borderColor="#bfdbfe"
          backgroundColor="#eff6ff"
          labelColor="#1e3a8a"
        />
        <StatCard
          label="Iptal"
          value={
            <span style={{ fontSize: 18, color: "#dc2626" }}>
              {loading ? "..." : `${(data?.total_cancelled ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}
            </span>
          }
          borderColor="#fecaca"
          backgroundColor="#fef2f2"
          labelColor="#7f1d1d"
        />
      </div>

      {/* Org bazli breakdown */}
      {!loading && (data?.org_breakdown?.length ?? 0) > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#14532d",
              marginBottom: 8,
            }}
          >
            Kanal Organizasyon Dagilimi
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#dcfce7", borderBottom: "1px solid #bbf7d0" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Organizasyon</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Bekleyen</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Onaylandi</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Odendi</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Iptal</th>
                </tr>
              </thead>
              <tbody>
                {data!.org_breakdown.map((row) => (
                  <tr
                    key={row.org_id}
                    style={{ borderBottom: "1px solid #f0fdf4" }}
                  >
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                      {row.org_name ?? `Org #${row.org_id}`}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#d97706" }}>
                      {(row.pending ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#16a34a" }}>
                      {(row.approved ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#2563eb" }}>
                      {(row.paid ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>
                      {(row.cancelled ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && (data?.org_breakdown?.length ?? 0) === 0 && (
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          Henuz komisyon verisi bulunmuyor.
        </div>
      )}

      {!loading && (data?.referral_breakdown?.length ?? 0) > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#14532d",
              marginBottom: 8,
            }}
          >
            Referral Link / Kampanya Takip Tablosu
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Org</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Link</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Kampanya</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Hedef</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Tiklama</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Kayit</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Aktivasyon</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Net Komisyon</th>
                </tr>
              </thead>
              <tbody>
                {data!.referral_breakdown.slice(0, 30).map((row) => (
                  <tr key={row.link_code} style={{ borderBottom: "1px solid #ecfeff" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                      {row.org_name ?? (row.org_id ? `Org #${row.org_id}` : "-")}
                    </td>
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: "#1d4ed8" }}>
                      {row.link_code}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {row.campaign_name ?? (row.campaign_id ? `#${row.campaign_id}` : "Genel")}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{row.target_type ?? "mixed"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{row.clicks}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{row.signups}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{row.activations}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#166534", fontWeight: 700 }}>
                      {row.net_commission.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
