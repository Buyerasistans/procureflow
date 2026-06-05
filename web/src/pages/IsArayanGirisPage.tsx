import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import SocialLoginButtons from "../components/SocialLoginButtons";
import TurnstileWidget from "../components/TurnstileWidget";
import "./IsArayanGirisPage.css";

export default function IsArayanGirisPage() {
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
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="iag-root">
      <NavBar activePath="/is-arayan-giris" />
      <div className="iag-center">
        <div className="iag-card">
          <div className="iag-brand">
            <div className="iag-brand-content">
              <PublicBrandLogo height={32} maxWidth={200} invert />
              <h1 className="iag-brand-h1">Kariyer yolculuğunuz burada başlıyor</h1>
              <p className="iag-brand-lead">
                Binlerce iş ilanına başvurun, kariyer profilinizi oluşturun ve hayalinizdeki pozisyona bir adım daha yaklaşın.
              </p>
              <ul className="iag-features">
                <li className="iag-feature-item"><span className="iag-feature-check">✓</span> Kişiselleştirilmiş iş önerileri</li>
                <li className="iag-feature-item"><span className="iag-feature-check">✓</span> Başvuru takibi</li>
                <li className="iag-feature-item"><span className="iag-feature-check">✓</span> Kariyer profili ve CV</li>
              </ul>
            </div>
          </div>

          <div className="iag-form-panel">
            <div className="iag-form-inner">
              <div className="iag-form-header">
                <div className="iag-eyebrow">İş Arayan Girişi</div>
                <h2 className="iag-form-h2">Hesabınla devam et</h2>
                <p className="iag-form-desc">
                  İş arayan hesabınızla giriş yaparak kariyer panelinize erişin.
                </p>
              </div>

              <SocialLoginButtons />

              <form onSubmit={onSubmit} className="iag-form">
                <label className="iag-label">
                  <span className="iag-label-text">E-posta</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="iag-input"
                  />
                </label>

                <label className="iag-label">
                  <span className="iag-label-text">Şifre</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="iag-input"
                  />
                </label>

                <TurnstileWidget onSuccess={setCaptchaToken} />

                {error && <div className="iag-error">{error}</div>}

                <button type="submit" disabled={submitting} className="iag-submit-btn">
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="iag-info-box">
                İş arayan hesabınız varsa bu ekrandan giriş yapabilirsiniz.
              </div>

              <div className="iag-back-row">
                <a href="/login" className="iag-back-link">← Tüm giriş seçenekleri</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
