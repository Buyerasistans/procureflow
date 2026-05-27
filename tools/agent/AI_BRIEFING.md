# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 5 / Atomik-3 - COMPLETE

## Executive Summary

PHASE 5 / Atomik-3 tamamlandı: `employer_company_admin` kullanıcıları `/jobs` üzerinde
`published` durumundaki ilanları "Kapat" (→ `closed`) veya "Dolu İşaretle" (→ `filled`)
butonları ile güncelleyebiliyor. Candidate regression korunuyor. Gate: 17/17 PASS.

G2 (P1) gap kapatıldı.

## Atomik-3 Değişiklikleri

### `web/src/services/jobs.service.ts`
- `JobUpdatePayload` interface eklendi (`status?: string` dahil)
- `updateJob(jobId, payload): Promise<ProcurementJob>` — `http.patch<ProcurementJob>(\`/jobs/${jobId}\`, payload)`

### `web/src/pages/JobsPage.tsx`
- `updateJob` import'a eklendi
- `JobCardProps` interface'e `updatingJobId: number | null` + `onStatusUpdate: (jobId, status) => void` eklendi
- `JobCard`'a `const isUpdating = updatingJobId === job.id` eklendi
- `canEmployer && !canTalent && job.status === "published"` guard altında `<div className="job-card__status-actions">` render edildi
- `.jobs-page__btn--status-close` (Kapat) + `.jobs-page__btn--status-fill` (Dolu İşaretle) butonları; `disabled={isUpdating}`
- `JobsPage`: `updatingJobId` state + `handleStatusUpdate(jobId, newStatus)` — PATCH → optimistic `setJobs` merge
- `JobCard` kullanımında `updatingJobId={updatingJobId}` + `onStatusUpdate={handleStatusUpdate}` geçildi

### `web/src/pages/JobsPage.css`
- `.job-card__status-actions` — `display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap`
- `.jobs-page__btn--status-close` — kırmızı (#dc2626); hover #b91c1c; focus-visible outline
- `.jobs-page__btn--status-fill` — mor (#7c3aed); hover #6d28d9; focus-visible outline
- Disabled: `opacity: 0.5; cursor: not-allowed`

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

### Gate Teknik Notları (her iki atomik için geçerli)
- Session injection: `pf_access_token` + `pf_user` JSON string (pattern: atomik4_talent_profile_gate)
- Route mock: **function predicates** (NOT glob strings) — `url.href.includes(...)`
- Catch-all: `localhost:8000 || 127.0.0.1:8000` → `{}`; /auth/me registered last (LIFO = highest priority)
- Base URL: `http://127.0.0.1:5175` (not `localhost:5175`)
- `page.goto(..., { waitUntil: "domcontentloaded" })` + wait for `.app-layout__header` first
- Atomik-3: `/api/v1/jobs` tek route handler — method check: PATCH → updated job, GET → list

## Gate Sonuçları

| Gate | Result |
|---|---|
| PHASE 4 Atomik-7 E2E gate | 79/79 PASS |
| PHASE 5 Atomik-1 | Docs only; no code gate |
| PHASE 5 Atomik-2 | 19/19 PASS |
| PHASE 5 Atomik-3 | 17/17 PASS |

### Atomik-3 Assertion Dağılımı

| Scenario | Assertions | Açıklama |
|---|---|---|
| A (×3 viewport) | 9 | Employer butonları görünür + no overflow — 360/768/1280 |
| B | 3 | "Kapat" → PATCH closed → badge "closed", butonlar yok |
| C | 3 | "Dolu İşaretle" → PATCH filled → badge "filled", butonlar yok |
| D | 2 | candidate_user: status-actions yok, "Başvur" intact |

Total: 9 + 3 + 3 + 2 = 17

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
| Job close/fill actions | G2 | **DONE (Atomik-3)** |
| /jobs/:id/applications | G3 | Açık |
| /my/applications | G4 | Açık |
| Candidate withdrawal | G5 | Açık |
| /jobs/:id | G6 | Açık |

## Gap Tablosu

| Gap | Açıklama | Öncelik | Durum |
|---|---|---|---|
| G1 | candidate_user TALENT_PROFILE_REQUIRED hatası linksize | P0 | **DONE** |
| G2 | Employer ilan kapatma/dolu işaretleme UI yok | P1 | **DONE** |
| G3 | Employer başvuru pipeline viewer yok | P1 | Açık |
| G4 | Candidate kendi başvurularını göremez (backend + frontend) | P1 | Açık |
| G5 | Candidate başvuru geri çekme yok (backend + frontend) | P2 | Açık |
| G6 | Job detail page yok (/jobs/:id route) | P2 | Açık |

## PHASE 5 Atomik Backlog

| Atomik | Hedef | Durum |
|---|---|---|
| A1 | Envanter (bu adım) | COMPLETE |
| A2 | G1: candidate UX — TALENT_PROFILE_REQUIRED link | **COMPLETE** |
| A3 | G2: employer ilan durum aksiyonları (kapat/dolu) | **COMPLETE** |
| A4 | G3: employer başvuru pipeline viewer | Açık |
| A5 | G4 backend: GET /my/applications endpoint | Açık |
| A6 | G4 frontend: candidate başvuru geçmişi UI | Açık |
| A7 | G5: candidate withdrawal (backend + frontend) | Açık |
| A8 | Full PHASE 5 E2E gate + closure | Açık |

## Next Atomic Step

**PHASE 5 / Atomik-4:** Employer — Başvuru pipeline görüntüleyici (G3)

Kapsam:
- `web/src/services/jobs.service.ts` — `listApplications(jobId)`, `updateApplicationStatus(appId, payload)` ekle
- `web/src/pages/JobsPage.tsx` — `JobCard`'a "Başvurular" toggle veya inline `ApplicationsPipeline` bölümü; başvuru satırlarında durum badge + geçiş butonları
- `web/src/pages/JobsPage.css` — pipeline tablo/kart stilleri

Gate: Responsive (360/768/1280) — employer session mock, başvuru listesi görünür, durum geçiş butonu çalışır
Commit: `feat(jobs): add employer application pipeline viewer`

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 5 / Atomik-3: COMPLETE — employer Kapat/Dolu Isaretle buttons on published jobs, gate 17/17 PASS
Next: PHASE 5 / Atomik-4 — employer application pipeline viewer (G3).
Runbook: docs/runbooks/posting-application-phase5-plan.md
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
Gate pattern: function predicates (NOT glob), pf_access_token session, 127.0.0.1:5175 base URL.
```

## SAFE TO RESUME
yes
