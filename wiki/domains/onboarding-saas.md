---
title: Onboarding SaaS Domain
owned_by: backend+frontend
last_verified_at: 2026-05-24
confidence: 0.82
stale_after_days: 14
source_files:
  - api/routers/onboarding_router.py
  - api/routers/onboarding_saas.py
  - api/services/onboarding_saas_service.py
  - web/src/components/OnboardingSaaSWizard.tsx
  - web/src/pages/OnboardingPage.tsx
  - docs/tenant-saas-system-schema.md
---

# Onboarding SaaS Domain

## Sorumluluk

Tenant onboarding adımları, doğrulama, kurulum akışı ve başlangıç yapılandırmaları.

## Akış

1. Tenant başlangıç verisi alınır.
2. Wizard adım adım tamamlanır.
3. Backend'de provisioning ve iş kuralları uygulanır.

## Bu PR'da ne değişti?

- Onboarding domain dosyası UTF-8'e normalize edildi ve domain coverage gate için güncellendi.
- `api/routers/onboarding_router.py`, `api/routers/onboarding_saas.py` ve `api/services/onboarding_saas_service.py` bu domainin backend kapsamı olarak teyit edildi.
- `web/src/components/OnboardingSaaSWizard.tsx` ve `web/src/pages/OnboardingPage.tsx` UI kapsamı olarak korunuyor.

## Etki analizi

- Onboarding runtime davranışında değişiklik yok.
- Wiki memory gate, bu PR'da dokunulan onboarding alanını güncel dokümantasyonla eşleştirecek.
- Türkçe karakterler dokümantasyonda doğru görüntülenecek.

## Risk/Rollback

- Risk düşük; değişiklik dokümantasyon ve encoding odaklı.
- Hatalı içerik tespit edilirse wiki commit'i `git revert` ile geri alınabilir.
- Runtime onboarding akışına migration veya servis davranışı değişikliği eklenmedi.

## Test notu

- `python tools/memory/lint_wiki.py`
- `python tools/memory/domain_coverage.py --base-ref origin/main`
- Wizard step sırası ve backend validasyonları için mevcut onboarding testleri ayrıca koşturulabilir.

## Riskler

- Wizard step sırası ile backend validasyonlarının mismatch olması
- Kısmi tamamlanan onboarding kayıtlarının temizlenmemesi

## TODO

- [ ] owner: product, target_date: 2026-05-25, step definition tablosu ekle
- [ ] owner: backend, target_date: 2026-05-25, onboarding fail/retry davranışını netleştir
