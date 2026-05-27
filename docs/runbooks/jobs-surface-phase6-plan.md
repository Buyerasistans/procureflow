# PHASE 6 Plan — Job Detail Page & Surface Completion

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`
Atomik-1 inventory date: 2026-05-27
Branch: pr/strict-gate-payment-clean-v2
Predecessor: PHASE 5 (CLOSED 2026-05-27) — G1–G5 tümü tamamlandı

---

## 1. Kapsam

PHASE 6, PHASE 5'te bilinçli olarak ertelenen G6 boşluğunu kapatır ve
iş ilanı yüzeyini tamamlar: job detail page + list entry points.

### Neden G6 Önce?

- Backend `GET /jobs/{job_id}` tamamen hazır (view_count++ dahil).
- Service `fetchJob(id)` zaten `jobs.service.ts`'de mevcut, hiç kullanılmıyor.
- Candidate "Başvurularım" bölümünde `İlan #{job_id}` plain text — tıklanabilir olması gerekiyor.
- JobsPage kart başlıkları link değil — detay sayfasına giriş noktası yok.

### Kapsam Dışı (bu fazda)

- Job arama/filtreleme UI (G7) — backend param'ları hazır, UI ertelendi
- Employer ilan düzenleme formu (PATCH /jobs/{id} UI zenginleştirme)
- Aday ilanı favorileme/kaydetme
- Email bildirimleri

---

## 2. Gap Analizi

### G6 — Job Detail Page (`/jobs/:id`)

**Mevcut durum:**

| Bileşen | Durum |
|---|---|
| Backend `GET /jobs/{job_id}` | HAZIR — `view_count++`, scope-aware, 404 JOB_NOT_FOUND |
| Frontend `fetchJob(id: number)` | MEVCUT — `jobs.service.ts:123`, hiç kullanılmıyor |
| `/jobs/:id` route (App.tsx) | YOK |
| `JobDetailPage.tsx` | YOK |
| Kart başlığı linki (JobsPage) | YOK — `<p className="job-card__title">` plain text |
| Candidate history linki | YOK — `İlan #{app.job_id}` plain text |

**Kullanıcı etkisi:**

- İlan başlığına tıklama hiçbir şey yapmıyor.
- Candidate "Başvurularım" bölümünde hangi ilana başvurduğu açıklamasız (sadece ID).
- İlanın tam açıklamasını, gereksinimlerini, şartlarını görmek için yer yok.
- Employer ilana ait tüm başvuruları tek yerden yönetemiyor (şu an liste görünümünde inline).

**Kabul kriterleri (Acceptance Criteria):**

1. `GET /jobs/:id` → `JobDetailPage` render edilir.
2. Sayfa: ilan başlığı, açıklaması, kategori, istihdam tipi, konum, maaş (varsa), tarih.
3. Candidate (canTalent && !canEmployer): "Başvur" CTA — inline ApplyForm (JobsPage ile aynı logic).
4. Employer (canEmployer && !canTalent): "Kapat" / "Dolu İşaretle" butonları (mevcut JobsPage logic).
5. JobsPage kart başlığı → `<Link to={/jobs/${job.id}}>` linki.
6. Candidate history satırı → `İlan #42` → `<Link to={/jobs/${app.job_id}}>`.
7. Responsive: 360/768/1280 — içerik taşmıyor.
8. E2E gate 16+ assertion PASS.

**Bağımlılıklar:**

- Hiçbir yeni backend endpoint gerekmez.
- `fetchJob(id)` import + kullanım — sadece `JobDetailPage.tsx`'te.
- `applyToJob`, `updateJob` — mevcut servisler, yeni sayfada da kullanılacak.

---

## 3. PHASE 6 Atomik Backlog

| Atomik | Hedef | Durum |
|---|---|---|
| A1 | Surface inventory + backlog definition (bu adım) | COMPLETE (no commit) |
| A2 | `JobDetailPage.tsx` shell + `/jobs/:id` route | Açık |
| A3 | Job info render + candidate apply CTA | Açık |
| A4 | Employer actions (close/fill) on detail page | Açık |
| A5 | Entry points: list card title link + history row link | Açık |
| A6 | Full PHASE 6 E2E gate + closure | Açık |

### Atomik-1: Surface inventory (bu adım) — COMPLETE (no commit)

**Amaç:** G6 boşluğunu belgele. PHASE 6 backlog tanımla.
**Çıktı:** Bu dosya + AI_BRIEFING.md + SESSION_STATE.json güncellemesi.

---

### Atomik-2: `JobDetailPage` shell + route — COMPLETE

**Amaç:** Sayfanın iskeleti ve route kaydı.

**Dosyalar (tamamlandı):**
- `web/src/pages/JobDetailPage.tsx` — YENİ
  - `useParams<{ id: string }>()` → `jobId = Number(id)`
  - `!id || isNaN(jobId) || jobId <= 0` guard → kullanıcı dostu hata
  - `useEffect` → `fetchJob(jobId)` → `setJob(data)` / loading / error state
  - Loading / error / not-found state'leri
  - Job başlık, meta badge'leri (status, employment_type, location_type, category, şehir/ülke), application_count + view_count
  - Açıklama: `white-space: pre-wrap; overflow-wrap: break-word`
- `web/src/pages/JobDetailPage.css` — YENİ
  - Selector'lar: `.job-detail`, `.job-detail__title`, `.job-detail__meta`, `.job-detail__badge`, `.job-detail__badge--{status}`, `.job-detail__meta-count`, `.job-detail__desc`, `.job-detail__loading`, `.job-detail__error`
  - Mobil uyumlu: `flex-wrap: wrap`, `overflow-wrap: break-word`
- `web/src/App.tsx` — `JobDetailPage` lazy import (line 46) + `<Route path="/jobs/:id">` (ProtectedRoute > AppLayout, `/jobs`'ın hemen altında)

**Kalite gateleri:**
- `npm run type-check` → 0 error
- `npm run build` → ✓

**Gate:** Atomik-2 bireysel gate yok — Atomik-6 full gate'e dahil.

---

### Atomik-3: Candidate apply CTA on detail page — COMPLETE

**Amaç:** Candidate `/jobs/:id`'de de başvurabilsin.

**Tamamlanan değişiklikler:**
- `web/src/pages/JobDetailPage.tsx` — `isEmployerAdmin` + `isTalentMember` role helpers eklendi; `useAuth` import; `canTalent && !canEmployer && job.status === "published"` guard; inline apply form (cover letter textarea, submit button, error/success states); DUPLICATE_APPLICATION / TALENT_PROFILE_REQUIRED / JOB_NOT_PUBLISHED error code handling; `/talent/profile` Link.
- `web/src/pages/JobDetailPage.css` — `.job-detail__apply*` selector seti: apply container, label, textarea (focus-visible outline), actions row, primary button (hover/disabled/focus-visible), error box, error-link, success box; `@media (max-width: 600px)` mobil uyum.

**Kalite gateleri:**
- `npm run type-check` → 0 error
- `npm run build` → ✓

**Commit:** `feat(jobs): add candidate apply cta on job detail page`

---

### Atomik-4: Employer actions on detail page — COMPLETE

**Amaç:** Employer `/jobs/:id`'de kapat / dolu işaretle yapabilsin.

**Tamamlanan değişiklikler:**
- `web/src/pages/JobDetailPage.tsx` — `canEmployer && !canTalent && job.status === "published"` guard; `updatingStatus: "closed" | "filled" | null` state; `statusError: string | null` state; `handleStatusUpdate(newStatus)` async function (`updateJob` → `setJob(updated)`); iki buton (Kapat/Dolu İşaretle), her ikisi `disabled={updatingStatus !== null}` sırasında; hata varsa `.job-detail__status-error` banner.
- `web/src/pages/JobDetailPage.css` — `.job-detail__actions` flex container; `.job-detail__action-btn` base; `.job-detail__action-btn--close` (kırmızı #fee2e2/#991b1b); `.job-detail__action-btn--fill` (mavi #e0e7ff/#3730a3); `.job-detail__status-error`; `@media (max-width: 600px)` column layout.

**Kalite gateleri:**
- `npm run type-check` → 0 error
- `npm run build` → ✓

**Commit:** `feat(jobs): add employer status actions on job detail page`

---

### Atomik-5: Entry points (links from list + history) — COMPLETE

**Amaç:** Kullanıcı `/jobs/:id`'e navigasyon yapabilsin.

**Tamamlanan değişiklikler:**
- `web/src/pages/JobsPage.tsx` — `JobCard` içinde `<p className="job-card__title">` → `<Link to={/jobs/${job.id}} className="job-card__title">` (Link zaten importlu)
- `web/src/pages/JobsPage.tsx` — candidate history satırı: `<span className="my-application-row__job">` → `<Link to={/jobs/${app.job_id}} className="my-application-row__job">`
- `web/src/pages/JobsPage.css` — `.job-card__title`: `display: block` eklendi (p→a layout koruma); `text-decoration: none`; hover `#0f6e57`; focus-visible outline
- `web/src/pages/JobsPage.css` — `.my-application-row__job`: `text-decoration: none`; hover `#0f6e57` + underline; focus-visible outline

**Kalite gateleri:**
- `npm run type-check` → 0 error
- `npm run build` → ✓

**Commit:** `feat(jobs): add job detail entry links from jobs list and application history`

---

### Atomik-6: Full PHASE 6 E2E gate + closure — COMPLETE

**Amaç:** G6 tüm akışlarını tek gate ile doğrula. PHASE 6'yı kapat.

**Gate script:** `tools/atomik6_phase6_e2e_gate.mjs`
**Artifacts:** `tools/gate-artifacts/atomik6-phase6-full/`
**Sonuç: 19/19 PASS**

| Senaryo | Açıklama | Assertion | Sonuç |
|---|---|---|---|
| A | /jobs/42 shell renders (title + desc + badge) | 3 | ✓ PASS |
| B | candidate apply CTA visible on detail | 1 | ✓ PASS |
| C | TALENT_PROFILE_REQUIRED + /talent/profile link on detail | 2 | ✓ PASS |
| D | employer Kapat/Dolu İşaretle visible on detail | 2 | ✓ PASS |
| E | employer Kapat click → badge closed | 2 | ✓ PASS |
| F | job card title link → /jobs/42 navigation | 2 | ✓ PASS |
| G | history İlan #id link → /jobs/42 navigation | 2 | ✓ PASS |
| H | regression: role isolation on detail | 2 | ✓ PASS |
| I | responsive: .job-detail fits 360/768/1280 | 3 | ✓ PASS |

**Commit:** `test(jobs): add phase6 full e2e gate and close phase6`

---

## PHASE 6 — CLOSED

G6 (Job Detail Page `/jobs/:id`) tamamlandı ve gate ile doğrulandı.

| G6 Bileşen | Durum |
|---|---|
| `GET /jobs/{job_id}` backend | HAZIRDI — dokunulmadı |
| `fetchJob(id)` frontend service | HAZIRDI — JobDetailPage'e wired |
| `/jobs/:id` route + `JobDetailPage.tsx` shell | COMPLETE (0131f98) |
| Candidate apply CTA on detail page | COMPLETE (f44728b) |
| Employer close/fill actions on detail page | COMPLETE (2454f8c) |
| Job card title → `/jobs/:id` link | COMPLETE (5fc5de8) |
| Candidate history → `/jobs/:id` link | COMPLETE (5fc5de8) |
| Full E2E gate 19/19 PASS | COMPLETE (bu commit) |

G7 (job search/filter UI) — LOW PRIORITY, deferred to PHASE 7.

---

## PHASE 7 Handoff Notu

PHASE 6 tamamen kapatıldı (3ecd270). Sonraki faz: PHASE 7 — Release Governance & PR to Main.

Runbook: `docs/runbooks/release-governance-phase7-plan.md`

Operasyonel protokoller (Atomik-2 ile eklendi):
- Section 9: Execution Checklist — komut + kanıt + durum
- Section 10: Dirty Files Decision Matrix — stash/branch/discard kararı
- Section 11: PR Scope Freeze Protocol — freeze point + izin verilen dosyalar
- Section 12: Reviewer Pack Template — PR description şablonu
- Section 13: Go/No-Go Criteria — merge için minimum koşullar

PHASE 7 Atomik Backlog:

| Atomik | Hedef | Durum |
|---|---|---|
| A1 | Release governance inventory | COMPLETE (no commit) |
| A2 | DRY cleanup: role helpers + ApplyForm extract (opsiyonel) | Açık |
| A3 | Unrelated dirty files karara bağlama + PR description taslağı | Açık |
| A4 | PR to main: final review + merge | Açık |
| A5 | Post-merge: G7 roadmap entry + PHASE 8 bootstrap | Opsiyonel |

Devredilen teknik borç (PHASE 6'dan):
- `isEmployerAdmin` / `isTalentMember` inline her iki sayfada — `web/src/lib/role-helpers.ts`'e extract edilebilir
- `ApplyForm` logic `JobDetailPage` + `JobsPage`'de çift — `web/src/components/jobs/ApplyForm.tsx`'e extract edilebilir

---

## 4. Teknik Notlar

### fetchJob Kullanım Paterni (Atomik-2)

```typescript
const { id } = useParams<{ id: string }>();
const jobId = Number(id);
const [job, setJob] = useState<ProcurementJob | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  if (isNaN(jobId)) { setError("Geçersiz ilan ID."); setLoading(false); return; }
  void fetchJob(jobId)
    .then(setJob)
    .catch((err) => setError(extractJobsError(err)))
    .finally(() => setLoading(false));
}, [jobId]);
```

### Route Ekleme (App.tsx — Atomik-2)

```tsx
// Lazy import (line ~45 civarı, diğer lazy importların yanına):
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));

// ProtectedRoute > AppLayout içine (line ~147 civarı, /jobs'ın hemen altına):
<Route path="/jobs/:id" element={<JobDetailPage />} />
```

### Link Stili Notları (Atomik-5)

- `job-card__title` hali hazırda `font-size: 16px; font-weight: 700; color: #0f172a` — link olunca `text-decoration: none; color: inherit` koruyacak
- Hover: subtle underline veya color shift — `#0f6e57` (brand green)

### Gate Pattern (Atomik-6)

- Mevcut pattern: function predicates, 127.0.0.1:5175, pf_access_token + pf_user sessionStorage
- Yeni mock gereksinimi: `GET /api/v1/jobs/42` → `MOCK_JOB`
- URL predicate: `url.href.includes("/api/v1/jobs/42") && !url.href.includes("/applications") && !url.href.includes("/apply")`

---

## 5. Riskler

| Risk | Seviye | Önlem |
|---|---|---|
| ApplyForm duplikasyonu (Atomik-3) | Düşük | Seçenek B (inline) tercih; DRY extract PHASE 7'e |
| `/jobs/:id` ile `/jobs` route çakışması | Yok | React Router params ayrımı garantili |
| view_count spam (bot/refresh) | Orta | Backend sorunu değil, rate-limit sonraki fazda |
| employer pipeline detail page'e taşınması | Orta | Atomik-4'te scope netleştirilecek; list inline kalabilir |
| Responsive: uzun açıklamalarda text wrap | Düşük | `overflow-wrap: break-word` + `line-clamp` CSS |

---

## 6. Bağımlılık Grafiği

```
A1 (envanter) — bu adım
└── A2 (JobDetailPage shell + route) — bağımsız
    └── A3 (candidate apply CTA) — A2'ye bağımlı
    └── A4 (employer actions) — A2'ye bağımlı; A3 ile paralel
    └── A5 (entry point links) — A2'ye bağımlı
└── A6 (E2E gate + closure) — A2-A5 tümüne bağımlı
```
