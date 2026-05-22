# ProcureFlow — Mimari Kurallar ve Proje Yapısı

## 1) Proje Özeti

**ProcureFlow** — Tedarik zinciri yönetimi için teklif (RFQ),
tedarikçi yönetimi, ve onay workflow'u sistemi.

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: FastAPI (Python) + SQLAlchemy ORM + PostgreSQL
- **Email**: SMTP (olimposyapi.com) SPF/DKIM/DMARC ile hardened
- **Auth**: JWT tokens + refresh tokens + magic links (tedarikçi)

Ek donusum referansi:

- Tenant-SaaS hedef mimarisi ve uygulama adimlari icin
  [TENANT_SAAS_TRANSFORMATION_PLAN.md](TENANT_SAAS_TRANSFORMATION_PLAN.md)
  dosyasini kullanin.

---

## 2) Dizin Yapısı ve Sorumlulukları

### 2.1 Backend: `/api`

``
api/
├── main.py                      # FastAPI app entry point
├── alembic/                     # Database migrations
│   ├── versions/                # Migration scripts (one per DB change)
│   └── env.py                   # Alembic config
├── core/                        # Shared configs
│   ├── config.py                # Settings (SMTP, JWT secrets, etc.)
│   ├── security.py              # JWT, password hashing
│   ├── deps.py                  # Dependency injection (get_db, get_current_user)
│   └── time.py                  # UTC timezone utilities
├── db/
│   └── session.py               # SQLAlchemy engine + SessionLocal
├── models/                      # SQLAlchemy ORM models
│   ├── _init_.py              # ✅ MUST import all models here for Alembic
│   ├── user.py                  # User, Role, Permission
│   ├── quote.py                 # Quote, QuoteItem, QuoteApproval
│   ├── supplier.py              # Supplier, SupplierUser, SupplierQuote, SupplierQuoteItem
│   ├── project.py               # Project, ProjectSupplier
│   ├── email_settings.py        # Email notification config
│   ├── logging_settings.py      # Logging config
│   ├── backup_settings.py       # Backup scheduling config
│   └── ... (others)
├── schemas/                     # Pydantic request/response validation
│   ├── _init_.py              # ✅ Export commonly used schemas
│   ├── quote.py
│   ├── supplier.py
│   ├── user.py
│   └── ... (others)
├── routers/                     # API endpoint handlers (∂ endpoints)
│   ├── health.py                # GET /health
│   ├── auth.py                  # POST /login, /refresh, /logout
│   ├── quotes.py                # Quote CRUD + status transitions
│   ├── supplier_router.py       # Supplier management
│   ├── supplier_response_router.py  # SupplierQuote submit/draft
│   ├── supplier_portal.py       # Supplier workspace view
│   ├── approval_router.py       # Approval workflow
│   ├── admin.py                 # Admin operations (user, role, settings)
│   ├── advanced_settings_router.py # Email/logging/backup settings
│   ├── settings_router.py       # Legacy settings (cleanup needed)
│   ├── user_profile_router.py   # User self-service endpoints
│   ├── files.py                 # File upload/download
│   ├── report_router.py         # Reports & exports
│   ├── contract_router.py       # Contract management
│   └── _init_.py
├── services/                    # Business logic (stateless, testable)
│   ├── email_service.py         # ✅ SMTP + hardened headers
(Date, Message-ID, plain+html)
│   ├── quote_service.py         # Quote state machine, revisions
│   ├── auth_service.py          # Login, refresh, token validation
│   ├── user_department_service.py # Department resolution
│   ├── sms_service.py           # SMS provider abstraction (noop by default)
│   └── __init__.py
├── dependencies/
│   └── authz.py                 # Role-based authorization rules
├── app/domain/                  # Domain-driven design layer
│   └── quote/
│       ├── policy.py            # Quote state transitions + domain events
│       └── enums.py             # QuoteStatus enum
├── scripts/                     # One-off admin utilities (not versioned)
│   ├── seed_admin.py
│   ├── reset_admin_password.py
│   └── ... (others)
├── uploads/                     # User-uploaded files (git-ignored)
├── database.py                  # SQLAlchemy Base + engine setup
├── requirements.txt             # pip dependencies
├── alembic.ini                  # Alembic config
└── _init_.py
``

### 2.2 Frontend: `/web`

``
web/
├── src/
│   ├── main.tsx                 # Vite entry point
│   ├── App.tsx                  # Root component + routing
│   ├── index.css
│   ├── App.css
│   ├── components/              # Reusable UI components
│   │   ├── sidebar/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── SupplierResponsePortal.tsx  # ✅ Supplier workspace tabs (3 states)
│   │   └── ... (others)
│   ├── pages/                   # Page/screen components
│   │   ├── Dashboard.tsx
│   │   ├── QuoteList.tsx
│   │   ├── QuoteDetail.tsx
│   │   ├── SupplierWorkspace.tsx
│   │   ├── AdminSettings.tsx
│   │   └── ... (others)
│   ├── routes/                  # Route definitions (if using routing lib)
│   ├── services/                # API client + hooks
│   │   ├── api.ts               # Axios/fetch configurations
│   │   ├── quoteService.ts
│   │   └── ... (others)
│   ├── hooks/                   # Custom React hooks
│   ├── context/                 # React Context (auth, theme, etc.)
│   ├── types/                   # TypeScript interfaces & types
│   ├── styles/                  # Global + util styles
│   ├── lib/                     # Utility libraries
│   ├── data/                    # Mock/seed data (for testing)
│   ├── auth/                    # Auth helpers (localStorage, token)
│   ├── assets/                  # Images, icons, fonts
│   └── test/                    # Component + integration tests
├── public/
│   └── index.html
├── vite.config.ts               # Vite build config
├── tsconfig.json
├── tailwind.config.js           # CSS utility framework (if used)
├── package.json
├── .gitignore
└── eslint.config.js             # ESLint rules
``

### 2.3 Root Level

``
procureflow/
├── api/                         # Backend (see 2.1)
├── web/                         # Frontend (see 2.2)
├── docs/                        # Documentation
│   ├── quote-domain.md          # Quote state machine design
│   ├── notifications-hardening.md  # Email deliverability notes
│   └── ... (other docs)
├── tests/                       # Integration tests (api + db)
│   ├── conftest.py              # pytest fixtures
│   ├── test_auth.py
│   ├── test_quotes.py
│   └── ... (others)
├── scripts/                     # Root-level one-off scripts (git-ignored)
│   └── ... (diagnostic, migration helpers)
├── .github/                     # GitHub Actions workflows
├── .vscode/                     # VS Code settings (workspace)
├── .env.example                 # ✅ Template (commit this, NOT .env)
├── .gitignore                   # ✅ See section 3
├── .pre-commit-config.yaml      # Pre-commit hook rules
├── .markdownlint.json           # Markdown linting rules
├── README.md                    # Getting started
├── ARCHITECTURE.md              # This file
├── pytest.ini                   # pytest configuration
└── requirements-lock.txt        # Locked dependency versions (pip freeze output)
``

---

## 3) Git Ignore Policy — Gereksiz Dosyalar

### 3.1 Neler Git'e Girilmemeli

| Kategori | Pattern | Açıklama |

|---|---|---|
| **IDE/Editor** | `.vscode/`, `.idea/`, `.idea/`, `*.swp`, `*.swo` | IDE-specific configs |
| **Python env** | `.venv/`, `venv/`, `env/`, `.mypy_cache/`, `.ruff_cache/` | Virtual environments & caches |
| **Python cache** | `__pycache__/`, `*.pyc`, `*.py[cod]` | Compiled bytecode |
| **Test outputs** | `.pytest_cache/`, `.coverage` | Test artifacts |
| **Web build** | `web/node_modules/`, `web/build/`, `web/dist/`, `web/.vite/`, `web/coverage/` | Build outputs |
| **Databases** | `*.db`, `test.db`, `procureflow.db`, `app.db` | Legacy SQLite artifacts (do not use as primary DB) |
| **Env secrets** | `.env`, `.env.local`, `.env.*.local` | Private credentials |
| **Temporary** | `/token.txt`, `/api_debug.log`, `/check_*.py`, `/debug_*.py`, `/create_*.py` | Diagnostic scripts |
| **Package locks (older)** | `package-lock.json`, `yarn.lock`, `Pipfile.lock` | Use one per project |
| **CSV/Excel temp** | `PİZZAMAX_TEKLİF_.csv` | Demo data |
| **Compiled/assets** | `.coverage/`, `htmlcov/` | Coverage reports |

### 3.2 Güncel `.gitignore` Kontrolü Listesi

```bash
# Run this to verify git config
cd d:\Projects\procureflow

# Show what would be ignored
git check-ignore -v $(find . -type f -o -type d | head -100)

# Confirm .venv/, __pycache__/, node_modules/ are ALL ignored
git status --porcelain
```

---

## 4) Mimari Prensipler

### 4.1 Katmanlar (Layered Architecture)

``
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (React/TypeScript)                              │
│  ├─ Pages (screens, routing)                            │
│  ├─ Components (reusable UI)                            │
│  ├─ Services (API client calls)                         │
│  └─ Hooks + Context (state management)                  │
├─────────────────────────────────────────────────────────┤
│ APIs (FastAPI Routers) — HTTP boundary                  │
│  ├─ Request validation (Pydantic schemas)              │
│  └─ Response serialization                             │
├─────────────────────────────────────────────────────────┤
│ BUSINESS LOGIC (Services)                               │
│  ├─ email_service.py (SMTP + headers hardening)        │
│  ├─ quote_service.py (state machine)                   │
│  ├─ auth_service.py (JWT, refresh tokens)              │
│  └─ user_department_service.py (dept resolution)       │
├─────────────────────────────────────────────────────────┤
│ DOMAIN LAYER (Optional DDD)                             │
│  ├─ app/domain/quote/policy.py (state rules)           │
│  ├─ app/domain/quote/enums.py (QuoteStatus enum)       │
│  └─ Domain events (QuoteStatusChanged)                 │
├─────────────────────────────────────────────────────────┤
│ ORM/Models (SQLAlchemy)                                 │
│  ├─ User, Role, Permission                             │
│  ├─ Quote, QuoteItem, QuoteApproval                    │
│  └─ Supplier, SupplierQuote, SupplierQuoteItem         │
├─────────────────────────────────────────────────────────┤
│ DATABASE (PostgreSQL)                                   │
│  └─ Migrations (alembic/versions/*)                    │
└─────────────────────────────────────────────────────────┘
``

### 4.2 Veri Akışı — Teklif Süreci Örneği

``
Admin → /api/v1/quotes (POST)
  ↓
[Router: quotes.py::create_quote()]
  ├─ Validate: QuoteCreate schema
  ├─ Permission:_ensure_admin(current_user)
  ├─ Logic: Quote model instantiate
  ├─ DB: db.add(quote) + db.commit()
  └─ Return: QuoteOut schema (serialize)
↓
Admin → /api/v1/quotes/{id}/submit (POST)
  ├─ Logic: QuoteService.submit_quote() — status: draft → sent
  ├─ Domain:_domain_events.append(QuoteStatusChanged(...))
  ├─ Email: email_service.send_new_quote_to_supplier()
  │   └─ Headers: Date, Message-ID, X-Mailer, Content-Language
  │   └─ Body: plain text + HTML multipart/alternative
  └─ Return: QuoteOut (updated status)
↓
Tedarikçi (SupplierUser) → /supplier/workspace
  ├─ Service: get_my_quotes() — fetch SupplierQuote list
  ├─ Frontend: SupplierResponsePortal.tsx (3 tabs)
  │   ├─ Bekleyen: status in [tasarı, revize_edildi]
  │   ├─ Gönderilen: status in [gönderilen, yanıtlandı]
  │   └─ Kapanmış: status in [reddedildi, kapatıldı_yüksek_fiyat]
  └─ UI: 3 tab buttons + conditional rendering
↓
Tedarikçi → /supplier-quotes/{id}/submit (POST)
  ├─ Validation: SupplierQuoteSubmit schema
  ├─ Logic: QuoteService.submit_supplier_quote()
  │   ├─ Price rules check (min/max % tolerance)
  │   ├─ SupplierQuote.status: tasarı → gönderilen
  │   ├─ Save initial_final_amount (reference for revisions)
  │   └─ revision_number = 0
  ├─ Email: email_service.send_supplier_response_to_admin()
  │   └─ Headers: [same hardening]
  │   └─ Body: [plain + html with amount, discount, delivery info]
  └─ Return: SupplierResponseOut
↓
Admin → /api/v1/quotes/{id}/request-revision/{supplier_quote_id}?reason=... (POST)
  ├─ Logic: QuoteService.request_quote_revision()
  │   ├─ SupplierQuote.status: gönderilen → revize_edildi
  │   ├─ revision_number += 1
  │   └─ Persist reason (returned in email template)
  ├─ Email: email_service.send_revision_request_to_supplier()
  │   └─ Headers + Body: [same multipart structure]
  │   └─ Template: Revision reason in red box, call-to-action button
  └─ Return: result
↓
Tedarikçi → /supplier-quotes/{id}/submit (again)
  ├─ Service: detect revision_number > 0
  ├─ Update SupplierQuote values + submitted_at
  ├─ SupplierQuote.status: revize_edildi → yanıtlandı
  ├─ Email: email_service.send_supplier_response_to_admin()
  │   └─ Template: "🔄 Revize Teklifi Alındı — 1. Revize"
  └─ Return: SupplierResponseOut
↓
Admin → /api/v1/quotes/{id}/approve (POST)
  ├─ Logic: check_version_collision (optimistic locking)
  ├─ Quote.status: sent/submitted → approved
  ├─ For each SupplierQuote where supplier_id != selected:
  │   └─ SupplierQuote.status: * → kapatıldı_yüksek_fiyat
  ├─ Event: QuoteStatusChanged (approved, ...)
  └─ Return: QuoteOut (updated)
``

### 4.3 Durum Makinesi Kuralları (State Machine)

**Quote (main teklif)

| From | To | Kurallar |

|---|---|---|
| draft | sent | Admin `submit` (zorunlu)  |
| sent | approved | Admin `approve` (admin-only) |
| sent | rejected | Admin `reject` (admin-only) |
| approved |*| Bloklı (terminal state) |
| rejected |*| Bloklı (terminal state) |

**SupplierQuote (tedarikçi yanıtları)

| From | To | Kurallar |

|---|---|---|
| tasarı | gönderilen | Tedarikçi `submit` (fiyat + kalemler gerekli) |
| gönderilen | revize_edildi | Admin `request-revision` (reason gerekli) |
| revize_edildi | yanıtlandı | Tedarikçi `submit` (yeni fiyatlar) |
| gönderilen | kapatıldı_yüksek_fiyat | Otomatik (Quote.approve → other suppliers)|
| * | reddedildi | Otomatik (Quote.reject → all suppliers) |

**Geçersiz Geçişler → HTTP 422

```python
# api/routers/quotes.py
_ensure_transition(row.status, {"sent"})  # Only from 'sent' allowed
```

### 4.4 Email Hardening — DNS + SMTP + Headers

**DNS Records (gerekli):**

- SPF: `v=spf1 a mx ip4:213.238.191.177 -all`
- DKIM: `default._domainkey TXT v=DKIM1; p=MIIBIjA...` (public key)
- DMARC: `_dmarc TXT v=DMARC1; p=quarantine; adkim=s; aspf=s; rua=...`
- PTR: `177.191.238.213 → mail.olimposyapi.com`

**Code Rules (email_service.py):**

```python

msg["Date"] = formatdate(localtime=True)
msg["Message-ID"] = make_msgid(domain="olimposyapi.com")
msg["X-Mailer"] = "ProcureFlow"
msg["Content-Language"] = "tr-TR"

# Multipart: plain text FIRST, then HTML (spam filters prefer text)
msg.attach(MIMEText(plain_body, "plain", "utf-8"))
msg.attach(MIMEText(html_body, "html", "utf-8"))
```

**Subject Line Consistency:**

```python
# All transactional emails MUST have [ProcureFlow] prefix
"[ProcureFlow] New Quote: Teklifim-001"
"[ProcureFlow] Revision Request (2nd Revision): Teklifim-001"
"[ProcureFlow] Quote Response: Admin Notification"
```

**Result:** Mail-tester score ≥ 8.5/10 (SPF PASS, DKIM PASS, DMARC PASS)

### 4.5 Sorumluluk Ayrılığı (Separation of Concerns)

| Layer | Sorumluluk | NOT Sorumluluk |

|---|---|---|
| **Router** | HTTP validation, auth check, response decoration | Business logic,
DB queries |
| **Service** | State transitions, email templates, price rules | Database I/O
(directly) |
| **Domain** | State rules, event definitions | Implementation, Framework |
| **Model** | ORM mapping, relationships, schema | Business rules (move to
Service) |
| **Form/Schema** | Pydantic validation, serialization | Domain logic |

---

## 5) Code Organization — Dosya Adlandırması Kuralları

### 5.1 Backend

- **Routers**: domain-odakli dosya adlari kullanilir (e.g., `quotes.py`, `supplier_router.py`)
  - Exception: Health check → `health.py`, Auth → `auth.py`
- **Services**: `<domain>_service.py` (e.g., `email_service.py`, `quote_service.py`)
- **Models**: `<entity>.py` (e.g., `user.py`, `quote.py`, `supplier.py`)
- **Schemas**: `<domain>.py` inside `schemas/` (e.g., `schemas/quote.py`)
- **Scripts**: Root-level one-offs → `.gitignore`'d (e.g., `reset_admin_password.py`)

### 5.2 Frontend

- **Components**: PascalCase, `.tsx` (e.g., `SupplierResponsePortal.tsx`, `QuoteList.tsx`)
- **Pages**: PascalCase, `.tsx` (e.g., `Dashboard.tsx`, `AdminSettings.tsx`)
- **Services**: camelCase, `.ts` (e.g., `quoteService.ts`, `authService.ts`)
- **Hooks**: Prefix `use`, camelCase, `.ts` (e.g., `useAuth.ts`, `useQuotes.ts`)
- **Types**: `.ts` in `types/` folder (e.g., `types/quote.ts`, `types/supplier.ts`)

---

## 6) Testing Policy

### 6.1 Backend Tests

```bash
# Location: tests/
pytest tests/ --cov=api --cov-report=html
```

- **test_auth.py** — Login, refresh tokens, JWT validation
- **test_quotes.py** — Quote CRUD, state transitions, status history
- **test_supplier_response.py** — SupplierQuote submit, revisions, price rules
- **conftest.py** — Fixtures: client, auth_headers, db_session

### 6.2 Frontend Tests

```bash
# Location: web/src/test/
npm run test
```

- Component snapshot tests (Vitest/Jest)
- Integration tests (React Testing Library)
- Mock API responses

---

## 7) Deployment Checklist

- [ ] `.env` file with real SMTP credentials (NOT in git)
- [ ] `.env.example` committed with placeholder values
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Frontend build: `npm run build` → `web/dist/`
- [ ] Backend requirements locked: `pip freeze > requirements-lock.txt`
- [ ] Pre-commit hooks installed: `pre-commit install`
- [ ] Linter clean: `ruff check api/ && eslint web/src/`
- [ ] Tests passing: `pytest tests/ -v`
- [ ] SPF/DKIM/DMARC records published (DNS)
- [ ] PTR record configured (hosting provider)

---

## 8) Kurallar Özeti

### ✅ DO

- ✅ Commit `.env.example` with dummy values
- ✅ Use `formatdate()` + `make_msgid()` in ALL email sends
- ✅ Multipart emails: plain text + HTML (in that order)
- ✅ HTTP 422 for invalid state transitions
- ✅ `_ensure_admin()` / `_ensure_owner()` guards in routers
- ✅ Organize routes by domain (supply, approval, reporting)
- ✅ Mock email service in tests
- ✅ Store `initial_final_amount` for revision tracking
- ✅ Use SQLAlchemy relationships (one-to-many, many-to-many)

### ❌ DON'T

- ❌ Store `.env` or `app.db` in git
- ❌ Inline SQL queries (use ORM)
- ❌ Business logic in routers (move to services)
- ❌ Send emails without Message-ID header
- ❌ Mix state logic with ORM (use domain/policy.py)
- ❌ Hardcode role names (use enums or config)
- ❌ Skip version collision check on state transitions
- ❌ Use `print()` instead of `logger.info()`

---

## 9) Geçiş Notları (Legacy)

| Obsolete | Replacement | Status |

|---|---|---|
| Legacy quote router | `quotes.py` | ✅ Consolidated |
| `settings_router.py` | `advanced_settings_router.py` | Consolidate |
| Direct `EmailMessage()` in routers | Use `email_service` | ✅ Done |
| `schemas.py` (root) | `schemas/<domain>.py` | ✅ Migrated |
| `database.py` legacy | `db/session.py` + `core/config.py` | ✅ Updated |

---

**Son Güncelleme:** 4 Nisan 2026  
**Dökümantasyon Sürümü:** 1.0
