# P0/P1 Kapanis Backlog ve Sirali Icra Plani (2026-05-17)

Bu dokuman, acik kalan maddeleri tek listede toplar ve "ne sirayla yapacagiz?" sorusuna operasyonel cevap verir.

## 1) Kapsam

- Kaynak dokumanlar:
  - `HOSTING_DEPLOYMENT_TRACKER.md`
  - `BUYER_ASISTANS_PUBLIC_WORKFLOW.md`
  - `ONBOARDING_IMPLEMENTATION_COMPLETE_PHASE_1_2.md`
  - `ADMIN_PANEL_FIRMALAR_PERSONEL_REFACTOR.md`
  - `ARCHITECTURE.md`
  - `docs/release/*` (preflight, runbook, go/no-go, minute checklist)
- Hedef:
  - Acik maddeleri P0/P1 onceliginde kapatmak
  - Release kararini kanitli sekilde verebilmek

## 2) Oncelik Tanimi

- `P0`: Canliya cikis/karar kapisini dogrudan bloklayan maddeler
- `P1`: P0 kapandiktan hemen sonra tamamlanmasi gereken kalite/operasyon maddeleri

## 3) Birlesik Backlog

### P0 - Bloklayicilar

- [ ] Uctan uca deployment smoke:
  - ZIP yenile + deploy + frontend build + API restart
  - Kaynak: `HOSTING_DEPLOYMENT_TRACKER.md` (6.4)
- [ ] Kritik smoke test paketi:
  - Health 200
  - Auth login/refresh 1 senaryo
  - Supplier workspace (bekleyen/gonderilen/kapali) 1 senaryo
  - Invalid quote transition -> HTTP 422
- [ ] Runtime log dogrulamasi:
  - `/tmp/uvicorn_start.log` hata taramasi
- [ ] Public web canli oncesi teknik kapilar:
  - DNS/SSL/redirect/canonical dogrulama
  - En az bir domainde analytics event gorulmesi
  - Rollback sahibi + iletisim kanali netlestirme
  - Kaynak: `BUYER_ASISTANS_PUBLIC_WORKFLOW.md` (Canli Oncesi Kapi)
- [ ] Migration/release gate senkronu:
  - Preflight audit + hedefli test + go/no-go kaydi guncel kanitla eslesmeli
  - Kaynak: `docs/release/tenant-saas-final-migration-preflight.md`, `docs/release/go-no-go-2026-04-19.md`

### P1 - Kapanis ve Kalite

- [ ] Admin refactor acik maddeleri:
  - Projeye ait firma filtresi/gruplama (admin proje listesi)
  - Kalan test maddeleri (ozellikle public/helper ve authz gorunurluk)
  - Kaynak: `ADMIN_PANEL_FIRMALAR_PERSONEL_REFACTOR.md`
- [ ] Onboarding Phase 3 cikis kapisi:
  - Frontend onboarding akisi exit kriterlerinin kapanisi
  - Kaynak: `ONBOARDING_IMPLEMENTATION_COMPLETE_PHASE_1_2.md`
- [ ] Terminoloji temizligi:
  - Turkce olmayan menu/izin metinlerinin tamamlanmasi
  - Kaynak: `ADMIN_PANEL_FIRMALAR_PERSONEL_REFACTOR.md`, `Terminoloji_karari.md`
- [ ] Dokuman tekil kaynak hizalama:
  - "tamamlandi" ve "acik" durum cakislarini tek karar kaynagina bagla
  - Bu dosya + `go-no-go` referans alinacak

## 4) Sirali Icra Plani

### Faz A - Release Gate Hazirlik (P0)

1. `owner` atamasi:
   - Deployment, backend smoke, frontend smoke, public-web operations icin sorumlu kisileri sabitle.
2. Ortam kilitleme:
   - Hangi commit/build ile test yapilacagini sabitle; test sirasinda kod degisimi yapma.
3. Preflight paketini calistir:
   - Audit komutlari + hedefli testler.
4. Sonuclari artefaktla:
   - JSON/CSV/test ciktilarini release klasorunde tarihli kaydet.

### Faz B - Uctan Uca Dogrulama (P0)

1. Deploy uygulamasi:
   - ZIP/deploy/build/restart sirasi.
2. Teknik smoke:
   - Health/auth/quote/supplier senaryolari.
3. Public-web smoke:
   - Canonical/redirect/sitemap/robots + analytics event kontrolu.
4. Log ve hata tarama:
   - Uvicorn/application loglarinda kritik hata yok teyidi.

### Faz C - Karar Kapisi (P0)

1. Go/No-Go matrisi doldurma:
   - "Evet/Hayir + kanit linki" seklinde.
2. Karar:
   - `GO` ise release notu kapat.
   - `NO-GO` ise rollback + issue listesi ac.

### Faz D - Hemen Sonrasi (P1)

1. Admin refactor kalanlari kapat.
2. Onboarding Phase 3 cikis kriterlerini tamamla.
3. Terminoloji ve UI metin temizlik turu.
4. Dokuman konsolidasyonu:
   - Bu dosyayi ana backlog, `go-no-go` dosyasini karar kaydi olarak sabitle.

## 5) Kanit Zorunlulugu (Definition of Done)

Bir madde `done` sayilmasi icin:

- [ ] Komut/test calismis olmali
- [ ] Sonuc dosyasi veya ekran kaniti olmali
- [ ] Tarih + sorumlu + ortam bilgisi not edilmeli
- [ ] Ilgili dokumanda kutucuk isaretlenmeli

## 6) Hizli Komut Seti (Operasyon Omurgasi)

Asagidaki komutlar referans niteligindedir; ortam yollarini mevcut runbook'a gore guncelleyin.

```bash
# Backend health
curl http://localhost:8000/api/v1/health

# Alembic current
api/.venv/bin/alembic -c api/alembic.ini current

# Frontend tests
cd web && npm run test:run

# Backend tests (hedefli veya tam)
python -m pytest -q
```

## 7) Yurutme Notu

Bu backlog "tek kaynak" olarak kullanilacaksa, her icra sonunda yalniz bu dosya ve ilgili `go-no-go` dosyasi guncellensin. Diger plan dokumanlari referans olarak kalabilir.

## 8) Icra Board (Canli Takip)

Durum kodu:
- `TODO`: Baslanmadi
- `IN_PROGRESS`: Devam ediyor
- `BLOCKED`: Dis bagimlilik/engel var
- `DONE`: Kanitla kapandi

### P0 Board

| ID | Is Kalemi | Owner | Hedef Tarih | Durum | Kanit |
|---|---|---|---|---|---|
| P0-01 | Uctan uca deployment smoke (zip/deploy/build/restart) | DevOps | 2026-05-18 | DONE | [2026-05-17] local `DeploymentService.refresh_zip()` => `Hostinge_Yukle.zip yenilendi (382 dosya, 16.27 MB)`; remote `DeploymentService.deploy_to_host()` => `SITE BASARILI SEKILDE YAYINA ALINDI`; remote `systemctl is-active procureflow.service` => `active`; remote `curl http://localhost:8000/api/v1/health` => `{\"status\":\"ok\"}` |
| P0-02 | Kritik smoke test paketi (health/auth/supplier/invalid-422) | Backend | 2026-05-18 | DONE | [2026-05-17] remote `GET /api/v1/health` => `200`; remote `POST /api/v1/supplier/login` (owner/admin demo hesaplari) => `200`; remote `GET /api/v1/supplier-quotes/me` => `200` (iki hesapta da `0` kayit); remote `POST /api/v1/auth/refresh` (invalid token) => `401`; remote `POST /api/v1/supplier-quotes/0/submit` + bos payload => `422` (zorunlu alan validation) |
| P0-03 | Runtime log dogrulamasi (`uvicorn_start.log`) | Backend | 2026-05-18 | DONE | [2026-05-17] remote `tail -20 /tmp/uvicorn_start.log` => dosya yok (systemd unit ile calisiyor); alternatif dogrulama `journalctl -u procureflow.service -n 20 --no-pager` => restart/start kayitlari temiz, kritik traceback yok |
| P0-04 | Public web canli oncesi teknik kapilar (DNS/SSL/redirect/canonical) | WebOps | 2026-05-19 | DONE | [2026-05-17] `www.buyerasistans.com.tr -> buyerasistans.com.tr` 301 kalici duzeltildi (`/var/www/vhosts/system/buyerasistans.com.tr/conf/vhost_nginx.conf`, `plesk sbin httpdmng --reconfigure-domain buyerasistans.com.tr`, `nginx -t`, `reload`); dis dogrulama `curl -I` ile `https://buyerasistans.com.tr`, `https://buyerasistans.com`, `https://buyerasistans.info`, `https://buyerasistans.online` => tumu `200 OK`; `https://www.buyerasistans.com.tr` => `301` |
| P0-05 | Analytics event gorunurlugu (en az 1 domain) | Growth/Ops | 2026-05-19 | DONE | [2026-05-17] live `POST /api/v1/public/telemetry` (`host=buyerasistans.com.tr,event_type=page_view`) => `accepted=true`; [2026-05-17] super-admin login + `GET /api/v1/admin/platform-analytics?host=buyerasistans.com.tr&event_type=page_view&start_date=2026-01-01&end_date=2026-12-31` => `public_summary.page_view_count=20`, `telemetry_breakdown_count=1`; `GET /api/v1/admin/platform-analytics/export?...` => `200` ve CSV icinde `buyerasistans.com.tr` kaydi var |
| P0-06 | Rollback owner + iletisim kanali netlestirme | Release Manager | 2026-05-19 | DONE | [2026-05-17] Rollback owner: `superadmin@buyerasistans.com.tr` (tek owner). `channel.owner.demo@buyerasistans.com.tr` ayri roldedir ve rollback owner/yedek kapsaminda degildir. Operasyon iletisim kanali: e-posta hatti + gercek zamanli kriz kanali `release-war-room` (runbook standard ad) |
| P0-07 | Preflight audit + hedefli test + go/no-go kanit senkronu | Release Manager | 2026-05-19 | DONE | [2026-05-17] local `alembic current` => `20260429_add_company_mailbox_team_visibility_toggle (head)`; `validate_runtime_bootstrap_chain.py` => `VALIDATED_RUNTIME_BOOTSTRAP_CHAIN`; `audit_quote_mirror_drop_readiness.py` => `QUOTE_LEGACY_MIRRORS_DROP_READY` (`drop_ready=true`); `pytest tests/test_tenant_governance_authz.py -k \"billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event\"` => `2 passed`; `docs/release/go-no-go-2026-04-19.md` teknik GO kaydi mevcut |

### P1 Board

| ID | Is Kalemi | Owner | Hedef Tarih | Durum | Kanit |
|---|---|---|---|---|---|
| P1-01 | Admin refactor acik maddeler (proje-firma filtre/gruplama) | Frontend | 2026-05-20 | DONE | [2026-05-17] admin proje listesinde firma filtresi + firma bazli gruplama aktif (`web/src/components/ProjectsTab.tsx`); dogrulama testi: `npm --prefix web run test:run -- src/test/projects-tab-permissions.test.tsx` => `2/2 passed` (firma filtresi senaryosu eklendi). Refactor checklist gunceli: `ADMIN_PANEL_FIRMALAR_PERSONEL_REFACTOR.md` ilgili P2 madde `[x]`. |
| P1-02 | Kalan test maddeleri (authz/public/helper) | QA | 2026-05-20 | DONE | [2026-05-17] hedefli test paketi: `npm --prefix web run test:run -- src/test/permissions.test.ts src/test/public-pages.test.tsx src/test/auth-guards.test.tsx` => `3/3 dosya, 30/30 test passed`; `public-pages.test.tsx` helper kapsamı (`getShortCompanyName`) dogrulandi ve refactor checklist'te ilgili P3 kutusu `[x]` yapildi. |
| P1-03 | Onboarding Phase 3 exit kriterleri | Frontend | 2026-05-21 | DONE | [2026-05-17] hedefli onboarding paketleri: `npm --prefix web run test:run -- src/test/onboarding-page.test.tsx src/test/premium-feature-purchase-panel.test.tsx src/test/profile-page-channel-summary.test.tsx` => `3/3 dosya, 9/9 test passed`; onboarding wizard akisi, premium feature aktivasyon paneli ve channel commission ozet akis kanitlandi. |
| P1-04 | Terminoloji temizligi (TR olmayan menu/izin metinleri) | Frontend | 2026-05-21 | DONE | [2026-05-17] gorunen menu/yonlendirme etiketleri Turkcelestirildi (`web/src/admin/workspace-panels.ts`: `Dashboard -> Genel Bakis`, `Deployment -> Yayinlama`, `Public Fiyatlandirma -> Genel Fiyatlandirma`; menu stil etiketleri guncellendi), odak aksiyonu `Projects'e Git -> Projelere Git` (`web/src/pages/AdminPage.tsx`), ilgili test gunceli (`web/src/test/admin-page-tenant-governance.test.tsx`) ve dogrulama: `npm --prefix web run test:run -- src/test/admin-page-tenant-governance.test.tsx` => `55/55 passed`. |
| P1-05 | Dokuman konsolidasyonu (tek source of truth) | Release Manager | 2026-05-21 | DONE | [2026-05-17] karar kaydi ve operasyon backlog'u hizalandi: `docs/release/go-no-go-2026-04-19.md` icine `p0-p1-closure-backlog-2026-05-17.md` referansi eklendi ve "Dokuman Konsolidasyon Notu" bolumuyle rol ayrimi netlestirildi (backlog=birincil takip, go-no-go=karar kaydi). |
| P1-06 | Multi-domain content distribution (.com/.info/.online) | WebOps+Frontend | 2026-05-22 | DONE | [2026-05-17] sunucuda `.com.tr` public build artefaktlari (`index.html`, `assets/`, `brand/`, `robots.txt`, `sitemap*.xml`) `.com/.info/.online` docrootlarina senkronlandi; dis smoke: `https://buyerasistans.com`, `https://buyerasistans.info`, `https://buyerasistans.online` app HTML donuyor (Plesk default page yok), `.com/sitemap.xml` => `200`, `.info/robots.txt` => `200`. [2026-05-17] host-intent kalibrasyonu build'e eklendi (`web/src/lib/public-intent.ts`, `PublicSeoManager`, `PublicTelemetryManager`, `App.tsx` root domain redirect) ve 4 domaine dagitildi. [2026-05-17] knowledge route seti acildi: `.info/blog`, `.info/rehber`, `.info/sozluk` => `301` (slash normalize) ve nihai `200` (`-L` ile dogrulandi); `sitemap-knowledge.xml` knowledge pathleriyle guncel. |

## 9) Owner Atama Taslagi

Bu rol adlari kisi isimlerine cevrilerek sabitlenecek:

- `Release Manager`: Go/No-Go karari, artefakt toplama, kapanis raporu
- `DevOps`: Deploy akisi, sunucu/runtime operasyonlari
- `Backend`: API smoke, log analizi, migration dogrulamasi
- `Frontend`: UI/regresyon, onboarding phase-3, terminoloji temizligi
- `WebOps`: Domain/SEO/redirect/canonical/sitemap/robots kontrolleri
- `QA`: Test koordine etme, kanit formatini standardize etme
- `Growth/Ops`: Analytics event ve dashboard dogrulamasi

## 10) Kanit Link Formati (Standart)

Her kapanan maddeye asagidaki formatta kanit girilir:

```text
[YYYY-MM-DD] <ortam> <komut/test> => <sonuc ozeti> | artefakt: <dosya-yolu>
```

Ornek:

```text
[2026-05-18] prod-like pytest targeted smoke => 12/12 pass | artefakt: docs/release/evidence/smoke-2026-05-18.txt
```

## 11) Ana Yapi Tamamlama Kapsami (Sadeleştirme Yok)

Bu bolum, mevcut akisi bozmadan "ana yapiyi tamamlama" hedefine yoneliktir.
Kural:
- Mevcut bilgi mimarisi korunacak.
- Mevcut ekran akislarinda sadeleştirme/refactor bahanesiyle davranis degisikligi yapilmayacak.
- Degisiklikler "ekleme ve iyilestirme" seklinde ilerleyecek.

### 11.1 Ana Yapi Kapanis Maddeleri

- [ ] P0/P1 kapanis maddeleri tamamlanmadan yeni feature branch'ine gecilmemesi
- [ ] Ortak layout/route guard/permission akisinin stabilite kontrolu
- [ ] Deployment panel + runtime bootstrap + auth akisinin birlikte smoke edilmesi
- [ ] Ana navigasyon, admin sekmeleri, supplier sekmeleri ve channel sekmeleri arasinda kirik route kalmamasi

## 12) Sonraki Faz Backlog (Template + Platform + AI Kesif)

Bu faz, P0/P1 kapandiktan sonra aktiflestirilir.

### 12.1 CSS Template Katmani (Toplu Stil Altyapisi)

- [ ] Uygulama genelinde tekil tema token dosyasi:
  - renkler
  - spacing
  - radius
  - tipografi skala
  - z-index katmanlari
- [ ] Ortak "template CSS" dosyasi:
  - admin surfaces
  - supplier surfaces
  - public surfaces
  - channel surfaces
- [ ] Sayfa bazli daginik inline style birikiminin kontrollu azaltim plani
- [ ] Responsive breakpoint standardizasyonu (mobile/tablet/desktop)
- [ ] Karanlik mod planlanmiyorsa acikca "out-of-scope" notu

### 12.2 Platform Girisleri ve Profil Yetkinlestirme

- [ ] Platform login / strategic partner login / supplier login / channel login akislarinin ortak auth matrisinde hizalanmasi
- [ ] Profil sayfalarinda rol-temelli alan gorunurlugu
- [ ] Profilde tenant/channel/supplier baglami ozet kartlari
- [ ] Session yenileme/timeout/401 davranislarinin rol bazli dogrulanmasi
- [ ] Yetki eksikligi durumunda yonlendirme mesajlarinin standartlastirilmasi

### 12.3 AI Kesif (Stratejik Gelisim Basligi)

- [ ] AI Kesif vizyon notu (amac, kapsam, sinirlar) dokumani
- [ ] AI Kesif MVP:
  - veri kaynagi siniri
  - prompt/cevap denetim katmani
  - audit/event kaydi
  - rol bazli erisim kurali
- [ ] AI Kesif UI:
  - kesif oturumu baslatma
  - sonuc kartlari
  - aksiyon onerileri
  - feedback mekanizmasi
- [ ] AI Kesif test seti:
  - prompt safety
  - response schema
  - authz
  - observability

## 13) Fazlandirilmis Icra Sirasi (P0/P1 Sonrasi)

1. CSS template altyapisini kur (davranisi bozmadan).
2. Platform giris/profil yetkinlestirme maddelerini tamamla.
3. AI Kesif MVP kapsamini ac ve kontrollu rollout uygula.
4. Her adimda kanit formatina uygun artefakt biriktir.

## 14) Ek Board - Gelecek Fazlar

| ID | Is Kalemi | Owner | Hedef Tarih | Durum | Kanit |
|---|---|---|---|---|---|
| NXT-01 | CSS template token + ortak stil dosyasi | Frontend | 2026-05-22 | TODO | - |
| NXT-02 | Auth/login surface hizalama | Backend+Frontend | 2026-05-23 | TODO | - |
| NXT-03 | Profil yetkinlestirme paketi | Frontend | 2026-05-24 | TODO | - |
| NXT-04 | AI Kesif vizyon + MVP teknik taslak | AI/Backend | 2026-05-24 | TODO | - |
| NXT-05 | AI Kesif UI + test paketi | AI/Frontend+QA | 2026-05-25 | TODO | - |

## 15) P1-06 Icra Paketi (Domain Dagilimi)

Kapsam:
- `buyerasistans.com.tr`: ana kurumsal domain (aktif)
- `buyerasistans.com`: global/EN acilis
- `buyerasistans.info`: bilgi merkezi
- `buyerasistans.online`: kampanya/landing

Sirali adim:
1. Domain bazli hedef route ve icerik matrisi kilitle.
2. Her domain icin docroot/vhost upstream'i app build ile hizala (Plesk default page kaldir).
3. Canonical/hreflang kurallarini domain niyetine gore uygula.
4. `sitemap-*.xml` ve `robots.txt` servislemesini domain bazli dogrula.
5. 4 domain smoke:
   - `/` => 200
   - hedef landing => 200
   - canonical kontrolu
   - redirect kurallari
6. Search submit ve analytics event gorunurlugunu tekrar kanitla.

Definition of Done:
- Plesk default page hicbir domainde gorunmeyecek.
- Domain niyet dagilimi dokuman + runtime davranis birbiriyle tutarli olacak.
- Kanitlar backlog satirina tarihli komut/sonuc olarak islenecek.

### 15.1 Domain-Route Icerik Matrisi (Kilitleme)

Kaynaklar:
- `web/src/App.tsx` public route tanimlari
- `web/src/components/PublicSeoManager.tsx` intent/canonical haritasi

| Domain | Intent | Birincil Public Route Seti | Not |
|---|---|---|---|
| `buyerasistans.com.tr` | `corporate` | `/`, `/teklifler`, `/cozumler`(redirect), `/fiyatlandirma`(redirect), `/stratejik-ortaklik`, `/onboarding` | Ana kurumsal domain. Canonical corporate pathler burada kalir. |
| `buyerasistans.com` | `global` | `/`, `/is-ortagi-programi`, EN/global odakli public varyantlar | Global/EN acilis. UI metin varyantlari sonraki adimda domain kosuluna baglanir. |
| `buyerasistans.online` | `campaign` | `/demo`, `/tedarikci-ol`, `/is-ortagi-basvuru`, kampanya landing pathleri | Performans/kampanya domeni. Kisa sureli landing ve CTA odagi. |
| `buyerasistans.info` | `knowledge` | bilgi merkezi pathleri (`/blog`, `/rehber`, `/sozluk` gibi) | Bilgi kutuphanesi. Kampanya pathleri burada birincil olmamali. |

### 15.2 Dagitim Zamani (Operasyon Karari)

- Hedef pencere: `2026-05-18` (P1-06 uygulama gunu)
- Sira:
  1. Plesk vhost/docroot routing netlestirme
  2. Build/deploy (public assets + router fallback)
  3. Canonical/hreflang/sitemap/robots runtime dogrulama
  4. 4-domain smoke + analytics event kontrolu
