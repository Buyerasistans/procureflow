# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 1 - Top nav governance foundation / Atomik-3

## Executive Summary
This checkpoint adds a non-invasive adapter/proof layer for authenticated top-nav comparison and expands parity test coverage to 10 role personas. No runtime render path changed.

`navigation-adapter.ts` provides `compareAuthenticatedTopNav(user)` which runs both the legacy resolver and the policy resolver and returns a diff result. It is not wired into any render path. Tests document two known divergences (channel_owner and channel_agent on `/quotes`) and assert parity for the remaining 8 personas.

## Completed This Iteration
- Added `web/src/config/navigation-adapter.ts` with `buildPolicyContext` and `compareAuthenticatedTopNav`.
- Expanded `web/src/test/navigation-policy.test.ts` with a new `describe("parity adapter: role vocabulary coverage", ...)` block — 10 new tests covering channel_owner, channel_agent, supplier_admin, supplier_user, tenant_admin, employer_company_admin, employer_recruiter, candidate_user, and regressions for super_admin and platform_support.
- Updated `docs/runbooks/nav-visibility-policy-shape.md` with a role vocabulary mapping table, known divergences note, unknown role fallback description, and parity scope boundary.
- Updated this briefing so the next assistant can resume from PHASE 1 / Atomik-4 without prior chat context.
- Updated local `tools/agent/SESSION_STATE.json`; it is gitignored and must not be committed.

## Files Changed
- `docs/runbooks/nav-visibility-policy-shape.md`
- `web/src/config/navigation-adapter.ts`
- `web/src/test/navigation-policy.test.ts`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Required For This Checkpoint
- `npm run type-check` — passed
- `npm run build` — passed
- `npm run test:run -- navigation-policy` — passed (13 tests: 3 original + 10 new)

## Working Tree Note
Before this checkpoint, the repo already had unrelated modified/untracked files in API, admin UI, and local agent folders. Do not stage or revert them as part of this program unless a later atomic step explicitly owns them.

## Known Divergences (Documented, Not Yet Resolved)

**channel_owner / channel_agent**: Legacy excludes `/quotes` via `visibleFor` callback in `navigation.ts`. Policy fixture has no exclusion. Tests assert `onlyInPolicy: ["/quotes"]` and `hasDivergence: true` to document this gap.

Resolving it before runtime adoption requires either:
- Adding an `excluded_tenant_roles` field to `NavigationVisibilityPolicyItem`; or
- Adding a negation predicate to the `isPolicyItemVisible` evaluation.

This must be an explicit future atomic step.

## Role Vocabulary Findings

- `employer_recruiter` and `candidate_user` are new program roles not in the current `visibleFor` logic — they fall through to the generic authenticated path and get `["/dashboard", "/quotes"]`.
- Supplier personas must use `system_role: null` (not "supplier_user") to reproduce the legacy path; with `system_role: "supplier_user"` the `/admin` workspace-panel route appears in policy but not in legacy.
- `tenant_admin` parity: `system_role: "tenant_admin"` with `role/business_role: "admin"` gives full parity across 5 routes.

## Technical Findings
- `compareAuthenticatedTopNav` mirrors the same permission resolution path as the legacy nav helper, so parity results are authoritative for the current role set.
- The adapter is the correct place to detect and document future divergences as the policy fixture expands.

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
- `employer_admin` (system_role: `employer_company_admin`)
- `employer_recruiter`
- `candidate_user`
- `guest_public`

## Open Risks / Blockers
- channel_owner / channel_agent `/quotes` exclusion must be resolved before runtime adoption of policy module.
- Supplier personas have a `system_role: "supplier_user"` vs `null` inconsistency between legacy and policy that must be aligned before wiring.
- New program roles (employer_recruiter, candidate_user) are not yet represented in `visibleFor` callbacks; their nav is identical to generic authenticated for now.
- Public jobs expansion may overlap with the existing talent network; role and onboarding separation must be explicit before runtime changes.

## Next Atomic Step
PHASE 1 / Atomik-4: resolve the channel_owner / channel_agent `/quotes` exclusion in the policy module (add negation predicate or `excluded_tenant_roles` field) and update parity tests to assert `hasDivergence: false` for those personas. No runtime render path changes.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 1 / Atomik-3 complete after checkpoint commit
Next atomic step: PHASE 1 / Atomik-4
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first. Keep unrelated dirty worktree files untouched. Implement only one atomic step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
