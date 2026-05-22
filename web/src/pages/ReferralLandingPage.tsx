import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getPublicReferralInfo } from "../services/profile.service";
import type { PublicReferralInfo } from "../services/profile.service";

export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const [info, setInfo] = useState<PublicReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    getPublicReferralInfo(code)
      .then((data) => setInfo(data))
      .catch(() => setError("Bu referral link bulunamadi veya artik gecerli degil."))
      .finally(() => setLoading(false));
  }, [code]);

  const forcedTarget = location.pathname.startsWith("/strategic_partner/")
    ? "partner"
    : location.pathname.startsWith("/supplier/")
    ? "supplier"
    : null;

  const effectiveTarget = forcedTarget || info?.target_type || "mixed";
  const targetLabel =
    effectiveTarget === "partner"
      ? "Stratejik Partner Programi"
      : effectiveTarget === "supplier"
      ? "Tedarikci Programi"
      : "Platform Programlari";

  const strategicPartnerPath = `/onboarding?tenant_type=strategic_partner&ref=${code}`;
  const supplierPath = `/onboarding?tenant_type=supplier&ref=${code}`;
  const registerPath =
    effectiveTarget === "partner"
      ? strategicPartnerPath
      : effectiveTarget === "supplier"
      ? supplierPath
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#f8fafc",
            letterSpacing: -0.5,
          }}
        >
          Buyer Asistans
        </div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>
          Tedarik ve Is Ortagi Platformu
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "36px 40px",
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 15 }}>
            Yukleniyor...
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
              Link Gecersiz
            </div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>{error}</div>
            <Link to="/" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
              Ana sayfaya don &rarr;
            </Link>
          </div>
        )}

        {!loading && !error && info && !info.is_active && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
              Link Artik Aktif Degil
            </div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
              Bu referral link pasife alinmis. Daha guncel bir link icin ilgili is ortagiyla iletisime gecin.
            </div>
            <Link to="/" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
              Ana sayfaya don &rarr;
            </Link>
          </div>
        )}

        {!loading && !error && info && info.is_active && (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🤝</div>
              {info.org_name && (
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                  <strong style={{ color: "#1e293b" }}>{info.org_name}</strong> sizi davet ediyor
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                {targetLabel}'ne Katil
              </div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 8 }}>
                Bu davet linki ile kayit olun ve avantajlardan yararlanin.
              </div>
            </div>

            {registerPath ? (
              <Link
                to={registerPath}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  padding: "14px 0",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                }}
              >
                Hemen Kayit Ol →
              </Link>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <Link
                  to={strategicPartnerPath}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "12px 0",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #0f766e, #0d9488)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Stratejik Partner Olarak Devam Et
                </Link>
                <Link
                  to={supplierPath}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "12px 0",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Tedarikci Olarak Devam Et
                </Link>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
              Zaten hesabiniz var mi? <Link to="/login" style={{ color: "#2563eb", textDecoration: "none" }}>Giris yapin</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
