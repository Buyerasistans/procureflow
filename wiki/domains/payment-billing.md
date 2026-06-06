---
title: Payment & Billing Domain
owned_by: backend+finance
last_verified_at: 2026-06-05
confidence: 0.70
stale_after_days: 10
source_files:
  - api/routers/payment.py
  - api/routers/payment_admin.py
  - api/routers/billing_router.py
  - api/services/billing_service.py
  - api/services/subscription_service.py
  - api/services/payment
  - web/src/services/payment.service.ts
---

# Payment & Billing Domain

## Sorumluluk
Ödeme işlemleri, abonelik, faturalama ve admin finans operasyonları.

## Akış
1. Ödeme niyeti/işlem başlatma
2. Sonuç doğrulama
3. Abonelik durum güncelleme
4. Faturalama yansıması

## Riskler
- Webhook ve manuel admin aksiyonları arasında yarış durumu
- Subscription state drift
- Finansal reconciliation eksikliği

## TODO
- [ ] owner: backend, target_date: 2026-05-24, webhook idempotency notu ekle
- [ ] owner: finance, target_date: 2026-05-26, reconciliation checklist bağla
