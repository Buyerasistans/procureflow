import NavBar from "../components/NavBar";
import HelpCenterInline from "../components/HelpCenterInline";
import "./KnowledgeLandingPage.css";

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
    <div className="kl-root">
      <NavBar activePath={`/${mode}`} />
      <main className="kl-main">
        <section className="kl-card">
          <h1 className="kl-title">{copy.title}</h1>
          <p className="kl-subtitle">{copy.subtitle}</p>
          <ul className="kl-bullets">
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
