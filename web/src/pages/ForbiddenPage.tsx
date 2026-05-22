// FILE: web/src/pages/ForbiddenPage.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getDefaultRouteForUser } from "../auth/routing";

export default function ForbiddenPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const deniedFrom =
    (location.state as { deniedFrom?: string } | null)?.deniedFrom ?? "bu sayfa";
  const fallbackToState =
    (location.state as { fallbackTo?: string } | null)?.fallbackTo;
  const fallbackTo = user ? fallbackToState ?? getDefaultRouteForUser(user) : "/dashboard";

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: 16, fontFamily: "Arial" }}>
      <h1 style={{ marginBottom: 8 }}>403 - Yetkisiz Erişim</h1>
      <p style={{ color: "#374151" }}>
        <b>{deniedFrom}</b> için gerekli yetkiye sahip değilsiniz.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            border: "1px solid #d1d5db",
            background: "#fff",
            borderRadius: 8,
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Geri Dön
        </button>

        <Link
          to={fallbackTo}
          style={{
            textDecoration: "none",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#111827",
            background: "#fff",
          }}
        >
          Uygun Sayfaya Git
        </Link>
      </div>
    </div>
  );
}
