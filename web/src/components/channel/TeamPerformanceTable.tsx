import React from "react";
import type { TeamPerformance } from "../../services/profile.service";
import "./TeamPerformanceTable.css";

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
    return <p className="tpt-empty">Performans verisi bulunmuyor.</p>;
  }

  return (
    <div className="tpt-wrap">
      <table className="tpt-table">
        <thead>
          <tr className="tpt-thead-row">
            <th className="tpt-th">Uye</th>
            <th className="tpt-th">Rol</th>
            <th className="tpt-th">Toplam Referral</th>
            <th className="tpt-th">30 Gun Referral</th>
            <th className="tpt-th">Komisyon (Baz)</th>
            <th className="tpt-th">Skor</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.slice(0, 10).map((row) => (
            <tr key={row.user_id} className="tpt-row">
              <td className={`tpt-td${row.is_active ? "" : " tpt-td--inactive"}`}>
                {row.display_name}
              </td>
              <td className="tpt-td--role">{roleLabel(row.role_profile_code)}</td>
              <td className="tpt-td--num">{row.referral_count}</td>
              <td className="tpt-td--num">{row.referral_last_30d}</td>
              <td className="tpt-td--num">{row.commission_total.toLocaleString("tr-TR")} ₺</td>
              <td className="tpt-td--score">{row.score_last_30d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TeamPerformanceTable;
