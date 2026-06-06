// Admin Quote Management Page
import React, { useEffect, useState, useCallback } from "react";
import { getRfqs, approveRfq, rejectRfq } from "../services/quote.service";
import type { Rfq as Quote } from "../services/quote.service";
import { QuoteStatusLabel, QuoteStatusColor, normalizeQuoteStatus } from "../types/quote.types";
import "./AdminQuoteManagementPage.css";

export default function AdminQuoteManagementPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedQuotes, setSelectedQuotes] = useState<Set<number>>(new Set());
  const [actionReason, setActionReason] = useState("");

  const PAGE_SIZE = 20;

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getRfqs(page, PAGE_SIZE);
      setQuotes(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedQuotes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuotes(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedQuotes.size === quotes.length) {
      setSelectedQuotes(new Set());
    } else {
      setSelectedQuotes(new Set(quotes.map((q) => q.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedQuotes.size === 0) {
      setError("Lütfen en az bir teklif seçiniz");
      return;
    }

    try {
      for (const id of selectedQuotes) {
        await approveRfq(id, actionReason ? { reason: actionReason } : undefined);
      }
      setSelectedQuotes(new Set());
      setActionReason("");
      await fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay işlemi başarısız");
    }
  };

  const handleBulkReject = async () => {
    if (selectedQuotes.size === 0) {
      setError("Lütfen en az bir teklif seçiniz");
      return;
    }

    if (!window.confirm(`${selectedQuotes.size} teklifi reddetmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      for (const id of selectedQuotes) {
        await rejectRfq(id, actionReason ? { reason: actionReason } : undefined);
      }
      setSelectedQuotes(new Set());
      setActionReason("");
      await fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddetme işlemi başarısız");
    }
  };

  if (loading) return <div className="aqm-loading">Yükleniyor...</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="aqm-root">
      <h1>Yönetici - RFQ / Teklif Yönetimi</h1>

      {error && (
        <div className="aqm-error">{error}</div>
      )}

      {selectedQuotes.size > 0 && (
        <div className="aqm-selection-panel">
          <div className="aqm-selection-header">
            <strong>{selectedQuotes.size} RFQ / teklif seçili</strong>
            <button
              type="button"
              onClick={() => setSelectedQuotes(new Set())}
              className="aqm-clear-btn"
            >
              Temizle
            </button>
          </div>

          <textarea
            placeholder="İşlem notu (opsiyonel)"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            className="aqm-reason-textarea"
          />

          <div className="aqm-action-row">
            <button type="button" onClick={handleBulkApprove} className="aqm-approve-btn">
              Toplu Onayla
            </button>
            <button type="button" onClick={handleBulkReject} className="aqm-reject-btn">
              Toplu Reddet
            </button>
          </div>
        </div>
      )}

      <div className="aqm-table-wrap">
        <table className="aqm-table">
          <thead>
            <tr className="aqm-thead-row">
              <th className="aqm-th">
                <input
                  type="checkbox"
                  aria-label="Tümünü seç"
                  checked={selectedQuotes.size === quotes.length && quotes.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="aqm-th">ID</th>
              <th className="aqm-th">Başlık</th>
              <th className="aqm-th aqm-th--right">Tutar</th>
              <th className="aqm-th">Durum</th>
              <th className="aqm-th">Oluşturan</th>
              <th className="aqm-th">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const quoteStatus = normalizeQuoteStatus(quote.status);
              return (
                <tr
                  key={quote.id}
                  className={selectedQuotes.has(quote.id) ? "aqm-row aqm-row--selected" : "aqm-row"}
                >
                  <td className="aqm-td">
                    <input
                      type="checkbox"
                      checked={selectedQuotes.has(quote.id)}
                      onChange={() => toggleSelect(quote.id)}
                    />
                  </td>
                  <td className="aqm-td--mono">#{quote.id}</td>
                  <td className="aqm-td">{quote.title}</td>
                  <td className="aqm-td--amount">
                    {(quote.total_amount ?? quote.amount ?? 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                  </td>
                  <td className="aqm-td">
                    <span
                      className="aqm-status-badge"
                      style={{ "--aqm-status-bg": QuoteStatusColor[quoteStatus] } as React.CSSProperties}
                    >
                      {QuoteStatusLabel[quoteStatus]}
                    </span>
                  </td>
                  <td className="aqm-td--sm">Kullanıcı #{quote.created_by_id}</td>
                  <td className="aqm-td--sm">
                    {new Date(quote.created_at).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="aqm-pagination">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="aqm-page-nav"
          >
            Önceki
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, page - 2) + i;
            return (
              pageNum <= totalPages && (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={page === pageNum ? "aqm-page-btn aqm-page-btn--active" : "aqm-page-btn"}
                >
                  {pageNum}
                </button>
              )
            );
          })}

          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="aqm-page-nav"
          >
            Sonraki
          </button>

          <span className="aqm-page-info">
            Sayfa {page} / {totalPages} (Toplam: {total})
          </span>
        </div>
      )}
    </div>
  );
}
