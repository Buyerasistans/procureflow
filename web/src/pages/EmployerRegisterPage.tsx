import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/auth.service";
import { setAccessToken, setRefreshToken } from "../lib/token";
import "./EmployerRegisterPage.css";

const USER_KEY = "pf_user";

interface FormState {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export default function EmployerRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim()) {
      setError("Ad Soyad zorunludur.");
      return;
    }
    if (!form.email.trim()) {
      setError("E-posta zorunludur.");
      return;
    }
    if (form.password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    try {
      setLoading(true);
      const data = await registerUser(form.full_name.trim(), form.email.trim(), form.password, "employer");
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      if (data.user) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      navigate("/jobs", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kayıt sırasında bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="employer-register-page">
      <div className="employer-register-page__shell">
        <div className="employer-register-page__card">
          <h1 className="employer-register-page__title">İşveren Kaydı</h1>
          <p className="employer-register-page__subtitle">
            İş ilanı yayınlamak ve aday yönetimi yapmak için ücretsiz hesap oluşturun.
          </p>

          {error && (
            <div className="employer-register-page__error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="employer-register-page__field">
              <label htmlFor="full_name" className="employer-register-page__label">
                Ad Soyad
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                className="employer-register-page__input"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Adınız Soyadınız"
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="employer-register-page__field">
              <label htmlFor="email" className="employer-register-page__label">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="employer-register-page__input"
                value={form.email}
                onChange={handleChange}
                placeholder="ornek@sirket.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="employer-register-page__field">
              <label htmlFor="password" className="employer-register-page__label">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="employer-register-page__input"
                value={form.password}
                onChange={handleChange}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="employer-register-page__field">
              <label htmlFor="confirm_password" className="employer-register-page__label">
                Şifre Tekrar
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                className="employer-register-page__input"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Şifrenizi tekrar girin"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="employer-register-page__submit"
              disabled={loading}
            >
              {loading ? "Kaydediliyor..." : "Hesap Oluştur"}
            </button>
          </form>

          <p className="employer-register-page__login-link">
            Zaten hesabınız var mı?{" "}
            <Link to="/login">Giriş yapın</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
