import React from "react";
import "./ChannelPrimitives.css";

const BORDER_CLASS_BY_COLOR: Record<string, string> = {
  "#bbf7d0": "channel-border--green",
  "#dcfce7": "channel-border--soft-green",
  "#e2e8f0": "channel-border--slate",
  "#dbeafe": "channel-border--blue",
  "#fde68a": "channel-border--amber",
  "#fecaca": "channel-border--red",
  "#bfdbfe": "channel-border--sky",
  "#fed7aa": "channel-border--orange",
  "#e5e7eb": "channel-border--gray",
};

const BACKGROUND_CLASS_BY_COLOR: Record<string, string> = {
  "#ffffff": "channel-bg--white",
  "#f0fdf4": "channel-bg--green",
  "#f8fafc": "channel-bg--slate",
  "#eff6ff": "channel-bg--blue",
  "#fffbeb": "channel-bg--amber",
  "#fef2f2": "channel-bg--red",
  "#fff7ed": "channel-bg--orange",
  "#fefce8": "channel-bg--yellow",
  "#fffbfb": "channel-bg--warm-white",
  transparent: "channel-bg--transparent",
};

const TEXT_CLASS_BY_COLOR: Record<string, string> = {
  "#64748b": "channel-text--slate",
  "#334155": "channel-text--dark-slate",
  "#78350f": "channel-text--amber",
  "#14532d": "channel-text--green",
  "#1e3a8a": "channel-text--blue",
  "#7f1d1d": "channel-text--red",
  "#9a3412": "channel-text--orange",
};

function colorClass(prefixMap: Record<string, string>, color: string | undefined) {
  return color ? prefixMap[color.toLowerCase()] ?? "" : "";
}

interface SectionCardProps {
  children: React.ReactNode;
  borderColor?: string;
  backgroundColor?: string;
  marginBottom?: number;
}

export function SectionCard({
  children,
  borderColor = "#e5e7eb",
  backgroundColor = "#ffffff",
  marginBottom = 14,
}: SectionCardProps) {
  const sectionCardClassName = [
    "channel-section-card",
    colorClass(BORDER_CLASS_BY_COLOR, borderColor),
    colorClass(BACKGROUND_CLASS_BY_COLOR, backgroundColor),
    marginBottom === 20 ? "channel-section-card--mb-20" : "channel-section-card--mb-14",
  ].filter(Boolean).join(" ");

  return (
    <div className={sectionCardClassName}>
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, right }: SectionHeaderProps) {
  return (
    <div className="channel-section-header">
      <h2 className="channel-section-header__title">{title}</h2>
      {right ?? <span />}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  borderColor?: string;
  backgroundColor?: string;
  labelColor?: string;
}

export function StatCard({
  label,
  value,
  borderColor = "#e2e8f0",
  backgroundColor = "transparent",
  labelColor = "#64748b",
}: StatCardProps) {
  const statCardClassName = [
    "channel-stat-card",
    colorClass(BORDER_CLASS_BY_COLOR, borderColor),
    colorClass(BACKGROUND_CLASS_BY_COLOR, backgroundColor),
  ].filter(Boolean).join(" ");

  return (
    <div className={statCardClassName}>
      <div className={`channel-stat-card__label ${colorClass(TEXT_CLASS_BY_COLOR, labelColor)}`}>
        {label}
      </div>
      <strong className="channel-stat-card__value">{value}</strong>
    </div>
  );
}
