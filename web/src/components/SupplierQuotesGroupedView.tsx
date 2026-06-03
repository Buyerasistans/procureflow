// web/src/components/SupplierQuotesGroupedView.tsx
import { useState } from "react";
import { ProfitabilityBadge } from "./ProfitabilityBadge";
import "./SupplierQuotesGroupedView.css";

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
      <div className="sqgv-empty">
        Henüz tedarikçi teklifi alınmamıştır.
      </div>
    );
  }

  return (
    <div className="sqgv-list">
      {suppliers.map((supplier) => {
        const isExpanded = expandedSuppliers.has(supplier.supplier_id);
        const latestQuote = supplier.quotes[0];

        return (
          <div key={supplier.supplier_id} className="sqgv-card">
            <div
              onClick={() => toggleSupplier(supplier.supplier_id)}
              className={`sqgv-card__header${isExpanded ? " sqgv-card__header--expanded" : ""}`}
            >
              <div>
                <h3 className="sqgv-card__name">{supplier.supplier_name}</h3>
                <div className="sqgv-card__meta">
                  <div>En Son Teklif: {formatMoney(Number(latestQuote?.total_amount || 0), latestQuote?.currency)}</div>
                  <div>Durum: {statusLabel(latestQuote?.status)}</div>
                  {latestQuote?.profitability_amount && canManage && (
                    <div className="sqgv-card__savings">
                      Tasarruf: <ProfitabilityBadge amount={latestQuote.profitability_amount} percent={latestQuote.profitability_percent} />
                    </div>
                  )}
                  {latestQuote?.status === "onaylandı" && (
                    <div className="sqgv-card__approved">
                      Onaylanan tedarikçi
                    </div>
                  )}
                </div>
              </div>
              <div className="sqgv-card__chevron">{isExpanded ? "▼" : "▶"}</div>
            </div>

            {isExpanded && (
              <div className="sqgv-card__body">
                {supplier.quotes.map((quote, quoteIdx) => (
                  <div
                    key={quote.id}
                    className={`sqgv-quote${quoteIdx >= supplier.quotes.length - 1 ? " sqgv-quote--last" : ""}`}
                  >
                    <div className="sqgv-qcard">
                      <div className="sqgv-qcard__row">
                        <div>
                          <span className="sqgv-qcard__label">
                            {quote.revision_number === 0 ? "İlk Teklif" : `${quote.revision_number}. Revizyon`}
                          </span>
                          <span className="sqgv-qcard__status">
                            {statusLabel(quote.status)}
                          </span>
                        </div>
                        {quote.submitted_at && (
                          <span className="sqgv-qcard__date">{formatDate(quote.submitted_at)}</span>
                        )}
                      </div>

                      <div className="sqgv-qcard__total-row">
                        <span className="sqgv-qcard__amount">
                          Toplam: {formatMoney(Number(quote.total_amount || 0), quote.currency)}
                        </span>
                        {quote.profitability_amount && canManage && (
                          <ProfitabilityBadge amount={quote.profitability_amount} percent={quote.profitability_percent} />
                        )}
                      </div>

                      <div className="sqgv-qcard__actions">
                        <button
                          onClick={() => onViewDetails(quote.id, supplier.supplier_name)}
                          className="sqgv-btn sqgv-btn--view"
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
                            className={`sqgv-btn sqgv-btn--revise${loading ? " sqgv-btn--loading" : ""}`}
                          >
                            Revize İste
                          </button>
                        )}

                        {canManage && onApproveSupplierQuote && quote.status === "yanıtlandı" && (
                          <button
                            onClick={() => onApproveSupplierQuote(quote.id, supplier.supplier_name)}
                            disabled={loading || hasApprovedQuote}
                            className={`sqgv-btn sqgv-btn--approve${hasApprovedQuote ? " sqgv-btn--approve-passive" : ""}${loading ? " sqgv-btn--loading" : ""}`}
                          >
                            {hasApprovedQuote ? "Pasif" : "İş Onayı Ver"}
                          </button>
                        )}

                        {quote.status === "onaylandı" && (
                          <span className="sqgv-badge--approved">
                            Onaylandı
                          </span>
                        )}
                      </div>
                    </div>

                    {quote.revisions && quote.revisions.length > 0 && (
                      <div className="sqgv-revisions">
                        {quote.revisions.map((revision) => (
                          <div key={revision.id} className="sqgv-rcard">
                            <div className="sqgv-qcard__row">
                              <div>
                                <span className="sqgv-rcard__label">
                                  {revision.revision_number}. Revizyon
                                </span>
                                <span className="sqgv-qcard__status">
                                  {statusLabel(revision.status)}
                                </span>
                              </div>
                              {revision.submitted_at && (
                                <span className="sqgv-qcard__date">{formatDate(revision.submitted_at)}</span>
                              )}
                            </div>

                            <div className="sqgv-qcard__total-row">
                              <span className="sqgv-qcard__amount">
                                Toplam: {formatMoney(Number(revision.total_amount || 0), revision.currency)}
                              </span>
                              {revision.profitability_amount && canManage && (
                                <ProfitabilityBadge amount={revision.profitability_amount} percent={revision.profitability_percent} />
                              )}
                            </div>

                            <div className="sqgv-rcard__actions">
                              <button
                                onClick={() => onViewDetails(revision.id, supplier.supplier_name)}
                                className="sqgv-btn sqgv-btn--view"
                              >
                                Göster
                              </button>

                              {canManage && onApproveSupplierQuote && revision.status === "yanıtlandı" && (
                                <button
                                  onClick={() => onApproveSupplierQuote(revision.id, supplier.supplier_name)}
                                  disabled={loading || hasApprovedQuote}
                                  className={`sqgv-btn sqgv-btn--approve${hasApprovedQuote ? " sqgv-btn--approve-passive" : ""}${loading ? " sqgv-btn--loading" : ""}`}
                                >
                                  {hasApprovedQuote ? "Pasif" : "İş Onayı Ver"}
                                </button>
                              )}

                              {revision.status === "onaylandı" && (
                                <span className="sqgv-badge--approved">
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
