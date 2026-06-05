import { useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import DemoRequestForm from "../components/DemoRequestForm";
import "./KampanyaDetailPage.css";

interface KampanyaData {
  slug: string;
  badge: string;
  title: string;
  summary: string;
  color: string;
  colorBg: string;
  validUntil: string;
  audience: "strategic" | "supplier" | "channel" | "employer" | "seeker";
  registerHref: string;
  conditions: string[];
  scope: string[];
  billingNote: string;
}

const KAMPANYALAR: Record<string, KampanyaData> = {
  "yeni-tedarikci-hosgeldin": {
    slug: "yeni-tedarikci-hosgeldin",
    badge: "Yeni Üye",
    title: "Yeni Tedarikçi Hoş Geldin Paketi",
    summary: "Platform'a yeni katılan tedarikçiler için ilk 3 ay temel özellikler ücretsiz.",
    color: "#0E7490",
    colorBg: "#ecfeff",
    validUntil: "2026-12-31",
    audience: "supplier",
    registerHref: "/supplier/register",
    conditions: [
      "Kampanya yalnızca ilk kez kayıt olan tedarikçi hesapları için geçerlidir.",
      "Aktivasyon tarihinden itibaren 3 ay süreyle uygulanır.",
      "Temel özellikler: teklif gönderme, kategori profili, performans panosu.",
      "Kullanım bazlı ek modüller (premium görünürlük vb.) bu kapsamda değildir.",
      "Kampanya kodu hesap aktivasyonunda otomatik uygulanır — manuel müdahale gerekmez.",
    ],
    scope: ["Teklif gönderme (sınırsız)", "Kategori profili", "Performans panosu", "Tedarikçi destek hattı"],
    billingNote: "Kullanım bazlı faturalama: 3 ay boyunca temel özellikler için ücret sıfırlanır. Kampanya indirimi idempotent uygulanır — aynı dönem için iki kez düşmez. Kampanya satırı fatura özetinde görünür.",
  },
  "stratejik-buyume": {
    slug: "stratejik-buyume",
    badge: "Büyüme",
    title: "Stratejik Partner Büyüme Paketi",
    summary: "İlk yılınızda %20 platform ücreti indirimi — kurumsal büyüme planları için özel teklif.",
    color: "#134E37",
    colorBg: "#ecfdf5",
    validUntil: "2026-09-30",
    audience: "strategic",
    registerHref: "/onboarding",
    conditions: [
      "İlk 12 ay boyunca platform kullanım ücretlerinde %20 indirim uygulanır.",
      "Minimum 3 kullanıcı lisansı gereklidir.",
      "Kampanya yalnızca yeni stratejik partner hesaplarına uygulanır.",
      "Kampanya kodu onboarding sırasında otomatik tanımlanır.",
      "İndirim, fiilen kullanılan modüller üzerinden hesaplanan tutara uygulanır.",
    ],
    scope: ["RFQ yönetimi", "Onay zinciri modülü", "Tedarikçi havuzu erişimi", "KPI rapor panosu", "API entegrasyon sandbox"],
    billingNote: "Kullanım bazlı faturalama: yalnızca aktif kullanılan ihale ve onay adımları için ücretlendirilirsiniz. %20 kampanya indirimi, fatura hesaplandıktan sonra ayrı bir indirim satırı olarak uygulanır — çift düşürme yapılmaz.",
  },
  "isveren-ik-paketi": {
    slug: "isveren-ik-paketi",
    badge: "İK",
    title: "İşveren İK Başlangıç Paketi",
    summary: "İlk 3 iş ilanınız ücretsiz — satın alma uzmanı bulmaya hemen başlayın.",
    color: "#5B21B6",
    colorBg: "#fdf4ff",
    validUntil: "2026-12-31",
    audience: "employer",
    registerHref: "/employer/register",
    conditions: [
      "Kampanya yalnızca yeni işveren hesapları için geçerlidir.",
      "İlk 3 ilan yayınlama tamamen ücretsizdir.",
      "Her ilan en fazla 60 gün aktif kalabilir.",
      "4. ilan ve sonrası standart fiyatlandırmaya tabidir.",
      "İK Yöneticisi rolü tanımlama da bu kampanya kapsamında ücretsizdir.",
    ],
    scope: ["3 iş ilanı (60 gün)", "Aday başvuru yönetimi", "İK Yöneticisi rolü", "Başvuru bildirimleri"],
    billingNote: "İlk 3 ilan ücretsize tabi tutulur; 4. ilandan itibaren kullanım bazlı ücretlendirme başlar. Kampanya satırı ilk dönem faturasında açıkça gösterilir.",
  },
  "ilk-ilan-ucretsiz": {
    slug: "ilk-ilan-ucretsiz",
    badge: "Kariyer & İK",
    title: "İlk İlan Ücretsiz — İşveren & Aday Paketi",
    summary: "İşverene ilk ilan ücretsiz. İş arayan adaylara CV profili ve başvuru paketi tamamen ücretsiz.",
    color: "#9F1239",
    colorBg: "#fff1f3",
    validUntil: "2026-12-31",
    audience: "employer",
    registerHref: "/employer/register",
    conditions: [
      "İşveren tarafı: ilk iş ilanı ücretsiz, maksimum 60 gün aktif.",
      "İş arayan tarafı: CV profili oluşturma ve ilk 5 başvuru ücretsiz.",
      "Kampanya yalnızca yeni hesaplara uygulanır.",
      "İşveren ve iş arayan kampanyaları bağımsız tetiklenir — tek hesapta birleştirilemez.",
      "Kampanya kodu aktivasyon sırasında otomatik uygulanır.",
    ],
    scope: [
      "1 iş ilanı (60 gün) — İşveren",
      "Aday başvuru yönetimi — İşveren",
      "CV profili oluşturma — İş Arayan",
      "İlk 5 başvuru — İş Arayan",
      "Başvuru bildirimleri",
    ],
    billingNote: "İşveren için ilk ilan, iş arayan için ilk 5 başvuru ücretsizdir. Bu kampanya kapsamındaki işlem satırları faturada 0 TL olarak görünür. İkinci ilan ve 6. başvurudan itibaren kullanım bazlı fiyatlandırma başlar.",
  },
};

export default function KampanyaDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const data = KAMPANYALAR[slug];

  if (!data) {
    return (
      <div className="kdp-root">
        <NavBar />
        <div className="kdp-notfound">
          <h1>Kampanya bulunamadı</h1>
          <p>Bu kampanya mevcut değil veya süresi dolmuş olabilir.</p>
          <a href="/" className="kdp-back">Ana Sayfaya Dön</a>
        </div>
      </div>
    );
  }

  const vars = { "--kdp-color": data.color, "--kdp-bg": data.colorBg } as React.CSSProperties;

  return (
    <div className="kdp-root" style={vars}>
      <NavBar activePath="" />

      <section className="kdp-hero">
        <div className="kdp-hero-inner">
          <div className="kdp-badge">{data.badge}</div>
          <h1 className="kdp-hero-h1">{data.title}</h1>
          <p className="kdp-hero-lead">{data.summary}</p>
          <div className="kdp-hero-validity">
            Geçerlilik: <strong>{data.validUntil}</strong> tarihine kadar
          </div>
          <a href={data.registerHref} className="kdp-hero-cta">Kampanyadan Yararlan →</a>
        </div>
      </section>

      <div className="kdp-content">

        {/* Kapsam */}
        <section className="kdp-section">
          <h2 className="kdp-section-title">Kampanya Kapsamı</h2>
          <ul className="kdp-scope-list">
            {data.scope.map((s) => (
              <li key={s} className="kdp-scope-item">
                <span className="kdp-scope-check">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Koşullar */}
        <section className="kdp-section">
          <h2 className="kdp-section-title">Kampanya Koşulları</h2>
          <ol className="kdp-conditions">
            {data.conditions.map((c, i) => (
              <li key={i} className="kdp-condition-item">{c}</li>
            ))}
          </ol>
        </section>

        {/* Faturalama */}
        <div className="kdp-billing-note">
          <div className="kdp-billing-note__icon">💳</div>
          <div>
            <div className="kdp-billing-note__title">Faturalama Şeffaflığı</div>
            <p className="kdp-billing-note__text">{data.billingNote}</p>
          </div>
        </div>

        {/* Bottom grid */}
        <div className="kdp-bottom-grid">
          <div>
            <h2 className="kdp-section-title">Demo Talep Et</h2>
            <DemoRequestForm audience={data.audience} source={`campaign_${data.slug}`} accentColor={data.color} />
          </div>
          <div className="kdp-cta-block">
            <h2 className="kdp-section-title" style={{ color: "#fff" }}>Hemen Yararlan</h2>
            <p className="kdp-cta-desc">Kayıt sonrası kampanya otomatik uygulanır.</p>
            <a href={data.registerHref} className="kdp-btn kdp-btn--white">Kayıt Ol →</a>
            <a href="/demo" className="kdp-btn kdp-btn--ghost">Demo Planla</a>
          </div>
        </div>

      </div>

      <footer className="kdp-footer">
        © {new Date().getFullYear()} BUYER ASISTANS &nbsp;·&nbsp;
        <a href="/">Ana Sayfa</a> &nbsp;·&nbsp;
        <a href="/demo">Demo Talebi</a>
      </footer>
    </div>
  );
}
