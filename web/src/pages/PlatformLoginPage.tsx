import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import "./PlatformLoginPage.css";

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
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
    <div className="plp-root">
      <NavBar variant="platform" activePath="/platform-login" />
      <div className="plp-center">
        <div className="plp-card">
          <div className="plp-brand">
            <div className="plp-brand-content">
              <PublicBrandLogo height={44} maxWidth={220} />
              <h1 className="plp-brand-h1">Kurumsal satın alma çalışma alanı</h1>
              <p className="plp-brand-lead">
                Platform yöneticileri ve super admin kullanıcıları giriş sonrasında merkezi platform arayüzü üzerinden tüm kiracılara ve çalışma alanlarına erişir.
              </p>
            </div>
          </div>

          <div className="plp-form-panel">
            <div className="plp-form-inner">
              <div className="plp-form-header">
                <div className="plp-eyebrow">Platform girişi</div>
                <h2 className="plp-form-h2">Hesabınla devam et</h2>
                <p className="plp-form-desc">
                  Platform yöneticileri ve super admin kullanıcıları bu ekran üzerinden sistem ayarlarını ve tüm kiracıları yönetir.
                </p>
              </div>

              <form onSubmit={onSubmit} className="plp-form">
                <label className="plp-label">
                  <span className="plp-label-text">E-posta</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="plp-input"
                  />
                </label>

                <label className="plp-label">
                  <span className="plp-label-text">Şifre</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="plp-input"
                  />
                </label>

                {error && <div className="plp-error">{error}</div>}

                <button type="submit" disabled={submitting} className="plp-submit-btn">
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="plp-info-box">
                Platform yöneticisi hesabınız varsa bu ekrandan giriş yapabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
