import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getAccessToken } from "../lib/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Plan = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  features?: string[];
  limits?: Record<string, number>;
};

type Addon = {
  code: string;
  name: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  increment?: number;
  unit?: string;
  visibility_notes?: string[];
};

type PricingConfig = {
  strategic_partner: { plans: Plan[]; addons?: Addon[] };
  supplier: { plans: Plan[] };
};

type PremiumFeature = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  available_for_tenant_types?: string | null;
  monthly_price?: number | null;
  annual_price?: number | null;
  display_order?: number;
  is_active?: boolean;
  isNew?: boolean;
};

type PremiumFeatureDraft = {
  code: string;
  name: string;
  description: string;
  available_for_tenant_types: string;
  monthly_price?: number;
  annual_price?: number;
  display_order?: number;
  is_active: boolean;
};

const FALLBACK: PricingConfig = {
  strategic_partner: { plans: [], addons: [] },
  supplier: { plans: [] },
};

const EMPTY_PREMIUM_FEATURE_DRAFT: PremiumFeatureDraft = {
  code: "",
  name: "",
  description: "",
  available_for_tenant_types: '["strategic_partner"]',
  monthly_price: 0,
  annual_price: 0,
  display_order: 0,
  is_active: true,
};

const LIMIT_FIELDS: Array<{ key: string; label: string; unit: string }> = [
  { key: "max_active_companies", label: "Firma limiti", unit: "firma" },
  { key: "max_active_internal_users", label: "Kullanici limiti", unit: "kullanici" },
  { key: "max_active_projects", label: "Proje limiti", unit: "proje" },
  { key: "max_active_private_suppliers", label: "Tedarikci limiti", unit: "tedarikci" },
  { key: "max_active_rfqs", label: "Teklif limiti", unit: "teklif" },
  { key: "max_project_files_total", label: "Dosya limiti", unit: "dosya" },
  { key: "max_project_file_size_mb", label: "Tek dosya boyutu", unit: "MB" },
  { key: "allow_campaign_listing", label: "Kampanya vitrini policy", unit: "flag" },
  { key: "allow_channel_commission_rules", label: "Kanal komisyon policy", unit: "flag" },
];

export default function PublicPricingAdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<PricingConfig>(FALLBACK);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [premiumFeatures, setPremiumFeatures] = useState<PremiumFeature[]>([]);
  const [deletedPremiumFeatureIds, setDeletedPremiumFeatureIds] = useState<number[]>([]);
  const [newPremiumFeature, setNewPremiumFeature] = useState<PremiumFeatureDraft>(EMPTY_PREMIUM_FEATURE_DRAFT);

  const isSuperAdmin = useMemo(() => user?.system_role === "super_admin" || user?.role === "super_admin", [user]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/v1/admin/public-pricing-config`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE}/api/v1/onboarding/admin/premium-features`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      }).then((r) => r.json()).catch(() => []),
    ])
      .then(([data, premiumData]) => {
        setConfig(data);
        setRaw(JSON.stringify(data, null, 2));
        setPremiumFeatures(Array.isArray(premiumData) ? premiumData : []);
        setDeletedPremiumFeatureIds([]);
      })
      .catch(() => {
        setError("Public pricing config yuklenemedi");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setRaw(JSON.stringify(config, null, 2));
  }, [config]);

  const strategicPlans = config.strategic_partner?.plans || [];
  const strategicAddons = config.strategic_partner?.addons || [];
  const supplierPlans = config.supplier?.plans || [];
  const sortedPremiumFeatures = [...premiumFeatures].sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0));
  const premiumFeatureCodes = useMemo(() => new Set(premiumFeatures.map((feature) => feature.code.trim().toLowerCase()).filter(Boolean)), [premiumFeatures]);
  const isNewPremiumFeatureCodeDuplicate = useMemo(() => premiumFeatureCodes.has(newPremiumFeature.code.trim().toLowerCase()), [newPremiumFeature.code, premiumFeatureCodes]);

  function updateStrategicPlan(planCode: string, updater: (plan: Plan) => Plan) {
    setConfig((current) => ({
      ...current,
      strategic_partner: {
        ...current.strategic_partner,
        plans: (current.strategic_partner?.plans || []).map((plan) => plan.code === planCode ? updater(plan) : plan),
      },
    }));
  }

  function updateSupplierPlan(planCode: string, updater: (plan: Plan) => Plan) {
    setConfig((current) => ({
      ...current,
      supplier: {
        ...current.supplier,
        plans: (current.supplier?.plans || []).map((plan) => plan.code === planCode ? updater(plan) : plan),
      },
    }));
  }

  function updateAddon(addonCode: string, updater: (addon: Addon) => Addon) {
    setConfig((current) => ({
      ...current,
      strategic_partner: {
        ...current.strategic_partner,
        addons: (current.strategic_partner?.addons || []).map((addon) => addon.code === addonCode ? updater(addon) : addon),
      },
    }));
  }

  function updatePremiumFeature(featureId: number, updater: (feature: PremiumFeature) => PremiumFeature) {
    setPremiumFeatures((current) => current.map((feature) => feature.id === featureId ? updater(feature) : feature));
  }

  function queuePremiumFeatureDelete(featureId: number) {
    if (typeof window !== "undefined") {
      const approved = window.confirm("Bu premium feature kaydini silmek istediginize emin misiniz?");
      if (!approved) return;
    }
    setPremiumFeatures((current) => current.filter((feature) => feature.id !== featureId));
    if (featureId > 0) {
      setDeletedPremiumFeatureIds((current) => current.includes(featureId) ? current : [...current, featureId]);
    }
  }

  function addPremiumFeatureDraft() {
    if (!newPremiumFeature.code.trim() || !newPremiumFeature.name.trim()) {
      setError("Yeni premium feature icin code ve ad alanlari zorunludur");
      return;
    }
    if (isNewPremiumFeatureCodeDuplicate) {
      setError("Bu premium feature code zaten listede mevcut");
      return;
    }
    setError(null);
    setPremiumFeatures((current) => [
      ...current,
      {
        id: -Date.now(),
        code: newPremiumFeature.code.trim(),
        name: newPremiumFeature.name.trim(),
        description: newPremiumFeature.description.trim() || null,
        available_for_tenant_types: newPremiumFeature.available_for_tenant_types.trim() || null,
        monthly_price: newPremiumFeature.monthly_price ?? 0,
        annual_price: newPremiumFeature.annual_price ?? 0,
        display_order: newPremiumFeature.display_order ?? 0,
        is_active: newPremiumFeature.is_active,
        isNew: true,
      },
    ]);
    setNewPremiumFeature(EMPTY_PREMIUM_FEATURE_DRAFT);
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/public-pricing-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Kayit hatasi");
      }
      await Promise.all(
        deletedPremiumFeatureIds.map((featureId) =>
          fetch(`${API_BASE}/api/v1/onboarding/admin/premium-features/${featureId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
          }).then(async (response) => {
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(typeof payload?.detail === "string" ? payload.detail : "Premium feature silinemedi");
            }
          })
        )
      );
      await Promise.all(
        premiumFeatures.map((feature) => {
          const endpoint = feature.id > 0
            ? `${API_BASE}/api/v1/onboarding/admin/premium-features/${feature.id}`
            : `${API_BASE}/api/v1/onboarding/admin/premium-features`;
          const method = feature.id > 0 ? "PUT" : "POST";
          return fetch(endpoint, {
            method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAccessToken() ?? ""}`,
            },
            body: JSON.stringify({
              code: feature.code,
              name: feature.name,
              description: feature.description || null,
              available_for_tenant_types: feature.available_for_tenant_types || null,
              monthly_price: feature.monthly_price ?? null,
              annual_price: feature.annual_price ?? null,
              is_active: feature.is_active ?? true,
              display_order: feature.display_order ?? 0,
            }),
          }).then(async (response) => {
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(typeof payload?.detail === "string" ? payload.detail : `${feature.name} kaydedilemedi`);
            }
            return response.json();
          });
        })
      );
      const premiumFeatureRefresh = await fetch(`${API_BASE}/api/v1/onboarding/admin/premium-features`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      }).then((response) => response.json()).catch(() => []);
      setConfig(data);
      setRaw(JSON.stringify(data, null, 2));
      setPremiumFeatures(Array.isArray(premiumFeatureRefresh) ? premiumFeatureRefresh : []);
      setDeletedPremiumFeatureIds([]);
      setMessage("Public pricing config guncellendi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayit hatasi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #eff6ff 0, #f8fafc 42%, #fff 100%)", padding: "28px 18px 40px", fontFamily: "'Segoe UI', sans-serif" }}>
      <section style={{ maxWidth: 1120, margin: "0 auto", background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", borderRadius: 18, padding: 24, boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)" }}>
        <h1 style={{ marginTop: 0, color: "#0f172a" }}>Public Fiyatlandirma Ayarlari</h1>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          Bu alan stratejik partner ve tedarikci plan fiyatlarini merkezi olarak yonetir.
          Public sayfalar (`/fiyatlandirma`) bu konfigurasyonu otomatik kullanir.
        </p>

        {loading ? (
          <div style={{ color: "#64748b" }}>Yukleniyorâ€¦</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
              <StatCard label="Stratejik Plan" value={String(config.strategic_partner?.plans?.length || 0)} />
              <StatCard label="Tedarikci Plan" value={String(config.supplier?.plans?.length || 0)} />
              <StatCard label="Premium Ozellik" value={String(sortedPremiumFeatures.length)} />
              <StatCard label="Yetki" value={isSuperAdmin ? "Yazma" : "Salt Okuma"} />
            </div>

            <section style={{ display: "grid", gap: 16, marginBottom: 16 }}>
              <article style={{ border: "1px solid #dbe3ee", borderRadius: 12, padding: 16, background: "linear-gradient(135deg,#eff6ff,#f8fafc)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#1d4ed8" }}>Public Bilgi Mimarisi</div>
                <div style={{ marginTop: 6, color: "#334155", lineHeight: 1.7 }}>
                  Public nav artik scope bazli ilerlemeli: Ana Sayfa, Teklifler, Tedarikciler, Stratejik Partnerlik, Is Ortagi Programi, Tedarikci Ol, Demo Talep Et ve Sisteme Giris. Fiyatlandirma ve cozumler icerigi bu sayfalarda dagitilabilir.
                </div>
              </article>

              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <CatalogCard title="Stratejik Partner Paketleri" accent="#0f766e" plans={strategicPlans} />
                <CatalogCard title="Tedarikci Paketleri" accent="#0284c7" plans={supplierPlans} />
              </div>

              <article style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#0f766e" }}>Form Tabanli Paket Yonetimi</div>
                <div style={{ marginTop: 6, color: "#475569", lineHeight: 1.7 }}>
                  Super admin burada paket fiyatlarini, limitlerini ve tek tek satilan ekstra haklari form ile guncelleyebilir. JSON editor altta ileri seviye fallback olarak kalir.
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                  {strategicPlans.map((plan) => (
                    <div key={plan.code} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 16, background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)", display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <LabeledInput label="Paket Adi" value={plan.name} disabled={!isSuperAdmin} onChange={(value) => updateStrategicPlan(plan.code, (current) => ({ ...current, name: value }))} />
                        <LabeledNumberInput label="Aylik Fiyat" value={plan.price_monthly} disabled={!isSuperAdmin} onChange={(value) => updateStrategicPlan(plan.code, (current) => ({ ...current, price_monthly: value }))} />
                        <LabeledInput label="Para Birimi" value={plan.currency || "TRY"} disabled={!isSuperAdmin} onChange={(value) => updateStrategicPlan(plan.code, (current) => ({ ...current, currency: value }))} />
                      </div>
                      <LabeledTextarea label="Aciklama" value={plan.description || ""} disabled={!isSuperAdmin} rows={2} onChange={(value) => updateStrategicPlan(plan.code, (current) => ({ ...current, description: value }))} />
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        {LIMIT_FIELDS.map((limitField) => (
                          <LabeledNumberInput
                            key={`${plan.code}-${limitField.key}`}
                            label={`${limitField.label} (${limitField.unit})`}
                            value={plan.limits?.[limitField.key]}
                            disabled={!isSuperAdmin}
                            onChange={(value) => updateStrategicPlan(plan.code, (current) => ({
                              ...current,
                              limits: { ...(current.limits || {}), [limitField.key]: value },
                            }))}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#b45309" }}>Ekstra Paket ve Adet Bazli Haklar</div>
                <div style={{ marginTop: 6, color: "#475569", lineHeight: 1.7 }}>
                  Paket gecisi istemeyen musteriler icin adet bazli haklar burada yonetilir. Birim fiyatlari ust paket gecisinden yuksek tutulabilir.
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                  {strategicAddons.map((addon) => (
                    <div key={addon.code} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 16, background: "linear-gradient(180deg, #fffaf0 0%, #ffffff 100%)", display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <LabeledInput label="Ek Ozellik Adi" value={addon.name} disabled={!isSuperAdmin} onChange={(value) => updateAddon(addon.code, (current) => ({ ...current, name: value }))} />
                        <LabeledNumberInput label="Aylik Fiyat" value={addon.price_monthly} disabled={!isSuperAdmin} onChange={(value) => updateAddon(addon.code, (current) => ({ ...current, price_monthly: value }))} />
                        <LabeledNumberInput label="Tek Seferde Kazanim" value={addon.increment} disabled={!isSuperAdmin} onChange={(value) => updateAddon(addon.code, (current) => ({ ...current, increment: value }))} />
                        <LabeledInput label="Birim" value={addon.unit || ""} disabled={!isSuperAdmin} onChange={(value) => updateAddon(addon.code, (current) => ({ ...current, unit: value }))} />
                      </div>
                      <LabeledTextarea label="Aciklama" value={addon.description || ""} disabled={!isSuperAdmin} rows={2} onChange={(value) => updateAddon(addon.code, (current) => ({ ...current, description: value }))} />
                      <LabeledTextarea
                        label="Gorunurluk ve Satis Notlari"
                        value={(addon.visibility_notes || []).join("\n")}
                        disabled={!isSuperAdmin}
                        rows={3}
                        onChange={(value) => updateAddon(addon.code, (current) => ({
                          ...current,
                          visibility_notes: value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </article>

              <article style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#0284c7" }}>Tedarikci Paket Yonetimi</div>
                <div style={{ marginTop: 6, color: "#475569", lineHeight: 1.7 }}>
                  Tedarikci paketlerinin ad, aciklama ve fiyat alanlari da buradan duzenlenebilir.
                </div>
                <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                  {supplierPlans.map((plan) => (
                    <div key={plan.code} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 16, background: "linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)", display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <LabeledInput label="Paket Adi" value={plan.name} disabled={!isSuperAdmin} onChange={(value) => updateSupplierPlan(plan.code, (current) => ({ ...current, name: value }))} />
                        <LabeledNumberInput label="Aylik Fiyat" value={plan.price_monthly} disabled={!isSuperAdmin} onChange={(value) => updateSupplierPlan(plan.code, (current) => ({ ...current, price_monthly: value }))} />
                        <LabeledInput label="Para Birimi" value={plan.currency || "TRY"} disabled={!isSuperAdmin} onChange={(value) => updateSupplierPlan(plan.code, (current) => ({ ...current, currency: value }))} />
                      </div>
                      <LabeledTextarea label="Aciklama" value={plan.description || ""} disabled={!isSuperAdmin} rows={2} onChange={(value) => updateSupplierPlan(plan.code, (current) => ({ ...current, description: value }))} />
                    </div>
                  ))}
                </div>
              </article>

              <article style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "#7c3aed" }}>Premium Feature Matrisi</div>
                <div style={{ marginTop: 6, color: "#475569", lineHeight: 1.7 }}>
                  Odeme dogrulamasi sonrasi aktiflestirilecek premium ozellikler burada scope bazli gorunur. Paket limiti yetmediginde RFQ entitlement zinciri bu feature aktivasyonlariyla tamamlanir.
                </div>
                <div style={{ marginTop: 14, border: "1px dashed #c4b5fd", borderRadius: 14, padding: 14, background: "#faf5ff", display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800, color: "#581c87" }}>Yeni Premium Feature Ekle</div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <LabeledInput label="Code" value={newPremiumFeature.code} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, code: value }))} />
                    <LabeledInput label="Ozellik Adi" value={newPremiumFeature.name} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, name: value }))} />
                    <LabeledNumberInput label="Aylik Fiyat" value={newPremiumFeature.monthly_price} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, monthly_price: value }))} />
                    <LabeledNumberInput label="Yillik Fiyat" value={newPremiumFeature.annual_price} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, annual_price: value }))} />
                    <LabeledNumberInput label="Sira" value={newPremiumFeature.display_order} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, display_order: value }))} />
                  </div>
                  <LabeledTextarea label="Aciklama" value={newPremiumFeature.description} disabled={!isSuperAdmin} rows={2} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, description: value }))} />
                  <LabeledInput label="Scope JSON / Liste" value={newPremiumFeature.available_for_tenant_types} disabled={!isSuperAdmin} onChange={(value) => setNewPremiumFeature((current) => ({ ...current, available_for_tenant_types: value }))} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                      <input type="checkbox" checked={newPremiumFeature.is_active} disabled={!isSuperAdmin} onChange={(event) => setNewPremiumFeature((current) => ({ ...current, is_active: event.target.checked }))} />
                      Aktif baslat
                    </label>
                    <button type="button" onClick={addPremiumFeatureDraft} disabled={!isSuperAdmin || isNewPremiumFeatureCodeDuplicate} style={{ border: "none", borderRadius: 10, padding: "10px 14px", background: isSuperAdmin && !isNewPremiumFeatureCodeDuplicate ? "#7c3aed" : "#c4b5fd", color: "#fff", fontWeight: 800, cursor: isSuperAdmin && !isNewPremiumFeatureCodeDuplicate ? "pointer" : "not-allowed" }}>
                      Listeye Ekle
                    </button>
                  </div>
                  {isNewPremiumFeatureCodeDuplicate ? <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>Bu code zaten listede var. Farkli bir code girin.</div> : null}
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {sortedPremiumFeatures.length === 0 ? (
                    <div style={{ color: "#64748b" }}>Tanimli premium ozellik yok.</div>
                  ) : sortedPremiumFeatures.map((feature) => (
                    <div key={feature.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 8, background: "linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{feature.name}</div>
                          {feature.isNew ? <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9", fontWeight: 700, fontSize: 12 }}>Yeni</span> : null}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9", fontWeight: 700, fontSize: 12 }}>{feature.code}</span>
                          <button type="button" onClick={() => queuePremiumFeatureDelete(feature.id)} disabled={!isSuperAdmin} style={{ border: "1px solid #e9d5ff", borderRadius: 999, padding: "6px 10px", background: "#fff", color: "#7c2d12", fontWeight: 700, cursor: isSuperAdmin ? "pointer" : "not-allowed" }}>
                            Sil
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <LabeledInput label="Ozellik Adi" value={feature.name} disabled={!isSuperAdmin} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, name: value }))} />
                        <LabeledNumberInput label="Aylik Fiyat" value={feature.monthly_price == null ? undefined : Number(feature.monthly_price)} disabled={!isSuperAdmin} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, monthly_price: value }))} />
                        <LabeledNumberInput label="Yillik Fiyat" value={feature.annual_price == null ? undefined : Number(feature.annual_price)} disabled={!isSuperAdmin} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, annual_price: value }))} />
                        <LabeledNumberInput label="Sira" value={feature.display_order} disabled={!isSuperAdmin} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, display_order: value }))} />
                      </div>
                      <LabeledTextarea label="Aciklama" value={feature.description || ""} disabled={!isSuperAdmin} rows={2} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, description: value }))} />
                      <LabeledInput label="Scope JSON / Liste" value={feature.available_for_tenant_types || ""} disabled={!isSuperAdmin} onChange={(value) => updatePremiumFeature(feature.id, (current) => ({ ...current, available_for_tenant_types: value }))} />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 12 }}>
                          Scope: {formatPremiumAudience(feature.available_for_tenant_types)}
                        </span>
                        <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontWeight: 700, fontSize: 12 }}>
                          {formatPrice(feature.monthly_price)} / ay
                        </span>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                          <input
                            type="checkbox"
                            checked={feature.is_active ?? true}
                            disabled={!isSuperAdmin}
                            onChange={(event) => updatePremiumFeature(feature.id, (current) => ({ ...current, is_active: event.target.checked }))}
                          />
                          Aktif
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#0f172a" }}>Gelistirici JSON Gorunumu</summary>
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  try {
                    const parsed = JSON.parse(e.target.value) as PricingConfig;
                    setConfig(parsed);
                    setError(null);
                  } catch {
                    // invalid JSON can stay in the editor until save/parse is desired
                  }
                }}
                rows={20}
                style={{ width: "100%", marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 10, padding: 12, fontFamily: "Consolas, monospace", fontSize: 13 }}
                disabled={!isSuperAdmin}
              />
            </details>

            {error && <div style={{ marginTop: 10, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10 }}>{error}</div>}
            {message && <div style={{ marginTop: 10, color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 10 }}>{message}</div>}

            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
                Paketler, ekstra haklar ve premium feature fiyatlari tek kayit akisinda guncellenir.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={saveConfig}
                disabled={!isSuperAdmin || saving}
                style={{ background: isSuperAdmin ? "#0f766e" : "#94a3b8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: isSuperAdmin ? "pointer" : "not-allowed" }}
              >
                {saving ? "Kaydediliyorâ€¦" : "Kaydet"}
              </button>
              <a href="/admin?tab=campaigns" style={{ textDecoration: "none", padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}>
                Admin'e Don
              </a>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function CatalogCard({ title, accent, plans }: { title: string; accent: string; plans: Plan[] }) {
  return (
    <article style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fff" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: accent }}>{title}</div>
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {plans.map((plan) => (
          <div key={plan.code} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 800, color: "#0f172a" }}>{plan.name}</div>
              <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: `${accent}15`, color: accent, fontWeight: 700, fontSize: 12 }}>{plan.code}</span>
            </div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>{plan.description || "Aciklama yok"}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontWeight: 700, fontSize: 12 }}>
                {plan.price_monthly ? `${plan.price_monthly} ${plan.currency || "TRY"} / ay` : "Kuruma ozel"}
              </span>
              {(plan.features || []).slice(0, 3).map((feature) => (
                <span key={feature} style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#ecfeff", color: "#155e75", fontWeight: 700, fontSize: 12 }}>{feature}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function formatPremiumAudience(raw?: string | null): string {
  if (!raw) return "Tum scope";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.join(", ");
    }
  } catch {
    // no-op
  }
  return raw;
}

function formatPrice(value?: number | null): string {
  if (!value || value <= 0) return "Fiyatlandirma tanimsiz";
  return `${Number(value).toLocaleString("tr-TR")} TRY`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#f8fafc" }}>
      <div style={{ color: "#64748b", fontSize: 12, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </article>
  );
}

function LabeledInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 13, background: disabled ? "#f8fafc" : "#fff" }}
      />
    </label>
  );
}

function LabeledNumberInput({ label, value, onChange, disabled }: { label: string; value?: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{label}</span>
      <input
        type="number"
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        disabled={disabled}
        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 13, background: disabled ? "#f8fafc" : "#fff" }}
      />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, disabled, rows }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; rows?: number }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows || 3}
        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", fontSize: 13, background: disabled ? "#f8fafc" : "#fff", resize: "vertical" }}
      />
    </label>
  );
}

