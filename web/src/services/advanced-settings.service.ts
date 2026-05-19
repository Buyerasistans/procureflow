// FILE: web/src/services/advanced-settings.service.ts
import { http } from "../lib/http";

export interface EmailSettingsData {
  id?: number;
  owner_user_id?: number | null;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  pop3_host?: string;
  pop3_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  incoming_use_ssl?: boolean;
  from_email?: string;
  from_name?: string;
  use_tls?: boolean;
  use_ssl?: boolean;
  enable_email_notifications?: boolean;
  dashboard_mail_button_enabled?: boolean;
  mail_domain?: string;
  app_url?: string;
  use_custom_app_url?: boolean;
  reply_to_email?: string;
  bounce_email?: string;
  mailbox_support_email?: string;
  enable_list_unsubscribe?: boolean;
  enable_strict_from_alignment?: boolean;
  mailbox_provider_type?: string;
  mailbox_provider_url?: string;
  mailbox_provider_api_url?: string;
  mailbox_provider_username?: string;
  mailbox_provider_password?: string;
  mailbox_provider_api_token?: string;
  mailbox_provider_verify_ssl?: boolean;
  mailbox_provider_auto_create?: boolean;
  mailbox_provider_custom_endpoint?: string;
  signature_name?: string;
  signature_title?: string;
  signature_note?: string;
  signature_image_url?: string;
}

export interface EmailProfileSummary {
  owner_user_id: number | null;
  label: string;
  kind: "default" | "personal";
  from_email?: string;
}

export interface LoggingSettingsData {
  log_level?: string;
  enable_file_logging?: boolean;
  enable_database_logging?: boolean;
  enable_syslog?: boolean;
  log_retention_days?: number;
  log_api_requests?: boolean;
  log_database_queries?: boolean;
  log_user_actions?: boolean;
}

export interface BackupSettingsData {
  enable_automatic_backup?: boolean;
  backup_frequency?: string;
  backup_time?: string;
  backup_location?: string;
  keep_last_n_backups?: number;
  compress_backups?: boolean;
  encrypt_backups?: boolean;
  encryption_key?: string;
}

export interface NotificationSettingsData {
  notify_on_quote_created?: boolean;
  notify_on_quote_response?: boolean;
  notify_on_quote_approved?: boolean;
  notify_on_quote_rejected?: boolean;
  notify_on_contract_created?: boolean;
  notify_on_contract_signed?: boolean;
  notify_on_system_errors?: boolean;
  notify_on_maintenance?: boolean;
  enable_daily_digest?: boolean;
  digest_time?: string;
}

export interface APIKeyData {
  id: number;
  name: string;
  key: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface EmailHealthSummary {
  outbound_total_7d: number;
  delivered_7d: number;
  failed_7d: number;
  bounced_7d: number;
  spam_flagged_7d: number;
  success_rate_7d: number;
  bounce_rate_7d: number;
  spam_rate_7d: number;
  last_error_at?: string | null;
  last_error_message?: string | null;
}

/**
 * Email Settings
 */
export async function getEmailSettings(ownerUserId?: number | null): Promise<EmailSettingsData> {
  const res = await http.get<EmailSettingsData>("/advanced-settings/email", {
    params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
  });
  return res.data;
}

export async function getEmailProfiles(): Promise<EmailProfileSummary[]> {
  const res = await http.get<EmailProfileSummary[]>("/advanced-settings/email/profiles");
  return res.data;
}

export async function updateEmailSettings(
  payload: EmailSettingsData,
  ownerUserId?: number | null,
): Promise<EmailSettingsData> {
  const res = await http.put<EmailSettingsData>(
    "/advanced-settings/email",
    payload,
    {
      params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
    }
  );
  return res.data;
}

export async function testEmailSettings(payload: EmailSettingsData & { to_email: string }, ownerUserId?: number | null): Promise<{ message: string }> {
  const res = await http.post<{ message: string }>(
    "/advanced-settings/email/test",
    payload,
    {
      params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
    }
  );
  return res.data;
}

export async function testMailboxProviderSettings(ownerUserId?: number | null): Promise<{ success: boolean; message: string; status: string }> {
  const res = await http.post<{ success: boolean; message: string; status: string }>(
    "/advanced-settings/email/provider/test",
    {},
    {
      params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
    },
  );
  return res.data;
}

export async function getEmailHealthSummary(ownerUserId?: number | null): Promise<EmailHealthSummary> {
  const res = await http.get<EmailHealthSummary>(
    "/advanced-settings/email/health",
    {
      params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
    },
  );
  return res.data;
}

export async function uploadEmailSignatureImage(file: File, ownerUserId?: number | null): Promise<{ success: boolean; signature_image_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post<{ success: boolean; signature_image_url: string }>(
    "/advanced-settings/email/signature-image",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
    },
  );
  return res.data;
}

/**
 * Logging Settings
 */
export async function getLoggingSettings(): Promise<LoggingSettingsData> {
  const res = await http.get<LoggingSettingsData>("/advanced-settings/logging");
  return res.data;
}

export async function updateLoggingSettings(
  payload: LoggingSettingsData
): Promise<LoggingSettingsData> {
  const res = await http.put<LoggingSettingsData>(
    "/advanced-settings/logging",
    payload
  );
  return res.data;
}

/**
 * Backup Settings
 */
export async function getBackupSettings(): Promise<BackupSettingsData> {
  const res = await http.get<BackupSettingsData>("/advanced-settings/backup");
  return res.data;
}

export async function updateBackupSettings(
  payload: BackupSettingsData
): Promise<BackupSettingsData> {
  const res = await http.put<BackupSettingsData>(
    "/advanced-settings/backup",
    payload
  );
  return res.data;
}

export async function triggerBackupManually(): Promise<{ message: string }> {
  const res = await http.post<{ message: string }>(
    "/advanced-settings/backup/trigger"
  );
  return res.data;
}

/**
 * Notification Settings
 */
export async function getNotificationSettings(): Promise<
  NotificationSettingsData
> {
  const res = await http.get<NotificationSettingsData>(
    "/advanced-settings/notifications"
  );
  return res.data;
}

export async function updateNotificationSettings(
  payload: NotificationSettingsData
): Promise<NotificationSettingsData> {
  const res = await http.put<NotificationSettingsData>(
    "/advanced-settings/notifications",
    payload
  );
  return res.data;
}

/**
 * API Keys
 */
export async function getAPIKeys(): Promise<APIKeyData[]> {
  const res = await http.get<APIKeyData[]>("/advanced-settings/api-keys");
  return res.data;
}

export async function createAPIKey(name: string): Promise<APIKeyData> {
  const res = await http.post<APIKeyData>("/advanced-settings/api-keys", {
    name,
  });
  return res.data;
}

export async function revokeAPIKey(keyId: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(
    `/advanced-settings/api-keys/${keyId}`
  );
  return res.data;
}
