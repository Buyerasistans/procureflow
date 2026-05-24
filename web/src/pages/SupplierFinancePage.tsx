import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
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

const Page = styled.div`
  max-width: 1100px;
  margin: 28px auto;
  padding: 0 16px 50px;
  display: grid;
  gap: 16px;
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: #334155;
`;

const Input = styled.input`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
`;

const Btn = styled.button`
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
`;

const PrimaryBtn = styled(Btn)`
  border: 0;
  background: #2563eb;
  color: #fff;
`;

const Message = styled.div<{ $error?: boolean }>`
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: ${(p) => (p.$error ? "#991b1b" : "#065f46")};
  background: ${(p) => (p.$error ? "#fee2e2" : "#d1fae5")};
`;

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
      await createSupplierFinancePayment({ title: paymentTitle, amount, payment_date: paymentDate || undefined });
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
      await createSupplierFinancePhoto({ title: photoTitle, file: photoFile });
      setPhotoTitle("");
      setPhotoFile(null);
      await loadFinance();
      setSuccess("İş fotoğrafı eklendi");
      setError(null);
    } catch {
      setError("İş fotoğrafı eklenemedi");
    }
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
    const nextDesc = window.prompt("Aciklama", current.description || "") || undefined;
    await updateSupplierFinancePhoto(id, { title: nextTitle, description: nextDesc });
    await loadFinance();
  }

  async function handleDeletePhoto(id: number) {
    if (!window.confirm("Fotograf silinsin mi?")) return;
    await deleteSupplierFinancePhoto(id);
    await loadFinance();
  }

  if (loading) return <Page>Yukleniyor...</Page>;

  return (
    <Page>
      {error && <Message $error>{error}</Message>}
      {success && <Message>{success}</Message>}

      <Card>
        <Header>
          <h2 style={{ margin: 0 }}>Finans Modulu</h2>
          <Btn type="button" onClick={() => navigate("/supplier/profile")}>Profile Don</Btn>
        </Header>
        {!!finance?.alerts?.length && <Message $error style={{ marginTop: 10 }}>{finance.alerts.join(" ")}</Message>}
      </Card>

      <Card>
        <Grid>
          <Label>Sozlesme Toplami<Input readOnly value={(finance?.totals.contract_total ?? 0).toLocaleString("tr-TR")} /></Label>
          <Label>Fatura Toplami<Input readOnly value={(finance?.totals.invoice_total ?? 0).toLocaleString("tr-TR")} /></Label>
          <Label>Odeme Toplami<Input readOnly value={(finance?.totals.payment_total ?? 0).toLocaleString("tr-TR")} /></Label>
        </Grid>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Filtrele</h3>
        <Grid>
          <Label>Arama<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Baslik, tutar, not" /></Label>
          <Label>Tarih Baslangic<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Label>
          <Label>Tarih Bitis<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Label>
        </Grid>
        <div style={{ marginTop: 8 }}>
          <Btn type="button" onClick={() => void loadFinance()}>Filtrele</Btn>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Fatura Ekle</h3>
        <Grid>
          <Label>Fatura Basligi<Input value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} /></Label>
          <Label>Fatura Tutari<Input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} /></Label>
          <Label>Fatura Tarihi<Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Label>
          <Label>Fatura Dosyasi<Input type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} /></Label>
        </Grid>
        <div style={{ marginTop: 8 }}>
          <PrimaryBtn type="button" onClick={() => void handleAddInvoice()}>Fatura Ekle</PrimaryBtn>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Odeme Ekle</h3>
        <Grid>
          <Label>Odeme Basligi<Input value={paymentTitle} onChange={(e) => setPaymentTitle(e.target.value)} /></Label>
          <Label>Odeme Tutari<Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></Label>
          <Label>Odeme Tarihi<Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Label>
        </Grid>
        <div style={{ marginTop: 8 }}>
          <PrimaryBtn type="button" onClick={() => void handleAddPayment()}>Odeme Ekle</PrimaryBtn>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>İş Fotoğrafı Ekle</h3>
        <Grid>
          <Label>Fotograf Basligi<Input value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} /></Label>
          <Label>İş Fotoğrafı<Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} /></Label>
        </Grid>
        <div style={{ marginTop: 8 }}>
          <PrimaryBtn type="button" onClick={() => void handleAddPhoto()}>Fotograf Ekle</PrimaryBtn>
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Faturalar ({finance?.invoices.length || 0})</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {(finance?.invoices || []).map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>{i.title} - {i.amount.toLocaleString("tr-TR")} {i.currency}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn type="button" onClick={() => void handleEditInvoice(i.id, i)}>Duzenle</Btn>
                <Btn type="button" onClick={() => void handleDeleteInvoice(i.id)}>Sil</Btn>
              </div>
            </div>
          ))}
          {(finance?.invoices || []).length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>Kayit yok.</span>}
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>Odemeler ({finance?.payments.length || 0})</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {(finance?.payments || []).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span>{p.title} - {p.amount.toLocaleString("tr-TR")} {p.currency}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn type="button" onClick={() => void handleEditPayment(p.id, p)}>Duzenle</Btn>
                <Btn type="button" onClick={() => void handleDeletePayment(p.id)}>Sil</Btn>
              </div>
            </div>
          ))}
          {(finance?.payments || []).length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>Kayit yok.</span>}
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>İş Fotoğrafları ({finance?.photos.length || 0})</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {(finance?.photos || []).map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <a href={p.file_url} target="_blank" rel="noreferrer">{p.title}</a>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn type="button" onClick={() => void handleEditPhoto(p.id, p)}>Duzenle</Btn>
                <Btn type="button" onClick={() => void handleDeletePhoto(p.id)}>Sil</Btn>
              </div>
            </div>
          ))}
          {(finance?.photos || []).length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>Kayit yok.</span>}
        </div>
      </Card>
    </Page>
  );
}
