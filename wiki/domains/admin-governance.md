---
title: Admin Governance Domain
owned_by: platform
last_verified_at: 2026-05-21
confidence: 0.80
stale_after_days: 14
source_files:
  - api/routers/admin.py
  - api/routers/admin_deployment.py
  - api/routers/advanced_settings_router.py
  - api/routers/support_ticket_router.py
  - api/routers/mail_center_router.py
  - api/routers/system_email_router.py
  - web/src/pages/AdminPage.tsx
  - web/src/pages/AdminQuoteManagementPage.tsx
  - web/src/pages/admin
  - web/src/components/admin
---


# Admin Governance Domain

- owned_by: backend+frontend
- last_verified_at: 2026-05-21
- confidence: 0.72
- stale_after_days: 14

## Sorumluluk

Admin governance alanı; yönetici panelleri, yetki sınırları, tenant yönetimi
ve operasyonel kontrolleri kapsar.

## Ana akışlar

- Admin kullanıcısı ilgili panele girer.
- Sistem izinleri ve tenant kapsamını doğrular.
- Yönetim aksiyonları kayıt altına alınır.
- Gerekirse ilgili alt bileşenler veya API uçları tetiklenir.

## Kritik durumlar

- Yetkisiz erişim denemeleri
- Tenant sınırının aşılması
- Eksik veya tutarsız konfigürasyon
- Operasyonel aksiyonların geri alınması gereken durumlar

## API uçları

- Admin paneli için kullanılan yönetim endpointleri
- Tenant governance işlemleri için backend router'ları
- Yetki ve erişim kontrolleri için yardımcı uçlar

## UI ekranları

- Admin ana sayfası
- Tenant governance sekmeleri
- Operasyon ve bakım panelleri
- İzin ve rol yönetimi görünümleri

## Riskler

- Yanlış yetkilendirme
- Tenant verilerinin karışması
- Yönetim aksiyonlarının doğrulanmadan çalışması
- UI ile API arasında izin uyumsuzluğu

## Açık sorular

- Hangi admin aksiyonları audit log'a zorunlu yazılmalı?
- Tenant governance için tek kaynak hangi modülde tutulmalı?
- Bazı panellerin yalnızca belirli roller için görünmesi gerekiyor mu?
