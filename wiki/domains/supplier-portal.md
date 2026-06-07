---
title: Supplier Portal Domain
owned_by: backend+frontend
last_verified_at: 2026-06-07
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

## Bu PR'da ne değişti? (feat/strategic-partner-governance-redesign)

- `api/routers/supplier_portal.py`: stratejik partner governance
  yeniden tasarımı kapsamında güncellendi.
- `web/src/pages/Supplier*`: supplier personal profil sayfası
  güvenlik düzeltmesi — telefon href sanitasyonu (CodeQL fix).
- Tedarikçi teklif akışı (`tedarikci_teklif@`) dokunulmadı.

## TODO

- [ ] owner: backend, target_date: 2026-06-20,
  tenant izolasyon kontrol noktaları ekle
- [ ] owner: qa, target_date: 2026-06-20,
  supplier response regression senaryosu bağla
