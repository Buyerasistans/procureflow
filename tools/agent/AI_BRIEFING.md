# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 2 / Atomik-5 - COMPLETE. PHASE 2 CLOSED.

## Executive Summary
PHASE 2 / Atomik-5 adds role-specific authenticated top-nav items for
`employer_recruiter` and `candidate_user` system roles. Both personas previously
received only `dashboard + quotes`. Policy extension in `navigation-policy.ts`
adds `/jobs` for employer_recruiter (3 nav items) and `/jobs + /talent/profile`
for candidate_user (4 nav items). Parity tests updated to document intentional
legacy divergence. All quality gates and responsive gate cleared.

PHASE 2 is now fully CLOSED. All 5 Atomik steps completed:
Atomik-1 runtime wiring, Atomik-2 legacy cleanup, Atomik-3 panel tab governance,
Atomik-4 public nav governance, Atomik-5 new role nav.

## Changes Made (Atomik-5)

**`web/src/config/navigation-policy.ts`**
- `top_nav.app.jobs.allowed_system_roles`: added `employer_recruiter`, `candidate_user`
  (was: `["talent_member", "employer_company_admin", "referral_partner", "super_admin"]`)
  (now: `["talent_member", "employer_company_admin", "employer_recruiter", "candidate_user", "referral_partner", "super_admin"]`)
- `top_nav.app.talent_profile.allowed_system_roles`: added `candidate_user`
  (was: `["talent_member", "referral_partner", "super_admin"]`)
  (now: `["talent_member", "candidate_user", "referral_partner", "super_admin"]`)

**`web/src/test/navigation-policy.test.ts`**
- `employer_recruiter` test: updated from `hasDivergence: false` to `true`;
  now asserts `/jobs` in `onlyInPolicy`, `/talent/profile` absent from policy routes.
- `candidate_user` test: updated from `hasDivergence: false` to `true`;
  now asserts `/jobs` and `/talent/profile` in `onlyInPolicy`.
- Test count: 26/26 passing (was 22; +4 employer_recruiter and candidate_user assertions).

**`docs/runbooks/nav-visibility-policy-shape.md`**
- Added PHASE 2 / Atomik-5 COMPLETE + PHASE 2 CLOSED banner.

**`tools/agent/AI_BRIEFING.md`**
- This file.

## Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| type-check | PASS | No errors |
| build | PASS | 1.40s |
| navigation-policy tests | PASS | 26/26 (was 22; +4 role persona tests) |
| responsive gate | PASS | See table below |

## Responsive Gate Results

| Persona | Viewport | Size | Nav items | Routes | Overflow | Click |
| --- | --- | --- | ---: | --- | --- | --- |
| employer_recruiter | mobile-375 | 375x812 | 3 | /dashboard,/quotes,/jobs | false | true |
| employer_recruiter | tablet-768 | 768x1024 | 3 | /dashboard,/quotes,/jobs | false | true |
| employer_recruiter | desktop-1366 | 1366x768 | 3 | /dashboard,/quotes,/jobs | false | true |
| candidate_user | mobile-375 | 375x812 | 4 | /dashboard,/quotes,/jobs,/talent/profile | false | true |
| candidate_user | tablet-768 | 768x1024 | 4 | /dashboard,/quotes,/jobs,/talent/profile | false | true |
| candidate_user | desktop-1366 | 1366x768 | 4 | /dashboard,/quotes,/jobs,/talent/profile | false | true |

All 6 scenarios PASS. Click smoke passed at all viewports (both personas).

Screenshots: `artifacts/atomik5-{employer_recruiter,candidate_user}-{mobile-375,tablet-768,desktop-1366}.png`
Report: `artifacts/atomik5-nav-gate-report.json`

Gate technique: Playwright session injection via `page.addInitScript` (sessionStorage)
+ LIFO-ordered `page.route` predicates (`/auth/me` highest priority, catch-all lowest).

## PHASE 2 CLOSURE SUMMARY

| Atomik | Commit | Description |
| --- | --- | --- |
| Atomik-1 | 00c2fe0 | Runtime wiring: AppLayout uses resolveVisibleNavItems |
| Atomik-2 | a1c6c66 | Legacy cleanup: routing.ts migrated, navigation.ts deprecated |
| Atomik-3 | d5e32b7 | Panel tab governance via policy resolver |
| Atomik-4 | fab2230 | Public nav governance via policy resolver |
| Atomik-5 | (this commit) | Role-specific nav for employer_recruiter + candidate_user |

## Open Risks

- `navigation.ts` still deprecated/test-only. Full deletion deferred (requires restructuring parity test).
- Mobile media queries still absent from AppLayout.css and NavBar.css (pre-existing gap).
- `employer_recruiter` and `candidate_user` have no demo DB accounts; gate uses Playwright session injection.
- EN locale routes for public nav are in locale map only, not in policy route fields.

## Next Atomic Step

**PHASE 3 / Atomik-1: Public jobs surface — inventory and route scaffolding**

Goal: Define and document the `/jobs` public surface. This is the job listing page
accessible to both authenticated and unauthenticated users (policy: `visibility_scope: "public"`
or open authenticated, TBD). Current state: `/jobs` route exists in nav policy for
employer_recruiter/candidate_user but the actual page/route may be a stub or missing.

Atomik-1 scope:
1. Inventory what exists at `/jobs` in the frontend (route definition, component, API calls).
2. Determine whether `/jobs` is a stub, a redirect, or a functional page.
3. Define the policy visibility target for the jobs surface:
   - Should unauthenticated users see a public job listing? (like `/teklifler` public surface)
   - Or is `/jobs` always authenticated?
4. Write the PHASE 3 program shape: which personas need what, what pages/components are in scope.
5. No code changes in Atomik-1 — pure inventory and goal definition.

Deliverable: `docs/runbooks/jobs-surface-phase3-plan.md` (or equivalent AI_BRIEFING entry)
with the inventory findings and confirmed PHASE 3 scope.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 2: COMPLETE AND CLOSED (5/5 Atomik steps done)
Last commit: feat(nav): add role-specific top nav items for recruiter and candidate
Next atomic step: PHASE 3 / Atomik-1 - public jobs surface inventory
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. Implement only one atomic step.
```

## SAFE TO RESUME
yes
