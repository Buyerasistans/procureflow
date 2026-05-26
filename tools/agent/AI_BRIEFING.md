# AI BRIEFING — Procurement Talent Network + Procurement Jobs

## Session Meta
- date: 2026-05-26
- branch: pr/strict-gate-payment-clean-v2
- stream: procurement-talent-network-and-jobs
- mode: multi-phase build

## Current Phase
**PHASE 3B — Talent Profile Frontend** ✅ COMPLETE

## Completed Steps
- [x] PHASE 0: 8 SQLAlchemy models, Alembic migration 76f4c14237af, RBAC helpers
- [x] PHASE 1: 4 routers (talent, jobs, job_applications, referral_tasks) + schemas + main.py registration
- [x] PHASE 2: earnings router + schemas + masking
- [x] PHASE 3A: JobsPage + jobs.service.ts + /jobs route + nav item
- [x] PHASE 3B: TalentProfilePage + talent.service.ts + /talent/profile route + nav item

## In-Progress Step
**PHASE 4 — Payout Processing OR PHASE 5 — Super Admin Control Center**

## Next Atomic Action
Confirm with user: PHASE 4 (payout processing: processing → paid state + admin workflow) or PHASE 5 (Super Admin control center for talent ecosystem oversight).

## Architecture Decisions Log
1. `TalentProfile` linked 1:1 to existing `User` (not a new user type) — reuses auth infrastructure
2. `ProcurementJob.is_procurement_only=True` always — enforced at model + API + UI levels
3. `EarningsLedger` is append-only (immutable log) — no updates, no deletes; balance computed from ledger
4. `ReferralSubmission` has unique constraint (task_id, submitter_user_id) — prevents double submission
5. `JobApplication` has unique constraint (job_id, applicant_user_id) — prevents double apply
6. New RBAC roles extend existing `system_role` field on `User` model (no schema change needed)
7. Spurious Alembic FK drift stripped from migration — only new tables included

## Open Risks / Blockers
- `User.system_role` field accepts string freely — new talent roles must be validated at API layer until enum migration done
- `ai_match_score` placeholder (NULL for now) — real AI scoring deferred to PHASE 3+
- Bank details in `PayoutRequest.bank_details_json` must be masked before API response — implement in schema layer

## Pending Migrations
- None at this phase. Next migration: PHASE 4 — payout workflow state machine columns (if needed)

## Pending Tests
- RBAC unit tests for `is_talent_member`, `can_approve_payout`, `can_post_procurement_job`
- Integration: talent profile register flow (POST /talent/register → talent_profiles row created)
- Integration: duplicate application guard (uq_job_applicant constraint)

## Rollback Notes
- `alembic downgrade 20260429_add_company_mailbox_team_visibility_toggle` drops all 8 talent tables cleanly
- No existing table modified — rollback is safe

## Files Changed (PHASE 0)
- `api/models/talent.py` — NEW (8 models, ~360 lines)
- `api/models/__init__.py` — UPDATED (import + __all__ for 8 new models)
- `api/core/authz.py` — UPDATED (4 role sets + 8 helper functions added at end)
- `api/alembic/versions/76f4c14237af_add_talent_network_and_procurement_jobs_.py` — NEW migration

## Delivery Phases
| Phase | Status | Description |
|-------|--------|-------------|
| PHASE 0 | ✅ DONE | Data model + RBAC roles + migration |
| PHASE 1 | 🔲 NEXT | Auth/RBAC foundation + API skeleton (talent + jobs routers) |
| PHASE 2 | 🔲 TODO | Talent Network backend/frontend |
| PHASE 3 | 🔲 TODO | Procurement Jobs backend/frontend |
| PHASE 4 | 🔲 TODO | Earnings/Payout/Dispute engine |
| PHASE 5 | 🔲 TODO | Super Admin control center |
| PHASE 6 | 🔲 TODO | Hardening (security/perf/a11y) |
| PHASE 7 | 🔲 TODO | UAT + docs + go-live checklist |

## Last Successful Commit SHA
735dbda (PHASE 3B: Talent Profile frontend — service + page + route + nav item)

## Resume Command
```
git checkout pr/strict-gate-payment-clean-v2
# Read this file, then SESSION_STATE.json
# PHASE 3B complete. Next: PHASE 4 or PHASE 5 (confirm with user)
```

## SAFE TO RESUME: yes
