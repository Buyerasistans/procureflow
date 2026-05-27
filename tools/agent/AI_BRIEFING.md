# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 3 / Atomik-2 - COMPLETE

## Executive Summary

PHASE 3 / Atomik-2 removes backend authz blockers for `employer_recruiter`
and `candidate_user`. Two set expansions in `api/core/authz.py` — no migration,
no schema change. All downstream call sites reviewed. No privilege escalation.
Talent register promotion side effect (Gap-4) auto-resolved. 30/31 backend
tests pass; 1 pre-existing failure is unrelated (OpenSSL entropy in paramiko).

## Change Made

**`api/core/authz.py`** — two set literals updated:

```python
# Before
TALENT_MEMBER_SYSTEM_ROLES = {"talent_member"}
EMPLOYER_ADMIN_SYSTEM_ROLES = {"employer_company_admin"}

# After
TALENT_MEMBER_SYSTEM_ROLES = {"talent_member", "candidate_user"}
EMPLOYER_ADMIN_SYSTEM_ROLES = {"employer_company_admin", "employer_recruiter"}
```

## Impact Analysis

All call sites of `is_talent_member`, `is_employer_admin`, and derived
functions reviewed.

**employer_recruiter now has:**
- `can_post_procurement_job` → POST /jobs (create job listing) ✓
- Tenant-scoped job query in GET /jobs (own-tenant + published others) ✓
- Application management: list + status update for own job listings ✓
- `can_review_talent_profile` via TALENT_REVIEWER_SYSTEM_ROLES ✓
- Member of TALENT_ECOSYSTEM_ROLES ✓

**candidate_user now has:**
- `can_access_talent_dashboard` → GET/PATCH /talent/me ✓
- `apply_to_job` → POST /jobs/{id}/apply ✓
- GET /talent/me/earnings ✓
- Referral task submission (referral_tasks.py is_talent_member check) ✓
- Talent register: is_talent_member returns True → no unwanted promotion ✓
- Member of TALENT_ECOSYSTEM_ROLES ✓

**candidate_user does NOT have (confirmed):**
- can_post_procurement_job: False ✓
- can_review_talent_profile: False ✓
- Admin surface, platform staff, payout approval: not affected ✓

**employer_recruiter does NOT have (confirmed):**
- can_access_talent_dashboard: False (recruiter views talent via admin surface) ✓
- Payout approval, platform governance: not affected ✓

**Pre-existing roles: unchanged (verified):**
- employer_company_admin: is_employer_admin still True ✓
- talent_member: is_talent_member still True ✓
- super_admin: all checks still True ✓

## Gap Status After Atomik-2

| Gap | Backend | UI/Frontend |
| --- | --- | --- |
| G1: employer_recruiter cannot create jobs | DONE | Pending (Atomik-3) |
| G2: candidate_user cannot access /talent/profile | DONE | N/A (API fix = page fix) |
| G3: candidate_user cannot apply to jobs | DONE | Pending (Atomik-3) |
| G4: register promotion side effect | DONE (auto) | N/A |
| G5: JobsPage helpers not policy-aligned | — | Pending (future) |
| G6: No public /jobs surface | — | Out of scope |

## Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| Python verification | PASS | All authz checks correct via MockUser |
| Backend tests | PASS 30/31 | 1 pre-existing paramiko/OpenSSL failure unrelated |
| type-check (frontend) | PASS | No errors |
| build (frontend) | PASS | 1.64s |

## Next Atomic Step

**PHASE 3 / Atomik-3:** Frontend — JobsPage UI role action CTAs

**Files:** `web/src/pages/JobsPage.tsx` only

**Changes:**
- `isEmployerAdmin()` local helper: add `"employer_recruiter"`
- `isTalentMember()` local helper: add `"candidate_user"`

**Gate:** type-check + build + responsive gate (375/768/1366 for both personas;
Playwright session injection; confirm "Yeni İlan" CTA for employer_recruiter
and "Başvur" CTA for candidate_user visible and clickable).

**Depends on:** Atomik-2 complete ✓

## Open Risks

- `web/src/JobList.tsx` dead orphan component — still present, not in routing.
- G5 (JobsPage helpers not policy-aligned) — deferred to future cleanup.
- Atomik-3 Playwright gate: employer_recruiter and candidate_user have no demo
  DB accounts; session injection technique required (same as Atomik-5).

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 3 / Atomik-2: COMPLETE (commit pending after this message)
Next atomic step: PHASE 3 / Atomik-3 — JobsPage.tsx UI role actions
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. Implement only one atomic step.
```

## SAFE TO RESUME
yes
