import React from "react";
import type { ChannelGamification } from "../../services/profile.service";
import { SectionCard, SectionHeader, StatCard } from "./ChannelPrimitives";

interface GamificationPanelProps {
  data: ChannelGamification | null;
  loading: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  L0: "#94a3b8",
  L1: "#60a5fa",
  L2: "#a78bfa",
  L3: "#f59e0b",
};

const LEVEL_LABELS: Record<string, string> = {
  L0: "Baslangic",
  L1: "Bronz",
  L2: "Gumus",
  L3: "Altin",
};

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score - full >= 0.5;
  return (
    <span style={{ fontSize: 18, letterSpacing: 2 }}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} style={{ color: "#f59e0b" }}>★</span>;
        if (i === full && half) return <span key={i} style={{ color: "#f59e0b" }}>⯨</span>;
        return <span key={i} style={{ color: "#e2e8f0" }}>★</span>;
      })}
    </span>
  );
}

export function GamificationPanel({ data, loading }: GamificationPanelProps) {
  const levelCode = data?.level_code ?? "L0";
  const levelColor = LEVEL_COLORS[levelCode] ?? "#94a3b8";
  const levelLabel = LEVEL_LABELS[levelCode] ?? levelCode;

  return (
    <SectionCard backgroundColor="#fefce8" borderColor="#fde68a">
      <SectionHeader
        title="Performans ve Seviye"
        right={
          loading ? (
            <span style={{ fontSize: 12, color: "#78716c" }}>Yukleniyor...</span>
          ) : (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                background: levelColor,
                borderRadius: 6,
                padding: "2px 10px",
              }}
            >
              {levelLabel}
            </span>
          )
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <StarRating score={data?.star_score ?? 0} />
        <span style={{ fontSize: 13, color: "#92400e" }}>
          Performans skoru:{" "}
          <strong>{data?.performance_score ?? 0}</strong>
          {" / 100"}
        </span>
        <span style={{ fontSize: 13, color: "#92400e" }}>
          Performans faktoru:{" "}
          <strong>×{data?.performance_factor ?? 0}</strong>
        </span>
      </div>

      {/* Performans bar */}
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "#fde68a",
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(data?.performance_score ?? 0, 100)}%`,
            background: levelColor,
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Toplam Referans"
          value={<span style={{ fontSize: 20 }}>{data?.total_referrals ?? "-"}</span>}
          borderColor="#fde68a"
          backgroundColor="#fffbeb"
          labelColor="#78350f"
        />
        <StatCard
          label="Aktif Ekip"
          value={<span style={{ fontSize: 20 }}>{data?.active_team_size ?? "-"}</span>}
          borderColor="#fde68a"
          backgroundColor="#fffbeb"
          labelColor="#78350f"
        />
        {(data?.grace_period_remaining ?? 0) > 0 && (
          <StatCard
            label="Koruma Donemi"
            value={
              <span style={{ fontSize: 18, color: "#d97706" }}>
                {data!.grace_period_remaining} donem
              </span>
            }
            borderColor="#fed7aa"
            backgroundColor="#fff7ed"
            labelColor="#9a3412"
          />
        )}
      </div>

      {/* Rozetler */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#78350f", marginBottom: 8 }}>
          Rozetler
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(data?.badges ?? []).map((badge) => (
            <span
              key={badge.code}
              title={badge.label}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 20,
                border: badge.earned ? "1px solid #f59e0b" : "1px solid #e2e8f0",
                background: badge.earned ? "#fef3c7" : "#f8fafc",
                color: badge.earned ? "#92400e" : "#94a3b8",
                fontWeight: badge.earned ? 700 : 400,
              }}
            >
              {badge.earned ? "✓ " : ""}{badge.label}
            </span>
          ))}
          {(data?.badges ?? []).length === 0 && (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Henuz rozet kazanilmadi.</span>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
