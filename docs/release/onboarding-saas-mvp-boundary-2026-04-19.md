# Onboarding SaaS MVP Siniri - 2026-04-19

Bu not,
[api/models/onboarding_saas.py](api/models/onboarding_saas.py) ve
[api/routers/onboarding_saas.py](api/routers/onboarding_saas.py)
uzerindeki kapsam sinirini netlestirir.

## Simdi Cikacak

- Tenant tipi ve subscription tier kataloglari
  - Public okuma yuzeyi korunur.
  - Amac: fiyatlandirma, onboarding studio ve public pricing akislari icin tek kaynak.
- Premium feature katalog okuma ve tenant aktivasyon omurgasi
  - Katalog listesi ve tenant bazli aktif feature okuma/yazma MVP icinde kalir.
  - Gercek odeme orkestrasyonu olmadan da admin/demo operasyonu destekler.
- Trial status ve tenant trial donemi takibi
  - Trial durumunun okunmasi ve trial period kaydi MVP icinde kalir.
  - SaaS plan/limit katmaninin temel kaniti olarak gereklidir.
- Business partner komisyon okuma ve rapor yuzeyi
  - Okuma raporu ve super-admin bonus guncelleme akisi operasyonel
    MVP kapsamina dahildir.

## Sonra Cikacak

- Kart dogrulama islemlerinin gercek provider entegrasyonu
  - [api/models/onboarding_saas.py](api/models/onboarding_saas.py)
    icindeki card verification transaction modeli korunur.
  - Ancak capture/refund lifecycle'i simdilik release kapisi degildir.
- Business partner ledger derinlestirmesi
  - Ledger schema ve ileri seviye komisyon dagitim kurallari sonraki faza kalir.
- Premium feature billing otomasyonu
  - Aktivasyon var, fakat otomatik faturalama / tahsilat / iptal
    senaryolari sonraki sertlestirme fazina aittir.
- Channel ve partner urunlestirmesi
  - Channel scope ve is ortagi programinin tam urunlestirilmesi bu
    sprintte bilerek ertelenmistir.

## Router Siniri

- Kalacak endpoint gruplari:
  - tenant-types
  - tenant-type tiers
  - premium-features
  - tenant premium feature list/activate
  - trial-status
  - business-partner commissions/report
  - admin catalog endpoints
- Sonraya birakilan davranislar:
  - payment provider callback/capture/refund gercek akisi
  - onboarding icinde muhasebesel ledger kapanisi
  - kapsamli partner campaign automation

## MVP Karari

- Bu modul release oncesi kaldirilacak aday degildir.
- Ancak odeme saglayicisi derinligi, ledger detaylari ve channel
  urunlestirmesi GO/NO-GO kapisinda zorunlu kriter sayilmaz.
