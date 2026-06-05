import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supplierLoginRequest } from "../services/auth.service";
import { isSupplierLoggedIn } from "../lib/session";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import SocialLoginButtons from "../components/SocialLoginButtons";
import TurnstileWidget from "../components/TurnstileWidget";
import "./SupplierPortalLoginPage.css";

export default function SupplierPortalLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  useEffect(() => {
    if (isSupplierLoggedIn()) {
      navigate("/supplier/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email) { setError("E-posta gerekli"); return; }
    if (!formData.password) { setError("Şifre gerekli"); return; }
    if (!captchaToken) { setError("Lütfen robot olmadığınızı doğrulayın."); return; }

    setLoading(true);
    try {
      await supplierLoginRequest(formData.email, formData.password);
      navigate("/supplier/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş başarısız. Lütfen bilgilerinizi kontrol ediniz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spll-root">
      <NavBar variant="supplier" activePath="/supplier/login" />
      <div className="spll-center">
        <div className="spll-card">
          <div className="spll-brand">
            <div className="spll-brand-content">
              <PublicBrandLogo height={32} maxWidth={200} invert />
              <h1 className="spll-brand-h1">Tedarikçi Portalı</h1>
              <p className="spll-brand-lead">
                Tekliflerinizi yönetin, proje detaylarını görün ve sözleşme süreçlerini tek bir panelden takip edin.
              </p>
              <ul className="spll-features">
                <li className="spll-feature-item"><span className="spll-feature-check">✓</span> RFQ teklif yönetimi</li>
                <li className="spll-feature-item"><span className="spll-feature-check">✓</span> Sözleşme süreçleri</li>
                <li className="spll-feature-item"><span className="spll-feature-check">✓</span> Proje ve sipariş takibi</li>
              </ul>
            </div>
          </div>

          <div className="spll-form-panel">
            <div className="spll-form-inner">
              <div className="spll-form-header">
                <div className="spll-eyebrow">Tedarikçi girişi</div>
                <h2 className="spll-form-h2">Hesabınla devam et</h2>
                <p className="spll-form-desc">
                  Tedarikçi hesabınızla giriş yaparak kendi tedarikçi panelinize erişin.
                </p>
              </div>

              <SocialLoginButtons />

              <form onSubmit={handleSubmit} className="spll-form">
                <label className="spll-label">
                  <span className="spll-label-text">E-posta</span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="spll-input"
                    placeholder="ornek@tedarikci.com"
                  />
                </label>

                <label className="spll-label">
                  <span className="spll-label-text">Şifre</span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="spll-input"
                    placeholder="••••••••"
                  />
                </label>

                <TurnstileWidget onSuccess={setCaptchaToken} />

                {error && <div className="spll-error">{error}</div>}

                <button type="submit" disabled={loading} className="spll-submit-btn">
                  {loading ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div className="spll-info-box">
                Tedarikçi portal hesabınız varsa bu ekrandan giriş yapabilirsiniz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
