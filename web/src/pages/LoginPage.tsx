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

          <h1 className="login-page__title">Giris Tipinizi Secin</h1>
          <p className="login-page__description">
            Her giris kendi rolune ozel ekrana yonlendirir. Stratejik partner, tedarikci ve is
            ortagi girisleri birbirinden ayridir.
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

          <div className="login-page__footer-note">
            Platform yonetici girisi guvenlik nedeniyle ozel erisim akisi ile acilir.
          </div>
        </div>
      </div>
    </div>
  );
}
