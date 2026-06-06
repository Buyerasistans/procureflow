import { useState } from "react";
import NavBar from "../components/NavBar";
import { http } from "../lib/http";
import "./DemoRequestPage.css";

export default function DemoRequestPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = new URLSearchParams(globalThis.location?.search || "");
  const audience = searchParams.get("audience") === "supplier" ? "supplier" : "strategic";
  const intent = searchParams.get("intent") || "general_demo";
  const requestedPlan = searchParams.get("plan") || "";
  const requestedPlanCode = searchParams.get("planCode") || "";
  const requestedAddon = searchParams.get("addon") || "";
  const requestedAddonCode = searchParams.get("addonKey") || "";
  const isSupplierDemo = audience === "supplier";
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    companyName: "",
    roleTitle: "",
    monthlyVolumeNote: "",
    note: "",
    phone: "",
  });
  const requestSummary = requestedPlan
    ? `${requestedPlan} paketi icin ticari gecis talebi`
    : requestedAddon
      ? `${requestedAddon} icin ek hak talebi`
      : isSupplierDemo
        ? "Tedarikçi demo talebi"
        : "Stratejik partner demo talebi";
  const requestNote = intent === "package_upgrade"
    ? `Talep konusu: ${requestedPlan} paketine gecis`
    : intent === "addon_purchase"
      ? `Talep konusu: ${requestedAddon} ek hak satin alma`
      : "Talep konusu: Demo ve ticari gorusme";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await http.post("/onboarding/commercial-requests", {
        request_type: intent,
        audience,
        source_surface: "demo_request_page",
        package_code: requestedPlanCode || undefined,
        package_name: requestedPlan || undefined,
        addon_code: requestedAddonCode || undefined,
        addon_name: requestedAddon || undefined,
        requester_name: form.fullName.trim(),
        requester_email: form.email.trim(),
        company_name: form.companyName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        role_title: form.roleTitle.trim() || undefined,
        monthly_volume_note: form.monthlyVolumeNote.trim() || undefined,
        notes: (form.note.trim() || requestNote),
      });
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Talep kaydedilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={isSupplierDemo ? "drp-root drp-root--supplier" : "drp-root"}>
      <NavBar variant={isSupplierDemo ? "supplier" : "strategic"} activePath="/demo" />

      <section className="drp-hero">
        <div className="drp-hero-inner">
          <div className="drp-hero-badge">
            {isSupplierDemo ? "Tedarikçi Demosu" : "Stratejik Partner Demosu"}
          </div>
          <h1 className="drp-hero-h1">
            {isSupplierDemo ? "Tedarikçi Deneyimini Birlikte Keşfedelim" : "Kurumsal Demo - Sizin Sürecinizle"}
          </h1>
          <p className="drp-hero-lead">
            {isSupplierDemo
              ? "Teklif yanit akislari, kategori gorunurlugu ve performans panelini canli inceleyin."
              : "Sektorunuze ozel 45 dakikalik canli senaryo, gap analizi ve 90 gunluk onboarding plani."}
          </p>
          <div className="drp-mode-row">
            <a
              href="/demo?audience=strategic"
              className={!isSupplierDemo ? "drp-mode-btn drp-mode-btn--strategic-active" : "drp-mode-btn"}
            >
              Stratejik Partner Demosu
            </a>
            <a
              href="/demo?audience=supplier"
              className={isSupplierDemo ? "drp-mode-btn drp-mode-btn--supplier-active" : "drp-mode-btn"}
            >
              Tedarikçi Demosu
            </a>
          </div>
        </div>
      </section>

      <section className="drp-content">
        <article className="drp-desc-article">
          <h2 className="drp-article-h2">Demo Kapsami</h2>
          <ul className="drp-scope-list">
            {isSupplierDemo ? (
              <>
                <li>Tedarikçi onboarding ve profil devreye alma</li>
                <li>İhale daveti alma ve teklif gönderme akışı</li>
                <li>Kategori bazli gorunurluk stratejisi</li>
                <li>Performans paneli ve geri bildirim sistemi</li>
                <li>Tedarikçi paketi fiyatlandırma rehberi</li>
              </>
            ) : (
              <>
                <li>45 dakika canlı ürün senaryosu</li>
                <li>Mevcut sürecine özel gap analizi</li>
                <li>İlk 90 gün onboarding planı</li>
                <li>Rol bazli onay ve denetim akislari</li>
                <li>Kurumsal fiyatlandirma ve entegrasyon rehberi</li>
              </>
            )}
          </ul>
          <div className="drp-scope-info">
            <strong>Sure:</strong> ~45 dakika &nbsp;|&nbsp; <strong>Format:</strong> Online / Yerinde
          </div>
        </article>

        <article className="drp-form-article">
          <h2 className="drp-article-h2">Demo Talep Formu</h2>
          <div className="drp-summary-box">
            <strong>Talep Özeti:</strong> {requestSummary}
            <div className="drp-summary-note">{requestNote}</div>
          </div>
          {sent ? (
            <div className="drp-sent">
              [OK] <strong>Talebiniz alindi!</strong> En kisa surede ekibimiz size donus yapacak.
            </div>
          ) : (
            <form data-telemetry-name="demo-request-form" onSubmit={handleSubmit} className="drp-form">
              <input required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad Soyad *" className="drp-input" />
              <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="İş e-postası *" className="drp-input" />
              <input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Firma" className="drp-input" />
              <input value={form.roleTitle} onChange={(event) => setForm((current) => ({ ...current, roleTitle: event.target.value }))} placeholder={isSupplierDemo ? "Ürün / Hizmet Kategorisi" : "Pozisyon"} className="drp-input" />
              <input value={form.monthlyVolumeNote} onChange={(event) => setForm((current) => ({ ...current, monthlyVolumeNote: event.target.value }))} placeholder={isSupplierDemo ? "Yillik ihale yanit adedi" : "Aylik ihale adedi"} className="drp-input" />
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" className="drp-input" />
              <textarea value={form.note || requestNote} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Notunuz" rows={3} className="drp-textarea" />
              {error && <div className="drp-form-error">{error}</div>}
              <button type="submit" className="drp-submit-btn">
                {submitting ? "Talep Kaydediliyor..." : "Talep Gönder"}
              </button>
            </form>
          )}
        </article>
      </section>

      <footer className="drp-footer">
        (c) {new Date().getFullYear()} BUYER ASISTANS | Demo Talebi
      </footer>
    </div>
  );
}
