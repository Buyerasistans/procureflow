# Release Window Cikti Seti - 2026-04-16

Bu dokuman, Batch C kapanisinda release penceresi icin toplanan audit ve
hedefli test ciktilarini tek formatta ozetler.

Son yenileme: 2026-04-19 (post-cleanup evidence refresh)

## 1) Audit Artefaktlari

- approval-transition-audit-2026-04-16.json
- approval-transition-audit-2026-04-16.csv
- approval-required-role-cleanup.json
- approval-required-role-cleanup.csv
- approval-required-role-cleanup-applied.json
- approval-required-role-cleanup-applied.csv
- audit-quote-mirror-drop-readiness.json
- audit-quote-mirror-drop-readiness.csv
- audit-quote-rfq-legacy-cleanup.json
- audit-quote-rfq-legacy-cleanup.csv
- audit-billing-reconciliation.json
- audit-billing-reconciliation.csv

## 2) Audit Ozeti

- Runtime bootstrap: VALIDATED_RUNTIME_BOOTSTRAP_CHAIN
- Quote mirror readiness: quotes = 23, issue_counts bos, drop_ready = true
- Quote mirror drop apply:
  QUOTE_LEGACY_MIRRORS_DROPPED -> sonraki dogrulamada
  QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED
- Approval transition:
  total_users = 37, users_with_issues = 0
  total_quote_approvals = 6, quote_approvals_with_issues = 0
- Approval required_role cleanup:
  compat_cleanup_ready = true, compat_cleanup_candidates = 0,
  already_cleaned = true, mirror_drop_ready = true
- Quote/RFQ legacy cleanup:
  quotes.total_rows = 23, supplier_quotes.total_rows = 20, issue_counts bos
- Billing reconciliation: section_count = 3, problem_rows = 0, issue_counts = 0

## 3) Hedefli Test Ozeti

- Backend:
  tests/test_tenant_governance_authz.py -k
  "billing_webhook_retry_requires_super_admin or
  super_admin_can_retry_failed_billing_webhook_event" -> 2 passed
- Backend:
  tests/test_quote_approval_required_role_cleanup.py +
  tests/test_approval_authz.py +
  tests/test_quote_approval_permissions.py -> 11 passed
- Frontend: src/test/admin-page-tenant-governance.test.tsx -> 65 passed
- Frontend: src/test/admin-page-tenant-governance.test.tsx +
  src/test/admin-modal-workflows.test.tsx -> 71 passed
- Frontend: npm --prefix web run lint -> pass
- Frontend: npm --prefix web run build -> pass

## 4) Batch C Cikis Karari

- Legacy drop preflight checklist hazirlandi.
- Operasyon runbook hazirlandi.
- Release penceresi cikti seti bu dokumanda sabitlendi.
- Fiziksel mirror drop apply adimi tamamlandi.
- Demo personel seed duzeltmesi sonrasi approval audit artefakti da temiz duruma
  getirildi.

Karar: migration penceresi icin GO/NO-GO degerlendirmesi preflight kapisina
gore verilir.

## 5) Komut Kaniti (Yeniden Calistirilan)

- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/validate_runtime_bootstrap_chain.py
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_quote_mirror_drop_readiness.py
  --output-json audit-quote-mirror-drop-readiness.json
  --output-csv audit-quote-mirror-drop-readiness.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/drop_quote_legacy_mirror_columns.py
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/drop_quote_legacy_mirror_columns.py --apply
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_role_system_role_consistency.py
  --output-json approval-transition-audit-2026-04-16.json
  --output-csv approval-transition-audit-2026-04-16.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_quote_approval_required_role_cleanup.py
  --output-json approval-required-role-cleanup.json
  --output-csv approval-required-role-cleanup.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_quote_approval_required_role_cleanup.py --apply
  --output-json approval-required-role-cleanup-applied.json
  --output-csv approval-required-role-cleanup-applied.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_quote_rfq_legacy_cleanup.py
  --json-output audit-quote-rfq-legacy-cleanup.json
  --csv-output audit-quote-rfq-legacy-cleanup.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe
  api/scripts/audit_billing_reconciliation.py
  --json-out audit-billing-reconciliation.json
  --csv-out audit-billing-reconciliation.csv
- D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest
  tests/test_tenant_governance_authz.py -k
  "billing_webhook_retry_requires_super_admin or
  super_admin_can_retry_failed_billing_webhook_event"
- D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest
  tests/test_quote_approval_required_role_cleanup.py
  tests/test_approval_authz.py
  tests/test_quote_approval_permissions.py
- npm --prefix web run test:run --
  src/test/admin-page-tenant-governance.test.tsx
  src/test/admin-modal-workflows.test.tsx
- npm --prefix web run lint
- npm --prefix web run build
