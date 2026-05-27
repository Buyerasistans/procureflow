import NavBar from "../components/NavBar";

const cards = [
  {
    title: "RFQ Yönetimi",
    body: "Tek panelden RFQ oluşturun, teknik dokümanları yönetin ve tedarikçi yanıtlarını izlenebilir şekilde toplayın.",
    bullets: ["Kategori bazlı RFQ setleri", "SLA destekli süreç takibi", "Çoklu para birimi hazırlığı"],
  },
  {
    title: "Onay Akışları",
    body: "Rol bazlı çok seviyeli onay akışlarıyla satın alma kararlarını yönetişim standartlarına uygun şekilde güvence altına alın.",
    bullets: ["required_business_role uyumu", "Denetim izi ve tarihce", "Istisna/kural modeli"],
  },
  {
    title: "Tedarikçi Ağı ve Portal",
    body: "Platform havuzu ve özel tedarikçi ağını tek modelde yönetin, tedarikçi deneyimini sade bir portalda standardize edin.",
    bullets: ["Platform supplier pool", "Kurum özel puanlama", "Tedarikçi devreye alma"],
  },
  {
    title: "Raporlama ve Analitik",
    body: "KPI, fiyat kırılımları, teklif dinamikleri ve onay performansını yönetime uygun rapor panolarına dönüştürün.",
    bullets: ["Yönetim özet panosu", "Operasyonel rapor export", "Kullanım ve benimseme metrikleri"],
  },
  {
    title: "Entegrasyon Katmanı",
    body: "ERP ve i? sistemlerle kontroll? veri ak???na haz?r entegrasyon modeli ile tekrarl? veri giri?ini azalt?n.",
    bullets: ["API-first mimari", "Webhook tetikleyiciler", "Kimlik ve yetki izolasyonu"],
  },
  {
    title: "Stratejik Partner Operasyonları",
    body: "Sadece ürün değil; kategori yönetimi, onboarding ve operasyon setup'ını birlikte tasarlayan hizmet katmanı.",
    bullets: ["Onboarding studio", "Operasyon runbooklari", "Surekli iyilestirme dongusu"],
  },
];

export default function SolutionsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)", fontFamily: "'Segoe UI', sans-serif" }}>
      <NavBar activePath="/cozumler" />
      <main style={{ padding: "40px 20px" }}>
      <section style={{ maxWidth: 1080, margin: "0 auto" }}>
        <h1 style={{ fontSize: 40, marginBottom: 8, color: "#0f172a" }}>Çözümler</h1>
        <p style={{ color: "#475569", marginBottom: 28, maxWidth: 860, lineHeight: 1.7 }}>
          Bu i?erik art?k Teklifler, Tedarik?iler ve Stratejik Partnerlik sayfalar?na da??t?ld?. Bu sayfa sadece ge?i? merkezi olarak tutulur.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {cards.map((c) => (
            <article key={c.title} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, color: "#0f172a" }}>{c.title}</h2>
              <p style={{ margin: 0, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{c.body}</p>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#334155", fontSize: 13, lineHeight: 1.6 }}>
                {c.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section style={{ marginTop: 26, background: "#0f172a", color: "#e2e8f0", borderRadius: 16, padding: 20 }}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22, color: "#f8fafc" }}>Bizi Ayrıştıran Kurumsal Çerçeve</h2>
          <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14 }}>
            Rakiplerde görülen geniş ürün setini; daha net rol modeli, daha hızlı canlıya geçiş ve yönetim seviyesi raporlanabilirlik ile birleştiriyoruz.
            Bu sayede sadece operasyon değil, satın alma yönetimi kültürünü de olgunlaştıran bir stratejik partner deneyimi sunuyoruz.
          </p>
        </section>

        <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <a href="/teklifler" style={ctaPrimary}>Teklifler Akisina Git</a>
          <a href="/tedarikciler" style={ctaSecondary}>Tedarik?iler Sayfas?na Git</a>
          <a href="/stratejik-ortaklik" style={ctaSecondary}>Stratejik Partnerlik Sayfas?na Git</a>
        </div>
      </section>
      </main>
    </div>
  );
}

const ctaPrimary = {
  background: "#16a34a",
  color: "#062012",
  borderRadius: 9,
  padding: "10px 16px",
  textDecoration: "none",
  fontWeight: 700,
};

const ctaSecondary = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  padding: "10px 16px",
  textDecoration: "none",
  fontWeight: 700,
};

