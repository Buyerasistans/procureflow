import { http } from "../lib/http";

export interface SupplierCompanyProfile {
  id: number;
  company_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  category_tags: string[];
  partner_category_tags: string[];
  effective_category_tags: string[];
  address: string | null;
  city: string | null;
  address_district: string | null;
  postal_code: string | null;
  logo_url: string | null;
  tax_number: string | null;
  tax_office: string | null;
  registration_number: string | null;
  invoice_name: string | null;
  invoice_address: string | null;
  invoice_city: string | null;
  invoice_district: string | null;
  invoice_postal_code: string | null;
  notes: string | null;
  payment_accounts: SupplierPaymentAccount[];
  accepts_checks: boolean;
  preferred_check_term: string | null;
  authorized_users: SupplierAuthorizedUser[];
  authorized_users_count: number;
  default_user_id: number | null;
}

export interface SupplierPaymentAccount {
  id?: number;
  bank_key: string | null;
  bank_name: string;
  iban: string;
  account_type: "tl" | "doviz";
}

export interface SupplierAuthorizedUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_default: boolean;
}

export interface SupplierGuaranteeItem {
  id: number;
  title: string;
  guarantee_type: string;
  amount: number | null;
  currency: string;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
}

export interface SupplierUserProfile {
  id: number;
  name: string;
  email: string;
  work_email: string | null;
  phone: string | null;
  created_at: string;
  email_verified: boolean;
}

export interface SupplierProfileResponse {
  supplier: SupplierCompanyProfile;
  user: SupplierUserProfile;
}

export interface SupplierEmailChangeStatus {
  pending: boolean;
  pending_email: string | null;
  email_verified: boolean;
  current_email: string;
}

export interface SupplierProfileUpdatePayload {
  supplier_website?: string;
  address?: string;
  city?: string;
  address_district?: string;
  postal_code?: string;
  tax_number?: string;
  tax_office?: string;
  registration_number?: string;
  invoice_name?: string;
  invoice_address?: string;
  invoice_city?: string;
  invoice_district?: string;
  invoice_postal_code?: string;
  notes?: string;
  category_tags?: string[];
  payment_accounts?: SupplierPaymentAccount[];
  accepts_checks?: boolean;
  preferred_check_term?: string;
  user_name?: string;
  user_phone?: string;
  user_email?: string;
  user_work_email?: string | null;
}

export type SupplierDocCategory = "certificates" | "company_docs" | "personnel_docs" | "guarantee_docs";

export interface SupplierDocumentItem {
  id: number;
  category: SupplierDocCategory;
  original_filename: string;
  stored_filename?: string;
  file_url: string;
  file_size?: number;
  content_type?: string;
  created_at?: string;
}

export interface SupplierContractItem {
  id: number;
  quote_id: number;
  contract_number: string;
  status: string;
  final_amount: number | null;
  created_at: string;
}

export interface SupplierFinanceContractItem {
  id: number;
  quote_id: number;
  contract_number: string;
  status: string;
  final_amount: number;
  signed_at?: string | null;
  created_at?: string;
}

export interface SupplierFinanceInvoiceItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  amount: number;
  currency: string;
  file_url?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SupplierFinancePaymentItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  payment_date?: string | null;
  amount: number;
  currency: string;
  method?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SupplierFinancePhotoItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  file_url: string;
  description?: string | null;
  created_at?: string;
}

export interface SupplierFinanceSummary {
  contracts: SupplierFinanceContractItem[];
  invoices: SupplierFinanceInvoiceItem[];
  payments: SupplierFinancePaymentItem[];
  photos: SupplierFinancePhotoItem[];
  totals: {
    contract_total: number;
    invoice_total: number;
    payment_total: number;
    delta_invoice_vs_contract: number;
    delta_payment_vs_contract: number;
    delta_payment_vs_invoice: number;
  };
  alerts: string[];
}

export async function getSupplierProfile(): Promise<SupplierProfileResponse> {
  const res = await http.get<SupplierProfileResponse>("/suppliers/profile");
  return res.data;
}

export async function updateSupplierProfile(
  payload: SupplierProfileUpdatePayload
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>("/suppliers/profile", payload);
  return res.data;
}

export async function uploadSupplierLogo(
  file: File
): Promise<{ logo_url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post<{ status: string; logo_url: string }>(
    "/suppliers/profile/logo",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return { logo_url: res.data.logo_url };
}

export async function uploadSupplierDocument(
  category: SupplierDocCategory,
  file: File
): Promise<SupplierDocumentItem> {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post<{ status: string; document: SupplierDocumentItem }>(
    `/suppliers/profile/documents/${category}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.document;
}

export async function listSupplierDocuments(
  category?: SupplierDocCategory
): Promise<SupplierDocumentItem[]> {
  const res = await http.get<{ documents: SupplierDocumentItem[] }>("/suppliers/profile/documents", {
    params: category ? { category } : undefined,
  });
  return res.data.documents ?? [];
}

export async function deleteSupplierDocument(documentId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/profile/documents/${documentId}`);
  return res.data;
}

export async function listSupplierContracts(): Promise<SupplierContractItem[]> {
  const res = await http.get<{ contracts: SupplierContractItem[] }>("/suppliers/profile/contracts");
  return res.data.contracts ?? [];
}

export async function requestSupplierEmailChange(newEmail: string): Promise<{ status: string; message: string; new_email: string }> {
  const res = await http.post<{ status: string; message: string; new_email: string }>(
    "/suppliers/profile/email-change/request",
    { new_email: newEmail }
  );
  return res.data;
}

export async function confirmSupplierEmailChange(token: string, newPassword?: string): Promise<{ status: string; message: string; new_email: string }> {
  const res = await http.post<{ status: string; message: string; new_email: string }>(
    "/suppliers/profile/email-change/confirm",
    { token, new_password: newPassword }
  );
  return res.data;
}

export async function getSupplierEmailChangeStatus(): Promise<SupplierEmailChangeStatus> {
  const res = await http.get<SupplierEmailChangeStatus>("/suppliers/profile/email-change/status");
  return res.data;
}

export async function updateSupplierProfileUser(
  userId: number,
  payload: { name: string; email: string; phone?: string }
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/profile/users/${userId}`, payload);
  return res.data;
}

export async function deleteSupplierProfileUser(userId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/profile/users/${userId}`);
  return res.data;
}

export async function listSupplierGuarantees(): Promise<SupplierGuaranteeItem[]> {
  const res = await http.get<{ guarantees: SupplierGuaranteeItem[] }>("/suppliers/profile/guarantees");
  return res.data.guarantees ?? [];
}

export async function getSupplierFinanceSummary(params?: { query?: string; date_from?: string; date_to?: string }): Promise<SupplierFinanceSummary> {
  const res = await http.get<SupplierFinanceSummary>("/suppliers/profile/finance-summary", { params });
  return res.data;
}

export async function createSupplierFinanceInvoice(payload: {
  title: string;
  amount: number;
  contract_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  currency?: string;
  notes?: string;
  file?: File;
}): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("title", payload.title);
  form.append("amount", String(payload.amount));
  if (payload.contract_id) form.append("contract_id", String(payload.contract_id));
  if (payload.invoice_number) form.append("invoice_number", payload.invoice_number);
  if (payload.invoice_date) form.append("invoice_date", payload.invoice_date);
  if (payload.currency) form.append("currency", payload.currency);
  if (payload.notes) form.append("notes", payload.notes);
  if (payload.file) form.append("file", payload.file);

  const res = await http.post<{ status: string; message: string }>(
    "/suppliers/profile/finance/invoices",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function createSupplierFinancePayment(payload: {
  title: string;
  amount: number;
  contract_id?: number;
  payment_date?: string;
  currency?: string;
  method?: string;
  notes?: string;
}): Promise<{ status: string; message: string }> {
  const res = await http.post<{ status: string; message: string }>("/suppliers/profile/finance/payments", payload);
  return res.data;
}

export async function createSupplierFinancePhoto(payload: {
  title: string;
  contract_id?: number;
  description?: string;
  file: File;
}): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("title", payload.title);
  if (payload.contract_id) form.append("contract_id", String(payload.contract_id));
  if (payload.description) form.append("description", payload.description);
  form.append("file", payload.file);

  const res = await http.post<{ status: string; message: string }>(
    "/suppliers/profile/finance/photos",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function updateSupplierFinanceInvoice(
  invoiceId: number,
  payload: { title?: string; invoice_number?: string; invoice_date?: string; amount?: number; currency?: string; notes?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/profile/finance/invoices/${invoiceId}`, payload);
  return res.data;
}

export async function deleteSupplierFinanceInvoice(invoiceId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/profile/finance/invoices/${invoiceId}`);
  return res.data;
}

export async function updateSupplierFinancePayment(
  paymentId: number,
  payload: { title?: string; payment_date?: string; amount?: number; currency?: string; method?: string; notes?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/profile/finance/payments/${paymentId}`, payload);
  return res.data;
}

export async function deleteSupplierFinancePayment(paymentId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/profile/finance/payments/${paymentId}`);
  return res.data;
}

export async function updateSupplierFinancePhoto(
  photoId: number,
  payload: { title?: string; description?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/profile/finance/photos/${photoId}`, payload);
  return res.data;
}

export async function deleteSupplierFinancePhoto(photoId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/profile/finance/photos/${photoId}`);
  return res.data;
}
