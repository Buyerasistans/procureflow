import NavBar from "../components/NavBar";
import "./ChannelPartnerProgramPage.css";

const benefits = [
  {
    title: "Referans Bazlı Gelir",
    desc: "Getirdiğiniz stratejik partner ve tedarikçi kayıtları için komisyon ve hedef bazlı prim modeli.",
  },
  {
    title: "Şeffaf Hakediş Takibi",
    desc: "Attribution kilidi ve ledger kayıtları ile hangi kayıttan ne kazandığınızı net görün.",
  },
  {
    title: "Hazır Satış Kitleri",
    desc: "Demo deck, referans senaryoları ve onboarding scriptleri ile daha hızlı dönüşüm.",
  },
  {
    title: "Panel ve Raporlama",
    desc: "Ekibinizin performansını, dönüşüm oranını ve ödeme bekleyen kalemleri tek panelde izleyin.",
  },
];

export default function ChannelPartnerProgramPage() {
  return (
    <div className="cpp-root">
      <NavBar variant="channel" activePath="/is-ortagi-programi" />

      <section className="cpp-hero">
        <div className="cpp-hero__inner">
          <div className="cpp-hero__badge">
            İş Ortağı / Komisyon Programı
          </div>
          <h1 className="cpp-hero__title">
            Networkunuzu Gelire Dönüştürün
          </h1>
          <p className="cpp-hero__body">
            İş ortağı programı; getirdiğiniz partner ve tedarikçi kayıtlarını kalıcı attribution ile takip eder,
            hakedişleri şeffaf şekilde hesaplar ve ödeme akışını ölçeklendirir.
          </p>
          <div className="cpp-hero__ctas">
            <a href="/demo?audience=strategic" className="cpp-cta--primary">
              Program Demosu Talep Et
            </a>
            <a href="/is-ortagi-basvuru" className="cpp-cta--ghost">
              Başvuru Sürecini Başlat
            </a>
          </div>
        </div>
      </section>

      <section className="cpp-benefits">
        <h2 className="cpp-benefits__title">
          Programda Neler Var?
        </h2>
        <div className="cpp-benefits__grid">
          {benefits.map((item) => (
            <article key={item.title} className="cpp-benefit">
              <div className="cpp-benefit__title">{item.title}</div>
              <p className="cpp-benefit__desc">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
