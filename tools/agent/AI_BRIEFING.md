# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 2 / Atomik-4 - COMPLETE

## Executive Summary
PHASE 2 / Atomik-4 extends the navigation policy to public nav. `NavBar.tsx`
previously built its link list from a hardcoded, locale-split array. It now
resolves items through `resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, PUBLIC_NAV_CONTEXT)`,
then maps each policy key to a locale-specific `{href, label}` pair via
`PUBLIC_NAV_LOCALE_MAP`. Parity is preserved: same 5 items, same order, same
labels and routes for both TR and EN locales. Policy now controls which
public nav items are enabled and in what order.

## Inventory: Public Nav Items (NavBar.tsx)

| key | TR route | EN route | order | scope |
| --- | --- | --- | ---: | --- |
| `top_nav.public.home` | `/` | `/` | 10 | public |
| `top_nav.public.offers` | `/teklifler` | `/offers` | 20 | public |
| `top_nav.public.suppliers` | `/tedarikciler` | `/suppliers` | 30 | public |
| `top_nav.public.strategic` | `/stratejik-ortaklik` | `/strategic-partner` | 40 | public |
| `top_nav.public.partner_program` | `/is-ortagi-programi` | `/partner-program` | 50 | public |

All items: `visibility_scope: "public"`, `is_enabled: true`, no role/permission restrictions.
`PUBLIC_NAV_CONTEXT`: `{ is_authenticated: false, permissions: [], scope: "public" }`.

## Completed This Iteration

### Changes Made

**`web/src/config/navigation-policy.ts`**
- Added `PUBLIC_NAV_CONTEXT: NavigationVisibilityContext` constant (exported).
- Added `PUBLIC_TOP_NAV_POLICY_ITEMS: NavigationVisibilityPolicyItem[]` array (5 items, exported).

**`web/src/components/NavBar.tsx`**
- Added imports: `PUBLIC_TOP_NAV_POLICY_ITEMS`, `PUBLIC_NAV_CONTEXT`, `resolveVisibleNavItems` from `navigation-policy`.
- Replaced hardcoded locale-split `links` array with:
  - `PUBLIC_NAV_LOCALE_MAP` — maps policy key → locale-specific `{href, label}` (computed inside component, locale-aware).
  - `links = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, PUBLIC_NAV_CONTEXT).map(item => PUBLIC_NAV_LOCALE_MAP[item.key]).filter(Boolean)`.
- Render loop unchanged — still `links.map((l) => <a href={l.href}>…</a>)`.

**`web/src/test/navigation-policy.test.ts`**
- Added imports: `PUBLIC_TOP_NAV_POLICY_ITEMS`, `PUBLIC_NAV_CONTEXT`.
- Added `describe("public nav policy", …)` block with 4 tests:
  1. Unauthenticated context → all 5 items visible (key order check).
  2. TR canonical route order parity check.
  3. Authenticated tenant_member context → all 5 items still visible.
  4. super_admin context → all 5 items visible.

**`docs/runbooks/nav-visibility-policy-shape.md`**
- Added PHASE 2 / Atomik-4 COMPLETE banner.

**`tools/agent/AI_BRIEFING.md`**
- This file.

## Gates Passed

| Gate | Result | Detail |
| --- | --- | --- |
| type-check | PASS | No errors |
| build | PASS | 944ms |
| navigation-policy tests | PASS | 22/22 (was 18; +4 public nav tests) |
| responsive gate | PASS | See table below |

## Responsive Gate Results

| Viewport | Size | Nav links | All present | Overflow | Click |
| --- | --- | ---: | --- | --- | --- |
| mobile-375 | 375x812 | 5 | true | false | false (pre-existing) |
| tablet-768 | 768x1024 | 5 | true | false | true |
| desktop-1366 | 1366x768 | 5 | true | false | true |

**Mobile 375 click failure** is pre-existing: NavBar has no `@media` queries and
the CTA / action area overlaps nav links at 375px (same gap documented in Atomik-1
for AppLayout). Not a regression. All 5 links are present and visible in the DOM.

Screenshots: `artifacts/public-nav-{mobile-375,tablet-768,desktop-1366}.png`
Report: `artifacts/public-nav-gate-report.json`

## Open Risks / Blockers for PHASE 2 / Atomik-5

- `PUBLIC_NAV_LOCALE_MAP` is computed inside the component on every render.
  This is intentional — it depends on `copy` (translation hook output) which is
  reactive. No memoization added (scope: future cleanup if needed).
- EN locale routes (`/offers`, `/suppliers`, etc.) are NOT in policy `route` fields.
  Policy uses TR canonical routes. EN routes are in the locale map only. If a future
  step needs EN route governance, the map approach must be extended or policy items
  duplicated. This is noted but out of scope for this program.
- Mobile 375 click gap (pre-existing): NavBar.css / AppLayout.css both lack
  `@media` queries. Future scope.
- `navigation.ts` still deprecated/test-only. Full deletion deferred.
- `employer_recruiter` and `candidate_user` have no dedicated nav items — Atomik-5.

## Product Principles
- UI visibility must be policy/config driven, not scattered hardcoded checks.
- Responsive behavior is a release gate for all UI render path steps.
- Route slugs, API field keys, DB columns, enums, and technical identifiers
  must remain stable unless a step explicitly owns a migration/contract change.

## Next Atomic Step

**PHASE 2 / Atomik-5:** New role nav — add dedicated authenticated top-nav
items for `employer_recruiter` and `candidate_user` system roles. These personas
currently receive only `dashboard + quotes` (parity proven). Atomik-5 adds
role-appropriate items (e.g. a Jobs or Talent section link) to the policy and
surfaces them in AppLayout via the existing `resolveVisibleNavItems` call.
Responsive gate required.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 2 / Atomik-4: COMPLETE (public navbar items governed via policy resolver)
Next atomic step: PHASE 2 / Atomik-5 - new role nav for employer_recruiter and candidate_user
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty worktree files untouched. Implement only one atomic step.
```

## SAFE TO RESUME
yes
