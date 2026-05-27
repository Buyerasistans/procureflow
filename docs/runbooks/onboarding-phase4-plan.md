# PHASE 4 Plan — Onboarding Split: Employer vs Candidate

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`
Atomik-1 inventory date: 2026-05-27
Branch: pr/strict-gate-payment-clean-v2

---

## 1. Mevcut Durum Özeti

### Mevcut Kayıt Yolları

| Yol | Route | Backend | Rol Ataması |
|---|---|---|---|
| B2B Onboarding | `/onboarding` | `POST /onboarding/register` | `tenant_admin` |
| Tedarikçi Kaydı | `/supplier/register` | `POST /supplier/register` | `supplier_*` |
| Kanal Partner | `/is-ortagi-basvuru` | `POST /...` | `channel_*` |
| Talent Profil | `/talent/profile` (login zorunlu) | `POST /talent/register` | `talent_member` |
| **Bireysel employer** | **YOK** | **YOK** | **—** |
| **Bireysel candidate** | **YOK** | **YOK** | **—** |

### OnboardingPage Mevcut Kapsam

`web/src/pages/OnboardingPage.tsx` — wizard tabanlı, 5 adım:
`tenant_type → plan → details → payment → done`

**Yalnızca B2B tenant tiplerini destekler:**
- `strategic_partner` (Stratejik Ortaklık)
- `supplier` (Tedarikçi)

İşveren şirketler (job posting odaklı) ve bireysel iş arayanlar bu akışın dışındadır.

### Backend Auth Endpoint Envanteri

`api/routers/auth.py` — login, activate/verify, activate, /me, refresh, logout.
**Standalone kullanıcı kaydı endpoint'i yok.**

---

## 2. Gap Analizi

### Gap-1: employer_company_admin için kayıt yolu yok

- **Belirti:** Bir şirket iş ilanı açmak istiyor ama mevcut B2B onboarding (satın alma odaklı) veya supplier kaydı uygun değil.
- **Kök neden:** `/onboarding` sadece satın alma firmalarını (strategic_partner) ve tedarikçileri kabul ediyor. İşveren (job poster) için ayrı bir akış tanımlı değil.
- **Etki:** `employer_company_admin` ve `employer_recruiter` rolleri authz'de tanımlı ama bu rollerin atanacağı bir kayıt akışı yok.
- **Çözüm:** Bireysel işveren kaydı için yeni route + form + backend endpoint.

### Gap-2: candidate_user için kayıt yolu yok

- **Belirti:** Bir iş arayan bireysel kullanıcı sisteme katılmak istiyor ama giriş yapabileceği bir kayıt sayfası yok.
- **Kök neden:** Mevcut kayıt yollarının hiçbiri `candidate_user` rolü atamıyor. `/talent/register` login sonrası profil oluşturur; kayıt değil.
- **Etki:** candidate_user hiç oluşturulamıyor (yalnızca DB'den manuel). Atomik-2/3/4'te UI hazırlandı ama kullanıcı hiç var olamıyor.
- **Çözüm:** Bireysel aday kaydı için yeni route + form + backend endpoint.

### Gap-3: guest_public kullanıcısı için entry point yok

- **Belirti:** Giriş yapmadan `/jobs` sayfasını görmek isteyen bir kullanıcının sisteme dahil olma yolu yok.
- **Kök neden:** `/jobs` authenticated-only; public jobs surface PHASE 3'te out-of-scope bırakıldı.
- **Etki:** İş arayanlar sistemi keşfedemiyor; conversion sıfır.
- **Durum:** PHASE 5 veya PHASE 6 kapsamında ele alınacak; PHASE 4'te navigasyon CTA'sı yeterli.

### Gap-4: Post-registration redirect yokluk

- **Belirti:** Kullanıcı kayıt tamamlandığında nereye yönleneceği belirsiz.
- **Kök neden:** Mevcut onboarding `done` step'i için genel bir mesaj gösteriyor; rol bazlı yönlendirme yok.
- **Çözüm:** employer → `/jobs`, candidate → `/talent/profile` (veya `/jobs`).

---

## 3. PHASE 4 Atomik Backlog

### Atomik-1: Envanter (bu adım) — kod değişikliği yok

**Amaç:** Mevcut durumu belgele, PHASE 4 backlog'u tanımla.
**Commit:** Yok (inventory).

---

### Atomik-2: Backend — bireysel kullanıcı kayıt endpoint'i — COMPLETE

**Commit:** `feat(auth): add public register endpoint for employer and candidate onboarding`

**Dosyalar:** `api/routers/auth.py`, `api/tests/test_auth_register.py`

**Endpoint:** `POST /api/v1/auth/register` — HTTP 201 Created.

**Sözleşme:**
```json
Request:  { "email": "...", "password": "...", "full_name": "...", "user_type": "employer"|"candidate" }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer", "user": {...} }
```

**Rol ataması:**
- `user_type = "employer"` → `system_role = "employer_company_admin"`
- `user_type = "candidate"` → `system_role = "candidate_user"`

**Test sonuçları:** 14/14 PASS (yeni) + 22/22 PASS (mevcut — regresyon yok)

**G1 + G2 durumu:** Backend registration path DONE — employer ve candidate artık sisteme katılabilir.

**Amaç:** `employer_company_admin` veya `candidate_user` rolü ile yeni bir bağımsız kullanıcı oluşturacak endpoint.

**Dosya:** `api/routers/auth.py` veya yeni `api/routers/individual_register.py`

**Endpoint önerisi:**
```
POST /auth/register
Body: { email, password, full_name, user_type: "employer" | "candidate" }
```

**Rol ataması:**
- `user_type: "employer"` → `system_role = "employer_company_admin"`
- `user_type: "candidate"` → `system_role = "candidate_user"`

**Yan etki kontrol:** `EMPLOYER_ADMIN_SYSTEM_ROLES` ve `TALENT_MEMBER_SYSTEM_ROLES` zaten bu rolleri içeriyor (Atomik-2, PHASE 3). Bu endpoint yalnızca rol ataması yapar; authz değişmez.

**E-posta aktivasyonu:** Mevcut `activate` endpoint'i yeniden kullanılabilir. Önce aktif kullanıcı oluşturma (no-activation) veya aktivasyon linki gönderme.

**Test:** backend unit test — rol atama doğrulaması, duplicate email kontrolü.

**Bağımlılık:** Yoktur.

**Not:** `api/routers/onboarding_router.py` mevcut durumda dirty (unrelated) — dokunma. Yeni file veya `auth.py` extension tercih edilmeli.

---

### Atomik-3: Frontend — EmployerRegisterPage — COMPLETE

**Amaç:** `employer_company_admin` rolü ile yeni kullanıcı oluşturacak kayıt formu.

**Route:** `/employer/register` (public, no auth guard)

**Dosyalar (tamamlandı):**
- `web/src/pages/EmployerRegisterPage.tsx` (yeni) — form component
- `web/src/pages/EmployerRegisterPage.css` (yeni) — responsive styles
- `web/src/App.tsx` — lazy import + public route `/employer/register`
- `web/src/services/auth.service.ts` — `registerUser()` fonksiyon eklendi
- `web/src/context/AuthProvider.tsx` — `/employer/register` PUBLIC_AUTH_PATHS'e eklendi

**Form alanları (gerçekleşen):**
- Ad Soyad (full_name) — boş validasyonu
- E-posta (email) — boş validasyonu
- Şifre (password) — min 8 karakter validasyonu
- Şifre Tekrar (confirm_password) — eşleşme validasyonu

**Başarı davranışı:** token pair sessionStorage'a set → `/jobs` redirect (replace: true)

**Responsive gate:** 33/33 PASS — 360 / 768 / 1280 × 4 senaryo × 3 viewport
- Senaryo 1: render (title, 4 input, submit görünürlük, kart taşma yok)
- Senaryo 2: boş submit → client validasyonu, navigation yok
- Senaryo 3: şifre uyumsuzluğu → hata gösterimi
- Senaryo 4: submit mock success → /jobs redirect

**Gates:**
- type-check: PASS (0 hata)
- build: PASS (EmployerRegisterPage-CH8jiTTE.js, EmployerRegisterPage-D44WBB_C.css)
- responsive gate: 33/33 PASS

**G4 durumu (employer tarafı):** Frontend kayıt formu ve /jobs yönlendirmesi DONE.

---

### Atomik-4: Frontend — CandidateRegisterPage — COMPLETE

**Amaç:** `candidate_user` rolü ile yeni bireysel iş arayan kaydı.

**Route:** `/candidate/register` (public, no auth guard)

**Dosyalar (tamamlandı):**
- `web/src/pages/CandidateRegisterPage.tsx` (yeni) — form component
- `web/src/pages/CandidateRegisterPage.css` (yeni) — blue brand responsive styles
- `web/src/App.tsx` — lazy import + public route `/candidate/register`
- `web/src/context/AuthProvider.tsx` — `/candidate/register` PUBLIC_AUTH_PATHS'e eklendi

**Form alanları (gerçekleşen):**
- Ad Soyad (full_name) — boş validasyonu
- E-posta (email) — boş validasyonu
- Şifre (password) — min 8 karakter validasyonu
- Şifre Tekrar (confirm_password) — eşleşme validasyonu

**Başarı davranışı:** token pair sessionStorage'a set → `/talent/profile` redirect (replace: true)

**Responsive gate:** 33/33 PASS — 360 / 768 / 1280 × 4 senaryo × 3 viewport
- Senaryo 1: render (title, 4 input, submit görünürlük, kart taşma yok)
- Senaryo 2: boş submit → client validasyonu, navigation yok
- Senaryo 3: şifre uyumsuzluğu → hata gösterimi
- Senaryo 4: submit mock success → /talent/profile redirect

**Gates:**
- type-check: PASS (0 hata)
- build: PASS (CandidateRegisterPage-yhHdFi_5.js, CandidateRegisterPage-BZY9cNc3.css)
- responsive gate: 33/33 PASS

**G2 durumu:** candidate_user kayıt akışı tam stack DONE (backend Atomik-2 + frontend Atomik-4).
**G4 durumu (candidate tarafı):** Frontend kayıt formu ve /talent/profile yönlendirmesi DONE.

---

### Atomik-5: Post-registration redirect + aktivasyon akışı — COMPLETE

**Amaç:** Rol bazlı redirect policy merkezileştirme + activation page hizası. Backend is_active=True davranışı değiştirilmedi.

**Not:** Aktivasyon email gate bu adımda eklenmedi — backend immediate login (is_active=True) intentional. Activation sayfası yalnızca davet edilen internal kullanıcılar içindir; kayıt akışı doğrudan token ile çalışır.

**Dosyalar (tamamlandı):**
- `web/src/config/register-redirect-policy.ts` (yeni) — `POST_REGISTER_REDIRECT` + `getActivationRedirectPath()`
- `web/src/pages/EmployerRegisterPage.tsx` — `POST_REGISTER_REDIRECT.employer` kullanımı + info note
- `web/src/pages/EmployerRegisterPage.css` — `__info` class (yeşil #059669)
- `web/src/pages/CandidateRegisterPage.tsx` — `POST_REGISTER_REDIRECT.candidate` kullanımı + info note
- `web/src/pages/CandidateRegisterPage.css` — `__info` class (mavi #0284c7)
- `web/src/pages/InternalUserActivationPage.tsx` — rol bazlı redirect: employer→/jobs, candidate→/talent/profile, fallback→/app

**Redirect Policy:**

| user_type / system_role | Hedef |
|---|---|
| employer (employer_company_admin, employer_recruiter) | /jobs |
| candidate (candidate_user) | /talent/profile |
| fallback (diğer tüm roller) | /app |

**Gate: 14/14 PASS**
- 3 viewport × 4 assertion (info note visible, kart taşma yok) = 12
- Activation smoke: employer→/jobs + candidate→/talent/profile = 2

---

### Atomik-6: Navigation — guest_public CTA'ları — COMPLETE

**Amaç:** Giriş yapmayan kullanıcılara employer/candidate kayıt entry point'leri göster.

**Dosyalar (tamamlandı):**
- `web/src/config/navigation-policy.ts` — iki yeni item eklendi (order 60 + 70, visibility_scope: "public")
- `web/src/components/NavBar.tsx` — link split + `.public-nav-cta` render + popup register section
- `web/src/components/NavBar.css` (yeni) — `.public-nav-cta` focus-visible + hover stilleri

**Nav items:**
- "İşveren Kaydı" → `/employer/register` — yeşil (#059669) button-link
- "İş Arıyorum" → `/candidate/register` — mavi (#0284c7) button-link

**Responsive + collapse:**
- 360/768/1280: CTA'lar NavBar'da inline görünür
- Mobil: "Sisteme Giriş" popup açıldığında "Yeni Hesap" bölümünde de mevcut

**Gate: 11/11 PASS**
- 3 viewport × 3 assertion (employer visible, candidate visible, non-zero width) = 9
- Mobile popup: employer + candidate in popup = 2

---

### Atomik-7: Responsive gate + E2E validation

**Amaç:** Tüm PHASE 4 akışlarını uçtan uca doğrula.

**Gate script:** `tools/atomik7_onboarding_gate.mjs`

**Senaryolar:**
- employer kayıt formu render + submit mock (3 viewport)
- candidate kayıt formu render + submit mock (3 viewport)
- guest_public nav CTA görünürlüğü (3 viewport)
- post-login redirect doğrulaması

---

## 4. Riskler

| Risk | Seviye | Önlem |
|---|---|---|
| `api/routers/onboarding_router.py` dirty (unrelated) | Düşük | Yeni endpoint için auth.py extension veya yeni router kullan |
| Email aktivasyon akışı mevcut tenant_admin flow'u etkiler | Orta | Activate endpoint'i user_type agnostic; rol attach'ı kayıt anında yapılır |
| Şifre hash, güvenlik gereksinimleri | Orta | Mevcut login endpoint ile aynı pattern; Bcrypt kullan |
| Supplier register page pattern referansı | Düşük | `SupplierRegisterPage.tsx` mevcut — pattern'i takip et, fork etme |

---

## 5. Bağımlılıklar

| Atomik | Bağlıdır |
|---|---|
| Atomik-2 (backend) | Bağımsız |
| Atomik-3 (employer UI) | Atomik-2 (endpoint mevcut olmalı ki submit çalışsın) |
| Atomik-4 (candidate UI) | Atomik-2 |
| Atomik-5 (redirect) | Atomik-3 + Atomik-4 |
| Atomik-6 (nav) | Atomik-3 + Atomik-4 (route'lar var olmalı) |
| Atomik-7 (gate) | Tüm önceki adımlar |
