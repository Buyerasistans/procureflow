# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 1 - Top nav governance foundation / Atomik-5

## Executive Summary
This checkpoint closes the supplier persona `/admin` parity gap.
Root cause: the `/admin` fixture included `"supplier_user"` in
`allowed_system_roles` because `canAccessWorkspacePanel` returns true for that
role. Legacy `/admin` nav item uses `hasAdminWorkspaceHome` as its `visibleFor`
guard, which excludes `supplier_user`. Fix: remove `"supplier_user"` from
`/admin` allowed_system_roles. Supplier accounts access their workspace via
`/supplier/workspace`, not `/admin` top-nav.

No runtime render path changed.

## Completed This Iteration

- Removed `"supplier_user"` from `/admin` fixture `allowed_system_roles` in
  `navigation-policy.ts`.
- Expanded `navigation-policy.test.ts` with 4 explicit supplier scenarios
  (supplier_admin + null, supplier_admin + supplier_user,
  supplier_user + null, supplier_user + supplier_user). All assert
  `hasDivergence: false` and `inBoth: ["/dashboard", "/quotes"]`.
  Previous supplier tests updated with `inBoth` assertion for completeness.
- Updated `nav-visibility-policy-shape.md`: Atomik-5 section with root cause,
  fix rationale, supplier role payload contract table, fallback behavior note.
- Updated this briefing and local `tools/agent/SESSION_STATE.json`.

## Files Changed

- `web/src/config/navigation-policy.ts`
- `web/src/test/navigation-policy.test.ts`
- `docs/runbooks/nav-visibility-policy-shape.md`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Run + Results

- `npm run type-check` — passed
- `npm run build` — passed (~1.4s)
- `npm run test:run -- navigation-policy` — passed (15 tests, 0 failures)

### Parity Summary (all personas)

| Persona | system_role | Legacy routes | Policy routes | Divergence |
|---|---|---|---|---|
| super_admin | super_admin | all 9 | all 9 | none |
| platform_support | platform_support | 7 routes | 7 routes | none |
| tenant_admin | tenant_admin | 5 routes | 5 routes | none |
| employer_company_admin | employer_company_admin | dashboard, quotes, jobs | same | none |
| employer_recruiter | employer_recruiter | dashboard, quotes | same | none |
| candidate_user | candidate_user | dashboard, quotes | same | none |
| channel_owner | tenant_member | dashboard, admin | same | none (Atomik-4) |
| channel_agent | tenant_member | dashboard, admin | same | none (Atomik-4) |
| supplier_admin | null | dashboard, quotes | same | none |
| supplier_admin | supplier_user | dashboard, quotes | same | none (Atomik-5) |
| supplier_user | null | dashboard, quotes | same | none |
| supplier_user | supplier_user | dashboard, quotes | same | none (Atomik-5) |

**All 15 test scenarios: hasDivergence: false** (except channel personas which
document their gap as expected divergence — now resolved to false in Atomik-4).

## Responsive Validation
Not applicable — no UI render path changed in this step.

## Working Tree Note
Unrelated dirty/untracked files present before this checkpoint were not touched.

## Root Cause Note

`canAccessWorkspacePanel` and `hasAdminWorkspaceHome` are distinct functions:

- `canAccessWorkspacePanel` → governs `view:workspace-panel` permission.
  Returns true for supplier_user system_role.
- `hasAdminWorkspaceHome` → governs top-nav `/admin` visibleFor.
  Does NOT include supplier_user; supplier workspace is a different URL.

The policy fixture must mirror `hasAdminWorkspaceHome` for the `/admin`
top-nav item, not `canAccessWorkspacePanel`.

## PHASE 1 Closure Assessment

All authenticated top-nav personas are now at parity with no outstanding
divergences. The policy module (`navigation-policy.ts`) correctly mirrors
legacy behavior for all known role combinations.

**PHASE 1 is ready to close** after one optional cleanup step:

- Document the remaining open items as PHASE 2 scope (panel tabs, quick links,
  page CTAs, runtime wiring) and write the PHASE 1 closure note.

Alternatively, the next atomik step can be the PHASE 1 closure commit itself
(no code change, docs only).

## Open Risks / Blockers

- Panel tabs, quick links, and page CTAs not yet covered by policy module
  (PHASE 2 scope).
- New program roles (employer_recruiter, candidate_user) not yet in legacy
  `visibleFor` callbacks — their nav is generic authenticated. Not a
  divergence risk; their current routes match policy.
- Public nav items not yet modeled (PHASE 2 scope).
- Runtime wiring (replacing `navigation.ts` with policy resolver in AppLayout)
  not done — requires explicit step with responsive validation gate.

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

**PHASE 1 / Atomik-6 (closure):** Write PHASE 1 closure document. No code
changes. Document:
- All personas at parity (table from this briefing)
- What the policy module covers and does not cover
- PHASE 2 scope definition (panel tabs, quick links, public nav, runtime wiring)
- Prerequisites for runtime wiring (responsive gate, visibleFor → policy
  migration plan)

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 1 / Atomik-5 complete — commit to be made
Next atomic step: PHASE 1 / Atomik-6 (closure doc, no code changes)
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json
first. Keep unrelated dirty worktree files untouched. Implement only one atomic
step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
