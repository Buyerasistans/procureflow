import React, { useCallback, useEffect, useState } from "react";
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

  const tabStyle = (tab: TabType): React.CSSProperties => ({
    padding: "8px 16px",
    border: "none",
    background: activeTab === tab ? "#3b82f6" : "transparent",
    color: activeTab === tab ? "white" : "#666",
    cursor: "pointer",
    fontWeight: activeTab === tab ? "bold" : "normal",
    borderRadius: 4,
  });

  const shouldShowEmailCustomization = isSuperAdmin || readOnly || isEmailCustomizationOpen;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {message && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#6ee7b7" : "#fca5a5"}`,
          }}
        >
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {readOnly && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fca5a5",
          }}
        >
          Bu panel bu profil icin salt okunur calisiyor; sadece goruntuleme yapabilirsiniz.
        </div>
      )}

      {isChannelScope && !readOnly && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#eff6ff",
            color: "#1e3a8a",
            border: "1px solid #bfdbfe",
          }}
        >
          Kanal hesap sahibi panelinde e-posta ayarları ve mailbox yönetimi açıktır.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
        <button style={tabStyle("email")} onClick={() => setActiveTab("email")}>📧 Email</button>
        {canAccessSettingsSurface && (
          <>
            <button style={tabStyle("logging")} onClick={() => setActiveTab("logging")}>📊 Logging</button>
            <button style={tabStyle("backup")} onClick={() => setActiveTab("backup")}>💾 Yedekleme</button>
            <button style={tabStyle("notifications")} onClick={() => setActiveTab("notifications")}>🔔 Bildirimler</button>
          </>
        )}
        {canManageApiKeys && (
          <button style={tabStyle("api-keys")} onClick={() => setActiveTab("api-keys")}>🔑 API Anahtarları</button>
        )}
      </div>

      {activeTab === "email" && (
        <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <h3>📧 SMTP / POP / IMAP Ayarları</h3>
          {!isSuperAdmin && (
            <div style={{ marginTop: 12, marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#1e3a8a" }}>
                Varsayılan Kullanım Bilgisi
              </div>
              <div style={{ marginTop: 6, color: "#1e40af", fontSize: 14 }}>
                Standart akışta sistem, buyerasistans.com.tr varsayılan ayarlarını kullanır. Özel sağlayıcı kullanmak için ayar ekranını açabilirsiniz.
              </div>
              <button
                type="button"
                onClick={() => setIsEmailCustomizationOpen((prev) => !prev)}
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #93c5fd",
                  background: isEmailCustomizationOpen ? "#dbeafe" : "#2563eb",
                  color: isEmailCustomizationOpen ? "#1e3a8a" : "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {isEmailCustomizationOpen ? "Özelleştirme Ekranını Kapat" : "SMTP / POP / IMAP Ayarlarını Özelleştir"}
              </button>
            </div>
          )}
          <fieldset disabled={readOnly} style={{ margin: 0, padding: 0, border: "none", minWidth: 0 }}>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
              {canManageProfiles ? "Profil Seçimi" : "Kullanılan Profil"}
            </div>
            {canManageProfiles ? (
              <select
                aria-label="Profil Seçimi"
                value={selectedEmailProfileOwnerId === null ? "default" : String(selectedEmailProfileOwnerId ?? "default")}
                onChange={(e) => setSelectedEmailProfileOwnerId(e.target.value === "default" ? null : Number(e.target.value))}
                style={{ marginTop: 8, width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
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
              <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 700 }}>Kendi SMTP profiliniz</div>
            )}
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
              {canManageProfiles
                ? "Süper admin varsayılan sistem SMTP profilini ve admin profillerini ayrı ayrı düzenleyebilir."
                : "Admin sadece kendi SMTP profilini ve kendi e-posta hesaplarını görür."}
            </div>
          </div>
          {emailSettings && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              Mevcut ayarlar yüklendi.
            </div>
          )}

          {!isSuperAdmin && !isEmailCustomizationOpen && (
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 13 }}>
              Aktif Email Profili: Standart profil kullanılıyor. Özelleştirmek için yukarıdaki butonu kullanın.
            </div>
          )}

          {shouldShowEmailCustomization ? (
            <>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>SMTP Host</label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={emailForm.smtp_host ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, smtp_host: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>SMTP Port</label>
              <input
                type="number"
                placeholder="587"
                value={emailForm.smtp_port ?? 587}
                onChange={(e) =>
                  setEmailForm({
                    ...emailForm,
                    smtp_port: Number.isNaN(Number(e.target.value)) ? 587 : Number(e.target.value),
                  })
                }
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>SMTP Username</label>
              <input
                type="text"
                placeholder="noreply@firma.com"
                value={emailForm.smtp_username ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, smtp_username: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>SMTP Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={emailForm.smtp_password ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, smtp_password: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>From Email</label>
              <input
                type="email"
                placeholder="noreply@firma.com"
                value={emailForm.from_email ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, from_email: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>From Name</label>
              <input
                type="text"
                placeholder="ProcureFlow"
                value={emailForm.from_name ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, from_name: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Geliştirme Uygulama URL</label>
              <input
                type="text"
                placeholder="http://localhost:5175"
                value={emailForm.app_url ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, app_url: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Canlı Domain</label>
              <input
                type="text"
                placeholder="ornek.com"
                value={emailForm.mail_domain ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, mail_domain: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Reply-To</label>
              <input
                type="email"
                placeholder="destek@ornek.com"
                value={emailForm.reply_to_email ?? ""}
                onChange={(e) => setEmailForm({ ...emailForm, reply_to_email: e.target.value })}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean((emailForm as Record<string, unknown>).use_tls)}
                onChange={(e) => setEmailForm({ ...emailForm, use_tls: e.target.checked } as EmailSettingsData)}
              />
              TLS kullan
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean((emailForm as Record<string, unknown>).use_ssl)}
                onChange={(e) => setEmailForm({ ...emailForm, use_ssl: e.target.checked } as EmailSettingsData)}
              />
              SSL kullan
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={Boolean((emailForm as Record<string, unknown>).use_custom_app_url)}
                onChange={(e) => setEmailForm({ ...emailForm, use_custom_app_url: e.target.checked } as EmailSettingsData)}
              />
              Domain modunu aktif et
            </label>
          </div>

          {isSuperAdmin && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#1e3a8a" }}>
                <input
                  type="checkbox"
                  checked={emailForm.dashboard_mail_button_enabled ?? true}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, dashboard_mail_button_enabled: e.target.checked } as EmailSettingsData)
                  }
                />
                {(emailForm.dashboard_mail_button_enabled ?? true)
                  ? "Dashboard mail butonu aktif"
                  : "Dashboard mail butonu pasif"}
              </label>
              <div style={{ marginTop: 8, fontSize: 12, color: "#1e40af" }}>
                Bu tik yalnızca stratejik partner, tedarikçi ve iş ortağı dashboard mail butonlarını etkiler; super admin paneli etkilenmez.
              </div>

              <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "#ffffff", border: "1px solid #dbeafe" }}>
                <div style={{ fontWeight: 700, color: "#1e3a8a", marginBottom: 6 }}>
                  Firma Bazli Mail Gorunurluk (Admin / Owner)
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginBottom: 10 }}>
                  Tik aciksa ilgili firmadaki admin/owner profiller kendi firma kapsamindaki ekip mailboxlarini gorebilir.
                  Tik kapaliysa yalnizca kendi mailbox hesaplarini gorurler.
                </div>

                {companyMailVisibilityRows.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#64748b" }}>Firma listesi bulunamadi.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                    {companyMailVisibilityRows.map((row) => (
                      <label
                        key={row.company_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          border: "1px solid #dbeafe",
                          borderRadius: 8,
                          background: row.enabled ? "#f0fdf4" : "#f8fafc",
                          opacity: row.is_active ? 1 : 0.6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          disabled={togglingCompanyId === row.company_id || !row.is_active}
                          onChange={() => void handleToggleCompanyMailVisibility(row)}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                            {row.company_name}
                            {row.is_primary ? " (Ana Firma)" : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "#475569" }}>{row.tenant_name}</div>
                        </div>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: row.enabled ? "1px solid #86efac" : "1px solid #cbd5e1",
                            background: row.enabled ? "#dcfce7" : "#e2e8f0",
                            color: row.enabled ? "#166534" : "#475569",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {row.enabled ? "Aktif" : "Pasif"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" }}>
            Domain modu aktifken sistem e-posta ve uygulama linklerini canlı domain üzerinden üretir. Pasifken geliştirme URL'si kullanılmaya devam eder.
          </div>

          <div style={{ marginTop: 18, padding: 16, border: "1px solid #e5e7eb", borderRadius: 10, background: "#f8fafc" }}>
            <h4 style={{ margin: "0 0 12px" }}>Global Mail İmzası</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="signature_name" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>İsim</label>
                <input
                  id="signature_name"
                  type="text"
                  value={emailForm.signature_name ?? ""}
                  onChange={(e) => setEmailForm({ ...emailForm, signature_name: e.target.value })}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
              </div>
              <div>
                <label htmlFor="signature_title" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Unvan</label>
                <input
                  id="signature_title"
                  type="text"
                  value={emailForm.signature_title ?? ""}
                  onChange={(e) => setEmailForm({ ...emailForm, signature_title: e.target.value })}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="signature_note" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Not / İmza Metni</label>
                <textarea
                  id="signature_note"
                  rows={3}
                  value={emailForm.signature_note ?? ""}
                  onChange={(e) => setEmailForm({ ...emailForm, signature_note: e.target.value })}
                  style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4, resize: "vertical" }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="signature_image" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>İmza Görseli / Logo</label>
                <input id="signature_image" type="file" accept="image/*" onChange={(e) => void handleSignatureImageUpload(e.target.files?.[0] || null)} />
                {emailForm.signature_image_url && (
                  <div style={{ marginTop: 10 }}>
                    <img src={emailForm.signature_image_url} alt="mail-imza" style={{ maxWidth: 240, maxHeight: 120, objectFit: "contain", borderRadius: 8, border: "1px solid #dbe3ee", background: "white" }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {isChannelScope && !readOnly && (
            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>1) E-posta Şablonları</h4>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {channelPrefs.templates.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => setActiveTemplateKey(tpl.key)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: activeTemplateKey === tpl.key ? "#dbeafe" : "#fff",
                        color: "#1e3a8a",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                {channelPrefs.templates
                  .filter((tpl) => tpl.key === activeTemplateKey)
                  .map((tpl) => (
                    <div key={tpl.key} style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      <input
                        aria-label={`${tpl.label} Başlığı`}
                        value={tpl.subject}
                        onChange={(e) => updateTemplateField(tpl.key, "subject", e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
                      />
                      <textarea
                        aria-label={`${tpl.label} İçeriği`}
                        rows={4}
                        value={tpl.body}
                        onChange={(e) => updateTemplateField(tpl.key, "body", e.target.value)}
                        style={{ width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 6, resize: "vertical" }}
                      />
                    </div>
                  ))}
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>2) İmza Kütüphanesi</h4>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset adı"
                    style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const name = newPresetName.trim();
                      if (!name) return;
                      setChannelPrefs((prev) => ({
                        ...prev,
                        signature_library: [
                          ...prev.signature_library,
                          {
                            id: `${Date.now()}`,
                            name,
                            signature_name: emailForm.signature_name || "",
                            signature_title: emailForm.signature_title || "",
                            signature_note: emailForm.signature_note || "",
                          },
                        ],
                      }));
                      setNewPresetName("");
                    }}
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", cursor: "pointer" }}
                  >
                    Ekle
                  </button>
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {channelPrefs.signature_library.map((preset) => (
                    <div key={preset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #dbeafe", borderRadius: 6, background: "#fff", padding: "8px 10px" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{preset.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{preset.signature_name} · {preset.signature_title}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setEmailForm((prev) => ({ ...prev, signature_name: preset.signature_name, signature_title: preset.signature_title, signature_note: preset.signature_note }))}
                          style={{ border: "1px solid #93c5fd", background: "#dbeafe", color: "#1e3a8a", borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}
                        >
                          Uygula
                        </button>
                        <button
                          type="button"
                          onClick={() => setChannelPrefs((prev) => ({ ...prev, signature_library: prev.signature_library.filter((item) => item.id !== preset.id) }))}
                          style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "6px 8px", cursor: "pointer" }}
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>3) Gönderim Limiti ve Kota</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <input aria-label="Saatlik Gönderim Hızı" type="number" min={1} value={channelPrefs.send_rate_per_hour} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, send_rate_per_hour: Number(e.target.value || 1) }))} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  <input aria-label="Günlük Gönderim Kotası" type="number" min={1} value={channelPrefs.send_quota_per_day} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, send_quota_per_day: Number(e.target.value || 1) }))} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>4) E-posta Sağlık Göstergesi (7 Gün)</h4>
                {emailHealthLoading ? (
                  <div style={{ marginTop: 8, color: "#64748b" }}>Yukleniyor...</div>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 8 }}>
                    <div style={{ border: "1px solid #d1fae5", borderRadius: 6, background: "#fff", padding: 8 }}><strong>{emailHealth?.success_rate_7d ?? 0}%</strong><div style={{ fontSize: 12 }}>Basari</div></div>
                    <div style={{ border: "1px solid #fee2e2", borderRadius: 6, background: "#fff", padding: 8 }}><strong>{emailHealth?.bounce_rate_7d ?? 0}%</strong><div style={{ fontSize: 12 }}>Bounce</div></div>
                    <div style={{ border: "1px solid #ffedd5", borderRadius: 6, background: "#fff", padding: 8 }}><strong>{emailHealth?.spam_rate_7d ?? 0}%</strong><div style={{ fontSize: 12 }}>Spam</div></div>
                    <div style={{ border: "1px solid #dbeafe", borderRadius: 6, background: "#fff", padding: 8 }}><strong>{emailHealth?.outbound_total_7d ?? 0}</strong><div style={{ fontSize: 12 }}>Toplam</div></div>
                  </div>
                )}
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>5) Doğrulanmış Domain Beyaz Liste</h4>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={newAllowedDomain} onChange={(e) => setNewAllowedDomain(e.target.value)} placeholder="ornek.com" style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  <button type="button" onClick={() => {
                    const normalized = normalizeDomain(newAllowedDomain);
                    if (!normalized) return;
                    setChannelPrefs((prev) => prev.allowed_from_domains.includes(normalized) ? prev : { ...prev, allowed_from_domains: [...prev.allowed_from_domains, normalized] });
                    setNewAllowedDomain("");
                  }} style={{ border: "1px solid #2563eb", background: "#2563eb", color: "#fff", borderRadius: 6, padding: "8px 10px", cursor: "pointer" }}>Ekle</button>
                </div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {channelPrefs.allowed_from_domains.map((domain) => (
                    <span key={domain} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #bfdbfe", borderRadius: 999, padding: "4px 8px", background: "#eff6ff" }}>
                      {domain}
                      <button type="button" onClick={() => setChannelPrefs((prev) => ({ ...prev, allowed_from_domains: prev.allowed_from_domains.filter((item) => item !== domain) }))} style={{ border: "none", background: "transparent", color: "#1e40af", cursor: "pointer" }}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>6) Mailbox Fallback Politikası</h4>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  <select aria-label="Mailbox Fallback Politikası" value={channelPrefs.fallback_policy} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, fallback_policy: e.target.value as ChannelEmailPreferences["fallback_policy"] }))} style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }}>
                    <option value="platform_default">Platform varsayılanına dön</option>
                    <option value="secondary_mailbox">İkinci mailbox kullan</option>
                    <option value="queue_only">Sadece kuyruğa al</option>
                  </select>
                  {channelPrefs.fallback_policy === "secondary_mailbox" && (
                    <input aria-label="Yedek Mailbox E-posta Adresi" type="email" value={channelPrefs.secondary_fallback_email} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, secondary_fallback_email: e.target.value }))} placeholder="yedek-mailbox@ornek.com" style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  )}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 10, border: "1px solid #dbeafe", background: "#f8fbff" }}>
                <h4 style={{ margin: 0, color: "#1e3a8a" }}>7) Kanal Markalama Ayarları</h4>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <input aria-label="Gönderici Adı Takma Adı" value={channelPrefs.sender_alias} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, sender_alias: e.target.value }))} placeholder="Gönderici adı" style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  <input aria-label="Marka Logosu URL" value={channelPrefs.branding_logo_url} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, branding_logo_url: e.target.value }))} placeholder="Logo URL" style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  <input aria-label="Birincil Marka Rengi" type="color" value={channelPrefs.branding_primary_color} onChange={(e) => setChannelPrefs((prev) => ({ ...prev, branding_primary_color: e.target.value }))} style={{ width: "100%", height: 38, border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff" }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleEmailSave} disabled={loading}>
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button onClick={handleEmailTest} disabled={loading}>
              {loading ? "Gönderiliyor..." : "Test Gönder"}
            </button>
          </div>

          <hr style={{ margin: "20px 0" }} />

          <h4>Sistem Mail Hesapları</h4>
          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
            Özel SMTP / POP3 / IMAP tanımı yoksa platformun oluşturduğu iş maili varsayılan kullanılır. Özel ayar tanımlandığında varsayılan kanal otomatik olarak bu profile geçer.
          </div>
          {!isSuperAdmin && (
            <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
              Bu panelde yalnızca size bağlı mailbox hesaplarını görür ve yönetirsiniz.
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Mail</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Şifre</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Açıklama</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>İmza</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {systemEmails.map((email: SystemEmail) => (
                <tr key={email.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{email.email}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {editingEmailId === email.id ? (
                      <div style={{ display: "grid", gap: 4 }}>
                        <input
                          type="password"
                          value={editingPassword}
                          onChange={(e) => setEditingPassword(e.target.value)}
                          placeholder="SMTP şifresi (boş bırakılırsa değişmez)"
                          style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                        />
                        <input
                          type="password"
                          value={editingImapPassword}
                          onChange={(e) => setEditingImapPassword(e.target.value)}
                          placeholder="IMAP şifresi / App Password (boş bırakılırsa değişmez)"
                          style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                        />
                      </div>
                    ) : (
                      "********"
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", minWidth: 220 }}>
                    {editingEmailId === email.id ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <input value={editingSignatureName} onChange={(e) => setEditingSignatureName(e.target.value)} placeholder="İmza adı" style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }} />
                        <input value={editingSignatureTitle} onChange={(e) => setEditingSignatureTitle(e.target.value)} placeholder="İmza unvanı" style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }} />
                        <textarea value={editingSignatureNote} onChange={(e) => setEditingSignatureNote(e.target.value)} placeholder="İmza notu" rows={2} style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4, resize: "vertical" }} />
                      </div>
                    ) : (
                      <div style={{ color: "#475569", fontSize: 13 }}>
                        <div>{email.signature_name || "-"}</div>
                        <div>{email.signature_title || ""}</div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {editingEmailId === email.id ? (
                      <input
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                      />
                    ) : (
                      email.description ?? "—"
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {editingEmailId === email.id ? (
                      <>
                        <button onClick={() => handleSystemEmailUpdate(email.id)} style={{ marginRight: 8 }}>
                          Kaydet
                        </button>
                        <button onClick={() => setEditingEmailId(null)}>Vazgeç</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleSystemEmailProvision(email.id)} style={{ marginRight: 8 }} disabled={loading || provisioningEmailId === email.id}>
                          {provisioningEmailId === email.id ? "Aciliyor..." : "Hostingte Ac"}
                        </button>
                        <button onClick={() => handleSystemEmailEdit(email)} style={{ marginRight: 8 }}>
                          Düzenle
                        </button>
                        <button onClick={() => handleSystemEmailDelete(email.id)}>Sil</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              <tr>
                <td style={{ padding: 8 }}>
                  <input
                    type="email"
                    value={newSystemEmail.email}
                    onChange={(e) => setNewSystemEmail({ ...newSystemEmail, email: e.target.value })}
                    placeholder="Yeni mail"
                    style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="password"
                    value={newSystemEmail.password}
                    onChange={(e) => setNewSystemEmail({ ...newSystemEmail, password: e.target.value })}
                    placeholder="Şifre (opsiyonel)"
                    style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    value={newSystemEmail.description ?? ""}
                    onChange={(e) => setNewSystemEmail({ ...newSystemEmail, description: e.target.value })}
                    placeholder="Açıklama"
                    style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <input value={newSystemEmail.signature_name ?? ""} onChange={(e) => setNewSystemEmail({ ...newSystemEmail, signature_name: e.target.value })} placeholder="İmza adı" style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }} />
                    <input value={newSystemEmail.signature_title ?? ""} onChange={(e) => setNewSystemEmail({ ...newSystemEmail, signature_title: e.target.value })} placeholder="İmza unvanı" style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 4 }} />
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={handleSystemEmailCreate} disabled={loading}>
                    Ekle
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </>
          ) : null}
          </fieldset>
        </div>
      )}

      {canAccessSettingsSurface && activeTab === "logging" && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>📊 Logging Ayarları</h3>
          <fieldset disabled={readOnly} style={{ margin: 0, padding: 0, border: "none", minWidth: 0 }}>
          {loggingSettings && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Logging ayarları yüklendi.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <label htmlFor="log_level" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Log Seviyesi</label>
              <select
                id="log_level"
                value={String((loggingForm as Record<string, unknown>).log_level ?? "INFO")}
                onChange={(e) => setLoggingForm({ ...loggingForm, log_level: e.target.value } as LoggingSettingsData)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              >
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label htmlFor="log_format" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Log Formatı</label>
              <input
                id="log_format"
                type="text"
                value={String((loggingForm as Record<string, unknown>).log_format ?? "")}
                onChange={(e) => setLoggingForm({ ...loggingForm, log_format: e.target.value } as LoggingSettingsData)}
                placeholder="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="log_file" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Log Dosyası</label>
              <input
                id="log_file"
                type="text"
                value={String((loggingForm as Record<string, unknown>).log_file ?? "")}
                onChange={(e) => setLoggingForm({ ...loggingForm, log_file: e.target.value } as LoggingSettingsData)}
                placeholder="/var/log/app.log"
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="max_file_size_mb" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>
                Maksimum Dosya Boyutu (MB)
              </label>
              <input
                id="max_file_size_mb"
                type="number"
                value={Number((loggingForm as Record<string, unknown>).max_file_size_mb ?? 10)}
                onChange={(e) =>
                  setLoggingForm({
                    ...loggingForm,
                    max_file_size_mb: Number.isNaN(Number(e.target.value)) ? 10 : Number(e.target.value),
                  } as LoggingSettingsData)
                }
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="backup_count" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Dosya Rotasyon Sayısı</label>
              <input
                id="backup_count"
                type="number"
                value={Number((loggingForm as Record<string, unknown>).backup_count ?? 5)}
                onChange={(e) =>
                  setLoggingForm({
                    ...loggingForm,
                    backup_count: Number.isNaN(Number(e.target.value)) ? 5 : Number(e.target.value),
                  } as LoggingSettingsData)
                }
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_console_logging)}
                onChange={(e) =>
                  setLoggingForm({ ...loggingForm, enable_console_logging: e.target.checked } as LoggingSettingsData)
                }
              />
              Console Logging Etkin
            </label>

            <label>
              <input
                type="checkbox"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_file_logging)}
                onChange={(e) =>
                  setLoggingForm({ ...loggingForm, enable_file_logging: e.target.checked } as LoggingSettingsData)
                }
              />
              File Logging Etkin
            </label>

            <label>
              <input
                type="checkbox"
                checked={Boolean((loggingForm as Record<string, unknown>).enable_json_logging)}
                onChange={(e) =>
                  setLoggingForm({ ...loggingForm, enable_json_logging: e.target.checked } as LoggingSettingsData)
                }
              />
              JSON Formatında Logla
            </label>
          </div>

          <button
            onClick={handleLoggingSave}
            disabled={loading}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          </fieldset>
        </div>
      )}

      {canAccessSettingsSurface && activeTab === "backup" && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>💾 Yedekleme Ayarları</h3>
          <fieldset disabled={readOnly} style={{ margin: 0, padding: 0, border: "none", minWidth: 0 }}>
          {backupSettings && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Yedekleme ayarları yüklendi.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <label htmlFor="backup_frequency" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Yedekleme Sıklığı</label>
              <select
                id="backup_frequency"
                value={String((backupForm as Record<string, unknown>).backup_frequency ?? "daily")}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, backup_frequency: e.target.value } as BackupSettingsData)
                }
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              >
                <option value="hourly">Saatlik</option>
                <option value="every_2_hours">2 Saatte Bir</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
              </select>
            </div>

            <div>
              <label htmlFor="backup_time" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Yedekleme Saati</label>
              <input
                id="backup_time"
                type="time"
                value={String((backupForm as Record<string, unknown>).backup_time ?? "02:00")}
                onChange={(e) => setBackupForm({ ...backupForm, backup_time: e.target.value } as BackupSettingsData)}
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="backup_location" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Yedekleme Konumu</label>
              <input
                id="backup_location"
                type="text"
                value={String((backupForm as Record<string, unknown>).backup_location ?? "")}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, backup_location: e.target.value } as BackupSettingsData)
                }
                placeholder="/backups"
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div>
              <label htmlFor="keep_last_n_backups" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Son N Yedeklemeyi Sakla</label>
              <input
                id="keep_last_n_backups"
                type="number"
                value={Number((backupForm as Record<string, unknown>).keep_last_n_backups ?? 5)}
                onChange={(e) =>
                  setBackupForm({
                    ...backupForm,
                    keep_last_n_backups: Number.isNaN(Number(e.target.value)) ? 5 : Number(e.target.value),
                  } as BackupSettingsData)
                }
                style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={Boolean((backupForm as Record<string, unknown>).enable_automatic_backup)}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, enable_automatic_backup: e.target.checked } as BackupSettingsData)
                }
              />
              Otomatik Yedeklemeyi Etkinleştir
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean((backupForm as Record<string, unknown>).compress_backups)}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, compress_backups: e.target.checked } as BackupSettingsData)
                }
              />
              Yedeklemeleri Sıkıştır
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean((backupForm as Record<string, unknown>).encrypt_backups)}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, encrypt_backups: e.target.checked } as BackupSettingsData)
                }
              />
              Yedeklemeleri Şifrele
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={handleBackupSave}
              disabled={loading}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              onClick={handleBackupTrigger}
              disabled={loading}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Başlatılıyor..." : "Şimdi Yedekle"}
            </button>
          </div>
          </fieldset>
        </div>
      )}

      {canAccessSettingsSurface && activeTab === "notifications" && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3>🔔 Bildirim Ayarları</h3>
          <fieldset disabled={readOnly} style={{ margin: 0, padding: 0, border: "none", minWidth: 0 }}>
          {notificationSettings && (
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              Bildirim ayarları yüklendi.
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h4>Teklif Bildirimleri</h4>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_created)}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    notify_on_quote_created: e.target.checked,
                  } as NotificationSettingsData)
                }
              />
              Teklif Oluşturulduğunda Bildir
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_response)}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    notify_on_quote_response: e.target.checked,
                  } as NotificationSettingsData)
                }
              />
              Teklif Yanıtı Alındığında Bildir
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_quote_approved)}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    notify_on_quote_approved: e.target.checked,
                  } as NotificationSettingsData)
                }
              />
              Teklif Onaylandığında Bildir
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Sistem Bildirimleri</h4>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Boolean((notificationForm as Record<string, unknown>).notify_on_system_errors)}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    notify_on_system_errors: e.target.checked,
                  } as NotificationSettingsData)
                }
              />
              Sistem Hataları Hakkında Bildir
            </label>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={Boolean((notificationForm as Record<string, unknown>).enable_daily_digest)}
                onChange={(e) =>
                  setNotificationForm({
                    ...notificationForm,
                    enable_daily_digest: e.target.checked,
                  } as NotificationSettingsData)
                }
              />
              Günlük Özet Etkinleştir
            </label>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <div>
              <label htmlFor="digest_time" style={{ display: "block", marginBottom: 4, fontWeight: "600" }}>Özet Saati</label>
              <input
                id="digest_time"
                type="time"
                value={String((notificationForm as Record<string, unknown>).digest_time ?? "09:00")}
                onChange={(e) =>
                  setNotificationForm({ ...notificationForm, digest_time: e.target.value } as NotificationSettingsData)
                }
                style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>
          </div>

          <button
            onClick={handleNotificationSave}
            disabled={loading}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          </fieldset>
        </div>
      )}

      {canManageApiKeys && activeTab === "api-keys" && (
        <div style={{ backgroundColor: "#fff", padding: 20, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3>🔑 API Anahtarları</h3>
          <fieldset disabled={readOnly} style={{ margin: 0, padding: 0, border: "none", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Anahtar adı" />
            <button onClick={handleCreateAPIKey} disabled={loading}>
              {loading ? "Oluşturuluyor..." : "Yeni Anahtar"}
            </button>
          </div>

          {apiKeys.length === 0 ? (
            <p>Henüz API anahtarı yok</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Ad</th>
                  <th style={{ textAlign: "left" }}>Anahtar</th>
                  <th style={{ textAlign: "left" }}>Durum</th>
                  <th style={{ textAlign: "left" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key: APIKeyData) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td>{key.key}</td>
                    <td>{key.is_active ? "Aktif" : "Pasif"}</td>
                    <td>
                      <button onClick={() => handleRevokeAPIKey(key.id)} disabled={loading}>
                        İptal Et
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </fieldset>
        </div>
      )}
    </div>
  );
};

export default AdvancedSettingsTab;
