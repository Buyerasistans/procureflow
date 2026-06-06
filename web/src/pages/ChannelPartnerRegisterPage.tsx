import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";
import "./ChannelPartnerRegisterPage.css";

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
  const prefillCode = searchParams.get("prefill_code") ?? "";

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
  const [isPrefilled, setIsPrefilled] = useState(false);

  useEffect(() => {
    if (!prefillCode) return;
    window.history.replaceState({}, "", window.location.pathname + (referralCode ? `?ref=${referralCode}` : ""));
    fetch(`${API_BASE}/api/v1/auth/social/prefill?code=${encodeURIComponent(prefillCode)}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: { name: string; email: string }) => {
        if (data.name) setFullName(data.name);
        if (data.email) setEmail(data.email);
        setIsPrefilled(true);
      })
      .catch(() => {/* prefill başarısız olursa form boş kalır */});
  }, [prefillCode, referralCode]);

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
    <div className="cpr-root">
      <NavBar variant="channel" activePath="/is-ortagi-programi" />
      <div className="cpr-page">
        <div className="cpr-card">
          <div className="cpr-header">
            <div className="cpr-badge">İŞ ORTAĞI / KOMİSYON PROGRAMI</div>
            <h1 className="cpr-title">Başvuru Formu</h1>
            <p className="cpr-subtitle">
              Networkunuzu gelire dönüştürün. Getirdiğiniz her müşteri için komisyon kazanın.
            </p>
          </div>

          {step === "form" && (
            <form onSubmit={handleSubmit}>
              {isPrefilled && (
                <div className="cpr-prefill-notice">
                  Sosyal hesabınızdan bilgileriniz otomatik dolduruldu. Lütfen firma bilgilerini ekleyerek başvuruyu tamamlayın.
                </div>
              )}

              <div className="cpr-info-box">
                <div className="cpr-info-row">
                  <span>[OK]</span>
                  <span>Programa katılım tamamen <strong>ücretsiz</strong></span>
                </div>
                <div className="cpr-info-row">
                  <span>[Kazanc]</span>
                  <span>İlk 90 günde getirdiğiniz müşterilerde <strong>%15 komisyon</strong></span>
                </div>
                <div className="cpr-info-row">
                  <span>[Takip]</span>
                  <span>Şeffaf takip ve ödeme - tüm kazançlarınızı panelinizden izleyin</span>
                </div>
              </div>

              <div className="cpr-form-grid">
                <label className="cpr-label">
                  Firma ticari unvanı *
                  <input
                    className="cpr-input"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Örnek Danışmanlık A.Ş."
                    required
                  />
                </label>
                <label className="cpr-label">
                  Marka adı / Ticaret adı
                  <input
                    className="cpr-input"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </label>
                <label className="cpr-label">
                  Uzmanlık / kategori
                  <select className="cpr-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Seçiniz</option>
                    {COMPANY_CATEGORY_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="cpr-info-box--prominent">
                  <div className="cpr-info-row">
                    <span>[İpucu]</span>
                    <span>Seçtiğiniz uzmanlık alanı, getireceğiniz müşteri ve tedarikçi portföyünün hangi kategorilerde yoğunlaştığını platform ekibine görünür kılar.</span>
                  </div>
                  <div className="cpr-info-row">
                    <span>[Bağlantı]</span>
                    <span>Bu bilgi daha sonra stratejik partner ve supplier onboarding akışlarıyla birlikte değerlendirilir; kategori bazlı büyüme ve eşleşme planları daha doğru kurulur.</span>
                  </div>
                </div>
                <label className="cpr-label">
                  Yetkili adı soyadı *
                  <input
                    className="cpr-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmet Yılmaz"
                    required
                  />
                </label>
                <label className="cpr-label">
                  E-posta *
                  <input
                    className="cpr-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmet@sirket.com.tr"
                    required
                  />
                </label>
                <label className="cpr-label">
                  Telefon
                  <input
                    className="cpr-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+90 5xx xxx xx xx"
                  />
                </label>
              </div>

              {error && <div className="cpr-error">{error}</div>}

              <div className="cpr-actions">
                <a href="/is-ortagi-programi" className="cpr-btn--secondary">{"<- Programa Dön"}</a>
                <button type="submit" className="cpr-btn--primary" disabled={submitting}>
                  {submitting ? "Başvuru gönderiliyor..." : "Başvuruyu Tamamla"}
                </button>
              </div>
            </form>
          )}

          {step === "done" && doneData && (
            <div className="cpr-done">
              <div className="cpr-done__icon">[Tamam]</div>
              <h2 className="cpr-done__title">
                Başvurunuz Alındı!
              </h2>
              <p className="cpr-done__msg">{doneData.message}</p>
              <div className="cpr-done__box">
                <div><strong>Hesap e-postası:</strong> {doneData.admin_email}</div>
                <div className="cpr-done__box-msg">
                  {doneData.invitation_sent
                    ? "[OK] Aktivasyon e-postası gönderildi. Gelen kutunuzu kontrol edin."
                    : "[Bekliyor] Ekibimiz başvurunuzu inceleyecek ve en kısa sürede iletişime geçecek."}
                </div>
              </div>
              <a href="/" className="cpr-link-btn">{"Ana Sayfaya Dön ->"}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
