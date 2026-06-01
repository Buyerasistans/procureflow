# ProcureFlow - AI Çalışma Rehberi

Bu dosya, yeni bir oturumda projeyi hızlı ve doğru anlamak için kısa mimari hafıza sağlar.

## 1) Proje Yapısı

- `web/`: React + TypeScript + Vite frontend
- `api/`: FastAPI + SQLAlchemy backend
- `migrations/`: veritabanı migration dosyaları
- `docs/`: operasyon ve release dokümantasyonu
- `scripts/`: yardımcı scriptler

## 2) Çalışma İlkesi

1. Akışı bozma: mevcut işleyişi koruyarak ilerle.
2. Değişiklikleri dar kapsamlı tut.
3. Önce hata/fonksiyonel kırılma, sonra görsel iyileştirme.
4. Türkçe karakter ve encoding tutarlılığına dikkat et (UTF-8).

## 3) Domain Kurgusu (özet)

- `buyerasistans.com.tr`: TR ana akış
- `buyerasistans.com`: global/universal akış
- `buyerasistans.info`: bilgi/yardım merkezi odaklı yüzey
- `buyerasistans.online`: kampanya/demo odaklı yüzey

## 4) Öncelikli Teknik Riskler

Frontend build başarılı olsa da lint sorunları mevcut:

- React hook kuralları:
  - `react-hooks/set-state-in-effect`
  - `react-hooks/purity` (`Date.now()` render içinde)
- TypeScript kalite:
  - `@typescript-eslint/no-explicit-any`
  - `@typescript-eslint/no-unused-vars`
- React refresh / memoizasyon:
  - `react-refresh/only-export-components`
  - `react-hooks/preserve-manual-memoization`

## 5) Kesinleşen Rol Katalogu (v2 — 2026-05-25)

### Platform Rolleri (merkezi, tenant bağımsız)

- Super Admin `superadmin@buyerasistans.com.tr` — DOKUNMA
- Platform Operasyon Admin `operasyon_admin@`
- Platform Operasyon Yöneticisi `operasyon_yoneticisi@`
- Platform Operasyon Uzmanı `operasyon_uzmani@`
- Platform Destek Admin `destek_admin@`
- Platform Destek Yöneticisi `destek_yoneticisi@`
- Platform Destek Uzmanı `destek_uzmani@`
- Platform Finans Admin `finans_admin@`
- Platform Finans Yöneticisi `finans_yoneticisi@`
- Platform Finans Uzmanı `finans_uzmani@`
- Platform Denetçi / Finans İzleyici `finans_izleyici@`
- Platform Güvenlik Uzmanı `guvenlik_uzmani@`
- Platform Raporlama Analisti `raporlama_analisti@`

### Stratejik Partner Rolleri (Lvl 0→9 + özel)

- Lvl 0: Partner Admin `firma_admin@` / `[firma]_admin@`
- Lvl 1: Satın Alma Direktörü `firma_direktor@`
- Lvl 2: Satın Alma Müdürü `firma_mudur@`
- Lvl 3: Satın Alma Müdür Yardımcısı `firma_mudur_yrd@`
- Lvl 4: Satın Alma Yöneticisi `firma_yonetici@`
- Lvl 5: Satın Alma Kıdemli Uzmanı `firma_kidemli_uzm@`
- Lvl 6: Satın Alma Uzman Yardımcısı `firma_uzman_yrd@`
- Lvl 7: Satın Alma Uzmanı `firma_uzman@`
- Lvl 8: Proje Mimarı `firma_mimar@`
- Lvl 9: Teknik Uzman `firma_teknik@`
- Lvl ★: Özel Stratejik Partner Rolü `firma_ozel@`
- Lvl ★: Finans İzleyici `firma_finans@`
- Lvl ★: İK Yöneticisi `firma_ik_yoneticisi@` — business_role: ik_yoneticisi, iş ilanı verme yetkisi
- Lvl ★: İK Uzmanı `firma_ik_uzmani@` — business_role: ik_uzmani, temel workspace + iş ilanı

### Tedarikçi Rolleri (Lvl 0→7 + özel)

Demo tenant: **BA Demo Tedarikçi Firma** (slug: `demo-tedarikci-firma`, prefix: `tedarikci_`)

- Lvl 0: Tedarikçi Admin `tedarikci_admin@`
- Lvl 1: Pazarlama Müdürü `tedarikci_mudur@`
- Lvl 2: Pazarlama Müdür Yardımcısı `tedarikci_mudur_yrd@`
- Lvl 3: Pazarlama Yöneticisi `tedarikci_yonetici@`
- Lvl 4: Kıdemli Pazarlama Uzmanı `tedarikci_kidemli_uzm@`
- Lvl 5: Pazarlama Uzmanı `tedarikci_uzman@`
- Lvl 6: Teknik Uzman ve Mimar `tedarikci_teknik@`
- Lvl 7: Teklif Uzmanı `tedarikci_teklif@` ⚠️ teklif akışı kritik — dokunma
- Lvl ★: Özel Tedarikçi Rolü `tedarikci_ozel@`
- Lvl ★: Finans İzleyici `tedarikci_finans@`
- Lvl ★: İK Yöneticisi `tedarikci_ik_yoneticisi@` — business_role: ik_yoneticisi

### İş Ortağı (Kanal) Rolleri (Lvl 0→4)

- Lvl 0: Kanal Hesap Sahibi `firma_kanal_sahibi@`
- Lvl 1: Kanal Ekip Lideri `firma_ekip_lideri@`
- Lvl 2: Kanal Temsilcisi `firma_temsilci@`
- Lvl 3: Kanal Finans `firma_kanal_finans@`
- Lvl ★: Özel Kanal Rolü `firma_ozel_kanal@`
- Lvl ★: İK Yöneticisi `firma_ik_yoneticisi@` — business_role: ik_yoneticisi

### Demo tenant email prefix tablosu

| Tenant | Prefix |
|--------|--------|
| BA Demo Stratejik Ortak | `firma_` |
| BA Demo İş Ortağı | `firma_` |
| BA Demo Tedarikçi Firma | `tedarikci_` |
| Kanal Ana Yönetici Demo | `kanal_` |
| OLİMPOS TEKNOLOJİ | `olimpos_` |
| Poseydon | `poseydon_` |
| PİZZA MAX | `pizzamax_` |
