// FILE: web/src/components/SettingsTab.tsx
import React, { useState, useEffect } from "react";
import { useSettings } from "../hooks/useSettings";
import { AdvancedSettingsTab } from "./AdvancedSettingsTab";
import { DemoDataTab } from "./DemoDataTab";
import PremiumFeaturePurchasePanel from "./PremiumFeaturePurchasePanel";
import type { SettingsUpdatePayload } from "../services/settings.service";
import { getQuotePriceRules, updateQuotePriceRules, type QuotePriceRules } from "../services/admin.service";
import { getMyTenantPremiumPurchaseContext, type TenantPremiumPurchaseContext } from "../services/payment.service";
import { useAuth } from "../hooks/useAuth";
import { canManageTenantIdentitySettings, getUserScopeType, isTenantOwnerUser } from "../auth/permissions";
import { PageHeader } from "../pages/admin/AdminTabContent";

type TabType = "basic" | "advanced" | "demo" | "price_rules" | "premium";

export const SettingsTab: React.FC = () => {
  const { user } = useAuth();
  const { settings, loading, error, updateSettings } = useSettings();
  const isChannelWorkspace = getUserScopeType(user) === "channel";
  const isTenantOwner = isTenantOwnerUser(user);
  const [activeTab, setActiveTab] = useState<TabType>(isChannelWorkspace ? "advanced" : "basic");
  const canEditTenantIdentity = canManageTenantIdentitySettings(user);
  
  const [premiumContext, setPremiumContext] = useState<TenantPremiumPurchaseContext | null>(null);
  
  const [formData, setFormData] = useState({
    app_name: "",
    maintenance_mode: false,
    vat_rates: [1, 10, 20] as number[],
  });
  const [newVatRate, setNewVatRate] = useState<string>("");
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fiyat kuralları state
  const [priceRules, setPriceRules] = useState<QuotePriceRules | null>(null);
  const [priceRulesLoading, setPriceRulesLoading] = useState(false);
  const [priceRulesMsg, setPriceRulesMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priceRulesSaving, setPriceRulesSaving] = useState(false);

  // Settings yüklendiğinde form'u doldur
  useEffect(() => {
    if (settings) {
      setFormData({
        app_name: settings.app_name || "",
        maintenance_mode: settings.maintenance_mode || false,
        vat_rates: settings.vat_rates && settings.vat_rates.length > 0 ? settings.vat_rates : [1, 10, 20],
      });
    }
  }, [settings]);

  // Premium context yükle (sadece tenant owner için)
  useEffect(() => {
    if (isTenantOwner && !premiumContext) {
      void getMyTenantPremiumPurchaseContext()
        .then((ctx) => setPremiumContext(ctx))
        .catch(() => {/* ignore */});
    }
  }, [isTenantOwner, premiumContext]);

  // Fiyat kuralları yükle
  useEffect(() => {
    if (activeTab === "price_rules" && !priceRules && !priceRulesLoading) {
      setPriceRulesLoading(true);
      getQuotePriceRules()
        .then((data) => setPriceRules(data))
        .catch(() => setPriceRulesMsg({ type: "error", text: "Fiyat kuralları yüklenemedi" }))
        .finally(() => setPriceRulesLoading(false));
    }
  }, [activeTab, priceRules, priceRulesLoading]);

  useEffect(() => {
    if (isChannelWorkspace && activeTab !== "advanced") {
      setActiveTab("advanced");
    }
  }, [activeTab, isChannelWorkspace]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.app_name.trim()) {
      setMessage({ type: "error", text: "Uygulama adı boş olamaz" });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const payload: SettingsUpdatePayload = {
        app_name: formData.app_name,
        maintenance_mode: formData.maintenance_mode,
        vat_rates: formData.vat_rates,
      };

      await updateSettings(payload);
      setMessage({ type: "success", text: "Ayarlar başarıyla kaydedildi" });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : "Kaydetme hatası";
      setMessage({ type: "error", text: errorText });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePriceRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceRules) return;
    try {
      setPriceRulesSaving(true);
      setPriceRulesMsg(null);
      const updated = await updateQuotePriceRules({
        max_markup_percent: priceRules.max_markup_percent,
        max_discount_percent: priceRules.max_discount_percent,
        tolerance_amount: priceRules.tolerance_amount,
        block_on_violation: priceRules.block_on_violation,
      });
      setPriceRules(updated);
      setPriceRulesMsg({ type: "success", text: "Fiyat kuralları kaydedildi" });
    } catch {
      setPriceRulesMsg({ type: "error", text: "Fiyat kuralları kaydedilemedi" });
    } finally {
      setPriceRulesSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">⏳</div>
        <span className="ml-2">Ayarlar yükleniyor...</span>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <strong>Hata:</strong> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistem"
        title={isChannelWorkspace ? "E-posta Ayarları" : "Sistem Ayarları"}
        sub={isChannelWorkspace ? "Mail gönderim profilinizi ve sistem mailbox ayarlarınızı yönetin" : "Uygulamanın temel ve gelişmiş ayarlarını yönetin"}
      />
      {!isChannelWorkspace && !canEditTenantIdentity && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bu alanda tenant kimliği ve temel ayarlar salt okunur gösterilir. Değişiklik yapmak için tenant owner veya super admin hesabı gerekir.
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-3 border-b-2 border-gray-200 pb-3 overflow-x-auto">
        {!isChannelWorkspace && (
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === "basic"
                ? "bg-blue-600 text-white"
                : "bg-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            ⚙️ Temel Ayarlar
          </button>
        )}
        <button
          onClick={() => setActiveTab("advanced")}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === "advanced"
              ? "bg-blue-600 text-white"
              : "bg-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          {isChannelWorkspace ? "📧 E-posta Ayarlari" : "🔧 Gelişmiş Ayarlar"}
        </button>
        {!isChannelWorkspace && (
          <>
            <button
              onClick={() => setActiveTab("demo")}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "demo"
                  ? "bg-green-600 text-white"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              📥 Demo Verileri
            </button>
            <button
              onClick={() => setActiveTab("price_rules")}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === "price_rules"
                  ? "bg-blue-600 text-white"
                  : "bg-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              💰 Teklif Fiyat Kuralları
            </button>
          </>
        )}
        {isTenantOwner && (
          <button
            onClick={() => setActiveTab("premium")}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
              activeTab === "premium"
                ? "bg-purple-600 text-white"
                : "bg-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            ⭐ Premium Özellikler
          </button>
        )}
      </div>

      {/* Basic Settings Tab */}
      {activeTab === "basic" && (
        <>
          {/* Messages */}
          {message && (
            <div
              className={`p-4 rounded-lg border ${
                message.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {message.type === "success" ? "✅" : "❌"} {message.text}
            </div>
          )}

          {/* Settings Form */}
          <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* App Name */}
            <div>
              <label htmlFor="app_name" className="block text-sm font-medium text-gray-700">
                Uygulama Adı
              </label>
              <input
                type="text"
                name="app_name"
                id="app_name"
                value={formData.app_name}
                onChange={handleInputChange}
                disabled={saving || !canEditTenantIdentity}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="ProcureFlow"
              />
              <p className="mt-1 text-sm text-gray-500">
                Uygulamanın adı (örn: ProcureFlow, ProcureFlow Pro)
              </p>
            </div>

            {/* Maintenance Mode */}
            <div className="border-t pt-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="maintenance_mode"
                  id="maintenance_mode"
                  checked={formData.maintenance_mode}
                  onChange={handleInputChange}
                  disabled={saving || !canEditTenantIdentity}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer disabled:opacity-60"
                />
                <label htmlFor="maintenance_mode" className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer">
                  Maintenance Modu
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {formData.maintenance_mode ? (
                  <span className="text-orange-600">
                    ⚠️ Maintenance modu aktif. Sadece admin kullanıcılar sisteme erişebilir.
                  </span>
                ) : (
                  <span>
                    Maintenance modu kapalı. Tüm kullanıcılar sisteme erişebilir.
                  </span>
                )}
              </p>
            </div>

            {/* Info Section */}
            {settings && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <ul className="space-y-1">
                  <li><strong>Son Güncelleme:</strong> {settings.updated_at ? new Date(settings.updated_at).toLocaleString("tr-TR") : "—"}</li>
                  {settings.updated_by_id && (
                    <li><strong>Güncelleyen:</strong> Kullanıcı #{settings.updated_by_id}</li>
                  )}
                </ul>
              </div>
            )}

            {/* VAT Rates */}
            <div className="border-t pt-6">
              <div className="block text-sm font-medium text-gray-700 mb-2">KDV Oranları</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.vat_rates.map((rate) => (
                  <div key={rate} className="inline-flex items-center gap-2 bg-gray-100 border border-gray-300 rounded px-3 py-1 text-sm">
                    <span>%{rate}</span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, vat_rates: prev.vat_rates.filter((r) => r !== rate) }))}
                      className="text-red-600 font-bold"
                      disabled={formData.vat_rates.length <= 1 || !canEditTenantIdentity}
                      title="KDV oranını sil"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={newVatRate}
                  onChange={(e) => setNewVatRate(e.target.value)}
                  disabled={!canEditTenantIdentity}
                  className="px-3 py-2 border border-gray-300 rounded-md w-40 disabled:bg-gray-100"
                  placeholder="Örn: 8"
                />
                <button
                  type="button"
                  disabled={!canEditTenantIdentity}
                  onClick={() => {
                    const parsed = Number(newVatRate);
                    if (!Number.isFinite(parsed) || parsed < 0) return;
                    setFormData((prev) => {
                      if (prev.vat_rates.includes(parsed)) return prev;
                      return { ...prev, vat_rates: [...prev.vat_rates, parsed].sort((a, b) => a - b) };
                    });
                    setNewVatRate("");
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  KDV Ekle
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Teklif kalemlerinde kullanılacak KDV oranlarını buradan yönetebilirsiniz.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={saving || loading || !canEditTenantIdentity}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </button>
              <button
                type="button"
                disabled={saving || loading || !canEditTenantIdentity}
                onClick={() => {
                  if (settings) {
                    setFormData({
                      app_name: settings.app_name,
                      maintenance_mode: settings.maintenance_mode,
                      vat_rates: settings.vat_rates && settings.vat_rates.length > 0 ? settings.vat_rates : [1, 10, 20],
                    });
                  }
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Sıfırla
              </button>
            </div>
          </form>
        </>
      )}

      {/* Advanced Settings Tab */}
      {activeTab === "advanced" && <AdvancedSettingsTab />}

      {/* Demo Data Tab */}
      {!isChannelWorkspace && activeTab === "demo" && <DemoDataTab />}

      {/* Price Rules Tab */}
      {!isChannelWorkspace && activeTab === "price_rules" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Teklif Fiyat Kontrol Kuralları</h3>
            <p className="text-sm text-gray-600 mt-1">
              Tedarikçilerin teklif fiyatları için geçerli olan kural eşiklerini tanımlayın. Baz fiyat olarak projedeki birim fiyat kullanılır.
            </p>
          </div>
          {priceRulesMsg && (
            <div className={`p-3 rounded-lg border text-sm ${priceRulesMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {priceRulesMsg.type === "success" ? "✅" : "❌"} {priceRulesMsg.text}
            </div>
          )}
          {priceRulesLoading && <div className="text-sm text-gray-500">⏳ Yükleniyor...</div>}
          {priceRules && !priceRulesLoading && (
            <form onSubmit={(e) => void handleSavePriceRules(e)} className="bg-white rounded-lg shadow p-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Maksimum Artış (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={0.1}
                    value={priceRules.max_markup_percent}
                    onChange={(e) => setPriceRules({ ...priceRules, max_markup_percent: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Maksimum artış yüzdesi"
                    title="Maksimum artış yüzdesi"
                    placeholder="Örn: 25"
                  />
                  <p className="text-xs text-gray-500 mt-1">Baz fiyatın en fazla bu kadar üzerinde teklif verilebilir.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Maksimum İndirim (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={priceRules.max_discount_percent}
                    onChange={(e) => setPriceRules({ ...priceRules, max_discount_percent: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Maksimum indirim yüzdesi"
                    title="Maksimum indirim yüzdesi"
                    placeholder="Örn: 10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Baz fiyatın en fazla bu kadar altında teklif verilebilir.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tolerans Tutarı (TL)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={priceRules.tolerance_amount}
                    onChange={(e) => setPriceRules({ ...priceRules, tolerance_amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Tolerans tutarı"
                    title="Tolerans tutarı"
                    placeholder="Örn: 1000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Yüzde sınırına ek olarak sabit para birimi toleransı.</p>
                </div>
                <div className="flex items-start gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="block_on_violation"
                    checked={priceRules.block_on_violation}
                    onChange={(e) => setPriceRules({ ...priceRules, block_on_violation: e.target.checked })}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <div>
                    <label htmlFor="block_on_violation" className="text-sm font-medium text-gray-700 cursor-pointer">
                      İhlalde Engelle
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Aktifse kural dışı fiyatlı teklifler kayıt edilemez. Pasifse sadece uyarı gösterilir.
                    </p>
                  </div>
                </div>
              </div>
              {priceRules.updated_at && (
                <p className="text-xs text-gray-400">Son güncelleme: {new Date(priceRules.updated_at).toLocaleString("tr-TR")}</p>
              )}
              <div className="pt-4 border-t">
                <button
                  type="submit"
                  disabled={priceRulesSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {priceRulesSaving ? "Kaydediliyor..." : "Kuralları Kaydet"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Premium Features Tab */}
      {isTenantOwner && activeTab === "premium" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Premium Özellikler</h3>
            {premiumContext && <p className="text-sm text-gray-600 mt-1">{premiumContext.tenant_name}</p>}
          </div>
          {premiumContext && <PremiumFeaturePurchasePanel tenants={[{ id: premiumContext.tenant_id, name: premiumContext.tenant_name }]} buyerName="" buyerEmail="" />}
        </div>
      )}

      {/* Premium Features always visible for tenant owner */}
      {isTenantOwner && premiumContext && activeTab !== "premium" && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Premium Özellikler</h3>
            <p className="text-sm text-gray-600 mt-1">{premiumContext.tenant_name}</p>
          </div>
          <PremiumFeaturePurchasePanel tenants={[{ id: premiumContext.tenant_id, name: premiumContext.tenant_name }]} buyerName="" buyerEmail="" />
        </div>
      )}
    </div>
  );
};
