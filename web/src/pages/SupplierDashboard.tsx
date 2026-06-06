import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import "./SupplierDashboard.css";

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
      {toast && <div className={`sd-toast sd-toast--${toast.type}`}>{toast.msg}</div>}
      <div className="sd-settings-card">
        <div className="sd-settings-title">Kullanıcı Bilgileri</div>
        <div className="sd-form-grid">
          <div className="sd-field">
            <label>Ad Soyad</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ad Soyad" />
          </div>
          <div className="sd-field">
            <label>E-posta (degistirilemez)</label>
            <input className="sd-field__input--disabled" value={initialEmail} disabled aria-label="E-posta" />
          </div>
          <div className="sd-field">
            <label>Telefon</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+90 5xx xxx xx xx" />
          </div>
          <div className="sd-field">
            <label>İş E-postası (opsiyonel)</label>
            <input value={form.work_email} onChange={(e) => setForm((p) => ({ ...p, work_email: e.target.value }))} placeholder="is@firmasi.com" />
          </div>
        </div>
        <button type="button" className="sd-save-btn sd-save-btn--mt" onClick={() => { void handleSave(); }} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Profili Kaydet"}
        </button>
      </div>

      {authorizedUsers.length > 0 && (
        <div className="sd-settings-card">
          <div className="sd-settings-title">Firma Yetkilileri ({authorizedUsers.length} kisi)</div>
          <div className="sd-user-list">
            {authorizedUsers.map((u) => (
              <div key={u.id} className="sd-user-row">
                <div className="sd-user-avatar">{u.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="sd-user-row__name">{u.name}</div>
                  <div className="sd-user-row__email">{u.email}</div>
                  {u.phone && <div className="sd-user-row__phone">{u.phone}</div>}
                </div>
                {u.is_default && (
                  <span className="sd-user-row__badge">Varsayilan Yetkili</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Firms Section ──────────────────────────────────────────── */
function FirmsSection({ firms, onSwitch }: { firms: FirmInfo[]; onSwitch?: (firm: FirmInfo) => void }) {
  const resolveLogoUrl = (logo?: string | null) => {
    if (!logo) return null;
    if (logo.startsWith("http")) return logo;
    const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || window.location.origin;
    return `${base}${logo}`;
  };
  return (
    <div className="sd-settings-card">
      <div className="sd-settings-title">Bagli Oldugum Firmalar</div>
      {firms.length === 0 && <div className="sd-firms-empty">Bagli firma bulunamadi.</div>}
      <div className="sd-firms-grid">
        {firms.map((f) => (
          <div key={f.id} className={`sd-firm-card${f.is_current ? " sd-firm-card--current" : ""}`}>
            {f.is_current && <span className="sd-firm-card__active-badge">AKTİF</span>}
            <div className="sd-firm-card__header">
              {resolveLogoUrl(f.logo_url) ? (
                <img src={resolveLogoUrl(f.logo_url) || ""} alt={f.company_name} className="sd-firm-card__logo" />
              ) : (
                <div className="sd-firm-card__logo-placeholder">{f.company_name.slice(0, 2).toUpperCase()}</div>
              )}
              <div>
                <div className="sd-firm-card__name">{f.company_name}</div>
                {f.city && <div className="sd-firm-card__city">{f.city}</div>}
              </div>
            </div>
            {f.email && <div className="sd-firm-card__meta">{f.email}</div>}
            {f.phone && <div className="sd-firm-card__meta">{f.phone}</div>}
            {!f.is_current && onSwitch && (
              <button type="button" className="sd-save-btn sd-save-btn--sm" onClick={() => onSwitch(f)}>Bu Firmaya Gec</button>
            )}
          </div>
        ))}
      </div>
    </div>
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
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (hasSupplierToken) {
      setSettings(null); setForm({}); setIsDefault(true); setLoadingSettings(false); return;
    }
    setLoadingSettings(true);
    getEmailSettings(userId)
      .then((data) => { setSettings(data); setForm(data); setIsDefault(!data.owner_user_id); })
      .catch(() => { setIsDefault(true); setForm({}); })
      .finally(() => setLoadingSettings(false));
  }, [hasSupplierToken, userId]);

  const handleChange = (key: keyof EmailSettingsData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (hasSupplierToken) { flash("Bu panelde SMTP ayarları super admin tarafından yönetilir.", "info"); return; }
    setSaving(true);
    try {
      const saved = await updateEmailSettings(form, userId);
      setSettings(saved); setForm(saved); setIsDefault(!saved.owner_user_id);
      flash("Ayarlar kaydedildi.", "success");
    } catch { flash("Kaydetme basarisiz oldu.", "error"); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (hasSupplierToken) { flash("Test gönderimi super admin panelinden yapılabilir.", "info"); return; }
    const to = form.from_email || form.smtp_username || "";
    if (!to) { flash("Test icin gecerli bir e-posta adresi girin.", "error"); return; }
    setTesting(true);
    try {
      const res = await testEmailSettings({ ...form, to_email: to }, userId);
      flash(res.message || "Test maili gönderildi.", "success");
    } catch { flash("Test maili gönderilemedi.", "error"); }
    finally { setTesting(false); }
  };

  if (loadingSettings) return <div className="sd-settings-loading">Ayarlar yukleniyor...</div>;

  return (
    <>
      {toast && <div className={`sd-toast sd-toast--${toast.type}`}>{toast.msg}</div>}

      {isDefault && (
        <div className="sd-default-badge">
          Bu profilde özel SMTP / POP3 / IMAP ayarı tanımlı değil. Mail gönderme ve alma işlemlerinde size tanımlanan buyerasistans.com.tr iş maili varsayılan olarak kullanılır. Özel ayar girip kaydederseniz varsayılan kanal otomatik olarak özel profilinize geçer.
        </div>
      )}
      {hasSupplierToken && (
        <div className="sd-default-badge">
          Bu panelde girdiginiz ozel SMTP / POP3 / IMAP ayarlari, mailbox tarafinda buyerasistans.com.tr varsayilaninin onune gecer. Login her zaman uye oldugunuz kisisel e-posta ve sifre ile devam eder.
        </div>
      )}

      <div className="sd-settings-card">
        <div className="sd-settings-title">SMTP Ayarlari (Giden Posta)</div>
        <div className="sd-form-grid">
          <div className="sd-field"><label>SMTP Sunucu (Host)</label><input value={form.smtp_host || ""} onChange={(e) => handleChange("smtp_host", e.target.value)} placeholder="smtp.ornekposta.com" /></div>
          <div className="sd-field"><label>SMTP Port</label><input type="number" value={form.smtp_port || ""} onChange={(e) => handleChange("smtp_port", Number(e.target.value))} placeholder="587" /></div>
          <div className="sd-field"><label>SMTP Kullanıcı Adı</label><input value={form.smtp_username || ""} onChange={(e) => handleChange("smtp_username", e.target.value)} placeholder="kullanici@firmasi.com" /></div>
          <div className="sd-field"><label>SMTP Şifre</label><input type="password" value={form.smtp_password || ""} onChange={(e) => handleChange("smtp_password", e.target.value)} placeholder="••••••••" /></div>
          <div className="sd-field"><label>Gönderen E-posta (From)</label><input value={form.from_email || ""} onChange={(e) => handleChange("from_email", e.target.value)} placeholder="bilgi@firmasi.com" /></div>
          <div className="sd-field"><label>Gönderen Adı</label><input value={form.from_name || ""} onChange={(e) => handleChange("from_name", e.target.value)} placeholder="Firma Adi" /></div>
          <div className="sd-field"><label>TLS Kullan</label><select aria-label="TLS Kullan" value={form.use_tls ? "true" : "false"} onChange={(e) => handleChange("use_tls", e.target.value === "true")}><option value="true">Evet</option><option value="false">Hayir</option></select></div>
          <div className="sd-field"><label>SSL Kullan</label><select aria-label="SSL Kullan" value={form.use_ssl ? "true" : "false"} onChange={(e) => handleChange("use_ssl", e.target.value === "true")}><option value="false">Hayir</option><option value="true">Evet</option></select></div>
        </div>
      </div>

      <div className="sd-settings-card">
        <div className="sd-settings-title">IMAP Ayarlari (Gelen Posta - IMAP)</div>
        <div className="sd-form-grid">
          <div className="sd-field"><label>IMAP Sunucu</label><input value={form.imap_host || ""} onChange={(e) => handleChange("imap_host", e.target.value)} placeholder="imap.ornekposta.com" /></div>
          <div className="sd-field"><label>IMAP Port</label><input type="number" value={form.imap_port || ""} onChange={(e) => handleChange("imap_port", Number(e.target.value))} placeholder="993" /></div>
          <div className="sd-field"><label>Gelen Posta SSL</label><select aria-label="Gelen Posta SSL" value={form.incoming_use_ssl ? "true" : "false"} onChange={(e) => handleChange("incoming_use_ssl", e.target.value === "true")}><option value="true">Evet</option><option value="false">Hayir</option></select></div>
        </div>
      </div>

      <div className="sd-settings-card">
        <div className="sd-settings-title">POP3 Ayarlari (Gelen Posta - POP3)</div>
        <div className="sd-form-grid">
          <div className="sd-field"><label>POP3 Sunucu</label><input value={form.pop3_host || ""} onChange={(e) => handleChange("pop3_host", e.target.value)} placeholder="pop.ornekposta.com" /></div>
          <div className="sd-field"><label>POP3 Port</label><input type="number" value={form.pop3_port || ""} onChange={(e) => handleChange("pop3_port", Number(e.target.value))} placeholder="995" /></div>
        </div>
      </div>

      <div className="sd-settings-actions">
        <button type="button" className="sd-save-btn" onClick={() => { void handleSave(); }} disabled={saving || hasSupplierToken}>{saving ? "Kaydediliyor..." : "Ayarlari Kaydet"}</button>
        <button type="button" className="sd-test-btn" onClick={() => { void handleTest(); }} disabled={testing || hasSupplierToken}>{testing ? "Test ediliyor..." : "Test Maili Gönder"}</button>
        {!hasSupplierToken && !isDefault && settings?.id && (
          <button
            type="button"
            className="sd-save-btn sd-save-btn--danger"
            onClick={() => {
              if (!window.confirm("Firma ozel ayarlarini sil? Platform varsayilanlarina donecek.")) return;
              updateEmailSettings({}, userId)
                .then(() => { flash("Ozel ayarlar silindi, varsayilana donuldu.", "info"); setIsDefault(true); setForm({}); })
                .catch(() => flash("Silme basarisiz.", "error"));
            }}
          >
            Ozel Ayarlari Sil
          </button>
        )}
      </div>
    </>
  );
}

function ScopeSettingsBoard({ userId }: { userId?: number | null }) {
  const [scopeTab, setScopeTab] = useState<"super_admin" | "partner" | "supplier" | "channel">("supplier");

  const scopeTitle =
    scopeTab === "super_admin" ? "Super Admin Ayarları" :
    scopeTab === "partner" ? "Stratejik Partner Ayarları" :
    scopeTab === "supplier" ? "Tedarikçi Ayarları" : "İş Ortağı Ayarları";

  const canAccessScope = scopeTab === "supplier";

  return (
    <>
      <div className="sd-system-tabs-row sd-system-tabs-row--center">
        <button type="button" className={`sd-system-tab${scopeTab === "super_admin" ? " sd-system-tab--active" : ""}`} onClick={() => setScopeTab("super_admin")}>Super Admin</button>
        <button type="button" className={`sd-system-tab${scopeTab === "partner" ? " sd-system-tab--active" : ""}`} onClick={() => setScopeTab("partner")}>Stratejik Partner</button>
        <button type="button" className={`sd-system-tab${scopeTab === "supplier" ? " sd-system-tab--active" : ""}`} onClick={() => setScopeTab("supplier")}>Tedarikçi</button>
        <button type="button" className={`sd-system-tab${scopeTab === "channel" ? " sd-system-tab--active" : ""}`} onClick={() => setScopeTab("channel")}>İş Ortağı</button>
      </div>

      {!canAccessScope && (
        <div className="sd-settings-card">
          <div className="sd-no-access">
            <div className="sd-no-access__title">Bu Scope'a Erişim Yok</div>
            <div className="sd-no-access__desc">
              {scopeTab === "super_admin" ? "Platform ayarları yalnızca super admin tarafından görülebilir." :
               scopeTab === "partner" ? "Partner ayarları yalnızca stratejik partner tarafından görülebilir." :
               "İş ortağı ayarları yalnızca iş ortağı tarafından görülebilir."}
            </div>
          </div>
        </div>
      )}

      {canAccessScope && (
        <>
          <div className="sd-settings-card">
            <div className="sd-settings-title">{scopeTitle} — E-posta Ayarları</div>
            <div className="sd-settings-desc">
              Tedarikçi hesabınız için özel SMTP/IMAP/POP3 ayarlarını burada yapılandırabilirsiniz. Bu ayarlar, platform varsayılanlarını geçersiz kılar.
            </div>
          </div>
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

  const [firmName, setFirmName] = useState<string>("-");
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("-");
  const [userEmail, setUserEmail] = useState<string>("-");
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userWorkEmail, setUserWorkEmail] = useState<string | null>(null);
  const [roleText, setRoleText] = useState<string>("Tedarikçi Kullanıcısı");
  const [supplierUserId, setSupplierUserId] = useState<number | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<SupplierAuthorizedUser[]>([]);

  const [myFirms, setMyFirms] = useState<FirmInfo[]>([]);

  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [mailAccounts, setMailAccounts] = useState<MailCenterAccount[]>([]);
  const [mailPopupOpen, setMailPopupOpen] = useState(false);
  const [dashboardMailButtonEnabled, setDashboardMailButtonEnabled] = useState(true);
  const [isSuperAdminSession, setIsSuperAdminSession] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<DashTab>("panel_home");

  const flash = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const submittedCount = useMemo(() => projects.filter((p) => Boolean(p.supplier_quote?.submitted)).length, [projects]);
  const pendingCount = useMemo(() => projects.filter((p) => !p.supplier_quote?.submitted).length, [projects]);
  const withFilesCount = useMemo(() => projects.filter((p) => (p.project_files || []).length > 0).length, [projects]);
  const preferredPersonalMailAddress = useMemo(() => String(userEmail || "").trim().toLowerCase(), [userEmail]);
  const preferredWorkMailAddress = useMemo(() => String(userWorkEmail || "").trim().toLowerCase(), [userWorkEmail]);
  const isPlatformMailboxAddress = useCallback((address: string) => address.endsWith("@buyerasistans.com.tr"), []);
  const preferredMailAccountId = useMemo(() => {
    if (!mailAccounts.length) return null;
    const selected =
      mailAccounts.find((a) => String(a.email || "").trim().toLowerCase() === preferredPersonalMailAddress)
      || mailAccounts.find((a) => {
        const n = String(a.email || "").trim().toLowerCase();
        return n === preferredWorkMailAddress && !isPlatformMailboxAddress(n);
      })
      || mailAccounts.find((a) => String(a.email || "").trim().toLowerCase() === preferredWorkMailAddress)
      || mailAccounts.find((a) => !isPlatformMailboxAddress(String(a.email || "").trim().toLowerCase()))
      || mailAccounts[0];
    return selected.id;
  }, [isPlatformMailboxAddress, mailAccounts, preferredPersonalMailAddress, preferredWorkMailAddress]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const response = await http.get("/suppliers/dashboard/projects");
      setProjects(response.data || []);
    } catch (err: unknown) {
      let message = "Projeler yuklenirken hata olustu";
      if (typeof err === "object" && err !== null && "response" in err) {
        const resp = (err as { response?: { data?: { detail?: string } } }).response;
        if (resp?.data?.detail) message = resp.data.detail;
      }
      setError(message);
    } finally { setLoading(false); }
  }, []);

  const loadSupplierIdentity = useCallback(async () => {
    try {
      const profile = await getSupplierProfile();
      setFirmName(profile.supplier.company_name || "Firma");
      if (profile.supplier.logo_url) {
        const base = import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || "http://127.0.0.1:8000";
        setFirmLogoUrl(profile.supplier.logo_url.startsWith("http") ? profile.supplier.logo_url : base + profile.supplier.logo_url);
      }
      setUserName(profile.user.name || profile.user.email);
      setUserEmail(profile.user.email);
      setUserPhone(profile.user.phone ?? null);
      setUserWorkEmail(profile.user.work_email ?? null);
      setSupplierUserId(profile.user.id);
      setAuthorizedUsers(profile.supplier.authorized_users ?? []);

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
      setFirmName("Firma"); setUserName("Tedarikçi kullanicisi");
    }
  }, []);

  useEffect(() => {
    if (!getSupplierAccessToken()) { window.location.href = "/supplier/login"; return; }
    void loadProjects();
    void loadSupplierIdentity();

    void (async () => {
      try {
        const res = await http.get<FirmInfo[]>("/suppliers/my-firms");
        setMyFirms(res.data || []);
      } catch { /* ignore */ }
    })();

    let stopMailPolling = false;
    const loadMail = async () => {
      try {
        const globalMailButtonConfig = await getDashboardMailButtonConfig();
        const isEnabled = globalMailButtonConfig.dashboard_mail_button_enabled !== false;
        setDashboardMailButtonEnabled(isEnabled);
        if (!isEnabled && !isSuperAdminSession) { setMailUnreadCount(0); setMailAccounts([]); return; }
        const accounts = await getMailCenterAccounts();
        setMailAccounts(accounts);
        setMailUnreadCount(accounts.reduce((s, a) => s + (a.unread_count || 0), 0));
      } catch (err: unknown) {
        const status = typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { status?: number } }).response?.status : undefined;
        if (status === 401 || status === 403) { stopMailPolling = true; setMailUnreadCount(0); setMailAccounts([]); }
      }
    };
    void loadMail();
    const mailInterval = window.setInterval(() => { if (stopMailPolling) return; void loadMail(); }, 45000);
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
      <div className="sd-shell">
        <div className="sd-loading">Yukleniyor...</div>
      </div>
    );
  }

  return (
    <div className="sd-shell">
      {/* ── TOP NAV ── */}
      <header className="sd-topnav">
        <div className="sd-topnav__left">
          <div className="sd-nav-brand">
            <div className="sd-nav-brand__logo-row">
              <PublicBrandLogo height={34} maxWidth={168} invert />
            </div>
            <div className="sd-firm-row">
              {firmLogoUrl
                ? <img className="sd-firm-logo" src={firmLogoUrl} alt={firmName} />
                : <div className="sd-firm-logo-placeholder">{firmName.slice(0, 2).toUpperCase()}</div>
              }
              <div className="sd-firm-name">{firmName}</div>
            </div>
          </div>
        </div>

        <nav className="sd-nav-links">
          <button type="button" className={`sd-nav-link${activeTab === "panel_home" ? " sd-nav-link--active" : ""}`} onClick={() => setActiveTab("panel_home")}>Anasayfa</button>
          <button type="button" className="sd-nav-link" onClick={() => navigate("/supplier/workspace?tab=offers")}>Tekliflerim</button>
          <button type="button" className="sd-nav-link" onClick={() => navigate("/supplier/workspace")}>Calisma Alani</button>
          <button type="button" className="sd-nav-link" onClick={() => navigate("/supplier/workspace?tab=profile")}>Profil</button>
          <button type="button" className={`sd-nav-link${activeTab === "platform_settings" ? " sd-nav-link--active" : ""}`} onClick={() => setActiveTab("platform_settings")}>Sistem Ayarlari</button>
        </nav>

        <div className="sd-nav-right">
          <button type="button" className="sd-user-btn" onClick={() => setUserMenuOpen((p) => !p)}>
            {userName} ▾
          </button>

          {userMenuOpen && (
            <div className="sd-user-menu">
              <div className="sd-user-menu__role">{roleText}</div>
              <button type="button" className="sd-user-menu-item" onClick={() => { setActiveTab("profil"); setUserMenuOpen(false); }}>
                Profilim
              </button>
              <button type="button" className="sd-user-menu-item sd-user-menu-item--danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>
                Çıkış Yap
              </button>
            </div>
          )}

          {(isSuperAdminSession || dashboardMailButtonEnabled) && (
            <button
              type="button"
              className={`sd-mail-btn${mailUnreadCount > 0 ? " sd-mail-btn--unread" : ""}`}
              onClick={() => setMailPopupOpen(true)}
              title="Mail Merkezi"
            >
              ✉ Mail
              {mailUnreadCount > 0 && (
                <span className="sd-mail-badge">{mailUnreadCount}</span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="sd-body">
        {/* Scope Banner */}
        <div className="sd-scope-banner">
          <div className="sd-scope-brand-card">
            <PublicBrandLogo height={24} maxWidth={80} invert />
          </div>
          <div className="sd-scope-info">
            <div className="sd-scope-label">Tedarikçi Platformu Yönetim Alanı</div>
            <div className="sd-scope-title">{firmName}</div>
            <div className="sd-scope-role">{roleText}</div>
          </div>
          <div className="sd-scope-right">
            <div className="sd-scope-welcome">Hoş geldiniz</div>
            <div className="sd-scope-user">{userName}</div>
            <div className="sd-scope-email">{userEmail}</div>
          </div>
        </div>

        {/* Work Menu Card */}
        <div className="sd-work-menu-card">
          <div className="sd-work-menu-label">Çalışma Menüsü</div>
          <div className="sd-work-menu-title">{roleText}</div>
          <div className="sd-pill-row">
            <button type="button" className={`sd-pill${activeTab === "panel_home" ? " sd-pill--active" : ""}`} onClick={() => setActiveTab("panel_home")}>Anasayfa</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=offers")}>Tekliflerim</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=contracts")}>Sözleşmelerim</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=guarantees")}>Teminatlarım</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=certificates")}>Sertifikalar</button>
            <button type="button" className="sd-pill" onClick={() => { flash("Roller ve Yetkiler yönetim alanı yakında açılacaktır.", "info"); }}>Roller ve Yetkiler</button>
            <button type="button" className="sd-pill" onClick={() => { flash("Departmanlar yönetim alanı yakında açılacaktır.", "info"); }}>Departmanlar</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=company_docs")}>Şirket Evrakları</button>
            <button type="button" className="sd-pill" onClick={() => navigate("/supplier/workspace?tab=profile")}>Firma Profili</button>
            <button type="button" className={`sd-pill${activeTab === "profil" ? " sd-pill--active" : ""}`} onClick={() => setActiveTab("profil")}>Profilim</button>
            {myFirms.length > 1 && (
              <button type="button" className={`sd-pill${activeTab === "firmalar" ? " sd-pill--active" : ""}`} onClick={() => setActiveTab("firmalar")}>Firmalarım ({myFirms.length})</button>
            )}
            <button type="button" className={`sd-pill${activeTab === "platform_settings" ? " sd-pill--active" : ""}`} onClick={() => setActiveTab("platform_settings")}>Sistem Ayarları</button>
          </div>
          <div className="sd-divider" />
        </div>

        {/* ── TAB: panel_home ── */}
        {activeTab === "panel_home" && (
          <>
            {error && <div className="sd-error-box">{error}</div>}

            <div className="sd-stats-row">
              <div className="sd-stat-box">
                <div className="sd-stat-box__lbl">Atanan Proje</div>
                <div className="sd-stat-box__val">{projects.length}</div>
              </div>
              <div className="sd-stat-box">
                <div className="sd-stat-box__lbl">Bekleyen Teklif</div>
                <div className="sd-stat-box__val sd-stat-box__val--amber">{pendingCount}</div>
              </div>
              <div className="sd-stat-box">
                <div className="sd-stat-box__lbl">Gönderilen Teklif</div>
                <div className="sd-stat-box__val sd-stat-box__val--green">{submittedCount}</div>
              </div>
              <div className="sd-stat-box">
                <div className="sd-stat-box__lbl">Dosyalı Proje</div>
                <div className="sd-stat-box__val">{withFilesCount}</div>
              </div>
            </div>

            <h2 className="sd-section-title">Size Atanan Projeler</h2>
            {projects.length === 0 ? (
              <div className="sd-empty">
                <div className="sd-empty__icon">📭</div>
                <h3>Henüz proje atanmamış</h3>
                <p>Size proje atandığında burada gösterilecektir</p>
              </div>
            ) : (
              <div className="sd-projects-grid">
                {projects.map((project) => (
                  <div className="sd-project-card" key={project.id}>
                    <div className="sd-project-card__company">
                      {resolveLogo(project.company?.logo_url) ? (
                        <img src={resolveLogo(project.company?.logo_url) || ""} alt="firma" className="sd-company-logo" />
                      ) : (
                        <div className="sd-company-logo-placeholder">🏢</div>
                      )}
                      <div>
                        <div className="sd-company-label">İş Veren Firma</div>
                        <div className="sd-company-name">{project.company?.name || "Firma bilgisi yok"}</div>
                      </div>
                    </div>

                    <h3>{project.name}</h3>

                    <span className={`sd-status-badge${project.supplier_quote?.submitted ? " sd-status-badge--submitted" : " sd-status-badge--pending"}`}>
                      {project.supplier_quote?.submitted ? "Teklif Gönderildi" : "Teklif Bekleniyor"}
                    </span>

                    {project.quote?.title && (
                      <div className="sd-quote-info">
                        <div className="sd-quote-info__label">Teklif Basligi</div>
                        <div className="sd-quote-info__value">{project.quote.title}</div>
                      </div>
                    )}
                    {project.quote?.description && (
                      <div className="sd-quote-desc">{project.quote.description}</div>
                    )}

                    {(project.project_files || []).length > 0 && (
                      <div className="sd-file-section">
                        <div className="sd-file-section__label">Dosyalar</div>
                        <div className="sd-file-list">
                          {(project.project_files || []).slice(0, 4).map((f) => (
                            <div key={f.id} className="sd-file-row">
                              <div className="sd-file-info">
                                <div className="sd-file-info__name">{f.name}</div>
                                <div className="sd-file-info__size">{(f.size / 1024).toFixed(1)} KB</div>
                              </div>
                              <div className="sd-file-actions">
                                <button type="button" className="sd-file-btn" onClick={(e) => { void openFile(f.id, e); }}>Aç</button>
                                <button type="button" className="sd-file-btn sd-file-btn--download" onClick={(e) => { void downloadFile(f.id, f.name, e); }}>İndir</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="sd-project-card__actions">
                      <button type="button" className="sd-project-card__btn sd-project-card__btn--primary" onClick={() => handleRespondQuote(project)}>Teklifi Aç</button>
                      <button type="button" className="sd-project-card__btn sd-project-card__btn--secondary" onClick={() => { void handleDeclineQuote(project); }}>Reddet</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="sd-support-box">
              <h2 className="sd-section-title">Destek</h2>
              <p className="sd-support-box__text">
                Sorularınız için <strong>info@buyerasistans.com</strong> adresine e-posta gönderin.
              </p>
            </div>

            <div className="sd-quick-grid">
              <button type="button" className="sd-quick-card" onClick={() => navigate("/supplier/workspace?tab=offers")}>
                <div className="sd-quick-card__title">Tekliflerim</div>
                <div className="sd-quick-card__desc">Tüm teklif kayıtlarına git, eksik kalanları tamamla.</div>
                <div className="sd-quick-card__cta">Aç →</div>
              </button>
              <button type="button" className="sd-quick-card" onClick={() => navigate("/supplier/workspace?tab=profile")}>
                <div className="sd-quick-card__title">Firma Profili</div>
                <div className="sd-quick-card__desc">Firma bilgileri, logo ve iletişim bilgilerini düzenle.</div>
                <div className="sd-quick-card__cta">Aç →</div>
              </button>
              <button type="button" className="sd-quick-card" onClick={() => setActiveTab("platform_settings")}>
                <div className="sd-quick-card__title">Sistem Ayarları</div>
                <div className="sd-quick-card__desc">SMTP / POP3 / IMAP e-posta ayarlarını yönet.</div>
                <div className="sd-quick-card__cta">Aç →</div>
              </button>
            </div>
          </>
        )}

        {/* ── TAB: platform_settings ── */}
        {activeTab === "platform_settings" && (
          <>
            <h2 className="sd-section-title">Sistem Ayarları — E-posta (SMTP / IMAP / POP3)</h2>
            <p className="sd-tab-desc">
              Platform varsayılan ayarları super admin tarafından belirlenir. Bu firma için özel ayar tanımlanmamışsa sistem otomatik olarak platform varsayılanını kullanır. Aşağıdan firma özel ayarları tanımlanabilir; super admin tüm ayarları görür, düzenler veya silebilir.
            </p>
            <ScopeSettingsBoard userId={supplierUserId} />
          </>
        )}

        {/* ── TAB: profil ── */}
        {activeTab === "profil" && (
          <>
            <h2 className="sd-section-title">Kullanıcı Profilim</h2>
            <p className="sd-tab-desc">Kişisel bilgilerinizi ve firma yetkilileri listesini buradan yönetebilirsiniz.</p>
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

        {/* ── TAB: firmalar ── */}
        {activeTab === "firmalar" && (
          <>
            <h2 className="sd-section-title">Bağlı Olduğum Firmalar</h2>
            <p className="sd-tab-desc">Bu kullanıcının yetkili olduğu tedarikçi firmaları. Başka bir firmaya geçmek için ilgili kartı kullanın.</p>
            <FirmsSection
              firms={myFirms}
              onSwitch={(firm) => {
                flash(`${firm.company_name} firmasına geçiş yapılamaz — tek oturum desteklenmektedir. Yeni firmaya katılım davetiyesi ile giriş yapınız.`, "info");
              }}
            />
          </>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="sd-hidden" aria-label="Logo dosyası seç" />

      {userMenuOpen && (
        <div className="sd-menu-overlay" onClick={() => setUserMenuOpen(false)} />
      )}

      {toast && <div className={`sd-toast sd-toast--${toast.type}`}>{toast.msg}</div>}

      {(isSuperAdminSession || dashboardMailButtonEnabled) && (
        <MailCenterPopup
          isOpen={mailPopupOpen}
          initialAccountId={preferredMailAccountId}
          onClose={() => setMailPopupOpen(false)}
        />
      )}
    </div>
  );
}
