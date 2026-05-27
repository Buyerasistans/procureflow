import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";

export default function IsverenGirisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from || "/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(5, 150, 105, 0.25), transparent 32%), linear-gradient(135deg, #ecfdf5 0%, #d1fae5 48%, #e0f2fe 100%)",
      }}
    >
      <NavBar variant="neutral" activePath="/isveren-giris" />
      <div
        style={{
          minHeight: "calc(100vh - 60px)",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(1120px, 100%)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 1fr)",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 32,
            overflow: "hidden",
            boxShadow: "0 30px 90px rgba(5, 150, 105, 0.14)",
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Sol — Employer branding */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              padding: 56,
              color: "white",
              background:
                "radial-gradient(circle at top right, rgba(167,243,208,0.3), transparent 24%), linear-gradient(135deg, #064e3b 0%, #065f46 52%, #047857 100%)",
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <PublicBrandLogo height={44} maxWidth={220} />
              <h1
                style={{
                  margin: "22px 0 12px",
                  fontSize: 44,
                  lineHeight: 1.08,
                  fontWeight: 900,
                }}
              >
                İşveren Girişi
              </h1>
              <p
                style={{
                  margin: "0 0 28px",
                  maxWidth: 520,
                  fontSize: 16,
                  lineHeight: 1.7,
                  color: "#a7f3d0",
                }}
              >
                Satın alma ve tedarik zinciri profesyonellerine yönelik iş ilanlarınızı yayınlayın.
                Doğru adayı, en kısa sürede bulun.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontSize: 14,
                  color: "#d1fae5",
                }}
              >
                {[
                  "Satın alma uzmanı pozisyonları yayınlayın",
                  "Onaylı profesyonel aday havuzuna ulaşın",
                  "İK rollerinizle ilanlarınızı yönetin",
                  "Kariyer modülü ile entegre çalışın",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#6ee7b7", fontWeight: 800 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ — Login form */}
          <div style={{ padding: "52px 44px" }}>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 2.2,
                    textTransform: "uppercase",
                    color: "#059669",
                  }}
                >
                  İşveren & Kariyer Girişi
                </div>
                <h2
                  style={{
                    margin: "10px 0 8px",
                    fontSize: 34,
                    lineHeight: 1.08,
                    color: "#0f172a",
                  }}
                >
                  Hesabınla devam et
                </h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#64748b" }}>
                  İşveren veya İK rolündeyseniz bu ekrandan giriş yaparak iş ilanı
                  oluşturabilir ve yönetebilirsiniz.
                </p>
              </div>

              <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>E-posta</span>
                  <input
                    id="employer-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>Şifre</span>
                  <input
                    id="employer-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      fontSize: 14,
                      boxSizing: "border-box",
                    }}
                  />
                </label>

                {error && (
                  <div
                    style={{
                      borderRadius: 18,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      padding: "12px 14px",
                      color: "#be123c",
                      fontSize: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: 18,
                    border: "none",
                    background: "#059669",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? "Giriş yapılıyor..." : "Giriş yap"}
                </button>
              </form>

              <div
                style={{
                  marginTop: 18,
                  borderRadius: 22,
                  border: "1px solid #d1fae5",
                  background: "#ecfdf5",
                  padding: "16px 18px",
                  color: "#064e3b",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                İşveren hesabınız yoksa{" "}
                <a
                  href="/employer/register"
                  style={{ color: "#059669", fontWeight: 700, textDecoration: "none" }}
                >
                  üye olun
                </a>
                . Mevcut hesabınız varsa e-posta ve şifrenizle doğrudan giriş yapabilirsiniz.
              </div>

              <div style={{ marginTop: 14, textAlign: "center" }}>
                <a
                  href="/login"
                  style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}
                >
                  ← Tüm giriş seçenekleri
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
