# AI Briefing

## Session Meta
- date: 2026-05-27
- branch: pr/strict-gate-payment-clean-v2
- stream: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
- mode: long-running atomic program

## Current Phase
PHASE 5 — CLOSED (Atomik-8 COMPLETE)

## Executive Summary

**PHASE 5 CLOSED.** Atomik-8 tamamlandı: Full PHASE 5 E2E gate (16/16 PASS).
G1–G5 tümü doğrulandı tek gate ile; üretim koduna dokunulmadı.
G6 (job detail page /jobs/:id) sonraki faza (PHASE 6) ertelendi.
Sonraki adım: PHASE 6 / Atomik-1 (surface inventory + backlog definition).

## Atomik-8 Değişiklikleri

### `tools/atomik8_phase5_e2e_gate.mjs`
- 16 assertion, 7 senaryo (A–G); hiçbir üretim dosyası değiştirilmedi
- 2 context factory: `makeEmployerContext({ jobPatchStatus, appPatchStatus })`, `makeCandidateContext({ applyError, myApps, withdrawResponse })`
- LIFO stack: catch-all → /api/v1/jobs → /api/v1/jobs/*/applications → (conditional) /api/v1/applications/*/status|withdraw → /auth/refresh → /auth/me
- Scenario A (2): G1 — apply error → TALENT_PROFILE_REQUIRED message + /talent/profile link [1280]
- Scenario B (2): G2 — Kapat → PATCH closed → badge `job-card__badge--closed` [1280]
- Scenario C (3): G3 — pipeline toggle → rows → advance → badge `application-status-badge--shortlisted` [1280]
- Scenario D (2): G4 — `jobs-page__my-applications` visible + 3 `my-application-row` [1280]
- Scenario E (2): G5 — `my-application-row__btn--withdraw` visible + click → badge `application-status-badge--withdrawn` [1280]
- Scenario F (2): Regression — employer no candidate section; candidate no pipeline toggle [1280]
- Scenario G (3): Responsive — `jobs-page__my-applications` fits within 360/768/1280
- Fix: `myApps ?? []` default in `makeCandidateContext` prevents `{}.map()` crash from catch-all returning `{}`
- Artifacts: `tools/gate-artifacts/atomik8-phase5-full/`

### `docs/runbooks/posting-application-phase5-plan.md`
- Atomik-8 COMPLETE bölümü eklendi (gate results, file list, quality gates)
- PHASE 5 CLOSED notu eklendi

## Atomik-7 Değişiklikleri

### `api/routers/job_applications.py`
- `_WITHDRAWABLE_STATUSES = frozenset({"applied", "shortlisted", "interview"})` eklendi
- `POST /applications/{application_id}/withdraw` endpoint eklendi
  - Guard: `is_talent_member` → False → 403 WITHDRAW_FORBIDDEN
  - Ownership: `applicant_user_id != current_user.id` → 403 WITHDRAW_OWNERSHIP
  - Status check: status not in WITHDRAWABLE → 400 WITHDRAW_INVALID_STATUS
  - Success: `application.status = "withdrawn"` → commit → refresh → `JobApplicationOut`

### `api/tests/test_job_applications.py`
- 8 yeni test eklendi (toplam 19/19 PASS)
- `_call_withdraw()` helper fonksiyonu eklendi
- `TestWithdrawApplicationSuccess` (3 test): applied/shortlisted/interview → withdrawn
- `TestWithdrawApplicationInvalidStatus` (3 test): offered/rejected/withdrawn → 400
- `TestWithdrawApplicationOwnership` (1 test): other user's app → 403 WITHDRAW_OWNERSHIP
- `TestWithdrawApplicationEmployerForbidden` (1 test): employer → 403 WITHDRAW_FORBIDDEN

### `web/src/services/jobs.service.ts`
- `withdrawApplication(applicationId)` eklendi: `POST /applications/{id}/withdraw` → `Promise<JobApplicationOut>`

### `web/src/pages/JobsPage.tsx`
- `withdrawApplication` import eklendi
- `WITHDRAWABLE_STATUSES = new Set(["applied", "shortlisted", "interview"])` — module-level
- `withdrawingApplicationId` state eklendi
- `handleWithdraw(applicationId)` handler: POST → optimistic `setMyApplications` map update
- "Başvurularım" satırına `{WITHDRAWABLE_STATUSES.has(app.status) && <button ...>Geri Çek</button>}` eklendi

### `web/src/pages/JobsPage.css`
- `.my-application-row__actions` — margin-top: 6px
- `.my-application-row__btn--withdraw` — red (#991b1b), hover, disabled, focus-visible

### `tools/atomik7_candidate_withdrawal_gate.mjs`
- 11 assertion, 5 senaryo
- LIFO: catch-all → /api/v1/jobs → /api/v1/my/applications → /api/v1/applications/*/withdraw → /auth/refresh → /auth/me
- Artifacts: `tools/gate-artifacts/atomik7-candidate-withdrawal/`

### Withdrawal Contract
| Alan | Değer |
|---|---|
| Path | `POST /api/v1/applications/{id}/withdraw` |
| Auth guard | `is_talent_member` |
| Ownership | `applicant_user_id == current_user.id` |
| Withdrawable | applied, shortlisted, interview |
| Terminal (400) | offered, rejected, withdrawn |
| Response | `JobApplicationOut` (status: "withdrawn") |

## Atomik-6 Değişiklikleri

### `web/src/services/jobs.service.ts`
- `getMyApplications()` eklendi: `GET /my/applications` → `Promise<JobApplicationOut[]>`

### `web/src/pages/JobsPage.tsx`
- Import: `getMyApplications` eklendi
- State: `myApplications`, `myApplicationsLoading`, `myApplicationsError` eklendi
- `useEffect`: `canTalent && !canEmployer` guard → mount'ta `getMyApplications()` fetch
- Render: job listesinin üstünde `<section className="jobs-page__my-applications">` eklendi
  - Loading / error / empty / list state'leri
  - Her satır: `my-application-row` — İlan #{job_id}, status badge, applied_at, updated_at, employer_note
  - Status badge: mevcut `application-status-badge--{status}` sınıflarını kullanıyor

### `web/src/pages/JobsPage.css`
- `.jobs-page__my-applications` — section container, overflow-x: hidden
- `.jobs-page__my-applications-title`, `.jobs-page__my-applications-empty`
- `.my-application-row`, `.my-application-row__info`, `.my-application-row__job`
- `.my-application-row__date`, `.my-application-row__note`

### `tools/atomik6_candidate_application_history_gate.mjs`
- Yeni gate script — 14 assertion, 6 senaryo
- LIFO stack: catch-all → /api/v1/jobs → /api/v1/my/applications → /auth/refresh → /auth/me
- Artifacts: `tools/gate-artifacts/atomik6-candidate-application-history/`

### Visibility Rules
| Role | canTalent | canEmployer | Bölüm görünür? |
|---|---|---|---|
| candidate_user | true | false | ✓ |
| talent_member | true | false | ✓ |
| employer_company_admin | false | true | ✗ |
| employer_recruiter | false | true | ✗ |
| super_admin | true | true | ✗ (canEmployer=true bloklar) |

## Atomik-5 Değişiklikleri

### `api/routers/job_applications.py`
- `GET /my/applications` endpoint eklendi (yeni)
- Guard: `is_talent_member(current_user)` — False → 403 MY_APPLICATIONS_FORBIDDEN
- Filter: `JobApplication.applicant_user_id == current_user.id`
- Order: `JobApplication.applied_at.desc()`
- Response: `list[JobApplicationOut]` (boşsa `[]`, 404 değil)

### `api/tests/test_job_applications.py`
- Yeni dosya — 11 test, 4 senaryo
- Senaryo A (4): candidate_user ve talent_member başvurularını alır; alanlar doğru; çoklu
- Senaryo B (2): DB filter çağrısı doğrulanıyor; yanlış user_id → boş liste
- Senaryo C (3): employer_company_admin ve employer_recruiter 403; hata kodu MY_APPLICATIONS_FORBIDDEN
- Senaryo D (2): başvuru yok → 200 + [] (not None, not 404)
- Test pattern: MagicMock DB + `_FakeApplication` attribute bag (from_attributes=True uyumlu)

### Endpoint Contract

| Alan | Değer |
|---|---|
| Path | `GET /api/v1/my/applications` |
| Auth guard | `is_talent_member` (candidate_user, talent_member) |
| Forbidden | employer_company_admin, employer_recruiter → 403 MY_APPLICATIONS_FORBIDDEN |
| Filter | `JobApplication.applicant_user_id == current_user.id` |
| Order | `applied_at DESC` |
| Response | `list[JobApplicationOut]` |
| Empty | 200 + `[]` |

## Atomik-4 Değişiklikleri

### `web/src/services/jobs.service.ts`
- `JobApplicationOut` interface'e eksik alanlar eklendi: `ai_match_score`, `employer_note`, `reviewed_by_user_id`, `reviewed_at`, `updated_at`
- `ApplicationStatusUpdatePayload` interface eklendi: `{ status: string; employer_note?: string }`
- `listApplications(jobId)` — `GET /jobs/${jobId}/applications` → `JobApplicationOut[]`
- `updateApplicationStatus(applicationId, payload)` — `PATCH /applications/${applicationId}/status` → `JobApplicationOut`

### `web/src/pages/JobsPage.tsx`
- `STATUS_TRANSITIONS: Record<string, string[]>` — state machine (applied→shortlisted/rejected, shortlisted→interview/rejected, interview→offered/rejected, offered→rejected, terminal: rejected/withdrawn)
- `TRANSITION_LABELS: Record<string, string>` — shortlisted=Listele, interview=Mülakata Al, offered=Teklif Ver, rejected=Reddet
- `JobCardProps` genişletildi: +6 prop (openApplicationsJobId, applicationsMap, loadingApplicationsJobId, updatingApplicationId, onToggleApplications, onUpdateApplicationStatus)
- `JobCard`'a pipeline bölümü eklendi: `canEmployer && !canTalent` guard; toggle button (`.job-card__applications-toggle`); açıkken `.job-card__applications` container; loading/empty/rows; her satırda `.application-row__info` + `.application-actions`
- `JobsPage` state: +4 (openApplicationsJobId, applicationsMap `Partial<Record<number, JobApplicationOut[]>>`, loadingApplicationsJobId, updatingApplicationId)
- `handleToggleApplications(jobId)` — toggle open/close; cache kontrolü (map'te varsa fetch yok); LIFO catch: setOpenApplicationsJobId(null)
- `handleUpdateApplicationStatus(applicationId, newStatus, jobId)` — PATCH → optimistic map update: `prev[jobId].map(a => a.id === updated.id ? updated : a)`

### `web/src/pages/JobsPage.css`
- `.job-card__applications-toggle` — toggle button margin
- `.job-card__applications` — flex column, gap 8px, overflow-x hidden
- `.application-row` — bordered card, flex column
- `.application-row__info` — flex wrap, gap 8px
- `.application-status-badge` + varyantlar (applied=mavi, shortlisted=sarı, interview=mor, offered=yeşil, rejected=kırmızı, withdrawn=gri)
- `.application-actions`, `.application-actions__btn--advance` (yeşil), `.application-actions__btn--reject` (kırmızı-şeffaf)

### Gate Teknik Notları (Atomik-4)
- Route sırası: catch-all → /api/v1/jobs → /api/v1/jobs/42/applications (daha yüksek LIFO önceliği) → /api/v1/applications/ → /auth/refresh → /auth/me
- `/api/v1/jobs/42/applications` her iki URL pattern'ı da eşleşir ama LIFO nedeniyle daha spesifik olan önce işlenir
- Scenario D: `.application-actions__btn--advance` click → PATCH mock → `waitForFunction` badge === "shortlisted"

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
| PHASE 5 Atomik-4 | 15/15 PASS |
| PHASE 5 Atomik-5 | 11/11 PASS (backend unit tests) |
| PHASE 5 Atomik-6 | 14/14 PASS (E2E — candidate UI, employer regression, 3 viewports) |
| PHASE 5 Atomik-7 | 11/11 PASS (E2E — withdrawal click, terminal guard, employer regression, 3 viewports); backend 19/19 |
| PHASE 5 Atomik-8 | 16/16 PASS (Full Phase 5 gate — G1-G5 + regression + responsive 360/768/1280) |

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
| /jobs/:id/applications | G3 | **DONE (Atomik-4)** |
| /my/applications | G4 | **DONE (Atomik-6)** |
| Candidate withdrawal | G5 | **DONE (Atomik-7)** |
| /jobs/:id | G6 | Açık |

## Gap Tablosu

| Gap | Açıklama | Öncelik | Durum |
|---|---|---|---|
| G1 | candidate_user TALENT_PROFILE_REQUIRED hatası linksize | P0 | **DONE** |
| G2 | Employer ilan kapatma/dolu işaretleme UI yok | P1 | **DONE** |
| G3 | Employer başvuru pipeline viewer yok | P1 | **DONE** |
| G4 | Candidate kendi başvurularını göremez (backend + frontend) | P1 | **DONE** |
| G5 | Candidate başvuru geri çekme yok (backend + frontend) | P2 | **DONE** |
| G6 | Job detail page yok (/jobs/:id route) | P2 | Açık |

## PHASE 5 Atomik Backlog

| Atomik | Hedef | Durum |
|---|---|---|
| A1 | Envanter (bu adım) | COMPLETE |
| A2 | G1: candidate UX — TALENT_PROFILE_REQUIRED link | **COMPLETE** |
| A3 | G2: employer ilan durum aksiyonları (kapat/dolu) | **COMPLETE** |
| A4 | G3: employer başvuru pipeline viewer | **COMPLETE** |
| A5 | G4 backend: GET /my/applications endpoint | **COMPLETE** |
| A6 | G4 frontend: candidate başvuru geçmişi UI | **COMPLETE** |
| A7 | G5: candidate withdrawal (backend + frontend) | **COMPLETE** |
| A8 | Full PHASE 5 E2E gate + closure | **COMPLETE** |

## Next Atomic Step

**PHASE 6 / Atomik-1:** Surface inventory + backlog definition

PHASE 5 tamamen kapatıldı. PHASE 6 başlıyor.
Kapsam (Atomik-1 her zaman docs-only, commit yok):
- PHASE 6 scope belirleme: G6 (job detail page /jobs/:id) + diğer açık yüzeyler
- Surface inventory: route eksikleri, backend endpoint boşlukları
- PHASE 6 backlog tanımı + AI_BRIEFING.md güncelleme

## RESUME BLOCK

```text
Program: NAV_GOVERNANCE_AND_JOB_MARKETPLACE
Branch: pr/strict-gate-payment-clean-v2
PHASE 5: CLOSED — G1-G5 tümü tamamlandı, gate 16/16 PASS (Atomik-8, commit: next)
Next: PHASE 6 / Atomik-1 — surface inventory + backlog definition (docs-only, no commit).
Runbook: docs/runbooks/posting-application-phase5-plan.md (CLOSED)
Instruction: Read tools/agent/AI_BRIEFING.md and tools/agent/SESSION_STATE.json first.
Keep unrelated dirty/untracked files untouched. One atomic step only.
Gate pattern: function predicates (NOT glob), pf_access_token session, 127.0.0.1:5175 base URL.
G6 (job detail page /jobs/:id) deferred — fetchJob service exists, route/page missing.
```

## SAFE TO RESUME
yes
