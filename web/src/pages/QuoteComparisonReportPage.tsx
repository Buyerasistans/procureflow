import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  approveSupplierQuote,
  downloadQuoteComparisonXlsx,
  getRfqComparisonDetailedReport,
  type RfqComparisonDetailedReport as QuoteComparisonDetailedReport,
} from "../services/quote.service";
import { useAuth } from "../hooks/useAuth";
import { canManageQuoteWorkspace, isPlatformStaffUser } from "../auth/permissions";

const page: CSSProperties = {
  background: "#f8fafc",
  minHeight: "100%",
  padding: "20px",
};

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "16px",
};

const statusLabel = (value: string) => {
  const map: Record<string, string> = {
    tasarı: "Taslak",
    gönderilen: "Gönderildi",
    yanıtlandı: "Yanıtlandı",
    revize_edildi: "Revize İstendi",
    onaylandı: "Onaylandı",
    kapatıldı_yüksek_fiyat: "Kapatıldı (Yüksek Fiyat)",
    reddedildi: "Reddedildi",
  };
  return map[value] || value;
};

const money = (val: number) =>
  `₺${Number(val || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function QuoteComparisonReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const readOnly = isPlatformStaffUser(user);

  const [report, setReport] = useState<QuoteComparisonDetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const quoteId = Number(id || 0);
  const canManage = canManageQuoteWorkspace(user);
  const reportRfqId = report?.quote.rfq_id ?? report?.quote.id ?? quoteId;
  const adminReturnHref = useMemo(() => {
    const adminTab = searchParams.get("adminTab");
    if (!adminTab) return null;
    const params = new URLSearchParams({ tab: adminTab });
    const tenantFocusId = searchParams.get("tenantFocusId");
    const tenantFocusName = searchParams.get("tenantFocusName");
    const projectFocusName = searchParams.get("projectFocusName");
    const quoteFocusId = searchParams.get("quoteFocusId");
    if (tenantFocusId) params.set("tenantFocusId", tenantFocusId);
    if (tenantFocusName) params.set("tenantFocusName", tenantFocusName);
    if (projectFocusName) params.set("projectFocusName", projectFocusName);
    if (quoteFocusId) params.set("quoteFocusId", quoteFocusId);
    return `/admin?${params.toString()}`;
  }, [searchParams]);

  const loadReport = useCallback(async () => {
    if (!quoteId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getRfqComparisonDetailedReport(quoteId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Karşılaştırma raporu yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const approvedSupplier = useMemo(
    () => report?.suppliers.find((s) => s.approved) ?? null,
    [report]
  );

  const onApprove = async (supplierQuoteId: number, supplierName: string) => {
    if (!report || !canManage) return;
    if (!window.confirm(`${supplierName} teklifi için iş onayı vermek istiyor musunuz?`)) return;
    try {
      setBusy(true);
      await approveSupplierQuote(quoteId, supplierQuoteId);
      await loadReport();
      alert("İş onayı verildi. Seçilen tedarikçi sözleşme aşamasına geçti.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Onay işlemi başarısız");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadExcel = async () => {
    try {
      setBusy(true);
      const blob = await downloadQuoteComparisonXlsx(quoteId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rfq_${reportRfqId}_karsilastirma_raporu.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Excel raporu indirilemedi");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div style={page}>Rapor yükleniyor...</div>;
  }

  if (error) {
    return (
      <div style={page}>
        <div style={{ ...card, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!report) {
    return <div style={page}>Rapor bulunamadı.</div>;
  }

  return (
    <div style={page}>
      <div style={{ ...card, marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", color: "#0f172a" }}>Karşılaştırma Raporu</h2>
            <div style={{ color: "#64748b", marginTop: "4px" }}>
              {report.quote.title} • RFQ #{reportRfqId} • Teklif #{report.quote.id}
            </div>
            {adminReturnHref ? (
              <a href={adminReturnHref} style={{ display: "inline-block", marginTop: "8px", color: "#1d4ed8", fontSize: "13px", fontWeight: 700, textDecoration: "none" }}>
                Admin odagina don
              </a>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate(`/quotes/${quoteId}`)}
              style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}
            >
              Teklif Detayına Dön
            </button>
            <button
              type="button"
              onClick={onDownloadExcel}
              disabled={busy}
              style={{ padding: "8px 12px", border: "none", borderRadius: "6px", background: "#1d4ed8", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
            >
              Excel Olarak İndir
            </button>
          </div>
        </div>
      </div>

      {readOnly && (
        <div style={{ ...card, marginBottom: "12px", borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e3a8a" }}>
          Platform personeli karsilastirma raporunu inceleyebilir; tedarikci secimi ve is onayi gibi write aksiyonlari salt okunur modda kapatildi.
        </div>
      )}

      {approvedSupplier && (
        <div style={{ ...card, marginBottom: "12px", borderColor: "#86efac", background: "#ecfdf5", color: "#166534" }}>
          Onaylanan tedarikçi: <strong>{approvedSupplier.supplier_name}</strong> ({money(approvedSupplier.final_amount)})
          <div style={{ marginTop: "4px", fontSize: "13px" }}>
            Bu teklif sözleşme aşamasına geçti. Diğer teklifler pasif konumdadır.
          </div>
        </div>
      )}

      <div style={{ ...card, marginBottom: "12px", overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Tedarikçi Final Tutar Karşılaştırması</h3>
        <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Tedarikçi</th>
              <th style={{ textAlign: "right", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Revizyon</th>
              <th style={{ textAlign: "right", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Toplam</th>
              <th style={{ textAlign: "right", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>İndirim</th>
              <th style={{ textAlign: "right", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Final</th>
              <th style={{ textAlign: "right", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Teslimat (Gün)</th>
              <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Durum</th>
              {canManage && (
                <th style={{ textAlign: "center", padding: "10px", borderBottom: "1px solid #e2e8f0" }}>İşlem</th>
              )}
            </tr>
          </thead>
          <tbody>
            {report.suppliers.map((supplier) => {
              const actionDisabled = busy || supplier.status !== "yanıtlandı" || (Boolean(approvedSupplier) && !supplier.approved);
              return (
                <tr key={supplier.supplier_quote_id}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{supplier.supplier_name}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{supplier.revision_number}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{money(supplier.total_amount)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{money(supplier.discount_amount)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#1e40af", fontWeight: 700 }}>{money(supplier.final_amount)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>{supplier.delivery_time || "-"}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{statusLabel(supplier.status)}</td>
                  {canManage && (
                    <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      {supplier.approved ? (
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontWeight: 700 }}>
                          Onaylandı
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApprove(supplier.supplier_quote_id, supplier.supplier_name)}
                          disabled={actionDisabled}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "none",
                            background: actionDisabled ? "#e2e8f0" : "#16a34a",
                            color: actionDisabled ? "#64748b" : "#fff",
                            cursor: actionDisabled ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {approvedSupplier ? "Pasif" : "İş Onayı Ver"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Kalem Bazlı Karşılaştırma</h3>
        <table style={{ width: "100%", minWidth: `${740 + report.suppliers.length * 190}px`, borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#e2e8f0" }}>
              <th rowSpan={2} style={{ padding: "8px", border: "1px solid #cbd5e1", minWidth: "56px" }}>Sıra</th>
              <th rowSpan={2} style={{ padding: "8px", border: "1px solid #cbd5e1", minWidth: "320px", textAlign: "left" }}>Açıklama</th>
              <th rowSpan={2} style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Birim</th>
              <th rowSpan={2} style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Miktar</th>
              <th rowSpan={2} style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Tahmini Birim Fiyat</th>
              {report.suppliers.map((supplier) => (
                <th
                  key={`head-${supplier.supplier_quote_id}`}
                  colSpan={2}
                  style={{ padding: "8px", border: "1px solid #cbd5e1", background: "#dbeafe" }}
                >
                  {supplier.supplier_name}
                </th>
              ))}
            </tr>
            <tr style={{ background: "#eff6ff" }}>
              {report.suppliers.map((supplier) => (
                <Fragment key={`subhead-${supplier.supplier_quote_id}`}>
                  <th key={`u-${supplier.supplier_quote_id}`} style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Birim Fiyat</th>
                  <th key={`t-${supplier.supplier_quote_id}`} style={{ padding: "8px", border: "1px solid #cbd5e1" }}>Birim Toplam</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.quote_item_id} style={{ background: item.is_group_header ? "#fef3c7" : "#fff" }}>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: item.is_group_header ? 700 : 500 }}>
                  {item.line_number}
                </td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", fontWeight: item.is_group_header ? 700 : 400 }}>
                  <div>{item.description}</div>
                  {item.detail && (
                    <div style={{ marginTop: "4px", color: "#64748b", fontSize: "12px" }}>{item.detail}</div>
                  )}
                </td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                  {item.is_group_header ? "" : item.unit}
                </td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                  {item.is_group_header ? "" : item.quantity}
                </td>
                <td style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                  {item.is_group_header ? "" : money(item.base_unit_price)}
                </td>
                {report.suppliers.map((supplier) => {
                  const price = item.supplier_prices[String(supplier.supplier_quote_id)] || {
                    unit_price: null,
                    total_price: null,
                  };
                  return (
                    <Fragment key={`prices-${item.quote_item_id}-${supplier.supplier_quote_id}`}>
                      <td key={`uu-${item.quote_item_id}-${supplier.supplier_quote_id}`} style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                        {item.is_group_header || price.unit_price == null ? "" : money(price.unit_price)}
                      </td>
                      <td key={`tt-${item.quote_item_id}-${supplier.supplier_quote_id}`} style={{ padding: "8px", border: "1px solid #e2e8f0", textAlign: "right" }}>
                        {item.is_group_header || price.total_price == null ? "" : money(price.total_price)}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
