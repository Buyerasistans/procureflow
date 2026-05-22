import { useEffect, useMemo, useState } from "react";
import { http } from "../lib/http";
import "./OnboardingSaaSWizard.css";

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

  const currentStepIndex = useMemo(() => STEP_ORDER.indexOf(currentStep), [currentStep]);

  useEffect(() => {
    void loadTenantTypes();
  }, []);

  useEffect(() => {
    if (selectedTenantType) {
      void loadTiers(selectedTenantType);
    }
  }, [selectedTenantType]);

  async function loadTenantTypes() {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get("/api/v1/onboarding/tenant-types");
      setTenantTypes(response.data || []);
    } catch (err) {
      console.error("Tenant types yüklenemedi:", err);
      setError("Tenant tipleri yüklenemedi. Lütfen sayfayı yenileyin.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTiers(tenantTypeCode: string) {
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
  }

  const handleNextStep = () => {
    if (currentStepIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]);
      setError(null);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]);
      setError(null);
    }
  };

  const validateStep = () => {
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
  };

  const handleStepClick = (step: WizardStep) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    if (stepIndex <= currentStepIndex) {
      setCurrentStep(step);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    if (currentStep === "confirmation") {
      try {
        setLoading(true);
        console.log("Submitting:", {
          tenantType: selectedTenantType,
          tier: selectedTier,
          company: companyData,
          card: cardData,
        });
        setError(null);
        alert("Başarıyla kaydolundu!");
      } catch (err) {
        console.error("Onboarding hatası:", err);
        setError("Onboarding sırasında bir hata oluştu.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (validateStep()) {
      handleNextStep();
    }
  };

  const renderTenantTypeStep = () => (
    <div className="onboarding-wizard__step">
      <h2 className="onboarding-wizard__heading">Tenant Tipi Seçin</h2>
      {error ? <div className="onboarding-wizard__error">{error}</div> : null}
      <div className="onboarding-wizard__options">
        {tenantTypes.map((type) => (
          <button
            key={type.code}
            type="button"
            onClick={() => setSelectedTenantType(type.code)}
            className={
              selectedTenantType === type.code
                ? "onboarding-wizard__option onboarding-wizard__option--selected"
                : "onboarding-wizard__option"
            }
          >
            <h3 className="onboarding-wizard__option-title">{type.name}</h3>
            <p className="onboarding-wizard__option-text">{type.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderTierStep = () => (
    <div className="onboarding-wizard__step">
      <h2 className="onboarding-wizard__heading">Plan Seçin</h2>
      {error ? <div className="onboarding-wizard__error">{error}</div> : null}
      <div className="onboarding-wizard__options">
        {tiers.map((tier) => (
          <button
            key={tier.code}
            type="button"
            onClick={() => setSelectedTier(tier.code)}
            className={
              selectedTier === tier.code
                ? "onboarding-wizard__option onboarding-wizard__option--selected"
                : "onboarding-wizard__option"
            }
          >
            <div className="onboarding-wizard__tier-card">
              <div>
                <h3 className="onboarding-wizard__option-title">{tier.name}</h3>
                <p className="onboarding-wizard__option-text">{tier.description}</p>
                <p className="onboarding-wizard__meta">✓ {tier.trial_days} gün ücretsiz deneme</p>
              </div>
              {tier.price_monthly ? (
                <div className="onboarding-wizard__price">
                  <p className="onboarding-wizard__price-value">${tier.price_monthly.toFixed(2)}</p>
                  <p className="onboarding-wizard__price-period">/ay</p>
                </div>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderCompanyStep = () => (
    <div className="onboarding-wizard__step">
      <h2 className="onboarding-wizard__heading">Firma Bilgileri</h2>
      {error ? <div className="onboarding-wizard__error">{error}</div> : null}

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="legal-name">
          Yasal Şirket Adı *
        </label>
        <input
          id="legal-name"
          type="text"
          value={companyData.legal_name}
          onChange={(event) => setCompanyData({ ...companyData, legal_name: event.target.value })}
          placeholder="Örn: ABC Anonim Şirketi"
          className="onboarding-wizard__input"
        />
      </div>

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="brand-name">
          Marka Adı
        </label>
        <input
          id="brand-name"
          type="text"
          value={companyData.brand_name}
          onChange={(event) => setCompanyData({ ...companyData, brand_name: event.target.value })}
          placeholder="Örn: ABC Markası"
          className="onboarding-wizard__input"
        />
      </div>

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="admin-email">
          Admin E-posta *
        </label>
        <input
          id="admin-email"
          type="email"
          value={companyData.admin_email}
          onChange={(event) => setCompanyData({ ...companyData, admin_email: event.target.value })}
          placeholder="admin@example.com"
          className="onboarding-wizard__input"
        />
      </div>

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="tax-id">
          Vergi Numarası
        </label>
        <input
          id="tax-id"
          type="text"
          value={companyData.tax_id || ""}
          onChange={(event) => setCompanyData({ ...companyData, tax_id: event.target.value })}
          placeholder="Örn: 1234567890"
          className="onboarding-wizard__input"
        />
      </div>
    </div>
  );

  const renderCardStep = () => (
    <div className="onboarding-wizard__step">
      <h2 className="onboarding-wizard__heading">Kart Doğrulama</h2>
      <p className="onboarding-wizard__description">
        Hesabınızı doğrulamak için 10 TL kesintisi yapılacak ve işlem tamamlandıktan sonra iade edilecektir.
      </p>
      {error ? <div className="onboarding-wizard__error">{error}</div> : null}

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="card-number">
          Kart Numarası *
        </label>
        <input
          id="card-number"
          type="text"
          value={cardData.card_number}
          onChange={(event) => {
            const value = event.target.value.replace(/\s/g, "").slice(0, 16);
            const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
            setCardData({ ...cardData, card_number: formatted });
          }}
          placeholder="1234 5678 9012 3456"
          className="onboarding-wizard__input onboarding-wizard__input--mono"
          title="Kart Numarası"
        />
      </div>

      <div className="onboarding-wizard__field">
        <label className="onboarding-wizard__label" htmlFor="card-holder">
          Kart Sahibinin Adı *
        </label>
        <input
          id="card-holder"
          type="text"
          value={cardData.card_holder}
          onChange={(event) => setCardData({ ...cardData, card_holder: event.target.value })}
          placeholder="Ad SOYAD"
          className="onboarding-wizard__input"
        />
      </div>

      <div className="onboarding-wizard__three-column">
        <div className="onboarding-wizard__field">
          <label className="onboarding-wizard__label" htmlFor="expiry-month">
            Ay *
          </label>
          <select
            id="expiry-month"
            value={cardData.expiry_month}
            onChange={(event) => setCardData({ ...cardData, expiry_month: event.target.value })}
            className="onboarding-wizard__input"
            title="Ay seçimi"
          >
            <option value="">Ay seç</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <option key={month} value={String(month).padStart(2, "0")}>
                {String(month).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        <div className="onboarding-wizard__field">
          <label className="onboarding-wizard__label" htmlFor="expiry-year">
            Yıl *
          </label>
          <select
            id="expiry-year"
            value={cardData.expiry_year}
            onChange={(event) => setCardData({ ...cardData, expiry_year: event.target.value })}
            className="onboarding-wizard__input"
            title="Yıl seçimi"
          >
            <option value="">Yıl seç</option>
            {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() + index).map((year) => (
              <option key={year} value={String(year).slice(-2)}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="onboarding-wizard__field">
          <label className="onboarding-wizard__label" htmlFor="cvv">
            CVV *
          </label>
          <input
            id="cvv"
            type="text"
            value={cardData.cvv}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "").slice(0, 4);
              setCardData({ ...cardData, cvv: value });
            }}
            placeholder="123"
            maxLength={4}
            className="onboarding-wizard__input onboarding-wizard__input--mono"
          />
        </div>
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const selectedTenantTypeData = tenantTypes.find((type) => type.code === selectedTenantType);
    const selectedTierData = tiers.find((tier) => tier.code === selectedTier);

    return (
      <div className="onboarding-wizard__step">
        <h2 className="onboarding-wizard__heading">Onay</h2>
        <div className="onboarding-wizard__summary">
          <h3 className="onboarding-wizard__summary-title">Özet</h3>
          <div className="onboarding-wizard__summary-text">
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
            {selectedTierData?.price_monthly ? (
              <p>
                <strong>Deneme Sonrası:</strong> ${selectedTierData.price_monthly.toFixed(2)}/ay
              </p>
            ) : null}
          </div>
        </div>
        <div className="onboarding-wizard__warning">
          ⚠️ Onayladığınızda hesabınız hemen oluşturulacak ve deneme dönemini başlatacaksınız.
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding-wizard">
      <div className="onboarding-wizard__progress">
        {STEP_ORDER.map((step, index) => (
          <div key={step} className="onboarding-wizard__progress-item">
            <button
              type="button"
              onClick={() => handleStepClick(step)}
              className={
                index === currentStepIndex
                  ? "onboarding-wizard__progress-step onboarding-wizard__progress-step--current"
                  : index < currentStepIndex
                    ? "onboarding-wizard__progress-step onboarding-wizard__progress-step--completed"
                    : "onboarding-wizard__progress-step"
              }
              disabled={index > currentStepIndex}
              aria-label={`${STEP_LABELS[step]} adımına git`}
              title={STEP_LABELS[step]}
            >
              {index < currentStepIndex ? "✓" : index + 1}
            </button>
            <span
              className={
                index === currentStepIndex
                  ? "onboarding-wizard__progress-label onboarding-wizard__progress-label--current"
                  : "onboarding-wizard__progress-label"
              }
            >
              {STEP_LABELS[step]}
            </span>
            {index < STEP_ORDER.length - 1 ? (
              <div
                className={
                  index < currentStepIndex
                    ? "onboarding-wizard__progress-line onboarding-wizard__progress-line--completed"
                    : "onboarding-wizard__progress-line"
                }
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="onboarding-wizard__content">
        {currentStep === "tenant_type" && renderTenantTypeStep()}
        {currentStep === "tier" && renderTierStep()}
        {currentStep === "company" && renderCompanyStep()}
        {currentStep === "card" && renderCardStep()}
        {currentStep === "confirmation" && renderConfirmationStep()}
      </div>

      <div className="onboarding-wizard__actions">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStep === "tenant_type"}
          className="onboarding-wizard__button onboarding-wizard__button--secondary"
        >
          ← Geri
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="onboarding-wizard__button onboarding-wizard__button--primary"
        >
          {loading ? "Yükleniyor..." : currentStep === "confirmation" ? "Onay ve Başla" : "İleri →"}
        </button>
      </div>
    </div>
  );
}
