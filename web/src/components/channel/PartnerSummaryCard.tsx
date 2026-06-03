import React from "react";
import type { ChannelProfileSummary } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";
import "./PartnerSummaryCard.css";

interface PartnerSummaryCardProps {
  summary: ChannelProfileSummary | null;
  loading: boolean;
}

export function PartnerSummaryCard({ summary, loading }: PartnerSummaryCardProps) {
  return (
    <SectionCard backgroundColor="#f8fafc" borderColor="#e2e8f0">
      <SectionHeader
        title="İş Ortağı Özet Kartı"
        right={
          <span className="psc-header-name">
            {loading ? "Guncelleniyor..." : summary?.display_name || "-"}
          </span>
        }
      />

      <div className="psc-stats-grid">
        <StatCard
          label="Toplam Ekip"
          value={<span className="psc-stat-value">{summary?.total_team_size ?? "-"}</span>}
          borderColor="#dbeafe"
          backgroundColor="#eff6ff"
          labelColor="#334155"
        />
        <StatCard
          label="Aktif Ekip"
          value={<span className="psc-stat-value">{summary?.active_team_size ?? "-"}</span>}
          borderColor="#dcfce7"
          backgroundColor="#f0fdf4"
          labelColor="#334155"
        />
        <StatCard
          label="Son 30 Gün Yeni Müşteri"
          value={<span className="psc-stat-value">{summary?.last_30d_new_customers ?? "-"}</span>}
          borderColor="#fde68a"
          backgroundColor="#fffbeb"
          labelColor="#334155"
        />
        <StatCard
          label="Bu Ay Net Komisyon"
          value={<span className="psc-stat-value">{summary ? `${summary.commission_net_current_month.toLocaleString("tr-TR")} ₺` : "-"}</span>}
          borderColor="#fecaca"
          backgroundColor="#fef2f2"
          labelColor="#334155"
        />
      </div>

      <div className="psc-stats-grid psc-stats-grid--no-mb">
        <StatCard label="Bekleyen" value={`${summary?.commission_pending.toLocaleString("tr-TR") ?? "-"} ₺`} />
        <StatCard label="Onaylanan" value={`${summary?.commission_approved.toLocaleString("tr-TR") ?? "-"} ₺`} />
        <StatCard label="Odenen" value={`${summary?.commission_paid.toLocaleString("tr-TR") ?? "-"} ₺`} />
      </div>
    </SectionCard>
  );
}

export default PartnerSummaryCard;
