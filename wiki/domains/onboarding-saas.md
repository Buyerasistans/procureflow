---
title: Onboarding SaaS Domain
owned_by: backend+frontend
last_verified_at: 2026-05-21
confidence: 0.76
stale_after_days: 14
source_files:
  - api/routers/onboarding_router.py
  - api/routers/onboarding_saas.py
  - api/services/onboarding_saas_service.py
  - web/src/components/OnboardingSaaSWizard.tsx
  - web/src/pages/OnboardingPage.tsx
  - docs/tenant-saas-system-schema.md
---

# Onboarding SaaS Domain

## Sorumluluk
Tenant onboarding adımları, doğrulama, kurulum akışı ve başlangıç yapılandırmaları.

## Akış
1. Tenant başlangıç verisi
2. Adım adım wizard tamamlanması
3. Backend’de provisioning/iş kuralı uygulanması

## Riskler
- Wizard step sırası ile backend validasyonlarının mismatch olması
- Kısmi tamamlanan onboarding kayıtlarının temizlenmemesi

## TODO
- [ ] owner: product, target_date: 2026-05-25, step definition tablosu ekle
- [ ] owner: backend, target_date: 2026-05-25, onboarding fail/retry davranışını netleştir
