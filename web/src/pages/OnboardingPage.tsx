import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";
import "./OnboardingPage.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PlanModule {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  limit_key?: string;
  limit_value?: number;
  unit?: string;
}

interface Plan {
  code: string;
  name: string;
  description: string;
  audience: string;
  price_monthly?: number;
  currency?: string;
  requires_payment?: boolean;
  is_default: boolean;
  included_target_category_limit?: number;
  extra_target_category_slot_price?: number;
  extra_target_category_slot_currency?: string;
  modules: PlanModule[];
}
const MAX_COMPANY_CATEGORY_COUNT = 5;
const DEFAULT_FREE_TARGET_CATEGORY_LIMIT = 2;
const DEFAULT_EXTRA_TARGET_CATEGORY_SLOT_PRICE = 3500;

type CategoryModalMode = "offered" | "target" | null;

interface PaymentProvider {
  code: string;
  name: string;
  ready?: boolean;
}

interface OnboardingLookupStatus {
  tenant_slug: string;
  legal_name: string;
  brand_name?: string | null;
  admin_email: string;
  onboarding_status: string;
  onboarding_payment_status: string;
  onboarding_approval_status: string;
  onboarding_activation_notes?: string | null;
  payment_transaction_id?: number | null;
  tracking_token?: string | null;
  tracking_token_expires_at?: string | null;
  payment_receipt_uploaded: boolean;
  can_resubmit_receipt: boolean;
}

interface BankTransferInstructions {
  bank_name?: string;
  iban?: string;
  account_name?: string;
  reference?: string;
  amount?: string;
  currency?: string;
}

type TenantType = "strategic_partner" | "supplier";
type WizardStep = "tenant_type" | "plan" | "details" | "payment" | "done";

interface TenantTypeOption {
  type: TenantType;
  title: string;
  description: string;
}

const TENANT_TYPES: TenantTypeOption[] = [
  {
    type: "strategic_partner",
    title: "Stratejik Partnerlik",
    description: "Kurumsal satın alma ekibi - Tedarikçileri yönetin, teklif alın",
  },
  {
    type: "supplier",
    title: "Tedarikçi",
    description: "Teklif sunun, müşteri bulun, daha fazla iş kazanın",
  },
];

const CATEGORY_HELP_COPY: Record<TenantType, { title: string; detail: string }> = {
  strategic_partner: {
    title: "Kategori bilgisi supplier planlamasi icin kullanilir",
    detail:
      "Seçtiğiniz faaliyet alanı onboarding sonrasında Stratejik Partner Yönetimi ekranında supplier kapsamı ile birlikte izlenir. Böylece ilgili kategoride hazır tedarikçi olup olmadığı ve hangi alanlarda ek supplier devreye alma gerektiği ilk günden görülür.",
  },
  supplier: {
    title: "Kategori bilgisi gorunurluk ve davet kalitesi icin kullanilir",
    detail:
      "Seçtiğiniz uzmanlık alanı sizi yalnızca profil etiketine dönüştürmez. Bu bilgi; ilgili RFQ akışlarında daha doğru görünürlük, daha isabetli davet ve admin tarafında kategori bazlı supplier kapsamı takibi için kullanılır.",
  },
};

const WIZARD_STEPS: WizardStep[] = ["tenant_type", "details", "plan", "payment", "done"];

function stepLabel(s: WizardStep): string {
  if (s === "tenant_type") return "Siz Kimsiniz?";
  if (s === "details") return "Hesap Bilgileri";
  if (s === "plan") return "Plan Seçimi";
  if (s === "payment") return "Ödeme";
  return "Tamamlandı";
}

export default function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const paramTenantType = (searchParams.get("tenant_type") || "") as TenantType | "";
  const paramPlanCode = (searchParams.get("plan_code") || "").trim();
  const trackingToken = (searchParams.get("tracking_token") || "").trim();
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();

  const [step, setStep] = useState<WizardStep>(paramTenantType ? "details" : "tenant_type");
  const [selectedTenantType, setSelectedTenantType] = useState<TenantType | "">(paramTenantType || "");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>(paramPlanCode || "");

  const [legalName, setLegalName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTargetCategories, setSelectedTargetCategories] = useState<string[]>([]);
  const [customCategoriesText, setCustomCategoriesText] = useState("");
  const [customTargetCategoriesText, setCustomTargetCategoriesText] = useState("");
  const [activeCategoryModal, setActiveCategoryModal] = useState<CategoryModalMode>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState(referralCode);

  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("bank_transfer");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentTransactionId, setPaymentTransactionId] = useState<number | null>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null);
  const [paymentReceiptNote, setPaymentReceiptNote] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<{ tenant_slug: string; admin_email: string; invitation_sent: boolean; message: string; payment_verified?: boolean; payment_transaction_id?: number | null } | null>(null);
  const [statusLookup, setStatusLookup] = useState<OnboardingLookupStatus | null>(null);
  const [statusLookupLoading, setStatusLookupLoading] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [bankTransferInstructions, setBankTransferInstructions] = useState<BankTransferInstructions | null>(null);

  const selectedPlanObj = useMemo(() => plans.find((p) => p.code === selectedPlan) || null, [plans, selectedPlan]);
  const requestedCategories = useMemo(() => parseCustomCategoryText(customCategoriesText), [customCategoriesText]);
  const requestedTargetCategories = useMemo(() => parseCustomCategoryText(customTargetCategoriesText), [customTargetCategoriesText]);
  const selectedPlanPrice = Number(selectedPlanObj?.price_monthly || 0);
  const selectedPlanCurrency = selectedPlanObj?.currency || "TRY";
  const includedTargetCategoryLimit = Number(selectedPlanObj?.included_target_category_limit || DEFAULT_FREE_TARGET_CATEGORY_LIMIT);
  const extraTargetCategorySlotPrice = Number(selectedPlanObj?.extra_target_category_slot_price || DEFAULT_EXTRA_TARGET_CATEGORY_SLOT_PRICE);
  const extraTargetCategorySlotCurrency = selectedPlanObj?.extra_target_category_slot_currency || selectedPlanCurrency;
  const totalTargetCategoryCount = selectedTargetCategories.length + requestedTargetCategories.length;
  const extraTargetCategoryCount = Math.max(totalTargetCategoryCount - includedTargetCategoryLimit, 0);
  const extraTargetCategoryFee = extraTargetCategoryCount * extraTargetCategorySlotPrice;
  const totalPaymentAmount = selectedPlanPrice + extraTargetCategoryFee;
  const selectedPlanRequiresPayment = totalPaymentAmount > 0;
  const selectedPlanNeedsSalesContact = Boolean(
    selectedPlanObj?.audience === "strategic_partner" && selectedPlanPrice <= 0,
  );

  const currentStepIdx = WIZARD_STEPS.indexOf(step);

  function toggleCategorySelection(
    value: string,
    setSelectedItems: Dispatch<SetStateAction<string[]>>
  ) {
    setSelectedItems((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  }

  function toggleLimitedCategorySelection(
    value: string,
    selectedItems: string[],
    setSelectedItems: Dispatch<SetStateAction<string[]>>,
    maxCount: number,
    limitMessage: string
  ) {
    if (selectedItems.includes(value)) {
      toggleCategorySelection(value, setSelectedItems);
      return;
    }
    if (selectedItems.length >= maxCount) {
      setError(limitMessage);
      return;
    }
    toggleCategorySelection(value, setSelectedItems);
  }

  function parseCustomCategoryText(value: string): string[] {
    const seen = new Set<string>();
    return value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter((item) => {
        const key = item.toLocaleLowerCase("tr-TR");
        if (!item || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  useEffect(() => {
    if (!selectedTenantType) {
      setPlans([]);
      setPlansLoading(false);
      return;
    }

    setPlansLoading(true);
    fetch(`${API_BASE}/api/v1/onboarding/plans`)
      .then((r) => r.json())
      .then((data) => {
        const allPlans = Array.isArray(data?.plans) ? data.plans : [];
        const filteredPlans = allPlans.filter((p: Plan) => p.audience === selectedTenantType);
        setPlans(filteredPlans);

        if (paramPlanCode) {
          const fromQuery = filteredPlans.find((p: Plan) => p.code === paramPlanCode);
          if (fromQuery) {
            setSelectedPlan(fromQuery.code);
            return;
          }
        }

        const def = filteredPlans.find((p: Plan) => p.is_default);
        if (def) {
          setSelectedPlan(def.code);
        } else if (filteredPlans.length > 0) {
          setSelectedPlan(filteredPlans[0].code);
        }
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
  }, [selectedTenantType, paramPlanCode]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/payment/providers`)
      .then((r) => r.json())
      .then((data) => {
        const providers = Array.isArray(data?.providers) ? data.providers : [];
        setPaymentProviders(providers);
        if (providers.length > 0 && !providers.some((p: PaymentProvider) => p.code === selectedProvider)) {
          setSelectedProvider(providers[0].code);
        }
      })
      .catch(() => setPaymentProviders([]));
  }, [selectedProvider]);

  useEffect(() => {
    if (selectedProvider !== "bank_transfer") {
      return;
    }
    fetch(`${API_BASE}/api/v1/payment/bank-transfer-instructions`)
      .then(async (response) => {
        const data = await parseApiResponse<{ instructions?: BankTransferInstructions | null; detail?: string }>(response);
        if (!response.ok) {
          throw new Error(data?.detail ?? "Banka bilgileri alınamadı.");
        }
        setBankTransferInstructions(data?.instructions || null);
      })
      .catch(() => {
        setBankTransferInstructions(null);
      });
  }, [selectedProvider]);

  async function parseApiResponse<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      if (!response.ok) {
        throw new Error(text);
      }
      throw new Error("Sunucu yanıtı ayrıştırılamadı.");
    }
  }

  async function loadStatusLookup() {
    if (!trackingToken) {
      setStatusLookup(null);
      return;
    }
    setStatusLookupLoading(true);
    try {
      const params = new URLSearchParams({ token: trackingToken });
      const res = await fetch(`${API_BASE}/api/v1/onboarding/status?${params.toString()}`);
      const data = await parseApiResponse<OnboardingLookupStatus | { detail?: string }>(res);
      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "Başvuru durumu alınamadı.");
      }
      const nextStatus = data as OnboardingLookupStatus;
      setStatusLookup(nextStatus);
      if (nextStatus.tracking_token && nextStatus.tracking_token !== trackingToken) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tracking_token", nextStatus.tracking_token);
        window.history.replaceState({}, "", `${window.location.pathname}?${nextParams.toString()}`);
      }
    } catch (err) {
      setStatusLookup(null);
      setError(err instanceof Error ? err.message : "Başvuru durumu alınamadı.");
    } finally {
      setStatusLookupLoading(false);
    }
  }

  useEffect(() => {
    void loadStatusLookup();
  }, [trackingToken]);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => setCopyFeedback(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  async function copyToClipboard(value: string, label: string) {
    const normalized = value.trim();
    if (!normalized) {
      setCopyFeedback(`${label} bulunamadı.`);
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized);
      } else {
        const temp = document.createElement("textarea");
        temp.value = normalized;
        temp.setAttribute("readonly", "true");
        temp.style.position = "absolute";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setCopyFeedback(`${label} kopyalandi.`);
    } catch {
      setCopyFeedback(`${label} kopyalanamadi.`);
    }
  }

  async function handleResubmitReceipt() {
    const transactionId = statusLookup?.payment_transaction_id ?? doneData?.payment_transaction_id ?? null;
    if (!transactionId) {
      setError("Güncellenecek ödeme işlemi bulunamadı.");
      return;
    }
    if (!paymentReceiptFile) {
      setError("Lütfen yeni dekont dosyasını seçin.");
      return;
    }

    setError(null);
    setStatusActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", paymentReceiptFile);
      if (paymentReceiptNote.trim()) {
        formData.append("note", paymentReceiptNote.trim());
      }
      const res = await fetch(`${API_BASE}/api/v1/payment/transactions/${transactionId}/receipt`, {
        method: "POST",
        body: formData,
      });
      const data = await parseApiResponse<{ detail?: string }>(res);
      if (!res.ok) {
        throw new Error(data?.detail ?? "Dekont güncellenemedi.");
      }
      setPaymentNote("Dekont yeniden yüklendi. Operasyon ekibi güncel kanıtı inceleyecek.");
      setPaymentReceiptFile(null);
      setPaymentReceiptNote("");
      await loadStatusLookup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dekont güncellenemedi.");
    } finally {
      setStatusActionLoading(false);
    }
  }

  async function submitRegistration(planCodeToUse: string, paymentTxnId: number | null) {
    const res = await fetch(`${API_BASE}/api/v1/onboarding/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_code: planCodeToUse,
        legal_name: legalName.trim(),
        brand_name: brandName.trim() || undefined,
        category: selectedCategories[0] || undefined,
        categories: selectedCategories,
        target_categories: selectedTargetCategories,
        requested_categories: requestedCategories,
        requested_target_categories: requestedTargetCategories,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        payment_transaction_id: paymentTxnId ?? undefined,
        referral_code: referralCodeInput || undefined,
      }),
    });
    const data = await parseApiResponse<{ detail?: string; tenant_slug: string; admin_email: string; invitation_sent: boolean; message: string; payment_verified?: boolean; payment_transaction_id?: number | null }>(res);
    if (!res.ok) {
      throw new Error((data as { detail?: string } | null)?.detail ?? "Kayıt sırasında bir hata oluştu.");
    }
    setDoneData(data);
    setStep("done");
  }

  function handleDetailsContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!legalName.trim() || !fullName.trim() || !email.trim() || !phone.trim()) {
      setError("Lütfen zorunlu alanları doldurun.");
      return;
    }
    if (selectedCategories.length < 1) {
      setError("En az 1 faaliyet kategorisi seçmelisiniz.");
      return;
    }

    setStep("plan");
  }

  async function handlePlanContinue() {
    setError(null);
    if (!selectedPlan) {
      setError("Lütfen bir plan seçin.");
      return;
    }
    if (selectedPlanNeedsSalesContact) {
      setError("Bu plan kuruma özel olduğu için self-serve kayıtla tamamlanamaz. Lütfen satış ekibiyle iletişime geçin.");
      return;
    }

    if (selectedPlanRequiresPayment && !paymentTransactionId) {
      setStep("payment");
      return;
    }

    setSubmitting(true);
    try {
      await submitRegistration(selectedPlan, paymentTransactionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaymentAndComplete() {
    setError(null);

    if (!selectedPlanObj || totalPaymentAmount <= 0) {
      setError("Ödeme gerektiren bir plan seçmelisiniz.");
      return;
    }

    if (!email.trim() || !fullName.trim() || !phone.trim() || selectedCategories.length < 1) {
      setError("Ödeme adımından önce hesap bilgilerini doldurun.");
      setStep("details");
      return;
    }

    setPaymentLoading(true);
    try {
      const paymentRes = await fetch(`${API_BASE}/api/v1/payment/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          amount: totalPaymentAmount,
          currency: selectedPlanCurrency,
          description: `Onboarding ${selectedPlanObj.name} plani`,
          buyer_email: email.trim(),
          buyer_name: fullName.trim(),
          transaction_type: "subscription",
          reference_type: "onboarding_plan",
          extra: {
            plan_code: selectedPlanObj.code,
            extra_target_category_count: extraTargetCategoryCount,
            extra_target_category_fee: extraTargetCategoryFee,
            transfer_reference: `ONB-${Date.now()}`,
          },
        }),
      });

      const paymentData = await parseApiResponse<{ detail?: string; transaction_id?: number; redirect_url?: string | null; instructions?: BankTransferInstructions | null }>(paymentRes);
      if (!paymentRes.ok) {
        throw new Error((paymentData as { detail?: string } | null)?.detail ?? "Ödeme başlatılamadı.");
      }

      const txnId = Number(paymentData?.transaction_id);
      if (!txnId) {
        throw new Error("Ödeme işlemi oluşturulamadı.");
      }

      setPaymentTransactionId(txnId);
      setBankTransferInstructions(paymentData?.instructions || null);

      if (selectedProvider === "bank_transfer" && paymentReceiptFile) {
        const formData = new FormData();
        formData.append("file", paymentReceiptFile);
        if (paymentReceiptNote.trim()) {
          formData.append("note", paymentReceiptNote.trim());
        }

        const receiptRes = await fetch(`${API_BASE}/api/v1/payment/transactions/${txnId}/receipt`, {
          method: "POST",
          body: formData,
        });
        const receiptData = await parseApiResponse<{ detail?: string }>(receiptRes).catch((err) => {
          throw err;
        });
        if (!receiptRes.ok) {
          throw new Error(receiptData?.detail ?? "Dekont yüklenemedi.");
        }
      }

      if (paymentData?.redirect_url) {
        window.open(String(paymentData.redirect_url), "_blank", "noopener,noreferrer");
        setPaymentNote("Ödeme penceresi yeni sekmede açıldı. Ödeme adımını tamamlayıp geri dönün.");
      } else {
        setPaymentNote("Ödeme işlemi oluşturuldu. Kayıt adımına devam ediliyor.");
      }

      setSubmitting(true);
      await submitRegistration(selectedPlanObj.code, txnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ödeme adımı başarısız oldu.");
    } finally {
      setPaymentLoading(false);
      setSubmitting(false);
    }
  }

  const navVariant = selectedTenantType === "supplier" ? "supplier" : "strategic";

  return (
    <div className="obp-root">
      <NavBar variant={navVariant} activePath="/onboarding" />
      <div className="obp-page">
        <div className="obp-card">
          <div className="obp-header">
            <PublicBrandLogo height={44} maxWidth={220} />
            <div className="obp-subtitle">Tedarik süreçlerinizi dijitalleştirin</div>
          </div>

          {trackingToken ? (
            <div className="obp-prominent-box obp-prominent-box--tracking">
              <div className="obp-prominent-box-title">Başvuru Takibi</div>
              {statusLookupLoading ? (
                <div>Başvuru durumu yükleniyor...</div>
              ) : statusLookup ? (
                <div className="obp-tracking-grid">
                  <div><strong>Başvuru:</strong> {statusLookup.brand_name || statusLookup.legal_name}</div>
                  <div><strong>Durum:</strong> {statusLookup.onboarding_approval_status} / {statusLookup.onboarding_payment_status}</div>
                  {statusLookup.tracking_token_expires_at ? <div><strong>Takip linki son geçerlilik:</strong> {new Date(statusLookup.tracking_token_expires_at).toLocaleString("tr-TR")}</div> : null}
                  {statusLookup.onboarding_activation_notes ? <div><strong>Operasyon notu:</strong> {statusLookup.onboarding_activation_notes}</div> : null}
                  {statusLookup.can_resubmit_receipt ? (
                    <div className="obp-resubmit-grid">
                      <div className="obp-tracking-note">Yeni dekont veya açıklama yükleyerek başvurunuzu güncelleyebilirsiniz.</div>
                      <label className="obp-label">
                        Yeni dekont dosyasi
                        <input type="file" accept="application/pdf,image/*" onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)} className="obp-input" />
                      </label>
                      <label className="obp-label">
                        Guncel aciklama
                        <textarea value={paymentReceiptNote} onChange={(e) => setPaymentReceiptNote(e.target.value)} rows={3} className="obp-textarea" placeholder="Yeni dekont aciklamasi veya banka referansi" />
                      </label>
                      <button type="button" className="obp-btn-primary" disabled={statusActionLoading} onClick={() => void handleResubmitReceipt()}>
                        {statusActionLoading ? "Güncelleniyor..." : "Dekontu Yeniden Yükle"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>Başvuru kaydı bulunamadı.</div>
              )}
            </div>
          ) : null}

          <div className="obp-steps">
            {WIZARD_STEPS.map((s, i) => {
              const dotVariant: "active" | "done" | "pending" = s === step ? "active" : i < currentStepIdx ? "done" : "pending";
              return (
                <div key={s} className="obp-step-item">
                  <div className={`obp-step-dot obp-step-dot--${dotVariant}`}>{i + 1}</div>
                  <span className={s === step ? "obp-step-label obp-step-label--active" : "obp-step-label"}>
                    {stepLabel(s)}
                  </span>
                  {i < WIZARD_STEPS.length - 1 && <div className="obp-step-line" />}
                </div>
              );
            })}
          </div>

          {step === "tenant_type" && (
            <div>
              <h2 className="obp-step-title">Siz kimsiniz?</h2>
              <p className="obp-step-desc">Lütfen işletme tipinizi seçin.</p>
              <div className="obp-type-grid">
                {TENANT_TYPES.map((type) => (
                  <div
                    key={type.type}
                    onClick={() => {
                      setSelectedTenantType(type.type);
                      setSelectedPlan("");
                      setError(null);
                      setStep("details");
                    }}
                    className="obp-plan-card"
                  >
                    <div className="obp-type-card-header">
                      <div className={`obp-type-icon obp-type-icon--${type.type === "strategic_partner" ? "strategic" : "supplier"}`}>
                        {type.type === "strategic_partner" ? "🏢" : "🏭"}
                      </div>
                      <span className="obp-type-title">{type.title}</span>
                    </div>
                    <p className="obp-type-desc">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "plan" && (
            <div>
              <h2 className="obp-step-title">Paketinizi seçin</h2>
              <p className="obp-step-desc">Fiyat bilgisi super admin tarafından yönetilir ve seçime göre ödeme adımı zorunlu tutulur.</p>
              {plansLoading ? (
                <div className="obp-loading">Paketler yükleniyor...</div>
              ) : (
                <div className="obp-plan-grid">
                  {plans.map((plan) => (
                    <div
                      key={plan.code}
                      onClick={() => {
                        setSelectedPlan(plan.code);
                        setError(null);
                      }}
                      className={selectedPlan === plan.code ? "obp-plan-card obp-plan-card--selected" : "obp-plan-card"}
                    >
                      <div className="obp-plan-header">
                        <span className="obp-plan-name">{plan.name}</span>
                        {plan.is_default ? <span className="obp-badge">Önerilen</span> : null}
                      </div>
                      <p className="obp-plan-desc">{plan.description}</p>
                      <div className="obp-plan-price">{renderPrice(plan)}</div>
                      <div className="obp-plan-modules">
                        {plan.modules.slice(0, 4).map((m) => (
                          <div key={m.code} className="obp-module-item">
                            <span className="obp-module-check">✓</span>
                            <span>
                              {m.name}
                              {m.limit_value ? ` - ${m.limit_value} ${m.unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {error && <div className="obp-error">{error}</div>}
              <div className="obp-actions">
                {!paramTenantType ? (
                  <button type="button" className="obp-btn-secondary" onClick={() => setStep("tenant_type")}>← Geri</button>
                ) : null}
                <button
                  type="button"
                  className="obp-btn-primary"
                  disabled={!selectedPlan || selectedPlanNeedsSalesContact || submitting}
                  onClick={() => { void handlePlanContinue(); }}
                >
                  {submitting ? "Kaydediliyor..." : "Devam Et →"}
                </button>
              </div>
              {selectedPlanNeedsSalesContact ? (
                <div className="obp-info-box">
                  Bu plan kuruma özel olduğu için self-serve akışta devam edilemez. Lütfen <a href="/demo?audience=strategic">satış ekibiyle görüşün</a>.
                </div>
              ) : null}
            </div>
          )}

          {step === "details" && (
            <form data-telemetry-name="onboarding-register-form" onSubmit={handleDetailsContinue}>
              <h2 className="obp-step-title">Firma ve hesap bilgileri</h2>
              <p className="obp-step-desc">Sisteme giriş yapacak ilk yönetici hesabını oluşturun.</p>
              {selectedPlanObj && (
                <div className="obp-prominent-box">
                  <strong>Seçilen plan:</strong> {selectedPlanObj.name} - {renderPrice(selectedPlanObj)}
                </div>
              )}
              <div className="obp-form-grid">
                <label className="obp-label">
                  Firma ticari unvani *
                  <input className="obp-input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Ornek A.S." required aria-label="Firma ticari unvani" />
                </label>
                <label className="obp-label">
                  Marka adi
                  <input className="obp-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Opsiyonel" aria-label="Marka adi" />
                </label>
                {selectedTenantType ? (
                  <div className="obp-label">
                    <div className="obp-selection-header">
                      <span>Mevcut faaliyet kategorileri *</span>
                      <button type="button" className="obp-inline-select-btn" onClick={() => { setError(null); setActiveCategoryModal("offered"); }}>
                        Kategori Seç
                      </button>
                    </div>
                    <div className="obp-selection-summary">
                      {selectedCategories.length > 0 ? selectedCategories.map((item) => (
                        <span key={`selected-offered-${item}`} className="obp-chip">{item}</span>
                      )) : <span className="obp-selection-empty">En az 1 kategori seçilmeli</span>}
                    </div>
                    <div className="obp-selection-meta">{selectedCategories.length} / {MAX_COMPANY_CATEGORY_COUNT} seçildi</div>
                  </div>
                ) : null}
                {selectedTenantType ? (
                  <div className="obp-label">
                    <div className="obp-selection-header">
                      <span>Hedef ilgilenilen kategoriler</span>
                      <button type="button" className="obp-inline-select-btn" onClick={() => { setError(null); setActiveCategoryModal("target"); }}>
                        Hedef Kategori Seç
                      </button>
                    </div>
                    <div className="obp-selection-summary">
                      {selectedTargetCategories.length > 0 ? selectedTargetCategories.map((item) => (
                        <span key={`selected-target-${item}`} className="obp-chip obp-chip--target">{item}</span>
                      )) : <span className="obp-selection-empty">Varsayilan olarak {includedTargetCategoryLimit} hedef kategoriye kadar ucretsiz</span>}
                    </div>
                    <div className="obp-selection-meta">
                      {includedTargetCategoryLimit} hedef kategori dahil. Liste disi hedef kategori talepleri de bu limite dahildir; sonraki her kategori icin {extraTargetCategorySlotPrice.toLocaleString("tr-TR")} {extraTargetCategorySlotCurrency} eklenir.
                    </div>
                  </div>
                ) : null}
                <label className="obp-label">
                  Yetkili adi soyadi *
                  <input className="obp-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ahmet Yilmaz" required aria-label="Yetkili adi soyadi" />
                </label>
                <label className="obp-label">
                  E-posta *
                  <input className="obp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ahmet@sirket.com.tr" required aria-label="E-posta" />
                </label>
                <label className="obp-label">
                  Telefon *
                  <input className="obp-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" required aria-label="Telefon" />
                </label>
                <label className="obp-label">
                  Takip Kodu
                  <input
                    className="obp-input"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ornek: CH-Y5LHNUHI"
                    aria-label="Takip Kodu"
                  />
                </label>
              </div>
              {selectedTenantType ? (
                <div className={`obp-prominent-box ${selectedTenantType === "supplier" ? "obp-prominent-box--help-supplier" : "obp-prominent-box--help-strategic"}`}>
                  <strong>{CATEGORY_HELP_COPY[selectedTenantType].title}</strong>
                  <div className="obp-info-detail">{CATEGORY_HELP_COPY[selectedTenantType].detail}</div>
                  <div className="obp-info-note">
                    Kategori seçimi popup ile yönetilir. Faaliyet kategorisi en fazla {MAX_COMPANY_CATEGORY_COUNT} adet seçilebilir. Hedef kategorilerde {includedTargetCategoryLimit} adet temel limite dahildir; daha fazlası ödeme tutarına eklenir.
                  </div>
                </div>
              ) : null}
              {error && <div className="obp-error">{error}</div>}
              <div className="obp-actions">
                <button type="button" className="obp-btn-secondary" onClick={() => setStep("tenant_type")}>← Geri</button>
                <button type="submit" className="obp-btn-primary" disabled={submitting}>
                  Plan Seçimine Devam Et →
                </button>
              </div>
            </form>
          )}

          {step === "payment" && (
            <div>
              <h2 className="obp-step-title">Ödeme adımı</h2>
              <p className="obp-step-desc">Seçilen plan ücretli olduğu için kayıt öncesi ödeme işlemi zorunludur.</p>
              <div className="obp-prominent-box">
                <div><strong>Plan:</strong> {selectedPlanObj?.name}</div>
                <div><strong>Plan ucreti:</strong> {selectedPlanPrice.toLocaleString("tr-TR")} {selectedPlanCurrency} / ay</div>
                <div><strong>Ek hedef kategori ucreti:</strong> {extraTargetCategoryFee.toLocaleString("tr-TR")} {extraTargetCategorySlotCurrency}</div>
                <div><strong>Toplam:</strong> {totalPaymentAmount.toLocaleString("tr-TR")} {selectedPlanCurrency}</div>
              </div>

              <label className="obp-label">
                Ödeme yontemi
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className="obp-select" aria-label="Ödeme yontemi">
                  {paymentProviders.length === 0 ? <option value="bank_transfer">Havale / EFT</option> : null}
                  {paymentProviders.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </label>

              {selectedProvider === "bank_transfer" ? (
                <div className="obp-prominent-box">
                  <div><strong>EFT / Havale iş akışı:</strong> Dekont yüklendikten sonra ödeme super admin ekibi tarafından doğrulanır, ardından üyelik aktivasyon onayı verilir.</div>
                  {bankTransferInstructions ? (
                    <div className="obp-bank-box">
                      <div><strong>Banka:</strong> {bankTransferInstructions.bank_name || "-"}</div>
                      <div><strong>Hesap adi:</strong> {bankTransferInstructions.account_name || "-"}</div>
                      <div className="obp-bank-row">
                        <span><strong>IBAN:</strong> {bankTransferInstructions.iban || "-"}</span>
                        <button type="button" className="obp-copy-btn" onClick={() => void copyToClipboard(bankTransferInstructions.iban || "", "IBAN")}>IBAN Kopyala</button>
                      </div>
                      <div className="obp-bank-row">
                        <span><strong>Açıklama / Referans:</strong> {bankTransferInstructions.reference || "-"}</span>
                        <button type="button" className="obp-copy-btn" onClick={() => void copyToClipboard(bankTransferInstructions.reference || "", "Referans")}>Referansi Kopyala</button>
                      </div>
                      <div><strong>Gönderilecek tutar:</strong> {bankTransferInstructions.amount || totalPaymentAmount} {bankTransferInstructions.currency || selectedPlanCurrency}</div>
                    </div>
                  ) : (
                    <div className="obp-bank-missing">Ödeme başlatıldığında banka hesap bilgileri burada görünecek.</div>
                  )}
                  {copyFeedback ? <div className="obp-copy-feedback">{copyFeedback}</div> : null}
                  <label className="obp-label obp-label--mt">
                    Dekont dosyasi
                    <input type="file" accept="application/pdf,image/*" onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)} className="obp-input" aria-label="Dekont dosyasi" />
                  </label>
                  <label className="obp-label obp-label--mt">
                    Referans / aciklama
                    <textarea value={paymentReceiptNote} onChange={(e) => setPaymentReceiptNote(e.target.value)} rows={3} className="obp-textarea" placeholder="Gönderen hesap adı, EFT referansı veya not" aria-label="Referans / aciklama" />
                  </label>
                </div>
              ) : null}

              {paymentNote ? <div className="obp-success">{paymentNote}</div> : null}
              {error && <div className="obp-error">{error}</div>}

              <div className="obp-actions">
                <button type="button" className="obp-btn-secondary" onClick={() => setStep("plan")}>← Geri</button>
                <button type="button" className="obp-btn-primary" onClick={handlePaymentAndComplete} disabled={paymentLoading || submitting}>
                  {paymentLoading || submitting ? "İşleniyor..." : "Ödemeyi Başlat ve Kaydı Tamamla"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && doneData && (
            <div className="obp-done-section">
              <div className="obp-done-emoji">🎉</div>
              <h2 className="obp-step-title obp-step-title--center">Kaydınız alındı!</h2>
              <p className="obp-done-msg">{doneData.message}</p>
              <div className="obp-done-box">
                <div><strong>Hesap:</strong> {doneData.admin_email}</div>
                <div className="obp-done-status">
                  {doneData.payment_verified
                    ? "✅ Ödeme adımı doğrulandı."
                    : doneData.payment_transaction_id
                      ? "⏳ Ödeme kaydı alındı. Dekont veya işlem sonucu operasyon ekibi tarafından doğrulandıktan sonra aktivasyon ilerleyecek."
                      : "ℹ️ Bu plan için ödeme adımı gerekmiyor."}
                </div>
                <div className="obp-done-status">
                  {doneData.invitation_sent ? "✅ Aktivasyon e-postası gönderildi. Gelen kutunuzu kontrol edin." : "⏳ Aktivasyon bağlantısı yakında iletilecektir."}
                </div>
                {doneData.payment_transaction_id ? <div className="obp-done-status"><strong>Ödeme işlem no:</strong> {doneData.payment_transaction_id}</div> : null}
              </div>
              <a href="/login" className="obp-link-btn">Giriş sayfasına git →</a>
            </div>
          )}
        </div>
      </div>
      {activeCategoryModal ? (
        <div className="obp-modal-overlay" onClick={() => setActiveCategoryModal(null)}>
          <div className="obp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="obp-modal-header">
              <div>
                <div className="obp-modal-title">{activeCategoryModal === "offered" ? "Faaliyet Kategorisi Seç" : "Hedef Kategori Seç"}</div>
                <div className="obp-modal-desc">
                  {activeCategoryModal === "offered"
                    ? `En fazla ${MAX_COMPANY_CATEGORY_COUNT} faaliyet kategorisi seçilebilir. En az 1 kategori zorunludur.`
                    : `${includedTargetCategoryLimit} hedef kategori dahil. Fazlası kategori başına ${extraTargetCategorySlotPrice.toLocaleString("tr-TR")} ${extraTargetCategorySlotCurrency} eklenir.`}
                </div>
              </div>
              <button type="button" className="obp-modal-close" onClick={() => setActiveCategoryModal(null)}>Kapat</button>
            </div>
            <div className="obp-modal-chips">
              {COMPANY_CATEGORY_OPTIONS.map((item) => {
                const isOffered = activeCategoryModal === "offered";
                const active = isOffered ? selectedCategories.includes(item) : selectedTargetCategories.includes(item);
                const chipVariant = active ? (isOffered ? "obp-modal-chip--active-offered" : "obp-modal-chip--active-target") : "";
                return (
                  <button
                    key={`${activeCategoryModal}-${item}`}
                    type="button"
                    onClick={() => {
                      setError(null);
                      if (isOffered) {
                        toggleLimitedCategorySelection(item, selectedCategories, setSelectedCategories, MAX_COMPANY_CATEGORY_COUNT, `En fazla ${MAX_COMPANY_CATEGORY_COUNT} faaliyet kategorisi seçebilirsiniz.`);
                        return;
                      }
                      toggleCategorySelection(item, setSelectedTargetCategories);
                    }}
                    className={`obp-modal-chip ${chipVariant}`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <label className="obp-label obp-label--mt">
              {activeCategoryModal === "offered" ? "Listede yoksa yeni faaliyet kategorileri" : "Listede yoksa yeni hedef kategorileri"}
              <textarea
                value={activeCategoryModal === "offered" ? customCategoriesText : customTargetCategoriesText}
                onChange={(e) => activeCategoryModal === "offered" ? setCustomCategoriesText(e.target.value) : setCustomTargetCategoriesText(e.target.value)}
                rows={3}
                className="obp-textarea"
                placeholder={activeCategoryModal === "offered" ? "Kategori adlarını virgülle yazın" : "Hedef kategori adlarını virgülle yazın"}
                aria-label={activeCategoryModal === "offered" ? "Yeni faaliyet kategorileri" : "Yeni hedef kategorileri"}
              />
            </label>
            <div className="obp-modal-footer">
              <div className="obp-selection-meta">
                {activeCategoryModal === "offered"
                  ? `${selectedCategories.length} / ${MAX_COMPANY_CATEGORY_COUNT} kategori seçildi`
                  : `${totalTargetCategoryCount} hedef kategori seçildi • ${extraTargetCategoryCount} adet ücretli ek slot`}
              </div>
              <button type="button" className="obp-btn-primary" onClick={() => setActiveCategoryModal(null)}>Seçimi Kaydet</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function renderPrice(plan: Plan): string {
  const amount = Number(plan.price_monthly || 0);
  if (!amount || amount <= 0) {
    return "Kuruma Özel Teklif";
  }
  return `${amount.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay`;
}
