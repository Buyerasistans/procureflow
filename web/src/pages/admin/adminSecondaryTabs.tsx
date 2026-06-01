import { useCallback, useEffect, useState } from "react";

import { canAccessAdminSurface, isSuperAdminUser } from "../../auth/permissions";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/token";
import { CampaignsAdminTab } from "../../components/admin/CampaignsTab.tsx";
import { PageHeader, StatCard } from "./AdminTabContent";

export function ReportsTabContent() {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  return (
    <div style={{ padding: "24px 0" }}>
      <PageHeader
        eyebrow="Sistem"
        title="Raporlar"
        sub="RFQ karşılaştırma, tedarikçi performans ve satın alma süreci raporları"
      />
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
        <a
          href="/quotes"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 18px", textDecoration: "none", color: "#065f46", fontWeight: 600, fontSize: 14 }}
        >
          Teklif Listesi {"->"} Karsilastirma raporlarina erismek icin bir RFQ secin
        </a>
        <a
          href={`${apiBase}/api/v1/reports/quote-comparison`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "14px 18px", textDecoration: "none", color: "#1e40af", fontWeight: 600, fontSize: 14 }}
        >
          Karsilastirma Raporu API {"->"}
        </a>
      </div>
    </div>
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

  if (loading) return <div style={{ padding: 32, color: "#6b7280" }}>Yukleniyor...</div>;
  if (error) return <div style={{ padding: 32, color: "#b91c1c" }}>Hata: {error}</div>;

  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  return (
    <div style={{ padding: "24px 0", display: "grid", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>İş Ortağı Raporları</h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
          Komisyon kazanclariniz, referans donusum performansiniz ve ekip aktivite ozetiniz.
        </p>
      </div>

      {/* Komisyon Özeti */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Bekleyen Komisyon", value: fmt(summary?.commission_pending ?? 0), color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
          { label: "Onaylanan Komisyon", value: fmt(summary?.commission_approved ?? 0), color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
          { label: "Odenen Komisyon", value: fmt(summary?.commission_paid ?? 0), color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Bu Ay Net", value: fmt(summary?.commission_net_current_month ?? 0), color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, border: `1px solid ${kpi.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Ekip ve Müşteri Özeti */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Toplam Ekip Buyuklugu", value: summary?.total_team_size ?? 0 },
          { label: "Aktif Ekip Uyeleri", value: summary?.active_team_size ?? 0 },
          { label: "Son 30 Günde Yeni Müşteri", value: summary?.last_30d_new_customers ?? 0 },
          { label: "Performans Skoru", value: `${Math.round(summary?.performance_score ?? 0)} / 100` },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Komisyon Kayıtları */}
      {report && report.entries && report.entries.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Son Komisyon Kayitlari</div>
          <div style={{ display: "grid", gap: 8 }}>
            {report.entries.slice(0, 10).map(entry => (
              <div key={entry.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {entry.description || entry.reference_type || "Komisyon"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {new Date(entry.created_at).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                    background: entry.status === "paid" ? "#dcfce7" : entry.status === "approved" ? "#dbeafe" : "#fef9c3",
                    color: entry.status === "paid" ? "#166534" : entry.status === "approved" ? "#1e40af" : "#92400e",
                  }}>
                    {entry.status === "paid" ? "Odendi" : entry.status === "approved" ? "Onaylandi" : "Bekliyor"}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>{fmt(entry.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!report || !report.entries || report.entries.length === 0) && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "24px 20px", textAlign: "center" as const, color: "#94a3b8", fontSize: 14 }}>
          Henüz komisyon kaydı bulunmuyor. Referans linkleri ile müşteri yönlendirmeleri yaptığınızda komisyon kazançlarınız burada görünecek.
        </div>
      )}
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

  if (loading) return <div style={{ padding: 32, color: "#6b7280" }}>Yukleniyor...</div>;
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
    { label: "Aktif Kullanıcı", value: summary.total_internal_users ?? 0, color: "#0284c7", bg: "#e0f2fe" },
    { label: "Toplam Tedarikçi", value: summary.total_suppliers ?? 0, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Platform Tedarikçi", value: summary.platform_suppliers ?? 0, color: "#b45309", bg: "#fffbeb" },
    { label: "Özel Tedarikçi", value: summary.private_suppliers ?? 0, color: "#0f766e", bg: "#f0fdfa" },
    { label: "Toplam Proje", value: summary.total_projects ?? 0, color: "#be185d", bg: "#fdf2f8" },
    { label: "Toplam Teklif", value: summary.total_quotes ?? 0, color: "#0369a1", bg: "#f0f9ff" },
  ];

  const publicMetricCards: Array<{ label: string; value: number; color: string; bg: string }> = [
    { label: "Partner Plan", value: publicSummary.strategic_partner_plan_count ?? 0, color: "#0f766e", bg: "#ecfdf5" },
    { label: "Tedarikçi Plan", value: publicSummary.supplier_plan_count ?? 0, color: "#0369a1", bg: "#f0f9ff" },
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
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Platform Analitikleri</h2>

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
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Public Web KPI Özeti</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {publicMetricCards.map((m) => (
            <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value.toLocaleString("tr-TR")}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Domain Intent Özeti</div>
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
              Başlangıç tarihi
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

export function PlatformSuppliersTab() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", website: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const canCreate = canAccessAdminSurface(user);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    fetch(`${apiBase}/api/v1/admin/platform-suppliers`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then(async (r) => {
        const payload = await r.json().catch(() => null);
        if (!r.ok) {
          throw new Error(
            typeof payload?.detail === "string"
              ? payload.detail
              : "Platform tedarikçi havuzu okunamadı"
          );
        }
        return Array.isArray(payload) ? payload : [];
      })
      .then(setSuppliers)
      .catch((loadError) => {
        setSuppliers([]);
        setErr(loadError instanceof Error ? loadError.message : "Platform tedarikçi havuzu okunamadı");
      })
      .finally(() => setLoading(false));
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Firma adi zorunlu"); return; }
    if (!form.email.trim()) { setErr("E-posta zorunlu"); return; }
    if (!form.phone.trim()) { setErr("Telefon zorunlu"); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/platform-suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.detail ?? "Hata"); return; }
      setForm({ name: "", email: "", phone: "", website: "", city: "" });
      setShowForm(false);
      load();
    } catch {
      setErr("Sunucu hatasi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 32, color: "#6b7280" }}>Yukleniyor...</div>;

  return (
    <div style={{ padding: "24px 0" }}>
      <PageHeader
        eyebrow="Operasyon"
        title="Platform Tedarikçi Havuzu"
        sub="Platform genelinde kayıtlı tedarikçi firmaları ve profil bilgileri"
      />
      <div className="kpi-grid kpi-grid--2">
        <StatCard label="Toplam Tedarikçi" value={suppliers.length} accent="blue" sub="Kayıtlı tedarikçi firmalar" />
        {/* TODO(data): aktif/pasif ayrımı — tedarikçi havuzu servisine is_active alanı eklenecek */}
        <StatCard label="Yükleniyor" value={loading ? "…" : suppliers.length} accent="slate" sub="Havuz durumu" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div />
        {canCreate ? (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            {showForm ? "İptal" : "+ Yeni Tedarikçi"}
          </button>
        ) : null}
      </div>

      {showForm && canCreate && (
        <form onSubmit={handleCreate} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["name", "email", "phone", "website", "city"] as const).map((f) => (
            <input
              key={f}
              placeholder={f === "name" ? "Firma adi *" : f}
              value={form[f]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))}
              style={{ border: "1px solid #d1d5db", borderRadius: 7, padding: "8px 10px", fontSize: 13 }}
            />
          ))}
          {err && <div style={{ gridColumn: "1/-1", color: "#b91c1c", fontSize: 13 }}>{err}</div>}
          <button type="submit" disabled={saving} style={{ gridColumn: "1/-1", background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      )}

      {err ? (
        <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12 }}>{err}</div>
      ) : suppliers.length === 0 ? (
        <div style={{ color: "#6b7280", fontStyle: "italic" }}>Platform havuzunda henüz tedarikçi yok.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
          {suppliers.map((s) => (
            <div key={String(s.id)} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 9, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{String(s.name)}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{[s.email, s.phone, s.city].filter(Boolean).join(" | ")}</div>
              </div>
              <span style={{ fontSize: 11, background: "#f0fdf4", color: "#065f46", borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>platform_network</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublicPricingTab() {
  const { user: pricingUser } = useAuth();
  const [configText, setConfigText] = useState("{}");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const canWritePricing = isSuperAdminUser(pricingUser);

  const loadConfig = useCallback(() => {
    setLoadingConfig(true);
    fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConfigText(JSON.stringify(data, null, 2));
      })
      .catch(() => {
        setSaveError("Public fiyatlandirma verisi yuklenemedi");
      })
      .finally(() => setLoadingConfig(false));
  }, [apiBase]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function handleSave() {
    setSavingConfig(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const parsed = JSON.parse(configText);
      const response = await fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveError(payload.detail ?? "Kayit basarisiz");
        return;
      }
      setConfigText(JSON.stringify(payload, null, 2));
      setSaveMessage("Public fiyatlandirma guncellendi");
    } catch {
      setSaveError("Gecersiz JSON veya sunucu hatasi");
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <div style={{ padding: "24px 0" }}>
      <PageHeader
        eyebrow="Ticari"
        title="Genel Fiyatlandırma"
        sub={`Public /fiyatlandırma sayfası plan konfigürasyonu · Yetki: ${canWritePricing ? "Yazma" : "Salt Okuma"}`}
      />

      {loadingConfig ? (
        <div style={{ color: "#6b7280" }}>Yukleniyor...</div>
      ) : (
        <>
          <textarea
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
            rows={22}
            style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, fontFamily: "Consolas, monospace", fontSize: 12 }}
            disabled={!canWritePricing}
          />

          {saveError && <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: 10, fontSize: 13 }}>{saveError}</div>}
          {saveMessage && <div style={{ marginTop: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", borderRadius: 8, padding: 10, fontSize: 13 }}>{saveMessage}</div>}

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={!canWritePricing || savingConfig}
              style={{ background: canWritePricing ? "#0f766e" : "#9ca3af", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: canWritePricing ? "pointer" : "not-allowed" }}
            >
              {savingConfig ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              onClick={loadConfig}
              style={{ background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}
            >
              Yenile
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function CampaignsTab() {
  return <CampaignsAdminTab />;
}
