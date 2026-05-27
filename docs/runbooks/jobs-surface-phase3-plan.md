# PHASE 3 Plan — Jobs Surface (NAV_GOVERNANCE_AND_JOB_MARKETPLACE)

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`
Atomik-1 inventory date: 2026-05-27
Atomik-2 completion date: 2026-05-27
Branch: pr/strict-gate-payment-clean-v2

> **PHASE 3 / Atomik-2 COMPLETE.**
> Backend authz extension committed. `employer_recruiter` added to
> `EMPLOYER_ADMIN_SYSTEM_ROLES`; `candidate_user` added to
> `TALENT_MEMBER_SYSTEM_ROLES` in `api/core/authz.py`.
> No migration. No schema change. 30/31 backend tests pass
> (1 pre-existing OpenSSL entropy failure unrelated to authz).
> Gap-1 (employer_recruiter backend), Gap-2 (candidate_user talent access),
> and Gap-3 (candidate_user apply) backend blockers resolved.
> Gap-4 (register promotion side effect) auto-resolved.
> Frontend UI CTAs remain blocked until Atomik-3.

---

## Mevcut Durum Özeti

PHASE 2 sonunda `/jobs` ve `/talent/profile` nav link'leri `employer_recruiter`
ve `candidate_user` rolleri için policy üzerinden gösterilmeye başlandı (Atomik-5).
Ancak bu linklerin hedeflediği sayfalardaki **rol aksiyonu mantığı** ve
**backend authz** bu yeni rolleri henüz tanımıyor.

---

## 1. Route Envanteri

### `/jobs`

| Özellik | Değer |
|---|---|
| Tanımlandığı dosya | `web/src/App.tsx:143` |
| Component | `JobsPage` (lazy — `web/src/pages/JobsPage.tsx`) |
| Auth guard | `ProtectedRoute` (user !== null) |
| Permission guard | **Yok** — RequirePermission sarmalayıcısı yok |
| Public erişim | **Hayır** — tamamen authenticated-only |
| Detail route | **Yok** — `/jobs/:id` tanımlı değil |
| Unauthenticated redirect | `/login` |

### `/talent/profile`

| Özellik | Değer |
|---|---|
| Tanımlandığı dosya | `web/src/App.tsx:144` |
| Component | `TalentProfilePage` (lazy — `web/src/pages/TalentProfilePage.tsx`) |
| Auth guard | `ProtectedRoute` (user !== null) |
| Permission guard | **Yok** |
| Public erişim | **Hayır** |
| Unauthenticated redirect | `/login` |

---

## 2. UI Envanteri

### JobsPage (`web/src/pages/JobsPage.tsx`)

Rol helpers dosyaya **yerel ve hardcoded** — policy'den türetilmiyor:

```typescript
function isEmployerAdmin(systemRole): boolean {
  // "employer_company_admin" | "super_admin" | "tenant_admin"
  // employer_recruiter YOK
}

function isTalentMember(systemRole): boolean {
  // "talent_member" | "referral_partner" | "super_admin"
  // candidate_user YOK
}
```

**Aksiyon matriksi (mevcut):**

| Rol | Sayfa görünür | "Yeni İlan" CTA | "Başvur" CTA |
|---|---|---|---|
| employer_company_admin | ✓ | ✓ (isEmployerAdmin) | ✗ |
| employer_recruiter | ✓ (nav sonrası) | ✗ GAP | ✗ |
| candidate_user | ✓ (nav sonrası) | ✗ | ✗ GAP |
| talent_member | ✓ (nav policy) | ✗ | ✓ (isTalentMember) |
| referral_partner | ✓ (nav policy) | ✗ | ✓ (isTalentMember) |
| super_admin | ✓ | ✓ | ✓ |

**CTA olmayan durum:** Eksik roller için sayfa bir iş ilanı listesi gösterir
ama hiçbir aksiyon (create/apply) aktif olmaz. İşlevsel ama eksik UX.

**Sayfalama:** 20/sayfa; pagination UI mevcut.

**Detail/slug sayfası:** YOK — `/jobs/:id` route'u tanımsız.

### TalentProfilePage (`web/src/pages/TalentProfilePage.tsx`)

- Bileşen kendi role check'i yapmaz
- Doğrudan `GET /talent/me` çağırır
- API 403 dönerse: sayfa "erişim yetkiniz yok" mesajı gösterir
- API 404 dönerse: `RegisterForm` gösterilir (profil yok → oluştur akışı)
- **`candidate_user` mevcut durumda**: API `can_access_talent_dashboard` kontrolü
  nedeniyle 403 döner → sayfa hata mesajı gösterir. **Kritik blocker.**

### JobList.tsx (`web/src/JobList.tsx`)

- Eski/orphan bileşen; routing'de kullanılmıyor
- Farklı veri modeli (department-based jobs, raw fetch, no auth)
- Dead code — PHASE 3 kapsamı dışı (ayrı temizlik adımı gerekebilir)

---

## 3. Servis / API Envanteri

### Frontend Servisleri

| Servis | Endpoint | Auth |
|---|---|---|
| `fetchJobs(page, size)` | `GET /jobs` | Bearer token |
| `fetchJob(id)` | `GET /jobs/{id}` | Bearer token |
| `createJob(payload)` | `POST /jobs` | Bearer token |
| `applyToJob(jobId, payload)` | `POST /jobs/{jobId}/apply` | Bearer token |
| `getMyTalentProfile()` | `GET /talent/me` | Bearer token |
| `registerTalentProfile(payload)` | `POST /talent/register` | Bearer token |
| `updateMyTalentProfile(payload)` | `PATCH /talent/me` | Bearer token |
| `getMyEarnings(page, size)` | `GET /talent/me/earnings` | Bearer token |

Public (unauthenticated) jobs endpoint: **YOK**.

### Backend Authz — Mevcut Durum (`api/core/authz.py`)

```python
EMPLOYER_ADMIN_SYSTEM_ROLES = {"employer_company_admin"}
# employer_recruiter YOK

TALENT_MEMBER_SYSTEM_ROLES = {"talent_member"}
# candidate_user YOK
```

**Etkilenen kontroller:**

| Kontrol | Şu an | employer_recruiter | candidate_user |
|---|---|---|---|
| `can_post_procurement_job` | employer_admin + tenant_admin + super_admin | ✗ BLOCKER | N/A |
| `can_access_talent_dashboard` | talent_member + referral_partner + super_admin | N/A | ✗ BLOCKER |
| `apply_to_job` endpoint | is_talent_member | N/A | ✗ BLOCKER |
| `GET /jobs` | tüm authenticated; published filtresinde | ✓ (görür) | ✓ (görür) |

### Backend — Talent Register Yan Etkisi

`POST /talent/register`: role guard yok — tüm authenticated kullanıcılar kayıt yapabilir.

```python
if not is_talent_member(current_user):
    current_user.system_role = "talent_member"  # otomatik rol promosyonu
```

`candidate_user` kayıt yaparsa `talent_member`'a promote edilir → system_role
kaybolur. Bu istenmeyen bir yan etki. PHASE 3 Atomik-3'te bu logic güncellenmeli.

---

## 4. Policy Envanteri

Atomik-5 sonrası mevcut durum:

```typescript
// top_nav.app.jobs
allowed_system_roles: [
  "talent_member", "employer_company_admin", "employer_recruiter",
  "candidate_user", "referral_partner", "super_admin"
]
visibility_scope: "authenticated"

// top_nav.app.talent_profile
allowed_system_roles: ["talent_member", "candidate_user", "referral_partner", "super_admin"]
visibility_scope: "authenticated"
```

Public jobs item: **YOK** — policy'de public visibility_scope'lu bir jobs item tanımlı değil.

---

## 5. Gap Analizi

### Gap-1: `employer_recruiter` — ilan oluşturma blocker (backend + frontend)

- **Belirti:** Nav'da /jobs görünür ama "Yeni İlan" butonu çıkmıyor; backend `POST /jobs` 403 döner
- **Kök neden:** `EMPLOYER_ADMIN_SYSTEM_ROLES = {"employer_company_admin"}` — recruiter yok
- **Etki:** Recruiter sayfayı görebilir ama iş ilanı açamaz
- **Çözüm:** `employer_recruiter`'ı `EMPLOYER_ADMIN_SYSTEM_ROLES`'e ekle (authz.py) + JobsPage.tsx local helper güncelle
- **Durum:** Backend DONE (Atomik-2 — authz.py). UI CTA pending (Atomik-3 — JobsPage.tsx).

### Gap-2: `candidate_user` — talent profil erişim blocker (backend + frontend)

- **Belirti:** `/talent/profile` sayfası "erişim yetkiniz yok" hatası gösterir
- **Kök neden:** `can_access_talent_dashboard` → `is_talent_member` → `TALENT_MEMBER_SYSTEM_ROLES = {"talent_member"}` — candidate_user yok
- **Etki:** candidate_user kendi profilini ne görüntüleyebilir ne oluşturabilir
- **Çözüm:** `candidate_user`'ı `TALENT_MEMBER_SYSTEM_ROLES`'e ekle + talent register promotion logic güncelle
- **Durum:** DONE (Atomik-2 — authz.py).

### Gap-3: `candidate_user` — iş başvurusu blocker (backend + frontend)

- **Belirti:** `/jobs` sayfasında "Başvur" butonu çıkmıyor; `POST /jobs/{id}/apply` 403 döner
- **Kök neden:** `apply_to_job` endpoint: `is_talent_member` kontrolü — candidate_user kapsam dışı
- **Etki:** candidate_user iş ilanına başvuramaz
- **Çözüm:** Gap-2 ile birleşik — TALENT_MEMBER_SYSTEM_ROLES güncellenmesi ikisini de çözer
- **Durum:** Backend DONE (Atomik-2). UI CTA pending (Atomik-3 — JobsPage.tsx).

### Gap-4: Talent register promosyon yan etkisi

- **Belirti:** `candidate_user` profil oluşturduğunda `talent_member` rolüne promote edilir
- **Kök neden:** `if not is_talent_member(current_user): system_role = "talent_member"`
- **Etki:** candidate_user sistem rolü kaybolur
- **Çözüm:** TALENT_MEMBER_SYSTEM_ROLES'e candidate_user eklendikten sonra promotion koşulu
  otomatik pass eder (is_talent_member true döner) → promote olmaz. Ek değişiklik gerekmez.
- **Durum:** DONE (auto-resolved by Atomik-2).

### Gap-5: JobsPage UI — local role helper policy'den bağımsız

- **Belirti:** Policy roller güncellendiğinde UI aksiyonları güncellenmez
- **Kök neden:** `isEmployerAdmin` / `isTalentMember` local hardcoded helper'lar; policy senkronize değil
- **Etki:** Her yeni rol için iki yerde değişiklik gerekiyor (policy + component)
- **Çözüm öneri:** helper'ları policy-aligned hale getir veya navigation-policy'den derive et

### Gap-6: `/jobs` public surface yok

- **Durum:** Tüm job listing authenticated-only; unauthenticated kullanıcılar göremez
- **Etki:** SEO ve landing conversion yok; job discovery sıfır public visibility
- **Scope:** Bu PHASE 3'ün daha ileri bir adımı (Atomik-4+) — backend public endpoint + frontend public route gerektirir

---

## 6. PHASE 3 Atomik Backlog Önerisi

### Atomik-2: Backend authz — employer_recruiter + candidate_user (önce backend)

**Amaç:** employer_recruiter ve candidate_user için authz engelini kaldır.

**Dosya etki alanı:** `api/core/authz.py` sadece

**Değişiklikler:**
- `EMPLOYER_ADMIN_SYSTEM_ROLES` setine `"employer_recruiter"` ekle
- `TALENT_MEMBER_SYSTEM_ROLES` setine `"candidate_user"` ekle

**Yan etki:** talent register promotion logic otomatik düzelir (candidate_user is_talent_member → true → promote atlanır)

**Test/gate:** API unit tests (authz fonksiyonları için), type-check, build

**Responsive:** N/A (backend-only)

**Bağımlılık:** Yoktur — diğer atomik adımların önkoşuludur

**Not:** Bu adım `src/api` değişikliği içerir — explicit onay gerekebilir.

---

### Atomik-3: Frontend — JobsPage UI aksiyonları

**Amaç:** employer_recruiter'a "Yeni İlan" CTA'sı; candidate_user'a "Başvur" CTA'sı göster.

**Dosya etki alanı:** `web/src/pages/JobsPage.tsx` sadece

**Değişiklikler:**
- `isEmployerAdmin()` local helper: `"employer_recruiter"` ekle
- `isTalentMember()` local helper: `"candidate_user"` ekle

**Test/gate:** type-check, build, responsive gate (375/768/1366 her iki persona için CTA görünürlüğü)

**Responsive:** Zorunlu — 3 viewport, Playwright session injection

**Bağımlılık:** Atomik-2 (backend authz) önce tamamlanmalı ki gate'de butona basıldığında 403 alınmasın

---

### Atomik-4: TalentProfilePage — candidate_user flow doğrulaması

**Amaç:** candidate_user için /talent/profile tam akışını doğrula (profil yok → oluştur → görüntüle).

**Dosya etki alanı:** Test ve gate odaklı; kod değişikliği muhtemelen minimal

**İş:** Atomik-2 sonrasında candidate_user /talent/me'ye erişebilir; bu adımda uçtan uca akış Playwright ile doğrulanır. Gerekirse TalentProfilePage'de ek hata/boş durum mesajları düzenlenir.

**Test/gate:** Playwright akış testi (candidate_user ile profil yok → RegisterForm görünür → doldur → kaydet → profil görüntülenir)

**Responsive:** Zorunlu

**Bağımlılık:** Atomik-2 + Atomik-3

---

### Atomik-5 (Opsiyonel / Sonraki Faz): Public jobs surface

**Amaç:** `/jobs` public listing — unauthenticated kullanıcılar iş ilanlarını görebilir.

**Dosya etki alanı:** Backend yeni endpoint, App.tsx yeni public route, yeni component (veya JobsPage fork)

**Kompleksite:** Orta-yüksek — backend public endpoint (no auth required), frontend yeni route, policy yeni public item

**Bağımlılık:** Atomik-4 tamamlanmış olmalı; standalone başlatılabilir ama risk daha yüksek

**Not:** Bu adım PHASE 4 olarak ayrı faz açabilir.

---

## Riskler

| Risk | Seviye | Önlem |
|---|---|---|
| `TALENT_MEMBER_SYSTEM_ROLES`'e candidate_user eklenmesi tüm is_talent_member check'lerini etkiler | Orta | TALENT_ECOSYSTEM_ROLES ve diğer is_talent_member consumers incelenmeli |
| `EMPLOYER_ADMIN_SYSTEM_ROLES`'e employer_recruiter eklenmesi tenant scoping'i etkiler | Düşük | Mevcut `_scoped_query` mantığı recruiter için de doğru çalışır |
| JobList.tsx orphan bileşeni temizlenmemişse import karışıklığı | Düşük | Routing'e dahil değil; ayrı cleanup atomik adımı |
| Talent register promotion logic — candidate_user sistemden çıkarsa | Düşük | Atomik-2 ile otomatik çözülür |
