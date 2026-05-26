import { http } from "../lib/http";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcurementJob {
  id: number;
  tenant_id: number | null;
  posted_by_user_id: number;
  title: string;
  description: string;
  category: string | null;
  employment_type: string;
  location_type: string;
  city: string | null;
  country: string | null;
  salary_min: string | null;
  salary_max: string | null;
  salary_currency: string;
  salary_period: string;
  required_skills: string[];
  min_experience_years: number | null;
  status: string;
  application_deadline: string | null;
  is_procurement_only: boolean;
  view_count: number;
  application_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedJobsOut {
  total: number;
  page: number;
  size: number;
  items: ProcurementJob[];
}

export interface JobCreatePayload {
  title: string;
  description: string;
  category?: string;
  employment_type?: string;
  location_type?: string;
  city?: string;
  country?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  required_skills?: string[];
  min_experience_years?: number;
  status?: string;
  application_deadline?: string;
}

export interface JobApplicationCreatePayload {
  cover_letter?: string;
}

export interface JobApplicationOut {
  id: number;
  job_id: number;
  applicant_user_id: number;
  talent_profile_id: number;
  cover_letter: string | null;
  status: string;
  applied_at: string;
}

// ---------------------------------------------------------------------------
// Error helper — backend returns detail: {code, message, request_id}
// ---------------------------------------------------------------------------

export function extractJobsError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: string }).message);
  }
  if (typeof detail === "string") return detail;
  return (err as { message?: string })?.message ?? "Bir hata oluştu";
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function fetchJobs(
  page = 1,
  size = 20,
  statusFilter?: string,
  employmentType?: string,
): Promise<PaginatedJobsOut> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (statusFilter) params.set("status", statusFilter);
  if (employmentType) params.set("employment_type", employmentType);
  const res = await http.get<PaginatedJobsOut>(`/jobs?${params.toString()}`);
  return res.data;
}

export async function fetchJob(id: number): Promise<ProcurementJob> {
  const res = await http.get<ProcurementJob>(`/jobs/${id}`);
  return res.data;
}

export async function createJob(payload: JobCreatePayload): Promise<ProcurementJob> {
  const res = await http.post<ProcurementJob>("/jobs", payload);
  return res.data;
}

export async function applyToJob(
  jobId: number,
  payload: JobApplicationCreatePayload,
): Promise<JobApplicationOut> {
  const res = await http.post<JobApplicationOut>(`/jobs/${jobId}/apply`, payload);
  return res.data;
}
