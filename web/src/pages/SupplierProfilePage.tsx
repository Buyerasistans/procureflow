import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
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

const PageWrap = styled.div`
  min-height: 100vh;
  background: #f0f4f8;
`;

const TopBar = styled.div`
  background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%);
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
  h1 { margin: 0; font-size: 20px; font-weight: 700; }
  span { font-size: 13px; opacity: 0.75; }
`;

const BackBtn = styled.button`
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.25); }
`;

const Body = styled.div`
  max-width: 1100px;
  margin: 32px auto;
  padding: 0 16px 60px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 26px 28px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
`;

const LogoCard = styled(Card)`
  display: flex;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
`;

const LogoLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LogoBox = styled.div<{ $hasLogo: boolean }>`
  width: 110px;
  height: 110px;
  border-radius: 16px;
  border: 2px dashed ${p => p.$hasLogo ? "#2d6a9f" : "#d1d5db"};
  background: ${p => p.$hasLogo ? "#f0f7ff" : "#f9fafb"};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  img { width: 100%; height: 100%; object-fit: contain; }
`;

const LogoPlaceholder = styled.div`
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
  span { font-size: 28px; display: block; }
`;

const LogoInfo = styled.div`
  flex: 1;
`;

const UploadBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #2d6a9f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #1e3a5f; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TopFields = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const MiniField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  > input {
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    padding: 9px 10px;
    font-size: 14px;
    background: #f8fafc;
    outline: none;
    &:focus { border-color: #2d6a9f; background: #fff; }
  }
`;

const MiniFieldHeader = styled.div`
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const MiniFieldLabel = styled.span`
  font-size: 11px;
  color: #475569;
  font-weight: 700;
  text-transform: uppercase;
`;

const SubBtn = styled.button`
  margin-top: 12px;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #334155;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #1f2937; }
`;

const Hint = styled.p`
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
`;

const EmailStatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusBadge = styled.span<{ $pending: boolean }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: ${p => p.$pending ? "#fef3c7" : "#dcfce7"};
  color: ${p => p.$pending ? "#92400e" : "#166534"};
`;

const PaymentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const PaymentCard = styled.div`
  border: 1px solid #dbe3ee;
  border-radius: 14px;
  background: #f8fafc;
  padding: 16px;
`;

const PaymentCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  h4 {
    margin: 0;
    font-size: 14px;
    color: #1e3a5f;
  }
`;

const GhostBtn = styled.button`
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;

const DangerGhostBtn = styled(GhostBtn)`
  color: #b91c1c;
  border-color: #fecaca;
  background: #fff5f5;
`;

const BankGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 800px) {
    grid-template-columns: 1fr 1fr;
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const BankOption = styled.button<{ $active: boolean; $start: string; $end: string }>`
  border: 1.5px solid ${p => p.$active ? p.$start : "#dbe3ee"};
  background: ${p => p.$active ? "#eff6ff" : "#fff"};
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
`;

const BankBadge = styled.span<{ $start: string; $end: string }>`
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, ${p => p.$start} 0%, ${p => p.$end} 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
`;

const BankMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  strong {
    font-size: 13px;
    color: #1e293b;
  }
  span {
    font-size: 11px;
    color: #64748b;
  }
`;

const Select = styled.select`
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 14px;
  color: #1e293b;
  background: #f8fafc;
  outline: none;
`;

const InlineCheckbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  input {
    width: 18px;
    height: 18px;
  }
`;

const SectionHeader = styled.button<{ $open: boolean }>`
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
    font-size: 15px;
    font-weight: 700;
    color: #1e3a5f;
  }
  span {
    color: #1e3a5f;
    font-size: 16px;
    transform: rotate(${p => p.$open ? "180deg" : "0deg"});
    transition: transform 0.2s;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const FullWidth = styled.div`
  grid-column: 1 / -1;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  > span { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; }
  > input, > textarea {
    border: 1.5px solid #e2e8f0;
    border-radius: 9px;
    padding: 10px 12px;
    font-size: 14px;
    color: #1e293b;
    background: #f8fafc;
    outline: none;
    &:focus { border-color: #2d6a9f; background: #fff; }
  }
  > textarea { min-height: 90px; resize: vertical; font-family: inherit; }
`;

const AutocompleteWrap = styled.div`
  position: relative;
`;

const DropdownList = styled.ul`
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
  margin: 0;
  padding: 4px 0;
  list-style: none;
`;

const DropdownItem = styled.li<{ $active?: boolean }>`
  padding: 9px 14px;
  font-size: 14px;
  cursor: pointer;
  background: ${p => p.$active ? "#e8f2fc" : "transparent"};
`;

const MapBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #0e7490;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 14px;
`;

const MapFrame = styled.iframe`
  width: 100%;
  height: 300px;
  border: none;
  border-radius: 12px;
  margin-top: 12px;
`;

const MapActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const ShareBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #16a34a;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
`;

const FooterBar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const TeamList = styled.div`
  margin-top: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`;

const TeamRow = styled.div`
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px dashed #dbe3ee;
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

const SaveBtn = styled.button`
  background: #2d6a9f;
  color: #fff;
  border: none;
  border-radius: 10px;
  height: 44px;
  padding: 0 28px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
`;

const Toast = styled.div<{ $type: "success" | "error" }>`
  position: fixed;
  bottom: 28px;
  right: 28px;
  background: ${p => p.$type === "success" ? "#065f46" : "#991b1b"};
  color: #fff;
  border-radius: 10px;
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 600;
`;

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
    <AutocompleteWrap>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        style={{ border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" }}
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
        <DropdownList>
          {filtered.map((opt, i) => (
            <DropdownItem
              key={opt}
              $active={i === hi}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
            >
              {opt}
            </DropdownItem>
          ))}
        </DropdownList>
      )}
    </AutocompleteWrap>
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
    invoice: false,
    address: false,
    payment: false,
    categories: false,
    notes: false,
  });
  const [emailStatus, setEmailStatus] = useState<{ pending: boolean; pendingEmail: string | null }>({
    pending: false,
    pendingEmail: null,
  });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingUserForm, setEditingUserForm] = useState<{ name: string; email: string; phone: string }>({
    name: "",
    email: "",
    phone: "",
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
        {
          bank_key: BANK_OPTIONS[0].key,
          bank_name: BANK_OPTIONS[0].name,
          iban: "",
          account_type: "tl",
        },
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
      return {
        ...prev,
        payment_accounts: prev.payment_accounts.filter((_, accountIndex) => accountIndex !== index),
      };
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
    setEditingUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
    });
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
    if (kind === "firma") {
      setFirmaMapUrl(embedUrl);
      setFirmaGoogleUrl(googleUrl);
    } else {
      setFaturaMapUrl(embedUrl);
      setFaturaGoogleUrl(googleUrl);
    }
  }, [flash]);

  useEffect(() => {
    if (!form?.city) return;
    if (!firmaMapUrl) {
      void findLocation("firma", [form.address, form.address_district, form.city]);
    }
  }, [form?.address, form?.address_district, form?.city, firmaMapUrl, findLocation]);

  useEffect(() => {
    if (!form?.invoice_city) return;
    if (!faturaMapUrl) {
      void findLocation("fatura", [form.invoice_address, form.invoice_district, form.invoice_city]);
    }
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
      <PageWrap>
        <TopBar><TopBarLeft><h1>Profilim</h1></TopBarLeft></TopBar>
        <Body><Card style={{ textAlign: "center", color: "#64748b" }}>Yükleniyor...</Card></Body>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <TopBar>
        <TopBarLeft>
          <h1>Profilim</h1>
          <span>{profile.supplier.company_name}</span>
        </TopBarLeft>
        <BackBtn onClick={() => navigate("/supplier/dashboard")}>← Panele Dön</BackBtn>
      </TopBar>

      <Body>
        <LogoCard>
          <LogoLeft>
            <LogoBox $hasLogo={!!logoSrc} onClick={() => fileRef.current?.click()} title="Tıklayarak logo yükleyin">
              {logoSrc ? <img src={logoSrc} alt="Logo" /> : <LogoPlaceholder><span>🏢</span>Logo</LogoPlaceholder>}
            </LogoBox>
            <UploadBtn onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "⏳ Yükleniyor..." : "📷 Logo Yükle"}
            </UploadBtn>
          </LogoLeft>
          <LogoInfo>
            <TopFields>
              <MiniField>
                <MiniFieldHeader>
                  <MiniFieldLabel>Şirket Yetkilisi</MiniFieldLabel>
                </MiniFieldHeader>
                <input value={form.user_name} onChange={e => set("user_name", e.target.value)} placeholder="Yetkili adı" />
              </MiniField>
              <MiniField>
                <MiniFieldHeader>
                  <MiniFieldLabel>Yetkili Telefonu</MiniFieldLabel>
                </MiniFieldHeader>
                <input value={form.user_phone} onChange={e => set("user_phone", e.target.value)} placeholder="0 (5xx) xxx xx xx" />
              </MiniField>
              <MiniField>
                <MiniFieldHeader>
                  <MiniFieldLabel>İş Maili</MiniFieldLabel>
                </MiniFieldHeader>
                <input value={form.user_work_email} onChange={e => set("user_work_email", e.target.value)} placeholder="mailbox@firma.com" />
              </MiniField>
              <MiniField>
                <MiniFieldHeader>
                  <MiniFieldLabel>Yetkili E-posta</MiniFieldLabel>
                  <EmailStatusRow>
                    <StatusBadge $pending={emailStatus.pending}>
                      {emailStatus.pending || !profile.user.email_verified ? "Beklemede" : "Onaylandı"}
                    </StatusBadge>
                  </EmailStatusRow>
                </MiniFieldHeader>
                <input value={form.user_email} onChange={e => set("user_email", e.target.value)} placeholder="ornek@firma.com" />
              </MiniField>
            </TopFields>
            <Hint>
              E-posta değişikliğinde yeni adrese doğrulama maili gönderilir.
              {emailStatus.pending && emailStatus.pendingEmail ? ` Bekleyen onay: ${emailStatus.pendingEmail}` : ""}
            </Hint>
            <Hint>İş maili mailbox eşlemesi için kullanılır; giriş e-postasından farklı olabilir.</Hint>
            <Hint>Şirkette toplam {profile.supplier.authorized_users_count} yetkili bulunuyor.</Hint>
            <TeamList>
              {authorizedUsers.map((teamUser) => (
                <TeamRow key={teamUser.id}>
                  {editingUser === teamUser.id ? (
                    <>
                      <input
                        value={editingUserForm.name}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, name: e.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 8px", fontSize: 12 }}
                      />
                      <input
                        value={editingUserForm.phone}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, phone: e.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 8px", fontSize: 12 }}
                      />
                      <input
                        value={editingUserForm.email}
                        onChange={(e) => setEditingUserForm(prev => ({ ...prev, email: e.target.value }))}
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 8px", fontSize: 12 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <MiniActionBtn type="button" onClick={() => void saveTeamUser(teamUser.id)}>Kaydet</MiniActionBtn>
                        <MiniActionBtn type="button" onClick={() => setEditingUser(null)}>Vazgeç</MiniActionBtn>
                      </div>
                    </>
                  ) : (
                    <>
                      <TeamCell><strong>{teamUser.name}</strong>{teamUser.is_default ? " (Varsayılan)" : ""}</TeamCell>
                      <TeamCell>{teamUser.phone || "-"}</TeamCell>
                      <TeamCell>{teamUser.email}</TeamCell>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {isCurrentUserDefault && !teamUser.is_default && (
                          <>
                            <MiniActionBtn type="button" onClick={() => beginEditTeamUser(teamUser)}>Düzenle</MiniActionBtn>
                            <MiniActionBtn type="button" onClick={() => void removeTeamUser(teamUser.id)}>Sil</MiniActionBtn>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </TeamRow>
              ))}
            </TeamList>
            <div>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=certificates")}>🏅 Sertifika Yükle</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=company_docs")}>📁 Şirket Evrakları</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=personnel_docs")}>👥 Personel Evrakları</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/finance")}>💳 Finans Modülü</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=guarantee_docs")}>🛡️ Alınan Teminatlar</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=contracts")}>📄 Sözleşmelerim</SubBtn>
              <SubBtn onClick={() => navigate("/supplier/workspace?tab=offers")}>💬 Tekliflerim</SubBtn>
            </div>
            <Hint>Evraklar bu ekranda listelenmez; ilgili sekmede goruntulenir.</Hint>
          </LogoInfo>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={handleLogoChange}
          />
        </LogoCard>

        <Card>
          <SectionHeader $open={openSections.invoice} onClick={() => toggleSection("invoice")}>
            <h3>Fatura ve Vergi Bilgileri</h3>
            <span>⌄</span>
          </SectionHeader>
          {openSections.invoice && (
            <>
              <Grid>
                <Field><span>Firma Fatura Ünvanı</span><input value={form.invoice_name} onChange={e => set("invoice_name", e.target.value)} /></Field>
                <Field><span>Vergi Dairesi</span><input value={form.tax_office} onChange={e => set("tax_office", e.target.value)} /></Field>
                <Field><span>Vergi Numarası</span><input value={form.tax_number} onChange={e => set("tax_number", e.target.value)} /></Field>
                <Field><span>Ticaret Sicil No</span><input value={form.registration_number} onChange={e => set("registration_number", e.target.value)} /></Field>
                <FullWidth><Field><span>Fatura Adresi</span><input value={form.invoice_address} onChange={e => set("invoice_address", e.target.value)} /></Field></FullWidth>
                <Field>
                  <span>Fatura İli</span>
                  <AutocompleteInput value={form.invoice_city} onChange={v => set("invoice_city", v)} options={cityNames} />
                </Field>
                <Field>
                  <span>Fatura İlçesi</span>
                  <AutocompleteInput value={form.invoice_district} onChange={v => set("invoice_district", v)} options={districts} disabled={!form.invoice_city} />
                </Field>
                <Field><span>Fatura Posta Kodu</span><input value={form.invoice_postal_code} onChange={e => set("invoice_postal_code", e.target.value)} /></Field>
              </Grid>
              <MapBtn onClick={() => {
                if (!faturaMapUrl) void findLocation("fatura", [form.invoice_address, form.invoice_district, form.invoice_city]);
                setShowFaturaMap(v => !v);
              }}>
                {showFaturaMap ? "Fatura Konumunu Gizle" : "Fatura Konumunu Aç"}
              </MapBtn>
              {showFaturaMap && faturaMapUrl && (
                <>
                  <MapFrame src={faturaMapUrl} title="Fatura Konumu" loading="lazy" allowFullScreen />
                  {faturaGoogleUrl && (
                    <MapActions>
                      <ShareBtn href={faturaGoogleUrl} target="_blank" rel="noreferrer">🗺️ Google Maps'te Aç</ShareBtn>
                      <ShareBtn href={`https://wa.me/?text=${encodeURIComponent(`Fatura konumu: ${faturaGoogleUrl}`)}`} target="_blank" rel="noreferrer">📲 WhatsApp ile Paylaş</ShareBtn>
                    </MapActions>
                  )}
                </>
              )}
            </>
          )}
        </Card>

        <Card>
          <SectionHeader $open={openSections.address} onClick={() => toggleSection("address")}>
            <h3>Firma Adresi ve Web</h3>
            <span>⌄</span>
          </SectionHeader>
          {openSections.address && (
            <>
              <Grid>
                <FullWidth><Field><span>Adres</span><input value={form.address} onChange={e => set("address", e.target.value)} /></Field></FullWidth>
                <Field>
                  <span>Şehir / İl</span>
                  <AutocompleteInput value={form.city} onChange={v => set("city", v)} options={cityNames} />
                </Field>
                <Field>
                  <span>İlçe</span>
                  <AutocompleteInput value={form.address_district} onChange={v => set("address_district", v)} options={addressDistricts} disabled={!form.city} />
                </Field>
                <Field><span>Posta Kodu</span><input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} /></Field>
                <FullWidth><Field><span>Web Sitesi</span><input value={form.supplier_website} onChange={e => set("supplier_website", e.target.value)} /></Field></FullWidth>
              </Grid>
              <MapBtn onClick={() => {
                if (!firmaMapUrl) void findLocation("firma", [form.address, form.address_district, form.city]);
                setShowFirmaMap(v => !v);
              }}>
                {showFirmaMap ? "Firma Konumunu Gizle" : "Firma Konumunu Aç"}
              </MapBtn>
              {showFirmaMap && firmaMapUrl && (
                <>
                  <MapFrame src={firmaMapUrl} title="Firma Konumu" loading="lazy" allowFullScreen />
                  {firmaGoogleUrl && (
                    <MapActions>
                      <ShareBtn href={firmaGoogleUrl} target="_blank" rel="noreferrer">🗺️ Google Maps'te Aç</ShareBtn>
                      <ShareBtn href={`https://wa.me/?text=${encodeURIComponent(`Firma konumu: ${firmaGoogleUrl}`)}`} target="_blank" rel="noreferrer">📲 WhatsApp ile Paylaş</ShareBtn>
                    </MapActions>
                  )}
                </>
              )}
            </>
          )}
        </Card>

        <Card>
          <SectionHeader $open={openSections.payment} onClick={() => toggleSection("payment")}>
            <h3>Ödeme Bilgileri</h3>
            <span>⌄</span>
          </SectionHeader>
          {openSections.payment && (
            <PaymentStack>
              <Hint>Firma için birden fazla banka hesabı ekleyebilir, hesapları TL ve Döviz olarak ayırabilir ve çek vadelerini tanımlayabilirsiniz.</Hint>

              {form.payment_accounts.length === 0 && (
                <Card style={{ padding: 16, background: "#f8fafc", boxShadow: "none" }}>
                  Henüz ödeme hesabı eklenmedi.
                </Card>
              )}

              {form.payment_accounts.map((account, index) => (
                <PaymentCard key={`${account.bank_key || "bank"}-${index}`}>
                  <PaymentCardHeader>
                    <h4>Hesap {index + 1}</h4>
                    <DangerGhostBtn type="button" onClick={() => removePaymentAccount(index)}>
                      Hesabı Sil
                    </DangerGhostBtn>
                  </PaymentCardHeader>

                  <Grid>
                    <Field>
                      <span>Hesap Türü</span>
                      <Select value={account.account_type} onChange={e => updatePaymentAccount(index, { account_type: e.target.value as "tl" | "doviz" })}>
                        <option value="tl">TL</option>
                        <option value="doviz">Döviz</option>
                      </Select>
                    </Field>
                    <Field>
                      <span>IBAN</span>
                      <input
                        value={account.iban}
                        onChange={e => updatePaymentAccount(index, { iban: e.target.value.toUpperCase() })}
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                      />
                    </Field>
                    <FullWidth>
                      <span style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Banka Seçimi</span>
                      <BankGrid>
                        {BANK_OPTIONS.map((bank) => (
                          <BankOption
                            key={bank.key}
                            type="button"
                            $active={account.bank_key === bank.key}
                            $start={bank.start}
                            $end={bank.end}
                            onClick={() => updatePaymentAccount(index, { bank_key: bank.key, bank_name: bank.name })}
                          >
                            <BankBadge $start={bank.start} $end={bank.end}>{bank.short}</BankBadge>
                            <BankMeta>
                              <strong>{bank.name}</strong>
                              <span>{bank.short} hesabı</span>
                            </BankMeta>
                          </BankOption>
                        ))}
                      </BankGrid>
                    </FullWidth>
                  </Grid>
                </PaymentCard>
              ))}

              <div>
                <GhostBtn type="button" onClick={addPaymentAccount}>+ Yeni Hesap Ekle</GhostBtn>
              </div>

              <PaymentCard>
                <PaymentCardHeader>
                  <h4>Çek Vadeleri</h4>
                </PaymentCardHeader>
                <Grid>
                  <FullWidth>
                    <InlineCheckbox>
                      <input
                        type="checkbox"
                        checked={form.accepts_checks}
                        onChange={e => setForm(prev => prev ? { ...prev, accepts_checks: e.target.checked, preferred_check_term: e.target.checked ? prev.preferred_check_term : "" } : prev)}
                      />
                      Firma çek kabul ediyor
                    </InlineCheckbox>
                  </FullWidth>
                  {form.accepts_checks && (
                    <FullWidth>
                      <Field>
                        <span>Tercih Edilen Çek Vadesi</span>
                        <input
                          value={form.preferred_check_term}
                          onChange={e => set("preferred_check_term", e.target.value)}
                          placeholder="Örn: 30 gün, 45 gün, ay sonu + 30"
                        />
                      </Field>
                    </FullWidth>
                  )}
                </Grid>
              </PaymentCard>
            </PaymentStack>
          )}
        </Card>

        <Card>
          <SectionHeader $open={openSections.categories} onClick={() => toggleSection("categories")}>
            <h3>Kategori ve Görünürlük</h3>
            <span>⌄</span>
          </SectionHeader>
          {openSections.categories && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#0f766e", marginBottom: 8 }}>Sizin yönettiğiniz kategoriler</div>
                <GhostBtn type="button" onClick={() => setShowCategoryModal(true)}>Kategori Seç</GhostBtn>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {form.category_tags.length > 0 ? form.category_tags.map((item) => (
                    <span key={item} style={{ padding: "6px 10px", borderRadius: 999, background: "#ecfeff", color: "#0f766e", fontWeight: 700, fontSize: 12 }}>{item}</span>
                  )) : <span style={{ color: "#94a3b8", fontSize: 12 }}>Henüz görünürlük kategorisi seçmediniz</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#1d4ed8", marginBottom: 8 }}>Stratejik partner tarafından eklenen kategoriler</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(profile.supplier.partner_category_tags || []).length > 0 ? profile.supplier.partner_category_tags.map((item) => (
                    <span key={item} style={{ padding: "6px 10px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: 12 }}>{item}</span>
                  )) : <span style={{ color: "#94a3b8", fontSize: 12 }}>Stratejik partner henüz kategori eklemedi</span>}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader $open={openSections.notes} onClick={() => toggleSection("notes")}>
            <h3>Önemli Notlar</h3>
            <span>⌄</span>
          </SectionHeader>
          {openSections.notes && (
            <Field>
              <span>Notlar</span>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} />
            </Field>
          )}
        </Card>

        <FooterBar>
          <SaveBtn onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Kaydediliyor..." : "💾 Profili Kaydet"}
          </SaveBtn>
        </FooterBar>

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
      </Body>

      {toast && <Toast $type={toast.type}>{toast.msg}</Toast>}
    </PageWrap>
  );
}
