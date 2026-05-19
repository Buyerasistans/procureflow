import { useRef } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { SubscriptionCatalogSnapshot, BillingOverview, CommercialRequestItem, CommercialRequestWebhookSettings, CommercialRequestWebhookDelivery, SubscriptionAddonAdminItem } from "../../services/admin.service";
import type { AdminFocusBannerTone, AdminTabKey } from "./adminPageMeta";
import PremiumFeaturePurchasePanel from "../../components/PremiumFeaturePurchasePanel";

type PackageUsageSummary = {
  atRiskTenants: number;
  breachedTenants: number;
  highestUtilization: number;
};

type PackagePlanSummary = {
  all: number;
  counts: Record<string, number>;
};

type BillingSummary = {
  openInvoices: number;
  totalOutstanding: number;
  subscriptionStatusCounts: {
    all: number;
    active: number;
    trialing: number;
    other: number;
  };
  invoiceStatusCounts: {
    all: number;
    open: number;
    paid: number;
    other: number;
  };
};

type BillingInvoiceStatusBucket = "paid" | "open" | "other";

type PackagesTabProps = {
  // Focus & render
  activePackageFocusSummary: string[];
  renderAdminFocusBanner: (options: {
    eyebrow: string;
    title: string;
    detail: string;
    tone: AdminFocusBannerTone;
    sourceLabel?: string;
    timestamp?: number | null;
    actions?: Array<{ label: string; onClick?: () => void; href?: string }>;
    testId?: string;
  }) => ReactNode;
  navigateAdminTab: (tab: AdminTabKey, params?: Record<string, string>) => void;
  jumpToPackageFocusTarget: () => void;

  // Subscription catalog & pricing
  subscriptionCatalog: SubscriptionCatalogSnapshot | null;
  strategicAddonCatalog: Array<{
    code: string;
    name: string;
    price_monthly?: number;
    currency?: string;
  }>;

  // Package usage data & summary
  packageUsageSummary: PackageUsageSummary;
  packagePlanSummary: PackagePlanSummary;
  visiblePackageUsageRows: Array<any>;
  packageUsageRowRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  packagePlanRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;

  // Package filter state
  packagePlanFilter: string;
  setPackagePlanFilter: Dispatch<SetStateAction<string>>;
  packageRiskFilter: "all" | "pressure" | "breach";
  setPackageRiskFilter: Dispatch<SetStateAction<"all" | "pressure" | "breach">>;

  // Commercial request state
  commercialRequests: CommercialRequestItem[];
  filteredCommercialRequests: CommercialRequestItem[];
  commercialRequestSummary: {
    all: number;
    new: number;
    contacted: number;
    qualified: number;
    won: number;
    lost: number;
  };
  commercialRequestStatusFilter: "all" | "new" | "contacted" | "qualified" | "won" | "lost";
  setCommercialRequestStatusFilter: Dispatch<SetStateAction<"all" | "new" | "contacted" | "qualified" | "won" | "lost">>;
  commercialRequestOwnerFilter: string;
  setCommercialRequestOwnerFilter: Dispatch<SetStateAction<string>>;
  commercialRequestOwnerOptions: string[];
  commercialRequestUpdatingId: number | null;
  handleAssignCommercialRequest: (requestId: number) => Promise<void>;
  handleCommercialRequestStatusUpdate: (requestId: number, status: "contacted" | "qualified" | "won" | "lost", options?: { ownerName?: string; markContactedNow?: boolean }) => Promise<void>;

  // Subscription addon state
  subscriptionAddons: SubscriptionAddonAdminItem[];
  filteredSubscriptionAddons: SubscriptionAddonAdminItem[];
  subscriptionAddonStatusFilter: "all" | "active" | "cancelled" | "expired";
  setSubscriptionAddonStatusFilter: Dispatch<SetStateAction<"all" | "active" | "cancelled" | "expired">>;
  subscriptionAddonTenantFilter: string;
  setSubscriptionAddonTenantFilter: Dispatch<SetStateAction<string>>;
  subscriptionAddonTenantOptions: string[];
  subscriptionAddonExpiryDrafts: Record<number, string>;
  setSubscriptionAddonExpiryDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  subscriptionAddonUpdatingId: number | null;
  handleSubscriptionAddonLifecycle: (addonId: number, action: any) => Promise<void>;

  // Commercial request webhook state
  commercialRequestWebhookSettings: CommercialRequestWebhookSettings | null;
  commercialRequestWebhookDraft: { webhook_url: string; webhook_secret: string };
  setCommercialRequestWebhookDraft: Dispatch<SetStateAction<{ webhook_url: string; webhook_secret: string }>>;
  commercialRequestWebhookSaving: boolean;
  handleSaveCommercialRequestWebhookSettings: () => Promise<void>;
  handleClearCommercialRequestWebhookSecret: () => Promise<void>;

  // Webhook delivery state
  visibleCommercialRequestWebhookDeliveries: CommercialRequestWebhookDelivery[];
  commercialRequestWebhookDeliveryFilter: "all" | "delivered" | "failed" | "other";
  setCommercialRequestWebhookDeliveryFilter: Dispatch<SetStateAction<"all" | "delivered" | "failed" | "other">>;
  selectedCommercialRequestWebhookDeliveryId: number | null;
  setSelectedCommercialRequestWebhookDeliveryId: Dispatch<SetStateAction<number | null>>;
  selectedCommercialRequestWebhookDelivery: CommercialRequestWebhookDelivery | null;
  commercialRequestWebhookRetryingId: number | null;
  handleRetryCommercialRequestWebhookDelivery: (deliveryId: number) => Promise<void>;

  // Billing data
  billingOverview: BillingOverview | null;
  billingSummary: BillingSummary;

  // Billing subscription state
  visibleBillingSubscriptions: Array<any>;
  billingSubscriptionFilter: "all" | "active" | "trialing" | "other";
  setBillingSubscriptionFilter: Dispatch<SetStateAction<"all" | "active" | "trialing" | "other">>;

  // Billing invoice state
  visibleBillingInvoices: Array<any>;
  billingInvoiceFilter: "all" | "open" | "paid" | "other";
  setBillingInvoiceFilter: Dispatch<SetStateAction<"all" | "open" | "paid" | "other">>;
  getBillingInvoiceStatusMeta: (status: string | null | undefined) => { bucket: BillingInvoiceStatusBucket; label: string };

  // Billing webhook state
  visibleBillingWebhooks: Array<any>;
  billingWebhookFilter: "all" | "processed" | "failed" | "other";
  setBillingWebhookFilter: Dispatch<SetStateAction<"all" | "processed" | "failed" | "other">>;
  billingWebhookRetryingEventId: number | null;
  handleRetryBillingWebhookEvent: (eventId: number) => Promise<void>;

  // User context
  user: { full_name?: string; email?: string } | null;
};

export function PackagesTab(props: PackagesTabProps) {
  const packageUsageRowsForDisplay = props.visiblePackageUsageRows.length > 0
    ? props.visiblePackageUsageRows
    : (props.packagePlanFilter === "all" && props.packageRiskFilter === "all"
      ? (props.subscriptionCatalog?.tenant_usage || [])
      : []);

  const latestFailedBillingWebhook = props.billingOverview?.recent_webhook_events.find(
    (event) => event.processing_status === "failed",
  ) || null;

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {props.activePackageFocusSummary.length > 0 ? props.renderAdminFocusBanner({
        eyebrow: "Filter Focus",
        title: `Paket odagi: ${props.activePackageFocusSummary.join(" ○ ")}`,
        detail: "Paket katalogu ve kullanim tablolari secili plan ve risk odagina gore daraltildi.",
        tone: "violet",
        sourceLabel: "Paketler filtresi",
        timestamp: Date.now(),
        actions: [
          { label: "Stratejik Partner Yonetimine Git", onClick: () => props.navigateAdminTab("tenant_governance") },
          { label: "Odak Kartina Git", onClick: props.jumpToPackageFocusTarget },
          { label: "Filtreyi Temizle", onClick: () => {
            props.setPackagePlanFilter("all");
            props.setPackageRiskFilter("all");
          } },
        ],
        testId: "admin-focus-banner-packages",
      }) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {[
          { label: "Plan Sayisi", value: props.subscriptionCatalog?.catalog.plans.length || 0, note: "Aktif katalog plani", color: "#2563eb" },
          { label: "Modul Sayisi", value: props.subscriptionCatalog?.catalog.plans.reduce((sum, plan) => sum + plan.modules.length, 0) || 0, note: "Tum planlara dagilan modul", color: "#7c3aed" },
          { label: "Varsayilan Plan", value: props.subscriptionCatalog?.catalog.plans.find((plan) => plan.is_default)?.name || "-", note: "Yeni Stratejik Partner icin acilan plan", color: "#059669" },
          { label: "Stratejik Partner Kullanim Satiri", value: props.subscriptionCatalog?.tenant_usage.length || 0, note: "Canli limit izleme satiri", color: "#b45309" },
          { label: "Riskteki Stratejik Partner", value: props.packageUsageSummary.atRiskTenants, note: `${props.packageUsageSummary.breachedTenants} Stratejik Partner limit asiminda`, color: "#dc2626" },
          { label: "En Yuksek Doluluk", value: `%${props.packageUsageSummary.highestUtilization}`, note: "Tum Stratejik Partner metriklerinde gorulen tepe oran", color: "#0f766e" },
          { label: "Aktif Abonelik", value: props.billingOverview?.subscriptions.filter((item) => item.status === "active").length || 0, note: `${props.billingOverview?.recent_webhook_events.length || 0} webhook olayi`, color: "#1d4ed8" },
          { label: "Acik Fatura", value: props.billingSummary.openInvoices, note: `${props.billingSummary.totalOutstanding.toLocaleString("tr-TR")} TRY bekleyen tahsilat`, color: "#b45309" },
        ].map((card) => (
          <div key={card.label} style={{ borderRadius: 20, background: "white", border: "1px solid #e5e7eb", padding: 18, boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
            <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{card.note}</div>
          </div>
        ))}
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Plan Katalogu</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Paket ve modul matrisi</div>
          <div style={{ marginTop: 8, color: "#64748b" }}>Bu alan artik hem plan katalogunu hem de Stratejik Partner bazli canli kullanim sayaclarini birlikte gosterir.</div>
        </div>
        <div style={{ borderRadius: 16, background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)", border: "1px solid #bfdbfe", padding: "14px 16px", display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#1d4ed8" }}>Entitlement Kurali</div>
          <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
            Paketler sadece limit tablosu degildir. Teklif listeleme kapsami, platform supplier agina acilma, ozel listeleme ve kampanya ile one cikma haklari da bu katalog ve premium feature aktivasyonlari ile birlikte degerlendirilmelidir.
          </div>
          <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
            Hedef modelde bir RFQ kaydi; hangi planin limitiyle acildigini, premium ozellik satin alimi olup olmadigini ve supplier tarafinda hangi vitrinde gorunecegini ayni entitlement omurgasindan okumali.
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {(props.subscriptionCatalog?.catalog.plans || []).map((plan) => (
            <div key={plan.code} ref={(node) => { props.packagePlanRefs.current[plan.code] = node; }} data-testid={`package-plan-card-${plan.code}`} style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: plan.is_default ? "#eff6ff" : "#f8fafc", padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{plan.name}</div>
                  <div style={{ marginTop: 6, color: "#475569" }}>{plan.description}</div>
                </div>
                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                  <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: plan.is_default ? "#dbeafe" : "#e2e8f0", color: plan.is_default ? "#1d4ed8" : "#334155", fontWeight: 700, fontSize: 12 }}>
                    {plan.is_default ? "Varsayilan Plan" : plan.code}
                  </span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{plan.audience}</span>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {plan.modules.map((module) => (
                  <div key={module.code} style={{ borderRadius: 16, background: "white", border: "1px solid #dbe3ee", padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>{module.name}</div>
                      <span style={{ color: module.enabled ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                        {module.enabled ? "Acilik".replace("Acilik", "Acik") : "Kapali"}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{module.description}</div>
                    {module.limit_key ? (
                      <div style={{ marginTop: 10, fontSize: 12, color: "#334155" }}>
                        {module.unit === "flag"
                          ? `Policy: ${Number(module.limit_value || 0) > 0 ? "Acik" : "Kapali"} ○ ${module.limit_key}`
                          : `Limit: ${module.limit_value} ${module.unit || "adet"} ○ ${module.limit_key}`}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <PremiumFeaturePurchasePanel
          tenants={(props.subscriptionCatalog?.tenant_usage || []).map((tenantUsage) => ({
            id: tenantUsage.tenant_id,
            name: tenantUsage.tenant_name,
            contactEmail: undefined,
          }))}
          defaultTenantId={props.visiblePackageUsageRows[0]?.tenant_id || null}
          buyerName={props.user?.full_name || props.user?.email || "Platform Ops"}
          buyerEmail={props.user?.email || "platform@procureflow.dev"}
          allowAdminVerification
          addonCatalog={props.strategicAddonCatalog}
        />
        <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #fffaf0 0%, #ffffff 50%, #f8fafc 100%)", padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#b45309" }}>Ticari Talep Kuyrugu</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Paket ve add-on talep takibi</div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
              Public paket ve ek hak akislarindan gelen talepler burada takip edilir. Durumu ilerlettiginizde ticari operasyon kuyru ğu tek yerden gorunur.
            </div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { key: "all", label: "Tum Talepler", value: props.commercialRequestSummary.all, color: "#0f172a" },
                { key: "new", label: "Yeni", value: props.commercialRequestSummary.new, color: "#b45309" },
                { key: "contacted", label: "Temas", value: props.commercialRequestSummary.contacted, color: "#2563eb" },
                { key: "qualified", label: "Nitelikli", value: props.commercialRequestSummary.qualified, color: "#7c3aed" },
                { key: "won", label: "Kazanildi", value: props.commercialRequestSummary.won, color: "#059669" },
                { key: "lost", label: "Kaybedildi", value: props.commercialRequestSummary.lost, color: "#dc2626" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.setCommercialRequestStatusFilter(item.key as "all" | "new" | "contacted" | "qualified" | "won" | "lost")}
                  style={{ borderRadius: 14, border: props.commercialRequestStatusFilter === item.key ? `2px solid ${item.color}` : "1px solid #e5e7eb", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={props.commercialRequestOwnerFilter} onChange={(event) => props.setCommercialRequestOwnerFilter(event.target.value)} style={{ minWidth: 220, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                <option value="all">Tum owner'lar</option>
                <option value="__unassigned__">Atanmamis talepler</option>
                {props.commercialRequestOwnerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              </select>
              {(props.commercialRequestStatusFilter !== "all" || props.commercialRequestOwnerFilter !== "all") ? (
                <button type="button" onClick={() => { props.setCommercialRequestStatusFilter("all"); props.setCommercialRequestOwnerFilter("all"); }} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>
                  Filtreleri Temizle
                </button>
              ) : null}
            </div>
            {(props.filteredCommercialRequests.length > 0 ? props.filteredCommercialRequests : []).slice(0, 16).map((request) => (
              <div key={request.id} style={{ borderRadius: 16, border: "1px solid #f1f5f9", background: "#fff", padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{request.company_name || request.requester_name}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{request.requester_email} ○ {request.request_type === "addon_purchase" ? (request.addon_name || request.addon_code || "Add-on") : request.request_type === "package_upgrade" ? (request.package_name || request.package_code || "Paket") : "Genel demo"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>Owner: {request.owner_name || "Atanmamis"} ○ Son temas: {request.last_contacted_at ? new Date(request.last_contacted_at).toLocaleString("tr-TR") : "-"}</div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: request.status === "new" ? "#fef3c7" : request.status === "won" ? "#dcfce7" : "#e2e8f0", color: request.status === "new" ? "#92400e" : request.status === "won" ? "#166534" : "#334155", fontSize: 12, fontWeight: 800 }}>
                    {request.status}
                  </span>
                </div>
                <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{request.notes || "Ek not girilmemis."}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void props.handleAssignCommercialRequest(request.id)}
                    disabled={props.commercialRequestUpdatingId === request.id}
                    style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontWeight: 700, padding: "8px 10px", cursor: props.commercialRequestUpdatingId === request.id ? "wait" : "pointer", fontSize: 12 }}
                  >
                    Bana Ata
                  </button>
                  {(["contacted", "qualified", "won", "lost"] as const).map((statusKey) => (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => void props.handleCommercialRequestStatusUpdate(request.id, statusKey, { markContactedNow: statusKey === "contacted" })}
                      disabled={props.commercialRequestUpdatingId === request.id || request.status === statusKey}
                      style={{ borderRadius: 10, border: request.status === statusKey ? "1px solid #94a3b8" : "1px solid #cbd5e1", background: request.status === statusKey ? "#f8fafc" : "#fff", color: "#334155", fontWeight: 700, padding: "8px 10px", cursor: props.commercialRequestUpdatingId === request.id ? "wait" : "pointer", fontSize: 12 }}
                    >
                      {statusKey}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {props.commercialRequests.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz kayitli ticari talep yok.</div> : null}
            {props.commercialRequests.length > 0 && props.filteredCommercialRequests.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Secili filtrelerle eslesen ticari talep bulunamadi.</div> : null}
          </div>
        </div>
        <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #fffaf0 100%)", padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0f766e" }}>Add-on Yasam Dongusu</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Yenileme, iptal ve bitis tarihi yonetimi</div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
              Satin alinmis kapasite add-on'larinin bitis tarihini uzatabilir, belirli bir tarihe cekebilir veya hemen iptal edebilirsiniz.
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={props.subscriptionAddonStatusFilter} onChange={(event) => props.setSubscriptionAddonStatusFilter(event.target.value as "all" | "active" | "cancelled" | "expired")} style={{ minWidth: 180, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                <option value="all">Tum durumlar</option>
                <option value="active">Aktif</option>
                <option value="cancelled">Iptal</option>
                <option value="expired">Suresi dolan</option>
              </select>
              <select value={props.subscriptionAddonTenantFilter} onChange={(event) => props.setSubscriptionAddonTenantFilter(event.target.value)} style={{ minWidth: 220, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                <option value="all">Tum tenant'lar</option>
                {props.subscriptionAddonTenantOptions.map((tenantName) => <option key={tenantName} value={tenantName} aria-label={tenantName}>{tenantName.slice(0, 2)}...</option>)}
              </select>
              {(props.subscriptionAddonStatusFilter !== "all" || props.subscriptionAddonTenantFilter !== "all") ? <button type="button" onClick={() => { props.setSubscriptionAddonStatusFilter("all"); props.setSubscriptionAddonTenantFilter("all"); }} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", padding: "10px 12px", fontWeight: 700, cursor: "pointer" }}>Filtreleri Temizle</button> : null}
            </div>
            {props.filteredSubscriptionAddons.slice(0, 16).map((addon) => (
              <div key={addon.id} style={{ borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{addon.addon_name || addon.addon_code}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{addon.tenant_name || `Tenant #${addon.tenant_id}`} ○ +{addon.total_increment} ○ {addon.limit_key}</div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 10px", background: addon.status === "active" ? "#dcfce7" : addon.status === "cancelled" ? "#fee2e2" : "#e2e8f0", color: addon.status === "active" ? "#166534" : addon.status === "cancelled" ? "#b91c1c" : "#334155", fontSize: 12, fontWeight: 800 }}>{addon.status}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>Bitis tarihi: {addon.expires_at ? new Date(addon.expires_at).toLocaleDateString("tr-TR") : "Tanimsiz"}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={() => void props.handleSubscriptionAddonLifecycle(addon.id, { action: "renew", extension_days: 30 })} disabled={props.subscriptionAddonUpdatingId === addon.id} style={{ borderRadius: 10, border: "1px solid #bae6fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, padding: "8px 10px", cursor: props.subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                    30 Gun Uzat
                  </button>
                  <button type="button" onClick={() => void props.handleSubscriptionAddonLifecycle(addon.id, { action: addon.status === "active" ? "cancel" : "reactivate" })} disabled={props.subscriptionAddonUpdatingId === addon.id} style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, padding: "8px 10px", cursor: props.subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                    {addon.status === "active" ? "Hemen Iptal" : "Yeniden Aktif Et"}
                  </button>
                  <input type="date" value={props.subscriptionAddonExpiryDrafts[addon.id] || ""} onChange={(event) => props.setSubscriptionAddonExpiryDrafts((current) => ({ ...current, [addon.id]: event.target.value }))} style={{ borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 10px", background: "#fff" }} />
                  <button type="button" onClick={() => void props.handleSubscriptionAddonLifecycle(addon.id, { action: "set_expiry", expires_at: props.subscriptionAddonExpiryDrafts[addon.id] ? `${props.subscriptionAddonExpiryDrafts[addon.id]}T23:59:59` : undefined })} disabled={props.subscriptionAddonUpdatingId === addon.id || !props.subscriptionAddonExpiryDrafts[addon.id]} style={{ borderRadius: 10, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 700, padding: "8px 10px", cursor: props.subscriptionAddonUpdatingId === addon.id ? "wait" : "pointer", fontSize: 12 }}>
                    Bitis Tarihini Kaydet
                  </button>
                </div>
              </div>
            ))}
            {props.subscriptionAddons.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz satin alinmis subscription add-on kaydi yok.</div> : null}
            {props.subscriptionAddons.length > 0 && props.filteredSubscriptionAddons.length === 0 ? <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Secili filtrelerle eslesen add-on kaydi yok.</div> : null}
          </div>
        </div>
        <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 48%, #f8fafc 100%)", padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0369a1" }}>Ticari Webhook Ayari</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>CRM / ticket webhook hedefi</div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
              Yeni ve guncellenen ticari talepleri dis sisteme iletmek icin webhook URL ve gizli anahtar tanimlayin.
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={props.commercialRequestWebhookDraft.webhook_url} onChange={(event) => props.setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_url: event.target.value }))} placeholder="https://crm.example.com/hooks/procureflow" style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }} />
            <input value={props.commercialRequestWebhookDraft.webhook_secret} onChange={(event) => props.setCommercialRequestWebhookDraft((current) => ({ ...current, webhook_secret: event.target.value }))} placeholder={props.commercialRequestWebhookSettings?.has_webhook_secret ? "Mevcut secret korunur, degistirmek icin yeni deger girin" : "Webhook secret (opsiyonel)"} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }} />
            <div style={{ color: "#64748b", fontSize: 12 }}>Mevcut durum: {props.commercialRequestWebhookSettings?.webhook_url ? props.commercialRequestWebhookSettings.webhook_url : "Webhook kapali"} ○ Secret: {props.commercialRequestWebhookSettings?.has_webhook_secret ? "Kayitli" : "Yok"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" onClick={() => void props.handleSaveCommercialRequestWebhookSettings()} disabled={props.commercialRequestWebhookSaving} style={{ borderRadius: 12, border: "none", background: props.commercialRequestWebhookSaving ? "#93c5fd" : "#0284c7", color: "#fff", fontWeight: 800, padding: "10px 16px", cursor: props.commercialRequestWebhookSaving ? "wait" : "pointer" }}>
                {props.commercialRequestWebhookSaving ? "Webhook Ayari Kaydediliyor..." : "Webhook Ayarini Kaydet"}
              </button>
              <button type="button" onClick={() => void props.handleClearCommercialRequestWebhookSecret()} disabled={props.commercialRequestWebhookSaving || !props.commercialRequestWebhookSettings?.has_webhook_secret} style={{ borderRadius: 12, border: "1px solid #cbd5e1", background: props.commercialRequestWebhookSaving || !props.commercialRequestWebhookSettings?.has_webhook_secret ? "#e2e8f0" : "#fff", color: "#0f172a", fontWeight: 700, padding: "10px 16px", cursor: props.commercialRequestWebhookSaving || !props.commercialRequestWebhookSettings?.has_webhook_secret ? "not-allowed" : "pointer" }}>
                Secreti Temizle
              </button>
            </div>
          </div>
        </div>
        <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #fefce8 100%)", padding: 18, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#a16207" }}>Ticari Webhook Teslimati</div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Son dispatch denemeleri ve manuel retry</div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
              Ticari talep create ve update olaylarinin webhook teslimatlari burada izlenir. Basarisiz denemeler ayni kayit uzerinden yeniden tetiklenebilir.
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { key: "all", label: "Tum Teslimatlar", value: props.visibleCommercialRequestWebhookDeliveries.length || 0, color: "#0f172a" },
                { key: "delivered", label: "Teslim", value: props.visibleCommercialRequestWebhookDeliveries.filter((d) => d.delivery_status === "delivered").length, color: "#15803d" },
                { key: "failed", label: "Basarisiz", value: props.visibleCommercialRequestWebhookDeliveries.filter((d) => d.delivery_status === "failed").length, color: "#b91c1c" },
                { key: "other", label: "Belirsiz", value: props.visibleCommercialRequestWebhookDeliveries.filter((d) => d.delivery_status !== "delivered" && d.delivery_status !== "failed").length, color: "#475569" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.setCommercialRequestWebhookDeliveryFilter(item.key as "all" | "delivered" | "failed" | "other")}
                  style={{ borderRadius: 14, border: props.commercialRequestWebhookDeliveryFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                </button>
              ))}
            </div>
            {props.visibleCommercialRequestWebhookDeliveries.length === 0 ? (
              <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#fff", padding: 18, color: "#64748b", fontSize: 13 }}>Henuz kayitli ticari webhook teslim denemesi yok.</div>
            ) : (
              props.visibleCommercialRequestWebhookDeliveries.slice(0, 8).map((delivery) => (
                <div key={delivery.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{delivery.event_type}</div>
                    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: delivery.delivery_status === "delivered" ? "#dcfce7" : delivery.delivery_status === "failed" ? "#fee2e2" : "#e2e8f0", color: delivery.delivery_status === "delivered" ? "#166534" : delivery.delivery_status === "failed" ? "#991b1b" : "#334155", fontSize: 12, fontWeight: 700 }}>{delivery.delivery_status}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{delivery.commercial_request_company_name || delivery.commercial_request_requester_email || `Talep #${delivery.commercial_request_id || delivery.id}`}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>HTTP: {delivery.http_status_code || "-"} ○ Deneme: {delivery.attempt_count} ○ Son deneme: {delivery.last_attempted_at ? new Date(delivery.last_attempted_at).toLocaleString("tr-TR") : "-"}</div>
                  {delivery.error_message ? <div style={{ color: "#991b1b", fontSize: 12 }}>Hata: {delivery.error_message}</div> : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => props.setSelectedCommercialRequestWebhookDeliveryId(delivery.id)}
                      style={{ borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
                    >
                      Detayi Ac
                    </button>
                    {delivery.delivery_status === "failed" ? (
                      <button
                        type="button"
                        disabled={props.commercialRequestWebhookRetryingId === delivery.id}
                        onClick={() => { void props.handleRetryCommercialRequestWebhookDelivery(delivery.id); }}
                        style={{ borderRadius: 10, border: "1px solid #fca5a5", background: props.commercialRequestWebhookRetryingId === delivery.id ? "#fee2e2" : "#fff1f2", color: "#991b1b", fontWeight: 700, fontSize: 12, padding: "6px 10px", cursor: props.commercialRequestWebhookRetryingId === delivery.id ? "not-allowed" : "pointer" }}
                      >
                        {props.commercialRequestWebhookRetryingId === delivery.id ? "Yeniden Isleniyor..." : "Yeniden Isle"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {props.selectedCommercialRequestWebhookDelivery ? (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.38)", display: "flex", justifyContent: "flex-end", zIndex: 60 }}>
            <div style={{ width: "min(560px, 100vw)", height: "100%", background: "#fff", boxShadow: "-24px 0 60px rgba(15, 23, 42, 0.18)", padding: 22, display: "grid", gap: 14, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#a16207" }}>Webhook Delivery Detayi</div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{props.selectedCommercialRequestWebhookDelivery.event_type}</div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{props.selectedCommercialRequestWebhookDelivery.commercial_request_company_name || props.selectedCommercialRequestWebhookDelivery.commercial_request_requester_email || `Talep #${props.selectedCommercialRequestWebhookDelivery.commercial_request_id || props.selectedCommercialRequestWebhookDelivery.id}`}</div>
                </div>
                <button type="button" onClick={() => props.setSelectedCommercialRequestWebhookDeliveryId(null)} style={{ borderRadius: 999, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontWeight: 700, padding: "8px 12px", cursor: "pointer" }}>
                  Kapat
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>Durum</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: props.selectedCommercialRequestWebhookDelivery.delivery_status === "delivered" ? "#166534" : props.selectedCommercialRequestWebhookDelivery.delivery_status === "failed" ? "#991b1b" : "#334155" }}>{props.selectedCommercialRequestWebhookDelivery.delivery_status}</div>
                </div>
                <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>HTTP / Deneme</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{props.selectedCommercialRequestWebhookDelivery.http_status_code || "-"} ○ {props.selectedCommercialRequestWebhookDelivery.attempt_count}</div>
                </div>
              </div>
              <div style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 12, display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#64748b" }}>Meta</div>
                <div style={{ color: "#334155", fontSize: 13 }}>Hedef URL: {props.selectedCommercialRequestWebhookDelivery.target_url || "-"}</div>
                <div style={{ color: "#334155", fontSize: 13 }}>Son deneme: {props.selectedCommercialRequestWebhookDelivery.last_attempted_at ? new Date(props.selectedCommercialRequestWebhookDelivery.last_attempted_at).toLocaleString("tr-TR") : "-"}</div>
                <div style={{ color: "#334155", fontSize: 13 }}>Teslim zamani: {props.selectedCommercialRequestWebhookDelivery.delivered_at ? new Date(props.selectedCommercialRequestWebhookDelivery.delivered_at).toLocaleString("tr-TR") : "-"}</div>
                {props.selectedCommercialRequestWebhookDelivery.error_message ? <div style={{ color: "#991b1b", fontSize: 13 }}>Hata: {props.selectedCommercialRequestWebhookDelivery.error_message}</div> : null}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 700 }}>
                  Webhook Payload
                  <textarea readOnly aria-label="Webhook Payload" value={props.selectedCommercialRequestWebhookDelivery.payload_raw || "Payload kaydi yok"} style={{ minHeight: 180, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
                </label>
                <label style={{ display: "grid", gap: 6, color: "#475569", fontSize: 12, fontWeight: 700 }}>
                  Webhook Response Body
                  <textarea readOnly aria-label="Webhook Response Body" value={props.selectedCommercialRequestWebhookDelivery.response_body || "Response body kaydi yok"} style={{ minHeight: 140, borderRadius: 12, border: "1px solid #dbe3ee", padding: 12, color: "#334155", fontSize: 12, background: "#f8fafc" }} />
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Canli Limit Izleme</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Stratejik Partner bazli kullanim sayaçlari</div>
          <div style={{ marginTop: 8, color: "#64748b" }}>Proje, kullanici ve private supplier limitleri plan bazli olarak ayni ekranda izlenir.</div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {[
              { key: "all", label: "Tum Planlar", value: props.packagePlanSummary.all, color: "#0f172a" },
              ...((props.subscriptionCatalog?.catalog.plans || []).map((plan) => ({
                key: plan.code,
                label: plan.name,
                value: props.packagePlanSummary.counts[plan.code] || 0,
                color: plan.is_default ? "#1d4ed8" : "#475569",
              }))),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => props.setPackagePlanFilter(item.key)}
                style={{ borderRadius: 14, border: props.packagePlanFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {[
              { key: "all", label: "Tum Riskler", value: props.subscriptionCatalog?.tenant_usage.length || 0, color: "#0f172a" },
              { key: "pressure", label: "Limit Baskisi", value: props.packageUsageSummary.atRiskTenants, color: "#b45309" },
              { key: "breach", label: "Limit Asimi", value: props.packageUsageSummary.breachedTenants, color: "#b91c1c" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => props.setPackageRiskFilter(item.key as "all" | "pressure" | "breach")}
                style={{ borderRadius: 14, border: props.packageRiskFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
              </button>
            ))}
          </div>
          {packageUsageRowsForDisplay.length > 0 ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {packageUsageRowsForDisplay.map((tenantUsage) => (
                <div key={`usage-chip-${tenantUsage.tenant_id}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 999, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 12, fontWeight: 700 }}>
                  <span aria-label={tenantUsage.tenant_name}>{tenantUsage.tenant_name.split(" ")[0]}</span>
                  {tenantUsage.metrics[0]?.limit !== null && tenantUsage.metrics[0]?.limit !== undefined ? (
                    <span aria-label={`${tenantUsage.metrics[0]?.used} / ${tenantUsage.metrics[0]?.limit}`}>{tenantUsage.metrics[0]?.used}/{tenantUsage.metrics[0]?.limit}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {packageUsageRowsForDisplay.length === 0 ? (
            <div style={{ borderRadius: 16, border: "1px dashed #cbd5e1", background: "#f8fafc", padding: 18, color: "#64748b" }}>
              Henuz canli kullanim ozeti gosterilecek Stratejik Partner bulunmuyor.
            </div>
          ) : (
            packageUsageRowsForDisplay.map((tenantUsage) => (
              <div key={tenantUsage.tenant_id} ref={(node) => { props.packageUsageRowRefs.current[tenantUsage.tenant_id] = node; }} data-testid={`package-usage-row-${tenantUsage.tenant_id}`} style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{tenantUsage.tenant_name}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{tenantUsage.plan_name} ○ {tenantUsage.status}</div>
                  </div>
                  <span style={{ display: "inline-flex", padding: "6px 10px", borderRadius: 999, background: tenantUsage.is_active ? "#dcfce7" : "#fee2e2", color: tenantUsage.is_active ? "#166534" : "#991b1b", fontWeight: 700, fontSize: 12 }}>
                    {tenantUsage.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  {tenantUsage.metrics.map((metric: any) => {
                    const ratio = metric.limit && metric.limit > 0 ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : null;
                    const isWarning = metric.limit !== null && metric.limit !== undefined && metric.used >= metric.limit;
                    return (
                      <div key={`${tenantUsage.tenant_id}-${metric.key}`} style={{ borderRadius: 16, background: "white", border: isWarning ? "1px solid #fecaca" : "1px solid #dbe3ee", padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{metric.label}</div>
                        <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: isWarning ? "#b91c1c" : "#0f172a" }}>
                          {metric.used}
                          {metric.limit !== null && metric.limit !== undefined ? ` / ${metric.limit}` : ""}
                        </div>
                        <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                          {metric.unit || "adet"}{ratio !== null ? ` ○ ${ratio}% doluluk` : " ○ limitsiz"}
                        </div>
                        {ratio !== null ? (
                          <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${ratio}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: ratio >= 100 ? "#dc2626" : ratio >= 80 ? "#d97706" : "#2563eb",
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ borderRadius: 24, background: "white", border: "1px solid #e5e7eb", padding: 22, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)", display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: "uppercase", color: "#8a5b2b" }}>Billing Operasyonlari</div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Abonelik ve webhook akisi</div>
          <div style={{ marginTop: 8, color: "#64748b" }}>Provider tarafindan gelen subscription degisiklikleri ve son webhook olaylari bu panelde izlenir.</div>
        </div>
        {latestFailedBillingWebhook ? (
          <div style={{ borderRadius: 16, border: "1px solid #fecaca", background: "#fff1f2", padding: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 800, color: "#991b1b" }}>Basarisiz webhook olayi bulundu</div>
              <div style={{ color: "#7f1d1d", fontSize: 13 }}>{latestFailedBillingWebhook.event_type} ○ {latestFailedBillingWebhook.error_message || "isleme hatasi"}</div>
            </div>
            <button
              type="button"
              disabled={props.billingWebhookRetryingEventId === latestFailedBillingWebhook.id}
              onClick={() => { void props.handleRetryBillingWebhookEvent(latestFailedBillingWebhook.id); }}
              style={{ borderRadius: 10, border: "1px solid #fca5a5", background: props.billingWebhookRetryingEventId === latestFailedBillingWebhook.id ? "#fee2e2" : "#fff", color: "#991b1b", fontWeight: 700, fontSize: 12, padding: "8px 12px", cursor: props.billingWebhookRetryingEventId === latestFailedBillingWebhook.id ? "not-allowed" : "pointer" }}
            >
              {props.billingWebhookRetryingEventId === latestFailedBillingWebhook.id ? "Yeniden Isleniyor..." : "Yeniden Isle"}
            </button>
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Aktif Subscription Kayitlari</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { key: "all", label: "Tum Abonelikler", value: props.billingSummary.subscriptionStatusCounts.all, color: "#0f172a" },
                { key: "active", label: "Aktif", value: props.billingSummary.subscriptionStatusCounts.active, color: "#15803d" },
                { key: "trialing", label: "Deneme", value: props.billingSummary.subscriptionStatusCounts.trialing, color: "#1d4ed8" },
                { key: "other", label: "Diger", value: props.billingSummary.subscriptionStatusCounts.other, color: "#475569" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.setBillingSubscriptionFilter(item.key as "all" | "active" | "trialing" | "other")}
                  style={{ borderRadius: 14, border: props.billingSubscriptionFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                </button>
              ))}
            </div>
            {props.visibleBillingSubscriptions.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Henuz gosterilecek subscription kaydi yok.</div>
            ) : (
              props.visibleBillingSubscriptions.slice(0, 6).map((subscription) => (
                <div key={subscription.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{subscription.subscription_plan_code}</div>
                    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: subscription.status === "active" ? "#dcfce7" : "#e2e8f0", color: subscription.status === "active" ? "#166534" : "#334155", fontSize: 12, fontWeight: 700 }}>{subscription.status}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Stratejik Partner #{subscription.tenant_id} ○ {subscription.billing_cycle}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Seat: {subscription.seats_purchased} ○ Provider: {subscription.billing_provider || "-"}</div>
                </div>
              ))
            )}
          </div>
          <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Son Faturalar</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { key: "all", label: "Tum Faturalar", value: props.billingSummary.invoiceStatusCounts.all, color: "#0f172a" },
                { key: "open", label: "Acik", value: props.billingSummary.invoiceStatusCounts.open, color: "#b45309" },
                { key: "paid", label: "Odendi", value: props.billingSummary.invoiceStatusCounts.paid, color: "#15803d" },
                { key: "other", label: "Diger", value: props.billingSummary.invoiceStatusCounts.other, color: "#475569" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.setBillingInvoiceFilter(item.key as "all" | "open" | "paid" | "other")}
                  style={{ borderRadius: 14, border: props.billingInvoiceFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                </button>
              ))}
            </div>
            {props.visibleBillingInvoices.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Henuz fatura kaydi olusmadi.</div>
            ) : (
              props.visibleBillingInvoices.slice(0, 6).map((invoice) => {
                const invoiceStatusMeta = props.getBillingInvoiceStatusMeta(invoice.status);
                return (
                <div key={invoice.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{invoice.invoice_number || invoice.provider_invoice_id || `Invoice #${invoice.id}`}</div>
                    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: invoiceStatusMeta.bucket === "paid" ? "#dcfce7" : invoiceStatusMeta.bucket === "open" ? "#fef3c7" : "#e2e8f0", color: invoiceStatusMeta.bucket === "paid" ? "#166534" : invoiceStatusMeta.bucket === "open" ? "#92400e" : "#334155", fontSize: 12, fontWeight: 700 }}>{invoiceStatusMeta.label}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Stratejik Partner #{invoice.tenant_id} ○ {invoice.currency}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Toplam: {Number(invoice.total_amount || 0).toLocaleString("tr-TR")} {invoice.currency}</div>
                </div>
                );
              })
            )}
          </div>
        </div>
        <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 16, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b" }}>Son Webhook Olaylari</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { key: "all", label: "Tum Olaylar", value: props.visibleBillingWebhooks.length, color: "#0f172a" },
                { key: "processed", label: "Islendi", value: props.visibleBillingWebhooks.filter((w) => w.processing_status === "processed").length, color: "#15803d" },
                { key: "failed", label: "Hatali", value: props.visibleBillingWebhooks.filter((w) => w.processing_status === "failed").length, color: "#b91c1c" },
                { key: "other", label: "Diger", value: props.visibleBillingWebhooks.filter((w) => w.processing_status !== "processed" && w.processing_status !== "failed").length, color: "#475569" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.setBillingWebhookFilter(item.key as "all" | "processed" | "failed" | "other")}
                  style={{ borderRadius: 14, border: props.billingWebhookFilter === item.key ? `2px solid ${item.color}` : "1px solid #dbe3ee", background: "white", padding: 10, display: "grid", gap: 4, textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: item.color }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: item.color }}>{item.value}</div>
                </button>
              ))}
            </div>
            {props.visibleBillingWebhooks.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13 }}>Henuz webhook olayi alinmadi.</div>
            ) : (
              props.visibleBillingWebhooks.slice(0, 6).map((event) => (
                <div key={event.id} style={{ borderRadius: 14, background: "white", border: "1px solid #dbe3ee", padding: 12, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{event.event_type}</div>
                    <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: event.processing_status === "processed" ? "#dcfce7" : event.processing_status === "failed" ? "#fee2e2" : "#e2e8f0", color: event.processing_status === "processed" ? "#166534" : event.processing_status === "failed" ? "#991b1b" : "#334155", fontSize: 12, fontWeight: 700 }}>{event.processing_status}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{event.provider} ○ {event.provider_event_id}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Stratejik Partner #{event.tenant_id || "-"}</div>
                  {event.processing_status === "failed" && event.error_message ? (
                    <div style={{ color: "#991b1b", fontSize: 12 }}>Hata: {event.error_message}</div>
                  ) : null}
                  {event.processing_status === "failed" ? (
                    <div>
                      <button
                        type="button"
                        disabled={props.billingWebhookRetryingEventId === event.id}
                        onClick={() => { void props.handleRetryBillingWebhookEvent(event.id); }}
                        style={{
                          borderRadius: 10,
                          border: "1px solid #fca5a5",
                          background: props.billingWebhookRetryingEventId === event.id ? "#fee2e2" : "#fff1f2",
                          color: "#991b1b",
                          fontWeight: 700,
                          fontSize: 12,
                          padding: "6px 10px",
                          cursor: props.billingWebhookRetryingEventId === event.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {props.billingWebhookRetryingEventId === event.id ? "Yeniden Isleniyor..." : "Tekrar Dene"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
      </div>
    </section>
  );
}
