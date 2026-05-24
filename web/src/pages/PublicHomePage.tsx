import NavBar from "../components/NavBar";

const highlights = [
  { label: "Kurumsal RFQ", value: "Dakikalar içinde ihale" },
  { label: "Onay Yönetişimi", value: "Rol bazlı + denetlenebilir" },
  { label: "Tedarikçi Ağı", value: "Platform + özel havuz" },
  { label: "Stratejik Partner", value: "Tenant-izole çalışma alanı" },
];

const domainMap = [
  {
    domain: "buyerasistans.com.tr",
    role: "Ana kurumsal vitrin",
    why: "TR hedef kitle, yerel güven ve marka otoritesi icin birincil alan.",
  },
  {
    domain: "buyerasistans.com",
    role: "Global/EN açılış sayfası",
    why: "Uluslararası aramalarda daha güçlü algı ve yurt dışı lead yakalama.",
  },
  {
    domain: "buyerasistans.online",
    role: "Kampanya ve demo landingleri",
    why: "Performans kampanyaları için hızlı A/B test ve mikro hedefleme.",
  },
  {
    domain: "buyerasistans.info",
    role: "Bilgi merkezi ve kaynak kütüphanesi",
    why: "SEO odaklı rehber, sözlük, doküman ve sektör içeriği ile organik büyüme.",
  },
];

const flowSteps = [
  {
    title: "1. Keşif ve Kayıt",
    detail:
      "Stratejik ortaklar onboarding ile, tedarikçiler supplier kayıt akışıyla platforma hızlı giriş yapar.",
  },
  {
    title: "2. Eşleşme ve Teklif",
    detail:
      "Alıcı talepleri, uygun tedarikçi havuzuna bağlanır; RFQ ve teklif süreci tek panelde izlenir.",
  },
  {
    title: "3. Onay ve Performans",
    detail:
      "Onay zinciri, teslimat ve performans metrikleriyle süreç kurumsal denetime hazır hale gelir.",
  },
];

export default function PublicHomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 10% 0%, #e8f8f1 0%, #eef7ff 40%, #f8fafc 100%)", fontFamily: "'Segoe UI', sans-serif" }}>
      <NavBar activePath="/" />
      <main style={{ padding: "24px 20px 64px" }}>
      <section style={{ maxWidth: 1120, margin: "0 auto" }}>
        <section style={{ width: "100%", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(15, 23, 42, 0.18)" }}>
          <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
            <iframe
              src="/slider/Sunum_Slider.html"
              title="BUYER ASISTANS Kurumsal Sunum"
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                border: "none",
                borderRadius: 16,
              }}
              allowFullScreen
            />
          </div>
        </section>

        <section style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/onboarding" style={ctaGreen}>Hemen Başla</a>
          <a href="/teklifler" style={ctaTeal}>Açık İhaleler</a>
          <a href="/stratejik-ortaklik" style={ctaGold}>Stratejik Partnerlerimiz</a>
          <a href="/is-ortagi-programi" style={ctaDark}>Başarılı İş Ortaklarımız</a>
        </section>

        <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <article style={tileCard}>
            <div style={{ fontWeight: 800, color: "#0f172a" }}>Stratejik Ortaklar İçin</div>
            <p style={{ margin: "8px 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              Kurumsal satın alma ekipleri için onboarding, yönetişim ve operasyon sürecini birlikte kurgulayan model.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/onboarding" style={miniPrimary}>Stratejik Ortak Ol</a>
              <a href="/demo?audience=strategic" style={miniGhost}>Stratejik Ortak Demosu</a>
              <a href="/fiyatlandirma#stratejik" style={miniGhost}>Stratejik Planlar</a>
            </div>
          </article>
          <article style={tileCard}>
            <div style={{ fontWeight: 800, color: "#0f172a" }}>Tedarikçiler İçin</div>
            <p style={{ margin: "8px 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              Tedarikçi programı ile daha fazla görünürlük, hızlı teklif yanıtı ve performans bazlı büyüme imkanları.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/supplier/register" style={miniPrimary}>Tedarikçi Ol</a>
              <a href="/supplier/login" style={miniGhost}>Tedarikçi Girişi</a>
              <a href="/demo?audience=supplier" style={miniGhost}>Tedarikçi Demosu</a>
              <a href="/fiyatlandirma#tedarikci" style={miniGhost}>Tedarikçi Planları</a>
            </div>
          </article>
          <article style={tileCard}>
            <div style={{ fontWeight: 800, color: "#0f172a" }}>İş Ortakları / Komisyoncular İçin</div>
            <p style={{ margin: "8px 0", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
              Getirdiğiniz partner ve tedarikçi kayıtları için attribution tabanlı hakediş modeli,
              Şeffaf komisyon takibi ve ekip paneli.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/is-ortagi-programi" style={miniPrimary}>İş Ortağı Programı</a>
              <a href="/demo?audience=strategic" style={miniGhost}>Program Demosu</a>
              <a href="/onboarding" style={miniGhost}>Başvuru Başlat</a>
            </div>
          </article>
        </section>

        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {highlights.map((item) => (
            <article key={item.label} style={tileCard}>
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "#64748b", letterSpacing: 1.2 }}>{item.label}</div>
              <div style={{ marginTop: 8, fontWeight: 800, color: "#0f172a", fontSize: 18 }}>{item.value}</div>
            </article>
          ))}
        </section>

        <section style={{ marginTop: 38, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
          <article style={panelCard}>
            <h2 style={h2}>Neden BUYER ASISTANS?</h2>
            <p style={bodyText}>
              Referans pazar oyuncularindaki en iyi yaklasimlari; daha yalin onboarding, daha net rol ayrimi ve daha guvenli denetim iziyle yeniden tasarladik.
            </p>
            <ul style={listStyle}>
              <li>Alici ve tedarikci tarafi icin ayri ama senkron calisma deneyimi</li>
              <li>Kurumsal yönetişime uygun, kanıtlanabilir onay zinciri</li>
              <li>Platform analytics ile yönetim kuruluna hazır KPI panosu</li>
              <li>Ayni altyapiyla coklu marka/domain yayini</li>
            </ul>
          </article>
          <article style={panelCard}>
            <h2 style={h2}>Stratejik Partnerlik Sozu</h2>
            <p style={bodyText}>
              Sadece yazılım değil; category, onay ve tedarikçi devreye alma disiplinini birlikte standardize eden bir operasyon modeli sunuyoruz.
            </p>
            <a href="/demo" style={{ ...primaryCta, display: "inline-block", marginTop: 8 }}>Kurumsal Demo Planla</a>
          </article>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ ...h2, marginBottom: 12 }}>Platform Akışı</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {flowSteps.map((step) => (
              <article key={step.title} style={tileCard}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{step.title}</div>
                <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.6, fontSize: 14 }}>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 38 }}>
          <h2 style={{ ...h2, marginBottom: 12 }}>Domain Görev Dağılımı Örneği</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {domainMap.map((d) => (
              <article key={d.domain} style={tileCard}>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 18 }}>{d.domain}</div>
                <div style={{ marginTop: 6, color: "#0b5d4a", fontWeight: 700 }}>{d.role}</div>
                <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.6, fontSize: 14 }}>{d.why}</p>
              </article>
            ))}
          </div>
        </section>

        <footer style={{ marginTop: 44, borderTop: "1px solid #dbeafe", paddingTop: 18, color: "#475569", fontSize: 13 }}>
          © {new Date().getFullYear()} BUYER ASISTANS · Stratejik Partner Satın Alma Platformu
        </footer>
      </section>
      </main>
    </div>
  );
}

const primaryCta = {
  background: "#22c55e",
  color: "#07261c",
  padding: "12px 18px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
};

const panelCard = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.05)",
};

const tileCard = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
};

const h2 = {
  margin: "0 0 8px",
  fontSize: 24,
  color: "#0f172a",
};

const bodyText = {
  margin: "0 0 10px",
  color: "#334155",
  lineHeight: 1.7,
};

const listStyle = {
  margin: 0,
  paddingLeft: 18,
  color: "#334155",
  lineHeight: 1.8,
};

const miniPrimary = {
  background: "#16a34a",
  color: "#062012",
  borderRadius: 8,
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
};

const miniGhost = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
};

const ctaBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 24px",
  borderRadius: 12,
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 15,
  boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  letterSpacing: 0.2,
  minWidth: 210,
};

const ctaGreen = { ...ctaBase, background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "#fff" };
const ctaTeal = { ...ctaBase, background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", color: "#fff" };
const ctaGold = { ...ctaBase, background: "linear-gradient(135deg, #D4AF37 0%, #b5952f 100%)", color: "#112a25" };
const ctaDark = { ...ctaBase, background: "linear-gradient(135deg, #112a25 0%, #1e4a3d 100%)", color: "#D4AF37" };
