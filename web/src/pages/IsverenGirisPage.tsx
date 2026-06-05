import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import SocialLoginButtons from "../components/SocialLoginButtons";
import TurnstileWidget from "../components/TurnstileWidget";
import "./IsverenGirisPage.css";

export default function IsverenGirisPage() {
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
      navigate(from || "/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="igp-root">
      <NavBar variant="neutral" activePath="/isveren-giris" />
      <div className="igp-center">
        <div className="igp-card">
          {/* Sol — Employer branding */}
          <div className="igp-brand">
            <div className="igp-brand-content">
              <PublicBrandLogo height={32} maxWidth={200} invert />
              <h1 className="igp-brand-h1">İşveren Girişi</h1>
              <p className="igp-brand-lead">
                Satın alma ve tedarik zinciri profesyonellerine yönelik iş ilanlarınızı yayınlayın.
                Doğru adayı, en kısa sürede bulun.
              </p>
              <div className="igp-features">
                {[
                  "Satın alma uzmanı pozisyonları yayınlayın",
                  "Onaylı profesyonel aday havuzuna ulaşın",
                  "İK rollerinizle ilanlarınızı yönetin",
                  "Kariyer modülü ile entegre çalışın",
                ].map((item) => (
                  <div key={item} className="igp-feature-item">
                    <span className="igp-feature-check">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ — Login form */}
          <div className="igp-form-panel">
            <div className="igp-form-inner">
              <div className="igp-form-header">
                <div className="igp-eyebrow">İşveren & Kariyer Girişi</div>
                <h2 className="igp-form-h2">Hesabınla devam et</h2>
                <p className="igp-form-desc">
                  İşveren veya İK rolündeyseniz bu ekrandan giriş yaparak iş ilanı
                  oluşturabilir ve yönetebilirsiniz.
                </p>
              </div>

              <SocialLoginButtons />

              <form onSubmit={onSubmit} className="igp-form">
                <label className="igp-label">
                  <span className="igp-label-text">E-posta</span>
                  <input
                    id="employer-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="igp-input"
                  />
                </label>

                <label className="igp-label">
                  <span className="igp-label-text">Şifre</span>
                  <input
                    id="employer-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="igp-input"
                  />
                </label>

                <TurnstileWidget onSuccess={setCaptchaToken} />

                {error && <div className="igp-error">{error}</div>}

                <button type="submit" disabled={submitting} className="igp-submit-btn">
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="igp-info-box">
                İşveren hesabınız yoksa{" "}
                <a href="/employer/register" className="igp-info-link">üye olun</a>.
                Mevcut hesabınız varsa e-posta ve şifrenizle doğrudan giriş yapabilirsiniz.
              </div>

              <div className="igp-back-row">
                <a href="/login" className="igp-back-link">← Tüm giriş seçenekleri</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
