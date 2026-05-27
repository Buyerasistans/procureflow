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
            <PublicBrandLogo height={42} maxWidth={220} />
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
              Stratejik Partner Girişi
            </button>
            <button
              type="button"
              onClick={() => navigate("/supplier/login")}
              className="login-page__entry-button login-page__entry-button--supplier"
            >
              Tedarikçi Girişi
            </button>
            <button
              type="button"
              onClick={() => navigate("/channel/login")}
              className="login-page__entry-button login-page__entry-button--channel"
            >
              İş Ortağı Girişi
            </button>
          </div>

          <div className="login-page__footer-note">
            Platform yönetici girişi güvenlik nedeniyle özel erişim akışı ile açılır.
          </div>
        </div>
      </div>
    </div>
  );
}
