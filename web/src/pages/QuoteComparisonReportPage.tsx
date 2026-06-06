import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  approveSupplierQuote,
  downloadQuoteComparisonXlsx,
  getRfqComparisonDetailedReport,
  type RfqComparisonDetailedReport as QuoteComparisonDetailedReport,
} from "../services/quote.service";
import { useAuth } from "../hooks/useAuth";
import { canManageQuoteWorkspace, isPlatformStaffUser } from "../auth/permissions";
import "./QuoteComparisonReportPage.css";

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
    return <div className="qcr-root">Rapor yükleniyor...</div>;
  }

  if (error) {
    return (
      <div className="qcr-root">
        <div className="qcr-card qcr-card--error">{error}</div>
      </div>
    );
  }

  if (!report) {
    return <div className="qcr-root">Rapor bulunamadı.</div>;
  }

  return (
    <div className="qcr-root">
      <div className="qcr-card">
        <div className="qcr-header">
          <div>
            <h2 className="qcr-page-title">Karşılaştırma Raporu</h2>
            <div className="qcr-subtitle">
              {report.quote.title} • RFQ #{reportRfqId} • Teklif #{report.quote.id}
            </div>
            {adminReturnHref ? (
              <a href={adminReturnHref} className="qcr-admin-return-link">
                Admin odagina don
              </a>
            ) : null}
          </div>
          <div className="qcr-header-actions">
            <button
              type="button"
              onClick={() => navigate(`/quotes/${quoteId}`)}
              className="qcr-back-btn"
            >
              Teklif Detayına Dön
            </button>
            <button
              type="button"
              onClick={onDownloadExcel}
              disabled={busy}
              className="qcr-download-btn"
            >
              Excel Olarak İndir
            </button>
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="qcr-card qcr-card--readonly">
          Platform personeli karsilastirma raporunu inceleyebilir; tedarikci secimi ve is onayı gibi write aksiyonlari salt okunur modda kapatildi.
        </div>
      )}

      {approvedSupplier && (
        <div className="qcr-card qcr-card--approved">
          Onaylanan tedarikçi: <strong>{approvedSupplier.supplier_name}</strong> ({money(approvedSupplier.final_amount)})
          <div className="qcr-approved-detail">
            Bu teklif sözleşme aşamasına geçti. Diğer teklifler pasif konumdadır.
          </div>
        </div>
      )}

      <div className="qcr-card qcr-table-wrap">
        <h3 className="qcr-summary-title">Tedarikçi Final Tutar Karşılaştırması</h3>
        <table className="qcr-summary-table">
          <thead>
            <tr className="qcr-summary-thead-row">
              <th className="qcr-th">Tedarikçi</th>
              <th className="qcr-th qcr-th--right">Revizyon</th>
              <th className="qcr-th qcr-th--right">Toplam</th>
              <th className="qcr-th qcr-th--right">İndirim</th>
              <th className="qcr-th qcr-th--right">Final</th>
              <th className="qcr-th qcr-th--right">Teslimat (Gün)</th>
              <th className="qcr-th">Durum</th>
              {canManage && (
                <th className="qcr-th qcr-th--center">İşlem</th>
              )}
            </tr>
          </thead>
          <tbody>
            {report.suppliers.map((supplier) => {
              const actionDisabled = busy || supplier.status !== "yanıtlandı" || (Boolean(approvedSupplier) && !supplier.approved);
              return (
                <tr key={supplier.supplier_quote_id}>
                  <td className="qcr-td qcr-td--name">{supplier.supplier_name}</td>
                  <td className="qcr-td qcr-td--right">{supplier.revision_number}</td>
                  <td className="qcr-td qcr-td--right">{money(supplier.total_amount)}</td>
                  <td className="qcr-td qcr-td--right">{money(supplier.discount_amount)}</td>
                  <td className="qcr-td qcr-td--final">{money(supplier.final_amount)}</td>
                  <td className="qcr-td qcr-td--right">{supplier.delivery_time || "-"}</td>
                  <td className="qcr-td">{statusLabel(supplier.status)}</td>
                  {canManage && (
                    <td className="qcr-td qcr-td--center">
                      {supplier.approved ? (
                        <span className="qcr-approved-badge">Onaylandı</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onApprove(supplier.supplier_quote_id, supplier.supplier_name)}
                          disabled={actionDisabled}
                          className="qcr-approve-btn"
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

      <div className="qcr-card qcr-table-wrap">
        <h3 className="qcr-detail-title">Kalem Bazlı Karşılaştırma</h3>
        <table
          className="qcr-detail-table"
          style={{ "--qcr-detail-min-width": `${740 + report.suppliers.length * 190}px` } as React.CSSProperties}
        >
          <thead>
            <tr className="qcr-dheader-row-1">
              <th rowSpan={2} className="qcr-dth">Sıra</th>
              <th rowSpan={2} className="qcr-dth qcr-dth--left">Açıklama</th>
              <th rowSpan={2} className="qcr-dth">Birim</th>
              <th rowSpan={2} className="qcr-dth">Miktar</th>
              <th rowSpan={2} className="qcr-dth">Tahmini Birim Fiyat</th>
              {report.suppliers.map((supplier) => (
                <th
                  key={`head-${supplier.supplier_quote_id}`}
                  colSpan={2}
                  className="qcr-dth qcr-dth--supplier"
                >
                  {supplier.supplier_name}
                </th>
              ))}
            </tr>
            <tr className="qcr-dheader-row-2">
              {report.suppliers.map((supplier) => (
                <Fragment key={`subhead-${supplier.supplier_quote_id}`}>
                  <th key={`u-${supplier.supplier_quote_id}`} className="qcr-dth">Birim Fiyat</th>
                  <th key={`t-${supplier.supplier_quote_id}`} className="qcr-dth">Birim Toplam</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.items.map((item) => (
              <tr key={item.quote_item_id} className={item.is_group_header ? "qcr-item-row qcr-item-row--header" : "qcr-item-row"}>
                <td className="qcr-dtd qcr-dtd--line">
                  {item.line_number}
                </td>
                <td className="qcr-dtd qcr-dtd--desc">
                  <div>{item.description}</div>
                  {item.detail && (
                    <div className="qcr-item-detail">{item.detail}</div>
                  )}
                </td>
                <td className="qcr-dtd">
                  {item.is_group_header ? "" : item.unit}
                </td>
                <td className="qcr-dtd qcr-dtd--right">
                  {item.is_group_header ? "" : item.quantity}
                </td>
                <td className="qcr-dtd qcr-dtd--right">
                  {item.is_group_header ? "" : money(item.base_unit_price)}
                </td>
                {report.suppliers.map((supplier) => {
                  const price = item.supplier_prices[String(supplier.supplier_quote_id)] || {
                    unit_price: null,
                    total_price: null,
                  };
                  return (
                    <Fragment key={`prices-${item.quote_item_id}-${supplier.supplier_quote_id}`}>
                      <td key={`uu-${item.quote_item_id}-${supplier.supplier_quote_id}`} className="qcr-dtd qcr-dtd--right">
                        {item.is_group_header || price.unit_price == null ? "" : money(price.unit_price)}
                      </td>
                      <td key={`tt-${item.quote_item_id}-${supplier.supplier_quote_id}`} className="qcr-dtd qcr-dtd--right">
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
