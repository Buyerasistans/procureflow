# Tenant SaaS Final Migration Preflight (Batch C)

Tarih: 2026-04-16
Son yenileme: 2026-04-19
Kapsam: Paket 4 son faz migration kararindan once canli-oncesi kontrol kapisi.

## 1) Kapsama Giren Migration Dosyalari

- migrations/2026_04_15_finalize_quote_rfq_legacy_drop.sql
- migrations/2026_04_15_finalize_quote_approval_required_role_compat_cleanup.sql

## 2) Preflight Giris Kriterleri (Go/No-Go)

Asagidaki maddelerin tumu saglanmadan migration uygulanmaz:

- Approval transition auditi issue=0 olmali.
- Approval required_role compatibility cleanup auditi yesil olmali.
- Quote/RFQ legacy cleanup auditi issue=0 olmali.
- Billing reconciliation auditi issue=0 olmali.
- Hedefli backend authz/regresyon paketleri yesil olmali.
- Hedefli frontend governance/billing regresyon paketi yesil olmali.

## 3) Audit Kontrol Komutlari

PowerShell (repo kokunden):

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_role_system_role_consistency.py `
  --output-json approval-transition-audit-2026-04-16.json `
  --output-csv approval-transition-audit-2026-04-16.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_approval_required_role_cleanup.py `
  --output-json approval-required-role-cleanup.json `
  --output-csv approval-required-role-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_rfq_legacy_cleanup.py `
  --output-json audit-quote-rfq-legacy-cleanup.json `
  --output-csv audit-quote-rfq-legacy-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_billing_reconciliation.py `
  --output-json audit-billing-reconciliation.json `
  --output-csv audit-billing-reconciliation.csv
```

Beklenen:

- approval-transition-audit-2026-04-16.json icinde
  quote_approvals_with_issues = 0
- approval-required-role-cleanup.json icinde
  compat_cleanup_ready = true ve issue_counts bos
- audit-quote-rfq-legacy-cleanup.json icinde issue_counts bos
- audit-billing-reconciliation.json icinde issue_counts bos

## 4) Hedefli Test Kapisi

Backend:

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  -m pytest tests/test_tenant_governance_authz.py `
  -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
```

Frontend:

```powershell
npm --prefix web run test:run -- src/test/admin-page-tenant-governance.test.tsx
npm --prefix web run test:run -- `
  src/test/admin-page-tenant-governance.test.tsx `
  src/test/admin-modal-workflows.test.tsx
```

Beklenen:

- Backend hedefli retry paketi gecmeli (2/2)
- Frontend hedefli admin paketi gecmeli (71/71)

## 5) Onay Kapisi

Asagidaki sorulara toplu "evet" denmeden migration penceresi acilmaz:

- Tum audit raporlari temiz mi?
- Hedefli testler yesil mi?
- Cikti dosyalari release notuna eklendi mi?
- Rollback komutlari runbookta hazir mi?
- Public search submit checklist'i ve evidence alanlari hazir mi?

## 6) Karar

- GO: Tum maddeler tamam.
- NO-GO: Herhangi bir audit/test kirmizisi varsa migration ertelenir.
