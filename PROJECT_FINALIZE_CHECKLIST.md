# ProcureFlow — Proje Finalize Kontrol Listesi

## 📋 Genel Durum

**Proje Aşaması:** Release Calibration (Pre-Go-Live)  
**Başlama Tarihi:** Ocak 2026  
**Son Güncelleme:** Mayis 2026 (2026-05-01 kalibrasyon)  
**Teknik Stack:** React 19 + FastAPI + SQLAlchemy + PostgreSQL  

Kalibrasyon notu (2026-05-01):

- Runtime bootstrap zinciri: PASS
- Quote mirror drop readiness: PASS
- Quote mirror drop plan: PASS
- Hedefli web regresyon paketi: PASS (59/59)
- Fiziksel drop apply ve post-cut audit adimlari: release
penceresinde ayri onayla ilerleyecek

---

## 1️⃣ Kod Kalitesi — ÖNCELİKLİ

### 1.1 TypeScript Build

- [x] `npm run build` başarıyla tamamlanıyor

  ```bash
  cd web
  npm run build
  # Expected: ✓ built in 460ms (or faster)
  ```

- [x] TypeScript hataları YOK

  ```bash
  npm run type-check
  # Expected: 0 errors
  ```

- [x] ESLint uyarıları göz önüne alındı

  ```bash
  npm run lint
  # Expected: 0 critical errors (warnings ok)
  ```

### 1.2 Python Code Quality

- [x] `pytest` tüm testleri geçiyor

  ```bash
  cd api
  pytest tests/ -v
  # Expected: >=90% pass rate
  ```

- [ ] Linting pass

  ```bash
  ruff check .
  # Expected: 0 critical errors
  ```

- [ ] Type hints cover (`mypy`)

  ```bash
  mypy api/
  # Expected: <5 errors
  ```

---

## 2️⃣ Backend — ÖNCELİKLİ

### 2.1 API Endpoints

- [ ] Authentication endpoint'leri work
  - [ ] POST `/auth/login` — JWT token döndürüyor
  - [ ] POST `/auth/refresh` — Refresh token geçerli
  - [ ] POST `/auth/logout` — Token revoke edilebiliyor

- [ ] Supplier endpoints work
  - [ ] GET `/api/v1/supplier-quotes/me` — Tedarikçi teklif listesi dönüyor
  - [ ] GET `/api/v1/supplier-quotes/{supplier_quote_id}`
    — Tekil tedarikçi teklifi okunabiliyor
  - [ ] POST `/api/v1/supplier-quotes/{supplier_quote_id}/submit` — Yanıt gönderilebiliyor
  - [ ] POST `/api/v1/supplier-quotes/{supplier_quote_id}/save-draft` — Taslak kaydedilebiliyor

- [ ] Admin endpoints work
  - [ ] POST `/api/v1/quotes` — Yeni RFQ oluşturuluyor
  - [ ] POST `/api/v1/quotes/{id}/submit` — RFQ onay akışına gönderilebiliyor
  - [ ] POST `/api/v1/approvals/{quote_id}/approve` — Teklif onaylanabiliyor
  - [ ] GET `/api/v1/quotes` — Canonical RFQ listesi dönüyor

### 2.2 Veritabanı

Release gate sirasi:

1. validate_runtime_bootstrap_chain.py
2. audit_quote_mirror_drop_readiness.py
3. drop_quote_legacy_mirror_columns.py plan modu
4. Sadece release onayi varsa drop_quote_legacy_mirror_columns.py --apply
5. Apply sonrasi audit ve hedefli regresyon tekrar kosusu

- [x] Runtime bootstrap zinciri dogrulandi

  ```bash
  D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/validate_runtime_bootstrap_chain.py
  # Expected: VALIDATED_RUNTIME_BOOTSTRAP_CHAIN
  # Last run: 2026-05-01 PASS
  ```

- [x] Quote legacy mirror drop-readiness dogrulandi

  ```bash
  D:/Projects/procureflow/api/.venv/Scripts/python.exe \
    api/scripts/audit_quote_mirror_drop_readiness.py \
    --output-json audit-quote-mirror-drop-readiness.json \
    --output-csv audit-quote-mirror-drop-readiness.csv
  # Expected: QUOTE_LEGACY_MIRRORS_DROP_READY
  # Last run: 2026-05-01 PASS (drop_ready=true)
  ```

- [x] Quote legacy mirror drop plan'i dogrulandi

  ```bash
  D:/Projects/procureflow/api/.venv/Scripts/python.exe api/scripts/drop_quote_legacy_mirror_columns.py
  # Expected: QUOTE_LEGACY_MIRRORS_DROP_PLAN_READY
  # Last run: 2026-05-01 PASS
  ```

- [ ] Quote legacy mirror drop apply karari kayda baglandi

  ```bash
  # Sadece release penceresinde ve readiness yesilse:
  D:/Projects/procureflow/api/.venv/Scripts/python.exe \
    api/scripts/drop_quote_legacy_mirror_columns.py --apply
  # Expected: QUOTE_LEGACY_MIRRORS_DROPPED
  # Re-run Expected: QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED
  ```

- [ ] Post-cut audit ve hedefli regresyon tekrar kosuldu

  ```bash
  D:/Projects/procureflow/api/.venv/Scripts/python.exe \
    api/scripts/audit_role_system_role_consistency.py \
    --output-json approval-transition-audit-2026-04-16.json \
    --output-csv approval-transition-audit-2026-04-16.csv
  D:/Projects/procureflow/api/.venv/Scripts/python.exe \
    api/scripts/audit_quote_rfq_legacy_cleanup.py \
    --json-output audit-quote-rfq-legacy-cleanup.json \
    --csv-output audit-quote-rfq-legacy-cleanup.csv
  D:/Projects/procureflow/api/.venv/Scripts/python.exe \
    api/scripts/audit_billing_reconciliation.py \
    --json-out audit-billing-reconciliation.json \
    --csv-out audit-billing-reconciliation.csv
  D:/Projects/procureflow/api/.venv/Scripts/python.exe -m pytest \
    tests/test_tenant_governance_authz.py \
    -k "billing_webhook_retry_requires_super_admin or super_admin_can_retry_failed_billing_webhook_event"
  npm --prefix web run test:run -- src/test/admin-page-tenant-governance.test.tsx
  # Expected: audit issue sayaci 0, hedefli testler yesil
  ```

- [ ] Aktif veritabani yolu dogrulandi

  ```bash
  type api\.env
  # DATABASE_URL PostgreSQL olmali
  # Ornek: postgresql+psycopg://postgres:postgres@localhost:5432/procureflow

  type tests\conftest.py
  # TEST_DATABASE_URL PostgreSQL olmali
  # Ornek: postgresql+psycopg://postgres:postgres@localhost:5432/procureflow_test
  ```

- [ ] Migrations apply

  ```bash
  cd api
  alembic upgrade head
  # Expected: OK, success (0 errors)
  ```

- [ ] Tablolar düzgün

  ```bash
  python check_tables.py
  # Expected: All tables present and schema valid
  ```

- [ ] Admin user exist

  ```bash
  python inspect_users_table.py | grep -i admin
  # Expected: 1 admin user found
  ```

### 2.3 Email Service

- [ ] SMTP ayarları doğru

  ```bash
  python -c "from api.core.config import settings; print(settings.SMTP_HOST)"
  # Expected: olimposyapi.com
  ```

- [ ] Test email gönderiliyor

  ```bash
  curl -X POST http://localhost:8000/api/v1/advanced-settings/email/test \
    -H "Authorization: Bearer {TOKEN}"
  # Expected: 200 OK, mail-tester score >= 8.0/10
  ```

- [ ] DNS kayıtları verified
  - [ ] SPF: `v=spf1 a mx ip4:213.238.191.177 -all`
  - [ ] DKIM: public key yayınlanmış
  - [ ] DMARC: p=quarantine (veya p=reject production'da)
  - [ ] PTR: `177.191.238.213 → mail.olimposyapi.com`

---

## 3️⃣ Frontend — ÖNCELİKLİ

### 3.1 UI Components

- [ ] SupplierResponsePortal 3 tab'i work
  - [ ] Tab 1: "Bekleyen" — pending quote'lar gösteriliyor
  - [ ] Tab 2: "Gönderilen" — submitted quote'lar gösteriliyor
  - [ ] Tab 3: "Kapanmış" — closed quote'lar gösteriliyor

- [ ] Quote submission flow
  - [ ] Supplier detaylı fiyat giriş yapıyor
  - [ ] Revision request'i accept/reject edebiliyor
  - [ ] Final yanıt admin'e ulaşıyor

- [ ] Admin dashboard
  - [ ] Quote status'u doğru gösteriliyor
  - [ ] Approval workflow'u work
  - [ ] Revision history doğru loglanıyor

### 3.2 Build Artifacts

- [ ] Web production build ready

  ```bash
  cd web
  npm run build
  npm run preview
  # Expected: App loads on http://localhost:4173
  ```

- [ ] Asset'ler optimized
  - [ ] JS minified
  - [ ] CSS purged (unused styles removed)
  - [ ] Images optimized (next-gen formats)

---

## 4️⃣ Deployment — İKİNCİL

### 4.1 Server Setup

- [ ] Node.js version correct

  ```bash
  node --version
  # Expected: v18.x or v20.x
  ```

- [ ] Python version correct

  ```bash
  python --version
  # Expected: Python 3.9 or 3.10+
  ```

- [ ] Environment variables set

  ```bash
  # Kontrol et:
  echo $DATABASE_URL
  echo $SMTP_PASSWORD
  echo $JWT_SECRET_KEY
  # None should be empty (production)
  ```

### 4.2 Database Backup

- [ ] Backup strategy documented
  - [ ] `api/scripts/backup.py` — Automated daily backup
  - [ ] Backup location: `/backups/procureflow_*.db`
  - [ ] Retention: 30 days

- [ ] Restore procedure tested

  ```bash
  python api/scripts/restore_backup.py --backup-id latest
  # Expected: Restored successfully
  ```

---

## 5️⃣ Security — ÖNCELİKLİ

### 5.1 Authentication & Authorization

- [ ] JWT token secret strong

  ```bash
  # In .env
  JWT_SECRET_KEY = "$(openssl rand -base64 32)"  # min 32 chars
  # AND
  REFRESH_TOKEN_SECRET = "$(openssl rand -base64 32)"
  ```

- [ ] CORS properly configured

  ```python
  # api/main.py check:
  origins = ["https://yourdomain.com"]  # NOT "*" in production
  ```

- [ ] Password hash verified

  ```bash
  # Check: passwords use bcrypt (not plaintext)
  grep -r "bcrypt\|hash_password" api/
  # Expected: Hash functions used, NOT plaintext
  ```

### 5.2 API Security

- [ ] Rate limiting enabled

  ```python
  # Check: slowapi or similar in requirements.txt
  ```

- [ ] HTTPS enforced

  ```bash
  # Nginx/Apache config check:
  grep -i "redirect\|ssl" /etc/nginx/sites-enabled/procureflow
  # Expected: Redirects http → https
  ```

- [ ] SQL Injection protected

  ```python
  # Check: SQLAlchemy parameterized queries used (not f-strings)
  grep -r "query(\|execute(" api/services/ | head -5
  ```

---

## 6️⃣ Dokumentasyon — ÖNCELİKLİ

- [ ] ARCHITECTURE.md oluşturulmuş
  - [ ] Project structure documented ✅
  - [ ] Teklif workflow drawn ✅
  - [ ] Email hardening rules written ✅
  - [ ] DO/DON'T checklist included ✅

- [ ] CLEANUP_GUIDE.md oluşturulmuş
  - [ ] Temp files listelenmiş ✅
  - [ ] Git cleanup procedure yazılmış ✅
  - [ ] Disk optimization tips included ✅

- [ ] API Documentation
  - [x] Swagger/OpenAPI endpoint: `http://localhost:8000/docs`
  - [ ] All endpoints documented
  - [ ] Request/response schemas shown

- [ ] README.md updated
  - [x] Setup instructions (backend + frontend)
  - [x] Running the app locally
  - [x] Database initialization
  - [ ] Troubleshooting section

---

## 7️⃣ Git & Source Control

- [ ] .gitignore updated

  ```bash
  # Kontrol:
  git check-ignore -v *.db __pycache__ node_modules
  # Expected: All ignored
  ```

- [ ] Commit history clean

  ```bash
  git log --oneline | grep -i "temp\|debug\|wip" | wc -l
  # Expected: 0 (no WIP commits)
  ```

- [ ] Branch strategy defined

  ```bash
  git branch -a
  # Expected: main (stable), maybe dev/staging, feature/* branches cleaned up
  ```

- [ ] Staging area clean

  ```bash
  git status
  # Expected: "working tree clean" or only intentional changes
  ```

---

## 8️⃣ Testing — İKİNCİL

### 8.1 Unit Tests

- [x] Hedefli web regresyon paketi geciyor (public + tenant governance)

  ```bash
  npm --prefix D:/Projects/procureflow/web run test:run -- \
    src/test/public-pages.test.tsx \
    src/test/admin-page-tenant-governance.test.tsx \
    --reporter=verbose
  # Last run: 2026-05-01 PASS (59/59)
  ```

- [ ] Backend unit tests pass

  ```bash
  cd api && pytest tests/unit/ -v
  # Expected: >=90% pass
  ```

- [ ] Frontend component tests

  ```bash
  cd web && npm test
  # Expected: >=80% coverage
  ```

### 8.2 Integration Tests

- [ ] E2E quote workflow

  ```bash
  cd tests && pytest test_quotes.py -v
  # Expected: Create → Submit → Revise → Approve → Close
  ```

- [ ] Auth flow

  ```bash
  pytest test_auth.py -v
  # Expected: Login → Token → Refresh → Logout
  ```

---

## 9️⃣ Monitoring & Logging — İKİNCİL

- [ ] Logging configured

  ```python
  # api/core/config.py check:
  LOG_LEVEL = "INFO"  # or DEBUG in dev
  # Logs written to: api/logs/app.log
  ```

- [ ] Error tracking (optional)
  - [ ] Sentry/DataDog integration (optional in production)
  - [ ] Error alerts configured
  - [ ] Health check endpoint monitored

---

## 🔟 Final Checklist Before Go-Live

```bash
# Step 1: Clean up temp files
python CLEANUP_GUIDE.py

# Step 2: Build frontend
cd web && npm run build && npm run preview

# Step 3: Test backend
cd ../api && pytest tests/ -v

# Step 4: Check env vars
env | grep -E "DATABASE_URL|SMTP|JWT" | wc -l
# Should be >= 5 vars

# Step 5: Git status clean
git status && echo "✅ Git clean"

# Step 6: Dry-run migration
alembic upgrade head --sql

# Step 7: Health check
curl -s http://localhost:8000/health | jq .

# Step 8: Final build
cd ../web && npm run build
# Expected: ✓ built in <500ms, 0 errors

# Step 9: Tag release
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0

echo "🚀 Ready for deployment!"
```

---

## 📊 Proje İstatistikleri

| Metrik | Değer | Durum |
| --- | --- | --- |
| **TypeScript Errorleri** | 0 | ✅ |
| **Python Errorleri** | 0 | ✅ |
| **E-mail Score** | 8.7/10 | ✅ |
| **Test Coverage (Backend)** | TBD | 🔄 |
| **Test Coverage (Frontend)** | TBD | 🔄 |
| **API Endpoints** | 25+ | ✅ |
| **Database Tables** | 15+ | ✅ |
| **Git Commits** | TBD | ✅ |
| **Documentation Pages** | 3 | ✅ |

---

## 🎯 Sonraki Adımlar

1. **Bugün:** CLEANUP_GUIDE.md takip ederek temp dosyaları sil
2. **Bu Hafta:** `npm run build` + `pytest` çalıştır, status doğrula
3. **Sonraki Hafta:** QA testing + UAT
4. **2 Hafta:** Production deployment

---

**Hazırlayan:** GitHub Copilot + Serkan  
**Tarih:** Nisan 2026  
**Sürüm:** 1.0.0-rc1 (Release Candidate)
