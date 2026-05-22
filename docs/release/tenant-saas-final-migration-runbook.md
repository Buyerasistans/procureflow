# Tenant SaaS Final Migration Runbook

Tarih: 2026-04-16
Son yenileme: 2026-04-19
Kapsam: Paket 4 final migration penceresi (apply, rollback, verification).

Not:

- Tum komutlar repo kokunden calistirilir: D:/Projects/procureflow
- Quote legacy mirror fiziksel drop adimi kosullu bir final cutover isidir.
  Readiness yesil degilse --apply adimina gecilmez.

## 1) Hazirlik

- Veritabani yedegi alin.
- Preflight checklist
  (docs/release/tenant-saas-final-migration-preflight.md)
  tamamlanmis olmali.
- Uygulama yazma trafigi dusuk pencereye alinmali.

## 2) Apply Sirasi

PowerShell (repo kokunden):

```powershell
# 1) Approval compatibility cleanup
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m alembic `
  -c api/alembic.ini upgrade head

# 1b) Approval required_role mirror cleanup readiness
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_approval_required_role_cleanup.py `
  --output-json approval-required-role-cleanup.json `
  --output-csv approval-required-role-cleanup.csv

# 1c) Readiness yesil ise mirror cleanup uygula
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_approval_required_role_cleanup.py --apply `
  --output-json approval-required-role-cleanup-applied.json `
  --output-csv approval-required-role-cleanup-applied.csv

# 2) Runtime/bootstrap zinciri
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/validate_runtime_bootstrap_chain.py

# 3) Quote mirror readiness gate
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_mirror_drop_readiness.py `
  --output-json audit-quote-mirror-drop-readiness.json `
  --output-csv audit-quote-mirror-drop-readiness.csv

# 4) Quote mirror drop plan onayi
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/drop_quote_legacy_mirror_columns.py

# 5) Sadece release onayi varsa fiziksel drop
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/drop_quote_legacy_mirror_columns.py --apply

# Not:
# Bu repo akisi SQL migration dosyalarini release penceresinde hedefli olarak kullanir.
# Gerekirse onayli migration dosyalari DBA proseduruyle sirali uygulanir:
# - migrations/2026_04_15_finalize_quote_approval_required_role_compat_cleanup.sql
# - migrations/2026_04_15_finalize_quote_rfq_legacy_drop.sql
```

## 3) Rollback Yaklasimi

- Her migration adimi oncesi DB snapshot alin.
- Hata durumunda snapshot restore et.
- Restore sonrasi dogrulama auditlerini tekrar calistir.

Ornek geri donus akisi:

```powershell
# Ortama ozel backup/restore proseduru kullanilir.
# Restore sonrasi audit ve hedefli testler tekrar kosulur.
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
  --json-output audit-quote-rfq-legacy-cleanup.json `
  --csv-output audit-quote-rfq-legacy-cleanup.csv
```

## 4) Dogrulama Sirasi

Apply sonrasi zorunlu adimlar:

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/validate_runtime_bootstrap_chain.py
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_mirror_drop_readiness.py `
  --output-json audit-quote-mirror-drop-readiness.json `
  --output-csv audit-quote-mirror-drop-readiness.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/drop_quote_legacy_mirror_columns.py
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_role_system_role_consistency.py `
  --output-json approval-transition-audit-2026-04-16.json `
  --output-csv approval-transition-audit-2026-04-16.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_quote_rfq_legacy_cleanup.py `
  --json-output audit-quote-rfq-legacy-cleanup.json `
  --csv-output audit-quote-rfq-legacy-cleanup.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe `
  api/scripts/audit_billing_reconciliation.py `
  --output-json audit-billing-reconciliation.json `
  --output-csv audit-billing-reconciliation.csv
D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest `
  tests/test_tenant_governance_authz.py `
  -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
npm --prefix web run test:run -- `
  src/test/admin-page-tenant-governance.test.tsx `
  src/test/admin-modal-workflows.test.tsx
```

Fiziksel drop uygulandiysa ek post-cut dogrulama:

```powershell
D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/drop_quote_legacy_mirror_columns.py
```

Beklenen cikti:

- Apply komutunda: QUOTE_LEGACY_MIRRORS_DROPPED
- Post-cut dogrulamada: QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED

## 5) Beklenen Sonuc

- Audit issue sayaci: 0
- Runtime bootstrap validation: `VALIDATED_RUNTIME_BOOTSTRAP_CHAIN`
- Approval required_role mirror cleanup:
  `APPROVAL_REQUIRED_ROLE_COMPAT_CLEANED` ->
  `APPROVAL_REQUIRED_ROLE_MIRROR_DROP_READY`
- Quote legacy mirror readiness: `QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED`
- Quote legacy mirror apply/post-cut gate:
  `QUOTE_LEGACY_MIRRORS_DROPPED` -> `QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED`
- Backend hedefli retry authz testleri: yesil
- Frontend admin governance test paketi: yesil
- Release notu dokumani guncellenmis

## 6) Artefaktlar

- approval-transition-audit-2026-04-16.json
- approval-transition-audit-2026-04-16.csv
- approval-required-role-cleanup.json
- approval-required-role-cleanup.csv
- approval-required-role-cleanup-applied.json
- approval-required-role-cleanup-applied.csv
- audit-quote-rfq-legacy-cleanup.json
- audit-quote-rfq-legacy-cleanup.csv
- audit-quote-mirror-drop-readiness.json
- audit-quote-mirror-drop-readiness.csv
- quote legacy mirror drop plan terminal cikti kaydi
- audit-billing-reconciliation.json
- audit-billing-reconciliation.csv
- docs/release/release-window-2026-04-16.md
- docs/release/public-search-console-bing-submit-checklist-2026-04-19.md

## 7) Public Search Evidence

- Search Console ve Bing submit kanitlari
  docs/release/public-search-console-bing-submit-checklist-2026-04-19.md
  icindeki "Operasyon Cikti Kaydi" alanina islenir.
- Release penceresi sonunda en az bir Search Console ve bir Bing
  inspection linki kanit olarak eklenmeden public web cutover tam
  kapanmis sayilmaz.
