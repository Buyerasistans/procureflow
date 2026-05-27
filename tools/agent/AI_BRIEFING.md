# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 4 / Atomik-2 - COMPLETE

## Executive Summary

PHASE 4 / Atomik-2 adds `POST /auth/register` — a public endpoint that
creates individual employer (`employer_company_admin`) and candidate
(`candidate_user`) accounts. No tenant affiliation. Returns a token pair
on success for immediate session use. 14 new tests PASS; 22 existing
auth/bootstrap tests PASS (no regression). G1 and G2 backend blockers
are now resolved.

## Change Made

**`api/routers/auth.py`** — extended with:
- `Literal` import
- `RegisterIn` schema: `{email, password, full_name, user_type}`
- `_USER_TYPE_ROLE_MAP` constant: `employer→employer_company_admin`, `candidate→candidate_user`
- `POST /auth/register` endpoint (HTTP 201)

**`api/tests/test_auth_register.py`** — new test file (14 tests):
- Role assignment for employer and candidate
- Role map coverage guard
- Duplicate email 409
- Short password 400
- Empty full_name 400
- Invalid user_type 422 (Pydantic)
- Schema validation

## Endpoint Contract

```
POST /api/v1/auth/register
Content-Type: application/json

Request:
{
  "email": "user@example.com",     // EmailStr — format validated
  "password": "min8chars",          // min 8 chars (handler check)
  "full_name": "Ada Lovelace",      // non-empty (handler check)
  "user_type": "employer"|"candidate"  // Literal — 422 on other values
}

Response 201:
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "user": { "id": ..., "email": ..., "system_role": ..., ... }
}

Errors:
  409  — duplicate email ("Bu e-posta adresi zaten kayıtlı.")
  400  — password < 8 chars
  400  — empty full_name
  422  — invalid user_type / email format (Pydantic)
```

## Security Notes

- Password hashed with `get_password_hash()` (same bcrypt pattern as login)
- Duplicate email: 409 (not 200 + "already exists" — no leaking of user existence via timing; both paths share the same code path until the early return)
- `user_type` is a strict `Literal` — no arbitrary role escalation possible
- `tenant_id=None` — standalone user; no tenant approval flow triggered
- Logging: `individual_register_ok user_id=X system_role=Y` (no PII in log)

## Gap Status After Atomik-2

| Gap | Status |
| --- | --- |
| G1: No employer_company_admin onboarding path | BACKEND DONE |
| G2: No candidate_user onboarding path | BACKEND DONE |
| G3: No guest_public entry point | PHASE 5/6 scope |
| G4: No post-registration role-based redirect | Frontend pending (Atomik-3/4) |

## Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| New tests | PASS 14/14 | test_auth_register.py |
| Existing auth tests | PASS 22/22 | test_auth_login.py + test_bootstrap_secret.py |
| type-check | N/A | Python/FastAPI — not a TypeScript project |
| build | N/A | Backend only; no frontend change |

## Next Atomic Step

**PHASE 4 / Atomik-3:** Frontend — `EmployerRegisterPage`

**Goal:** New public registration page at `/employer/register` for
`employer_company_admin` users. Calls `POST /auth/register` with
`user_type="employer"`. On success, stores token + user and redirects
to `/jobs`.

**Files:**
- `web/src/pages/EmployerRegisterPage.tsx` (new)
- `web/src/pages/EmployerRegisterPage.css` (new)
- `web/src/App.tsx` — add public route `/employer/register`
- `web/src/services/auth.service.ts` — add `registerUser()` function

**Responsive gate:** 375 / 768 / 1366 — form render + submit mock.
**Constraint:** src/api changes NOT needed (endpoint already exists).

## Open Risks

- `api/routers/onboarding_router.py` dirty (unrelated) — not touched.
- `web/src/JobList.tsx` orphan — dead code, still deferred.
- PHASE 3 docs still dirty (jobs-surface-phase3-plan.md Atomik-4 note).

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 4 / Atomik-2: COMPLETE
Next: PHASE 4 / Atomik-3 — Frontend EmployerRegisterPage at /employer/register.
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
```

## SAFE TO RESUME
yes
