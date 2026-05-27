<#
.SYNOPSIS
    Local procureflow DB'yi yedekler ve mevcut durumu raporlar.
    Destructive bir işlem (DROP / RECREATE / restore) yapmadan ÖNCE çalıştır.

.USAGE
    # Sadece snapshot al (öneri: her restore öncesi):
    .\scripts\guard_local_db.ps1

    # Snapshot al VE golden backup'ı güncelle (veri iyi durumdaysa):
    .\scripts\guard_local_db.ps1 -UpdateGolden

    # Güvenli minimum eşiği override et (küçük DB testlerinde):
    .\scripts\guard_local_db.ps1 -MinUsers 5

.NOTES
    Backup hedefi: D:\Projects\procureflow_full_backups\local_backup\
    Golden backup : D:\Projects\procureflow_full_backups\local_backup\GOLDEN_PROCUREFLOW_<ts>.dump
    Format        : pg_dump custom (-Fc) — pg_restore ile geri yüklenir
#>
param(
    [switch]$UpdateGolden,
    [int]$MinUsers    = 10,   # Bu eşiğin altındaysa golden update engellenir
    [int]$MinCompanies = 5,   # Bu eşiğin altındaysa golden update engellenir
    [string]$DbName   = "procureflow",
    [string]$DbUser   = "postgres",
    [string]$DbHost   = "localhost",
    [string]$DbPort   = "5432",
    [string]$DbPass   = "96578097",
    [string]$BackupDir = "D:\Projects\procureflow_full_backups\local_backup"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$pgDump    = Join-Path $pgBin "pg_dump.exe"
$psql      = Join-Path $pgBin "psql.exe"

if (-not (Test-Path $pgDump)) {
    # Fallback: any PG version
    $pgDumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    $psqlCmd   = Get-Command psql   -ErrorAction SilentlyContinue
    if ($pgDumpCmd) { $pgDump = $pgDumpCmd.Source }
    if ($psqlCmd)   { $psql   = $psqlCmd.Source }
}
if (-not $pgDump -or -not (Test-Path $pgDump)) {
    Write-Error "pg_dump bulunamadi. PostgreSQL bin klasoru PATH'te olmali."
    exit 1
}

$env:PGPASSWORD = $DbPass

# ── 1. Mevcut durumu raporla ──────────────────────────────────────────────────
Write-Host ""
Write-Host "=== LOCAL DB DURUM RAPORU ===" -ForegroundColor Cyan
Write-Host "DB: $DbName @ $DbHost`:$DbPort"

function Invoke-Query([string]$sql) {
    & $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -t -c $sql 2>$null |
        Where-Object { $_.Trim() } | Select-Object -First 1 | ForEach-Object { $_.Trim() }
}

$userCount    = Invoke-Query "SELECT COUNT(*) FROM users"
$companyCount = Invoke-Query "SELECT COUNT(*) FROM companies"
$tenantCount  = Invoke-Query "SELECT COUNT(*) FROM tenants"
$quoteCount   = Invoke-Query "SELECT COUNT(*) FROM quotes"

Write-Host "  Kullanicilar : $userCount"
Write-Host "  Firmalar     : $companyCount"
Write-Host "  Tenantlar    : $tenantCount"
Write-Host "  Teklifler    : $quoteCount"

$isHealthy = ([int]$userCount -ge $MinUsers) -and ([int]$companyCount -ge $MinCompanies)
if ($isHealthy) {
    Write-Host "  Durum        : SAGLIKLI (esik: >=$MinUsers kullanici, >=$MinCompanies firma)" -ForegroundColor Green
} else {
    Write-Host "  UYARI: DB esik altinda (kullanici=$userCount < $MinUsers veya firma=$companyCount < $MinCompanies)" -ForegroundColor Yellow
}

# ── 2. Anlık snapshot al ────────────────────────────────────────────────────
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }

$ts       = Get-Date -Format "yyyyMMdd_HHmmss"
$snapName = "snapshot_${DbName}_${ts}.dump"
$snapPath = Join-Path $BackupDir $snapName

Write-Host ""
Write-Host "=== SNAPSHOT ALINIYOR ===" -ForegroundColor Cyan
Write-Host "Hedef: $snapPath"

& $pgDump -h $DbHost -p $DbPort -U $DbUser -Fc -d $DbName -f $snapPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump basarisiz (exit $LASTEXITCODE)"
    exit 1
}

$sizeMB = [math]::Round((Get-Item $snapPath).Length / 1MB, 2)
Write-Host "Snapshot tamam: $sizeMB MB" -ForegroundColor Green

# ── 3. Golden backup guncelle (istenirse ve DB saglikli ise) ─────────────────
if ($UpdateGolden) {
    if (-not $isHealthy) {
        Write-Host ""
        Write-Host "GOLDEN GUNCELLEME REDDEDILDI: DB saglik esigi altinda." -ForegroundColor Red
        Write-Host "Mevcut kullanici=$userCount (gereken >=$MinUsers), firma=$companyCount (gereken >=$MinCompanies)"
        exit 1
    }

    $goldenName = "GOLDEN_PROCUREFLOW_${ts}.dump"
    $goldenPath = Join-Path $BackupDir $goldenName

    # Eski golden'i bul ve yeniden adlandir (arsiv)
    $oldGoldens = Get-ChildItem $BackupDir -Filter "GOLDEN_PROCUREFLOW_*.dump" |
                  Sort-Object LastWriteTime -Descending
    foreach ($old in $oldGoldens) {
        $archiveName = $old.Name -replace "^GOLDEN_", "ARCHIVED_GOLDEN_"
        Rename-Item $old.FullName (Join-Path $BackupDir $archiveName)
        Write-Host "Arsivlendi: $($old.Name) -> $archiveName" -ForegroundColor DarkGray
    }

    Copy-Item $snapPath $goldenPath
    $goldenSizeMB = [math]::Round((Get-Item $goldenPath).Length / 1MB, 2)

    Write-Host ""
    Write-Host "=== GOLDEN BACKUP GUNCELLENDI ===" -ForegroundColor Green
    Write-Host "  Dosya  : $goldenPath"
    Write-Host "  Boyut  : $goldenSizeMB MB"
    Write-Host "  Icerik : kullanici=$userCount firma=$companyCount tenant=$tenantCount teklif=$quoteCount"
    Write-Host ""
    Write-Host "HOSTING_DEPLOYMENT_TRACKER.md icinde golden backup yolunu guncellemeyi unutma." -ForegroundColor Yellow
}

# ── 4. Eski snapshot'lari temizle (30 gundan eskiler) ────────────────────────
$cutoff = (Get-Date).AddDays(-30)
$old = Get-ChildItem $BackupDir -Filter "snapshot_*.dump" |
       Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old.Count -gt 0) {
    $old | Remove-Item -Force
    Write-Host "Temizlendi: $($old.Count) eski snapshot silindi (30+ gun)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== TAMAMLANDI ===" -ForegroundColor Cyan
Write-Host "Snapshot: $snapPath"
Write-Host "Artik guvenle DROP / RECREATE / restore yapabilirsin."
Write-Host ""
