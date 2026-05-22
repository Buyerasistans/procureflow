import { http } from "../lib/http";

export interface MailCenterAccount {
  id: number;
  email: string;
  description?: string | null;
  is_active: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_use_ssl?: boolean;
  mailbox_folder?: string | null;
  last_inbox_sync_at?: string | null;
  last_inbox_error?: string | null;
  inbound_count: number;
  unread_count: number;
  outbound_count: number;
}

export interface MailCenterMessage {
  id: number;
  system_email_id: number;
  direction: string;
  status: string;
  subject?: string | null;
  from_email?: string | null;
  to_email?: string | null;
  cc_email?: string | null;
  snippet?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  attachments_json?: string | null;
  thread_key?: string | null;
  in_reply_to?: string | null;
  references_header?: string | null;
  is_read: boolean;
  is_starred?: boolean;
  is_important?: boolean;
  received_at?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
}

export interface MailCenterMessageActionPayload {
  action: "archive" | "trash" | "delete" | "spam" | "restore" | "read" | "unread" | "star" | "unstar" | "important" | "unimportant";
  is_read?: boolean;
  is_starred?: boolean;
  is_important?: boolean;
}

export interface CompanyMailVisibilityRow {
  company_id: number;
  company_name: string;
  tenant_id: number | null;
  tenant_name: string;
  is_primary: boolean;
  is_active: boolean;
  enabled: boolean;
}

export interface MailCenterAccountDiagnosis {
  status: "ok" | "error";
  account_id: number;
  email: string;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_use_ssl?: boolean;
  imap_username?: string | null;
  mailbox_folder?: string | null;
  checks: {
    has_imap_host: boolean;
    has_username: boolean;
    has_password: boolean;
  };
  connection: {
    success: boolean;
    error_type?: string | null;
    error_message?: string | null;
  };
  hints: string[];
}

export async function getMailCenterAccounts(): Promise<MailCenterAccount[]> {
  const res = await http.get<MailCenterAccount[]>("/mail-center/accounts");
  return res.data;
}

export async function getDashboardMailButtonConfig(): Promise<{ dashboard_mail_button_enabled: boolean }> {
  const res = await http.get<{ dashboard_mail_button_enabled: boolean }>("/mail-center/dashboard-mail-button");
  return res.data;
}

export async function getCompanyMailVisibility(): Promise<CompanyMailVisibilityRow[]> {
  const res = await http.get<CompanyMailVisibilityRow[]>("/mail-center/company-mail-visibility");
  return res.data;
}

export async function updateCompanyMailVisibility(companyId: number, enabled: boolean): Promise<{ company_id: number; enabled: boolean }> {
  const res = await http.patch<{ company_id: number; enabled: boolean }>(
    `/mail-center/company-mail-visibility/${companyId}`,
    { enabled },
  );
  return res.data;
}

export async function getMailCenterMessages(accountId: number, direction: "all" | "inbound" | "outbound" = "all"): Promise<MailCenterMessage[]> {
  const res = await http.get<MailCenterMessage[]>(`/mail-center/accounts/${accountId}/messages`, { params: { direction } });
  return res.data;
}

export async function syncMailCenterInbox(accountId: number): Promise<{ status: string; synced: number; message: string }> {
  const res = await http.post<{ status: string; synced: number; message: string }>(`/mail-center/accounts/${accountId}/sync`, {});
  return res.data;
}

export async function diagnoseMailCenterAccount(accountId: number): Promise<MailCenterAccountDiagnosis> {
  const res = await http.get<MailCenterAccountDiagnosis>(`/mail-center/accounts/${accountId}/diagnose`);
  return res.data;
}

export async function sendMailCenterTest(accountId: number, payload: { to_email: string; subject: string; body: string; cc?: string | null }): Promise<{ status: string; message: string }> {
  const res = await http.post<{ status: string; message: string }>(`/mail-center/accounts/${accountId}/send-test`, payload);
  return res.data;
}

export async function updateMailCenterMessage(accountId: number, messageId: number, payload: MailCenterMessageActionPayload): Promise<MailCenterMessage> {
  const res = await http.patch<MailCenterMessage>(`/mail-center/accounts/${accountId}/messages/${messageId}`, payload);
  return res.data;
}

export async function fetchMailCenterAttachment(accountId: number, messageId: number, attachmentIndex: number, disposition: "inline" | "attachment" = "attachment") {
  const res = await http.get<Blob>(`/mail-center/accounts/${accountId}/messages/${messageId}/attachments/${attachmentIndex}`, {
    params: { disposition },
    responseType: "blob",
  });
  return res.data;
}
