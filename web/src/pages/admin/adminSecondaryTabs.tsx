import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { canAccessAdminSurface, isSuperAdminUser } from "../../auth/permissions";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/token";
import { CampaignsAdminTab } from "../../components/admin/CampaignsTab.tsx";
import { PageHeader, StatCard, Section, DataTable } from "./AdminTabContent";
import { getProjects, getCompanies, type Project, type Company } from "../../services/admin.service";
import "./adminSecondaryTabs.css";
import "./networkHub.css";

const RP_TYPE_DEFS = [
  { code: "price",      label: "Fiyat Analizi",         abbr: "FA", color: "#1d4ed8", desc: "Min/max/ort/medyan teklif fiyatı, fiyat sapması" },
  { code: "supplier",   label: "Tedarikçi Performansı", abbr: "TP", color: "#be123c", desc: "Fiyat/teslim/kalite/iletişim puanları, genel skor" },
  { code: "comparison", label: "Teklif Karşılaştırma",  abbr: "TK", color: "#7c3aed", desc: "Teklifler arası kazanan/fiyat/teslim kıyası" },
  { code: "contract",   label: "Sözleşmeler",           abbr: "SZ", color: "#047857", desc: "İmzalı sözleşmeler, tutar, ödeme & garanti" },
  { code: "spend",      label: "Harcama & Tasarruf",    abbr: "HS", color: "#b45309", desc: "Dönemsel harcama, bütçe-gerçekleşme, tasarruf" },
  { code: "approval",   label: "Onay Süreleri",         abbr: "OS", color: "#0891b2", desc: "Onay zinciri süreleri, bekleyen/geciken" },
] as const;

type RpCode = (typeof RP_TYPE_DEFS)[number]["code"];

interface RpHistoryItem {
  id: string;
  type: RpCode | string;
  name: string;
  scope: string;
  period: string;
  format: string;
  date: string;
  size: string;
}

const RP_INITIAL_HISTORY: RpHistoryItem[] = [
  { id: "R-244", type: "price",      name: "Hammadde Q3 Fiyat Analizi",   scope: "PizzaMax Gıda A.Ş.",   period: "Q3 2026",    format: "PDF",   date: "01.06.2026", size: "1.2 MB" },
  { id: "R-241", type: "supplier",   name: "Tedarikçi Performans Karnesi", scope: "Platform geneli",      period: "Mayıs 2026", format: "Excel", date: "31.05.2026", size: "480 KB" },
  { id: "R-238", type: "contract",   name: "İmzalı Sözleşmeler Özeti",     scope: "Atlas Yapı & İnşaat",  period: "2026",       format: "PDF",   date: "28.05.2026", size: "2.1 MB" },
  { id: "R-235", type: "spend",      name: "Çeyreklik Harcama Raporu",     scope: "NorthWind Lojistik",   period: "Q2 2026",    format: "Excel", date: "25.05.2026", size: "690 KB" },
  { id: "R-230", type: "comparison", name: "AVM İnşaatı Teklif Kıyası",   scope: "Atlas Yapı & İnşaat",  period: "Mayıs 2026", format: "PDF",   date: "20.05.2026", size: "850 KB" },
  { id: "R-228", type: "approval",   name: "Onay Süreleri Analizi",        scope: "Platform geneli",      period: "Nisan 2026", format: "CSV",   date: "12.05.2026", size: "210 KB" },
];

const RP_SCOPES  = ["Platform geneli", "Atlas Yapı & İnşaat", "PizzaMax Gıda A.Ş.", "NorthWind Lojistik"];
const RP_PERIODS = ["Bu ay", "Geçen ay", "Q2 2026", "Q3 2026", "2026 (yıl)"];
const RP_FORMATS = ["PDF", "Excel", "CSV"];
let rpSeq = 244;

export function ReportsTabContent() {
  const [selType, setSelType] = useState<string>("price");
  const [scope,   setScope]   = useState(RP_SCOPES[0]);
  const [period,  setPeriod]  = useState(RP_PERIODS[0]);
  const [fmt,     setFmt]     = useState(RP_FORMATS[0]);
  const [history, setHistory] = useState<RpHistoryItem[]>(RP_INITIAL_HISTORY);

  const meta = RP_TYPE_DEFS.find((t) => t.code === selType) ?? RP_TYPE_DEFS[0];

  function generate() {
    rpSeq++;
    setHistory((prev) => [
      { id: `R-${rpSeq}`, type: selType, name: `${meta.label} — ${scope}`, scope, period, format: fmt, date: "az önce", size: "—" },
      ...prev,
    ]);
  }

  const thisMonth = history.filter((r) => /06\.2026|az önce/.test(r.date)).length;

  return (
    <>
      <PageHeader
        eyebrow="Sistem · Raporlama"
        title="Raporlar"
        sub="Satın alma ve platform raporları — fiyat analizi, tedarikçi performansı, sözleşmeler, harcama ve onay süreleri."
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Rapor şablonu" value={RP_TYPE_DEFS.length} sub="kategori" />
        <StatCard label="Üretilen rapor" value={history.length} sub="son dönem" accent="blue" />
        <StatCard label="Bu ay" value={thisMonth} accent="green" />
        <StatCard label="Zamanlanmış" value={3} sub="otomatik" accent="violet" />
      </div>

      <Section title="Rapor oluştur" sub="tür · kapsam · dönem · format">
        <div className="rp-types">
          {RP_TYPE_DEFS.map((t) => (
            <button
              key={t.code}
              type="button"
              className={"rp-typecard" + (selType === t.code ? " on" : "")}
              style={
                selType === t.code
                  ? { borderColor: t.color, boxShadow: `0 0 0 2px ${t.color}33` }
                  : undefined
              }
              onClick={() => setSelType(t.code)}
            >
              <span
                className="rp-typecard__ico"
                style={{ "--rp-bg": t.color + "1f", "--rp-fg": t.color } as CSSProperties}
              >
                {t.abbr}
              </span>
              <b>{t.label}</b>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
        <div className="rp-gen">
          <label className="rp-field">
            <span className="rp-field__lbl">Kapsam</span>
            <select className="rp-sel" value={scope} onChange={(e) => setScope(e.target.value)}>
              {RP_SCOPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="rp-field">
            <span className="rp-field__lbl">Dönem</span>
            <select className="rp-sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {RP_PERIODS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <div className="rp-field">
            <span className="rp-field__lbl">Format</span>
            <div className="rp-fmtseg">
              {RP_FORMATS.map((f) => (
                <button key={f} type="button" className={fmt === f ? "on" : ""} onClick={() => setFmt(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="rp-gen__btn" onClick={generate}>
            ↓ {meta.label} oluştur
          </button>
        </div>
      </Section>

      <Section title="Üretilen raporlar" sub="geçmiş · indir">
        <table className="rp-table">
          <thead>
            <tr>
              <th>Rapor</th><th>Tür</th><th>Kapsam</th><th>Dönem</th><th>Format</th><th>Tarih</th><th aria-label="Eylemler"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => {
              const t = RP_TYPE_DEFS.find((x) => x.code === r.type) ?? { label: r.type, color: "#64748b", abbr: "?" };
              return (
                <tr key={r.id} style={{ "--rp-bg": t.color + "1f", "--rp-fg": t.color } as CSSProperties}>
                  <td>
                    <div className="rp-tname">
                      <span className="rp-dot" />
                      <div>
                        <b>{r.name}</b>
                        <span>{r.id}{r.size !== "—" ? ` · ${r.size}` : ""}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="rp-typebadge">
                      {t.label}
                    </span>
                  </td>
                  <td className="rp-mut">{r.scope}</td>
                  <td className="rp-mut">{r.period}</td>
                  <td><span className="rp-fmtbadge">{r.format}</span></td>
                  <td className="rp-mut">{r.date}</td>
                  <td><button type="button" className="rp-actbtn">İndir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </>
  );
}

interface ChannelSummary {
  display_name: string;
  level_code: string;
  star_score: number;
  performance_score: number;
  total_team_size: number;
  active_team_size: number;
  last_30d_new_customers: number;
  commission_pending: number;
  commission_approved: number;
  commission_paid: number;
  commission_net_current_month: number;
}

interface ChannelCommissionReport {
  total_earnings: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  entries: Array<{
    id: number;
    amount: number;
    status: string;
    reference_type: string | null;
    description: string | null;
    created_at: string;
  }>;
}

const COMMISSION_STATUS_LABELS: Record<string, string> = { paid: "Ödendi", approved: "Onaylandı", pending: "Bekliyor" };
const COMMISSION_STATUS_CLASS: Record<string, string> = { paid: "ch-badge ch-badge--paid", approved: "ch-badge ch-badge--approved", pending: "ch-badge ch-badge--pending" };

export function ChannelReportsTabContent() {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const token = getAccessToken();

  const [summary, setSummary] = useState<ChannelSummary | null>(null);
  const [report, setReport] = useState<ChannelCommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${apiBase}/api/v1/channel/profile/summary`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${apiBase}/api/v1/channel/profile/commission-report`, { headers }).then(r => r.ok ? r.json() : null),
    ])
      .then(([summaryData, reportData]) => {
        setSummary(summaryData as ChannelSummary | null);
        setReport(reportData as ChannelCommissionReport | null);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [apiBase, token]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="ch-tab">
        <PageHeader eyebrow="İş Ortağı" title="İş Ortağı Raporları" sub="Yükleniyor…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ch-tab">
        <PageHeader eyebrow="İş Ortağı" title="İş Ortağı Raporları" />
        <div className="ch-error">Hata: {error}</div>
      </div>
    );
  }

  const entries = report?.entries ?? [];

  return (
    <div className="ch-tab">
      <PageHeader
        eyebrow="İş Ortağı"
        title="İş Ortağı Raporları"
        sub="Komisyon kazançları, referans dönüşüm performansı ve ekip aktivite özeti"
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Bekleyen Komisyon" value={fmt(summary?.commission_pending ?? 0)} accent="gold" />
        <StatCard label="Onaylanan Komisyon" value={fmt(summary?.commission_approved ?? 0)} accent="green" />
        <StatCard label="Ödenen Komisyon" value={fmt(summary?.commission_paid ?? 0)} accent="blue" />
        <StatCard label="Bu Ay Net" value={fmt(summary?.commission_net_current_month ?? 0)} accent="violet" />
      </div>

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Toplam Ekip" value={summary?.total_team_size ?? 0} accent="slate" sub="kayıtlı üye" />
        <StatCard label="Aktif Üye" value={summary?.active_team_size ?? 0} accent="teal" sub="son 30 gün aktif" />
        <StatCard label="Yeni Müşteri" value={summary?.last_30d_new_customers ?? 0} accent="blue" sub="son 30 gün" />
        <StatCard label="Performans" value={`${Math.round(summary?.performance_score ?? 0)} / 100`} accent="green" sub="puan skoru" />
      </div>

      <Section title="Son Komisyon Kayıtları" sub={`${entries.length} kayıt`} padded={false}>
        {entries.length === 0 ? (
          <div className="ch-empty">
            Henüz komisyon kaydı bulunmuyor. Referans linkleri ile müşteri yönlendirmeleri yaptığınızda komisyon kazançlarınız burada görünecek.
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "description", label: "Açıklama",
                render: (r) => (
                  <div>
                    <div className="ch-entry-title">{String(r.description || r.reference_type || "Komisyon")}</div>
                    <div className="ch-entry-date">{new Date(String(r.created_at)).toLocaleDateString("tr-TR")}</div>
                  </div>
                ),
              },
              {
                key: "status", label: "Durum", width: "120px",
                render: (r) => (
                  <span className={COMMISSION_STATUS_CLASS[String(r.status)] ?? "ch-badge"}>
                    {COMMISSION_STATUS_LABELS[String(r.status)] ?? String(r.status)}
                  </span>
                ),
              },
              {
                key: "amount", label: "Tutar", align: "right",
                render: (r) => <strong className="ch-amount">{fmt(Number(r.amount))}</strong>,
              },
            ]}
            rows={entries.slice(0, 10) as unknown as Record<string, unknown>[]}
            rowKey="id"
          />
        )}
      </Section>
    </div>
  );
}

/* ── Platform Analytics — mock data & chart helpers ─────────────────────── */

const PA_ECO_SERIES = [
  { m: "2025-06", strategic: 24, supplier: 210, talent: 20 },
  { m: "2025-07", strategic: 27, supplier: 228, talent: 34 },
  { m: "2025-08", strategic: 29, supplier: 242, talent: 46 },
  { m: "2025-09", strategic: 31, supplier: 255, talent: 58 },
  { m: "2025-10", strategic: 33, supplier: 266, talent: 69 },
  { m: "2025-11", strategic: 35, supplier: 274, talent: 77 },
  { m: "2025-12", strategic: 36, supplier: 283, talent: 86 },
  { m: "2026-01", strategic: 38, supplier: 291, talent: 95 },
  { m: "2026-02", strategic: 39, supplier: 298, talent: 103 },
  { m: "2026-03", strategic: 40, supplier: 305, talent: 110 },
  { m: "2026-04", strategic: 41, supplier: 311, talent: 117 },
  { m: "2026-05", strategic: 42, supplier: 318, talent: 124 },
] as const;
type EcoKey = "strategic" | "supplier" | "talent";
const PA_ECO_LINES: { key: EcoKey; label: string; color: string }[] = [
  { key: "supplier",  label: "Tedarikçi (havuz)",  color: "#be123c" },
  { key: "talent",    label: "Yetenek",             color: "#7c3aed" },
  { key: "strategic", label: "Stratejik Partner",   color: "#1d4ed8" },
];

const PA_ORIGIN_DONUT = [
  { label: "Partner daveti",      count: 128, color: "#1d4ed8" },
  { label: "İş ortağı (kanal)",   count: 96,  color: "#047857" },
  { label: "Doğrudan kayıt",      count: 94,  color: "#64748b" },
];

const PA_RFQ_FUNNEL = [
  { stage: "RFQ açıldı",              count: 1404 },
  { stage: "Tedarikçiye iletildi",     count: 1180 },
  { stage: "Teklif geldi",             count: 842  },
  { stage: "Değerlendirildi",          count: 610  },
  { stage: "Kazanan seçildi",          count: 318  },
];

const PA_TALENT_FUNNEL = [
  { stage: "Açık ilan",  count: 34  },
  { stage: "Başvuru",    count: 310 },
  { stage: "Ön eleme",   count: 128 },
  { stage: "Mülakat",    count: 47  },
  { stage: "Teklif",     count: 18  },
  { stage: "Yerleşti",   count: 11  },
];

const PA_CAREER_SERIES = [
  { m: "2025-06", applications: 14, placements: 1 },
  { m: "2025-07", applications: 19, placements: 1 },
  { m: "2025-08", applications: 23, placements: 2 },
  { m: "2025-09", applications: 26, placements: 1 },
  { m: "2025-10", applications: 29, placements: 2 },
  { m: "2025-11", applications: 27, placements: 2 },
  { m: "2025-12", applications: 31, placements: 1 },
  { m: "2026-01", applications: 35, placements: 2 },
  { m: "2026-02", applications: 30, placements: 1 },
  { m: "2026-03", applications: 38, placements: 2 },
  { m: "2026-04", applications: 36, placements: 1 },
  { m: "2026-05", applications: 42, placements: 2 },
];

const PA_CHANNEL_BARS = [
  { m: "Ara", partners: 1, suppliers: 3 },
  { m: "Oca", partners: 1, suppliers: 2 },
  { m: "Şub", partners: 2, suppliers: 4 },
  { m: "Mar", partners: 1, suppliers: 3 },
  { m: "Nis", partners: 2, suppliers: 5 },
  { m: "May", partners: 2, suppliers: 4 },
];

const PA_CONTRIB_TILES = [
  { k: "Aktif görev",         v: "3" },
  { k: "Tamamlanan katkı",    v: "142" },
  { k: "Dağıtılan ödül",      v: "₺186.400" },
  { k: "Ort. itibar puanı",   v: "512" },
  { k: "Bekleyen ödeme",      v: "₺5.950" },
];

function PaMultiLine({ series, lines, height = 240 }: {
  series: readonly { m: string; strategic: number; supplier: number; talent: number }[];
  lines: { key: EcoKey; label: string; color: string }[];
  height?: number;
}) {
  const W = 760, PL = 38, PR = 16, PT = 14, PB = 26;
  const n = series.length;
  const max = Math.max(...series.flatMap((d) => lines.map((l) => d[l.key]))) * 1.1;
  const x = (i: number) => PL + (i * (W - PL - PR)) / (n - 1);
  const y = (v: number) => PT + (height - PT - PB) * (1 - v / max);
  return (
    <div className="pa-chart" style={{ "--pa-chart-h": height + "px" } as CSSProperties}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((i) => {
          const yy = PT + ((height - PT - PB) * i) / 4;
          return (
            <g key={i}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eef2f7" strokeWidth="1" />
              <text x={PL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {Math.round(max * (1 - i / 4))}
              </text>
            </g>
          );
        })}
        {lines.map((l) => (
          <polyline
            key={l.key}
            points={series.map((d, i) => `${x(i)},${y(d[l.key])}`).join(" ")}
            fill="none" stroke={l.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {lines.map((l) =>
          series.map((d, i) => (
            <circle key={l.key + i} cx={x(i)} cy={y(d[l.key])} r="2.4" fill={l.color} />
          ))
        )}
        {series.map((d, i) =>
          i % 2 === 1 ? (
            <text key={"x" + i} x={x(i)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
              {d.m.slice(5)}.{d.m.slice(2, 4)}
            </text>
          ) : null
        )}
      </svg>
      <div className="pa-legend">
        {lines.map((l) => (
          <span key={l.key} style={{ "--leg-bg": l.color } as CSSProperties}>
            <i />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PaCareerLine({ series, height = 220 }: {
  series: { m: string; applications: number; placements: number }[];
  height?: number;
}) {
  const W = 760, PL = 38, PR = 16, PT = 14, PB = 26;
  const n = series.length;
  const maxApp = Math.max(...series.map((d) => d.applications)) * 1.1;
  const maxPl  = Math.max(...series.map((d) => d.placements));
  const x = (i: number) => PL + (i * (W - PL - PR)) / (n - 1);
  const yA = (v: number) => PT + (height - PT - PB) * (1 - v / maxApp);
  const yP = (v: number) => PT + (height - PT - PB) * (1 - v / (maxPl + 2));
  const appPts = series.map((d, i) => `${x(i)},${yA(d.applications)}`).join(" ");
  const plPts  = series.map((d, i) => `${x(i)},${yP(d.placements)}`).join(" ");
  return (
    <div className="pa-chart" style={{ "--pa-chart-h": height + "px" } as CSSProperties}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((i) => {
          const yy = PT + ((height - PT - PB) * i) / 4;
          return <line key={i} x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eef2f7" strokeWidth="1" />;
        })}
        <polyline points={appPts} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={plPts}  fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((d, i) => <circle key={"a" + i} cx={x(i)} cy={yA(d.applications)} r="2.4" fill="#7c3aed" />)}
        {series.map((d, i) => <circle key={"p" + i} cx={x(i)} cy={yP(d.placements)}  r="2.4" fill="#1d4ed8" />)}
        {series.map((d, i) =>
          i % 2 === 1 ? (
            <text key={"x" + i} x={x(i)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
              {d.m.slice(5)}.{d.m.slice(2, 4)}
            </text>
          ) : null
        )}
      </svg>
      <div className="pa-legend">
        <span><i className="pa-legend-i--violet" />Başvuru</span>
        <span><i className="pa-legend-i--blue" />Yerleşme</span>
      </div>
    </div>
  );
}

function PaFunnelBars({ steps, color }: { steps: { stage: string; count: number }[]; color: string }) {
  const max = steps[0].count;
  return (
    <div className="pa-funnel">
      {steps.map((s, i) => {
        const pct = Math.max(6, Math.round((s.count / max) * 100));
        const conv = i === 0 ? null : Math.round((s.count / steps[i - 1].count) * 100);
        return (
          <div key={i} className="pa-funnel__row">
            <span className="pa-funnel__lbl">{s.stage}</span>
            <div className="pa-funnel__track">
              <div className="pa-funnel__bar" style={{ "--funnel-w": pct + "%", "--funnel-bg": color } as CSSProperties}>
                <b>{s.count.toLocaleString("tr-TR")}</b>
              </div>
            </div>
            <span className="pa-funnel__conv">{conv === null ? "—" : "%" + conv}</span>
          </div>
        );
      })}
    </div>
  );
}

function PaGroupBars({ data }: { data: { m: string; partners: number; suppliers: number }[] }) {
  const max = Math.max(...data.flatMap((d) => [d.partners, d.suppliers]));
  return (
    <>
      <div className="pa-gbars">
        {data.map((d) => (
          <div key={d.m} className="pa-gbars__col">
            <div className="pa-gbars__pair" style={{ "--ph": (d.partners / max * 100) + "%", "--sh": (d.suppliers / max * 100) + "%" } as CSSProperties}>
              <div className="pa-gbars__b pa-gbars__b--partner" title={`Getirilen partner: ${d.partners}`} />
              <div className="pa-gbars__b pa-gbars__b--supplier" title={`Getirilen tedarikçi: ${d.suppliers}`} />
            </div>
            <div className="pa-gbars__lbl">{d.m}</div>
          </div>
        ))}
      </div>
      <div className="pa-legend">
        <span><i className="pa-legend-i--blue" />Getirilen partner</span>
        <span><i className="pa-legend-i--churn" />Getirilen tedarikçi</span>
      </div>
    </>
  );
}

function PaCityBars({ data }: { data: [string, number][] }) {
  const max = data.length ? data[0][1] : 1;
  return (
    <div className="pa-city">
      {data.map(([city, n]) => (
        <div key={city} className="pa-city__row">
          <span className="pa-city__name">{city}</span>
          <div className="pa-city__track">
            <div className="pa-city__bar" style={{ "--city-w": (n / max * 100) + "%" } as CSSProperties} />
          </div>
          <span className="pa-city__n">{n}</span>
        </div>
      ))}
    </div>
  );
}

function PaDonut({ data, size = 200 }: { data: { label: string; count: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = (size - 12) / 2;
  const cx = size / 2, cy = size / 2;
  let cumAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z` };
  });
  const innerR = r * 0.54;
  return (
    <div className="pa-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s) => <path key={s.label} d={s.d} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={innerR} fill="#fff" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#64748b">tedarikçi</text>
      </svg>
      <div className="pa-donut-legend">
        {data.map((d) => (
          <div key={d.label} className="pa-donut-legend__row">
            <span className="pa-donut-legend__dot" style={{ "--dot-bg": d.color } as CSSProperties} />
            <span className="pa-donut-legend__label">{d.label}</span>
            <span className="pa-donut-legend__val">{d.count} <small>({Math.round(d.count / total * 100)}%)</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlatformAnalyticsTab() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState("12a");
  const apiBase = import.meta.env.VITE_API_URL ?? "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedHost !== "all") params.set("host", selectedHost);
    if (selectedEventType !== "all") params.set("event_type", selectedEventType);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const query = params.toString();
    fetch(`${apiBase}/api/v1/admin/platform-analytics${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Veri alinamadi");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [apiBase, selectedHost, selectedEventType, startDate, endDate]);

  if (loading) return <div className="pat-loading">Yükleniyor...</div>;
  if (error) return <div className="pat-error">Hata: {error}</div>;
  if (!data) return null;

  const summary = (data.summary as Record<string, number>) ?? {};
  const planDist = (data.plan_distribution as Array<{ plan_code: string; plan_name: string; tenant_count: number }>) ?? [];
  const onboardingDist = (data.onboarding_distribution as Array<{ status: string; count: number }>) ?? [];
  const publicSummary = (data.public_summary as Record<string, number>) ?? {};
  const domainIntentSummary =
    (data.domain_intent_summary as Array<{
      host: string;
      intent: string;
      primary_kpi: number;
      primary_kpi_label: string;
    }>) ?? [];
  const telemetryBreakdown =
    (data.telemetry_breakdown as Array<{
      host: string;
      intent: string;
      event_type: string;
      count: number;
    }>) ?? [];

  const telemetryHosts = ["all", ...Array.from(new Set(telemetryBreakdown.map((row) => row.host)))];
  const telemetryEventTypes = ["all", ...Array.from(new Set(telemetryBreakdown.map((row) => row.event_type)))];
  const filteredTelemetryBreakdown = telemetryBreakdown.filter((row) => {
    if (selectedHost !== "all" && row.host !== selectedHost) return false;
    if (selectedEventType !== "all" && row.event_type !== selectedEventType) return false;
    return true;
  });

  function handleExportTelemetryCsv() {
    const params = new URLSearchParams();
    if (selectedHost !== "all") params.set("host", selectedHost);
    if (selectedEventType !== "all") params.set("event_type", selectedEventType);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const url = `${apiBase}/api/v1/admin/platform-analytics/export?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="pat-tab">
      <PageHeader
        eyebrow="Platform"
        title="Platform Analitikleri"
        sub="Tenant, kullanıcı, tedarikçi ve public web metrikleri"
        actions={
          <div className="pa-period">
            {([["30g", "30 gün"], ["90g", "90 gün"], ["12a", "12 ay"]] as const).map(([v, l]) => (
              <button key={v} type="button" className={"pa-period__btn" + (period === v ? " on" : "")} onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
        }
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Toplam Tenant"      value={summary.total_tenants ?? 0}        accent="violet" />
        <StatCard label="Aktif Tenant"       value={summary.active_tenants ?? 0}       accent="green"  />
        <StatCard label="Aktif Kullanıcı"    value={summary.total_internal_users ?? 0} accent="blue"   />
        <StatCard label="Toplam Tedarikçi"   value={summary.total_suppliers ?? 0}      accent="violet" />
        <StatCard label="Platform Tedarikçi" value={summary.platform_suppliers ?? 0}   accent="gold"   />
        <StatCard label="Özel Tedarikçi"     value={summary.private_suppliers ?? 0}    accent="teal"   />
        <StatCard label="Toplam Proje"       value={summary.total_projects ?? 0}       accent="red"    />
        <StatCard label="Toplam Teklif"      value={summary.total_quotes ?? 0}         accent="blue"   />
      </div>

      <div className="pat-dist-grid">
        <div className="pat-dist-panel">
          <div className="pat-dist-panel__title">Plan Dağılımı</div>
          {planDist.map((row) => (
            <div key={row.plan_code} className="pat-dist-row">
              <span>{row.plan_name}</span>
              <span className="pat-dist-row__val--plan">{row.tenant_count}</span>
            </div>
          ))}
        </div>
        <div className="pat-dist-panel">
          <div className="pat-dist-panel__title">Onboarding Durumu</div>
          {onboardingDist.map((row) => (
            <div key={row.status} className="pat-dist-row">
              <span className="pat-dist-row__val--onboarding">{row.status}</span>
              <span className="pat-dist-row__val--plan">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="pat-section-title">Public Web KPI Özeti</h3>
        <div className="kpi-grid kpi-grid--4">
          <StatCard label="Partner Plan"    value={publicSummary.strategic_partner_plan_count ?? 0}  accent="teal"   />
          <StatCard label="Tedarikçi Plan"  value={publicSummary.supplier_plan_count ?? 0}           accent="blue"   />
          <StatCard label="Public Kampanya" value={publicSummary.public_campaign_count ?? 0}         accent="violet" />
          <StatCard label="Aktif Kampanya"  value={publicSummary.active_public_campaign_count ?? 0}  accent="gold"   />
          <StatCard label="Campaign Event"  value={publicSummary.campaign_event_count ?? 0}          accent="red"    />
          <StatCard label="Onboarding Lead" value={publicSummary.pending_onboarding_leads ?? 0}      accent="blue"   />
          <StatCard label="Page View"       value={publicSummary.page_view_count ?? 0}               accent="teal"   />
          <StatCard label="CTA Click"       value={publicSummary.cta_click_count ?? 0}               accent="gold"   />
          <StatCard label="Form Submit"     value={publicSummary.form_submit_count ?? 0}             accent="red"    />
        </div>

        <div className="pat-intent-panel">
          <div className="pat-intent-panel__title">Domain Intent Özeti</div>
          <div className="pat-intent-grid">
            {domainIntentSummary.map((row) => (
              <div key={row.host} className="pat-intent-row">
                <div>
                  <div className="pat-intent-row__host">{row.host}</div>
                  <div className="pat-intent-row__meta">Intent: {row.intent}</div>
                </div>
                <div className="pat-intent-row__right">
                  <div className="pat-intent-row__kpi">{row.primary_kpi.toLocaleString("tr-TR")}</div>
                  <div className="pat-intent-row__kpi-label">{row.primary_kpi_label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pat-telemetry-panel">
          <div className="pat-telemetry-head">
            <div>
              <div className="pat-telemetry-title">Telemetry Segmentleri</div>
              <div className="pat-telemetry-sub">Host ve event tipine göre public telemetry kırılımı.</div>
            </div>
            <button type="button" className="pat-export-btn" onClick={handleExportTelemetryCsv}>
              CSV Export
            </button>
          </div>

          <div className="pat-filter-row">
            <label className="pat-filter-label">
              Host filtresi
              <select className="pat-filter-select" value={selectedHost} onChange={(event) => setSelectedHost(event.target.value)}>
                {telemetryHosts.map((host) => (
                  <option key={host} value={host}>{host === "all" ? "Tüm hostlar" : host}</option>
                ))}
              </select>
            </label>
            <label className="pat-filter-label">
              Event filtresi
              <select className="pat-filter-select" value={selectedEventType} onChange={(event) => setSelectedEventType(event.target.value)}>
                {telemetryEventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>{eventType === "all" ? "Tüm eventler" : eventType}</option>
                ))}
              </select>
            </label>
            <label className="pat-filter-label">
              Başlangıç tarihi
              <input type="date" className="pat-filter-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="pat-filter-label">
              Bitiş tarihi
              <input type="date" className="pat-filter-input" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>

          <div className="pat-telemetry-list">
            {filteredTelemetryBreakdown.length === 0 ? (
              <div className="pat-telemetry-empty">Seçili filtreler için telemetry kaydı yok.</div>
            ) : (
              filteredTelemetryBreakdown.map((row) => (
                <div key={`${row.host}-${row.event_type}`} className="pat-telemetry-row">
                  <div className="pat-telemetry-row__host">{row.host}</div>
                  <div className="pat-telemetry-row__meta">{row.intent}</div>
                  <div className="pat-telemetry-row__meta">{row.event_type}</div>
                  <div className="pat-telemetry-row__count">{row.count.toLocaleString("tr-TR")}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Ekosistem Büyüme Analizi ──────────────────────────────── */}
      <div className="pa-band">Ekosistem Büyüme Analizi</div>

      <Section title="Ekosistem büyümesi · 12 ay" sub="taraf bazında kümülatif kayıt — marka renkleri">
        <PaMultiLine series={PA_ECO_SERIES} lines={PA_ECO_LINES} />
      </Section>

      <div className="split-1-1">
        <Section title="Tedarikçi havuzu kökeni" sub="318 tedarikçi nereden geldi">
          <PaDonut data={PA_ORIGIN_DONUT} size={200} />
        </Section>
        <Section title="RFQ → Kazanan hunisi" sub="teklif yaşam döngüsü · dönüşüm oranları">
          <PaFunnelBars steps={PA_RFQ_FUNNEL} color="#1d4ed8" />
        </Section>
      </div>

      <div className="split-1-1">
        <Section title="İş Ortağı katkısı · 6 ay" sub="kanal kaynaklı yeni partner & tedarikçi">
          <PaGroupBars data={PA_CHANNEL_BARS} />
        </Section>
        <Section title="Coğrafi dağılım · şehir bazlı tenant" sub="en yoğun şehirler">
          <PaCityBars data={[["İstanbul", 18], ["Ankara", 9], ["İzmir", 6], ["Bursa", 4], ["Antalya", 3], ["Kocaeli", 2], ["Gaziantep", 1]]} />
        </Section>
      </div>

      {/* ── Kariyer & Yetenek Pazarı ─────────────────────────────── */}
      <div className="pa-band">Kariyer &amp; Yetenek Pazarı</div>

      <div className="kpi-grid">
        <StatCard label="Açık ilan"       value={34}       sub="yayında · işveren tenant"    accent="violet" />
        <StatCard label="Aktif başvuru"   value={310}      sub="başvuru akışında"             accent="blue"   />
        <StatCard label="Yerleşen · 12 ay" value={18}     sub="işe yerleştirme"              accent="green"  />
        <StatCard label="Yetenek profili" value={124}      sub="96 KYC onaylı"               />
        <StatCard label="Dağıtılan ödül"  value="₺186K"   sub="katkı ekonomisi"              accent="gold"   />
      </div>

      <div className="split-1-1">
        <Section title="Başvuru & Yerleşme · 12 ay" sub="iş ilanı talebi vs gerçekleşen yerleştirme">
          <PaCareerLine series={PA_CAREER_SERIES} />
        </Section>
        <Section title="Yetenek pazarı hunisi" sub="ilan → yerleşme dönüşümü">
          <PaFunnelBars steps={PA_TALENT_FUNNEL} color="#7c3aed" />
        </Section>
      </div>

      <Section title="Yetenek katkı ekonomisi" sub="Katkı ile Kazan — görev, ödül ve itibar">
        <div className="pa-contrib">
          {PA_CONTRIB_TILES.map((t) => (
            <div key={t.k} className="pa-tile">
              <b>{t.v}</b>
              <span>{t.k}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── PlatformSuppliersTab types ──────────────────────────────────────────────

interface SnOrigin {
  type: "partner" | "channel" | "direct";
  partner?: string | null; channel?: string | null; invitedBy?: string | null;
  date: string;
}
interface SnPool { inPool: boolean; paid: boolean; fee: number | null; since: string | null; }
interface SnBecamePartner { yes: boolean; since: string | null; note: string | null; }
interface SnAssignment { project: string; by: string; invite: "accepted" | "sent" | "declined"; date: string; }
interface SnQuote { project: string; amount: number; status: string; }
interface SnTenantRel { id: string; name: string; role: "owner" | "user"; assignments: SnAssignment[]; quotes: SnQuote[]; }
interface SnSupplierRich {
  id: number; company_name: string; company_title: string; city: string;
  phone: string; email: string; website: string;
  category_tags: string[]; partner_category_tags: string[];
  reference_score: number; is_verified: boolean; is_active: boolean;
  dual_role_status: "active" | "pending" | "rejected" | null;
  users: Array<{ name: string; email: string }>;
  origin: SnOrigin; pool: SnPool;
  becamePartner: SnBecamePartner; tenants: SnTenantRel[];
}

// ── Mock data — TODO(data): replace with real API when origin/journey model is available

const SN_MOCK_TENANTS = [
  { id: "t_atlas", name: "Atlas Yapı & İnşaat",  plan: "Kurumsal" },
  { id: "t_pizza", name: "PizzaMax Gıda A.Ş.",   plan: "Gelişim"  },
  { id: "t_north", name: "NorthWind Lojistik",    plan: "Kurumsal" },
];

const SN_MOCK_SUPPLIERS: SnSupplierRich[] = [
  { id: 1, company_name: "Anadolu Ambalaj San. A.Ş.", company_title: "Oluklu mukavva & koli", city: "Bursa", phone: "+90 224 220 11 00", email: "satis@anadoluambalaj.com", website: "anadoluambalaj.com", category_tags: ["Ambalaj"], partner_category_tags: ["Hammadde"], reference_score: 4.6, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Hakan Er", email: "hakan@anadoluambalaj.com" }],
    origin: { type: "channel", channel: "Vektör İş Geliştirme", date: "02.2025" },
    pool: { inPool: true, paid: true, fee: 2400, since: "04.2025" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_pizza", name: "PizzaMax Gıda A.Ş.", role: "user", assignments: [{ project: "Ambalaj Yenileme", by: "Mehmet Yıldız", invite: "accepted", date: "01.05.2026" }], quotes: [{ project: "Ambalaj Yenileme", amount: 84500, status: "kazandı" }] }] },

  { id: 2, company_name: "Trakya Tarım Ürünleri", company_title: "Tahıl & bakliyat", city: "Edirne", phone: "+90 284 100 22 33", email: "info@trakyatarim.com", website: "trakyatarim.com", category_tags: ["Gıda", "Hammadde"], partner_category_tags: [], reference_score: 4.1, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Okan Demir", email: "okan@trakyatarim.com" }],
    origin: { type: "partner", partner: "PizzaMax Gıda A.Ş.", invitedBy: "Mehmet Yıldız", date: "03.2025" },
    pool: { inPool: true, paid: true, fee: 1800, since: "06.2025" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_pizza", name: "PizzaMax Gıda A.Ş.", role: "user", assignments: [{ project: "Hammadde Q3", by: "Mehmet Yıldız", invite: "accepted", date: "12.04.2026" }], quotes: [{ project: "Hammadde Q3", amount: 128000, status: "kazandı" }] }] },

  { id: 3, company_name: "EgePet Kimya A.Ş.", company_title: "Endüstriyel kimyasallar", city: "İzmir", phone: "+90 232 444 77 88", email: "satis@egepet.com.tr", website: "egepet.com.tr", category_tags: ["Kimya", "Hammadde"], partner_category_tags: [], reference_score: 4.9, is_verified: true, is_active: true, dual_role_status: "active",
    users: [{ name: "Burak Şahin", email: "burak@egepet.com.tr" }],
    origin: { type: "channel", channel: "Mavi Hat Danışmanlık", date: "01.2025" },
    pool: { inPool: true, paid: true, fee: 3200, since: "03.2025" }, becamePartner: { yes: true, since: "11.2025", note: "Kendi RFQ tenant'ı açıldı" },
    tenants: [{ id: "t_north", name: "NorthWind Lojistik", role: "user", assignments: [{ project: "Depo Otomasyon", by: "Ayşe Demir", invite: "accepted", date: "02.2026" }], quotes: [{ project: "NorthWind · Solvent", amount: 210000, status: "kazandı" }] }] },

  { id: 4, company_name: "Hız Kargo & Dağıtım", company_title: "Yurt içi lojistik", city: "İstanbul", phone: "+90 212 555 00 11", email: "kurumsal@hizkargo.com", website: "hizkargo.com", category_tags: ["Lojistik"], partner_category_tags: ["Hizmet"], reference_score: 3.8, is_verified: true, is_active: true, dual_role_status: "pending",
    users: [{ name: "Gökhan Er", email: "gokhan@hizkargo.com" }],
    origin: { type: "channel", channel: "Vektör İş Geliştirme", date: "02.2026" },
    pool: { inPool: true, paid: false, fee: null, since: "02.2026" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [] },

  { id: 5, company_name: "DataNet Yazılım", company_title: "ERP & entegrasyon", city: "İstanbul", phone: "+90 216 800 40 50", email: "kurumsal@datanet.com.tr", website: "datanet.com.tr", category_tags: ["Yazılım/IT", "Hizmet"], partner_category_tags: [], reference_score: 4.7, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Kaan Us", email: "kaan@datanet.com.tr" }],
    origin: { type: "direct", invitedBy: "—", date: "09.2024" },
    pool: { inPool: true, paid: true, fee: 1500, since: "10.2024" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_north", name: "NorthWind Lojistik", role: "user", assignments: [{ project: "Depo Otomasyon", by: "Ayşe Demir", invite: "accepted", date: "02.02.2026" }], quotes: [{ project: "Depo Otomasyon", amount: 175000, status: "kazandı" }] }] },

  { id: 6, company_name: "Akdeniz İnşaat Malz.", company_title: "Çimento & agrega", city: "Antalya", phone: "+90 242 311 22 33", email: "satis@akdenizinsaat.com", website: "akdenizinsaat.com", category_tags: ["İnşaat Malz."], partner_category_tags: [], reference_score: 4.4, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Mert Kaya", email: "mert@akdenizinsaat.com" }],
    origin: { type: "partner", partner: "Atlas Yapı & İnşaat", invitedBy: "Caner Aksoy", date: "01.2026" },
    pool: { inPool: true, paid: true, fee: 2000, since: "03.2026" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_atlas", name: "Atlas Yapı & İnşaat", role: "user", assignments: [{ project: "Konut Bloğu A", by: "Caner Aksoy", invite: "accepted", date: "02.05.2026" }, { project: "AVM İnşaatı", by: "Caner Aksoy", invite: "sent", date: "18.05.2026" }], quotes: [{ project: "Konut Bloğu A", amount: 96000, status: "kazandı" }] }] },

  { id: 7, company_name: "Volt Elektrik Malzeme", company_title: "Pano & kablo", city: "Ankara", phone: "+90 312 666 99 00", email: "info@voltelektrik.com", website: "voltelektrik.com", category_tags: ["Elektrik-Elektronik"], partner_category_tags: [], reference_score: 3.5, is_verified: false, is_active: true, dual_role_status: null,
    users: [{ name: "Tarık Yel", email: "tarik@voltelektrik.com" }],
    origin: { type: "direct", date: "05.2026" },
    pool: { inPool: true, paid: false, fee: null, since: "05.2026" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [] },

  { id: 8, company_name: "Marmara Tekstil", company_title: "Dokuma & iplik", city: "Tekirdağ", phone: "+90 282 717 18 19", email: "satis@marmaratekstil.com", website: "marmaratekstil.com", category_tags: ["Tekstil", "Hammadde"], partner_category_tags: [], reference_score: 4.0, is_verified: true, is_active: false, dual_role_status: null,
    users: [{ name: "Ceyda Boz", email: "ceyda@marmaratekstil.com" }],
    origin: { type: "channel", channel: "Bağımsız Acente · D. Koç", date: "02.2025" },
    pool: { inPool: true, paid: true, fee: 1200, since: "04.2025" }, becamePartner: { yes: false, since: null, note: null },
    tenants: [] },

  { id: 9, company_name: "Mavi Çelik Endüstri", company_title: "Sac & profil", city: "Karabük", phone: "+90 370 333 12 12", email: "teklif@mavicelik.com", website: "mavicelik.com", category_tags: ["Hammadde", "Makine"], partner_category_tags: [], reference_score: 4.3, is_verified: false, is_active: true, dual_role_status: "pending",
    users: [{ name: "Selin Arı", email: "selin@mavicelik.com" }],
    origin: { type: "partner", partner: "Atlas Yapı & İnşaat", invitedBy: "Caner Aksoy", date: "04.2026" },
    pool: { inPool: false, paid: false, fee: null, since: null }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_atlas", name: "Atlas Yapı & İnşaat", role: "owner", assignments: [{ project: "AVM İnşaatı", by: "Caner Aksoy", invite: "sent", date: "20.05.2026" }], quotes: [{ project: "AVM İnşaatı", amount: 540000, status: "değerlendirme" }] }] },

  { id: 10, company_name: "Demir Nakliyat Ltd.", company_title: "Şantiye içi taşıma", city: "Antalya", phone: "+90 242 700 10 20", email: "info@demirnakliyat.com", website: "demirnakliyat.com", category_tags: ["Lojistik"], partner_category_tags: [], reference_score: 3.6, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Ramazan Demir", email: "ramazan@demirnakliyat.com" }],
    origin: { type: "direct", invitedBy: "Atlas Yapı (kendi kaydı)", date: "03.2026" },
    pool: { inPool: false, paid: false, fee: null, since: null }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_atlas", name: "Atlas Yapı & İnşaat", role: "owner", assignments: [{ project: "Altyapı 2026", by: "Pelin Usta", invite: "accepted", date: "10.04.2026" }], quotes: [] }] },

  { id: 11, company_name: "Soğuk Hat Lojistik", company_title: "Frigorifik taşıma", city: "İstanbul", phone: "+90 212 909 80 70", email: "info@soguhat.com", website: "soguhat.com", category_tags: ["Lojistik"], partner_category_tags: [], reference_score: 3.9, is_verified: false, is_active: true, dual_role_status: null,
    users: [{ name: "Tuna Boz", email: "tuna@soguhat.com" }],
    origin: { type: "partner", partner: "PizzaMax Gıda A.Ş.", invitedBy: "Pınar Ak", date: "05.2026" },
    pool: { inPool: false, paid: false, fee: null, since: null }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_pizza", name: "PizzaMax Gıda A.Ş.", role: "owner", assignments: [{ project: "Soğuk Zincir", by: "Pınar Ak", invite: "sent", date: "21.05.2026" }], quotes: [] }] },

  { id: 12, company_name: "Filo Servis A.Ş.", company_title: "Araç bakım & yedek parça", city: "Kocaeli", phone: "+90 262 410 50 60", email: "servis@filoservis.com", website: "filoservis.com", category_tags: ["Makine", "Hizmet"], partner_category_tags: [], reference_score: 4.2, is_verified: true, is_active: true, dual_role_status: null,
    users: [{ name: "Barış Yol", email: "baris@filoservis.com" }],
    origin: { type: "channel", channel: "Mavi Hat Danışmanlık", date: "03.2026" },
    pool: { inPool: false, paid: false, fee: null, since: null }, becamePartner: { yes: false, since: null, note: null },
    tenants: [{ id: "t_north", name: "NorthWind Lojistik", role: "owner", assignments: [{ project: "Filo Bakım", by: "Ayşe Demir", invite: "accepted", date: "15.03.2026" }], quotes: [{ project: "Filo Bakım", amount: 62000, status: "kazandı" }] }] },
];

const SN_INVITE_LABEL: Record<string, { label: string; cls: string }> = {
  accepted: { label: "Kabul etti",       cls: "ok"   },
  sent:     { label: "Davet gönderildi", cls: "wait" },
  declined: { label: "Reddetti",         cls: "off"  },
};
const SN_DUAL_LABEL: Record<string, { label: string; cls: string }> = {
  active:   { label: "Çift rol · Aktif",         cls: "ok"   },
  pending:  { label: "Çift rol · Onay bekliyor", cls: "wait" },
  rejected: { label: "Çift rol · Red",            cls: "off"  },
};

function snOriginChip(s: SnSupplierRich) {
  if (s.origin.type === "partner") return { txt: snShortName(s.origin.partner ?? "") + " · davet", cls: "pt" };
  if (s.origin.type === "channel") return { txt: snShortName(s.origin.channel ?? "") + " · kanal", cls: "ch" };
  return { txt: "Doğrudan", cls: "dr" };
}
function snShortName(n: string) { return n.split(" ").slice(0, 2).join(" "); }
function snLogo(n: string) {
  return n.split(" ").filter((w) => /[A-Za-zÇĞİÖŞÜçğışöü]/.test(w)).slice(0, 2).map((w) => (w[0] ?? "").toUpperCase()).join("") || n.slice(0, 2).toUpperCase();
}
function snMoney(n: number) { return "₺" + n.toLocaleString("tr-TR"); }
function snJourneySteps(s: SnSupplierRich) {
  const steps: Array<{ kind: string; t: string; detail: string; date: string }> = [];
  if (s.origin.type === "partner")
    steps.push({ kind: "invite",  t: "Partner daveti ile geldi",       detail: (s.origin.partner ?? "") + (s.origin.invitedBy ? " · " + s.origin.invitedBy : ""), date: s.origin.date });
  else if (s.origin.type === "channel")
    steps.push({ kind: "channel", t: "İş ortağı (kanal) getirdi",     detail: s.origin.channel ?? "",    date: s.origin.date });
  else
    steps.push({ kind: "direct",  t: "Doğrudan platforma kaydoldu",   detail: s.origin.invitedBy ?? "—", date: s.origin.date });
  if (s.pool.inPool)
    steps.push({ kind: "pool",    t: s.pool.paid ? "Havuza ÜCRETLİ katıldı" : "Havuza katıldı (ücretsiz)", detail: s.pool.paid ? "Üyelik bedeli " + snMoney(s.pool.fee ?? 0) : "platform ağına açıldı", date: s.pool.since ?? "" });
  if (s.becamePartner.yes)
    steps.push({ kind: "partner", t: "Stratejik partner oldu",         detail: s.becamePartner.note ?? "dual-role aktif", date: s.becamePartner.since ?? "" });
  return steps;
}

function SnStars({ score }: { score: number }) {
  const full = Math.round(score);
  return (
    <span className="sn-stars" title={`${score.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= full ? "on" : ""}>★</span>)}
      <em>{score.toFixed(1)}</em>
    </span>
  );
}

export function PlatformSuppliersTab() {
  const { user } = useAuth();
  const canCreate = canAccessAdminSurface(user);
  const apiBase = import.meta.env.VITE_API_URL ?? "";

  // Real API — platform supplier count (TODO(data): also load list when origin/journey model is available)
  const [realCount, setRealCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", website: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/admin/platform-suppliers`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    }).then(async (r) => {
      const payload = await r.json().catch(() => null);
      if (r.ok && Array.isArray(payload)) setRealCount(payload.length);
    }).catch(() => {});
  }, [apiBase]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormErr("Firma adı zorunlu"); return; }
    if (!form.email.trim()) { setFormErr("E-posta zorunlu"); return; }
    setSaving(true); setFormErr(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/platform-suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setFormErr((d as Record<string, unknown>).detail as string ?? "Hata"); return; }
      setForm({ name: "", email: "", phone: "", website: "", city: "" });
      setShowForm(false);
      setRealCount((c) => c + 1);
    } catch { setFormErr("Sunucu hatası"); }
    finally { setSaving(false); }
  }

  // TODO(data): all below uses mock data — replace with real API when origin/journey model is available
  const [view, setView] = useState<"pool" | "partner">("pool");
  const [tenantId, setTenantId] = useState(SN_MOCK_TENANTS[0]?.id ?? "");
  const [selId, setSelId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("all");

  const tenant = SN_MOCK_TENANTS.find((t) => t.id === tenantId);
  const ql = q.trim().toLowerCase();

  const poolList    = SN_MOCK_SUPPLIERS.filter((s) => s.pool.inPool);
  const matchQ = (s: SnSupplierRich) =>
    !ql || (s.company_name + " " + s.company_title + " " + s.city + " " + (s.origin.partner ?? "") + " " + (s.origin.channel ?? "")).toLowerCase().includes(ql);
  const poolFiltered = poolList.filter((s) => {
    if (!matchQ(s)) return false;
    if (flt === "paid" && !s.pool.paid) return false;
    if (flt === "free" && s.pool.paid) return false;
    if (flt === "partner" && !s.becamePartner.yes) return false;
    if (flt === "fromchannel" && s.origin.type !== "channel") return false;
    return true;
  });
  const partnerList = SN_MOCK_SUPPLIERS.filter((s) => s.tenants.some((t) => t.id === tenantId));
  const partnerFiltered = partnerList.filter((s) => {
    if (!matchQ(s)) return false;
    const rel = s.tenants.find((t) => t.id === tenantId);
    if (flt === "owner" && rel?.role !== "owner") return false;
    if (flt === "user" && rel?.role !== "user") return false;
    return true;
  });

  const list = view === "pool" ? poolFiltered : partnerFiltered;
  const sel  = SN_MOCK_SUPPLIERS.find((s) => s.id === selId) ?? list[0] ?? null;
  const selRel = sel ? sel.tenants.find((t) => t.id === tenantId) ?? null : null;

  const paidCount    = poolList.filter((s) => s.pool.paid).length;
  const channelCount = poolList.filter((s) => s.origin.type !== "direct").length;
  const partnerCount = poolList.filter((s) => s.becamePartner.yes).length;
  const ownerCount   = partnerList.filter((s) => s.tenants.find((t) => t.id === tenantId)?.role === "owner").length;
  const userCount    = partnerList.filter((s) => s.tenants.find((t) => t.id === tenantId)?.role === "user").length;
  const assignedCount = partnerList.filter((s) => (s.tenants.find((t) => t.id === tenantId)?.assignments.length ?? 0) > 0).length;
  const pendingCount  = partnerList.reduce((a, s) => a + (s.tenants.find((t) => t.id === tenantId)?.assignments.filter((x) => x.invite === "sent").length ?? 0), 0);

  return (
    <div className="pst-tab">
      <PageHeader
        eyebrow="Tedarik Ağı"
        title="Tedarikçi Ağı"
        sub="Platform havuzu ve partner tedarikçileri tek ekranda — her tedarikçinin kökeni, havuza geçişi ve stratejik partnerliğe dönüşümü izlenir."
        actions={
          canCreate ? (
            <button type="button" className="pr-btn--primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "İptal" : "+ Tedarikçi Ekle"}
            </button>
          ) : undefined
        }
      />

      {showForm && canCreate && (
        <Section title="Yeni Platform Tedarikçisi" sub="platform havuzuna doğrudan ekle">
          <form onSubmit={handleCreate} className="pst-form">
            <input className="pst-input" placeholder="Firma adı *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="pst-input" placeholder="E-posta *" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <input className="pst-input" placeholder="Telefon *" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <input className="pst-input" placeholder="Web sitesi" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
            <input className="pst-input" placeholder="Şehir" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
            <div className="pst-form__footer">
              {formErr && <span className="pst-form__err">{formErr}</span>}
              <button type="submit" className="pr-btn--primary" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </form>
        </Section>
      )}

      {/* View tabs */}
      <div className="nh-tabs">
        <button type="button" className={`nh-tab${view === "pool" ? " on" : ""}`}
          onClick={() => { setView("pool"); setFlt("all"); setSelId(null); }}>
          Platform Havuzu
        </button>
        <button type="button" className={`nh-tab${view === "partner" ? " on" : ""}`}
          onClick={() => { setView("partner"); setFlt("all"); setSelId(null); }}>
          Partner Tedarikçileri
        </button>
      </div>

      {view === "partner" && (
        <div className="pr-tenantbar">
          <div className="pr-tenantbar__l">
            <span className="pr-tenantbar__lbl">Stratejik Partner</span>
            <select className="pr-sel" aria-label="Tenant seçimi" value={tenantId}
              onChange={(e) => { setTenantId(e.target.value); setSelId(null); }}>
              {SN_MOCK_TENANTS.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.plan}</option>)}
            </select>
          </div>
          <span className="pr-tenantbar__hint">{partnerList.length} tedarikçi bağlı</span>
        </div>
      )}

      {/* KPI stats */}
      <div className="nh-stats">
        {view === "pool" ? (
          <>
            <StatCard label="Havuz geneli" value={Math.max(realCount, poolList.length)} sub="paylaşımlı · tüm ağ" />
            <StatCard label="Ücretli üye"  value={paidCount}    sub="havuza ödeme yaparak"      accent="green"  />
            <StatCard label="Davet/kanal kaynaklı" value={channelCount} sub="partner daveti + iş ortağı" accent="blue" />
            <StatCard label="Partner'a dönüşen" value={partnerCount} sub="çift rol · stratejik partner" accent="violet" />
          </>
        ) : (
          <>
            <StatCard label="Özel tedarikçi"    value={ownerCount}    sub="firmanın kendi eklediği"  accent="blue"   />
            <StatCard label="Havuzdan kullanılan" value={userCount}    sub="platform ağından"          accent="green"  />
            <StatCard label="Projede atanmış"   value={assignedCount} sub="aktif atama"               accent="violet" />
            <StatCard label="Davet bekleyen"     value={pendingCount}  sub="yanıt bekliyor"            accent="gold"   />
          </>
        )}
      </div>

      {/* Search + filter toolbar */}
      <div className="sp-toolbar">
        <div className="sp-search">
          <span className="sp-search__icon">⌕</span>
          <input className="sp-search__input"
            placeholder={view === "pool" ? "Firma, köken (partner/kanal) ara…" : "Tedarikçi ara…"}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="sp-segs">
          {(view === "pool"
            ? ([["all", "Tümü"], ["paid", "Ücretli üye"], ["fromchannel", "Kanaldan gelen"], ["partner", "Partner olmuş"]] as const)
            : ([["all", "Tümü"], ["owner", "Özel"], ["user", "Havuzdan"]] as const)
          ).map(([v, l]) => (
            <button key={v} type="button" className={flt === v ? "on" : ""} onClick={() => setFlt(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Two-pane split */}
      <div className="nh-split">
        <aside className="nh-list">
          <div className="nh-list__hd">
            {view === "pool" ? "Havuzdaki tedarikçiler" : (tenant?.name ?? "Tenant")} <span>{list.length}</span>
          </div>
          <div className="nh-list__scroll">
            {list.length === 0 ? (
              <div className="nh-list-empty">Eşleşen tedarikçi yok.</div>
            ) : list.map((s) => {
              const oc  = snOriginChip(s);
              const rel = s.tenants.find((t) => t.id === tenantId);
              return (
                <button key={s.id} type="button"
                  className={`sp-srow${sel?.id === s.id ? " on" : ""}${s.is_active ? "" : " off"}`}
                  onClick={() => setSelId(s.id)}>
                  <span className="sp-logo">{snLogo(s.company_name)}</span>
                  <span className="sp-srow__meta">
                    <b>
                      {s.company_name}
                      {s.is_verified && <span className="sp-ver" title="Doğrulanmış">✓</span>}
                    </b>
                    <span className="sp-tags">
                      <i className={`sn-oc sn-oc--${oc.cls}`}>{oc.txt}</i>
                      {view === "partner" && rel && (
                        <i className={`nh-badge ${rel.role === "owner" ? "info" : "ok"}`}>{rel.role === "owner" ? "Özel" : "Havuzdan"}</i>
                      )}
                      {view === "pool" && s.pool.paid && <i className="sn-pill sn-pill--paid">ücretli</i>}
                      {s.becamePartner.yes && <i className="sn-pill sn-pill--partner">partner</i>}
                    </span>
                  </span>
                  <span className="sp-srow__r">
                    <SnStars score={s.reference_score} />
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="nh-detail">
          {!sel ? (
            <div className="nh-list-empty nh-list-empty--lg">Tedarikçi seçin.</div>
          ) : (
            <>
              <div className="nh-detail__hd">
                <div className="sn-detail-l">
                  <span className="sp-logo sp-logo--lg">{snLogo(sel.company_name)}</span>
                  <div>
                    <h3>
                      {sel.company_name}
                      {sel.is_verified
                        ? <span className="nh-badge ok">✓ Doğrulanmış</span>
                        : <span className="nh-badge wait">Onaysız</span>}
                    </h3>
                    <p className="nh-mut">{sel.company_title} · {sel.city} · {sel.phone} · {sel.email}</p>
                    <div className="sn-detail-meta">
                      <SnStars score={sel.reference_score} />
                      {sel.pool.inPool
                        ? <span className="nh-badge ok">Havuzda{sel.pool.paid ? " · ücretli" : ""}</span>
                        : <span className="nh-badge info">Partner tedarikçisi</span>}
                      {sel.dual_role_status && (
                        <span className={`nh-badge ${SN_DUAL_LABEL[sel.dual_role_status]?.cls ?? "info"}`}>
                          {SN_DUAL_LABEL[sel.dual_role_status]?.label ?? sel.dual_role_status}
                        </span>
                      )}
                      {!sel.is_active && <span className="nh-badge off">Pasif</span>}
                    </div>
                  </div>
                </div>
                <div className="sp-actions">
                  {view === "pool" && (
                    <button type="button" className="nh-act">
                      {sel.is_verified ? "Doğrulamayı kaldır" : "✓ Doğrula"}
                    </button>
                  )}
                  <button type="button" className="nh-act">
                    {sel.is_active ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                </div>
              </div>

              {sel.dual_role_status === "pending" && (
                <div className="sp-dual">
                  <div>
                    <b>Çift rol başvurusu bekliyor</b>
                    <span>Bu tedarikçi stratejik partner olmak istiyor. Onaylarsanız yolculuk güncellenir.</span>
                  </div>
                  <div className="sp-dual__acts">
                    <button type="button" className="nh-act ok">Onayla</button>
                    <button type="button" className="nh-act danger">Reddet</button>
                  </div>
                </div>
              )}

              <Section title="Köken & Yolculuk" sub="nereden geldi → nereye geçti">
                <div className="sn-facts">
                  <div className="sn-fact"><span>Köken</span>
                    <b>{sel.origin.type === "partner" ? "Partner daveti" : sel.origin.type === "channel" ? "İş ortağı (kanal)" : "Doğrudan"}</b>
                    <i>{sel.origin.partner ?? sel.origin.channel ?? sel.origin.invitedBy ?? "—"}</i>
                  </div>
                  <div className="sn-fact"><span>Havuz üyeliği</span>
                    <b>{sel.pool.inPool ? (sel.pool.paid ? "Ücretli üye" : "Ücretsiz") : "Havuzda değil"}</b>
                    <i>{sel.pool.inPool ? (sel.pool.paid ? snMoney(sel.pool.fee ?? 0) + " · " + (sel.pool.since ?? "") : sel.pool.since ?? "") : "sadece partner tedarikçisi"}</i>
                  </div>
                  <div className="sn-fact"><span>Stratejik partner</span>
                    <b>{sel.becamePartner.yes ? "Evet" : sel.dual_role_status === "pending" ? "Başvuru bekliyor" : "Hayır"}</b>
                    <i>{sel.becamePartner.yes ? (sel.becamePartner.since ?? "") : sel.dual_role_status === "pending" ? "çift rol onayı" : "—"}</i>
                  </div>
                  <div className="sn-fact"><span>Kullanan partner</span>
                    <b>{sel.tenants.filter((t) => t.role === "user").length}</b>
                    <i>{sel.tenants.filter((t) => t.role === "user").length
                      ? sel.tenants.filter((t) => t.role === "user").map((u) => snShortName(u.name)).join(", ")
                      : "henüz yok"}</i>
                  </div>
                </div>
                <div className="sn-journey">
                  {snJourneySteps(sel).map((st, i) => (
                    <div key={i} className={`sn-step sn-step--${st.kind}`}>
                      <span className="sn-step__dot" />
                      <div className="sn-step__body"><b>{st.t}</b><span>{st.detail}</span></div>
                      <span className="sn-step__date">{st.date}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {view === "pool" ? (
                <Section title="Bu havuz tedarikçisini kullanan partnerler" sub="hangi stratejik partner kullanıyor">
                  {sel.tenants.filter((t) => t.role === "user").length === 0 ? (
                    <p className="nh-mut">Henüz hiçbir partner bu tedarikçiyi kullanmıyor.</p>
                  ) : (
                    <table className="nh-table">
                      <thead><tr><th>Partner</th><th>Atandığı proje</th><th>Davet</th><th>Kazanılan teklif</th></tr></thead>
                      <tbody>
                        {sel.tenants.filter((t) => t.role === "user").map((t, i) => (
                          <tr key={i}>
                            <td><b>{t.name}</b></td>
                            <td className="nh-mut">{t.assignments.map((a) => a.project).join(", ") || "—"}</td>
                            <td>
                              {t.assignments.map((a, j) => (
                                <span key={j} className={`nh-badge nh-badge--mr ${SN_INVITE_LABEL[a.invite]?.cls ?? "info"}`}>
                                  {SN_INVITE_LABEL[a.invite]?.label ?? a.invite}
                                </span>
                              ))}
                            </td>
                            <td className="nh-mono">
                              {t.quotes.filter((qq) => qq.status === "kazandı").length
                                ? snMoney(t.quotes.filter((qq) => qq.status === "kazandı").reduce((a, b) => a + b.amount, 0))
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              ) : (
                <>
                  <Section title={`${tenant?.name ?? "Partner"} · atandığı projeler & davet`} sub="ProjectSupplier — davet ve katılım">
                    {!selRel || selRel.assignments.length === 0 ? (
                      <p className="nh-mut">Bu partnerin projelerine henüz atanmadı.</p>
                    ) : (
                      <table className="nh-table">
                        <thead><tr><th>Proje</th><th>Atayan</th><th>Tarih</th><th>Davet</th><th>Eylem</th></tr></thead>
                        <tbody>
                          {selRel.assignments.map((a, i) => (
                            <tr key={i}>
                              <td><b>{a.project}</b></td>
                              <td className="nh-mut">{a.by}</td>
                              <td className="nh-mut">{a.date}</td>
                              <td><span className={`nh-badge ${SN_INVITE_LABEL[a.invite]?.cls ?? "info"}`}>{SN_INVITE_LABEL[a.invite]?.label ?? a.invite}</span></td>
                              <td>{a.invite !== "accepted" && <button type="button" className="nh-act">Daveti yenile</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>
                  <Section title="Bu partner için teklif geçmişi" sub="tenant kapsamındaki RFQ'lar">
                    {!selRel || selRel.quotes.length === 0 ? (
                      <p className="nh-mut">Henüz teklif yok.</p>
                    ) : (
                      <table className="nh-table">
                        <thead><tr><th>Proje / RFQ</th><th>Tutar</th><th>Durum</th></tr></thead>
                        <tbody>
                          {selRel.quotes.map((qt, i) => (
                            <tr key={i}>
                              <td><b>{qt.project}</b></td>
                              <td className="nh-mono">{snMoney(qt.amount)}</td>
                              <td><span className={`nh-badge ${qt.status === "kazandı" ? "ok" : "wait"}`}>{qt.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Section>
                </>
              )}

              <Section title="Kategoriler & yetkili kişiler" sub="tedarik etiketleri">
                <div className="sn-cats">
                  {[...sel.category_tags, ...sel.partner_category_tags].map((t) => (
                    <span key={t} className="sn-cat">{t}</span>
                  ))}
                </div>
                <div className="nh-members">
                  {sel.users.map((u, i) => (
                    <div key={i} className="nh-member">
                      <span className="nh-av">{u.name.split(" ").map((p) => (p[0] ?? "").toUpperCase()).join("").slice(0, 2)}</span>
                      <div><b>{u.name}</b><span className="nh-mut">{u.email}</span></div>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── PublicPricingTab types & helpers ─────────────────────────────────── */
type PlLimit   = { key: string; label: string; value: string };
type PlPlan    = {
  code: string; name: string; codeLabel: string;
  priceMonthly: number; priceBefore?: number | null; currency: string;
  tagline: string; featured: boolean; badge: string | null;
  ctaLabel: string; ctaStyle: string;
  limits: PlLimit[]; features: string[];
};
type PlAddon   = { code: string; icon: string; name: string; price: number; unit: string; desc: string };
type PlAudience = {
  code: string; label: string; eyebrow: string; headline: string; blurb: string;
  plans: PlPlan[]; addons: PlAddon[];
};
type PlData = {
  strategic: PlAudience; supplier: PlAudience; channel: PlAudience;
  employer: PlAudience; candidate: PlAudience; updatedAt?: string;
};

const AUD_ORDER = ["strategic", "supplier", "channel", "employer", "candidate"] as const;
type AudCode = typeof AUD_ORDER[number];

const AUD_META: Record<AudCode, { label: string; eyebrow: string; headline: string; blurb: string }> = {
  strategic: { label: "Stratejik Partner", eyebrow: "Stratejik Partner · Fiyatlandırma", headline: "İşletmenize özel paketler",   blurb: "Satın alma süreçlerinizi dijitalleştirin, tedarikçilerinizle güçlü bağlar kurun." },
  supplier:  { label: "Tedarikçi",         eyebrow: "Tedarikçi · Fiyatlandırma",         headline: "Tekliflerinizi büyütün",       blurb: "Yeni müşterilere ulaşın, tekliflerinizi zamanında iletin." },
  channel:   { label: "İş Ortağı (Kanal)", eyebrow: "Kanal · Fiyatlandırma",             headline: "Ortaklık programı",            blurb: "Müşterilerinize Buyer Asistans'ı önererek gelir elde edin." },
  employer:  { label: "İşveren",           eyebrow: "İşveren · Fiyatlandırma",           headline: "Yetenek bulun, hızlı işe alın",blurb: "İK süreçlerinizi hızlandırmak için doğru araçlar." },
  candidate: { label: "Aday",              eyebrow: "Kariyer · Fiyatlandırma",           headline: "Kariyerinizi yönetin",         blurb: "Profil oluşturun, başvurun ve takip edin." },
};

function parsePlLimit(l: unknown): PlLimit {
  const r = (typeof l === "object" && l !== null ? l : {}) as Record<string, unknown>;
  return { key: String(r.key ?? ""), label: String(r.label ?? r.key ?? ""), value: String(r.value ?? "") };
}
function parseOldLimits(limits: unknown): PlLimit[] {
  if (typeof limits !== "object" || limits === null || Array.isArray(limits)) return [];
  return Object.entries(limits as Record<string, unknown>).map(([k, v]) => ({ key: k, label: k, value: String(v) }));
}
function parsePlPlan(p: unknown): PlPlan {
  const r = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
  const rawLimits = r.limits;
  const limits = Array.isArray(rawLimits) ? rawLimits.map(parsePlLimit) : parseOldLimits(rawLimits);
  return {
    code: String(r.code ?? `plan-${Date.now()}`),
    name: String(r.name ?? "Plan"),
    codeLabel: String(r.codeLabel ?? r.code_label ?? r.code ?? "PLAN").slice(0, 8),
    priceMonthly: Number(r.priceMonthly ?? r.price_monthly ?? 0),
    priceBefore: typeof r.priceBefore === "number" ? r.priceBefore : null,
    currency: String(r.currency ?? "₺"),
    tagline: String(r.tagline ?? r.description ?? ""),
    featured: !!r.featured,
    badge: typeof r.badge === "string" ? r.badge : null,
    ctaLabel: String(r.ctaLabel ?? "Başlayın"),
    ctaStyle: String(r.ctaStyle ?? "ghost"),
    limits,
    features: Array.isArray(r.features) ? r.features.map(String) : [],
  };
}
function parsePlAddon(a: unknown): PlAddon {
  const r = (typeof a === "object" && a !== null ? a : {}) as Record<string, unknown>;
  return {
    code: String(r.code ?? `addon-${Date.now()}`),
    icon: String(r.icon ?? "+"),
    name: String(r.name ?? "Eklenti"),
    price: Number(r.price ?? r.price_monthly ?? 0),
    unit: String(r.unit ?? "/ ay"),
    desc: String(r.desc ?? r.description ?? ""),
  };
}
function parsePlAudience(raw: unknown, code: AudCode): PlAudience {
  const meta = AUD_META[code];
  if (typeof raw !== "object" || raw === null)
    return { code, ...meta, plans: [], addons: [] };
  const r = raw as Record<string, unknown>;
  return {
    code,
    label:   typeof r.label   === "string" ? r.label   : meta.label,
    eyebrow: typeof r.eyebrow === "string" ? r.eyebrow : meta.eyebrow,
    headline:typeof r.headline=== "string" ? r.headline: meta.headline,
    blurb:   typeof r.blurb   === "string" ? r.blurb   : meta.blurb,
    plans:  Array.isArray(r.plans)  ? r.plans.map(parsePlPlan)  : [],
    addons: Array.isArray(r.addons) ? r.addons.map(parsePlAddon): [],
  };
}
function fromApiResponse(raw: unknown): PlData {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    strategic: parsePlAudience(r.strategic ?? r.strategic_partner, "strategic"),
    supplier:  parsePlAudience(r.supplier,  "supplier"),
    channel:   parsePlAudience(r.channel,   "channel"),
    employer:  parsePlAudience(r.employer,  "employer"),
    candidate: parsePlAudience(r.candidate, "candidate"),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}

/* ── PlPlanEditor ────────────────────────────────────────────────────── */
function PlPlanEditor({ plan, canWrite, onChange, onLimitChange, onLimitAdd, onLimitRemove,
  onFeatureChange, onFeatureAdd, onFeatureRemove, onSetFeatured, onDelete }: {
  plan: PlPlan; canWrite: boolean;
  onChange: (f: string, v: unknown) => void;
  onLimitChange: (li: number, lf: string, lv: string) => void;
  onLimitAdd: () => void; onLimitRemove: (li: number) => void;
  onFeatureChange: (fi: number, v: string) => void;
  onFeatureAdd: () => void; onFeatureRemove: (fi: number) => void;
  onSetFeatured: () => void; onDelete: () => void;
}) {
  const [adjustPct, setAdjustPct] = useState(10);
  const hasDiscount = plan.priceBefore != null && plan.priceBefore > plan.priceMonthly;
  const savings     = hasDiscount ? (plan.priceBefore! - plan.priceMonthly) : 0;
  const savingsPct  = hasDiscount ? Math.round((savings / plan.priceBefore!) * 100) : 0;

  function applyAdjustment(dir: 1 | -1) {
    const cur = plan.priceMonthly;
    if (cur === 0) return;
    const pct = Math.abs(adjustPct) || 0;
    if (pct === 0) return;
    if (dir === -1) {
      const before = (plan.priceBefore != null && plan.priceBefore > cur) ? plan.priceBefore : cur;
      onChange("priceMonthly", Math.round(cur * (1 - pct / 100)));
      onChange("priceBefore", before);
    } else {
      const newPrice = Math.round(cur * (1 + pct / 100));
      onChange("priceMonthly", newPrice);
      if (plan.priceBefore != null && newPrice >= plan.priceBefore) onChange("priceBefore", null);
    }
  }

  return (
    <div className={`pl-plan${plan.featured ? " pl-plan--featured" : ""}`}>
      <div className="pl-plan__top">
        <div className="pl-plan__top-l">
          <input className="pl-plan__code-input" placeholder="STARTER" aria-label="Plan kodu"
            value={plan.codeLabel ?? ""} disabled={!canWrite}
            onChange={(e) => onChange("codeLabel", e.target.value)} />
          <input className="pl-plan__name-input" placeholder="Plan adı" aria-label="Plan adı"
            value={plan.name} disabled={!canWrite}
            onChange={(e) => onChange("name", e.target.value)} />
        </div>
        <div className="pl-plan__top-r">
          {plan.featured && <span className="pl-pop-badge">{plan.badge ?? "EN POPÜLER"}</span>}
          <button type="button" className="pl-icn-btn" title="En popüler yap" disabled={!canWrite} onClick={onSetFeatured}>
            <svg width="14" height="14" viewBox="0 0 24 24"
              fill={plan.featured ? "#D4AF37" : "none"}
              stroke={plan.featured ? "#D4AF37" : "#94a3b8"} strokeWidth="2">
              <polygon points="12 2 15 9 22 9 17 14 19 22 12 17 5 22 7 14 2 9 9 9"/>
            </svg>
          </button>
          <button type="button" className="pl-icn-btn" title="Sil" disabled={!canWrite} onClick={onDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="pl-plan__price-row">
        <span className="pl-plan__currency">{plan.currency}</span>
        <input className="pl-plan__price-input" type="number" min="0" step="100" aria-label="Aylık fiyat"
          value={plan.priceMonthly} disabled={!canWrite}
          onChange={(e) => onChange("priceMonthly", Number(e.target.value))} />
        <span className="pl-plan__per">/ ay</span>
      </div>

      <div className="pl-adj">
        <div className="pl-adj__row">
          <span className="pl-adj__label">Fiyat ayarla</span>
          <div className="pl-adj__input-group">
            <input type="number" min="1" max="90" step="1" className="pl-adj__pct"
              aria-label="Yüzde" value={adjustPct} disabled={!canWrite}
              onChange={(e) => setAdjustPct(Number(e.target.value))} />
            <span className="pl-adj__pct-sign">%</span>
          </div>
          <button type="button" className="pl-adj__btn pl-adj__btn--down"
            disabled={!canWrite} onClick={() => applyAdjustment(-1)}>↓ İndir</button>
          <button type="button" className="pl-adj__btn pl-adj__btn--up"
            disabled={!canWrite} onClick={() => applyAdjustment(1)}>↑ Artır</button>
        </div>
        {hasDiscount && (
          <div className="pl-adj__discount">
            <div>
              <span className="pl-adj__old">Eski: {plan.currency}{plan.priceBefore!.toLocaleString("tr-TR")}</span>
              <span className="pl-adj__save">%{savingsPct} indirim · {plan.currency}{savings.toLocaleString("tr-TR")} tasarruf</span>
            </div>
            <button type="button" className="pl-adj__clear" disabled={!canWrite}
              onClick={() => onChange("priceBefore", null)}>×</button>
          </div>
        )}
      </div>

      <textarea className="pl-plan__tagline" rows={2} placeholder="Plan açıklaması" aria-label="Plan açıklaması"
        value={plan.tagline} disabled={!canWrite}
        onChange={(e) => onChange("tagline", e.target.value)} />

      <div className="pl-plan__section">
        <div className="pl-plan__section-head">
          <span>Limitler ({plan.limits.length})</span>
          {canWrite && <button type="button" className="pl-text-btn" onClick={onLimitAdd}>+ ekle</button>}
        </div>
        {plan.limits.map((lim, li) => (
          <div key={li} className="pl-limit-row">
            <input className="pl-limit-key" placeholder="Etiket" aria-label="Limit etiket"
              value={lim.label} disabled={!canWrite}
              onChange={(e) => onLimitChange(li, "label", e.target.value)} />
            <input className="pl-limit-val" placeholder="Değer" aria-label="Limit değer"
              value={lim.value} disabled={!canWrite}
              onChange={(e) => onLimitChange(li, "value", e.target.value)} />
            {canWrite && <button type="button" className="pl-icn-btn pl-icn-btn--sm" onClick={() => onLimitRemove(li)}>×</button>}
          </div>
        ))}
      </div>

      <div className="pl-plan__section">
        <div className="pl-plan__section-head">
          <span>Özellikler ({plan.features.length})</span>
          {canWrite && <button type="button" className="pl-text-btn" onClick={onFeatureAdd}>+ ekle</button>}
        </div>
        {plan.features.map((feat, fi) => (
          <div key={fi} className="pl-feat-row">
            <span className="pl-feat-check">✓</span>
            <input className="pl-feat-input" placeholder="Özellik metni" aria-label="Özellik"
              value={feat} disabled={!canWrite}
              onChange={(e) => onFeatureChange(fi, e.target.value)} />
            {canWrite && <button type="button" className="pl-icn-btn pl-icn-btn--sm" onClick={() => onFeatureRemove(fi)}>×</button>}
          </div>
        ))}
      </div>

      <div className="pl-plan__cta-row">
        <input className="pl-plan__cta-input" placeholder="CTA metni" aria-label="CTA metni"
          value={plan.ctaLabel ?? ""} disabled={!canWrite}
          onChange={(e) => onChange("ctaLabel", e.target.value)} />
        <select className="pl-plan__cta-style" aria-label="CTA stili"
          value={plan.ctaStyle ?? "ghost"} disabled={!canWrite}
          onChange={(e) => onChange("ctaStyle", e.target.value)}>
          <option value="ghost">Ghost</option>
          <option value="primary">Primary (Altın)</option>
          <option value="supplier">Mavi</option>
          <option value="channel">Amber</option>
          <option value="employer">İndigo</option>
          <option value="candidate">Yeşil</option>
        </select>
      </div>
    </div>
  );
}

/* ── PlAddonEditor ───────────────────────────────────────────────────── */
function PlAddonEditor({ addon, canWrite, onChange, onDelete }: {
  addon: PlAddon; canWrite: boolean;
  onChange: (f: string, v: unknown) => void;
  onDelete: () => void;
}) {
  return (
    <div className="pl-addon">
      <input className="pl-addon__icon" placeholder="+" aria-label="İkon" maxLength={3}
        value={addon.icon} disabled={!canWrite}
        onChange={(e) => onChange("icon", e.target.value)} />
      <div className="pl-addon__main">
        <input className="pl-addon__name" placeholder="Eklenti adı" aria-label="Eklenti adı"
          value={addon.name} disabled={!canWrite}
          onChange={(e) => onChange("name", e.target.value)} />
        <input className="pl-addon__desc" placeholder="Açıklama" aria-label="Açıklama"
          value={addon.desc} disabled={!canWrite}
          onChange={(e) => onChange("desc", e.target.value)} />
      </div>
      <div className="pl-addon__price">
        <input className="pl-addon__price-input" type="number" min="0" step="10" aria-label="Fiyat"
          value={addon.price} disabled={!canWrite}
          onChange={(e) => onChange("price", Number(e.target.value))} />
        <input className="pl-addon__unit" placeholder="/ ay" aria-label="Birim"
          value={addon.unit} disabled={!canWrite}
          onChange={(e) => onChange("unit", e.target.value)} />
      </div>
      {canWrite && (
        <button type="button" className="pl-icn-btn" title="Sil" onClick={onDelete}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── PublicPricingTab ────────────────────────────────────────────────── */
export function PublicPricingTab() {
  const { user: pricingUser } = useAuth();
  const [data, setData] = useState<PlData | null>(null);
  const [audience, setAudience] = useState<AudCode>("strategic");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const canWritePricing = isSuperAdminUser(pricingUser);

  const loadConfig = useCallback(() => {
    setLoadingConfig(true);
    setSaveMessage(null);
    setSaveError(null);
    fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then((r) => r.json() as Promise<unknown>)
      .then((raw) => { setData(fromApiResponse(raw)); setDirty(false); })
      .catch(() => setSaveError("Public fiyatlandırma verisi yüklenemedi"))
      .finally(() => setLoadingConfig(false));
  }, [apiBase]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  function update(producer: (d: PlData) => void) {
    setData((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as PlData;
      producer(next);
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!data) return;
    setSavingConfig(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({ ...data, updatedAt: new Date().toISOString() }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) { setSaveError((payload as { detail?: string }).detail ?? "Kayıt başarısız"); return; }
      setData(fromApiResponse(payload));
      setSaveMessage("Fiyatlandırma konfigürasyonu güncellendi.");
      setDirty(false);
    } catch {
      setSaveError("Sunucu hatası.");
    } finally {
      setSavingConfig(false);
    }
  }

  const aud = data?.[audience];
  const lastSaved = data?.updatedAt ? new Date(data.updatedAt).toLocaleString("tr-TR") : "Hiç kaydedilmedi";

  return (
    <div>
      <PageHeader
        eyebrow="Ticari · Public Pricing"
        title="Genel Fiyatlandırma"
        sub={`Public sayfalarda ve kayıt akışlarında görünen planlar & ekstralar · Son: ${lastSaved}`}
        actions={
          canWritePricing ? (
            <div className="ppt-actions">
              <button type="button" className="ppt-btn ppt-btn--ghost" onClick={loadConfig} disabled={loadingConfig}>Yenile</button>
              <button type="button" className="ppt-btn ppt-btn--primary" onClick={() => void handleSave()} disabled={savingConfig || !dirty}>
                {savingConfig ? "Kaydediliyor…" : dirty ? "● Kaydet" : "✓ Kaydedildi"}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="ppt-sync-bar">
        <span className="ppt-sync-bar__dot" />
        <span><strong>Tek kaynak (single source of truth)</strong> — buradaki değişiklikler public fiyatlandırma sayfasına ve kayıt akışlarına uygulanır.</span>
        <span className={`ppt-sync-bar__badge ${canWritePricing ? "ppt-sync-bar__badge--live" : "ppt-sync-bar__badge--ro"}`}>
          {canWritePricing ? "CANLI" : "SALT OKUMA"}
        </span>
      </div>

      {saveError   && <div className="ppt-msg ppt-msg--err">{saveError}</div>}
      {saveMessage && <div className="ppt-msg ppt-msg--ok">{saveMessage}</div>}
      {loadingConfig && <div className="ppt-loading">Yükleniyor…</div>}

      {!loadingConfig && data && (
        <>
          <div className="pl-aud-switch">
            {AUD_ORDER.map((code) => (
              <button key={code} type="button"
                className={`pl-aud-btn pl-aud-btn--${code}${audience === code ? " on" : ""}`}
                onClick={() => setAudience(code)}>
                <div className="pl-aud-btn__name">{data[code].label}</div>
                <div className="pl-aud-btn__count">{data[code].plans.length} plan · {data[code].addons.length} ekstra</div>
              </button>
            ))}
          </div>

          {aud && (
            <>
              <Section title="Genel Mesaj" sub="Public sayfanın üst başlıkları">
                <div className="pl-fields">
                  <div className="pl-field">
                    <label>Eyebrow</label>
                    <input type="text" className="pl-input" aria-label="Eyebrow"
                      value={aud.eyebrow} disabled={!canWritePricing}
                      onChange={(e) => update((d) => { d[audience].eyebrow = e.target.value; })} />
                  </div>
                  <div className="pl-field">
                    <label>Headline</label>
                    <input type="text" className="pl-input" aria-label="Headline"
                      value={aud.headline} disabled={!canWritePricing}
                      onChange={(e) => update((d) => { d[audience].headline = e.target.value; })} />
                  </div>
                  <div className="pl-field pl-field--full">
                    <label>Açıklama (blurb)</label>
                    <textarea className="pl-textarea" aria-label="Blurb" rows={2}
                      value={aud.blurb} disabled={!canWritePricing}
                      onChange={(e) => update((d) => { d[audience].blurb = e.target.value; })} />
                  </div>
                </div>
              </Section>

              <Section
                title={`Planlar (${aud.plans.length})`}
                sub="Plan kartlarının ismini, fiyatını, limitlerini ve özelliklerini düzenleyin"
                action={canWritePricing ? (
                  <button type="button" className="ppt-btn ppt-btn--ghost"
                    onClick={() => update((d) => {
                      d[audience].plans.push({
                        code: `plan-${Date.now()}`, name: "Yeni Plan", codeLabel: "NEW",
                        priceMonthly: 0, currency: "₺", tagline: "", featured: false, badge: null,
                        ctaLabel: "Demo iste", ctaStyle: "ghost", limits: [], features: [],
                      });
                    })}>+ Plan ekle</button>
                ) : undefined}>
                <div className="pl-plans">
                  {aud.plans.length === 0 && <div className="pl-empty">Bu kitle için plan tanımlı değil.</div>}
                  {aud.plans.map((plan, idx) => (
                    <PlPlanEditor key={plan.code + String(idx)} plan={plan} canWrite={canWritePricing}
                      onChange={(f, v) => update((d) => { (d[audience].plans[idx] as Record<string, unknown>)[f] = v; })}
                      onLimitChange={(li, lf, lv) => update((d) => { (d[audience].plans[idx].limits[li] as Record<string, unknown>)[lf] = lv; })}
                      onLimitAdd={() => update((d) => { d[audience].plans[idx].limits.push({ key: `lim-${Date.now()}`, label: "Yeni limit", value: "0" }); })}
                      onLimitRemove={(li) => update((d) => { d[audience].plans[idx].limits.splice(li, 1); })}
                      onFeatureChange={(fi, v) => update((d) => { d[audience].plans[idx].features[fi] = v; })}
                      onFeatureAdd={() => update((d) => { d[audience].plans[idx].features.push("Yeni özellik"); })}
                      onFeatureRemove={(fi) => update((d) => { d[audience].plans[idx].features.splice(fi, 1); })}
                      onSetFeatured={() => update((d) => { d[audience].plans.forEach((p, i) => { p.featured = i === idx; p.badge = i === idx ? "EN POPÜLER" : null; }); })}
                      onDelete={() => { if (!confirm(`"${plan.name}" planı silinecek. Emin misin?`)) return; update((d) => { d[audience].plans.splice(idx, 1); }); }}
                    />
                  ))}
                </div>
              </Section>

              <Section
                title={`Ekstralar / Eklentiler (${aud.addons.length})`}
                sub="Plan dışı, adet bazlı eklentiler — birim fiyat ve birim metni"
                action={canWritePricing ? (
                  <button type="button" className="ppt-btn ppt-btn--ghost"
                    onClick={() => update((d) => {
                      d[audience].addons.push({ code: `addon-${Date.now()}`, icon: "+", name: "Yeni eklenti", price: 0, unit: "/ ay", desc: "Açıklama" });
                    })}>+ Eklenti ekle</button>
                ) : undefined}>
                {aud.addons.length === 0 ? (
                  <div className="pl-empty">Bu kitle için eklenti tanımlı değil.</div>
                ) : (
                  <div className="pl-addons">
                    {aud.addons.map((addon, idx) => (
                      <PlAddonEditor key={addon.code + String(idx)} addon={addon} canWrite={canWritePricing}
                        onChange={(f, v) => update((d) => { (d[audience].addons[idx] as Record<string, unknown>)[f] = v; })}
                        onDelete={() => { if (!confirm(`"${addon.name}" eklentisi silinecek. Emin misin?`)) return; update((d) => { d[audience].addons.splice(idx, 1); }); }}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </>
      )}

      {dirty && !loadingConfig && (
        <div className="pl-sticky">
          <span>Kaydedilmemiş değişiklikler var.</span>
          <button type="button" className="ppt-btn ppt-btn--ghost"
            onClick={() => { if (!confirm("Değişiklikler geri alınacak. Emin misin?")) return; loadConfig(); }}>
            Geri al
          </button>
          <button type="button" className="ppt-btn ppt-btn--primary" onClick={() => void handleSave()}>
            Şimdi kaydet
          </button>
        </div>
      )}
    </div>
  );
}

export function CampaignsTab() {
  return <CampaignsAdminTab />;
}

/* ── Network Hub — Channel Partners Admin Tab ─────────────────────────── */

type NhChannelOrg = { id: number; name: string; slug: string; is_active: boolean };
type NhLedger     = { id: number; event_type: string; amount: number; currency: string; status: string };
type NhMember     = { name: string; role: string; active: boolean };
type NhReferral   = { type: "partner" | "supplier"; name: string; date: string; status: string };
type NhOrgLink    = { code: string; clicks: number; signups: number; conv: number };

interface NhOrgExtras {
  orgType: string; contact: string; phone: string; city: string;
  owner: string; contractLabel: string;
  members: NhMember[]; referrals: NhReferral[]; link: NhOrgLink;
}

// TODO(data): replace with real API once /organizations/{id}/members, /referrals, /link endpoints exist
const NH_ORG_EXTRAS: NhOrgExtras[] = [
  {
    orgType: "Acente", contact: "info@vektorbd.com", phone: "+90 212 441 22 10",
    city: "İstanbul", owner: "Kerem Aydın", contractLabel: "Komisyon · Partner %5 · Tedarikçi %3",
    members: [
      { name: "Kerem Aydın", role: "Hesap Sahibi", active: true },
      { name: "Pelin Usta",  role: "Ekip Lideri",  active: true },
      { name: "Berk Olcay",  role: "Acente",       active: true },
    ],
    referrals: [
      { type: "partner",  name: "Atlas Yapı & İnşaat", date: "14.05.2026", status: "active"  },
      { type: "supplier", name: "Anadolu Ambalaj",      date: "02.05.2026", status: "active"  },
      { type: "supplier", name: "Trakya Tarım",         date: "21.04.2026", status: "pending" },
    ],
    link: { code: "VEKTOR2026", clicks: 1840, signups: 12, conv: 0.65 },
  },
  {
    orgType: "Broker", contact: "partner@mavihat.com.tr", phone: "+90 312 220 55 30",
    city: "Ankara", owner: "Selim Korkmaz", contractLabel: "Sabit + Adet · ₺2.000 / 5 kayıt",
    members: [
      { name: "Selim Korkmaz", role: "Hesap Sahibi",  active: true  },
      { name: "Nazlı Eren",    role: "Acente",         active: true  },
      { name: "Onur Baş",      role: "Junior Acente",  active: false },
    ],
    referrals: [
      { type: "partner", name: "EgePet Kimya",        date: "10.05.2026", status: "active" },
      { type: "partner", name: "Mavi Çelik Endüstri", date: "28.04.2026", status: "active" },
    ],
    link: { code: "MAVIHAT", clicks: 920, signups: 6, conv: 0.65 },
  },
  {
    orgType: "Bireysel acente", contact: "derya.koc@gmail.com", phone: "+90 532 000 00 00",
    city: "İzmir", owner: "Derya Koç", contractLabel: "Komisyon · Partner %4 · Tedarikçi %2.5",
    members: [
      { name: "Derya Koç", role: "Hesap Sahibi", active: false },
    ],
    referrals: [
      { type: "supplier", name: "Hız Kargo", date: "12.02.2026", status: "inactive" },
    ],
    link: { code: "DKOC2026", clicks: 210, signups: 1, conv: 0.48 },
  },
];

function nhOrgExtras(idx: number): NhOrgExtras {
  return NH_ORG_EXTRAS[idx] ?? {
    orgType: "—", contact: "—", phone: "—", city: "—",
    owner: "—", contractLabel: "—",
    members: [], referrals: [], link: { code: "—", clicks: 0, signups: 0, conv: 0 },
  };
}

const NH_REF_STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: "Aktif",     cls: "ok"   },
  pending:  { label: "Beklemede", cls: "wait" },
  inactive: { label: "Pasif",     cls: "off"  },
};
const NH_LEDGER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Bekliyor", cls: "wait" },
  approved:  { label: "Onaylı",   cls: "info" },
  paid:      { label: "Ödendi",   cls: "ok"   },
  cancelled: { label: "İptal",    cls: "off"  },
};

function nhMoney(n: number) { return "₺" + Number(n || 0).toLocaleString("tr-TR"); }
function nhInitials(name: string) {
  return name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function ChannelPartnersAdminTab() {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const [orgs, setOrgs] = useState<NhChannelOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<NhLedger[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerOverrides, setLedgerOverrides] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`${apiBase}/api/v1/channel/organizations`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Kanal organizasyonları okunamadı");
        const data: unknown = await r.json();
        return Array.isArray(data) ? (data as NhChannelOrg[]) : [];
      })
      .then((rows) => {
        setOrgs(rows);
        if (rows.length > 0 && rows[0]) setSelId(rows[0].id);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Yükleme hatası"))
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    if (selId == null) return;
    setLedgerLoading(true);
    setLedger([]);
    fetch(`${apiBase}/api/v1/channel/organizations/${selId}/ledger`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then(async (r) => {
        if (!r.ok) return [];
        const data: unknown = await r.json();
        return Array.isArray(data) ? (data as NhLedger[]) : [];
      })
      .then(setLedger)
      .catch(() => setLedger([]))
      .finally(() => setLedgerLoading(false));
  }, [apiBase, selId]);

  function advanceLedger(id: number, current: string) {
    const next = current === "pending" ? "approved" : current === "approved" ? "paid" : null;
    if (!next) return;
    setLedgerOverrides((prev) => ({ ...prev, [id]: next }));
    // TODO(data): persist via PATCH /api/v1/channel/organizations/{orgId}/ledger/{id}/status
  }

  const selIdx = orgs.findIndex((o) => o.id === selId);
  const sel    = selIdx >= 0 ? orgs[selIdx] : null;
  const extras = nhOrgExtras(selIdx);

  const activeCount    = orgs.filter((o) => o.is_active).length;
  const totalPartners  = NH_ORG_EXTRAS.reduce((a, e) => a + e.referrals.filter((r) => r.type === "partner").length, 0);
  const totalSuppliers = NH_ORG_EXTRAS.reduce((a, e) => a + e.referrals.filter((r) => r.type === "supplier").length, 0);
  const totalReferrals = totalPartners + totalSuppliers;

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Operasyon · Kanal Ağı" title="İş Ortakları (Kanal)" sub="Yükleniyor…" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Operasyon · Kanal Ağı"
        title="İş Ortakları (Kanal)"
        sub="Partner ve tedarikçi getiren acente / broker iş ortaklarının yönetimi · komisyon sözleşmeleri ve hakediş takibi."
      />
      {err && <div className="nh-error">{err}</div>}

      <div className="nh-stats">
        <StatCard label="Aktif iş ortağı"     value={activeCount}    sub={`${orgs.length} kayıtlı acente/broker`} />
        <StatCard label="Getirilen partner"   value={totalPartners}  sub="kanal kaynaklı" accent="blue" />
        <StatCard label="Getirilen tedarikçi" value={totalSuppliers} sub="kanal kaynaklı" accent="violet" />
        <StatCard label="Toplam referans"     value={totalReferrals} sub="aktif + bekleyen" accent="gold" />
      </div>

      <div className="nh-split">
        {/* Sol: org listesi */}
        <aside className="nh-list">
          <div className="nh-list__hd">İş Ortakları <span>{orgs.length}</span></div>
          <div className="nh-list__scroll">
            {orgs.length === 0 ? (
              <div className="nh-list-empty">Kayıtlı iş ortağı yok.</div>
            ) : orgs.map((o, idx) => {
              const ex = nhOrgExtras(idx);
              const partners  = ex.referrals.filter((r) => r.type === "partner").length;
              const suppliers = ex.referrals.filter((r) => r.type === "supplier").length;
              return (
                <button
                  key={o.id}
                  type="button"
                  className={"nh-orgrow" + (o.id === selId ? " on" : "")}
                  onClick={() => setSelId(o.id)}
                >
                  <span className="nh-orgrow__ico">⇄</span>
                  <span className="nh-orgrow__meta">
                    <b>{o.name}</b>
                    <i>{ex.orgType} · {ex.city}</i>
                  </span>
                  <span className="nh-orgrow__r">
                    <span className="nh-mini-num">{partners}P · {suppliers}T</span>
                    <span className={"nh-dot" + (o.is_active ? " on" : "")} />
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Sağ: detay */}
        <div className="nh-detail">
          {!sel ? (
            <div className="nh-mut">Bir iş ortağı seçin.</div>
          ) : (
            <>
              <div className="nh-detail__hd">
                <div>
                  <h3>
                    {sel.name}
                    {!sel.is_active && <span className="nh-badge off">Pasif</span>}
                  </h3>
                  <p>
                    {extras.orgType} · Hesap sahibi <strong>{extras.owner}</strong>
                    {" · "}{extras.contact}{" · "}{extras.phone}
                  </p>
                </div>
                <div className="nh-detail__contract">
                  <b>{extras.contractLabel.split("·")[0]?.trim()}</b>
                  <span>{extras.contractLabel.split("·").slice(1).join("·").trim()}</span>
                </div>
              </div>

              <Section title="Ekip üyeleri" sub={`${extras.members.length} kişi`}>
                {extras.members.length === 0 ? (
                  <p className="nh-mut">Üye bilgisi yok.</p>
                ) : (
                  <div className="nh-members">
                    {extras.members.map((m, i) => (
                      <div key={i} className={"nh-member" + (m.active ? "" : " off")}>
                        <span className="nh-av">{nhInitials(m.name)}</span>
                        <div>
                          <b>{m.name}</b>
                          <span>{m.role}</span>
                        </div>
                        <span className={"nh-dot" + (m.active ? " on" : "")} />
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Getirilen partner & tedarikçiler" sub="attribution kalıcı (değişmez)">
                {extras.referrals.length === 0 ? (
                  <p className="nh-mut">Referans kaydı yok.</p>
                ) : (
                  <table className="nh-table">
                    <thead>
                      <tr>
                        <th>Tip</th><th>Firma</th><th>Tarih</th><th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extras.referrals.map((r, i) => {
                        const st = NH_REF_STATUS[r.status] ?? { label: r.status, cls: "off" };
                        return (
                          <tr key={i}>
                            <td>
                              <span className={"nh-tag " + (r.type === "partner" ? "p" : "s")}>
                                {r.type === "partner" ? "Partner" : "Tedarikçi"}
                              </span>
                            </td>
                            <td><strong>{r.name}</strong></td>
                            <td className="nh-mut">{r.date}</td>
                            <td><span className={"nh-badge " + st.cls}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section title="Hakediş (komisyon ledger)" sub="onay → ödeme akışı">
                {ledgerLoading ? (
                  <p className="nh-mut">Yükleniyor…</p>
                ) : ledger.length === 0 ? (
                  <p className="nh-mut">Hakediş kaydı yok.</p>
                ) : (
                  <table className="nh-table">
                    <thead>
                      <tr>
                        <th>Kayıt</th><th>Olay</th><th>Tutar</th><th>Durum</th>
                        <th>Eylem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((l) => {
                        const status = ledgerOverrides[l.id] ?? l.status;
                        const st = NH_LEDGER_STATUS[status] ?? { label: status, cls: "off" };
                        return (
                          <tr key={l.id}>
                            <td className="nh-mono">L-{l.id}</td>
                            <td className="nh-mut">{l.event_type}</td>
                            <td className="nh-mono">{nhMoney(l.amount)}</td>
                            <td><span className={"nh-badge " + st.cls}>{st.label}</span></td>
                            <td>
                              {status === "pending" && (
                                <button type="button" className="nh-act ok" onClick={() => advanceLedger(l.id, status)}>
                                  Onayla
                                </button>
                              )}
                              {status === "approved" && (
                                <button type="button" className="nh-act ok" onClick={() => advanceLedger(l.id, status)}>
                                  Öde
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section title="Davet linki & dönüşüm" sub={`Kod: ${extras.link.code}`}>
                <div className="nh-link">
                  <div className="nh-link__stat">
                    <b>{extras.link.clicks.toLocaleString("tr-TR")}</b>
                    <span>tıklama</span>
                  </div>
                  <div className="nh-link__stat">
                    <b>{extras.link.signups}</b>
                    <span>kayıt</span>
                  </div>
                  <div className="nh-link__stat">
                    <b>%{(extras.link.conv * 100).toFixed(0)}</b>
                    <span>dönüşüm</span>
                  </div>
                  <code className="nh-link__url">
                    app.buyerasistans.com.tr/r/{extras.link.code}
                  </code>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

interface AilBomItem { material: string; quantity: number; unit: string; source_layer: string; group_name?: string; group_key?: string; }
interface AilLayer   { layer_name: string; total_length: number; unit: string; }
interface AilKararSoru { id: number; soru: string; neden: string; }
interface AilResult  {
  status?: string;
  session_id?: string;
  metadata?: { katmanlar?: AilLayer[] };
  bom?: AilBomItem[];
  ai_report?: {
    teknik_analiz?: string;
    karar_destek_sorulari?: AilKararSoru[];
    kritik_uyarilar?: string[];
  };
}
interface AilConfirmResult {
  transfer_id: string;
  quote_id: number;
  project_id: number;
  project_name: string;
  confirmed_by_email?: string;
  status?: string;
}

const AIL_MODELS = [
  { id: "buyer_cad" as const, label: "Buyer-CAD v4",   icon: "🏗️", sub: "Self-hosted · sektör eğitimli",           speed: "Yavaş", cost: "₺0/sayfa",    tag: "Önerilen" },
  { id: "claude"    as const, label: "Claude Sonnet",   icon: "🤖", sub: "En dengeli · CAD + metraj + RFQ",         speed: "Hızlı", cost: "₺0.018/sayfa", tag: null },
  { id: "gpt"       as const, label: "GPT-4o",          icon: "⚡", sub: "Karmaşık geometri · yüksek doğruluk",    speed: "Orta",  cost: "₺0.024/sayfa", tag: null },
  { id: "gemini"    as const, label: "Gemini 2.5 Pro",  icon: "✨", sub: "Çok katmanlı · 3D analiz",               speed: "Orta",  cost: "₺0.020/sayfa", tag: null },
];

const AIL_STEPS = [
  { key: "upload",  label: "Dosya yükleme",       sub: "DWG/DXF · max 250MB" },
  { key: "convert", label: "DWG→DXF dönüşümü",   sub: "ODAFileConverter · katmanları koru" },
  { key: "layers",  label: "Katman çıkarımı",     sub: "Ana + alt katmanlar tespit" },
  { key: "metraj",  label: "Metraj hesabı",       sub: "Birim bazlı miktar + fiyatlandırma" },
  { key: "audit",   label: "AI bilişsel denetim", sub: "Soru oluşturma + tutarlılık kontrolü" },
  { key: "rfq",     label: "RFQ taslağı",         sub: "Otomatik teklif paketi" },
];

const AIL_AUTO_KEY = "pf_ail_admin_auto_open";

/* ── AI Lab Admin Tab (ail-) ── */
export function AiLabAdminTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user);

  const [selectedModel, setSelectedModel] = useState<"buyer_cad" | "claude" | "gpt" | "gemini">("buyer_cad");
  const [uploading, setUploading]     = useState(false);
  const [activeStep, setActiveStep]   = useState(-1);
  const [doneSteps, setDoneSteps]     = useState<number[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult]           = useState<AilResult | null>(null);
  const [fileName, setFileName]       = useState<string | null>(null);
  const [autoOpen, setAutoOpen]       = useState<boolean>(() => {
    try { return window.localStorage.getItem(AIL_AUTO_KEY) === "true"; } catch { return false; }
  });
  const [resultTab, setResultTab]     = useState<"katman" | "rfq">("katman");
  const [projects, setProjects]       = useState<Project[]>([]);
  const [companies, setCompanies]     = useState<Company[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [confirming, setConfirming]   = useState(false);
  const [confirmResult, setConfirmResult] = useState<AilConfirmResult | null>(null);
  const [confirmError, setConfirmError]   = useState<string | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
    if (isSuperAdmin) getCompanies().then(setCompanies).catch(() => {});
  }, [isSuperAdmin]);
  useEffect(() => {
    try { window.localStorage.setItem(AIL_AUTO_KEY, String(autoOpen)); } catch { /* ignore */ }
  }, [autoOpen]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /* animation: step 0→1 on upload start; steps 2-5 animate fast on API success */
  function startAnimation() {
    setDoneSteps([]);
    setActiveStep(0);
    timerRef.current = setTimeout(() => {
      setDoneSteps([0]);
      setActiveStep(1); // stays until API returns
    }, 1200);
  }

  function finishAnimationSuccess() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const FAST = 480;
    setDoneSteps([0, 1]);
    let step = 2;
    const tick = () => {
      setDoneSteps(AIL_STEPS.map((_, i) => i).slice(0, step));
      setActiveStep(step);
      step++;
      if (step < AIL_STEPS.length) {
        timerRef.current = setTimeout(tick, FAST);
      } else {
        timerRef.current = setTimeout(() => {
          setDoneSteps(AIL_STEPS.map((_, i) => i));
          setActiveStep(-1);
        }, FAST);
      }
    };
    tick();
  }

  function finishAnimationError() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveStep(-1);
  }

  async function handleConfirm() {
    if (!result?.session_id) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const keys = bomRows.map((item, idx) =>
        `${item.source_layer}-${item.material}-${idx}`
      );
      const token = getAccessToken();
      const base = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
      const res = await fetch(`${base}/api/v1/ai-lab/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          session_id: result.session_id,
          project_id: selectedProjectId ?? null,
          selected_bom_item_keys: keys,
        }),
      });
      const data = (await res.json()) as { status?: string; transfer?: AilConfirmResult; detail?: unknown };
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Onay başarısız.");
      setConfirmResult(data.transfer ?? null);
      setResultTab("rfq");
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Bilinmeyen hata.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 250 * 1024 * 1024) {
      setUploadError("Dosya 250 MB sınırını aşıyor. Lütfen daha küçük bir dosya seçin.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploadError(null);
    setResult(null);
    setResultTab("katman");
    setConfirmResult(null);
    setConfirmError(null);
    setFileName(file.name);
    setUploading(true);
    startAnimation();
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (selectedProjectId) fd.append("project_id", String(selectedProjectId));
      const token = getAccessToken();
      const base = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
      const res = await fetch(`${base}/api/v1/ai-lab/analyze`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = (await res.json()) as AilResult & { detail?: unknown };
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Analiz başarısız.");
      finishAnimationSuccess();
      setResult(data);
      if (autoOpen) setResultTab("rfq");
    } catch (err) {
      finishAnimationError();
      setUploadError(err instanceof Error ? err.message : "Bilinmeyen hata.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const bomRows   = result?.bom ?? [];
  const layers    = result?.metadata?.katmanlar ?? [];
  const totalLen  = layers.reduce((s, l) => s + l.total_length, 0);
  const showSteps = uploading || result !== null || uploadError !== null;

  /* group BOM rows by group_name, assign LYR-XX codes */
  const bomGroups: Record<string, (AilBomItem & { lyrNum: number })[]> = {};
  let lyrCounter = 0;
  for (const row of bomRows) {
    const g = row.group_name ?? "Genel";
    if (!bomGroups[g]) bomGroups[g] = [];
    lyrCounter++;
    bomGroups[g].push({ ...row, lyrNum: lyrCounter });
  }
  const bomGroupEntries = Object.entries(bomGroups);

  /* project dropdown: grouped by company for SuperAdmin */
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const byCompany: Record<string, Project[]> = {};
  const noCompany: Project[] = [];
  for (const p of projects) {
    if (isSuperAdmin && p.company_id) {
      const cname = companyMap.get(p.company_id) ?? `Firma #${p.company_id}`;
      if (!byCompany[cname]) byCompany[cname] = [];
      byCompany[cname].push(p);
    } else {
      noCompany.push(p);
    }
  }
  const companyGroupEntries = Object.entries(byCompany);

  return (
    <div className="ail-tab">
      <PageHeader
        eyebrow="AI & Keşif"
        title="AI Keşif Lab"
        sub="Mimari proje (DWG/DXF) yükle, AI denetlesin, metraj otomatik çıksın ve doğrudan RFQ üret."
      />

      {/* ── Aktif AI Modeli ── */}
      <Section title="Aktif AI Modeli" sub="Analiz için kullanılacak model. İşlem başlamadan değiştirilebilir.">
        <div className="ail-models">
          {AIL_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`ail-model-card${selectedModel === m.id ? " ail-model-card--active" : ""}${result && selectedModel === m.id ? " ail-model-card--used" : ""}`}
              onClick={() => !uploading && setSelectedModel(m.id)}
              disabled={uploading}
            >
              {m.tag && <span className="ail-model-tag">{m.tag}</span>}
              <span className="ail-model-icon">{m.icon}</span>
              <span className="ail-model-name">{m.label}</span>
              <span className="ail-model-sub">{m.sub}</span>
              <div className="ail-model-meta">
                <span className="ail-model-speed">{m.speed}</span>
                <span className="ail-model-cost">{m.cost}</span>
              </div>
              {result && selectedModel === m.id && (
                <span className="ail-model-badge">✓ Analiz yapıldı</span>
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Proje + Yükleme ── */}
      <Section title="Yeni Proje Yükle">
        <div className="ail-upload-row">
          <div className="ail-select-wrap">
            <label className="ail-field-label" htmlFor="ail-project-select">Proje</label>
            <select
              id="ail-project-select"
              title="Proje seçin"
              className="ail-select"
              value={selectedProjectId ?? ""}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              disabled={uploading}
            >
              <option value="">Otomatik (yeni proje oluşturulacak)</option>
              {/* SuperAdmin: projects grouped by company */}
              {isSuperAdmin ? (
                <>
                  {companyGroupEntries.map(([cname, cprojects]) => (
                    <optgroup key={cname} label={cname}>
                      {cprojects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                  {noCompany.length > 0 && (
                    <optgroup label="Firma Atanmamış">
                      {noCompany.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  )}
                </>
              ) : (
                projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
              )}
            </select>
          </div>

          <div
            className={`ail-upload-zone${uploading ? " ail-upload-zone--uploading" : ""}${result ? " ail-upload-zone--done" : ""}`}
            onClick={() => !uploading && fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (!uploading && (e.key === "Enter" || e.key === " ")) fileRef.current?.click(); }}
            aria-label="Dosya yükleme alanı"
          >
            {uploading ? (
              <><div className="ail-spinner" /><p className="ail-upload-zone__text">Analiz devam ediyor…</p><p className="ail-upload-zone__sub">{fileName}</p></>
            ) : result ? (
              <><span className="ail-upload-ok">✓</span><p className="ail-upload-zone__text">Tamamlandı — {fileName}</p><p className="ail-upload-zone__sub">Yeni dosya için tıklayın</p></>
            ) : (
              <><span className="ail-upload-icon">↑</span><p className="ail-upload-zone__text">Mimari projeyi sürükleyin veya tıklayın</p><p className="ail-upload-zone__sub">.dwg veya .dxf · maks. 250 MB</p></>
            )}
            <input ref={fileRef} type="file" accept=".dwg,.dxf" disabled={uploading} className="ail-file-hidden" aria-label="DWG veya DXF dosyası seç" onChange={handleFile} />
          </div>
          {uploadError && <p className="ail-error">{uploadError}</p>}
        </div>
      </Section>

      {/* ── Analiz Adımları ── */}
      {showSteps && (
        <Section title={result ? "Analiz Tamamlandı" : uploadError ? "Analiz Kesildi" : "Analiz İlerlemesi"}>
          <div className="ail-steps">
            {AIL_STEPS.map((s, i) => {
              const done   = doneSteps.includes(i);
              const active = activeStep === i;
              return (
                <div key={s.key} className={`ail-step${done ? " ail-step--done" : active ? " ail-step--active" : ""}`}>
                  <div className="ail-step__ico">
                    {done ? "✓" : active ? <span className="ail-step-spin" /> : <span>{i + 1}</span>}
                  </div>
                  <div className="ail-step__body">
                    <div className="ail-step__label">{s.label}</div>
                    <div className="ail-step__sub">{s.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Sonuç Sekmeleri ── */}
      {result && (
        <Section
          title={`Analiz Sonuçları — ${bomRows.length || layers.length} kalem`}
          sub={`${fileName} · ${AIL_MODELS.find(m => m.id === selectedModel)?.label ?? selectedModel}`}
        >
          {/* tab bar */}
          <div className="ail-res-tabs">
            <button
              type="button"
              className={`ail-res-tab${resultTab === "katman" ? " ail-res-tab--active" : ""}`}
              onClick={() => setResultTab("katman")}
            >
              Teknik Katman Özeti
            </button>
            <button
              type="button"
              className={`ail-res-tab${resultTab === "rfq" ? " ail-res-tab--active" : ""}`}
              onClick={() => setResultTab("rfq")}
            >
              Oluşan RFQ
            </button>
          </div>

          {/* Teknik Katman Özeti */}
          {resultTab === "katman" && (
            <>
              {bomRows.length > 0 ? (
                <div className="ail-bom-wrap">
                  <table className="ail-bom-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Katman</th>
                        <th>Malzeme Adı</th>
                        <th>Birim</th>
                        <th className="ail-bom-num">Miktar</th>
                      </tr>
                    </thead>
                    {bomGroupEntries.map(([groupName, rows]) => (
                      <tbody key={groupName}>
                        <tr className="ail-bom-group">
                          <td colSpan={5}>{groupName}</td>
                        </tr>
                        {rows.map((row) => (
                          <tr key={row.lyrNum}>
                            <td className="ail-bom-lyr">LYR-{String(row.lyrNum).padStart(2, "0")}</td>
                            <td>{row.source_layer}</td>
                            <td>{row.material}</td>
                            <td>{row.unit}</td>
                            <td className="ail-bom-num">{row.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                    <tfoot>
                      <tr className="ail-bom-totals">
                        <td colSpan={5}>Toplam — {bomRows.length} kalem</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : layers.length > 0 ? (
                <DataTable
                  rows={layers as unknown as Record<string, unknown>[]}
                  columns={[
                    { key: "layer_name",   label: "Katman" },
                    { key: "total_length", label: "Uzunluk", align: "right", render: (r) => String((r as unknown as AilLayer).total_length) },
                    { key: "unit",         label: "Birim" },
                  ]}
                />
              ) : (
                <p className="ail-empty">Analiz tamamlandı ancak katman verisi bulunamadı.</p>
              )}

              {/* onay alanı */}
              {confirmResult ? (
                <div className="ail-approved-stamp">
                  <div className="ail-approved-stamp__header">
                    <span className="ail-approved-stamp__check">✓</span>
                    <span className="ail-approved-stamp__title">AI Onaylı</span>
                  </div>
                  <div className="ail-approved-stamp__rows">
                    <span className="ail-approved-stamp__label">Transfer</span>
                    <span className="ail-approved-stamp__val">{confirmResult.transfer_id}</span>
                    <span className="ail-approved-stamp__label">Teklif #</span>
                    <span className="ail-approved-stamp__val">{confirmResult.quote_id}</span>
                    <span className="ail-approved-stamp__label">Proje</span>
                    <span className="ail-approved-stamp__val">{confirmResult.project_name}</span>
                  </div>
                </div>
              ) : (
                <div className="ail-confirm-bar">
                  {confirmError && <p className="ail-error" style={{marginBottom: 8}}>{confirmError}</p>}
                  <button
                    type="button"
                    className="ail-confirm-btn"
                    onClick={handleConfirm}
                    disabled={confirming || bomRows.length === 0}
                  >
                    {confirming ? <><span className="ail-step-spin" /> Onaylanıyor…</> : "Onayla ve RFQ Oluştur"}
                  </button>
                  <p className="ail-confirm-hint">
                    Tüm {bomRows.length} kalem seçili projeye AI Onaylı damgasıyla iletilir.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Oluşan RFQ */}
          {resultTab === "rfq" && (
            <div className="ail-rfq-panel">
              {confirmResult ? (
                <>
                  {/* AI Onaylı damga */}
                  <div className="ail-approved-stamp ail-approved-stamp--center">
                    <div className="ail-approved-stamp__header">
                      <span className="ail-approved-stamp__check">✓</span>
                      <span className="ail-approved-stamp__title">AI Onaylı RFQ Oluşturuldu</span>
                    </div>
                    <div className="ail-approved-stamp__rows">
                      <span className="ail-approved-stamp__label">Transfer ID</span>
                      <span className="ail-approved-stamp__val">{confirmResult.transfer_id}</span>
                      <span className="ail-approved-stamp__label">Teklif #</span>
                      <span className="ail-approved-stamp__val">{confirmResult.quote_id}</span>
                      <span className="ail-approved-stamp__label">Proje</span>
                      <span className="ail-approved-stamp__val">{confirmResult.project_name}</span>
                    </div>
                  </div>
                  <div className="ail-rfq-actions">
                    <button
                      type="button"
                      className="ail-link ail-link--btn"
                      onClick={() => navigate("/admin?tab=discovery_lab_operations")}
                    >
                      Discovery Lab Operasyonlarında Görüntüle →
                    </button>
                    {result.session_id && (
                      <a
                        href={`/discovery-lab?session=${result.session_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ail-link"
                      >
                        Tenant görünümünde aç ↗
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="ail-rfq-icon">📋</div>
                  <p className="ail-rfq-msg">
                    BOM tablosunu inceledikten sonra <strong>Teknik Katman Özeti</strong> sekmesindeki
                    "Onayla ve RFQ Oluştur" butonuna tıklayın.
                    RFQ oluşturulduktan sonra burada AI Onaylı damgası ve teklif detayları görünür.
                  </p>
                  {/* AI karar soruları varsa göster */}
                  {(result.ai_report?.karar_destek_sorulari ?? []).length > 0 && (
                    <div className="ail-rfq-report" style={{width: "100%", textAlign: "left"}}>
                      <strong>AI Karar Destek Soruları</strong>
                      {result.ai_report!.karar_destek_sorulari!.map((q) => (
                        <div key={q.id} className="ail-karar-soru">
                          <span className="ail-karar-soru__q">S{q.id}: {q.soru}</span>
                          <span className="ail-karar-soru__why">{q.neden}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.ai_report?.teknik_analiz && (
                    <div className="ail-rfq-report" style={{width: "100%", textAlign: "left", marginTop: 8}}>
                      <strong>AI Teknik Analiz</strong>
                      <p>{result.ai_report.teknik_analiz}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── Seçenek ── */}
      <Section title="Seçenek">
        <label className="ail-toggle-row">
          <input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} />
          <span>Aktarım tamamlanınca RFQ sekmesini aç</span>
        </label>
      </Section>
    </div>
  );
}
