import NavBar from "../components/NavBar";
import "./StrategicPartnerProgramPage.css";

const features = [
  { icon: "[Plan]", title: "90 Gunluk Canliya Gecis Plani", desc: "Haftalik kilometre taslari, onboarding kocu ve teknik destek ile platforma en kisa surede entegre olun." },
  { icon: "[Onay]", title: "Rol Bazlı Onay ve Denetim", desc: "Çok seviyeli onay zinciri, denetim izi ve kurumsal yönetişim gerekliliklerine tam uyum." },
  { icon: "[Havuz]", title: "Tedarikçi Havuzu + Özel Havuz", desc: "Platform tedarikçi veri tabanı ile kendi özel tedarikçi listenizi yan yana yönetin." },
  { icon: "[KPI]", title: "Yönetim KPI Panosu", desc: "Tasarruf oranı, onay süresi, tedarikçi performansı ve yönetime hazır raporlar." },
  { icon: "[AI]", title: "AI Destekli Teklif Analizi", desc: "Gelen teklifleri piyasa verileriyle otomatik karsilastir, sapan fiyatlari aninda tespit et." },
  { icon: "[API]", title: "ERP / API Entegrasyonu", desc: "SAP, Oracle ve diger sistemlerle veri koprusu kurun, manuel veri girisini azaltin." },
];

const steps = [
  { num: "01", title: "Keşif Görüşmesi", desc: "Mevcut süreçlerinizi ve hedeflerinizi birlikte haritalandırıyoruz." },
  { num: "02", title: "Ozellestirilmis Demo", desc: "Sektorunuze ozel senaryolarla canli platform tanitimi." },
  { num: "03", title: "Onboarding Başlangıcı", desc: "90 günlük plan aktivasyonu ve ilk tedarikçi entegrasyonu." },
  { num: "04", title: "Tam Operasyon", desc: "Süreç optimizasyonu, raporlama ve sürekli iyileştirme döngüsü." },
];

const governanceDetails = [
  {
    title: "Onboardingde Kategori Toplanir",
    desc: "Stratejik partner kaydi acilirken faaliyet alani ve uzmanlik kategorisi onboarding akisinda kaydedilir. Bu bilgi sonraki operasyon katmanlarinda supplier uygunlugu icin referans olur.",
  },
  {
    title: "Supplier Uygunluğu İlk Günden Görünür",
    desc: "Platform yönetimi sizin kategorinizle aynı alanda aktif supplier sayısını tenant governance ekranında görür. Böylece ilk günden hangi kategori için hazır supplier kapsamı olduğu hızla anlaşılır.",
  },
  {
    title: "Kategori Eksigi Operasyon Kuyruguna Donusur",
    desc: "Kategori bilgisi eksik stratejik partnerlar ayrı filtrelenebilir. Bu da onboarding kalitesini yükseltir ve supplier eşleştirme kararlarını veriyle yönetilen bir akışa dönüştürür.",
  },
];

const planCards = [
  {
    name: "Başlangıç",
    price: "Kuruma ozel teklif",
    variant: "start" as const,
    features: ["RFQ + teklif toplama", "Temel onay akisi", "Standart destek"],
  },
  {
    name: "Gelisim",
    price: "Paket + premium kombinasyonu",
    variant: "grow" as const,
    features: ["Platform supplier agi", "KPI export", "Kategori bazli governance"],
  },
  {
    name: "Kurumsal",
    price: "Ozel SLA ve entegrasyon",
    variant: "enterprise" as const,
    features: ["ERP / API baglantisi", "Tenant-izole marka katmani", "Operasyon runbooklari"],
  },
];

export default function StrategicPartnerProgramPage() {
  const activePath = typeof window !== "undefined" && window.location.pathname === "/teklifler" ? "/teklifler" : "/stratejik-ortaklik";

  return (
    <div className="stpp-root">
      <NavBar variant="strategic" activePath={activePath} />

      <section className="stpp-hero">
        <div className="stpp-hero-inner">
          <div className="stpp-hero-badge">Stratejik Partner Programı</div>
          <h1 className="stpp-hero-title">
            Satin Alma Operasyonunuzu <span className="stpp-hero-title-accent">Birlikte Donusturelim</span>
          </h1>
          <p className="stpp-hero-desc">
            BUYER ASISTANS, kurumsal satın alma ekipleri için operasyonel yazılım ve süreç danışmanlığını bir arada sunar. Onboardingden tam operasyona kadar yanınızdayız.
          </p>
          <div className="stpp-hero-info-box">
            <div className="stpp-hero-info-label">Kategori Destekli Onboarding</div>
            <div className="stpp-hero-info-text">
              Stratejik partner onboardingi sirasinda girilen kategori ve uzmanlik alani yalnizca form verisi olarak kalmaz.
              Bu bilgi platform yönetiminde supplier kapsamı ile birlikte izlenir; böylece ilk günden hangi kategori için
              hazır tedarikçi havuzu olduğu ve hangi alanlarda ek supplier devreye alma gerektiği netleşir.
            </div>
          </div>
          <div className="stpp-hero-ctas">
            <a href="/onboarding?tenant_type=strategic_partner" className="stpp-hero-cta-primary">Stratejik Partner Ol</a>
            <a href="/demo?audience=strategic" className="stpp-hero-cta-demo">Demo Planla</a>
            <a href="#planlar" className="stpp-hero-cta-plans">Planlari Gor</a>
          </div>
        </div>
      </section>

      <section className="stpp-features-section">
        <h2 className="stpp-features-title">Stratejik Partnerlara Ozel Yetenekler</h2>
        <p className="stpp-features-subtitle">Kurumsal satin alma operasyonunuzu uctan uca kapsayan moduller</p>
        <div className="stpp-features-grid">
          {features.map((f) => (
            <article key={f.title} className="stpp-feature-card">
              <div className="stpp-feature-icon">{f.icon}</div>
              <div className="stpp-feature-name">{f.title}</div>
              <p className="stpp-feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
        <div className="stpp-gov-grid">
          {governanceDetails.map((item) => (
            <article key={item.title} className="stpp-gov-card">
              <div className="stpp-gov-title">{item.title}</div>
              <p className="stpp-gov-desc">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="planlar" className="stpp-plans-section">
        <div className="stpp-plans-header">
          <h2 className="stpp-plans-title">Teklifler sayfasına dağıtılan plan ve çözüm katmanı</h2>
          <p className="stpp-plans-subtitle">
            Eski Çözümler ve Fiyatlandırma anlatımı artık bu sayfanın içinde. RFQ, onay, supplier ağı ve yönetim KPI modülleri seçilen paketle birlikte aynı akışta okunur.
          </p>
        </div>
        <div className="stpp-plans-grid">
          {planCards.map((plan) => (
            <article key={plan.name} className={`stpp-plan-card stpp-plan-card--${plan.variant}`}>
              <div className="stpp-plan-name">{plan.name}</div>
              <div className="stpp-plan-price">{plan.price}</div>
              <ul className="stpp-plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="stpp-steps-section">
        <div className="stpp-steps-inner">
          <h2 className="stpp-steps-title">Nasıl Çalışır?</h2>
          <div className="stpp-steps-grid">
            {steps.map((s) => (
              <div key={s.num} className="stpp-step-card">
                <div className="stpp-step-num">{s.num}</div>
                <div className="stpp-step-name">{s.title}</div>
                <p className="stpp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stpp-cta-section">
        <h2 className="stpp-cta-title">Hazir misiniz?</h2>
        <p className="stpp-cta-subtitle">Kurumsal demo planlayin veya hemen kaydolun.</p>
        <div className="stpp-cta-group">
          <a href="/onboarding?tenant_type=strategic_partner" className="stpp-cta-register">Hemen Basla</a>
          <a href="/demo?audience=strategic" className="stpp-cta-demo">Demo Talep Et</a>
        </div>
      </section>

      <footer className="stpp-footer">
        (c) {new Date().getFullYear()} BUYER ASISTANS - Stratejik Partner Satin Alma Platformu
      </footer>
    </div>
  );
}
