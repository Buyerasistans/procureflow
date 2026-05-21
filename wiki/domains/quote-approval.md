---
title: Quote & Approval Domain
owned_by: backend+frontend
last_verified_at: 2026-05-21
confidence: 0.78
stale_after_days: 14
source_files:
  - api/routers/quote_router.py
  - api/routers/quotes.py
  - api/routers/approval_router.py
  - api/services/quote_service.py
  - api/services/quote_approval_service.py
  - api/services/quote_transition_service.py
  - web/src/pages/QuoteDetailPage.tsx
  - web/src/pages/QuoteListPage.tsx
  - web/src/components/SupplierQuotesGroupedView.tsx
  - web/src/services/quote.service.ts
  - web/src/services/quotes.service.ts
  - docs/quote-domain.md
---

# Quote & Approval Domain

## Sorumluluk
Teklif oluşturma, listeleme, detay görüntüleme, onaya gönderme, revize, tedarikçi cevapları ve geçiş kuralları.

## Ana Akışlar
1. Teklif oluşturma/güncelleme
2. Onaya gönderme
3. Onay/reddet/revize
4. Tedarikçi tekliflerinin karşılaştırılması
5. Seçilen tedarikçi üzerinden karar akışı

## API Katmanı
- Router düzeyi giriş: `quote_router.py`, `quotes.py`, `approval_router.py`
- İş kuralları: `quote_service.py`, `quote_approval_service.py`, `quote_transition_service.py`

## UI Katmanı
- Liste: `QuoteListPage.tsx`
- Detay: `QuoteDetailPage.tsx`
- Gruplanmış tedarikçi görünümü: `SupplierQuotesGroupedView.tsx`

## Durum Geçişleri (örnek)
Assumption: net state enum değerleri service dosyalarından teyit edilmelidir.
- draft -> pending_approval
- pending_approval -> approved | rejected | revision_requested
- revision_requested -> draft | pending_approval

## Riskler
- Geçiş kuralları backend/frontend arasında drift riski
- Yetki kontrollerinin UI’da görünür ama API’da eksik kalma riski
- Supplier quote seçimi sonrası ana teklifin durum senkronizasyon riski

## TODO
- [ ] owner: backend, target_date: 2026-05-24, state enum’larını kesinleştir
- [ ] owner: frontend, target_date: 2026-05-24, QuoteDetailPage aksiyon görünürlük matrisi ekle
- [ ] owner: qa, target_date: 2026-05-25, approval transition test senaryolarını wiki/flows’a bağla
