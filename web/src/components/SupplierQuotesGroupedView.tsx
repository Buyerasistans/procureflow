// web/src/components/SupplierQuotesGroupedView.tsx
import { useState } from "react";
import { ProfitabilityBadge } from "./ProfitabilityBadge";

interface SupplierQuote {
  id: number;
  revision_number: number;
  status: string;
  currency?: string;
  total_amount: number;
  profitability_amount: number | null;
  profitability_percent: number | null;
  revisions: SupplierQuote[];
  submitted_at?: string;
}

interface SupplierGroup {
  supplier_id: number;
  supplier_name: string;
  quotes: SupplierQuote[];
}

interface SupplierQuotesGroupedViewProps {
  suppliers: SupplierGroup[];
  onRequestRevision: (
    supplierQuoteId: number,
    supplierName: string,
    supplierId: number
  ) => Promise<void>;
  onViewDetails: (supplierQuoteId: number, supplierName: string) => void;
  onApproveSupplierQuote?: (supplierQuoteId: number, supplierName: string) => Promise<void>;
  loading?: boolean;
  canManage?: boolean;
}

export function SupplierQuotesGroupedView({
  suppliers,
  onRequestRevision,
  onViewDetails,
  onApproveSupplierQuote,
  loading = false,
  canManage = false,
}: SupplierQuotesGroupedViewProps) {
  const hasApprovedQuote = suppliers.some((supplier) => {
    const revisions = supplier.quotes.flatMap((q) => q.revisions || []);
    return [...supplier.quotes, ...revisions].some((q) => q.status === "onaylandı");
  });

  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<number>>(
    new Set(suppliers.map((s) => s.supplier_id).slice(0, 1))
  );

  const toggleSupplier = (supplierId: number) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) {
        next.delete(supplierId);
      } else {
        next.add(supplierId);
      }
      return next;
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalizeCurrency = (value?: string | null): "TRY" | "USD" | "EUR" => {
    const raw = String(value || "TRY").toUpperCase();
    if (raw === "TL" || raw === "TRL") return "TRY";
    if (raw === "USDT") return "USD";
    if (raw === "USD" || raw === "EUR") return raw;
    return "TRY";
  };

  const formatMoney = (amount: number, currency?: string) =>
    Number(amount || 0).toLocaleString("tr-TR", {
      style: "currency",
      currency: normalizeCurrency(currency),
      maximumFractionDigits: 2,
    });

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      tasarı: "Taslak",
      gönderildi: "Gönderildi",
      revize_edildi: "Revize İstendi",
      onaylandı: "Onaylandı",
      kapatıldı_yüksek_fiyat: "Kapatıldı",
    };
    return labels[status] || status;
  };

  if (suppliers.length === 0) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          textAlign: "center",
          color: "#666",
        }}
      >
        Henüz tedarikçi teklifi alınmamıştır.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {suppliers.map((supplier) => {
        const isExpanded = expandedSuppliers.has(supplier.supplier_id);
        const latestQuote = supplier.quotes[0];

        return (
          <div
            key={supplier.supplier_id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              overflow: "hidden",
              background: "white",
            }}
          >
            {/* Supplier Header */}
            <div
              onClick={() => toggleSupplier(supplier.supplier_id)}
              style={{
                padding: "16px",
                background: "#f9fafb",
                borderBottom: isExpanded ? "1px solid #ddd" : "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "16px" }}>{supplier.supplier_name}</h3>
                <div style={{ fontSize: "13px", color: "#666" }}>
                  <div>En Son Teklif: {formatMoney(Number(latestQuote?.total_amount || 0), latestQuote?.currency)}</div>
                  <div>Durum: {statusLabel(latestQuote?.status)}</div>
                  {latestQuote?.profitability_amount && canManage && (
                    <div style={{ marginTop: "4px" }}>
                      Tasarruf: <ProfitabilityBadge amount={latestQuote.profitability_amount} percent={latestQuote.profitability_percent} />
                    </div>
                  )}
                  {latestQuote?.status === "onaylandı" && (
                    <div style={{ marginTop: "6px", color: "#166534", fontWeight: 700 }}>
                      Onaylanan tedarikçi
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "20px", color: "#999" }}>{isExpanded ? "▼" : "▶"}</div>
            </div>

            {/* Supplier Details - Expanded */}
            {isExpanded && (
              <div style={{ padding: "16px" }}>
                {supplier.quotes.map((quote, quoteIdx) => (
                  <div key={quote.id} style={{ marginBottom: quoteIdx < supplier.quotes.length - 1 ? "16px" : 0 }}>
                    <div
                      style={{
                        padding: "12px",
                        background: "#fafafa",
                        borderRadius: "6px",
                        borderLeft: "4px solid #3b82f6",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: "14px" }}>
                            {quote.revision_number === 0 ? "İlk Teklif" : `${quote.revision_number}. Revizyon`}
                          </span>
                          <span style={{ marginLeft: "8px", fontSize: "13px", color: "#666" }}>
                            {statusLabel(quote.status)}
                          </span>
                        </div>
                        {quote.submitted_at && (
                          <span style={{ fontSize: "12px", color: "#999" }}>{formatDate(quote.submitted_at)}</span>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>
                          Toplam: {formatMoney(Number(quote.total_amount || 0), quote.currency)}
                        </span>
                        {quote.profitability_amount && canManage && (
                          <ProfitabilityBadge amount={quote.profitability_amount} percent={quote.profitability_percent} />
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => onViewDetails(quote.id, supplier.supplier_name)}
                          style={{
                            padding: "6px 12px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "13px",
                          }}
                        >
                          Göster
                        </button>

                        {canManage && quote.revision_number === 0 && (
                          <button
                            onClick={() =>
                              onRequestRevision(
                                quote.id,
                                supplier.supplier_name,
                                supplier.supplier_id
                              )
                            }
                            disabled={loading}
                            style={{
                              padding: "6px 12px",
                              background: "#f59e0b",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: loading ? "wait" : "pointer",
                              fontSize: "13px",
                              opacity: loading ? 0.6 : 1,
                            }}
                          >
                            Revize İste
                          </button>
                        )}

                        {canManage && onApproveSupplierQuote && quote.status === "yanıtlandı" && (
                          <button
                            onClick={() => onApproveSupplierQuote(quote.id, supplier.supplier_name)}
                            disabled={loading || hasApprovedQuote}
                            style={{
                              padding: "6px 12px",
                              background: hasApprovedQuote ? "#e5e7eb" : "#16a34a",
                              color: hasApprovedQuote ? "#6b7280" : "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: loading ? "wait" : hasApprovedQuote ? "not-allowed" : "pointer",
                              fontSize: "13px",
                              opacity: loading ? 0.6 : 1,
                            }}
                          >
                            {hasApprovedQuote ? "Pasif" : "İş Onayı Ver"}
                          </button>
                        )}

                        {quote.status === "onaylandı" && (
                          <span
                            style={{
                              padding: "6px 12px",
                              background: "#dcfce7",
                              color: "#166534",
                              borderRadius: "4px",
                              fontSize: "13px",
                              fontWeight: 700,
                            }}
                          >
                            Onaylandı
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Revisions */}
                    {quote.revisions && quote.revisions.length > 0 && (
                      <div style={{ marginLeft: "16px", paddingLeft: "12px", borderLeft: "2px solid #e5e7eb" }}>
                        {quote.revisions.map((revision) => (
                          <div
                            key={revision.id}
                            style={{
                              padding: "12px",
                              background: "#f0fdf4",
                              borderRadius: "6px",
                              borderLeft: "4px solid #10b981",
                              marginBottom: "12px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: "14px", color: "#10b981" }}>
                                  {revision.revision_number}. Revizyon
                                </span>
                                <span style={{ marginLeft: "8px", fontSize: "13px", color: "#666" }}>
                                  {statusLabel(revision.status)}
                                </span>
                              </div>
                              {revision.submitted_at && (
                                <span style={{ fontSize: "12px", color: "#999" }}>{formatDate(revision.submitted_at)}</span>
                              )}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <span style={{ fontSize: "14px", fontWeight: 600 }}>
                                Toplam: {formatMoney(Number(revision.total_amount || 0), revision.currency)}
                              </span>
                              {revision.profitability_amount && canManage && (
                                <ProfitabilityBadge amount={revision.profitability_amount} percent={revision.profitability_percent} />
                              )}
                            </div>

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                onClick={() => onViewDetails(revision.id, supplier.supplier_name)}
                                style={{
                                  padding: "6px 12px",
                                  background: "#3b82f6",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                }}
                              >
                                Göster
                              </button>

                              {canManage && onApproveSupplierQuote && revision.status === "yanıtlandı" && (
                                <button
                                  onClick={() => onApproveSupplierQuote(revision.id, supplier.supplier_name)}
                                  disabled={loading || hasApprovedQuote}
                                  style={{
                                    padding: "6px 12px",
                                    background: hasApprovedQuote ? "#e5e7eb" : "#16a34a",
                                    color: hasApprovedQuote ? "#6b7280" : "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: loading ? "wait" : hasApprovedQuote ? "not-allowed" : "pointer",
                                    fontSize: "13px",
                                    opacity: loading ? 0.6 : 1,
                                  }}
                                >
                                  {hasApprovedQuote ? "Pasif" : "İş Onayı Ver"}
                                </button>
                              )}

                              {revision.status === "onaylandı" && (
                                <span
                                  style={{
                                    padding: "6px 12px",
                                    background: "#dcfce7",
                                    color: "#166534",
                                    borderRadius: "4px",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                  }}
                                >
                                  Onaylandı
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
