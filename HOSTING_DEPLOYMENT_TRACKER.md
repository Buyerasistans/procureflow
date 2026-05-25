# ProcureFlow — Hostinge Yükleme & Canlıya Yakın Operasyon Takip MD
**Hedef:** `hostinge_yukle.md` kılavuzunu sunucu üzerindeki mevcut durumunla harmanlayıp, bundan sonra her adımı çalıştırdıkça işaretleyerek ilerlemek.  
**Tarih:** 5 Mayıs 2026

---

## 1) Sunucu & Ortam Bilgileri (mevcut kurulum)
- **IP:** 213.238.191.177
- **OS:** Ubuntu 22.04 LTS
- **Panel:** Plesk
- **SSH Port:** 22
- **Domain:** buyerasistans.com.tr
- **API URL:** https://api.buyerasistans.com.tr/api/v1
- **Site URL:** https://buyerasistans.com.tr

### Python / venv
- **Sunucu Python:** 3.13.3 (kaynak koddan derlendi), `/usr/local/bin/python3.13`
- **API venv:** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/api/.venv`
- **uvicorn:** `api/.venv/bin/uvicorn`

### Veritabanı
- **Motor:** PostgreSQL
- **Host/Port:** localhost / 5432
- **DB:** `admin_procureflow`
- **Kullanıcı:** `buyerasistans`
- **DATABASE_URL:** `postgresql+psycopg://buyerasistans:SIFRE@localhost:5432/admin_procureflow` (sifre Plesk)

### Dosya konumları
- **Kök:** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/`
- **API:** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/api/`
- **venv:** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/api/.venv/`
- **env:** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/api/.env`
- **Log:** `/tmp/uvicorn_start.log`
- **Frontend build (dist):** `/var/www/vhosts/buyerasistans.com.tr/httpdocs/` (dist içeriği)

---

## 2) Deployment Komutları (mevcut)
### Başlat
```bash
setsid api/.venv/bin/uvicorn api.main:app \
  --host 0.0.0.0 --port 8000 --workers 2 \
  --env-file api/.env \
  </dev/null >/tmp/uvicorn_start.log 2>&1 &
```

### Durdurma
```bash
pkill -f uvicorn
```

### Kontrol
```bash
pgrep -fa uvicorn
tail -20 /tmp/uvicorn_start.log
curl http://localhost:8000/api/v1/health
```

---

## 3) Migration / Alembic Bilgisi
- **Alembic config:** `api/alembic.ini`
- **Versions:** `api/alembic/versions/`

Komutlar:
```bash
api/.venv/bin/alembic -c api/alembic.ini upgrade head
api/.venv/bin/alembic -c api/alembic.ini stamp head   # tablo zaten varsa
api/.venv/bin/alembic -c api/alembic.ini current
```

### Bilinen sorun
- **DuplicateTable:** `quotes` relation already exists  
  **Çözüm:** `alembic ... stamp head`

---

## 4) ZIP Yönetimi (mevcut kural)
- **ZIP yolu (local):** `D:\Projects\procureflow\Hostinge_Yukle.zip`
- **ZIP’e dahil:**
  - `Hostinge_Yukle/api/` ve `Hostinge_Yukle/web/` içerikleri
- **ZIP’e dahil edilmeyen (sunucuda oluşturulacak/yeniden kurulacak):**
  - `api/.venv/`
  - `web/node_modules/` (sunucuda `npm install` ile)
  - `web/dist/` (sunucuda `npm run build` ile)
  - `__pycache__/` ve `*.pyc`

### ZIP yenileme (manuel kural - PowerShell)
```powershell
cd D:\Projects\procureflow\api
.venv\Scripts\pip freeze | Out-File -Encoding utf8 requirements.txt
```

> Not: Bu repo/hosting akışında “manual elle requirements yazma” kuralı var; **her zaman pip freeze**.

---

## 5) Hızlı SSH Komutları (mevcut)
```bash
ssh root@213.238.191.177
cd /var/www/vhosts/buyerasistans.com.tr/httpdocs
pkill -f uvicorn; sleep 1
setsid api/.venv/bin/uvicorn api.main:app \
  --host 0.0.0.0 --port 8000 --workers 2 \
  --env-file api/.env \
  </dev/null >/tmp/uvicorn_start.log 2>&1 &
tail -20 /tmp/uvicorn_start.log
curl http://localhost:8000/api/v1/health
```

---

## 6) Uygulama Runbook (Şimdi başlayacağımız tek akış)
Aşağıdaki checklist’i adım adım ilerleteceğiz. Her tamamladığımız maddede kutuyu işaretleyeceğiz.

### Durum (mevcut işaretler)
- [x] Python 3.13.3 sunucuya kuruldu
- [x] venv oluşturuldu
- [x] `pip install -r requirements.txt` tamamlandı
- [x] uvicorn çalışıyor (port 8000)
- [x] API saglik kontrolu geçti: `{"status":"ok"}`
- [x] Frontend build edildi ve deploy edildi
- [x] `hostinge_yukle.md` güncellendi

---

## 6.1 Sunucuya yükleme / ortam dosyaları (hostinge_yukle.md ile uyumlu)
> Bu bölüm geneldir; bazıları zaten yapılmış olabilir. Emin olamadıkça [ ] bırakıyoruz.

- [ ] Proje klasörü sunucuda doğru konumda: `/var/www/vhosts/buyerasistans.com.tr/httpdocs/`
- [ ] API klasörü: `/httpdocs/api/` mevcut ve gerekli dosyalar var (`main.py`, `database.py`, `alembic/`, `core/`, `routers/`, `services/`, `schemas/`, vb.)
- [ ] `.env` dosyası API tarafında oluşturuldu: `/httpdocs/api/.env` (DATABASE_URL, SECRET_KEY, SMTP opsiyonel, DWG converter path opsiyonel)
- [ ] Frontend `.env.production` ile build edilecek env doğru (VITE_API_BASE_URL vb.)
- [ ] Converter (DWG→DXF) gerekli ise kurulu ve `.env` path doğru

---

## 6.2 Backend kurulumu & migrasyon gate
- [x] Backend venv hazır (`api/.venv`)
- [x] Python paketleri yüklendi (`pip install -r requirements.txt`)
- [x] **Migration:** `alembic stamp head` çalıştır (DuplicateTable riskine karşı)
  - [x] Çözüm uygulandı: `public.alembic_version` tablosu manuel olarak `version_num VARCHAR(128) NOT NULL PRIMARY KEY` ile oluşturuldu.
  - [x] `alembic stamp head` başarılı oldu.
- [x] **Migration sonrası doğrulama:** `alembic current` ile sürüm kontrol et
  - [x] `20260429_add_company_mailbox_team_visibility_toggle (head)` doğrulandı.
- [x] API health kontrol (tekrar): `curl http://localhost:8000/api/v1/health`
  - [x] `curl -i` ile `HTTP/1.1 200 OK` ve `{"status":"ok"}` doğrulandı.
- [x] Hedef endpoint smoke: (auth + supplier-quotes + quotes) en azından “200 + doğru response shape” kontrolü
  - [x] `GET /api/v1/health/db` → `{"database":"ok"}`
  - [x] `POST /api/v1/auth/login` → endpoint reachable; invalid/malformed body için beklenen 422 döndü
  - [x] `GET /api/v1/quotes` ve `GET /api/v1/suppliers` → `401 Not authenticated` döndü; route’lar ayakta

> Migration adımındaki belirleyici amaç: `DuplicateTable` görüldüyse “upgrade yerine stamp” ile katalogu doğru hizalamak.

---

## 6.3 requirements.txt güncelleme / ZIP yenileme akışı (mevcut “deployment merkezi” ile)
- [x] Local: `pip freeze` ile `api/requirements.txt` güncelle
- [x] Lokal: `Hostinge_Yukle.zip` yenileme (dosya kuralı: `.venv/node_modules/dist` dahil değil)
- [x] Lokal: bu repo içindeki `deployment.py` dosyasına aşağıdaki iki geliştirmeyi ekle:
  - [x] `refresh_zip()` metodunu ekle
  - [x] `smart_reload()` metodunu ekle
- [x] Frontend UI:
  - [x] “**ZIP Yenile & Hostinge Gonder**” butonu ekle
  - [x] “**Siteyi Yenile (Hizli)**” butonu ekle

---

## 6.4 Production benzeri test & doğrulama
- [ ] ZIP yenile + deploy et + frontend build + API restart (uçtan uca)
- [ ] Hedef smoke testleri:
  - [ ] Health (200)
  - [ ] Auth: login/refresh akışlarından 1 senaryo
  - [ ] Supplier portal: 1 “bekleyen/sent/closed” ekranı (frontend)
  - [ ] Quote state transitions: bilerek 1 invalid geçiş → **HTTP 422** doğrula
- [ ] Log doğrulama: `/tmp/uvicorn_start.log` hata var mı
- [ ] (Varsa) Email test endpoint’i üzerinden “mail send” doğrulaması (opsiyonel, DNS bağımlı)

---

## 7) Bilinen Sorunlar & Kök Nedenler (ref)
- **DuplicateTable** → `alembic stamp head`
- **StringDataRightTruncation** → `alembic_version.version_num` kolon tip uyumsuzluğu (`varchar(32)` yetersiz)
- **ModuleNotFoundError** (örn. openpyxl/pandas) → `pip freeze → ZIP yenile → deploy`
- **Sunucuya eski dosyalar gidiyor** → ZIP yenile + “Hostinge Gonder” butonu
- **requirements.txt Plesk’te bozuk görünür** → çoğunlukla encoding; dosya sağlamlığını kontrol:
  - `cat api/requirements.txt | head -20`
- **datetime.UTC hatası** → Python 3.13 kullanımı (3.10’da attribute yok)

---

## 8) Deployment Merkezi (local admin panel UI referansı)
- URL (local): `http://192.168.1.151:5175/admin?tab=deployment`

Butonlar:
- [ ] [Ilk Kurulum]              → local sistem kontrolü / venv / pip / migration
- [ ] [ZIP Yenile & Hostinge Gonder] → pip freeze + ZIP oluştur + deploy
- [ ] [Hostinge Gonder]          → mevcut ZIP ile tam deploy
- [ ] [Siteyi Yenile - Hizli]    → sadece değişen dosyalar
- [ ] [DB Migrasyonu]            → sunucuda `alembic upgrade head`

---

## 9) Son Durum
Bu doküman, `hostinge_yukle.md` kılavuzunu mevcut sunucu bilgilerinle birleştirip **tek bir çalışma planına** dönüştürür.  
Güncel durum: `alembic current` başlıkla uyumlu; requirements güncellendi, `Hostinge_Yukle.zip` başarıyla oluşturuldu ve kritik içerikler doğrulandı. Sonraki adım deploy/smoke test akışına geçmek.

---

## 10) DB Ayrımı, Login ve Seed Notu (2026-05-05)

### Karar
- Local geliştirme veritabanı ile hosting veritabanı kasıtlı olarak **ayrı** tutulacak.
- Local seed işlemleri hosting veritabanını etkilemeyecek.
- Hosting deploy paketleri hostun kendi `/api/.env` dosyasını ezmemeli.

### Güncel DB durumu
- **Local:** `postgresql+psycopg://postgres:96578097@localhost:5432/procureflow`
- **Golden snapshot (yüklenebilir referans - Local procureflow):**
  - **Aktif golden:**
    `local_backup\GOLDEN_PROCUREFLOW_20260525_101632.dump`
    (users=71, companies=11, tenants=6, quotes=24)
  - **Amaç:** Daha sonra hosting/local sync sırasında “doğru veri” durumuna hızlı geri dönmek.
- **Hosting:** `admin_procureflow` üzerinde ayrı DB
- Aynı kullanıcı kaydı iki ortamda da aynı anda bulunmayabilir; bu nedenle seed işlemleri ortam bazlı yürütülmeli.

### ⚠️ KURAL: Local DB'ye dokunmadan önce MUTLAKA guard scriptini çalıştır

```powershell
# Sadece snapshot al (her DROP / RECREATE / restore öncesi zorunlu):
.\scripts\guard_local_db.ps1

# Veri temiz ve güncel ise golden'ı da güncelle:
.\scripts\guard_local_db.ps1 -UpdateGolden
```

**Bu kuralın ihlali 2026-05-22 auth regresyonuna neden oldu:**
restore drill sırasında local DB silinip sadece demo seed uygulandı
→ 71 kullanıcı + 11 firma kayboldu. Guard script çalıştırılmış
olsaydı önce snapshot alınırdı ve geri dönüş 1 komutla olurdu.

### Canonical giriş bilgisi
- **Super Admin:** `superadmin@buyerasistans.com.tr`
- **Şifre:** `[REDACTED — api/.env SUPER_ADMIN_PASSWORD alanından okunur]`

### Seed / bootstrap komutları
Local ortam için:
```bash
api/.venv/bin/python -m api.scripts.bootstrap_runtime_defaults
api/.venv/bin/python -m api.scripts.bootstrap_scope_demo_data
```

Hosting ortamı için:
- Deploy sonrası aynı bootstrap komutları sunucuda çalıştırılmalı.
- Özellikle `bootstrap_runtime_defaults` canonical super admin’i garanti eder.
- `bootstrap_scope_demo_data` demo/scope hesaplarını ve bağlı firmaları yeniden kurar.

### Frontend API hedefi
- Production frontend şu canonical API yolunu kullanmalı:
  - `https://buyerasistans.com.tr/api/v1`
- Yanlış hedefler:
  - `https://api.buyerasistans.com.tr/...`
  - `https://buyerasistans.com.tr:8000/...`

### Not
Yeni bir oturumda ilk okunacaklar:
1. `AGENTS_MEMORY_INTEGRATION.md`
2. `HOSTING_DEPLOYMENT_TRACKER.md`
3. `api/.env`
4. `web/.env.production`

---

## 11) Deployment Panel UI İstekleri İçin Güvenli Not
**Kapsam:** Sadece frontend yerleşimi ve buton akışları.
- Veritabanı şeması, seed, migration veya restore işlemi yapılmayacak.
- Mevcut `api/v1/admin/deployment` endpoint’leri kullanılacak.
- `.env` bilgileri ekranda doldurulmuş gelecek; kullanıcı isterse güncelleyip kaydedebilecek.
- Aksiyon sırası:
  1. İlk Kurulum
  2. ZIP Yenile
  3. Dosyaları Sil
  4. Hostinge Gönder
  5. Siteyi Yenile
  6. Hızlı Yenile
  7. Yerel DB → Hosting DB Eşitleme
  8. DB Migrasyonu
- Yerleşim isteği:
  - Üstte hafif renkli, üst menü tarzı kart butonlar
  - Alt bölümde host bilgileri dikey sıralı alanlar
  - Ortada `Bağlantıyı Test Et` ve `.env'e Kaydet`
  - Altında `Temizle`
- Bu not, ileride "kaldığın yerden devam et" dendiğinde referans alınacak.
