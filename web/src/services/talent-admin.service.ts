import { http } from "../lib/http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminTalentProfile {
  id: number;
  user_id: number;
  availability: string;
  experience_years: number | null;
  kyc_status: string;
  reputation_score: number;
  total_earned: string;
  total_paid_out: string;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedAdminTalentProfiles {
  total: number;
  page: number;
  size: number;
  items: AdminTalentProfile[];
}

export interface KycStatusUpdatePayload {
  kyc_status: string;
  kyc_notes?: string | null;
}

export interface PayoutSummary {
  pending: number;
  approved: number;
  processing: number;
  paid: number;
  rejected: number;
}

// ---------------------------------------------------------------------------
// Error helpers - backend returns detail: {code, message, request_id}
// ---------------------------------------------------------------------------

const TALENT_ADMIN_ERROR_MESSAGES: Record<string, string> = {
  KYC_REVIEW_FORBIDDEN: "KYC inceleme yetkiniz bulunmuyor.",
  TALENT_PROFILE_NOT_FOUND: "Talent profili bulunamadı.",
  TALENT_ADMIN_FORBIDDEN: "Talent yönetim paneline erişim yetkiniz yok.",
};

const DEFAULT_TALENT_ADMIN_ERROR_MESSAGE =
  "Talent yönetimi işlemi tamamlanamadı. Lütfen tekrar deneyin.";

export function getTalentAdminErrorCode(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (detail && typeof detail === "object" && "code" in detail) {
    return String((detail as { code: string }).code);
  }
  return null;
}

export function extractTalentAdminError(err: unknown): string {
  const code = getTalentAdminErrorCode(err);
  return code
    ? TALENT_ADMIN_ERROR_MESSAGES[code] ?? DEFAULT_TALENT_ADMIN_ERROR_MESSAGE
    : DEFAULT_TALENT_ADMIN_ERROR_MESSAGE;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function fetchAdminTalentProfiles(
  page = 1,
  size = 20,
  kycStatus?: string,
): Promise<PaginatedAdminTalentProfiles> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (kycStatus) params.set("kyc_status", kycStatus);
  const res = await http.get<PaginatedAdminTalentProfiles>(
    `/talent/admin/profiles?${params.toString()}`,
  );
  return res.data;
}

export async function updateTalentKycStatus(
  profileId: number,
  payload: KycStatusUpdatePayload,
): Promise<AdminTalentProfile> {
  const res = await http.patch<AdminTalentProfile>(
    `/talent/admin/profiles/${profileId}/kyc`,
    payload,
  );
  return res.data;
}

// Payout summary: derive counts from existing paginated endpoint (size=1 per status)
// Source: GET /admin/payout-requests?status=X&page=1&size=1 -> { total }
export async function fetchPayoutSummary(): Promise<PayoutSummary> {
  const STATUSES = ["pending", "approved", "processing", "paid", "rejected"] as const;
  const results = await Promise.all(
    STATUSES.map((s) =>
      http
        .get<{ total: number }>(`/admin/payout-requests?status=${s}&page=1&size=1`)
        .then((r) => r.data.total)
        .catch(() => 0),
    ),
  );
  const [pending, approved, processing, paid, rejected] = results;
  return { pending, approved, processing, paid, rejected };
}
