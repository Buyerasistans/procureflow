import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";

export default function ChannelLoginPage() {
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
      navigate(from || "/app", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Giris basarisiz.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(245, 158, 11, 0.2), transparent 30%), linear-gradient(135deg, #fff7ed 0%, #ffedd5 48%, #fef3c7 100%)" }}>
      <NavBar variant="channel" activePath="/channel/login" />
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
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(255,255,255,0.7)",
          borderRadius: 32,
          overflow: "hidden",
          boxShadow: "0 30px 90px rgba(52, 73, 94, 0.18)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: 56,
            color: "white",
            background:
              "radial-gradient(circle at top right, rgba(245, 158, 11, 0.28), transparent 24%), radial-gradient(circle at bottom left, rgba(251, 191, 36, 0.22), transparent 26%), linear-gradient(135deg, #2f1a0d 0%, #4b2a12 52%, #6b3a14 100%)",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <PublicBrandLogo height={44} maxWidth={220} />
            <h1 style={{ margin: "22px 0 12px", fontSize: 50, lineHeight: 1.02, fontWeight: 900 }}>
              Is Ortagi Programi
            </h1>
            <p style={{ margin: 0, maxWidth: 560, fontSize: 16, lineHeight: 1.7, color: "#fdecd3" }}>
              Is ortaklari bu alandan giris yaparak lead, portfoy ve hakedis
              sureclerini kendi panelinden yonetir.
            </p>
          </div>
        </div>

        <div style={{ padding: "52px 44px" }}>
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.2, textTransform: "uppercase", color: "#92400e" }}>
                Is Ortagi girisi
              </div>
              <h2 style={{ margin: "10px 0 8px", fontSize: 34, lineHeight: 1.08, color: "#0f172a" }}>Hesabinla devam et</h2>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#64748b" }}>
                Is ortagi hesabi olan kullanicilar bu ekran uzerinden ilgili ortaklik paneline erisir.
              </p>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>E-posta</span>
                <input
                  id="email"
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
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>Sifre</span>
                <input
                  id="password"
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
                  }}
                />
              </label>

              {error && (
                <div style={{ borderRadius: 18, border: "1px solid #fecaca", background: "#fff1f2", padding: "12px 14px", color: "#be123c", fontSize: 14 }}>
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
                  background: "#f59e0b",
                  color: "#2f1a0d",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Giris yapiliyor..." : "Giris yap"}
              </button>
            </form>

            <div style={{ marginTop: 18, borderRadius: 22, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "16px 18px", color: "#475569", fontSize: 14, lineHeight: 1.7 }}>
              Is ortagi hesabiniz varsa bu ekrandan giris yapabilirsiniz.
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
