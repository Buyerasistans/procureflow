# Migration Window Kopyala-Calistir Komutlari - 2026-04-16

Kapsam: Paket 4 son faz migration penceresi icin tek dosyada kopyala-calistir komut bloklari.

## 1) Preflight Hazirlik

```powershell
Get-Location
git status --short
Get-ChildItem approval-transition-audit-2026-04-16.*
Get-ChildItem audit-quote-rfq-legacy-cleanup.*
Get-ChildItem audit-billing-reconciliation.*
```

## 2) Preflight Audit Paketi

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_role_system_role_consistency.py --output-json approval-transition-audit-2026-04-16.json --output-csv approval-transition-audit-2026-04-16.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_quote_rfq_legacy_cleanup.py --json-output audit-quote-rfq-legacy-cleanup.json --csv-output audit-quote-rfq-legacy-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_billing_reconciliation.py --json-out audit-billing-reconciliation.json --csv-out audit-billing-reconciliation.csv
```

Beklenen:
- Approval transition issue = 0
- Quote/RFQ cleanup issue_counts bos
- Billing reconciliation problem_rows = 0

## 3) Preflight Test Paketi

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest tests/test_tenant_governance_authz.py -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
npm --prefix web run test:run -- src/test/admin-page-tenant-governance.test.tsx
```

Beklenen:
- Backend: 2 passed
- Frontend: 49 passed

## 4) Apply Bloku

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m alembic -c api/alembic.ini upgrade head
```

Not:
- Ortam SQL migration'lari DBA proseduruyle hedefli uyguluyorsa su dosyalar referans alinacak:
  - migrations/2026_04_15_finalize_quote_approval_required_role_compat_cleanup.sql
  - migrations/2026_04_15_finalize_quote_rfq_legacy_drop.sql

## 5) Post-Apply Dogrulama Bloku

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_role_system_role_consistency.py --output-json approval-transition-audit-2026-04-16.json --output-csv approval-transition-audit-2026-04-16.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_quote_rfq_legacy_cleanup.py --json-output audit-quote-rfq-legacy-cleanup.json --csv-output audit-quote-rfq-legacy-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_billing_reconciliation.py --json-out audit-billing-reconciliation.json --csv-out audit-billing-reconciliation.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest tests/test_tenant_governance_authz.py -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
npm --prefix web run test:run -- src/test/admin-page-tenant-governance.test.tsx
```

## 6) Rollback Sonrasi Minimum Dogrulama Bloku

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_role_system_role_consistency.py --output-json approval-transition-audit-2026-04-16.json --output-csv approval-transition-audit-2026-04-16.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_quote_rfq_legacy_cleanup.py --json-output audit-quote-rfq-legacy-cleanup.json --csv-output audit-quote-rfq-legacy-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/audit_billing_reconciliation.py --json-out audit-billing-reconciliation.json --csv-out audit-billing-reconciliation.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest tests/test_tenant_governance_authz.py -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
```

## 7) Operasyon Kapanis Bloku

```powershell
Get-ChildItem docs/release/release-window-2026-04-16.md
Get-ChildItem docs/release/go-no-go-2026-04-16.md
Get-ChildItem docs/release/migration-window-minute-checklist-2026-04-16.md
```

Referans dokumanlar:
- docs/release/tenant-saas-final-migration-preflight.md
- docs/release/tenant-saas-final-migration-runbook.md
- docs/release/migration-window-minute-checklist-2026-04-16.md
