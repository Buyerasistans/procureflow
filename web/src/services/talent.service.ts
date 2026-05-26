import { http } from "../lib/http";

// ---------------------------------------------------------------------------
// Types — TalentProfile
// ---------------------------------------------------------------------------

export interface TalentProfile {
  id: number;
  user_id: number;
  availability: string;
  experience_years: number | null;
  linkedin_url: string | null;
  bio: string | null;
  skills: string[];
  category_expertise: string[];
  kyc_status: string;
  reputation_score: number;
  total_earned: string;
  total_paid_out: string;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface TalentProfileCreatePayload {
  availability?: string;
  experience_years?: number;
  linkedin_url?: string;
  bio?: string;
  skills?: string[];
  category_expertise?: string[];
  is_public?: boolean;
}

export interface TalentProfileUpdatePayload {
  availability?: string;
  experience_years?: number | null;
  linkedin_url?: string | null;
  bio?: string | null;
  skills?: string[];
  category_expertise?: string[];
  is_public?: boolean;
}

// ---------------------------------------------------------------------------
// Types — EarningsLedger
// ---------------------------------------------------------------------------

export interface EarningsEntry {
  id: number;
  user_id: number;
  talent_profile_id: number;
  event_type: string;
  amount: string;
  currency: string;
  balance_after: string;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface PaginatedEarningsOut {
  total: number;
  page: number;
  size: number;
  items: EarningsEntry[];
}

// ---------------------------------------------------------------------------
// Error helper — backend returns detail: {code, message, request_id}
// ---------------------------------------------------------------------------

export function extractTalentError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  if (typeof detail === "string") return detail;
  return (err as { message?: string })?.message ?? "Bir hata oluştu";
}

export function getTalentErrorCode(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === "object" && "code" in detail) {
    return String((detail as { code: string }).code);
  }
  return null;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getMyTalentProfile(): Promise<TalentProfile> {
  const res = await http.get<TalentProfile>("/talent/me");
  return res.data;
}

export async function registerTalentProfile(
  payload: TalentProfileCreatePayload,
): Promise<TalentProfile> {
  const res = await http.post<TalentProfile>("/talent/register", payload);
  return res.data;
}

export async function updateMyTalentProfile(
  payload: TalentProfileUpdatePayload,
): Promise<TalentProfile> {
  const res = await http.patch<TalentProfile>("/talent/me", payload);
  return res.data;
}

export async function getMyEarnings(
  page = 1,
  size = 10,
): Promise<PaginatedEarningsOut> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const res = await http.get<PaginatedEarningsOut>(`/talent/me/earnings?${params.toString()}`);
  return res.data;
}
