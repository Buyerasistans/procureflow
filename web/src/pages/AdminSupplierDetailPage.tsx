import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createAdminSupplierGuarantee,
  createAdminSupplierUser,
  deleteAdminSupplierGuarantee,
  deleteAdminSupplierUser,
  getAdminSupplierManagementDetail,
  resendAdminSupplierMagicLink,
  sendAdminSupplierEmail,
  setAdminSupplierDefaultUser,
  updateAdminSupplierGuarantee,
  updateAdminSupplierManagementDetail,
  updateAdminSupplierUser,
  type AdminSupplierManagementResponse,
  type AdminSupplierPaymentAccount,
  type AdminSupplierUser,
} from "../services/admin.service";
import { COMPANY_CATEGORY_OPTIONS } from "../constants/companyCategories";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import { CategorySelectionModal } from "../components/CategorySelectionModal";
import "./AdminSupplierDetailPage.css";

const BANKS = [
  { key: "ziraat", name: "Ziraat Bankası" },
  { key: "isbank", name: "İş Bankası" },
  { key: "garanti", name: "Garanti BBVA" },
  { key: "yapikredi", name: "Yapı Kredi" },
  { key: "akbank", name: "Akbank" },
  { key: "vakifbank", name: "VakıfBank" },
  { key: "halkbank", name: "Halkbank" },
  { key: "qnb", name: "QNB" },
  { key: "denizbank", name: "DenizBank" },
];

type GuaranteeEditState = {
  title: string;
  guarantee_type: string;
  amount: string;
  currency: string;
  issued_at: string;
  expires_at: string;
  status: string;
};

type SectionKey = "invoice" | "payment" | "users" | "guarantees";

type UserDraft = { name: string; email: string; phone: string };

function defaultSupplierForm(data: AdminSupplierManagementResponse["supplier"]) {
  return {
    company_name: data.company_name || "",
    company_title: data.company_title || "",
    phone: data.phone || "",
    email: data.email || "",
    website: data.website || "",
    address: data.address || "",
    city: data.city || "",
    address_district: data.address_district || "",
    postal_code: data.postal_code || "",
    invoice_name: data.invoice_name || "",
    invoice_address: data.invoice_address || "",
    invoice_city: data.invoice_city || "",
    invoice_district: data.invoice_district || "",
    invoice_postal_code: data.invoice_postal_code || "",
    tax_number: data.tax_number || "",
    registration_number: data.registration_number || "",
    tax_office: data.tax_office || "",
    notes: data.notes || "",
    category: data.category || "",
    category_tags: data.category_tags || [],
    partner_category_tags: data.partner_category_tags || [],
    effective_category_tags: data.effective_category_tags || [],
    accepts_checks: !!data.accepts_checks,
    preferred_check_term: data.preferred_check_term || "",
    payment_accounts: data.payment_accounts || [],
  };
}

function normalizeDate(v?: string | null): string {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function sectionArrow(isOpen: boolean): string {
  return isOpen ? "▲" : "▼";
}

function normalizeTrPhone(phone?: string | null): string {
  if (!phone) return "";
  let n = phone.replace(/\D/g, "");
  if (n.startsWith("0090")) n = n.slice(4);
  if (n.startsWith("90") && n.length >= 12) n = n.slice(2);
  if (n.startsWith("0") && n.length >= 11) n = n.slice(1);
  return n;
}

function isLikelyMobilePhone(phone?: string | null): boolean {
  const n = normalizeTrPhone(phone);
  return n.length >= 10 && n.startsWith("5");
}

export default function AdminSupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const supplierId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [detail, setDetail] = useState<AdminSupplierManagementResponse | null>(null);
  const [form, setForm] = useState<ReturnType<typeof defaultSupplierForm> | null>(null);

  const [showFirmMap, setShowFirmMap] = useState(true);
  const [showInvoiceMap, setShowInvoiceMap] = useState(true);
  const [showPartnerCategoryModal, setShowPartnerCategoryModal] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "verified" | "unverified">("all");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", phone: "" });
  const [editingUsers, setEditingUsers] = useState<Record<number, UserDraft>>({});

  const [newGuarantee, setNewGuarantee] = useState({
    title: "",
    guarantee_type: "",
    amount: "",
    currency: "TRY",
    issued_at: "",
    expires_at: "",
  });
  const [editingGuaranteeId, setEditingGuaranteeId] = useState<number | null>(null);
  const [editingGuarantee, setEditingGuarantee] = useState<GuaranteeEditState | null>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [resendingMagicUserId, setResendingMagicUserId] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    invoice: false,
    users: true,
    guarantees: true,
    payment: true,
  });

  const cityNames = useMemo(() => getCityNames(), []);
  const cityDistricts = useMemo(() => (form?.city ? getDistricts(form.city) : []), [form?.city]);
  const invoiceDistricts = useMemo(() => (form?.invoice_city ? getDistricts(form.invoice_city) : []), [form?.invoice_city]);

  const filteredUsers = useMemo(() => {
    if (!detail) return [];
    return detail.users.filter((u) => {
      const queryOk = [u.name, u.email, u.phone || ""].join(" ").toLowerCase().includes(userQuery.toLowerCase());
      const filterOk = userFilter === "all" ? true : userFilter === "verified" ? u.email_verified : !u.email_verified;
      return queryOk && filterOk;
    });
  }, [detail, userQuery, userFilter]);

  const logoSrc = useMemo(() => {
    const url = detail?.supplier.logo_url;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    return `${apiBase}${url}`;
  }, [detail?.supplier.logo_url]);

  const defaultContact = useMemo(() => {
    if (!detail) return null;
    return detail.users.find((u) => u.is_default) || detail.users[0] || null;
  }, [detail]);

  const supplierInviteStatus = useMemo(() => {
    if (!detail) return { label: "Durum bilinmiyor", tone: "neutral" as const };
    const hasRegisteredUser = detail.users.some((user) => Boolean(user.password_set));
    const hasVerifiedUser = detail.users.some((user) => Boolean(user.email_verified));
    if (hasRegisteredUser && hasVerifiedUser) {
      return { label: "Profil erişimi aktif", tone: "success" as const };
    }
    if (detail.users_count > 0) {
      return { label: "Davet gönderildi, kayıt bekleniyor", tone: "warning" as const };
    }
    return { label: "Henüz davetli yetkili yok", tone: "neutral" as const };
  }, [detail]);

  const getMapLink = (address: string, district: string, city: string) => {
    const q = [address, district, city, "Türkiye"].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  };

  const getMapEmbedSrc = (address: string, district: string, city: string) => {
    const q = [address, district, city, "Türkiye"].filter(Boolean).join(", ");
    return `https://maps.google.com/maps?output=embed&t=k&q=${encodeURIComponent(q)}`;
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const load = useCallback(async () => {
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      setError("Geçersiz tedarikçi kimliği");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminSupplierManagementDetail(supplierId);
      setDetail(data);
      setForm(defaultSupplierForm(data.supplier));
      setEditingUsers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detay yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveSupplier() {
    if (!form) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updateAdminSupplierManagementDetail(supplierId, {
        ...form,
        preferred_check_term: form.accepts_checks ? form.preferred_check_term : "",
      });
      setSuccess("Tedarikçi bilgileri güncellendi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydetme hatası");
    } finally {
      setSaving(false);
    }
  }

  function startEditUser(user: AdminSupplierUser) {
    setEditingUsers((prev) => ({
      ...prev,
      [user.id]: { name: user.name, email: user.email, phone: user.phone || "" },
    }));
  }

  function cancelEditUser(userId: number) {
    setEditingUsers((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  async function saveEditUser(userId: number) {
    const draft = editingUsers[userId];
    if (!draft) return;
    try {
      await updateAdminSupplierUser(supplierId, userId, draft);
      setSuccess("Yetkili güncellendi");
      cancelEditUser(userId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yetkili güncellenemedi");
    }
  }

  async function handleAddUser() {
    if (!newUser.name || !newUser.email) {
      setError("Kullanıcı adı ve e-posta zorunludur");
      return;
    }
    try {
      await createAdminSupplierUser(supplierId, newUser);
      setNewUser({ name: "", email: "", phone: "" });
      setShowAddUser(false);
      setSuccess("Kullanıcı eklendi ve davet e-postası gönderildi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kullanıcı eklenemedi");
    }
  }

  async function handleDeleteGuarantee(guaranteeId: number) {
    if (!window.confirm("Teminat kaydını silmek istiyor musunuz?")) return;
    try {
      await deleteAdminSupplierGuarantee(supplierId, guaranteeId);
      setSuccess("Teminat silindi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Teminat silinemedi");
    }
  }

  async function handleAddGuarantee() {
    if (!newGuarantee.title || !newGuarantee.guarantee_type) {
      setError("Teminat başlığı ve türü zorunludur");
      return;
    }
    try {
      await createAdminSupplierGuarantee(supplierId, {
        title: newGuarantee.title,
        guarantee_type: newGuarantee.guarantee_type,
        amount: newGuarantee.amount ? Number(newGuarantee.amount) : null,
        currency: newGuarantee.currency,
        issued_at: newGuarantee.issued_at || null,
        expires_at: newGuarantee.expires_at || null,
      });
      setNewGuarantee({ title: "", guarantee_type: "", amount: "", currency: "TRY", issued_at: "", expires_at: "" });
      setSuccess("Teminat eklendi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Teminat eklenemedi");
    }
  }

  async function saveGuaranteeEdit() {
    if (!editingGuaranteeId || !editingGuarantee) return;
    try {
      await updateAdminSupplierGuarantee(supplierId, editingGuaranteeId, {
        title: editingGuarantee.title,
        guarantee_type: editingGuarantee.guarantee_type,
        amount: editingGuarantee.amount ? Number(editingGuarantee.amount) : null,
        currency: editingGuarantee.currency,
        issued_at: editingGuarantee.issued_at || null,
        expires_at: editingGuarantee.expires_at || null,
        status: editingGuarantee.status,
      });
      setEditingGuaranteeId(null);
      setEditingGuarantee(null);
      setSuccess("Teminat güncellendi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Teminat güncellenemedi");
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!window.confirm("Bu yetkiliyi silmek istiyor musunuz?")) return;
    try {
      await deleteAdminSupplierUser(supplierId, userId);
      setSuccess("Yetkili silindi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yetkili silinemedi");
    }
  }

  async function handleSetDefaultUser(userId: number) {
    try {
      await setAdminSupplierDefaultUser(supplierId, userId);
      setSuccess("Varsayılan yetkili güncellendi");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Varsayılan yetkili güncellenemedi");
    }
  }

  async function handleResendUserMagicLink(teamUser: AdminSupplierUser) {
    if (!id) return;
    try {
      setResendingMagicUserId(teamUser.id);
      const result = await resendAdminSupplierMagicLink(Number(id), teamUser.id);
      if (result.magic_link_sent) {
        setSuccess(`Magic link tekrar gönderildi: ${teamUser.email}`);
        setError(null);
      } else {
        setError(result.message || "Magic link yenilendi ancak e-posta gönderilemedi");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Magic link tekrar gönderilemedi");
    } finally {
      setResendingMagicUserId(null);
    }
  }

  function shareOnWhatsapp() {
    if (!form) return;
    const mapLink = getMapLink(form.address, form.address_district, form.city);
    const defaultLine = defaultContact
      ? `Yetkili: ${defaultContact.name}\nTelefon: ${defaultContact.phone || "-"}\nE-posta: ${defaultContact.email}`
      : "Yetkili: -";

    const message = [
      form.company_name || "-",
      form.address || "-",
      `${form.city || "-"}/${form.address_district || "-"}`,
      "",
      defaultLine,
      `Konum: ${mapLink}`,
    ].join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function callPhone(phone?: string | null) {
    const normalized = normalizeTrPhone(phone);
    if (!normalized) return;
    window.location.href = `tel:+90${normalized}`;
  }

  function messageWhatsapp(phone?: string | null) {
    const normalized = normalizeTrPhone(phone);
    if (!normalized) return;
    window.open(`https://wa.me/90${normalized}`, "_blank", "noopener,noreferrer");
  }

  function openEmailComposer(targetEmail?: string | null) {
    if (!targetEmail) return;
    setEmailTo(targetEmail);
    setEmailCc("");
    setEmailSubject(`${form?.company_name || "Tedarikçi"} - Bilgilendirme`);
    setEmailBody("Merhaba,\n\n");
    setEmailFiles([]);
    setShowEmailModal(true);
  }

  async function handleSendEmail() {
    if (!emailTo || !emailSubject) {
      setError("E-posta alıcısı ve konu zorunludur");
      return;
    }
    try {
      setEmailSending(true);
      await sendAdminSupplierEmail(supplierId, {
        to_email: emailTo,
        subject: emailSubject,
        body: emailBody,
        cc: emailCc || undefined,
        attachments: emailFiles,
      });
      setSuccess("E-posta gönderildi");
      setShowEmailModal(false);
    } catch (e) {
      const errDetail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(errDetail || "E-posta gönderilemedi");
    } finally {
      setEmailSending(false);
    }
  }

  if (loading) return <div className="asd-page">Yükleniyor...</div>;
  if (!detail || !form) return <div className="asd-page">Veri bulunamadı.</div>;

  return (
    <div className="asd-page">
      {error && <div className="asd-msg asd-msg--error">{error}</div>}
      {success && <div className="asd-msg">{success}</div>}

      <div className="asd-header-row">
        <h2>Tedarikçiyi Görüntüle: {detail.supplier.company_name}</h2>
        <div className="asd-nav-btns">
          <button type="button" className="asd-btn asd-btn--secondary" onClick={() => navigate("/admin?tab=suppliers")}>Tedarikçilere Dön</button>
          <button type="button" className="asd-btn asd-btn--secondary" onClick={() => navigate("/admin")}>Panele Dön</button>
        </div>
      </div>

      <section className="asd-card">
        <div className="asd-header-row">
          <h3>Genel Bilgiler</h3>
          <button type="button" className="asd-btn" disabled={saving} onClick={handleSaveSupplier}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>

        <div className="asd-logo-row">
          <div className="asd-logo-box">
            {logoSrc ? <img src={logoSrc} alt="Firma logosu" /> : <span className="asd-logo-box__empty">Logo Yok</span>}
          </div>
          <div className="asd-logo-row__info">
            <div className="asd-logo-row__name">{form.company_name || "-"}</div>
            <div className="asd-logo-row__hint">Logoyu tedarikçi kendi profilinden günceller.</div>
            <div className="asd-badge-row">
              <span className={`asd-badge asd-badge--${supplierInviteStatus.tone}`}>{supplierInviteStatus.label}</span>
              <span className={`asd-badge ${detail.supplier.address_district || detail.supplier.city ? "asd-badge--info" : ""}`}>
                {detail.supplier.address_district || detail.supplier.city
                  ? `Konum: ${[detail.supplier.city, detail.supplier.address_district].filter(Boolean).join(" / ")}`
                  : "Konum bilgisi davet seviyesinde"}
              </span>
              <span className={`asd-badge ${detail.supplier.partner_category_tags.length > 0 ? "asd-badge--info" : ""}`}>
                {detail.supplier.partner_category_tags.length > 0
                  ? `${detail.supplier.partner_category_tags.length} partner kategorisi`
                  : "Partner kategorisi bekleniyor"}
              </span>
            </div>
            <div className="asd-action-inline">
              <button type="button" className="asd-ghost-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=certificates`)}>Sertifika Yükle</button>
              <button type="button" className="asd-ghost-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=company_docs`)}>Şirket Evrakları</button>
              <button type="button" className="asd-ghost-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=personnel_docs`)}>Personel Evrakları</button>
              <button type="button" className="asd-ghost-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}/finance`)}>Finans Modülü</button>
              <button type="button" className="asd-ghost-btn" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=guarantee_docs`)}>Alınan Teminatlar</button>
            </div>
          </div>
        </div>

        <div className="asd-grid">
          <label className="asd-label">Firma Adı<input className="asd-input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label>
          <label className="asd-label">Ünvan<input className="asd-input" value={form.company_title} onChange={(e) => setForm({ ...form, company_title: e.target.value })} /></label>
          <label className="asd-label">
            Telefon
            <input className="asd-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="asd-action-inline">
              <button type="button" className="asd-mini-btn asd-mini-btn--call" onClick={() => callPhone(form.phone)}>Ara</button>
              <button type="button" className="asd-mini-btn asd-mini-btn--whatsapp" disabled={!isLikelyMobilePhone(form.phone)} onClick={() => messageWhatsapp(form.phone)}>WhatsApp</button>
            </div>
          </label>
          <label className="asd-label">
            E-posta
            <input className="asd-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="asd-action-inline">
              <button type="button" className="asd-mini-btn asd-mini-btn--mail" onClick={() => openEmailComposer(form.email)}>Mail Gönder</button>
            </div>
          </label>
          <label className="asd-label">Web Sitesi<input className="asd-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
          <label className="asd-label">
            Stratejik Partner Kategorileri
            <button type="button" className="asd-ghost-btn" onClick={() => setShowPartnerCategoryModal(true)}>Kategori Seç</button>
            <div className="asd-cat-pills">
              {form.partner_category_tags.length > 0 ? form.partner_category_tags.map((item) => (
                <span key={item} className="asd-cat-pill asd-cat-pill--blue">{item}</span>
              )) : <span className="asd-cat-pills__empty">Henüz partner kategorisi atanmadı</span>}
            </div>
          </label>
          <label className="asd-label">
            Tedarikçinin Kendi Kategorileri
            <div className="asd-cat-pills">
              {detail.supplier.category_tags.length > 0 ? detail.supplier.category_tags.map((item) => (
                <span key={item} className="asd-cat-pill asd-cat-pill--teal">{item}</span>
              )) : <span className="asd-cat-pills__empty">Tedarikçi kendi görünürlük kategorilerini henüz eklemedi</span>}
            </div>
          </label>

          <label className="asd-label asd-label--full">Adres<textarea className="asd-textarea" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>

          <label className="asd-label">
            Şehir
            <select className="asd-select" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, address_district: "" })}>
              <option value="">Seçiniz</option>
              {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label className="asd-label">
            İlçe
            <select className="asd-select" value={form.address_district} onChange={(e) => setForm({ ...form, address_district: e.target.value })} disabled={!form.city}>
              <option value="">Seçiniz</option>
              {cityDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="asd-label">Posta Kodu<input className="asd-input" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></label>

          <label className="asd-label asd-label--full">Notlar<textarea className="asd-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>

        <div className="asd-map-btns">
          <button type="button" className="asd-ghost-btn" onClick={() => setShowFirmMap((v) => !v)}>
            {showFirmMap ? "Firma Konumunu Gizle" : "Firma Konumunu Aç"}
          </button>
          <button type="button" className="asd-ghost-btn" onClick={shareOnWhatsapp}>WhatsApp Paylaş</button>
        </div>

        {showFirmMap && (
          <div className="asd-map-wrap">
            <iframe
              title="Firma konumu"
              className="asd-map-frame"
              src={getMapEmbedSrc(form.address, form.address_district, form.city)}
              width="100%"
              height="280"
              loading="lazy"
            />
          </div>
        )}
      </section>

      <CategorySelectionModal
        isOpen={showPartnerCategoryModal}
        title="Stratejik Partner Kategorileri"
        subtitle="Bu kategoriler tedarikçiyi partner panelinde hızlı eşleme ve listeleme için etiketler."
        availableOptions={COMPANY_CATEGORY_OPTIONS}
        value={form.partner_category_tags}
        maxSelectionCount={5}
        onClose={() => setShowPartnerCategoryModal(false)}
        onSave={(value) => {
          setForm((prev) => prev ? { ...prev, partner_category_tags: value, category: value[0] || prev.category } : prev);
          setShowPartnerCategoryModal(false);
        }}
      />

      <section className="asd-card">
        <button type="button" className="asd-section-hdr" onClick={() => toggleSection("users")}>
          <h3>Yetkili Kullanıcılar ({detail.users_count})</h3>
          <span className="asd-section-hdr__arrow">{sectionArrow(openSections.users)}</span>
        </button>
        {openSections.users && (
          <>
            <div className="asd-grid">
              <label className="asd-label">Arama<input className="asd-input" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Ad, e-posta, telefon" /></label>
              <label className="asd-label">
                Durum Filtresi
                <select className="asd-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value as "all" | "verified" | "unverified")}>
                  <option value="all">Tümü</option>
                  <option value="verified">Doğrulanmış</option>
                  <option value="unverified">Bekleyen</option>
                </select>
              </label>
            </div>

            <div className="asd-section-footer">
              <button type="button" className="asd-btn" onClick={() => setShowAddUser(true)}>+ Kullanıcı Ekle</button>
            </div>

            <div className="asd-team-list">
              <div className="asd-team-head">
                <div>Ad Soyad</div>
                <div>Telefon</div>
                <div>E-posta</div>
                <div className="asd-th--right">İşlemler</div>
              </div>
              {filteredUsers.map((teamUser) => {
                const editing = editingUsers[teamUser.id];
                return (
                  <div className="asd-team-row" key={teamUser.id}>
                    <div className="asd-team-cell">
                      {editing ? (
                        <input className="asd-input" aria-label="Ad Soyad" value={editing.name} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, name: e.target.value } }))} />
                      ) : (
                        <strong>{teamUser.name}{teamUser.is_default ? " (Varsayılan)" : ""}</strong>
                      )}
                    </div>

                    <div className="asd-team-cell">
                      {editing ? (
                        <input className="asd-input" aria-label="Telefon" value={editing.phone} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, phone: e.target.value } }))} />
                      ) : (
                        <>
                          {teamUser.phone || "-"}
                          <div className="asd-action-inline">
                            <button type="button" className="asd-mini-btn asd-mini-btn--call" onClick={() => callPhone(teamUser.phone)}>Ara</button>
                            <button type="button" className="asd-mini-btn asd-mini-btn--whatsapp" disabled={!isLikelyMobilePhone(teamUser.phone)} onClick={() => messageWhatsapp(teamUser.phone)}>WhatsApp</button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="asd-team-cell">
                      {editing ? (
                        <input className="asd-input" type="email" aria-label="E-posta" value={editing.email} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, email: e.target.value } }))} />
                      ) : (
                        <>
                          {teamUser.email}
                          <div className="asd-badge-row asd-badge-row--mt4">
                            <span className={`asd-badge ${teamUser.password_set ? "asd-badge--success" : "asd-badge--warning"}`}>
                              {teamUser.password_set ? "Kayıt tamamlandı" : "Magic link bekleniyor"}
                            </span>
                            <span className={`asd-badge ${teamUser.email_verified ? "asd-badge--success" : ""}`}>
                              {teamUser.email_verified ? "E-posta onaylı" : "E-posta onayı bekliyor"}
                            </span>
                          </div>
                          <div className="asd-action-inline">
                            <button type="button" className="asd-mini-btn asd-mini-btn--mail" onClick={() => openEmailComposer(teamUser.email)}>Mail Gönder</button>
                            {(!teamUser.password_set || !teamUser.email_verified) && (
                              <button
                                type="button"
                                className="asd-mini-btn asd-mini-btn--mail"
                                onClick={() => void handleResendUserMagicLink(teamUser)}
                                disabled={resendingMagicUserId === teamUser.id}
                              >
                                {resendingMagicUserId === teamUser.id ? "Gönderiliyor..." : "Magic Link Tekrar Gönder"}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="asd-team-actions">
                      {editing ? (
                        <>
                          <button type="button" className="asd-mini-btn" onClick={() => void saveEditUser(teamUser.id)}>Kaydet</button>
                          <button type="button" className="asd-mini-btn" onClick={() => cancelEditUser(teamUser.id)}>Vazgeç</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="asd-mini-btn" onClick={() => startEditUser(teamUser)}>Düzenle</button>
                          {!teamUser.is_default && <button type="button" className="asd-mini-btn" onClick={() => void handleSetDefaultUser(teamUser.id)}>Varsayılan Yap</button>}
                          {!teamUser.is_default && <button type="button" className="asd-mini-btn" onClick={() => void handleDeleteUser(teamUser.id)}>Sil</button>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="asd-card">
        <button type="button" className="asd-section-hdr" onClick={() => toggleSection("invoice")}>
          <h3>Fatura Bilgileri</h3>
          <span className="asd-section-hdr__arrow">{sectionArrow(openSections.invoice)}</span>
        </button>
        {openSections.invoice && (
          <>
            <div className="asd-grid">
              <label className="asd-label">Fatura Ünvanı<input className="asd-input" value={form.invoice_name} onChange={(e) => setForm({ ...form, invoice_name: e.target.value })} /></label>
              <label className="asd-label">Vergi Dairesi<input className="asd-input" value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} /></label>
              <label className="asd-label">Vergi No<input className="asd-input" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></label>
              <label className="asd-label">Sicil No<input className="asd-input" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></label>

              <label className="asd-label asd-label--full">Fatura Adresi<textarea className="asd-textarea" rows={2} value={form.invoice_address} onChange={(e) => setForm({ ...form, invoice_address: e.target.value })} /></label>

              <label className="asd-label">
                Fatura Şehir
                <select className="asd-select" value={form.invoice_city} onChange={(e) => setForm({ ...form, invoice_city: e.target.value, invoice_district: "" })}>
                  <option value="">Seçiniz</option>
                  {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
              <label className="asd-label">
                Fatura İlçe
                <select className="asd-select" value={form.invoice_district} onChange={(e) => setForm({ ...form, invoice_district: e.target.value })} disabled={!form.invoice_city}>
                  <option value="">Seçiniz</option>
                  {invoiceDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="asd-label">Fatura Posta Kodu<input className="asd-input" value={form.invoice_postal_code} onChange={(e) => setForm({ ...form, invoice_postal_code: e.target.value })} /></label>
            </div>

            <div className="asd-section-footer--mt10">
              <button type="button" className="asd-ghost-btn" onClick={() => setShowInvoiceMap((v) => !v)}>
                {showInvoiceMap ? "Fatura Konumunu Gizle" : "Fatura Konumunu Aç"}
              </button>
            </div>

            {showInvoiceMap && (
              <div className="asd-map-wrap">
                <iframe
                  title="Fatura konumu"
                  className="asd-map-frame"
                  src={getMapEmbedSrc(form.invoice_address, form.invoice_district, form.invoice_city)}
                  width="100%"
                  height="280"
                  loading="lazy"
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="asd-card">
        <button type="button" className="asd-section-hdr" onClick={() => toggleSection("guarantees")}>
          <h3>Teminatlar</h3>
          <span className="asd-section-hdr__arrow">{sectionArrow(openSections.guarantees)}</span>
        </button>
        {openSections.guarantees && (
          <>
            <div className="asd-grid">
              <label className="asd-label">Başlık<input className="asd-input" value={newGuarantee.title} onChange={(e) => setNewGuarantee({ ...newGuarantee, title: e.target.value })} /></label>
              <label className="asd-label">Tür<input className="asd-input" value={newGuarantee.guarantee_type} onChange={(e) => setNewGuarantee({ ...newGuarantee, guarantee_type: e.target.value })} /></label>
              <label className="asd-label">Tutar<input className="asd-input" value={newGuarantee.amount} onChange={(e) => setNewGuarantee({ ...newGuarantee, amount: e.target.value })} /></label>
              <label className="asd-label">Para Birimi<input className="asd-input" value={newGuarantee.currency} onChange={(e) => setNewGuarantee({ ...newGuarantee, currency: e.target.value.toUpperCase() })} /></label>
              <label className="asd-label">Veriliş Tarihi<input className="asd-input" type="date" value={newGuarantee.issued_at} onChange={(e) => setNewGuarantee({ ...newGuarantee, issued_at: e.target.value })} /></label>
              <label className="asd-label">Bitiş Tarihi<input className="asd-input" type="date" value={newGuarantee.expires_at} onChange={(e) => setNewGuarantee({ ...newGuarantee, expires_at: e.target.value })} /></label>
            </div>
            <div className="asd-section-footer">
              <button type="button" className="asd-btn" onClick={() => void handleAddGuarantee()}>Teminat Ekle</button>
            </div>

            <div className="asd-guarantee-list">
              {detail.guarantees.map((g) => (
                <section className="asd-card" key={g.id}>
                  <div className="asd-header-row">
                    <div>
                      <strong>{g.title}</strong>
                      <div>{g.guarantee_type} | {g.amount ?? "-"} {g.currency || "TRY"}</div>
                      <div>Durum: {g.status} | Bitiş: {g.expires_at || "-"}</div>
                    </div>
                    <div className="asd-guarantee-actions">
                      <button
                        type="button"
                        className="asd-btn asd-btn--secondary"
                        onClick={() => {
                          setEditingGuaranteeId(g.id);
                          setEditingGuarantee({
                            title: g.title,
                            guarantee_type: g.guarantee_type,
                            amount: g.amount == null ? "" : String(g.amount),
                            currency: g.currency || "TRY",
                            issued_at: normalizeDate(g.issued_at),
                            expires_at: normalizeDate(g.expires_at),
                            status: g.status || "active",
                          });
                        }}
                      >
                        Düzenle
                      </button>
                      <button type="button" className="asd-btn asd-btn--danger" onClick={() => void handleDeleteGuarantee(g.id)}>Sil</button>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="asd-card">
        <button type="button" className="asd-section-hdr" onClick={() => toggleSection("payment")}>
          <h3>Ödeme ve Çek Ayarları</h3>
          <span className="asd-section-hdr__arrow">{sectionArrow(openSections.payment)}</span>
        </button>
        {openSections.payment && (
          <>
            <div className="asd-grid">
              <label className="asd-label">
                Çek Kabulü
                <select className="asd-select" value={form.accepts_checks ? "yes" : "no"} onChange={(e) => setForm({ ...form, accepts_checks: e.target.value === "yes" })}>
                  <option value="yes">Evet</option>
                  <option value="no">Hayır</option>
                </select>
              </label>
              <label className="asd-label">
                Tercih Edilen Çek Vadesi
                <input className="asd-input" value={form.preferred_check_term} onChange={(e) => setForm({ ...form, preferred_check_term: e.target.value })} disabled={!form.accepts_checks} />
              </label>
            </div>

            <div className="asd-payment-list">
              {form.payment_accounts.map((acc, idx) => (
                <section className="asd-card" key={`${acc.bank_name}-${idx}`}>
                  <div className="asd-grid">
                    <label className="asd-label">
                      Banka
                      <select
                        className="asd-select"
                        value={acc.bank_key || ""}
                        onChange={(e) => {
                          const bank = BANKS.find((b) => b.key === e.target.value);
                          const next = [...form.payment_accounts] as AdminSupplierPaymentAccount[];
                          next[idx] = { ...next[idx], bank_key: bank?.key || null, bank_name: bank?.name || "" };
                          setForm({ ...form, payment_accounts: next });
                        }}
                      >
                        <option value="">Seçiniz</option>
                        {BANKS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
                      </select>
                    </label>
                    <label className="asd-label">IBAN<input className="asd-input" value={acc.iban} onChange={(e) => {
                      const next = [...form.payment_accounts] as AdminSupplierPaymentAccount[];
                      next[idx] = { ...next[idx], iban: e.target.value };
                      setForm({ ...form, payment_accounts: next });
                    }} /></label>
                    <label className="asd-label">
                      Hesap Türü
                      <select
                        className="asd-select"
                        value={acc.account_type}
                        onChange={(e) => {
                          const next = [...form.payment_accounts] as AdminSupplierPaymentAccount[];
                          next[idx] = { ...next[idx], account_type: e.target.value as "tl" | "doviz" };
                          setForm({ ...form, payment_accounts: next });
                        }}
                      >
                        <option value="tl">TL</option>
                        <option value="doviz">Döviz</option>
                      </select>
                    </label>
                    <button type="button" className="asd-btn asd-btn--danger" onClick={() => setForm({ ...form, payment_accounts: form.payment_accounts.filter((_, i) => i !== idx) })}>
                      Hesabı Sil
                    </button>
                  </div>
                </section>
              ))}

              <button
                type="button"
                className="asd-btn asd-btn--secondary"
                onClick={() => setForm({
                  ...form,
                  payment_accounts: [...form.payment_accounts, { bank_name: "", iban: "", account_type: "tl", bank_key: null }],
                })}
              >
                + Hesap Ekle
              </button>
            </div>
          </>
        )}
      </section>

      {showAddUser && (
        <div className="asd-modal-back" onClick={() => setShowAddUser(false)}>
          <div className="asd-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Yeni Yetkili Ekle</h3>
            <div className="asd-grid">
              <label className="asd-label">Ad Soyad<input className="asd-input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></label>
              <label className="asd-label">E-posta<input className="asd-input" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
              <label className="asd-label">Telefon<input className="asd-input" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} /></label>
            </div>
            <div className="asd-modal-footer">
              <button type="button" className="asd-btn asd-btn--secondary" onClick={() => setShowAddUser(false)}>İptal</button>
              <button type="button" className="asd-btn" onClick={() => void handleAddUser()}>Kullanıcı Ekle</button>
            </div>
          </div>
        </div>
      )}

      {editingGuaranteeId && editingGuarantee && (
        <div className="asd-modal-back" onClick={() => { setEditingGuaranteeId(null); setEditingGuarantee(null); }}>
          <div className="asd-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Teminat Düzenle</h3>
            <div className="asd-grid">
              <label className="asd-label">Başlık<input className="asd-input" value={editingGuarantee.title} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, title: e.target.value })} /></label>
              <label className="asd-label">Tür<input className="asd-input" value={editingGuarantee.guarantee_type} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, guarantee_type: e.target.value })} /></label>
              <label className="asd-label">Tutar<input className="asd-input" value={editingGuarantee.amount} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, amount: e.target.value })} /></label>
              <label className="asd-label">Para Birimi<input className="asd-input" value={editingGuarantee.currency} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, currency: e.target.value.toUpperCase() })} /></label>
              <label className="asd-label">Veriliş Tarihi<input className="asd-input" type="date" value={editingGuarantee.issued_at} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, issued_at: e.target.value })} /></label>
              <label className="asd-label">Bitiş Tarihi<input className="asd-input" type="date" value={editingGuarantee.expires_at} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, expires_at: e.target.value })} /></label>
              <label className="asd-label">
                Durum
                <select className="asd-select" value={editingGuarantee.status} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="expired">expired</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
            </div>
            <div className="asd-modal-footer">
              <button type="button" className="asd-btn asd-btn--secondary" onClick={() => { setEditingGuaranteeId(null); setEditingGuarantee(null); }}>İptal</button>
              <button type="button" className="asd-btn" onClick={() => void saveGuaranteeEdit()}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="asd-modal-back" onClick={() => setShowEmailModal(false)}>
          <div className="asd-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>E-posta Gönder</h3>
            <div className="asd-grid">
              <label className="asd-label">Alıcı (To)<input className="asd-input" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /></label>
              <label className="asd-label">CC (virgülle ayırın)<input className="asd-input" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} /></label>
              <label className="asd-label asd-label--full">Konu<input className="asd-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} /></label>
              <label className="asd-label asd-label--full">Mesaj<textarea className="asd-textarea" rows={7} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} /></label>
              <label className="asd-label asd-label--full">
                Ek Dosyalar
                <input className="asd-input" type="file" multiple onChange={(e) => setEmailFiles(Array.from(e.target.files || []))} />
                {emailFiles.length > 0 && (
                  <div className="asd-file-list">{emailFiles.map((f) => f.name).join(", ")}</div>
                )}
              </label>
            </div>
            <div className="asd-modal-footer">
              <button type="button" className="asd-btn asd-btn--secondary" onClick={() => setShowEmailModal(false)}>İptal</button>
              <button type="button" className="asd-btn" disabled={emailSending} onClick={() => void handleSendEmail()}>
                {emailSending ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
