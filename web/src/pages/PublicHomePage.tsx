import NavBar from "../components/NavBar";
import { useCampaigns } from "../hooks/useCampaigns";
import { SEGMENT_META } from "../admin/segment-colors";
import "./PublicHomePage.css";

const SM = SEGMENT_META;

const STATS = [
  { label: SM.strategic.label, value: "247",    sub: "Aktif firma",       color: SM.strategic.color, bg: SM.strategic.bg },
  { label: SM.supplier.label,  value: "1.840",  sub: "Onaylı tedarikçi",  color: SM.supplier.color,  bg: SM.supplier.bg  },
  { label: SM.channel.label,   value: "93",     sub: "Kanal partneri",    color: SM.channel.color,   bg: SM.channel.bg   },
  { label: SM.employer.label,  value: "312",    sub: "İşveren firma",     color: SM.employer.color,  bg: SM.employer.bg  },
  { label: SM.seeker.label,    value: "4.200+", sub: "Kariyer profili",   color: SM.seeker.color,    bg: SM.seeker.bg    },
  { label: "Memnuniyet",       value: "%97.4",  sub: "Platform skoru",    color: "#D4AF37",           bg: "#fffbeb"        },
];

const ECOSYSTEM = [
  {
    key: "strategic",
    title: "Stratejik Ortaklar",
    desc: "Kurumsal satın alma ekipleri için onboarding, yönetişim ve operasyon sürecini birlikte kurgulayan model.",
    color: SM.strategic.color,
    bg: SM.strategic.bg,
    border: "#a7f3d0",
    ctas: [
      { label: "Stratejik Ortak Ol", href: "/onboarding", primary: true },
      { label: "Demo Planla", href: "/demo?audience=strategic", primary: false },
    ],
  },
  {
    key: "supplier",
    title: "Tedarikçiler",
    desc: "Daha fazla görünürlük, hızlı teklif yanıtı ve performans bazlı büyüme imkânları.",
    color: SM.supplier.color,
    bg: SM.supplier.bg,
    border: "#a5f3fc",
    ctas: [
      { label: "Tedarikçi Girişi", href: "/supplier/login", primary: true },
      { label: "Tedarikçi Kaydı", href: "/supplier/register", primary: false },
    ],
  },
  {
    key: "channel",
    title: "İş Ortakları",
    desc: "Attribution tabanlı hakediş modeli, şeffaf komisyon takibi ve ekip paneliyle büyüyün.",
    color: SM.channel.color,
    bg: SM.channel.bg,
    border: "#fed7aa",
    ctas: [
      { label: "İş Ortağı Girişi", href: "/channel/login", primary: true },
      { label: "Program Demosu", href: "/is-ortagi-programi", primary: false },
    ],
  },
  {
    key: "career",
    title: "Kariyer & İK",
    desc: "Satın alma kariyeri için özgeçmiş oluştur, ilanları takip et; işverenler için hızlı kadro kurma.",
    color: SM.employer.color,
    bg: SM.employer.bg,
    border: "#e9d5ff",
    ctas: [
      { label: "İşveren Girişi", href: "/isveren-giris", primary: true },
      { label: "İş Arıyorum", href: "/is-arayan-giris", primary: false },
    ],
  },
];

const FEATURES = [
  { icon: "📋", title: "Kurumsal RFQ", desc: "Dakikalar içinde ihale oluştur, tedarikçi tekliflerini tek panelde karşılaştır." },
  { icon: "✅", title: "Onay Yönetişimi", desc: "Rol bazlı + denetlenebilir onay zinciri; kurumsal compliance'a hazır." },
  { icon: "🌐", title: "Tedarikçi Ağı", desc: "Platform havuzu + özel tenant havuzunu tek arayüzde yönet." },
  { icon: "🤝", title: "Stratejik Partner", desc: "Tenant-izole çalışma alanı; çoklu marka/domain desteği ile ölçeklen." },
];

const GROWTH = [
  { label: "Yıllık Büyüme", value: "+%38", sub: "2024→2025 platform hacmi" },
  { label: "Aylık Hacim", value: "₺12M+", sub: "İşlenen teklif tutarı" },
  { label: "SLA Uyum", value: "%99.7", sub: "Sistem erişilebilirliği" },
];

interface KampanyaCard {
  slug: string;
  badge: string;
  title: string;
  summary: string;
  color: string;
  bg: string;
  validUntil: string;
  ctas?: Array<{ label: string; href: string }>;
}

const KAMPANYALAR: KampanyaCard[] = [
  {
    slug: "yeni-tedarikci-hosgeldin",
    badge: "Yeni Üye",
    title: "Yeni Tedarikçi Hoş Geldin Paketi",
    summary: "İlk 3 ay temel özellikler ücretsiz. Teklif ver, kategori görünürlüğü kazan.",
    color: SM.supplier.color,
    bg: SM.supplier.bg,
    validUntil: "2026-12-31",
  },
  {
    slug: "stratejik-buyume",
    badge: "Büyüme",
    title: "Stratejik Partner Büyüme Paketi",
    summary: "İlk yıl platform ücretlerinde %20 indirim. Yalnızca kullandığın kadar öde.",
    color: SM.strategic.color,
    bg: SM.strategic.bg,
    validUntil: "2026-09-30",
  },
  {
    slug: "isveren-ik-paketi",
    badge: "İK",
    title: "İşveren İK Başlangıç Paketi",
    summary: "İlk 3 iş ilanın ücretsiz. Onaylı satın alma uzmanı adaylarına hemen ulaş.",
    color: SM.employer.color,
    bg: SM.employer.bg,
    validUntil: "2026-12-31",
  },
  {
    slug: "ilk-ilan-ucretsiz",
    badge: "Kariyer",
    title: "İlk İlan Ücretsiz — İşveren & Aday",
    summary: "İşverene ilk ilan ücretsiz. İş arayan adaylara CV profili ve başvuru paketi ücretsiz.",
    color: SM.seeker.color,
    bg: SM.seeker.bg,
    validUntil: "2026-12-31",
    ctas: [
      { label: "İşveren Yararlan", href: "/isveren-giris" },
      { label: "İş Arayan Yararlan", href: "/is-arayan-giris" },
    ],
  },
];

const WHY_CARDS = [
  {
    key: "stratejik-ortak",
    title: "Stratejik Ortak",
    tagline: "Satın alma sürecinizi standartlaştırın.",
    desc: "Onay zinciri, tedarikçi havuzu ve RFQ yönetimini tek platformda yönetin. Kurumsal denetim ve KPI panosu hazır.",
    color: SM.strategic.color,
    bg: SM.strategic.bg,
    border: "#a7f3d0",
    registerHref: "/onboarding",
    loginHref: "/strategic-partner-login",
    detailHref: "/neden-stratejik-ortak",
  },
  {
    key: "tedarikci",
    title: "Tedarikçi",
    tagline: "Onaylı alıcılara aracısız ulaşın.",
    desc: "Teklif şablonları, kategori görünürlüğü ve performans skoru ile büyüyün. Başarılı satış gerçekleştiğinde komisyon ödeyin.",
    color: SM.supplier.color,
    bg: SM.supplier.bg,
    border: "#a5f3fc",
    registerHref: "/supplier/register",
    loginHref: "/supplier/login",
    detailHref: "/neden-tedarikci",
  },
  {
    key: "cift-rol",
    title: "Çift Rol",
    tagline: "Hem alıcı hem satıcı — izole, şeffaf.",
    desc: "Aynı hesapta stratejik ortak ve tedarikçi modüllerini izole kullanın. Roller ve faturalar tamamen ayrı tutulur.",
    color: SM.platform.color,
    bg: SM.platform.bg,
    border: "#bfdbfe",
    registerHref: "/onboarding",
    loginHref: "/login",
    detailHref: "/cift-rol",
  },
  {
    key: "is-ortagi",
    title: "İş Ortağı",
    tagline: "Getir, kazan — attribution şeffaflığıyla.",
    desc: "Müşteri getirdiğinizde aylık hakediş kazanın. Komisyon takibi ve ekip paneli panelde şeffaf görünür.",
    color: SM.channel.color,
    bg: SM.channel.bg,
    border: "#fed7aa",
    registerHref: "/is-ortagi-basvuru",
    loginHref: "/channel/login",
    detailHref: "/neden-is-ortagi",
  },
  {
    key: "isveren",
    title: "İşveren",
    tagline: "Satın alma uzmanını 5 dakikada bulun.",
    desc: "Onaylı aday havuzu, hızlı ilan oluşturma ve İK rolü desteğiyle kadronuzu tamamlayın.",
    color: SM.employer.color,
    bg: SM.employer.bg,
    border: "#e9d5ff",
    registerHref: "/employer/register",
    loginHref: "/isveren-giris",
    detailHref: "/neden-isveren",
  },
  {
    key: "is-arayan",
    title: "İş Arayan",
    tagline: "Kariyeriniz için en doğru eşleşme.",
    desc: "Profil oluştur, onaylı işverenlerden gelecek ilanları bekle, başvurularını gerçek zamanlı izle. Tamamen ücretsiz.",
    color: SM.seeker.color,
    bg: SM.seeker.bg,
    border: "#fecdd3",
    registerHref: "/candidate/register",
    loginHref: "/is-arayan-giris",
    detailHref: "/neden-is-arayan",
  },
];

const DOMAINS = [
  { domain: "buyerasistans.com.tr", desc: "Ana Türkiye platformu. Tüm kurumsal akışlar bu domain üzerinden yürütülür.", badge: "Ana Platform" },
  { domain: "buyerasistans.com", desc: "Global / İngilizce yüzey. Uluslararası stratejik ortak ve tedarikçi erişimi.", badge: "Global" },
  { domain: "buyerasistans.online", desc: "Kampanya ve demo talep yüzeyi. Promosyon dönemlerinde aktif.", badge: "Kampanya" },
  { domain: "buyerasistans.info", desc: "Bilgi merkezi, sözlük ve rehber içerikler.", badge: "Bilgi Merkezi" },
];

export default function PublicHomePage() {
  const { campaigns: apiCampaigns } = useCampaigns();

  const activeCampaigns = apiCampaigns === null
    ? KAMPANYALAR
    : KAMPANYALAR.filter((k) => apiCampaigns.some((c) => c.code === k.slug));

  return (
    <div className="php-root">
      <NavBar activePath="/" />
      <main className="php-main">
        <div className="php-container">

          {/* ── SLIDER ── */}
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

          {/* ── CTA ROW ── */}
          <section className="php-cta-row">
            <a href="/login" className="php-cta php-cta--primary">Hemen Başla →</a>
            <a href="/teklifler" className="php-cta php-cta--teal">Açık İhaleler</a>
            <a href="/is-arayanlar" className="php-cta php-cta--purple">Aday Havuzu</a>
            <a href="/is-ilanlari" className="php-cta php-cta--wine">İş İlanları</a>
          </section>

          {/* ── REALTIME STATS BAND ── */}
          <section className="php-stats-band">
            <div className="php-stats-band__header">
              <span className="php-stats-live-dot" />
              <span className="php-stats-live-label">Gerçek Zamanlı</span>
            </div>
            <div className="php-stats-grid">
              {STATS.map((s) => (
                <div key={s.label} className="php-stat-card" style={{ "--stat-color": s.color, "--stat-bg": s.bg } as React.CSSProperties}>
                  <div className="php-stat-card__value">{s.value}</div>
                  <div className="php-stat-card__label">{s.label}</div>
                  <div className="php-stat-card__sub">{s.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── KAMPANYALAR ── */}
          {activeCampaigns.length > 0 && (
            <section className="php-campaigns">
              <div className="php-section-header">
                <h2 className="php-section-title">Aktif Kampanyalar</h2>
                <span className="php-section-note">Yalnızca yararlandığın kadar ödersin — yanlış tahsilat olmaz</span>
              </div>
              <div className="php-campaigns-grid">
                {activeCampaigns.map((k) => (
                  <article
                    key={k.slug}
                    className="php-campaign-card"
                    style={{ "--kc-color": k.color, "--kc-bg": k.bg } as React.CSSProperties}
                  >
                    <div className="php-campaign-badge">{k.badge}</div>
                    <div className="php-campaign-title">{k.title}</div>
                    <p className="php-campaign-summary">{k.summary}</p>
                    <div className="php-campaign-validity">Geçerlilik: {k.validUntil}</div>
                    <div className="php-campaign-actions">
                      {k.ctas ? (
                        <>
                          {k.ctas.map((cta) => (
                            <a key={cta.href} href={cta.href} className="php-campaign-btn php-campaign-btn--primary">{cta.label}</a>
                          ))}
                          <a href={`/kampanya/${k.slug}`} className="php-campaign-btn php-campaign-btn--ghost">Detay</a>
                        </>
                      ) : (
                        <>
                          <a href={`/kampanya/${k.slug}`} className="php-campaign-btn php-campaign-btn--primary">Yararlan</a>
                          <a href={`/kampanya/${k.slug}`} className="php-campaign-btn php-campaign-btn--ghost">Kampanya Detayı</a>
                          <a href="/demo" className="php-campaign-btn php-campaign-btn--ghost">Demo</a>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── WHY CARDS ── */}
          <section className="php-why">
            <h2 className="php-section-title">Neden BUYER ASISTANS?</h2>
            <div className="php-why-grid">
              {WHY_CARDS.map((w) => (
                <article
                  key={w.key}
                  className="php-why-card"
                  style={{ "--wc-color": w.color, "--wc-bg": w.bg, "--wc-border": w.border } as React.CSSProperties}
                >
                  <div className="php-why-card__title">{w.title}</div>
                  <div className="php-why-card__tagline">{w.tagline}</div>
                  <p className="php-why-card__desc">{w.desc}</p>
                  <div className="php-why-card__actions">
                    <a href={w.registerHref} className="php-why-btn php-why-btn--primary">Üye Ol</a>
                    <a href={w.loginHref} className="php-why-btn php-why-btn--ghost">Giriş</a>
                    <a href={w.detailHref} className="php-why-btn php-why-btn--link">Detay →</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── ECOSYSTEM CARDS ── */}
          <section className="php-ecosystem">
            <h2 className="php-section-title">Platform Ekosistemi</h2>
            <div className="php-ecosystem-grid">
              {ECOSYSTEM.map((e) => (
                <article
                  key={e.key}
                  className="php-eco-card"
                  style={{ "--eco-color": e.color, "--eco-bg": e.bg, "--eco-border": e.border } as React.CSSProperties}
                >
                  <div className="php-eco-card__title">{e.title}</div>
                  <p className="php-eco-card__desc">{e.desc}</p>
                  <div className="php-eco-card__ctas">
                    {e.ctas.map((c) => (
                      <a
                        key={c.href}
                        href={c.href}
                        className={c.primary ? "php-eco-btn php-eco-btn--primary" : "php-eco-btn php-eco-btn--ghost"}
                      >
                        {c.label}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── FEATURE BOXES ── */}
          <section className="php-features">
            <h2 className="php-section-title">Temel Yetenekler</h2>
            <div className="php-features-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="php-feature-card">
                  <div className="php-feature-card__icon">{f.icon}</div>
                  <div className="php-feature-card__title">{f.title}</div>
                  <p className="php-feature-card__desc">{f.desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* ── CATEGORY MATCHING ENGINE ── */}
          <section className="php-cat-engine">
            <h2 className="php-section-title">Kategori Bazli Eslesme Motoru</h2>
            <p className="php-cat-engine__desc">
              Super admin panelinde kategori kapsami, eslesen supplier sayisi ve kategori eksikleri tek bakista izlenir.
            </p>
            <div className="php-cat-engine__actions">
              <a href="/stratejik-ortaklik" className="php-cta php-cta--primary">Stratejik Ortaklik</a>
            </div>
          </section>

          {/* ── DEMO CTA BAND ── */}
          <section className="php-demo-band">
            <div className="php-demo-band__left">
              <div className="php-demo-band__title">Demo İste</div>
              <p className="php-demo-band__desc">45 dakikada sektörünüze özel canlı senaryo, gap analizi ve 90 günlük plan.</p>
            </div>
            <div className="php-demo-band__right">
              <a href="/demo?audience=strategic" className="php-demo-btn">Stratejik Ortak Demosu</a>
              <a href="/demo?audience=supplier" className="php-demo-btn php-demo-btn--supplier">Tedarikçi Demosu</a>
            </div>
          </section>

          {/* ── GROWTH SECTION ── */}
          <section className="php-growth">
            <div className="php-growth__left">
              <div className="php-growth__eyebrow">Platform Büyümesi</div>
              <h2 className="php-growth__title">Güvenilir, ölçeklenebilir, kanıtlanmış</h2>
              <p className="php-growth__desc">
                Referans pazar oyuncularındaki en iyi yaklaşımları daha yalın onboarding, net rol ayrımı
                ve güvenli denetim iziyle yeniden tasarladık.
              </p>
              <a href="/demo" className="php-growth__cta">Kurumsal Demo Planla →</a>
            </div>
            <div className="php-growth__right">
              {GROWTH.map((g) => (
                <div key={g.label} className="php-growth-stat">
                  <div className="php-growth-stat__value">{g.value}</div>
                  <div className="php-growth-stat__label">{g.label}</div>
                  <div className="php-growth-stat__sub">{g.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── OFFICIAL DOMAINS ── */}
          <section className="php-domains">
            <div className="php-domains-header">
              <h2 className="php-section-title">Resmi Domainlerimiz</h2>
              <p className="php-domains-sub">Yalnızca aşağıdaki resmi domainler üzerinden hizmet sunulmaktadır. Farklı bir domain gördüğünüzde dikkatli olun.</p>
            </div>
            <div className="php-domains-grid">
              {DOMAINS.map((d) => (
                <div key={d.domain} className="php-domain-card">
                  <div className="php-domain-card__domain">{d.domain}</div>
                  <p className="php-domain-card__desc">{d.desc}</p>
                  <span className="php-domain-card__badge">{d.badge}</span>
                </div>
              ))}
            </div>
            <div className="php-domains-fraud">
              ⚠️ Resmi yazışmalarımız yalnızca <strong>@buyerasistans.com.tr</strong> uzantılı e-posta adreslerinden yapılır. Farklı bir domain'den gelen mesajlara itibar etmeyin.
            </div>
          </section>

          <footer className="php-footer">
            © {new Date().getFullYear()} BUYER ASISTANS · Stratejik Partner Satın Alma Platformu
          </footer>

        </div>
      </main>
    </div>
  );
}
