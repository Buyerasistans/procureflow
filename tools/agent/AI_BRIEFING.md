# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 1 - Top nav governance foundation / Atomik-2

## Executive Summary
This checkpoint adds a typed frontend navigation visibility policy module for authenticated top navigation while preserving runtime parity.

No runtime render path changed in this checkpoint. Existing `web/src/config/navigation.ts` remains the active source for UI output; the new policy module is isolated and covered by parity tests.

## Completed This Iteration
- Added `web/src/config/navigation-policy.ts` with typed policy fields, context shape, visibility evaluation, and visible-item resolver.
- Added a current authenticated top-nav policy fixture that mirrors the existing route set without being wired into runtime rendering.
- Added parity tests comparing the new policy resolver against the existing `getVisibleNavItems` + `hasPermissionForUser` path for `super_admin`, `platform_support`, and a non-privileged authenticated user.
- Updated `docs/runbooks/nav-visibility-policy-shape.md` with the module path, evaluation flow, and parity guarantee.
- Updated this briefing so the next assistant can resume from PHASE 1 / Atomik-3 without relying on prior chat context.
- Updated local `tools/agent/SESSION_STATE.json`; it is gitignored and must not be committed.

## Files Changed
- `docs/runbooks/nav-visibility-policy-shape.md`
- `web/src/config/navigation-policy.ts`
- `web/src/test/navigation-policy.test.ts`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Required For This Checkpoint
- `npm run type-check`
- `npm run build`
- `npm run test:run -- navigation-policy`
- Document heading verification for the policy shape and this briefing.
- Responsive validation is parity-only for PHASE 1 / Atomik-2; no UI render path changed.

## Working Tree Note
Before this checkpoint, the repo already had unrelated modified/untracked files in API, admin UI, and local agent folders. Do not stage or revert them as part of this program unless a later atomic step explicitly owns them.

## Inventory Findings
- Authenticated top nav is centralized in `web/src/config/navigation.ts`, but item visibility still uses embedded `visibleFor` callbacks.
- `web/src/components/AppLayout.tsx` renders authenticated nav after `hasPermissionForUser` filtering and has local label mapping.
- Public top nav is hardcoded in `web/src/components/NavBar.tsx`.
- Admin tabs are mixed: `web/src/admin/workspace-panels.ts` and `api/routers/admin.py` provide workspace panel defaults, while `web/src/pages/AdminPage.tsx` constructs and filters runtime tab configs.
- Quick links are partially config-driven through workspace panel profiles, but page CTAs and focus-banner actions are still component-local.
- Backend role/permission helpers exist in `api/core/authz.py`; navigation visibility is not yet a backend contract.

## Technical Findings
- The typed policy module can represent the current top-nav item set as ordered policy rows with placement, scope, allowlists, required permissions, and responsive behavior.
- Runtime parity is currently proven through route-list equality, not visual rendering, because this step intentionally does not wire the new module into `AppLayout`.
- Future wiring must preserve existing `visibleFor` edge cases, especially channel/business-role exclusions, before the policy module becomes the active source.

## Product Principles
- UI visibility must be policy/config driven, not scattered hardcoded checks.
- Top nav, panel tabs, quick links, and page CTAs must be manageable from governance/panel design surfaces where appropriate.
- Responsive behavior is a release gate for all UI steps.
- Route slugs, API field keys, DB columns, enums, and technical identifiers must remain stable unless a step explicitly owns a migration/contract change.

## Role Scope
- `super_admin`
- `platform_operator`
- `platform_support`
- `tenant_admin`
- `employer_admin`
- `employer_recruiter`
- `candidate_user`
- `guest_public`

## Open Risks / Blockers
- Existing unrelated dirty worktree entries must be kept separate from this program.
- Current nav visibility sources are mixed across config, layout, admin panel data, and role checks.
- New program roles are not fully represented in current frontend role vocabulary.
- Public jobs expansion may overlap with the existing talent network; role and onboarding separation must be explicit before runtime changes.
- The new top-nav fixture mirrors current behavior for covered personas; broader role coverage should be added before runtime adoption.

## Next Atomic Step
PHASE 1 / Atomik-3: add a non-invasive adapter/proof layer for authenticated top-nav that can compare current `navigation.ts` output with policy output in development/tests, expanding parity coverage for channel, supplier, tenant-admin, employer, and candidate personas without changing runtime UI.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 1 / Atomik-2 complete after checkpoint commit
Next atomic step: PHASE 1 / Atomik-3
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first. Keep unrelated dirty worktree files untouched. Implement only one atomic step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
