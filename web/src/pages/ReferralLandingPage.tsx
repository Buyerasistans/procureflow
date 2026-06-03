import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getPublicReferralInfo } from "../services/profile.service";
import type { PublicReferralInfo } from "../services/profile.service";
import "./ReferralLandingPage.css";

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
      .catch(() => setError("Bu referral link bulunamadı veya artık geçerli değil."))
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
      ? "Stratejik Partner Programı"
      : effectiveTarget === "supplier"
      ? "Tedarikçi Programı"
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
    <div className="rlp-root">
      <div className="rlp-logo-section">
        <div className="rlp-logo-name">Buyer Asistans</div>
        <div className="rlp-logo-sub">Tedarik ve İş Ortağı Platformu</div>
      </div>

      <div className="rlp-card">
        {loading && <div className="rlp-loading">Yukleniyor...</div>}

        {!loading && error && (
          <div className="rlp-status">
            <div className="rlp-status-emoji">⚠️</div>
            <div className="rlp-status-title">Link Gecersiz</div>
            <div className="rlp-status-desc">{error}</div>
            <Link to="/" className="rlp-status-link">Ana sayfaya don &rarr;</Link>
          </div>
        )}

        {!loading && !error && info && !info.is_active && (
          <div className="rlp-status">
            <div className="rlp-status-emoji">🔒</div>
            <div className="rlp-status-title">Link Artik Aktif Degil</div>
            <div className="rlp-status-desc">
              Bu referral link pasife alınmış. Daha güncel bir link için ilgili iş ortağıyla iletişime geçin.
            </div>
            <Link to="/" className="rlp-status-link">Ana sayfaya don &rarr;</Link>
          </div>
        )}

        {!loading && !error && info && info.is_active && (
          <>
            <div className="rlp-active-header">
              <div className="rlp-active-emoji">🤝</div>
              {info.org_name && (
                <div className="rlp-org-name">
                  <strong>{info.org_name}</strong> sizi davet ediyor
                </div>
              )}
              <div className="rlp-target-label">{targetLabel}'ne Katil</div>
              <div className="rlp-active-desc">
                Bu davet linki ile kayit olun ve avantajlardan yararlanin.
              </div>
            </div>

            {registerPath ? (
              <Link to={registerPath} className="rlp-register-btn">
                Hemen Kayit Ol →
              </Link>
            ) : (
              <div className="rlp-mixed-links">
                <Link to={strategicPartnerPath} className="rlp-partner-btn">
                  Stratejik Partner Olarak Devam Et
                </Link>
                <Link to={supplierPath} className="rlp-supplier-btn">
                  Tedarikçi Olarak Devam Et
                </Link>
              </div>
            )}

            <div className="rlp-login-hint">
              Zaten hesabınız var mı?{" "}
              <Link to="/login" className="rlp-login-link">Giriş yapın</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
