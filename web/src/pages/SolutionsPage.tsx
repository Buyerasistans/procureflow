import NavBar from "../components/NavBar";

const cards = [
  {
    title: "RFQ Yönetimi",
    body: "Tek panelden RFQ olusturun, teknik dokumanlari yonetin ve tedarikci yanitlarini izlenebilir sekilde toplayin.",
    bullets: ["Kategori bazli RFQ setleri", "SLA destekli surec takibi", "Coklu para birimi hazirligi"],
  },
  {
    title: "Onay Akışları",
    body: "Rol bazli cok seviyeli onay akislariyla satin alma kararlarini yonetisim standartlarina uygun sekilde guvence altina alin.",
    bullets: ["required_business_role uyumu", "Denetim izi ve tarihce", "Istisna/kural modeli"],
  },
  {
    title: "Tedarikçi Ağı ve Portal",
    body: "Platform havuzu ve ozel tedarikci agini tek modelde yonetin, tedarikci deneyimini sade bir portalda standardize edin.",
    bullets: ["Platform supplier pool", "Kurum ozel puanlama", "Tedarikci devreye alma"],
  },
  {
    title: "Raporlama ve Analitik",
    body: "KPI, fiyat kirilimlari, teklif dinamikleri ve onay performansini yonetime uygun rapor panolarina donusturun.",
    bullets: ["Yonetim ozet panosu", "Operasyonel rapor export", "Kullanim ve benimseme metrikleri"],
  },
  {
    title: "Entegrasyon Katmanı",
    body: "ERP ve ic sistemlerle kontrollu veri akisina hazir entegrasyon modeli ile tekrarli veri girisini azaltin.",
    bullets: ["API-first mimari", "Webhook tetikleyiciler", "Kimlik ve yetki izolasyonu"],
  },
  {
    title: "Stratejik Partner Operasyonları",
    body: "Sadece urun degil; kategori yonetimi, onboarding ve operasyon setup'ini birlikte tasarlayan hizmet katmani.",
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
          Bu icerik artik Teklifler, Tedarikciler ve Stratejik Partnerlik sayfalarina dagitildi. Bu sayfa sadece gecis merkezi olarak tutulur.
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
            Rakiplerde gorulen genis urun setini; daha net rol modeli, daha hizli canliya gecis ve yonetim seviyesi raporlanabilirlik ile birlestiriyoruz.
            Bu sayede sadece operasyon degil, satin alma yonetimi kulturunu de olgunlastiran bir stratejik partner deneyimi sunuyoruz.
          </p>
        </section>

        <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <a href="/teklifler" style={ctaPrimary}>Teklifler Akisina Git</a>
          <a href="/tedarikciler" style={ctaSecondary}>Tedarikciler Sayfasina Git</a>
          <a href="/stratejik-ortaklik" style={ctaSecondary}>Stratejik Partnerlik Sayfasina Git</a>
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

