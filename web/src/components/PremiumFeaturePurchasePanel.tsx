import { useEffect, useMemo, useState } from "react";
import {
  getPaymentProviders,
  getPremiumFeatures,
  getPaymentTransaction,
  initiatePremiumFeaturePayment,
  initiateSubscriptionAddonPayment,
  uploadPaymentReceipt,
  verifyPaymentTransaction,
  type PaymentProviderItem,
  type PremiumFeatureCatalogItem,
  type SubscriptionAddonCatalogItem,
} from "../services/payment.service";

type TenantOption = {
  id: number;
  name: string;
  contactEmail?: string | null;
};

interface PremiumFeaturePurchasePanelProps {
  tenants: TenantOption[];
  defaultTenantId?: number | null;
  buyerName: string;
  buyerEmail: string;
  allowAdminVerification?: boolean;
  addonCatalog?: SubscriptionAddonCatalogItem[];
}

function formatPrice(value?: number | null): string {
  if (!value || value <= 0) return "Fiyatlandirma tanimsiz";
  return `${Number(value).toLocaleString("tr-TR")} TRY / ay`;
}

export default function PremiumFeaturePurchasePanel({
  tenants,
  defaultTenantId,
  buyerName,
  buyerEmail,
  allowAdminVerification = false,
  addonCatalog = [],
}: PremiumFeaturePurchasePanelProps) {
  const [providers, setProviders] = useState<PaymentProviderItem[]>([]);
  const [features, setFeatures] = useState<PremiumFeatureCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<number>(defaultTenantId && tenants.some((item) => item.id === defaultTenantId) ? defaultTenantId : tenants[0]?.id || 0);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number>(0);
  const [purchaseMode, setPurchaseMode] = useState<"premium_feature" | "subscription_addon">("premium_feature");
  const [selectedAddonCode, setSelectedAddonCode] = useState<string>(addonCatalog[0]?.code || "");
  const [selectedAddonQuantity, setSelectedAddonQuantity] = useState<number>(1);
  const [selectedProvider, setSelectedProvider] = useState("bank_transfer");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<{
    id: number;
    provider: string;
    redirectUrl?: string | null;
    instructions?: {
      bank_name?: string;
      iban?: string;
      account_name?: string;
      reference?: string;
      amount?: string;
      currency?: string;
    } | null;
  } | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getPaymentProviders(), getPremiumFeatures("strategic_partner")])
      .then(([providerRows, featureRows]) => {
        if (!mounted) return;
        setProviders(providerRows.filter((item) => item.ready || item.code === "bank_transfer"));
        setFeatures(featureRows);
        const firstFeature = featureRows.find((item) => Number(item.monthly_price || 0) > 0) || featureRows[0];
        if (firstFeature) {
          setSelectedFeatureId(firstFeature.id);
        }
        if (providerRows.some((item) => item.code === "bank_transfer")) {
          setSelectedProvider("bank_transfer");
        } else if (providerRows[0]) {
          setSelectedProvider(providerRows[0].code);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setError("Premium feature katalogu veya odeme saglayicilari yuklenemedi.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedAddonCode && addonCatalog[0]) {
      setSelectedAddonCode(addonCatalog[0].code);
    }
  }, [addonCatalog, selectedAddonCode]);

  useEffect(() => {
    if (!selectedTenantId && tenants[0]) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [selectedTenantId, tenants]);

  const selectedFeature = useMemo(
    () => features.find((item) => item.id === selectedFeatureId) || null,
    [features, selectedFeatureId],
  );

  const selectedTenant = useMemo(
    () => tenants.find((item) => item.id === selectedTenantId) || null,
    [selectedTenantId, tenants],
  );

  const selectedAddon = useMemo(
    () => addonCatalog.find((item) => item.code === selectedAddonCode) || null,
    [addonCatalog, selectedAddonCode],
  );

  async function handleStartPayment() {
    if (!selectedTenant) {
      setError("Lutfen stratejik partner secin.");
      return;
    }
    const amount = purchaseMode === "premium_feature"
      ? Number(selectedFeature?.monthly_price || 0)
      : Number(selectedAddon?.price_monthly || 0) * Math.max(selectedAddonQuantity, 1);
    if (amount <= 0) {
      setError(purchaseMode === "premium_feature"
        ? "Secilen premium feature icin gecerli bir aylik fiyat tanimli degil."
        : "Secilen add-on icin gecerli bir fiyat tanimli degil.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = purchaseMode === "premium_feature" && selectedFeature
        ? await initiatePremiumFeaturePayment({
          tenant_id: selectedTenant.id,
          premium_feature_id: selectedFeature.id,
          provider: selectedProvider,
          amount,
          buyer_email: selectedTenant.contactEmail || buyerEmail,
          buyer_name: buyerName,
          description: `${selectedTenant.name} icin ${selectedFeature.name} premium ozelligi`,
        })
        : await initiateSubscriptionAddonPayment({
          tenant_id: selectedTenant.id,
          addon_code: selectedAddon?.code || "",
          addon_name: selectedAddon?.name || "",
          provider: selectedProvider,
          amount,
          quantity: Math.max(selectedAddonQuantity, 1),
          buyer_email: selectedTenant.contactEmail || buyerEmail,
          buyer_name: buyerName,
          description: `${selectedTenant.name} icin ${selectedAddon?.name || "add-on"} kapasite alimi`,
        });
      setLastTransaction({
        id: Number(result.transaction_id),
        provider: result.provider,
        redirectUrl: result.redirect_url,
        instructions: result.instructions,
      });
      setReceiptFile(null);
      setReceiptNote("");
      if (result.redirect_url) {
        window.open(String(result.redirect_url), "_blank", "noopener,noreferrer");
        setMessage("Odeme oturumu yeni sekmede acildi. Saglayici sonucu webhook ile islenecek.");
      } else {
        setMessage("Odeme islemi olusturuldu. Banka referansi ile manuel tahsilat baslatilabilir.");
      }
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Odeme baslatilamadi.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadReceipt() {
    if (!lastTransaction?.id || !receiptFile) {
      setError("Once islem olusturun ve dekont dosyasi secin.");
      return;
    }
    setReceiptBusy(true);
    setError(null);
    setMessage(null);
    try {
      await uploadPaymentReceipt(lastTransaction.id, receiptFile, receiptNote);
      const refreshed = await getPaymentTransaction(lastTransaction.id);
      setLastTransaction((prev) => prev ? {
        ...prev,
        instructions: prev.instructions,
      } : prev);
      setMessage(`Dekont yuklendi. Islem durumu: ${refreshed.status}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dekont yuklenemedi.");
    } finally {
      setReceiptBusy(false);
    }
  }

  async function handleVerifyPayment() {
    if (!lastTransaction?.id) {
      setError("Dogrulanacak odeme islemi bulunamadi.");
      return;
    }
    setVerifyBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await verifyPaymentTransaction(lastTransaction.id);
      setMessage(
        purchaseMode === "premium_feature"
          ? `Odeme dogrulandi. Aktiflestirilen premium feature sayisi: ${result.activated_feature_count}`
          : `Odeme dogrulandi. Aktiflestirilen add-on sayisi: ${result.activated_addon_count}`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Odeme dogrulanamadi.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div style={{ borderRadius: 20, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 48%, #f8fafc 100%)", padding: 18, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#7c3aed" }}>Premium Satin Alma</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Gercek odeme baslatma paneli</div>
        <div style={{ marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
          Secilen stratejik partner icin premium feature veya kapasite add-on odemesini baslatir. Basarili webhook sonrasinda hak otomatik aktiflesir.
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Premium katalog yukleniyor...</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "premium_feature", label: "Premium Feature" },
              { key: "subscription_addon", label: "Kapasite Add-on" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPurchaseMode(item.key as "premium_feature" | "subscription_addon")}
                style={{ borderRadius: 999, border: purchaseMode === item.key ? "1px solid #7c3aed" : "1px solid #cbd5e1", background: purchaseMode === item.key ? "#f3e8ff" : "#fff", color: purchaseMode === item.key ? "#6d28d9" : "#334155", fontWeight: 800, padding: "8px 12px", cursor: "pointer" }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700, fontSize: 13 }}>
              Stratejik Partner
              <select value={selectedTenantId || ""} onChange={(event) => setSelectedTenantId(Number(event.target.value))} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id} aria-label={tenant.name}>#{tenant.id}</option>
                ))}
              </select>
            </label>

            {purchaseMode === "premium_feature" ? (
              <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700, fontSize: 13 }}>
                Premium Feature
                <select value={selectedFeatureId || ""} onChange={(event) => setSelectedFeatureId(Number(event.target.value))} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                  {features.map((feature) => (
                    <option key={feature.id} value={feature.id}>{feature.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700, fontSize: 13 }}>
                  Kapasite Add-on
                  <select value={selectedAddonCode} onChange={(event) => setSelectedAddonCode(event.target.value)} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                    {addonCatalog.map((addon) => (
                      <option key={addon.code} value={addon.code}>{addon.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700, fontSize: 13 }}>
                  Adet
                  <input type="number" min={1} value={selectedAddonQuantity} onChange={(event) => setSelectedAddonQuantity(Math.max(Number(event.target.value) || 1, 1))} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }} />
                </label>
              </>
            )}

            <label style={{ display: "grid", gap: 6, color: "#334155", fontWeight: 700, fontSize: 13 }}>
              Odeme Saglayicisi
              <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", background: "#fff" }}>
                {providers.map((provider) => (
                  <option key={provider.code} value={provider.code}>{provider.name}</option>
                ))}
              </select>
            </label>
          </div>

          {purchaseMode === "premium_feature" && selectedFeature ? (
            <div style={{ borderRadius: 16, border: "1px solid #ddd6fe", background: "#faf5ff", padding: 14, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{selectedFeature.name}</div>
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", background: "#ede9fe", color: "#6d28d9", fontWeight: 700, fontSize: 12 }}>
                  {formatPrice(selectedFeature.monthly_price)}
                </span>
              </div>
              <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.7 }}>{selectedFeature.description || "Aciklama bulunmuyor."}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Hedef tenant: #{selectedTenant?.id || "-"} • Alici e-posta: {selectedTenant?.contactEmail || buyerEmail}
              </div>
            </div>
          ) : null}

          {purchaseMode === "subscription_addon" && selectedAddon ? (
            <div style={{ borderRadius: 16, border: "1px solid #fed7aa", background: "#fff7ed", padding: 14, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{selectedAddon.name}</div>
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", background: "#ffedd5", color: "#9a3412", fontWeight: 700, fontSize: 12 }}>
                  {formatPrice((Number(selectedAddon.price_monthly || 0) || 0) * Math.max(selectedAddonQuantity, 1))}
                </span>
              </div>
              <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.7 }}>{selectedAddon.description || "Aciklama bulunmuyor."}</div>
              <div style={{ color: "#7c2d12", fontSize: 12 }}>
                Her alim: {selectedAddon.increment || 1} {selectedAddon.unit || "adet"} ek kapasite • Secilen adet: {selectedAddonQuantity}
              </div>
              <div style={{ color: "#64748b", fontSize: 12 }}>
                Hedef tenant: #{selectedTenant?.id || "-"} • Alici e-posta: {selectedTenant?.contactEmail || buyerEmail}
              </div>
            </div>
          ) : null}

          {error ? <div style={{ borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", padding: 12 }}>{error}</div> : null}
          {message ? <div style={{ borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", padding: 12 }}>{message}</div> : null}

          {lastTransaction?.instructions ? (
            <div style={{ borderRadius: 16, border: "1px solid #fed7aa", background: "#fff7ed", padding: 14, display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 800, color: "#9a3412" }}>Banka Havalesi Talimati</div>
              <div style={{ color: "#7c2d12", fontSize: 13 }}>Islem No: {lastTransaction.id}</div>
              <div style={{ color: "#7c2d12", fontSize: 13 }}>Banka: {lastTransaction.instructions.bank_name || "-"}</div>
              <div style={{ color: "#7c2d12", fontSize: 13 }}>IBAN: {lastTransaction.instructions.iban || "-"}</div>
              <div style={{ color: "#7c2d12", fontSize: 13 }}>Referans: {lastTransaction.instructions.reference || "-"}</div>
            </div>
          ) : null}

          {lastTransaction?.id ? (
            <div style={{ borderRadius: 16, border: "1px solid #dbeafe", background: "#f8fbff", padding: 14, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Dekont ve Manuel Dogrulama</div>
              <div style={{ color: "#475569", fontSize: 13 }}>Islem No: {lastTransaction.id}</div>
              <input type="file" accept="application/pdf,image/*" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} />
              <textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} rows={3} style={{ borderRadius: 12, border: "1px solid #cbd5e1", padding: 10, resize: "vertical" }} placeholder="Dekont notu veya banka referansi" />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={handleUploadReceipt} disabled={receiptBusy || !receiptFile} style={{ borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, padding: "9px 14px", cursor: receiptBusy || !receiptFile ? "not-allowed" : "pointer" }}>
                  {receiptBusy ? "Dekont Yukleniyor..." : "Dekont Yukle"}
                </button>
                {allowAdminVerification ? (
                  <button type="button" onClick={handleVerifyPayment} disabled={verifyBusy} style={{ borderRadius: 10, border: "none", background: "#0f766e", color: "#fff", fontWeight: 700, padding: "9px 14px", cursor: verifyBusy ? "wait" : "pointer" }}>
                    {verifyBusy ? "Dogrulaniyor..." : "Odemeyi Dogrula ve Aktiflestir"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Webhook basarisinda aktivasyon otomatik islenir. Manuel saglayicilarda banka referansi transaction kaydina baglidir.
            </div>
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={submitting || !selectedTenant || (purchaseMode === "premium_feature" ? !selectedFeature : !selectedAddon)}
              style={{ borderRadius: 12, border: "none", background: submitting ? "#a78bfa" : "#7c3aed", color: "#fff", fontWeight: 800, padding: "10px 16px", cursor: submitting ? "wait" : "pointer" }}
            >
              {submitting ? "Odeme Baslatiliyor..." : purchaseMode === "premium_feature" ? "Premium Satin Alimini Baslat" : "Add-on Satin Alimini Baslat"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}