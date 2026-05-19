import { http } from "../lib/http";

export interface SystemEmail {
  id: number;
  email: string;
  password: string;
  description: string;
  owner_user_id?: number | null;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_note?: string | null;
  signature_image_url?: string | null;
  is_active?: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_password?: string | null;
  imap_use_ssl?: boolean;
  mailbox_folder?: string | null;
  last_inbox_sync_at?: string | null;
  last_inbox_error?: string | null;
  mailbox_provision_status?: string | null;
  mailbox_provision_message?: string | null;
  mailbox_provisioned_at?: string | null;
}

export interface SystemEmailCreate {
  email: string;
  password: string;
  description: string;
  owner_user_id?: number | null;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_note?: string | null;
  signature_image_url?: string | null;
  is_active?: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_password?: string | null;
  imap_use_ssl?: boolean;
  mailbox_folder?: string | null;
}

export interface SystemEmailUpdate {
  password?: string;
  description?: string;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_note?: string | null;
  signature_image_url?: string | null;
  is_active?: boolean;
  imap_host?: string | null;
  imap_port?: number | null;
  imap_username?: string | null;
  imap_password?: string | null;
  imap_use_ssl?: boolean;
  mailbox_folder?: string | null;
}

export async function getSystemEmails(ownerUserId?: number | null): Promise<SystemEmail[]> {
  const res = await http.get<SystemEmail[]>("/system-emails", {
    params: ownerUserId === undefined ? undefined : { owner_user_id: ownerUserId },
  });
  return res.data;
}

export async function createSystemEmail(payload: SystemEmailCreate): Promise<SystemEmail> {
  const res = await http.post<SystemEmail>("/system-emails", payload);
  return res.data;
}

export async function updateSystemEmail(id: number, payload: SystemEmailUpdate): Promise<SystemEmail> {
  const res = await http.put<SystemEmail>(`/system-emails/${id}`, payload);
  return res.data;
}

export async function provisionSystemEmail(id: number): Promise<SystemEmail> {
  const res = await http.post<SystemEmail>(`/system-emails/${id}/provision`, {});
  return res.data;
}

export async function deleteSystemEmail(id: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/system-emails/${id}`);
  return res.data;
}
