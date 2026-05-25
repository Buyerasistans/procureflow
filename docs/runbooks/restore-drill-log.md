# DB Restore Operasyon Notu

**Tarih:** 2026-05-22
**Komutan:** Principal DBRE + Claude Sonnet 4.6
**Branch:** pr/strict-gate-payment-clean-v2 (commit: fb0e557)

## Olay Özeti
Veri kaybı penceresi: 2026-05-22 03:17 → 05:12 (yaklaşık 2 saat).
Sadece super_admin ayakta kaldı. Tüm tenant/kullanıcı/proje/teklif verisi sıfırlandı.

## Restore Zinciri

| Adım | Durum | Not |
|------|-------|-----|
| Preflight | ✅ PASS | Golden backup doğrulandı (22 MB RAR, SHA256 kontrol OK) |
| Forensic Snapshot | ✅ PASS | forensic_postloss_20260522_131143.dump (373 KB) |
| Staging Dry-Run | ✅ PASS | Tüm 16 kontrol geçti (169 users, 6 tenants, 24 quotes) |
| Production Cutover | ✅ PASS | Drop → recreate → psql restore exit 0, 0 hata |
| Post-Restore Validation | ✅ PASS | users=169, tenants=6, projects=6, quotes=24, companies=10 |
| Uvicorn Restart | ✅ PASS | /api/v1/health → {"status":"ok"} |
| Cleanup | ✅ PASS | procureflow_restore_test silindi, restore_temp silindi |

## Kaynak Backup
- Dosya: procureflow_sql_20260522_031746.rar (11.2 MB sıkıştırılmış, 22.2 MB SQL)
- SHA256: [backup_postgres_sql.ps1 tarafından doğrulandı]
- Tarih: 2026-05-22 03:17 UTC+3

## Forensik Kanıt
- D:\Projects\procureflow_full_backups\forensic\forensic_postloss_20260522_131143.dump
- SHA256: AEC4A27E91782004C20BCE019804CB630F6FCB81F4A93C5D469140792FECE4F8

## Uygulanan Güvenlik Yamaları (PR-1..4)
- PR-1: _require_local_env() allowlist deny-by-default
- PR-2: SUPER_ADMIN_PASSWORD env'e taşındı (hardcoded kaldırıldı)
- PR-3: backup_postgres_sql.ps1 tamamen sertleştirildi (lock, min-size, SHA256, atomik)
- PR-4: docs/runbooks/db-incident-recovery.md oluşturuldu

## Açık Eylem Kalemi

- [x] api/.env içindeki SUPER_ADMIN_PASSWORD=Aa1234!! güçlü rastgele değerle değiştirildi

## Secret Rotation Kaydı — 2026-05-25

| Alan | Değer |
| --- | --- |
| Tarih | 2026-05-25 |
| Yöntem | env-only — api/.env güncellendi (gitignored, repoya gitmez) |
| Uzunluk | 32 karakter, CSPRNG (RandomNumberGenerator), base64-alfanumerik |
| Doğrulama | health OK · login(yeni) 200 OK · login(eski Aa1234!!) 401 OK |
| Önceki değer | Aa1234!! (PR-2'den beri geçici — artık geçersiz) |
| Yeni değer | [MASKED — api/.env içinde saklanır] |
