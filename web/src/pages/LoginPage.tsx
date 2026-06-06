import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="login-page">
      <NavBar variant="strategic" activePath="/login" />
      <div className="login-page__shell">
        <div className="login-page__card">
          <div className="login-page__logo-row">
            <PublicBrandLogo height={52} maxWidth={220} />
          </div>

          <h1 className="login-page__title">Giriş Tipinizi Seçin</h1>
          <p className="login-page__description">
            Her giriş kendi rolüne özel ekrana yönlendirir. Stratejik partner, tedarikçi ve iş
            ortağı girişleri birbirinden ayrıdır.
          </p>

          <div className="login-page__entry-grid">
            <button
              type="button"
              onClick={() => navigate("/strategic-partner-login")}
              className="login-page__entry-button login-page__entry-button--strategic"
            >
              Stratejik Partner Girisi
            </button>
            <button
              type="button"
              onClick={() => navigate("/supplier/login")}
              className="login-page__entry-button login-page__entry-button--supplier"
            >
              Tedarikci Girisi
            </button>
            <button
              type="button"
              onClick={() => navigate("/channel/login")}
              className="login-page__entry-button login-page__entry-button--channel"
            >
              Is Ortagi Girisi
            </button>
          </div>

          <div className="login-page__divider">
            <span className="login-page__divider-label">İşveren &amp; Kariyer</span>
          </div>

          <p className="login-page__kariyer-note">
            İş ilanı vermek veya kariyer profilinize erişmek için giriş yapın.
            Hesabınız yoksa hemen üye olabilirsiniz.
          </p>

          <div className="login-page__kariyer-grid">
            <div className="login-page__kariyer-col">
              <button
                type="button"
                onClick={() => navigate("/isveren-giris")}
                className="login-page__entry-button login-page__entry-button--employer"
              >
                🏢 İşveren Girişi
              </button>
              <a href="/employer/register" className="login-page__inline-register">
                Üye Ol →
              </a>
            </div>
            <div className="login-page__kariyer-col">
              <button
                type="button"
                onClick={() => navigate("/is-arayan-giris")}
                className="login-page__entry-button login-page__entry-button--candidate"
              >
                🎯 İş Arıyorum Girişi
              </button>
              <a href="/candidate/register" className="login-page__inline-register">
                Üye Ol →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
