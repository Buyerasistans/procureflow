// web/src/components/SupplierResponsePortal.tsx
import { Fragment, useState, useEffect, useCallback, type ChangeEvent } from "react";
import styled from "styled-components";

const Container = styled.div`
  padding: 20px;
`;

const Header = styled.div`
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: #1f2937;
  }

  p {
    color: #6b7280;
    margin: 5px 0 0 0;
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    word-break: normal;
  }

  th {
    background-color: #f3f4f6;
    font-weight: 600;
  }

  tr:hover {
    background-color: #f9fafb;
  }
`;

const TableScroll = styled.div`
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
`;

const Button = styled.button<{ variant?: "primary" | "success" | "secondary" }>`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  background-color: ${(props) => {
    switch (props.variant) {
      case "success":
        return "#10b981";
      case "secondary":
        return "#6b7280";
      default:
        return "#3b82f6";
    }
  }};
  color: white;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${(props) => {
    switch (props.status) {
      case "tasarı":
        return "#f3f4f6";
      case "gönderilen":
        return "#fef3c7";
      case "revize_edildi":
        return "#ffedd5";
      case "yanıtlandı":
        return "#d1fae5";
      case "reddedildi":
      case "kapatildi":
      case "kapatıldı":
      case "kapatildi_yuksek_fiyat":
      case "kapatıldı_yüksek_fiyat":
        return "#fee2e2";
      default:
        return "#f3f4f6";
    }
  }};
  color: ${(props) => {
    switch (props.status) {
      case "tasarı":
        return "#374151";
      case "gönderilen":
        return "#92400e";
      case "revize_edildi":
        return "#9a3412";
      case "yanıtlandı":
        return "#065f46";
      case "reddedildi":
      case "kapatildi":
      case "kapatıldı":
      case "kapatildi_yuksek_fiyat":
      case "kapatıldı_yüksek_fiyat":
        return "#991b1b";
      default:
        return "#374151";
    }
  }};
`;

const Form = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin: 15px 0;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  margin-bottom: 5px;
  font-weight: 600;
  font-size: 13px;
`;

const Input = styled.input`
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const ErrorMessage = styled.div`
  background-color: #fee2e2;
  color: #991b1b;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`;

const SuccessMessage = styled.div`
  background-color: #d1fae5;
  color: #065f46;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #9ca3af;
`;

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
    return <Container>Yükleniyor...</Container>;
  }

  return (
    <Container>
      <Header>
        <h2>📬 Teklif Yanıtları</h2>
        <p>Gönderilen tekliflere fiyat girerek yanıt verin</p>
      </Header>

      {error && <ErrorMessage>❌ {error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {activeTab === "pending" && pendingQuotes.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Platform Ağına Açık", value: pendingQuotes.filter((quote) => quote.platform_network_listing_enabled).length, bg: "#ecfdf5", color: "#166534" },
            { label: "Premium Rozetli", value: pendingQuotes.filter((quote) => quote.premium_listing_enabled).length, bg: "#fff7ed", color: "#b45309" },
            { label: "Sadece Ozel Havuz", value: pendingQuotes.filter((quote) => !quote.platform_network_listing_enabled).length, bg: "#eff6ff", color: "#1d4ed8" },
            { label: "Yanit Verdikleriniz", value: submittedQuotes.length, bg: "#f5f3ff", color: "#6d28d9" },
          ].map((card) => (
            <div key={card.label} style={{ borderRadius: 12, border: "1px solid #e5e7eb", background: card.bg, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.1, color: card.color }}>{card.label}</div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tab navigasyonu */}
      <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderBottom: "2px solid #e5e7eb" }}>
        {([
          { key: "pending", label: "Bekleyen", count: pendingQuotes.length, activeColor: "#f59e0b", activeBg: "#fffbeb" },
          { key: "submitted", label: "Gönderilen", count: submittedQuotes.length, activeColor: "#059669", activeBg: "#f0fdf4" },
          { key: "closed", label: "Kapanmış", count: closedQuotes.length, activeColor: "#dc2626", activeBg: "#fef2f2" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: activeTab === tab.key ? `3px solid ${tab.activeColor}` : "3px solid transparent",
              background: activeTab === tab.key ? tab.activeBg : "transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: "14px",
              color: activeTab === tab.key ? tab.activeColor : "#6b7280",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {tab.label}
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "20px",
              height: "20px",
              borderRadius: "999px",
              padding: "0 6px",
              fontSize: "11px",
              fontWeight: 700,
              background: activeTab === tab.key ? tab.activeColor : "#e5e7eb",
              color: activeTab === tab.key ? "#fff" : "#6b7280",
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {quotes.length === 0 ? (
        <EmptyState>
          <p>Henüz teklif alınmamış veya tüm tekliflere yanıt verilmiş</p>
        </EmptyState>
      ) : activeTab === "pending" ? (
        pendingQuotes.length === 0 ? (
          <EmptyState><p>Bekleyen teklif yok.</p></EmptyState>
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
              <Card key={quote.id}>
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#111827", fontSize: 16 }}>{quote.quote_title}</div>
                      <div style={{ marginTop: 4, color: "#6b7280", fontSize: 13 }}>{quote.published_by_tenant_name || "Firma belirtilmedi"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, fontSize: 11 }}>{quote.listing_scope_label || "Listeleme yok"}</span>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f8fafc", color: "#475569", fontWeight: 800, fontSize: 11 }}>{quote.package_plan_name || quote.package_plan_code || "Plan yok"}</span>
                      {premiumCodes.length > 0 ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontWeight: 800, fontSize: 11 }}>Premium: {premiumCodes.join(", ")}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                    <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Davet</div>
                      <div style={{ marginTop: 6, fontWeight: 900, color: "#0f172a", fontSize: 20 }}>{quote.invited_supplier_count || 0}</div>
                    </div>
                    <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Platform</div>
                      <div style={{ marginTop: 6, fontWeight: 900, color: "#0f172a", fontSize: 20 }}>{quote.platform_network_supplier_count || 0}</div>
                    </div>
                    <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: "#f8fafc", padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Ozel Havuz</div>
                      <div style={{ marginTop: 6, fontWeight: 900, color: "#0f172a", fontSize: 20 }}>{quote.private_supplier_count || 0}</div>
                    </div>
                    <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", background: quote.platform_network_listing_enabled ? "#ecfdf5" : "#fff7ed", padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: quote.platform_network_listing_enabled ? "#166534" : "#9a3412", fontWeight: 800, textTransform: "uppercase" }}>Paket Yetkisi</div>
                      <div style={{ marginTop: 6, fontWeight: 900, color: quote.platform_network_listing_enabled ? "#166534" : "#9a3412", fontSize: 14 }}>{quote.platform_network_listing_enabled ? "Platform gorunurlugu acik" : "Private kapsam"}</div>
                    </div>
                  </div>
                  {quote.entitlement_summary ? (
                    <div style={{ borderRadius: 10, border: `1px solid ${quote.platform_network_listing_enabled ? "#bbf7d0" : "#fed7aa"}`, background: quote.platform_network_listing_enabled ? "#f0fdf4" : "#fff7ed", padding: "10px 12px", color: quote.platform_network_listing_enabled ? "#166534" : "#9a3412", fontSize: 12, lineHeight: 1.7 }}>
                      {quote.entitlement_summary}
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    padding: "8px 0",
                  }}
                  onClick={() =>
                    setExpanded(expanded === quote.id ? null : quote.id)
                  }
                >
                  <div>
                    <h3 style={{ margin: "0 0 5px 0" }}>
                      {quote.quote_title}
                    </h3>
                    <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>
                      {quote.items.length} kalem • Son Tarih:{" "}
                      {new Date(quote.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <StatusBadge status={quote.status}>
                    {quote.status}
                  </StatusBadge>
                </div>

                {expanded === quote.id && data && (
                  <>
                    {isRevisionRequested && (
                      <div
                        style={{
                          marginTop: "10px",
                          marginBottom: "8px",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          background: "#fff7ed",
                          border: "1px solid #fdba74",
                          fontSize: "12px",
                          color: "#9a3412",
                        }}
                      >
                        Revize istendi. Eski fiyatlar sabit gösterilir, her kaleme yeni revize fiyat girilir.
                      </div>
                    )}
                    {revisionChain.length > 0 && (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "10px 12px",
                          borderRadius: "6px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          fontSize: "12px",
                          color: "#1e3a8a",
                          overflow: "hidden",
                          boxSizing: "border-box",
                        }}
                      >
                        {revisionChain.map((rev) => {
                          const label = Number(rev.revision_number || 0) === 0 ? "İlk Teklif" : `${rev.revision_number}. Revize`;
                          return (
                            <div key={`history-${quote.id}-${rev.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px", alignItems: "center", width: "100%", minWidth: 0 }}>
                              <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                              <span style={{ whiteSpace: "nowrap", fontSize: "11px", paddingLeft: "8px", maxWidth: "100%" }}>
                                {formatMoney(Number(rev.final_amount || 0), normalizeCurrency(rev.currency))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <TableScroll style={{ marginTop: "15px" }}>
                    <Table>
                      <thead>
                        <tr>
                          <th style={{ width: "31%" }}>Kalem</th>
                          <th style={{ width: "6%" }}>Ünite</th>
                          <th style={{ width: "6%" }}>Miktar</th>
                          <th style={{ width: "19%" }}>Birim Fiyat</th>
                          <th style={{ width: "14%" }}>Birim Toplam Fiyat</th>
                          <th style={{ width: "11%" }}>KDV Tutar</th>
                          <th style={{ width: "13%" }}>KDV Dahil Toplam</th>
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
                              <tr
                                key={idx}
                                style={{
                                  background: "#fef3c7",
                                  borderBottom: "2px solid #eab308",
                                  fontWeight: 700,
                                }}
                              >
                                <td
                                  colSpan={3}
                                  style={{
                                    padding: "10px 12px",
                                    color: "#92400e",
                                    fontSize: "13px",
                                    letterSpacing: "0.03em",
                                  }}
                                >
                                  <span
                                    style={{
                                      background: "#f59e0b",
                                      color: "#fff",
                                      borderRadius: "999px",
                                      padding: "2px 8px",
                                      fontSize: "11px",
                                      marginRight: "8px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Grup
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleGroupCollapse(quote.id, currentGroupKey);
                                    }}
                                    style={{
                                      marginRight: "8px",
                                      border: "none",
                                      background: "transparent",
                                      color: "#92400e",
                                      cursor: "pointer",
                                      fontWeight: 800,
                                      padding: 0,
                                    }}
                                    title={isGroupCollapsed(quote.id, currentGroupKey) ? "Grubu Aç" : "Grubu Kapat"}
                                  >
                                    {isGroupCollapsed(quote.id, currentGroupKey) ? "▶" : "▼"}
                                  </button>
                                  {lineNumber && (
                                    <span style={{ marginRight: "8px", fontWeight: 800 }}>{lineNumber}</span>
                                  )}
                                  {quoteItem.description}
                                </td>
                                <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap", textAlign: "left" }}>
                                  <span style={{ fontSize: "11px", color: "#92400e", fontWeight: 700 }}>Grup Toplamı</span>
                                </td>
                                <td style={{ padding: "10px 10px", fontWeight: 700, whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                                    {isRevisionRequested && (
                                      <span style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500 }}>
                                        İlk Teklif: {formatMoney(headerOldNet, "TRY")}
                                      </span>
                                    )}
                                    <span>{formatMoney(headerNet, "TRY")}</span>
                                  </div>
                                </td>
                                <td style={{ padding: "10px 10px", fontWeight: 700, whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                  {isRevisionRequested && (
                                    <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500 }}>
                                      İlk Teklif: {formatMoney(headerOldVat, "TRY")}
                                    </div>
                                  )}
                                  {formatMoney(headerVat, "TRY")}
                                </td>
                                <td style={{ padding: "10px 10px", fontWeight: 700, whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                  {isRevisionRequested && (
                                    <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 500 }}>
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
                              <tr style={{ background: "#fff" }}>
                              <td style={{ verticalAlign: "top", paddingBottom: quoteItem.item_detail || quoteItem.item_image_url ? "2px" : undefined }}>
                                <div style={{ fontWeight: 600 }}>
                                  {lineNumber && (
                                    <span style={{ marginRight: "8px", color: "#64748b", fontWeight: 700 }}>{lineNumber}</span>
                                  )}
                                  {quoteItem.description}
                                </div>
                                {itemHistory && (
                                  <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b", lineHeight: 1.4 }}>
                                    {itemHistory}
                                  </div>
                                )}
                              </td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{quoteItem.unit}</td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>
                                {quoteItem.quantity.toLocaleString("tr-TR")}
                              </td>
                              <td>
                                {isRevisionRequested && (
                                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_unit_price || 0), normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div style={{
                                  position: "relative",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "6px",
                                  background: "#fff",
                                }}>
                                  <Input
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
                                    style={{
                                      width: "100%",
                                      minWidth: "84px",
                                      border: "none",
                                      padding: "8px 48px 8px 8px",
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCurrencyPickerOpenFor((prev) =>
                                        prev === `${quote.id}-${formIdx}` ? null : `${quote.id}-${formIdx}`
                                      )
                                    }
                                    style={{
                                      position: "absolute",
                                      right: "4px",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      width: "40px",
                                      padding: "6px 4px",
                                      border: "none",
                                      borderLeft: "1px solid #e5e7eb",
                                      borderRadius: "4px",
                                      background: "#f8fafc",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      color: "#334155",
                                    }}
                                  >
                                    {currencySymbol(itemCurrency)} ▾
                                  </button>

                                  {currencyPickerOpenFor === `${quote.id}-${formIdx}` && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        right: "4px",
                                        top: "calc(100% + 4px)",
                                        background: "#fff",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "6px",
                                        boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)",
                                        zIndex: 30,
                                        minWidth: "42px",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {(["TRY", "USD", "EUR"] as const).map((ccy) => (
                                        <button
                                          key={`${quote.id}-${formIdx}-${ccy}`}
                                          type="button"
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
                                          style={{
                                            display: "block",
                                            width: "100%",
                                            border: "none",
                                            background: ccy === itemCurrency ? "#eff6ff" : "#fff",
                                            color: ccy === itemCurrency ? "#1e40af" : "#334155",
                                            textAlign: "left",
                                            padding: "8px 8px",
                                            cursor: "pointer",
                                            fontWeight: ccy === itemCurrency ? 700 : 500,
                                          }}
                                        >
                                          {ccy === "TRY" ? "₺" : ccy === "USD" ? "$" : "€"}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ marginTop: "8px" }}>
                                  <Input
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
                                    style={{ width: "100%", fontSize: "12px" }}
                                  />
                                </div>
                              </td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                {isRevisionRequested && (
                                  <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_total_price || 0), normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div style={{ fontWeight: 700 }}>
                                  {formatMoney(item.total_price, itemCurrency)}
                                  {itemCurrency !== "TRY" && (
                                    <div style={{ fontSize: "11px", color: "#92400e" }}>
                                      TL: {formatMoney(convertAmount(item.total_price, itemCurrency, "TRY"), "TRY")}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                {isRevisionRequested && (
                                  <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>
                                    İlk Teklif: {formatMoney((Number(quoteItem.supplier_total_price || 0) * vatRate) / 100, normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div style={{ fontWeight: 700 }}>
                                  {formatMoney(vatAmount, itemCurrency)}
                                </div>
                                {itemCurrency !== "TRY" && (
                                  <div style={{ fontSize: "11px", color: "#92400e" }}>
                                    TL: {formatMoney(vatTry, "TRY")}
                                  </div>
                                )}
                              </td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "right", fontSize: "13px" }}>
                                {isRevisionRequested && (
                                  <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>
                                    İlk Teklif: {formatMoney(Number(quoteItem.supplier_total_price || 0) + (Number(quoteItem.supplier_total_price || 0) * vatRate) / 100, normalizeCurrency(quote.currency))}
                                  </div>
                                )}
                                <div style={{ fontWeight: 700 }}>
                                  {formatMoney(grossTotal, itemCurrency)}
                                </div>
                                {itemCurrency !== "TRY" && (
                                  <div style={{ fontSize: "11px", color: "#92400e" }}>
                                    TL: {formatMoney(grossTry, "TRY")}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {(quoteItem.item_detail || quoteItem.item_image_url) && (
                              <tr style={{ background: "#fafafa" }}>
                                <td colSpan={7} style={{ paddingTop: "2px", paddingBottom: "10px", paddingLeft: "12px" }}>
                                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                                    {quoteItem.item_image_url && (
                                      <a href={quoteItem.item_image_url} target="_blank" rel="noopener noreferrer" title="Görseli yeni sekmede aç">
                                        <img
                                          src={quoteItem.item_image_url}
                                          alt="Kalem görseli"
                                          style={{ width: "160px", height: "110px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e5e7eb", flexShrink: 0 }}
                                        />
                                      </a>
                                    )}
                                    {quoteItem.item_detail && (
                                      <span style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
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
                    </Table>
                    </TableScroll>

                    <Form>
                      <FormGroup style={{ gridColumn: "1 / -1" }}>
                        <Label>Toplam Tutar ({normalizeCurrency(data.currency)})</Label>
                        <Input
                          type="text"
                          value={formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                          readOnly
                        />
                        <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                          {formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                          {normalizeCurrency(data.currency) !== "TRY" && (
                            <span style={{ marginLeft: "8px", color: "#92400e", fontWeight: 600 }}>
                              (TL karşılığı: {toTryAmount(data.total_amount, normalizeCurrency(data.currency)) !== null
                                ? formatMoney(Number(toTryAmount(data.total_amount, normalizeCurrency(data.currency))), "TRY")
                                : "kur bekleniyor"})
                            </span>
                          )}
                        </div>
                      </FormGroup>

                      <FormGroup>
                        <Label>İndirim %</Label>
                        <Input
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
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>İndirim Tutar ({normalizeCurrency(data.currency)})</Label>
                        <Input
                          type="text"
                          value={formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                          readOnly
                        />
                        <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                          {formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                        </div>
                      </FormGroup>

                      <FormGroup>
                        <Label>Final Tutar ({normalizeCurrency(data.currency)})</Label>
                        <Input
                          type="text"
                          value={formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                          readOnly
                          style={{
                            fontWeight: "bold",
                            color: "#10b981",
                            fontSize: "16px",
                          }}
                        />
                        <div style={{ fontSize: "12px", color: "#047857", marginTop: "4px", fontWeight: 700 }}>
                          {formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                          {normalizeCurrency(data.currency) !== "TRY" && (
                            <span style={{ marginLeft: "8px", color: "#92400e" }}>
                              (TL karşılığı: {toTryAmount(data.final_amount, normalizeCurrency(data.currency)) !== null
                                ? formatMoney(Number(toTryAmount(data.final_amount, normalizeCurrency(data.currency))), "TRY")
                                : "kur bekleniyor"})
                            </span>
                          )}
                        </div>
                      </FormGroup>

                      <FormGroup>
                        <Label>Teslimat Süresi (Gün)</Label>
                        <Input
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
                        />
                      </FormGroup>

                      <FormGroup style={{ gridColumn: "1 / -1" }}>
                        <Label>Ödeme Şartları</Label>
                        <Input
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
                      </FormGroup>

                      <FormGroup style={{ gridColumn: "1 / -1" }}>
                        <Label>Garanti</Label>
                        <Input
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
                      </FormGroup>
                    </Form>

                    <div
                      style={{
                        marginTop: "8px",
                        marginBottom: "12px",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        fontSize: "12px",
                        color: "#334155",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: "6px" }}>Döviz Özeti (Kalem Toplamları)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "6px" }}>
                        <div>
                          USD Toplami: {formatMoney(formSummary.currencyBuckets.USD, "USD")}
                          <span style={{ marginLeft: "6px", color: "#92400e" }}>
                            (TL: {formatMoney(convertAmount(formSummary.currencyBuckets.USD, "USD", "TRY"), "TRY")})
                          </span>
                        </div>
                        <div>
                          EUR Toplami: {formatMoney(formSummary.currencyBuckets.EUR, "EUR")}
                          <span style={{ marginLeft: "6px", color: "#92400e" }}>
                            (TL: {formatMoney(convertAmount(formSummary.currencyBuckets.EUR, "EUR", "TRY"), "TRY")})
                          </span>
                        </div>
                        <div>
                          TL Toplami: {formatMoney(formSummary.currencyBuckets.TRY, "TRY")}
                        </div>
                      </div>
                      <div style={{ marginTop: "6px", fontWeight: 700 }}>
                        Toplam TL Karsiligi: {formatMoney(formSummary.totalTryEquivalent, "TRY")}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "15px" }}>
                      <Button
                        variant="secondary"
                        onClick={() => handleSaveDraft(quote.id)}
                        disabled={submitting !== null}
                      >
                        {submitting === quote.id ? "⏳" : "💾"} Taslak Kaydet
                      </Button>
                      <Button
                        onClick={() => handleSubmit(quote.id)}
                        disabled={submitting !== null}
                      >
                        {submitting === quote.id
                          ? "⏳ Gönderiliyor..."
                          : (isRevisionRequested ? "✅ Revize Teklifi Gönder" : "✅ Teklifi Gönder")}
                      </Button>
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: normalizeCurrency(data.currency) === "TRY" ? "#f1f5f9" : "#fffbeb",
                        border: normalizeCurrency(data.currency) === "TRY" ? "1px solid #cbd5e1" : "1px solid #fcd34d",
                        fontSize: "12px",
                        color: normalizeCurrency(data.currency) === "TRY" ? "#334155" : "#92400e",
                        fontWeight: 600,
                      }}
                    >
                      Teklif para birimi: {normalizeCurrency(data.currency)}
                      <span style={{ marginLeft: "8px", fontWeight: 700 }}>
                        | Toplam: {formatMoney(data.total_amount, normalizeCurrency(data.currency))}
                        {" "}• Indirim: {formatMoney(data.discount_amount, normalizeCurrency(data.currency))}
                        {" "}• Final: {formatMoney(data.final_amount, normalizeCurrency(data.currency))}
                      </span>
                      {normalizeCurrency(data.currency) !== "TRY" && exchangeRates && (
                        <span style={{ marginLeft: "8px", fontWeight: 700 }}>
                          (TCMB efektif satış: 1 USD = {exchangeRates.usd_try.toFixed(4)} TL, 1 EUR = {exchangeRates.eur_try.toFixed(4)} TL)
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Card>
            );
          })
      ) : activeTab === "submitted" ? (
        submittedQuotes.length === 0 ? (
          <EmptyState><p>Henüz gönderilmiş teklif yok.</p></EmptyState>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {submittedQuotes.map((q) => (
              <Card key={`submitted-${q.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{q.quote_title}</div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: "#475569" }}>
                      Gönderilen Tutar: {formatMoney(Number(q.final_amount || 0), normalizeCurrency(q.currency))}
                      {normalizeCurrency(q.currency) !== "TRY" && (
                        <span style={{ marginLeft: "8px", color: "#92400e", fontWeight: 600 }}>
                          (TL: {toTryAmount(Number(q.final_amount || 0), normalizeCurrency(q.currency)) !== null
                            ? formatMoney(Number(toTryAmount(Number(q.final_amount || 0), normalizeCurrency(q.currency))), "TRY")
                            : "kur bekleniyor"})
                        </span>
                      )}
                    </div>
                    {q.submitted_at && (
                      <div style={{ marginTop: "4px", fontSize: "12px", color: "#9ca3af" }}>
                        Gönderilme: {new Date(q.submitted_at).toLocaleString("tr-TR")}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={q.status}>{q.status}</StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        closedQuotes.length === 0 ? (
          <EmptyState><p>Kapanmış teklif yok.</p></EmptyState>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {closedQuotes.map((q) => (
              <Card key={`closed-${q.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{q.quote_title}</div>
                    <div style={{ marginTop: "4px", fontSize: "13px", color: "#475569" }}>
                      Son Teklifiniz: {formatMoney(Number(q.final_amount || 0), normalizeCurrency(q.currency))}
                    </div>
                    <div style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#7c2d12",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      padding: "8px 10px",
                    }}>
                      ℹ️ {getClosedReason(q)}
                    </div>
                  </div>
                  <StatusBadge status={q.status}>{q.status}</StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </Container>
  );
}
