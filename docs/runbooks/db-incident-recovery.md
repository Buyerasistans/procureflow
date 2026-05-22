# DB Incident Recovery Runbook
**Son güncelleme:** 2026-05-22 | **Sahip:** Platform Ops

---

## RPO / RTO Hedefleri

| Metrik | Hedef |
|--------|-------|
| RPO (Recovery Point Objective) | ≤ 2 saat (zamanlanmış backup aralığı) |
| RTO (Recovery Time Objective) | ≤ 30 dakika (manuel restore) |
| Min backup boyutu | ≥ 5 MB (alarm eşiği) |
| Backup başarı oranı | ≥ 99% |

---

## Bölüm 1 — Triage (İlk 5 Dakika)

Veri kaybı şüphesi durumunda sırayla çalıştır:

```powershell
# 1a. Son 3 backup boyutunu kontrol et
Get-ChildItem "D:\Projects\procureflow_full_backups\scheduled\sql\" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5 Name, Length, LastWriteTime |
    Format-Table -AutoSize

# 1b. Mevcut DB kullanıcı sayısı (1 = sadece super_admin → VERİ KAYBI)
$env:PGPASSWORD = "<DB_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow -c "SELECT COUNT(*) AS users FROM users;"
$env:PGPASSWORD = ""

# 1c. Tüm tablolardaki satır sayıları
$env:PGPASSWORD = "<DB_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow -c "
  SELECT tablename,
         (xpath('/row/count/text()',
           query_to_xml(format('SELECT COUNT(*) AS count FROM %I', tablename),
           false, true, '')))[1]::text::int AS rows
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY rows DESC, tablename
  LIMIT 20;
"
$env:PGPASSWORD = ""
```

**Karar ağacı:**
- `users` = 1 ve diğer kritik tablolar boşsa → Bölüm 2'ye geç
- Backup boyutu < 1 MB ise → golden backup'ı bul (Bölüm 3)
- Backup boyutu normal ama uygulama çalışmıyorsa → Bölüm 6

---

## Bölüm 2 — Forensic Snapshot (Restore Öncesi Zorunlu)

**Bu adımı ATLAMAK YASAK. Restore öncesi kanıtı koru.**

```powershell
# 2a. Forensic dizini oluştur
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$forensicDir = "D:\Projects\procureflow_full_backups\forensic"
New-Item -ItemType Directory -Force $forensicDir

# 2b. Mevcut (bozuk) DB snapshot'ı al — salt okunur, DB'ye dokunmaz
$env:PGPASSWORD = "<DB_PASS>"
pg_dump -h localhost -p 5432 -U postgres -d procureflow `
    --format=custom --verbose `
    -f "$forensicDir\forensic_postloss_$ts.dump"
$env:PGPASSWORD = ""

# 2c. Satır sayılarını dosyaya kaydet
$env:PGPASSWORD = "<DB_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow `
    -c "SELECT tablename, (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_name = pg_tables.tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" `
    > "$forensicDir\row_counts_postloss_$ts.txt"
$env:PGPASSWORD = ""

Write-Host "Forensic kanit: $forensicDir"
```

---

## Bölüm 3 — Golden Backup'ı Bul

```powershell
# Son geçerli (≥5 MB) backup'ı bul
Get-ChildItem "D:\Projects\procureflow_full_backups\scheduled\sql\*.rar" |
    Where-Object { $_.Length -ge 5_000_000 } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 3 Name, Length, LastWriteTime

# Seçilen dosyanın bütünlüğünü test et (WinRAR kuruluysa)
$goldenRar = "D:\Projects\procureflow_full_backups\scheduled\sql\<DOSYA_ADI>.rar"
& "C:\Program Files\WinRAR\WinRAR.exe" t $goldenRar
```

**Bilinen golden backup'lar:**

| Dosya | Boyut | Tarih | Durum |
|-------|-------|-------|-------|
| `procureflow_sql_20260522_031746.rar` | 11.2 MB | 2026-05-22 03:17 | GOLDEN |
| `backups/pre_db_fix_20260518_071534.dump` | 16.4 MB | 2026-05-18 07:15 | Yedek |

---

## Bölüm 4 — Staging Restore Dry-Run

**Üretim restore'dan önce test DB'sinde dene:**

```powershell
# 4a. Test DB oluştur
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE procureflow_restore_test OWNER postgres;"
$env:PGPASSWORD = ""

# 4b. RAR'ı aç
$restoreDir = "D:\Projects\procureflow_full_backups\restore_temp"
New-Item -ItemType Directory -Force $restoreDir
& "C:\Program Files\WinRAR\WinRAR.exe" x -y $goldenRar "$restoreDir\"

# 4c. SQL dosyasını bul
$sqlFile = Get-ChildItem $restoreDir -Filter "*.sql" | Select-Object -First 1
Write-Host "Restore dosyasi: $($sqlFile.FullName) — $($sqlFile.Length) bytes"

# 4d. İlk 50 satırı gözden geçir (INSERT var mı?)
Get-Content $sqlFile.FullName -TotalCount 50

# 4e. Test DB'ye restore
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow_restore_test -f $sqlFile.FullName 2>&1 |
    Tee-Object "$restoreDir\restore_test_log.txt"
$env:PGPASSWORD = ""

# 4f. Validate (staging)
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow_restore_test -c "
  SELECT 'users' AS tablo, COUNT(*) AS sayi FROM users
  UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
  UNION ALL SELECT 'projects', COUNT(*) FROM projects
  UNION ALL SELECT 'quotes', COUNT(*) FROM quotes
  UNION ALL SELECT 'companies', COUNT(*) FROM companies
  ORDER BY tablo;
"
$env:PGPASSWORD = ""
```

**Beklenen:** `users` > 1 (super_admin dahil gerçek kullanıcılar)

---

## Bölüm 5 — Üretim Cutover

**Staging dry-run başarılı olduktan sonra uygula:**

```powershell
# 5a. Uygulamayı durdur
# -- Uvicorn process'ini durdur (yöneticiden sor) --
Get-Process -Name "uvicorn","python" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*procureflow*" } |
    Stop-Process -WhatIf
# -WhatIf kaldır ve onayladıktan sonra çalıştır

# 5b. Tüm DB bağlantılarını kes
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname='procureflow' AND pid <> pg_backend_pid();"
$env:PGPASSWORD = ""

# 5c. DB'yi yeniden oluştur
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS procureflow;"
psql -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE procureflow OWNER postgres ENCODING 'UTF8';"
$env:PGPASSWORD = ""

# 5d. Restore (aynı SQL dosyası, Bölüm 4'ten)
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d procureflow -f $sqlFile.FullName 2>&1 |
    Tee-Object "$restoreDir\restore_prod_log.txt"
$env:PGPASSWORD = ""
```

---

## Bölüm 6 — Post-Restore Validation Queries

```sql
-- Kritik tablo satır sayıları
SELECT 'users'     AS tablo, COUNT(*) AS sayi FROM users
UNION ALL SELECT 'tenants',   COUNT(*) FROM tenants
UNION ALL SELECT 'projects',  COUNT(*) FROM projects
UNION ALL SELECT 'quotes',    COUNT(*) FROM quotes
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'roles',     COUNT(*) FROM roles
UNION ALL SELECT 'permissions', COUNT(*) FROM permissions
ORDER BY sayi DESC;

-- Super admin dışında aktif kullanıcı var mı?
SELECT email, role, system_role, is_active, created_at
FROM users
WHERE system_role != 'super_admin' AND hidden_from_admin = false
ORDER BY created_at DESC
LIMIT 10;

-- Tenant bütünlüğü
SELECT t.name, COUNT(u.id) AS users
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
GROUP BY t.name
ORDER BY users DESC;

-- Alembic migration durumu (şema bütünlüğü)
SELECT version_num, is_current FROM alembic_version;
```

---

## Bölüm 7 — Uygulamayı Yeniden Başlat

```powershell
# 7a. APP_ENV kontrolü (zorunlu)
Get-Content "D:\Projects\procureflow\api\.env" | Select-String "APP_ENV"
# Beklenen: APP_ENV=development

# 7b. SUPER_ADMIN_PASSWORD kontrolü
Get-Content "D:\Projects\procureflow\api\.env" | Select-String "SUPER_ADMIN_PASSWORD"
# Beklenen: SUPER_ADMIN_PASSWORD=<dolu değer>

# 7c. Uygulamayı başlat (yöneticiden sor)
# cd D:\Projects\procureflow\api && uvicorn main:app --host 0.0.0.0 --port 8000

# 7d. Sağlık kontrolü
Start-Sleep -Seconds 5
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
```

---

## Bölüm 8 — Rollback Planı

Restore başarısız olursa (pg_restore hata döndürdüyse):

```powershell
# Restore önceki duruma dön (forensic snapshot'tan)
$forensicDump = "D:\Projects\procureflow_full_backups\forensic\forensic_postloss_<TS>.dump"

$env:PGPASSWORD = "<POSTGRES_PASS>"
pg_restore -h localhost -p 5432 -U postgres -d procureflow `
    --clean --if-exists --no-owner $forensicDump
$env:PGPASSWORD = ""
```

Eğer forensic dump da boşsa → `backups/pre_db_fix_20260518_071534.dump` kullan (Mayıs 18 durumu).

---

## Bölüm 9 — Temizlik

```powershell
# Staging test DB'yi sil
$env:PGPASSWORD = "<POSTGRES_PASS>"
psql -h localhost -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS procureflow_restore_test;"
$env:PGPASSWORD = ""

# Geçici restore dizinini sil (başarıyı doğruladıktan sonra)
Remove-Item "D:\Projects\procureflow_full_backups\restore_temp" -Recurse -Force
```

---

## Bölüm 10 — Haftalık Kontrol Listesi

- [ ] Son backup boyutu ≥ 5 MB mi? (`Get-ChildItem ...sql\ | Sort LastWriteTime -Desc | Select -First 1`)
- [ ] SHA256 checksum dosyası var mı? (`*.sha256`)
- [ ] `APP_ENV=development` api/.env'de mevcut mu?
- [ ] `SUPER_ADMIN_PASSWORD` api/.env'de mevcut ve boş değil mi?
- [ ] Task Scheduler son exit kodu 0 mu? (`schtasks /query /tn "\ProcureflowFullBackup2h" /fo LIST`)
- [ ] Windows Event Log'da backup hatası var mı?

---

## Bölüm 11 — Aylık Restore Tatbikatı

```powershell
# Her ay ilk Pazartesi çalıştır
# 1. En son golden backup ile staging restore yap (Bölüm 4)
# 2. users, tenants, projects satır sayılarını kaydet
# 3. Sonuçları docs/runbooks/restore-drill-log.md dosyasına yaz
# 4. Test DB'yi sil
```

---

## Bilinen Riskler ve Önlemler

| Risk | Önlem | Durum |
|------|-------|-------|
| `APP_ENV` boş → guard etkisiz | `_require_local_env` allowlist'e çevrildi (PR-1) | ✅ Uygulandı |
| Hardcoded super_admin şifresi | `SUPER_ADMIN_PASSWORD` env'e taşındı (PR-2) | ✅ Uygulandı |
| Bozuk backup başarılı sayılıyor | Min size + checksum + integrity test (PR-3) | ✅ Uygulandı |
| TRUNCATE CASCADE endpoint açık | `APP_ENV=development` api/.env'e eklendi | ✅ Uygulandı |
| DB reset → sadece super_admin | `ensure_runtime_super_admin()` tasarım gereği | ℹ️ Beklenen davranış |
| PostgreSQL server log yok | Log rotasyonunu aktifleştir | ⬜ Bekliyor |
