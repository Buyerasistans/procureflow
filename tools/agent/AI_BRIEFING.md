# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 5 / Atomik-1 - COMPLETE

## Executive Summary

PHASE 5 / Atomik-1 tamamlandı: posting/application lifecycle yüzeyleri envanteri
ve gap analizi yapıldı, 6 gap (G1-G6) tespit edildi, 8 atomik backlog maddesi
tanımlandı. Runbook: `docs/runbooks/posting-application-phase5-plan.md`.

No code change; test rerun not required.

## Inventory Findings

### Backend — Mevcut Endpoints

| Endpoint | Yetki |
|---|---|
| POST /jobs | employer_company_admin, employer_recruiter, tenant_admin, platform_staff, super_admin |
| GET /jobs | Tüm authenticated (scope-aware) |
| GET /jobs/{id} | Tüm authenticated (scope-aware, view_count++) |
| PATCH /jobs/{id} | Poster veya broad admin |
| POST /jobs/{job_id}/apply | talent_member, candidate_user |
| GET /jobs/{job_id}/applications | Employer, tenant-aware |
| PATCH /applications/{id}/status | Employer, tenant-aware |

### Backend — Eksik Endpoints

| Endpoint | Gap |
|---|---|
| GET /my/applications | G4 — candidate başvuru geçmişi |
| POST /applications/{id}/withdraw | G5 — candidate withdrawal |

### Job Status State Machine

```
draft → published → closed
                 → filled
```
Create: yalnızca `draft | published`. Update: `draft | published | closed | filled`.

### Application Status State Machine (employer-side)

```
applied → shortlisted | rejected
shortlisted → interview | rejected
interview → offered | rejected
offered → rejected
rejected → (terminal)
withdrawn → (terminal)  ← model var, candidate endpoint yok
```

### Frontend — Mevcut Routes

| Route | Sayfa | Durum |
|---|---|---|
| /jobs | JobsPage.tsx | MEVCUT — create + list + apply |
| /talent/profile | TalentProfilePage.tsx | MEVCUT — profile create/edit + earnings |
| /admin/talent-ecosystem | TalentAdminControlPage.tsx | MEVCUT — admin |

### Frontend — Eksik

| Route / Feature | Gap |
|---|---|
| /jobs/:id | G6 — job detail page (fetchJob servisi var, sayfa yok) |
| /jobs/:id/applications | G3 — employer pipeline viewer |
| /my/applications | G4 — candidate application history |
| Job close/fill actions | G2 — employer job status actions |
| TALENT_PROFILE_REQUIRED link | G1 — candidate UX |

## Gap Tablosu

| Gap | Açıklama | Öncelik |
|---|---|---|
| G1 | candidate_user TALENT_PROFILE_REQUIRED hatası linksize | P0 |
| G2 | Employer ilan kapatma/dolu işaretleme UI yok | P1 |
| G3 | Employer başvuru pipeline viewer yok | P1 |
| G4 | Candidate kendi başvurularını göremez (backend + frontend) | P1 |
| G5 | Candidate başvuru geri çekme yok (backend + frontend) | P2 |
| G6 | Job detail page yok (/jobs/:id route) | P2 |

## PHASE 5 Atomik Backlog

| Atomik | Hedef | Risk | Bağımlılık |
|---|---|---|---|
| A1 | Envanter (bu adım) | — | — |
| A2 | G1: candidate UX — TALENT_PROFILE_REQUIRED link | Düşük | Yok |
| A3 | G2: employer ilan durum aksiyonları (kapat/dolu) | Orta | Yok |
| A4 | G3: employer başvuru pipeline viewer | Yüksek | A3 ile paralel |
| A5 | G4 backend: GET /my/applications endpoint | Düşük | Yok |
| A6 | G4 frontend: candidate başvuru geçmişi UI | Orta | A5 |
| A7 | G5: candidate withdrawal (backend + frontend) | Orta | A5+A6 |
| A8 | Full PHASE 5 E2E gate + closure | — | Tümü |

## Kritik Tasarım Kararları (Atomik-7'e bırakıldı)

- Withdrawal sonrası re-apply: unique constraint kaldırılacak mı?
- Job detail page scope: okuma odaklı mı, düzenleme panelli mi?
- Application pipeline: JobCard toggle mı, /jobs/:id/applications route mu?

## Gates Passed

| Gate | Result |
|---|---|
| PHASE 4 Atomik-7 E2E gate | 79/79 PASS |
| PHASE 5 Atomik-1 | Docs only; no code gate |

## Open Risks

- `api/routers/onboarding_router.py` dirty (unrelated) — not touched.
- candidate_user → TalentProfile uyumsuzluğu (G1 hızlı kapanacak, A2).
- Withdrawal unique constraint (open design question, A7).
- Responsive risk: başvuru tabloları 360px'de overflow yapabilir (A4/A6'da gate).

## Next Atomic Step

**PHASE 5 / Atomik-2:** Candidate UX fix — `TALENT_PROFILE_REQUIRED` hatası
`/talent/profile`'a link içermeli.

Kapsam: `web/src/pages/JobsPage.tsx` — `ApplyForm`'da hata kodu ayrımı + Link.
Risk: Düşük. 1 dosya.
Gate: Responsive 360/768/1280 — hata görünürlüğü + link varlığı.
Commit: `fix(jobs): add talent profile link on TALENT_PROFILE_REQUIRED apply error`

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 5 / Atomik-1: COMPLETE — posting/application lifecycle inventory done
Next: PHASE 5 / Atomik-2 — candidate UX: TALENT_PROFILE_REQUIRED error link.
Runbook: docs/runbooks/posting-application-phase5-plan.md
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
```

## SAFE TO RESUME
yes
