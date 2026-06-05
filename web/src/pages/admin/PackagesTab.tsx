import { useEffect, useRef, useState } from "react";
import { PageHeader, StatCard, Section } from "./AdminTabContent";
import {
  getSubscriptionCatalog,
  getBillingOverview,
  getCommercialRequests,
  getSubscriptionAddons,
  retryBillingWebhookEvent,
} from "../../services/admin.service";
import type {
  SubscriptionCatalogSnapshot,
  BillingOverview,
  CommercialRequestItem,
  SubscriptionAddonAdminItem,
} from "../../services/admin.service";
import "./PackagesTab.css";

type LoadState = {
  catalog: SubscriptionCatalogSnapshot | null;
  billing: BillingOverview | null;
  commercial: CommercialRequestItem[] | null;
  addons: SubscriptionAddonAdminItem[] | null;
};

type SubscriptionBucket = "all" | "active" | "trialing" | "other";
type InvoiceBucket = "all" | "open" | "paid";
type WebhookBucket = "all" | "processed" | "failed";
type PlanFilter = "all" | string;
type UsageFilter = "all" | "pressure" | "breach";

function getSubscriptionBucket(status: string): SubscriptionBucket {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  return "other";
}

function getInvoiceBucket(status: string): InvoiceBucket {
  if (status === "paid") return "paid";
  if (["open", "unpaid", "past_due", "uncollectible"].includes(status)) return "open";
  return "all";
}

function getWebhookBucket(processingStatus: string): WebhookBucket {
  if (processingStatus === "processed") return "processed";
  if (processingStatus === "failed") return "failed";
  return "all";
}

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

export function PackagesTab() {
  const [data, setData] = useState<LoadState>({ catalog: null, billing: null, commercial: null, addons: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [subscriptionBucket, setSubscriptionBucket] = useState<SubscriptionBucket>("all");
  const [invoiceBucket, setInvoiceBucket] = useState<InvoiceBucket>("all");
  const [webhookBucket, setWebhookBucket] = useState<WebhookBucket>("all");
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const usageSectionRef = useRef<HTMLDivElement>(null);

  const hasActiveFilter = planFilter !== "all" || usageFilter !== "all";

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
          setError("Veriler yuklenirken bir hata olustu.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="pkg-tab">
        <PageHeader eyebrow="Ticari" title="Paket ve Kullanim" sub="Yukleniyor…" />
        <div className="pkg-loading">Veriler yukleniyor…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pkg-tab">
        <PageHeader eyebrow="Ticari" title="Paket ve Kullanim" />
        <div className="pkg-error">{error}</div>
      </div>
    );
  }

  const plans = data.catalog?.catalog.plans ?? [];
  const tenantUsage = data.catalog?.tenant_usage ?? [];
  const subscriptions = data.billing?.subscriptions ?? [];
  const invoices = data.billing?.invoices ?? [];
  const webhooks = data.billing?.recent_webhook_events ?? [];

  // ── Plan + usage filtering ──────────────────────────────
  const filteredTenantUsage = tenantUsage.filter((tu) => {
    if (planFilter !== "all" && tu.plan_code !== planFilter) return false;
    if (usageFilter === "breach") {
      // "Limit Baskisi": tenants at or over their limit
      const atLimit = tu.metrics.some(
        (m) => m.limit != null && m.limit > 0 && m.used >= m.limit,
      );
      if (!atLimit) return false;
    } else if (usageFilter === "pressure") {
      // "Tum Riskler": tenants that have any limit defined
      const hasLimit = tu.metrics.some((m) => m.limit != null && m.limit > 0);
      if (!hasLimit) return false;
    }
    return true;
  });

  // ── Subscription filtering ──────────────────────────────
  const filteredSubscriptions = subscriptions.filter((s) => {
    if (subscriptionBucket === "all") return true;
    return getSubscriptionBucket(s.status) === subscriptionBucket;
  });

  // ── Invoice filtering ───────────────────────────────────
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceBucket === "all") return true;
    return getInvoiceBucket(inv.status) === invoiceBucket;
  });

  // ── Webhook filtering ───────────────────────────────────
  const filteredWebhooks = webhooks.filter((w) => {
    if (webhookBucket === "all") return true;
    return getWebhookBucket(w.processing_status) === webhookBucket;
  });

  // ── Risk metrics ────────────────────────────────────────
  const atLimitUsage = tenantUsage.filter((tu) =>
    tu.metrics.some((m) => m.limit != null && m.limit > 0 && m.used >= m.limit),
  );
  const highestUsage = tenantUsage.reduce<{ name: string; pct: number } | null>((best, tu) => {
    for (const m of tu.metrics) {
      if (m.limit != null && m.limit > 0) {
        const pct = Math.round((m.used / m.limit) * 100);
        if (!best || pct > best.pct) return { name: tu.tenant_name, pct };
      }
    }
    return best;
  }, null);

  const clearFilters = () => {
    setPlanFilter("all");
    setUsageFilter("all");
  };

  const handleRetry = async (eventId: number) => {
    setRetryingId(eventId);
    try {
      await retryBillingWebhookEvent(eventId);
      const billing = await getBillingOverview();
      setData((prev) => ({ ...prev, billing }));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="pkg-tab">
      <PageHeader
        eyebrow="Ticari"
        title="Paket ve Kullanim"
        sub="Abonelikler, faturalar, webhook'lar ve ticari talepler"
      />

      {/* ── Focus banner ────────────────────────────────────── */}
      {hasActiveFilter && (
        <div data-testid="admin-focus-banner-packages" className="pkg-focus-banner">
          <div className="pkg-focus-banner__content">
            <div className="pkg-focus-banner__title">
              Paket filtresi aktif: {planFilter !== "all" ? planFilter : usageFilter}
            </div>
            <span className="pkg-focus-banner__chip">
              Kaynak: Paketler Filtresi
            </span>
          </div>
          <div className="pkg-focus-banner__actions">
            <button
              type="button"
              className="pkg-focus-banner__action"
              onClick={() => usageSectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })}
            >
              Odak Kartina Git
            </button>
            <button
              type="button"
              className="pkg-focus-banner__action pkg-focus-banner__action--muted"
              onClick={clearFilters}
            >
              Filtreyi Temizle
            </button>
          </div>
        </div>
      )}

      {/* ── KPI ─────────────────────────────────────────────── */}
      <div className="kpi-grid kpi-grid--4">
        <StatCard label="Plan Sayisi" value={plans.length} accent="blue" sub="katalogdaki toplam" />
        <StatCard label="Aktif Abonelik" value={subscriptions.filter((s) => s.status === "active").length} accent="green" sub={`/ ${subscriptions.length} toplam`} />
        <StatCard label="Bekleyen Fatura" value={invoices.filter((i) => ["open", "past_due", "unpaid", "uncollectible"].includes(i.status)).length} accent="warn" sub="acik veya gecikmiş" />
        <StatCard label="Risk" value={atLimitUsage.length} accent={atLimitUsage.length > 0 ? "warn" : "default"} sub="limit asimi" />
      </div>

      {/* ── Paket ve Modul Matrisi ───────────────────────────── */}
      <Section title="Paket ve Modul Matrisi" sub={`${plans.length} plan`}>
        <div className="pkg-plan-filter-row">
          <button
            type="button"
            className={`pkg-filter-btn ${planFilter === "all" && usageFilter === "all" ? "pkg-filter-btn--active" : ""}`}
            onClick={clearFilters}
          >
            Tum Planlar
          </button>
          {plans.map((plan) => (
            <button
              key={plan.code}
              type="button"
              className={`pkg-filter-btn ${planFilter === plan.code ? "pkg-filter-btn--active" : ""}`}
              onClick={() => { setPlanFilter(plan.code); setUsageFilter("all"); }}
            >
              {plan.name}
            </button>
          ))}
          <button
            type="button"
            className={`pkg-filter-btn ${usageFilter === "breach" ? "pkg-filter-btn--active" : ""}`}
            onClick={() => { setUsageFilter("breach"); setPlanFilter("all"); }}
          >
            Limit Baskisi
          </button>
          <button
            type="button"
            className={`pkg-filter-btn ${usageFilter === "pressure" ? "pkg-filter-btn--active" : ""}`}
            onClick={() => { setUsageFilter("pressure"); setPlanFilter("all"); }}
          >
            Tum Riskler
          </button>
        </div>

        <div className="pkg-plan-grid">
          {plans.map((plan) => (
            <div key={plan.code} className="pkg-plan-card">
              <div className="pkg-plan-card__head">
                <div>
                  <div className="pkg-plan-card__name">{plan.name}</div>
                  <div className="pkg-plan-card__code">{plan.code}</div>
                </div>
                {plan.is_default && (
                  <span className="pkg-badge pkg-badge--active">Varsayilan Plan</span>
                )}
              </div>
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
      </Section>

      {/* ── Stratejik Partner Bazli Kullanim Sayaçlari ─────── */}
      <Section title="Stratejik Partner Bazli Kullanim Sayaçlari" sub={`${filteredTenantUsage.length} stratejik partner`}>
        <div ref={usageSectionRef} className="pkg-usage-table">
          {filteredTenantUsage.length === 0 ? (
            <div className="pkg-empty">Bu filtre icin kullanim verisi bulunamadi.</div>
          ) : (
            filteredTenantUsage.map((tu) => (
              <div key={tu.tenant_id} className="pkg-usage-row">
                <div className="pkg-usage-row__head">
                  <div className="pkg-usage-row__name">{tu.tenant_name}</div>
                  <span className="pkg-plan-tag">{tu.plan_name}</span>
                </div>
                {tu.metrics.map((m) => (
                  <div key={m.key} className="pkg-usage-row__metric">
                    <span className="pkg-usage-row__metric-label">{m.label}</span>
                    {m.limit != null ? (
                      <span className="pkg-usage-row__metric-val">{m.used} / {m.limit}</span>
                    ) : (
                      <span className="pkg-usage-row__metric-val">{m.used}</span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </Section>

      {/* ── Riskteki Stratejik Partner ──────────────────────── */}
      <Section title="Riskteki Stratejik Partner" sub="Limit doluluk analizi">
        {atLimitUsage.length === 0 ? (
          <div className="pkg-empty">Risk alti stratejik partner bulunamadi.</div>
        ) : (
          <div className="pkg-risk-grid">
            <div className="pkg-risk-card">
              <div className="pkg-risk-card__label">En Yuksek Doluluk</div>
              {highestUsage && highestUsage.pct >= 100 && (
                <div className="pkg-risk-card__badge">100% Doluluk</div>
              )}
            </div>
            {atLimitUsage.map((tu) => (
              <div key={tu.tenant_id} className="pkg-risk-card pkg-risk-card--at-limit">
                {tu.metrics
                  .filter((m) => m.limit != null && m.limit > 0 && m.used >= m.limit)
                  .map((m) => (
                    <div key={m.key} className="pkg-risk-card__metric">
                      {m.label}: {m.used}/{m.limit} — Limit asimi
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Billing Operasyonlari ───────────────────────────── */}
      <Section title="Billing Operasyonlari" sub="Abonelikler, faturalar ve webhook olaylari">

        {/* Subscription filters */}
        <div className="pkg-filter-row">
          {(["all", "active", "trialing", "other"] as const).map((bucket) => (
            <button
              key={bucket}
              type="button"
              className={`pkg-filter-btn pkg-filter-btn--sm ${subscriptionBucket === bucket ? "pkg-filter-btn--active" : ""}`}
              onClick={() => setSubscriptionBucket(bucket)}
            >
              {bucket === "all" ? "Tum Abonelikler" : bucket === "active" ? "Aktif" : bucket === "trialing" ? "Deneme" : "Diger"}
            </button>
          ))}
        </div>

        <div className="pkg-sub-list">
          {filteredSubscriptions.length === 0 ? (
            <div className="pkg-empty">Bu filtre icin abonelik bulunamadi.</div>
          ) : (
            filteredSubscriptions.map((sub) => (
              <div key={sub.id} className="pkg-sub-card">
                <div className="pkg-sub-card__head">
                  <span className="pkg-sub-card__plan">{sub.subscription_plan_code}</span>
                  <span className="pkg-sub-card__status">{sub.status}</span>
                </div>
                <div className="pkg-sub-card__meta">
                  <span>seat: {sub.seats_purchased}</span>
                  <span>{sub.billing_provider}</span>
                  <span>{fmt(sub.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Invoice filters */}
        <div className="pkg-filter-row">
          {(["all", "open", "paid"] as const).map((bucket) => (
            <button
              key={bucket}
              type="button"
              className={`pkg-filter-btn pkg-filter-btn--sm ${invoiceBucket === bucket ? "pkg-filter-btn--active" : ""}`}
              onClick={() => setInvoiceBucket(bucket)}
            >
              {bucket === "all" ? "Tum Faturalar" : bucket === "open" ? "Acik" : "Odendi"}
            </button>
          ))}
        </div>

        <div className="pkg-invoice-list">
          {filteredInvoices.length === 0 ? (
            <div className="pkg-empty">Bu filtre icin fatura bulunamadi.</div>
          ) : (
            filteredInvoices.map((inv) => (
              <div key={inv.id} className="pkg-invoice-card">
                <span className="pkg-invoice-card__num">{inv.invoice_number}</span>
                <span className="pkg-invoice-card__status">{inv.status}</span>
                <span className="pkg-invoice-card__amount">{inv.total_amount} {inv.currency}</span>
              </div>
            ))
          )}
        </div>

        {/* Webhook filters */}
        <div className="pkg-filter-row">
          {(["all", "processed", "failed"] as const).map((bucket) => (
            <button
              key={bucket}
              type="button"
              className={`pkg-filter-btn pkg-filter-btn--sm ${webhookBucket === bucket ? "pkg-filter-btn--active" : ""}`}
              onClick={() => setWebhookBucket(bucket)}
            >
              {bucket === "all" ? "Tum Olaylar" : bucket === "processed" ? "Islendi" : "Hatali"}
            </button>
          ))}
        </div>

        <div className="pkg-webhook-list">
          {filteredWebhooks.length === 0 ? (
            <div className="pkg-empty">Henuz webhook olayi alinmadi.</div>
          ) : (
            filteredWebhooks.map((w) => (
              <div key={w.id} className="pkg-webhook-card">
                <div className="pkg-webhook-card__head">
                  <span className="pkg-webhook-card__type">{w.event_type}</span>
                  <span className="pkg-webhook-card__status">{w.processing_status}</span>
                </div>
                {w.error_message && (
                  <div className="pkg-webhook-card__error">{w.error_message}</div>
                )}
                {w.processing_status === "failed" && (
                  <button
                    type="button"
                    disabled={retryingId === w.id}
                    onClick={() => handleRetry(w.id)}
                    className="pkg-filter-btn pkg-filter-btn--sm"
                  >
                    {retryingId === w.id ? "Isleniyor…" : "Yeniden Isle"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

export default PackagesTab;
