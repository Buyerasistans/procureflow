# update-deps.ps1 — Bağımlılıkları requirements.in'den yeniden derler
# Kullanım:
#   ./update-deps.ps1           # mevcut sürümleri koru (güvenli)
#   ./update-deps.ps1 -Upgrade  # tüm paketleri güncelle

param(
    [switch]$Upgrade
)

$venv = Join-Path $PSScriptRoot "api\.venv\Scripts"
$pip  = Join-Path $venv "pip.exe"
$compile = Join-Path $venv "pip-compile.exe"

# pip-tools yoksa kur
& $pip install --quiet pip-tools

$args = @("api\requirements.in", "-o", "api\requirements.txt")
if (-not $Upgrade) { $args += "--no-upgrade" }

Write-Host "pip-compile $($args -join ' ')" -ForegroundColor Cyan
& $compile @args

Copy-Item "api\requirements.txt" "requirements.txt" -Force
Copy-Item "api\requirements.txt" "requirements-lock.txt" -Force
Write-Host "Tamamlandi: api/requirements.txt, requirements.txt, requirements-lock.txt guncellendi." -ForegroundColor Green
