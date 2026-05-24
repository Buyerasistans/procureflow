import NavBar from "../components/NavBar";
import HelpCenterInline from "../components/HelpCenterInline";

type KnowledgeMode = "blog" | "rehber" | "sozluk";

const COPY_BY_MODE: Record<KnowledgeMode, { title: string; subtitle: string; bullets: string[] }> = {
  blog: {
    title: "Bilgi Merkezi Blog",
    subtitle: "Satın alma operasyonları, tedarikçi yönetimi ve uygulama pratikleri için güncel yazı havuzu.",
    bullets: [
      "Saha ogrenimleri ve vaka notlari",
      "Satın alma süreç optimizasyonu",
      "Tedarikçi performans ve KPI yorumları",
    ],
  },
  rehber: {
    title: "Uygulama Rehberleri",
    subtitle: "Ekiplere hizli devreye alma ve operasyon standardi kazandiran adim adim kilavuzlar.",
    bullets: [
      "Onboarding ve rol dagitimi kilavuzu",
      "RFQ ve onay akis kontrol listeleri",
      "Raporlama ve denetim izi hazirligi",
    ],
  },
  sozluk: {
    title: "Terim Sozlugu",
    subtitle: "Platform ve satin alma operasyonlarinda kullanilan temel kavramlarin ortak dili.",
    bullets: [
      "Rol, yetki ve onay terimleri",
      "Tedarikçi ve teklif süreci kavramları",
      "Operasyon ve yönetişim tanımları",
    ],
  },
};

function resolveMode(pathname: string): KnowledgeMode {
  if (pathname.startsWith("/rehber")) return "rehber";
  if (pathname.startsWith("/sozluk")) return "sozluk";
  return "blog";
}

export default function KnowledgeLandingPage() {
  const mode = resolveMode(window.location.pathname);
  const copy = COPY_BY_MODE[mode];

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Segoe UI', sans-serif", background: "#f8fafc" }}>
      <NavBar activePath={`/${mode}`} />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 56px" }}>
        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 24 }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 34, color: "#0f172a" }}>{copy.title}</h1>
          <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 15, lineHeight: 1.7 }}>{copy.subtitle}</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.9 }}>
            {copy.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <HelpCenterInline />
      </main>
    </div>
  );
}
