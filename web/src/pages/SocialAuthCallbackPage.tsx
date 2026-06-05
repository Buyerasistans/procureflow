import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setTokens } from "../lib/session";
import { POST_REGISTER_REDIRECT, getActivationRedirectPath } from "../config/register-redirect-policy";
import "./SocialAuthCallbackPage.css";

type PageState = "loading" | "error";

const ERROR_LABELS: Record<string, string> = {
  access_denied:           "Giriş izni reddedildi.",
  not_configured:          "Bu giriş yöntemi henüz yapılandırılmamış.",
  token_failed:            "Kimlik doğrulama başarısız oldu.",
  invalid_profile:         "Profil bilgileri alınamadı.",
  server_error:            "Sunucu hatası oluştu. Lütfen tekrar deneyin.",
  invalid_or_expired_code: "Oturum kodu süresi doldu. Lütfen tekrar giriş yapın.",
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

interface ExchangeResponse {
  access_token: string;
  refresh_token: string;
  is_new: boolean;
  mode: string;
}

export default function SocialAuthCallbackPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const err  = params.get("err");

    if (err || !code) {
      setErrorMsg(ERROR_LABELS[err ?? ""] ?? "Giriş başarısız oldu.");
      setPageState("error");
      return;
    }

    // Remove code from browser history immediately — it is single-use
    window.history.replaceState({}, "", window.location.pathname);

    fetch(`${API_BASE}/auth/social/exchange?code=${encodeURIComponent(code)}`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { detail?: string };
          throw new Error(body?.detail ?? "exchange_failed");
        }
        return res.json() as Promise<ExchangeResponse>;
      })
      .then(({ access_token, refresh_token, is_new, mode }) => {
        setTokens(access_token, refresh_token);

        if (is_new) {
          if (mode === "candidate") {
            navigate(`${POST_REGISTER_REDIRECT.candidate}?welcome=1`, { replace: true });
            return;
          }
          if (mode === "employer") {
            navigate(`${POST_REGISTER_REDIRECT.employer}?welcome=1`, { replace: true });
            return;
          }
          navigate(getActivationRedirectPath(null), { replace: true });
          return;
        }

        navigate("/app", { replace: true });
      })
      .catch((ex: Error) => {
        const key = ex.message in ERROR_LABELS ? ex.message : "";
        setErrorMsg(ERROR_LABELS[key] ?? "Giriş başarısız oldu.");
        setPageState("error");
      });
  }, [navigate]);

  if (pageState === "error") {
    return (
      <div className="sac-error">
        <span className="sac-error__icon">⚠️</span>
        <h2 className="sac-error__title">Sosyal Giriş Başarısız</h2>
        <p className="sac-error__msg">{errorMsg}</p>
        <button type="button" className="sac-error__back" onClick={() => navigate(-1)}>
          ← Geri dön
        </button>
      </div>
    );
  }

  return <div className="sac-loading">Giriş tamamlanıyor...</div>;
}
