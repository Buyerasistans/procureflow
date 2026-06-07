---
title: Public Content & SEO Domain
owned_by: growth+frontend
last_verified_at: 2026-06-07
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

## Bu PR'da ne değişti? (feat/strategic-partner-governance-redesign)

- `web/src/pages/PublicHomePage.tsx` ve ilgili CSS: stratejik
  ortak tasarımı kapsamında genel stil düzenlemeleri.
- `web/index.html`, `web/public/slider/Sunum_Slider.html`:
  public sayfa slider içeriği güncellendi.
- Davranış veya SEO metadata değiştirilmedi; görsel revizyon.

## TODO

- [ ] owner: growth, target_date: 2026-06-20, SEO KPI mapping ekle
- [ ] owner: frontend, target_date: 2026-06-20, locale fallback matrisi ekle
