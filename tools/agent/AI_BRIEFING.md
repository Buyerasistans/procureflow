# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 4 / Atomik-5 - COMPLETE

## Executive Summary

PHASE 4 / Atomik-5 centralizes post-registration redirect policy into a single
frontend module (`register-redirect-policy.ts`), wires role-based redirect into
`InternalUserActivationPage.tsx` (employer→/jobs, candidate→/talent/profile,
fallback→/app), and adds a UX info note to both register pages confirming
immediate account access. Backend `is_active=True` (no email gate) is
intentional and unchanged. Gate 14/14 PASS.

## Changes Made

**`web/src/config/register-redirect-policy.ts`** — new file:
- `POST_REGISTER_REDIRECT` const: `{ employer: "/jobs", candidate: "/talent/profile" }`
- `getActivationRedirectPath(systemRole)` — maps system_role to redirect path:
  - employer_company_admin / employer_recruiter → /jobs
  - candidate_user → /talent/profile
  - fallback → /app

**`web/src/pages/EmployerRegisterPage.tsx`** — updated:
- Import `POST_REGISTER_REDIRECT` from policy module
- `navigate(POST_REGISTER_REDIRECT.employer, { replace: true })` (was hardcoded "/jobs")
- Added `<p className="employer-register-page__info">` info note after subtitle

**`web/src/pages/EmployerRegisterPage.css`** — updated:
- Subtitle `margin: 0 0 28px` → `0 0 8px`
- Added `.employer-register-page__info` (green #059669, 12px, centered)

**`web/src/pages/CandidateRegisterPage.tsx`** — updated:
- Import `POST_REGISTER_REDIRECT` from policy module
- `navigate(POST_REGISTER_REDIRECT.candidate, { replace: true })` (was hardcoded "/talent/profile")
- Added `<p className="candidate-register-page__info">` info note after subtitle

**`web/src/pages/CandidateRegisterPage.css`** — updated:
- Subtitle `margin: 0 0 28px` → `0 0 8px`
- Added `.candidate-register-page__info` (blue #0284c7, 12px, centered)

**`web/src/pages/InternalUserActivationPage.tsx`** — updated:
- Import `getActivationRedirectPath` from policy module
- After successful activation: `const redirectPath = getActivationRedirectPath(data.user?.system_role)`
- `navigate(redirectPath, { replace: true })` (was hardcoded "/app")

**`docs/runbooks/onboarding-phase4-plan.md`** — updated:
- Atomik-5 section marked COMPLETE with redirect policy table and gate results

## Redirect Policy Table

| user_type / system_role | Hedef |
|---|---|
| employer_company_admin | /jobs |
| employer_recruiter | /jobs |
| candidate_user | /talent/profile |
| fallback (all other roles) | /app |

## Gate Results

Gate script: `tools/atomik5_activation_redirect_gate.mjs`
Artifacts: `tools/gate-artifacts/atomik5-activation-redirect/`

| Scenario | Viewports | Result |
|---|---|---|
| Employer register info note visible | 360/768/1280 | PASS (3/3) |
| Employer card fits viewport | 360/768/1280 | PASS (3/3) |
| Candidate register info note visible | 360/768/1280 | PASS (3/3) |
| Candidate card fits viewport | 360/768/1280 | PASS (3/3) |
| Activation employer_company_admin → /jobs | desktop-1280 | PASS |
| Activation candidate_user → /talent/profile | desktop-1280 | PASS |

**Total: 14/14 PASS**

Card widths: 334px (360vp) · 530px (768vp) · 554px (1280vp) — all within viewport.

## Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| type-check | PASS | 0 errors |
| build | PASS | register-redirect-policy-BWgjnEyh.js emitted |
| Responsive gate | 14/14 PASS | 360/768/1280 register notes + 2 activation smoke |

## Next Atomic Step

**PHASE 4 / Atomik-6:** Navigation — guest_public CTA links.

**Goal:** Giriş yapmayan kullanıcılara employer/candidate kayıt entry point'lerini
public navigation'da göster.

**Files to investigate / update:**
- `web/src/config/navigation-policy.ts` — public nav items ekleme
  - "İşveren Kaydı" → `/employer/register` (visibility_scope: "public")
  - "İş Arıyorum" → `/candidate/register` (visibility_scope: "public")
- `web/src/components/NavBar.tsx` veya AppLayout — public CTA render
- Responsive mobile collapse/hamburger davranışı test edilmeli

**Constraint:** Mevcut public nav yapısını bozmadan ekle. Nav governance
policy (PHASE 2 Atomik-4) üzerinden çalış.

## Open Risks

- `api/routers/onboarding_router.py` dirty (unrelated) — not touched.
- Backend register currently sets `is_active=True` — intentional, no email gate.
- Navigation guest_public CTAs — Atomik-6.

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 4 / Atomik-5: COMPLETE
Next: PHASE 4 / Atomik-6 — guest_public nav CTA links (employer/candidate register).
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
```

## SAFE TO RESUME
yes
