import { http } from "../lib/http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankDetailsMasked {
  [key: string]: string | null;
}

export interface PayoutRequest {
  id: number;
  user_id: number;
  talent_profile_id: number;
  amount: string;
  currency: string;
  payment_method: string;
  bank_details_masked: BankDetailsMasked | null;
  status: string;
  reviewer_user_id: number | null;
  reviewed_at: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPayoutRequestsOut {
  total: number;
  page: number;
  size: number;
  items: PayoutRequest[];
}

export interface PayoutStatusUpdatePayload {
  status: string;
  rejection_reason?: string | null;
}

// ---------------------------------------------------------------------------
// Error helpers — backend returns detail: {code, message, request_id}
// ---------------------------------------------------------------------------

export function extractPayoutError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  if (typeof detail === "string") return detail;
  return (err as { message?: string })?.message ?? "Bir hata oluştu";
}

export function getPayoutErrorCode(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (detail && typeof detail === "object" && "code" in detail) {
    return String((detail as { code: string }).code);
  }
  return null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function fetchAdminPayoutRequests(
  page = 1,
  size = 20,
  statusFilter?: string,
): Promise<PaginatedPayoutRequestsOut> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (statusFilter) params.set("status", statusFilter);
  const res = await http.get<PaginatedPayoutRequestsOut>(
    `/admin/payout-requests?${params.toString()}`,
  );
  return res.data;
}

export async function updatePayoutStatus(
  id: number,
  payload: PayoutStatusUpdatePayload,
): Promise<PayoutRequest> {
  const res = await http.patch<PayoutRequest>(`/admin/payout-requests/${id}`, payload);
  return res.data;
}
