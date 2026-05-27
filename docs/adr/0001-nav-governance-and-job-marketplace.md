# ADR 0001: Nav Governance And Job Marketplace Program

## Status
Accepted for phased implementation.

## Context
ProcureFlow currently has several visible navigation and marketplace surfaces that are partly hardcoded in frontend route, layout, and panel code. The next program, `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`, must make visible UI entry points configurable and auditable while expanding the jobs flow beyond partner-only users.

The program must support these roles:

- `super_admin`
- `platform_operator`
- `platform_support`
- `tenant_admin`
- `employer_admin`
- `employer_recruiter`
- `candidate_user`
- `guest_public`

The target product principles are:

- Top navigation, panel tabs, quick links, and page CTAs are policy/config driven.
- Panel designer becomes the source of truth for visible workspace navigation where applicable.
- Public jobs, employer onboarding, candidate onboarding, posting, and application lifecycle are responsive-first.
- Every atomic delivery is resume-safe and has one checkpoint commit.

## Decision
We will implement the program in small atomic phases, starting with governance foundations before expanding user-facing job marketplace flows.

The navigation model will be treated as a governed visibility policy:

- `top_nav`: public and authenticated primary navigation items.
- `panel_tabs`: workspace/admin/supplier/channel/talent panel tab visibility.
- `quick_links`: contextual shortcuts surfaced inside dashboards.
- `page_ctas`: role-aware primary actions on pages.

The policy must preserve route/API identifiers and must not mutate backend contract names for presentation concerns. User-visible labels may be localized and managed separately from technical keys.

## Implementation Guardrails
- No hardcoded one-off visibility checks for new surfaces unless wrapped by a reusable policy helper.
- No broad refactor in a single step.
- No migration unless the current atomic step explicitly requires it.
- UI changes must pass desktop/tablet/mobile smoke checks for at least 360, 768, and 1280 width classes.
- `lead` remains a product term if encountered in shared copy.

## Consequences
- PHASE 1 should focus on the smallest top-nav governance foundation and an inventory of current hardcoded navigation sources.
- PHASE 2 can professionalize the panel designer only after the governance shape is explicit.
- Job marketplace expansion must not overload the existing talent network without clear role separation between employer and candidate flows.

## Rollback
This ADR is documentation-only. Rollback is `git revert <checkpoint_sha>` for the checkpoint that introduced it.
