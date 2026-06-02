// web/src/components/SupplierResponsePortal.tsx
import { Fragment, useState, useEffect, useCallback, type ChangeEvent } from "react";
import "./SupplierResponsePortal.css";

interface QuoteItem {
  id: number;
  quote_item_id: number;
  description: string;
  unit: string;
  quantity: number;
  vat_rate?: number;
  original_unit_price: number;
  supplier_unit_price: number;
  supplier_total_price: number;
  notes?: string;
  is_group_header?: boolean;
  line_number?: string;
  item_detail?: string;
  item_image_url?: string;
}

interface PendingQuote {
  id: number;
  supplier_id: number;
  quote_id: number;
  quote_title: string;
  published_by_tenant_name?: string | null;
  listing_scope?: string | null;
  listing_scope_label?: string | null;
  private_supplier_count?: number;
  platform_network_supplier_count?: number;
  invited_supplier_count?: number;
  responded_supplier_count?: number;
  package_plan_code?: string | null;
  package_plan_name?: string | null;
  active_premium_feature_codes?: string[];
  entitlement_status?: string | null;
  entitlement_summary?: string | null;
  platform_network_listing_enabled?: boolean;
  premium_listing_enabled?: boolean;
  revision_number?: number;
  quote_status?: string;
  selected_supplier_id?: number | null;
  status: string;
  currency?: "TRY" | "USD" | "EUR";
  total_amount: number;
  final_amount: number;
  payment_terms?: string;
  delivery_time?: number;
  warranty?: string;
  items: QuoteItem[];
  created_at: string;
  submitted_at?: string;
}

interface SupplierResponsePortalProps {
  apiUrl: string;
  authToken: string;
  supplierUserId?: number;
}

function statusBadgeClass(status: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "gönderilen") return "srp-badge srp-badge--gonderilen";
  if (s === "revize_edildi") return "srp-badge srp-badge--revize";
  if (s === "yanıtlandı") return "srp-badge srp-badge--yanitlandi";
  if (
    s === "reddedildi" ||
    s === "kapatildi" ||
    s === "kapatıldı" ||
    s === "kapatildi_yuksek_fiyat" ||
    s === "kapatıldı_yüksek_fiyat"
  ) return "srp-badge srp-badge--closed";
  return "srp-badge";
}

export function SupplierResponsePortal({
  apiUrl,
  authToken,
}: SupplierResponsePortalProps) {
  const [quotes, setQuotes] = useState<PendingQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    [key: number]: {
      items: Array<{
        quote_item_id: number;
        unit_price: number;
        total_price: number;
        notes: string;
        currency: "TRY" | "USD" | "EUR";
      }>;
      total_amount: number;
      discount_percent: number;
      discount_amount: number;
      final_amount: number;
      currency: "TRY" | "USD" | "EUR";
      payment_terms: string;
      delivery_time: number;
      warranty: string;
    };
  }>({});

  const [submitting, setSubmitting] = useState<number | null>(null);
  const [focusedPriceInput, setFocusedPriceInput] = useState<string | null>(null);
  const [collapsedGroupsByQuote, setCollapsedGroupsByQuote] = useState<Record<number, Record<string, boolean>>>({});
  const [currencyPickerOpenFor, setCurrencyPickerOpenFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "closed">("pending");
  const [exchangeRates, setExchangeRates] = useState<{ usd_try: number; eur_try: number } | null>(null);

  const normalizeCurrency = (value?: string | null): "TRY" | "USD" | "EUR" => {
    const raw = String(value || "TRY").toUpperCase();
    if (raw === "TL" || raw === "TRL") return "TRY";
    if (raw === "USDT") return "USD";
    if (raw === "USD" || raw === "EUR") return raw;
    return "TRY";
  };

  const formatMoney = (amount: number, currency: "TRY" | "USD" | "EUR") => {
    const normalized = normalizeCurrency(currency);
    return Number(amount || 0).toLocaleString("tr-TR", {
      style: "currency",
      currency: normalized,
      minimumFractionDigits: 2,
    });
  };

  const currencySymbol = (currency: "TRY" | "USD" | "EUR") => {
    const normalized = normalizeCurrency(currency);
    if (normalized === "USD") return "$";
    if (normalized === "EUR") return "€";
    return "₺";
  };

  const parseItemNotePayload = (raw: string | null | undefined): { note: string; currency: "TRY" | "USD" | "EUR" } => {
    if (!raw) return { note: "", currency: "TRY" };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const note = String((parsed as { user_note?: unknown; note?: unknown }).user_note ?? (parsed as { note?: unknown }).note ?? "");
        const currency = normalizeCurrency(String((parsed as { currency?: unknown }).currency ?? "TRY"));
        return { note, currency };
      }
    } catch {
      // Eski düz metin not formatı
    }
    return { note: String(raw), currency: "TRY" };
  };

  const buildItemNotePayload = (note: string, currency: "TRY" | "USD" | "EUR"): string => {
    return JSON.stringify({
      user_note: String(note || ""),
      currency: normalizeCurrency(currency),
    });
  };

  const rateToTry = (currency: "TRY" | "USD" | "EUR"): number => {
    const normalized = normalizeCurrency(currency);
    if (normalized === "TRY") return 1;
    if (!exchangeRates) return 0;
    if (normalized === "USD") return Number(exchangeRates.usd_try || 0);
    return Number(exchangeRates.eur_try || 0);
  };

  const convertAmount = (
    amount: number,
    from: "TRY" | "USD" | "EUR",
    to: "TRY" | "USD" | "EUR"
  ): number => {
    const safe = Number(amount || 0);
    const source = normalizeCurrency(from);
    const target = normalizeCurrency(to);
    if (source === target) return safe;

    const fromRate = rateToTry(source);
    const toRate = rateToTry(target);
    if (fromRate <= 0 || toRate <= 0) return 0;

    const amountTry = safe * fromRate;
    return amountTry / toRate;
  };

  const summarizeByCurrency = (
    items: Array<{ total_price: number; currency: "TRY" | "USD" | "EUR" }>
  ): Record<"TRY" | "USD" | "EUR", number> => {
    return items.reduce(
      (acc, item) => {
        const ccy = normalizeCurrency(item.currency);
        acc[ccy] += Number(item.total_price || 0);
        return acc;
      },
      { TRY: 0, USD: 0, EUR: 0 }
    );
  };

  const computeFormTotals = (
    items: Array<{ total_price: number; currency: "TRY" | "USD" | "EUR" }>,
    quoteCurrency: "TRY" | "USD" | "EUR",
    discountPercent: number
  ) => {
    const normalizedQuoteCurrency = normalizeCurrency(quoteCurrency);
    const total = items.reduce(
      (sum, item) =>
        sum + convertAmount(Number(item.total_price || 0), normalizeCurrency(item.currency), normalizedQuoteCurrency),
      0
    );
    const discountAmount = (total * Number(discountPercent || 0)) / 100;
    const finalAmount = total - discountAmount;
    const currencyBuckets = summarizeByCurrency(items);
    const totalTryEquivalent =
      currencyBuckets.TRY +
      currencyBuckets.USD * rateToTry("USD") +
      currencyBuckets.EUR * rateToTry("EUR");

    return {
      total_amount: total,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      currencyBuckets,
      totalTryEquivalent,
    };
  };

  const toTryAmount = (amount: number, currency: "TRY" | "USD" | "EUR") => {
    const normalized = normalizeCurrency(currency);
    const safeAmount = Number(amount || 0);
    if (normalized === "TRY") return safeAmount;
    if (!exchangeRates) return null;
    if (normalized === "USD") return safeAmount * Number(exchangeRates.usd_try || 0);
    return safeAmount * Number(exchangeRates.eur_try || 0);
  };

  const normalizeStatus = (value?: string | null): string => String(value || "").toLowerCase();

  const isClosedQuote = (q: PendingQuote): boolean => {
    const quoteStatus = normalizeStatus(q.quote_status);
    const supplierStatus = normalizeStatus(q.status);
    // revize_edildi her zaman aktif (bekleyen) sayılır — kapalı değil
    if (supplierStatus === "revize_edildi") return false;
    return (
      quoteStatus === "approved" ||
      quoteStatus === "rejected" ||
      supplierStatus === "reddedildi" ||
      supplierStatus === "kapatildi" ||
      supplierStatus === "kapatıldı" ||
      supplierStatus === "kapatildi_yuksek_fiyat" ||
      supplierStatus === "kapatıldı_yüksek_fiyat"
    );
  };

  const isSubmittedQuote = (q: PendingQuote): boolean => {
    const supplierStatus = normalizeStatus(q.status);
    return supplierStatus === "yanıtlandı" && !isClosedQuote(q);
  };

  const isPendingQuote = (q: PendingQuote): boolean => {
    if (isClosedQuote(q) || isSubmittedQuote(q)) return false;
    const supplierStatus = normalizeStatus(q.status);
    return supplierStatus === "gönderilen" || supplierStatus === "tasarı" || supplierStatus === "revize_edildi" || !supplierStatus;
  };

  const getClosedReason = (q: PendingQuote): string => {
    const quoteStatus = normalizeStatus(q.quote_status);
    const supplierStatus = normalizeStatus(q.status);
    if (quoteStatus === "approved") {
      if (supplierStatus === "onaylandı") {
        return "Teklifiniz onaylandı. Sözleşme süreci başlatılacaktır.";
      }
      if (
        supplierStatus === "kapatildi_yuksek_fiyat" ||
        supplierStatus === "kapatıldı_yüksek_fiyat" ||
        supplierStatus === "kapatildi" ||
        supplierStatus === "kapatıldı"
      ) {
        return "Fiyatınız yüksek bulunduğu için sözleşme başka tedarikçi ile yapıldı.";
      }
      if (q.selected_supplier_id && q.selected_supplier_id !== q.supplier_id) {
        return "Fiyatınız yüksek bulunduğu için sözleşme başka tedarikçi ile yapıldı.";
      }
      if (q.selected_supplier_id && q.selected_supplier_id === q.supplier_id) {
        return "Teklifiniz onaylandı. Sözleşme süreci başlatılacaktır.";
      }
      return "Bu teklif yönetici tarafından onaylanarak kapatıldı.";
    }
    if (quoteStatus === "rejected") {
      return "İş kapsamı değişikliği veya red nedeniyle teklif kapatıldı.";
    }
    return "Teklif kapatıldı.";
  };

  const pendingQuotes = quotes.filter(isPendingQuote);
  const submittedQuotes = quotes.filter(isSubmittedQuote);
  const closedQuotes = quotes.filter(isClosedQuote);

  const isGroupCollapsed = (quoteId: number, groupKey: string): boolean => {
    if (!groupKey) return false;
    return Boolean(collapsedGroupsByQuote[quoteId]?.[groupKey]);
  };

  const toggleGroupCollapse = (quoteId: number, groupKey: string) => {
    if (!groupKey) return;
    setCollapsedGroupsByQuote((prev) => ({
      ...prev,
      [quoteId]: {
        ...(prev[quoteId] || {}),
        [groupKey]: !prev[quoteId]?.[groupKey],
      },
    }));
  };

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/api/v1/supplier-quotes/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.detail || "Teklif listesi yüklenemedi";
        throw new Error(errorMsg);
      }

      const data: PendingQuote[] = await response.json();
      setQuotes(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Teklif listesi yüklenemedi";
      setError(errorMsg);
      console.error("Error loading quotes:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authToken]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    const loadExchangeRates = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/supplier-quotes/exchange-rates/tcmb`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (!response.ok) return;
        const payload = await response.json();
        setExchangeRates({
          usd_try: Number(payload?.usd_try || 0),
          eur_try: Number(payload?.eur_try || 0),
        });
      } catch {
        // Kur servisi anlık erişilemezse formu bloklamayalım.
      }
    };
    void loadExchangeRates();
  }, [apiUrl, authToken]);

  function initializeForm(quote: PendingQuote) {
    if (!formData[quote.id]) {
      setFormData((prev) => ({
        ...prev,
        [quote.id]: {
          items: quote.items
            .filter((item) => !item.is_group_header)
            .map((item) => {
              const parsed = parseItemNotePayload(item.notes);
              return {
                quote_item_id: item.quote_item_id,
                unit_price: item.supplier_unit_price || 0,
                total_price: item.supplier_total_price || 0,
                notes: parsed.note,
                currency: parsed.currency,
              };
            }),
          total_amount: quote.total_amount,
          discount_percent: 0,
          discount_amount: 0,
          final_amount: quote.final_amount,
          currency: normalizeCurrency(quote.currency),
          payment_terms: quote.payment_terms || "",
          delivery_time: quote.delivery_time || 0,
          warranty: quote.warranty || "",
        },
      }));
    }
  }

  const buildSubmitPayload = (quoteId: number) => {
    const data = formData[quoteId];
    if (!data) return null;

    const sanitizedItems = (data.items || [])
      .filter((item) => Number.isFinite(Number(item.quote_item_id)))
      .map((item) => ({
        quote_item_id: Number(item.quote_item_id),
        unit_price: Number.isFinite(Number(item.unit_price)) ? Number(item.unit_price) : 0,
        total_price: Number.isFinite(Number(item.total_price)) ? Number(item.total_price) : 0,
        notes: buildItemNotePayload(String(item.notes || ""), normalizeCurrency(item.currency)),
      }));

    const totalAmount = Number.isFinite(Number(data.total_amount)) ? Number(data.total_amount) : 0;
    const discountPercent = Number.isFinite(Number(data.discount_percent)) ? Number(data.discount_percent) : 0;
    const discountAmount = Number.isFinite(Number(data.discount_amount)) ? Number(data.discount_amount) : 0;
    const finalAmount = Number.isFinite(Number(data.final_amount)) ? Number(data.final_amount) : totalAmount;
    const deliveryTime = Number.isFinite(Number(data.delivery_time)) ? Math.max(0, Math.trunc(Number(data.delivery_time))) : 0;

    return {
      items: sanitizedItems,
      total_amount: totalAmount,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      currency: normalizeCurrency(data.currency),
      payment_terms: String(data.payment_terms || ""),
      delivery_time: deliveryTime,
      warranty: String(data.warranty || ""),
    };
  };

  async function handleSaveDraft(quoteId: number) {
    try {
      setSubmitting(quoteId);
      const payload = buildSubmitPayload(quoteId);
      if (!payload || payload.items.length === 0) {
        throw new Error("Kaydetmek için en az bir geçerli kalem gereklidir");
      }

      const response = await fetch(
        `${apiUrl}/api/v1/supplier-quotes/${quoteId}/draft-save`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = (error as { detail?: string | { message?: string } }).detail;
        const message = typeof detail === "string" ? detail : detail?.message;
        throw new Error(message || "Taslak kaydedilemedi");
      }

      setSuccess("✅ Taslak kaydedildi");
      window.alert("Teklif taslağı kaydedildi.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Taslak kaydedilemedi";
      setError(message);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSubmit(quoteId: number) {
    try {
      setSubmitting(quoteId);
      const payload = buildSubmitPayload(quoteId);
      if (!payload || payload.items.length === 0) {
        throw new Error("Göndermek için en az bir geçerli kalem gereklidir");
      }

      const response = await fetch(
        `${apiUrl}/api/v1/supplier-quotes/${quoteId}/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = (error as { detail?: string | { message?: string } }).detail;
        const message = typeof detail === "string" ? detail : detail?.message;
        throw new Error(message || "Teklif gönderilemedi");
      }

      setSuccess("✅ Teklif başarıyla gönderildi. Yönetici panelinde ilgili teklif detayında görülebilir.");
      window.alert("Teklif gönderildi. Yönetici panelinde ilgili teklif detayında görüntülenebilir.");
      setExpanded(null);
      loadQuotes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Teklif gönderilemedi";
      setError(message);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <div className="srp-container">Yükleniyor...</div>;
  }

  return (
    <div className="srp-container">
      <div className="srp-header">
        <h2>📬 Teklif Yanıtları</h2>
        <p>Gönderilen tekliflere fiyat girerek yanıt verin</p>
      </div>

      {error && <div className="srp-error">❌ {error}</div>}
      {success && <div className="srp-success">{success}</div>}

      {activeTab === "pending" && pendingQuotes.length > 0 ? (
        <div className="srp-stats-grid">
          {[
            { label: "Platform Ağına Açık", value: pendingQuotes.filter((quote) => quote.platform_network_listing_enabled).length, colorKey: "green" },
            { label: "Premium Rozetli", value: pendingQuotes.filter((quote) => quote.premium_listing_enabled).length, colorKey: "orange" },
            { label: "Sadece Ozel Havuz", value: pendingQuotes.filter((quote) => !quote.platform_network_listing_enabled).length, colorKey: "blue" },
            { label: "Yanit Verdikleriniz", value: submittedQuotes.length, colorKey: "purple" },
          ].map((card) => (
            <div key={card.label} className={`srp-stat-card srp-stat-card--${card.colorKey}`}>
              <div className="srp-stat-card__label">{card.label}</div>
              <div className="srp-stat-card__value">{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="srp-tabs">
        {([
          { key: "pending", label: "Bekleyen", count: pendingQuotes.length },
          { key: "submitted", label: "Gönderilen", count: submittedQuotes.length },
          { key: "closed", label: "Kapanmış", count: closedQuotes.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`srp-tab srp-tab--${tab.key}${activeTab === tab.key ? " srp-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="srp-tab__count">{tab.count}</span>
          </button>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="srp-empty">
          <p>Henüz teklif alınmamış veya tüm tekliflere yanıt verilmiş</p>
        </div>
      ) : activeTab === "pending" ? (
        pendingQuotes.length === 0 ? (
          <div className="srp-empty"><p>Bekleyen teklif yok.</p></div>
        ) :
        pendingQuotes
          .map((quote) => {
            if (!formData[quote.id]) {
              initializeForm(quote);
            }

            const data = formData[quote.id];
            const isRevisionRequested = normalizeStatus(quote.status) === "revize_edildi";
            const revisionChain = quotes
              .filter((q) => q.quote_id === quote.quote_id && q.supplier_id === quote.supplier_id)
              .sort((a, b) => Number(a.revision_number || 0) - Number(b.revision_number || 0));
            const parseLineParts = (line?: string): number[] =>
              String(line || "")
                .split(".")
                .map((p) => Number.parseInt(p, 10))
                .map((n) => (Number.isFinite(n) ? n : 9999));

            const compareLine = (a?: string, b?: string): number => {
              const pa = parseLineParts(a);
              const pb = parseLineParts(b);
              const len = Math.max(pa.length, pb.length);
              for (let i = 0; i < len; i++) {
                const va = pa[i] ?? 0;
                const vb = pb[i] ?? 0;
                if (va !== vb) return va - vb;
              }
              return String(a || "").localeCompare(String(b || ""));
            };

            const groupHeaders = quote.items
              .filter((it) => Boolean(it.is_group_header))
              .sort((a, b) => compareLine(a.line_number, b.line_number));

            const nonHeaderItems = quote.items
              .filter((it) => !it.is_group_header)
              .sort((a, b) => compareLine(a.line_number, b.line_number));

            const usedItemIds = new Set<number>();
            const orderedRows: Array<{ kind: "header" | "item"; item: QuoteItem }> = [];

            for (const header of groupHeaders) {
              orderedRows.push({ kind: "header", item: header });
              const groupKey = String(header.line_number || "").split(".")[0];
              const children = nonHeaderItems.filter((it) => {
                const ln = String(it.line_number || "");
                return groupKey && ln.startsWith(`${groupKey}.`);
              });
              for (const child of children) {
                usedItemIds.add(Number(child.quote_item_id));
                orderedRows.push({ kind: "item", item: child });
              }
            }

            // Grup dışı veya eşleşmeyen kalemleri en altta kaybetmeyelim.
            for (const orphan of nonHeaderItems) {
              if (usedItemIds.has(Number(orphan.quote_item_id))) continue;
              orderedRows.push({ kind: "item", item: orphan });
            }

            const formSummary = data
              ? computeFormTotals(
                  data.items,
                  normalizeCurrency(data.currency),
                  Number(data.discount_percent || 0)
                )
              : {
                  total_amount: 0,
                  discount_amount: 0,
                  final_amount: 0,
                  currencyBuckets: { TRY: 0, USD: 0, EUR: 0 },
                  totalTryEquivalent: 0,
                };

            const premiumCodes = quote.active_premium_feature_codes || [];

            return (
              <div key={quote.id} className="srp-card">
                <div className="srp-quote-meta">
                  <div className="srp-quote-title-row">
                    <div>
                      <div className="srp-quote-title__text">{quote.quote_title}</div>
                      <div className="srp-quote-title__tenant">{quote.published_by_tenant_name || "Firma belirtilmedi"}</div>
                    </div>
                    <div className="srp-quote-badges">
                      <span className="srp-badge-scope">{quote.listing_scope_label || "Listeleme yok"}</span>
                      <span className="srp-badge-plan">{quote.package_plan_name || quote.package_plan_code || "Plan yok"}</span>
                      {premiumCodes.length > 0 ? <span className="srp-badge-premium">Premium: {premiumCodes.join(", ")}</span> : null}
                    </div>
                  </div>
                  <div className="srp-info-grid">
                    <div className="srp-info-tile">
                      <div className="srp-info-tile__label">Davet</div>
                      <div className="srp-info-tile__value">{quote.invited_supplier_count || 0}</div>
                    </div>
                    <div className="srp-info-tile">
                      <div className="srp-info-tile__label">Platform</div>
                      <div className="srp-info-tile__value">{quote.platform_network_supplier_count || 0}</div>
                    </div>
                    <div className="srp-info-tile">
                      <div className="srp-info-tile__label">Ozel Havuz</div>
                      <div className="srp-info-tile__value">{quote.private_supplier_count || 0}</div>
                    </div>
                    <div className={`srp-info-tile ${quote.platform_network_listing_enabled ? "srp-info-tile--open" : "srp-info-tile--private"}`}>
                      <div className="srp-info-tile__label">Paket Yetkisi</div>
                      <div className="srp-info-tile__value srp-info-tile__value--sm">
                        {quote.platform_network_listing_enabled ? "Platform gorunurlugu acik" : "Private kapsam"}
                      </div>
                    </div>
                  </div>
                  {quote.entitlement_summary ? (
                    <div className={`srp-entitlement ${quote.platform_network_listing_enabled ? "srp-entitlement--open" : "srp-entitlement--private"}`}>
                      {quote.entitlement_summary}
                    </div>
                  ) : null}
                </div>

                <div
                  className="srp-expand-toggle"
                  onClick={() => setExpanded(expanded === quote.id ? null : quote.id)}
                >
                  <div>
                    <h3>{quote.quote_title}</h3>
                    <p>
                      {quote.items.length} kalem • Son Tarih:{" "}
                      {new Date(quote.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <span className={statusBadgeClass(quote.status)}>{quote.status}</span>
                </div>

                {expanded === quote.id && data && (
                  <>
                    {isRevisionRequested && (
                      <div className="srp-revision-notice">
                        Revize istendi. Eski fiyatlar sabit gösterilir, her kaleme yeni revize fiyat girilir.
                      </div>
                    )}
                    {revisionChain.length > 0 && (
                      <div className="srp-revision-chain">
                        {revisionChain.map((rev) => {
                          const label = Number(rev.revision_number || 0) === 0 ? "İlk Teklif" : `${rev.revision_number}. Revize`;
                          return (
                            <div key={`history-${quote.id}-${rev.id}`} className="srp-revision-chain__row">
                              <span className="srp-revision-chain__label">{label}</span>
                              <span className="srp-revision-chain__amount">
                                {formatMoney(Number(rev.final_amount || 0), normalizeCurrency(rev.currency))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="srp-table-scroll srp-table-scroll--mt">
                    <table className="srp-table">
                      <thead>
                        <tr>
                          <th>Kalem</th>
                          <th>Ünite</th>
                          <th>Miktar</th>
                          <th>Birim Fiyat</th>
                          <th>Birim Toplam Fiyat</th>
                          <th>KDV Tutar</th>
                          <th>KDV Dahil Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedRows.map((row, idx) => {
                          const quoteItem = row.item;
                          const isHeader = row.kind === "header";
                          const lineNumber = String(quoteItem.line_number || "");
                          const currentGroupKey = lineNumber.split(".")[0];

                          if (!isHeader && currentGroupKey && isGroupCollapsed(quote.id, currentGroupKey)) {
                            return null;
                          }

                          const groupChildren = quote.items.filter(
                            (qi) => !qi.is_group_header && (qi.line_number || "").startsWith(`${currentGroupKey}.`)
                          );
                          const headerNet = groupChildren.reduce((sum, qi) => {
                            const formLine = data.items.find((fi) => fi.quote_item_id === qi.quote_item_id);
                            return sum + convertAmount(Number(formLine?.total_price || 0), normalizeCurrency(formLine?.currency), "TRY");
                          }, 0);
                          const headerVat = groupChildren.reduce((sum, qi) => {
                            const formLine = data.items.find((fi) => fi.quote_item_id === qi.quote_item_id);
                            const net = convertAmount(Number(formLine?.total_price || 0), normalizeCurrency(formLine?.currency), "TRY");
                            const rate = Number(qi.vat_rate ?? 20);
                            return sum + (net * rate) / 100;
                          }, 0);
                          const quoteCurrency = normalizeCurrency(quote.currency);
                          const headerOldNet = groupChildren.reduce((sum, qi) => {
                            const oldTotal = Number(qi.supplier_total_price || 0);
                            return sum + convertAmount(oldTotal, quoteCurrency, "TRY");
                          }, 0);
                          const headerOldVat = groupChildren.reduce((sum, qi) => {
                            const oldTotal = Number(qi.supplier_total_price || 0);
                            const oldNetTry = convertAmount(oldTotal, quoteCurrency, "TRY");
                            const rate = Number(qi.vat_rate ?? 20);
                            return sum + (oldNetTry * rate) / 100;
                          }, 0);
                          const headerOldGross = headerOldNet + headerOldVat;
                          // Başlık satırı
                          if (isHeader) {
                            return (
                              <tr key={idx} className="srp-group-row">
                                <td colSpan={3} className="srp-group-cell">
                                  <span className="srp-group-badge">Grup</span>
                                  <button
                                    type="button"
                                    className="srp-group-toggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleGroupCollapse(quote.id, currentGroupKey);
                                    }}
                                    title={isGroupCollapsed(quote.id, currentGroupKey) ? "Grubu Aç" : "Grubu Kapat"}
                                  >
                                    {isGroupCollapsed(quote.id, currentGroupKey) ? "▶" : "▼"}
                                  </button>
                                  {lineNumber && (
                                    <span className="srp-group-linenr">{lineNumber}</span>
                                  )}
                                  {quoteItem.description}
                                </td>
                                <td className="srp-group-total-cell">
                                  <span className="srp-group-total-label">Grup Toplamı</span>
                                </td>
                                <td className="srp-group-amount-cell">
                                  <div className="srp-group-amount">
                                    {isRevisionRequested && (
                                      <span className="srp-old-price-sm">
                                        İlk Teklif: {formatMoney(headerOldNet, "TRY")}
                                      </span>
                                    )}
                                    <span>{formatMoney(headerNet, "TRY")}</span>
                                  </div>
                                </td>
                                <td className="srp-group-amount-cell">
                                  {isRevisionRequested && (
                                    <div className="srp-old-price-sm">
                                      İlk Teklif: {formatMoney(headerOldVat, "TRY")}
                                    </div>
                                  )}
                                  {formatMoney(headerVat, "TRY")}
                                </td>
                                <td className="srp-group-amount-cell">
                                  {isRevisionRequested && (
                                    <div className="srp-old-price-sm">
                                      İlk Teklif: {formatMoney(headerOldGross, "TRY")}
                                    </div>
                                  )}
                                  {formatMoney(headerNet + headerVat, "TRY")}
                                </td>
                              </tr>
                            );
                          }
                          // Normal kalem - formData içindeki index'i bul
                          const formIdx = data.items.findIndex(
                            (fi) => fi.quote_item_id === quoteItem.quote_item_id
                          );
                          if (formIdx === -1) return null;
                          const item = data.items[formIdx];
                          const itemCurrency = normalizeCurrency(item.currency);
                          const vatRate = Number(quoteItem.vat_rate ?? 20);
                          const vatAmount = item.total_price * (vatRate / 100);
                          const grossTotal = item.total_price + vatAmount;
                          const vatTry = convertAmount(vatAmount, itemCurrency, "TRY");
                          const grossTry = convertAmount(grossTotal, itemCurrency, "TRY");
                          const itemHistory = revisionChain
                            .map((rev) => {
                              const histItem = rev.items?.find((ri) => Number(ri.quote_item_id) === Number(quoteItem.quote_item_id));
                              if (!histItem) return null;
                              const label = Number(rev.revision_number || 0) === 0 ? "İlk Teklif" : `${rev.revision_number}. Revize`;
                              const currency = normalizeCurrency(rev.currency);
                              return `${label}: ${formatMoney(Number(histItem.supplier_total_price || 0), currency)}`;
                            })
                            .filter(Boolean)
                            .join(" • ");
                          return (
                            <Fragment key={idx}>
                              <tr className="srp-item-row">
                              <td className={(quoteItem.item_detail || quoteItem.item_image_url) ? "srp-td--pb2" : ""}>
                                <div className="srp-item-desc">
                                  {lineNumber && (
                                    <span className="srp-item-linenr">{lineNumber}</span>
                                  )}
                                  {quoteItem.description}
                                </div>
                                {itemHistory && (
                                  <div className="srp-item-history">
                                    {itemHistory}
                                  </div>
                                )}
                              </td>
                              <td className="srp-cell-center">{quoteItem.unit}</td>
                              <td className="srp-cell-center">
                                {quoteItem.quantity.toLocaleString("tr-TR")}
                              </td>
                              <td>
                                {isRevisionRequested && (
                                  <div className="srp-old-price srp-old-price--mb4">
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_unit_price || 0), normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div className="srp-price-wrapper">
                                  <input
                                    className="srp-price-input"
                                    type="number"
                                    step="0.01"
                                    value={item.unit_price === 0 && focusedPriceInput === `${quote.id}-${formIdx}` ? "" : item.unit_price}
                                    onFocus={(e) => {
                                      setFocusedPriceInput(`${quote.id}-${formIdx}`);
                                      setCurrencyPickerOpenFor(null);
                                      e.target.select();
                                    }}
                                    onBlur={() => setFocusedPriceInput((prev) => (prev === `${quote.id}-${formIdx}` ? null : prev))}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const newItems = [...data.items];
                                      const raw = e.target.value.trim();
                                      const parsed = raw === "" ? 0 : (parseFloat(raw) || 0);
                                      newItems[formIdx].unit_price = parsed;
                                      newItems[formIdx].total_price =
                                        newItems[formIdx].unit_price *
                                        (quoteItem.quantity || 0);
                                      const totals = computeFormTotals(newItems, normalizeCurrency(data.currency), Number(data.discount_percent || 0));

                                      setFormData((prev) => ({
                                        ...prev,
                                        [quote.id]: {
                                          ...data,
                                          items: newItems,
                                          total_amount: totals.total_amount,
                                          discount_amount: totals.discount_amount,
                                          final_amount: totals.final_amount,
                                        },
                                      }));
                                    }}
                                    aria-label="Birim fiyat"
                                  />
                                  <button
                                    type="button"
                                    className="srp-price-currency-btn"
                                    onClick={() =>
                                      setCurrencyPickerOpenFor((prev) =>
                                        prev === `${quote.id}-${formIdx}` ? null : `${quote.id}-${formIdx}`
                                      )
                                    }
                                    title="Para birimi seç"
                                  >
                                    {currencySymbol(itemCurrency)} ▾
                                  </button>

                                  {currencyPickerOpenFor === `${quote.id}-${formIdx}` && (
                                    <div className="srp-currency-dropdown">
                                      {(["TRY", "USD", "EUR"] as const).map((ccy) => (
                                        <button
                                          key={`${quote.id}-${formIdx}-${ccy}`}
                                          type="button"
                                          className={`srp-currency-opt${ccy === itemCurrency ? " srp-currency-opt--active" : ""}`}
                                          onClick={() => {
                                            const nextCurrency = normalizeCurrency(ccy);
                                            const newItems = [...data.items];
                                            newItems[formIdx] = { ...newItems[formIdx], currency: nextCurrency };
                                            const totals = computeFormTotals(newItems, normalizeCurrency(data.currency), Number(data.discount_percent || 0));
                                            setFormData((prev) => ({
                                              ...prev,
                                              [quote.id]: {
                                                ...data,
                                                items: newItems,
                                                total_amount: totals.total_amount,
                                                discount_amount: totals.discount_amount,
                                                final_amount: totals.final_amount,
                                              },
                                            }));
                                            setCurrencyPickerOpenFor(null);
                                          }}
                                        >
                                          {ccy === "TRY" ? "₺" : ccy === "USD" ? "$" : "€"}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="srp-note-wrap">
                                  <input
                                    className="srp-note-input"
                                    type="text"
                                    value={item.notes}
                                    placeholder="Not ekleyin..."
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const newItems = [...data.items];
                                      newItems[formIdx].notes = e.target.value;
                                      setFormData((prev) => ({
                                        ...prev,
                                        [quote.id]: {
                                          ...data,
                                          items: newItems,
                                        },
                                      }));
                                    }}
                                    aria-label="Kalem notu"
                                  />
                                </div>
                              </td>
                              <td className="srp-cell-right">
                                {isRevisionRequested && (
                                  <div className="srp-old-price srp-old-price--mb2">
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_total_price || 0), normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div className="srp-fw">
                                  {formatMoney(item.total_price, itemCurrency)}
                                  {itemCurrency !== "TRY" && (
                                    <div className="srp-fx-hint">
                                      TL: {formatMoney(convertAmount(item.total_price, itemCurrency, "TRY"), "TRY")}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="srp-cell-right">
                                {isRevisionRequested && (
                                  <div className="srp-old-price srp-old-price--mb2">
                                    İlk Teklif: {formatMoney((Number(quoteItem.supplier_total_price || 0) * vatRate) / 100, normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div className="srp-fw">
                                  {formatMoney(vatAmount, itemCurrency)}
                                </div>
                                {itemCurrency !== "TRY" && (
                                  <div className="srp-fx-hint">
                                    TL: {formatMoney(vatTry, "TRY")}
                                  </div>
                                )}
                              </td>
                              <td className="srp-cell-right">
                                {isRevisionRequested && (
                                  <div className="srp-old-price srp-old-price--mb2">
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_total_price || 0) + (Number(quoteItem.supplier_total_price || 0) * vatRate) / 100, normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div className="srp-fw">
                                  {formatMoney(grossTotal, itemCurrency)}
                                </div>
                                {itemCurrency !== "TRY" && (
                                  <div className="srp-fx-hint">
                                    TL: {formatMoney(grossTry, "TRY")}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {(quoteItem.item_detail || quoteItem.item_image_url) && (
                              <tr className="srp-item-detail-row">
                                <td colSpan={7} className="srp-item-detail-cell">
                                  <div className="srp-item-detail-inner">
                                    {quoteItem.item_image_url && (
                                      <a href={quoteItem.item_image_url} target="_blank" rel="noopener noreferrer" title="Görseli yeni sekmede aç">
                                        <img
                                          src={quoteItem.item_image_url}
                                          alt="Kalem görseli"
                                          className="srp-item-img"
                                        />
                                      </a>
                                    )}
                                    {quoteItem.item_detail && (
                                      <span className="srp-item-text">
                                        {quoteItem.item_detail}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    <form className="srp-form">
                      <div className="srp-form-group srp-form-group--full">
                        <label className="srp-label">Toplam Tutar ({normalizeCurrency(data.currency)})</label>
                        <input
                          className="srp-input"
                          type="text"
                          value={formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                          readOnly
                          aria-label="Toplam tutar"
                        />
                        <div className="srp-hint">
                          {formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                          {normalizeCurrency(data.currency) !== "TRY" && (
                            <span className="srp-hint--orange">
                              (TL karşılığı: {toTryAmount(data.total_amount, normalizeCurrency(data.currency)) !== null
                                ? formatMoney(Number(toTryAmount(data.total_amount, normalizeCurrency(data.currency))), "TRY")
                                : "kur bekleniyor"})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="srp-form-group">
                        <label className="srp-label">İndirim %</label>
                        <input
                          className="srp-input"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={data.discount_percent}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const pct = parseFloat(e.target.value) || 0;
                            const totals = computeFormTotals(data.items, normalizeCurrency(data.currency), pct);
                            setFormData((prev) => ({
                              ...prev,
                              [quote.id]: {
                                ...data,
                                discount_percent: pct,
                                discount_amount: totals.discount_amount,
                                final_amount: totals.final_amount,
                              },
                            }));
                          }}
                          aria-label="İndirim yüzdesi"
                        />
                      </div>

                      <div className="srp-form-group">
                        <label className="srp-label">İndirim Tutar ({normalizeCurrency(data.currency)})</label>
                        <input
                          className="srp-input"
                          type="text"
                          value={formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                          readOnly
                          aria-label="İndirim tutarı"
                        />
                        <div className="srp-hint">
                          {formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                        </div>
                      </div>

                      <div className="srp-form-group">
                        <label className="srp-label">Final Tutar ({normalizeCurrency(data.currency)})</label>
                        <input
                          className="srp-input srp-input--final"
                          type="text"
                          value={formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                          readOnly
                          aria-label="Final tutar"
                        />
                        <div className="srp-hint srp-hint--green">
                          {formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                          {normalizeCurrency(data.currency) !== "TRY" && (
                            <span className="srp-hint--orange">
                              (TL karşılığı: {toTryAmount(data.final_amount, normalizeCurrency(data.currency)) !== null
                                ? formatMoney(Number(toTryAmount(data.final_amount, normalizeCurrency(data.currency))), "TRY")
                                : "kur bekleniyor"})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="srp-form-group">
                        <label className="srp-label">Teslimat Süresi (Gün)</label>
                        <input
                          className="srp-input"
                          type="number"
                          value={data.delivery_time}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev) => ({
                              ...prev,
                              [quote.id]: {
                                ...data,
                                delivery_time: parseInt(e.target.value) || 0,
                              },
                            }))
                          }
                          aria-label="Teslimat süresi"
                        />
                      </div>

                      <div className="srp-form-group srp-form-group--full">
                        <label className="srp-label">Ödeme Şartları</label>
                        <input
                          className="srp-input"
                          type="text"
                          placeholder="Örn: %50 peşin, %50 30 gün"
                          value={data.payment_terms}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev) => ({
                              ...prev,
                              [quote.id]: {
                                ...data,
                                payment_terms: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="srp-form-group srp-form-group--full">
                        <label className="srp-label">Garanti</label>
                        <input
                          className="srp-input"
                          type="text"
                          placeholder="Örn: 12 ay ürün garantisi"
                          value={data.warranty}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev) => ({
                              ...prev,
                              [quote.id]: {
                                ...data,
                                warranty: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </form>

                    <div className="srp-fx-summary">
                      <div className="srp-fx-summary__title">Döviz Özeti (Kalem Toplamları)</div>
                      <div className="srp-fx-summary__grid">
                        <div>
                          USD Toplami: {formatMoney(formSummary.currencyBuckets.USD, "USD")}
                          <span className="srp-fx-ref">
                            (TL: {formatMoney(convertAmount(formSummary.currencyBuckets.USD, "USD", "TRY"), "TRY")})
                          </span>
                        </div>
                        <div>
                          EUR Toplami: {formatMoney(formSummary.currencyBuckets.EUR, "EUR")}
                          <span className="srp-fx-ref">
                            (TL: {formatMoney(convertAmount(formSummary.currencyBuckets.EUR, "EUR", "TRY"), "TRY")})
                          </span>
                        </div>
                        <div>
                          TL Toplami: {formatMoney(formSummary.currencyBuckets.TRY, "TRY")}
                        </div>
                      </div>
                      <div className="srp-fx-summary__total">
                        Toplam TL Karsiligi: {formatMoney(formSummary.totalTryEquivalent, "TRY")}
                      </div>
                    </div>

                    <div className="srp-btn-row">
                      <button
                        type="button"
                        className="srp-btn srp-btn--secondary"
                        onClick={() => { void handleSaveDraft(quote.id); }}
                        disabled={submitting !== null}
                      >
                        {submitting === quote.id ? "⏳" : "💾"} Taslak Kaydet
                      </button>
                      <button
                        type="button"
                        className="srp-btn"
                        onClick={() => { void handleSubmit(quote.id); }}
                        disabled={submitting !== null}
                      >
                        {submitting === quote.id
                          ? "⏳ Gönderiliyor..."
                          : (isRevisionRequested ? "✅ Revize Teklifi Gönder" : "✅ Teklifi Gönder")}
                      </button>
                    </div>

                    <div className={`srp-currency-bar ${normalizeCurrency(data.currency) === "TRY" ? "srp-currency-bar--try" : "srp-currency-bar--foreign"}`}>
                      Teklif para birimi: {normalizeCurrency(data.currency)}
                      <span className="srp-currency-bar__detail">
                        | Toplam: {formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                        {" "}• Indirim: {formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                        {" "}• Final: {formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                      </span>
                      {normalizeCurrency(data.currency) !== "TRY" && exchangeRates && (
                        <span className="srp-currency-bar__detail">
                          (TCMB efektif satış: 1 USD = {exchangeRates.usd_try.toFixed(4)} TL, 1 EUR = {exchangeRates.eur_try.toFixed(4)} TL)
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
      ) : activeTab === "submitted" ? (
        submittedQuotes.length === 0 ? (
          <div className="srp-empty"><p>Henüz gönderilmiş teklif yok.</p></div>
        ) : (
          <div className="srp-tab-grid">
            {submittedQuotes.map((q) => (
              <div key={`submitted-${q.id}`} className="srp-card">
                <div className="srp-quote-row">
                  <div>
                    <div className="srp-quote-title">{q.quote_title}</div>
                    <div className="srp-quote-amount">
                      Gönderilen Tutar: {formatMoney(Number(q.final_amount || 0), normalizeCurrency(q.currency))}
                      {normalizeCurrency(q.currency) !== "TRY" && (
                        <span className="srp-fx-amount-hint">
                          (TL: {toTryAmount(Number(q.final_amount || 0), normalizeCurrency(q.currency)) !== null
                            ? formatMoney(Number(toTryAmount(Number(q.final_amount || 0), normalizeCurrency(q.currency))), "TRY")
                            : "kur bekleniyor"})
                        </span>
                      )}
                    </div>
                    {q.submitted_at && (
                      <div className="srp-quote-date">
                        Gönderilme: {new Date(q.submitted_at).toLocaleString("tr-TR")}
                      </div>
                    )}
                  </div>
                  <span className={statusBadgeClass(q.status)}>{q.status}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        closedQuotes.length === 0 ? (
          <div className="srp-empty"><p>Kapanmış teklif yok.</p></div>
        ) : (
          <div className="srp-tab-grid">
            {closedQuotes.map((q) => (
              <div key={`closed-${q.id}`} className="srp-card">
                <div className="srp-quote-row">
                  <div className="srp-quote-flex1">
                    <div className="srp-quote-title">{q.quote_title}</div>
                    <div className="srp-quote-amount">
                      Son Teklifiniz: {formatMoney(Number(q.final_amount || 0), normalizeCurrency(q.currency))}
                    </div>
                    <div className="srp-closed-reason">
                      ℹ️ {getClosedReason(q)}
                    </div>
                  </div>
                  <span className={statusBadgeClass(q.status)}>{q.status}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
