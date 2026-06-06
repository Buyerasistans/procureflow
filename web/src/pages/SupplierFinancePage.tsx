import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupplierAccessToken } from "../lib/session";
import {
  createSupplierFinanceInvoice,
  createSupplierFinancePayment,
  createSupplierFinancePhoto,
  deleteSupplierFinanceInvoice,
  deleteSupplierFinancePayment,
  deleteSupplierFinancePhoto,
  getSupplierFinanceSummary,
  updateSupplierFinanceInvoice,
  updateSupplierFinancePayment,
  updateSupplierFinancePhoto,
  type SupplierFinanceSummary,
} from "../services/supplier-profile.service";
import "./SupplierFinancePage.css";

export default function SupplierFinancePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    const summary = await getSupplierFinanceSummary({
      query: query || undefined,
      date_from: from || undefined,
      date_to: to || undefined,
    });
    setFinance(summary);
  }, [query, from, to]);

  useEffect(() => {
    if (!getSupplierAccessToken()) {
      navigate("/supplier/login", { replace: true });
      return;
    }
    (async () => {
      try {
        setLoading(true);
        await loadFinance();
      } catch {
        setError("Finans verileri yuklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, loadFinance]);

  async function handleAddInvoice() {
    const amount = Number(invoiceAmount);
    if (!invoiceTitle || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await createSupplierFinanceInvoice({ title: invoiceTitle, amount, invoice_date: invoiceDate || undefined, file: invoiceFile || undefined });
      setInvoiceTitle(""); setInvoiceAmount(""); setInvoiceDate(""); setInvoiceFile(null);
      await loadFinance();
      setSuccess("Fatura eklendi"); setError(null);
    } catch { setError("Fatura eklenemedi"); }
  }

  async function handleAddPayment() {
    const amount = Number(paymentAmount);
    if (!paymentTitle || !Number.isFinite(amount) || amount <= 0) return;
    try {
      await createSupplierFinancePayment({ title: paymentTitle, amount, payment_date: paymentDate || undefined });
      setPaymentTitle(""); setPaymentAmount(""); setPaymentDate("");
      await loadFinance();
      setSuccess("Odeme eklendi"); setError(null);
    } catch { setError("Odeme eklenemedi"); }
  }

  async function handleAddPhoto() {
    if (!photoTitle || !photoFile) return;
    try {
      await createSupplierFinancePhoto({ title: photoTitle, file: photoFile });
      setPhotoTitle(""); setPhotoFile(null);
      await loadFinance();
      setSuccess("İş fotoğrafı eklendi"); setError(null);
    } catch { setError("İş fotoğrafı eklenemedi"); }
  }

  async function handleEditInvoice(id: number, current: { title: string; amount: number; invoice_date?: string | null }) {
    const nextTitle = window.prompt("Fatura basligi", current.title);
    if (!nextTitle) return;
    const nextAmountRaw = window.prompt("Fatura tutari", String(current.amount));
    if (!nextAmountRaw) return;
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    const nextDate = window.prompt("Fatura tarihi (YYYY-MM-DD)", current.invoice_date || "") || undefined;
    await updateSupplierFinanceInvoice(id, { title: nextTitle, amount: nextAmount, invoice_date: nextDate });
    await loadFinance();
  }

  async function handleDeleteInvoice(id: number) {
    if (!window.confirm("Fatura silinsin mi?")) return;
    await deleteSupplierFinanceInvoice(id);
    await loadFinance();
  }

  async function handleEditPayment(id: number, current: { title: string; amount: number; payment_date?: string | null }) {
    const nextTitle = window.prompt("Odeme basligi", current.title);
    if (!nextTitle) return;
    const nextAmountRaw = window.prompt("Odeme tutari", String(current.amount));
    if (!nextAmountRaw) return;
    const nextAmount = Number(nextAmountRaw);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) return;
    const nextDate = window.prompt("Odeme tarihi (YYYY-MM-DD)", current.payment_date || "") || undefined;
    await updateSupplierFinancePayment(id, { title: nextTitle, amount: nextAmount, payment_date: nextDate });
    await loadFinance();
  }

  async function handleDeletePayment(id: number) {
    if (!window.confirm("Odeme silinsin mi?")) return;
    await deleteSupplierFinancePayment(id);
    await loadFinance();
  }

  async function handleEditPhoto(id: number, current: { title: string; description?: string | null }) {
    const nextTitle = window.prompt("Fotograf basligi", current.title);
    if (!nextTitle) return;
    const nextDesc = window.prompt("Açıklama", current.description || "") || undefined;
    await updateSupplierFinancePhoto(id, { title: nextTitle, description: nextDesc });
    await loadFinance();
  }

  async function handleDeletePhoto(id: number) {
    if (!window.confirm("Fotograf silinsin mi?")) return;
    await deleteSupplierFinancePhoto(id);
    await loadFinance();
  }

  if (loading) return <div className="sfp-page">Yukleniyor...</div>;

  return (
    <div className="sfp-page">
      {error && <div className="sfp-msg sfp-msg--error">{error}</div>}
      {success && <div className="sfp-msg">{success}</div>}

      <section className="sfp-card">
        <div className="sfp-header">
          <h2>Finans Modulu</h2>
          <button type="button" className="sfp-btn" onClick={() => navigate("/supplier/profile")}>Profile Don</button>
        </div>
        {!!finance?.alerts?.length && <div className="sfp-msg sfp-msg--error sfp-msg--mt">{finance.alerts.join(" ")}</div>}
      </section>

      <section className="sfp-card">
        <div className="sfp-grid">
          <label className="sfp-label">Sozlesme Toplami<input className="sfp-input" readOnly value={(finance?.totals.contract_total ?? 0).toLocaleString("tr-TR")} /></label>
          <label className="sfp-label">Fatura Toplami<input className="sfp-input" readOnly value={(finance?.totals.invoice_total ?? 0).toLocaleString("tr-TR")} /></label>
          <label className="sfp-label">Odeme Toplami<input className="sfp-input" readOnly value={(finance?.totals.payment_total ?? 0).toLocaleString("tr-TR")} /></label>
        </div>
      </section>

      <section className="sfp-card">
        <h3>Filtrele</h3>
        <div className="sfp-grid">
          <label className="sfp-label">Arama<input className="sfp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Baslik, tutar, not" /></label>
          <label className="sfp-label">Tarih Başlangıç<input type="date" className="sfp-input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="sfp-label">Tarih Bitis<input type="date" className="sfp-input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="sfp-action-row">
          <button type="button" className="sfp-btn" onClick={() => void loadFinance()}>Filtrele</button>
        </div>
      </section>

      <section className="sfp-card">
        <h3>Fatura Ekle</h3>
        <div className="sfp-grid">
          <label className="sfp-label">Fatura Basligi<input className="sfp-input" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} /></label>
          <label className="sfp-label">Fatura Tutari<input type="number" className="sfp-input" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></label>
          <label className="sfp-label">Fatura Tarihi<input type="date" className="sfp-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
          <label className="sfp-label">Fatura Dosyasi<input type="file" className="sfp-input" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} /></label>
        </div>
        <div className="sfp-action-row">
          <button type="button" className="sfp-btn sfp-btn--primary" onClick={() => void handleAddInvoice()}>Fatura Ekle</button>
        </div>
      </section>

      <section className="sfp-card">
        <h3>Odeme Ekle</h3>
        <div className="sfp-grid">
          <label className="sfp-label">Odeme Basligi<input className="sfp-input" value={paymentTitle} onChange={(e) => setPaymentTitle(e.target.value)} /></label>
          <label className="sfp-label">Odeme Tutari<input type="number" className="sfp-input" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
          <label className="sfp-label">Odeme Tarihi<input type="date" className="sfp-input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></label>
        </div>
        <div className="sfp-action-row">
          <button type="button" className="sfp-btn sfp-btn--primary" onClick={() => void handleAddPayment()}>Odeme Ekle</button>
        </div>
      </section>

      <section className="sfp-card">
        <h3>İş Fotoğrafı Ekle</h3>
        <div className="sfp-grid">
          <label className="sfp-label">Fotograf Basligi<input className="sfp-input" value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} /></label>
          <label className="sfp-label">İş Fotoğrafı<input type="file" accept="image/*" className="sfp-input" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} /></label>
        </div>
        <div className="sfp-action-row">
          <button type="button" className="sfp-btn sfp-btn--primary" onClick={() => void handleAddPhoto()}>Fotograf Ekle</button>
        </div>
      </section>

      <section className="sfp-card">
        <h3>Faturalar ({finance?.invoices.length || 0})</h3>
        <div className="sfp-item-list">
          {(finance?.invoices || []).map((i) => (
            <div key={i.id} className="sfp-item-row">
              <span>{i.title} - {i.amount.toLocaleString("tr-TR")} {i.currency}</span>
              <div className="sfp-item-row__actions">
                <button type="button" className="sfp-btn" onClick={() => void handleEditInvoice(i.id, i)}>Duzenle</button>
                <button type="button" className="sfp-btn" onClick={() => void handleDeleteInvoice(i.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.invoices || []).length === 0 && <span className="sfp-empty">Kayit yok.</span>}
        </div>
      </section>

      <section className="sfp-card">
        <h3>Odemeler ({finance?.payments.length || 0})</h3>
        <div className="sfp-item-list">
          {(finance?.payments || []).map((p) => (
            <div key={p.id} className="sfp-item-row">
              <span>{p.title} - {p.amount.toLocaleString("tr-TR")} {p.currency}</span>
              <div className="sfp-item-row__actions">
                <button type="button" className="sfp-btn" onClick={() => void handleEditPayment(p.id, p)}>Duzenle</button>
                <button type="button" className="sfp-btn" onClick={() => void handleDeletePayment(p.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.payments || []).length === 0 && <span className="sfp-empty">Kayit yok.</span>}
        </div>
      </section>

      <section className="sfp-card">
        <h3>İş Fotoğrafları ({finance?.photos.length || 0})</h3>
        <div className="sfp-item-list">
          {(finance?.photos || []).map((p) => (
            <div key={p.id} className="sfp-item-row">
              <a href={p.file_url} target="_blank" rel="noreferrer">{p.title}</a>
              <div className="sfp-item-row__actions">
                <button type="button" className="sfp-btn" onClick={() => void handleEditPhoto(p.id, p)}>Duzenle</button>
                <button type="button" className="sfp-btn" onClick={() => void handleDeletePhoto(p.id)}>Sil</button>
              </div>
            </div>
          ))}
          {(finance?.photos || []).length === 0 && <span className="sfp-empty">Kayit yok.</span>}
        </div>
      </section>
    </div>
  );
}
