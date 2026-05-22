import NavBar from "../components/NavBar";
import { BRAND_COLORS } from "../components/nav-brand-colors";

const c = BRAND_COLORS.supplier;

const features = [
  { icon: "[Hiz]", title: "Hizli Profil Devreye Alma", desc: "Tedarikci profilinizi dakikalar icinde olusturun, kategori ve cografya etiketlerinizi tanimlayin." },
  { icon: "[Ihale]", title: "Ihale Davetlerine Tek Panelden Yanit", desc: "Gelen ihale davetlerini tek yerden gorun, teklifinizi gonderin, durumu takip edin." },
  { icon: "[Kategori]", title: "Kategori Bazli Gorunurluk", desc: "Sectiginiz urun ve hizmet kategorilerinde alici kurumlarin radarinda kalin." },
  { icon: "[Rapor]", title: "Performans ve Geri Bildirim Raporu", desc: "Teklif kabul orani, teslimat puani ve alici yorumlariyla kendinizi gelistirin." },
  { icon: "[Rozet]", title: "Oncu Tedarikci Rozeti", desc: "Prime seviyede one cikma ve oncelikli ihale daveti firsatlari kazanin." },
  { icon: "[Baglanti]", title: "Dogrudan Alici Baglantisi", desc: "Alici kurumlarla guvenli mesajlasma ve sozlesme yonetimi tek platformda." },
];

const steps = [
  { num: "01", title: "Kayit ve Profil", desc: "Tedarikci kaydi olusturun, kategori ve belgelerinizi yukleyin." },
  { num: "02", title: "Onay ve Devreye Alma", desc: "Platform ekibinin hizli onayinin ardindan aktif duruma gecin." },
  { num: "03", title: "Ihale Yaniti", desc: "Gelen ihale davetlerine teklif gonderin, muzakereleri yonetin." },
  { num: "04", title: "Performans ve Buyume", desc: "Raporlarla kendinizi gelistirin, daha fazla firsat kazanin." },
];

const matchingDetails = [
  {
    title: "Kategori Secimi Neden Onemli?",
    desc: "Kayit sirasinda sectiginiz uzmanlik alani profil etiketinden daha fazlasidir. Platform sizi bu kategoriyle eslesen stratejik partner ve RFQ baglamlarinda daha gorunur hale getirir.",
  },
  {
    title: "Daha Dogru Davet, Daha Az Gurultu",
    desc: "Kategori verisi; size ilgisiz davetleri azaltmak, daha isabetli ihale akisina dahil olmak ve alici tarafinin sizi dogru listede gormesi icin kullanilir.",
  },
  {
    title: "Admin Tarafinda Eslesme Takibi",
    desc: "Super admin ekibi kategori eslesmelerini Stratejik Partner Yonetimi ekraninda toplu gorur. Boylece tedarikci portfoyu bos kalan kategoriler hizla fark edilir.",
  },
];

const supplierPlans = [
  {
    name: "Tedarikci Ucretsiz",
    price: "0 TRY / ay",
    accent: "#0284c7",
    features: ["Profil olusturma", "Teklif yanitlama", "Aylik performans ozeti"],
  },
  {
    name: "Tedarikci Prime",
    price: "Premium feature ile genisler",
    accent: "#7c3aed",
    features: ["One cikarma", "Kategori bazli rapor", "Oncelikli gorunurluk"],
  },
];

export default function SupplierProgramPage() {
  const activePath = typeof window !== "undefined" && window.location.pathname === "/tedarikciler" ? "/tedarikciler" : "/tedarikci-ol";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#f0f9ff" }}>
      <NavBar variant="supplier" activePath={activePath} />

      <section style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1e4976 55%, #1a3a5c 100%)`, color: c.text, padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.35)", color: c.accent, borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" as const, marginBottom: 24 }}>
            Tedarikci Programi
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, lineHeight: 1.08, color: "#fff" }}>
            Daha Fazla Aliciya Ulasin, <span style={{ color: c.accent }}>Daha Hizli Buyuyun</span>
          </h1>
          <p style={{ margin: "0 auto 32px", fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: 700 }}>
            BUYER ASISTANS tedarikci programi; kurumsal alicilarla bulusmaniz, tekliflerinizi yonetmeniz ve performansinizi izlemeniz icin tek bir platformdur.
          </p>
          <div style={{ maxWidth: 760, margin: "0 auto 28px", borderRadius: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(14,165,233,0.22)", padding: "16px 18px", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: c.accent }}>Kategoriye Gore Gorunurluk</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, fontSize: 14 }}>
              Tedarikci kaydinda sectiginiz kategori ve uzmanlik alani yalnizca bilgi amacli tutulmaz.
              Bu veri sizi uygun stratejik partner havuzlariyla eslestirmek, dogru RFQ akislarinda gorunur kilmak ve
              platform ekibinin kategori bazli supplier kapsamini yonetebilmesi icin aktif olarak kullanilir.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/onboarding?tenant_type=supplier" style={{ background: `linear-gradient(135deg, ${c.accent} 0%, ${c.accentHover} 100%)`, color: "#fff", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15 }}>Tedarikci Ol</a>
            <a href="/demo?audience=supplier" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>Tedarikci Demosu</a>
            <a href="#planlar" style={{ background: "transparent", color: c.accent, border: `1px solid ${c.accent}`, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>Planlari Gor</a>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "52px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Tedarikci icin Ne Sunuyoruz?</h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 32, fontSize: 15 }}>Gorunurlukten buyumeye, butun asamalarda yaninizdayiz</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <article key={f.title} style={{ background: "#fff", borderTop: "1px solid #e0f2fe", borderRight: "1px solid #e0f2fe", borderBottom: "1px solid #e0f2fe", borderLeft: `4px solid ${c.accent}`, borderRadius: 14, padding: 22, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 20, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 16, marginBottom: 6 }}>{f.title}</div>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6, fontSize: 14 }}>{f.desc}</p>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {matchingDetails.map((item) => (
            <article key={item.title} style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 14, padding: 18, boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)" }}>
              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{item.title}</div>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.7, fontSize: 14 }}>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planlar" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 52px" }}>
        <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>Tedarikciler sayfasina tasinan fiyatlandirma ve cozum yapisi</h2>
          <p style={{ margin: 0, textAlign: "center", color: "#64748b", lineHeight: 1.7 }}>
            Eski Fiyatlandirma ve Cozumler icerigi artik tedarikci baglaminda burada okunur. Gorunurluk, teklif hizi ve premium vitrinde one cikma ayni plan katmaninda anlatilir.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {supplierPlans.map((plan) => (
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

      <section style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1e4976 100%)`, padding: "52px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 32 }}>Nasil Baslarsiniz?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {steps.map((s) => (
              <div key={s.num} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 14, padding: 22, textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, margin: "0 auto 14px" }}>{s.num}</div>
                <div style={{ fontWeight: 800, color: "#fff", marginBottom: 6, fontSize: 15 }}>{s.title}</div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ textAlign: "center", padding: "52px 24px", background: "#fff" }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>Hemen Platforma Katilin</h2>
        <p style={{ color: "#64748b", marginBottom: 28, fontSize: 15 }}>Ucretsiz temel plan ile hemen baslayin.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/onboarding?tenant_type=supplier" style={{ background: `linear-gradient(135deg, ${c.bg} 0%, #1e4976 100%)`, color: c.accent, padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15, border: "1px solid rgba(14,165,233,0.3)" }}>Tedarikci Kaydi</a>
          <a href="/demo?audience=supplier" style={{ background: c.accent, color: "#fff", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 800, fontSize: 15 }}>Demo Talep Et</a>
          <a href="/supplier/login" style={{ background: "#f1f5f9", color: "#0f172a", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15, border: "1px solid #e2e8f0" }}>Tedarikci Girisi</a>
        </div>
      </section>

      <footer style={{ background: c.bg, color: "rgba(255,255,255,0.55)", textAlign: "center", padding: "20px", fontSize: 13 }}>
        (c) {new Date().getFullYear()} BUYER ASISTANS - Tedarikci Programi
      </footer>
    </div>
  );
}
