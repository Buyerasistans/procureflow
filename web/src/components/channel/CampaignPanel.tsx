import React from "react";
import type { CampaignChannel } from "../../services/profile.service";

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
    <div
      style={{
        width: "100%",
        height: 6,
        backgroundColor: "#e5e7eb",
        borderRadius: 3,
        overflow: "hidden",
        marginTop: 4,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          backgroundColor: pct >= 100 ? "#047857" : "#3b82f6",
          borderRadius: 3,
          transition: "width 0.3s ease",
        }}
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
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        backgroundColor: isJoined ? "#f0fdf4" : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Başlık satırı */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {campaign.name}
          </span>
          {campaign.description && (
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#6b7280" }}>
              {campaign.description}
            </p>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#fff",
            backgroundColor: statusColor,
            borderRadius: 4,
            padding: "2px 7px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* İlerleme */}
      {nextRule ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151" }}>
            <span>İlerleme</span>
            <span>
              {campaign.my_progress_count} / {nextRule.threshold_count}
            </span>
          </div>
          <ProgressBar value={campaign.my_progress_count} max={nextRule.threshold_count} />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
            Sonraki ödül:{" "}
            <strong>{REWARD_LABELS[nextRule.reward_type] ?? nextRule.reward_type}</strong>
          </div>
        </div>
      ) : sortedRules.length > 0 ? (
        <div style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>
          ✓ Tüm basamaklar tamamlandı
        </div>
      ) : null}

      {/* Kazanılan ödüller */}
      {earnedCount > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
          {campaign.my_grants.map((gt, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                backgroundColor: "#d1fae5",
                color: "#065f46",
                borderRadius: 4,
                padding: "2px 7px",
                fontWeight: 600,
              }}
            >
              {REWARD_LABELS[gt] ?? gt}
            </span>
          ))}
        </div>
      )}

      {/* Bitiş tarihi */}
      {campaign.ends_at && (
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          Bitiş: {new Date(campaign.ends_at).toLocaleDateString("tr-TR")}
        </div>
      )}
    </div>
  );
}

export function CampaignPanel({ campaigns }: CampaignPanelProps) {
  if (campaigns.length === 0) {
    return (
      <p style={{ color: "#9ca3af", fontSize: 13 }}>
        Şu an aktif kampanya bulunmuyor.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </div>
  );
}

export default CampaignPanel;
