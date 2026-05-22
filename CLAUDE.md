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

## 5) Hedef Rol Katalogu

### Platform Rolleri
- Super Admin
- Platform Operasyon Admin / Yöneticisi / Uzmanı
- Platform Destek Admin / Yöneticisi / Uzmanı
- Platform Finans Admin / Yöneticisi / Uzmanı
- Platform Denetçi / Finans İzleyici
- Platform Güvenlik Uzmanı
- Platform Raporlama Analisti

### Stratejik Partner Rolleri
- Partner Ana Yönetici / Partner Yöneticisi
- Satın Alma Direktörü / Müdürü / Müdür Yardımcısı / Yöneticisi
- Satın Alma Kıdemli Uzmanı / Uzmanı
- Teknik Uzman ve Mimar
- Özel Stratejik Partner Rolü
- Partner Denetçi / Finans İzleyici

### Tedarikçi Rolleri
- Tedarikçi Ana Yönetici / Tedarikçi Yöneticisi
- Pazarlama Müdürü / Müdür Yardımcısı / Yöneticisi
- Kıdemli Pazarlama Uzmanı / Pazarlama Uzmanı
- Teknik Uzman ve Mimar
- Teklif Uzmanı
- Özel Tedarikçi Rolü
- Tedarikçi Denetçi / Finans İzleyici

### İş Ortağı (Kanal) Rolleri
- Kanal Hesap Sahibi
- Kanal Ekip Lideri
- Kanal Temsilcisi
- Kanal Finans Görüntüleyici
- Kanal Denetçisi
