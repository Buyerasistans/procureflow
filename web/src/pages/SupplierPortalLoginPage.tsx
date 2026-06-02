import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supplierLoginRequest } from "../services/auth.service";
import { isSupplierLoggedIn } from "../lib/session";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import "./SupplierPortalLoginPage.css";

interface LoginError {
  field?: string;
  message: string;
}

export default function SupplierPortalLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [success, setSuccess] = useState("");

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
    setSuccess("");

    if (!formData.email) {
      setError({ field: "email", message: "E-posta gerekli" });
      return;
    }

    if (!formData.password) {
      setError({ field: "password", message: "Şifre gerekli" });
      return;
    }

    setLoading(true);

    try {
      await supplierLoginRequest(formData.email, formData.password);
      setSuccess("Giriş başarılı! Yönlendiriliyorsunuz...");
      navigate("/supplier/dashboard", { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Giriş başarısız. Lütfen e-posta ve şifrenizi kontrol ediniz.";
      setError({ message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="spll-page">
      <NavBar variant="supplier" activePath="/supplier/login" />
      <div className="spll-container">
        <section className="spll-left">
          <div>
            <PublicBrandLogo height={44} maxWidth={220} marginBottom={24} invert />
            <h1>Tedarikçi Portalı</h1>
            <p>Tekliflerinizi yönetin, proje detaylarını görün ve sözleşme süreçlerini tek bir panelden takip edin.</p>
          </div>
        </section>

        <section className="spll-right">
          <div className="spll-form-card">
            <h2>Tedarikçi Girişi</h2>
            <p>Tedarikçi hesabınızla giriş yaparak kendi tedarikçi panelinize erişin.</p>

            <form className="spll-form" onSubmit={handleSubmit}>
              {error && <div className="spll-msg spll-msg--error">{error.message}</div>}
              {success && <div className="spll-msg spll-msg--success">{success}</div>}

              <label className="spll-label" htmlFor="email">
                E-posta Adresi
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="spll-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ornek@tedarikci.com"
                  disabled={loading}
                  required
                />
              </label>

              <label className="spll-label" htmlFor="password">
                Şifre
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="spll-input"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
              </label>

              <button type="submit" className="spll-submit" disabled={loading}>
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
