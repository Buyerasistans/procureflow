import NavBar from "../components/NavBar";
import "./SatinAlmaKariyerimPage.css";

export default function SatinAlmaKariyerimPage() {
  return (
    <div className="kariyer-page">
      <NavBar variant="neutral" activePath="/satin-alma-kariyerim" />

      <main className="kariyer-main">
        {/* SEO: h1 sayfanın tek ana başlığı, ana keyword içermeli */}
        <section className="kariyer-hero">
          <div className="kariyer-hero__icon" aria-hidden="true">🎯</div>
          <h1 className="kariyer-hero__title">Satın Alma Kariyerim</h1>
          <p className="kariyer-hero__subtitle">
            Türkiye'nin satın alma ve tedarik zinciri uzmanlarını işverenlerle buluşturan kariyer platformu
          </p>
        </section>

        {/* SEO: h2 bölüm başlıkları keyword içermeli, distinct olmalı */}
        <section className="kariyer-cards" aria-label="Kariyer seçenekleri">
          <article className="kariyer-card kariyer-card--employer">
            <div className="kariyer-card__icon" aria-hidden="true">👔</div>
            <h2 className="kariyer-card__title">Yayınlanan Pozisyonlar</h2>
            <p className="kariyer-card__role">(İŞVEREN)</p>
            <p className="kariyer-card__desc">
              Ekibinizin güçlü sesi burada. Satın alma ve tedarik zinciri profesyonellerine ulaşın —
              ihtiyacınız varsa siz de pozisyon yayınlayabilirsiniz.
            </p>
            <a
              href="/isveren-pozisyonlari"
              className="kariyer-card__btn kariyer-card__btn--employer"
              aria-label="İşverenlerin açık satın alma pozisyonlarını incele"
            >
              İşveren İhtiyaçlarını İncele
            </a>
          </article>

          <article className="kariyer-card kariyer-card--candidate">
            <div className="kariyer-card__icon" aria-hidden="true">🎯</div>
            <h2 className="kariyer-card__title">Satın Alma Profesyonel İlanlarımız</h2>
            <p className="kariyer-card__role">(PROFESYONEL)</p>
            <p className="kariyer-card__desc">
              Kariyerinizi vitrine çıkarın. Satın alma profesyonelleri arasına katılın —
              ilanınızı verin, doğru şirket sizi bulsun.
            </p>
            <a
              href="/is-ilanlari"
              className="kariyer-card__btn kariyer-card__btn--candidate"
              aria-label="Satın alma kariyeri için profesyonel pozisyonları incele"
            >
              Profesyonel Pozisyonları İncele
            </a>
          </article>
        </section>
      </main>
    </div>
  );
}
