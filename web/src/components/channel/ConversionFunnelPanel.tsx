import React from "react";
import type { ChannelConversionMetrics } from "../../services/profile.service";
import { SectionCard } from "./ChannelPrimitives";
import "./ConversionFunnelPanel.css";

interface ConversionFunnelPanelProps {
  data: ChannelConversionMetrics | null;
}

function rateBox(label: string, value: number, valueClass: string) {
  return (
    <div className="conversion-funnel-panel__rate-card">
      <div className="conversion-funnel-panel__rate-label">{label}</div>
      <div className={`conversion-funnel-panel__rate-value ${valueClass}`}>
        {value.toLocaleString("tr-TR")}%
      </div>
    </div>
  );
}

export function ConversionFunnelPanel({ data }: ConversionFunnelPanelProps) {
  if (!data) {
    return <p className="conversion-funnel-panel__empty">Funnel verisi bulunmuyor.</p>;
  }

  const trend = data.daily_trend?.slice(-7) ?? [];

  return (
    <SectionCard>
      <div className="conversion-funnel-panel">
        <div className="conversion-funnel-panel__grid">
          {rateBox("Tiklama > Kayit", data.funnel_ratio_click_to_signup ?? 0, "conversion-funnel-panel__rate-value--clicks")}
          {rateBox("Kayit > Aktivasyon", data.funnel_ratio_signup_to_activation ?? 0, "conversion-funnel-panel__rate-value--signup")}
          {rateBox("Aktivasyon > Partner", data.funnel_ratio_activation_to_partner ?? 0, "conversion-funnel-panel__rate-value--partner")}
        </div>

        <div className="conversion-funnel-panel__trend-shell">
          <div className="conversion-funnel-panel__trend-title">Son 7 Gun Trend</div>
          {trend.length === 0 ? (
            <div className="conversion-funnel-panel__trend-empty">Trend verisi yok.</div>
          ) : (
            <div className="conversion-funnel-panel__trend-list">
              {trend.map((day) => (
                <div key={day.day} className="conversion-funnel-panel__trend-item">
                  {day.day}: {day.clicks} tiklama / {day.signups} kayit / {day.activations} aktivasyon
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default ConversionFunnelPanel;
