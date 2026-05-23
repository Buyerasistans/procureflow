# update-deps.ps1 - Bağımlılıkları requirements.in'den yeniden derler
# Kullanım:
#   ./update-deps.ps1           # mevcut sürümleri koru (güvenli)
#   ./update-deps.ps1 -Upgrade  # tüm paketleri güncelle

param(
    [switch]$Upgrade
)

[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$venv = Join-Path $PSScriptRoot "api\.venv\Scripts"
$pip  = Join-Path $venv "pip.exe"
$compile = Join-Path $venv "pip-compile.exe"

# pip-tools yoksa kur
& $pip install --quiet pip-tools

$args = @("api\requirements.in", "-o", "api\requirements.txt")
if (-not $Upgrade) { $args += "--no-upgrade" }

Write-Host "pip-compile $($args -join ' ')" -ForegroundColor Cyan
& $compile @args
