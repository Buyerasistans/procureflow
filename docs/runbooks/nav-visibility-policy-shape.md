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
