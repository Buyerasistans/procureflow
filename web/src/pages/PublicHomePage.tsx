import NavBar from "../components/NavBar";
import "./PublicHomePage.css";

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
    <div className="php-root">
      <NavBar activePath="/" />
      <main className="php-main">
        <section className="php-container">
          <section className="php-slider-section">
            <div className="php-slider-ratio">
              <iframe
                src="/slider/Sunum_Slider.html"
                title="BUYER ASISTANS Kurumsal Sunum"
                className="php-slider-iframe"
                allowFullScreen
              />
            </div>
          </section>

          <section className="php-cta-row">
            <a href="/onboarding" className="php-cta php-cta--green">Hemen Başla</a>
            <a href="/teklifler" className="php-cta php-cta--teal">Açık İhaleler</a>
            <a href="/stratejik-ortaklik" className="php-cta php-cta--gold">Stratejik Partnerlerimiz</a>
            <a href="/is-ortagi-programi" className="php-cta php-cta--dark">Başarılı İş Ortaklarımız</a>
          </section>

          <section className="php-audience-grid">
            <article className="php-tile">
              <div className="php-tile-title">Stratejik Ortaklar İçin</div>
              <p className="php-tile-body">
                Kurumsal satın alma ekipleri için onboarding, yönetişim ve operasyon sürecini birlikte kurgulayan model.
              </p>
              <div className="php-tile-links">
                <a href="/onboarding" className="php-mini-primary">Stratejik Ortak Ol</a>
                <a href="/demo?audience=strategic" className="php-mini-ghost">Stratejik Ortak Demosu</a>
                <a href="/fiyatlandirma#stratejik" className="php-mini-ghost">Stratejik Planlar</a>
              </div>
            </article>
            <article className="php-tile">
              <div className="php-tile-title">Tedarikçiler İçin</div>
              <p className="php-tile-body">
                Tedarikçi programı ile daha fazla görünürlük, hızlı teklif yanıtı ve performans bazlı büyüme imkanları.
              </p>
              <div className="php-tile-links">
                <a href="/supplier/register" className="php-mini-primary">Tedarikçi Ol</a>
                <a href="/supplier/login" className="php-mini-ghost">Tedarikçi Girişi</a>
                <a href="/demo?audience=supplier" className="php-mini-ghost">Tedarikçi Demosu</a>
                <a href="/fiyatlandirma#tedarikci" className="php-mini-ghost">Tedarikçi Planları</a>
              </div>
            </article>
            <article className="php-tile">
              <div className="php-tile-title">İş Ortakları / Komisyoncular İçin</div>
              <p className="php-tile-body">
                Getirdiğiniz partner ve tedarikçi kayıtları için attribution tabanlı hakediş modeli,
                Şeffaf komisyon takibi ve ekip paneli.
              </p>
              <div className="php-tile-links">
                <a href="/is-ortagi-programi" className="php-mini-primary">İş Ortağı Programı</a>
                <a href="/demo?audience=strategic" className="php-mini-ghost">Program Demosu</a>
                <a href="/onboarding" className="php-mini-ghost">Başvuru Başlat</a>
              </div>
            </article>
          </section>

          <section className="php-highlights-grid">
            {highlights.map((item) => (
              <article key={item.label} className="php-tile">
                <div className="php-highlight-label">{item.label}</div>
                <div className="php-highlight-value">{item.value}</div>
              </article>
            ))}
          </section>

          <section className="php-panel-grid">
            <article className="php-panel">
              <h2 className="php-h2">Neden BUYER ASISTANS?</h2>
              <p className="php-body">
                Referans pazar oyuncularindaki en iyi yaklasimlari; daha yalin onboarding, daha net rol ayrimi ve daha guvenli denetim iziyle yeniden tasarladik.
              </p>
              <ul className="php-list">
                <li>Alıcı ve tedarikçi tarafı için ayrı ama senkron çalışma deneyimi</li>
                <li>Kurumsal yönetişime uygun, kanıtlanabilir onay zinciri</li>
                <li>Platform analytics ile yönetim kuruluna hazır KPI panosu</li>
                <li>Ayni altyapiyla coklu marka/domain yayini</li>
              </ul>
            </article>
            <article className="php-panel">
              <h2 className="php-h2">Stratejik Partnerlik Sozu</h2>
              <p className="php-body">
                Sadece yazılım değil; category, onay ve tedarikçi devreye alma disiplinini birlikte standardize eden bir operasyon modeli sunuyoruz.
              </p>
              <a href="/demo" className="php-primary-cta">Kurumsal Demo Planla</a>
            </article>
          </section>

          <section className="php-flow-section">
            <h2 className="php-h2 php-h2--mb">Platform Akışı</h2>
            <div className="php-auto-grid">
              {flowSteps.map((step) => (
                <article key={step.title} className="php-tile">
                  <div className="php-tile-title">{step.title}</div>
                  <p className="php-tile-body php-tile-body--top">{step.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="php-domain-section">
            <h2 className="php-h2 php-h2--mb">Domain Görev Dağılımı Örneği</h2>
            <div className="php-auto-grid">
              {domainMap.map((d) => (
                <article key={d.domain} className="php-tile">
                  <div className="php-tile-title php-tile-title--lg">{d.domain}</div>
                  <div className="php-domain-role">{d.role}</div>
                  <p className="php-tile-body php-tile-body--top">{d.why}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className="php-footer">
            © {new Date().getFullYear()} BUYER ASISTANS · Stratejik Partner Satın Alma Platformu
          </footer>
        </section>
      </main>
    </div>
  );
}
