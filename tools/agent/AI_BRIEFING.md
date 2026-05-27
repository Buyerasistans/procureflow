# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 1 - Top nav governance foundation / Atomik-4

## Executive Summary
This checkpoint closes the channel_owner / channel_agent `/quotes` parity gap
by adding an explicit `excluded_tenant_roles` deny-list field to the policy
model. No runtime render path changed.

`isPolicyItemVisible` now evaluates exclusion before allow-lists. The `/quotes`
fixture item carries `excluded_tenant_roles: ["channel_owner", "channel_agent",
"is_ortagi"]`, mirroring the existing `visibleFor` callback in `navigation.ts`.

Parity adapter tests for both channel personas now assert `hasDivergence: false`.
All 13 tests pass.

## Completed This Iteration

- Added `excluded_tenant_roles?: string[]` to `NavigationVisibilityPolicyItem`
  type in `navigation-policy.ts`.
- Added `isTenantRoleExcluded(item, context)` helper — normalizes and checks
  `context.tenant_role` and `context.business_role` against the deny-list.
- Updated `isPolicyItemVisible` to call exclusion check after scope, before
  allow-lists.
- Updated `/quotes` fixture item with
  `excluded_tenant_roles: ["channel_owner", "channel_agent", "is_ortagi"]`.
- Updated `navigation-policy.test.ts`: channel_owner and channel_agent tests
  now assert `hasDivergence: false` and `inBoth: ["/dashboard", "/admin"]`.
- Updated `docs/runbooks/nav-visibility-policy-shape.md`: role vocabulary table
  corrected, Known Divergences marked RESOLVED, Atomik-4 section added with
  rationale, exclusion priority rule, and evaluation flow updated.
- Updated this briefing; local `tools/agent/SESSION_STATE.json` updated.

## Files Changed

- `web/src/config/navigation-policy.ts`
- `web/src/test/navigation-policy.test.ts`
- `docs/runbooks/nav-visibility-policy-shape.md`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Run + Results

- `npm run type-check` — passed
- `npm run build` — passed (✓ built in ~1.2s)
- `npm run test:run -- navigation-policy` — passed (13 tests, 0 failures)
  - channel_owner: `hasDivergence: false`, `inBoth: ["/dashboard", "/admin"]`
  - channel_agent: `hasDivergence: false`, `inBoth: ["/dashboard", "/admin"]`
  - All prior regression tests continue to pass

## Responsive Validation
Not applicable — no UI render path changed in this step.

## Working Tree Note
Unrelated dirty/untracked files present before this checkpoint were not touched:
`api/routers/*, api/services/*, web/src/components/admin/CampaignsTab.*,
web/src/pages/AdminPage.tsx, web/src/pages/admin/{OnboardingStudioTab,
PackagesTab, PlatformOperationsTab*, adminSecondaryTabs}.tsx,
web/src/test/admin-page-tenant-governance.test.tsx`, and untracked `.claude/,
Obsidian_Kasa/, tools/agent/STATE.md, tools/agent/prompts/, PricingTab.css`.

## Exclusion Design Note

`excluded_tenant_roles` is an explicit deny-list. It wins over allow-lists.
Evaluation order: `is_enabled` → scope → **exclusion** → allow-lists →
permissions.

An unknown role not listed in `excluded_tenant_roles` still passes the exclusion
gate; the allow-list gate (or empty allow-list = no restriction) then determines
visibility. Least-privilege outcome is preserved.

`is_ortagi` is included in the deny-list (alongside channel_owner / channel_agent)
to match the legacy `visibleFor` callback exactly. It is not a typed `Role` in
`permissions.ts` but the deny-list is `string[]` so it resolves correctly.

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

## Open Risks / Blockers

- Supplier personas: `system_role: "supplier_user"` vs `null` inconsistency
  between legacy and policy path. Supplier personas must use `system_role: null`
  to match legacy behavior; with `system_role: "supplier_user"` the `/admin`
  workspace-panel route appears in policy but not legacy. Must align before
  runtime wiring.
- New program roles (employer_recruiter, candidate_user) not yet in `visibleFor`
  callbacks; nav is identical to generic authenticated for now.
- Public jobs expansion may overlap with existing talent network.
- Panel tabs, quick links, and page CTAs not yet covered by policy module.

## Next Atomic Step

PHASE 1 / Atomik-5: Evaluate whether PHASE 1 is complete (all authenticated
top-nav personas at parity with no outstanding divergences) and either:
A) Write a final PHASE 1 closure document + plan PHASE 2 scope; or
B) Identify the next remaining divergence (supplier system_role inconsistency)
   and resolve it in the policy module.

Recommended: (B) resolve supplier system_role inconsistency next, then close
PHASE 1.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 1 / Atomik-4 complete after checkpoint commit
Next atomic step: PHASE 1 / Atomik-5
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json
first. Keep unrelated dirty worktree files untouched. Implement only one atomic
step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
