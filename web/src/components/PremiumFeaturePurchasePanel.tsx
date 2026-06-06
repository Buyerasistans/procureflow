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
import "./PremiumFeaturePurchasePanel.css";

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
  if (!value || value <= 0) return "Fiyatlandırma tanımsız";
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
  const [selectedTenantId, setSelectedTenantId] = useState<number>(
    defaultTenantId && tenants.some((item) => item.id === defaultTenantId) ? defaultTenantId : tenants[0]?.id || 0,
  );
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
        setError("Premium feature katalogu veya ödeme sağlayıcıları yüklenemedi.");
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
      setError("Lütfen stratejik partner seçin.");
      return;
    }

    const amount =
      purchaseMode === "premium_feature"
        ? Number(selectedFeature?.monthly_price || 0)
        : Number(selectedAddon?.price_monthly || 0) * Math.max(selectedAddonQuantity, 1);

    if (amount <= 0) {
      setError(
        purchaseMode === "premium_feature"
          ? "Seçilen premium feature için geçerli bir aylık fiyat tanımlı değil."
          : "Seçilen add-on için geçerli bir fiyat tanımlı değil.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result =
        purchaseMode === "premium_feature" && selectedFeature
          ? await initiatePremiumFeaturePayment({
              tenant_id: selectedTenant.id,
              premium_feature_id: selectedFeature.id,
              provider: selectedProvider,
              amount,
              buyer_email: selectedTenant.contactEmail || buyerEmail,
              buyer_name: buyerName,
              description: `${selectedTenant.name} için ${selectedFeature.name} premium özelliği`,
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
              description: `${selectedTenant.name} için ${selectedAddon?.name || "add-on"} kapasite alımı`,
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
        setMessage("Ödeme oturumu yeni sekmede açıldı. Sağlayıcı sonucu webhook ile işlenecek.");
      } else {
        setMessage("Ödeme işlemi oluşturuldu. Banka referansı ile manuel tahsilat başlatılabilir.");
      }
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Ödeme başlatılamadı.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadReceipt() {
    if (!lastTransaction?.id || !receiptFile) {
      setError("Önce işlem oluşturun ve dekont dosyası seçin.");
      return;
    }

    setReceiptBusy(true);
    setError(null);
    setMessage(null);

    try {
      await uploadPaymentReceipt(lastTransaction.id, receiptFile, receiptNote);
      const refreshed = await getPaymentTransaction(lastTransaction.id);
      setMessage(`Dekont yüklendi. İşlem durumu: ${refreshed.status}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dekont yüklenemedi.");
    } finally {
      setReceiptBusy(false);
    }
  }

  async function handleVerifyPayment() {
    if (!lastTransaction?.id) {
      setError("Doğrulanacak ödeme işlemi bulunamadı.");
      return;
    }

    setVerifyBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await verifyPaymentTransaction(lastTransaction.id);
      setMessage(
        purchaseMode === "premium_feature"
          ? `Ödeme doğrulandı. Aktifleştirilen premium feature sayısı: ${result.activated_feature_count}`
          : `Ödeme doğrulandı. Aktifleştirilen add-on sayısı: ${result.activated_addon_count}`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ödeme doğrulanamadı.");
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <div className="premium-feature-purchase-panel">
      <div className="premium-feature-purchase-panel__header">
        <div className="premium-feature-purchase-panel__eyebrow">Premium Satın Alma</div>
        <div className="premium-feature-purchase-panel__title">Gercek odeme baslatma paneli</div>
        <div className="premium-feature-purchase-panel__description">
          Seçilen stratejik partner için premium feature veya kapasite add-on ödemesini başlatır. Başarılı webhook sonrasında hak otomatik aktifleşir.
        </div>
      </div>

      {loading ? (
        <div className="premium-feature-purchase-panel__status">Premium katalog yükleniyor...</div>
      ) : (
        <>
          <div className="premium-feature-purchase-panel__mode-switch">
            {[
              { key: "premium_feature", label: "Premium Feature" },
              { key: "subscription_addon", label: "Kapasite Add-on" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPurchaseMode(item.key as "premium_feature" | "subscription_addon")}
                className={
                  purchaseMode === item.key
                    ? "premium-feature-purchase-panel__pill premium-feature-purchase-panel__pill--active"
                    : "premium-feature-purchase-panel__pill"
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="premium-feature-purchase-panel__grid">
            <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-tenant">
              Stratejik Partner
              <select
                id="premium-feature-purchase-panel-tenant"
                value={selectedTenantId || ""}
                onChange={(event) => setSelectedTenantId(Number(event.target.value))}
                className="premium-feature-purchase-panel__select"
                title="Stratejik Partner seçimi"
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id} aria-label={tenant.name}>
                    #{tenant.id}
                  </option>
                ))}
              </select>
            </label>

            {purchaseMode === "premium_feature" ? (
              <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-feature">
                Premium Feature
                <select
                  id="premium-feature-purchase-panel-feature"
                  value={selectedFeatureId || ""}
                  onChange={(event) => setSelectedFeatureId(Number(event.target.value))}
                  className="premium-feature-purchase-panel__select"
                  title="Premium feature seçimi"
                >
                  {features.map((feature) => (
                    <option key={feature.id} value={feature.id}>
                      {feature.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-addon">
                  Kapasite Add-on
                  <select
                    id="premium-feature-purchase-panel-addon"
                    value={selectedAddonCode}
                    onChange={(event) => setSelectedAddonCode(event.target.value)}
                    className="premium-feature-purchase-panel__select"
                    title="Add-on seçimi"
                  >
                    {addonCatalog.map((addon) => (
                      <option key={addon.code} value={addon.code}>
                        {addon.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-quantity">
                  Adet
                  <input
                    id="premium-feature-purchase-panel-quantity"
                    type="number"
                    min={1}
                    value={selectedAddonQuantity}
                    onChange={(event) =>
                      setSelectedAddonQuantity(Math.max(Number(event.target.value) || 1, 1))
                    }
                    className="premium-feature-purchase-panel__input"
                    title="Add-on adet seçimi"
                  />
                </label>
              </>
            )}

            <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-provider">
              Ödeme Sağlayıcısı
              <select
                id="premium-feature-purchase-panel-provider"
                value={selectedProvider}
                onChange={(event) => setSelectedProvider(event.target.value)}
                className="premium-feature-purchase-panel__select"
                title="Ödeme sağlayıcısı seçimi"
              >
                {providers.map((provider) => (
                  <option key={provider.code} value={provider.code}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {purchaseMode === "premium_feature" && selectedFeature ? (
            <div className="premium-feature-purchase-panel__card premium-feature-purchase-panel__card--premium">
              <div className="premium-feature-purchase-panel__card-head">
                <div className="premium-feature-purchase-panel__card-title">{selectedFeature.name}</div>
                <span className="premium-feature-purchase-panel__badge">
                  {formatPrice(selectedFeature.monthly_price)}
                </span>
              </div>
              <div className="premium-feature-purchase-panel__card-text">
                {selectedFeature.description || "Açıklama bulunmuyor."}
              </div>
              <div className="premium-feature-purchase-panel__meta">
                Hedef tenant: #{selectedTenant?.id || "-"} • Alıcı e-posta: {selectedTenant?.contactEmail || buyerEmail}
              </div>
            </div>
          ) : null}

          {purchaseMode === "subscription_addon" && selectedAddon ? (
            <div className="premium-feature-purchase-panel__card premium-feature-purchase-panel__card--addon">
              <div className="premium-feature-purchase-panel__card-head">
                <div className="premium-feature-purchase-panel__card-title">{selectedAddon.name}</div>
                <span className="premium-feature-purchase-panel__badge premium-feature-purchase-panel__badge--addon">
                  {formatPrice((Number(selectedAddon.price_monthly || 0) || 0) * Math.max(selectedAddonQuantity, 1))}
                </span>
              </div>
              <div className="premium-feature-purchase-panel__card-text">
                {selectedAddon.description || "Açıklama bulunmuyor."}
              </div>
              <div className="premium-feature-purchase-panel__meta premium-feature-purchase-panel__meta--addon">
                Her alım: {selectedAddon.increment || 1} {selectedAddon.unit || "adet"} ek kapasite • Seçilen adet: {selectedAddonQuantity}
              </div>
              <div className="premium-feature-purchase-panel__meta">
                Hedef tenant: #{selectedTenant?.id || "-"} • Alıcı e-posta: {selectedTenant?.contactEmail || buyerEmail}
              </div>
            </div>
          ) : null}

          {error ? <div className="premium-feature-purchase-panel__alert premium-feature-purchase-panel__alert--error">{error}</div> : null}
          {message ? <div className="premium-feature-purchase-panel__alert premium-feature-purchase-panel__alert--info">{message}</div> : null}

          {lastTransaction?.instructions ? (
            <div className="premium-feature-purchase-panel__card premium-feature-purchase-panel__card--bank">
              <div className="premium-feature-purchase-panel__card-title premium-feature-purchase-panel__card-title--bank">
                Banka Havalesi Talimatı
              </div>
              <div className="premium-feature-purchase-panel__meta">İşlem No: {lastTransaction.id}</div>
              <div className="premium-feature-purchase-panel__meta">Banka: {lastTransaction.instructions.bank_name || "-"}</div>
              <div className="premium-feature-purchase-panel__meta">IBAN: {lastTransaction.instructions.iban || "-"}</div>
              <div className="premium-feature-purchase-panel__meta">Referans: {lastTransaction.instructions.reference || "-"}</div>
            </div>
          ) : null}

          {lastTransaction?.id ? (
            <div className="premium-feature-purchase-panel__card premium-feature-purchase-panel__card--receipt">
              <div className="premium-feature-purchase-panel__card-title premium-feature-purchase-panel__card-title--receipt">
                Dekont ve Manuel Doğrulama
              </div>
              <div className="premium-feature-purchase-panel__meta">İşlem No: {lastTransaction.id}</div>

              <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-receipt">
                Dekont dosyası
                <input
                  id="premium-feature-purchase-panel-receipt"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] || null)}
                  className="premium-feature-purchase-panel__file-input"
                  title="Dekont dosyası seçimi"
                />
              </label>

              <label className="premium-feature-purchase-panel__field" htmlFor="premium-feature-purchase-panel-note">
                Dekont notu
                <textarea
                  id="premium-feature-purchase-panel-note"
                  value={receiptNote}
                  onChange={(event) => setReceiptNote(event.target.value)}
                  rows={3}
                  className="premium-feature-purchase-panel__textarea"
                  placeholder="Dekont notu veya banka referansı"
                  title="Dekont notu"
                />
              </label>

              <div className="premium-feature-purchase-panel__action-row">
                <button
                  type="button"
                  onClick={handleUploadReceipt}
                  disabled={receiptBusy || !receiptFile}
                  className="premium-feature-purchase-panel__button premium-feature-purchase-panel__button--secondary"
                >
                  {receiptBusy ? "Dekont Yükleniyor..." : "Dekont Yükle"}
                </button>
                {allowAdminVerification ? (
                  <button
                    type="button"
                    onClick={handleVerifyPayment}
                    disabled={verifyBusy}
                    className="premium-feature-purchase-panel__button premium-feature-purchase-panel__button--success"
                  >
                    {verifyBusy ? "Doğrulanıyor..." : "Ödemeyi Doğrula ve Aktifleştir"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="premium-feature-purchase-panel__footer">
            <div className="premium-feature-purchase-panel__footer-note">
              Webhook başarısında aktivasyon otomatik işlenir. Manuel sağlayıcılarda banka referansı transaction kaydına bağlıdır.
            </div>
            <button
              type="button"
              onClick={handleStartPayment}
              disabled={submitting || !selectedTenant || (purchaseMode === "premium_feature" ? !selectedFeature : !selectedAddon)}
              className="premium-feature-purchase-panel__button premium-feature-purchase-panel__button--primary"
            >
              {submitting
                ? "Ödeme Başlatılıyor..."
                : purchaseMode === "premium_feature"
                  ? "Premium Satın Alımını Başlat"
                  : "Add-on Satın Alımını Başlat"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
