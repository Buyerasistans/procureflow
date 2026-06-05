import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setTokens } from "../lib/session";
import { POST_REGISTER_REDIRECT, getActivationRedirectPath } from "../config/register-redirect-policy";
import "./SocialAuthCallbackPage.css";

type PageState = "loading" | "error";

const ERROR_LABELS: Record<string, string> = {
  not_configured: "Bu giriş yöntemi henüz yapılandırılmamış.",
  access_denied:  "Giriş izni reddedildi.",
  token_failed:   "Kimlik doğrulama başarısız oldu.",
  invalid_profile:"Profil bilgileri alınamadı.",
  server_error:   "Sunucu hatası oluştu. Lütfen tekrar deneyin.",
};

export default function SocialAuthCallbackPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error        = params.get("error");
    const isNewUser    = params.get("new_user") === "1";
    const mode         = params.get("mode") ?? "";

    if (error || !accessToken || !refreshToken) {
      setErrorMsg(ERROR_LABELS[error ?? ""] ?? "Giriş başarısız oldu.");
      setState("error");
      return;
    }

    setTokens(accessToken, refreshToken);

    if (isNewUser) {
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
  }, [navigate]);

  if (state === "error") {
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
