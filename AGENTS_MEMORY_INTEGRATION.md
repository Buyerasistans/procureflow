# Tüm ajanlar için güncellenmiş genel hafıza ve ilerleme özeti

Bu dosya, tekrar tekrar en baştan başlama sorununu azaltmak için proje durumunun tek kaynak özeti olarak kullanılır.

## Amaç
- Yeni oturumlarda bağlamı korumak
- Yapılan işi ve kalan işi görünür kılmak
- Kritik kararları, referans dosyaları ve riskleri kaydetmek
- İlerlemeyi herkes için izlenebilir hale getirmek

## Kullanım Kuralı
- Her anlamlı değişiklikten sonra bu dosya güncellenir.
- Yeni bir sohbet başladığında ilk okunacak dosyalardan biridir.
- Kayıtlar kısa, somut ve tarihli tutulur.
- Varsayım yerine gerçek durum yazılır.
- Bir görev tamamlandığında, tamamlanan adım ve sonucu buraya eklenir.

## Güncel Durum Şablonu
Aşağıdaki alanlar her görev için doldurulur:

- Son güncelleme:
- Sorumlu ajan:
- Görev / hedef:
- Tamamlananlar:
- Devam edenler:
- Sonraki adım:
- Kritik kararlar:
- Riskler / blokajlar:
- Referans dosyalar:
- Son doğrulama:
- Notlar:

## Handoff Akışı
Yeni bir oturum açıldığında şu sıra izlenir:

1. `AGENTS_MEMORY_INTEGRATION.md` okunur.
2. İlgili `.agent.md` dosyası okunur.
3. `Devam edenler` bölümündeki işten devam edilir.
4. Her tamamlanan adım sonrası bu dosya güncellenir.

## Ajanların Rolü
- `sentinel-agent`: merkezi hafıza ve durum özetini yönetir.
- Uzman ajanlar: kendi alanlarındaki işlemleri ve kararları kaydeder.
- `orchestrator-agent`: görevleri dağıtır, ilerlemeyi toplar ve süreci koordine eder.

## Sentinel Entegrasyonu
- Bu ajan, yaptığı tüm önemli işlemleri ve kararları sentinel-agent ile paylaşır.
- Yeni bir sohbet başlatıldığında, sentinel-agent tarafından sistemin mevcut durumu ve geçmiş işlemler hakkında bilgilendirilir.
- Böylece her yeni sohbette bağlam ve geçmiş bilgi korunur, sıfırdan başlamak gerekmez.

## Kısa Örnek Kayıt
- Son güncelleme: 2026-05-05 10:17
- Sorumlu ajan: orchestrator-agent
- Görev / hedef: login / DB / deploy ayrımı ve kalıcı hafıza notları
- Tamamlananlar:
  - Canonical süper admin hesabı garanti edildi
  - Local demo omurgası yeniden seed edildi
  - Production frontend env dosyaları canonical API yoluna çekildi
  - Auth testleri geçti
  - Local login akışı doğrulandı
- Devam edenler:
  - Host tarafında aynı değişikliklerin rebuild + deploy ile yayına alınması
  - Host DB’nin kendi `.env`/DATABASE_URL’i ile çalıştığının teyidi
  - Host demo/scope seed’inin server tarafında da çalıştırılması
- Sonraki adım:
  - Host build sonrası login ve platform girişlerini yeniden smoke-test etmek
- Kritik kararlar:
  - Local ve hosting DB’leri ayrı tutulacak; aynı DB’ye bağlanmayacak
  - Deploy edilen paket, host üzerindeki `/api/.env` dosyasını ezmemeli
  - Host frontend build, `VITE_API_BASE_URL=https://buyerasistans.com.tr/api/v1` kullanacak
- Riskler / blokajlar:
  - Hostta eski frontend build kalmış olabilir
  - Host backend `.env` yanlış DB’ye işaret ediyor olabilir
  - Hostta demo/scope hesapları henüz seed edilmemiş olabilir
- Referans dosyalar:
  - `api/.env`
  - `web/.env.production`
  - `Hostinge_Yükle/web/.env.production`
  - `Hostinge_Deploy/Hostinge_Yükle/web/.env.production`
  - `api/services/runtime_bootstrap.py`
  - `api/scripts/bootstrap_runtime_defaults.py`
  - `api/services/scope_demo_bootstrap.py`
  - `api/scripts/bootstrap_scope_demo_data.py`
  - `api/routers/auth.py`
  - `api/create_super_admin.py`
  - `HOSTING_DEPLOYMENT_TRACKER.md`
- Son doğrulama:
  - `api\.venv\Scripts\python.exe -m api.scripts.bootstrap_runtime_defaults`
  - `api\.venv\Scripts\python.exe -m api.scripts.bootstrap_scope_demo_data`
  - `curl.exe ... POST /api/v1/auth/login` → `200 OK`
- Notlar:
  - Local DB şu an ayrı ve aktif; seed edilen demo kullanıcılar lokal geliştirme için kullanılıyor.
  - Host DB ayrı kalmalı; prod deploy sonrası kendi sunucu `api/.env` dosyasıyla çalışmalı.
  - Yeni oturumda ilk yapılacak iş: `AGENTS_MEMORY_INTEGRATION.md` + `HOSTING_DEPLOYMENT_TRACKER.md` okumak.

## Current State Notes
- Local database URL:
  - `postgresql+psycopg://postgres:96578097@localhost:5432/procureflow`
- Hosting database URL:
  - host üzerinde `admin_procureflow` kullanılıyor; local DB ile aynı olmamalı
- Canonical super admin:
  - email: `superadmin@buyerasistans.com.tr`
  - password: `[REDACTED — env/secret-store'da saklanır]`
- Local demo/scope seed:
  - `python -m api.scripts.bootstrap_scope_demo_data`
- Runtime bootstrap:
  - `python -m api.scripts.bootstrap_runtime_defaults`
- Production frontend base URL:
  - `https://buyerasistans.com.tr/api/v1`
- Production site URL:
  - `https://buyerasistans.com.tr`

## Son Kararlar
- Local ve hosting veritabanları kasıtlı olarak ayrı tutulacak.
- Host tarafına gönderilen build, hostun kendi veritabanına ve kendi `.env` dosyasına bağlanmalı.
- Local seed işlemleri hostu etkilememeli.
- Host tarafında eksik kullanıcılar gerekiyorsa, server üzerinde `bootstrap_runtime_defaults` ve `bootstrap_scope_demo_data` benzeri seed komutları yeniden çalıştırılmalı.

## Kalan İşler
- Hostta frontend yeniden build edilmeli.
- Hostta backend deploy sonrası login smoke-test yapılmalı.
- Host DB üzerinde demo/scope kullanıcıları görünmüyorsa server seed çalıştırılmalı.
- Host ve local deploy notları tek bir runbook altında toparlanmalı.
