// Quote API Service
import { http } from "../lib/http";
import type { ApprovalDetailLike, QuotePendingApprovalLike } from "../types/approval";
import { normalizeQuote, normalizeQuotes } from "../types/quote";

export interface Quote {
  id: number;
  rfq_id?: number;
  tenant_id?: number | null;
  project_id: number;
  created_by_id: number;
  title: string;
  description?: string;
  amount?: number; // Backward compat
  total_amount?: number; // Backend dönerseçiliyor
  status: "DRAFT" | "SUBMITTED" | "PENDING" | "RESPONDED" | "APPROVED" | "REJECTED" | "draft" | "submitted" | "approved" | "rejected";
  company_name: string;
  company_contact_name: string;
  company_contact_phone: string;
  company_contact_email: string;
  published_by_tenant_name?: string | null;
  listing_scope?: string | null;
  listing_scope_label?: string | null;
  private_supplier_count?: number;
  platform_network_supplier_count?: number;
  invited_supplier_count?: number;
  responded_supplier_count?: number;
  package_plan_code?: string | null;
  package_plan_name?: string | null;
  active_premium_feature_codes?: string[];
  entitlement_status?: string | null;
  entitlement_summary?: string | null;
  platform_network_listing_enabled?: boolean;
  premium_listing_enabled?: boolean;
  currency?: string;
  version?: number;
  transition_reason?: string;
  created_at: string;
  updated_at?: string;
  sent_at?: string;
  deadline?: string;
  is_active?: boolean;
  items?: Array<{
    id: number;
    quote_id: number;
    rfq_id?: number;
    line_number: string;
    category_code: string;
    category_name: string;
    description: string;
    group_key?: string;
    is_group_header?: boolean;
    unit: string;
    quantity: number;
    unit_price: number;
    vat_rate?: number;
    total_price: number;
    notes?: string;
  }>;
}

export type Rfq = Quote;

export interface QuoteListResponse {
  items: Quote[];
  total: number;
  page: number;
  size: number;
  count?: number;
}

export type RfqListResponse = QuoteListResponse;

export interface CreateQuoteRequest {
  title: string;
  description?: string;
  listing_scope_preference?: "private_suppliers_only" | "platform_network_only" | "private_and_platform_network" | "premium_featured_listing";
  project_id: number;
  department_id?: number;
  assigned_to_id?: number;
  company_name: string;
  company_contact_name: string;
  company_contact_phone: string;
  company_contact_email: string;
  amount?: number;
}

export type CreateRfqRequest = CreateQuoteRequest;

export interface QuoteItemPayload {
  line_number: string;
  category_code: string;
  category_name: string;
  description: string;
  group_key?: string;
  is_group_header?: boolean;
  unit: string;
  quantity: number;
  unit_price?: number;
  vat_rate?: number;
  notes?: string;
}

export type RfqItemPayload = QuoteItemPayload;

export interface UpdateQuoteRequest {
  title?: string;
  amount?: number;
  description?: string;
  company_name?: string;
  company_contact_name?: string;
  company_contact_phone?: string;
  company_contact_email?: string;
}

export type UpdateRfqRequest = UpdateQuoteRequest;

export interface QuoteStatusChangeRequest {
  reason?: string;
}

export type RfqStatusChangeRequest = QuoteStatusChangeRequest;

export interface StatusLog {
  id: number;
  quote_id: number;
  from_status: string;
  to_status: string;
  from_status_en?: string;
  to_status_en?: string;
  changed_by: number;
  changed_by_name?: string;
  created_at?: string;
  changed_at?: string;
  approval_details?: ApprovalDetailLike[] | null;
}

export interface QuoteAuditEvent {
  timestamp?: string;
  type: string;
  icon?: string;
  title: string;
  actor?: string | number;
  actor_id?: number;
  details?: Record<string, unknown>;
}

export interface QuoteAuditTrail {
  quote_id: number;
  quote_title: string;
  current_status: string;
  total_events: number;
  timeline: QuoteAuditEvent[];
  summary?: {
    created_at?: string;
    created_by?: string;
    status_changes?: number;
    approval_levels?: number;
    suppliers_responded?: number;
  };
}

export interface DomainEvent {
  event_type: string;
  quote_id: number;
  old_status?: string;
  new_status?: string;
  reason?: string;
  actor_id?: number;
  timestamp: string;
}

export interface QuoteApprovalActionResponse {
  status: string;
  message: string;
  approval_level?: number;
  workflow_completed?: boolean;
  next_step?: string;
  quote_status?: string;
  reason?: string;
}

export type RfqApprovalActionResponse = QuoteApprovalActionResponse;

export type QuotePendingApproval = QuotePendingApprovalLike;
export type RfqPendingApproval = QuotePendingApproval;

// List quotes with filters
export async function getQuotes(
  page: number = 1,
  size: number = 10,
  status?: string
): Promise<QuoteListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    size: size.toString(),
  });
  if (status) params.append("status_filter", status);

  const res = await http.get<QuoteListResponse>(`/quotes?${params}`);
  return {
    ...res.data,
    total: Number(res.data.total ?? res.data.count ?? 0),
    items: normalizeQuotes(res.data.items) as Quote[],
  };
}

export async function getRfqs(
  page: number = 1,
  size: number = 10,
  status?: string
): Promise<RfqListResponse> {
  return getQuotes(page, size, status);
}

// Get single quote
export async function getQuote(id: number): Promise<Quote> {
  const res = await http.get<Quote>(`/quotes/${id}`);
  return normalizeQuote(res.data) as Quote;
}

export async function getRfq(id: number): Promise<Rfq> {
  return getQuote(id);
}

// Create quote
export async function createQuote(data: CreateQuoteRequest): Promise<Quote> {
  const res = await http.post<Quote>("/quotes/", data);
  return normalizeQuote(res.data) as Quote;
}

export async function createRfq(data: CreateRfqRequest): Promise<Rfq> {
  return createQuote(data);
}

// Bulk replace quote items
export async function updateQuoteItems(quoteId: number, items: QuoteItemPayload[]): Promise<Quote> {
  const res = await http.put<Quote>(`/quotes/${quoteId}/items`, items);
  return normalizeQuote(res.data) as Quote;
}

export async function updateRfqItems(rfqId: number, items: RfqItemPayload[]): Promise<Rfq> {
  return updateQuoteItems(rfqId, items);
}

// Update quote
export async function updateQuote(id: number, data: UpdateQuoteRequest): Promise<Quote> {
  const res = await http.put<Quote>(`/quotes/${id}`, data);
  return normalizeQuote(res.data) as Quote;
}

export async function updateRfq(id: number, data: UpdateRfqRequest): Promise<Rfq> {
  return updateQuote(id, data);
}

// Delete quote (soft delete)
export async function deleteQuote(id: number): Promise<void> {
  await http.delete(`/quotes/${id}`);
}

export async function deleteRfq(id: number): Promise<void> {
  return deleteQuote(id);
}

// Restore quote
export async function restoreQuote(id: number): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/restore`);
  return normalizeQuote(res.data) as Quote;
}

export async function restoreRfq(id: number): Promise<Rfq> {
  return restoreQuote(id);
}

// Quote transitions
export async function submitQuote(
  id: number,
  data?: QuoteStatusChangeRequest
): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/submit`, data || {});
  return normalizeQuote(res.data) as Quote;
}

export async function submitRfq(
  id: number,
  data?: RfqStatusChangeRequest
): Promise<Rfq> {
  return submitQuote(id, data);
}

export async function approveQuote(
  id: number,
  data?: QuoteStatusChangeRequest
): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/approve`, data || {});
  return normalizeQuote(res.data) as Quote;
}

export async function approveRfq(
  id: number,
  data?: RfqStatusChangeRequest
): Promise<Rfq> {
  return approveQuote(id, data);
}

export async function rejectQuote(
  id: number,
  data?: QuoteStatusChangeRequest
): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/reject`, data || {});
  return normalizeQuote(res.data) as Quote;
}

export async function rejectRfq(
  id: number,
  data?: RfqStatusChangeRequest
): Promise<Rfq> {
  return rejectQuote(id, data);
}

export async function approveQuoteWorkflow(
  id: number,
  comment?: string
): Promise<QuoteApprovalActionResponse> {
  const res = await http.post<QuoteApprovalActionResponse>(`/approvals/${id}/approve`, {
    comment: comment || null,
  });
  return res.data;
}

export async function approveRfqWorkflow(
  id: number,
  comment?: string
): Promise<RfqApprovalActionResponse> {
  return approveQuoteWorkflow(id, comment);
}

export async function rejectQuoteWorkflow(
  id: number,
  comment: string
): Promise<QuoteApprovalActionResponse> {
  const res = await http.post<QuoteApprovalActionResponse>(`/approvals/${id}/reject`, {
    comment,
  });
  return res.data;
}

export async function rejectRfqWorkflow(
  id: number,
  comment: string
): Promise<RfqApprovalActionResponse> {
  return rejectQuoteWorkflow(id, comment);
}

export async function getQuotePendingApprovals(id: number): Promise<QuotePendingApproval[]> {
  const res = await http.get<QuotePendingApproval[]>(`/approvals/${id}/pending`);
  return res.data;
}

export async function getRfqPendingApprovals(id: number): Promise<RfqPendingApproval[]> {
  return getQuotePendingApprovals(id);
}

// Get status history
export async function getQuoteHistory(id: number): Promise<StatusLog[]> {
  const res = await http.get<StatusLog[]>(`/quotes/${id}/status-history`);
  return res.data;
}

export async function getQuoteAuditTrail(id: number): Promise<QuoteAuditTrail> {
  const res = await http.get<QuoteAuditTrail>(`/quotes/${id}/full-audit-trail`);
  return res.data;
}

// Get domain events (for admin)
export async function getDomainEvents(): Promise<DomainEvent[]> {
  const res = await http.get<{ events: DomainEvent[] }>("/quotes/internal/events");
  return res.data.events;
}

// ============================================================================
// Revision System APIs
// ============================================================================

export interface SupplierQuoteRevision {
  id: number;
  revision_number: number;
  status: string;
  currency?: string;
  total_amount: number;
  initial_final_amount?: number;
  submitted_at?: string;
  profitability_amount: number | null;
  profitability_percent: number | null;
  revisions: SupplierQuoteRevision[];
  items?: Array<{
    quote_item_id: number;
    line_number?: string;
    description?: string;
    unit?: string;
    quantity?: number;
    vat_rate?: number;
    supplier_unit_price?: number;
    supplier_total_price?: number;
    unit_price?: number;
    total_price?: number;
    is_group_header?: boolean;
    item_notes?: string | null;
    notes?: string;
    original_unit_price?: number;
    original_total_price?: number;
  }>;
}

export interface SupplierQuoteDetail {
  id: number;
  quote_id: number;
  quote_title?: string;
  supplier_id: number;
  supplier_name?: string;
  status: string;
  currency?: string;
  total_amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  payment_terms?: string;
  delivery_time?: number;
  warranty?: string;
  submitted_at?: string;
  created_at?: string;
  items: Array<{
    quote_item_id: number;
    description?: string;
    unit?: string;
    quantity?: number;
    vat_rate?: number;
    supplier_unit_price?: number;
    supplier_total_price?: number;
    notes?: string;
    is_group_header?: boolean;
    line_number?: string;
    item_detail?: string;
    item_image_url?: string;
  }>;
}

export interface SupplierQuotesGrouped {
  supplier_id: number;
  supplier_name: string;
  quotes: SupplierQuoteRevision[];
}

export interface SupplierApprovalResponse {
  status: string;
  quote_id: number;
  supplier_quote_id: number;
  supplier_id: number;
  supplier_name: string;
  approved_amount: number;
  message: string;
}

export interface QuoteComparisonDetailedItem {
  quote_item_id: number;
  line_number: string;
  description: string;
  detail: string;
  image_url: string;
  unit: string;
  quantity: number;
  base_unit_price: number;
  is_group_header: boolean;
  supplier_prices: Record<string, { unit_price: number | null; total_price: number | null }>;
}

export interface QuoteComparisonDetailedSupplier {
  supplier_quote_id: number;
  supplier_id: number;
  supplier_name: string;
  revision_number: number;
  status: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  delivery_time: number;
  approved: boolean;
}

export interface QuoteComparisonDetailedReport {
  quote: {
    id: number;
    rfq_id?: number;
    title: string;
    generated_at: string;
    approved_supplier_name: string;
  };
  suppliers: QuoteComparisonDetailedSupplier[];
  items: QuoteComparisonDetailedItem[];
}

export type RfqComparisonDetailedReport = QuoteComparisonDetailedReport;

// 1. Tedarikçi tekliflerini tedarikçi bazında gruplandırılmış olarak getir
export async function getSupplierQuotesGrouped(quoteId: number): Promise<SupplierQuotesGrouped[]> {
  const res = await http.get<SupplierQuotesGrouped[]>(`/quotes/${quoteId}/suppliers`);
  return res.data;
}

export async function getSupplierQuoteById(supplierQuoteId: number): Promise<SupplierQuoteDetail> {
  const res = await http.get<SupplierQuoteDetail>(`/supplier-quotes/${supplierQuoteId}`);
  return res.data;
}

// 2. Tedarikçiden revize iste
export async function requestQuoteRevision(
  quoteId: number,
  supplierQuoteId: number,
  reason: string
): Promise<{ status: string; message: string; quote_id: number }> {
  const res = await http.post<{ status: string; message: string; quote_id: number }>(
    `/quotes/${quoteId}/request-revision/${supplierQuoteId}?reason=${encodeURIComponent(reason)}`
  );
  return res.data;
}

// 3. Revize teklifini gönder (tedarikçi tarafından)
export async function submitRevisionedQuote(
  quoteId: number,
  supplierQuoteId: number,
  revisedPrices: Array<{ quote_item_id: number; unit_price: number; total_price: number }>
): Promise<{ status: string; new_supplier_quote_id: number; profitability: { amount: number; percent: number } }> {
  const res = await http.post(
    `/quotes/${quoteId}/submit-revision`,
    { supplier_quote_id: supplierQuoteId, revised_prices: revisedPrices }
  );
  return res.data;
}

// 4. Karşılaştırma ekranında tedarikçi teklifi onayla
export async function approveSupplierQuote(
  quoteId: number,
  supplierQuoteId: number
): Promise<SupplierApprovalResponse> {
  const res = await http.post<SupplierApprovalResponse>(
    `/quotes/${quoteId}/approve-supplier/${supplierQuoteId}`
  );
  return res.data;
}

// 5. Karşılaştırma raporunu Excel olarak indir
export async function downloadQuoteComparisonXlsx(quoteId: number): Promise<Blob> {
  const res = await http.get<Blob>(`/reports/${quoteId}/comparison/export-xlsx`, {
    responseType: "blob",
  });
  return res.data;
}

// 6. Karşılaştırma sayfası için detaylı rapor verisi
export async function getQuoteComparisonDetailedReport(quoteId: number): Promise<QuoteComparisonDetailedReport> {
  const res = await http.get<QuoteComparisonDetailedReport>(`/reports/${quoteId}/comparison/detailed`);
  return res.data;
}

export async function getRfqComparisonDetailedReport(rfqId: number): Promise<RfqComparisonDetailedReport> {
  return getQuoteComparisonDetailedReport(rfqId);
}
