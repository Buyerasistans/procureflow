---
title: Auth & Permission Domain
owned_by: backend+frontend
last_verified_at: 2026-06-05
confidence: 0.74
stale_after_days: 14
source_files:
  - api/routers/auth.py
  - api/services/auth_service.py
  - web/src/components/PermissionGuard.tsx
  - web/src/components/RequirePermission.tsx
  - web/src/permissions.ts
  - web/src/services/auth.service.ts
---

# Auth & Permission Domain

## Sorumluluk
Kimlik doğrulama, oturum, rol/izin tabanlı erişim kontrolü.

## Ana Bileşenler
- Backend auth endpointleri
- Frontend route/component guard’ları
- Permission sabitleri ve kullanım noktaları

## Kritik Noktalar
- UI guard bypass edilse bile API zorunlu yetki kontrolü yapmalı
- Token yenileme / session timeout akışı net dokümante edilmeli

## Riskler
- Permission enum adları backend/frontend uyumsuzluğu
- Sadece frontend guard’a güvenilmesi

## TODO
- [ ] owner: backend, target_date: 2026-05-24, endpoint bazlı izin matrisi çıkar
- [ ] owner: frontend, target_date: 2026-05-24, protected route envanterini güncelle
