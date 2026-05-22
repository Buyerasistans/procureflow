import NavBar from "../components/NavBar";
import { BRAND_COLORS } from "../components/nav-brand-colors";

const c = BRAND_COLORS.strategic;

const features = [
  { icon: "[Plan]", title: "90 Gunluk Canliya Gecis Plani", desc: "Haftalik kilometre taslari, onboarding kocu ve teknik destek ile platforma en kisa surede entegre olun." },
  { icon: "[Onay]", title: "Rol Bazli Onay ve Denetim", desc: "Cok seviyeli onay zinciri, denetim izi ve kurumsal yonetisim gerekliliklerine tam uyum." },
  { icon: "[Havuz]", title: "Tedarikci Havuzu + Ozel Havuz", desc: "Platform tedarikci veri tabani ile kendi ozel tedarikci listenizi yan yana yonetin." },
  { icon: "[KPI]", title: "Yonetim KPI Panosu", desc: "Tasarruf orani, onay suresi, tedarikci performansi ve yonetime hazir raporlar." },
  { icon: "[AI]", title: "AI Destekli Teklif Analizi", desc: "Gelen teklifleri piyasa verileriyle otomatik karsilastir, sapan fiyatlari aninda tespit et." },
  { icon: "[API]", title: "ERP / API Entegrasyonu", desc: "SAP, Oracle ve diger sistemlerle veri koprusu kurun, manuel veri girisini azaltin." },
];

const steps = [
  { num: "01", title: "Kesif Gorusmesi", desc: "Mevcut sureclerinizi ve hedeflerinizi birlikte haritalandiriyoruz." },
  { num: "02", title: "Ozellestirilmis Demo", desc: "Sektorunuze ozel senaryolarla canli platform tanitimi." },
  { num: "03", title: "Onboarding Baslangici", desc: "90 gunluk plan aktivasyonu ve ilk tedarikci entegrasyonu." },
  { num: "04", title: "Tam Operasyon", desc: "Surec optimizasyonu, raporlama ve surekli iyilestirme dongusu." },
];

const governanceDetails = [
  {
    title: "Onboardingde Kategori Toplanir",
    desc: "Stratejik partner kaydi acilirken faaliyet alani ve uzmanlik kategorisi onboarding akisinda kaydedilir. Bu bilgi sonraki operasyon katmanlarinda supplier uygunlugu icin referans olur.",
  },
  {
    title: "Supplier Uygunlugu Ilk Gunden Gorunur",
    desc: "Platform yonetimi sizin kategorinizle ayni alanda aktif supplier sayisini tenant governance ekraninda gorur. Boylece ilk gunden hangi kategoride hazir supplier kapsami oldugu hizla anlasilir.",
  },
  {
    title: "Kategori Eksigi Operasyon Kuyruguna Donusur",
    desc: "Kategori bilgisi eksik stratejik partnerlar ayri filtrelenebilir. Bu da onboarding kalitesini yukseltir ve supplier eslestirme kararlarini veriyle yonetilen bir akisa donusturur.",
  },
];

const planCards = [
  {
    name: "Baslangic",
    price: "Kuruma ozel teklif",
    accent: "#0f766e",
    features: ["RFQ + teklif toplama", "Temel onay akisi", "Standart destek"],
  },
  {
    name: "Gelisim",
    price: "Paket + premium kombinasyonu",
    accent: "#1d4ed8",
    features: ["Platform supplier agi", "KPI export", "Kategori bazli governance"],
  },
  {
    name: "Kurumsal",
    price: "Ozel SLA ve entegrasyon",
    accent: "#7c3aed",
    features: ["ERP / API baglantisi", "Tenant-izole marka katmani", "Operasyon runbooklari"],
  },
];

export default function StrategicPartnerProgramPage() {
  const activePath = typeof window !== "undefined" && window.location.pathname === "/teklifler" ? "/teklifler" : "/stratejik-ortaklik";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8fafc" }}>
      <NavBar variant="strategic" activePath={activePath} />

      <section style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1e4a3d 55%, #20503e 100%)`, color: c.text, padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.35)", color: c.accent, borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 24 }}>
            Stratejik Partner Programi
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, lineHeight: 1.08, color: "#fff" }}>
            Satin Alma Operasyonunuzu <span style={{ color: c.accent }}>Birlikte Donusturelim</span>
          </h1>
          <p style={{ margin: "0 auto 32px", fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: 700 }}>
            BUYER ASISTANS, kurumsal satin alma ekipleri icin operasyonel yazilim ve surec danismanligini bir arada sunar. Onboardingden tam operasyona kadar yaninizdayiz.
          </p>
          <div style={{ maxWidth: 780, margin: "0 auto 28px", borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(212,175,55,0.22)", padding: "16px 18px", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: c.accent }}>Kategori Destekli Onboarding</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, fontSize: 14 }}>
              Stratejik partner onboardingi sirasinda girilen kategori ve uzmanlik alani yalnizca form verisi olarak kalmaz.
              Bu bilgi platform yonetiminde supplier kapsami ile birlikte izlenir; boylece ilk gunden hangi kategori icin
              hazir tedarikci havuzu oldugu ve hangi alanlarda ek supplier devreye alma gerektigi netlesir.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/onboarding?tenant_type=strategic_partner" style={{ background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accentHover} 100%)`, color: c.bg, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15 }}>Stratejik Partner Ol</a>
            <a href="/demo?audience=strategic" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>Demo Planla</a>
            <a href="#planlar" style={{ background: "transparent", color: c.accent, border: `1px solid ${c.accent}`, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>Planlari Gor</a>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "52px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Stratejik Partnerlara Ozel Yetenekler</h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 32, fontSize: 15 }}>Kurumsal satin alma operasyonunuzu uctan uca kapsayan moduller</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <article key={f.title} style={{ background: "#fff", borderTop: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", borderLeft: `4px solid ${c.accent}`, borderRadius: 14, padding: 22, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 20, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 16, marginBottom: 6 }}>{f.title}</div>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6, fontSize: 14 }}>{f.desc}</p>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {governanceDetails.map((item) => (
            <article key={item.title} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)" }}>
              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{item.title}</div>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, fontSize: 14 }}>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planlar" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 52px" }}>
        <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>Teklifler sayfasina dagitilan plan ve cozum katmani</h2>
          <p style={{ margin: 0, textAlign: "center", color: "#64748b", lineHeight: 1.7 }}>
            Eski Cozumler ve Fiyatlandirma anlatimi artik bu sayfanin icinde. RFQ, onay, supplier agi ve yonetim KPI modulleri secilen paketle birlikte ayni akista okunur.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {planCards.map((plan) => (
            <article key={plan.name} style={{ borderRadius: 18, border: `1px solid ${plan.accent}33`, background: "#fff", padding: 18, boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: plan.accent }}>{plan.name}</div>
              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{plan.price}</div>
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "#475569", lineHeight: 1.7, fontSize: 14 }}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1a3d30 100%)`, padding: "52px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 32 }}>Nasil Calisir?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {steps.map((s) => (
              <div key={s.num} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 14, padding: 22, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.accent, color: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, margin: "0 auto 14px" }}>{s.num}</div>
                <div style={{ fontWeight: 800, color: "#fff", marginBottom: 6, fontSize: 15 }}>{s.title}</div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ textAlign: "center", padding: "52px 24px", background: "#fff" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>Hazir misiniz?</h2>
        <p style={{ color: "#64748b", marginBottom: 28, fontSize: 15 }}>Kurumsal demo planlayin veya hemen kaydolun.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/onboarding?tenant_type=strategic_partner" style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1e4a3d 100%)`, color: c.accent, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15, border: "1px solid rgba(212,175,55,0.3)" }}>Hemen Basla</a>
          <a href="/demo?audience=strategic" style={{ background: c.accent, color: c.bg, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15 }}>Demo Talep Et</a>
        </div>
      </section>

      <footer style={{ background: c.bg, color: "rgba(255,255,255,0.55)", textAlign: "center", padding: "20px", fontSize: 13 }}>
        (c) {new Date().getFullYear()} BUYER ASISTANS - Stratejik Partner Satin Alma Platformu
      </footer>
    </div>
  );
}
