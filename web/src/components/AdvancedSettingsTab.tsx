import React, { useCallback, useEffect, useState } from "react";
import "./AdvancedSettingsTab.css";
import {
  getEmailSettings,
  getEmailProfiles,
  updateEmailSettings,
  testEmailSettings,
  getLoggingSettings,
  updateLoggingSettings,
  getBackupSettings,
  updateBackupSettings,
  triggerBackupManually,
  getNotificationSettings,
  updateNotificationSettings,
  getAPIKeys,
  createAPIKey,
  revokeAPIKey,
  uploadEmailSignatureImage,
  getEmailHealthSummary,
  type EmailSettingsData,
  type EmailProfileSummary,
  type LoggingSettingsData,
  type BackupSettingsData,
  type NotificationSettingsData,
  type APIKeyData,
  type EmailHealthSummary,
} from "../services/advanced-settings.service";
import {
  getSystemEmails,
  createSystemEmail,
  updateSystemEmail,
  provisionSystemEmail,
  deleteSystemEmail,
  type SystemEmail,
  type SystemEmailCreate,
} from "../services/system-email.service";
import {
  getCompanyMailVisibility,
  updateCompanyMailVisibility,
  type CompanyMailVisibilityRow,
} from "../services/mail-center.service";
import { useAuth } from "../hooks/useAuth";
import {
  canAccessProcurementSettings,
  canManageSharedEmailProfiles,
  getUserScopeType,
  isPlatformStaffUser,
  isSuperAdminUser,
} from "../auth/permissions";

type TabType = "email" | "logging" | "backup" | "notifications" | "api-keys";

type ChannelEmailTemplateKey = "quote_invite" | "approval" | "reminder";

interface ChannelEmailTemplate {
  key: ChannelEmailTemplateKey;
  label: string;
  subject: string;
  body: string;
}

interface SignaturePreset {
  id: string;
  name: string;
  signature_name: string;
  signature_title: string;
  signature_note: string;
}

interface ChannelEmailPreferences {
  templates: ChannelEmailTemplate[];
  signature_library: SignaturePreset[];
  send_rate_per_hour: number;
  send_quota_per_day: number;
  allowed_from_domains: string[];
  fallback_policy: "platform_default" | "secondary_mailbox" | "queue_only";
  secondary_fallback_email: string;
  branding_logo_url: string;
  branding_primary_color: string;
  sender_alias: string;
}

const DEFAULT_CHANNEL_EMAIL_PREFERENCES: ChannelEmailPreferences = {
  templates: [
    {
      key: "quote_invite",
      label: "Teklif Daveti",
      subject: "Yeni teklif daveti: {{project_name}}",
      body: "Merhaba {{recipient_name}},\n\n{{project_name}} projesi icin teklif davetiniz olusturuldu.",
    },
    {
      key: "approval",
      label: "Onay Bildirimi",
      subject: "Onay durumu guncellendi: {{status}}",
      body: "Merhaba {{recipient_name}},\n\nTeklifinizin onay durumu {{status}} olarak guncellendi.",
    },
    {
      key: "reminder",
      label: "Hatirlatma",
      subject: "Hatirlatma: {{project_name}} icin son tarih",
      body: "Merhaba {{recipient_name}},\n\n{{project_name}} icin son teklif tarihi yaklasiyor.",
    },
  ],
  signature_library: [],
  send_rate_per_hour: 120,
  send_quota_per_day: 1200,
  allowed_from_domains: [],
  fallback_policy: "platform_default",
  secondary_fallback_email: "",
  branding_logo_url: "",
  branding_primary_color: "#2563eb",
  sender_alias: "",
};

interface EmToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}
const EmToggle: React.FC<EmToggleProps> = ({ label, hint, checked, onChange, disabled }) => (
  <div className={`em-toggle${disabled ? " em-toggle--disabled" : ""}`}>
    <div className="em-toggle__txt">
      <b>{label}</b>
      {hint ? <span>{hint}</span> : null}
    </div>
    <button
      type="button"
      aria-label={label}
      className={`em-switch${checked ? " on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
    >
      <span className="em-switch__thumb" />
    </button>
  </div>
);

export const AdvancedSettingsTab: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user);
  const canManageProfiles = canManageSharedEmailProfiles(user);
  const scopeType = getUserScopeType(user);
  const isChannelScope = scopeType === "channel";
  const canAccessSettingsSurface = canAccessProcurementSettings(user);
  const canManageApiKeys = canAccessSettingsSurface;
  const canManageEmailSettings = canAccessSettingsSurface || isChannelScope;
  const readOnly =
    isPlatformStaffUser(user)
    || scopeType === "supplier"
    || !canManageEmailSettings;
  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Email
  const [emailSettings, setEmailSettings] = useState<EmailSettingsData | null>(null);
  const [emailForm, setEmailForm] = useState<EmailSettingsData>({});
  const [emailProfiles, setEmailProfiles] = useState<EmailProfileSummary[]>([]);
  const [selectedEmailProfileOwnerId, setSelectedEmailProfileOwnerId] = useState<number | null | undefined>(undefined);
  const [isEmailCustomizationOpen, setIsEmailCustomizationOpen] = useState<boolean>(isSuperAdmin || readOnly);

  // Logging
  const [loggingSettings, setLoggingSettings] = useState<LoggingSettingsData | null>(null);
  const [loggingForm, setLoggingForm] = useState<LoggingSettingsData>({});

  // Backup
  const [backupSettings, setBackupSettings] = useState<BackupSettingsData | null>(null);
  const [backupForm, setBackupForm] = useState<BackupSettingsData>({});

  // Notification
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsData | null>(null);
  const [notificationForm, setNotificationForm] = useState<NotificationSettingsData>({});

  // API Keys
  const [apiKeys, setApiKeys] = useState<APIKeyData[]>([]);
  const [newKeyName, setNewKeyName] = useState("");

  // System Emails
  const [systemEmails, setSystemEmails] = useState<SystemEmail[]>([]);
  const [newSystemEmail, setNewSystemEmail] = useState<SystemEmailCreate>({
    email: "",
    password: "",
    description: "",
  });
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [editingImapPassword, setEditingImapPassword] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingSignatureName, setEditingSignatureName] = useState("");
  const [editingSignatureTitle, setEditingSignatureTitle] = useState("");
  const [editingSignatureNote, setEditingSignatureNote] = useState("");
  const [companyMailVisibilityRows, setCompanyMailVisibilityRows] = useState<CompanyMailVisibilityRow[]>([]);
  const [togglingCompanyId, setTogglingCompanyId] = useState<number | null>(null);
  const [provisioningEmailId, setProvisioningEmailId] = useState<number | null>(null);
  const [emailHealth, setEmailHealth] = useState<EmailHealthSummary | null>(null);
  const [emailHealthLoading, setEmailHealthLoading] = useState(false);
  const [channelPrefs, setChannelPrefs] = useState<ChannelEmailPreferences>(DEFAULT_CHANNEL_EMAIL_PREFERENCES);
  const [activeTemplateKey, setActiveTemplateKey] = useState<ChannelEmailTemplateKey>("quote_invite");
  const [newAllowedDomain, setNewAllowedDomain] = useState("");
  const [newPresetName, setNewPresetName] = useState("");

  const channelPrefStorageKey = `channel-email-preferences-v1:${user?.id ?? "anonymous"}`;

  const normalizeDomain = (raw: string) =>
    raw.trim().toLowerCase().replace(/^@+/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const readStoredChannelPrefs = useCallback((): ChannelEmailPreferences => {
    try {
      const raw = window.localStorage.getItem(channelPrefStorageKey);
      if (!raw) return DEFAULT_CHANNEL_EMAIL_PREFERENCES;
      const parsed = JSON.parse(raw) as Partial<ChannelEmailPreferences>;
      return {
        ...DEFAULT_CHANNEL_EMAIL_PREFERENCES,
        ...parsed,
        templates: parsed.templates && parsed.templates.length > 0 ? parsed.templates : DEFAULT_CHANNEL_EMAIL_PREFERENCES.templates,
        signature_library: parsed.signature_library ?? [],
        allowed_from_domains: (parsed.allowed_from_domains ?? []).map(normalizeDomain).filter(Boolean),
      };
    } catch {
      return DEFAULT_CHANNEL_EMAIL_PREFERENCES;
    }
  }, [channelPrefStorageKey]);

  const persistChannelPrefs = useCallback((next: ChannelEmailPreferences) => {
    window.localStorage.setItem(channelPrefStorageKey, JSON.stringify(next));
  }, [channelPrefStorageKey]);

  const updateTemplateField = useCallback(
    (key: ChannelEmailTemplateKey, field: "subject" | "body", value: string) => {
      setChannelPrefs((prev) => ({
        ...prev,
        templates: prev.templates.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
      }));
    },
    [],
  );

  const resolveFriendlyErrorMessage = (err: unknown, fallback: string, forbiddenFallback: string) => {
    const maybeResponse =
      typeof err === "object" && err !== null && "response" in err
        ? (err as { response?: { status?: number; data?: { detail?: string } } }).response
        : undefined;
    const statusCode = maybeResponse?.status;
    const backendDetail = maybeResponse?.data?.detail;
    if (statusCode === 401 || statusCode === 403) {
      return forbiddenFallback;
    }
    return backendDetail || (err instanceof Error ? err.message : fallback);
  };

  const loadSettings = useCallback(async (ownerUserId?: number | null) => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        getEmailSettings(ownerUserId),
        canAccessSettingsSurface ? getLoggingSettings() : Promise.resolve(null),
        canAccessSettingsSurface ? getBackupSettings() : Promise.resolve(null),
        canAccessSettingsSurface ? getNotificationSettings() : Promise.resolve(null),
        canManageApiKeys ? getAPIKeys() : Promise.resolve([]),
        getEmailProfiles(),
      ]);

      const email = results[0].status === "fulfilled" ? results[0].value : null;
      const logging = results[1].status === "fulfilled" ? results[1].value : null;
      const backup = results[2].status === "fulfilled" ? results[2].value : null;
      const notifications = results[3].status === "fulfilled" ? results[3].value : null;
      const keys = results[4].status === "fulfilled" ? results[4].value : [];
      const profiles = results[5].status === "fulfilled" ? results[5].value : [];

      setEmailSettings(email);
      setEmailForm(email ?? {});
      setLoggingSettings(logging);
      setLoggingForm(logging ?? {});
      setBackupSettings(backup);
      setBackupForm(backup ?? {});
      setNotificationSettings(notifications);
      setNotificationForm(notifications ?? {});
      setApiKeys(keys ?? []);
      setEmailProfiles(profiles);
      if (selectedEmailProfileOwnerId === undefined) {
        if (canManageProfiles) {
          setSelectedEmailProfileOwnerId(ownerUserId ?? null);
        } else {
          setSelectedEmailProfileOwnerId(user?.id ?? null);
        }
      }
      const firstError = results.find((item) => item.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstError) {
        const messageText = resolveFriendlyErrorMessage(
          firstError.reason,
          "Bazi gelismis ayarlar yuklenemedi",
          "Bazi gelismis ayarlar yetki nedeniyle yuklenemedi.",
        );
        setMessage({ type: "error", text: messageText });
      }
    } catch (err) {
      const messageText = resolveFriendlyErrorMessage(
        err,
        "Ayarlar yuklenemedi",
        "Bu panelde gelismis ayarlar salt okunur veya erisim disidir.",
      );
      setMessage({
        type: "error",
        text: messageText,
      });
    } finally {
      setLoading(false);
    }
  }, [canAccessSettingsSurface, canManageApiKeys, canManageProfiles, selectedEmailProfileOwnerId, user]);

  const loadSystemEmails = useCallback(async (ownerUserId?: number | null) => {
    try {
      const list = await getSystemEmails(ownerUserId);
      setSystemEmails(list ?? []);
    } catch (err) {
      const maybeResponse =
        typeof err === "object" && err !== null && "response" in err
          ? (err as { response?: { status?: number } }).response
          : undefined;
      if (maybeResponse?.status !== 404) {
        const messageText = resolveFriendlyErrorMessage(
          err,
          "Sistem mailleri yuklenemedi",
          "Bu panelde sistem mail hesaplari salt okunur veya erisim disidir.",
        );
        setMessage({
          type: "error",
          text: messageText,
        });
      }
    }
  }, []);

  const loadCompanyMailVisibility = useCallback(async () => {
    if (!isSuperAdmin) {
      setCompanyMailVisibilityRows([]);
      return;
    }
    try {
      const rows = await getCompanyMailVisibility();
      setCompanyMailVisibilityRows(rows ?? []);
    } catch (err) {
      const messageText = resolveFriendlyErrorMessage(
        err,
        "Firma bazli mail gorunurluk listesi yuklenemedi",
        "Firma bazli mail gorunurluk listesine erisim yetkiniz yok.",
      );
      setMessage({ type: "error", text: messageText });
    }
  }, [isSuperAdmin]);

  const handleToggleCompanyMailVisibility = useCallback(async (row: CompanyMailVisibilityRow) => {
    try {
      setTogglingCompanyId(row.company_id);
      const updated = await updateCompanyMailVisibility(row.company_id, !row.enabled);
      setCompanyMailVisibilityRows((prev) =>
        prev.map((item) =>
          item.company_id === updated.company_id
            ? { ...item, enabled: updated.enabled }
            : item,
        ),
      );
    } catch (err) {
      const messageText = resolveFriendlyErrorMessage(
        err,
        "Firma mail gorunurluk ayari guncellenemedi",
        "Firma mail gorunurluk ayarini guncelleme yetkiniz yok.",
      );
      setMessage({ type: "error", text: messageText });
    } finally {
      setTogglingCompanyId(null);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (selectedEmailProfileOwnerId === undefined) return;
    void loadSettings(selectedEmailProfileOwnerId);
    void loadSystemEmails(selectedEmailProfileOwnerId);
  }, [loadSettings, loadSystemEmails, selectedEmailProfileOwnerId]);

  useEffect(() => {
    void loadCompanyMailVisibility();
  }, [loadCompanyMailVisibility]);

  useEffect(() => {
    if (isSuperAdmin) {
      setIsEmailCustomizationOpen(true);
    }
  }, [isSuperAdmin]);

  const loadEmailHealth = useCallback(async (ownerUserId?: number | null) => {
    try {
      setEmailHealthLoading(true);
      const summary = await getEmailHealthSummary(ownerUserId);
      setEmailHealth(summary);
    } catch {
      setEmailHealth(null);
    } finally {
      setEmailHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isChannelScope) return;
    setChannelPrefs(readStoredChannelPrefs());
  }, [isChannelScope, readStoredChannelPrefs]);

  useEffect(() => {
    if (!isChannelScope) return;
    persistChannelPrefs(channelPrefs);
  }, [channelPrefs, isChannelScope, persistChannelPrefs]);

  useEffect(() => {
    if (selectedEmailProfileOwnerId === undefined) return;
    void loadEmailHealth(selectedEmailProfileOwnerId);
  }, [loadEmailHealth, selectedEmailProfileOwnerId]);

  // Email handlers
  const handleEmailSave = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde email ayarlari salt okunur." });
      return;
    }

    const effectiveFromEmail = (emailForm.from_email || emailForm.smtp_username || "").trim().toLowerCase();
    if (isChannelScope && channelPrefs.allowed_from_domains.length > 0 && effectiveFromEmail.includes("@")) {
      const fromDomain = normalizeDomain(effectiveFromEmail.split("@").pop() || "");
      if (!channelPrefs.allowed_from_domains.includes(fromDomain)) {
        setMessage({
          type: "error",
          text: `From domain izni yok: ${fromDomain}. Izinli domain listesini guncelleyin.`,
        });
        return;
      }
    }

    try {
      setLoading(true);
      const payload: EmailSettingsData = {
        ...emailForm,
        from_name: isChannelScope
          ? (channelPrefs.sender_alias || emailForm.from_name || "ProcureFlow").trim()
          : emailForm.from_name,
      };
      const updated = await updateEmailSettings(payload, selectedEmailProfileOwnerId);
      setEmailSettings(updated);
      setEmailForm(updated);
      if (isChannelScope && channelPrefs.signature_library.length > 0) {
        setMessage({ type: "success", text: "Email ayarlari kaydedildi. Kanal profili tercihleri de kaydedildi." });
        return;
      }
      if (!isSuperAdmin) {
        setIsEmailCustomizationOpen(false);
        setMessage({ type: "success", text: "Email ayarları kaydedildi ve ekran normal görünüme döndürüldü." });
      } else {
        setMessage({ type: "success", text: "Email ayarları kaydedildi" });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Kaydetme hatasi",
          "Bu panelde email ayarlarini guncelleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailTest = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde test gönderimi kapatılmış durumda." });
      return;
    }
    if (!emailForm.from_email && !emailForm.smtp_username) {
      setMessage({ type: "error", text: "Test için gönderen e-posta gerekli" });
      return;
    }

    try {
      setLoading(true);
      await testEmailSettings(
        {
          ...emailForm,
          to_email: emailForm.from_email || emailForm.smtp_username || "",
        },
        selectedEmailProfileOwnerId,
      );
      setMessage({ type: "success", text: "Test e-postası gönderildi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Test gönderimi başarısız",
          "Bu panelde test e-postası gönderme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureImageUpload = async (file: File | null) => {
    if (!file) return;
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde imza gorseli yukleme yetkiniz yok." });
      return;
    }
    try {
      setLoading(true);
      const result = await uploadEmailSignatureImage(file, selectedEmailProfileOwnerId);
      setEmailForm((prev) => ({ ...prev, signature_image_url: result.signature_image_url }));
      setMessage({ type: "success", text: "İmza görseli yüklendi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Imza gorseli yuklenemedi",
          "Bu panelde imza gorseli yukleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // Logging handlers
  const handleLoggingSave = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde logging ayarlari salt okunur." });
      return;
    }
    try {
      setLoading(true);
      const updated = await updateLoggingSettings(loggingForm);
      setLoggingSettings(updated);
      setLoggingForm(updated);
      setMessage({ type: "success", text: "Logging ayarları kaydedildi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Kaydetme hatasi",
          "Bu panelde logging ayari guncelleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // Backup handlers
  const handleBackupSave = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde yedekleme ayarlari salt okunur." });
      return;
    }
    try {
      setLoading(true);
      const updated = await updateBackupSettings(backupForm);
      setBackupSettings(updated);
      setBackupForm(updated);
      setMessage({ type: "success", text: "Yedekleme ayarları kaydedildi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Kaydetme hatasi",
          "Bu panelde yedekleme ayari guncelleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackupTrigger = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde manuel yedekleme baslatma kapatilmis durumda." });
      return;
    }
    try {
      setLoading(true);
      await triggerBackupManually();
      setMessage({ type: "success", text: "Yedekleme başlatıldı" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Yedekleme baslatilamadi",
          "Bu panelde manuel yedekleme baslatma yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // Notification handlers
  const handleNotificationSave = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde bildirim ayarlari salt okunur." });
      return;
    }
    try {
      setLoading(true);
      const updated = await updateNotificationSettings(notificationForm);
      setNotificationSettings(updated);
      setNotificationForm(updated);
      setMessage({ type: "success", text: "Bildirim ayarları kaydedildi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Kaydetme hatasi",
          "Bu panelde bildirim ayari guncelleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // API key handlers
  const handleCreateAPIKey = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde API anahtari olusturma kapatilmis durumda." });
      return;
    }
    if (!newKeyName.trim()) {
      setMessage({ type: "error", text: "API anahtarı adı gerekli" });
      return;
    }

    try {
      setLoading(true);
      const newKey = await createAPIKey(newKeyName.trim());
      setApiKeys((prev) => [...prev, newKey]);
      setNewKeyName("");
      setMessage({ type: "success", text: "API anahtarı oluşturuldu" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "API anahtari olusturulamadi",
          "Bu panelde API anahtari olusturma yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAPIKey = async (keyId: number) => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde API anahtari iptal etme kapatilmis durumda." });
      return;
    }
    if (!window.confirm("API anahtarını iptal etmek istediğinize emin misiniz?")) return;

    try {
      setLoading(true);
      await revokeAPIKey(keyId);
      setApiKeys((prev) => prev.filter((k: APIKeyData) => k.id !== keyId));
      setMessage({ type: "success", text: "API anahtarı iptal edildi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Iptal islemi basarisiz",
          "Bu panelde API anahtari iptal etme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // System email handlers
  const handleSystemEmailCreate = async () => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde sistem mail hesabi ekleme kapatilmis durumda." });
      return;
    }
    if (!newSystemEmail.email?.trim()) {
      setMessage({ type: "error", text: "Email zorunlu" });
      return;
    }

    try {
      setLoading(true);
      const created = await createSystemEmail({
        ...newSystemEmail,
        password: (newSystemEmail.password || "").trim(),
        owner_user_id: selectedEmailProfileOwnerId ?? null,
      });
      setSystemEmails((prev) => [...prev, created]);
      setNewSystemEmail({ email: "", password: "", description: "" });
      if (created.mailbox_provision_status === "provisioned") {
        setMessage({
          type: "success",
          text: created.mailbox_provision_message || "Hostingte mailbox olusturuldu ve sifre otomatik kaydedildi.",
        });
      } else {
        setMessage({ type: "success", text: "Sistem mail hesabı eklendi" });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Sistem mail hesabi eklenemedi",
          "Bu panelde sistem mail hesabi ekleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemEmailEdit = (email: SystemEmail) => {
    setEditingEmailId(email.id);
    setEditingPassword("");
    setEditingImapPassword("");
    setEditingDescription(email.description ?? "");
    setEditingSignatureName(email.signature_name ?? "");
    setEditingSignatureTitle(email.signature_title ?? "");
    setEditingSignatureNote(email.signature_note ?? "");
  };

  const handleSystemEmailUpdate = async (id: number) => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde sistem mail hesabi guncelleme kapatilmis durumda." });
      return;
    }
    try {
      setLoading(true);
      const payload: Partial<SystemEmailCreate> = {
        description: editingDescription,
        signature_name: editingSignatureName,
        signature_title: editingSignatureTitle,
        signature_note: editingSignatureNote,
      };
      if (editingPassword.trim()) payload.password = editingPassword.trim();
      if (editingImapPassword.trim()) payload.imap_password = editingImapPassword.trim();

      const updated = await updateSystemEmail(id, payload);
      setSystemEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingEmailId(null);
      setEditingPassword("");
      setEditingImapPassword("");
      setEditingDescription("");
      setEditingSignatureName("");
      setEditingSignatureTitle("");
      setEditingSignatureNote("");
      setMessage({ type: "success", text: "Sistem mail hesabı güncellendi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Guncelleme basarisiz",
          "Bu panelde sistem mail hesabi guncelleme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemEmailDelete = async (id: number) => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde sistem mail hesabi silme kapatilmis durumda." });
      return;
    }
    if (!window.confirm("Bu sistem mail hesabını silmek istediğinize emin misiniz?")) return;

    try {
      setLoading(true);
      await deleteSystemEmail(id);
      setSystemEmails((prev) => prev.filter((e) => e.id !== id));
      setMessage({ type: "success", text: "Sistem mail hesabı silindi" });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Silme islemi basarisiz",
          "Bu panelde sistem mail hesabi silme yetkiniz yok.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemEmailProvision = async (id: number) => {
    if (readOnly) {
      setMessage({ type: "error", text: "Bu panelde hostingte mailbox acma kapatilmis durumda." });
      return;
    }
    try {
      setProvisioningEmailId(id);
      const updated = await provisionSystemEmail(id);
      setSystemEmails((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setMessage({
        type: updated.mailbox_provision_status === "provisioned" ? "success" : "error",
        text: updated.mailbox_provision_message || "Hosting mailbox islem sonucu alindi.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: resolveFriendlyErrorMessage(
          err,
          "Hosting mailbox islemi basarisiz",
          "Bu panelde hosting mailbox islemi yetkiniz yok.",
        ),
      });
    } finally {
      setProvisioningEmailId(null);
    }
  };

  const shouldShowEmailCustomization = isSuperAdmin || readOnly || isEmailCustomizationOpen;

  return (
    <div className="em-wrap">
      {message && (
        <div className={`em-banner em-banner--${message.type}`}>
          {message.type === "success" ? "✅" : "�?�"} {message.text}
        </div>
      )}

      {readOnly && (
        <div className="em-note em-note--err">
          Bu panel bu profil için salt okunur çalışıyor; sadece görüntüleme yapabilirsiniz.
        </div>
      )}

      {isChannelScope && !readOnly && (
        <div className="em-note em-note--blue">
          Kanal hesap sahibi panelinde e-posta ayarları ve mailbox yönetimi açıktır.
        </div>
      )}

      <div className="em-tabs">
        <button className={`em-tab${activeTab === "email" ? " on" : ""}`} onClick={() => setActiveTab("email")}>?��� Email</button>
        {canAccessSettingsSurface && (
          <>
            <button className={`em-tab${activeTab === "logging" ? " on" : ""}`} onClick={() => setActiveTab("logging")}>?��� Logging</button>
            <button className={`em-tab${activeTab === "backup" ? " on" : ""}`} onClick={() => setActiveTab("backup")}>?��� Yedekleme</button>
            <button className={`em-tab${activeTab === "notifications" ? " on" : ""}`} onClick={() => setActiveTab("notifications")}>?��� Bildirimler</button>
          </>
        )}
        {canManageApiKeys && (
          <button className={`em-tab${activeTab === "api-keys" ? " on" : ""}`} onClick={() => setActiveTab("api-keys")}>?��� API Anahtarları</button>
        )}
      </div>

      {activeTab === "email" && (
        <>
          {/* Profile selector */}
          <div className="em-psel-wrap">
            <div className="em-psel-head">
              <div>
                <b>{canManageProfiles ? "Profil Seçimi" : "Kullanılan Profil"}</b>
                <span>
                  {canManageProfiles
                    ? "Süper admin varsayılan sistem SMTP profilini ve admin profillerini ayrı ayrı düzenleyebilir."
                    : "Admin sadece kendi SMTP profilini ve kendi e-posta hesaplarını görür."}
                </span>
              </div>
              <span className="em-profiles__count">{emailProfiles.length} profil</span>
            </div>
            <div className="em-psel-body">
              {canManageProfiles ? (
                <select
                  className="em-input"
                  aria-label="Profil Seçimi"
                  value={selectedEmailProfileOwnerId === null ? "default" : String(selectedEmailProfileOwnerId ?? "default")}
                  onChange={(e) => setSelectedEmailProfileOwnerId(e.target.value === "default" ? null : Number(e.target.value))}
                >
                  {emailProfiles.map((profile) => (
                    <option
                      key={profile.owner_user_id === null ? "default" : String(profile.owner_user_id)}
                      value={profile.owner_user_id === null ? "default" : String(profile.owner_user_id)}
                    >
                      {profile.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ fontWeight: 700, color: "var(--pf-slate-900)", fontSize: 13 }}>Kendi SMTP profiliniz</div>
              )}
            </div>
          </div>

          {!isSuperAdmin && (
            <div className="em-note em-note--blue">
              <div className="em-flex1">
                <div className="em-note-cap">
                  Varsayılan Kullanım Bilgisi
                </div>
                <div>Standart akışta sistem, buyerasistans.com.tr varsayılan ayarlarını kullanır. Özel sağlayıcı kullanmak için ayar ekranını açabilirsiniz.</div>
                <button
                  type="button"
                  onClick={() => setIsEmailCustomizationOpen((prev) => !prev)}
                  className={isEmailCustomizationOpen ? "em-btn--ghost em-mt10" : "em-btn--primary em-mt10"}
                >
                  {isEmailCustomizationOpen ? "Özelleştirme Ekranını Kapat" : "SMTP / POP / IMAP Ayarlarını Özelleştir"}
                </button>
              </div>
            </div>
          )}

          <fieldset disabled={readOnly} className="em-fieldset">

          {!isSuperAdmin && !isEmailCustomizationOpen && (
            <p className="em-muted">Aktif Email Profili: Standart profil kullanılıyor. Özelleştirmek için yukarıdaki butonu kullanın.</p>
          )}

          {shouldShowEmailCustomization && (
            <>

          <div className="em-grid">

            {/* SMTP */}
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">📤</span>
                <div className="em-card__ttl">
                  <b>Giden Sunucu (SMTP)</b>
                  <span>Sistem e-postalarının gönderildiği sunucu</span>
                </div>
                <div className="em-card__right">
                  <button type="button" className={`em-test${loading ? " loading" : ""}`} onClick={handleEmailTest} disabled={loading}>
                    {loading ? "Gönderiliyor…" : "Test e-postası gönder"}
                  </button>
                </div>
              </header>
              <div className="em-card__body">
                <div className="em-row2">
                  <label className="em-field">
                    <span className="em-field__label">SMTP Host</span>
                    <input className="em-input em-input--mono" type="text" placeholder="smtp.alanadi.com"
                      value={emailForm.smtp_host ?? ""}
                      onChange={(e) => setEmailForm({ ...emailForm, smtp_host: e.target.value })} />
                  </label>
                  <label className="em-field em-field--half">
                    <span className="em-field__label">Port</span>
                    <input className="em-input em-input--mono" type="number"
                      value={emailForm.smtp_port ?? 587}
                      onChange={(e) => setEmailForm({ ...emailForm, smtp_port: Number.isNaN(Number(e.target.value)) ? 587 : Number(e.target.value) })} />
                  </label>
                </div>
                <label className="em-field">
                  <span className="em-field__label">SMTP Kullanıcı Adı</span>
                  <input className="em-input" type="text" placeholder="noreply@firma.com"
                    value={emailForm.smtp_username ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, smtp_username: e.target.value })} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">SMTP �?ifre</span>
                  <input className="em-input em-input--mono" type="password" placeholder="••••••••"
                    value={emailForm.smtp_password ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, smtp_password: e.target.value })} />
                </label>
                <EmToggle label="TLS Kullan"
                  checked={Boolean((emailForm as Record<string, unknown>).use_tls)}
                  onChange={(v) => setEmailForm({ ...emailForm, use_tls: v } as EmailSettingsData)} />
                <EmToggle label="SSL Kullan"
                  checked={Boolean((emailForm as Record<string, unknown>).use_ssl)}
                  onChange={(v) => setEmailForm({ ...emailForm, use_ssl: v } as EmailSettingsData)} />
              </div>
            </section>

            {/* Sender Identity */}
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">✉️</span>
                <div className="em-card__ttl">
                  <b>Gönderici Kimliği</b>
                  <span>From adı, e-posta ve reply-to adresi</span>
                </div>
              </header>
              <div className="em-card__body">
                <label className="em-field">
                  <span className="em-field__label">From E-posta</span>
                  <input className="em-input" type="email" placeholder="noreply@firma.com"
                    value={emailForm.from_email ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, from_email: e.target.value })} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">From Adı</span>
                  <input className="em-input" type="text" placeholder="ProcureFlow"
                    value={emailForm.from_name ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, from_name: e.target.value })} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">Reply-To</span>
                  <input className="em-input" type="email" placeholder="destek@ornek.com"
                    value={emailForm.reply_to_email ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, reply_to_email: e.target.value })} />
                </label>
                <EmToggle label="Domain modunu aktif et" hint="Sistem link ve maillerini canlı domain üzerinden üretir"
                  checked={Boolean((emailForm as Record<string, unknown>).use_custom_app_url)}
                  onChange={(v) => setEmailForm({ ...emailForm, use_custom_app_url: v } as EmailSettingsData)} />
              </div>
            </section>

            {/* Domain & App */}
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">🌐</span>
                <div className="em-card__ttl">
                  <b>Domain &amp; Uygulama</b>
                  <span>Geliştirme URL ve canlı domain ayarları</span>
                </div>
              </header>
              <div className="em-card__body">
                <label className="em-field">
                  <span className="em-field__label">Uygulama URL (Geliştirme)</span>
                  <input className="em-input em-input--mono" type="text" placeholder="http://localhost:5175"
                    value={emailForm.app_url ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, app_url: e.target.value })} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">Canlı Domain</span>
                  <input className="em-input em-input--mono" type="text" placeholder="ornek.com"
                    value={emailForm.mail_domain ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, mail_domain: e.target.value })} />
                </label>
                <div className="em-note em-note--amber">
                  Domain modu aktifken sistem e-posta ve uygulama linklerini canlı domain üzerinden üretir. Pasifken geliştirme URL kullanılmaya devam eder.
                </div>
              </div>
            </section>

            {/* Health */}
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">📈</span>
                <div className="em-card__ttl">
                  <b>E-posta Sağlığı (7 Gün)</b>
                  <span>Gönderim istatistikleri{emailSettings ? " · yüklendi" : ""}</span>
                </div>
              </header>
              <div className="em-card__body">
                {emailHealthLoading ? (
                  <p className="em-muted">Yükleniyor…</p>
                ) : (
                  <div className="em-health">
                    <div className="em-stat"><b>{emailHealth?.success_rate_7d ?? 0}%</b><span>Başarı</span></div>
                    <div className="em-stat"><b>{emailHealth?.bounce_rate_7d ?? 0}%</b><span>Bounce</span></div>
                    <div className="em-stat"><b>{emailHealth?.spam_rate_7d ?? 0}%</b><span>Spam</span></div>
                    <div className="em-stat"><b>{emailHealth?.outbound_total_7d ?? 0}</b><span>Toplam</span></div>
                  </div>
                )}
              </div>
            </section>

          </div>

          {isSuperAdmin && (
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">🏢</span>
                <div className="em-card__ttl">
                  <b>Firma Mail Görünürlüğü</b>
                  <span>Admin/Owner profillerinin mailbox erişim kapsamı</span>
                </div>
              </header>
              <div className="em-card__body">
                <EmToggle
                  label="Dashboard mail butonu aktif"
                  hint="Stratejik partner, tedarikçi ve iş ortağı dashboard mail butonlarını etkiler; super admin paneli etkilenmez."
                  checked={emailForm.dashboard_mail_button_enabled ?? true}
                  onChange={(v) => setEmailForm({ ...emailForm, dashboard_mail_button_enabled: v } as EmailSettingsData)}
                />
                <div className="em-note em-note--blue">
                  Tik açıksa ilgili firmadaki admin/owner profiller kendi firma kapsamındaki ekip mailboxlarını görebilir. Tik kapalıysa yalnızca kendi mailbox hesaplarını görürler.
                </div>
                {companyMailVisibilityRows.length === 0 ? (
                  <p className="em-muted">Firma listesi bulunamadı.</p>
                ) : (
                  <div className="em-vis-list">
                    <div className="em-vis-list__title">Firma Bazlı Mail Görünürlük</div>
                    {companyMailVisibilityRows.map((row) => (
                      <label key={row.company_id} className={`em-vis-row${row.enabled ? " em-vis-row--active" : ""}${!row.is_active ? " em-vis-row--inactive" : ""}`}>
                        <input type="checkbox" checked={row.enabled}
                          disabled={togglingCompanyId === row.company_id || !row.is_active}
                          onChange={() => void handleToggleCompanyMailVisibility(row)} />
                        <div className="em-vis-row__info">
                          <b>{row.company_name}{row.is_primary ? " (Ana Firma)" : ""}</b>
                          <span>{row.tenant_name}</span>
                        </div>
                        <span className={`em-status-pill${row.enabled ? " em-status-pill--active" : " em-status-pill--inactive"}`}>
                          {row.enabled ? "Aktif" : "Pasif"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">✍️</span>
              <div className="em-card__ttl">
                <b>Global Mail İmzası</b>
                <span>Tüm giden maillere eklenen imza</span>
              </div>
            </header>
            <div className="em-card__body">
              <div className="em-row2">
                <label className="em-field">
                  <span className="em-field__label">İsim</span>
                  <input id="signature_name" className="em-input" type="text"
                    value={emailForm.signature_name ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, signature_name: e.target.value })} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">Unvan</span>
                  <input id="signature_title" className="em-input" type="text"
                    value={emailForm.signature_title ?? ""}
                    onChange={(e) => setEmailForm({ ...emailForm, signature_title: e.target.value })} />
                </label>
              </div>
              <label className="em-field">
                <span className="em-field__label">Not / İmza Metni</span>
                <textarea id="signature_note" className="em-input em-input--ta" rows={3}
                  value={emailForm.signature_note ?? ""}
                  onChange={(e) => setEmailForm({ ...emailForm, signature_note: e.target.value })} />
              </label>
              <label className="em-field">
                <span className="em-field__label">İmza Görseli / Logo</span>
                <input id="signature_image" type="file" accept="image/*"
                  onChange={(e) => void handleSignatureImageUpload(e.target.files?.[0] || null)} />
              </label>
              {emailForm.signature_image_url && (
                <img src={emailForm.signature_image_url} alt="mail-imza"
                  style={{ maxWidth: 240, maxHeight: 120, objectFit: "contain", borderRadius: 8, border: "1px solid var(--pf-border-color)", background: "white" }} />
              )}
            </div>
          </section>

          {isChannelScope && !readOnly && (
            <section className="em-card">
              <header className="em-card__head">
                <span className="em-card__ico">📡</span>
                <div className="em-card__ttl">
                  <b>Kanal E-posta Tercihleri</b>
                  <span>Şablonlar, imza kütüphanesi ve gönderim limitleri</span>
                </div>
              </header>
              <div className="em-card__body">

                <div className="em-chan-card">
                  <h4>1) E-posta Şablonları</h4>
                  <div className="em-presets">
                    {channelPrefs.templates.map((tpl) => (
                      <button key={tpl.key} type="button"
                        className={`em-chip${activeTemplateKey === tpl.key ? " on" : ""}`}
                        onClick={() => setActiveTemplateKey(tpl.key)}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                  {channelPrefs.templates.filter((tpl) => tpl.key === activeTemplateKey).map((tpl) => (
                    <div key={tpl.key} className="em-grid--g8 em-mt10">
                      <input aria-label={`${tpl.label} Başlığı`} className="em-input" value={tpl.subject}
                        onChange={(e) => updateTemplateField(tpl.key, "subject", e.target.value)} />
                      <textarea aria-label={`${tpl.label} İçeriği`} className="em-input em-input--ta" rows={4}
                        value={tpl.body} onChange={(e) => updateTemplateField(tpl.key, "body", e.target.value)} />
                    </div>
                  ))}
                </div>

                <div className="em-chan-card">
                  <h4>2) İmza Kütüphanesi</h4>
                  <div className="em-row2">
                    <label className="em-field">
                      <input className="em-input" value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)} placeholder="Preset adı" />
                    </label>
                    <button type="button" className="em-btn--primary"
                      onClick={() => {
                        const name = newPresetName.trim();
                        if (!name) return;
                        setChannelPrefs((prev) => ({
                          ...prev,
                          signature_library: [
                            ...prev.signature_library,
                            { id: `${Date.now()}`, name, signature_name: emailForm.signature_name || "", signature_title: emailForm.signature_title || "", signature_note: emailForm.signature_note || "" },
                          ],
                        }));
                        setNewPresetName("");
                      }}>
                      Ekle
                    </button>
                  </div>
                  <div className="em-grid--g6 em-mt8">
                    {channelPrefs.signature_library.map((preset) => (
                      <div key={preset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--pf-border-color)", borderRadius: 6, background: "var(--pf-surface)", padding: "8px 10px" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--pf-slate-900)" }}>{preset.name}</div>
                          <div style={{ fontSize: 12, color: "var(--pf-slate-500)" }}>{preset.signature_name} · {preset.signature_title}</div>
                        </div>
                        <div className="em-flex--g6">
                          <button type="button" className="em-mini em-mini--accent"
                            onClick={() => setEmailForm((prev) => ({ ...prev, signature_name: preset.signature_name, signature_title: preset.signature_title, signature_note: preset.signature_note }))}>
                            Uygula
                          </button>
                          <button type="button" className="em-mini em-mini--danger"
                            onClick={() => setChannelPrefs((prev) => ({ ...prev, signature_library: prev.signature_library.filter((item) => item.id !== preset.id) }))}>
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="em-chan-card">
                  <h4>3) Gönderim Limiti ve Kota</h4>
                  <div className="em-row2 em-mt8">
                    <label className="em-field">
                      <span className="em-field__label">Saatlik Hız</span>
                      <input aria-label="Saatlik Gönderim Hızı" className="em-input" type="number" min={1}
                        value={channelPrefs.send_rate_per_hour}
                        onChange={(e) => setChannelPrefs((prev) => ({ ...prev, send_rate_per_hour: Number(e.target.value || 1) }))} />
                    </label>
                    <label className="em-field">
                      <span className="em-field__label">Günlük Kota</span>
                      <input aria-label="Günlük Gönderim Kotası" className="em-input" type="number" min={1}
                        value={channelPrefs.send_quota_per_day}
                        onChange={(e) => setChannelPrefs((prev) => ({ ...prev, send_quota_per_day: Number(e.target.value || 1) }))} />
                    </label>
                  </div>
                </div>

                <div className="em-chan-card">
                  <h4>4) E-posta Sağlık Göstergesi (7 Gün)</h4>
                  {emailHealthLoading ? (
                    <p className="em-muted">Yükleniyor…</p>
                  ) : (
                    <div className="em-health em-mt8">
                      <div className="em-stat"><b>{emailHealth?.success_rate_7d ?? 0}%</b><span>Başarı</span></div>
                      <div className="em-stat"><b>{emailHealth?.bounce_rate_7d ?? 0}%</b><span>Bounce</span></div>
                      <div className="em-stat"><b>{emailHealth?.spam_rate_7d ?? 0}%</b><span>Spam</span></div>
                      <div className="em-stat"><b>{emailHealth?.outbound_total_7d ?? 0}</b><span>Toplam</span></div>
                    </div>
                  )}
                </div>

                <div className="em-chan-card">
                  <h4>5) Doğrulanmış Domain Beyaz Liste</h4>
                  <div className="em-row2 em-mt8">
                    <label className="em-field">
                      <input className="em-input" value={newAllowedDomain}
                        onChange={(e) => setNewAllowedDomain(e.target.value)} placeholder="ornek.com" />
                    </label>
                    <button type="button" className="em-btn--primary" onClick={() => {
                      const normalized = normalizeDomain(newAllowedDomain);
                      if (!normalized) return;
                      setChannelPrefs((prev) => prev.allowed_from_domains.includes(normalized) ? prev : { ...prev, allowed_from_domains: [...prev.allowed_from_domains, normalized] });
                      setNewAllowedDomain("");
                    }}>Ekle</button>
                  </div>
                  <div className="em-chan-tags em-mt8">
                    {channelPrefs.allowed_from_domains.map((domain) => (
                      <span key={domain} className="em-chan-tag">
                        {domain}
                        <button type="button" onClick={() => setChannelPrefs((prev) => ({ ...prev, allowed_from_domains: prev.allowed_from_domains.filter((item) => item !== domain) }))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="em-chan-card">
                  <h4>6) Mailbox Fallback Politikası</h4>
                  <select aria-label="Mailbox Fallback Politikası" className="em-input em-mt8"
                    value={channelPrefs.fallback_policy}
                    onChange={(e) => setChannelPrefs((prev) => ({ ...prev, fallback_policy: e.target.value as ChannelEmailPreferences["fallback_policy"] }))}>
                    <option value="platform_default">Platform varsayılanına dön</option>
                    <option value="secondary_mailbox">İkinci mailbox kullan</option>
                    <option value="queue_only">Sadece kuyruğa al</option>
                  </select>
                  {channelPrefs.fallback_policy === "secondary_mailbox" && (
                    <input aria-label="Yedek Mailbox E-posta Adresi" type="email" className="em-input em-mt8"
                      value={channelPrefs.secondary_fallback_email}
                      onChange={(e) => setChannelPrefs((prev) => ({ ...prev, secondary_fallback_email: e.target.value }))}
                      placeholder="yedek-mailbox@ornek.com" />
                  )}
                </div>

                <div className="em-chan-card">
                  <h4>7) Kanal Markalama</h4>
                  <div className="em-row2 em-mt8">
                    <label className="em-field">
                      <span className="em-field__label">Gönderici Alias</span>
                      <input aria-label="Gönderici Adı Takma Adı" className="em-input" value={channelPrefs.sender_alias}
                        onChange={(e) => setChannelPrefs((prev) => ({ ...prev, sender_alias: e.target.value }))} placeholder="Gönderici adı" />
                    </label>
                    <label className="em-field">
                      <span className="em-field__label">Logo URL</span>
                      <input aria-label="Marka Logosu URL" className="em-input" value={channelPrefs.branding_logo_url}
                        onChange={(e) => setChannelPrefs((prev) => ({ ...prev, branding_logo_url: e.target.value }))} placeholder="Logo URL" />
                    </label>
                    <label className="em-field em-field--half">
                      <span className="em-field__label">Renk</span>
                      <input aria-label="Birincil Marka Rengi" type="color" className="em-color-input"
                        value={channelPrefs.branding_primary_color}
                        onChange={(e) => setChannelPrefs((prev) => ({ ...prev, branding_primary_color: e.target.value }))} />
                    </label>
                  </div>
                </div>

              </div>
            </section>
          )}

          <div className="em-savebar">
            <span className="em-savebar__state">{loading ? "Kaydediliyor…" : "✓ Email ayarları"}</span>
            <div className="em-savebar__btns">
              <button type="button" className="em-btn--primary" onClick={handleEmailSave} disabled={loading}>
                {loading ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>

          <hr className="em-hr" />

          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">📬</span>
              <div className="em-card__ttl">
                <b>Sistem Mail Hesapları</b>
                <span>Özel SMTP/POP3/IMAP hesabı yoksa platform varsayılanı kullanılır</span>
              </div>
            </header>
            <div className="em-card__body">
              {!isSuperAdmin && (
                <div className="em-note em-note--blue">Bu panelde yalnızca size bağlı mailbox hesaplarını görür ve yönetirsiniz.</div>
              )}
              <div className="em-mb-list">
                {systemEmails.map((email: SystemEmail) => (
                  <div key={email.id} className="em-mb">
                    <div className="em-mb__row">
                      <div className="em-mb__main">
                        <div className="em-mb__top">
                          <span className="em-mb__email">{email.email}</span>
                        </div>
                        <div className="em-mb__desc">
                          {[email.signature_name, email.signature_title, email.description].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="em-mb__acts">
                        {editingEmailId === email.id ? (
                          <>
                            <button type="button" className="em-mini" onClick={() => handleSystemEmailUpdate(email.id)}>Kaydet</button>
                            <button type="button" className="em-mini" onClick={() => setEditingEmailId(null)}>Vazgeç</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="em-mini" onClick={() => handleSystemEmailProvision(email.id)} disabled={loading || provisioningEmailId === email.id}>
                              {provisioningEmailId === email.id ? "Açılıyor…" : "Hostingde Aç"}
                            </button>
                            <button type="button" className="em-mini" onClick={() => handleSystemEmailEdit(email)}>Düzenle</button>
                            <button type="button" className="em-mini em-mini--danger" onClick={() => handleSystemEmailDelete(email.id)}>Sil</button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingEmailId === email.id && (
                      <div className="em-grid--g6 em-mt10">
                        <input type="password" className="em-input em-input--mono" value={editingPassword}
                          onChange={(e) => setEditingPassword(e.target.value)}
                          placeholder="SMTP şifresi (boş bırakılırsa değişmez)" />
                        <input type="password" className="em-input em-input--mono" value={editingImapPassword}
                          onChange={(e) => setEditingImapPassword(e.target.value)}
                          placeholder="IMAP şifresi / App Password (boş bırakılırsa değişmez)" />
                        <div className="em-row2">
                          <label className="em-field">
                            <span className="em-field__label">İmza Adı</span>
                            <input className="em-input" value={editingSignatureName}
                              onChange={(e) => setEditingSignatureName(e.target.value)} placeholder="İmza adı" />
                          </label>
                          <label className="em-field">
                            <span className="em-field__label">İmza Unvanı</span>
                            <input className="em-input" value={editingSignatureTitle}
                              onChange={(e) => setEditingSignatureTitle(e.target.value)} placeholder="İmza unvanı" />
                          </label>
                        </div>
                        <textarea className="em-input em-input--ta" value={editingSignatureNote} rows={2}
                          onChange={(e) => setEditingSignatureNote(e.target.value)} placeholder="İmza notu" />
                        <input className="em-input" value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)} placeholder="Açıklama" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="em-grid--g8 em-mt12">
                <div className="em-row2">
                  <label className="em-field">
                    <span className="em-field__label">Yeni Mail</span>
                    <input type="email" className="em-input" value={newSystemEmail.email}
                      onChange={(e) => setNewSystemEmail({ ...newSystemEmail, email: e.target.value })}
                      placeholder="yeni@ornek.com" />
                  </label>
                  <label className="em-field">
                    <span className="em-field__label">�?ifre (opsiyonel)</span>
                    <input type="password" className="em-input em-input--mono" value={newSystemEmail.password}
                      onChange={(e) => setNewSystemEmail({ ...newSystemEmail, password: e.target.value })}
                      placeholder="••••••••" />
                  </label>
                </div>
                <div className="em-row2">
                  <label className="em-field">
                    <span className="em-field__label">İmza Adı</span>
                    <input className="em-input" value={newSystemEmail.signature_name ?? ""}
                      onChange={(e) => setNewSystemEmail({ ...newSystemEmail, signature_name: e.target.value })}
                      placeholder="İmza adı" />
                  </label>
                  <label className="em-field">
                    <span className="em-field__label">İmza Unvanı</span>
                    <input className="em-input" value={newSystemEmail.signature_title ?? ""}
                      onChange={(e) => setNewSystemEmail({ ...newSystemEmail, signature_title: e.target.value })}
                      placeholder="İmza unvanı" />
                  </label>
                  <label className="em-field">
                    <span className="em-field__label">Açıklama</span>
                    <input className="em-input" value={newSystemEmail.description ?? ""}
                      onChange={(e) => setNewSystemEmail({ ...newSystemEmail, description: e.target.value })}
                      placeholder="Açıklama" />
                  </label>
                </div>
                <button type="button" className="em-btn--primary em-self-start" onClick={handleSystemEmailCreate} disabled={loading}>
                  {loading ? "Ekleniyor…" : "Ekle"}
                </button>
              </div>
            </div>
          </section>
          </>
          )}
          </fieldset>
        </>
      )}

      {canAccessSettingsSurface && activeTab === "logging" && (
        <fieldset disabled={readOnly} className="em-fieldset">
          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">📊</span>
              <div className="em-card__ttl">
                <b>Logging Ayarları</b>
                <span>Log seviyesi, format ve rotasyon</span>
              </div>
            </header>
            <div className="em-card__body">
              <div className="em-row2">
                <label className="em-field">
                  <span className="em-field__label">Log Seviyesi</span>
                  <select id="log_level" className="em-input"
                    value={String((loggingForm as Record<string, unknown>).log_level ?? "INFO")}
                    onChange={(e) => setLoggingForm({ ...loggingForm, log_level: e.target.value } as LoggingSettingsData)}>
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARNING">WARNING</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </label>
                <label className="em-field">
                  <span className="em-field__label">Log Formatı</span>
                  <input id="log_format" className="em-input em-input--mono" type="text"
                    value={String((loggingForm as Record<string, unknown>).log_format ?? "")}
                    onChange={(e) => setLoggingForm({ ...loggingForm, log_format: e.target.value } as LoggingSettingsData)}
                    placeholder="%(asctime)s - %(name)s - %(levelname)s - %(message)s" />
                </label>
              </div>
              <label className="em-field">
                <span className="em-field__label">Log Dosyası</span>
                <input id="log_file" className="em-input em-input--mono" type="text"
                  value={String((loggingForm as Record<string, unknown>).log_file ?? "")}
                  onChange={(e) => setLoggingForm({ ...loggingForm, log_file: e.target.value } as LoggingSettingsData)}
                  placeholder="/var/log/app.log" />
              </label>
              <div className="em-row2">
                <label className="em-field">
                  <span className="em-field__label">Maks. Dosya Boyutu (MB)</span>
                  <input id="max_file_size_mb" className="em-input" type="number"
                    value={Number((loggingForm as Record<string, unknown>).max_file_size_mb ?? 10)}
                    onChange={(e) => setLoggingForm({ ...loggingForm, max_file_size_mb: Number.isNaN(Number(e.target.value)) ? 10 : Number(e.target.value) } as LoggingSettingsData)} />
                </label>
                <label className="em-field">
                  <span className="em-field__label">Rotasyon Sayısı</span>
                  <input id="backup_count" className="em-input" type="number"
                    value={Number((loggingForm as Record<string, unknown>).backup_count ?? 5)}
                    onChange={(e) => setLoggingForm({ ...loggingForm, backup_count: Number.isNaN(Number(e.target.value)) ? 5 : Number(e.target.value) } as LoggingSettingsData)} />
                </label>
              </div>
              <EmToggle label="Console Logging"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_console_logging)}
                onChange={(v) => setLoggingForm({ ...loggingForm, enable_console_logging: v } as LoggingSettingsData)} />
              <EmToggle label="File Logging"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_file_logging)}
                onChange={(v) => setLoggingForm({ ...loggingForm, enable_file_logging: v } as LoggingSettingsData)} />
              <EmToggle label="JSON Formatında Logla"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_json_logging)}
                onChange={(v) => setLoggingForm({ ...loggingForm, enable_json_logging: v } as LoggingSettingsData)} />
            </div>
          </section>
          <div className="em-savebar">
            <span className="em-savebar__state">{loading ? "Kaydediliyor…" : "✓ Logging ayarları"}</span>
            <div className="em-savebar__btns">
              <button type="button" className="em-btn--primary" onClick={handleLoggingSave} disabled={loading}>
                {loading ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {canAccessSettingsSurface && activeTab === "backup" && (
        <fieldset disabled={readOnly} className="em-fieldset">
          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">💾</span>
              <div className="em-card__ttl">
                <b>Yedekleme Ayarları</b>
                <span>Otomatik yedekleme, sıklık ve saklama politikası</span>
              </div>
            </header>
            <div className="em-card__body">
              <div className="em-row2">
                <label className="em-field">
                  <span className="em-field__label">Yedekleme Sıklığı</span>
                  <select id="backup_frequency" className="em-input"
                    value={String((backupForm as Record<string, unknown>).backup_frequency ?? "daily")}
                    onChange={(e) => setBackupForm({ ...backupForm, backup_frequency: e.target.value } as BackupSettingsData)}>
                    <option value="hourly">Saatlik</option>
                    <option value="every_2_hours">2 Saatte Bir</option>
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </label>
                <label className="em-field em-field--half">
                  <span className="em-field__label">Saat</span>
                  <input id="backup_time" className="em-input" type="time"
                    value={String((backupForm as Record<string, unknown>).backup_time ?? "02:00")}
                    onChange={(e) => setBackupForm({ ...backupForm, backup_time: e.target.value } as BackupSettingsData)} />
                </label>
              </div>
              <label className="em-field">
                <span className="em-field__label">Yedekleme Konumu</span>
                <input id="backup_location" className="em-input em-input--mono" type="text"
                  value={String((backupForm as Record<string, unknown>).backup_location ?? "")}
                  onChange={(e) => setBackupForm({ ...backupForm, backup_location: e.target.value } as BackupSettingsData)}
                  placeholder="/backups" />
              </label>
              <label className="em-field">
                <span className="em-field__label">Son N Yedeklemeyi Sakla</span>
                <input id="keep_last_n_backups" className="em-input" type="number"
                  value={Number((backupForm as Record<string, unknown>).keep_last_n_backups ?? 5)}
                  onChange={(e) => setBackupForm({ ...backupForm, keep_last_n_backups: Number.isNaN(Number(e.target.value)) ? 5 : Number(e.target.value) } as BackupSettingsData)} />
              </label>
              <EmToggle label="Otomatik Yedekleme"
                checked={Boolean((backupForm as Record<string, unknown>).enable_automatic_backup)}
                onChange={(v) => setBackupForm({ ...backupForm, enable_automatic_backup: v } as BackupSettingsData)} />
              <EmToggle label="Yedeklemeleri Sıkıştır"
                checked={Boolean((backupForm as Record<string, unknown>).compress_backups)}
                onChange={(v) => setBackupForm({ ...backupForm, compress_backups: v } as BackupSettingsData)} />
              <EmToggle label="Yedeklemeleri �?ifrele"
                checked={Boolean((backupForm as Record<string, unknown>).encrypt_backups)}
                onChange={(v) => setBackupForm({ ...backupForm, encrypt_backups: v } as BackupSettingsData)} />
            </div>
          </section>
          <div className="em-savebar">
            <span className="em-savebar__state">{loading ? "Kaydediliyor…" : "✓ Yedekleme ayarları"}</span>
            <div className="em-savebar__btns">
              <button type="button" className="em-btn--ghost" onClick={handleBackupTrigger} disabled={loading}>
                {loading ? "Başlatılıyor…" : "�?imdi Yedekle"}
              </button>
              <button type="button" className="em-btn--primary" onClick={handleBackupSave} disabled={loading}>
                {loading ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {canAccessSettingsSurface && activeTab === "notifications" && (
        <fieldset disabled={readOnly} className="em-fieldset">
          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">🔔</span>
              <div className="em-card__ttl">
                <b>Teklif Bildirimleri</b>
                <span>Teklif olaylarında bildirim gönder</span>
              </div>
            </header>
            <div className="em-card__body">
              <EmToggle label="Teklif Oluşturulduğunda Bildir"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_created)}
                onChange={(v) => setNotificationForm({ ...notificationForm, notify_on_quote_created: v } as NotificationSettingsData)} />
              <EmToggle label="Teklif Yanıtı Alındığında Bildir"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_response)}
                onChange={(v) => setNotificationForm({ ...notificationForm, notify_on_quote_response: v } as NotificationSettingsData)} />
              <EmToggle label="Teklif Onaylandığında Bildir"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_approved)}
                onChange={(v) => setNotificationForm({ ...notificationForm, notify_on_quote_approved: v } as NotificationSettingsData)} />
            </div>
          </section>
          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">⚙️</span>
              <div className="em-card__ttl">
                <b>Sistem Bildirimleri</b>
                <span>Sistem hataları ve günlük özet</span>
              </div>
            </header>
            <div className="em-card__body">
              <EmToggle label="Sistem Hataları Hakkında Bildir"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_system_errors)}
                onChange={(v) => setNotificationForm({ ...notificationForm, notify_on_system_errors: v } as NotificationSettingsData)} />
              <EmToggle label="Günlük Özet Etkinleştir"
                checked={Boolean((notificationForm as Record<string, unknown>).enable_daily_digest)}
                onChange={(v) => setNotificationForm({ ...notificationForm, enable_daily_digest: v } as NotificationSettingsData)} />
              <label className="em-field em-mt4">
                <span className="em-field__label">Özet Saati</span>
                <input id="digest_time" className="em-input em-input--auto" type="time"
                  value={String((notificationForm as Record<string, unknown>).digest_time ?? "09:00")}
                  onChange={(e) => setNotificationForm({ ...notificationForm, digest_time: e.target.value } as NotificationSettingsData)} />
              </label>
            </div>
          </section>
          <div className="em-savebar">
            <span className="em-savebar__state">{loading ? "Kaydediliyor…" : "✓ Bildirim ayarları"}</span>
            <div className="em-savebar__btns">
              <button type="button" className="em-btn--primary" onClick={handleNotificationSave} disabled={loading}>
                {loading ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {canManageApiKeys && activeTab === "api-keys" && (
        <fieldset disabled={readOnly} className="em-fieldset">
          <section className="em-card">
            <header className="em-card__head">
              <span className="em-card__ico">🔑</span>
              <div className="em-card__ttl">
                <b>API Anahtarları</b>
                <span>Harici entegrasyon için erişim anahtarları</span>
              </div>
            </header>
            <div className="em-card__body">
              <div className="em-row2">
                <label className="em-field">
                  <span className="em-field__label">Anahtar Adı</span>
                  <input className="em-input" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Anahtar adı" />
                </label>
                <button type="button" className="em-btn--primary em-self-end" onClick={handleCreateAPIKey} disabled={loading}>
                  {loading ? "Oluşturuluyor…" : "Yeni Anahtar"}
                </button>
              </div>
              {apiKeys.length === 0 ? (
                <p className="em-muted">Henüz API anahtarı yok.</p>
              ) : (
                <table className="em-table">
                  <thead>
                    <tr>
                      <th>Ad</th>
                      <th>Anahtar</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key: APIKeyData) => (
                      <tr key={key.id}>
                        <td>{key.name}</td>
                        <td><code>{key.key}</code></td>
                        <td>{key.is_active ? "Aktif" : "Pasif"}</td>
                        <td>
                          <button type="button" className="em-mini em-mini--danger" onClick={() => handleRevokeAPIKey(key.id)} disabled={loading}>
                            İptal Et
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </fieldset>
      )}
    </div>
  );
};

export default AdvancedSettingsTab;
