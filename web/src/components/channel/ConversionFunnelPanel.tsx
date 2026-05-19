import React from "react";
import type { ChannelConversionMetrics } from "../../services/profile.service";

interface ConversionFunnelPanelProps {
  data: ChannelConversionMetrics | null;
}

function rateBox(label: string, value: number, color: string) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, backgroundColor: "#fff" }}>
      <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value.toLocaleString("tr-TR")}%</div>
    </div>
  );
}

export function ConversionFunnelPanel({ data }: ConversionFunnelPanelProps) {
  if (!data) {
    return <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>Funnel verisi bulunmuyor.</p>;
  }

  const trend = data.daily_trend?.slice(-7) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {rateBox("Tiklama > Kayit", data.funnel_ratio_click_to_signup ?? 0, "#1d4ed8")}
        {rateBox("Kayit > Aktivasyon", data.funnel_ratio_signup_to_activation ?? 0, "#047857")}
        {rateBox("Aktivasyon > Partner", data.funnel_ratio_activation_to_partner ?? 0, "#7c3aed")}
      </div>

      <div style={{ border: "1px dashed #bfdbfe", borderRadius: 8, padding: 10, backgroundColor: "#f8fbff" }}>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Son 7 Gun Trend</div>
        {trend.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Trend verisi yok.</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {trend.map((d) => (
              <div key={d.day} style={{ fontSize: 12, color: "#334155" }}>
                {d.day}: {d.clicks} tiklama / {d.signups} kayit / {d.activations} aktivasyon
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversionFunnelPanel;
