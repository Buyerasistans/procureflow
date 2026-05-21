$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "local_backups\$ts"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Kritik klasörleri yedekle
$items = @("api","web","wiki","tools","docs",".github")
foreach ($i in $items) {
  if (Test-Path $i) {
    Copy-Item $i "$backupDir\$i" -Recurse -Force
  }
}

git status --short | Out-File "$backupDir\git_status.txt" -Encoding utf8
git rev-parse --abbrev-ref HEAD | Out-File "$backupDir\branch.txt" -Encoding utf8

Write-Host "✅ Local snapshot created: $backupDir"
