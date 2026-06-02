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
import "./SettingsTab.css";

type SettingsGroupCode =
  | "basic" | "price_rules" | "email" | "email_accounts"
  | "logging" | "backup" | "notifications" | "brand" | "channel_brand"
  | "premium" | "demo";

interface SettingsGroup {
  code: SettingsGroupCode;
  label: string;
  icon: string;
  desc: string;
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  { code: "basic",          label: "Temel Ayarlar",           icon: "⚙",  desc: "Uygulama adı, bakım modu, KDV oranları" },
  { code: "price_rules",    label: "Teklif Fiyat Kuralları",  icon: "₺",  desc: "Markup/iskonto limitleri, tolerans, ihlal bloğu" },
  { code: "email",          label: "E-posta (SMTP/POP/IMAP)", icon: "✉",  desc: "Posta sunucu, gönderen, domain modu" },
  { code: "email_accounts", label: "Sistem Posta Kutuları",   icon: "📥", desc: "Çoklu sistem e-posta hesabı yönetimi" },
  { code: "logging",        label: "Loglama",                 icon: "📋", desc: "Log seviyesi, format, dosya/konsol/JSON" },
  { code: "backup",         label: "Yedekleme",               icon: "🗄", desc: "Sıklık, hedef, otomatik/şifreli/sıkıştırma" },
  { code: "notifications",  label: "Bildirimler",             icon: "🔔", desc: "E-posta/push/SMS, dijest saati" },
  { code: "brand",          label: "Marka & Kimlik",          icon: "🎨", desc: "Partner logo, renk, görünen ad" },
  { code: "channel_brand",  label: "Kanal Markalama",         icon: "🚀", desc: "İş ortağı portalı görünüm + mailbox" },
  { code: "premium",        label: "Premium Özellikler",      icon: "⭐", desc: "Partner başına feature aktivasyonu" },
  { code: "demo",           label: "Demo Verileri",           icon: "📊", desc: "Örnek veri yükle / temizle" },
];

type StaticFieldType = "text" | "number" | "select" | "toggle" | "readonly" | "color" | "file" | "secret" | "action" | "mailbox";

interface StaticField {
  key: string;
  label: string;
  type: StaticFieldType;
  value?: unknown;
  hint?: string;
  options?: string[];
  accept?: string;
  role?: string;
  status?: string;
  proto?: string;
  danger?: boolean;
  actionHint?: string;
}

// TODO(data): wire up when backend endpoints are ready
const STATIC_FIELDS: Partial<Record<SettingsGroupCode, StaticField[]>> = {
  email_accounts: [
    { key: "ea1", label: "destek@buyerasistans.com.tr",  type: "mailbox", role: "Destek · gelen kutusu",    proto: "IMAP + SMTP", status: "active" },
    { key: "ea2", label: "fatura@buyerasistans.com.tr",  type: "mailbox", role: "Finans · giden",           proto: "SMTP",        status: "active" },
    { key: "ea3", label: "noreply@buyerasistans.com.tr", type: "mailbox", role: "Sistem · transactional",  proto: "SMTP",        status: "active" },
    { key: "ea4", label: "kanal@buyerasistans.com.tr",   type: "mailbox", role: "Kanal · gelen/giden",      proto: "POP3 + SMTP", status: "warn"   },
  ],
  logging: [
    { key: "log_level",              label: "Log seviyesi",        type: "select", value: "INFO",                   options: ["DEBUG","INFO","WARNING","ERROR","CRITICAL"] },
    { key: "log_format",             label: "Log formatı",         type: "select", value: "JSON",                   options: ["JSON","TEXT","LOGFMT"] },
    { key: "log_file",               label: "Log dosya yolu",      type: "text",   value: "/var/log/buyerasistans/app.log" },
    { key: "enable_console_logging", label: "Konsol logu",         type: "toggle", value: true },
    { key: "enable_file_logging",    label: "Dosya logu",          type: "toggle", value: true },
    { key: "enable_json_logging",    label: "JSON logu",           type: "toggle", value: true, hint: "Structured logging — log toplama için" },
  ],
  backup: [
    { key: "backup_frequency",        label: "Yedekleme sıklığı",   type: "select", value: "daily",                  options: ["hourly","daily","weekly"] },
    { key: "backup_time",             label: "Yedekleme saati",      type: "text",   value: "06:00",                  hint: "HH:MM · sunucu saati" },
    { key: "backup_location",         label: "Yedek hedefi",         type: "select", value: "AWS S3 (eu-central-1)",  options: ["Yerel disk","AWS S3 (eu-central-1)","GCP Cloud Storage","Azure Blob"] },
    { key: "enable_automatic_backup", label: "Otomatik yedekleme",   type: "toggle", value: true },
    { key: "compress_backups",        label: "Yedekleri sıkıştır",   type: "toggle", value: true,  hint: "gzip · disk tasarrufu" },
    { key: "encrypt_backups",         label: "Yedekleri şifrele",    type: "toggle", value: true,  hint: "AES-256 · KVKK uyumu" },
  ],
  notifications: [
    { key: "notify_email",  label: "E-posta bildirimleri",  type: "toggle", value: true },
    { key: "notify_push",   label: "Push bildirimleri",     type: "toggle", value: true },
    { key: "notify_sms",    label: "SMS bildirimleri",      type: "toggle", value: false, hint: "Kritik olaylar için" },
    { key: "notify_digest", label: "Günlük özet (digest)",  type: "toggle", value: true },
    { key: "digest_time",   label: "Dijest gönderim saati", type: "text",   value: "08:30", hint: "HH:MM" },
    { key: "sms_provider",  label: "SMS sağlayıcı",         type: "select", value: "NetGSM", options: ["NetGSM","İletimerkezi","Twilio"] },
  ],
  brand: [
    { key: "logo_dark",     label: "Koyu zemin logosu", type: "file",     value: "buyer-logo-koyu.svg", accept: ".svg, .png" },
    { key: "logo_light",    label: "Açık zemin logosu", type: "file",     value: "buyer-logo.svg",      accept: ".svg, .png" },
    { key: "favicon",       label: "Favicon",            type: "file",     value: "favicon.svg",         accept: ".svg, .ico" },
    { key: "display_name",  label: "Görünen ad",         type: "text",     value: "Buyer Asistans" },
    { key: "brand_primary", label: "Ana renk",           type: "color",    value: "#112a25" },
    { key: "brand_accent",  label: "Vurgu renk",         type: "color",    value: "#D4AF37" },
    { key: "identity_note", label: "Yetki notu",         type: "readonly", value: "Sadece tenant_owner / super_admin düzenleyebilir (tenant_identity yetkisi)" },
  ],
  channel_brand: [
    { key: "ch_enabled",   label: "Kanal markalama aktif", type: "toggle", value: true },
    { key: "ch_logo",      label: "Kanal portal logosu",   type: "file",   value: "kanal-logo.svg", accept: ".svg, .png" },
    { key: "ch_primary",   label: "Kanal ana renk",        type: "color",  value: "#f59e0b" },
    { key: "ch_mailbox",   label: "Kanal mailbox aktif",   type: "toggle", value: true, hint: "Kanal hesap sahibi e-posta yönetimi açık" },
    { key: "ch_from_name", label: "Kanal gönderen ad",     type: "text",   value: "Buyer Asistans · İş Ortağı" },
  ],
};

function StaticFieldRow({ field }: { field: StaticField }) {
  const [localValue, setLocalValue] = useState(field.value);

  if (field.type === "mailbox") {
    return (
      <div className="st-row st-row--integration">
        <div className="st-row__l">
          <b>{field.label}</b>
          <span>{field.role}</span>
        </div>
        <div className="st-row__c">
          <span className="st-domain-ssl">{field.proto}</span>
        </div>
        <div className="st-row__r">
          <span className={`st-status st-status--${field.status ?? "inactive"}`}>
            {field.status === "active" ? "● Aktif" : field.status === "warn" ? "▲ Doğrula" : "× Pasif"}
          </span>
          <button type="button" className="st-row__act">Yönet →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="st-row">
      <div className="st-row__label">
        <label>{field.label}</label>
        {field.hint ? <span>{field.hint}</span> : null}
      </div>
      <div className="st-row__input">
        {field.type === "text" && (
          <input type="text" className="st-input" aria-label={field.label} value={String(localValue ?? "")}
            onChange={(e) => setLocalValue(e.target.value)} />
        )}
        {field.type === "number" && (
          <input type="number" className="st-input st-input--sm" aria-label={field.label} value={Number(localValue ?? 0)}
            onChange={(e) => setLocalValue(Number(e.target.value))} />
        )}
        {field.type === "select" && (
          <select className="st-select" aria-label={field.label} value={String(localValue ?? "")}
            onChange={(e) => setLocalValue(e.target.value)}>
            {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {field.type === "toggle" && (
          <label className="st-toggle">
            <input type="checkbox" aria-label={field.label} checked={!!localValue}
              onChange={(e) => setLocalValue(e.target.checked)} />
            <span className="st-toggle__track"><span className="st-toggle__thumb" /></span>
            <span className="st-toggle__label">{localValue ? "Açık" : "Kapalı"}</span>
          </label>
        )}
        {field.type === "readonly" && <div className="st-readonly">{String(localValue ?? "")}</div>}
        {field.type === "color" && (
          <div className="st-color">
            <input type="color" aria-label={`${field.label} renk`} value={String(localValue ?? "#000000")}
              onChange={(e) => setLocalValue(e.target.value)} />
            <input type="text" className="st-input st-input--sm" aria-label={`${field.label} hex`} value={String(localValue ?? "")}
              onChange={(e) => setLocalValue(e.target.value)} />
          </div>
        )}
        {field.type === "file" && (
          <div className="st-file">
            <code>{String(localValue ?? "")}</code>
            <button type="button" className="st-row__act">Değiştir → {field.accept}</button>
          </div>
        )}
        {field.type === "secret" && (
          <div className="st-secret">
            <code>{String(localValue ?? "")}</code>
            <button type="button" className="st-row__act">Göster</button>
            <button type="button" className="st-row__act">Yenile</button>
          </div>
        )}
        {field.type === "action" && (
          <>
            <button type="button" className={`st-action-btn${field.danger ? " st-action-btn--danger" : ""}`}>
              {String(localValue ?? "")}
            </button>
            {field.actionHint && <span className="st-action-hint">{field.actionHint}</span>}
          </>
        )}
      </div>
    </div>
  );
}

export const SettingsTab: React.FC = () => {
  const { user } = useAuth();
  const { settings, loading, error, updateSettings } = useSettings();
  const isChannelWorkspace = getUserScopeType(user) === "channel";
  const isTenantOwner = isTenantOwnerUser(user);
  const canEditTenantIdentity = canManageTenantIdentitySettings(user);

  const defaultGroup: SettingsGroupCode = isChannelWorkspace ? "email" : "basic";
  const [activeGroup, setActiveGroup] = useState<SettingsGroupCode>(defaultGroup);
  const [search, setSearch] = useState("");

  // Nav style
  const [navStyle, setNavStyleState] = useState<"sidebar" | "top">(() => {
    try { return (localStorage.getItem("pf_nav_style") as "sidebar" | "top") || "sidebar"; } catch { return "sidebar"; }
  });
  function handleNavStyleChange(style: "sidebar" | "top") {
    try { localStorage.setItem("pf_nav_style", style); } catch { /* ignore */ }
    setNavStyleState(style);
    window.location.reload();
  }

  // Basic settings state
  const [formData, setFormData] = useState({ app_name: "", maintenance_mode: false, vat_rates: [1, 10, 20] as number[] });
  const [newVatRate, setNewVatRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Price rules state
  const [priceRules, setPriceRules] = useState<QuotePriceRules | null>(null);
  const [priceRulesLoading, setPriceRulesLoading] = useState(false);
  const [priceRulesDirty, setPriceRulesDirty] = useState(false);
  const [priceRulesMsg, setPriceRulesMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priceRulesSaving, setPriceRulesSaving] = useState(false);

  // Premium state
  const [premiumContext, setPremiumContext] = useState<TenantPremiumPurchaseContext | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        app_name: settings.app_name || "",
        maintenance_mode: settings.maintenance_mode || false,
        vat_rates: settings.vat_rates?.length ? settings.vat_rates : [1, 10, 20],
      });
    }
  }, [settings]);

  useEffect(() => {
    if (isTenantOwner && !premiumContext) {
      void getMyTenantPremiumPurchaseContext()
        .then((ctx) => setPremiumContext(ctx))
        .catch(() => { /* ignore */ });
    }
  }, [isTenantOwner, premiumContext]);

  useEffect(() => {
    if (activeGroup === "price_rules" && !priceRules && !priceRulesLoading) {
      setPriceRulesLoading(true);
      getQuotePriceRules()
        .then((data) => setPriceRules(data))
        .catch(() => setPriceRulesMsg({ type: "error", text: "Fiyat kuralları yüklenemedi" }))
        .finally(() => setPriceRulesLoading(false));
    }
  }, [activeGroup, priceRules, priceRulesLoading]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.app_name.trim()) { setMessage({ type: "error", text: "Uygulama adı boş olamaz" }); return; }
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
      setDirty(false);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Kaydetme hatası" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePriceRules = async (e: React.FormEvent<HTMLFormElement>) => {
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
      setPriceRulesDirty(false);
    } catch {
      setPriceRulesMsg({ type: "error", text: "Fiyat kuralları kaydedilemedi" });
    } finally {
      setPriceRulesSaving(false);
    }
  };

  function addVatRate() {
    const parsed = Number(newVatRate);
    if (!Number.isFinite(parsed) || parsed < 0 || formData.vat_rates.includes(parsed)) return;
    setFormData((p) => ({ ...p, vat_rates: [...p.vat_rates, parsed].sort((a, b) => a - b) }));
    setNewVatRate("");
    setDirty(true);
  }

  const group = SETTINGS_GROUPS.find((g) => g.code === activeGroup);
  const staticFields = STATIC_FIELDS[activeGroup] ?? [];
  const filteredStatic = search
    ? staticFields.filter((f) => f.label.toLowerCase().includes(search.toLowerCase()))
    : staticFields;
  const isStaticGroup = activeGroup in STATIC_FIELDS;

  if (loading && !settings) {
    return <div className="st-loading">⏳ Ayarlar yükleniyor...</div>;
  }
  if (error && !settings) {
    return <div className="st-error">Hata: {error}</div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sistem · Genel Ayarlar"
        title="Ayarlar"
        sub="Platform geneli yapılandırma · 11 kategori · değişiklikler kaydedildiğinde anında geçerli olur."
      />

      <div className="st-layout">
        <aside className="st-sidebar">
          <div className="st-sidebar__search">
            <span className="st-sidebar__search-icon">🔍</span>
            <input
              className="st-sidebar__search-input"
              placeholder="Ayar ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="st-sidebar__list">
            {SETTINGS_GROUPS.map((g) => (
              <button
                key={g.code}
                type="button"
                className={`st-nav${activeGroup === g.code ? " on" : ""}`}
                onClick={() => { setActiveGroup(g.code); setSearch(""); }}
              >
                <span className="st-nav__icon">{g.icon}</span>
                <div className="st-nav__body">
                  <b>{g.label}</b>
                  <span>{g.desc}</span>
                </div>
                <span className="st-nav__arrow">›</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="st-detail">
          <div className="st-detail__head">
            <span className="st-detail__icon">{group?.icon}</span>
            <div>
              <h2 className="st-detail__title">{group?.label}</h2>
              <p className="st-detail__desc">{group?.desc}</p>
            </div>
          </div>

          {/* ── Temel Ayarlar ──────────────────────────────────── */}
          {activeGroup === "basic" && (
            <>
              {!canEditTenantIdentity && (
                <div className="st-warn-banner">
                  Bu alanda temel ayarlar salt okunur gösterilir. Değişiklik için tenant owner veya super admin hesabı gerekir.
                </div>
              )}
              {message && (
                <div className={`st-message st-message--${message.type}`}>
                  {message.type === "success" ? "✓" : "✕"} {message.text}
                </div>
              )}
              <div className="st-fields">
                <div className="st-row">
                  <div className="st-row__label">
                    <label>Navigasyon Stili</label>
                    <span>Sol kenar çubuğu veya üst navigasyon. Değişiklik sayfayı yeniler.</span>
                  </div>
                  <div className="st-row__input">
                    <div className="st-nav-style-group">
                      <button className={`st-nav-style-btn${navStyle === "sidebar" ? " on" : ""}`}
                        type="button" onClick={() => handleNavStyleChange("sidebar")}>
                        ☰ Sol Sidebar
                      </button>
                      <button className={`st-nav-style-btn${navStyle === "top" ? " on" : ""}`}
                        type="button" onClick={() => handleNavStyleChange("top")}>
                        ▬ Üst Navigasyon
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <form onSubmit={(e) => void handleSave(e)} className="st-fields">
                <div className="st-row">
                  <div className="st-row__label">
                    <label htmlFor="st_app_name">Uygulama adı</label>
                    <span>Örn: ProcureFlow, Buyer Asistans Pro</span>
                  </div>
                  <div className="st-row__input">
                    <input id="st_app_name" type="text" className="st-input"
                      value={formData.app_name} disabled={saving || !canEditTenantIdentity}
                      onChange={(e) => { setFormData((p) => ({ ...p, app_name: e.target.value })); setDirty(true); }} />
                  </div>
                </div>
                <div className="st-row">
                  <div className="st-row__label">
                    <label htmlFor="st_maint">Bakım modu</label>
                    <span>Aktifken sadece admin kullanıcılar sisteme erişir</span>
                  </div>
                  <div className="st-row__input">
                    <label className="st-toggle">
                      <input id="st_maint" type="checkbox"
                        checked={formData.maintenance_mode} disabled={saving || !canEditTenantIdentity}
                        onChange={(e) => { setFormData((p) => ({ ...p, maintenance_mode: e.target.checked })); setDirty(true); }} />
                      <span className="st-toggle__track"><span className="st-toggle__thumb" /></span>
                      <span className="st-toggle__label">{formData.maintenance_mode ? "Açık" : "Kapalı"}</span>
                    </label>
                  </div>
                </div>
                <div className="st-row">
                  <div className="st-row__label">
                    <label>KDV oranları (%)</label>
                    <span>Tekliflerde seçilebilir oranlar — en az 1 tane</span>
                  </div>
                  <div className="st-row__input">
                    <div className="st-taglist">
                      <div className="st-taglist__tags">
                        {formData.vat_rates.map((rate) => (
                          <span key={rate} className="st-tag">
                            %{rate}
                            <button type="button"
                              disabled={formData.vat_rates.length <= 1 || !canEditTenantIdentity}
                              onClick={() => { setFormData((p) => ({ ...p, vat_rates: p.vat_rates.filter((r) => r !== rate) })); setDirty(true); }}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="st-taglist__add">
                        <input type="number" className="st-input st-input--sm" placeholder="Örn: 8"
                          value={newVatRate} disabled={!canEditTenantIdentity}
                          onChange={(e) => setNewVatRate(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVatRate(); } }} />
                        <button type="button" className="st-row__act" disabled={!canEditTenantIdentity}
                          onClick={addVatRate}>
                          + Ekle
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                {settings && (
                  <div className="st-row">
                    <div className="st-row__label"><label>Son güncelleme</label></div>
                    <div className="st-row__input">
                      <div className="st-readonly">
                        {settings.updated_at ? new Date(settings.updated_at).toLocaleString("tr-TR") : "—"}
                      </div>
                    </div>
                  </div>
                )}
                <div className="st-form-actions">
                  <button type="button" className="st-btn st-btn--ghost"
                    disabled={saving || !canEditTenantIdentity}
                    onClick={() => {
                      if (settings) {
                        setFormData({ app_name: settings.app_name, maintenance_mode: settings.maintenance_mode, vat_rates: settings.vat_rates?.length ? settings.vat_rates : [1, 10, 20] });
                        setDirty(false);
                      }
                    }}>
                    Sıfırla
                  </button>
                  <button type="submit" className="st-btn st-btn--primary"
                    disabled={saving || !dirty || !canEditTenantIdentity}>
                    {saving ? "Kaydediliyor..." : dirty ? "● Kaydet" : "✓ Kaydedildi"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Teklif Fiyat Kuralları ──────────────────────────── */}
          {activeGroup === "price_rules" && (
            <>
              {priceRulesMsg && (
                <div className={`st-message st-message--${priceRulesMsg.type}`}>
                  {priceRulesMsg.type === "success" ? "✓" : "✕"} {priceRulesMsg.text}
                </div>
              )}
              {priceRulesLoading && <div className="st-loading-inline">⏳ Yükleniyor...</div>}
              {priceRules && !priceRulesLoading && (
                <form onSubmit={(e) => void handleSavePriceRules(e)} className="st-fields">
                  <div className="st-row">
                    <div className="st-row__label">
                      <label>Maksimum markup (%)</label>
                      <span>Teklif fiyatı liste fiyatının en fazla bu kadar üstünde olabilir</span>
                    </div>
                    <div className="st-row__input">
                      <input type="number" className="st-input st-input--sm" aria-label="Maksimum markup (%)" min={0} max={1000} step={0.1}
                        value={priceRules.max_markup_percent}
                        onChange={(e) => { setPriceRules({ ...priceRules, max_markup_percent: parseFloat(e.target.value) || 0 }); setPriceRulesDirty(true); }} />
                    </div>
                  </div>
                  <div className="st-row">
                    <div className="st-row__label">
                      <label>Maksimum iskonto (%)</label>
                      <span>Teklif fiyatı en fazla bu kadar indirilebilir</span>
                    </div>
                    <div className="st-row__input">
                      <input type="number" className="st-input st-input--sm" aria-label="Maksimum iskonto (%)" min={0} max={100} step={0.1}
                        value={priceRules.max_discount_percent}
                        onChange={(e) => { setPriceRules({ ...priceRules, max_discount_percent: parseFloat(e.target.value) || 0 }); setPriceRulesDirty(true); }} />
                    </div>
                  </div>
                  <div className="st-row">
                    <div className="st-row__label">
                      <label>Tolerans tutarı (₺)</label>
                      <span>Bu tutarın altındaki sapmalar göz ardı edilir</span>
                    </div>
                    <div className="st-row__input">
                      <input type="number" className="st-input st-input--sm" aria-label="Tolerans tutarı (₺)" min={0} step={1}
                        value={priceRules.tolerance_amount}
                        onChange={(e) => { setPriceRules({ ...priceRules, tolerance_amount: parseFloat(e.target.value) || 0 }); setPriceRulesDirty(true); }} />
                    </div>
                  </div>
                  <div className="st-row">
                    <div className="st-row__label">
                      <label>İhlalde teklifi blokla</label>
                      <span>Kapalıysa sadece uyarı verir, teklif geçer</span>
                    </div>
                    <div className="st-row__input">
                      <label className="st-toggle">
                        <input type="checkbox" checked={priceRules.block_on_violation}
                          onChange={(e) => { setPriceRules({ ...priceRules, block_on_violation: e.target.checked }); setPriceRulesDirty(true); }} />
                        <span className="st-toggle__track"><span className="st-toggle__thumb" /></span>
                        <span className="st-toggle__label">{priceRules.block_on_violation ? "Açık" : "Kapalı"}</span>
                      </label>
                    </div>
                  </div>
                  {priceRules.updated_at && (
                    <div className="st-row">
                      <div className="st-row__label"><label>Son güncelleme</label></div>
                      <div className="st-row__input">
                        <div className="st-readonly">{new Date(priceRules.updated_at).toLocaleString("tr-TR")}</div>
                      </div>
                    </div>
                  )}
                  <div className="st-form-actions">
                    <button type="submit" className="st-btn st-btn--primary"
                      disabled={priceRulesSaving || !priceRulesDirty}>
                      {priceRulesSaving ? "Kaydediliyor..." : priceRulesDirty ? "● Kaydet" : "✓ Kaydedildi"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ── E-posta (SMTP) — mevcut AdvancedSettingsTab ─────── */}
          {activeGroup === "email" && <div className="st-embedded"><AdvancedSettingsTab /></div>}

          {/* ── Demo Verileri ───────────────────────────────────── */}
          {activeGroup === "demo" && <div className="st-embedded"><DemoDataTab /></div>}

          {/* ── Premium Özellikler ──────────────────────────────── */}
          {activeGroup === "premium" && (
            <div className="st-fields">
              {premiumContext ? (
                <PremiumFeaturePurchasePanel
                  tenants={[{ id: premiumContext.tenant_id, name: premiumContext.tenant_name }]}
                  buyerName=""
                  buyerEmail=""
                />
              ) : (
                <div className="st-readonly">
                  {isTenantOwner ? "Premium bağlam yükleniyor..." : "Bu kullanıcı için premium görünümü mevcut değil."}
                </div>
              )}
            </div>
          )}

          {/* ── Statik gruplar (email_accounts, logging, backup, notifications, brand, channel_brand) */}
          {isStaticGroup && (
            <div className="st-fields">
              {filteredStatic.length === 0 ? (
                <div className="st-empty">Aramayla eşleşen ayar yok.</div>
              ) : (
                filteredStatic.map((f) => <StaticFieldRow key={f.key} field={f} />)
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
