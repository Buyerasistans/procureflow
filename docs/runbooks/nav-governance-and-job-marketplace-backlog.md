# NAV_GOVERNANCE_AND_JOB_MARKETPLACE Backlog

## Program Goal
Make all visible navigation and marketplace entry points governance-driven, then expand the job marketplace into an independent public, employer, recruiter, and candidate workflow.

## Phase 0: Memory Bootstrap, ADR, Backlog
Status: in progress for this checkpoint.

Deliverables:
- ADR for governance and marketplace principles.
- Atomic backlog with phased next steps.
- `AI_BRIEFING.md` and local `SESSION_STATE.json` updated for resume safety.

Acceptance:
- No runtime code changes.
- One checkpoint commit.
- Next atomic step is explicit.

## Phase 1: Top Nav Governance Foundation
Goal: Introduce the smallest safe policy/config layer for top navigation visibility.

Candidate atomic steps:
1. Inventory current top-nav and authenticated nav sources.
2. Add a typed navigation visibility policy shape without changing behavior.
3. Wire top-nav rendering through the policy with parity tests.
4. Add panel-designer alignment notes for top-nav placement.

Acceptance:
- Existing visible nav stays behaviorally equivalent.
- Policy can express `guest_public`, platform roles, tenant roles, employer roles, and candidate roles.
- Responsive smoke covers desktop/tablet/mobile.

## Phase 2: Panel Designer Professionalization
Goal: Make placement, role matrix, preview, and import/export operations safer for admins.

Candidate atomic steps:
1. Add role visibility matrix documentation and UI acceptance checklist.
2. Add preview parity checks for top nav, panel tabs, quick links, and CTAs.
3. Harden import/export validation without changing stored contract.

Acceptance:
- Admins can reason about role-specific visibility before saving.
- No hidden route or broken CTA is introduced.

## Phase 3: Public Jobs Surface
Goal: Add a public `/is-ilanlari` surface and detail page that works for guests, candidates, and employers.

Candidate atomic steps:
1. Define route and content requirements.
2. Build read-only listing/detail pages with responsive layout.
3. Add CTA routing for employer posting and candidate application intent.

Acceptance:
- Guest can browse without auth.
- Candidate and employer CTAs are role-aware.

## Phase 4: Onboarding Split
Goal: Separate employer and candidate onboarding flows.

Candidate atomic steps:
1. Define role and form requirements for employer onboarding.
2. Define candidate profile onboarding requirements.
3. Add safe auth routing and friendly validation.

Acceptance:
- Employer onboarding does not require partner status.
- Candidate onboarding is independent from supplier/partner onboarding.

## Phase 5: Posting And Application Lifecycle
Goal: Mature posting, application, status transitions, and admin oversight.

Candidate atomic steps:
1. Add employer posting workflow hardening.
2. Add candidate application status visibility.
3. Add admin moderation and audit trail.

Acceptance:
- Employer/recruiter can manage postings within authorized scope.
- Candidate can track applications.

## Phase 6: Campaign And Growth Ops
Goal: Add UTM, landing, and KPI tracking for marketplace acquisition.

Candidate atomic steps:
1. Define campaign attribution fields and reporting needs.
2. Add landing CTA tracking.
3. Add KPI dashboard slice.

Acceptance:
- Campaign source can be measured without exposing private data.

## Phase 7: Hardening, UAT, Release Governance
Goal: Complete responsive, accessibility, security, and release readiness gates.

Candidate atomic steps:
1. Responsive viewport smoke matrix.
2. A11y review for navigation and marketplace flows.
3. Release readiness and rollback docs.

Acceptance:
- No user-visible hardcoded navigation regression.
- All new marketplace roles have defined access and route behavior.

## Next Atomic Step
PHASE 1 / Atomik-1: inventory current top-nav and authenticated navigation sources, then document the minimal visibility policy shape without changing runtime behavior.
