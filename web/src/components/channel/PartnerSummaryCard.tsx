import React from "react";
import type { ChannelProfileSummary } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";

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
          <span style={{ fontSize: 12, color: "#475569" }}>
          {loading ? "Guncelleniyor..." : summary?.display_name || "-"}
          </span>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 10 }}>
        <StatCard
          label="Toplam Ekip"
          value={<span style={{ fontSize: 20 }}>{summary?.total_team_size ?? "-"}</span>}
          borderColor="#dbeafe"
          backgroundColor="#eff6ff"
          labelColor="#334155"
        />
        <StatCard
          label="Aktif Ekip"
          value={<span style={{ fontSize: 20 }}>{summary?.active_team_size ?? "-"}</span>}
          borderColor="#dcfce7"
          backgroundColor="#f0fdf4"
          labelColor="#334155"
        />
        <StatCard
          label="Son 30 Gün Yeni Müşteri"
          value={<span style={{ fontSize: 20 }}>{summary?.last_30d_new_customers ?? "-"}</span>}
          borderColor="#fde68a"
          backgroundColor="#fffbeb"
          labelColor="#334155"
        />
        <StatCard
          label="Bu Ay Net Komisyon"
          value={<span style={{ fontSize: 20 }}>{summary ? `${summary.commission_net_current_month.toLocaleString("tr-TR")} ₺` : "-"}</span>}
          borderColor="#fecaca"
          backgroundColor="#fef2f2"
          labelColor="#334155"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <StatCard label="Bekleyen" value={`${summary?.commission_pending.toLocaleString("tr-TR") ?? "-"} ₺`} />
        <StatCard label="Onaylanan" value={`${summary?.commission_approved.toLocaleString("tr-TR") ?? "-"} ₺`} />
        <StatCard label="Odenen" value={`${summary?.commission_paid.toLocaleString("tr-TR") ?? "-"} ₺`} />
      </div>
    </SectionCard>
  );
}

export default PartnerSummaryCard;
