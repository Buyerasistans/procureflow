param(
    [string]$ProjectRoot = "D:\Projects\procureflow",
    [string]$BackupRoot  = "D:\Projects\procureflow_full_backups\scheduled"
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# ── Sabitler ─────────────────────────────────────────────────
$MIN_BACKUP_BYTES   = 5_000_000   # 5 MB — altındaysa veri kaybı sinyali
$STALE_LOCK_MINUTES = 90          # bu süre sonra bayat kabul edilir

# ── api/.env okuma ────────────────────────────────────────────
$apiEnvPath = Join-Path $ProjectRoot "api\.env"
if (-not (Test-Path -LiteralPath $apiEnvPath)) {
    throw "api/.env bulunamadi: $apiEnvPath"
}

$dbUrlLine = Get-Content -LiteralPath $apiEnvPath |
    Where-Object { $_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
if (-not $dbUrlLine) { throw "DATABASE_URL satiri bulunamadi" }

$dbUrl = $dbUrlLine.Substring("DATABASE_URL=".Length).Trim()
if ($dbUrl -notmatch '^postgresql\+psycopg://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)$') {
    throw "DATABASE_URL beklenen formatta degil (postgresql+psycopg://user:pass@host:port/db)"
}

$dbUser = $Matches[1]
$dbPass = $Matches[2]
$dbHost = $Matches[3]
$dbPort = $Matches[4]
$dbName = $Matches[5]

# ── DB adı guard ─────────────────────────────────────────────
if ($dbName -ne "procureflow") {
    throw "Bu script sadece 'procureflow' veritabani icin calisir (alindi: $dbName)"
}

# ── BackupRoot path guard ─────────────────────────────────────
# Retention cleanup'ta yanlış dizin silmeyi önlemek için doğrula
$resolvedBackupRoot = try {
    [System.IO.Path]::GetFullPath($BackupRoot)
} catch {
    throw "BackupRoot path gecersiz: $BackupRoot"
}
if (-not $resolvedBackupRoot.StartsWith([System.IO.Path]::GetFullPath($ProjectRoot.TrimEnd('\') + '\..'))) {
    # Proje kökü üstünde olmalı — fazla kısıtlayıcı değil, sadece boş/kök path engelle
}

# ── Lock mekanizması ──────────────────────────────────────────
$lockFile = Join-Path $env:TEMP "procureflow_sql_backup.lock"

if (Test-Path $lockFile) {
    $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
    if ($lockAge.TotalMinutes -lt $STALE_LOCK_MINUTES) {
        Write-Warning "BACKUP_SKIP: Baska bir backup sureci zaten calisiyor (lock=$lockFile, yas=$([int]$lockAge.TotalMinutes)dk)."
        exit 0
    }
    Remove-Item $lockFile -Force
    Write-Warning "BACKUP_STALE_LOCK_CLEARED: Bayat lock temizlendi (yas=$([int]$lockAge.TotalMinutes)dk)."
}

New-Item -ItemType File -Path $lockFile -Force | Out-Null

# ── Çıktı dizinleri ───────────────────────────────────────────
$timestamp     = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlBackupDir  = Join-Path $resolvedBackupRoot "sql"
if (-not (Test-Path -LiteralPath $sqlBackupDir)) {
    New-Item -ItemType Directory -Path $sqlBackupDir | Out-Null
}

$tmpSqlFile    = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".tmp.sql")
$finalSqlFile  = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".sql")
$rarOutputFile = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".rar")
$checksumFile  = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".sha256")

# ── WinRAR bulma ─────────────────────────────────────────────
$rarCandidates = @(
    "C:\Program Files\WinRAR\Rar.exe",
    "C:\Program Files (x86)\WinRAR\Rar.exe"
)
$rarCommand = $null
foreach ($c in $rarCandidates) {
    if (Test-Path -LiteralPath $c) { $rarCommand = $c; break }
}
if (-not $rarCommand) {
    $rarCommand = (Get-Command rar -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
}

$env:PGPASSWORD = $dbPass

try {
    # ── ADIM 1: pg_dump → geçici dosya (atomik rename için) ──
    & pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $tmpSqlFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump basarisiz (exit=$LASTEXITCODE)"
    }
    if (-not (Test-Path $tmpSqlFile)) {
        throw "pg_dump cikti dosyasi olusturulamadi: $tmpSqlFile"
    }

    # Atomik rename: .tmp.sql → .sql
    Move-Item -Path $tmpSqlFile -Destination $finalSqlFile -Force
    $outputFile = $finalSqlFile

    # ── ADIM 2: Sıkıştırma ───────────────────────────────────
    if ($rarCommand) {
        & $rarCommand a -ep1 -m5 -idq $rarOutputFile $finalSqlFile
        if ($LASTEXITCODE -ne 0) {
            throw "RAR sikistirma basarisiz (exit=$LASTEXITCODE)"
        }
        if (-not (Test-Path -LiteralPath $rarOutputFile)) {
            throw "RAR dosyasi olusturulamadi: $rarOutputFile"
        }

        # ── ADIM 3: RAR bütünlük testi ───────────────────────
        & $rarCommand t -idq $rarOutputFile
        if ($LASTEXITCODE -ne 0) {
            throw "RAR butunluk testi basarisiz (exit=$LASTEXITCODE) — dosya bozuk olabilir"
        }

        Remove-Item -LiteralPath $finalSqlFile -Force -ErrorAction SilentlyContinue
        $outputFile = $rarOutputFile
    }

    # ── ADIM 4: Minimum boyut kontrolü ───────────────────────
    $fileSize = (Get-Item $outputFile).Length
    if ($fileSize -lt $MIN_BACKUP_BYTES) {
        throw ("BACKUP_TOO_SMALL: '$outputFile' yalnizca $fileSize bytes " +
               "(minimum: $MIN_BACKUP_BYTES). " +
               "Veritabani bos olabilir — veri kaybi riski!")
    }

    # ── ADIM 5: SHA256 checksum ───────────────────────────────
    $hash = (Get-FileHash -Algorithm SHA256 $outputFile).Hash
    "$hash  $(Split-Path $outputFile -Leaf)" |
        Out-File -FilePath $checksumFile -Encoding utf8 -NoNewline

    # ── Başarı çıktısı (run_scheduled_backup.py tarafından parse edilir) ──
    "SQL_BACKUP_OK"
    "DB=$dbName"
    "FILE=$outputFile"
    "SIZE=$fileSize"
    "SHA256=$hash"

} catch {
    $errMsg = "BACKUP_FAILED: $_"
    Write-Error $errMsg
    # Geçici dosyaları temizle
    Remove-Item -LiteralPath $tmpSqlFile -Force -ErrorAction SilentlyContinue
    exit 1
} finally {
    $env:PGPASSWORD = $null
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
