import NavBar from "../components/NavBar";
import "./SupplierProgramPage.css";

const features = [
  { icon: "[Hiz]", title: "Hızlı Profil Devreye Alma", desc: "Tedarikçi profilinizi dakikalar içinde oluşturun, kategori ve coğrafya etiketlerinizi tanımlayın." },
  { icon: "[İhale]", title: "İhale Davetlerine Tek Panelden Yanıt", desc: "Gelen ihale davetlerini tek yerden görün, teklifinizi gönderin, durumu takip edin." },
  { icon: "[Kategori]", title: "Kategori Bazlı Görünürlük", desc: "Seçtiğiniz ürün ve hizmet kategorilerinde alıcı kurumların radarında kalın." },
  { icon: "[Rapor]", title: "Performans ve Geri Bildirim Raporu", desc: "Teklif kabul orani, teslimat puani ve alici yorumlariyla kendinizi gelistirin." },
  { icon: "[Rozet]", title: "Öncü Tedarikçi Rozeti", desc: "Prime seviyede öne çıkma ve öncelikli ihale daveti fırsatları kazanın." },
  { icon: "[Bağlantı]", title: "Dogrudan Alici Bağlantısi", desc: "Alıcı kurumlarla güvenli mesajlaşma ve sözleşme yönetimi tek platformda." },
];

const steps = [
  { num: "01", title: "Kayıt ve Profil", desc: "Tedarikçi kaydı oluşturun, kategori ve belgelerinizi yükleyin." },
  { num: "02", title: "Onay ve Devreye Alma", desc: "Platform ekibinin hizli onayinin ardindan aktif duruma gecin." },
  { num: "03", title: "İhale Yanıtı", desc: "Gelen ihale davetlerine teklif gönderin, müzakereleri yönetin." },
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
    desc: "Super admin ekibi kategori eşleşmelerini Stratejik Partner Yönetimi ekranında toplu görür. Böylece tedarikçi portföyü boş kalan kategoriler hızla fark edilir.",
  },
];

const supplierPlans = [
  {
    name: "Tedarikçi Ücretsiz",
    price: "0 TRY / ay",
    variant: "free" as const,
    features: ["Profil olusturma", "Teklif yanitlama", "Aylik performans ozeti"],
  },
  {
    name: "Tedarikçi Prime",
    price: "Premium feature ile genisler",
    variant: "prime" as const,
    features: ["One cikarma", "Kategori bazli rapor", "Oncelikli gorunurluk"],
  },
];

export default function SupplierProgramPage() {
  const activePath = typeof window !== "undefined" && window.location.pathname === "/tedarikciler" ? "/tedarikciler" : "/tedarikci-ol";

  return (
    <div className="spp-root">
      <NavBar variant="supplier" activePath={activePath} />

      <section className="spp-hero">
        <div className="spp-hero-inner">
          <div className="spp-hero-badge">Tedarikçi Programı</div>
          <h1 className="spp-hero-title">
            Daha Fazla Aliciya Ulasin, <span className="spp-hero-title-accent">Daha Hizli Buyuyun</span>
          </h1>
          <p className="spp-hero-desc">
            BUYER ASISTANS tedarikçi programı; kurumsal alıcılarla buluşmanız, tekliflerinizi yönetmeniz ve performansınızı izlemeniz için tek bir platformdur.
          </p>
          <div className="spp-hero-info-box">
            <div className="spp-hero-info-label">Kategoriye Gore Gorunurluk</div>
            <div className="spp-hero-info-text">
              Tedarikçi kaydında seçtiğiniz kategori ve uzmanlık alanı yalnızca bilgi amaçlı tutulmaz.
              Bu veri sizi uygun stratejik partner havuzlariyla eslestirmek, dogru RFQ akislarinda gorunur kilmak ve
              platform ekibinin kategori bazlı supplier kapsamını yönetebilmesi için aktif olarak kullanılır.
            </div>
          </div>
          <div className="spp-hero-ctas">
            <a href="/onboarding?tenant_type=supplier" className="spp-hero-cta-primary">Tedarikçi Ol</a>
            <a href="/demo?audience=supplier" className="spp-hero-cta-demo">Tedarikçi Demosu</a>
            <a href="#planlar" className="spp-hero-cta-plans">Planlari Gor</a>
          </div>
        </div>
      </section>

      <section className="spp-features-section">
        <h2 className="spp-features-title">Tedarikçi İçin Ne Sunuyoruz?</h2>
        <p className="spp-features-subtitle">Gorunurlukten buyumeye, butun asamalarda yaninizdayiz</p>
        <div className="spp-features-grid">
          {features.map((f) => (
            <article key={f.title} className="spp-feature-card">
              <div className="spp-feature-icon">{f.icon}</div>
              <div className="spp-feature-name">{f.title}</div>
              <p className="spp-feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
        <div className="spp-matching-grid">
          {matchingDetails.map((item) => (
            <article key={item.title} className="spp-matching-card">
              <div className="spp-matching-title">{item.title}</div>
              <p className="spp-matching-desc">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planlar" className="spp-plans-section">
        <div className="spp-plans-header">
          <h2 className="spp-plans-title">Tedarikçiler sayfasına taşınan fiyatlandırma ve çözüm yapısı</h2>
          <p className="spp-plans-subtitle">
            Eski Fiyatlandırma ve Çözümler içeriği artık tedarikçi bağlamında burada okunur. Görünürlük, teklif hızı ve premium vitrinde öne çıkma aynı plan katmanında anlatılır.
          </p>
        </div>
        <div className="spp-plans-grid">
          {supplierPlans.map((plan) => (
            <article key={plan.name} className={`spp-plan-card spp-plan-card--${plan.variant}`}>
              <div className="spp-plan-name">{plan.name}</div>
              <div className="spp-plan-price">{plan.price}</div>
              <ul className="spp-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="spp-steps-section">
        <div className="spp-steps-inner">
          <h2 className="spp-steps-title">Nasıl Başlarsınız?</h2>
          <div className="spp-steps-grid">
            {steps.map((s) => (
              <div key={s.num} className="spp-step-card">
                <div className="spp-step-num">{s.num}</div>
                <div className="spp-step-name">{s.title}</div>
                <p className="spp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="spp-cta-section">
        <h2 className="spp-cta-title">Hemen Platforma Katilin</h2>
        <p className="spp-cta-subtitle">Ucretsiz temel plan ile hemen baslayin.</p>
        <div className="spp-cta-group">
          <a href="/onboarding?tenant_type=supplier" className="spp-cta-register">Tedarikçi Kaydı</a>
          <a href="/demo?audience=supplier" className="spp-cta-demo">Demo Talep Et</a>
          <a href="/supplier/login" className="spp-cta-login">Tedarikçi Girişi</a>
        </div>
      </section>

      <footer className="spp-footer">
        (c) {new Date().getFullYear()} BUYER ASISTANS - Tedarikçi Programı
      </footer>
    </div>
  );
}
