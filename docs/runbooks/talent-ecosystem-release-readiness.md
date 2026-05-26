# Talent Ecosystem Release Readiness

This note covers the procurement talent network, payout review, and talent admin control surfaces.

## Required Environment And Config

- Frontend build uses the same API base URL as the target environment.
- Auth tokens are issued with roles that match the backend role checks.
- Platform staff roles are available for the intended operators:
  - `super_admin`
  - `finance_officer`
  - other platform staff roles already recognized by the application
- Database migration `76f4c14237af` has been applied.
- Existing admin routes are deployed:
  - `/admin/payout-requests`
  - `/admin/talent-ecosystem`
- Backend endpoints are reachable:
  - `GET /api/v1/admin/payout-requests`
  - `PATCH /api/v1/admin/payout-requests/{id}`
  - `GET /api/v1/talent/admin/profiles`
  - `PATCH /api/v1/talent/admin/profiles/{id}/kyc`

## Release Gate

- [ ] `npm run type-check` passes in `web/`.
- [ ] `npm run build` passes in `web/`.
- [ ] UAT smoke checklist passes: `docs/runbooks/talent-ecosystem-uat-smoke.md`.
- [ ] Payout transition smoke covers `pending -> approved -> processing -> paid`.
- [ ] Payout reject path works from `pending -> rejected`.
- [ ] KYC approve and reject actions are confirmed.
- [ ] Error UX shows friendly messages and no raw backend detail.

## Definition Of Done

- [ ] Admin payout reviewers can process and reject payout requests.
- [ ] Talent admin reviewers can approve and reject KYC.
- [ ] Routes are protected by existing admin/auth permissions.
- [ ] User-facing admin errors are sanitized.
- [ ] Heavy admin tabs remain lazy-loaded after build.
- [ ] No migration or endpoint drift is introduced by release-only changes.

## Known Risks

- `User.system_role` still accepts string values; role validation remains API-layer dependent until a future enum migration.
- `ai_match_score` is still a placeholder and is not part of the release gate.
- Broader visual redesign is outside this release readiness step.
- Existing unrelated working-tree changes must not be accidentally included in the release commit.

## Rollback

Use commit-based rollback only; do not use destructive reset in a shared worktree.

- Revert PHASE 7 docs checkpoint if release readiness docs need removal:
  - `git revert <phase-7-atomik-1-sha>`
- Revert PHASE 6 controlled split if an unexpected lazy-loading regression appears:
  - `git revert afea4b0`
- Revert PHASE 6 admin hardening if error UX regression is confirmed:
  - `git revert 276afe2`

After any revert:

- [ ] Run `npm run type-check`.
- [ ] Run `npm run build`.
- [ ] Re-run the UAT smoke checklist.
