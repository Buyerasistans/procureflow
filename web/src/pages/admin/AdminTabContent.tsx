import { useState } from "react";
import type { ReactNode } from "react";
import "./adminTabContent.css";

/* ── PageHeader ── */
type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, sub, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <h1 className="page-header__title">{title}</h1>
        {sub && <div className="page-header__sub">{sub}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

/* ── StatCard ── */
type StatCardAccent = "blue" | "gold" | "green" | "warn" | "red" | "violet" | "teal" | "slate" | "default";

type StatCardProps = {
  label: string;
  value: number | string;
  delta?: number;
  trend?: "up" | "down" | "flat";
  unit?: string;
  currency?: string;
  accent?: StatCardAccent;
  sub?: string;
};

export function StatCard({ label, value, delta, trend, unit, currency, accent = "default", sub }: StatCardProps) {
  const trendColor = trend === "up" ? "#15803d" : trend === "down" ? "#be123c" : "#64748b";
  const trendIco = trend === "up" ? "▲" : trend === "down" ? "▼" : "·";
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">
        {currency && <span className="stat-card__currency">{currency}</span>}
        {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
        {unit && <span className="stat-card__unit">{unit}</span>}
      </div>
      {delta !== undefined ? (
        <div className="stat-card__delta" style={{ color: trendColor }}>
          {trendIco} {Math.abs(delta)}% · son 30 gün
        </div>
      ) : sub ? (
        <div className="stat-card__delta">{sub}</div>
      ) : null}
    </div>
  );
}

/* ── Section ── */
type SectionProps = {
  title?: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
};

export function Section({ title, sub, action, children, padded = true }: SectionProps) {
  return (
    <section className="sec">
      {(title || action) && (
        <div className="sec-head">
          <div>
            {title && <h2 className="sec-title">{title}</h2>}
            {sub && <div className="sec-sub">{sub}</div>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={padded ? "sec-body" : "sec-body sec-body--flush"}>{children}</div>
    </section>
  );
}

/* ── DataTable ── */
type Column<T> = {
  key: string;
  label: string;
  width?: string;
  align?: "right";
  render?: (row: T) => ReactNode;
};

type DataTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  rows: T[];
  rowKey?: string;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey = "id",
  selectable = false,
  onRowClick,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<unknown>>(new Set());
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r[rowKey])));
  }
  function toggleRow(id: unknown) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="dt-wrap">
      <table className="dt">
        <thead>
          <tr>
            {selectable && (
              <th className="dt-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={c.align === "right" ? "dt-right" : ""}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={String(r[rowKey])}
              onClick={() => onRowClick?.(r)}
              className={onRowClick ? "dt-row--click" : ""}
            >
              {selectable && (
                <td className="dt-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(r[rowKey])}
                    onChange={() => toggleRow(r[rowKey])}
                  />
                </td>
              )}
              {columns.map((c) => (
                <td key={c.key} className={c.align === "right" ? "dt-right" : ""}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── UsageBar ── */
type UsageBarProps = {
  value: number;
  max?: number;
  label?: string;
};

export function UsageBar({ value, max = 100, label }: UsageBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 90 ? "#be123c" : pct >= 70 ? "#b45309" : "#2563eb";
  return (
    <div className="usage-bar">
      {label && <div className="usage-bar__num">{label}</div>}
      <div className="usage-bar__track">
        <div className="usage-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="usage-bar__num">{pct}%</div>
    </div>
  );
}
