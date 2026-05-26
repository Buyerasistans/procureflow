# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 1 - Top nav governance foundation / Atomik-1

## Executive Summary
This checkpoint inventories current navigation sources and defines the minimal visibility policy shape for future governance work.

No runtime behavior changed in this checkpoint. The work is documentation and handoff state only.

## Completed This Iteration
- Added a file-by-file navigation source inventory.
- Added the minimal navigation visibility policy entity shape, example policy rows, fallback policy, and migration analysis.
- Updated this briefing so the next assistant can resume from PHASE 1 / Atomik-2 without relying on prior chat context.
- Updated local `tools/agent/SESSION_STATE.json`; it is gitignored and must not be committed.

## Files Changed
- `docs/runbooks/nav-source-inventory.md`
- `docs/runbooks/nav-visibility-policy-shape.md`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Required For This Checkpoint
- `npm run type-check`
- `npm run build`
- Document heading verification for the inventory, policy shape, and this briefing.
- Responsive validation is documentation-only for PHASE 1 / Atomik-1; no UI changed.

## Working Tree Note
Before this checkpoint, the repo already had unrelated modified/untracked files in API, admin UI, and local agent folders. Do not stage or revert them as part of this program unless a later atomic step explicitly owns them.

## Inventory Findings
- Authenticated top nav is centralized in `web/src/config/navigation.ts`, but item visibility still uses embedded `visibleFor` callbacks.
- `web/src/components/AppLayout.tsx` renders authenticated nav after `hasPermissionForUser` filtering and has local label mapping.
- Public top nav is hardcoded in `web/src/components/NavBar.tsx`.
- Admin tabs are mixed: `web/src/admin/workspace-panels.ts` and `api/routers/admin.py` provide workspace panel defaults, while `web/src/pages/AdminPage.tsx` constructs and filters runtime tab configs.
- Quick links are partially config-driven through workspace panel profiles, but page CTAs and focus-banner actions are still component-local.
- Backend role/permission helpers exist in `api/core/authz.py`; navigation visibility is not yet a backend contract.

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

## Next Atomic Step
PHASE 1 / Atomik-2: add a typed frontend navigation visibility policy module that mirrors current authenticated top-nav behavior without changing rendered output.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 1 / Atomik-1 complete after checkpoint commit
Next atomic step: PHASE 1 / Atomik-2
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first. Keep unrelated dirty worktree files untouched. Implement only one atomic step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
