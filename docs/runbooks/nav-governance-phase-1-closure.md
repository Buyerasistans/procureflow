# NAV_GOVERNANCE_AND_JOB_MARKETPLACE — PHASE 1 Closure

**Status:** CLOSED  
**Closed:** 2026-05-27  
**Branch:** `pr/strict-gate-payment-clean-v2`  
**Program:** NAV_GOVERNANCE_AND_JOB_MARKETPLACE

---

## Scope of Phase 1

PHASE 1 established a typed, tested, non-invasive navigation visibility policy
foundation for authenticated top-nav. No runtime render path was changed at any
point during PHASE 1.

The phase covered:

- Inventory of existing nav sources and visibility logic.
- A minimal typed policy shape definition.
- A typed TypeScript policy module (`navigation-policy.ts`) with evaluation
  logic for authenticated top-nav items.
- A non-invasive adapter (`navigation-adapter.ts`) for comparing legacy vs
  policy output in tests without wiring either into runtime.
- Parity test coverage across all known authenticated top-nav role personas.
- Resolution of all identified divergences between legacy and policy output.

---

## Delivered Artifacts

| Atomik Step | Commit | Summary |
| --- | --- | --- |
| PHASE 0 / Atomik-1 | `ba02ed4` | Program ADR + phased backlog bootstrap |
| PHASE 1 / Atomik-1 | `241f03a` | Nav source inventory + minimal policy shape |
| PHASE 1 / Atomik-2 | `4073a0a` | Typed `navigation-policy.ts` module + 3 initial parity tests |
| PHASE 1 / Atomik-3 | `43e7ac4` | Non-invasive adapter + 10-persona parity coverage |
| PHASE 1 / Atomik-4 | `d770680` | `excluded_tenant_roles` field + channel_owner/agent gap resolved |
| PHASE 1 / Atomik-5 | `6ec1a67` | Supplier `system_role` inconsistency resolved; 15 tests total |

**New files (all non-wired):**

- `web/src/config/navigation-policy.ts` — typed policy module
- `web/src/config/navigation-adapter.ts` — dev/test comparison adapter
- `web/src/test/navigation-policy.test.ts` — parity test suite
- `docs/runbooks/nav-visibility-policy-shape.md` — policy shape + findings
- `docs/runbooks/nav-governance-phase-1-closure.md` — this document

---

## Parity Evidence Summary

All 12 persona scenarios tested. Final state: **0 divergences**.

| Persona | system_role | business_role | Legacy routes | Divergence | Resolved |
| --- | --- | --- | --- | --- | --- |
| super_admin | super_admin | super_admin | 9 routes | none | — |
| platform_support | platform_support | admin | 7 routes | none | — |
| tenant_admin | tenant_admin | admin | 5 routes | none | — |
| employer_company_admin | employer_company_admin | user | dashboard, quotes, jobs | none | — |
| employer_recruiter | employer_recruiter | user | dashboard, quotes | none | — |
| candidate_user | candidate_user | user | dashboard, quotes | none | — |
| channel_owner | tenant_member | channel_owner | dashboard, admin | `/quotes` onlyInPolicy | Atomik-4 |
| channel_agent | tenant_member | channel_agent | dashboard, admin | `/quotes` onlyInPolicy | Atomik-4 |
| supplier_admin | null | supplier_admin | dashboard, quotes | none | — |
| supplier_admin | supplier_user | supplier_admin | dashboard, quotes | `/admin` onlyInPolicy | Atomik-5 |
| supplier_user | null | supplier_user | dashboard, quotes | none | — |
| supplier_user | supplier_user | supplier_user | dashboard, quotes | `/admin` onlyInPolicy | Atomik-5 |

**Test suite:** `web/src/test/navigation-policy.test.ts` — 15 tests, all passing.  
**Verification commands:**

```bash
npm run type-check
npm run build
npm run test:run -- navigation-policy
```

---

## Out-of-Scope (Not Covered in Phase 1)

The following items were intentionally excluded from PHASE 1 scope to keep the
phase non-invasive and focused on foundation:

1. **Runtime wiring** — `AppLayout.tsx` still reads from `navigation.ts`. The
   policy module is not used in any production render path.
2. **Panel tabs** (`panel_tab` placement) — workspace panel tab visibility is
   not yet governed by the policy module.
3. **Quick links** (`quick_link` placement) — supplier/channel workspace quick
   links are not modeled.
4. **Page CTAs** (`page_cta` placement) — onboarding, jobs, and employer CTAs
   are not modeled.
5. **Public nav** — `NavBar.tsx` public top-nav items are hardcoded; not yet
   migrated to policy.
6. **Tenant nav overrides** — per-tenant nav customization is not yet supported.
7. **Backend policy storage** — all policy lives in frontend TypeScript; no
   backend contract or admin editing surface.
8. **New program role nav** — `employer_recruiter` and `candidate_user` receive
   generic authenticated nav (dashboard, quotes). Their dedicated nav items are
   not yet defined in legacy or policy.

---

## Why Runtime Wiring Was Deferred

Runtime wiring (`AppLayout.tsx` reading from `navigation-policy.ts` instead of
`navigation.ts`) was explicitly deferred for the following reasons:

1. **Parity must be proven before adoption.** Replacing the runtime source
   without a tested, verified policy module risks accidental nav changes for
   all users. PHASE 1 builds that foundation.

2. **`visibleFor` edge cases are complex.** The legacy system uses callback
   functions (`visibleFor`) with access to the full `AuthUser` object. The
   policy module evaluates against a normalized `NavigationVisibilityContext`.
   These are equivalent for tested personas but may diverge on untested
   edge-case payloads.

3. **Responsive gate.** Any UI render path change requires PC + tablet + mobile
   verification per project policy. This is a separate quality gate that cannot
   be satisfied in a parity-only phase.

4. **One-step reversibility.** Keeping `navigation.ts` as the active source
   means any issues with the policy module can be addressed without a rollback.
   Once wiring is done, rollback is a breaking change.

---

## Responsive Gate (Mandatory for PHASE 2+)

Per project rules (`feedback_responsive_design` memory):

> All UI changes must be verified on PC + tablet + mobile before marking a step
> complete. The user does not want to be reminded of this every time.

**Any PHASE 2 atomic step that touches a runtime render path must include
explicit responsive validation** (desktop, tablet 768px, mobile 375px) before
the step is considered done. Parity-only steps (no render path change) are
exempt.

---

## PHASE 2 Definition of Ready (Entry Criteria)

PHASE 2 is ready to begin when all of the following are true:

- [ ] PHASE 1 closure confirmed (this document committed).
- [ ] A clear single starting point is selected from the PHASE 2 scope items
  below (runtime wiring is the recommended first step).
- [ ] The runtime wiring atomic step specifies exactly which component changes
  and includes a responsive validation plan.
- [ ] No PHASE 1 divergences remain open (confirmed: 0 open divergences).

---

## PHASE 2 Definition of Done (Success Criteria)

PHASE 2 is complete when all of the following are true:

- [ ] `AppLayout.tsx` reads authenticated top-nav from `navigation-policy.ts`
  (runtime wiring done).
- [ ] Legacy `navigation.ts` is either removed or explicitly marked deprecated.
- [ ] All responsive breakpoints (PC + tablet + mobile) verified for top-nav
  render after wiring.
- [ ] `navigation-adapter.ts` is either removed (no longer needed) or repurposed
  for ongoing divergence monitoring.
- [ ] Panel tab visibility (`panel_tab` placement) is governed by the policy
  module for at least the platform and tenant_admin personas.
- [ ] Public top-nav items are modeled (or explicitly deferred to PHASE 3 with
  a documented rationale).
- [ ] No regression in existing test suite after wiring.

---

## PHASE 2 Recommended Scope

In priority order:

1. **Runtime wiring** (PHASE 2 / Atomik-1): Switch `AppLayout.tsx` to read
   from `resolveVisibleNavItems(AUTHENTICATED_TOP_NAV_POLICY_ITEMS, context)`.
   Responsive gate required.
2. **Legacy cleanup** (PHASE 2 / Atomik-2): Remove or deprecate `navigation.ts`
   and inline `visibleFor` callbacks. Remove `navigation-adapter.ts` if no
   longer needed.
3. **Panel tab governance** (PHASE 2 / Atomik-3): Model `panel_tab` items in
   the policy module for at least platform and tenant_admin personas.
4. **Public nav** (PHASE 2 / Atomik-4): Model public top-nav in the policy
   module and wire `NavBar.tsx`.
5. **New role nav** (PHASE 2 / Atomik-5): Define dedicated nav items for
   `employer_recruiter` and `candidate_user` roles in policy and legacy.

---

## Cross-References

- Policy shape and evaluation flow:
  [`docs/runbooks/nav-visibility-policy-shape.md`](nav-visibility-policy-shape.md)
- Policy module:
  [`web/src/config/navigation-policy.ts`](../../web/src/config/navigation-policy.ts)
- Parity adapter (dev/test only):
  [`web/src/config/navigation-adapter.ts`](../../web/src/config/navigation-adapter.ts)
- Parity test suite:
  [`web/src/test/navigation-policy.test.ts`](../../web/src/test/navigation-policy.test.ts)
