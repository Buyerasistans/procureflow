import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import SocialLoginButtons from "../components/SocialLoginButtons";
import TurnstileWidget from "../components/TurnstileWidget";
import "./StrategicPartnerLoginPage.css";

export default function StrategicPartnerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) { setError("Lütfen robot olmadığınızı doğrulayın."); return; }
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password, captchaToken);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from || "/app", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Giriş başarısız.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="splp-root">
      <NavBar variant="strategic" activePath="/login" />
      <div className="splp-center">
        <div className="splp-card">
          <div className="splp-brand">
            <div className="splp-brand-content">
              <PublicBrandLogo height={32} maxWidth={200} invert />
              <h1 className="splp-brand-h1">Stratejik Partner Yönetimi</h1>
              <p className="splp-brand-lead">
                Stratejik partnerleri yönetir, kendi tenant alanlarına erişir; kültür, altyapı, satış kanalları ve platform deneyimi bütünlüğünü kontrol ederiz.
              </p>
            </div>
          </div>

          <div className="splp-form-panel">
            <div className="splp-form-inner">
              <div className="splp-form-header">
                <div className="splp-eyebrow">Stratejik Partner girişi</div>
                <h2 className="splp-form-h2">Hesabınla devam et</h2>
                <p className="splp-form-desc">
                  Stratejik partnerler bu ekran üzerinden yönetim paneline erişir ve kendi çalışma alanlarını kontrol eder.
                </p>
              </div>

              <SocialLoginButtons />

              <form onSubmit={onSubmit} className="splp-form">
                <label className="splp-label">
                  <span className="splp-label-text">E-posta</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="splp-input"
                  />
                </label>

                <label className="splp-label">
                  <span className="splp-label-text">Şifre</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="splp-input"
                  />
                </label>

                <TurnstileWidget onSuccess={setCaptchaToken} />

                {error && <div className="splp-error">{error}</div>}

                <button type="submit" disabled={submitting} className="splp-submit-btn">
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="splp-info-box">
                Stratejik partner hesabınız varsa bu ekrandan giriş yapabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
