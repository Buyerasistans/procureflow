import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/auth.service";
import { setAccessToken, setRefreshToken } from "../lib/token";
import "./CandidateRegisterPage.css";

const USER_KEY = "pf_user";

interface FormState {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export default function CandidateRegisterPage() {
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
      const data = await registerUser(form.full_name.trim(), form.email.trim(), form.password, "candidate");
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      if (data.user) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      navigate("/talent/profile", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kayıt sırasında bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="candidate-register-page">
      <div className="candidate-register-page__shell">
        <div className="candidate-register-page__card">
          <h1 className="candidate-register-page__title">Aday Kaydı</h1>
          <p className="candidate-register-page__subtitle">
            İş fırsatlarını keşfetmek ve profilinizi oluşturmak için ücretsiz hesap açın.
          </p>

          {error && (
            <div className="candidate-register-page__error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="candidate-register-page__field">
              <label htmlFor="full_name" className="candidate-register-page__label">
                Ad Soyad
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                className="candidate-register-page__input"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Adınız Soyadınız"
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="candidate-register-page__field">
              <label htmlFor="email" className="candidate-register-page__label">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="candidate-register-page__input"
                value={form.email}
                onChange={handleChange}
                placeholder="ornek@email.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="candidate-register-page__field">
              <label htmlFor="password" className="candidate-register-page__label">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="candidate-register-page__input"
                value={form.password}
                onChange={handleChange}
                placeholder="En az 8 karakter"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="candidate-register-page__field">
              <label htmlFor="confirm_password" className="candidate-register-page__label">
                Şifre Tekrar
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                className="candidate-register-page__input"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Şifrenizi tekrar girin"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="candidate-register-page__submit"
              disabled={loading}
            >
              {loading ? "Kaydediliyor..." : "Hesap Oluştur"}
            </button>
          </form>

          <p className="candidate-register-page__login-link">
            Zaten hesabınız var mı?{" "}
            <Link to="/login">Giriş yapın</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
