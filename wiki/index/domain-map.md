---
title: Domain Map
owned_by: platform
last_verified_at: 2026-05-21
confidence: 0.90
stale_after_days: 14
source_files:
  - api/routers
  - api/services
  - web/src/pages
  - web/src/components
  - docs/quote-domain.md
  - docs/mimari-kurallar.md
---

# Domain Map

Bu sayfa, repo içindeki ana domainleri ve temel giriş dosyalarını listeler.

## 1) Quote & Approval
- Backend Routers:
  - `api/routers/quote_router.py`
  - `api/routers/quotes.py`
  - `api/routers/approval_router.py`
- Backend Services:
  - `api/services/quote_service.py`
  - `api/services/quote_approval_service.py`
  - `api/services/quote_transition_service.py`
- Frontend:
  - `web/src/pages/QuoteDetailPage.tsx`
  - `web/src/pages/QuoteListPage.tsx`
  - `web/src/components/SupplierQuotesGroupedView.tsx`
  - `web/src/services/quote.service.ts`
  - `web/src/services/quotes.service.ts`
- Domain page: `wiki/domains/quote-approval.md`

## 2) Auth & Permission
- Backend:
  - `api/routers/auth.py`
  - `api/services/auth_service.py`
- Frontend:
  - `web/src/components/PermissionGuard.tsx`
  - `web/src/components/RequirePermission.tsx`
  - `web/src/permissions.ts`
  - `web/src/services/auth.service.ts`
- Domain page: `wiki/domains/auth-permission.md`

## 3) Onboarding SaaS
- Backend:
  - `api/routers/onboarding_router.py`
  - `api/routers/onboarding_saas.py`
  - `api/services/onboarding_saas_service.py`
- Frontend:
  - `web/src/components/OnboardingSaaSWizard.tsx`
  - `web/src/pages/OnboardingPage.tsx`
- Domain page: `wiki/domains/onboarding-saas.md`

## 4) Payment & Billing
- Backend:
  - `api/routers/payment.py`
  - `api/routers/payment_admin.py`
  - `api/routers/billing_router.py`
  - `api/services/billing_service.py`
  - `api/services/subscription_service.py`
  - `api/services/payment/`
- Frontend:
  - `web/src/services/payment.service.ts`
- Domain page: `wiki/domains/payment-billing.md`

## 5) Supplier Portal
- Backend:
  - `api/routers/supplier_portal.py`
  - `api/routers/supplier_router.py`
  - `api/routers/supplier_response_router.py`
- Frontend:
  - `web/src/pages/SupplierPortalPage.tsx`
  - `web/src/pages/SupplierWorkspacePage.tsx`
  - `web/src/pages/SupplierDashboard.tsx`
  - `web/src/components/SupplierResponsePortal.tsx`
- Domain page: `wiki/domains/supplier-portal.md`

## 6) Admin Governance
- Backend:
  - `api/routers/admin.py`
  - `api/routers/admin_deployment.py`
  - `api/routers/advanced_settings_router.py`
- Frontend:
  - `web/src/pages/admin/*`
  - `web/src/components/admin/*`
- Domain page: `wiki/domains/admin-governance.md`

## 7) Public Content & SEO
- Backend:
  - `api/routers/public_assets.py`
  - `api/routers/public_locale.py`
  - `api/routers/public_showcase.py`
  - `api/routers/public_telemetry.py`
  - `api/routers/public_translations.py`
- Frontend:
  - `web/src/pages/PublicHomePage.tsx`
  - `web/src/pages/PricingPage.tsx`
  - `web/src/components/PublicSeoManager.tsx`
  - `web/src/components/PublicTelemetryManager.tsx`
- Domain page: `wiki/domains/public-content-seo.md`
