import React from "react";
import type { ChannelGamification } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";
import "./GamificationPanel.css";

interface GamificationPanelProps {
  data: ChannelGamification | null;
  loading: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
  L0: "Başlangıç",
  L1: "Bronz",
  L2: "Gumus",
  L3: "Altin",
};

const LEVEL_CLASSES: Record<string, string> = {
  L0: "gamification-panel__level-pill--L0",
  L1: "gamification-panel__level-pill--L1",
  L2: "gamification-panel__level-pill--L2",
  L3: "gamification-panel__level-pill--L3",
};

const PROGRESS_CLASSES: Record<number, string> = {
  0: "gamification-panel__progress-fill--0",
  10: "gamification-panel__progress-fill--10",
  20: "gamification-panel__progress-fill--20",
  30: "gamification-panel__progress-fill--30",
  40: "gamification-panel__progress-fill--40",
  50: "gamification-panel__progress-fill--50",
  60: "gamification-panel__progress-fill--60",
  70: "gamification-panel__progress-fill--70",
  80: "gamification-panel__progress-fill--80",
  90: "gamification-panel__progress-fill--90",
  100: "gamification-panel__progress-fill--100",
};

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score - full >= 0.5;

  return (
    <span className="gamification-panel__stars" aria-label={`Puan ${score.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        if (index < full) {
          return (
            <span key={index} className="gamification-panel__star gamification-panel__star--filled">
              ★
            </span>
          );
        }

        if (index === full && half) {
          return (
            <span key={index} className="gamification-panel__star gamification-panel__star--half">
              ⯨
            </span>
          );
        }

        return (
          <span key={index} className="gamification-panel__star gamification-panel__star--empty">
            ★
          </span>
        );
      })}
    </span>
  );
}

export function GamificationPanel({ data, loading }: GamificationPanelProps) {
  const levelCode = data?.level_code ?? "L0";
  const levelClass = LEVEL_CLASSES[levelCode] ?? LEVEL_CLASSES.L0;
  const performanceScore = data?.performance_score ?? 0;
  const roundedScore = Math.max(0, Math.min(100, Math.round(performanceScore)));
  const progressBucket = Math.floor(roundedScore / 10) * 10;
  const progressClass = PROGRESS_CLASSES[progressBucket] ?? PROGRESS_CLASSES[0];
  const badges = data?.badges ?? [];
  const gracePeriodRemaining = data?.grace_period_remaining ?? 0;

  return (
    <SectionCard backgroundColor="#fefce8" borderColor="#fde68a">
      <div className="gamification-panel">
        <SectionHeader
          title="Performans ve Seviye"
          right={
            loading ? (
              <span className="gamification-panel__loading-text">Yukleniyor...</span>
            ) : (
              <span className={`gamification-panel__level-pill ${levelClass}`}>
                {LEVEL_LABELS[levelCode] ?? levelCode}
              </span>
            )
          }
        />

        <div className="gamification-panel__score-row">
          <StarRating score={data?.star_score ?? 0} />
          <span className="gamification-panel__score-text">
            Performans skoru: <strong>{performanceScore}</strong> / 100
          </span>
          <span className="gamification-panel__score-text">
            Performans faktoru: <strong>×{data?.performance_factor ?? 0}</strong>
          </span>
        </div>

        <div className="gamification-panel__progress-track">
          <div className={`gamification-panel__progress-fill ${progressClass}`} />
        </div>

        <div className="gamification-panel__metrics-grid">
          <StatCard
            label="Toplam Referans"
            value={<span className="gamification-panel__metric-value">{data?.total_referrals ?? "-"}</span>}
            borderColor="#fde68a"
            backgroundColor="#fffbfb"
            labelColor="#78350f"
          />
          <StatCard
            label="Aktif Ekip"
            value={<span className="gamification-panel__metric-value">{data?.active_team_size ?? "-"}</span>}
            borderColor="#fde68a"
            backgroundColor="#fffbfb"
            labelColor="#78350f"
          />
          {gracePeriodRemaining > 0 ? (
            <StatCard
              label="Koruma Donemi"
              value={
                <span className="gamification-panel__metric-value gamification-panel__metric-value--warning">
                  {gracePeriodRemaining} donem
                </span>
              }
              borderColor="#fed7aa"
              backgroundColor="#fff7ed"
              labelColor="#9a3412"
            />
          ) : null}
        </div>

        <div>
          <div className="gamification-panel__section-title">Rozetler</div>
          <div className="gamification-panel__badges">
            {badges.map((badge) => (
              <span
                key={badge.code}
                title={badge.label}
                className={`gamification-panel__badge ${
                  badge.earned ? "gamification-panel__badge--earned" : "gamification-panel__badge--locked"
                }`}
              >
                {badge.earned ? "✓ " : ""}
                {badge.label}
              </span>
            ))}
            {badges.length === 0 ? (
              <span className="gamification-panel__empty">Henuz rozet kazanilmadi.</span>
            ) : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
