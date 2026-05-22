---
title: Public Content & SEO Domain
owned_by: growth+frontend
last_verified_at: 2026-05-21
confidence: 0.72
stale_after_days: 21
source_files:
  - api/routers/public_assets.py
  - api/routers/public_locale.py
  - api/routers/public_showcase.py
  - api/routers/public_telemetry.py
  - api/routers/public_translations.py
  - web/src/pages/PublicHomePage.tsx
  - web/src/pages/PricingPage.tsx
  - web/src/components/PublicSeoManager.tsx
  - web/src/components/PublicTelemetryManager.tsx
---

# Public Content & SEO Domain

## Sorumluluk
Public sayfalar, SEO yönetimi, telemetry ve localization.

## Ana Konular
- Public içerik servisleri
- SEO metadata yönetimi
- Telemetry sinyalleri
- Çok dilli içerik

## Riskler
- Locale fallback hataları
- SEO metadata drift
- Telemetry event şema tutarsızlığı

## TODO
- [ ] owner: growth, target_date: 2026-05-27, SEO KPI mapping ekle
- [ ] owner: frontend, target_date: 2026-05-27, locale fallback matrisi ekle
