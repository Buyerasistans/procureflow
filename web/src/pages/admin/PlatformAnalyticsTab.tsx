import { useEffect, useState } from "react";
import { getAccessToken } from "../../lib/token";
import { PageHeader } from "./AdminTabContent";
import "./PlatformAnalyticsTab.css";

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

  if (!response.ok) {
    throw new Error("Veri alinamadi");
  }

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

export function PlatformAnalyticsTab() {
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
        if (active) {
          setData(payload);
        }
      } catch (fetchError: unknown) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Bilinmeyen hata");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [apiBase, selectedHost, selectedEventType, startDate, endDate]);

  if (loading) {
    return (
      <div className="platform-analytics-tab">
        <div className="platform-analytics-tab__panel platform-analytics-tab__panel--white">
          <div className="platform-analytics-tab__panel-title">Yukleniyor…</div>
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

  if (!data) {
    return null;
  }

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

  const metricCards: MetricCard[] = [
    { label: "Toplam Tenant", value: summary.total_tenants ?? 0, variant: "indigo" },
    { label: "Aktif Tenant", value: summary.active_tenants ?? 0, variant: "green" },
    { label: "Aktif Kullanıcı", value: summary.total_internal_users ?? 0, variant: "sky" },
    { label: "Toplam Tedarikçi", value: summary.total_suppliers ?? 0, variant: "violet" },
    { label: "Platform Tedarikçi", value: summary.platform_suppliers ?? 0, variant: "amber" },
    { label: "Özel Tedarikçi", value: summary.private_suppliers ?? 0, variant: "teal" },
    { label: "Toplam Proje", value: summary.total_projects ?? 0, variant: "pink" },
    { label: "Toplam Teklif", value: summary.total_quotes ?? 0, variant: "cyan" },
  ];

  const publicMetricCards: PublicMetricCard[] = [
    { label: "Partner Plan", value: publicSummary.strategic_partner_plan_count ?? 0, variant: "teal" },
    { label: "Tedarikçi Plan", value: publicSummary.supplier_plan_count ?? 0, variant: "cyan" },
    { label: "Public Kampanya", value: publicSummary.public_campaign_count ?? 0, variant: "violet" },
    { label: "Aktif Kampanya", value: publicSummary.active_public_campaign_count ?? 0, variant: "amber" },
    { label: "Campaign Event", value: publicSummary.campaign_event_count ?? 0, variant: "pink" },
    { label: "Onboarding Lead", value: publicSummary.pending_onboarding_leads ?? 0, variant: "indigo" },
    { label: "Page View", value: publicSummary.page_view_count ?? 0, variant: "teal" },
    { label: "CTA Click", value: publicSummary.cta_click_count ?? 0, variant: "amber" },
    { label: "Form Submit", value: publicSummary.form_submit_count ?? 0, variant: "rose" },
  ];

  return (
    <section className="platform-analytics-tab">
      <PageHeader
        eyebrow="Platform Analitikleri"
        title="Platform Analitikleri"
        sub="Ziyaretçi trafiği, sayfa görüntülemeleri ve dönüşüm metrikleri"
      />

      <div className="platform-analytics-tab__metric-grid">
        {renderMetricCards(metricCards)}
      </div>

      <div className="platform-analytics-tab__two-column-grid">
        <div className="platform-analytics-tab__panel">
          <div className="platform-analytics-tab__panel-title">Plan Dagilimi</div>
          <div className="platform-analytics-tab__section">
            {planDist.length === 0 ? (
              <div className="platform-analytics-tab__empty-state">Plan dagilimi verisi bulunmuyor.</div>
            ) : (
              planDist.map((row) => (
                <div key={row.plan_code} className="platform-analytics-tab__list-row">
                  <span>{row.plan_name}</span>
                  <span className="platform-analytics-tab__list-value platform-analytics-tab__list-value--indigo">
                    {row.tenant_count.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="platform-analytics-tab__panel">
          <div className="platform-analytics-tab__panel-title">Onboarding Durumu</div>
          <div className="platform-analytics-tab__section">
            {onboardingDist.length === 0 ? (
              <div className="platform-analytics-tab__empty-state">Onboarding verisi bulunmuyor.</div>
            ) : (
              onboardingDist.map((row) => (
                <div key={row.status} className="platform-analytics-tab__list-row">
                  <span>{row.status}</span>
                  <span className="platform-analytics-tab__list-value platform-analytics-tab__list-value--green">
                    {row.count.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="platform-analytics-tab__section">
        <h3 className="platform-analytics-tab__panel-title platform-analytics-tab__panel-title--small">Public Web KPI Özeti</h3>
        <div className="platform-analytics-tab__metric-grid">
          {renderMetricCards(publicMetricCards)}
        </div>
      </div>

      <div className="platform-analytics-tab__detail-panel">
        <div className="platform-analytics-tab__panel-title">Domain Intent Özeti</div>
        {domainIntentSummary.length === 0 ? (
          <div className="platform-analytics-tab__empty-state">Domain intent verisi bulunmuyor.</div>
        ) : (
          domainIntentSummary.map((row) => (
            <div key={row.host} className="platform-analytics-tab__detail-row">
              <div>
                <div className="platform-analytics-tab__detail-row-title">{row.host}</div>
                <div className="platform-analytics-tab__detail-row-subtitle">Intent: {row.intent}</div>
              </div>
              <div className="platform-analytics-tab__detail-row-value">
                <div className="platform-analytics-tab__detail-row-value-number">{row.primary_kpi.toLocaleString("tr-TR")}</div>
                <div className="platform-analytics-tab__detail-row-value-label">{row.primary_kpi_label}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="platform-analytics-tab__panel platform-analytics-tab__panel--white">
        <div className="platform-analytics-tab__filter-bar">
          <div>
            <div className="platform-analytics-tab__panel-title">Telemetry Segmentleri</div>
            <div className="platform-analytics-tab__detail-row-subtitle">Host ve event tipine gore public telemetry kirilimi.</div>
          </div>
          <button type="button" onClick={handleExportTelemetryCsv} className="platform-analytics-tab__button">
            CSV Export
          </button>
        </div>

        <div className="platform-analytics-tab__filter-bar">
          <label className="platform-analytics-tab__field">
            Host filtresi
            <select value={selectedHost} onChange={(event) => setSelectedHost(event.target.value)} className="platform-analytics-tab__select">
              {telemetryHosts.map((host) => (
                <option key={host} value={host}>
                  {host === "all" ? "Tum hostlar" : host}
                </option>
              ))}
            </select>
          </label>

          <label className="platform-analytics-tab__field">
            Event filtresi
            <select value={selectedEventType} onChange={(event) => setSelectedEventType(event.target.value)} className="platform-analytics-tab__select">
              {telemetryEventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType === "all" ? "Tum eventler" : eventType}
                </option>
              ))}
            </select>
          </label>

          <label className="platform-analytics-tab__field">
            Başlangıç tarihi
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="platform-analytics-tab__input" />
          </label>

          <label className="platform-analytics-tab__field">
            Bitis tarihi
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="platform-analytics-tab__input" />
          </label>
        </div>

        <div className="platform-analytics-tab__telemetry-grid">
          {filteredTelemetryBreakdown.length === 0 ? (
            <div className="platform-analytics-tab__empty-state">Secili filtreler icin telemetry kaydi yok.</div>
          ) : (
            filteredTelemetryBreakdown.map((row) => (
              <div key={`${row.host}-${row.event_type}`} className="platform-analytics-tab__telemetry-row">
                <div className="platform-analytics-tab__telemetry-host">{row.host}</div>
                <div className="platform-analytics-tab__telemetry-text">{row.intent}</div>
                <div className="platform-analytics-tab__telemetry-text">{row.event_type}</div>
                <div className="platform-analytics-tab__telemetry-count">{row.count.toLocaleString("tr-TR")}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
