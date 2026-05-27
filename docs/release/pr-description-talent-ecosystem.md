# PR Description: Talent Ecosystem And Payout Admin Readiness

## Scope

This PR completes the procurement talent ecosystem release slice from payout workflow hardening through admin UAT readiness.

- Payout workflow state transitions and admin review surface.
- Talent admin KYC review and payout summary surface.
- Friendly admin-facing error handling for payout and talent admin actions.
- Basic a11y quick wins for newly added admin pages.
- Controlled lazy split for heavy admin tabs.
- UAT smoke, release readiness, evidence, merge readiness, and final sign-off docs.

## Changed File Groups

- Backend and domain foundation:
  - Talent ecosystem models, routers, schemas, and admin endpoints from earlier phase commits.
- Frontend admin surfaces:
  - Payout admin page and service.
  - Talent admin control page and service.
  - Admin route/nav wiring and controlled lazy loading.
- Release documentation:
  - `docs/runbooks/talent-ecosystem-uat-smoke.md`
  - `docs/runbooks/talent-ecosystem-release-readiness.md`
  - `docs/runbooks/talent-ecosystem-uat-evidence.md`
  - `docs/runbooks/talent-ecosystem-merge-readiness.md`
  - `docs/release/final-signoff.md`

## Test Evidence

- `npm run type-check` in `web/`: PASS
- `npm run build` in `web/`: PASS
- Route/build evidence:
  - `/admin/payout-requests`
  - `/admin/talent-ecosystem`
- Error UX evidence:
  - Payout and talent admin services map backend `detail.code` to friendly Turkish fallback messages.
  - Raw backend detail/message is not surfaced to these admin pages.

## UAT And Runbook Links

- UAT smoke checklist: `docs/runbooks/talent-ecosystem-uat-smoke.md`
- UAT evidence packet: `docs/runbooks/talent-ecosystem-uat-evidence.md`
- Release readiness: `docs/runbooks/talent-ecosystem-release-readiness.md`
- Merge readiness: `docs/runbooks/talent-ecosystem-merge-readiness.md`
- Final sign-off: `docs/release/final-signoff.md`

## Merge Follow-up Checks

1. Confirm CI repeats `npm run type-check` and `npm run build`.
2. Run seeded-data UAT for payout transitions:
   - `pending -> approved -> processing -> paid`
   - `pending -> rejected`
3. Run seeded-data UAT for talent KYC:
   - pending profile approve
   - pending profile reject
4. Confirm friendly error UX in a non-production forbidden/not-found/invalid-transition scenario.
5. Confirm no unrelated dirty files are included in the final merge commit.

## Rollback

Rollback should use commit-based `git revert`, not destructive reset.

- Latest evidence docs: `939f774`
- UAT/release docs: `27eab1f`
- Admin lazy split: `afea4b0`
- Admin hardening: `276afe2`
- Talent admin control: `88607db`
