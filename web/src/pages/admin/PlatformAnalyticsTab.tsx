import { useEffect, useState } from "react";

import { getAccessToken } from "../../lib/token";

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

  if (loading) return <div style={{ padding: 32, color: "#6b7280" }}>Yukleniyor…</div>;
  if (error) return <div style={{ padding: 32, color: "#b91c1c" }}>Hata: {error}</div>;
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

  const metricCards: Array<{ label: string; value: number; color: string; bg: string }> = [
    { label: "Toplam Tenant", value: summary.total_tenants ?? 0, color: "#4f46e5", bg: "#eef2ff" },
    { label: "Aktif Tenant", value: summary.active_tenants ?? 0, color: "#059669", bg: "#ecfdf5" },
    { label: "Aktif Kullanici", value: summary.total_internal_users ?? 0, color: "#0284c7", bg: "#e0f2fe" },
    { label: "Toplam Tedarikci", value: summary.total_suppliers ?? 0, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Platform Tedarikci", value: summary.platform_suppliers ?? 0, color: "#b45309", bg: "#fffbeb" },
    { label: "Ozel Tedarikci", value: summary.private_suppliers ?? 0, color: "#0f766e", bg: "#f0fdfa" },
    { label: "Toplam Proje", value: summary.total_projects ?? 0, color: "#be185d", bg: "#fdf2f8" },
    { label: "Toplam Teklif", value: summary.total_quotes ?? 0, color: "#0369a1", bg: "#f0f9ff" },
  ];

  const publicMetricCards: Array<{ label: string; value: number; color: string; bg: string }> = [
    { label: "Partner Plan", value: publicSummary.strategic_partner_plan_count ?? 0, color: "#0f766e", bg: "#ecfdf5" },
    { label: "Tedarikci Plan", value: publicSummary.supplier_plan_count ?? 0, color: "#0369a1", bg: "#f0f9ff" },
    { label: "Public Kampanya", value: publicSummary.public_campaign_count ?? 0, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Aktif Kampanya", value: publicSummary.active_public_campaign_count ?? 0, color: "#b45309", bg: "#fffbeb" },
    { label: "Campaign Event", value: publicSummary.campaign_event_count ?? 0, color: "#be185d", bg: "#fdf2f8" },
    { label: "Onboarding Lead", value: publicSummary.pending_onboarding_leads ?? 0, color: "#1d4ed8", bg: "#eff6ff" },
    { label: "Page View", value: publicSummary.page_view_count ?? 0, color: "#0f766e", bg: "#f0fdfa" },
    { label: "CTA Click", value: publicSummary.cta_click_count ?? 0, color: "#92400e", bg: "#fff7ed" },
    { label: "Form Submit", value: publicSummary.form_submit_count ?? 0, color: "#7c2d12", bg: "#fef2f2" },
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📊 Platform Analitikleri</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        {metricCards.map((m) => (
          <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: m.color }}>{m.value.toLocaleString("tr-TR")}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Plan Dagilimi</div>
          {planDist.map((row) => (
            <div key={row.plan_code} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
              <span>{row.plan_name}</span>
              <span style={{ fontWeight: 700, color: "#4f46e5" }}>{row.tenant_count}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Onboarding Durumu</div>
          {onboardingDist.map((row) => (
            <div key={row.status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e5e7eb", fontSize: 13 }}>
              <span style={{ textTransform: "capitalize" as const }}>{row.status}</span>
              <span style={{ fontWeight: 700, color: "#059669" }}>{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Public Web KPI Ozeti</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {publicMetricCards.map((m) => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value.toLocaleString("tr-TR")}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Domain Intent Ozeti</div>
          <div style={{ display: "grid", gap: 10 }}>
            {domainIntentSummary.map((row) => (
              <div key={row.host} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.host}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Intent: {row.intent}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1d4ed8" }}>{row.primary_kpi.toLocaleString("tr-TR")}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{row.primary_kpi_label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Telemetry Segmentleri</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Host ve event tipine gore public telemetry kirilimi.</div>
            </div>
            <button type="button" onClick={handleExportTelemetryCsv} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontWeight: 700, cursor: "pointer" }}>
              CSV Export
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
              Host filtresi
              <select value={selectedHost} onChange={(event) => setSelectedHost(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 180 }}>
                {telemetryHosts.map((host) => (
                  <option key={host} value={host}>{host === "all" ? "Tum hostlar" : host}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
              Event filtresi
              <select value={selectedEventType} onChange={(event) => setSelectedEventType(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 180 }}>
                {telemetryEventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>{eventType === "all" ? "Tum eventler" : eventType}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
              Baslangic tarihi
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 160 }} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#475569" }}>
              Bitis tarihi
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", minWidth: 160 }} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {filteredTelemetryBreakdown.length === 0 ? (
              <div style={{ borderRadius: 10, background: "#f8fafc", padding: 12, color: "#64748b", fontSize: 13 }}>
                Secili filtreler icin telemetry kaydi yok.
              </div>
            ) : (
              filteredTelemetryBreakdown.map((row) => (
                <div key={`${row.host}-${row.event_type}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.4fr", gap: 12, alignItems: "center", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.host}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{row.intent}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>{row.event_type}</div>
                  <div style={{ textAlign: "right", fontWeight: 800, color: "#1d4ed8" }}>{row.count.toLocaleString("tr-TR")}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
