---
title: Admin Governance Domain
owned_by: platform
last_verified_at: 2026-06-07
confidence: 0.84
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

## Sorumluluk

Admin governance alanı; yönetici panelleri, yetki sınırları, tenant yönetimi ve operasyonel kontrolleri kapsar.

## Ana akışlar

- Admin kullanıcısı ilgili panele girer.
- Sistem izinleri ve tenant kapsamını doğrular.
- Yönetim aksiyonları kayıt altına alınır.
- Gerekirse ilgili alt bileşenler veya API uçları tetiklenir.

## Bu PR'da ne değişti? (feat/strategic-partner-governance-redesign)

- `web/src/pages/admin/StrategicPartnerGovernance.tsx`: Az sayıda satır olduğunda origin grupları (direct/channel/supplier) otomatik açılır; accordion UX iyileştirmesi.
- `web/src/pages/admin/PersonnelTab.tsx`: Durum butonuna `aria-label` eklendi — erişilebilirlik ve test tutarlılığı.
- `web/src/components/admin/DeploymentPanel.tsx`, `WorkspacePanelDesignerTab.tsx`: Stratejik partner governance yeniden tasarımı kapsamında güncellendi.
- `api/routers/admin_deployment.py`: Deployment yönetimi router güncellendi.
- Test dosyaları (admin-governance domain): accordion genişletme adımları tüm test senaryolarına eklendi.

## Etki analizi

- Stratejik partner governance UI'ı artık küçük veri setlerinde grupları otomatik açarak UX geliştiriyor.
- Accordion mantığı `rows.length <= 5` eşiğiyle yalnızca az satırlı görünümleri etkiliyor.
- 317 test tümü geçiyor; mevcut admin panel davranışı veya yetki matrisi değiştirilmedi.

## Risk/Rollback

- Risk düşük; UI iyileştirme ve erişilebilirlik odaklı.
- Accordion auto-expand kaldırılmak istenirse `useEffect` bloğu temizlenir.

## Test notu

- `npx vitest run` → 317/317 geçti.
- `python tools/memory/domain_coverage.py --base-ref origin/main`

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
