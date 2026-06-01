import { useCallback, useEffect, useState } from "react";

import { canAccessAdminSurface, isSuperAdminUser } from "../../auth/permissions";
import { useAuth } from "../../hooks/useAuth";
import { getAccessToken } from "../../lib/token";
import { CampaignsAdminTab } from "../../components/admin/CampaignsTab.tsx";
import { PageHeader, StatCard, Section, DataTable } from "./AdminTabContent";
import "./adminSecondaryTabs.css";

const REPORT_TYPES = [
  { code: "quote_comparison", label: "Teklif Karşılaştırma", desc: "RFQ bazında tedarikçi tekliflerini yan yana görüntüle", href: "/quotes", accent: "#065f46", bg: "#f0fdf4", border: "#bbf7d0", external: false },
  { code: "quote_comparison_api", label: "Karşılaştırma API", desc: "Ham rapor verisini JSON olarak dışa aktar", href: "/api/v1/reports/quote-comparison", accent: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", external: true },
] as const;

export function ReportsTabContent() {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  return (
    <div className="rpt-tab">
      <PageHeader
        eyebrow="Sistem"
        title="Raporlar"
        sub="RFQ karşılaştırma, tedarikçi performans ve satın alma süreci raporları"
      />
      <div className="kpi-grid kpi-grid--2">
        <StatCard label="Rapor Şablonu" value={REPORT_TYPES.length} accent="blue" sub="mevcut rapor türü" />
        <StatCard label="RFQ Karşılaştırma" value="Anlık" accent="green" sub="üretildiğinde indir" />
      </div>
      <Section title="Mevcut Raporlar" sub="Rapor oluşturmak için ilgili kaynağa gidin">
        <div className="rpt-cards">
          {REPORT_TYPES.map((r) => (
            <a
              key={r.code}
              href={r.external ? `${apiBase}${r.href}` : r.href}
              target={r.external ? "_blank" : undefined}
              rel={r.external ? "noopener noreferrer" : undefined}
              className="rpt-card"
              style={{ background: r.bg, borderColor: r.border, color: r.accent }}
            >
              <div className="rpt-card__label">{r.label}</div>
              <div className="rpt-card__desc">{r.desc}</div>
              <div className="rpt-card__arrow">{r.external ? "↗" : "→"}</div>
            </a>
          ))}
        </div>
      </Section>
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

  if (loading) {
    return (
      <div className="pst-tab">
        <PageHeader eyebrow="Operasyon" title="Platform Tedarikçi Havuzu" sub="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="pst-tab">
      <PageHeader
        eyebrow="Operasyon"
        title="Platform Tedarikçi Havuzu"
        sub="Platform genelinde kayıtlı tedarikçi firmaları ve profil bilgileri"
      />

      <div className="kpi-grid kpi-grid--3">
        <StatCard label="Toplam Tedarikçi" value={suppliers.length} accent="blue" sub="Kayıtlı tedarikçi firmalar" />
        <StatCard label="Havuz Tipi" value="Platform Network" accent="teal" sub="Paylaşımlı tedarik ağı" />
        {/* TODO(data): aktif/pasif ayrımı — is_active alanı backend'e eklenecek */}
        <StatCard label="Havuz Durumu" value="Aktif" accent="green" sub="Tüm tedarikçiler erişilebilir" />
      </div>

      {err && (
        <div className="pst-error">{err}</div>
      )}

      {canCreate && (
        <Section
          title="Yeni Tedarikçi Ekle"
          action={
            <button type="button" className="pst-btn-toggle" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "İptal" : "+ Yeni Tedarikçi"}
            </button>
          }
        >
          {showForm ? (
            <form onSubmit={handleCreate} className="pst-form">
              <input className="pst-input" placeholder="Firma adı *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <input className="pst-input" placeholder="E-posta *" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <input className="pst-input" placeholder="Telefon *" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <input className="pst-input" placeholder="Web sitesi" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
              <input className="pst-input" placeholder="Şehir" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              <div className="pst-form__footer">
                {err && <span className="pst-form__err">{err}</span>}
                <button type="submit" className="pst-btn pst-btn--save" disabled={saving}>
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </form>
          ) : (
            <div className="pst-form-hint">Forma erişmek için "+ Yeni Tedarikçi" butonunu kullanın.</div>
          )}
        </Section>
      )}

      <Section title="Tedarikçi Listesi" sub={`${suppliers.length} kayıt`} padded={false}>
        {suppliers.length === 0 ? (
          <div className="pst-empty">Platform havuzunda henüz tedarikçi yok.</div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Firma Adı" },
              { key: "email", label: "E-posta" },
              { key: "phone", label: "Telefon" },
              { key: "city", label: "Şehir" },
              {
                key: "website", label: "Web", width: "160px",
                render: (r) => r.website
                  ? <a href={String(r.website)} target="_blank" rel="noopener noreferrer" className="pst-link">{String(r.website)}</a>
                  : <span className="pst-muted">—</span>,
              },
              {
                key: "_tag", label: "", width: "130px",
                render: () => <span className="pst-badge">platform_network</span>,
              },
            ]}
            rows={suppliers}
            rowKey="id"
          />
        )}
      </Section>
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
    setSaveMessage(null);
    setSaveError(null);
    fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then((r) => r.json())
      .then((data) => setConfigText(JSON.stringify(data, null, 2)))
      .catch(() => setSaveError("Public fiyatlandırma verisi yüklenemedi"))
      .finally(() => setLoadingConfig(false));
  }, [apiBase]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleSave() {
    setSavingConfig(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const parsed = JSON.parse(configText);
      const response = await fetch(`${apiBase}/api/v1/admin/public-pricing-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json();
      if (!response.ok) { setSaveError(payload.detail ?? "Kayıt başarısız"); return; }
      setConfigText(JSON.stringify(payload, null, 2));
      setSaveMessage("Fiyatlandırma konfigürasyonu güncellendi.");
    } catch {
      setSaveError("Geçersiz JSON veya sunucu hatası.");
    } finally {
      setSavingConfig(false);
    }
  }

  const accessLabel = canWritePricing ? "Yazma yetkisi" : "Salt okuma";

  return (
    <div className="ppt-tab">
      <PageHeader
        eyebrow="Ticari"
        title="Genel Fiyatlandırma"
        sub={`Public /fiyatlandırma sayfası plan konfigürasyonu · ${accessLabel}`}
        actions={
          canWritePricing ? (
            <div className="ppt-actions">
              <button type="button" className="ppt-btn ppt-btn--ghost" onClick={loadConfig} disabled={loadingConfig}>
                Yenile
              </button>
              <button type="button" className="ppt-btn ppt-btn--primary" onClick={handleSave} disabled={savingConfig || loadingConfig}>
                {savingConfig ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="ppt-sync-bar">
        <span className="ppt-sync-bar__dot" />
        <span>
          <strong>Tek kaynak (single source of truth)</strong> — buradaki değişiklikler public fiyatlandırma sayfasına ve kayıt akışlarına uygulanır.
        </span>
        <span className={`ppt-sync-bar__badge ${canWritePricing ? "ppt-sync-bar__badge--live" : "ppt-sync-bar__badge--ro"}`}>
          {canWritePricing ? "CANLI" : "SALT OKUMA"}
        </span>
      </div>

      {saveError && <div className="ppt-msg ppt-msg--err">{saveError}</div>}
      {saveMessage && <div className="ppt-msg ppt-msg--ok">{saveMessage}</div>}

      <Section title="JSON Konfigürasyonu" sub="Audience başına plan, eklenti ve fiyat tanımları">
        {loadingConfig ? (
          <div className="ppt-loading">Yükleniyor…</div>
        ) : (
          <textarea
            className="ppt-editor"
            aria-label="Public fiyatlandırma JSON konfigürasyonu"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={24}
            disabled={!canWritePricing}
            spellCheck={false}
          />
        )}
      </Section>
    </div>
  );
}

export function CampaignsTab() {
  return <CampaignsAdminTab />;
}
