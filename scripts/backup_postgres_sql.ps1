param(
    [string]$ProjectRoot = "D:\Projects\procureflow",
    [string]$BackupRoot = "D:\Projects\procureflow_full_backups\scheduled"
)

$ErrorActionPreference = "Stop"

$apiEnvPath = Join-Path $ProjectRoot "api\.env"
if (-not (Test-Path -LiteralPath $apiEnvPath)) {
    throw "api/.env bulunamadi: $apiEnvPath"
}

$dbUrlLine = Get-Content -LiteralPath $apiEnvPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $dbUrlLine) {
    throw "DATABASE_URL satiri bulunamadi"
}

$dbUrl = $dbUrlLine.Substring("DATABASE_URL=".Length)
if ($dbUrl -notmatch '^postgresql\+psycopg://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)$') {
    throw "DATABASE_URL beklenen formatta degil"
}

$dbUser = $matches[1]
$dbPass = $matches[2]
$dbHost = $matches[3]
$dbPort = $matches[4]
$dbName = $matches[5]

if ($dbName -ne "procureflow") {
    throw "Bu script sadece procureflow veritabani icin calisir"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlBackupDir = Join-Path $BackupRoot "sql"
if (-not (Test-Path -LiteralPath $sqlBackupDir)) {
    New-Item -ItemType Directory -Path $sqlBackupDir | Out-Null
}

$outputFile = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".sql")
$rarOutputFile = Join-Path $sqlBackupDir ("procureflow_sql_" + $timestamp + ".rar")

$rarCandidates = @(
    "C:\Program Files\WinRAR\Rar.exe",
    "C:\Program Files (x86)\WinRAR\Rar.exe"
)

$rarPath = $null
foreach ($candidate in $rarCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        $rarPath = $candidate
        break
    }
}

$rarCommand = if ($rarPath) { $rarPath } else { (Get-Command rar -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue) }
$env:PGPASSWORD = $dbPass

try {
    & pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $outputFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump komutu basarisiz oldu (kod=$LASTEXITCODE)"
    }

    if ($rarCommand) {
        & $rarCommand a -ep1 -m5 -idq $rarOutputFile $outputFile
        if ($LASTEXITCODE -ne 0) {
            throw "rar sikistirma basarisiz oldu (kod=$LASTEXITCODE)"
        }
        if (-not (Test-Path -LiteralPath $rarOutputFile)) {
            throw "rar cikti dosyasi olusturulamadi: $rarOutputFile"
        }
        Remove-Item -LiteralPath $outputFile -Force -ErrorAction SilentlyContinue
        $outputFile = $rarOutputFile
    }
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

"SQL_BACKUP_OK"
"DB=$dbName"
"FILE=$outputFile"
