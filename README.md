# ProcureFlow API

FastAPI tabanlı backend servisidir.

## Son Release Ozeti (2026-04-20)

- Paket 5 SaaS ticari katman kapanisi dokumante edildi.
- Discovery Lab kritik senaryolarinda frontend test drift stabilizasyonu tamamlandi.
- Ikinci axios istemcisinde request interceptor headers korumasi
  eklenerek import-time crash riski giderildi.
- Hedefli frontend regresyon dogrulamasi:
  public-pages + admin governance kombinasyonu 72/72 yesil.

Detayli kapanis notu:

- docs/release/package-5-saas-commercial-layer-complete-2026-04-20.md

## 1) Gereksinimler

- Python 3.11+ (3.14 da olur)
- Git
- Windows PowerShell

## 2) Kurulum

```powershell
cd D:\Projects\procureflow\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Tenant Bootstrap

Mevcut admin kayitlarindan tenant omurgasi olusturmak icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\apply_runtime_foundation_columns.py
api\.venv\Scripts\python.exe api\scripts\apply_runtime_compat_columns.py
api\.venv\Scripts\python.exe api\scripts\apply_runtime_quote_compat_columns.py
api\.venv\Scripts\python.exe api\scripts\apply_supplier_quote_price_rules_defaults.py
api\.venv\Scripts\python.exe -m api.scripts.bootstrap_tenants --dry-run
api\.venv\Scripts\python.exe -m api.scripts.bootstrap_tenants --apply
```

Canli veritabani eski tek-tenant veriyle calisiyorsa ve bootstrap sirasinda
kalan tenant_id bosluklarini ayni akista kapatmak istiyorsaniz:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe -m api.scripts.bootstrap_tenants --dry-run --backfill-single-tenant
api\.venv\Scripts\python.exe -m api.scripts.bootstrap_tenants --apply --backfill-single-tenant
```

Notlar:

- `apply_runtime_foundation_columns.py`, canli DB'de eksik
  tenant/system_role kolonlarini ve tenant tablolarini idempotent
  sekilde hazirlar.
- `apply_runtime_compat_columns.py`, profil, tenant support ve email
  branding gibi startup disina alinabilen uyumluluk kolonlarini
  tamamlar.
- `apply_runtime_quote_compat_columns.py`, quote/rfq ve supplier
  revision uyumluluk kolonlarini startup disina tasir.
- `apply_supplier_quote_price_rules_defaults.py`, supplier quote fiyat
  kural tablosunu ve varsayilan kural kaydini bootstrap akisinda
  hazirlar.
- `bootstrap_tenants.py --backfill-single-tenant` sadece
  veritabaninda tam olarak 1 tenant varsa backfill uygular; cok
  tenantli ortamlarda bilerek atlar.
- `backfill_single_tenant_scope.py` ayri operasyon ihtiyaci icin
  korunur, ama onerilen akis bootstrap uzerinden ilerlemektir.

## Runtime Bootstrap Flags

Uygulama startup'inda demo kullanici ve permission catalog seed'i artik varsayilan
olarak kapalidir. Sadece ihtiyac oldugunda environment flag ile acilmalidir:

```powershell
cd D:\Projects\procureflow
$env:PF_ENABLE_RUNTIME_DEMO_USERS = "true"
$env:PF_ENABLE_RUNTIME_PERMISSION_SEED = "true"
api\.venv\Scripts\python.exe -m api.main
```

Startup disinda ayni runtime patch + seed akisini manuel calistirmak icin:

```powershell
cd D:\Projects\procureflow
$env:PF_ENABLE_RUNTIME_DEMO_USERS = "true"
$env:PF_ENABLE_RUNTIME_PERMISSION_SEED = "true"
api\.venv\Scripts\python.exe -m api.scripts.bootstrap_runtime_defaults
```

Bootstrap zincirinin tek komutla dogrulandigi operasyon komutu:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\validate_runtime_bootstrap_chain.py
```

Quote legacy mirror kolonlarinin fiziksel drop asamasina hazir olup olmadigini
dogrulayan operasyon komutu:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_quote_mirror_drop_readiness.py \
  --output-json audit-quote-mirror-drop-readiness.json \
  --output-csv audit-quote-mirror-drop-readiness.csv
```

Readiness audit yesil ise fiziksel drop planini gormek veya uygulamak icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\drop_quote_legacy_mirror_columns.py
api\.venv\Scripts\python.exe api\scripts\drop_quote_legacy_mirror_columns.py --apply
```

Not:

- Production ve canli benzeri ortamlarda bu iki flag kapali kalmalidir.
- `bootstrap_runtime_defaults`, sirayla foundation kolonlari, compat kolonlari,
  quote/supplier compat kolonlari, supplier quote price rules defaults
  ve opsiyonel seed adimlarini calistirir.
- `validate_runtime_bootstrap_chain.py`, bootstrap zincirini
  calistirip kritik tablo/kolonlari dogrular; basarili durumda
  `VALIDATED_RUNTIME_BOOTSTRAP_CHAIN` yazdirir.
- `audit_quote_mirror_drop_readiness.py`, `quotes.user_id`,
  `quotes.amount` ve audit mirror alanlarinin canonical alanlarla
  hizasini raporlar; basarili durumda
  `QUOTE_LEGACY_MIRRORS_DROP_READY` yazdirir.
- `drop_quote_legacy_mirror_columns.py`, readiness audit basariliysa
  fiziksel drop SQL planini yazdirir; `--apply` ile `quotes.user_id`,
  `quotes.amount`, `quotes.created_by`, `quotes.updated_by` ve
  `quotes.deleted_by` kolonlarini dusurur.
- Permission catalog seed'i uzun vadede ayri bootstrap/seed komutundan
  calistirilmalidir; startup path'inde sadece gecis donemi uyumlulugu icin
  korunur.

## Role/System Role Audit

Gecis donemindeki role ve system_role tutarliligini denetlemek icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_role_system_role_consistency.py \
  --output-json audit-report.json \
  --output-csv audit-report.csv
```

Guvenli auto-fix adaylarini dry-run olarak gormek icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_role_system_role_consistency.py \
  --fix \
  --output-json audit-fix-preview.json \
  --output-csv audit-fix-preview.csv
```

Bu preview ciktisi artik `summary` blogu da icerir:

- hedeflenen `system_role` dagilimi
- uygulanacak fix tipi dagilimi
- etkilenecek toplam kayit sayisi

Acik ve guvenli system_role eslestirmelerini veritabanina uygulamak icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_role_system_role_consistency.py \
  --fix --apply \
  --output-json audit-fix-applied.json \
  --output-csv audit-fix-applied.csv
```

Quote approval alanlarindaki `required_role` /
`required_business_role` hizasini sadece dry-run olarak gormek icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_role_system_role_consistency.py \
  --fix-approvals \
  --output-json approval-fix-preview.json \
  --output-csv approval-fix-preview.csv
```

Quote approval mirror hizasini veritabanina uygulamak icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\audit_role_system_role_consistency.py \
  --fix-approvals --apply \
  --output-json approval-fix-applied.json \
  --output-csv approval-fix-applied.csv
```

## Quote Approval Final Faz Sirasi

Quote approval business-role gecisini sikilastirmadan once onerilen sira:

1. Role/system role genel raporunu alin.
2. Quote approval preview raporunu alin.
3. Gerekirse `--fix-approvals` dry-run sonucunu inceleyin.
4. Onaylandiginda `--fix-approvals --apply` ile mirror alanlarini hizalayin.
5. Ardindan
   `migrations/2026_04_14_finalize_quote_approval_business_role_transition.sql`
   migration'ini calistirin.

Bu final fazdan sonra:

- `required_business_role` ana kaynak olur.
- `required_role` nullable compatibility mirror olarak kalir.
- 2026-04-15 audit sonucu: `approval-transition-audit.json`
  raporunda `total_quote_approvals=6`,
  `quote_approvals_with_issues=0` ve
  `repair_preview.preview_rows=0` dogrulandi.

Ek not:

- `api/services/quote_approval_service.py` yeni approval kayitlarinda
  artik `required_role` yazmiyor; write-path canonical olarak
  `required_business_role` alanina daraltildi.
- Approval endpoint response'lari artik canonical-only calisir; aktif
  istemciler `required_business_role` ve
  `required_business_role_label` alanlarini kullanir.
- `migrations/2026_04_15_finalize_quote_approval_required_role_compat_cleanup.sql`
  DB icindeki `required_role` mirror alanini null'a cekerek bu alani
  fiziksel drop oncesi compatibility seviyesine indirir.

Approval `required_role` compatibility mirror temizligi icin hazirlik/audit komutu:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe `
  api\scripts\audit_quote_approval_required_role_cleanup.py `
  --output-json approval-required-role-cleanup.json `
  --output-csv approval-required-role-cleanup.csv
```

Audit yesil ise compatibility mirror alanini null'a cekmek icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe `
  api\scripts\audit_quote_approval_required_role_cleanup.py `
  --apply `
  --output-json approval-required-role-cleanup-applied.json `
  --output-csv approval-required-role-cleanup-applied.csv
```

Beklenen ciktilar:

- `APPROVAL_REQUIRED_ROLE_COMPAT_NOT_READY`: once approval audit/fix gerekli
- `APPROVAL_REQUIRED_ROLE_COMPAT_CLEANUP_READY`: mirror cleanup uygulanabilir
- `APPROVAL_REQUIRED_ROLE_COMPAT_CLEANED`: compatibility mirror null'a cekildi
- `APPROVAL_REQUIRED_ROLE_COMPAT_ALREADY_CLEAN`: cleanup daha once uygulanmis
- `APPROVAL_REQUIRED_ROLE_MIRROR_DROP_READY`: DB mirror alani tum
  kayitlarda temiz, sonraki breaking-change/drop fazi planlanabilir

Fiziksel kolon drop plani ve uygulamasi icin:

```powershell
cd D:\Projects\procureflow
api\.venv\Scripts\python.exe api\scripts\drop_quote_approval_required_role_column.py
api\.venv\Scripts\python.exe `
  api\scripts\drop_quote_approval_required_role_column.py `
  --apply
```

Beklenen ciktilar:

- `APPROVAL_REQUIRED_ROLE_DROP_PLAN_READY`: fiziksel drop uygulanabilir
- `APPROVAL_REQUIRED_ROLE_DROPPED`: kolon fiziksel olarak dusuruldu
- `APPROVAL_REQUIRED_ROLE_ALREADY_DROPPED`: post-cut dogrulamada kolon artik yok

Breaking-change/drop fazina gecmeden once kalan runtime call-site envanteri icin:

```powershell
cd D:\Projects\procureflow
type docs\release\approval-required-role-drop-preflight-2026-04-19.md
```

Public web multi-domain cutover paketinin operasyon referanslari:

- `infra/nginx/buyerasistans-multidomain.conf`
- `infra/cloudflare/redirect-rules.json`
- `infra/cloudflare/cache-rules.json`
- `docs/release/public-web-domain-cutover-2026-04-19.md`
- `web/src/components/PublicSeoManager.tsx`
- `web/public/robots.txt`
- `web/public/sitemap.xml`
- `web/public/sitemap-main.xml`

## Quote/RFQ Legacy Cleanup Final Faz

Quote -> RFQ gecisinin adapter ve scope refactorlari tamamlandiktan sonra son
legacy kolon temizligi icin referans plan dosyasi:

- `migrations/2026_04_15_quote_rfq_legacy_cleanup_plan.sql`

Bu plan dosyasi su sirayla kullanilmalidir:

1. Preflight sorgulari calistir ve `quotes.user_id`, `quotes.amount`
   ve supplier quote tenant zincirinde drift olmadigini dogrula.
1. Gerekirse mirror alignment update bloklarini uygula.
1. Uygulama katmaninda `created_by_id` ve `total_amount` tek canonical
   kaynak olarak kaldigindan emin ol.
1. Bu kontrollerden sonra
   `migrations/2026_04_15_finalize_quote_rfq_legacy_drop.sql`
   migration'ini uygula.

Not:

- `company_*` alanlari bu asamada drop adayi degil; RFQ snapshot
  alanlari olarak korunur.
- `created_by`, `updated_by`, `deleted_by` integer alanlari ayri audit
  sadelestirme fazinda ele alinmalidir.
- `api/routers/quotes.py` artik create/update/items write akislarinda
  dogrudan `user_id` ve `amount` yazmiyor; canonical write source
  `created_by_id` ve `total_amount` olarak daraltildi.
- 2026-04-15 audit sonucu:
  `audit-quote-rfq-legacy-cleanup.json` raporunda `quotes=23`,
  `supplier_quotes=20`, `issue_counts={}` ve
  `repair_preview.preview_rows=0` dogrulandi.

## Canli DB Toparlama Sirasi

14 Nisan 2026 itibariyla canli veritabani uzerinde dogrulanan guvenli
toparlama sirasi:

1. `api\scripts\apply_runtime_foundation_columns.py` ile eksik
  tenant/system_role kolonlarini ve tenant tablolarini olustur.
2. `audit_role_system_role_consistency.py --fix` ile system_role preview al.
3. Preview temizse `--fix --apply` ile acik ve guvenli system_role
  eslestirmelerini uygula.
4. `bootstrap_tenants.py --dry-run` ve sonra `--apply` ile aktif admin
  zincirinden tenant omurgasini kur.
5. Ortam tek tenantli legacy veri ise
  `bootstrap_tenants.py --backfill-single-tenant` ile kalan tenant_id
  alanlarini ayni akista doldur.
6. `audit_role_system_role_consistency.py --output-json`
  `audit-report-final.json --output-csv audit-report-final.csv` ile
  son dogrulamayi al.

Beklenen final durum:

- `users_with_issues = 0`
- `quote_approvals_with_issues = 0`

## Auth Payload Sozlesmesi

Tenant-SaaS gecisinde auth cevaplarinda rol alanlari asagidaki anlamla tasinir:

- `system_role`: platform ve tenant erisim sinirlarinin ana kaynagi.
- `business_role`: satin alma ve onay akislarindaki operasyonel rolun ana kaynagi.
- `role`: geriye uyumluluk icin korunan compatibility mirror.
  Mevcut istemciler ve eski token akislarini kirmaz.

Onerilen istemci onceligi:

1. Yetkilendirme ve ana workspace yonlendirmesi icin `system_role`
2. Operasyonel UI ve approval semantigi icin `business_role`
3. Sadece gecis uyumlulugu gerekiyorsa `role`

Ornek `POST /api/v1/auth/login` veya `GET /api/v1/auth/me` user payload'i:

```json
{
  "id": 1,
  "email": "admin@procureflow.dev",
  "role": "admin",
  "business_role": "admin",
  "system_role": "tenant_admin",
  "full_name": "Admin User",
  "department_id": 1,
  "organization_name": "ProcureFlow Test Company",
  "organization_logo_url": null,
  "workspace_label": "ProcureFlow Test Company Calisma Alani",
  "platform_name": "Buyera Asistans",
  "platform_domain": "buyerasistans.com.tr"
}
```

## Troubleshooting

### Backend Başlatma Sorunları

**ModuleNotFoundError: No module named 'api'*

- PYTHONPATH ayarını kontrol edin: `set PYTHONPATH=D:\Projects\procureflow`
- Venv'i aktifleştirdikten sonra uvicorn çalıştırın

**Database Connection Error*

- .env dosyasındaki DATABASE_URL'yi kontrol edin
- PostgreSQL servisinin çalıştığından emin olun

### Frontend Build Sorunları

**ESLint Errors*

- `npm run lint` çalıştırıp hataları düzeltin
- setState in useEffect hataları için useMemo kullanın

**TypeScript Errors*

- `npm run type-check` çalıştırın
- Tip hatalarını düzeltin

### Test Çalıştırma

**Backend Tests*

```powershell
cd D:\Projects\procureflow\api
.venv\Scripts\activate
pytest ../tests/ -v
```

**Frontend Tests

```powershell
cd D:\Projects\procureflow\web
npm test
```

### API Test

Backend başladıktan sonra:

- Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Email Service

SMTP bağlantı hatası alırsanız:

- Credentials'ları kontrol edin
- Network erişimini doğrulayın
- `smtp_test_tls.py` ile test edin
