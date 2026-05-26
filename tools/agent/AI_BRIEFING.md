# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 0 - Memory bootstrap + ADR + backlog

## Executive Summary
This checkpoint starts the `NAV_GOVERNANCE_AND_JOB_MARKETPLACE` program. The goal is to make visible navigation surfaces governance-driven and then expand the job marketplace into public, employer, recruiter, and candidate flows.

No runtime code changed in this checkpoint. The work is documentation and handoff state only.

## Completed This Iteration
- Added the program ADR for navigation governance and job marketplace expansion.
- Added the phased atomic backlog and acceptance criteria.
- Updated this briefing so the next assistant can resume from PHASE 1 without relying on prior chat context.
- Updated local `tools/agent/SESSION_STATE.json`; it is gitignored and must not be committed.

## Files Changed
- `docs/adr/0001-nav-governance-and-job-marketplace.md`
- `docs/runbooks/nav-governance-and-job-marketplace-backlog.md`
- `tools/agent/AI_BRIEFING.md`

## Migrations
None.

## Tests Required For This Checkpoint
- `npm run type-check`
- `npm run build`
- Document heading verification for the ADR, backlog, and this briefing.
- Responsive validation is documentation-only for PHASE 0; no UI changed.

## Working Tree Note
Before this checkpoint, the repo already had unrelated modified/untracked files in API, admin UI, and local agent folders. Do not stage or revert them as part of this program unless a later atomic step explicitly owns them.

## Program Phases
- PHASE 0: Memory bootstrap + ADR + backlog
- PHASE 1: Top nav governance foundation
- PHASE 2: Panel designer professionalization
- PHASE 3: Public jobs surface (`/is-ilanlari`, detail, CTA)
- PHASE 4: Onboarding split (Employer vs Candidate)
- PHASE 5: Posting/Application lifecycle
- PHASE 6: Campaign/Growth ops (UTM + landing + KPI)
- PHASE 7: Hardening + UAT + release governance

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
- Current nav visibility sources are mixed across config, layout, admin panel data, and role checks; PHASE 1 must inventory before implementation.
- Public jobs expansion may overlap with the existing talent network; role and onboarding separation must be explicit before runtime changes.

## Next Atomic Step
PHASE 1 / Atomik-1: inventory current top-nav and authenticated navigation sources, then document the minimal visibility policy shape without changing runtime behavior.

## RESUME BLOCK
```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
Current phase: PHASE 0 complete after checkpoint commit
Next atomic step: PHASE 1 / Atomik-1
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first. Keep unrelated dirty worktree files untouched. Implement only one atomic step and commit it with AI_BRIEFING.md.
```

## SAFE TO RESUME
yes
