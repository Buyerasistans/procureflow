const EMPLOYER_SYSTEM_ROLES = new Set([
  "employer_company_admin",
  "employer_recruiter",
]);

export const POST_REGISTER_REDIRECT = {
  employer: "/jobs",
  candidate: "/talent/profile",
} as const;

export function getActivationRedirectPath(systemRole: string | null | undefined): string {
  const role = String(systemRole || "").toLowerCase();
  if (EMPLOYER_SYSTEM_ROLES.has(role)) return POST_REGISTER_REDIRECT.employer;
  if (role === "candidate_user") return POST_REGISTER_REDIRECT.candidate;
  return "/app";
}
