import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearSupplierToken } from "../lib/session";
import { confirmSupplierEmailChange } from "../services/supplier-profile.service";
import "./SupplierEmailChangeConfirmPage.css";

export default function SupplierEmailChangeConfirmPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Doğrulama yapılıyor...");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    async function run() {
      const tokenValue = (params.get("token") || "").trim();
      if (!tokenValue) {
        setMessage("Token bulunamadı.");
        setLoading(false);
        return;
      }
      setToken(tokenValue);
      setMessage("E-posta doğrulamak için isterseniz yeni şifre belirleyip onaylayın.");
      setLoading(false);
    }
    void run();
  }, [params]);

  const handleConfirm = async () => {
    if (!token || submitting) return;
    if (password || password2) {
      if (password !== password2) {
        setMessage("Şifre tekrar alanı eşleşmiyor.");
        return;
      }
      if (password.length < 4) {
        setMessage("Şifre en az 4 karakter olmalıdır.");
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await confirmSupplierEmailChange(token, password || undefined);
      setMessage(res.message || "E-posta değişikliği onaylandı.");
      setSuccess(true);
      clearSupplierToken();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || "Onay işlemi başarısız.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (loading || !success) return;
    if (countdown <= 0) {
      navigate("/supplier/login", { replace: true });
      return;
    }

    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [loading, success, countdown, navigate]);

  return (
    <div className="secc-wrap">
      <div className="secc-card">
        <h2 className="secc-card__title">E-posta Doğrulama</h2>
        <p className="secc-card__msg">
          {loading ? "İşlem sürüyor..." : message}
        </p>
        {!loading && !success && (
          <div className="secc-form">
            <input
              type="password"
              className="secc-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Yeni şifre (opsiyonel)"
              aria-label="Yeni şifre"
            />
            <input
              type="password"
              className="secc-input"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Yeni şifre tekrar"
              aria-label="Yeni şifre tekrar"
            />
            <button type="button" className="secc-btn" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Onaylanıyor..." : "E-postayı Onayla"}
            </button>
          </div>
        )}
        {!loading && success && (
          <p className="secc-card__countdown">
            Oturumunuz güvenlik için kapatıldı. {countdown} sn içinde giriş sayfasına yönlendirileceksiniz.
          </p>
        )}
        {!loading && success && (
          <button type="button" className="secc-btn" onClick={() => navigate("/supplier/login", { replace: true })}>
            Giriş Sayfasına Git
          </button>
        )}
      </div>
    </div>
  );
}
