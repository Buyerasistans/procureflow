// FILE: web/src/pages/LoginPage.tsx
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(236, 201, 130, 0.35), transparent 28%), linear-gradient(135deg, #f7f1e7 0%, #dfe8e2 48%, #eef4f7 100%)" }}>
      <NavBar variant="strategic" activePath="/login" />
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
            width: "min(980px, 100%)",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 32,
            padding: "44px 40px",
            boxShadow: "0 30px 90px rgba(52, 73, 94, 0.16)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <PublicBrandLogo height={42} maxWidth={220} />
          </div>
          <h1 style={{ margin: 0, textAlign: "center", fontSize: 42, lineHeight: 1.06, color: "#0f172a", fontWeight: 900 }}>
            Giris Tipinizi Secin
          </h1>
          <p style={{ margin: "14px auto 0", textAlign: "center", maxWidth: 640, color: "#475569", fontSize: 15, lineHeight: 1.7 }}>
            Her giris kendi rolune ozel ekrana yonlendirir. Stratejik partner, tedarikci ve is ortagi girisleri birbirinden ayridir.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: 30 }}>
            <button onClick={() => navigate("/strategic-partner-login")} style={entryBtn("#21453d")}>
              Stratejik Partner Girisi
            </button>
            <button onClick={() => navigate("/supplier/login")} style={entryBtn("#0284c7")}>
              Tedarikci Girisi
            </button>
            <button onClick={() => navigate("/channel/login")} style={entryBtn("#f59e0b", "#2f1a0d")}>
              Is Ortagi Girisi
            </button>
          </div>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "#64748b" }}>
            Platform yonetici girisi guvenlik nedeniyle ozel erisim akisi ile acilir.
          </div>
        </div>
      </div>
    </div>
  );
}

function entryBtn(bg: string, color = "#ffffff") {
  return {
    border: "none",
    borderRadius: 14,
    padding: "15px 16px",
    fontSize: 14,
    fontWeight: 800,
    color,
    background: bg,
    cursor: "pointer",
  } as const;
}
