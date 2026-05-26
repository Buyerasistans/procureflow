# Discovery Lab Release Gate

This runbook closes the Discovery Lab hotfix without destructive database cleanup.

## No-drop backend profile

Use `PYTEST_NO_DROP=1` for backend Discovery Lab tests:

```powershell
$env:PYTEST_NO_DROP = "1"
.\api\.venv\Scripts\python.exe -m pytest -m nodrop tests/test_ai_lab_router.py
```

The no-drop profile creates an isolated SQLite database under `tests/.runtime/` and does not call the legacy test teardown that drops tables.

## Full local gate

On Windows, use the `.cmd` wrapper to avoid PowerShell execution-policy issues with `npm.ps1`:

```powershell
scripts\discovery_lab_release_gate.cmd
```

The gate runs:

1. `PYTEST_NO_DROP=1 api\.venv\Scripts\python.exe -m pytest -m nodrop tests/test_ai_lab_router.py`
2. `npm.cmd run test:run -- discovery-lab.test.tsx`
3. `npm.cmd run type-check`
4. `npm.cmd run build`
5. `git diff --check`

## Converter health check

Authenticated admins can check converter availability:

```http
GET /api/v1/ai-lab/health/converter
```

Response fields:

```json
{
  "converter_found": false,
  "resolver_source": "unavailable",
  "executable_name": null,
  "request_id": "..."
}
```

The endpoint intentionally avoids returning absolute paths or raw converter exceptions. Operational details are logged with `request_id`, `error_code`, and `reason`.

For Ubuntu/Plesk live setup, install/configure the converter with:

- [Discovery Lab Ubuntu/Plesk DWG Converter Runbook](discovery-lab-ubuntu-plesk-converter.md)

## Release acceptance

- Backend Discovery Lab tests pass with `PYTEST_NO_DROP=1`.
- Frontend Discovery Lab test passes.
- Type-check and build pass.
- `git diff --check` passes.
- Raw technical exceptions are not shown in the Discovery Lab UI.
