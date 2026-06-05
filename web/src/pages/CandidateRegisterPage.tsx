import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/auth.service";
import { setAccessToken, setRefreshToken } from "../lib/token";
import { POST_REGISTER_REDIRECT } from "../config/register-redirect-policy";
import TurnstileWidget from "../components/TurnstileWidget";
import SocialLoginButtons from "../components/SocialLoginButtons";
import SocialRegisterLayout from "../components/SocialRegisterLayout";
import "./CandidateRegisterPage.css";

const USER_KEY = "pf_user";

const BRAND_FEATURES = [
  { text: "Google veya LinkedIn ile saniyeler içinde kayıt" },
  { text: "Profiliniz sosyal hesabınızdan otomatik doldurulur" },
  { text: "Binlerce iş fırsatına ücretsiz erişin" },
  { text: "Kariyer yolculuğunuzu akıllı araçlarla yönetin" },
];

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim()) { setError("Ad Soyad zorunludur."); return; }
    if (!form.email.trim()) { setError("E-posta zorunludur."); return; }
    if (form.password.length < 8) { setError("Şifre en az 8 karakter olmalıdır."); return; }
    if (form.password !== form.confirm_password) { setError("Şifreler eşleşmiyor."); return; }
    if (!captchaToken) { setError("Lütfen robot olmadığınızı doğrulayın."); return; }

    try {
      setLoading(true);
      const data = await registerUser(
        form.full_name.trim(),
        form.email.trim(),
        form.password,
        "candidate",
        captchaToken,
      );
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      if (data.user) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      navigate(POST_REGISTER_REDIRECT.candidate, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kayıt sırasında bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SocialRegisterLayout
      brandGradient="linear-gradient(160deg, #0f2a5c 0%, #1e40af 52%, #2563eb 100%)"
      brandTitle="Kariyerinizin Yeni Başlangıcı"
      brandSubtitle="Türkiye'nin satın alma ekosisteminde fark yaratın. Profilinizi oluşturun, doğru pozisyonlara ulaşın."
      brandFeatures={BRAND_FEATURES}
      formTitle="Ücretsiz Hesap Oluşturun"
      formSubtitle="Aday olarak kayıt olun ve iş fırsatlarını keşfetmeye başlayın."
    >
      <SocialLoginButtons
        mode="candidate"
        dividerLabel="veya e-posta ile devam edin"
      />

      {error && (
        <div className="srl-error" role="alert">{error}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="srl-field">
          <label htmlFor="full_name" className="srl-label">Ad Soyad</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            className="srl-input"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Adınız Soyadınız"
            autoComplete="name"
            disabled={loading}
          />
        </div>

        <div className="srl-field">
          <label htmlFor="email" className="srl-label">E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            className="srl-input"
            value={form.email}
            onChange={handleChange}
            placeholder="ornek@email.com"
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="srl-field">
          <label htmlFor="password" className="srl-label">Şifre</label>
          <input
            id="password"
            name="password"
            type="password"
            className="srl-input"
            value={form.password}
            onChange={handleChange}
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className="srl-field">
          <label htmlFor="confirm_password" className="srl-label">Şifre Tekrar</label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            className="srl-input"
            value={form.confirm_password}
            onChange={handleChange}
            placeholder="Şifrenizi tekrar girin"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <TurnstileWidget onSuccess={setCaptchaToken} />

        <button
          type="submit"
          className="srl-submit crp-submit"
          disabled={loading}
        >
          {loading ? "Kaydediliyor..." : "Hesap Oluştur"}
        </button>
      </form>

      <p className="srl-footer">
        Zaten hesabınız var mı? <Link to="/login">Giriş yapın</Link>
      </p>
      <p className="srl-legal-note">
        Kayıt olarak{" "}
        <Link to="/kullanim-kosullari">Kullanım Koşulları</Link>
        {" "}ve{" "}
        <Link to="/gizlilik-politikasi">Gizlilik Politikası</Link>
        'nı kabul etmiş olursunuz.
      </p>
    </SocialRegisterLayout>
  );
}
