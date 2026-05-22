import React from "react";
import type { CampaignChannel } from "../../services/profile.service";
import "./CampaignPanel.css";

interface CampaignPanelProps {
  campaigns: CampaignChannel[];
}

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  live: "Canlı",
  draft: "Taslak",
  ended: "Bitti",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#047857",
  live: "#1d4ed8",
  draft: "#92400e",
  ended: "#6b7280",
  cancelled: "#dc2626",
};

const REWARD_LABELS: Record<string, string> = {
  quote_bonus: "Teklif Bonusu",
  project_visibility: "Proje Görünürlüğü",
  special_list_access: "Özel Liste Erişimi",
  strategic_quote_access: "Stratejik Teklif Erişimi",
  permission_override: "Yetki Genişletme",
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="campaign-card__progress-bar">
      <div
        className={`campaign-card__progress-bar-fill ${pct >= 100 ? "campaign-card__progress-bar-fill--complete" : "campaign-card__progress-bar-fill--incomplete"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignChannel }) {
  const statusLabel = STATUS_LABELS[campaign.status] ?? campaign.status;
  const statusColor = STATUS_COLORS[campaign.status] ?? "#6b7280";
  const sortedRules = [...campaign.rules].sort((a, b) => a.sort_order - b.sort_order);
  const nextRule = sortedRules.find(
    (r) => r.threshold_count > campaign.my_progress_count
  );
  const isJoined = campaign.my_progress_count > 0;
  const earnedCount = campaign.my_grants.length;

  return (
    <div
      data-testid="campaign-card"
      className={`campaign-card ${isJoined ? "campaign-card--joined" : "campaign-card--default"}`}
    >
      {/* Başlık satırı */}
      <div className="campaign-card__header">
        <div>
          <span className="campaign-card__name">{campaign.name}</span>
          {campaign.description && (
            <p className="campaign-card__description">
              {campaign.description}
            </p>
          )}
        </div>
        <span
          className="campaign-card__status"
          style={{ backgroundColor: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      {/* İlerleme */}
      {nextRule ? (
        <div>
          <div className="campaign-card__progress-header">
            <span>İlerleme</span>
            <span>
              {campaign.my_progress_count} / {nextRule.threshold_count}
            </span>
          </div>
          <ProgressBar value={campaign.my_progress_count} max={nextRule.threshold_count} />
          <div className="campaign-card__next-reward">
            Sonraki ödül:{" "}
            <strong>{REWARD_LABELS[nextRule.reward_type] ?? nextRule.reward_type}</strong>
          </div>
        </div>
      ) : sortedRules.length > 0 ? (
        <div className="campaign-card__completed">
          ✓ Tüm basamaklar tamamlandı
        </div>
      ) : null}

      {/* Kazanılan ödüller */}
      {earnedCount > 0 && (
        <div className="campaign-card__grants">
          {campaign.my_grants.map((gt, i) => (
            <span
              key={i}
              className="campaign-card__grant"
            >
              {REWARD_LABELS[gt] ?? gt}
            </span>
          ))}
        </div>
      )}

      {/* Bitiş tarihi */}
      {campaign.ends_at && (
        <div className="campaign-card__end-date">
          Bitiş: {new Date(campaign.ends_at).toLocaleDateString("tr-TR")}
        </div>
      )}
    </div>
  );
}

export function CampaignPanel({ campaigns }: CampaignPanelProps) {
  if (campaigns.length === 0) {
    return (
      <p className="campaign-panel__empty">
        Şu an aktif kampanya bulunmuyor.
      </p>
    );
  }

  return (
    <div className="campaign-panel">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </div>
  );
}

export default CampaignPanel;
