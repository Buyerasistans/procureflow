import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import "./ChannelLoginPage.css";

export default function ChannelLoginPage() {
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
    <div className="clp-root">
      <NavBar variant="channel" activePath="/channel/login" />
      <div className="clp-center">
        <div className="clp-card">
          <div className="clp-brand">
            <div className="clp-brand-content">
              <PublicBrandLogo height={44} maxWidth={220} />
              <h1 className="clp-brand-h1">İş Ortağı Programı</h1>
              <p className="clp-brand-lead">
                İş ortakları bu alandan giriş yaparak lead, portföy ve hakediş
                süreçlerini kendi panelinden yönetir.
              </p>
            </div>
          </div>

          <div className="clp-form-panel">
            <div className="clp-form-inner">
              <div className="clp-form-header">
                <div className="clp-eyebrow">İş Ortağı girişi</div>
                <h2 className="clp-form-h2">Hesabınla devam et</h2>
                <p className="clp-form-desc">
                  İş ortağı hesabı olan kullanıcılar bu ekran üzerinden ilgili ortaklık paneline erişir.
                </p>
              </div>

              <form onSubmit={onSubmit} className="clp-form">
                <label className="clp-label">
                  <span className="clp-label-text">E-posta</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="clp-input"
                  />
                </label>

                <label className="clp-label">
                  <span className="clp-label-text">Şifre</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="clp-input"
                  />
                </label>

                {error && <div className="clp-error">{error}</div>}

                <button type="submit" disabled={submitting} className="clp-submit-btn">
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="clp-info-box">
                İş ortağı hesabınız varsa bu ekrandan giriş yapabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
