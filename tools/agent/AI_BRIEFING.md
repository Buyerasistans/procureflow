# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 2 / Atomik-3 - COMPLETE

## Executive Summary
PHASE 2 / Atomik-3 extends the navigation policy model from authenticated top-nav to admin panel tabs. The admin tab render path now keeps the existing tab metadata/order from `AdminPage.tsx`, then applies a typed `panel_tab` policy resolver before rendering.

Runtime parity goal is preserved: labels, tab slugs, order, workspace-profile `allowed_tabs` behavior, and content rendering remain unchanged.

## Completed This Iteration
- Added `PanelTabVisibilityFlags`, `buildAdminPanelTabPolicyItems`, and `resolveVisiblePanelTabKeys` in `web/src/config/navigation-policy.ts`.
- Added `placement: "panel_tab"` policy rows for current admin tabs.
- Wired `AdminPage.tsx` to filter the already-built tab list through the policy resolver.
- Preserved workspace profile filtering after policy resolution.
- Added a minimal admin tab-row responsive containment fix so the new render path can be smoke-tested at mobile width without document-level horizontal overflow.
- Added panel tab policy tests for:
  - `super_admin`
  - `tenant_admin`
  - role-management-only persona
- Kept top-nav parity tests intact.
- Updated `docs/runbooks/nav-visibility-policy-shape.md` with panel tab inventory, policy shape, and PHASE 2 / Atomik-3 notes.
- Updated local `tools/agent/SESSION_STATE.json`; it is gitignored and must not be committed.

## Files Changed
- `web/src/config/navigation-policy.ts`
- `web/src/pages/AdminPage.tsx`
- `web/src/styles/pages/AdminPage.css`
- `web/src/test/navigation-policy.test.ts`
- `docs/runbooks/nav-visibility-policy-shape.md`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Panel Tab Inventory Summary

| Group | Tabs | Visibility source now |
| --- | --- | --- |
| core | `panel_home`, `companies`, `roles`, `departments`, `personnel`, `projects`, `approvals`, `reports` | `panel_tab` policy flags |
| platform | `platform_operations`, `discovery_lab_operations`, `onboarding_studio`, `tenant_governance`, `platform_analytics`, `platform_suppliers`, `public_pricing`, `campaigns`, `commission_admin`, `support_tickets` | `can_view_platform_governance` policy flag |
| packages | `packages` | platform governance + packages policy flags |
| deployment | `deployment` | platform governance + deployment policy flags |
| settings | `settings` | platform settings or workspace settings links policy flags |
| panel designer | `panel_designer` | super admin or self-customization policy flag |
| role management only | `roles` | role-management-only policy flag |

## Test Status
- `npm.cmd run test:run -- navigation-policy` from `web/`: passed, 18/18.
- `npm.cmd run test:run -- admin-page-tenant-governance -t "role-management-only|platform support icin ayri platform operasyonlari sekmesini gosterir"` from `web/`: passed, 3/3 targeted, 53 skipped.
- `npm.cmd run type-check` from `web/`: passed.
- `npm.cmd run build` from `web/`: passed.
- `node artifacts\panel-tab-smoke.mjs`: passed before cleanup for 375/768/1366; visible panel tab set rendered, document overflow was false, and `platform_operations` click/content smoke passed.

## Working Tree Note
Before this checkpoint, the repo already had unrelated modified/untracked files in API, admin UI, and local folders. This step touched only the files listed above. Do not stage or revert unrelated files.

## Open Risks / Blockers
- `AdminPage.tsx` already had unrelated local modifications before Atomik-3. The policy filter was added surgically around tab visibility only.
- Panel tab policy currently preserves existing frontend-derived booleans; backend-governed persistence is not introduced.
- Workspace-profile `allowed_tabs` remains a second-stage filter by design.
- The full `admin-page-tenant-governance` suite is not claimed as fully clean in this checkpoint because pre-existing local dirty changes in adjacent admin tabs are outside this atomik scope; targeted panel visibility coverage passed.

## Product Principles
- UI visibility must be policy/config driven, not scattered hardcoded checks.
- Responsive behavior is a release gate for all UI render path steps.
- Route slugs, API field keys, DB columns, enums, and technical identifiers must remain stable unless a step explicitly owns a migration/contract change.

## Next Atomic Step
PHASE 2 / Atomik-4: public nav governance. Model `NavBar.tsx` public navigation items in policy with a parity-first adapter, then prepare controlled runtime adoption without changing public route labels, order, or responsive behavior.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 2 / Atomik-3: COMPLETE after checkpoint commit
Next atomic step: PHASE 2 / Atomik-4 - public nav governance
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first. Keep unrelated dirty worktree files untouched. Implement only one atomic step and commit it with AI_BRIEFING.md. SESSION_STATE.json remains local/gitignored.
```

## SAFE TO RESUME
yes
