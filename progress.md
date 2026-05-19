# Progress Özeti

Güncelleme Tarihi: 2026-05-19

## Tamamlananlar

- Frontend build kontrolü yapıldı (`web`):
  - `npm run build` başarılı.
- Lint analizi çıkarıldı.
- Token/context verimliliği için:
  - `CLAUDE.md`
  - `.claudeignore`
  - `progress.md`

## Açık Konular (Öncelik Sırası)

1. Türkçe karakter bozulmaları (özellikle eski DB kayıtları)
2. Rol/personel/firma atama uyumsuzlukları
3. Supplier ve partner segmentlerinde kalan mükerrer/kirli personel kayıtları
4. Hook/TypeScript lint borçları

## Hızlı Teknik Durum

- Derleme alınıyor.
- Lint hâlâ kırık.
- Veri temizliği sürüyor.

## Sonraki Adım

1. DB rol kataloğunu canonical Türkçe set ile yeniden uygula.
2. Personel ad/rol/departman metinlerini normalize et.
3. Firma scope uyumsuzluklarını düzelt.
4. Sonuç raporunu tablo halinde çıkar.
