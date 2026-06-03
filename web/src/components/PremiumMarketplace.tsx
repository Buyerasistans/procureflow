import { useState, useEffect } from "react";
import { http } from "../lib/http";
import "./PremiumMarketplace.css";

interface PremiumFeature {
  code: string;
  name: string;
  description: string;
  price_monthly?: number;
  icon?: string;
}

interface TenantPremiumFeature {
  feature_code: string;
  is_active: boolean;
  activated_at?: string;
  expires_at?: string;
}

interface PremiumMarketplaceProps {
  tenantId: number;
  tenantTypeCode: string;
  onActivated?: () => void;
}

export function PremiumMarketplace({
  tenantId,
  tenantTypeCode,
  onActivated,
}: PremiumMarketplaceProps) {
  const [features, setFeatures] = useState<PremiumFeature[]>([]);
  const [activePremiums, setActivePremiums] = useState<TenantPremiumFeature[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [activatingFeature, setActivatingFeature] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantTypeCode]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load available features
      const featuresResponse = await http.get(
        `/api/v1/onboarding/premium-features?tenant_type=${tenantTypeCode}`
      );
      setFeatures(featuresResponse.data || []);

      // Load active premium features for this tenant
      const activePremiumsResponse = await http.get(
        `/api/v1/onboarding/tenant/${tenantId}/premium-features`
      );
      setActivePremiums(activePremiumsResponse.data || []);
    } catch (err) {
      console.error("Premium features yüklenemedi:", err);
      setError("Premium özellikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const handleActivateFeature = async (featureCode: string) => {
    try {
      setActivatingFeature(featureCode);
      setError(null);

      await http.post(
        `/api/v1/onboarding/tenant/${tenantId}/premium-features/activate`,
        {
          feature_code: featureCode,
        }
      );

      // Reload active features
      const activePremiumsResponse = await http.get(
        `/api/v1/onboarding/tenant/${tenantId}/premium-features`
      );
      setActivePremiums(activePremiumsResponse.data || []);

      if (onActivated) {
        onActivated();
      }
    } catch (err) {
      console.error("Özellik aktivasyon hatası:", err);
      setError("Özellik aktivasyonu başarısız oldu");
    } finally {
      setActivatingFeature(null);
    }
  };

  if (loading) return <div className="pm-loading">Yükleniyor...</div>;
  if (error) return <div className="pm-error">{error}</div>;

  return (
    <div className="pm-list">
      <div>
        <h2 className="pm-section-title">Premium Özellikler Pazarı</h2>
        <p className="pm-section-desc">
          Hesabınızı geliştirmek için ekstra özellikler aktivasyon edin.
        </p>
      </div>

      {activePremiums.length > 0 && (
        <div className="pm-active-section">
          <h3 className="pm-active-section__title">✓ Aktif Premium Özellikleriniz</h3>
          <div className="pm-active-list">
            {activePremiums
              .filter((ap) => ap.is_active)
              .map((activePremium) => {
                const feature = features.find((f) => f.code === activePremium.feature_code);
                return (
                  <div key={activePremium.feature_code} className="pm-active-item">
                    <div>
                      <p className="pm-active-item__name">{feature?.name}</p>
                      {activePremium.expires_at && (
                        <p className="pm-active-item__expires">
                          Süresi bitişi: {activePremium.expires_at}
                        </p>
                      )}
                    </div>
                    <span className="pm-active-badge">Aktif</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div>
        <h3 className="pm-avail-title">Mevcut Premium Özellikler</h3>
        <div className="pm-avail-grid">
          {features.map((feature) => {
            const isActive = activePremiums.some(
              (ap) => ap.feature_code === feature.code && ap.is_active
            );
            const isActivating = activatingFeature === feature.code;

            return (
              <div
                key={feature.code}
                className={`pm-feat-card${isActive ? " pm-feat-card--active" : ""}`}
              >
                <div className="pm-feat-card__header">
                  <div className="pm-feat-card__icon">{feature.icon || "⭐"}</div>
                  <h4 className="pm-feat-card__name">{feature.name}</h4>
                  <p className="pm-feat-card__desc">{feature.description}</p>
                </div>

                {feature.price_monthly && (
                  <div className="pm-feat-card__price-section">
                    <p className="pm-feat-card__price-label">Fiyat</p>
                    <p className="pm-feat-card__price-value">
                      ${feature.price_monthly.toFixed(2)}
                      <span className="pm-feat-card__price-period"> /ay</span>
                    </p>
                  </div>
                )}

                {isActive && (
                  <div className="pm-feat-card__active-badge">
                    <p className="pm-feat-card__active-label">✓ Aktif</p>
                  </div>
                )}

                {!isActive && (
                  <button
                    onClick={() => handleActivateFeature(feature.code)}
                    disabled={isActivating}
                    className={`pm-feat-card__cta-btn${isActivating ? " pm-feat-card__cta-btn--activating" : ""}`}
                  >
                    {isActivating ? "Aktivasyonda..." : "Aktivasyon Yap"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {features.length === 0 && (
        <div className="pm-empty">
          Bu tenant tipi için premium özellik mevcut değil.
        </div>
      )}
    </div>
  );
}
