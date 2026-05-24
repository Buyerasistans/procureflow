import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { http } from "../lib/http";
import { clearToken, getSupplierAccessToken } from "../lib/session";
import PublicBrandLogo from "../components/PublicBrandLogo";
import { getSupplierProfile, updateSupplierProfile, type SupplierAuthorizedUser } from "../services/supplier-profile.service";
import { getDashboardMailButtonConfig, getMailCenterAccounts, type MailCenterAccount } from "../services/mail-center.service";
import MailCenterPopup from "../components/MailCenterPopup";
import {
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings,
  type EmailSettingsData,
} from "../services/advanced-settings.service";

const SUPPLIER_THEME = {
  bg: "#1a3a5c",
  bgMid: "#1e4f78",
  bgDeep: "#0f70a8",
  accent: "#0ea5e9",
  accentSoft: "#dbeafe",
};

/* ─── Page shell ─────────────────────────────────────────────── */
const PageShell = styled.div`
  background: #f0f4f8;
  min-height: 100vh;
  font-family: Arial, sans-serif;
`;

/* ─── Top nav header (dark, like partner panel) ──────────────── */
const TopNav = styled.header`
  background: linear-gradient(135deg, #1a3a5c 0%, #1f5a7b 48%, #246d9e 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 22px;
  min-height: 96px;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
`;

const NavBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
`;

const FirmRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const FirmLogoImg = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.08);
`;

const FirmLogoPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,0.14);
  font-weight: 900;
  font-size: 15px;
  color: #fff;
`;

const FirmName = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #f8fafc;
`;

const NavLinks = styled.nav`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding-top: 38px;
`;

const NavLink = styled.button<{ $active?: boolean }>`
  color: #e5ece8;
  background: ${(p) => (p.$active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)")};
  border: 1px solid ${(p) => (p.$active ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)")};
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
`;

const NavRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  position: relative;
`;

const UserBtn = styled.button`
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #d1d5db;
  padding: 10px 14px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
`;

const UserMenuPanel = styled.div`
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 220px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.22);
  overflow: hidden;
  z-index: 30;
`;

const UserMenuItem = styled.button<{ $danger?: boolean }>`
  width: 100%;
  text-align: left;
  border: none;
  padding: 11px 14px;
  background: #ffffff;
  color: ${(p) => (p.$danger ? "#b91c1c" : "#1e293b")};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: ${(p) => (p.$danger ? "#fee2e2" : "#f1f5f9")}; }
`;

/* ─── Main body ──────────────────────────────────────────────── */
const Body = styled.div`
  max-width: 1200px;
  margin: 24px auto;
  padding: 0 18px 60px;
`;

/* ─── Identity card (big scope banner like partner panel) ─────── */
const ScopeBanner = styled.div`
  background: linear-gradient(135deg, #1a3a5c 0%, #1e4f78 58%, #0f70a8 100%);
  border-radius: 18px;
  padding: 20px 24px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const ScopeBrandCard = styled.div`
  width: 140px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(7, 18, 30, 0.26);
  display: grid;
  place-items: center;
`;

const ScopeLabel = styled.div`
  font-size: 11px;
  color: #bae6fd;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  font-weight: 800;
  margin-bottom: 6px;
`;

const ScopeTitle = styled.div`
  font-size: 26px;
  font-weight: 900;
  color: #f8fafc;
  line-height: 1.1;
`;

const ScopeRight = styled.div`
  text-align: right;
  color: #e0f2fe;
`;

const ScopeUser = styled.div`
  font-size: 22px;
  font-weight: 900;
  color: #ffffff;
`;

const ScopeEmail = styled.div`
  font-size: 13px;
  color: #bae6fd;
  margin-top: 4px;
`;

/* ─── Work menu ──────────────────────────────────────────────── */
const WorkMenuCard = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 18px;
`;

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: #e2e8f0;
  margin-top: 14px;
`;

const WorkMenuLabel = styled.div`
  font-size: 11px;
  font-weight: 900;
  color: #64748b;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
`;

const WorkMenuTitle = styled.div`
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MenuPillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const MenuPill = styled.button<{ $active?: boolean }>`
  padding: 9px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? SUPPLIER_THEME.accent : "#e2e8f0")};
  background: ${(p) => (p.$active ? SUPPLIER_THEME.accent : "#f8fafc")};
  color: ${(p) => (p.$active ? "#ffffff" : "#334155")};
  display: flex;
  align-items: center;
  gap: 6px;
`;

/* ─── Stats ──────────────────────────────────────────────────── */
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 12px;
  margin-bottom: 18px;
  @media (max-width: 900px) { grid-template-columns: repeat(2,1fr); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const StatBox = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  text-align: center;
  .lbl { font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
  .val { font-size: 28px; font-weight: 900; color: #0f172a; line-height: 1; }
  .sub { font-size: 11px; color: #94a3b8; margin-top: 3px; }
`;

/* ─── Quick links ────────────────────────────────────────────── */
const QuickGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 12px;
  margin-bottom: 18px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const QuickCard = styled.button`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  .title { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .desc { font-size: 12px; color: #64748b; line-height: 1.3; }
  .cta { margin-top: 10px; font-size: 12px; font-weight: 800; color: #0f766e; }
  &:hover { border-color: #0f766e; }
`;

/* ─── Projects ───────────────────────────────────────────────── */
const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 14px;
`;

const ProjectsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
`;

const ProjectCard = styled.div`
  background: white;
  border-radius: 14px;
  border: 1px solid #dbe3ee;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  padding: 16px;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
  cursor: pointer;

  &:hover {
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
    transform: translateY(-2px);
  }

  h3 {
    font-size: 16px;
    color: #1f2937;
    margin: 0 0 8px 0;
    font-weight: 700;
  }

  .status-badge {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 10px;
    background-color: #dbeafe;
    color: #0c4a6e;

    &.pending {
      background-color: #fef3c7;
      color: #78350f;
    }

    &.submitted {
      background-color: #d1fae5;
      color: #065f46;
    }
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .actions > button {
    flex: 1;
    padding: 9px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &.primary {
      background-color: #667eea;
      color: white;
      &:hover { background-color: #5568d3; }
    }

    &.secondary {
      background-color: #e5e7eb;
      color: #374151;
      &:hover { background-color: #d1d5db; }
    }
  }
`;

const EmptyState = styled.div`
  background: white;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
  .icon { font-size: 64px; margin-bottom: 20px; }
  h3 { font-size: 18px; color: #1f2937; margin: 0 0 10px 0; }
  p { margin: 0; font-size: 14px; }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  font-size: 16px;
  color: #6b7280;
`;

/* ─── Platform Settings ──────────────────────────────────────── */
const SettingsCard = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 22px;
  margin-bottom: 16px;
`;

const SettingsTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`
  display: grid;
  gap: 4px;
  label { font-size: 12px; font-weight: 700; color: #475569; }
  input, select {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: #0f172a;
    &:focus { outline: none; border-color: #0f766e; }
  }
`;

const DefaultBadge = styled.div`
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #92400e;
  margin-bottom: 14px;
`;

const SaveBtn = styled.button`
  padding: 10px 20px;
  background: #0ea5e9;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  margin-top: 14px;
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TestBtn = styled.button`
  padding: 10px 16px;
  background: #1d4ed8;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  margin-top: 14px;
  margin-left: 8px;
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SystemTabsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 14px;
`;

const SystemTab = styled.button<{ $active?: boolean }>`
  border: 1px solid ${(p) => (p.$active ? "#2563eb" : "#cbd5e1")};
  background: ${(p) => (p.$active ? "#3b82f6" : "#ffffff")};
  color: ${(p) => (p.$active ? "#ffffff" : "#334155")};
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;

const Toast = styled.div<{ $type: "success" | "error" | "info" }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: ${(p) => p.$type === "success" ? "#065f46" : p.$type === "info" ? "#1e3a5f" : "#991b1b"};
  color: #fff;
  border-radius: 12px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  z-index: 9999;
  max-width: 360px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
`;

/* ─── Types ──────────────────────────────────────────────────── */
export interface Project {
  id: number;
  name: string;
  description?: string;
  budget?: number;
  status?: string;
}

export interface AssignedProject extends Project {
  supplier_status?: string;
  quote_submitted?: boolean;
  company?: {
    id?: number | null;
    name?: string;
    logo_url?: string | null;
  };
  quote?: {
    id?: number | null;
    title?: string;
    description?: string | null;
    status?: string | null;
  };
  supplier_quote?: {
    id?: number | null;
    status?: string | null;
    submitted?: boolean;
  };
  project_files?: Array<{
    id: number;
    name: string;
    size: number;
    file_type?: string;
  }>;
}

type DashTab = "panel_home" | "platform_settings" | "profil" | "firmalar";

/* ─── Firm card for multi-firm switcher ─────────────────────── */
interface FirmInfo {
  id: number;
  company_name: string;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  city?: string | null;
  is_current: boolean;
}

/* ─── User Profile Section ───────────────────────────────────── */
function UserProfileSection({
  initialName,
  initialEmail,
  initialPhone,
  initialWorkEmail,
  authorizedUsers,
  onSaved,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string | null;
  initialWorkEmail: string | null;
  authorizedUsers: SupplierAuthorizedUser[];
  onSaved?: (name: string) => void;
}) {
  const [form, setForm] = useState({ name: initialName, phone: initialPhone || "", work_email: initialWorkEmail || "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const flash = (msg: string, type: "success" | "error" | "info") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSupplierProfile({ user_name: form.name, user_phone: form.phone || undefined, user_work_email: form.work_email || null });
      flash("Profil kaydedildi.", "success");
      onSaved?.(form.name);
    } catch { flash("Kaydetme basarisiz.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      {toast && <Toast $type={toast.type}>{toast.msg}</Toast>}
      <SettingsCard>
        <SettingsTitle>Kullanici Bilgileri</SettingsTitle>
        <FormGrid>
          <Field>
            <label>Ad Soyad</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ad Soyad" />
          </Field>
          <Field>
            <label>E-posta (degistirilemez)</label>
            <input value={initialEmail} disabled style={{ background: "#f1f5f9", color: "#94a3b8" }} />
          </Field>
          <Field>
            <label>Telefon</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+90 5xx xxx xx xx" />
          </Field>
          <Field>
            <label>İş E-postası (opsiyonel)</label>
            <input value={form.work_email} onChange={(e) => setForm((p) => ({ ...p, work_email: e.target.value }))} placeholder="is@firmasi.com" />
          </Field>
        </FormGrid>
        <SaveBtn onClick={() => { void handleSave(); }} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? "Kaydediliyor..." : "Profili Kaydet"}
        </SaveBtn>
      </SettingsCard>

      {authorizedUsers.length > 0 && (
        <SettingsCard>
          <SettingsTitle>Firma Yetkilileri ({authorizedUsers.length} kisi)</SettingsTitle>
          <div style={{ display: "grid", gap: 10 }}>
            {authorizedUsers.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0f766e", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{u.email}</div>
                  {u.phone && <div style={{ fontSize: 11, color: "#94a3b8" }}>{u.phone}</div>}
                </div>
                {u.is_default && (
                  <span style={{ marginLeft: "auto", background: "#dcfce7", color: "#065f46", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "3px 10px", border: "1px solid #86efac" }}>
                    Varsayilan Yetkili
                  </span>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>
      )}
    </>
  );
}

/* ─── Firms Section (multi-firm switcher) ─────────────────────── */
function FirmsSection({ firms, onSwitch }: { firms: FirmInfo[]; onSwitch?: (firm: FirmInfo) => void }) {
  const resolveLogoUrl = (logo?: string | null) => {
    if (!logo) return null;
    if (logo.startsWith("http")) return logo;
    const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || window.location.origin;
    return `${base}${logo}`;
  };
  return (
    <SettingsCard>
      <SettingsTitle>Bagli Oldugum Firmalar</SettingsTitle>
      {firms.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>Bagli firma bulunamadi.</div>}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {firms.map((f) => (
          <div key={f.id} style={{ border: `2px solid ${f.is_current ? "#0f766e" : "#e2e8f0"}`, borderRadius: 14, padding: 16, background: f.is_current ? "#f0fdf4" : "#fff", position: "relative" }}>
            {f.is_current && (
              <span style={{ position: "absolute", top: 10, right: 10, background: "#dcfce7", color: "#065f46", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "2px 8px" }}>AKTİF</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              {resolveLogoUrl(f.logo_url) ? (
                <img src={resolveLogoUrl(f.logo_url) || ""} alt={f.company_name} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#134e4a", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900 }}>
                  {f.company_name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>{f.company_name}</div>
                {f.city && <div style={{ fontSize: 11, color: "#64748b" }}>{f.city}</div>}
              </div>
            </div>
            {f.email && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{f.email}</div>}
            {f.phone && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{f.phone}</div>}
            {!f.is_current && onSwitch && (
              <SaveBtn onClick={() => onSwitch(f)} style={{ fontSize: 12, padding: "7px 14px", marginTop: 4 }}>Bu Firmaya Gec</SaveBtn>
            )}
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

/* ─── Platform Settings Section ──────────────────────────────── */
function PlatformSettingsSection({ userId }: { userId?: number | null }) {
  const hasSupplierToken = Boolean(getSupplierAccessToken());
  const [settings, setSettings] = useState<EmailSettingsData | null>(null);
  const [form, setForm] = useState<EmailSettingsData>({});
  const [isDefault, setIsDefault] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const flash = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (hasSupplierToken) {
      setSettings(null);
      setForm({});
      setIsDefault(true);
      setLoadingSettings(false);
      return;
    }

    setLoadingSettings(true);
    getEmailSettings(userId)
      .then((data) => {
        setSettings(data);
        setForm(data);
        setIsDefault(!data.owner_user_id);
      })
      .catch(() => {
        setIsDefault(true);
        setForm({});
      })
      .finally(() => setLoadingSettings(false));
  }, [hasSupplierToken, userId]);

  const handleChange = (key: keyof EmailSettingsData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (hasSupplierToken) {
      flash("Bu panelde SMTP ayarları super admin tarafından yönetilir.", "info");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateEmailSettings(form, userId);
      setSettings(saved);
      setForm(saved);
      setIsDefault(!saved.owner_user_id);
      flash("Ayarlar kaydedildi.", "success");
    } catch {
      flash("Kaydetme basarisiz oldu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (hasSupplierToken) {
      flash("Test gönderimi super admin panelinden yapılabilir.", "info");
      return;
    }
    const to = form.from_email || form.smtp_username || "";
    if (!to) { flash("Test icin gecerli bir e-posta adresi girin.", "error"); return; }
    setTesting(true);
    try {
      const res = await testEmailSettings({ ...form, to_email: to }, userId);
      flash(res.message || "Test maili gönderildi.", "success");
    } catch {
      flash("Test maili gönderilemedi.", "error");
    } finally {
      setTesting(false);
    }
  };

  if (loadingSettings) return <div style={{ padding: 24, color: "#64748b" }}>Ayarlar yukleniyor...</div>;

  return (
    <>
      {toast && <Toast $type={toast.type}>{toast.msg}</Toast>}

      {isDefault && (
        <DefaultBadge>
          Bu profilde özel SMTP / POP3 / IMAP ayarı tanımlı değil. Mail gönderme ve alma işlemlerinde size tanımlanan buyerasistans.com.tr iş maili varsayılan olarak kullanılır. Özel ayar girip kaydederseniz varsayılan kanal otomatik olarak özel profilinize geçer.
        </DefaultBadge>
      )}

      {hasSupplierToken && (
        <DefaultBadge>
          Bu panelde girdiginiz ozel SMTP / POP3 / IMAP ayarlari, mailbox tarafinda buyerasistans.com.tr varsayilaninin onune gecer. Login her zaman uye oldugunuz kisisel e-posta ve sifre ile devam eder.
        </DefaultBadge>
      )}

      <SettingsCard>
        <SettingsTitle>SMTP Ayarlari (Giden Posta)</SettingsTitle>
        <FormGrid>
          <Field>
            <label>SMTP Sunucu (Host)</label>
            <input value={form.smtp_host || ""} onChange={(e) => handleChange("smtp_host", e.target.value)} placeholder="smtp.ornekposta.com" />
          </Field>
          <Field>
            <label>SMTP Port</label>
            <input type="number" value={form.smtp_port || ""} onChange={(e) => handleChange("smtp_port", Number(e.target.value))} placeholder="587" />
          </Field>
          <Field>
            <label>SMTP Kullanici Adi</label>
            <input value={form.smtp_username || ""} onChange={(e) => handleChange("smtp_username", e.target.value)} placeholder="kullanici@firmasi.com" />
          </Field>
          <Field>
            <label>SMTP Sifre</label>
            <input type="password" value={form.smtp_password || ""} onChange={(e) => handleChange("smtp_password", e.target.value)} placeholder="••••••••" />
          </Field>
          <Field>
            <label>Gönderen E-posta (From)</label>
            <input value={form.from_email || ""} onChange={(e) => handleChange("from_email", e.target.value)} placeholder="bilgi@firmasi.com" />
          </Field>
          <Field>
            <label>Gönderen Adı</label>
            <input value={form.from_name || ""} onChange={(e) => handleChange("from_name", e.target.value)} placeholder="Firma Adi" />
          </Field>
          <Field>
            <label>TLS Kullan</label>
            <select value={form.use_tls ? "true" : "false"} onChange={(e) => handleChange("use_tls", e.target.value === "true")}>
              <option value="true">Evet</option>
              <option value="false">Hayir</option>
            </select>
          </Field>
          <Field>
            <label>SSL Kullan</label>
            <select value={form.use_ssl ? "true" : "false"} onChange={(e) => handleChange("use_ssl", e.target.value === "true")}>
              <option value="false">Hayir</option>
              <option value="true">Evet</option>
            </select>
          </Field>
        </FormGrid>
      </SettingsCard>

      <SettingsCard>
        <SettingsTitle>IMAP Ayarlari (Gelen Posta - IMAP)</SettingsTitle>
        <FormGrid>
          <Field>
            <label>IMAP Sunucu</label>
            <input value={form.imap_host || ""} onChange={(e) => handleChange("imap_host", e.target.value)} placeholder="imap.ornekposta.com" />
          </Field>
          <Field>
            <label>IMAP Port</label>
            <input type="number" value={form.imap_port || ""} onChange={(e) => handleChange("imap_port", Number(e.target.value))} placeholder="993" />
          </Field>
          <Field>
            <label>Gelen Posta SSL</label>
            <select value={form.incoming_use_ssl ? "true" : "false"} onChange={(e) => handleChange("incoming_use_ssl", e.target.value === "true")}>
              <option value="true">Evet</option>
              <option value="false">Hayir</option>
            </select>
          </Field>
        </FormGrid>
      </SettingsCard>

      <SettingsCard>
        <SettingsTitle>POP3 Ayarlari (Gelen Posta - POP3)</SettingsTitle>
        <FormGrid>
          <Field>
            <label>POP3 Sunucu</label>
            <input value={form.pop3_host || ""} onChange={(e) => handleChange("pop3_host", e.target.value)} placeholder="pop.ornekposta.com" />
          </Field>
          <Field>
            <label>POP3 Port</label>
            <input type="number" value={form.pop3_port || ""} onChange={(e) => handleChange("pop3_port", Number(e.target.value))} placeholder="995" />
          </Field>
        </FormGrid>
      </SettingsCard>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SaveBtn onClick={() => { void handleSave(); }} disabled={saving || hasSupplierToken}>{saving ? "Kaydediliyor..." : "Ayarlari Kaydet"}</SaveBtn>
        <TestBtn onClick={() => { void handleTest(); }} disabled={testing || hasSupplierToken}>{testing ? "Test ediliyor..." : "Test Maili Gönder"}</TestBtn>
        {!hasSupplierToken && !isDefault && settings?.id && (
          <SaveBtn
            onClick={() => {
              if (!window.confirm("Firma ozel ayarlarini sil? Platform varsayilanlarina donecek.")) return;
              updateEmailSettings({}, userId)
                .then(() => { flash("Ozel ayarlar silindi, varsayilana donuldu.", "info"); setIsDefault(true); setForm({}); })
                .catch(() => flash("Silme basarisiz.", "error"));
            }}
            style={{ background: "#dc2626", marginLeft: 8 }}
          >
            Ozel Ayarlari Sil
          </SaveBtn>
        )}
      </div>
    </>
  );
}

function ScopeSettingsBoard({ userId }: { userId?: number | null }) {
  const [scopeTab, setScopeTab] = useState<"super_admin" | "partner" | "supplier" | "channel">("supplier");

  const scopeTitle =
    scopeTab === "super_admin"
      ? "Super Admin Ayarları"
      : scopeTab === "partner"
        ? "Stratejik Partner Ayarları"
        : scopeTab === "supplier"
          ? "Tedarikçi Ayarları"
          : "İş Ortağı Ayarları";

  const canAccessScope = scopeTab === "supplier";

  return (
    <>
      <SystemTabsRow style={{ justifyContent: "center", marginBottom: 18 }}>
        <SystemTab $active={scopeTab === "super_admin"} onClick={() => setScopeTab("super_admin")}>Super Admin</SystemTab>
        <SystemTab $active={scopeTab === "partner"} onClick={() => setScopeTab("partner")}>Stratejik Partner</SystemTab>
        <SystemTab $active={scopeTab === "supplier"} onClick={() => setScopeTab("supplier")}>Tedarikçi</SystemTab>
        <SystemTab $active={scopeTab === "channel"} onClick={() => setScopeTab("channel")}>İş Ortağı</SystemTab>
      </SystemTabsRow>

      {!canAccessScope && (
        <SettingsCard>
          <div style={{ textAlign: "center", padding: "24px 16px" }}>
            <div style={{ fontSize: 14, color: "#64748b", fontWeight: 700, marginBottom: 8 }}>Bu Scope'a Erişim Yok</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {scopeTab === "super_admin" ? "Platform ayarları yalnızca super admin tarafından görülebilir." :
               scopeTab === "partner" ? "Partner ayarları yalnızca stratejik partner tarafından görülebilir." :
               "İş ortağı ayarları yalnızca iş ortağı tarafından görülebilir."}
            </div>
          </div>
        </SettingsCard>
      )}

      {canAccessScope && (
        <>
          <SettingsCard>
            <SettingsTitle>{scopeTitle} — E-posta Ayarları</SettingsTitle>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
              Tedarikçi hesabınız için özel SMTP/IMAP/POP3 ayarlarını burada yapılandırabilirsiniz. Bu ayarlar, platform varsayılanlarını geçersiz kılar.
            </div>
          </SettingsCard>
          <PlatformSettingsSection userId={userId} />
        </>
      )}
    </>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function SupplierDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  /* identity */
  const [firmName, setFirmName] = useState<string>("-");
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("-");
  const [userEmail, setUserEmail] = useState<string>("-");
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userWorkEmail, setUserWorkEmail] = useState<string | null>(null);
  const [roleText, setRoleText] = useState<string>("Tedarikçi Kullanıcısı");
  const [supplierUserId, setSupplierUserId] = useState<number | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<SupplierAuthorizedUser[]>([]);

  /* multi-firm */
  const [myFirms, setMyFirms] = useState<FirmInfo[]>([]);

  /* mail */
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [mailAccounts, setMailAccounts] = useState<MailCenterAccount[]>([]);
  const [mailPopupOpen, setMailPopupOpen] = useState(false);
  const [dashboardMailButtonEnabled, setDashboardMailButtonEnabled] = useState(true);
  const [isSuperAdminSession, setIsSuperAdminSession] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /* tab */
  const [activeTab, setActiveTab] = useState<DashTab>("panel_home");

  const flash = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const submittedCount = useMemo(() => projects.filter((p) => Boolean(p.supplier_quote?.submitted)).length, [projects]);
  const pendingCount = useMemo(() => projects.filter((p) => !p.supplier_quote?.submitted).length, [projects]);
  const withFilesCount = useMemo(() => projects.filter((p) => (p.project_files || []).length > 0).length, [projects]);
  const preferredPersonalMailAddress = useMemo(
    () => String(userEmail || "").trim().toLowerCase(),
    [userEmail],
  );
  const preferredWorkMailAddress = useMemo(
    () => String(userWorkEmail || "").trim().toLowerCase(),
    [userWorkEmail],
  );
  const isPlatformMailboxAddress = useCallback(
    (address: string) => address.endsWith("@buyerasistans.com.tr"),
    [],
  );
  const preferredMailAccountId = useMemo(() => {
    if (!mailAccounts.length) return null;
    const selected =
      mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === preferredPersonalMailAddress)
      || mailAccounts.find((account) => {
        const normalized = String(account.email || "").trim().toLowerCase();
        return normalized === preferredWorkMailAddress && !isPlatformMailboxAddress(normalized);
      })
      || mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === preferredWorkMailAddress)
      || mailAccounts.find((account) => !isPlatformMailboxAddress(String(account.email || "").trim().toLowerCase()))
      || mailAccounts[0];
    return selected.id;
  }, [isPlatformMailboxAddress, mailAccounts, preferredPersonalMailAddress, preferredWorkMailAddress]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get("/suppliers/dashboard/projects");
      setProjects(response.data || []);
    } catch (err: unknown) {
      let message = "Projeler yuklenirken hata olustu";
      if (typeof err === "object" && err !== null && "response" in err) {
        const resp = (err as { response?: { data?: { detail?: string } } }).response;
        if (resp?.data?.detail) message = resp.data.detail;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSupplierIdentity = useCallback(async () => {
    try {
      const profile = await getSupplierProfile();

      /* firm */
      setFirmName(profile.supplier.company_name || "Firma");
      if (profile.supplier.logo_url) {
        const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";
        setFirmLogoUrl(profile.supplier.logo_url.startsWith("http") ? profile.supplier.logo_url : base + profile.supplier.logo_url);
      }

      /* user */
      setUserName(profile.user.name || profile.user.email);
      setUserEmail(profile.user.email);
      setUserPhone(profile.user.phone ?? null);
      setUserWorkEmail(profile.user.work_email ?? null);
      setSupplierUserId(profile.user.id);
      setAuthorizedUsers(profile.supplier.authorized_users ?? []);

      /* role from local session */
      const rawUser = localStorage.getItem("pf_user") || sessionStorage.getItem("pf_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { business_role?: string; system_role?: string; role_profile_code?: string };
        const br = String(parsed.business_role || "").toLowerCase();
        const sr = String(parsed.system_role || "").toLowerCase();
        const code = String(parsed.role_profile_code || "").trim();
        setIsSuperAdminSession(sr === "super_admin");
        if (br === "supplier_admin") setRoleText(code || "Tedarikçi Yöneticisi");
        else if (br === "supplier_user" || sr === "supplier_user") setRoleText(code || "Tedarikçi Kullanıcısı");
        else setRoleText(code || "Tedarikçi");
      }
    } catch {
      setFirmName("Firma");
      setUserName("Tedarikçi kullanicisi");
    }
  }, []);

  useEffect(() => {
    if (!getSupplierAccessToken()) {
      window.location.href = "/supplier/login";
      return;
    }
    void loadProjects();
    void loadSupplierIdentity();

    /* load my firms */
    void (async () => {
      try {
        const res = await http.get<FirmInfo[]>("/suppliers/my-firms");
        setMyFirms(res.data || []);
      } catch { /* ignore */ }
    })();

    /* mail unread count + polling */
    let stopMailPolling = false;
    const loadMail = async () => {
      try {
        const globalMailButtonConfig = await getDashboardMailButtonConfig();
        const isEnabled = globalMailButtonConfig.dashboard_mail_button_enabled !== false;
        setDashboardMailButtonEnabled(isEnabled);
        if (!isEnabled && !isSuperAdminSession) {
          setMailUnreadCount(0);
          setMailAccounts([]);
          return;
        }
        const accounts = await getMailCenterAccounts();
        setMailAccounts(accounts);
        setMailUnreadCount(accounts.reduce((s, a) => s + (a.unread_count || 0), 0));
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err !== null && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        if (status === 401 || status === 403) {
          stopMailPolling = true;
          setMailUnreadCount(0);
          setMailAccounts([]);
        }
      }
    };
    void loadMail();
    const mailInterval = window.setInterval(() => {
      if (stopMailPolling) return;
      void loadMail();
    }, 45000);
    return () => { window.clearInterval(mailInterval); };
  }, [isSuperAdminSession, loadProjects, loadSupplierIdentity]);

  const resolveLogo = (logo?: string | null) => {
    if (!logo) return null;
    if (logo.startsWith("http")) return logo;
    const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || window.location.origin;
    return `${base}${logo}`;
  };

  const openFile = async (fileId: number, e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    const token = getSupplierAccessToken();
    if (!token) return;
    try {
      const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || window.location.origin;
      const resp = await fetch(`${base}/api/v1/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || "Dosya acilamadi");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { alert(err instanceof Error ? err.message : "Dosya acilamadi"); }
  };

  const downloadFile = async (fileId: number, fileName: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); e?.preventDefault();
    const token = getSupplierAccessToken();
    if (!token) return;
    try {
      const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || window.location.origin;
      const resp = await fetch(`${base}/api/v1/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || "Dosya indirilemedi");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { alert(err instanceof Error ? err.message : "Dosya indirilemedi"); }
  };

  const handleRespondQuote = (project: AssignedProject) => {
    if (!project.supplier_quote?.id) { alert("Bu proje icin teklif kaydi bulunamadi."); return; }
    navigate(`/supplier/workspace?tab=offers&supplierQuoteId=${project.supplier_quote.id}`);
  };

  const handleDeclineQuote = async (project: AssignedProject) => {
    if (!project.supplier_quote?.id) { alert("Bu proje icin teklif kaydi bulunamadi."); return; }
    const reason = window.prompt("Reddetme nedenini yazin (opsiyonel):", "");
    if (reason === null) return;
    try {
      await http.post(`/supplier-quotes/${project.supplier_quote.id}/decline${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`);
      await loadProjects();
      flash("Teklif cevaplama reddedildi.", "info");
    } catch (err: unknown) {
      const detail = typeof err === "object" && err !== null && "response" in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail : undefined;
      flash(detail || "Reddetme islemi basarisiz.", "error");
    }
  };

  const handleLogout = () => {
    clearToken();
    sessionStorage.removeItem("pf_user");
    localStorage.removeItem("pf_user");
    navigate("/supplier/login", { replace: true });
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingContainer>Yukleniyor...</LoadingContainer>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* ── TOP NAV ───────────────────────────────────────────── */}
      <TopNav>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexShrink: 0 }}>
          <NavBrand>
            <div style={{ display: "flex", alignItems: "center", height: 36 }}>
              <PublicBrandLogo height={34} maxWidth={168} invert />
            </div>
            <FirmRow>
              {firmLogoUrl ? (
                <FirmLogoImg src={firmLogoUrl} alt={firmName} />
              ) : (
                <FirmLogoPlaceholder>{firmName.slice(0, 2).toUpperCase()}</FirmLogoPlaceholder>
              )}
              <div>
                <FirmName>{firmName}</FirmName>
              </div>
            </FirmRow>
          </NavBrand>
        </div>

        <NavLinks>
          <NavLink $active={activeTab === "panel_home"} onClick={() => setActiveTab("panel_home")}>Anasayfa</NavLink>
          <NavLink onClick={() => navigate("/supplier/workspace?tab=offers")}>Tekliflerim</NavLink>
          <NavLink onClick={() => navigate("/supplier/workspace")}>Calisma Alani</NavLink>
          <NavLink onClick={() => navigate("/supplier/workspace?tab=profile")}>Profil</NavLink>
          <NavLink $active={activeTab === "platform_settings"} onClick={() => setActiveTab("platform_settings")}>Sistem Ayarlari</NavLink>
        </NavLinks>

        <NavRight>
          <UserBtn type="button" onClick={() => setUserMenuOpen((p) => !p)}>
            {userName} ▾
          </UserBtn>

          {userMenuOpen && (
            <UserMenuPanel>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                {roleText}
              </div>
              <UserMenuItem
                type="button"
                onClick={() => {
                  setActiveTab("profil");
                  setUserMenuOpen(false);
                }}
              >
                Profilim
              </UserMenuItem>
              <UserMenuItem
                type="button"
                $danger
                onClick={() => {
                  setUserMenuOpen(false);
                  handleLogout();
                }}
              >
                Çıkış Yap
              </UserMenuItem>
            </UserMenuPanel>
          )}

          {(isSuperAdminSession || dashboardMailButtonEnabled) && (
            <button
              onClick={() => setMailPopupOpen(true)}
              type="button"
              style={{
                background: mailUnreadCount > 0
                  ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                  : "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                border: mailUnreadCount > 0
                  ? "1px solid rgba(147, 197, 253, 0.8)"
                  : "1px solid rgba(14, 165, 233, 0.4)",
                color: "#ffffff",
                borderRadius: 14,
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: mailUnreadCount > 0
                  ? "0 12px 24px rgba(37, 99, 235, 0.32)"
                  : "0 10px 22px rgba(14, 165, 233, 0.22)",
              }}
              title="Mail Merkezi"
            >
              ✉ Mail
              {mailUnreadCount > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800 }}>
                  {mailUnreadCount}
                </span>
              )}
            </button>
          )}
        </NavRight>
      </TopNav>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <Body>
        {/* Scope Banner */}
        <ScopeBanner>
          <ScopeBrandCard>
            <PublicBrandLogo height={24} maxWidth={80} invert />
          </ScopeBrandCard>
          <div style={{ flex: 1, paddingLeft: 8 }}>
            <ScopeLabel>Tedarikçi Platformu Yönetim Alanı</ScopeLabel>
            <ScopeTitle>{firmName}</ScopeTitle>
            <div style={{ fontSize: 13, color: "#bae6fd", marginTop: 4 }}>{roleText}</div>
          </div>
          <ScopeRight>
            <div style={{ fontSize: 12, color: "#dbeafe", marginBottom: 4, fontWeight: 700 }}>Hoş geldiniz</div>
            <ScopeUser>{userName}</ScopeUser>
            <ScopeEmail>{userEmail}</ScopeEmail>
          </ScopeRight>
        </ScopeBanner>

        {/* Work Menu Card */}
        <WorkMenuCard>
          <WorkMenuLabel>Çalışma Menüsü</WorkMenuLabel>
          <WorkMenuTitle>{roleText}</WorkMenuTitle>
          <MenuPillRow>
            <MenuPill $active={activeTab === "panel_home"} onClick={() => setActiveTab("panel_home")}>Anasayfa</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=offers")}>Tekliflerim</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=contracts")}>Sözleşmelerim</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=guarantees")}>Teminatlarım</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=certificates")}>Sertifikalar</MenuPill>
            <MenuPill onClick={() => { flash("Roller ve Yetkiler yönetim alanı yakında açılacaktır.", "info"); }}>Roller ve Yetkiler</MenuPill>
            <MenuPill onClick={() => { flash("Departmanlar yönetim alanı yakında açılacaktır.", "info"); }}>Departmanlar</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=company_docs")}>Şirket Evrakları</MenuPill>
            <MenuPill onClick={() => navigate("/supplier/workspace?tab=profile")}>Firma Profili</MenuPill>
            <MenuPill $active={activeTab === "profil"} onClick={() => setActiveTab("profil")}>Profilim</MenuPill>
            {myFirms.length > 1 && (
              <MenuPill $active={activeTab === "firmalar"} onClick={() => setActiveTab("firmalar")}>Firmalarım ({myFirms.length})</MenuPill>
            )}
            <MenuPill $active={activeTab === "platform_settings"} onClick={() => setActiveTab("platform_settings")}>Sistem Ayarları</MenuPill>
          </MenuPillRow>
          <Divider />
        </WorkMenuCard>

        {/* ── TAB: panel_home ─────────────────────────────────── */}
        {activeTab === "panel_home" && (
          <>
            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: 16, borderRadius: 10, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* Stats */}
            <StatsRow>
              <StatBox>
                <div className="lbl">Atanan Proje</div>
                <div className="val">{projects.length}</div>
              </StatBox>
              <StatBox>
                <div className="lbl">Bekleyen Teklif</div>
                <div className="val" style={{ color: "#b45309" }}>{pendingCount}</div>
              </StatBox>
              <StatBox>
                <div className="lbl">Gönderilen Teklif</div>
                <div className="val" style={{ color: "#065f46" }}>{submittedCount}</div>
              </StatBox>
              <StatBox>
                <div className="lbl">Dosyalı Proje</div>
                <div className="val">{withFilesCount}</div>
              </StatBox>
            </StatsRow>

            {/* Projects */}
            <SectionTitle>Size Atanan Projeler</SectionTitle>
            {projects.length === 0 ? (
              <EmptyState>
                <div className="icon">📭</div>
                <h3>Henüz proje atanmamış</h3>
                <p>Size proje atandığında burada gösterilecektir</p>
              </EmptyState>
            ) : (
              <ProjectsGrid>
                {projects.map((project) => (
                  <ProjectCard key={project.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      {resolveLogo(project.company?.logo_url) ? (
                        <img src={resolveLogo(project.company?.logo_url) || ""} alt="firma" style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }} />
                      ) : (
                        <div style={{ width: 42, height: 42, borderRadius: 8, border: "1px solid #e5e7eb", display: "grid", placeItems: "center", color: "#94a3b8" }}>🏢</div>
                      )}
                      <div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>İş Veren Firma</div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{project.company?.name || "Firma bilgisi yok"}</div>
                      </div>
                    </div>

                    <h3>{project.name}</h3>

                    <div className={`status-badge${project.supplier_quote?.submitted ? " submitted" : " pending"}`}>
                      {project.supplier_quote?.submitted ? "Teklif Gönderildi" : "Teklif Bekleniyor"}
                    </div>

                    {project.quote?.title && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Teklif Basligi</div>
                        <div style={{ fontWeight: 700, color: "#1f2937" }}>{project.quote.title}</div>
                      </div>
                    )}
                    {project.quote?.description && (
                      <div style={{ marginBottom: 10, fontSize: 13, color: "#374151" }}>{project.quote.description}</div>
                    )}

                    {(project.project_files || []).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Dosyalar</div>
                        <div style={{ display: "grid", gap: 5 }}>
                          {(project.project_files || []).slice(0, 4).map((f) => (
                            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{(f.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                <button onClick={(e) => { void openFile(f.id, e); }} type="button" style={{ padding: "5px 8px", fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", cursor: "pointer" }}>Aç</button>
                                <button onClick={(e) => { void downloadFile(f.id, f.name, e); }} type="button" style={{ padding: "5px 8px", fontSize: 11, borderRadius: 6, border: "1px solid #93c5fd", background: "#dbeafe", color: "#1e40af", cursor: "pointer" }}>İndir</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="actions">
                      <button className="primary" onClick={() => handleRespondQuote(project)}>Teklifi Aç</button>
                      <button className="secondary" onClick={() => { void handleDeclineQuote(project); }}>Reddet</button>
                    </div>
                  </ProjectCard>
                ))}
              </ProjectsGrid>
            )}

            <div style={{ background: "white", padding: 20, borderRadius: 12, marginTop: 20 }}>
              <SectionTitle style={{ marginBottom: 6 }}>Destek</SectionTitle>
              <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                Sorularınız için <strong>info@buyerasistans.com</strong> adresine e-posta gönderin.
              </p>
            </div>

            {/* Quick links - moved to bottom */}
            <QuickGrid style={{ marginTop: 18 }}>
              <QuickCard onClick={() => navigate("/supplier/workspace?tab=offers")}>
                <div className="title">Tekliflerim</div>
                <div className="desc">Tüm teklif kayıtlarına git, eksik kalanları tamamla.</div>
                <div className="cta">Aç →</div>
              </QuickCard>
              <QuickCard onClick={() => navigate("/supplier/workspace?tab=profile")}>
                <div className="title">Firma Profili</div>
                <div className="desc">Firma bilgileri, logo ve iletişim bilgilerini düzenle.</div>
                <div className="cta">Aç →</div>
              </QuickCard>
              <QuickCard onClick={() => setActiveTab("platform_settings")}>
                <div className="title">Sistem Ayarları</div>
                <div className="desc">SMTP / POP3 / IMAP e-posta ayarlarını yönet.</div>
                <div className="cta">Aç →</div>
              </QuickCard>
            </QuickGrid>
          </>
        )}

        {/* ── TAB: platform_settings ───────────────────────────── */}
        {activeTab === "platform_settings" && (
          <>
            <SectionTitle>Sistem Ayarları — E-posta (SMTP / IMAP / POP3)</SectionTitle>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18, lineHeight: 1.5 }}>
              Platform varsayılan ayarları super admin tarafından belirlenir. Bu firma için özel ayar tanımlanmamışsa sistem otomatik olarak platform varsayılanını kullanır. Aşağıdan firma özel ayarları tanımlanabilir; super admin tüm ayarları görür, düzenler veya silebilir.
            </p>
            <ScopeSettingsBoard userId={supplierUserId} />
          </>
        )}

        {/* ── TAB: profil ─────────────────────────────────────── */}
        {activeTab === "profil" && (
          <>
            <SectionTitle>Kullanıcı Profilim</SectionTitle>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
              Kişisel bilgilerinizi ve firma yetkilileri listesini buradan yönetebilirsiniz.
            </p>
            <UserProfileSection
              initialName={userName}
              initialEmail={userEmail}
              initialPhone={userPhone}
              initialWorkEmail={userWorkEmail}
              authorizedUsers={authorizedUsers}
              onSaved={(name) => setUserName(name)}
            />
          </>
        )}

        {/* ── TAB: firmalar ───────────────────────────────────── */}
        {activeTab === "firmalar" && (
          <>
            <SectionTitle>Bağlı Olduğum Firmalar</SectionTitle>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>
              Bu kullanıcının yetkili olduğu tedarikçi firmaları. Başka bir firmaya geçmek için ilgili kartı kullanın.
            </p>
            <FirmsSection
              firms={myFirms}
              onSwitch={(firm) => {
                flash(`${firm.company_name} firmasına geçiş yapılamaz — tek oturum desteklenmektedir. Yeni firmaya katılım davetiyesi ile giriş yapınız.`, "info");
              }}
            />
          </>
        )}
      </Body>

      {/* hidden ref for future logo upload if needed */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />

      {userMenuOpen && (
        <div
          onClick={() => setUserMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 10 }}
        />
      )}

      {toast && <Toast $type={toast.type}>{toast.msg}</Toast>}

      {/* ── Mail Center Popup ─────────────────────────────────── */}
      {(isSuperAdminSession || dashboardMailButtonEnabled) && (
        <MailCenterPopup
          isOpen={mailPopupOpen}
          initialAccountId={preferredMailAccountId}
          onClose={() => setMailPopupOpen(false)}
        />
      )}
    </PageShell>
  );
}

