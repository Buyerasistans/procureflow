import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createAdminSupplierFinanceInvoice,
  createAdminSupplierFinancePayment,
  createAdminSupplierFinancePhoto,
  deleteAdminSupplierFinanceInvoice,
  deleteAdminSupplierFinancePayment,
  deleteAdminSupplierFinancePhoto,
  getAdminSupplierFinanceSummary,
  getAdminSupplierManagementDetail,
  updateAdminSupplierFinanceInvoice,
  updateAdminSupplierFinancePayment,
  updateAdminSupplierFinancePhoto,
  type SupplierFinanceSummary,
} from "../services/admin.service";
import "./AdminSupplierFinancePage.css";

export default function AdminSupplierFinancePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [finance, setFinance] = useState<SupplierFinanceSummary | null>(null);

  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [paymentTitle, setPaymentTitle] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const [photoTitle, setPhotoTitle] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const loadFinance = useCallback(async () => {
    const summary = await getAdminSupplierFinanceSummary(supplierId, {
      query: query || undefined,
      date_from: from || undefined,
      date_to: to || undefined,
    });
    setFinance(summary);
  }, [supplierId, query, from, to]);

  useEffect(() => {
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      setError("Geçersiz tedarikçi numarası");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const [detail] = await Promise.all([getAdminSupplierManagementDetail(supplierId), loadFinance()]);
        setSupplierName(detail.supplier.company_name || `#${supplierId}`);
      } catch {
        setError("Finans verileri yuklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [supplierId, loadFinance]);

  async function handleAddInvoice() {
    const amount = Number(invoiceAmount);
    if (!invoiceTitle || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await createAdminSupplierFinanceInvoice(supplierId, { title: invoiceTitle, amount, invoice_date: invoiceDate || undefined, file: invoiceFile || undefined });
      setInvoiceTitle("");
      setInvoiceAmount("");
      setInvoiceDate("");
      setInvoiceFile(null);
      await loadFinance();
      setSuccess("Fatura eklendi");
      setError(null);
    } catch {
      setError("Fatura eklenemedi");
    }
  }

  async function handleAddPayment() {
    const amount = Number(paymentAmount);
    if (!paymentTitle || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await createAdminSupplierFinancePayment(supplierId, { title: paymentTitle, amount, payment_date: paymentDate || undefined });
      setPaymentTitle("");
      setPaymentAmount("");
      setPaymentDate("");
      await loadFinance();
      setSuccess("Odeme eklendi");
      setError(null);
    } catch {
      setError("Odeme eklenemedi");
    }
  }

  async function handleAddPhoto() {
    if (!photoTitle || !photoFile) return;
    try {
      await createAdminSupplierFinancePhoto(supplierId, { title: photoTitle, file: photoFile });
      setPhotoTitle("");
      setPhotoFile(null);
      await loadFinance();
      setSuccess("İş fotoğrafı eklendi");
      setError(null);
    } catch {
      setError("İş fotoğrafı eklenemedi");
    }
  }

  async function handleEditInvoice(idValue: number, current: { title: string; amount: number; invoice_date?: string | null }) {
    const nextTitle = window.prompt("Fatura basligi", current.title);
    if (!nextTitle) return;
    const nextAmountRaw = window.prompt("Fatura tutari", String(current.amount));
    if (!nextAmountRaw) return;
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    const nextDate = window.prompt("Fatura tarihi (YYYY-MM-DD)", current.invoice_date || "") || undefined;
    await updateAdminSupplierFinanceInvoice(supplierId, idValue, { title: nextTitle, amount: nextAmount, invoice_date: nextDate });
    await loadFinance();
  }

  async function handleDeleteInvoice(idValue: number) {
    if (!window.confirm("Fatura silinsin mi?")) return;
    await deleteAdminSupplierFinanceInvoice(supplierId, idValue);
    await loadFinance();
  }

  async function handleEditPayment(idValue: number, current: { title: string; amount: number; payment_date?: string | null }) {
    const nextTitle = window.prompt("Odeme basligi", current.title);
    if (!nextTitle) return;
    const nextAmountRaw = window.prompt("Odeme tutari", String(current.amount));
    if (!nextAmountRaw) return;
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    const nextDate = window.prompt("Odeme tarihi (YYYY-MM-DD)", current.payment_date || "") || undefined;
    await updateAdminSupplierFinancePayment(supplierId, idValue, { title: nextTitle, amount: nextAmount, payment_date: nextDate });
    await loadFinance();
  }

  async function handleDeletePayment(idValue: number) {
    if (!window.confirm("Odeme silinsin mi?")) return;
    await deleteAdminSupplierFinancePayment(supplierId, idValue);
    await loadFinance();
  }

  async function handleEditPhoto(idValue: number, current: { title: string; description?: string | null }) {
    const nextTitle = window.prompt("Fotograf basligi", current.title);
    if (!nextTitle) return;
    const nextDesc = window.prompt("Açıklama", current.description || "") || undefined;
    await updateAdminSupplierFinancePhoto(supplierId, idValue, { title: nextTitle, description: nextDesc });
    await loadFinance();
  }

  async function handleDeletePhoto(idValue: number) {
    if (!window.confirm("Fotograf silinsin mi?")) return;
    await deleteAdminSupplierFinancePhoto(supplierId, idValue);
    await loadFinance();
  }

  if (loading) return <div className="asf-page">Yukleniyor...</div>;

  return (
    <div className="asf-page">
      {error && <div className="asf-msg asf-msg--error">{error}</div>}
      {success && <div className="asf-msg">{success}</div>}

      <section className="asf-card">
        <div className="asf-card__header">
          <h2 className="asf-card__title">Finans Modulu: {supplierName || `#${supplierId}`}</h2>
          <button type="button" className="asf-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}`)}>
            Tedarikçi Detayına Dön
          </button>
        </div>
        {!!finance?.alerts?.length && (
          <div className="asf-msg asf-msg--error asf-msg--mt">{finance.alerts.join(" ")}</div>
        )}
      </section>

      <section className="asf-card">
        <div className="asf-grid">
          <label className="asf-label">
            Sozlesme Toplami
            <input className="asf-input" readOnly value={(finance?.totals.contract_total ?? 0).toLocaleString("tr-TR")} />
          </label>
          <label className="asf-label">
            Fatura Toplami
            <input className="asf-input" readOnly value={(finance?.totals.invoice_total ?? 0).toLocaleString("tr-TR")} />
          </label>
          <label className="asf-label">
            Odeme Toplami
            <input className="asf-input" readOnly value={(finance?.totals.payment_total ?? 0).toLocaleString("tr-TR")} />
          </label>
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">Filtrele</h3>
        <div className="asf-grid">
          <label className="asf-label">
            Arama
            <input className="asf-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Baslik, tutar, not" />
          </label>
          <label className="asf-label">
            Tarih Başlangıç
            <input className="asf-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="asf-label">
            Tarih Bitis
            <input className="asf-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="asf-card__footer">
          <button type="button" className="asf-btn" onClick={() => void loadFinance()}>Filtrele</button>
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">Fatura Ekle</h3>
        <div className="asf-grid">
          <label className="asf-label">
            Fatura Basligi
            <input className="asf-input" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} />
          </label>
          <label className="asf-label">
            Fatura Tutari
            <input className="asf-input" type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
          </label>
          <label className="asf-label">
            Fatura Tarihi
            <input className="asf-input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label className="asf-label">
            Fatura Dosyasi
            <input className="asf-input" type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="asf-card__footer">
          <button type="button" className="asf-btn asf-btn--primary" onClick={() => void handleAddInvoice()}>Fatura Ekle</button>
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">Odeme Ekle</h3>
        <div className="asf-grid">
          <label className="asf-label">
            Odeme Basligi
            <input className="asf-input" value={paymentTitle} onChange={(e) => setPaymentTitle(e.target.value)} />
          </label>
          <label className="asf-label">
            Odeme Tutari
            <input className="asf-input" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </label>
          <label className="asf-label">
            Odeme Tarihi
            <input className="asf-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </label>
        </div>
        <div className="asf-card__footer">
          <button type="button" className="asf-btn asf-btn--primary" onClick={() => void handleAddPayment()}>Odeme Ekle</button>
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">İş Fotoğrafı Ekle</h3>
        <div className="asf-grid">
          <label className="asf-label">
            Fotograf Basligi
            <input className="asf-input" value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} />
          </label>
          <label className="asf-label">
            İş Fotoğrafı
            <input className="asf-input" type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="asf-card__footer">
          <button type="button" className="asf-btn asf-btn--primary" onClick={() => void handleAddPhoto()}>Fotograf Ekle</button>
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">Faturalar ({finance?.invoices.length || 0})</h3>
        <div className="asf-item-list">
          {(finance?.invoices || []).map((i) => (
            <div key={i.id} className="asf-item-row">
              <span>{i.title} - {i.amount.toLocaleString("tr-TR")} {i.currency}</span>
              <div className="asf-item-row__actions">
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleEditInvoice(i.id, i)}>Duzenle</button>
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleDeleteInvoice(i.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.invoices || []).length === 0 && <span className="asf-empty">Kayit yok.</span>}
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">Odemeler ({finance?.payments.length || 0})</h3>
        <div className="asf-item-list">
          {(finance?.payments || []).map((p) => (
            <div key={p.id} className="asf-item-row">
              <span>{p.title} - {p.amount.toLocaleString("tr-TR")} {p.currency}</span>
              <div className="asf-item-row__actions">
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleEditPayment(p.id, p)}>Duzenle</button>
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleDeletePayment(p.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.payments || []).length === 0 && <span className="asf-empty">Kayit yok.</span>}
        </div>
      </section>

      <section className="asf-card">
        <h3 className="asf-card__subtitle">İş Fotoğrafları ({finance?.photos.length || 0})</h3>
        <div className="asf-item-list">
          {(finance?.photos || []).map((p) => (
            <div key={p.id} className="asf-item-row">
              <a href={p.file_url} target="_blank" rel="noreferrer">{p.title}</a>
              <div className="asf-item-row__actions">
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleEditPhoto(p.id, p)}>Duzenle</button>
                <button type="button" className="asf-btn asf-btn--sm" onClick={() => void handleDeletePhoto(p.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.photos || []).length === 0 && <span className="asf-empty">Kayit yok.</span>}
        </div>
      </section>
    </div>
  );
}
