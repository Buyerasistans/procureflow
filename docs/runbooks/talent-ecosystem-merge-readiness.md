# Talent Ecosystem Merge Readiness Checklist

Date: 2026-05-27
Branch: `pr/strict-gate-payment-clean-v2`

## Commit Chain

| Phase | Commit | Scope |
| --- | --- | --- |
| PHASE 4 / atomik-1 | `d3cb28c` | Payout transition state machine extension. |
| PHASE 4 / atomik-2 | `c663fbb` | Payout admin page, service, route, and nav wiring. |
| PHASE 5 / atomik-1 | `88607db` | Talent admin control page, service, backend admin endpoints, finance officer alignment. |
| State fix | `eeccfc0` | Agent state SAFE TO RESUME correction. |
| PHASE 6 / atomik-1 | `276afe2` | Payout/talent admin hardening, friendly error UX, a11y quick wins. |
| PHASE 6 / atomik-2 | `afea4b0` | Controlled lazy split for heavy admin tabs. |
| PHASE 7 / atomik-1 | `27eab1f` | UAT smoke checklist and release readiness docs. |
| PHASE 7 / atomik-2 | TBD | UAT evidence and merge readiness docs. |

## Test Summary

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run type-check` | PASS | `tsc --noEmit` completed successfully. |
| `npm run build` | PASS | `tsc -b && vite build` completed successfully. |
| Route smoke | PASS | `/admin/payout-requests` and `/admin/talent-ecosystem` are registered routes and build successfully. |
| Sanitized error UX | PASS | Services map backend `detail.code` to friendly fallback messages. |
| Manual data-dependent UAT | READY_FOR_UAT | See `docs/runbooks/talent-ecosystem-uat-evidence.md`. |

## Merge Checklist

- [ ] Confirm branch head includes this PHASE 7 / atomik-2 checkpoint.
- [ ] Attach `docs/runbooks/talent-ecosystem-uat-evidence.md` to the PR or release ticket.
- [ ] Attach `docs/runbooks/talent-ecosystem-release-readiness.md` to the PR or release ticket.
- [ ] Confirm no unrelated dirty working-tree files are included in the merge commit.
- [ ] Confirm CI runs `type-check` and build gates.
- [ ] Confirm a platform admin can access both admin routes in the target environment.
- [ ] Confirm seeded payout and KYC test data exists before final manual UAT.

## Risks

- Manual payout and KYC happy-path UAT still requires seeded data in the target environment.
- `User.system_role` remains string-based; future enum hardening is still recommended.
- `ai_match_score` remains a placeholder and is not release-blocking for this workstream.
- Existing unrelated local dirty files must stay out of the release commit.

## Rollback References

Use commit-based rollback only.

- Roll back PHASE 7 docs/evidence:
  - `git revert <phase-7-atomik-2-sha>`
  - `git revert 27eab1f`
- Roll back PHASE 6 perf split:
  - `git revert afea4b0`
- Roll back PHASE 6 hardening:
  - `git revert 276afe2`
- Roll back PHASE 5 talent admin control:
  - `git revert 88607db`

After any rollback:

- [ ] Run `npm run type-check`.
- [ ] Run `npm run build`.
- [ ] Re-run route smoke for `/admin/payout-requests` and `/admin/talent-ecosystem`.
