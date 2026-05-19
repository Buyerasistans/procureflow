# Migration Window Dakika Bazli Komut Checklisti - 2026-04-16

Kapsam: Paket 4 son faz migration penceresinde operasyon ekibinin
dakika bazli uygulama akisi.

Hizli kullanim:

- Tek dosyada kopyala-calistir bloklari icin docs/release/migration-window-copy-paste-commands-2026-04-16.md

## T-30 dk (Pencere Acilmadan Once)

- [ ] Terminal ve yetki kontrolu

```powershell
Get-Location
git status --short
```

- [ ] Preflight dokumani ve runbook referansi acik
  - docs/release/tenant-saas-final-migration-preflight.md
  - docs/release/tenant-saas-final-migration-runbook.md

- [ ] Son audit artefaktlari workspace icinde mevcut

```powershell
Get-ChildItem approval-transition-audit-2026-04-16.*
Get-ChildItem approval-required-role-cleanup*
Get-ChildItem audit-quote-rfq-legacy-cleanup.*
Get-ChildItem audit-billing-reconciliation.*
```

## T-20 dk (Yedek ve Donma Hazirligi)

- [ ] DB snapshot/yedek alinmis (ortam prosedurune gore)
- [ ] Yazma trafigi dusuk pencereye alinmis
- [ ] Operasyon notu acildi (kim, ne zaman, hangi commit)

## T-15 dk (Audit Kapisi Son Kontrol)

- [ ] Approval transition audit yeniden kos

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_role_system_role_consistency.py `
  --output-json approval-transition-audit-2026-04-16.json `
  --output-csv approval-transition-audit-2026-04-16.csv
```

Beklenen:

- quote_approvals_with_issues = 0

- [ ] Quote/RFQ legacy cleanup audit yeniden kos

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_rfq_legacy_cleanup.py `
  --json-output audit-quote-rfq-legacy-cleanup.json `
  --csv-output audit-quote-rfq-legacy-cleanup.csv
```

Beklenen:

- summary.issue_counts bos

- [ ] Approval required_role cleanup audit yeniden kos

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_approval_required_role_cleanup.py `
  --output-json approval-required-role-cleanup.json `
  --output-csv approval-required-role-cleanup.csv
```

Beklenen:

- summary.compat_cleanup_ready = true
- summary.issue_counts bos

- [ ] Billing reconciliation audit yeniden kos

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_billing_reconciliation.py `
  --json-out audit-billing-reconciliation.json `
  --csv-out audit-billing-reconciliation.csv
```

Beklenen:

- summary.problem_rows = 0
- summary.issue_counts bos

## T-10 dk (Hedefli Test Kapisi)

- [ ] Backend hedefli retry authz testi

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  -m pytest tests/test_tenant_governance_authz.py `
  -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
```

Beklenen:

- 2 passed

- [ ] Frontend governance/billing hedefli test

```powershell
npm --prefix web run test:run -- `
  src/test/admin-page-tenant-governance.test.tsx `
  src/test/admin-modal-workflows.test.tsx
```

Beklenen:

- 71 passed

## T-5 dk (GO/NO-GO Kapisi)

- [ ] Tum auditler temiz
- [ ] Tum hedefli testler yesil
- [ ] Runbook rollback adimi hazir
- [ ] Operasyon sorumlusu GO onayi verdi

Karar:

- [ ] GO
- [ ] NO-GO

## T0 (Migration Uygulama)

- [ ] Runbook uygulama adimlari sirali izlenir
  - docs/release/tenant-saas-final-migration-runbook.md

Not:

- Ortam Alembic zinciri ve/veya DBA SQL uygulama prosedurune gore ilerlenir.
- Onayli migration dosyalari:
  - migrations/2026_04_15_finalize_quote_approval_required_role_compat_cleanup.sql
  - migrations/2026_04_15_finalize_quote_rfq_legacy_drop.sql

## T+5 dk (Post-Apply Dogrulama)

- [ ] Uc audit tekrar kosulur (T-15 komutlari)
- [ ] Approval required_role cleanup apply artefakti dogrulandi
- [ ] Backend hedefli test tekrar kosulur
- [ ] Frontend hedefli test tekrar kosulur
- [ ] Release notu guncellenir

## T+15 dk (Kapanis)

- [ ] docs/release/release-window-2026-04-16.md guncellendi
- [ ] docs/release/go-no-go-2026-04-16.md karar satiri dogrulandi
- [ ] Operasyon kaydi kapatildi

## Acil Durum (Rollback)

- [ ] Snapshot restore
- [ ] Uc audit yeniden kos
- [ ] Kritik hedefli testleri yeniden kos
- [ ] NO-GO kaydi ac
