import React from "react";
import type { TeamPerformance } from "../../services/profile.service";

interface TeamPerformanceTableProps {
  data: TeamPerformance | null;
}

function roleLabel(role: string): string {
  if (role === "channel.account_owner") return "Hesap Sahibi";
  if (role === "channel.team_lead") return "Ekip Lideri";
  if (role === "channel.junior_agent") return "Junior";
  return "Temsilci";
}

export function TeamPerformanceTable({ data }: TeamPerformanceTableProps) {
  if (!data || data.rows.length === 0) {
    return <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Performans verisi bulunmuyor.</p>;
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc", textAlign: "left" }}>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>Uye</th>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>Rol</th>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>Toplam Referral</th>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>30 Gun Referral</th>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>Komisyon (Baz)</th>
            <th style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>Skor</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.slice(0, 10).map((row) => (
            <tr key={row.user_id} style={{ borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 12px", fontSize: 13, color: row.is_active ? "#111827" : "#9ca3af" }}>
                {row.display_name}
              </td>
              <td style={{ padding: "10px 12px", fontSize: 12, color: "#475569" }}>{roleLabel(row.role_profile_code)}</td>
              <td style={{ padding: "10px 12px", fontSize: 12 }}>{row.referral_count}</td>
              <td style={{ padding: "10px 12px", fontSize: 12 }}>{row.referral_last_30d}</td>
              <td style={{ padding: "10px 12px", fontSize: 12 }}>{row.commission_total.toLocaleString("tr-TR")} ₺</td>
              <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#0f766e" }}>{row.score_last_30d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TeamPerformanceTable;
