import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
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

const Page = styled.div`
  display: grid;
  gap: 16px;
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #111827;
`;

const Input = styled.input`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
`;

const Select = styled.select`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  background: #fff;
`;

const TextArea = styled.textarea`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  resize: vertical;
`;

const Button = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 9px 12px;
  font-weight: 600;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
`;

const SecondaryButton = styled(Button)`
  background: #4b5563;
`;

const DangerButton = styled(Button)`
  background: #dc2626;
`;

const GhostButton = styled.button`
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: #334155;
  font-weight: 600;
  cursor: pointer;
`;

const Message = styled.div<{ $error?: boolean }>`
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: ${(p) => (p.$error ? "#991b1b" : "#065f46")};
  background: ${(p) => (p.$error ? "#fee2e2" : "#d1fae5")};
`;

const StatusBadge = styled.span<{ $tone: "neutral" | "success" | "warning" | "info" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background: ${(p) =>
    p.$tone === "success"
      ? "#dcfce7"
      : p.$tone === "warning"
        ? "#fef3c7"
        : p.$tone === "info"
          ? "#dbeafe"
          : "#e5e7eb"};
  color: ${(p) =>
    p.$tone === "success"
      ? "#166534"
      : p.$tone === "warning"
        ? "#92400e"
        : p.$tone === "info"
          ? "#1d4ed8"
          : "#475569"};
`;

const SectionHeader = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0;
  margin-bottom: 14px;
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #4f4f6c;
  }
`;

const Arrow = styled.span`
  font-size: 18px;
  font-weight: 700;
  color: #334155;
`;

const TeamList = styled.div`
  margin-top: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`;

const TeamHead = styled.div`
  display: grid;
  grid-template-columns: minmax(170px, 1.1fr) minmax(170px, 1fr) minmax(220px, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  @media (max-width: 900px) {
    display: none;
  }
`;

const TeamRow = styled.div`
  display: grid;
  grid-template-columns: minmax(170px, 1.1fr) minmax(170px, 1fr) minmax(220px, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 10px 12px;
  border-bottom: 1px dashed #dbe3ee;
  background: #fff;
  &:last-child {
    border-bottom: none;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 6px;
  }
`;

const TeamCell = styled.div`
  font-size: 12px;
  color: #334155;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  strong {
    color: #0f172a;
  }
`;

const MiniActionBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
`;

const CallBtn = styled(MiniActionBtn)`
  border-color: #93c5fd;
  color: #1d4ed8;
`;

const MailBtn = styled(MiniActionBtn)`
  border-color: #fcd34d;
  color: #92400e;
`;

const WhatsappBtn = styled(MiniActionBtn)`
  border-color: #86efac;
  color: #166534;
`;

const LogoBox = styled.div`
  width: 110px;
  height: 110px;
  border-radius: 12px;
  border: 1px solid #dbe3ee;
  background: #f8fafc;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const ModalBack = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

const ModalCard = styled.div`
  width: min(700px, 94vw);
  background: #fff;
  border-radius: 10px;
  border: 1px solid #dbe3ee;
  padding: 16px;
`;

const ActionInline = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

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
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "E-posta gönderilemedi");
    } finally {
      setEmailSending(false);
    }
  }

  if (loading) return <Page>Yükleniyor...</Page>;
  if (!detail || !form) return <Page>Veri bulunamadı.</Page>;

  return (
    <Page>
      {error && <Message $error>{error}</Message>}
      {success && <Message>{success}</Message>}

      <HeaderRow>
        <h2>Tedarikçiyi Görüntüle: {detail.supplier.company_name}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <SecondaryButton onClick={() => navigate("/admin?tab=suppliers")}>Tedarikçilere Dön</SecondaryButton>
          <SecondaryButton onClick={() => navigate("/admin")}>Panele Dön</SecondaryButton>
        </div>
      </HeaderRow>

      <Card>
        <HeaderRow>
          <h3>Genel Bilgiler</h3>
          <Button disabled={saving} onClick={handleSaveSupplier}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
        </HeaderRow>

        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <LogoBox>
            {logoSrc ? <img src={logoSrc} alt="Firma logosu" /> : <span style={{ color: "#94a3b8" }}>Logo Yok</span>}
          </LogoBox>
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            <div style={{ fontWeight: 700, color: "#1e293b" }}>{form.company_name || "-"}</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Logoyu tedarikçi kendi profilinden günceller.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge $tone={supplierInviteStatus.tone}>{supplierInviteStatus.label}</StatusBadge>
              <StatusBadge $tone={detail.supplier.address_district || detail.supplier.city ? "info" : "neutral"}>
                {detail.supplier.address_district || detail.supplier.city
                  ? `Konum: ${[detail.supplier.city, detail.supplier.address_district].filter(Boolean).join(" / ")}`
                  : "Konum bilgisi davet seviyesinde"}
              </StatusBadge>
              <StatusBadge $tone={detail.supplier.partner_category_tags.length > 0 ? "info" : "neutral"}>
                {detail.supplier.partner_category_tags.length > 0
                  ? `${detail.supplier.partner_category_tags.length} partner kategorisi`
                  : "Partner kategorisi bekleniyor"}
              </StatusBadge>
            </div>
            <ActionInline>
              <GhostButton type="button" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=certificates`)}>Sertifika Yükle</GhostButton>
              <GhostButton type="button" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=company_docs`)}>Şirket Evrakları</GhostButton>
              <GhostButton type="button" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=personnel_docs`)}>Personel Evrakları</GhostButton>
              <GhostButton type="button" onClick={() => navigate(`/admin/suppliers/${supplierId}/finance`)}>Finans Modülü</GhostButton>
              <GhostButton type="button" onClick={() => navigate(`/admin/suppliers/${supplierId}/workspace?tab=guarantee_docs`)}>Alınan Teminatlar</GhostButton>
            </ActionInline>
          </div>
        </div>

        <Grid>
          <Label>Firma Adı<Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Label>
          <Label>Ünvan<Input value={form.company_title} onChange={(e) => setForm({ ...form, company_title: e.target.value })} /></Label>
          <Label>
            Telefon
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <ActionInline>
              <CallBtn type="button" onClick={() => callPhone(form.phone)}>Ara</CallBtn>
              <WhatsappBtn type="button" disabled={!isLikelyMobilePhone(form.phone)} onClick={() => messageWhatsapp(form.phone)}>WhatsApp</WhatsappBtn>
            </ActionInline>
          </Label>
          <Label>
            E-posta
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <ActionInline>
              <MailBtn type="button" onClick={() => openEmailComposer(form.email)}>Mail Gönder</MailBtn>
            </ActionInline>
          </Label>
          <Label>Web Sitesi<Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Label>
          <Label>
            Stratejik Partner Kategorileri
            <GhostButton type="button" onClick={() => setShowPartnerCategoryModal(true)}>Kategori Seç</GhostButton>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {form.partner_category_tags.length > 0 ? form.partner_category_tags.map((item) => (
                <span key={item} style={{ padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 12 }}>{item}</span>
              )) : <span style={{ color: "#94a3b8", fontSize: 12 }}>Henüz partner kategorisi atanmadı</span>}
            </div>
          </Label>
          <Label>
            Tedarikçinin Kendi Kategorileri
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {detail.supplier.category_tags.length > 0 ? detail.supplier.category_tags.map((item) => (
                <span key={item} style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfeff", color: "#0f766e", fontWeight: 700, fontSize: 12 }}>{item}</span>
              )) : <span style={{ color: "#94a3b8", fontSize: 12 }}>Tedarikçi kendi görünürlük kategorilerini henüz eklemedi</span>}
            </div>
          </Label>

          <Label style={{ gridColumn: "1 / -1" }}>Adres<TextArea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Label>

          <Label>
            Şehir
            <Select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, address_district: "" })}>
              <option value="">Seçiniz</option>
              {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
            </Select>
          </Label>
          <Label>
            İlçe
            <Select value={form.address_district} onChange={(e) => setForm({ ...form, address_district: e.target.value })} disabled={!form.city}>
              <option value="">Seçiniz</option>
              {cityDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Label>
          <Label>Posta Kodu<Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></Label>

          <Label style={{ gridColumn: "1 / -1" }}>Notlar<TextArea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Label>
        </Grid>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <GhostButton type="button" onClick={() => setShowFirmMap((v) => !v)}>
            {showFirmMap ? "Firma Konumunu Gizle" : "Firma Konumunu Aç"}
          </GhostButton>
          <GhostButton type="button" onClick={shareOnWhatsapp}>WhatsApp Paylaş</GhostButton>
        </div>

        {showFirmMap && (
          <div style={{ marginTop: 10, border: "1px solid #dbe3ee", borderRadius: 8, overflow: "hidden" }}>
            <iframe title="Firma konumu" src={getMapEmbedSrc(form.address, form.address_district, form.city)} width="100%" height="280" style={{ border: 0 }} loading="lazy" />
          </div>
        )}
      </Card>

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

      <Card>
        <SectionHeader onClick={() => toggleSection("users")}>
          <h3>Yetkili Kullanıcılar ({detail.users_count})</h3>
          <Arrow>{sectionArrow(openSections.users)}</Arrow>
        </SectionHeader>
        {openSections.users && (
          <>
            <Grid>
              <Label>Arama<Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Ad, e-posta, telefon" /></Label>
              <Label>
                Durum Filtresi
                <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value as "all" | "verified" | "unverified") }>
                  <option value="all">Tümü</option>
                  <option value="verified">Doğrulanmış</option>
                  <option value="unverified">Bekleyen</option>
                </Select>
              </Label>
            </Grid>

            <div style={{ marginTop: 8 }}>
              <Button type="button" onClick={() => setShowAddUser(true)}>+ Kullanıcı Ekle</Button>
            </div>

            <TeamList>
              <TeamHead>
                <div>Ad Soyad</div>
                <div>Telefon</div>
                <div>E-posta</div>
                <div style={{ textAlign: "right" }}>İşlemler</div>
              </TeamHead>
              {filteredUsers.map((teamUser) => {
                const editing = editingUsers[teamUser.id];
                return (
                  <TeamRow key={teamUser.id}>
                    <TeamCell>
                      {editing ? (
                        <Input value={editing.name} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, name: e.target.value } }))} />
                      ) : (
                        <strong>{teamUser.name}{teamUser.is_default ? " (Varsayılan)" : ""}</strong>
                      )}
                    </TeamCell>

                    <TeamCell>
                      {editing ? (
                        <Input value={editing.phone} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, phone: e.target.value } }))} />
                      ) : (
                        <>
                          {teamUser.phone || "-"}
                          <ActionInline>
                            <CallBtn type="button" onClick={() => callPhone(teamUser.phone)}>Ara</CallBtn>
                            <WhatsappBtn type="button" disabled={!isLikelyMobilePhone(teamUser.phone)} onClick={() => messageWhatsapp(teamUser.phone)}>WhatsApp</WhatsappBtn>
                          </ActionInline>
                        </>
                      )}
                    </TeamCell>

                    <TeamCell>
                      {editing ? (
                        <Input type="email" value={editing.email} onChange={(e) => setEditingUsers((prev) => ({ ...prev, [teamUser.id]: { ...editing, email: e.target.value } }))} />
                      ) : (
                        <>
                          {teamUser.email}
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                            <StatusBadge $tone={teamUser.password_set ? "success" : "warning"}>
                              {teamUser.password_set ? "Kayıt tamamlandı" : "Magic link bekleniyor"}
                            </StatusBadge>
                            <StatusBadge $tone={teamUser.email_verified ? "success" : "neutral"}>
                              {teamUser.email_verified ? "E-posta onaylı" : "E-posta onayı bekliyor"}
                            </StatusBadge>
                          </div>
                          <ActionInline>
                            <MailBtn type="button" onClick={() => openEmailComposer(teamUser.email)}>Mail Gönder</MailBtn>
                            {(!teamUser.password_set || !teamUser.email_verified) && (
                              <MailBtn
                                type="button"
                                onClick={() => void handleResendUserMagicLink(teamUser)}
                                disabled={resendingMagicUserId === teamUser.id}
                              >
                                {resendingMagicUserId === teamUser.id ? "Gönderiliyor..." : "Magic Link Tekrar Gönder"}
                              </MailBtn>
                            )}
                          </ActionInline>
                        </>
                      )}
                    </TeamCell>

                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {editing ? (
                        <>
                          <MiniActionBtn type="button" onClick={() => void saveEditUser(teamUser.id)}>Kaydet</MiniActionBtn>
                          <MiniActionBtn type="button" onClick={() => cancelEditUser(teamUser.id)}>Vazgeç</MiniActionBtn>
                        </>
                      ) : (
                        <>
                          <MiniActionBtn type="button" onClick={() => startEditUser(teamUser)}>Düzenle</MiniActionBtn>
                          {!teamUser.is_default && <MiniActionBtn type="button" onClick={() => void handleSetDefaultUser(teamUser.id)}>Varsayılan Yap</MiniActionBtn>}
                          {!teamUser.is_default && <MiniActionBtn type="button" onClick={() => void handleDeleteUser(teamUser.id)}>Sil</MiniActionBtn>}
                        </>
                      )}
                    </div>
                  </TeamRow>
                );
              })}
            </TeamList>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader onClick={() => toggleSection("invoice")}>
          <h3>Fatura Bilgileri</h3>
          <Arrow>{sectionArrow(openSections.invoice)}</Arrow>
        </SectionHeader>
        {openSections.invoice && (
          <>
            <Grid>
              <Label>Fatura Ünvanı<Input value={form.invoice_name} onChange={(e) => setForm({ ...form, invoice_name: e.target.value })} /></Label>
              <Label>Vergi Dairesi<Input value={form.tax_office} onChange={(e) => setForm({ ...form, tax_office: e.target.value })} /></Label>
              <Label>Vergi No<Input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></Label>
              <Label>Sicil No<Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></Label>

              <Label style={{ gridColumn: "1 / -1" }}>Fatura Adresi<TextArea rows={2} value={form.invoice_address} onChange={(e) => setForm({ ...form, invoice_address: e.target.value })} /></Label>

              <Label>
                Fatura Şehir
                <Select value={form.invoice_city} onChange={(e) => setForm({ ...form, invoice_city: e.target.value, invoice_district: "" })}>
                  <option value="">Seçiniz</option>
                  {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
                </Select>
              </Label>
              <Label>
                Fatura İlçe
                <Select value={form.invoice_district} onChange={(e) => setForm({ ...form, invoice_district: e.target.value })} disabled={!form.invoice_city}>
                  <option value="">Seçiniz</option>
                  {invoiceDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Label>
              <Label>Fatura Posta Kodu<Input value={form.invoice_postal_code} onChange={(e) => setForm({ ...form, invoice_postal_code: e.target.value })} /></Label>
            </Grid>

            <div style={{ marginTop: 10 }}>
              <GhostButton type="button" onClick={() => setShowInvoiceMap((v) => !v)}>
                {showInvoiceMap ? "Fatura Konumunu Gizle" : "Fatura Konumunu Aç"}
              </GhostButton>
            </div>

            {showInvoiceMap && (
              <div style={{ marginTop: 10, border: "1px solid #dbe3ee", borderRadius: 8, overflow: "hidden" }}>
                <iframe title="Fatura konumu" src={getMapEmbedSrc(form.invoice_address, form.invoice_district, form.invoice_city)} width="100%" height="280" style={{ border: 0 }} loading="lazy" />
              </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <SectionHeader onClick={() => toggleSection("guarantees")}>
          <h3>Teminatlar</h3>
          <Arrow>{sectionArrow(openSections.guarantees)}</Arrow>
        </SectionHeader>
        {openSections.guarantees && (
          <>
            <Grid>
              <Label>Başlık<Input value={newGuarantee.title} onChange={(e) => setNewGuarantee({ ...newGuarantee, title: e.target.value })} /></Label>
              <Label>Tür<Input value={newGuarantee.guarantee_type} onChange={(e) => setNewGuarantee({ ...newGuarantee, guarantee_type: e.target.value })} /></Label>
              <Label>Tutar<Input value={newGuarantee.amount} onChange={(e) => setNewGuarantee({ ...newGuarantee, amount: e.target.value })} /></Label>
              <Label>Para Birimi<Input value={newGuarantee.currency} onChange={(e) => setNewGuarantee({ ...newGuarantee, currency: e.target.value.toUpperCase() })} /></Label>
              <Label>Veriliş Tarihi<Input type="date" value={newGuarantee.issued_at} onChange={(e) => setNewGuarantee({ ...newGuarantee, issued_at: e.target.value })} /></Label>
              <Label>Bitiş Tarihi<Input type="date" value={newGuarantee.expires_at} onChange={(e) => setNewGuarantee({ ...newGuarantee, expires_at: e.target.value })} /></Label>
            </Grid>
            <div style={{ marginTop: 8 }}>
              <Button type="button" onClick={() => void handleAddGuarantee()}>Teminat Ekle</Button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {detail.guarantees.map((g) => (
                <Card key={g.id}>
                  <HeaderRow>
                    <div>
                      <strong>{g.title}</strong>
                      <div>{g.guarantee_type} | {g.amount ?? "-"} {g.currency || "TRY"}</div>
                      <div>Durum: {g.status} | Bitiş: {g.expires_at || "-"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <SecondaryButton
                        type="button"
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
                      </SecondaryButton>
                      <DangerButton type="button" onClick={() => void handleDeleteGuarantee(g.id)}>Sil</DangerButton>
                    </div>
                  </HeaderRow>
                </Card>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionHeader onClick={() => toggleSection("payment")}>
          <h3>Ödeme ve Çek Ayarları</h3>
          <Arrow>{sectionArrow(openSections.payment)}</Arrow>
        </SectionHeader>
        {openSections.payment && (
          <>
            <Grid>
              <Label>
                Çek Kabulü
                <Select value={form.accepts_checks ? "yes" : "no"} onChange={(e) => setForm({ ...form, accepts_checks: e.target.value === "yes" })}>
                  <option value="yes">Evet</option>
                  <option value="no">Hayır</option>
                </Select>
              </Label>
              <Label>
                Tercih Edilen Çek Vadesi
                <Input value={form.preferred_check_term} onChange={(e) => setForm({ ...form, preferred_check_term: e.target.value })} disabled={!form.accepts_checks} />
              </Label>
            </Grid>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {form.payment_accounts.map((acc, idx) => (
                <Card key={`${acc.bank_name}-${idx}`}>
                  <Grid>
                    <Label>
                      Banka
                      <Select
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
                      </Select>
                    </Label>
                    <Label>IBAN<Input value={acc.iban} onChange={(e) => {
                      const next = [...form.payment_accounts] as AdminSupplierPaymentAccount[];
                      next[idx] = { ...next[idx], iban: e.target.value };
                      setForm({ ...form, payment_accounts: next });
                    }} /></Label>
                    <Label>
                      Hesap Türü
                      <Select
                        value={acc.account_type}
                        onChange={(e) => {
                          const next = [...form.payment_accounts] as AdminSupplierPaymentAccount[];
                          next[idx] = { ...next[idx], account_type: e.target.value as "tl" | "doviz" };
                          setForm({ ...form, payment_accounts: next });
                        }}
                      >
                        <option value="tl">TL</option>
                        <option value="doviz">Döviz</option>
                      </Select>
                    </Label>
                    <DangerButton type="button" onClick={() => setForm({ ...form, payment_accounts: form.payment_accounts.filter((_, i) => i !== idx) })}>
                      Hesabı Sil
                    </DangerButton>
                  </Grid>
                </Card>
              ))}

              <SecondaryButton
                type="button"
                onClick={() => setForm({
                  ...form,
                  payment_accounts: [...form.payment_accounts, { bank_name: "", iban: "", account_type: "tl", bank_key: null }],
                })}
              >
                + Hesap Ekle
              </SecondaryButton>
            </div>
          </>
        )}
      </Card>

      {showAddUser && (
        <ModalBack onClick={() => setShowAddUser(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <h3>Yeni Yetkili Ekle</h3>
            <Grid>
              <Label>Ad Soyad<Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></Label>
              <Label>E-posta<Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></Label>
              <Label>Telefon<Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} /></Label>
            </Grid>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <SecondaryButton type="button" onClick={() => setShowAddUser(false)}>İptal</SecondaryButton>
              <Button type="button" onClick={() => void handleAddUser()}>Kullanıcı Ekle</Button>
            </div>
          </ModalCard>
        </ModalBack>
      )}

      {editingGuaranteeId && editingGuarantee && (
        <ModalBack onClick={() => { setEditingGuaranteeId(null); setEditingGuarantee(null); }}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <h3>Teminat Düzenle</h3>
            <Grid>
              <Label>Başlık<Input value={editingGuarantee.title} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, title: e.target.value })} /></Label>
              <Label>Tür<Input value={editingGuarantee.guarantee_type} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, guarantee_type: e.target.value })} /></Label>
              <Label>Tutar<Input value={editingGuarantee.amount} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, amount: e.target.value })} /></Label>
              <Label>Para Birimi<Input value={editingGuarantee.currency} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, currency: e.target.value.toUpperCase() })} /></Label>
              <Label>Veriliş Tarihi<Input type="date" value={editingGuarantee.issued_at} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, issued_at: e.target.value })} /></Label>
              <Label>Bitiş Tarihi<Input type="date" value={editingGuarantee.expires_at} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, expires_at: e.target.value })} /></Label>
              <Label>
                Durum
                <Select value={editingGuarantee.status} onChange={(e) => setEditingGuarantee({ ...editingGuarantee, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="expired">expired</option>
                  <option value="cancelled">cancelled</option>
                </Select>
              </Label>
            </Grid>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <SecondaryButton type="button" onClick={() => { setEditingGuaranteeId(null); setEditingGuarantee(null); }}>İptal</SecondaryButton>
              <Button type="button" onClick={() => void saveGuaranteeEdit()}>Kaydet</Button>
            </div>
          </ModalCard>
        </ModalBack>
      )}

      {showEmailModal && (
        <ModalBack onClick={() => setShowEmailModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <h3>E-posta Gönder</h3>
            <Grid>
              <Label>Alıcı (To)<Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} /></Label>
              <Label>CC (virgülle ayırın)<Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} /></Label>
              <Label style={{ gridColumn: "1 / -1" }}>Konu<Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} /></Label>
              <Label style={{ gridColumn: "1 / -1" }}>Mesaj<TextArea rows={7} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} /></Label>
              <Label style={{ gridColumn: "1 / -1" }}>
                Ek Dosyalar
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setEmailFiles(Array.from(e.target.files || []))}
                />
                {emailFiles.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#334155" }}>
                    {emailFiles.map((f) => f.name).join(", ")}
                  </div>
                )}
              </Label>
            </Grid>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <SecondaryButton type="button" onClick={() => setShowEmailModal(false)}>İptal</SecondaryButton>
              <Button type="button" disabled={emailSending} onClick={() => void handleSendEmail()}>
                {emailSending ? "Gönderiliyor..." : "Gönder"}
              </Button>
            </div>
          </ModalCard>
        </ModalBack>
      )}
    </Page>
  );
}
