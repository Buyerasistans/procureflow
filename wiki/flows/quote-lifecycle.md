---
title: Quote Lifecycle Flow
owned_by: backend+frontend
last_verified_at: 2026-05-21
confidence: 0.73
stale_after_days: 10
source_files:
  - api/services/quote_service.py
  - api/services/quote_approval_service.py
  - api/services/quote_transition_service.py
  - api/routers/quote_router.py
  - api/routers/approval_router.py
  - web/src/pages/QuoteDetailPage.tsx
---

# Quote Lifecycle Flow

## Amaç
Teklifin draft aşamasından onay/ret/revizyona kadar yaşam döngüsünü takip etmek.

## Akış Adımları
1. Draft oluşturulur/güncellenir
2. Onaya gönderilir
3. Onaycı aksiyon alır (approve/reject/revise)
4. Gerekirse revize edilip tekrar onaya gider
5. Tedarikçi seçimi ve kapanış adımları

## Kontroller
- Her geçişte yetki kontrolü
- Geçersiz geçişlerin backend’de engellenmesi
- UI’da aksiyon butonlarının role/state bazlı görünmesi

## Test Notları
- Geçersiz state transition testleri
- Read-only kullanıcı davranışları
- Revize sonrası tekrar onaya gönderim

## Bağlantılar
- Domain: `wiki/domains/quote-approval.md`
- ADR: `wiki/adr/adr-0001-memory-model.md`
