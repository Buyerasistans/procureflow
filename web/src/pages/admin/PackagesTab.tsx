import { useEffect, useState } from "react";
import { PageHeader, StatCard, Section, DataTable, UsageBar } from "./AdminTabContent";
import {
  getSubscriptionCatalog,
  getBillingOverview,
  getCommercialRequests,
  getSubscriptionAddons,
} from "../../services/admin.service";
import type {
  SubscriptionCatalogSnapshot,
  BillingOverview,
  CommercialRequestItem,
  SubscriptionAddonAdminItem,
} from "../../services/admin.service";
import "./PackagesTab.css";

const STATUS_BADGE: Record<string, string> = {
  active: "pkg-badge pkg-badge--active",
  pending: "pkg-badge pkg-badge--pending",
  past_due: "pkg-badge pkg-badge--warn",
  cancelled: "pkg-badge pkg-badge--cancelled",
  open: "pkg-badge pkg-badge--pending",
  paid: "pkg-badge pkg-badge--active",
  succeeded: "pkg-badge pkg-badge--active",
  failed: "pkg-badge pkg-badge--warn",
  approved: "pkg-badge pkg-badge--active",
  rejected: "pkg-badge pkg-badge--cancelled",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "pkg-badge";
  const labels: Record<string, string> = {
    active: "Aktif", pending: "Beklemede", past_due: "Gecikmiş",
    cancelled: "İptal", open: "Açık", paid: "Ödendi",
    succeeded: "Başarılı", failed: "Başarısız", approved: "Onaylandı",
    rejected: "Reddedildi",
  };
  return <span className={cls}>{labels[status] ?? status}</span>;
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

function currency(amount: number | null | undefined, cur = "TRY") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amount);
}

const AUDIENCE_LABELS: Record<string, string> = {
  strategic_partner: "Stratejik Partner",
  supplier: "Tedarikçi",
  channel_partner: "İş Ortağı",
  candidate: "Aday",
  employer: "İşveren",
};

type LoadState = {
  catalog: SubscriptionCatalogSnapshot | null;
  billing: BillingOverview | null;
  commercial: CommercialRequestItem[] | null;
  addons: SubscriptionAddonAdminItem[] | null;
};

export function PackagesTab() {
  const [data, setData] = useState<LoadState>({ catalog: null, billing: null, commercial: null, addons: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSubscriptionCatalog(),
      getBillingOverview(),
      getCommercialRequests(),
      getSubscriptionAddons(),
    ])
      .then(([catalog, billing, commercial, addons]) => {
        if (!cancelled) {
          setData({ catalog, billing, commercial, addons });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Veriler yüklenirken bir hata oluştu.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="pkg-tab">
        <PageHeader eyebrow="Ticari" title="Paket & Kullanım" sub="Yükleniyor…" />
        <div className="pkg-loading">Veriler yükleniyor…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pkg-tab">
        <PageHeader eyebrow="Ticari" title="Paket & Kullanım" />
        <div className="pkg-error">{error}</div>
      </div>
    );
  }

  const plans = data.catalog?.catalog.plans ?? [];
  const tenantUsage = data.catalog?.tenant_usage ?? [];
  const subscriptions = data.billing?.subscriptions ?? [];
  const invoices = data.billing?.invoices ?? [];
  const webhooks = data.billing?.recent_webhook_events ?? [];
  const addons = data.addons ?? [];
  const commercial = data.commercial ?? [];

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active").length;
  const pendingInvoices = invoices.filter((i) => i.status === "open" || i.status === "past_due").length;
  const pendingCommercial = commercial.filter((c) => c.status === "pending").length;

  return (
    <div className="pkg-tab">
      <PageHeader
        eyebrow="Ticari"
        title="Paket & Kullanım"
        sub="Abonelikler, faturalar, webhook'lar, eklentiler ve ticari talepler"
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Plan Sayısı" value={plans.length} accent="blue" sub="katalogdaki toplam" />
        <StatCard label="Aktif Abonelik" value={activeSubscriptions} accent="green" sub={`/ ${subscriptions.length} toplam`} />
        <StatCard label="Bekleyen Fatura" value={pendingInvoices} accent={pendingInvoices > 0 ? "warn" : "default"} sub="açık veya gecikmiş" />
        <StatCard label="Ticari Talep" value={pendingCommercial} accent={pendingCommercial > 0 ? "gold" : "default"} sub="onay bekliyor" />
      </div>

      <Section title="Plan Katalogu" sub={`${plans.length} plan tanımlı`}>
        {plans.length === 0 ? (
          <div className="pkg-empty">Henüz plan tanımlanmamış.</div>
        ) : (
          <div className="pkg-plan-grid">
            {plans.map((plan) => (
              <div key={plan.code} className="pkg-plan-card">
                <div className="pkg-plan-card__head">
                  <div>
                    <div className="pkg-plan-card__name">{plan.name}</div>
                    <div className="pkg-plan-card__code">{plan.code}</div>
                  </div>
                  {plan.is_default && <span className="pkg-badge pkg-badge--active">Varsayılan</span>}
                </div>
                <div className="pkg-plan-card__audience">
                  {AUDIENCE_LABELS[plan.audience] ?? plan.audience}
                </div>
                {plan.description && (
                  <div className="pkg-plan-card__desc">{plan.description}</div>
                )}
                {plan.modules && plan.modules.length > 0 && (
                  <div className="pkg-plan-card__modules">
                    {plan.modules.map((m) => (
                      <span key={m.code} className="pkg-module-tag">{m.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Tenant Kullanım Özeti" sub={`${tenantUsage.length} tenant`}>
        {tenantUsage.length === 0 ? (
          <div className="pkg-empty">Kullanım verisi bulunamadı.</div>
        ) : (
          <div className="pkg-usage-table">
            {tenantUsage.map((tu) => (
              <div key={tu.tenant_id} className="pkg-usage-row">
                <div className="pkg-usage-row__head">
                  <div className="pkg-usage-row__name">{tu.tenant_name}</div>
                  <div className="pkg-usage-row__meta">
                    <span className="pkg-plan-tag">{tu.plan_name}</span>
                    <StatusBadge status={tu.status} />
                  </div>
                </div>
                {tu.metrics.length > 0 && (
                  <div className="pkg-usage-row__metrics">
                    {tu.metrics.map((m) => (
                      <div key={m.key} className="pkg-usage-row__metric">
                        <div className="pkg-usage-row__metric-label">{m.label}</div>
                        {m.limit != null ? (
                          <UsageBar value={m.used} max={m.limit} label={`${m.used} / ${m.limit}${m.unit ? " " + m.unit : ""}`} />
                        ) : (
                          <div className="pkg-usage-row__metric-val">{m.used}{m.unit ? " " + m.unit : ""} <span className="pkg-usage-row__metric-unlimited">sınırsız</span></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Abonelikler" sub={`${subscriptions.length} kayıt`} padded={false}>
        <DataTable
          columns={[
            { key: "tenant_id", label: "Tenant ID", width: "80px" },
            { key: "subscription_plan_code", label: "Plan" },
            { key: "billing_cycle", label: "Döngü" },
            { key: "seats_purchased", label: "Koltuk", align: "right" },
            {
              key: "status", label: "Durum", width: "130px",
              render: (r) => <StatusBadge status={r.status as string} />,
            },
            {
              key: "current_period_ends_at", label: "Dönem Sonu",
              render: (r) => fmt(r.current_period_ends_at as string),
            },
          ]}
          rows={subscriptions as unknown as Record<string, unknown>[]}
          rowKey="id"
        />
        {subscriptions.length === 0 && <div className="pkg-empty">Abonelik kaydı bulunamadı.</div>}
      </Section>

      <Section title="Faturalar" sub={`${invoices.length} kayıt`} padded={false}>
        <DataTable
          columns={[
            { key: "id", label: "ID", width: "60px" },
            { key: "tenant_id", label: "Tenant" },
            { key: "invoice_number", label: "Fatura No" },
            {
              key: "total_amount", label: "Tutar", align: "right",
              render: (r) => currency(r.total_amount as number, r.currency as string),
            },
            {
              key: "status", label: "Durum", width: "120px",
              render: (r) => <StatusBadge status={r.status as string} />,
            },
            {
              key: "due_at", label: "Vade",
              render: (r) => fmt(r.due_at as string),
            },
          ]}
          rows={invoices as unknown as Record<string, unknown>[]}
          rowKey="id"
        />
        {invoices.length === 0 && <div className="pkg-empty">Fatura bulunamadı.</div>}
      </Section>

      <Section title="Webhook Olayları" sub={`${webhooks.length} son olay`} padded={false}>
        <DataTable
          columns={[
            { key: "provider", label: "Sağlayıcı", width: "110px" },
            { key: "event_type", label: "Olay Türü" },
            {
              key: "processing_status", label: "Durum", width: "120px",
              render: (r) => <StatusBadge status={r.processing_status as string} />,
            },
            { key: "tenant_id", label: "Tenant", width: "80px" },
            {
              key: "received_at", label: "Alındı",
              render: (r) => fmt(r.received_at as string),
            },
          ]}
          rows={webhooks as unknown as Record<string, unknown>[]}
          rowKey="id"
        />
        {webhooks.length === 0 && <div className="pkg-empty">Webhook olayı bulunamadı.</div>}
      </Section>

      <Section title="Eklentiler" sub={`${addons.length} kayıt`} padded={false}>
        <DataTable
          columns={[
            { key: "tenant_name", label: "Tenant" },
            { key: "addon_name", label: "Eklenti" },
            { key: "limit_key", label: "Limit Anahtarı" },
            { key: "total_increment", label: "Toplam Artış", align: "right" },
            {
              key: "status", label: "Durum", width: "120px",
              render: (r) => <StatusBadge status={r.status as string} />,
            },
            {
              key: "activated_at", label: "Aktifleşti",
              render: (r) => fmt(r.activated_at as string),
            },
          ]}
          rows={addons as unknown as Record<string, unknown>[]}
          rowKey="id"
        />
        {addons.length === 0 && <div className="pkg-empty">Eklenti kaydı bulunamadı.</div>}
      </Section>

      <Section title="Ticari Talepler" sub={`${commercial.length} kayıt`} padded={false}>
        <DataTable
          columns={[
            { key: "requester_name", label: "Talep Eden" },
            { key: "company_name", label: "Firma" },
            { key: "request_type", label: "Tür" },
            { key: "package_name", label: "Paket" },
            {
              key: "audience", label: "Kitle",
              render: (r) => AUDIENCE_LABELS[r.audience as string] ?? (r.audience as string),
            },
            {
              key: "status", label: "Durum", width: "120px",
              render: (r) => <StatusBadge status={r.status as string} />,
            },
            {
              key: "created_at", label: "Tarih",
              render: (r) => fmt(r.created_at as string),
            },
          ]}
          rows={commercial as unknown as Record<string, unknown>[]}
          rowKey="id"
        />
        {commercial.length === 0 && <div className="pkg-empty">Ticari talep bulunamadı.</div>}
      </Section>
    </div>
  );
}

export default PackagesTab;
