import { useState, useEffect, useCallback } from "react";
import { http } from "../lib/http";

// Types
interface TenantType {
  code: string;
  name: string;
  description: string;
}

interface SubscriptionTier {
  code: string;
  name: string;
  description: string;
  price_monthly?: number;
  trial_days: number;
  max_suppliers?: number;
  max_projects?: number;
  max_users?: number;
}

interface CompanyFormData {
  legal_name: string;
  brand_name: string;
  short_name: string;
  admin_email: string;
  tax_id?: string;
  website?: string;
}

interface CardVerificationData {
  card_number: string;
  card_holder: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
}

type WizardStep = "tenant_type" | "tier" | "company" | "card" | "confirmation";

const STEP_LABELS: Record<WizardStep, string> = {
  tenant_type: "Tenant Tipi",
  tier: "Plan Seçimi",
  company: "Firma Bilgileri",
  card: "Kart Doğrulama",
  confirmation: "Onay",
};

const STEP_ORDER: WizardStep[] = ["tenant_type", "tier", "company", "card", "confirmation"];

export function OnboardingSaaSWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("tenant_type");
  const [tenantTypes, setTenantTypes] = useState<TenantType[]>([]);
  const [selectedTenantType, setSelectedTenantType] = useState<string | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    legal_name: "",
    brand_name: "",
    short_name: "",
    admin_email: "",
    tax_id: "",
    website: "",
  });
  const [cardData, setCardData] = useState<CardVerificationData>({
    card_number: "",
    card_holder: "",
    expiry_month: "",
    expiry_year: "",
    cvv: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tenant types on mount
  useEffect(() => {
    loadTenantTypes();
  }, []);

  // Load tiers when tenant type changes
  useEffect(() => {
    if (selectedTenantType) {
      loadTiers(selectedTenantType);
    }
  }, [selectedTenantType]);

  const loadTenantTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get(`/api/v1/onboarding/tenant-types`);
      setTenantTypes(response.data || []);
    } catch (err) {
      console.error("Tenant types yüklenemedi:", err);
      setError("Tenant tipleri yüklenemedi. Lütfen sayfayı yenileyin.");
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async (tenantTypeCode: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get(`/api/v1/onboarding/tenant-types/${tenantTypeCode}/tiers`);
      setTiers(response.data || []);
    } catch (err) {
      console.error("Tiers yüklenemedi:", err);
      setError("Plan seçenekleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = useCallback(() => {
    const stepIndex = STEP_ORDER.indexOf(currentStep);
    if (stepIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[stepIndex + 1]);
      setError(null);
    }
  }, [currentStep]);

  const handlePrevStep = useCallback(() => {
    const stepIndex = STEP_ORDER.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEP_ORDER[stepIndex - 1]);
      setError(null);
    }
  }, [currentStep]);

  const validateStep = useCallback(() => {
    switch (currentStep) {
      case "tenant_type":
        if (!selectedTenantType) {
          setError("Lütfen bir tenant tipi seçin");
          return false;
        }
        break;
      case "tier":
        if (!selectedTier) {
          setError("Lütfen bir plan seçin");
          return false;
        }
        break;
      case "company":
        if (!companyData.legal_name || !companyData.admin_email) {
          setError("Lütfen tüm zorunlu alanları doldurun");
          return false;
        }
        if (!companyData.admin_email.includes("@")) {
          setError("Lütfen geçerli bir e-posta adresi girin");
          return false;
        }
        break;
      case "card":
        if (!cardData.card_number || !cardData.card_holder || !cardData.cvv) {
          setError("Lütfen tüm kart bilgilerini girin");
          return false;
        }
        if (cardData.card_number.replace(/\s/g, "").length !== 16) {
          setError("Kart numarası 16 haneli olmalıdır");
          return false;
        }
        break;
    }
    return true;
  }, [currentStep, selectedTenantType, selectedTier, companyData, cardData]);

  const handleStepClick = (step: WizardStep) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (stepIndex <= currentIndex) {
      setCurrentStep(step);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (currentStep === "confirmation") {
      // Submit the wizard data
      try {
        setLoading(true);
        // TODO: Call backend to create tenant with all data
        console.log("Submitting:", {
          tenantType: selectedTenantType,
          tier: selectedTier,
          company: companyData,
          card: cardData,
        });
        setError(null);
        // Show success message
        alert("Başarıyla kaydolundu!");
      } catch (err) {
        console.error("Onboarding hatası:", err);
        setError("Onboarding sırasında bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    } else {
      if (validateStep()) {
        handleNextStep();
      }
    }
  };

  // Render functions for each step
  const renderTenantTypeStep = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>
        Tenant Tipi Seçin
      </h2>
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      {tenantTypes.map((type) => (
        <div
          key={type.code}
          onClick={() => setSelectedTenantType(type.code)}
          style={{
            padding: "16px",
            border: selectedTenantType === type.code ? "2px solid #4f46e5" : "2px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
            backgroundColor:
              selectedTenantType === type.code ? "#eef2ff" : "#ffffff",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (selectedTenantType !== type.code) {
              (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db";
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTenantType !== type.code) {
              (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
              (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff";
            }
          }}
        >
          <h3 style={{ margin: "0 0 8px 0", color: "#1f2937" }}>{type.name}</h3>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
            {type.description}
          </p>
        </div>
      ))}
    </div>
  );

  const renderTierStep = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>
        Plan Seçin
      </h2>
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      {tiers.map((tier) => (
        <div
          key={tier.code}
          onClick={() => setSelectedTier(tier.code)}
          style={{
            padding: "16px",
            border: selectedTier === tier.code ? "2px solid #4f46e5" : "2px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
            backgroundColor: selectedTier === tier.code ? "#eef2ff" : "#ffffff",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (selectedTier !== tier.code) {
              (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db";
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f9fafb";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTier !== tier.code) {
              (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
              (e.currentTarget as HTMLElement).style.backgroundColor = "#ffffff";
            }
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#1f2937" }}>{tier.name}</h3>
              <p style={{ margin: "0 0 8px 0", color: "#6b7280", fontSize: "14px" }}>
                {tier.description}
              </p>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "13px" }}>
                ✓ {tier.trial_days} gün ücretsiz deneme
              </p>
            </div>
            {tier.price_monthly && (
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, color: "#1f2937", fontSize: "18px", fontWeight: "600" }}>
                  ${tier.price_monthly.toFixed(2)}
                </p>
                <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "12px" }}>
                  /ay
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCompanyStep = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>
        Firma Bilgileri
      </h2>
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Yasal Şirket Adı *
        </label>
        <input
          type="text"
          value={companyData.legal_name}
          onChange={(e) => setCompanyData({ ...companyData, legal_name: e.target.value })}
          placeholder="Örn: ABC Anonim Şirketi"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Marka Adı
        </label>
        <input
          type="text"
          value={companyData.brand_name}
          onChange={(e) => setCompanyData({ ...companyData, brand_name: e.target.value })}
          placeholder="Örn: ABC Markası"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Admin E-posta *
        </label>
        <input
          type="email"
          value={companyData.admin_email}
          onChange={(e) => setCompanyData({ ...companyData, admin_email: e.target.value })}
          placeholder="admin@example.com"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Vergi Numarası
        </label>
        <input
          type="text"
          value={companyData.tax_id || ""}
          onChange={(e) => setCompanyData({ ...companyData, tax_id: e.target.value })}
          placeholder="Örn: 1234567890"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );

  const renderCardStep = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h2 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>
        Kart Doğrulama
      </h2>
      <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "14px" }}>
        Hesabınızı doğrulamak için 10 TL kesintisi yapılacak ve işlem tamamlandıktan sonra iade edilecektir.
      </p>
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Kart Numarası *
        </label>
        <input
          type="text"
          value={cardData.card_number}
          onChange={(e) => {
            const val = e.target.value.replace(/\s/g, "").slice(0, 16);
            const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
            setCardData({ ...cardData, card_number: formatted });
          }}
          placeholder="1234 5678 9012 3456"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
            fontFamily: "monospace",
          }}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
          Kart Sahibinin Adı *
        </label>
        <input
          type="text"
          value={cardData.card_holder}
          onChange={(e) => setCardData({ ...cardData, card_holder: e.target.value })}
          placeholder="Ad SOYAD"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
            Ay *
          </label>
          <select
            value={cardData.expiry_month}
            onChange={(e) => setCardData({ ...cardData, expiry_month: e.target.value })}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            <option value="">Ay seç</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={String(month).padStart(2, "0")}>
                {String(month).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
            Yıl *
          </label>
          <select
            value={cardData.expiry_year}
            onChange={(e) => setCardData({ ...cardData, expiry_year: e.target.value })}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            <option value="">Yıl seç</option>
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((year) => (
              <option key={year} value={String(year).slice(-2)}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "4px", color: "#374151", fontWeight: "500" }}>
            CVV *
          </label>
          <input
            type="text"
            value={cardData.cvv}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCardData({ ...cardData, cvv: val });
            }}
            placeholder="123"
            maxLength={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
          />
        </div>
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const selectedTenantTypeData = tenantTypes.find((t) => t.code === selectedTenantType);
    const selectedTierData = tiers.find((t) => t.code === selectedTier);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>
          Onay
        </h2>
        <div
          style={{
            padding: "16px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", color: "#15803d", fontSize: "16px" }}>
            Özet
          </h3>
          <div style={{ color: "#15803d", fontSize: "14px", lineHeight: "1.6" }}>
            <p>
              <strong>Tenant Tipi:</strong> {selectedTenantTypeData?.name}
            </p>
            <p>
              <strong>Plan:</strong> {selectedTierData?.name}
            </p>
            <p>
              <strong>Firma Adı:</strong> {companyData.legal_name}
            </p>
            <p>
              <strong>Admin E-posta:</strong> {companyData.admin_email}
            </p>
            <p>
              <strong>Deneme Süresi:</strong> {selectedTierData?.trial_days} gün
            </p>
            {selectedTierData?.price_monthly && (
              <p>
                <strong>Deneme Sonrası:</strong> ${selectedTierData.price_monthly.toFixed(2)}/ay
              </p>
            )}
          </div>
        </div>
        <div
          style={{
            padding: "12px",
            backgroundColor: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            color: "#92400e",
            fontSize: "13px",
          }}
        >
          ⚠️ Onayladığınızda hesabınız hemen oluşturulacak ve deneme dönemini başlatacaksınız.
        </div>
      </div>
    );
  };

  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      {/* Progress Steps */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "40px",
          gap: "8px",
        }}
      >
        {STEP_ORDER.map((step, i) => (
          <div key={step} style={{ flex: 1 }}>
            <div
              onClick={() => handleStepClick(step)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                cursor: i <= stepIndex ? "pointer" : "not-allowed",
                opacity: i <= stepIndex ? 1 : 0.5,
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    currentStep === step
                      ? "#4f46e5"
                      : i < stepIndex
                        ? "#10b981"
                        : "#e5e7eb",
                  color: "white",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                {i < stepIndex ? "✓" : i + 1}
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: currentStep === step ? "#4f46e5" : "#6b7280",
                  fontWeight: currentStep === step ? "600" : "400",
                  textAlign: "center",
                  maxWidth: "80px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                style={{
                  height: "2px",
                  backgroundColor: i < stepIndex ? "#10b981" : "#e5e7eb",
                  marginTop: "8px",
                  transition: "all 0.2s",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div
        style={{
          minHeight: "300px",
          marginBottom: "30px",
        }}
      >
        {currentStep === "tenant_type" && renderTenantTypeStep()}
        {currentStep === "tier" && renderTierStep()}
        {currentStep === "company" && renderCompanyStep()}
        {currentStep === "card" && renderCardStep()}
        {currentStep === "confirmation" && renderConfirmationStep()}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={handlePrevStep}
          disabled={currentStep === "tenant_type"}
          style={{
            flex: 1,
            padding: "10px 16px",
            backgroundColor: "#e5e7eb",
            color: "#374151",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: currentStep === "tenant_type" ? "not-allowed" : "pointer",
            opacity: currentStep === "tenant_type" ? 0.6 : 1,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (currentStep !== "tenant_type") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#d1d5db";
            }
          }}
          onMouseLeave={(e) => {
            if (currentStep !== "tenant_type") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#e5e7eb";
            }
          }}
        >
          ← Geri
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 16px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4338ca";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#4f46e5";
            }
          }}
        >
          {loading ? "Yükleniyor..." : currentStep === "confirmation" ? "Onay ve Başla" : "İleri →"}
        </button>
      </div>
    </div>
  );
}
