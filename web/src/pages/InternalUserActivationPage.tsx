import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRoleLabel, getUserDisplayRoleLabel } from "../auth/permissions";
import { activateInternalUserRequest, verifyInternalActivationToken } from "../services/auth.service";
import { setAccessToken, setRefreshToken } from "../lib/token";
import { getActivationRedirectPath } from "../config/register-redirect-policy";
import "./InternalUserActivationPage.css";

export default function InternalUserActivationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    email: string;
    full_name: string;
    role: string;
    business_role?: string | null;
    system_role?: string | null;
    organization_name?: string | null;
    organization_logo_url?: string | null;
    workspace_label?: string | null;
    platform_name?: string | null;
    platform_domain?: string | null;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Geçersiz aktivasyon bağlantısı");
      setLoading(false);
      return;
    }

    let mounted = true;
    void verifyInternalActivationToken(token)
      .then((data) => {
        if (!mounted) return;
        setProfile({
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          business_role: data.business_role,
          system_role: data.system_role,
          organization_name: data.organization_name,
          organization_logo_url: data.organization_logo_url,
          workspace_label: data.workspace_label,
          platform_name: data.platform_name,
          platform_domain: data.platform_domain,
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "Aktivasyon bağlantısı doğrulanamadı");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    try {
      setSubmitting(true);
      const data = await activateInternalUserRequest(token, password);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      if (data.user) {
        sessionStorage.setItem("pf_user", JSON.stringify(data.user));
      }
      setSuccess("Hesabınız aktifleştirildi. Yönlendiriliyorsunuz...");
      const redirectPath = getActivationRedirectPath(data.user?.system_role);
      window.setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 700);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 403 && detail && detail.includes("onayı bekliyor")) {
        setSuccess(detail);
      } else {
        setError(detail || "Aktivasyon tamamlanamadı");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="iuap-loading">Aktivasyon bilgileri yükleniyor...</div>;
  }

  return (
    <div className="iuap-root">
      <div className="iuap-card">
        <div className="iuap-platform-name">{profile?.platform_name || "Buyera Asistans"}</div>
        <h1 className="iuap-h1">Hesabınızı Aktifleştirin</h1>
        <p className="iuap-desc">Davet edilen personel hesabı için kendi şifrenizi belirleyin.</p>

        {profile && (
          <div className="iuap-profile">
            <div className="iuap-profile-header">
              {profile.organization_logo_url ? (
                <img
                  src={profile.organization_logo_url}
                  alt={profile.organization_name || "Firma logosu"}
                  className="iuap-logo-img"
                />
              ) : (
                <div className="iuap-logo-placeholder">
                  {(profile.organization_name || "BA").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="iuap-org-name">{profile.organization_name || profile.full_name}</div>
                <div className="iuap-workspace">{profile.workspace_label || profile.platform_domain}</div>
              </div>
            </div>
            <div className="iuap-full-name">{profile.full_name}</div>
            <div className="iuap-email">{profile.email}</div>
            <div className="iuap-role">Rol: {getUserDisplayRoleLabel(profile) || getRoleLabel(profile.role)}</div>
          </div>
        )}

        {error && <div className="iuap-error">{error}</div>}
        {success && <div className="iuap-success">{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} className="iuap-form">
            <label className="iuap-label">
              <span className="iuap-label-text">Yeni Şifre</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="iuap-input"
              />
            </label>
            <label className="iuap-label">
              <span className="iuap-label-text">Şifre Tekrar</span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="iuap-input"
              />
            </label>
            <button type="submit" disabled={submitting} className="iuap-submit-btn">
              {submitting ? "Aktifleştiriliyor..." : "Hesabı Aktifleştir"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
