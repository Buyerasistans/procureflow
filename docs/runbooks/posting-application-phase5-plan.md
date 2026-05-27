# PHASE 5 Plan — Posting & Application Lifecycle

Program: `NAV_GOVERNANCE_AND_JOB_MARKETPLACE`
Atomik-1 inventory date: 2026-05-27
Branch: pr/strict-gate-payment-clean-v2

---

## 1. Mevcut Durum Özeti

### Backend Endpoint Envanteri

| Endpoint | Method | Yetki | Durum |
|---|---|---|---|
| `POST /jobs` | Oluştur | employer_company_admin, employer_recruiter, tenant_admin, platform_staff, super_admin | MEVCUT |
| `GET /jobs` | Listele (sayfalı, filtrelenmiş) | Tüm authenticated; scope-aware | MEVCUT |
| `GET /jobs/{id}` | Detay (view_count++) | Tüm authenticated; scope-aware | MEVCUT |
| `PATCH /jobs/{id}` | Güncelle/durum değiştir | Poster veya broad admin | MEVCUT |
| `POST /jobs/{job_id}/apply` | Başvur | talent_member, candidate_user | MEVCUT |
| `GET /jobs/{job_id}/applications` | Başvuruları listele | Employer; tenant-aware | MEVCUT |
| `PATCH /applications/{id}/status` | Durum geçişi | Employer; tenant-aware | MEVCUT |
| `GET /my/applications` | Kendi başvurularım | — | **YOK** |
| `POST /jobs/{id}/withdraw` (veya benzeri) | Başvuruyu geri çek | candidate_user | **YOK** |

### İş İlanı Durum Makinesi (Model)

```
draft → published → closed
                 → filled
published → draft (?)  [PATCH destekler ama UI yok]
```

Yaratma sırasında: yalnızca `draft | published` izin verilir (`ProcurementJobCreate`).
Güncelleme sırasında: `draft | published | closed | filled` tümü izin verilir (`ProcurementJobUpdate`).

### Başvuru Durum Makinesi (Employer-side state machine)

```
applied → shortlisted | rejected
shortlisted → interview | rejected
interview → offered | rejected
offered → rejected
rejected → (terminal)
withdrawn → (terminal)   ← model tanımlı ama candidate endpoint'i YOK
```

### Frontend Route Envanteri

| Route | Sayfa | Roller (nav policy) |
|---|---|---|
| `/jobs` | JobsPage.tsx | talent_member, employer_company_admin, employer_recruiter, candidate_user, referral_partner, super_admin |
| `/talent/profile` | TalentProfilePage.tsx | talent_member, candidate_user, referral_partner, super_admin |
| `/admin/talent-ecosystem` | TalentAdminControlPage.tsx | (admin-only) |
| `/jobs/:id` | — | **SAYFA YOK** (fetchJob servisi mevcut) |
| `/jobs/:id/applications` | — | **SAYFA YOK** |
| `/my/applications` | — | **SAYFA YOK** |

### Frontend Servis Envanteri (`jobs.service.ts`)

| Fonksiyon | Backend Eşleşmesi | Durum |
|---|---|---|
| `fetchJobs()` | `GET /jobs` | MEVCUT |
| `fetchJob(id)` | `GET /jobs/{id}` | MEVCUT (UI yok) |
| `createJob()` | `POST /jobs` | MEVCUT |
| `applyToJob()` | `POST /jobs/{job_id}/apply` | MEVCUT |
| `updateJob()` | `PATCH /jobs/{id}` | **EKSİK** |
| `listApplications()` | `GET /jobs/{job_id}/applications` | **EKSİK** |
| `updateApplicationStatus()` | `PATCH /applications/{id}/status` | **EKSİK** |
| `getMyApplications()` | `GET /my/applications` | **EKSİK + BACKEND YOK** |
| `withdrawApplication()` | backend yok | **EKSİK + BACKEND YOK** |

---

## 2. Gap Analizi

### G1 — Candidate UX: `TALENT_PROFILE_REQUIRED` hatası bağlantısız

**Belirti:** `candidate_user` `/jobs`'a gelir, "Başvur"a tıklar, `TALENT_PROFILE_REQUIRED` hatasıyla engellenir.
Hata mesajı: "Başvuru için önce talent profilinizi oluşturmalısınız." — ama `/talent/profile`'a link yok.

**Etki:** Yeni kayıtlı candidate_user nerede profil oluşturacağını bilmiyor.

**Risk:** Düşük. Tek dosya, tek satır link ekleme.

**Çözüm:** `ApplyForm`'da `TALENT_PROFILE_REQUIRED` hatasında `/talent/profile` linki göster.

---

### G2 — Employer: İlan durum aksiyonları yok (Kapat / Dolu İşaretle)

**Belirti:** İşveren, yayınlanmış bir ilanı `closed` veya `filled` yapamıyor.
Backend `PATCH /jobs/{id}` destekliyor ama UI'da buton yok.

**Etki:** Dolu pozisyonlar veya kapanan ilanlar `published` olarak kalıyor; aday karışıklığı riski.

**Risk:** Orta. `updateJob()` servisi eksik; JobCard'a aksiyon butonu eklenecek.

**Çözüm:**
- `jobs.service.ts`: `updateJob(id, payload)` ekle.
- `JobCard`: employer için `published` ilanda "Kapat" ve "Dolu İşaretle" butonları.

---

### G3 — Employer: Başvuru pipeline görüntüleyici yok

**Belirti:** Employer, hangi adayların başvurduğunu, hangi aşamada olduklarını ve kim tarafından incelendiğini göremiyor.
Backend `GET /jobs/{job_id}/applications` ve `PATCH /applications/{id}/status` mevcut ama UI yok.

**Etki:** Tüm işe alım akışı kör çalışıyor. employer_recruiter rolü işlevsiz.

**Risk:** Yüksek. Yeni component/panel gerekiyor; state machine geçiş butonları.

**Çözüm:**
- `jobs.service.ts`: `listApplications(jobId)` ve `updateApplicationStatus(appId, payload)` ekle.
- `JobCard`'a "Başvurular" toggle ekle veya `/jobs/:id` detay sayfası oluştur.
- Başvuru satırlarında durum badge + geçiş butonları.

---

### G4 — Candidate: Kendi başvurularını görememe

**Belirti:** Aday hangi ilanlara başvurduğunu, başvurusunun hangi aşamada olduğunu göremez.

**Kök neden:** `GET /my/applications` backend endpoint'i yok. `withdrawn` için de backend endpoint yok.

**Etki:** Candidate_user başvuru durumunu takip edemiyor; PHASE 4 ile tamamlanan kayıt akışı eksik kalıyor.

**Risk:** Yüksek. Backend endpoint gerekiyor + frontend sayfa/panel.

**Çözüm (iki adım):**
- Backend: `GET /api/v1/my/applications` — candidate'ın kendi başvurularını dönsün.
- Frontend: TalentProfilePage'e "Başvurularım" bölümü veya yeni route.

---

### G5 — Candidate: Başvuru geri çekme yok

**Belirti:** Model `withdrawn` durumu tanımlı. `JobApplicationStatusUpdate` şemasında yok (sadece employer geçişleri). Candidate kendi başvurusunu geri çekemez.

**Kök neden:** job_applications.py comment: "Talent withdrawal is a separate flow (PHASE 3+)" — bilinçli olarak ötelenmiş.

**Risk:** Orta. Yeni backend endpoint + minimal UI.

**Çözüm:**
- Backend: `POST /jobs/{job_id}/applications/mine/withdraw` veya `DELETE /jobs/{job_id}/apply`.
- Frontend: "Geri Çek" butonu başvuru listesinde.

---

### G6 — Job Detail Page yok

**Belirti:** `fetchJob(id)` servisi mevcut, `/jobs/:id` App.tsx'te kayıtlı değil.

**Etki:** İlan tıklanabilir detay sayfası yok; tüm içerik list card'ında.

**Risk:** Düşük-Orta. Yeni sayfa, mevcut `fetchJob` servisini kullanır.

**Çözüm:** `/jobs/:id` route + `JobDetailPage.tsx` — okuma odaklı (employer edit + candidate apply CTA'ları).

---

## 3. PHASE 5 Atomik Backlog

### Atomik-1: Envanter (bu adım) — kod değişikliği yok — COMPLETE

**Amaç:** G1–G6 gap'lerini belgele, PHASE 5 backlog'u tanımla.
**Commit:** docs(phase5): bootstrap posting and application lifecycle inventory and atomic backlog

---

### Atomik-2: Candidate UX hızlı kazanımı — `TALENT_PROFILE_REQUIRED` linki — COMPLETE

**Amaç:** G1'i kapat. Yeni kayıtlı candidate_user'ın başvuru engeline çarptığında `/talent/profile`'a yönlendirilmesini sağla.

**Dosyalar (tamamlandı):**
- `web/src/pages/JobsPage.tsx` — `ApplyForm`'a `profileLinkRequired` state eklendi; TALENT_PROFILE_REQUIRED durumunda `<Link className="jobs-page__error-link" to="/talent/profile">` render edilir
- `web/src/pages/JobsPage.css` — `.jobs-page__error-link` stili eklendi (renk, hover, focus-visible)

**Link davranışı:**
- Hata kodu: `TALENT_PROFILE_REQUIRED`
- Hata mesajı: "Başvuru için önce talent profilinizi oluşturmalısınız."
- Link metni: "Profil oluştur →"
- Selector: `.jobs-page__error-link[href="/talent/profile"]`
- Klavye odaklanabilir (focus-visible outline #991b1b)

**Gate:** 19/19 PASS — `tools/atomik2_talent_profile_link_gate.mjs`
- A1-A6: hata görünürlüğü + link varlığı + href doğruluğu + overflow yok — 360/768/1280
- A7: link tıklama → /talent/profile navigation — 1280

**G1 durumu:** DONE

---

### Atomik-3: Employer — İlan durum aksiyonları (Kapat / Dolu İşaretle)

**Amaç:** G2'yi kapat. Employer yayındaki ilanı kapatabilsin veya dolu işaretleyebilsin.

**Dosyalar:**
- `web/src/services/jobs.service.ts` — `updateJob(id, payload)` ekle
- `web/src/pages/JobsPage.tsx` — `JobCard` employer aksiyon butonları
- `web/src/pages/JobsPage.css` — gerekirse stilsiz kalmasın

**Gate:** Responsive (360/768/1280) — status button görünürlük + mock PATCH success
**Bağımlılık:** Yok (backend mevcut).
**Risk:** Orta.

---

### Atomik-4: Employer — Başvuru pipeline görüntüleyici

**Amaç:** G3'ü kapat. Employer, bir ilanın başvurularını görebilsin ve durum geçişi yapabilsin.

**Dosyalar:**
- `web/src/services/jobs.service.ts` — `listApplications()`, `updateApplicationStatus()` ekle
- `web/src/pages/JobsPage.tsx` — `JobCard`'a toggle veya yeni `ApplicationsPipeline` component
- `web/src/pages/JobsPage.css` — pipeline tablo/kart stilleri

**Gate:** Responsive (360/768/1280) — employer session mock, başvuru listesi görünür, durum geçiş butonu çalışır
**Bağımlılık:** Atomik-3 (updateJob bağımsız ama aynı dosyada çalışılacak).
**Risk:** Yüksek. Yeni bileşen; state machine transition UI.

---

### Atomik-5: Backend — Candidate başvuru geçmişi endpoint'i

**Amaç:** G4 (backend kısmı). `GET /api/v1/my/applications` — candidate'ın kendi başvurularını dönsün.

**Dosyalar:**
- `api/routers/job_applications.py` — yeni endpoint ekle
- `api/tests/test_job_applications.py` — birim test

**Gate:** Backend birim test (kandidat token ile GET → kendi başvurularını görür; başkasının görmez)
**Bağımlılık:** Yok.
**Risk:** Düşük. Tek endpoint, yalnızca `applicant_user_id == current_user.id` filter.

---

### Atomik-6: Frontend — Candidate başvuru geçmişi UI

**Amaç:** G4 (frontend kısmı). TalentProfilePage'e "Başvurularım" bölümü ekle.

**Dosyalar:**
- `web/src/services/jobs.service.ts` — `getMyApplications()` ekle
- `web/src/pages/TalentProfilePage.tsx` — `MyApplicationsSection` component
- `web/src/pages/TalentProfilePage.css` — başvuru satırı stilleri

**Gate:** Responsive (360/768/1280) — candidate session mock, başvuru listesi görünür, durum badge'leri doğru
**Bağımlılık:** Atomik-5 (backend endpoint).
**Risk:** Orta.

---

### Atomik-7: Backend + Frontend — Başvuru geri çekme (withdrawal)

**Amaç:** G5'i kapat. Candidate kendi başvurusunu geri çekebilsin.

**Backend dosyaları:**
- `api/routers/job_applications.py` — `DELETE /jobs/{job_id}/applications/mine` veya `POST /applications/{id}/withdraw`
- `api/tests/test_job_applications.py` — withdrawal test

**Frontend dosyaları:**
- `web/src/services/jobs.service.ts` — `withdrawApplication()` ekle
- `web/src/pages/TalentProfilePage.tsx` — başvuru satırına "Geri Çek" butonu

**Gate:** Backend unit test (withdraw → status=withdrawn, tekrar başvuru imkanı?) + frontend responsive
**Bağımlılık:** Atomik-5 + Atomik-6 (başvuru listesi görünmeli ki withdraw edilebilsin).
**Risk:** Orta. Duplicate başvuru kısıtı: withdraw sonrası aynı ilana tekrar başvurulabilir mi? Açık tasarım kararı.

---

### Atomik-8: Full PHASE 5 E2E gate + closure

**Amaç:** PHASE 5 tüm akışlarını tek gate ile doğrula.

**Gate script:** `tools/atomik8_phase5_e2e_gate.mjs`

**Senaryolar:**
- Employer: ilan oluştur → yayınla → kapat (3 viewport)
- Employer: başvuru listesi + durum geçişi (desktop)
- Candidate: başvur → TALENT_PROFILE_REQUIRED → link görünür (3 viewport)
- Candidate: başvuru geçmişi listesi (desktop)
- Candidate: geri çekme (desktop)

---

## 4. Öncelik ve Kapsam Değerlendirmesi

| Atomik | Değer | Risk | Öncelik |
|---|---|---|---|
| A2: Candidate UX link | Yüksek (quick win) | Düşük | **P0** |
| A3: İlan durum aksiyonları | Yüksek | Orta | **P1** |
| A4: Başvuru pipeline | Yüksek | Yüksek | **P1** |
| A5: Backend my/applications | Yüksek | Düşük | **P1** |
| A6: Frontend başvuru geçmişi | Yüksek | Orta | **P2** |
| A7: Withdrawal | Orta | Orta | **P2** |
| A8: E2E gate | Zorunlu kapanış | — | **P3** |

---

## 5. Riskler

| Risk | Seviye | Önlem |
|---|---|---|
| `candidate_user` → TalentProfile uyumsuzluğu | Orta | A2'de link ekle, A5/A6'da profil kontrolü |
| Başvuru durum makinesi UI'a yansıma hataları | Yüksek | State machine tablosunu UI'da doğrudan enumerate et |
| Withdrawal sonrası re-apply kısıtı | Orta | Atomik-7'de tasarım kararı ver (unique constraint kaldır?) |
| Employer recruiter vs admin yetki ayrımı | Orta | Her endpoint'te `can_post_procurement_job()` tutarlı |
| Responsive risk: başvuru tabloları mobilde | Yüksek | Her Atomik'te 360px viewport zorunlu gate |

---

## 6. Bağımlılık Grafiği

```
A1 (envanter)
└── A2 (candidate UX) — bağımsız
└── A3 (employer durum aksiyonları) — bağımsız
└── A4 (başvuru pipeline) — A3 ile paralel, aynı dosya
└── A5 (backend my/applications) — bağımsız
    └── A6 (frontend başvuru geçmişi) — A5'e bağımlı
        └── A7 (withdrawal) — A5+A6'ya bağımlı
└── A8 (E2E gate) — tüm önceki adımlara bağımlı
```
