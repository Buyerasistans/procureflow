# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 2 / Atomik-2 — COMPLETE

## Executive Summary
PHASE 2 / Atomik-2 legacy cleanup is complete and committed. All runtime
consumers of `getVisibleNavItems` (from `navigation.ts`) have been migrated to
the typed policy resolver. `navigation.ts` is now `@deprecated` and only consumed
by the parity test suite. `auth-routing.test.tsx` stale mock removed and
assertions updated to match policy output. All gates passed.

## PHASE 2 Completion Record

| Atomik Step | Commit | Deliverable |
| --- | --- | --- |
| Atomik-1 | 00c2fe0 | Runtime wiring: AppLayout.tsx → policy resolver |
| Atomik-2 | (this commit) | Legacy cleanup: routing.ts → policy; nav.ts deprecated |

## Completed This Iteration

### Call-site Analysis Results

| Consumer | Type | Action |
| --- | --- | --- |
| `AppLayout.tsx` | runtime | Already migrated in Atomik-1 |
| `routing.ts` | runtime | Migrated to policy resolver in Atomik-2 |
| `getDefaultRouteForRole` | runtime (dead) | Removed — never called outside routing.ts |
| `navigation-adapter.ts` | test-only | Kept; jsdoc updated |
| `navigation-policy.test.ts` | test | Kept — parity test requires legacy comparison |
| `auth-routing.test.tsx` | test | Stale mock removed; assertions updated |

**Zero runtime consumers of `getVisibleNavItems` remain.**

### Changes Made

**`web/src/auth/routing.ts`**
- Removed `getDefaultRouteForRole` (dead export, never called)
- Removed imports of `getVisibleNavItems`, `hasPermissionForUser`
- `getDefaultRouteForUser` now uses `resolveVisibleNavItems` + `buildPolicyContext`
  instead of `getVisibleNavItems` + `hasPermissionForUser` double-filter
- `hasAdminWorkspaceHome` guard retained (behavior unchanged)
- Behavioral parity: resolveVisibleNavItems has 0 divergences from legacy
  (proven by 15 parity tests across 12 personas)

**`web/src/config/navigation.ts`**
- Added file-level `@deprecated` JSDoc with migration notes
- No code changes — kept intact for parity test suite

**`web/src/config/navigation-adapter.ts`**
- Updated JSDoc to reflect current state: both AppLayout.tsx and routing.ts
  now read from policy; this file is test-only

**`web/src/test/auth-routing.test.tsx`**
- Removed stale `vi.mock("../config/navigation", ...)` block (did nothing
  after AppLayout switched to policy in Atomik-1)
- Updated nav-link assertions from role-specific labels
  (Admin / Ortak Admin / Super Admin / Yonetici Paneli) to "Yönetim Alanı"
  (the policy item's fixed string label, uniform across all roles)
- All 7 tests now pass (2 permission-gate tests + 5 nav-visibility tests)

**`docs/runbooks/nav-visibility-policy-shape.md`**
- Added PHASE 2 / Atomik-2 COMPLETE banner

**`tools/agent/AI_BRIEFING.md`**
- This file

### Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| type-check | PASS | No errors |
| build | PASS | 1.18s |
| navigation-policy (parity) | PASS | 15/15 |
| auth-routing | PASS | 7/7 |

### Responsive Gate

**NOT REQUIRED for this step.** Rationale:

- `routing.ts` change is not a render path change — it determines redirect
  targets (which route to navigate to), not what is displayed on screen.
- The function `getDefaultRouteForUser` now uses `resolveVisibleNavItems` which
  has 0 parity divergences from the legacy `getVisibleNavItems` resolver.
- No HTML, CSS, or component tree was modified.
- No new visual surface was introduced.

Conclusion: no viewport behavior can differ from PHASE 2 / Atomik-1 state
(already responsive-gate-cleared).

## Open Risks / Blockers for PHASE 2 / Atomik-3

- `navigation.ts` is deprecated but not deleted: depends on
  `navigation-policy.test.ts` which imports `getVisibleNavItems` directly
  for the parity comparison. To fully delete `navigation.ts`, the parity
  test would need to be restructured or removed (scope: Atomik-3+).
- `navigation-adapter.ts` is test-only; `compareAuthenticatedTopNav` has no
  remaining callers outside the parity test. Could be inlined into the test.
- Mobile layout gap (pre-existing): AppLayout.css has no media queries. Nav
  chips not pointer-clickable at 375px due to action area overlay. Not
  introduced by this program; future scope.
- Panel tabs, quick links, page CTAs not yet modeled (Atomik-3 scope).
- Public nav hardcoded in NavBar.tsx — Atomik-4 scope.
- employer_recruiter and candidate_user have no dedicated nav items — Atomik-5.

## Product Principles
- UI visibility must be policy/config driven, not scattered hardcoded checks.
- Responsive behavior is a release gate for all UI steps.
- Route slugs, API field keys, DB columns, enums, and technical identifiers
  must remain stable unless a step explicitly owns a migration/contract change.

## Next Atomic Step

**PHASE 2 / Atomik-3:** Panel tab governance — model `panel_tab` placement
items in `navigation-policy.ts`. Pre-work: inventory all panel tab items
and their current visibility logic (likely in AdminPage.tsx or secondary tab
configs). Responsive gate required before commit.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 2 / Atomik-2: COMPLETE (legacy cleanup committed)
Next atomic step: PHASE 2 / Atomik-3 — panel tab governance
Pre-work: inventory panel_tab items in AdminPage.tsx / secondary tab configs.
Responsive gate required. Keep unrelated dirty worktree files untouched.
```

## SAFE TO RESUME
yes
