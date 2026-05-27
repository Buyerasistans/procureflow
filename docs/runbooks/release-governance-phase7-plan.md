# PHASE 7 Plan — Release Governance & PR to Main

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`
Atomik-1 inventory date: 2026-05-27
Branch: pr/strict-gate-payment-clean-v2
Predecessor: PHASE 6 CLOSED (3ecd270) — G6 tüm acceptance criteria karşılandı

---

## 1. Amaç

PHASE 0–6 çıktılarını `main`'e merge için hazır hale getirmek.
Bunu yaparken:
- Release readiness durumunu belgele
- Risk/deviation listesi çıkar
- DRY/cleanup borçlarını tanımla
- PR kapsamını netleştir
- Atomik kapatma backlogunu oluştur

---

## 2. Program Özeti (PHASE 0–6)

### Commit Kanıtı

| Faz | Son Checkpoint | Gate | Sonuç |
|---|---|---|---|
| PHASE 0 | ba02ed4 — program ADR + backlog | — | DOCS |
| PHASE 1 | 34a1de7 — PHASE 1 closure | ✓ policy parity (15 test) | CLOSED |
| PHASE 2 | 9469349 — role-specific nav | ✓ responsive gate (Playwright 3 vp) | CLOSED |
| PHASE 3 | 7629d0e — CTA UI alignment | ✓ E2E 6/6 (no commit) | CLOSED |
| PHASE 4 | e8f1c58 — PHASE 4 full gate | ✓ 79/79 PASS | CLOSED |
| PHASE 5 | c0677a6 — PHASE 5 full gate | ✓ 16/16 PASS | CLOSED |
| PHASE 6 | 3ecd270 — PHASE 6 full gate | ✓ 19/19 PASS | CLOSED |

### Gate Kanıtı

| Gate Script | Assertions | Sonuç | Artifact |
|---|---|---|---|
| atomik8_phase5_e2e_gate.mjs | 16/16 | PASS | tools/gate-artifacts/atomik8-phase5-full/ |
| atomik6_phase6_e2e_gate.mjs | 19/19 | PASS | tools/gate-artifacts/atomik6-phase6-full/ |

---

## 3. PR Kapsamı

### Dahil Edilen Alan

Bu branch (pr/strict-gate-payment-clean-v2) `main`'den ayrıldığından beri:
- 311 dosya değişti / eklendi
- NAV_GOVERNANCE programı commit'leri: 30+ atomik checkpoint

Committed değişiklikler programa aittir ve PR'e dahil edilmesi beklenir.

### Unrelated Uncommitted Dirty Files (LOCAL ONLY — PR'E DAHİL DEĞİL)

Aşağıdaki dosyalar working directory'de dirty (unstaged) ama commit'lenmemiş.
PR'e **dahil olmayacak** — yerel state.

| Dosya | Alan | Risk |
|---|---|---|
| api/routers/admin.py | backend unrelated | yoksa önce commit veya stash |
| api/routers/onboarding_router.py | backend unrelated | yoksa önce commit veya stash |
| api/routers/quotes.py | backend unrelated | backend unrelated |
| api/services/deployment_service.py | backend unrelated | — |
| api/services/extractor.py | backend unrelated | — |
| docs/runbooks/jobs-surface-phase3-plan.md | doc unrelated | — |
| web/src/components/admin/CampaignsTab.css | frontend unrelated | — |
| web/src/components/admin/CampaignsTab.tsx | frontend unrelated | — |
| web/src/pages/AdminPage.tsx | frontend unrelated | — |
| web/src/pages/admin/OnboardingStudioTab.tsx | frontend unrelated | — |
| web/src/pages/admin/PackagesTab.tsx | frontend unrelated | — |
| web/src/pages/admin/PlatformOperationsTab.css | frontend unrelated | — |
| web/src/pages/admin/PlatformOperationsTab.tsx | frontend unrelated | — |
| web/src/pages/admin/adminSecondaryTabs.tsx | frontend unrelated | — |
| web/src/test/admin-page-tenant-governance.test.tsx | test unrelated | — |

**Karar:** Bu dosyalar kendi ayrı commit'leriyle (veya ayrı bir branch üzerinden) merge edilmeli.
Program kapsamı dışında olduklarından, PHASE 7 PR'ine dahil edilmezler.

---

## 4. Deferred Items (Teknik Borç)

| Item | Ertelenen Yer | Öneri |
|---|---|---|
| `isEmployerAdmin` / `isTalentMember` her iki sayfada inline | PHASE 5/6 nota | PHASE 7/A2: `web/src/lib/role-helpers.ts`'e extract et |
| `ApplyForm` logic `JobDetailPage.tsx` + `JobsPage.tsx`'te çift | PHASE 6/A3 nota | PHASE 7/A2: `web/src/components/jobs/ApplyForm.tsx` extract |
| G7 — job search/filter UI | PHASE 6 kapsam dışı | Ayrı backlog item / PHASE 8 |
| Inline CSS class duplikasyonu (apply/action blokları) | PHASE 6 nota | PHASE 7/A2 veya sonrası |

---

## 5. Risk Register

| Risk | Seviye | Önlem |
|---|---|---|
| Unrelated dirty files aynı anda commit edilirse scope kirlenir | ORTA | Atomik-3'te ayrı commit stratejisi belirlenir |
| Branch çok büyük — 311 dosya (reviewer yükü) | ORTA | PR description'da scope + gate kanıtı açıkça belirt |
| DRY borç: role helpers/ApplyForm duplikasyonu | DÜŞÜK | Çalışır kod, PHASE 7/A2'de cleanup yapılır |
| G7 eksikliği kullanıcı beklentisini karşılamıyor | DÜŞÜK | Scoped out, roadmap'e girilecek |
| `navigation.ts` / `navigation-adapter.ts` test-only retained | BİLİNEN | Atomik-3'te temizlik veya explicit not |

---

## 6. Release Checklist

### Teknik

- [x] `npm run type-check` → 0 error (son: PHASE 6/A3)
- [x] `npm run build` → başarılı (son: PHASE 6/A3)
- [x] E2E gate PHASE 5 — 16/16 PASS
- [x] E2E gate PHASE 6 — 19/19 PASS
- [ ] Unrelated dirty files karara bağlandı (commit / stash / drop)
- [ ] PR description yazıldı (scope + gate evidence)
- [ ] CI çalıştırıldı (branch'te)
- [ ] Reviewer atandı

### Governance

- [x] PHASE 1–6 tümü kapatıldı (closure commit veya doc)
- [x] Gate artifact'ları committed: `tools/gate-artifacts/`
- [x] Runbook'lar güncel
- [x] DRY cleanup kararı verildi — Atomik-2: borç kabul edildi, skip (risk düşük, merge sonrası yapılabilir)
- [ ] PHASE 7 PR description taslağı hazır (Atomik-3'te)
- [x] G7 erteleme kararı belgelendi — deferred to PHASE 8, explicitly out-of-scope

---

## 7. PHASE 7 Atomik Backlog

| Atomik | Hedef | Beklenti |
|---|---|---|
| A1 | Release governance inventory (bu adım) | COMPLETE (no commit) |
| A2 | Governance checklist operasyonelleştirme (docs-only) | COMPLETE (tek commit) |
| A3 | Unrelated dirty files karara bağlama + PR description taslağı | İş akışı kararı |
| A4 | PR to main: final review + merge | FINAL |
| A5 | Post-merge: G7 roadmap entry + PHASE 8 bootstrap | OPSIYONEL |

### Atomik-2 Detayı (Governance Checklist Operasyonelleştirme) — COMPLETE

Yapılanlar:
- Section 6 (Release Checklist) operational hale getirildi
- Dirty Files Decision Matrix eklendi (Section 9)
- PR Scope Freeze Protocol eklendi (Section 10)
- Reviewer Pack Template eklendi (Section 11)
- Go/No-Go Criteria eklendi (Section 12)
- DRY cleanup kararı: borç kabul edildi, skip — merge sonrasına ertelendi

### Atomik-3 Detayı (PR Preparation)

- Unrelated dirty files için karar: `git stash` veya ayrı branch'e al
- PR description hazırla (scope, gate kanıtı, deferred items)
- Branch'i latest main'e rebase etmeyi değerlendir (gerekirse)

### Atomik-4 Detayı (PR to Main)

- `gh pr create` veya GitHub UI üzerinden
- Reviewer: Olimpos_Bot kullanıcısı tarafından takip edilmeli
- CI yeşil görünce merge

---

## 8. Handoff Notu

Bu dosya PHASE 7 için yol haritasıdır.
PHASE 6'dan bu governance planına geçiş:
- PHASE 6 tüm acceptance criteria karşılandı ✓
- G6 gate 19/19 PASS ✓
- G7 explicitly out-of-scope ✓
- Production code değişikliği gerekmez (sadece cleanup/PR hazırlığı)

---

## 9. Execution Checklist (Operational)

Her madde için: owner, komut, beklenen kanıt, mevcut durum.

### Teknik Kalite Kapıları

| # | Kontrol | Komut | Beklenen Kanıt | Durum |
|---|---|---|---|---|
| T1 | type-check 0 error | `cd web && npm run type-check` | Exit 0, no stderr | ✓ DONE (PHASE 6/A3) |
| T2 | build başarılı | `cd web && npm run build` | Exit 0, dist/ oluştu | ✓ DONE (PHASE 6/A3) |
| T3 | E2E gate PHASE 5 | `node tools/atomik8_phase5_e2e_gate.mjs` | 16/16 PASS + artifacts | ✓ DONE (c0677a6) |
| T4 | E2E gate PHASE 6 | `node tools/atomik6_phase6_e2e_gate.mjs` | 19/19 PASS + artifacts | ✓ DONE (3ecd270) |

### Dirty Files İşlemi

| # | Kontrol | Aksiyon | Beklenen Kanıt | Durum |
|---|---|---|---|---|
| D1 | Unrelated dirty files karara bağlandı | Atomik-3'te karar (stash/branch/discard) | `git status --short` temiz (program dosyaları only) | Açık |
| D2 | PR scope doğrulaması | `git diff --name-only main...HEAD` | 311 dosya, unrelated dirty yok | Açık |

### Governance Dokümantasyon

| # | Kontrol | Aksiyon | Beklenen Kanıt | Durum |
|---|---|---|---|---|
| G1 | PHASE 1–6 tümü kapatıldı | git log kontrol | Closure commit her fazda | ✓ DONE |
| G2 | Gate artifact'lar committed | `ls tools/gate-artifacts/` | atomik8-phase5-full + atomik6-phase6-full | ✓ DONE |
| G3 | Runbook'lar güncel | docs/runbooks/ gözden geçir | Bu dosya + phase6 plan CLOSED | ✓ DONE |
| G4 | DRY cleanup kararı | Atomik-2 kararı | borç kabul edildi, skip | ✓ DONE |
| G5 | G7 erteleme belgelendi | Bu runbook + phase6 plan | G7 PHASE 8'e ertelendi | ✓ DONE |
| G6 | PR description taslağı | Atomik-3'te hazırla | scope + gate kanıtı + deferred items | Açık |

---

## 10. Dirty Files Decision Matrix

15 unrelated uncommitted dirty dosya mevcut. Atomik-3'te karar verilecek.

### Seçenek Matrisi

| Seçenek | Ne Zaman Kullan | Komut | Risk |
|---|---|---|---|
| **git stash** | Değişiklikler tekrar lazım olacak, hızlı kapat | `git stash push -m "unrelated-pre-phase7"` | Stash unutulabilir — `git stash list` ile takip et |
| **Ayrı branch** | Değişiklikler başka PR'a gidecek | `git checkout -b feat/admin-unrelated && git stash pop` → commit | En temiz yol; PR'leri net ayırır |
| **Discard** | Değişiklikler artık gerekmiyor / tekrar yazılabilir | `git checkout -- <file>` | Geri dönüşü yok — önce `git diff <file>` al |
| **Ayrı commit (bu PR)** | Değişiklikler program kapsamıyla doğrudan ilgili | `git add <file> && git commit` | PR scope kirlenir — **önerilmez** |

### Bu Proje İçin Karar (Atomik-3'te uygulanacak)

Tercih sırası: **Ayrı branch > git stash > discard**

### Dosya Grupları

| Grup | Dosyalar | Önerilen Aksiyon |
|---|---|---|
| Backend unrelated | `api/routers/admin.py`, `quotes.py`, `deployment_service.py`, `extractor.py` | Ayrı branch veya stash |
| Backend kritik (dirty) | `api/routers/onboarding_router.py` | Stash — dokunma |
| Frontend admin | `web/src/pages/AdminPage.tsx`, `admin/*.tsx`, `CampaignsTab.*` | Ayrı branch veya stash |
| Docs unrelated | `docs/runbooks/jobs-surface-phase3-plan.md` | Stash veya discard |
| Test unrelated | `web/src/test/admin-page-tenant-governance.test.tsx` | Ayrı branch veya stash |

---

## 11. PR Scope Freeze Protocol

### Freeze Point

PR oluşturulmadan önce (Atomik-4 başlamadan) scope freeze uygulanır.
Unrelated dirty files commit edilmemiş olmalı.

### İzin Verilen Dosyalar (PR'e dahil olacaklar)

Şunlar `main`'den farklı olabilir:

- `web/src/**` — NAV_GOVERNANCE program değişiklikleri
- `api/**` — program kapsamındaki backend endpoint'leri
- `migrations/**` — program kapsamındaki DB migration'lar
- `docs/runbooks/**` — program runbook'ları (PHASE 1–7)
- `tools/**` — gate scriptleri ve artifact'lar

### Yasak Dosyalar

- Unrelated dirty/uncommitted dosyalar (15 dosya — Section 3 listesi)
- `tools/agent/SESSION_STATE.json` — gitignored, commit edilmeyecek
- `.env`, credentials, secret dosyalar

### İstisna Yönetimi

Bir dosya hem program hem unrelated değişiklik içeriyorsa:

1. `git diff <file>` — program vs unrelated hunks'ı ayır
2. Program değişikliği yoksa → stash veya discard
3. Program değişikliği varsa → `git add -p <file>` ile sadece program hunks'ı seç

### Scope Doğrulama Komutu

```bash
git diff --name-only main...HEAD
```

Çıktıda unrelated dosya görünürse → freeze ihlali → Atomik-3 adımlarını uygula.

---

## 12. Reviewer Pack Template

PR description Atomik-3'te bu şablondan doldurulacak.

```
## NAV_GOVERNANCE_AND_JOB_MARKETPLACE — PR to Main

### Program Özeti
PHASE 0–6 tüm atomik adımlar tamamlandı. 30+ checkpoint commit.
Gate kanıtları committed (tools/gate-artifacts/).

### Kapsam
- Navigation governance policy + role-based visibility (PHASE 1–2)
- Job marketplace: posting, application, withdrawal, detail page (PHASE 3, 5–6)
- Employer + candidate onboarding (PHASE 4)

### Gate Kanıtı
| Gate | Sonuç | Artifact |
|---|---|---|
| PHASE 4 full gate | 79/79 PASS | tools/gate-artifacts/atomik7-onboarding/ |
| PHASE 5 full gate | 16/16 PASS | tools/gate-artifacts/atomik8-phase5-full/ |
| PHASE 6 full gate | 19/19 PASS | tools/gate-artifacts/atomik6-phase6-full/ |

### Ertelenen Kalemler (Deferred)
- G7: Job search/filter UI — backend hazır, UI PHASE 8'e ertelendi
- DRY: role helpers (isEmployerAdmin/isTalentMember) inline — teknik borç, minor
- DRY: ApplyForm duplikasyonu — teknik borç, minor

### Runbook
docs/runbooks/release-governance-phase7-plan.md
```

---

## 13. Go/No-Go Criteria

Aşağıdaki tüm Go koşulları karşılanmadan PR `main`'e merge edilmez.

### Go Koşulları (Zorunlu)

| # | Koşul | Kanıt | Durum |
|---|---|---|---|
| 1 | type-check 0 error | `npm run type-check` exit 0 | ✓ DONE |
| 2 | build başarılı | `npm run build` exit 0 | ✓ DONE |
| 3 | E2E gate PHASE 5 ≥ 16/16 PASS | gate-artifacts/atomik8-phase5-full/report.json | ✓ DONE |
| 4 | E2E gate PHASE 6 ≥ 19/19 PASS | gate-artifacts/atomik6-phase6-full/report.json | ✓ DONE |
| 5 | Unrelated dirty files PR scope dışında | `git status` → unrelated dosyalar commit edilmemiş | Açık (A3) |
| 6 | PR description tamamlandı | scope + gate kanıtı + deferred items | Açık (A3) |
| 7 | CI yeşil | GitHub Actions passing | Açık (A4) |

### No-Go Koşulları (Blocker)

| # | Koşul | Aksiyon |
|---|---|---|
| N1 | type-check hatası | Hata düzelt → re-check |
| N2 | build hatası | Hata düzelt → re-build |
| N3 | Gate failure (herhangi bir assertion) | Root cause → fix → gate re-run |
| N4 | Unrelated dirty file commit'e dahil | `git reset HEAD <file>` → scope re-verify |
| N5 | PR description eksik | Atomik-3'te tamamla |
| N6 | CI red | Hata logunu incele → fix |

### Risk Kabul Süreci

Eğer bir No-Go koşulu teknik borç niteliğinde ve düşük riskse:
- Explicit risk kabul notu PR description'a ekle
- Deferred item listesine ekle
- Reviewer onayı al
