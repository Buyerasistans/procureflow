import NavBar from "../components/NavBar";
import "./SatinAlmaKariyerimPage.css";

export default function SatinAlmaKariyerimPage() {
  return (
    <div className="kariyer-page">
      <NavBar variant="neutral" activePath="/satin-alma-kariyerim" />

      <main className="kariyer-main">
        <section className="kariyer-hero">
          <div className="kariyer-hero__icon" aria-hidden="true">🎯</div>
          <h1 className="kariyer-hero__title">Satın Alma Kariyerim</h1>
          <p className="kariyer-hero__subtitle">
            Türkiye'nin tek procurement kariyer ve yetenek platformu
          </p>
        </section>

        <section className="kariyer-cards">
          <div className="kariyer-card kariyer-card--employer">
            <div className="kariyer-card__icon" aria-hidden="true">👔</div>
            <h2 className="kariyer-card__title">Pozisyon Yayınla</h2>
            <p className="kariyer-card__role">(İşveren)</p>
            <p className="kariyer-card__desc">
              Satın alma ve tedarik zinciri uzmanlarına ulaşın. İş ilanınızı yayınlayın, en nitelikli adaylarla tanışın.
            </p>
            <a href="/isveren-pozisyonlari" className="kariyer-card__btn kariyer-card__btn--employer">
              İş Verenlerin İhtiyaç Duyduğu Pozisyonları Gör
            </a>
          </div>

          <div className="kariyer-card kariyer-card--candidate">
            <div className="kariyer-card__icon" aria-hidden="true">🎯</div>
            <h2 className="kariyer-card__title">İş Arıyorum</h2>
            <p className="kariyer-card__role">(Profesyonel)</p>
            <p className="kariyer-card__desc">
              Türkiye'nin önde gelen şirketlerindeki satın alma pozisyonlarını keşfedin. Profilinizi oluşturun, fırsatları yakalayın.
            </p>
            <a href="/is-ilanlari" className="kariyer-card__btn kariyer-card__btn--candidate">
              Profesyonel İş İlanlarını Gör
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
