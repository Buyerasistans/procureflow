import React from "react";

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
  return (
    <div
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: 20,
        marginBottom,
      }}
    >
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
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
  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 10, padding: 10, backgroundColor }}>
      <div style={{ fontSize: 12, color: labelColor }}>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
