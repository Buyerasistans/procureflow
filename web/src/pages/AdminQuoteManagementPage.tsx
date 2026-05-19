// Admin Quote Management Page
import { useEffect, useState, useCallback } from "react";
import { getRfqs, approveRfq, rejectRfq } from "../services/quote.service";
import type { Rfq as Quote } from "../services/quote.service";
import { QuoteStatusLabel, QuoteStatusColor, normalizeQuoteStatus } from "../types/quote.types";

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

  if (loading) return <div style={{ textAlign: "center", padding: 20 }}>Yükleniyor...</div>;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Yönetici - RFQ / Teklif Yönetimi</h1>

      {error && (
        <div style={{ color: "red", padding: "12px", background: "#fee2e2", borderRadius: "4px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {selectedQuotes.size > 0 && (
        <div style={{ background: "#f0f4ff", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong>{selectedQuotes.size} RFQ / teklif seçili</strong>
            <button
              onClick={() => setSelectedQuotes(new Set())}
              style={{
                padding: "4px 8px",
                background: "transparent",
                border: "1px solid #3b82f6",
                color: "#3b82f6",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Temizle
            </button>
          </div>

          <textarea
            placeholder="İşlem notu (opsiyonel)"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              marginBottom: "12px",
              boxSizing: "border-box",
              minHeight: "60px",
            }}
          />

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleBulkApprove}
              style={{
                padding: "8px 16px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Toplu Onayla
            </button>
            <button
              onClick={handleBulkReject}
              style={{
                padding: "8px 16px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Toplu Reddet
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>
                <input
                  type="checkbox"
                  checked={selectedQuotes.size === quotes.length && quotes.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={{ padding: "12px", textAlign: "left" }}>ID</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Başlık</th>
              <th style={{ padding: "12px", textAlign: "right" }}>Tutar</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Durum</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Oluşturan</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const quoteStatus = normalizeQuoteStatus(quote.status);
              return (
              <tr
                key={quote.id}
                style={{
                  borderBottom: "1px solid #eee",
                  background: selectedQuotes.has(quote.id) ? "#f0f4ff" : "white",
                }}
              >
                <td style={{ padding: "12px" }}>
                  <input
                    type="checkbox"
                    checked={selectedQuotes.has(quote.id)}
                    onChange={() => toggleSelect(quote.id)}
                  />
                </td>
                <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "12px" }}>
                  #{quote.id}
                </td>
                <td style={{ padding: "12px" }}>{quote.title}</td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>
                  {(quote.total_amount ?? quote.amount ?? 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                </td>
                <td style={{ padding: "12px" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: QuoteStatusColor[quoteStatus],
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    {QuoteStatusLabel[quoteStatus]}
                  </span>
                </td>
                <td style={{ padding: "12px", fontSize: "12px" }}>
                  Kullanıcı #{quote.created_by_id}
                </td>
                <td style={{ padding: "12px", fontSize: "12px" }}>
                  {new Date(quote.created_at).toLocaleDateString("tr-TR")}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "20px",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: "8px 12px",
              background: page === 1 ? "#f3f4f6" : "white",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: page === 1 ? "not-allowed" : "pointer",
            }}
          >
            Önceki
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, page - 2) + i;
            return (
              pageNum <= totalPages && (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    padding: "8px 12px",
                    background: page === pageNum ? "#3b82f6" : "white",
                    color: page === pageNum ? "white" : "black",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: page === pageNum ? "bold" : "normal",
                  }}
                >
                  {pageNum}
                </button>
              )
            );
          })}

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: "8px 12px",
              background: page === totalPages ? "#f3f4f6" : "white",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: page === totalPages ? "not-allowed" : "pointer",
            }}
          >
            Sonraki
          </button>

          <span style={{ marginLeft: "12px", color: "#666", fontSize: "14px" }}>
            Sayfa {page} / {totalPages} (Toplam: {total})
          </span>
        </div>
      )}
    </div>
  );
}
