import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSupplierAccessToken } from "../lib/session";
import {
  deleteSupplierProfileUser,
  getSupplierEmailChangeStatus,
  getSupplierProfile,
  requestSupplierEmailChange,
  updateSupplierProfileUser,
  updateSupplierProfile,
  uploadSupplierLogo,
  type SupplierPaymentAccount,
  type SupplierAuthorizedUser,
  type SupplierProfileResponse,
} from "../services/supplier-profile.service";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";
import { CategorySelectionModal } from "../components/CategorySelectionModal";
import "./SupplierProfilePage.css";

function AutocompleteInput({ value, onChange, options, placeholder, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const filtered = useMemo(
    () => options.filter(o => o.toLowerCase().includes(value.toLowerCase())).slice(0, 100),
    [options, value]
  );

  return (
    <div className="ssp-autocomplete-wrap">
      <input
        type="text"
        className="ssp-field__input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === "ArrowDown") { setHi(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
          if (e.key === "ArrowUp") { setHi(h => Math.max(h - 1, 0)); e.preventDefault(); }
          if (e.key === "Enter" && filtered[hi]) { onChange(filtered[hi]); setOpen(false); e.preventDefault(); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="ssp-dropdown-list">
          {filtered.map((opt, i) => (
            <li
              key={opt}
              className={`ssp-dropdown-item${i === hi ? " ssp-dropdown-item--active" : ""}`}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type FormState = {
  supplier_website: string;
  address: string;
  city: string;
  address_district: string;
  postal_code: string;
  tax_number: string;
  tax_office: string;
  registration_number: string;
  invoice_name: string;
  invoice_address: string;
  invoice_city: string;
  invoice_district: string;
  invoice_postal_code: string;
  notes: string;
  category_tags: string[];
  payment_accounts: SupplierPaymentAccount[];
  accepts_checks: boolean;
  preferred_check_term: string;
  user_name: string;
  user_phone: string;
  user_email: string;
  user_work_email: string;
};

type SectionKey = "invoice" | "address" | "payment" | "categories" | "notes";

const BANK_OPTIONS = [
  { key: "ziraat", name: "Ziraat Bankası", short: "ZB", start: "#b91c1c", end: "#ef4444" },
  { key: "isbank", name: "İş Bankası", short: "İŞ", start: "#1d4ed8", end: "#60a5fa" },
  { key: "garanti", name: "Garanti BBVA", short: "GB", start: "#047857", end: "#34d399" },
  { key: "yapikredi", name: "Yapı Kredi", short: "YK", start: "#1e3a8a", end: "#2563eb" },
  { key: "akbank", name: "Akbank", short: "AK", start: "#991b1b", end: "#f87171" },
  { key: "vakifbank", name: "VakıfBank", short: "VB", start: "#a16207", end: "#fbbf24" },
  { key: "halkbank", name: "Halkbank", short: "HB", start: "#065f46", end: "#10b981" },
  { key: "qnb", name: "QNB", short: "QN", start: "#581c87", end: "#a855f7" },
  { key: "denizbank", name: "DenizBank", short: "DB", start: "#0f172a", end: "#334155" },
];

const t = (v: string | null | undefined) => v ?? "";

function mapToForm(p: SupplierProfileResponse): FormState {
  return {
    supplier_website: t(p.supplier.website),
    address: t(p.supplier.address),
    city: t(p.supplier.city),
    address_district: t(p.supplier.address_district),
    postal_code: t(p.supplier.postal_code),
    tax_number: t(p.supplier.tax_number),
    tax_office: t(p.supplier.tax_office),
    registration_number: t(p.supplier.registration_number),
    invoice_name: t(p.supplier.invoice_name),
    invoice_address: t(p.supplier.invoice_address),
    invoice_city: t(p.supplier.invoice_city),
    invoice_district: t(p.supplier.invoice_district),
    invoice_postal_code: t(p.supplier.invoice_postal_code),
    notes: t(p.supplier.notes),
    category_tags: p.supplier.category_tags ?? [],
    payment_accounts: (p.supplier.payment_accounts ?? []).map((account) => ({
      id: account.id,
      bank_key: account.bank_key,
      bank_name: account.bank_name,
      iban: account.iban,
      account_type: account.account_type,
    })),
    accepts_checks: !!p.supplier.accepts_checks,
    preferred_check_term: t(p.supplier.preferred_check_term),
    user_name: t(p.user.name),
    user_phone: t(p.user.phone),
    user_email: t(p.user.email),
    user_work_email: t(p.user.work_email),
  };
}

export default function SupplierProfilePage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<SupplierProfileResponse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    invoice: false, address: false, payment: false, categories: false, notes: false,
  });
  const [emailStatus, setEmailStatus] = useState<{ pending: boolean; pendingEmail: string | null }>({
    pending: false, pendingEmail: null,
  });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingUserForm, setEditingUserForm] = useState<{ name: string; email: string; phone: string }>({
    name: "", email: "", phone: "",
  });
  const [firmaMapUrl, setFirmaMapUrl] = useState<string | null>(null);
  const [faturaMapUrl, setFaturaMapUrl] = useState<string | null>(null);
  const [firmaGoogleUrl, setFirmaGoogleUrl] = useState<string | null>(null);
  const [faturaGoogleUrl, setFaturaGoogleUrl] = useState<string | null>(null);
  const [showFirmaMap, setShowFirmaMap] = useState(true);
  const [showFaturaMap, setShowFaturaMap] = useState(true);

  const flash = useCallback((msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, status] = await Promise.all([getSupplierProfile(), getSupplierEmailChangeStatus()]);
      setProfile(data);
      setForm(mapToForm(data));
      setEmailStatus({ pending: status.pending, pendingEmail: status.pending_email });
    } catch {
      flash("Profil yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => {
    if (!getSupplierAccessToken()) {
      navigate("/supplier/login", { replace: true });
      return;
    }
    void load();
  }, [load, navigate]);

  const cityNames = useMemo(() => getCityNames(), []);
  const districts = useMemo(() => form?.invoice_city ? getDistricts(form.invoice_city) : [], [form?.invoice_city]);
  const addressDistricts = useMemo(() => form?.city ? getDistricts(form.city) : [], [form?.city]);

  const set = (key: keyof FormState, val: string) =>
    setForm(prev => prev ? { ...prev, [key]: val } : prev);

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addPaymentAccount = () => {
    setForm((prev) => prev ? {
      ...prev,
      payment_accounts: [
        ...prev.payment_accounts,
        { bank_key: BANK_OPTIONS[0].key, bank_name: BANK_OPTIONS[0].name, iban: "", account_type: "tl" },
      ],
    } : prev);
  };

  const updatePaymentAccount = (index: number, patch: Partial<SupplierPaymentAccount>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const payment_accounts = prev.payment_accounts.map((account, accountIndex) =>
        accountIndex === index ? { ...account, ...patch } : account
      );
      return { ...prev, payment_accounts };
    });
  };

  const removePaymentAccount = (index: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, payment_accounts: prev.payment_accounts.filter((_, i) => i !== index) };
    });
  };

  const logoSrc = useMemo(() => {
    const url = profile?.supplier.logo_url;
    if (!url) return null;
    return url.startsWith("http") ? url : `http://127.0.0.1:8000${url}`;
  }, [profile?.supplier.logo_url]);

  const authorizedUsers = profile?.supplier.authorized_users ?? [];
  const isCurrentUserDefault = profile ? profile.user.id === profile.supplier.default_user_id : false;

  const beginEditTeamUser = (user: SupplierAuthorizedUser) => {
    setEditingUser(user.id);
    setEditingUserForm({ name: user.name, email: user.email, phone: user.phone ?? "" });
  };

  const saveTeamUser = async (userId: number) => {
    try {
      await updateSupplierProfileUser(userId, editingUserForm);
      flash("Yetkili güncellendi", "success");
      setEditingUser(null);
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail || "Yetkili güncellenemedi", "error");
    }
  };

  const removeTeamUser = async (userId: number) => {
    if (!window.confirm("Bu yetkiliyi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteSupplierProfileUser(userId);
      flash("Yetkili silindi", "success");
      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail || "Yetkili silinemedi", "error");
    }
  };

  const findLocation = useCallback(async (kind: "firma" | "fatura", addrParts: string[]) => {
    const [addrRaw, district, city] = addrParts;
    if (!city) { flash("Önce şehir / il bilgisini girin.", "error"); return; }
    const q = [addrRaw, district, city, "Türkiye"].filter(Boolean).join(", ");
    const embedUrl = `https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(q)}`;
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    if (kind === "firma") { setFirmaMapUrl(embedUrl); setFirmaGoogleUrl(googleUrl); }
    else { setFaturaMapUrl(embedUrl); setFaturaGoogleUrl(googleUrl); }
  }, [flash]);

  useEffect(() => {
    if (!form?.city) return;
    if (!firmaMapUrl) void findLocation("firma", [form.address, form.address_district, form.city]);
  }, [form?.address, form?.address_district, form?.city, firmaMapUrl, findLocation]);

  useEffect(() => {
    if (!form?.invoice_city) return;
    if (!faturaMapUrl) void findLocation("fatura", [form.invoice_address, form.invoice_district, form.invoice_city]);
  }, [form?.invoice_address, form?.invoice_district, form?.invoice_city, faturaMapUrl, findLocation]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadSupplierLogo(file);
      setProfile(prev => prev ? { ...prev, supplier: { ...prev.supplier, logo_url: res.logo_url } } : prev);
      flash("Logo güncellendi", "success");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail || "Logo yüklenemedi", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form || !profile) return;
    try {
      setSaving(true);
      const currentEmail = profile.user.email.trim().toLowerCase();
      const nextEmail = form.user_email.trim().toLowerCase();
      const payload = {
        supplier_website: form.supplier_website,
        address: form.address,
        city: form.city,
        address_district: form.address_district,
        postal_code: form.postal_code,
        tax_number: form.tax_number,
        tax_office: form.tax_office,
        registration_number: form.registration_number,
        invoice_name: form.invoice_name,
        invoice_address: form.invoice_address,
        invoice_city: form.invoice_city,
        invoice_district: form.invoice_district,
        invoice_postal_code: form.invoice_postal_code,
        notes: form.notes,
        category_tags: form.category_tags,
        payment_accounts: form.payment_accounts.map((account) => ({
          bank_key: account.bank_key,
          bank_name: account.bank_name,
          iban: account.iban,
          account_type: account.account_type,
        })),
        accepts_checks: form.accepts_checks,
        preferred_check_term: form.accepts_checks ? form.preferred_check_term : "",
        user_name: form.user_name,
        user_phone: form.user_phone,
        user_work_email: form.user_work_email || null,
      };

      const res = await updateSupplierProfile(payload);
      flash(res.message || "Profil kaydedildi", "success");

      if (nextEmail && nextEmail !== currentEmail) {
        await requestSupplierEmailChange(nextEmail);
        flash("Yeni e-posta adresine doğrulama linki gönderildi.", "success");
      }

      await load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      flash(detail || "Kaydetme başarısız", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile || !form) {
    return (
      <div className="ssp-wrap">
        <div className="ssp-topbar">
          <div className="ssp-topbar__left"><h1>Profilim</h1></div>
        </div>
        <div className="ssp-body"><div className="ssp-card ssp-card--center">Yükleniyor...</div></div>
      </div>
    );
  }

  return (
    <div className="ssp-wrap">
      <div className="ssp-topbar">
        <div className="ssp-topbar__left">
          <h1>Profilim</h1>
          <span>{profile.supplier.company_name}</span>
        </div>
        <button type="button" className="ssp-topbar__back" onClick={() => navigate("/supplier/dashboard")}>← Panele Dön</button>
      </div>

      <div className="ssp-body">
        {/* Logo & Contact card */}
        <div className="ssp-card ssp-logo-card">
          <div className="ssp-logo-left">
            <div
              className={`ssp-logo-box${logoSrc ? " ssp-logo-box--has-logo" : ""}`}
              onClick={() => fileRef.current?.click()}
              title="Tıklayarak logo yükleyin"
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === "Enter" && fileRef.current?.click()}
            >
              {logoSrc
                ? <img src={logoSrc} alt="Logo" />
                : <div className="ssp-logo-placeholder"><span>🏢</span>Logo</div>}
            </div>
            <button type="button" className="ssp-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "⏳ Yükleniyor..." : "📷 Logo Yükle"}
            </button>
          </div>

          <div className="ssp-logo-info">
            <div className="ssp-top-fields">
              <label className="ssp-mini-field">
                <div className="ssp-mini-field__header">
                  <span className="ssp-mini-field__label">Şirket Yetkilisi</span>
                </div>
                <input className="ssp-field__input" value={form.user_name} onChange={e => set("user_name", e.target.value)} placeholder="Yetkili adı" />
              </label>
              <label className="ssp-mini-field">
                <div className="ssp-mini-field__header">
                  <span className="ssp-mini-field__label">Yetkili Telefonu</span>
                </div>
                <input className="ssp-field__input" value={form.user_phone} onChange={e => set("user_phone", e.target.value)} placeholder="0 (5xx) xxx xx xx" />
              </label>
              <label className="ssp-mini-field">
                <div className="ssp-mini-field__header">
                  <span className="ssp-mini-field__label">İş Maili</span>
                </div>
                <input className="ssp-field__input" value={form.user_work_email} onChange={e => set("user_work_email", e.target.value)} placeholder="mailbox@firma.com" />
              </label>
              <label className="ssp-mini-field">
                <div className="ssp-mini-field__header">
                  <span className="ssp-mini-field__label">Yetkili E-posta</span>
                  <div className="ssp-email-status-row">
                    <span className={`ssp-status-badge${emailStatus.pending || !profile.user.email_verified ? " ssp-status-badge--pending" : ""}`}>
                      {emailStatus.pending || !profile.user.email_verified ? "Beklemede" : "Onaylandı"}
                    </span>
                  </div>
                </div>
                <input className="ssp-field__input" value={form.user_email} onChange={e => set("user_email", e.target.value)} placeholder="ornek@firma.com" />
              </label>
            </div>
            <p className="ssp-hint">
              E-posta değişikliğinde yeni adrese doğrulama maili gönderilir.
              {emailStatus.pending && emailStatus.pendingEmail ? ` Bekleyen onay: ${emailStatus.pendingEmail}` : ""}
            </p>
            <p className="ssp-hint">İş maili mailbox eşlemesi için kullanılır; giriş e-postasından farklı olabilir.</p>
            <p className="ssp-hint">Şirkette toplam {profile.supplier.authorized_users_count} yetkili bulunuyor.</p>

            <div className="ssp-team-list">
              {authorizedUsers.map((teamUser) => (
                <div key={teamUser.id} className="ssp-team-row">
                  {editingUser === teamUser.id ? (
                    <>
                      <input
                        className="ssp-team-input"
                        value={editingUserForm.name}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, name: e.target.value }))}
                        aria-label="Ad Soyad"
                      />
                      <input
                        className="ssp-team-input"
                        value={editingUserForm.phone}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, phone: e.target.value }))}
                        aria-label="Telefon"
                      />
                      <input
                        className="ssp-team-input"
                        value={editingUserForm.email}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, email: e.target.value }))}
                        aria-label="E-posta"
                      />
                      <div className="ssp-team-actions">
                        <button type="button" className="ssp-mini-action-btn" onClick={() => void saveTeamUser(teamUser.id)}>Kaydet</button>
                        <button type="button" className="ssp-mini-action-btn" onClick={() => setEditingUser(null)}>Vazgeç</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ssp-team-cell"><strong>{teamUser.name}</strong>{teamUser.is_default ? " (Varsayılan)" : ""}</div>
                      <div className="ssp-team-cell">{teamUser.phone || "-"}</div>
                      <div className="ssp-team-cell">{teamUser.email}</div>
                      <div className="ssp-team-actions">
                        {isCurrentUserDefault && !teamUser.is_default && (
                          <>
                            <button type="button" className="ssp-mini-action-btn" onClick={() => beginEditTeamUser(teamUser)}>Düzenle</button>
                            <button type="button" className="ssp-mini-action-btn" onClick={() => void removeTeamUser(teamUser.id)}>Sil</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=certificates")}>🏅 Sertifika Yükle</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=company_docs")}>📁 Şirket Evrakları</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=personnel_docs")}>👥 Personel Evrakları</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/finance")}>💳 Finans Modülü</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=guarantee_docs")}>🛡️ Alınan Teminatlar</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=contracts")}>📄 Sözleşmelerim</button>
              <button type="button" className="ssp-sub-btn" onClick={() => navigate("/supplier/workspace?tab=offers")}>💬 Tekliflerim</button>
            </div>
            <p className="ssp-hint">Evraklar bu ekranda listelenmez; ilgili sekmede goruntulenir.</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="ssp-hidden"
            onChange={handleLogoChange}
            aria-label="Logo dosyası seç"
          />
        </div>

        {/* Invoice section */}
        <div className="ssp-card">
          <button type="button" className="ssp-section-hdr" onClick={() => toggleSection("invoice")}>
            <h3>Fatura ve Vergi Bilgileri</h3>
            <span className={`ssp-section-hdr__arrow${openSections.invoice ? " ssp-section-hdr__arrow--open" : ""}`}>⌄</span>
          </button>
          {openSections.invoice && (
            <>
              <div className="ssp-grid">
                <label className="ssp-field"><span>Firma Fatura Ünvanı</span><input className="ssp-field__input" value={form.invoice_name} onChange={e => set("invoice_name", e.target.value)} /></label>
                <label className="ssp-field"><span>Vergi Dairesi</span><input className="ssp-field__input" value={form.tax_office} onChange={e => set("tax_office", e.target.value)} /></label>
                <label className="ssp-field"><span>Vergi Numarası</span><input className="ssp-field__input" value={form.tax_number} onChange={e => set("tax_number", e.target.value)} /></label>
                <label className="ssp-field"><span>Ticaret Sicil No</span><input className="ssp-field__input" value={form.registration_number} onChange={e => set("registration_number", e.target.value)} /></label>
                <div className="ssp-full-width"><label className="ssp-field"><span>Fatura Adresi</span><input className="ssp-field__input" value={form.invoice_address} onChange={e => set("invoice_address", e.target.value)} /></label></div>
                <label className="ssp-field"><span>Fatura İli</span><AutocompleteInput value={form.invoice_city} onChange={v => set("invoice_city", v)} options={cityNames} /></label>
                <label className="ssp-field"><span>Fatura İlçesi</span><AutocompleteInput value={form.invoice_district} onChange={v => set("invoice_district", v)} options={districts} disabled={!form.invoice_city} /></label>
                <label className="ssp-field"><span>Fatura Posta Kodu</span><input className="ssp-field__input" value={form.invoice_postal_code} onChange={e => set("invoice_postal_code", e.target.value)} /></label>
              </div>
              <button type="button" className="ssp-map-btn" onClick={() => {
                if (!faturaMapUrl) void findLocation("fatura", [form.invoice_address, form.invoice_district, form.invoice_city]);
                setShowFaturaMap(v => !v);
              }}>
                {showFaturaMap ? "Fatura Konumunu Gizle" : "Fatura Konumunu Aç"}
              </button>
              {showFaturaMap && faturaMapUrl && (
                <>
                  <iframe className="ssp-map-frame" src={faturaMapUrl} title="Fatura Konumu" loading="lazy" allowFullScreen />
                  {faturaGoogleUrl && (
                    <div className="ssp-map-actions">
                      <a className="ssp-share-btn" href={faturaGoogleUrl} target="_blank" rel="noreferrer">🗺️ Google Maps'te Aç</a>
                      <a className="ssp-share-btn" href={`https://wa.me/?text=${encodeURIComponent(`Fatura konumu: ${faturaGoogleUrl}`)}`} target="_blank" rel="noreferrer">📲 WhatsApp ile Paylaş</a>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Address section */}
        <div className="ssp-card">
          <button type="button" className="ssp-section-hdr" onClick={() => toggleSection("address")}>
            <h3>Firma Adresi ve Web</h3>
            <span className={`ssp-section-hdr__arrow${openSections.address ? " ssp-section-hdr__arrow--open" : ""}`}>⌄</span>
          </button>
          {openSections.address && (
            <>
              <div className="ssp-grid">
                <div className="ssp-full-width"><label className="ssp-field"><span>Adres</span><input className="ssp-field__input" value={form.address} onChange={e => set("address", e.target.value)} /></label></div>
                <label className="ssp-field"><span>Şehir / İl</span><AutocompleteInput value={form.city} onChange={v => set("city", v)} options={cityNames} /></label>
                <label className="ssp-field"><span>İlçe</span><AutocompleteInput value={form.address_district} onChange={v => set("address_district", v)} options={addressDistricts} disabled={!form.city} /></label>
                <label className="ssp-field"><span>Posta Kodu</span><input className="ssp-field__input" value={form.postal_code} onChange={e => set("postal_code", e.target.value)} /></label>
                <div className="ssp-full-width"><label className="ssp-field"><span>Web Sitesi</span><input className="ssp-field__input" value={form.supplier_website} onChange={e => set("supplier_website", e.target.value)} /></label></div>
              </div>
              <button type="button" className="ssp-map-btn" onClick={() => {
                if (!firmaMapUrl) void findLocation("firma", [form.address, form.address_district, form.city]);
                setShowFirmaMap(v => !v);
              }}>
                {showFirmaMap ? "Firma Konumunu Gizle" : "Firma Konumunu Aç"}
              </button>
              {showFirmaMap && firmaMapUrl && (
                <>
                  <iframe className="ssp-map-frame" src={firmaMapUrl} title="Firma Konumu" loading="lazy" allowFullScreen />
                  {firmaGoogleUrl && (
                    <div className="ssp-map-actions">
                      <a className="ssp-share-btn" href={firmaGoogleUrl} target="_blank" rel="noreferrer">🗺️ Google Maps'te Aç</a>
                      <a className="ssp-share-btn" href={`https://wa.me/?text=${encodeURIComponent(`Firma konumu: ${firmaGoogleUrl}`)}`} target="_blank" rel="noreferrer">📲 WhatsApp ile Paylaş</a>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Payment section */}
        <div className="ssp-card">
          <button type="button" className="ssp-section-hdr" onClick={() => toggleSection("payment")}>
            <h3>Ödeme Bilgileri</h3>
            <span className={`ssp-section-hdr__arrow${openSections.payment ? " ssp-section-hdr__arrow--open" : ""}`}>⌄</span>
          </button>
          {openSections.payment && (
            <div className="ssp-payment-stack">
              <p className="ssp-hint">Firma için birden fazla banka hesabı ekleyebilir, hesapları TL ve Döviz olarak ayırabilir ve çek vadelerini tanımlayabilirsiniz.</p>

              {form.payment_accounts.length === 0 && (
                <div className="ssp-payment-card ssp-payment-card--empty">Henüz ödeme hesabı eklenmedi.</div>
              )}

              {form.payment_accounts.map((account, index) => (
                <div key={`${account.bank_key || "bank"}-${index}`} className="ssp-payment-card">
                  <div className="ssp-payment-card__header">
                    <h4>Hesap {index + 1}</h4>
                    <button type="button" className="ssp-ghost-btn ssp-ghost-btn--danger" onClick={() => removePaymentAccount(index)}>
                      Hesabı Sil
                    </button>
                  </div>

                  <div className="ssp-grid">
                    <label className="ssp-field">
                      <span>Hesap Türü</span>
                      <select className="ssp-select" value={account.account_type} onChange={e => updatePaymentAccount(index, { account_type: e.target.value as "tl" | "doviz" })}>
                        <option value="tl">TL</option>
                        <option value="doviz">Döviz</option>
                      </select>
                    </label>
                    <label className="ssp-field">
                      <span>IBAN</span>
                      <input
                        className="ssp-field__input"
                        value={account.iban}
                        onChange={e => updatePaymentAccount(index, { iban: e.target.value.toUpperCase() })}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                      />
                    </label>
                    <div className="ssp-full-width">
                      <span className="ssp-bank-section-label">Banka Seçimi</span>
                      <div className="ssp-bank-grid">
                        {BANK_OPTIONS.map((bank) => (
                          <button
                            key={bank.key}
                            type="button"
                            className={`ssp-bank-option ssp-bank-option--${bank.key}${account.bank_key === bank.key ? " ssp-bank-option--active" : ""}`}
                            onClick={() => updatePaymentAccount(index, { bank_key: bank.key, bank_name: bank.name })}
                          >
                            <span className={`ssp-bank-badge ssp-bank-badge--${bank.key}`}>{bank.short}</span>
                            <div className="ssp-bank-meta">
                              <strong>{bank.name}</strong>
                              <span>{bank.short} hesabı</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <button type="button" className="ssp-ghost-btn" onClick={addPaymentAccount}>+ Yeni Hesap Ekle</button>
              </div>

              <div className="ssp-payment-card">
                <div className="ssp-payment-card__header">
                  <h4>Çek Vadeleri</h4>
                </div>
                <div className="ssp-grid">
                  <div className="ssp-full-width">
                    <label className="ssp-inline-checkbox">
                      <input
                        type="checkbox"
                        checked={form.accepts_checks}
                        onChange={e => setForm(prev => prev ? { ...prev, accepts_checks: e.target.checked, preferred_check_term: e.target.checked ? prev.preferred_check_term : "" } : prev)}
                      />
                      Firma çek kabul ediyor
                    </label>
                  </div>
                  {form.accepts_checks && (
                    <div className="ssp-full-width">
                      <label className="ssp-field">
                        <span>Tercih Edilen Çek Vadesi</span>
                        <input
                          className="ssp-field__input"
                          value={form.preferred_check_term}
                          onChange={e => set("preferred_check_term", e.target.value)}
                          placeholder="Örn: 30 gün, 45 gün, ay sonu + 30"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Categories section */}
        <div className="ssp-card">
          <button type="button" className="ssp-section-hdr" onClick={() => toggleSection("categories")}>
            <h3>Kategori ve Görünürlük</h3>
            <span className={`ssp-section-hdr__arrow${openSections.categories ? " ssp-section-hdr__arrow--open" : ""}`}>⌄</span>
          </button>
          {openSections.categories && (
            <div className="ssp-cat-section">
              <div>
                <div className="ssp-cat-section__label ssp-cat-section__label--teal">Sizin yönettiğiniz kategoriler</div>
                <button type="button" className="ssp-ghost-btn" onClick={() => setShowCategoryModal(true)}>Kategori Seç</button>
                <div className="ssp-cat-pills">
                  {form.category_tags.length > 0 ? form.category_tags.map((item) => (
                    <span key={item} className="ssp-cat-pill ssp-cat-pill--teal">{item}</span>
                  )) : <span className="ssp-cat-empty">Henüz görünürlük kategorisi seçmediniz</span>}
                </div>
              </div>
              <div>
                <div className="ssp-cat-section__label ssp-cat-section__label--blue">Stratejik partner tarafından eklenen kategoriler</div>
                <div className="ssp-cat-pills">
                  {(profile.supplier.partner_category_tags || []).length > 0 ? profile.supplier.partner_category_tags.map((item) => (
                    <span key={item} className="ssp-cat-pill ssp-cat-pill--blue">{item}</span>
                  )) : <span className="ssp-cat-empty">Stratejik partner henüz kategori eklemedi</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes section */}
        <div className="ssp-card">
          <button type="button" className="ssp-section-hdr" onClick={() => toggleSection("notes")}>
            <h3>Önemli Notlar</h3>
            <span className={`ssp-section-hdr__arrow${openSections.notes ? " ssp-section-hdr__arrow--open" : ""}`}>⌄</span>
          </button>
          {openSections.notes && (
            <label className="ssp-field">
              <span>Notlar</span>
              <textarea className="ssp-field__textarea" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </label>
          )}
        </div>

        <div className="ssp-footer-bar">
          <button type="button" className="ssp-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Kaydediliyor..." : "💾 Profili Kaydet"}
          </button>
        </div>

        <CategorySelectionModal
          isOpen={showCategoryModal}
          title="Bulunmak İstediğiniz Kategoriler"
          subtitle="Bu seçimler, alıcıların sizi ararken kullandığı görünürlük ve davet filtrelerini besler."
          availableOptions={COMPANY_CATEGORY_OPTIONS}
          value={form.category_tags}
          maxSelectionCount={5}
          onClose={() => setShowCategoryModal(false)}
          onSave={(value) => {
            setForm((prev) => prev ? { ...prev, category_tags: value } : prev);
            setShowCategoryModal(false);
          }}
        />
      </div>

      {toast && <div className={`ssp-toast ssp-toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
