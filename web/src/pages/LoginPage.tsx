import { useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [showRegisterOptions, setShowRegisterOptions] = useState(false);

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

          <div className="login-page__divider">
            <span className="login-page__divider-label">İşveren &amp; Kariyer</span>
          </div>

          <p className="login-page__kariyer-note">
            İş ilanı vermek veya kariyer profilinize erişmek için giriş yapın.
            Hesabınız yoksa hemen üye olabilirsiniz.
          </p>

          <div className="login-page__kariyer-grid">
            <button
              type="button"
              onClick={() => navigate("/strategic-partner-login")}
              className="login-page__entry-button login-page__entry-button--employer"
            >
              🏢 İşveren Girişi
            </button>
            <button
              type="button"
              onClick={() => navigate("/strategic-partner-login")}
              className="login-page__entry-button login-page__entry-button--candidate"
            >
              🎯 İş Arıyorum Girişi
            </button>
          </div>

          {!showRegisterOptions ? (
            <button
              type="button"
              className="login-page__register-cta"
              onClick={() => setShowRegisterOptions(true)}
            >
              Üye Ol →
            </button>
          ) : (
            <div className="login-page__register-options">
              <p className="login-page__register-options-title">Ne için üye olmak istiyorsunuz?</p>
              <div className="login-page__register-grid">
                <a href="/employer/register" className="login-page__register-btn login-page__register-btn--employer">
                  <span className="login-page__register-btn-icon">🏢</span>
                  <span className="login-page__register-btn-label">İşveren Kaydı</span>
                  <span className="login-page__register-btn-sub">İş ilanı yayınlamak istiyorum</span>
                </a>
                <a href="/candidate/register" className="login-page__register-btn login-page__register-btn--candidate">
                  <span className="login-page__register-btn-icon">🎯</span>
                  <span className="login-page__register-btn-label">Kariyer Kaydı</span>
                  <span className="login-page__register-btn-sub">Satın alma kariyeri arıyorum</span>
                </a>
              </div>
              <button
                type="button"
                className="login-page__register-cancel"
                onClick={() => setShowRegisterOptions(false)}
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
