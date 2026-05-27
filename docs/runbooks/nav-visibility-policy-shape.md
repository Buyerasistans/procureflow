# Minimal Navigation Visibility Policy Shape

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`

Scope: PHASE 1 / Atomik-1. This document defines the target minimal policy shape only. No migration or runtime implementation is included in this step.

## Policy Entity

```ts
type NavigationPlacement = "top_nav" | "panel_tab" | "quick_link" | "page_cta";
type VisibilityScope = "public" | "authenticated" | "tenant_only" | "platform_only";
type ResponsiveBehavior = "wrap" | "collapse" | "more_menu";

type NavigationVisibilityPolicyItem = {
  key: string;
  label: string;
  placement: NavigationPlacement;
  route: string;
  order: number;
  is_enabled: boolean;
  visibility_scope: VisibilityScope;
  allowed_system_roles: string[];
  allowed_tenant_roles: string[];
  requires_permissions: string[];
  responsive_behavior: ResponsiveBehavior;
};
```

## Field Semantics

| Field | Meaning | Notes |
| --- | --- | --- |
| `key` | Stable technical identifier | Must not be localized. Example: `top_nav.jobs.public`. |
| `label` | User-visible default label | Later can be localized. |
| `placement` | Where the item is rendered | `top_nav`, `panel_tab`, `quick_link`, or `page_cta`. |
| `route` | Internal route or href | Existing slugs stay stable unless a future step owns a route change. |
| `order` | Sort order within placement | Lower number renders earlier. |
| `is_enabled` | Feature visibility toggle | Disabled items should not render. |
| `visibility_scope` | Broad audience scope | `public` needs no auth; `authenticated` needs user; tenant/platform scopes require role guards. |
| `allowed_system_roles` | Auth `system_role` allowlist | Empty means no system-role restriction beyond scope/permission. |
| `allowed_tenant_roles` | Business/tenant role allowlist | Empty means no tenant-role restriction beyond scope/permission. |
| `requires_permissions` | Permission keys required | Empty means no additional permission requirement. |
| `responsive_behavior` | Overflow behavior | `wrap`, `collapse`, or `more_menu`. |

## Example Policy Draft

| key | label | placement | route | order | enabled | scope | system roles | tenant roles | permissions | responsive |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `top_nav.public.home` | Ana Sayfa | `top_nav` | `/` | 10 | true | `public` | - | - | - | `collapse` |
| `top_nav.public.tenders` | Açık İhaleler | `top_nav` | `/teklifler` | 20 | true | `public` | - | - | - | `collapse` |
| `top_nav.public.suppliers` | Tedarikçi Havuzu | `top_nav` | `/tedarikciler` | 30 | true | `public` | - | - | - | `collapse` |
| `top_nav.public.jobs` | İş İlanları | `top_nav` | `/is-ilanlari` | 40 | true | `public` | - | - | - | `collapse` |
| `top_nav.app.dashboard` | Dashboard | `top_nav` | `/dashboard` | 10 | true | `authenticated` | - | - | `view:dashboard` | `more_menu` |
| `top_nav.app.quotes` | Teklifler | `top_nav` | `/quotes` | 20 | true | `tenant_only` | `tenant_admin`, `tenant_owner`, `tenant_member` | `admin`, `manager`, `buyer`, `satinalmaci`, `satinalma_uzmani`, `satinalma_yoneticisi`, `satinalma_direktoru` | `view:dashboard` | `more_menu` |
| `top_nav.app.admin_workspace` | Yönetim Alanı | `top_nav` | `/admin` | 30 | true | `authenticated` | `super_admin`, `platform_support`, `platform_operator`, `tenant_admin`, `tenant_owner` | `admin`, `channel_owner`, `channel_agent` | `view:workspace-panel` | `more_menu` |
| `top_nav.app.discovery_lab` | AI Keşif Lab | `top_nav` | `/discovery-lab` | 40 | true | `platform_only` | `super_admin`, `platform_support`, `platform_operator` | - | `view:admin` | `more_menu` |
| `top_nav.app.jobs` | İş İlanları | `top_nav` | `/jobs` | 50 | true | `authenticated` | `talent_member`, `employer_company_admin`, `employer_admin`, `employer_recruiter`, `referral_partner`, `super_admin` | - | `view:dashboard` | `more_menu` |
| `panel_tab.admin.panel_home` | Panel Ana Sayfa | `panel_tab` | `/admin?tab=panel_home` | 10 | true | `authenticated` | - | - | `view:workspace-panel` | `wrap` |
| `quick_link.supplier.offers` | Tekliflerim | `quick_link` | `/supplier/workspace?tab=offers` | 10 | true | `authenticated` | `supplier_user` | `supplier_admin`, `supplier_user` | `view:dashboard` | `wrap` |
| `page_cta.public.employer_onboarding` | İşveren Olarak Başla | `page_cta` | `/onboarding?type=employer` | 10 | true | `public` | - | - | - | `wrap` |

## Fallback Policy

If policy config cannot be read or is malformed:

1. Public nav renders only safe public basics: home, tenders, supplier pool, strategic partnership, login.
2. Authenticated nav falls back to the current static equivalent of `Dashboard` plus only items allowed by existing `hasPermissionForUser`.
3. Platform-only/admin items are hidden unless the current user is explicitly `super_admin`.
4. Unknown roles get no privileged navigation.
5. Panel tabs fall back to `panel_home` only unless a valid workspace profile is available.

This fallback favors least privilege and prevents accidental exposure of admin or tenant-only surfaces.

## Migration Analysis

No migration is required for PHASE 1 / Atomik-1 because this is documentation-only.

Likely future options:

- Short term: introduce a typed frontend policy module that mirrors current behavior without persistence.
- Medium term: extend existing `/admin/workspace-panels` JSON to include top-nav/CTA governance if the product wants panel-designer ownership.
- Long term: store navigation visibility policies in a dedicated backend table or versioned JSON config once admin editing, audit history, import/export, and tenant overrides are required.

## Runtime Change Status

No runtime behavior changed in this policy-shape step.

## PHASE 1 / Atomik-3 Adapter and Parity Scope

New non-invasive proof layer:

- `web/src/config/navigation-adapter.ts`

`compareAuthenticatedTopNav(user)` runs both the legacy resolver and the policy resolver for a given `AuthUser` and returns `{ legacy, policy, onlyInLegacy, onlyInPolicy, inBoth, hasDivergence }`. Not wired into any runtime render path; safe to import in tests only.

### Role Vocabulary Mapping

| Persona | system_role | business_role | Legacy routes | Policy routes | Status |
| --- | --- | --- | --- | --- | --- |
| super_admin | super_admin | super_admin | all 9 | all 9 | parity |
| platform_support | platform_support | admin | dashboard, quotes, admin, discovery-lab, reports, payout-requests, talent-ecosystem | same | parity |
| tenant_admin | tenant_admin | admin | dashboard, quotes, admin, discovery-lab, reports | same | parity |
| employer_company_admin | employer_company_admin | user | dashboard, quotes, jobs | same | parity |
| employer_recruiter | employer_recruiter | user | dashboard, quotes | same | parity |
| candidate_user | candidate_user | user | dashboard, quotes | same | parity |
| supplier_admin | null | supplier_admin | dashboard, quotes | same | parity |
| supplier_user | null | supplier_user | dashboard, quotes | same | parity |
| channel_owner | tenant_member | channel_owner | dashboard, admin | dashboard, admin | parity (Atomik-4) |
| channel_agent | tenant_member | channel_agent | dashboard, admin | dashboard, admin | parity (Atomik-4) |

### Known Divergences

**channel_owner / channel_agent — RESOLVED in Atomik-4**: `/quotes` exclusion is now enforced via `excluded_tenant_roles: ["channel_owner", "channel_agent", "is_ortagi"]` on the quotes policy item. Tests assert `hasDivergence: false` for both personas. See PHASE 1 / Atomik-4 section for the chosen approach.

### Unknown Role Fallback

A user whose `system_role` and `business_role` are not listed in the policy allowlists will receive only items with empty `allowed_system_roles` and `allowed_tenant_roles`. With the current fixture this means: items that require only `view:dashboard` and have no role restriction — i.e., `/dashboard` and `/quotes` — if the user has `view:dashboard` permission. Platform-only, tenant-admin-only, and talent/employer-scoped items are hidden. This matches the least-privilege fallback goal.

### Parity Scope Boundary

PHASE 1 / Atomik-3 proves route-list parity for authenticated top-nav only. Panel tabs, quick links, and page CTAs are not yet covered. Runtime render path still reads from `navigation.ts`; `navigation-adapter.ts` is test/dev only.

## PHASE 1 / Atomik-5 Supplier Role Normalization

**Goal:** Close the supplier persona `/admin` divergence (system_role="supplier_user") without touching the runtime render path.

**Root cause:** The `/admin` policy fixture originally included `"supplier_user"` in `allowed_system_roles` because `canAccessWorkspacePanel` returns true for that role. However, the legacy `/admin` nav item uses `hasAdminWorkspaceHome` as its `visibleFor` guard, which does NOT include `supplier_user`. These are two distinct functions with different semantics: `canAccessWorkspacePanel` governs workspace-panel permission (the `view:workspace-panel` check), while `hasAdminWorkspaceHome` governs top-nav /admin visibility specifically.

**Fix:** Remove `"supplier_user"` from `/admin` fixture `allowed_system_roles`. Supplier accounts access their workspace via `/supplier/workspace`, not `/admin` top-nav. Semantically correct and minimally invasive.

**Supplier role payload contract:**

| Payload | system_role | business_role | Legacy /admin | Policy /admin | Outcome |
| --- | --- | --- | --- | --- | --- |
| supplier_admin, null | null | supplier_admin | hidden | hidden (no view:workspace-panel) | parity |
| supplier_admin, supplier_user | supplier_user | supplier_admin | hidden (hasAdminWorkspaceHome=false) | hidden (removed from allow-list) | parity |
| supplier_user, null | null | supplier_user | hidden | hidden | parity |
| supplier_user, supplier_user | supplier_user | supplier_user | hidden | hidden | parity |

**Fallback behavior with conflicting payloads:** If an unknown system_role is paired with a supplier business_role, the allow-list check for /admin will fail (supplier business_role is not in `allowed_tenant_roles`), so /admin remains hidden. Least-privilege preserved.

## PHASE 1 / Atomik-4 Exclusion Rule

**Goal:** Close the channel_owner / channel_agent `/quotes` divergence without touching the runtime render path.

**Approach chosen: `excluded_tenant_roles`** (explicit deny-list per item). Added to `NavigationVisibilityPolicyItem` as an optional field. Evaluated before allow-lists in `isPolicyItemVisible`, so an explicit exclusion always wins over a matching allow-list entry. Default is `undefined` / empty — no behavior change for items that do not set it.

**Why not negation predicate?** A deny-list field is self-documenting, auditable, and composable with future governance UIs. A predicate function would be opaque to config serialization.

**Implementation:**
- `NavigationVisibilityPolicyItem.excluded_tenant_roles?: string[]`
- `isTenantRoleExcluded(item, context)` — normalizes and checks `context.tenant_role` and `context.business_role` against the deny-list.
- `/quotes` fixture: `excluded_tenant_roles: ["channel_owner", "channel_agent", "is_ortagi"]`

**Exclusion priority rule:** `is_enabled` → scope → **exclusion** → allow-lists → permissions.

**Unknown role + exclusion interaction:** An unknown role not in `excluded_tenant_roles` still passes the exclusion gate. The allow-list gate (or empty allow-list = no restriction) then determines visibility. Least-privilege outcome is preserved because unknown roles have no privileged permissions.

## PHASE 1 / Atomik-2 Typed Module

New non-invasive frontend module:

- `web/src/config/navigation-policy.ts`

The module defines the first typed visibility-policy contract for authenticated navigation without wiring it into the render path. Current rendering still uses `web/src/config/navigation.ts`; the new module is covered by parity tests before any future adapter step can switch runtime reads.

## Evaluation Flow

1. A `NavigationVisibilityPolicyItem` declares placement, route, enabled state, broad scope, role allowlists, required permissions, and responsive behavior.
2. The caller provides `NavigationVisibilityContext` with auth state, system role, tenant/business role, permission set, and broad scope.
3. `isPolicyItemVisible(item, context)` evaluates:
   - `is_enabled`
   - `visibility_scope`
   - `excluded_tenant_roles` (explicit deny — wins over allow-lists)
   - role allowlists
   - required permissions
4. `resolveVisibleNavItems(items, context)` filters visible items and sorts by `order`.
5. Future runtime wiring must keep the existing `hasPermissionForUser`/role semantics until backend-governed policy storage is introduced.

## Parity Guarantee

PHASE 1 / Atomik-2 adds `web/src/test/navigation-policy.test.ts` to compare the new typed policy result against the existing authenticated top-nav resolver for:

- `super_admin`
- platform staff (`platform_support`)
- a non-privileged authenticated user

This means the new module is present and testable, but no runtime visual or route behavior changes in this step.
