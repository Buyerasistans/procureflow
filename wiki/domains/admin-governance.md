---
title: Admin Governance Domain
owned_by: platform
last_verified_at: 2026-05-24
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

## Bu PR'da ne değişti?

- `api/routers/admin.py` içinde proje dosyası listeleme/silme metinleri UTF-8'e normalize edildi.
- `web/src/components/admin` ve `web/src/pages/admin` kapsamındaki yönetim ekranları bu domain gate'ini tetikleyen dosyalar arasında kalıyor.
- Agent guard, CODEOWNERS ve wiki memory akışı admin governance değişikliklerinin PR'da izlenmesini sürdürüyor.

## Etki analizi

- Kullanıcıya dönen hata/detail metinleri Türkçe karakterleri doğru gösterecek.
- Admin panel davranışı veya yetki matrisi değiştirilmedi.
- Wiki gate açısından admin governance dokümantasyonu güncel değişiklikle yeniden hizalandı.

## Risk/Rollback

- Risk düşük; değişiklik metin ve dokümantasyon odaklı.
- Beklenmeyen encoding drift görülürse encoding commit'i `git revert` ile geri alınabilir.
- Admin router davranışı değişmediği için runtime rollback gerektirmesi beklenmez.

## Test notu

- `python tools/memory/domain_coverage.py --base-ref origin/main`
- `python tools/memory/check_pr_wiki_gate.py`
- Admin dosya endpointleri için mevcut authorization testleri etkilenmemelidir.

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
