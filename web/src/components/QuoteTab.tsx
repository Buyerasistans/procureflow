import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeQuotes } from "../types/quote";
import type { Quote } from "../types/quote";
import { http } from "../lib/http";
import SendQuoteModal from "./SendQuoteModal";
import "./QuoteTab.css";

interface QuoteTabProps {
  projectId: number;
  apiUrl: string;
  authToken: string;
  readOnly?: boolean;
}

export function QuoteTab({ projectId, apiUrl, authToken, readOnly = false }: QuoteTabProps) {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSendForQuote, setShowSendForQuote] = useState<Quote | null>(null);
  const [projectSuppliers, setProjectSuppliers] = useState<Array<{ id: number; supplier_id: number; supplier_name: string; supplier_email: string; source_type?: "private" | "platform_network"; category?: string; is_active: boolean }>>([]);

  const handleViewClick = (quoteId: number) => {
    navigate(`/quotes/${quoteId}`);
  };

  const handleEditClick = (quoteId: number) => {
    if (readOnly) return;
    navigate(`/quotes/${quoteId}/edit`);
  };

  const handleDeleteClick = async (quoteId: number) => {
    if (readOnly) return;
    if (!window.confirm("Bu teklifi silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/quotes/${quoteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Teklif silinemedi");
      setSuccess("Teklif silindi");
      await loadQuotes();
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(String(err));
    }
  };

  const loadProjectSuppliers = async () => {
    const res = await http.get(`/suppliers/projects/${projectId}/suppliers`);
    setProjectSuppliers(Array.isArray(res.data) ? res.data : []);
  };

  const openSendModal = async (quote: Quote) => {
    if (readOnly) return;
    try {
      await loadProjectSuppliers();
      setShowSendForQuote(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projeye ekli tedarikçiler yüklenemedi");
    }
  };

  const statusLabelTr = (status?: string) => {
    const s = String(status || "DRAFT").toUpperCase();
    if (s === "DRAFT") return "Taslak";
    if (s === "SUBMITTED") return "Gönderildi";
    if (s === "SENT") return "Gönderildi";
    if (s === "PENDING") return "Onay Bekliyor";
    if (s === "RESPONDED") return "Yanıtlandı";
    if (s === "APPROVED") return "Onaylandı";
    if (s === "REJECTED") return "Reddedildi";
    return s;
  };

  const isReviewBackDraft = (quote: Quote) => {
    const s = String(quote.status || "draft").toLowerCase();
    const reason = String(quote.transition_reason || "").toLowerCase();
    return s === "draft" && reason.startsWith("hata ve eksikler var");
  };

  const canSendToSuppliers = (status?: string) => {
    const s = String(status || "draft").toLowerCase();
    return s === "submitted" || s === "sent";
  };

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${apiUrl}/api/v1/quotes/project/${projectId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (!response.ok) throw new Error("Teklifler yüklenemedi");
      const data = await response.json();
      setQuotes(normalizeQuotes(Array.isArray(data) ? data : []));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, apiUrl, authToken]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  if (loading) return <div className="quote-tab__loading">Yükleniyor...</div>;

  return (
    <div className="quote-tab">
      {error && <div className="quote-tab__message quote-tab__message--error">❌ {error}</div>}
      {success && <div className="quote-tab__message quote-tab__message--success">{success}</div>}

      {showSendForQuote && (
        <SendQuoteModal
          quote={showSendForQuote}
          quoteId={showSendForQuote.id}
          projectId={projectId}
          suppliers={projectSuppliers}
          onClose={() => setShowSendForQuote(null)}
          onSent={async () => {
            setSuccess("Teklif seçilen tedarikçilere gönderildi");
            await loadQuotes();
          }}
        />
      )}

      <div className="quote-tab__header">
        <h2 className="quote-tab__header-title">Teklifler ({quotes.length})</h2>
        {!readOnly && (
          <button
            type="button"
            className="quote-tab__button quote-tab__button--primary"
            onClick={() => navigate(`/quotes/create?projectId=${projectId}`)}
          >
            + Yeni Teklif
          </button>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="quote-tab__empty-state">
          <p>Henüz teklif oluşturulmamış</p>
        </div>
      ) : (
        <table className="quote-tab__table">
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Durum</th>
              <th>Gönderildi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td>
                  <div className="quote-tab__quote-title">{quote.title}</div>
                  <div className="quote-tab__quote-meta">RFQ #{quote.rfq_id ?? quote.id}</div>
                </td>
                <td>
                  <span className="quote-tab__status-badge">
                    {(() => {
                      if (isReviewBackDraft(quote)) return "İade Edildi (Gözden Geçirme)";
                      const raw = String(quote.status || "").toLowerCase();
                      const approvalsCompleted = String(quote.transition_reason || "").toLowerCase().includes("gönderim onayları tamamlandı");
                      if (raw === "approved") return "Teklif Sözleşme Aşamasına Geçti - Kapatıldı";
                      if (raw === "responded") return "Tedarikçi Yanıtladı";
                      if (quote.sent_at) return "Tedarikçiye Gönderildi - Yanıt Bekleniyor";
                      if (raw === "submitted" && approvalsCompleted) return "Onaylandı (Gönderime Hazır)";
                      return statusLabelTr(quote.status);
                    })()}
                  </span>
                  {isReviewBackDraft(quote) && (
                    <div className="quote-tab__quote-warning">{quote.transition_reason}</div>
                  )}
                </td>
                <td>
                  {quote.sent_at
                    ? new Date(quote.sent_at).toLocaleDateString("tr-TR")
                    : "-"}
                </td>
                <td>
                  {(() => {
                    const normalized = String(quote.status || "draft").toLowerCase();
                    const approvalsCompleted = String(quote.transition_reason || "").toLowerCase().includes("gönderim onayları tamamlandı");
                    const canEditQuote = (normalized === "draft" || normalized === "submitted")
                      && !approvalsCompleted
                      && !quote.sent_at;
                    return (
                      <div className="quote-tab__actions">
                        <button
                          type="button"
                          className="quote-tab__button quote-tab__button--info"
                          onClick={() => handleViewClick(quote.id)}
                        >
                          Görüntüle
                        </button>
                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              className="quote-tab__button quote-tab__button--success"
                              onClick={() => handleEditClick(quote.id)}
                              disabled={!canEditQuote}
                              title={canEditQuote ? "Teklifi düzenle" : "Onaylanan teklif düzenlenemez"}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="quote-tab__button quote-tab__button--info"
                              onClick={() => openSendModal(quote)}
                              disabled={!canSendToSuppliers(quote.status)}
                              title={canSendToSuppliers(quote.status) ? "Teklifi tedarikçilere gönder" : "Bu durumda teklif tekrar gönderilemez"}
                            >
                              Gönder
                            </button>
                            <button
                              type="button"
                              className="quote-tab__button quote-tab__button--danger"
                              onClick={() => handleDeleteClick(quote.id)}
                            >
                              Sil
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
