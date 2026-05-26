import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRoleLabel, getUserDisplayRoleLabel } from "../auth/permissions";
import { activateInternalUserRequest, verifyInternalActivationToken } from "../services/auth.service";
import { setAccessToken, setRefreshToken } from "../lib/token";

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
      window.setTimeout(() => {
        navigate("/app", { replace: true });
      }, 700);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      // 403 with "onay bekliyor" means activation succeeded but tenant awaits approval
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
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Aktivasyon bilgileri yükleniyor...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #ecfeff 0%, #eff6ff 100%)", padding: 24 }}>
      <div style={{ width: "min(560px, 100%)", background: "white", borderRadius: 28, padding: 30, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)", border: "1px solid #dbeafe" }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#8a5b2b" }}>{profile?.platform_name || "Buyera Asistans"}</div>
        <h1 style={{ margin: "8px 0 6px", fontSize: 30, color: "#0f172a" }}>Hesabınızı Aktifleştirin</h1>
        <p style={{ margin: 0, color: "#475569" }}>Davet edilen personel hesabı için kendi şifrenizi belirleyin.</p>

        {profile && (
          <div style={{ marginTop: 18, padding: 18, borderRadius: 20, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              {profile.organization_logo_url ? (
                <img src={profile.organization_logo_url} alt={profile.organization_name || "Firma logosu"} style={{ width: 52, height: 52, borderRadius: 18, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 18, display: "grid", placeItems: "center", background: "#16302b", color: "white", fontWeight: 800 }}>
                  {(profile.organization_name || "BA").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, color: "#111827" }}>{profile.organization_name || profile.full_name}</div>
                <div style={{ marginTop: 4, color: "#475569" }}>{profile.workspace_label || profile.platform_domain}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontWeight: 700, color: "#111827" }}>{profile.full_name}</div>
            <div style={{ marginTop: 4, color: "#475569" }}>{profile.email}</div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>Rol: {getUserDisplayRoleLabel(profile) || getRoleLabel(profile.role)}</div>
          </div>
        )}

        {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#fee2e2", color: "#991b1b" }}>{error}</div>}
        {success && <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#dcfce7", color: "#166534" }}>{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "#334155" }}>Yeni Şifre</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 700, color: "#334155" }}>Şifre Tekrar</span>
              <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1" }} />
            </label>
            <button type="submit" disabled={submitting} style={{ marginTop: 6, padding: "14px 18px", borderRadius: 14, border: "none", background: "#2563eb", color: "white", fontWeight: 800, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Aktifleştiriliyor..." : "Hesabı Aktifleştir"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}