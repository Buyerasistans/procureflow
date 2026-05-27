# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 2 / Atomik-1 — COMPLETE

## Executive Summary
PHASE 2 / Atomik-1 runtime wiring is complete and committed. `AppLayout.tsx`
authenticated top-nav now reads from `resolveVisibleNavItems` + `buildPolicyContext`
(the typed policy module). The legacy `getVisibleNavItems` call is fully removed
from the runtime render path. All gates passed: type-check, build, 15 parity tests,
and real Playwright/Chromium responsive gate at 3 viewports × 2 personas.

## PHASE 1 Completion Record

| Atomik Step | Commit | Deliverable |
| --- | --- | --- |
| PHASE 0 / Atomik-1 | ba02ed4 | Program ADR + phased backlog |
| PHASE 1 / Atomik-1 | 241f03a | Nav inventory + minimal policy shape |
| PHASE 1 / Atomik-2 | 4073a0a | Typed navigation-policy.ts + 3 parity tests |
| PHASE 1 / Atomik-3 | 43e7ac4 | Adapter + 10-persona parity coverage |
| PHASE 1 / Atomik-4 | d770680 | excluded_tenant_roles + channel parity resolved |
| PHASE 1 / Atomik-5 | 6ec1a67 | Supplier system_role parity resolved |
| PHASE 1 / Atomik-6 | 34a1de7 | Closure doc + runbook cross-link |

## PHASE 2 / Atomik-1 Completion Record

### Technical Changes (this commit)

**`web/src/components/AppLayout.tsx`**
- Removed: `import { getVisibleNavItems } from "../config/navigation"` 
- Removed: `hasPermissionForUser` from permissions imports
- Added: `resolveVisibleNavItems`, `buildPolicyContext`, `AUTHENTICATED_TOP_NAV_POLICY_ITEMS`
  from `navigation-policy`
- `visibleItems` changed from:
  `getVisibleNavItems(user).filter((item) => hasPermissionForUser(user, item.permission))`
  to:
  `resolveVisibleNavItems(AUTHENTICATED_TOP_NAV_POLICY_ITEMS, buildPolicyContext(user))`
- Render loop: `item.to` → `item.route`; `typeof item.label === "function"` guard removed
  (policy items have string labels only)

**`web/src/config/navigation-adapter.ts`**
- Removed duplicate `buildPolicyContext` definition (was a copy of policy module's version)
- Now re-exports `buildPolicyContext` from `navigation-policy.ts`
- Updated JSDoc: `NavComparisonResult.legacy` — removed stale "runtime source of truth"
  note; now says "dev/test reference only; runtime now uses policy"
- Note: `compareAuthenticatedTopNav` is dev/test only; not wired into any render path

**`web/src/config/navigation-policy.ts`**
- Added `import { hasPermissionForUser }` + `import type { AuthUser }` (for buildPolicyContext)
- Added `KNOWN_PERMISSIONS` constant
- Added `buildPolicyContext(user: AuthUser): NavigationVisibilityContext` as canonical export

**`docs/runbooks/nav-visibility-policy-shape.md`**
- Added PHASE 2 / Atomik-1 COMPLETE banner with responsive gate evidence note

### Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| type-check | PASS | `npm.cmd run type-check` — no errors |
| build | PASS | `npm.cmd run build` — 1.40s |
| parity tests | PASS | 15/15 tests, all personas |
| responsive gate | PASS | See table below |

### Responsive Gate Results (real Playwright/Chromium)

| Persona | Viewport | Nav Items | Overflow | Click | Screenshot |
| --- | --- | --- | --- | --- | --- |
| tenant_admin | 375x812 | 2 | false | blocked (pre-existing) | artifacts/nav-tenant_admin-mobile-375.png |
| tenant_admin | 768x1024 | 2 | false | ✅ /admin | artifacts/nav-tenant_admin-tablet-768.png |
| tenant_admin | 1366x768 | 2 | false | ✅ /admin | artifacts/nav-tenant_admin-desktop-1366.png |
| platform_operator | 375x812 | 7 | false | blocked (pre-existing) | artifacts/nav-platform_operator-mobile-375.png |
| platform_operator | 768x1024 | 7 | false | ✅ /dashboard | artifacts/nav-platform_operator-tablet-768.png |
| platform_operator | 1366x768 | 7 | false | ✅ /dashboard | artifacts/nav-platform_operator-desktop-1366.png |

**Mobile click note:** At 375px, action buttons (user/mail) physically overlay nav chips
due to pre-existing absence of responsive media queries in `AppLayout.css`.
Nav chips ARE present in DOM and visible (`getBoundingClientRect().width > 0`).
This is pre-existing behavior; our change introduces no regression.

### Runtime Parity Smoke Results

| Persona | Nav Routes (in order) |
| --- | --- |
| tenant_admin | /admin, /discovery-lab |
| platform_operator | /dashboard, /quotes, /admin, /discovery-lab, /reports, /admin/payout-requests, /admin/talent-ecosystem |

Nav order matches policy `order` field: 10, 20, 30, 40, 50, 80, 90.
No spurious items; no missing items.

## Files Changed (this commit)

- `web/src/components/AppLayout.tsx`
- `web/src/config/navigation-adapter.ts`
- `web/src/config/navigation-policy.ts`
- `docs/runbooks/nav-visibility-policy-shape.md`
- `tools/agent/AI_BRIEFING.md`

## NOT Committed (local only)
- `tools/agent/SESSION_STATE.json` — gitignored, local state only
- `tools/responsive_gate.mjs` — ad-hoc Playwright script, not committed
- `artifacts/` — screenshots, not committed

## Runtime Change Status
**ACTIVE.** AppLayout.tsx runtime authenticated top-nav now reads from policy
resolver. Legacy `getVisibleNavItems` is no longer called in the render path.

## Open Risks / Blockers for PHASE 2 / Atomik-2

- Mobile layout gap (pre-existing): `AppLayout.css` has no media queries.
  Nav chips not pointer-clickable at 375px due to action area overlay.
  This is a PHASE 2 / Atomik-2 or dedicated mobile fix scope item.
- `navigation.ts` legacy `visibleFor` callbacks still exist (not yet deleted).
  PHASE 2 / Atomik-2 owns their removal.
- Panel tabs, quick links, page CTAs not yet modeled (later PHASE 2 steps).
- Public nav hardcoded in `NavBar.tsx` — separate PHASE 2 step.
- `employer_recruiter` and `candidate_user` have no dedicated nav items yet.

## Product Principles
- UI visibility must be policy/config driven, not scattered hardcoded checks.
- Top nav, panel tabs, quick links, and page CTAs must be manageable from
  governance/panel design surfaces where appropriate.
- Responsive behavior is a release gate for all UI steps.
- Route slugs, API field keys, DB columns, enums, and technical identifiers must
  remain stable unless a step explicitly owns a migration/contract change.

## Role Scope
- `super_admin`
- `platform_operator`
- `platform_support`
- `tenant_admin`
- `employer_admin` (system_role: `employer_company_admin`)
- `employer_recruiter`
- `candidate_user`
- `guest_public`

## Next Atomic Step

**PHASE 2 / Atomik-2:** Legacy cleanup — remove `visibleFor` callbacks from
`navigation.ts`. Evaluate whether `navigation-adapter.ts` and `navigation.ts`
can be fully deleted or if they have remaining call sites outside tests.
Responsive gate (PC + tablet + mobile) required before commit.
Pre-work: check for any remaining consumers of `getVisibleNavItems` / `NavItem`.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 2 / Atomik-1: COMPLETE (runtime wiring committed)
Next atomic step: PHASE 2 / Atomik-2 — legacy cleanup
Pre-work: grep getVisibleNavItems and NavItem consumers outside test files.
Responsive gate required. Keep unrelated dirty worktree files untouched.
```

## SAFE TO RESUME
yes
