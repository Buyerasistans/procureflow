// FILE: web/src/pages/OnboardingPage.tsx
import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import PublicBrandLogo from "../components/PublicBrandLogo";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";

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
  color: string;
  bgColor: string;
}

const TENANT_TYPES: TenantTypeOption[] = [
  {
    type: "strategic_partner",
    title: "Stratejik Partnerlik",
    description: "Kurumsal satin alma ekibi - Tedarikcileri yonetin, teklif alin",
    color: "#4f46e5",
    bgColor: "#eef2ff",
  },
  {
    type: "supplier",
    title: "Tedarikci",
    description: "Teklif sunun, musteri bulun, daha fazla is kazanin",
    color: "#0891b2",
    bgColor: "#ecf0ff",
  },
];

const CATEGORY_HELP_COPY: Record<TenantType, { title: string; detail: string }> = {
  strategic_partner: {
    title: "Kategori bilgisi supplier planlamasi icin kullanilir",
    detail:
      "Sectiginiz faaliyet alani onboarding sonrasinda Stratejik Partner Yonetimi ekraninda supplier kapsami ile birlikte izlenir. Boylece ilgili kategoride hazir tedarikci olup olmadigi ve hangi alanlarda ek supplier devreye alma gerektigi ilk gunden gorulur.",
  },
  supplier: {
    title: "Kategori bilgisi gorunurluk ve davet kalitesi icin kullanilir",
    detail:
      "Sectiginiz uzmanlik alani sizi yalnizca profil etiketine donusturmez. Bu bilgi; ilgili RFQ akislarinda daha dogru gorunurluk, daha isabetli davet ve admin tarafinda kategori bazli supplier kapsami takibi icin kullanilir.",
  },
};

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
          throw new Error(data?.detail ?? "Banka bilgileri alinamadi.");
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
      throw new Error("Sunucu yaniti ayrıştırılamadi.");
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
        throw new Error((data as { detail?: string } | null)?.detail ?? "Basvuru durumu alinamadi.");
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
      setError(err instanceof Error ? err.message : "Basvuru durumu alinamadi.");
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
      setCopyFeedback(`${label} bulunamadi.`);
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
      setError("Guncellenecek odeme islemi bulunamadi.");
      return;
    }
    if (!paymentReceiptFile) {
      setError("Lutfen yeni dekont dosyasini secin.");
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
        throw new Error(data?.detail ?? "Dekont guncellenemedi.");
      }
      setPaymentNote("Dekont yeniden yuklendi. Operasyon ekibi guncel kaniti inceleyecek.");
      setPaymentReceiptFile(null);
      setPaymentReceiptNote("");
      await loadStatusLookup();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dekont guncellenemedi.");
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
      throw new Error((data as { detail?: string } | null)?.detail ?? "Kayit sirasinda bir hata olustu.");
    }
    setDoneData(data);
    setStep("done");
  }

  function handleDetailsContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!legalName.trim() || !fullName.trim() || !email.trim() || !phone.trim()) {
      setError("Lutfen zorunlu alanlari doldurun.");
      return;
    }
    if (selectedCategories.length < 1) {
      setError("En az 1 faaliyet kategorisi secmelisiniz.");
      return;
    }

    setStep("plan");
  }

  async function handlePlanContinue() {
    setError(null);
    if (!selectedPlan) {
      setError("Lutfen bir plan secin.");
      return;
    }
    if (selectedPlanNeedsSalesContact) {
      setError("Bu plan kuruma ozel oldugu icin self-serve kayitla tamamlanamaz. Lutfen satis ekibiyle iletisime gecin.");
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
      setError(err instanceof Error ? err.message : "Sunucuya baglanilamadi. Lutfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaymentAndComplete() {
    setError(null);

    if (!selectedPlanObj || totalPaymentAmount <= 0) {
      setError("Odeme gerektiren bir plan secmelisiniz.");
      return;
    }

    if (!email.trim() || !fullName.trim() || !phone.trim() || selectedCategories.length < 1) {
      setError("Odeme adimindan once hesap bilgilerini doldurun.");
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
        throw new Error((paymentData as { detail?: string } | null)?.detail ?? "Odeme baslatilamadi.");
      }

      const txnId = Number(paymentData?.transaction_id);
      if (!txnId) {
        throw new Error("Odeme islemi olusturulamadi.");
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
          throw new Error(receiptData?.detail ?? "Dekont yuklenemedi.");
        }
      }

      if (paymentData?.redirect_url) {
        window.open(String(paymentData.redirect_url), "_blank", "noopener,noreferrer");
        setPaymentNote("Odeme penceresi yeni sekmede acildi. Odeme adimini tamamlayip geri donun.");
      } else {
        setPaymentNote("Odeme islemi olusturuldu. Kayit adimina devam ediliyor.");
      }

      setSubmitting(true);
      await submitRegistration(selectedPlanObj.code, txnId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odeme adimi basarisiz oldu.");
    } finally {
      setPaymentLoading(false);
      setSubmitting(false);
    }
  }

  const navVariant = selectedTenantType === "supplier" ? "supplier" : "strategic";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #eef2ff 0%, #f0fdf4 100%)" }}>
      <NavBar variant={navVariant} activePath="/onboarding" />
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.header}>
            <PublicBrandLogo height={44} maxWidth={220} />
            <div style={styles.subtitle}>Tedarik sureclerinizi dijitallestirin</div>
          </div>

          {trackingToken ? (
            <div style={{ ...styles.prominentInfoBox, marginBottom: 18, borderColor: "#93c5fd", background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" }}>
              <div style={{ fontWeight: 800, color: "#1d4ed8", marginBottom: 6 }}>Basvuru Takibi</div>
              {statusLookupLoading ? (
                <div>Basvuru durumu yukleniyor...</div>
              ) : statusLookup ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div><strong>Basvuru:</strong> {statusLookup.brand_name || statusLookup.legal_name}</div>
                  <div><strong>Durum:</strong> {statusLookup.onboarding_approval_status} / {statusLookup.onboarding_payment_status}</div>
                  {statusLookup.tracking_token_expires_at ? <div><strong>Takip linki son gecerlilik:</strong> {new Date(statusLookup.tracking_token_expires_at).toLocaleString("tr-TR")}</div> : null}
                  {statusLookup.onboarding_activation_notes ? <div><strong>Operasyon notu:</strong> {statusLookup.onboarding_activation_notes}</div> : null}
                  {statusLookup.can_resubmit_receipt ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                      <div style={{ color: "#1e3a8a" }}>Yeni dekont veya aciklama yukleyerek basvurunuzu guncelleyebilirsiniz.</div>
                      <label style={styles.label}>
                        Yeni dekont dosyasi
                        <input type="file" accept="application/pdf,image/*" onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)} style={styles.input} />
                      </label>
                      <label style={styles.label}>
                        Guncel aciklama
                        <textarea value={paymentReceiptNote} onChange={(e) => setPaymentReceiptNote(e.target.value)} rows={3} style={{ ...styles.input, resize: "vertical" }} placeholder="Yeni dekont aciklamasi veya banka referansi" />
                      </label>
                      <button type="button" style={styles.btnPrimary} disabled={statusActionLoading} onClick={() => void handleResubmitReceipt()}>
                        {statusActionLoading ? "Guncelleniyor..." : "Dekontu Yeniden Yukle"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>Basvuru kaydi bulunamadi.</div>
              )}
            </div>
          ) : null}

          <div style={styles.steps}>
            {(["tenant_type", "details", "plan", "payment", "done"] as WizardStep[]).map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    ...styles.stepDot,
                    background: step === s ? "#4f46e5" : i < ["tenant_type", "details", "plan", "payment", "done"].indexOf(step) ? "#6ee7b7" : "#e5e7eb",
                    color: step === s || i < ["tenant_type", "details", "plan", "payment", "done"].indexOf(step) ? "#fff" : "#9ca3af",
                  }}
                >
                  {i + 1}
                </div>
                <span style={{ fontSize: 12, color: step === s ? "#4f46e5" : "#6b7280", fontWeight: step === s ? 600 : 400 }}>
                  {s === "tenant_type" ? "Siz Kimsiniz?" : s === "details" ? "Hesap Bilgileri" : s === "plan" ? "Plan Secimi" : s === "payment" ? "Odeme" : "Tamamlandi"}
                </span>
                {i < 4 && <div style={styles.stepLine} />}
              </div>
            ))}
          </div>

          {step === "tenant_type" && (
            <div>
              <h2 style={styles.stepTitle}>Siz kimsiniz?</h2>
              <p style={styles.stepDesc}>Lutfen isletme tipinizi secin.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 20 }}>
                {TENANT_TYPES.map((type) => (
                  <div
                    key={type.type}
                    onClick={() => {
                      setSelectedTenantType(type.type);
                      setSelectedPlan("");
                      setError(null);
                      setStep("details");
                    }}
                    style={{
                      ...styles.planCard,
                      border: "2px solid #e5e7eb",
                      cursor: "pointer",
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: type.bgColor,
                          border: `2px solid ${type.color}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: type.color,
                          fontWeight: 700,
                          fontSize: 20,
                        }}
                      >
                        {type.type === "strategic_partner" ? "🏢" : "🏭"}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 17, color: "#111827" }}>{type.title}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{type.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "plan" && (
            <div>
              <h2 style={styles.stepTitle}>Paketinizi secin</h2>
              <p style={styles.stepDesc}>Fiyat bilgisi super admin tarafindan yonetilir ve secime gore odeme adimi zorunlu tutulur.</p>
              {plansLoading ? (
                <div style={styles.loading}>Paketler yukleniyor...</div>
              ) : (
                <div style={styles.planGrid}>
                  {plans.map((plan) => (
                    <div
                      key={plan.code}
                      onClick={() => {
                        setSelectedPlan(plan.code);
                        setError(null);
                      }}
                      style={{
                        ...styles.planCard,
                        border: selectedPlan === plan.code ? "2px solid #4f46e5" : "2px solid #e5e7eb",
                        background: selectedPlan === plan.code ? "#eef2ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 17 }}>{plan.name}</span>
                        {plan.is_default ? <span style={styles.badge}>Onerilen</span> : null}
                      </div>
                      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{plan.description}</p>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                        {renderPrice(plan)}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                        {plan.modules.slice(0, 4).map((m) => (
                          <div key={m.code} style={{ fontSize: 12, color: "#374151", display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ color: "#10b981" }}>✓</span>
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
              {error && <div style={styles.error}>{error}</div>}
              <div style={styles.actions}>
                {!paramTenantType ? (
                  <button type="button" style={styles.btnSecondary} onClick={() => setStep("tenant_type")}>← Geri</button>
                ) : null}
                <button
                  style={styles.btnPrimary}
                  disabled={!selectedPlan || selectedPlanNeedsSalesContact || submitting}
                  onClick={() => {
                    void handlePlanContinue();
                  }}
                >
                  {submitting ? "Kaydediliyor..." : "Devam Et →"}
                </button>
              </div>
              {selectedPlanNeedsSalesContact ? (
                <div style={styles.infoBox}>
                  Bu plan kuruma ozel oldugu icin self-serve akista devam edilemez. Lutfen <a href="/demo?audience=strategic">satis ekibiyle gorusun</a>.
                </div>
              ) : null}
            </div>
          )}

          {step === "details" && (
            <form data-telemetry-name="onboarding-register-form" onSubmit={handleDetailsContinue}>
              <h2 style={styles.stepTitle}>Firma ve hesap bilgileri</h2>
              <p style={styles.stepDesc}>Sisteme giris yapacak ilk yonetici hesabini olusturun.</p>
              {selectedPlanObj && (
                <div style={styles.prominentInfoBox}>
                  <strong>Secilen plan:</strong> {selectedPlanObj.name} - {renderPrice(selectedPlanObj)}
                </div>
              )}
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Firma ticari unvani *
                  <input style={styles.input} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Ornek A.S." required />
                </label>
                <label style={styles.label}>
                  Marka adi
                  <input style={styles.input} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Opsiyonel" />
                </label>
                {selectedTenantType ? (
                  <div style={{ ...styles.label, gridColumn: "1 / -1" }}>
                    <div style={styles.selectionHeaderRow}>
                      <span>Mevcut faaliyet kategorileri *</span>
                      <button type="button" style={styles.inlineSelectBtn} onClick={() => { setError(null); setActiveCategoryModal("offered"); }}>
                        Kategori Sec
                      </button>
                    </div>
                    <div style={styles.selectionSummaryBox}>
                      {selectedCategories.length > 0 ? selectedCategories.map((item) => (
                        <span key={`selected-offered-${item}`} style={styles.selectedChip}>{item}</span>
                      )) : <span style={styles.selectionEmpty}>En az 1 kategori secilmeli</span>}
                    </div>
                    <div style={styles.selectionMeta}>{selectedCategories.length} / {MAX_COMPANY_CATEGORY_COUNT} secildi</div>
                  </div>
                ) : null}
                {selectedTenantType ? (
                  <div style={{ ...styles.label, gridColumn: "1 / -1" }}>
                    <div style={styles.selectionHeaderRow}>
                      <span>Hedef ilgilenilen kategoriler</span>
                      <button type="button" style={styles.inlineSelectBtn} onClick={() => { setError(null); setActiveCategoryModal("target"); }}>
                        Hedef Kategori Sec
                      </button>
                    </div>
                    <div style={styles.selectionSummaryBox}>
                      {selectedTargetCategories.length > 0 ? selectedTargetCategories.map((item) => (
                        <span key={`selected-target-${item}`} style={{ ...styles.selectedChip, background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" }}>{item}</span>
                      )) : <span style={styles.selectionEmpty}>Varsayilan olarak {includedTargetCategoryLimit} hedef kategoriye kadar ucretsiz</span>}
                    </div>
                    <div style={styles.selectionMeta}>
                      {includedTargetCategoryLimit} hedef kategori dahil. Liste disi hedef kategori talepleri de bu limite dahildir; sonraki her kategori icin {extraTargetCategorySlotPrice.toLocaleString("tr-TR")} {extraTargetCategorySlotCurrency} eklenir.
                    </div>
                  </div>
                ) : null}
                <label style={styles.label}>
                  Yetkili adi soyadi *
                  <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ahmet Yilmaz" required />
                </label>
                <label style={styles.label}>
                  E-posta *
                  <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ahmet@sirket.com.tr" required />
                </label>
                <label style={styles.label}>
                  Telefon *
                  <input style={styles.input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" required />
                </label>
                <label style={styles.label}>
                  Takip Kodu
                  <input
                    style={styles.input}
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ornek: CH-Y5LHNUHI"
                  />
                </label>
              </div>
              {selectedTenantType ? (
                <div style={{ ...styles.prominentInfoBox, marginTop: 14, marginBottom: 0, borderColor: selectedTenantType === "supplier" ? "#7dd3fc" : "#a5b4fc", background: selectedTenantType === "supplier" ? "linear-gradient(135deg, #ecfeff 0%, #f0f9ff 100%)" : "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)" }}>
                  <strong>{CATEGORY_HELP_COPY[selectedTenantType].title}</strong>
                  <div style={{ marginTop: 6 }}>{CATEGORY_HELP_COPY[selectedTenantType].detail}</div>
                  <div style={{ marginTop: 8, color: "#475569" }}>
                    Kategori secimi popup ile yonetilir. Faaliyet kategorisi en fazla {MAX_COMPANY_CATEGORY_COUNT} adet secilebilir. Hedef kategorilerde {includedTargetCategoryLimit} adet temel limite dahildir; daha fazlasi odeme tutarina eklenir.
                  </div>
                </div>
              ) : null}
              {error && <div style={styles.error}>{error}</div>}
              <div style={styles.actions}>
                <button type="button" style={styles.btnSecondary} onClick={() => setStep("tenant_type")}>← Geri</button>
                <button type="submit" style={styles.btnPrimary} disabled={submitting}>
                  Plan Secimine Devam Et →
                </button>
              </div>
            </form>
          )}

          {step === "payment" && (
            <div>
              <h2 style={styles.stepTitle}>Odeme adimi</h2>
              <p style={styles.stepDesc}>Secilen plan ucretli oldugu icin kayit oncesi odeme islemi zorunludur.</p>
              <div style={styles.prominentInfoBox}>
                <div><strong>Plan:</strong> {selectedPlanObj?.name}</div>
                <div><strong>Plan ucreti:</strong> {selectedPlanPrice.toLocaleString("tr-TR")} {selectedPlanCurrency} / ay</div>
                <div><strong>Ek hedef kategori ucreti:</strong> {extraTargetCategoryFee.toLocaleString("tr-TR")} {extraTargetCategorySlotCurrency}</div>
                <div><strong>Toplam:</strong> {totalPaymentAmount.toLocaleString("tr-TR")} {selectedPlanCurrency}</div>
              </div>

              <label style={styles.label}>
                Odeme yontemi
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} style={styles.select}>
                  {paymentProviders.length === 0 ? <option value="bank_transfer">Havale / EFT</option> : null}
                  {paymentProviders.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </label>

              {selectedProvider === "bank_transfer" ? (
                <div style={styles.prominentInfoBox}>
                  <div><strong>EFT / Havale is akisi:</strong> Dekont yuklendikten sonra odeme super admin ekibi tarafindan dogrulanir, ardindan uyelik aktivasyon onayi verilir.</div>
                  {bankTransferInstructions ? (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "white", display: "grid", gap: 4 }}>
                      <div><strong>Banka:</strong> {bankTransferInstructions.bank_name || "-"}</div>
                      <div><strong>Hesap adi:</strong> {bankTransferInstructions.account_name || "-"}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span><strong>IBAN:</strong> {bankTransferInstructions.iban || "-"}</span>
                        <button type="button" style={styles.copyBtn} onClick={() => void copyToClipboard(bankTransferInstructions.iban || "", "IBAN")}>IBAN Kopyala</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <span><strong>Aciklama / Referans:</strong> {bankTransferInstructions.reference || "-"}</span>
                        <button type="button" style={styles.copyBtn} onClick={() => void copyToClipboard(bankTransferInstructions.reference || "", "Referans")}>Referansi Kopyala</button>
                      </div>
                      <div><strong>Gonderilecek tutar:</strong> {bankTransferInstructions.amount || totalPaymentAmount} {bankTransferInstructions.currency || selectedPlanCurrency}</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>Odeme baslatildiginda banka hesap bilgileri burada gorunecek.</div>
                  )}
                  {copyFeedback ? <div style={{ marginTop: 10, color: "#1d4ed8", fontSize: 12 }}>{copyFeedback}</div> : null}
                  <label style={{ ...styles.label, marginTop: 12 }}>
                    Dekont dosyasi
                    <input type="file" accept="application/pdf,image/*" onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)} style={styles.input} />
                  </label>
                  <label style={{ ...styles.label, marginTop: 12 }}>
                    Referans / aciklama
                    <textarea value={paymentReceiptNote} onChange={(e) => setPaymentReceiptNote(e.target.value)} rows={3} style={{ ...styles.input, resize: "vertical" }} placeholder="Gonderen hesap adi, EFT referansi veya not" />
                  </label>
                </div>
              ) : null}

              {paymentNote ? <div style={styles.success}>{paymentNote}</div> : null}
              {error && <div style={styles.error}>{error}</div>}

              <div style={styles.actions}>
                <button type="button" style={styles.btnSecondary} onClick={() => setStep("plan")}>← Geri</button>
                <button type="button" style={styles.btnPrimary} onClick={handlePaymentAndComplete} disabled={paymentLoading || submitting}>
                  {paymentLoading || submitting ? "Isleniyor..." : "Odemeyi Baslat ve Kaydi Tamamla"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && doneData && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h2 style={{ ...styles.stepTitle, textAlign: "center" }}>Kaydiniz alindi!</h2>
              <p style={{ color: "#6b7280", margin: "0 0 20px" }}>{doneData.message}</p>
              <div style={styles.doneBox}>
                <div><strong>Hesap:</strong> {doneData.admin_email}</div>
                <div style={{ marginTop: 6 }}>
                  {doneData.payment_verified
                    ? "✅ Odeme adimi dogrulandi."
                    : doneData.payment_transaction_id
                      ? "⏳ Odeme kaydi alindi. Dekont veya islem sonucu operasyon ekibi tarafindan dogrulandiktan sonra aktivasyon ilerleyecek."
                      : "ℹ️ Bu plan icin odeme adimi gerekmiyor."}
                </div>
                <div style={{ marginTop: 6 }}>
                  {doneData.invitation_sent ? "✅ Aktivasyon e-postasi gonderildi. Gelen kutunuzu kontrol edin." : "⏳ Aktivasyon baglantisi yakinda iletilecektir."}
                </div>
                {doneData.payment_transaction_id ? <div style={{ marginTop: 6 }}><strong>Odeme islem no:</strong> {doneData.payment_transaction_id}</div> : null}
              </div>
              <a href="/login" style={styles.linkBtn}>Giris sayfasina git →</a>
            </div>
          )}
        </div>
      </div>
      {activeCategoryModal ? (
        <div style={styles.modalOverlay} onClick={() => setActiveCategoryModal(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeaderRow}>
              <div>
                <div style={styles.modalTitle}>{activeCategoryModal === "offered" ? "Faaliyet Kategorisi Sec" : "Hedef Kategori Sec"}</div>
                <div style={styles.modalDesc}>
                  {activeCategoryModal === "offered"
                    ? `En fazla ${MAX_COMPANY_CATEGORY_COUNT} faaliyet kategorisi secilebilir. En az 1 kategori zorunludur.`
                    : `${includedTargetCategoryLimit} hedef kategori dahil. Fazlasi kategori basina ${extraTargetCategorySlotPrice.toLocaleString("tr-TR")} ${extraTargetCategorySlotCurrency} eklenir.`}
                </div>
              </div>
              <button type="button" style={styles.modalCloseBtn} onClick={() => setActiveCategoryModal(null)}>Kapat</button>
            </div>
            <div style={styles.modalChipGrid}>
              {COMPANY_CATEGORY_OPTIONS.map((item) => {
                const isOffered = activeCategoryModal === "offered";
                const active = isOffered ? selectedCategories.includes(item) : selectedTargetCategories.includes(item);
                return (
                  <button
                    key={`${activeCategoryModal}-${item}`}
                    type="button"
                    onClick={() => {
                      setError(null);
                      if (isOffered) {
                        toggleLimitedCategorySelection(item, selectedCategories, setSelectedCategories, MAX_COMPANY_CATEGORY_COUNT, `En fazla ${MAX_COMPANY_CATEGORY_COUNT} faaliyet kategorisi secebilirsiniz.`);
                        return;
                      }
                      toggleCategorySelection(item, setSelectedTargetCategories);
                    }}
                    style={{
                      ...styles.modalChip,
                      borderColor: active ? (isOffered ? "#0f766e" : "#4338ca") : "#cbd5e1",
                      background: active ? (isOffered ? "#ccfbf1" : "#e0e7ff") : "white",
                      color: active ? (isOffered ? "#115e59" : "#3730a3") : "#334155",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <label style={{ ...styles.label, marginTop: 16 }}>
              {activeCategoryModal === "offered" ? "Listede yoksa yeni faaliyet kategorileri" : "Listede yoksa yeni hedef kategorileri"}
              <textarea
                value={activeCategoryModal === "offered" ? customCategoriesText : customTargetCategoriesText}
                onChange={(e) => activeCategoryModal === "offered" ? setCustomCategoriesText(e.target.value) : setCustomTargetCategoriesText(e.target.value)}
                rows={3}
                style={{ ...styles.input, resize: "vertical" }}
                placeholder={activeCategoryModal === "offered" ? "Kategori adlarini virgulle yazin" : "Hedef kategori adlarini virgulle yazin"}
              />
            </label>
            <div style={styles.modalFooterRow}>
              <div style={styles.selectionMeta}>
                {activeCategoryModal === "offered"
                  ? `${selectedCategories.length} / ${MAX_COMPANY_CATEGORY_COUNT} kategori secildi`
                    : `${totalTargetCategoryCount} hedef kategori secildi • ${extraTargetCategoryCount} adet ucretli ek slot`}
              </div>
              <button type="button" style={styles.btnPrimary} onClick={() => setActiveCategoryModal(null)}>Secimi Kaydet</button>
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
    return "Kuruma Ozel Teklif";
  }
  return `${amount.toLocaleString("tr-TR")} ${plan.currency || "TRY"} / ay`;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 60px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 4px 32px rgba(0,0,0,0.10)",
    padding: "40px 48px",
    width: "100%",
    maxWidth: 760,
  },
  header: { textAlign: "center", marginBottom: 28 },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  steps: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 32, flexWrap: "wrap" },
  stepDot: { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 },
  stepLine: { width: 22, height: 2, background: "#e5e7eb" },
  stepTitle: { fontSize: 32, fontWeight: 700, color: "#111827", margin: "0 0 6px" },
  stepDesc: { fontSize: 14, color: "#6b7280", margin: "0 0 20px" },
  loading: { textAlign: "center", padding: 32, color: "#6b7280" },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 },
  planCard: { borderRadius: 10, padding: "16px 14px", transition: "border-color 0.15s" },
  badge: { background: "#4f46e5", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 },
  formGrid: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151", fontWeight: 500 },
  input: { border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", color: "#111827" },
  select: { border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", color: "#111827", marginBottom: 16 },
  selectionHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  inlineSelectBtn: { background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  selectionSummaryBox: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #dbe4ff", background: "#f8fafc", minHeight: 48, alignItems: "center" },
  selectedChip: { display: "inline-flex", alignItems: "center", padding: "7px 12px", borderRadius: 999, border: "1px solid #99f6e4", background: "#ecfeff", color: "#115e59", fontWeight: 700, fontSize: 12 },
  selectionEmpty: { color: "#64748b", fontSize: 12 },
  selectionMeta: { marginTop: 8, color: "#64748b", fontSize: 12 },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 },
  success: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 },
  infoBox: { background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", marginBottom: 14, color: "#334155", fontSize: 13 },
  prominentInfoBox: { background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)", border: "1px solid #cbd5e1", borderRadius: 14, padding: "14px 16px", marginBottom: 14, color: "#334155", fontSize: 13, boxShadow: "0 10px 28px rgba(79, 70, 229, 0.08)" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  btnPrimary: { background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnSecondary: { background: "transparent", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", fontWeight: 500, fontSize: 14, cursor: "pointer" },
  copyBtn: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 8, padding: "6px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  doneBox: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", textAlign: "left", marginBottom: 20, fontSize: 14 },
  linkBtn: { display: "inline-block", color: "#4f46e5", fontWeight: 600, fontSize: 14, textDecoration: "none" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 },
  modalCard: { width: "100%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)" },
  modalHeaderRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  modalTitle: { fontSize: 24, fontWeight: 800, color: "#0f172a" },
  modalDesc: { marginTop: 6, color: "#475569", fontSize: 13 },
  modalCloseBtn: { background: "transparent", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  modalChipGrid: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 },
  modalChip: { padding: "10px 14px", borderRadius: 999, border: "1px solid #cbd5e1", background: "white", color: "#334155", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  modalFooterRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 18, flexWrap: "wrap" },
};
