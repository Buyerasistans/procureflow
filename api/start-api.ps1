$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
Set-Location $scriptRoot

if (-Not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error ".venv sanal ortamı bulunamadı. api dizininde .venv oluşturun ve paketleri yükleyin."
    exit 1
}

$env:PYTHONPATH = (Resolve-Path "$scriptRoot\.." ).Path
& ".\.venv\Scripts\python.exe" -m uvicorn api.main:app --host 0.0.0.0 --port 8000
