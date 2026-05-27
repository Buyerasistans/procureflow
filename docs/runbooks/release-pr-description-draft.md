# PR Description Draft — NAV_GOVERNANCE_AND_JOB_MARKETPLACE

Branch: `pr/strict-gate-payment-clean-v2` → `main`
Hazırlayan: PHASE 7 / Atomik-3 governance execution
Durum: **DRAFT — Atomik-4'te `gh pr create` ile kullanılacak**

---

## Summary

`NAV_GOVERNANCE_AND_JOB_MARKETPLACE` programının PHASE 0–6 çıktılarını main'e alır.

30+ atomik checkpoint commit ile ilerleyen bu program; frontend navigation governance,
iş ilanı yüzeyi (posting, application, withdrawal, detail page) ve employer/candidate
onboarding akışlarını tamamlar. Tüm kabul kriterleri gate testleriyle doğrulanmıştır.

---

## Scope

### PHASE 1–2 — Navigation Governance

- `web/src/lib/nav-visibility-policy.ts` — typed role-based nav visibility policy
- Non-invasive adapter pattern (mevcut routing.ts'yi korur)
- Role-specific nav: `employer_recruiter` (post/manage) vs `candidate_user` (apply/browse)
- Panel tab governance via policy resolver
- Public navbar items governed (guest_public → register CTAs)
- Parity test coverage: 15 role personas

### PHASE 3 — Job Surface Authz

- Backend authz extension: `employer_recruiter` + `candidate_user` /jobs endpoint erişimi
- `JobsPage` CTA alignment: role-aware (employer: post/manage, candidate: apply/browse)

### PHASE 4 — Onboarding

- `POST /auth/register` — employer + candidate registration backend
- `EmployerRegisterPage` + `/employer/register` public route
- `CandidateRegisterPage` + `/candidate/register` public route
- Register-redirect policy + activation role-based redirect
- Guest NavBar + popup register CTAs

### PHASE 5 — Application Lifecycle

- Employer: "Kapat" + "Dolu İşaretle" butonları (published ilan yönetimi)
- Employer: application pipeline viewer with state transitions (shortlist / interview / offer / reject)
- Backend `GET /my/applications` — candidate application history endpoint
- Candidate: application history UI on JobsPage
- Candidate: `POST /jobs/{id}/withdraw` + UI withdrawal flow

### PHASE 6 — Job Detail Page

- `GET /jobs/:id` route + `JobDetailPage.tsx` (yeni sayfa)
- Candidate apply CTA on detail page (TALENT_PROFILE_REQUIRED handling dahil)
- Employer close/fill actions on detail page
- Job card title → `/jobs/:id` link (JobsPage list)
- Candidate history row → `/jobs/:id` link

### PHASE 7 — Release Governance

- Release governance runbook (`docs/runbooks/release-governance-phase7-plan.md`)
- Operational checklist, dirty files matrix, scope freeze protocol, Go/No-Go criteria

---

## Key Features Delivered

- **Role-based navigation** — her rol kendi nav öğelerini görür, diğerlerini görmez
- **Job posting lifecycle** — employer ilanı yayınlar, kapatır, dolu işaretler
- **Application flow** — candidate başvurur, durumunu takip eder, geri çeker
- **Employer pipeline** — başvuruları pipeline'da yönetir (shortlist → interview → offer/reject)
- **Job detail page** — ilan detayı, role-aware CTAs, responsive 360/768/1280
- **Onboarding gates** — employer/candidate kayıt + aktivasyon yönlendirmesi

---

## Gate Evidence

| Gate | Script | Assertions | Sonuç | Artifact |
|---|---|---|---|---|
| PHASE 4 full | `tools/atomik7_onboarding_gate.mjs` | 79/79 | PASS | `tools/gate-artifacts/atomik7-onboarding/` |
| PHASE 5 full | `tools/atomik8_phase5_e2e_gate.mjs` | 16/16 | PASS | `tools/gate-artifacts/atomik8-phase5-full/` |
| PHASE 6 full | `tools/atomik6_phase6_e2e_gate.mjs` | 19/19 | PASS | `tools/gate-artifacts/atomik6-phase6-full/` |

Tüm gate'ler: `127.0.0.1:5175` (Vite dev server), Playwright, function predicates (NOT glob strings).
Responsive doğrulama: 360 / 768 / 1280 viewport.

---

## Deferred Items (Explicit)

| Item | Karar | Neden |
|---|---|---|
| G7: Job search/filter UI | PHASE 8'e ertelendi | Backend params hazır; UI kapsam dışı tutuldu — zaman kısıtı |
| DRY: `isEmployerAdmin` / `isTalentMember` | Teknik borç kabul | 2 dosyada inline — minor, çalışıyor; merge sonrası extract edilebilir |
| DRY: ApplyForm logic duplikasyonu | Teknik borç kabul | JobsPage + JobDetailPage inline copy — minor |

---

## Rollback Notes

- Tüm DB migration'lar additive (kolon ekle / tablo ekle) — destructive DDL yok
- Frontend değişiklikleri route/page bazlı izole — PR revert yeterli
- Backend endpoint'leri yeni (`/jobs`, `/register`, `/my/applications`, `/withdraw`) — mevcut endpoint'leri kırmaz
- Nav policy adapter pattern non-invasive — eski `routing.ts` yedekte (test-only retained)

---

## Reviewer Checklist

- [ ] `web/src/lib/nav-visibility-policy.ts` — tüm rol personas için visibility kuralları doğru
- [ ] `web/src/pages/JobsPage.tsx` + `web/src/pages/JobDetailPage.tsx` — `canTalent && !canEmployer` / `canEmployer && !canTalent` guard'ları yerinde
- [ ] `/employer/register` + `/candidate/register` — public route (ProtectedRoute sarmalı yok)
- [ ] `tools/gate-artifacts/atomik6-phase6-full/report.json` — son gate kanıtı okunabilir
- [ ] Deferred items listesi PR description'da explicit — reviewer onayı
- [ ] Regression: Atomik-6 gate Senaryo H (role isolation on detail page) PASS kanıtı
- [ ] CI green before merge

---

## Runbook

`docs/runbooks/release-governance-phase7-plan.md` — Go/No-Go kriterleri, scope freeze, execution checklist
