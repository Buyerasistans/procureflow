import { useState, useEffect } from "react";
import { http } from "../lib/http";

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

  if (loading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#f3f4f6",
          color: "#6b7280",
          textAlign: "center",
        }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          fontSize: "14px",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2
          style={{
            margin: "0 0 8px 0",
            color: "#1f2937",
            fontSize: "20px",
            fontWeight: "600",
          }}
        >
          Premium Özellikler Pazarı
        </h2>
        <p
          style={{
            margin: "0 0 16px 0",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Hesabınızı geliştirmek için ekstra özellikler aktivasyon edin.
        </p>
      </div>

      {/* Active Features Section */}
      {activePremiums.length > 0 && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              color: "#15803d",
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
            }}
          >
            ✓ Aktif Premium Özellikleriniz
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activePremiums
              .filter((ap) => ap.is_active)
              .map((activePremium) => {
                const feature = features.find(
                  (f) => f.code === activePremium.feature_code
                );
                return (
                  <div
                    key={activePremium.feature_code}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#ecfdf5",
                      borderRadius: "4px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: "0 0 2px 0",
                          color: "#15803d",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                      >
                        {feature?.name}
                      </p>
                      {activePremium.expires_at && (
                        <p
                          style={{
                            margin: 0,
                            color: "#6b7280",
                            fontSize: "12px",
                          }}
                        >
                          Süresi bitişi: {activePremium.expires_at}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#10b981",
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Aktif
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Available Features Grid */}
      <div>
        <h3
          style={{
            margin: "0 0 12px 0",
            color: "#1f2937",
            fontSize: "14px",
            fontWeight: "600",
            textTransform: "uppercase",
          }}
        >
          Mevcut Premium Özellikler
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {features.map((feature) => {
            const isActive = activePremiums.some(
              (ap) => ap.feature_code === feature.code && ap.is_active
            );
            const isActivating = activatingFeature === feature.code;

            return (
              <div
                key={feature.code}
                style={{
                  padding: "16px",
                  border: isActive ? "2px solid #10b981" : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  backgroundColor: isActive ? "#f0fdf4" : "#ffffff",
                  transition: "all 0.2s",
                  cursor: "default",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "#d1d5db";
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 4px 6px rgba(0,0,0,0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "#e5e7eb";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }
                }}
              >
                {/* Header */}
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      fontSize: "24px",
                      marginBottom: "8px",
                    }}
                  >
                    {feature.icon || "⭐"}
                  </div>
                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      color: "#1f2937",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}
                  >
                    {feature.name}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      color: "#6b7280",
                      fontSize: "13px",
                      lineHeight: "1.4",
                    }}
                  >
                    {feature.description}
                  </p>
                </div>

                {/* Price */}
                {feature.price_monthly && (
                  <div
                    style={{
                      marginBottom: "12px",
                      paddingBottom: "12px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        color: "#6b7280",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        fontWeight: "600",
                      }}
                    >
                      Fiyat
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: "#1f2937",
                        fontSize: "18px",
                        fontWeight: "700",
                      }}
                    >
                      ${feature.price_monthly.toFixed(2)}
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#6b7280",
                          fontWeight: "400",
                        }}
                      >
                        {" "}
                        /ay
                      </span>
                    </p>
                  </div>
                )}

                {/* Status Badge */}
                {isActive && (
                  <div
                    style={{
                      marginBottom: "12px",
                      padding: "8px",
                      backgroundColor: "#ecfdf5",
                      borderRadius: "4px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: "#10b981",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      ✓ Aktif
                    </p>
                  </div>
                )}

                {/* CTA Button */}
                {!isActive && (
                  <button
                    onClick={() => handleActivateFeature(feature.code)}
                    disabled={isActivating}
                    style={{
                      marginTop: "auto",
                      padding: "10px 16px",
                      backgroundColor: "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: isActivating ? "not-allowed" : "pointer",
                      opacity: isActivating ? 0.6 : 1,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActivating) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = "#4338ca";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActivating) {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.backgroundColor = "#4f46e5";
                      }
                    }}
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
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            backgroundColor: "#f3f4f6",
            borderRadius: "8px",
            color: "#6b7280",
          }}
        >
          Bu tenant tipi için premium özellik mevcut değil.
        </div>
      )}
    </div>
  );
}
