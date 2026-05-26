# AI BRIEFING — Procurement Talent Network + Procurement Jobs

## Session Meta
- date: 2026-05-26
- branch: feat/final-stabilization
- stream: procurement-talent-network-and-jobs
- mode: multi-phase build

## Current Phase
**PHASE 0 — Discovery + Architecture + Data Model** ✅ COMPLETE

## Completed Steps
- [x] Codebase scan: FastAPI + SQLAlchemy + React/TS, multi-tenant, PostgreSQL
- [x] `api/models/talent.py` — 8 new SQLAlchemy models (TalentProfile, ProcurementJob, JobApplication, ReferralTask, ReferralSubmission, EarningsLedger, PayoutRequest, ReputationEvent)
- [x] `api/models/__init__.py` — all 8 models registered + exported
- [x] `api/core/authz.py` — 4 new system roles + 8 RBAC helper functions added
- [x] Alembic migration `76f4c14237af` — 8 tables applied to local DB (83→91 tables)
- [x] Migration verified: all 8 tables confirmed in PostgreSQL

## In-Progress Step
**PHASE 1 — Auth/RBAC Foundation + API Skeleton**

## Next Atomic Action
Create `api/routers/talent.py` — talent profile CRUD endpoints (GET /me, POST /register, PATCH /me) with RBAC guards.

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
(pending — commit not yet created for this phase)

## Resume Command
```
git checkout feat/final-stabilization
# Read this file, then SESSION_STATE.json
# Start PHASE 1: create api/routers/talent.py
```
