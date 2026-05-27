import NavBar from "../components/NavBar";
import { BRAND_COLORS } from "../components/nav-brand-colors";

const c = BRAND_COLORS.channel;

const benefits = [
  {
    title: "Referans Bazlı Gelir",
    desc: "Getirdiğiniz stratejik partner ve tedarikçi kayıtları için komisyon ve hedef bazlı prim modeli.",
  },
  {
    title: "Şeffaf Hakediş Takibi",
    desc: "Attribution kilidi ve ledger kayıtları ile hangi kayıttan ne kazandığınızı net görün.",
  },
  {
    title: "Hazır Satış Kitleri",
    desc: "Demo deck, referans senaryoları ve onboarding scriptleri ile daha hızlı dönüşüm.",
  },
  {
    title: "Panel ve Raporlama",
    desc: "Ekibinizin performansını, dönüşüm oranını ve ödeme bekleyen kalemleri tek panelde izleyin.",
  },
];

export default function ChannelPartnerProgramPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fffaf3", fontFamily: "'Segoe UI', sans-serif" }}>
      <NavBar variant="channel" activePath="/is-ortagi-programi" />

      <section
        style={{
          background: `linear-gradient(135deg, ${c.bg} 0%, #3a250f 55%, #4a2d0f 100%)`,
          color: c.text,
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.35)",
              color: c.accent,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            İş Ortağı / Komisyon Programı
          </div>
          <h1 style={{ margin: "0 0 14px", fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 900, color: "#fff" }}>
            Networkunuzu Gelire Dönüştürün
          </h1>
          <p style={{ margin: "0 auto 28px", maxWidth: 720, color: "rgba(255,247,237,0.86)", lineHeight: 1.7, fontSize: 16 }}>
            İş ortağı programı; getirdiğiniz partner ve tedarikçi kayıtlarını kalıcı attribution ile takip eder,
            hakedişleri şeffaf şekilde hesaplar ve ödeme akışını ölçeklendirir.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/demo?audience=strategic" style={primaryBtn}>
              Program Demosu Talep Et
            </a>
            <a href="/is-ortagi-basvuru" style={ghostBtn}>
              Başvuru Sürecini Başlat
            </a>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "46px 24px" }}>
        <h2 style={{ margin: "0 0 18px", fontSize: 28, fontWeight: 900, color: "#1f2937", textAlign: "center" }}>
          Programda Neler Var?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {benefits.map((item) => (
            <article
              key={item.title}
              style={{
                background: "#fff",
                border: "1px solid #fde7c0",
                borderLeft: `4px solid ${c.accent}`,
                borderRadius: 14,
                padding: 18,
                boxShadow: "0 6px 16px rgba(17,24,39,0.06)",
              }}
            >
              <div style={{ fontWeight: 800, color: "#111827", marginBottom: 8 }}>{item.title}</div>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6, fontSize: 14 }}>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const primaryBtn = {
  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  color: "#2b1d0e",
  padding: "13px 24px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 14,
} as const;

const ghostBtn = {
  background: "rgba(255,255,255,0.08)",
  color: "#fff7ed",
  border: "1px solid rgba(255,247,237,0.35)",
  padding: "13px 24px",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
} as const;
