---
title: Supplier Portal Domain
owned_by: backend+frontend
last_verified_at: 2026-06-05
confidence: 0.75
stale_after_days: 14
source_files:
  - api/routers/supplier_portal.py
  - api/routers/supplier_router.py
  - api/routers/supplier_response_router.py
  - web/src/pages/SupplierPortalPage.tsx
  - web/src/pages/SupplierWorkspacePage.tsx
  - web/src/pages/SupplierDashboard.tsx
  - web/src/components/SupplierResponsePortal.tsx
---

# Supplier Portal Domain

## Sorumluluk
Tedarikçi girişleri, teklif cevaplama, portal deneyimi ve dashboard.

## Ana Akış
1. Supplier authentication
2. RFQ/quote response
3. Portal üzerinden durum takibi

## Riskler
- Tedarikçi şirket/tenant izolasyon hataları
- Response revizyonlarının ana quote ile senkron olmaması

## TODO
- [ ] owner: backend, target_date: 2026-05-25, tenant izolasyon kontrol noktaları ekle
- [ ] owner: qa, target_date: 2026-05-26, supplier response regression senaryosu bağla
