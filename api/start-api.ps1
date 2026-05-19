$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot

if (-Not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error ".venv sanal ortamı bulunamadı. api dizininde .venv oluşturun ve paketleri yükleyin."
    exit 1
}

$env:PYTHONPATH = (Resolve-Path "$scriptRoot\.." ).Path
& ".\.venv\Scripts\python.exe" -m uvicorn api.main:app --host 0.0.0.0 --port 8000
