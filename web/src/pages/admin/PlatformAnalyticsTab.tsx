import { useEffect, useState } from "react";
import { getAccessToken } from "../../lib/token";
import { PageHeader, Section, StatCard } from "./AdminTabContent";
import "./PlatformAnalyticsTab.css";

// ── Ekosistem grafik sabitleri ─────────────────────────────────────────────

const PA_BRAND = {
  strategic: "#1d4ed8",
  supplier:  "#be123c",
  channel:   "#047857",
  talent:    "#7c3aed",
  neutral:   "#64748b",
} as const;

interface PaLine       { key: string; label: string; color: string; }
interface PaDonutSlice { label: string; count: number; color: string; }
interface PaFunnelStep { stage: string; count: number; }
interface PaBarPoint   { m: string; partners: number; suppliers: number; }

const PA_ECO_SERIES: Array<Record<string, number | string>> = [
  { m: "2025-06", strategic: 24, supplier: 210, talent: 20  },
  { m: "2025-07", strategic: 27, supplier: 228, talent: 34  },
  { m: "2025-08", strategic: 29, supplier: 242, talent: 46  },
  { m: "2025-09", strategic: 31, supplier: 255, talent: 58  },
  { m: "2025-10", strategic: 33, supplier: 266, talent: 69  },
  { m: "2025-11", strategic: 35, supplier: 274, talent: 77  },
  { m: "2025-12", strategic: 36, supplier: 283, talent: 86  },
  { m: "2026-01", strategic: 38, supplier: 291, talent: 95  },
  { m: "2026-02", strategic: 39, supplier: 298, talent: 103 },
  { m: "2026-03", strategic: 40, supplier: 305, talent: 110 },
  { m: "2026-04", strategic: 41, supplier: 311, talent: 117 },
  { m: "2026-05", strategic: 42, supplier: 318, talent: 124 },
];

const PA_ECO_LINES: PaLine[] = [
  { key: "supplier",  label: "Tedarikçi (havuz)", color: PA_BRAND.supplier  },
  { key: "talent",    label: "Yetenek",            color: PA_BRAND.talent    },
  { key: "strategic", label: "Stratejik Partner",  color: PA_BRAND.strategic },
];

const PA_ORIGIN_DONUT: PaDonutSlice[] = [
  { label: "Partner daveti",    count: 128, color: PA_BRAND.strategic },
  { label: "İş ortağı (kanal)", count: 96,  color: PA_BRAND.channel   },
  { label: "Doğrudan kayıt",    count: 94,  color: PA_BRAND.neutral   },
];

const PA_RFQ_FUNNEL: PaFunnelStep[] = [
  { stage: "RFQ açıldı",           count: 1404 },
  { stage: "Tedarikçiye iletildi",  count: 1180 },
  { stage: "Teklif geldi",          count: 842  },
  { stage: "Değerlendirildi",       count: 610  },
  { stage: "Kazanan seçildi",       count: 318  },
];

const PA_TALENT_FUNNEL: PaFunnelStep[] = [
  { stage: "Açık ilan",  count: 34  },
  { stage: "Başvuru",    count: 310 },
  { stage: "Ön eleme",   count: 128 },
  { stage: "Mülakat",    count: 47  },
  { stage: "Teklif",     count: 18  },
  { stage: "Yerleşti",   count: 11  },
];

const PA_CAREER_SERIES: Array<Record<string, number | string>> = [
  { m: "2025-06", basvuru: 14, yerlesen: 1 },
  { m: "2025-07", basvuru: 19, yerlesen: 1 },
  { m: "2025-08", basvuru: 23, yerlesen: 2 },
  { m: "2025-09", basvuru: 26, yerlesen: 1 },
  { m: "2025-10", basvuru: 29, yerlesen: 2 },
  { m: "2025-11", basvuru: 27, yerlesen: 2 },
  { m: "2025-12", basvuru: 31, yerlesen: 1 },
  { m: "2026-01", basvuru: 35, yerlesen: 2 },
  { m: "2026-02", basvuru: 30, yerlesen: 1 },
  { m: "2026-03", basvuru: 38, yerlesen: 2 },
  { m: "2026-04", basvuru: 36, yerlesen: 1 },
  { m: "2026-05", basvuru: 42, yerlesen: 2 },
];

const PA_CAREER_LINES: PaLine[] = [
  { key: "basvuru",  label: "Başvuru",  color: PA_BRAND.talent    },
  { key: "yerlesen", label: "Yerleşme", color: PA_BRAND.strategic },
];

const PA_CHANNEL_BARS: PaBarPoint[] = [
  { m: "Ara", partners: 1, suppliers: 3 },
  { m: "Oca", partners: 1, suppliers: 2 },
  { m: "Şub", partners: 2, suppliers: 4 },
  { m: "Mar", partners: 1, suppliers: 3 },
  { m: "Nis", partners: 2, suppliers: 5 },
  { m: "May", partners: 2, suppliers: 4 },
];

const PA_CONTRIB_TILES = [
  { k: "Aktif görev",       v: "3"        },
  { k: "Tamamlanan katkı",  v: "142"      },
  { k: "Dağıtılan ödül",    v: "₺186.400" },
  { k: "Ort. itibar puanı", v: "512"      },
  { k: "Bekleyen ödeme",    v: "₺5.950"   },
];

const PA_CITIES = [
  { city: "İstanbul", n: 18 }, { city: "Ankara",  n: 12 }, { city: "İzmir",   n: 7 },
  { city: "Bursa",    n: 6  }, { city: "Kocaeli", n: 4  }, { city: "Mersin",  n: 3 },
  { city: "Konya",    n: 2  },
];

// ── SVG grafik bileşenleri ─────────────────────────────────────────────────

function PaMultiLine({
  series, lines, height = 240,
}: {
  series: Array<Record<string, number | string>>;
  lines: PaLine[];
  height?: number;
}) {
  const w = 760, padL = 38, padR = 16, padT = 14, padB = 26;
  const n = series.length;
  if (n < 2) return null;
  const allVals = series.flatMap((d) => lines.map((l) => Number(d[l.key] ?? 0)));
  const max = (Math.max(...allVals) || 1) * 1.1;
  const x = (i: number) => padL + (i * (w - padL - padR)) / (n - 1);
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  const ticks = 4;
  return (
    <div className="pa-chart">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const yy = padT + ((height - padT - padB) * i) / ticks;
          return <line key={i} x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="#eef2f7" strokeWidth="1" />;
        })}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const yy = padT + ((height - padT - padB) * i) / ticks;
          return (
            <text key={`t${i}`} x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {Math.round(max * (1 - i / ticks))}
            </text>
          );
        })}
        {lines.map((l) => (
          <polyline
            key={l.key}
            points={series.map((d, i) => `${x(i)},${y(Number(d[l.key] ?? 0))}`).join(" ")}
            fill="none" stroke={l.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {lines.map((l) =>
          series.map((d, i) => (
            <circle key={`${l.key}${i}`} cx={x(i)} cy={y(Number(d[l.key] ?? 0))} r="2.4" fill={l.color} />
          ))
        )}
        {series.map((d, i) =>
          i % 2 === 1 ? (
            <text key={`x${i}`} x={x(i)} y={height - 7} textAnchor="middle" fontSize="9.5" fill="#94a3b8">
              {String(d.m).slice(5)}.{String(d.m).slice(2, 4)}
            </text>
          ) : null
        )}
      </svg>
      <div className="pa-legend">
        {lines.map((l) => (
          <span key={l.key}>
            <i style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function PaDonut({ data, size = 160 }: { data: PaDonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = Math.min(size / 2 - 18, 60);
  const circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const slices = data.reduce<Array<PaDonutSlice & { dash: number; offset: number }>>(
    (acc, d) => {
      const dash = (d.count / total) * circ;
      const prev = acc[acc.length - 1];
      acc.push({ ...d, dash, offset: prev ? prev.offset + prev.dash : 0 });
      return acc;
    },
    []
  );
  return (
    <svg width={size} height={size} className="pa-donut-svg">
      {slices.map((s) => (
        <circle
          key={s.label} cx={cx} cy={cy} r={r}
          fill="none" stroke={s.color} strokeWidth={20}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={-s.offset}
        />
      ))}
    </svg>
  );
}

function PaFunnelBars({ steps, color }: { steps: PaFunnelStep[]; color: string }) {
  const max = steps[0]?.count ?? 1;
  return (
    <div className="pa-funnel">
      {steps.map((s, i) => {
        const pct = Math.max(6, Math.round((s.count / max) * 100));
        const prev = steps[i - 1]?.count ?? null;
        const conv = prev === null ? null : Math.round((s.count / prev) * 100);
        return (
          <div key={i} className="pa-funnel__row">
            <span className="pa-funnel__lbl">{s.stage}</span>
            <div className="pa-funnel__track">
              <div className="pa-funnel__bar" style={{ width: `${pct}%`, background: color }}>
                <b>{s.count.toLocaleString("tr-TR")}</b>
              </div>
            </div>
            <span className="pa-funnel__conv">{conv === null ? "—" : `%${conv}`}</span>
          </div>
        );
      })}
    </div>
  );
}

function PaGroupBars({ data }: { data: PaBarPoint[] }) {
  const max = Math.max(...data.flatMap((d) => [d.partners, d.suppliers]), 1);
  return (
    <>
      <div className="pa-gbars">
        {data.map((d) => (
          <div key={d.m} className="pa-gbars__col">
            <div className="pa-gbars__pair">
              <div
                className="pa-gbars__b pa-gbars__b--strategic"
                style={{ height: `${(d.partners / max) * 100}%` }}
                title={`Partner: ${d.partners}`}
              />
              <div
                className="pa-gbars__b pa-gbars__b--supplier"
                style={{ height: `${(d.suppliers / max) * 100}%` }}
                title={`Tedarikçi: ${d.suppliers}`}
              />
            </div>
            <div className="pa-gbars__lbl">{d.m}</div>
          </div>
        ))}
      </div>
      <div className="pa-legend">
        <span><i className="pa-dot--strategic" />Getirilen partner</span>
        <span><i className="pa-dot--supplier"  />Getirilen tedarikçi</span>
      </div>
    </>
  );
}

function PaCityBars() {
  const max = PA_CITIES[0]?.n ?? 1;
  return (
    <div className="pa-city">
      {PA_CITIES.map(({ city, n }) => (
        <div key={city} className="pa-city__row">
          <span className="pa-city__name">{city}</span>
          <div className="pa-city__track">
            <div className="pa-city__bar" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <span className="pa-city__n">{n}</span>
        </div>
      ))}
    </div>
  );
}

// ── API veri çekme ────────────────────────────────────────────────────────────

type MetricCard = {
  label: string;
  value: number;
  variant: "indigo" | "green" | "sky" | "violet" | "amber" | "teal" | "pink" | "cyan" | "rose";
};

type PublicMetricCard = MetricCard;

async function fetchPlatformAnalytics(
  apiBase: string,
  selectedHost: string,
  selectedEventType: string,
  startDate: string,
  endDate: string,
) {
  const params = new URLSearchParams();
  if (selectedHost !== "all") params.set("host", selectedHost);
  if (selectedEventType !== "all") params.set("event_type", selectedEventType);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const query = params.toString();

  const response = await fetch(`${apiBase}/api/v1/admin/platform-analytics${query ? `?${query}` : ""}`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
  });

  if (!response.ok) throw new Error("Veri alinamadi");
  return response.json() as Promise<Record<string, unknown>>;
}

function renderMetricCards(cards: MetricCard[]) {
  return cards.map((card) => (
    <div key={card.label} className={`platform-analytics-tab__metric-card platform-analytics-tab__metric-card--${card.variant}`}>
      <div className="platform-analytics-tab__metric-value">{card.value.toLocaleString("tr-TR")}</div>
      <div className="platform-analytics-tab__metric-label">{card.label}</div>
    </div>
  ));
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export function PlatformAnalyticsTab() {
  const [period, setPeriod] = useState<"30g" | "90g" | "12a">("12a");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHost, setSelectedHost] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const apiBase = import.meta.env.VITE_API_URL ?? "";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setError(null);
        const payload = await fetchPlatformAnalytics(apiBase, selectedHost, selectedEventType, startDate, endDate);
        if (active) setData(payload);
      } catch (fetchError: unknown) {
        if (active) setError(fetchError instanceof Error ? fetchError.message : "Bilinmeyen hata");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [apiBase, selectedHost, selectedEventType, startDate, endDate]);

  function handleExportTelemetryCsv() {
    const params = new URLSearchParams();
    if (selectedHost !== "all") params.set("host", selectedHost);
    if (selectedEventType !== "all") params.set("event_type", selectedEventType);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    window.open(`${apiBase}/api/v1/admin/platform-analytics/export?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  const periodLabel = period === "30g" ? "30 gün" : period === "90g" ? "90 gün" : "12 ay";

  if (loading) {
    return (
      <div className="platform-analytics-tab">
        <div className="platform-analytics-tab__panel platform-analytics-tab__panel--white">
          <div className="platform-analytics-tab__panel-title">Yükleniyor…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="platform-analytics-tab">
        <div className="platform-analytics-tab__panel platform-analytics-tab__panel--white">
          <div className="platform-analytics-tab__panel-title">Hata</div>
          <div className="platform-analytics-tab__empty-state">Hata: {error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const summary       = (data.summary               as Record<string, number>) ?? {};
  const planDist      = (data.plan_distribution      as Array<{ plan_code: string; plan_name: string; tenant_count: number }>) ?? [];
  const onboardingDist= (data.onboarding_distribution as Array<{ status: string; count: number }>) ?? [];
  const publicSummary = (data.public_summary          as Record<string, number>) ?? {};
  const domainIntentSummary = (data.domain_intent_summary as Array<{
    host: string; intent: string; primary_kpi: number; primary_kpi_label: string;
  }>) ?? [];
  const telemetryBreakdown = (data.telemetry_breakdown as Array<{
    host: string; intent: string; event_type: string; count: number;
  }>) ?? [];

  const telemetryHosts = ["all", ...Array.from(new Set(telemetryBreakdown.map((r) => r.host)))];
  const telemetryEventTypes = ["all", ...Array.from(new Set(telemetryBreakdown.map((r) => r.event_type)))];
  const filteredTelemetry = telemetryBreakdown.filter((r) => {
    if (selectedHost !== "all" && r.host !== selectedHost) return false;
    if (selectedEventType !== "all" && r.event_type !== selectedEventType) return false;
    return true;
  });

  const metricCards: MetricCard[] = [
    { label: "Toplam Tenant",      value: summary.total_tenants         ?? 0, variant: "indigo" },
    { label: "Aktif Tenant",        value: summary.active_tenants         ?? 0, variant: "green"  },
    { label: "Aktif Kullanıcı",    value: summary.total_internal_users   ?? 0, variant: "sky"    },
    { label: "Toplam Tedarikçi",   value: summary.total_suppliers         ?? 0, variant: "violet" },
    { label: "Platform Tedarikçi", value: summary.platform_suppliers      ?? 0, variant: "amber"  },
    { label: "Özel Tedarikçi",     value: summary.private_suppliers       ?? 0, variant: "teal"   },
    { label: "Toplam Proje",        value: summary.total_projects           ?? 0, variant: "pink"   },
    { label: "Toplam Teklif",       value: summary.total_quotes             ?? 0, variant: "cyan"   },
  ];

  const publicMetricCards: PublicMetricCard[] = [
    { label: "Partner Plan",     value: publicSummary.strategic_partner_plan_count  ?? 0, variant: "teal"   },
    { label: "Tedarikçi Plan",   value: publicSummary.supplier_plan_count            ?? 0, variant: "cyan"   },
    { label: "Public Kampanya",  value: publicSummary.public_campaign_count          ?? 0, variant: "violet" },
    { label: "Aktif Kampanya",   value: publicSummary.active_public_campaign_count   ?? 0, variant: "amber"  },
    { label: "Campaign Event",   value: publicSummary.campaign_event_count           ?? 0, variant: "pink"   },
    { label: "Onboarding Lead",  value: publicSummary.pending_onboarding_leads       ?? 0, variant: "indigo" },
    { label: "Page View",         value: publicSummary.page_view_count                ?? 0, variant: "teal"   },
    { label: "CTA Click",         value: publicSummary.cta_click_count                ?? 0, variant: "amber"  },
    { label: "Form Submit",       value: publicSummary.form_submit_count              ?? 0, variant: "rose"   },
  ];

  return (
    <section className="platform-analytics-tab">
      <PageHeader
        eyebrow="Platform"
        title="Platform Analitikleri"
        sub="Tenant, kullanıcı, tedarikçi ve public web metrikleri"
        actions={
          <div className="pa-period">
            {(["30g", "90g", "12a"] as const).map((v) => (
              <button key={v} type="button" className={period === v ? "on" : ""} onClick={() => setPeriod(v)}>
                {v === "30g" ? "30 gün" : v === "90g" ? "90 gün" : "12 ay"}
              </button>
            ))}
          </div>
        }
      />

      {/* Çekirdek sayaçlar */}
      <div className="platform-analytics-tab__metric-grid">
        {renderMetricCards(metricCards)}
      </div>

      {/* Plan dağılımı + Onboarding */}
      <div className="platform-analytics-tab__two-column-grid">
        <div className="platform-analytics-tab__panel">
          <div className="platform-analytics-tab__panel-title">Plan Dağılımı</div>
          <div className="platform-analytics-tab__section">
            {planDist.length === 0 ? (
              <div className="platform-analytics-tab__empty-state">Plan dağılımı verisi bulunmuyor.</div>
            ) : planDist.map((row) => (
              <div key={row.plan_code} className="platform-analytics-tab__list-row">
                <span>{row.plan_name}</span>
                <span className="platform-analytics-tab__list-value platform-analytics-tab__list-value--indigo">
                  {row.tenant_count.toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="platform-analytics-tab__panel">
          <div className="platform-analytics-tab__panel-title">Onboarding Durumu</div>
          <div className="platform-analytics-tab__section">
            {onboardingDist.length === 0 ? (
              <div className="platform-analytics-tab__empty-state">Onboarding verisi bulunmuyor.</div>
            ) : onboardingDist.map((row) => (
              <div key={row.status} className="platform-analytics-tab__list-row">
                <span>{row.status}</span>
                <span className="platform-analytics-tab__list-value platform-analytics-tab__list-value--green">
                  {row.count.toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Public Web KPI */}
      <div className="platform-analytics-tab__section">
        <h3 className="platform-analytics-tab__panel-title platform-analytics-tab__panel-title--small">
          Public Web KPI Özeti
        </h3>
        <div className="platform-analytics-tab__metric-grid">
          {renderMetricCards(publicMetricCards)}
        </div>
      </div>

      {/* Domain Intent */}
      <div className="platform-analytics-tab__detail-panel">
        <div className="platform-analytics-tab__panel-title">Domain Intent Özeti</div>
        {domainIntentSummary.length === 0 ? (
          <div className="platform-analytics-tab__empty-state">Domain intent verisi bulunmuyor.</div>
        ) : domainIntentSummary.map((row) => (
          <div key={row.host} className="platform-analytics-tab__detail-row">
            <div>
              <div className="platform-analytics-tab__detail-row-title">{row.host}</div>
              <div className="platform-analytics-tab__detail-row-subtitle">Intent: {row.intent}</div>
            </div>
            <div className="platform-analytics-tab__detail-row-value">
              <div className="platform-analytics-tab__detail-row-value-number">
                {row.primary_kpi.toLocaleString("tr-TR")}
              </div>
              <div className="platform-analytics-tab__detail-row-value-label">{row.primary_kpi_label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Telemetry */}
      <div className="platform-analytics-tab__panel platform-analytics-tab__panel--white">
        <div className="platform-analytics-tab__filter-bar">
          <div>
            <div className="platform-analytics-tab__panel-title">Telemetry Segmentleri</div>
            <div className="platform-analytics-tab__detail-row-subtitle">
              Host ve event tipine göre public telemetry kırılımı.
            </div>
          </div>
          <button type="button" onClick={handleExportTelemetryCsv} className="platform-analytics-tab__button">
            CSV Export
          </button>
        </div>
        <div className="platform-analytics-tab__filter-bar">
          <label className="platform-analytics-tab__field">
            Host filtresi
            <select value={selectedHost} onChange={(e) => setSelectedHost(e.target.value)} className="platform-analytics-tab__select">
              {telemetryHosts.map((h) => <option key={h} value={h}>{h === "all" ? "Tüm hostlar" : h}</option>)}
            </select>
          </label>
          <label className="platform-analytics-tab__field">
            Event filtresi
            <select value={selectedEventType} onChange={(e) => setSelectedEventType(e.target.value)} className="platform-analytics-tab__select">
              {telemetryEventTypes.map((et) => <option key={et} value={et}>{et === "all" ? "Tüm eventler" : et}</option>)}
            </select>
          </label>
          <label className="platform-analytics-tab__field">
            Başlangıç tarihi
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="platform-analytics-tab__input" />
          </label>
          <label className="platform-analytics-tab__field">
            Bitiş tarihi
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="platform-analytics-tab__input" />
          </label>
        </div>
        <div className="platform-analytics-tab__telemetry-grid">
          {filteredTelemetry.length === 0 ? (
            <div className="platform-analytics-tab__empty-state">Seçili filtreler için telemetry kaydı yok.</div>
          ) : filteredTelemetry.map((row) => (
            <div key={`${row.host}-${row.event_type}`} className="platform-analytics-tab__telemetry-row">
              <div className="platform-analytics-tab__telemetry-host">{row.host}</div>
              <div className="platform-analytics-tab__telemetry-text">{row.intent}</div>
              <div className="platform-analytics-tab__telemetry-text">{row.event_type}</div>
              <div className="platform-analytics-tab__telemetry-count">{row.count.toLocaleString("tr-TR")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EKOSİSTEM BÜYÜME ANALİZİ
          ═══════════════════════════════════════════════════════════ */}
      <div className="pa-band">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Ekosistem Büyüme Analizi
      </div>

      <Section title="Ekosistem büyümesi · 12 ay" sub="taraf bazında kümülatif kayıt — marka renkleri">
        <PaMultiLine series={PA_ECO_SERIES} lines={PA_ECO_LINES} />
      </Section>

      <div className="pa-split">
        <Section title="Tedarikçi havuzu kökeni" sub="318 tedarikçi nereden geldi">
          <div className="pa-donut-wrap">
            <PaDonut data={PA_ORIGIN_DONUT} size={160} />
            <div className="pa-donut-legend">
              {PA_ORIGIN_DONUT.map((d) => {
                const total = PA_ORIGIN_DONUT.reduce((s, x) => s + x.count, 0);
                return (
                  <div key={d.label} className="pa-donut-legend__item">
                    <span className="pa-donut-legend__dot" style={{ background: d.color }} />
                    <span className="pa-donut-legend__label">{d.label}</span>
                    <span className="pa-donut-legend__val">
                      {d.count} <small>({Math.round((d.count / total) * 100)}%)</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="RFQ → Kazanan hunisi" sub="teklif yaşam döngüsü · dönüşüm oranları">
          <PaFunnelBars steps={PA_RFQ_FUNNEL} color={PA_BRAND.strategic} />
        </Section>
      </div>

      <div className="pa-split">
        <Section title="İş Ortağı katkısı · 6 ay" sub="kanal kaynaklı yeni partner & tedarikçi">
          <PaGroupBars data={PA_CHANNEL_BARS} />
        </Section>

        <Section title="Coğrafi dağılım · şehir bazlı" sub="en yoğun şehirler · tenant dağılımı">
          <PaCityBars />
        </Section>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          KARİYER & YETENEK PAZARI
          ═══════════════════════════════════════════════════════════ */}
      <div className="pa-band">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
        Kariyer &amp; Yetenek Pazarı
      </div>

      <div className="pa-grid4">
        <StatCard label="Açık ilan"         value={34}     sub="yayında · işveren tenant" accent="violet" />
        <StatCard label="Aktif başvuru"      value={310}    sub="başvuru akışında"          accent="blue"   />
        <StatCard label="Yerleşen · 12 ay"   value={18}     sub="işe yerleştirme"            accent="green"  />
        <StatCard label="Yetenek profili"    value={124}    sub="96 KYC onaylı"             />
        <StatCard label="Dağıtılan ödül"     value="₺186K"  sub="katkı ekonomisi"            accent="gold"   />
      </div>

      <div className="pa-split">
        <Section
          title={`Başvuru & Yerleşme · ${periodLabel}`}
          sub="iş ilanı talebi vs gerçekleşen yerleştirme"
        >
          <PaMultiLine series={PA_CAREER_SERIES} lines={PA_CAREER_LINES} height={200} />
        </Section>

        <Section title="Yetenek pazarı hunisi" sub="ilan → yerleşme dönüşümü">
          <PaFunnelBars steps={PA_TALENT_FUNNEL} color={PA_BRAND.talent} />
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
    </section>
  );
}
