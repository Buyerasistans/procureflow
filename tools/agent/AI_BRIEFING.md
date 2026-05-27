# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 5 / Atomik-2 - COMPLETE

## Executive Summary

PHASE 5 / Atomik-2 tamamlandı: `candidate_user` `/jobs` üzerinde başvuru yaparken
`TALENT_PROFILE_REQUIRED` hatası aldığında hata mesajı içinde görünür ve tıklanabilir
bir `/talent/profile` linki gösteriliyor. Gate: 19/19 PASS — 360/768/1280 viewport.

G1 (P0) gap kapatıldı.

## Atomik-2 Değişiklikleri

### `web/src/pages/JobsPage.tsx`
- `Link` import eklendi (`react-router-dom`)
- `ApplyForm` içine `profileLinkRequired: boolean` state eklendi
- `handleApply`: her denemede `setProfileLinkRequired(false)` resetlenir
- `TALENT_PROFILE_REQUIRED` durumunda `setProfileLinkRequired(true)` + hata mesajı set edilir
- Hata render: `{error && <div className="jobs-page__error">{error} {profileLinkRequired && <Link ... to="/talent/profile">}</div>}`

### `web/src/pages/JobsPage.css`
- `.jobs-page__error-link` — renk: `#7f1d1d`, `font-weight: 700`, `text-decoration: underline`, `white-space: nowrap`
- `.jobs-page__error-link:hover` — `color: #450a0a`
- `.jobs-page__error-link:focus-visible` — `outline: 2px solid #991b1b; outline-offset: 2px; border-radius: 2px`

### Gate Teknik Notları
- Session injection: `pf_access_token` + `pf_user` JSON string (pattern: atomik4_talent_profile_gate)
- Route mock: **function predicates** (NOT glob strings) — `url.href.includes(...)`
- Catch-all: `localhost:8000 || 127.0.0.1:8000` → `{}`; /auth/me registered last (LIFO = highest priority)
- Base URL: `http://127.0.0.1:5175` (not `localhost:5175`)
- `page.goto(..., { waitUntil: "domcontentloaded" })` + wait for `.app-layout__header` first
- A7 (desktop): `Promise.all([waitForURL, link.click()])` → /talent/profile navigation verified

## Gate Sonuçları

| Gate | Result |
|---|---|
| PHASE 4 Atomik-7 E2E gate | 79/79 PASS |
| PHASE 5 Atomik-1 | Docs only; no code gate |
| PHASE 5 Atomik-2 | 19/19 PASS |

### Atomik-2 Assertion Dağılımı

| Assertion | Açıklama | Viewport |
|---|---|---|
| A1 | Başvur button visible | 360/768/1280 |
| A2 | Error div visible (.apply-form .jobs-page__error) | 360/768/1280 |
| A3 | Error message text correct ("önce talent profilinizi") | 360/768/1280 |
| A4 | /talent/profile link visible (.jobs-page__error-link) | 360/768/1280 |
| A5 | Link href="/talent/profile" | 360/768/1280 |
| A6 | Error block fits within viewport (no overflow) | 360/768/1280 |
| A7 | Link click → /talent/profile navigation | 1280 only |

Total: 6 × 3 + 1 = 19

## Inventory Findings (from Atomik-1)

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

### Frontend — Eksik

| Route / Feature | Gap | Durum |
|---|---|---|
| TALENT_PROFILE_REQUIRED link | G1 | **DONE (Atomik-2)** |
| Job close/fill actions | G2 | Açık |
| /jobs/:id/applications | G3 | Açık |
| /my/applications | G4 | Açık |
| Candidate withdrawal | G5 | Açık |
| /jobs/:id | G6 | Açık |

## Gap Tablosu

| Gap | Açıklama | Öncelik | Durum |
|---|---|---|---|
| G1 | candidate_user TALENT_PROFILE_REQUIRED hatası linksize | P0 | **DONE** |
| G2 | Employer ilan kapatma/dolu işaretleme UI yok | P1 | Açık |
| G3 | Employer başvuru pipeline viewer yok | P1 | Açık |
| G4 | Candidate kendi başvurularını göremez (backend + frontend) | P1 | Açık |
| G5 | Candidate başvuru geri çekme yok (backend + frontend) | P2 | Açık |
| G6 | Job detail page yok (/jobs/:id route) | P2 | Açık |

## PHASE 5 Atomik Backlog

| Atomik | Hedef | Durum |
|---|---|---|
| A1 | Envanter (bu adım) | COMPLETE |
| A2 | G1: candidate UX — TALENT_PROFILE_REQUIRED link | **COMPLETE** |
| A3 | G2: employer ilan durum aksiyonları (kapat/dolu) | Açık |
| A4 | G3: employer başvuru pipeline viewer | Açık |
| A5 | G4 backend: GET /my/applications endpoint | Açık |
| A6 | G4 frontend: candidate başvuru geçmişi UI | Açık |
| A7 | G5: candidate withdrawal (backend + frontend) | Açık |
| A8 | Full PHASE 5 E2E gate + closure | Açık |

## Next Atomic Step

**PHASE 5 / Atomik-3:** Employer — İlan durum aksiyonları (Kapat / Dolu İşaretle)

Kapsam:
- `web/src/services/jobs.service.ts` — `updateJob(id, payload)` ekle
- `web/src/pages/JobsPage.tsx` — `JobCard`'a employer aksiyon butonları: "Kapat" (→ `closed`) + "Dolu İşaretle" (→ `filled`); yalnızca `published` ilanlar için göster; role guard: `canEmployer && !canTalent`
- `web/src/pages/JobsPage.css` — `.job-card__status-actions` stil

Gate: Responsive (360/768/1280) — status button görünürlük + mock PATCH success → badge güncellenir
Commit: `feat(jobs): add employer job close and fill status actions`

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 5 / Atomik-2: COMPLETE — TALENT_PROFILE_REQUIRED link added to ApplyForm, gate 19/19 PASS
Next: PHASE 5 / Atomik-3 — employer job status actions (close/fill).
Runbook: docs/runbooks/posting-application-phase5-plan.md
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
Gate pattern: function predicates (NOT glob), pf_access_token session, 127.0.0.1:5175 base URL.
```

## SAFE TO RESUME
yes
