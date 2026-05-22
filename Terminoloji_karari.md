# ProcureFlow Terminoloji Karari

Bu dokuman, urun icindeki is dili ile teknik dil arasindaki siniri netlestirmek,
tekrar kullanilabilir bir terim listesi olusturmak ve ileride template veya coklu
dil destegi eklenirken ortak referans saglamak icin tutulur.

## 1. Temel Kural

- Kullaniciya gorunen tum metinler once Turkce dusunulur ve Turkce yazilir.
- Is dilinde `tenant` yerine `Stratejik Partner` terimi kullanilir.
- Teknik uyumluluk nedeniyle kod, tablo, kolon, API alanlari ve query parametreleri mevcut adiyla kalabilir.

## 2. Turkcelestirilecek Yuzeyler

Asagidaki metinler kullaniciya gorunen urun dili olarak kabul edilir ve Turkce tutulur:

- Sayfa basliklari
- Sekme ve menu adlari
- Buton ve aksiyon etiketleri
- Form label, placeholder ve yardim metinleri
- Bos durum, hata, basari ve toast mesajlari
- KPI kart basliklari, tablo sutunlari ve rozet etiketleri
- Rapor, export ve panel basliklari

## 3. Teknikte Korunabilecek Terimler

Asagidaki alanlar, geriye uyumluluk veya teknik netlik gerekiyorsa mevcut adiyla kalabilir:

- Veritabani tablo ve kolon adlari
- API request/response alan adlari
- Query parametreleri
- Migration dosya adlari
- Script ve audit cikti alanlari
- Internal type, interface ve enum anahtarlari

Not:
- Teknik bir terim korunuyorsa, kullaniciya gorunen label veya aciklama yine Turkce yazilir.

## 4. Standart Karsiliklar

- tenant -> Stratejik Partner
- tenant governance -> Stratejik Partner Yonetimi
- platform overview -> Platform Genel Bakisi
- platform operations -> Platform Operasyonlari
- onboarding studio -> Kurulum Studyosu
- private supplier -> Ozel Tedarikci
- platform network -> Platform Agi
- status history -> Durum Gecmisi
- audit trail -> Denetim Izi
- restore replay -> Geri Yukleme Tekrari
- admin focus telemetry -> Yonetici Odak Telemetrisi
- telemetry quick actions -> Telemetri Hizli Eylemleri
- preset package preview -> On Ayar Paketi Onizlemesi

## 5. Korunabilecek Ortak Teknik Terimler

Asagidaki terimler kullanima gore korunabilir:

- RFQ
- API
- SMTP
- webhook
- JSON
- CSV

Not:
- Bu terimler korunabilir, ancak cevresindeki aciklama dili Turkce olmaya devam eder.

## 6. Yeni Ekran veya Ozellik Checklisti

Yeni bir ekran, panel veya akista metin yazarken asagidaki sira izlenir:

1. Metin kullaniciya gorunuyor mu diye kontrol et.
2. Kullaniciya gorunuyorsa Turkce yaz.
3. Is dili iceren bir terim varsa once bu dosyadaki standart karsiliga bak.
4. Teknik anahtar gerekiyorsa sadece internal katmanda koru.
5. UI metni degisti ise ilgili test assertion metinlerini de guncelle.

## 7. Template ve Dil Desteigi Notu

- Bu dosya ileride template cikarmak icin ana referans olarak kullanilabilir.
- Coklu dil destegi eklenirse, bu listedeki Turkce karsiliklar varsayilan kaynak metin olarak alinabilir.
- Yeni terim kararlarinda once bu dosya guncellenmeli, sonra UI ve testler degistirilmelidir.