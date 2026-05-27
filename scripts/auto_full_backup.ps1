param(
    [string]$Source = "D:\Projects\procureflow",
    [string]$BackupRoot = "D:\Projects\procureflow_full_backups\scheduled"
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$source = $Source
$backupRoot = $BackupRoot
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$target = Join-Path $backupRoot ("backup_" + $timestamp)

$excludeDirectories = @(
    ".git",
    ".venv",
    "api\.venv",
    "api\node_modules",
    "web\node_modules",
    "web\coverage",
    "web\dist"
)

$excludeFiles = @(
    "api_debug.log",
    "history_restore_plan.txt",
    "history_restore_result.txt",
    "token.txt",
    "check_*.py",
    "create_*.py",
    "debug_*.py",
    "decode_jwt.py",
    "final_test.py",
    "find_admin.py",
    "fix_*.py",
    "init_db.py",
    "inspect_users_table.py",
    "load_*.py",
    "seed_test_user.py",
    "test_*.py",
    "settings.json",
    "settings_default.json"
)

if (-not (Test-Path -LiteralPath $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}

New-Item -ItemType Directory -Path $target | Out-Null
$logPath = Join-Path $target "backup.log"

$robocopyArgs = @(
    $source,
    $target,
    "/E",
    "/R:1",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NP",
    "/LOG:$logPath"
)

if ($excludeDirectories.Count -gt 0) {
    $robocopyArgs += "/XD"
    $robocopyArgs += $excludeDirectories
}

if ($excludeFiles.Count -gt 0) {
    $robocopyArgs += "/XF"
    $robocopyArgs += $excludeFiles
}

& robocopy @robocopyArgs | Out-Null

if ($LASTEXITCODE -gt 7) {
    throw "Robocopy failed with code $LASTEXITCODE"
}

"BACKUP_OK"
"SOURCE=$source"
"TARGET=$target"
"LOG=$logPath"
"ROBOCODE=$LASTEXITCODE"
