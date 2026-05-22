@echo off
cd /d %~dp0
if not exist ".venv\Scripts\python.exe" (
  echo .venv sanal ortamı bulunamadı. api\ dizininde .venv oluşturun.
  exit /b 1
)

set PYTHONPATH=%~dp0..
".venv\Scripts\python.exe" -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
