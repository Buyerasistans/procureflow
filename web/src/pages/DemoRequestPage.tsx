import { useState, type CSSProperties } from "react";
import NavBar from "../components/NavBar";
import { BRAND_COLORS } from "../components/nav-brand-colors";
import { http } from "../lib/http";

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
  const c = isSupplierDemo ? BRAND_COLORS.supplier : BRAND_COLORS.strategic;
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
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: isSupplierDemo ? "#f0f9ff" : "#f0fdf4" }}>
      <NavBar variant={isSupplierDemo ? "supplier" : "strategic"} activePath="/demo" />

      {/* Hero Banner */}
      <section style={{ background: `linear-gradient(135deg, ${c.bg} 0%, ${isSupplierDemo ? "#1e4976" : "#1e4a3d"} 100%)`, padding: "40px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `rgba(${isSupplierDemo ? "14,165,233" : "212,175,55"},0.12)`, border: `1px solid rgba(${isSupplierDemo ? "14,165,233" : "212,175,55"},0.35)`, color: c.accent, borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 16 }}>
            {isSupplierDemo ? "Tedarikçi Demosu" : "Stratejik Partner Demosu"}
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 900, color: "#fff" }}>
            {isSupplierDemo ? "Tedarikçi Deneyimini Birlikte Keşfedelim" : "Kurumsal Demo - Sizin Sürecinizle"}
          </h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 1.6 }}>
            {isSupplierDemo
              ? "Teklif yanit akislari, kategori gorunurlugu ve performans panelini canli inceleyin."
              : "Sektorunuze ozel 45 dakikalik canli senaryo, gap analizi ve 90 gunluk onboarding plani."}
          </p>
          {/* Mod degistirici */}
          <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center" }}>
            <a href="/demo?audience=strategic" style={{ background: !isSupplierDemo ? BRAND_COLORS.strategic.accent : "rgba(255,255,255,0.12)", color: !isSupplierDemo ? BRAND_COLORS.strategic.bg : "rgba(255,255,255,0.75)", padding: "8px 18px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 13, border: !isSupplierDemo ? "none" : "1px solid rgba(255,255,255,0.2)" }}>
              Stratejik Partner Demosu
            </a>
            <a href="/demo?audience=supplier" style={{ background: isSupplierDemo ? BRAND_COLORS.supplier.accent : "rgba(255,255,255,0.12)", color: isSupplierDemo ? "#fff" : "rgba(255,255,255,0.75)", padding: "8px 18px", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 13, border: isSupplierDemo ? "none" : "1px solid rgba(255,255,255,0.2)" }}>
              Tedarikçi Demosu
            </a>
          </div>
        </div>
      </section>

      {/* Icerik + Form */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {/* Aciklama kutusu */}
        <article style={{ background: "#fff", borderTop: `1px solid ${isSupplierDemo ? "#e0f2fe" : "#dcfce7"}`, borderRight: `1px solid ${isSupplierDemo ? "#e0f2fe" : "#dcfce7"}`, borderBottom: `1px solid ${isSupplierDemo ? "#e0f2fe" : "#dcfce7"}`, borderLeft: `4px solid ${c.accent}`, borderRadius: 16, padding: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <h2 style={{ marginTop: 0, fontSize: 20, color: "#0f172a", fontWeight: 900 }}>Demo Kapsami</h2>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 2, fontSize: 14, color: "#334155" }}>
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
          <div style={{ background: isSupplierDemo ? "#f0f9ff" : "#f0fdf4", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
            <strong>Sure:</strong> ~45 dakika &nbsp;|&nbsp; <strong>Format:</strong> Online / Yerinde
          </div>
        </article>

        {/* Form */}
        <article style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <h2 style={{ marginTop: 0, fontSize: 20, color: "#0f172a", fontWeight: 900 }}>Demo Talep Formu</h2>
          <div style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${isSupplierDemo ? "#bae6fd" : "#bbf7d0"}`, background: isSupplierDemo ? "#f0f9ff" : "#f0fdf4", padding: 14, color: "#334155", fontSize: 13, lineHeight: 1.6 }}>
            <strong>Talep Özeti:</strong> {requestSummary}
            <div style={{ marginTop: 6 }}>{requestNote}</div>
          </div>
          {sent ? (
            <div style={{ background: "#ecfdf5", border: "1px solid #86efac", color: "#166534", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.7 }}>
              [OK] <strong>Talebiniz alindi!</strong> En kisa surede ekibimiz size donus yapacak.
            </div>
          ) : (
            <form data-telemetry-name="demo-request-form" onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
              <input required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ad Soyad *" style={inputStyle} />
              <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="İş e-postası *" style={inputStyle} />
              <input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Firma" style={inputStyle} />
              <input value={form.roleTitle} onChange={(event) => setForm((current) => ({ ...current, roleTitle: event.target.value }))} placeholder={isSupplierDemo ? "Ürün / Hizmet Kategorisi" : "Pozisyon"} style={inputStyle} />
              <input value={form.monthlyVolumeNote} onChange={(event) => setForm((current) => ({ ...current, monthlyVolumeNote: event.target.value }))} placeholder={isSupplierDemo ? "Yillik ihale yanit adedi" : "Aylik ihale adedi"} style={inputStyle} />
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Telefon" style={inputStyle} />
              <textarea value={form.note || requestNote} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Notunuz" rows={3} style={{ ...inputStyle, resize: "vertical" as const }} />
              {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 12, fontSize: 13 }}>{error}</div> : null}
              <button type="submit" style={{ background: `linear-gradient(135deg, ${c.bg} 0%, ${isSupplierDemo ? "#1e4976" : "#1e4a3d"} 100%)`, color: isSupplierDemo ? c.accent : c.accent, border: "none", borderRadius: 10, padding: "12px 16px", fontWeight: 800, cursor: "pointer", fontSize: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                {submitting ? "Talep Kaydediliyor..." : "Talep Gönder"}
              </button>
            </form>
          )}
        </article>
      </section>

      <footer style={{ background: c.bg, color: "rgba(255,255,255,0.55)", textAlign: "center", padding: "20px", fontSize: 13 }}>
        (c) {new Date().getFullYear()} BUYER ASISTANS | Demo Talebi
      </footer>
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box" as const,
};
