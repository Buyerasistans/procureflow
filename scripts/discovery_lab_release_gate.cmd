@echo off
setlocal

set PYTEST_NO_DROP=1
set PYTHON_BIN=python
if exist api\.venv\Scripts\python.exe set PYTHON_BIN=api\.venv\Scripts\python.exe

%PYTHON_BIN% -m pytest -m nodrop tests/test_ai_lab_router.py
if errorlevel 1 exit /b %errorlevel%

pushd web
call npm.cmd run test:run -- discovery-lab.test.tsx
if errorlevel 1 (
  popd
  exit /b %errorlevel%
)

call npm.cmd run type-check
if errorlevel 1 (
  popd
  exit /b %errorlevel%
)

call npm.cmd run build
if errorlevel 1 (
  popd
  exit /b %errorlevel%
)
popd

git diff --check
exit /b %errorlevel%
