# Navigation Source Inventory

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`

Scope: PHASE 1 / Atomik-1. This is a documentation-only inventory. No runtime behavior was changed.

## Summary
Navigation is currently split across public top navigation, authenticated app layout navigation, admin workspace panel profiles, admin tab rendering, quick links, and page-level CTAs.

The main finding is that authenticated nav has a partial config layer in `web/src/config/navigation.ts`, while public nav and many page CTAs remain component-local. Admin panel tabs are partly config-driven through workspace panel profiles, but the tab catalog and rendering rules still live in frontend and backend defaults.

## Source Inventory

| Surface | Source file | Key evidence | Current state | Notes |
| --- | --- | --- | --- | --- |
| Authenticated top nav item catalog | `web/src/config/navigation.ts` | `NAV_ITEMS`, `getVisibleNavItems` | Partly config-driven | Items have `label`, `to`, `permission`, and optional `visibleFor`; role logic is embedded in callbacks. |
| Authenticated top nav rendering | `web/src/components/AppLayout.tsx` | `getVisibleNavItems(user).filter(...hasPermissionForUser...)` | Partly config-driven | Uses `NAV_ITEMS` and permission filter, then renders header chips. Label translations are partially mapped in component. |
| Auth default route resolution | `web/src/auth/routing.ts` | `getDefaultRouteForRole`, `getDefaultRouteForUser` | Config-driven by current `NAV_ITEMS` | First visible/allowed nav item determines fallback route after admin-home special case. |
| Public top nav | `web/src/components/NavBar.tsx` | local `links` array and variant-based login CTA | Hardcoded in component | Public routes and login CTA variants are local arrays/conditionals, not governed by shared policy. |
| Public home CTAs | `web/src/pages/PublicHomePage.tsx` | hero links to onboarding, tenders, strategic partnership, partner program | Hardcoded in page | Good candidate for `page_cta` placement in a later phase. |
| Solution page CTAs | `web/src/pages/SolutionsPage.tsx` | links to offers/suppliers/strategic partner | Hardcoded in page | Also a `page_cta` candidate. |
| Admin tab type catalog | `web/src/pages/admin/adminPageMeta.tsx` | `AdminTabKey`, `TabConfig` | Typed frontend catalog | Defines valid admin tab keys and tab metadata shape. |
| Admin tab construction | `web/src/pages/AdminPage.tsx` | `tabConfigs`, `baseTabs`, `allowedTabs` | Mixed | Frontend constructs base tabs and filters by active workspace panel profile. |
| Admin workspace profile defaults | `web/src/admin/workspace-panels.ts` | `WORKSPACE_PANEL_TAB_OPTIONS`, `DEFAULT_WORKSPACE_PANEL_CONFIG`, `allowed_tabs`, `quick_links` | Config-driven defaults | Role profiles define allowed tabs and quick links; contains frontend fallback config. |
| Admin workspace profile backend defaults | `api/routers/admin.py` | `_default_workspace_panel_config`, `_validate_workspace_panel_config`, `/admin/workspace-panels` | Config-driven backend persistence | Backend stores/validates workspace panel config and merges defaults. |
| Workspace panel designer | `web/src/components/admin/WorkspacePanelDesignerTab.tsx` | `allowed_tabs`, `quick_links`, `WORKSPACE_PANEL_TAB_OPTIONS` | Config editor | Allows admin editing of panel tabs and quick links, but not top nav/page CTA governance yet. |
| Scope workspace quick links | `web/src/pages/AdminPage.tsx`, `web/src/admin/workspace-panels.ts` | `getWorkspacePanelQuickLinks(activeWorkspacePanelProfile)` | Config-driven | Quick links come from workspace panel profile or role defaults. |
| Admin focus banner CTAs | `web/src/pages/AdminPage.tsx`, `web/src/pages/admin/PlatformOverviewSummarySection.tsx`, `web/src/pages/admin/PlatformOperationsTab.tsx`, `web/src/pages/admin/TenantGovernanceTab.tsx` | `actions: [{ label, onClick, href }]` | Hardcoded/contextual | Contextual CTAs are embedded in page logic and should later move behind `page_cta` policy shape where stable. |
| Supplier dashboard quick cards | `web/src/pages/SupplierDashboard.tsx` | `navigate("/supplier/workspace?...")` quick card actions | Hardcoded page CTAs | Supplier portal navigation remains page-local. |
| Jobs route wiring | `web/src/App.tsx`, `web/src/pages/JobsPage.tsx` | `/jobs` route and `JobsPage` | Route exists | Current path is authenticated `/jobs`; public `/is-ilanlari` is not yet implemented. |
| Jobs backend authorization | `api/core/authz.py`, `api/routers/jobs.py`, `api/routers/job_applications.py` | `can_post_procurement_job`, `is_talent_member`, `can_access_talent_admin` | Backend role-driven | Backend has employer/talent/admin checks but current role names do not yet match the new program names exactly. |

## Current Role And Permission Binding

| Layer | Source | Binding mechanism | Notes |
| --- | --- | --- | --- |
| Frontend permissions | `web/src/auth/permissions.ts` | `Role`, `Permission`, `hasPermissionForUser` | Small permission enum: `view:dashboard`, `view:admin`, `view:workspace-panel`, `view:reports`, `manage:users`. |
| Frontend system role checks | `web/src/config/navigation.ts` | `visibleFor(user)` callbacks | Talent, employer, payout, and talent admin nav visibility are embedded in callbacks. |
| Frontend workspace panel checks | `web/src/auth/permissions.ts` | `hasAdminWorkspaceHome`, `canAccessWorkspacePanel`, role helpers | Drives Admin route visibility and workspace home behavior. |
| Backend platform/admin roles | `api/core/authz.py` | normalized `system_role` helpers | Includes platform, tenant, talent, employer, payout reviewer helpers. |
| Backend admin permission matrix | `api/routers/admin.py`, `api/core/permission_matrix.py` | `/admin/permission-catalog`, `/admin/role-permission-matrix`, overrides/delegations | Existing admin permission tooling can inform later governance work. |
| Workspace panel persistence | `api/routers/admin.py`, `web/src/services/admin.service.ts` | `/admin/workspace-panels` GET/PUT | Existing persisted JSON is currently focused on panel tabs, themes, and quick links. |

## Hardcoded Versus Config-driven

| Category | Config-driven today | Hardcoded today |
| --- | --- | --- |
| Public top nav | No shared governance config | `NavBar.tsx` local `links` and variant login CTAs |
| Authenticated top nav | `NAV_ITEMS` central file | Role callbacks and labels inside `navigation.ts`; rendered/mapped in `AppLayout.tsx` |
| Admin panel tabs | Workspace panel `allowed_tabs` | Base tab construction and several conditional tab checks in `AdminPage.tsx` |
| Quick links | Workspace panel `quick_links` | Page-specific quick cards and focus CTAs |
| Page CTAs | No shared governance config | Public home, solutions, admin focus banners, supplier dashboard, upgrade workspace |
| Backend permissions | Role helpers and permission catalog exist | Navigation visibility is not yet a backend contract |

## Gaps For PHASE 1 / Atomik-2
- New program roles are not fully represented in frontend `Role` and nav policy vocabulary: `employer_admin`, `employer_recruiter`, `candidate_user`, `guest_public`.
- Current employer backend role is `employer_company_admin`; it should be mapped deliberately rather than renamed blindly.
- `NAV_ITEMS` lacks placement, order, scope, responsive behavior, and tenant role fields.
- Public nav and page CTAs are not represented in any shared visibility model.
- Fallback behavior is implicit. A future policy helper should define secure defaults when config is absent or malformed.

## Runtime Change Status
No runtime behavior changed in this inventory step.
