import { useCallback, useEffect, useMemo, useState } from "react";
import { ContractPortal } from "./ContractPortal";
import "./QuoteComparisonDashboard.css";

interface SupplierResponse {
  supplier_id: number;
  supplier_name: string;
  supplier_contact?: string;
  status: string;
  total_amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  payment_terms?: string;
  delivery_time?: number;
  warranty?: string;
  submitted_at?: string;
}

interface QuoteComparisonDashboardProps {
  quoteId: number;
  apiUrl: string;
  authToken: string;
  supplierId?: number;
  supplierName?: string;
}

type SortBy = "price" | "delivery" | "name";
type FilterStatus = "all" | "yanıtlandı" | "tasarı";
type ActiveTab = "comparison" | "contract";

const STATUS_META: Record<string, { label: string; className: string }> = {
  tasarı: {
    label: "Tasarı",
    className: "quote-comparison-dashboard__status-badge--draft",
  },
  gönderilen: {
    label: "Gönderilen",
    className: "quote-comparison-dashboard__status-badge--sent",
  },
  yanıtlandı: {
    label: "Yanıtlandı",
    className: "quote-comparison-dashboard__status-badge--responded",
  },
};

const LEGEND_ITEMS = [
  {
    label: "En Düşük Fiyat",
    className: "quote-comparison-dashboard__legend-dot--best",
  },
  {
    label: "Competitive",
    className: "quote-comparison-dashboard__legend-dot--second",
  },
  {
    label: "Diğer",
    className: "quote-comparison-dashboard__legend-dot--other",
  },
] as const;

export function QuoteComparisonDashboard({
  quoteId,
  apiUrl,
  authToken,
  supplierId,
  supplierName = "Tedarikçi",
}: QuoteComparisonDashboardProps) {
  const [responses, setResponses] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("price");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("yanıtlandı");
  const [activeTab, setActiveTab] = useState<ActiveTab>("comparison");

  const loadResponses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${apiUrl}/api/v1/supplier-quotes/quote/${quoteId}/responses`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Tedarikçi yanıtları yüklenemedi");
      }

      const data = await response.json();
      setResponses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [quoteId, apiUrl, authToken]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const sortedResponses = useMemo(() => {
    const filtered = responses.filter(
      (item) => filterStatus === "all" || item.status === filterStatus,
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "price") {
        return a.final_amount - b.final_amount;
      }

      if (sortBy === "delivery") {
        return (a.delivery_time || 999) - (b.delivery_time || 999);
      }

      return a.supplier_name.localeCompare(b.supplier_name);
    });
  }, [responses, sortBy, filterStatus]);

  const minPrice = useMemo(() => {
    if (sortedResponses.length === 0) return 0;
    return Math.min(...sortedResponses.map((item) => item.final_amount));
  }, [sortedResponses]);

  const maxPrice = useMemo(() => {
    if (sortedResponses.length === 0) return 0;
    return Math.max(...sortedResponses.map((item) => item.final_amount));
  }, [sortedResponses]);

  const getStatusMeta = (status: string) => {
    const normalized = status.toLowerCase();
    return STATUS_META[normalized] ?? {
      label: status,
      className: "quote-comparison-dashboard__status-badge",
    };
  };

  const getBarClassName = (item: SupplierResponse) => {
    if (item.final_amount === minPrice) {
      return "quote-comparison-dashboard__bar-value quote-comparison-dashboard__bar-value--best";
    }

    return "quote-comparison-dashboard__bar-value";
  };

  const getBarColorClass = (item: SupplierResponse, index: number) => {
    if (item.final_amount === minPrice) {
      return "quote-comparison-dashboard__bar--best";
    }

    if (index < 2) {
      return "quote-comparison-dashboard__bar--second";
    }

    return "quote-comparison-dashboard__bar--other";
  };

  if (loading) {
    return <div className="quote-comparison-dashboard">Yükleniyor...</div>;
  }

  return (
    <div className="quote-comparison-dashboard">
      <header className="quote-comparison-dashboard__header">
        <h2 className="quote-comparison-dashboard__title">📊 Teklif Yönetimi</h2>
        <p className="quote-comparison-dashboard__description">
          Tedarikçilerin verdikleri fiyatları karşılaştırın ve sözleşme oluşturun
        </p>
      </header>

      <div className="quote-comparison-dashboard__tabs">
        <button
          type="button"
          className={`quote-comparison-dashboard__tab ${
            activeTab === "comparison" ? "quote-comparison-dashboard__tab--active" : ""
          }`}
          onClick={() => setActiveTab("comparison")}
        >
          📊 Karşılaştırma
        </button>
        <button
          type="button"
          className={`quote-comparison-dashboard__tab ${
            activeTab === "contract" ? "quote-comparison-dashboard__tab--active" : ""
          }`}
          onClick={() => setActiveTab("contract")}
        >
          📄 Sözleşmeler
        </button>
      </div>

      {activeTab === "comparison" ? (
        <>
          {error && <div className="quote-comparison-dashboard__error">❌ {error}</div>}

          {responses.length === 0 ? (
            <div className="quote-comparison-dashboard__empty">
              <p>Henüz tedarikçi yanıtı alınmamış</p>
            </div>
          ) : (
            <>
              <div className="quote-comparison-dashboard__filters">
                <button
                  type="button"
                  className={`quote-comparison-dashboard__filter-button ${
                    filterStatus === "all"
                      ? "quote-comparison-dashboard__filter-button--active"
                      : ""
                  }`}
                  onClick={() => setFilterStatus("all")}
                >
                  Tümü ({responses.length})
                </button>
                <button
                  type="button"
                  className={`quote-comparison-dashboard__filter-button ${
                    filterStatus === "yanıtlandı"
                      ? "quote-comparison-dashboard__filter-button--active"
                      : ""
                  }`}
                  onClick={() => setFilterStatus("yanıtlandı")}
                >
                  Yanıtlandı (
                  {responses.filter((item) => item.status === "yanıtlandı").length})
                </button>
                <button
                  type="button"
                  className={`quote-comparison-dashboard__filter-button ${
                    filterStatus === "tasarı"
                      ? "quote-comparison-dashboard__filter-button--active"
                      : ""
                  }`}
                  onClick={() => setFilterStatus("tasarı")}
                >
                  Tasarı ({responses.filter((item) => item.status === "tasarı").length})
                </button>
              </div>

              <section className="quote-comparison-dashboard__card">
                <div className="quote-comparison-dashboard__sorting">
                  <strong className="quote-comparison-dashboard__sorting-title">
                    Sıralama:
                  </strong>
                  <div className="quote-comparison-dashboard__sorting-buttons">
                    <button
                      type="button"
                      className={`quote-comparison-dashboard__filter-button ${
                        sortBy === "price"
                          ? "quote-comparison-dashboard__filter-button--active"
                          : ""
                      }`}
                      onClick={() => setSortBy("price")}
                    >
                      💰 Fiyata Göre
                    </button>
                    <button
                      type="button"
                      className={`quote-comparison-dashboard__filter-button ${
                        sortBy === "delivery"
                          ? "quote-comparison-dashboard__filter-button--active"
                          : ""
                      }`}
                      onClick={() => setSortBy("delivery")}
                    >
                      📦 Teslimat Süresine Göre
                    </button>
                    <button
                      type="button"
                      className={`quote-comparison-dashboard__filter-button ${
                        sortBy === "name"
                          ? "quote-comparison-dashboard__filter-button--active"
                          : ""
                      }`}
                      onClick={() => setSortBy("name")}
                    >
                      🏢 Tedarikçiye Göre
                    </button>
                  </div>
                </div>
              </section>

              <section className="quote-comparison-dashboard__card">
                <h3 className="quote-comparison-dashboard__sorting-title">
                  Fiyat Karşılaştırması
                </h3>

                <div className="quote-comparison-dashboard__chart">
                  {sortedResponses.map((item, index) => {
                    const normalizedHeight =
                      ((item.final_amount - minPrice) / (maxPrice - minPrice || 1)) *
                        100 +
                      (maxPrice - minPrice === 0 ? 50 : 0);

                    return (
                      <div
                        key={item.supplier_id}
                        className="quote-comparison-dashboard__bar-group"
                      >
                        <svg
                          className="quote-comparison-dashboard__bar-svg"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="20"
                            width="60"
                            y={100 - normalizedHeight}
                            height={normalizedHeight}
                            rx="4"
                            className={getBarColorClass(item, index)}
                          />
                        </svg>
                        <div className="quote-comparison-dashboard__bar-label">
                          {item.supplier_name}
                        </div>
                        <div className={getBarClassName(item)}>
                          ₺
                          {item.final_amount.toLocaleString("tr-TR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="quote-comparison-dashboard__legend">
                  {LEGEND_ITEMS.map((item) => (
                    <div
                      key={item.label}
                      className="quote-comparison-dashboard__legend-item"
                    >
                      <span
                        className={`quote-comparison-dashboard__legend-dot ${item.className}`}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="quote-comparison-dashboard__card">
                <h3 className="quote-comparison-dashboard__sorting-title">
                  Detaylı Karşılaştırma
                </h3>

                <table className="quote-comparison-dashboard__table">
                  <thead>
                    <tr>
                      <th>🏢 Tedarikçi</th>
                      <th>{sortBy === "price" ? "💰" : ""} Toplam Fiyat</th>
                      <th>% İndirim</th>
                      <th>{sortBy === "price" ? "⭐" : ""} Final Fiyat</th>
                      <th>{sortBy === "delivery" ? "⭐" : ""} Teslimat (Gün)</th>
                      <th>💳 Ödeme</th>
                      <th>Garanti</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResponses.map((item) => {
                      const statusMeta = getStatusMeta(item.status);

                      return (
                        <tr key={item.supplier_id}>
                          <td>
                            <strong>{item.supplier_name}</strong>
                            {item.supplier_contact && (
                              <div className="quote-comparison-dashboard__bar-label">
                                {item.supplier_contact}
                              </div>
                            )}
                          </td>
                          <td>
                            ₺
                            {item.total_amount.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            {item.discount_percent > 0 && (
                              <>
                                {item.discount_percent.toFixed(2)}%{" "}
                                <span className="quote-comparison-dashboard__bar-label">
                                  (-₺
                                  {item.discount_amount.toLocaleString("tr-TR", {
                                    minimumFractionDigits: 2,
                                  })}
                                  )
                                </span>
                              </>
                            )}
                          </td>
                          <td>
                            <strong className={getBarClassName(item)}>
                              ₺
                              {item.final_amount.toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                              })}
                            </strong>
                          </td>
                          <td>
                            {item.delivery_time ? (
                              `${item.delivery_time} gün`
                            ) : (
                              <span className="quote-comparison-dashboard__contract-placeholder">
                                -
                              </span>
                            )}
                          </td>
                          <td>
                            {item.payment_terms ? (
                              <span className="quote-comparison-dashboard__bar-label">
                                {item.payment_terms}
                              </span>
                            ) : (
                              <span className="quote-comparison-dashboard__contract-placeholder">
                                -
                              </span>
                            )}
                          </td>
                          <td>
                            {item.warranty ? (
                              <span className="quote-comparison-dashboard__bar-label">
                                {item.warranty}
                              </span>
                            ) : (
                              <span className="quote-comparison-dashboard__contract-placeholder">
                                -
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={statusMeta.className}>
                              {statusMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="quote-comparison-dashboard__card quote-comparison-dashboard__card--recommendations">
                <h3 className="quote-comparison-dashboard__recommendations-title">
                  ✅ Öneriler
                </h3>
                <ul className="quote-comparison-dashboard__recommendations-list">
                  <li>
                    En düşük fiyat:{" "}
                    <strong>{sortedResponses[0]?.supplier_name}</strong> (
                    ₺
                    {sortedResponses[0]?.final_amount.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                    })}
                    )
                  </li>
                  {sortedResponses[0]?.delivery_time && (
                    <li>
                      En hızlı teslimat:{" "}
                      <strong>{sortedResponses[0]?.supplier_name}</strong> (
                      {sortedResponses[0]?.delivery_time} gün)
                    </li>
                  )}
                  <li>Toplam {sortedResponses.length} tedarikçiden yanıt alındı</li>
                </ul>
              </section>
            </>
          )}
        </>
      ) : supplierId ? (
        <ContractPortal
          quoteId={quoteId}
          supplierId={supplierId}
          supplierName={supplierName}
        />
      ) : (
        <div className="quote-comparison-dashboard__card">
          <p className="quote-comparison-dashboard__contract-placeholder">
            Sözleşme oluşturmak için bir tedarikçi seçiniz
          </p>
        </div>
      )}
    </div>
  );
}
