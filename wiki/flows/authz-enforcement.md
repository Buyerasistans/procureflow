---
title: Authorization Enforcement Flow
owned_by: security+backend+frontend
last_verified_at: 2026-05-21
confidence: 0.71
stale_after_days: 10
source_files:
  - api/routers/auth.py
  - api/services/auth_service.py
  - web/src/components/PermissionGuard.tsx
  - web/src/components/RequirePermission.tsx
  - web/src/permissions.ts
---

# Authorization Enforcement Flow

## Amaç
Yetkilerin hem API hem UI seviyesinde tutarlı uygulanmasını sağlamak.

## Akış
1. Kullanıcı kimlik doğrular
2. Rol/izin seti yüklenir
3. UI guard görünürlüğü belirler
4. API final yetki kararını verir

## Kritik Kural
UI guard sadece UX katmanıdır; güvenlik kararı API’da zorunludur.
