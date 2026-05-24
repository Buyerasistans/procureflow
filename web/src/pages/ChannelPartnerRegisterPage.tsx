// PAGE: web/src/pages/ChannelPartnerRegisterPage.tsx
import { useState, type CSSProperties, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Step = "form" | "done";

interface DoneData {
  admin_email: string;
  invitation_sent: boolean;
  message: string;
}

export default function ChannelPartnerRegisterPage() {
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();
  const [step, setStep] = useState<Step>("form");
  const [legalName, setLegalName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<DoneData | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!legalName.trim() || !fullName.trim() || !email.trim()) {
      setError("Lütfen zorunlu alanları doldurun.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/onboarding/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: "business_partner_free",
          legal_name: legalName.trim(),
          brand_name: brandName.trim() || undefined,
          category: category.trim() || undefined,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          referral_code: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Kayıt sırasında bir hata oluştu.");
        return;
      }
      setDoneData(data);
      setStep("done");
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" }}>
      <NavBar variant="channel" activePath="/is-ortagi-programi" />
      <div style={styles.page}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.badge}>İŞ ORTAĞI / KOMİSYON PROGRAMI</div>
            <h1 style={styles.title}>Başvuru Formu</h1>
            <p style={styles.subtitle}>
              Networkunuzu gelire dönüştürün. Getirdiğiniz her müşteri için komisyon kazanın.
            </p>
          </div>

          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <div style={styles.infoBox}>
                <div style={styles.infoRow}>
                  <span>[OK]</span>
                  <span>Programa katılım tamamen <strong>ücretsiz</strong></span>
                </div>
                <div style={styles.infoRow}>
                  <span>[Kazanc]</span>
                  <span>İlk 90 günde getirdiğiniz müşterilerde <strong>%15 komisyon</strong></span>
                </div>
                <div style={styles.infoRow}>
                  <span>[Takip]</span>
                  <span>Şeffaf takip ve ödeme - tüm kazançlarınızı panelinizden izleyin</span>
                </div>
              </div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Firma ticari unvanı *
                  <input
                    style={styles.input}
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Örnek Danışmanlık A.Ş."
                    required
                  />
                </label>
                <label style={styles.label}>
                  Marka adı / Ticaret adı
                  <input
                    style={styles.input}
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </label>
                <label style={styles.label}>
                  Uzmanlık / kategori
                  <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Seçiniz</option>
                    {COMPANY_CATEGORY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div style={{ ...styles.prominentInfoBox, gridColumn: "1 / -1", marginTop: -4, marginBottom: 4, borderColor: "#fcd34d", background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)" }}>
                  <div style={styles.infoRow}>
                    <span>[İpucu]</span>
                    <span>Seçtiğiniz uzmanlık alanı, getireceğiniz müşteri ve tedarikçi portföyünün hangi kategorilerde yoğunlaştığını platform ekibine görünür kılar.</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span>[Bağlantı]</span>
                    <span>Bu bilgi daha sonra stratejik partner ve supplier onboarding akışlarıyla birlikte değerlendirilir; kategori bazlı büyüme ve eşleşme planları daha doğru kurulur.</span>
                  </div>
                </div>
                <label style={styles.label}>
                  Yetkili adı soyadı *
                  <input
                    style={styles.input}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmet Yılmaz"
                    required
                  />
                </label>
                <label style={styles.label}>
                  E-posta *
                  <input
                    style={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmet@sirket.com.tr"
                    required
                  />
                </label>
                <label style={styles.label}>
                  Telefon
                  <input
                    style={styles.input}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+90 5xx xxx xx xx"
                  />
                </label>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <div style={styles.actions}>
                <a href="/is-ortagi-programi" style={styles.btnSecondary}>{"<- Programa Dön"}</a>
                <button type="submit" style={styles.btnPrimary} disabled={submitting}>
                  {submitting ? "Başvuru gönderiliyor..." : "Başvuruyu Tamamla"}
                </button>
              </div>
            </form>
          )}

          {step === "done" && doneData && (
            <div style={{ textAlign: "center" as const, padding: "24px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>[Tamam]</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>
                Başvurunuz Alındı!
              </h2>
              <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>{doneData.message}</p>
              <div style={styles.doneBox}>
                <div><strong>Hesap e-postası:</strong> {doneData.admin_email}</div>
                <div style={{ marginTop: 8 }}>
                  {doneData.invitation_sent
                    ? "[OK] Aktivasyon e-postası gönderildi. Gelen kutunuzu kontrol edin."
                    : "[Bekliyor] Ekibimiz başvurunuzu inceleyecek ve en kısa sürede iletişime geçecek."}
                </div>
              </div>
              <a href="/" style={styles.linkBtn}>{"Ana Sayfaya Dön ->"}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 60px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    padding: "40px 44px",
    width: "100%",
    maxWidth: 580,
  },
  header: {
    textAlign: "center" as const,
    marginBottom: 28,
  },
  badge: {
    display: "inline-block",
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fbbf24",
    borderRadius: 20,
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 900,
    color: "#111827",
    margin: "0 0 8px",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    margin: 0,
    lineHeight: 1.5,
  },
  infoBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: "16px 20px",
    marginBottom: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  prominentInfoBox: {
    background: "linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)",
    border: "1px solid #f59e0b",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 24,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    boxShadow: "0 14px 32px rgba(245, 158, 11, 0.12)",
  },
  infoRow: {
    display: "flex",
    gap: 10,
    fontSize: 14,
    color: "#78350f",
    alignItems: "flex-start",
  },
  formGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    color: "#111827",
  },
  error: {
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginTop: 16,
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    gap: 12,
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    color: "#6b7280",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
  },
  doneBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "16px 20px",
    fontSize: 14,
    color: "#166534",
    marginBottom: 24,
    textAlign: "left" as const,
  },
  linkBtn: {
    display: "inline-block",
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 15,
  },
};

