import NavBar from "../components/NavBar";
import "./SolutionsPage.css";

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
    <div className="sp-root">
      <NavBar activePath="/cozumler" />
      <main className="sp-main">
      <section className="sp-section">
        <h1 className="sp-h1">Çözümler</h1>
        <p className="sp-intro">
          Bu i?erik art?k Teklifler, Tedarik?iler ve Stratejik Partnerlik sayfalar?na da??t?ld?. Bu sayfa sadece ge?i? merkezi olarak tutulur.
        </p>

        <div className="sp-grid">
          {cards.map((c) => (
            <article key={c.title} className="sp-card">
              <h2 className="sp-card__title">{c.title}</h2>
              <p className="sp-card__body">{c.body}</p>
              <ul className="sp-card__bullets">
                {c.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <section className="sp-framework">
          <h2 className="sp-framework__title">Bizi Ayrıştıran Kurumsal Çerçeve</h2>
          <p className="sp-framework__body">
            Rakiplerde görülen geniş ürün setini; daha net rol modeli, daha hızlı canlıya geçiş ve yönetim seviyesi raporlanabilirlik ile birleştiriyoruz.
            Bu sayede sadece operasyon değil, satın alma yönetimi kültürünü de olgunlaştıran bir stratejik partner deneyimi sunuyoruz.
          </p>
        </section>

        <div className="sp-cta-row">
          <a href="/teklifler" className="sp-cta--primary">Teklifler Akisina Git</a>
          <a href="/tedarikciler" className="sp-cta--secondary">Tedarik?iler Sayfas?na Git</a>
          <a href="/stratejik-ortaklik" className="sp-cta--secondary">Stratejik Partnerlik Sayfas?na Git</a>
        </div>
      </section>
      </main>
    </div>
  );
}
