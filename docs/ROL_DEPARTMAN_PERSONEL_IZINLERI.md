# Rol Departman ve Personel Izinleri Referans Dokumani

Bu dokuman rol siniflandirma, personel bilgi mimarisi, menu izinleri ve kisiye ozel yetki yonetimi icin tek referanstir.
Ana plan kaydi: TENANT_SAAS_TRANSFORMATION_PLAN.md -> Paket 6.

## 1. Kapsam ve Amac

Bu dokumanin amaci:
- Coklu admin karmasasini net rol siniflarina ayirmak
- Personeller ekranini operasyonel olarak okunur hale getirmek
- Menu gorunurlugu ve menu aksiyonlarini rol bazli netlestirmek
- Rol bazli izinlere ek olarak kisiye ozel izin ac/kapat mekanizmasi tanimlamak
- Ust rollerin alt rollere delege edebilecegi izin modelini belirlemek
- Yapilan isi checklist ve durum notlariyla takip edilebilir hale getirmek

## 2. Terminoloji Karari (UI Dili)

Kullaniciya gorunen tum metinlerde asagidaki terimler kullanilir:
- tenant -> Stratejik Partner
- tenant governance -> Stratejik Partner Yonetimi
- tenant identity settings -> Stratejik Partner Kimlik Ayarlari
- admin surface -> Yonetim Alani
- quote workspace -> Teklif Calisma Alani
- platform_support -> Platform Destek
- platform_operator -> Platform Operasyon

Not:
- Teknik katmanda (kolon/endpoint/sabit adlari) geriye uyumluluk nedeniyle mevcut isimler korunabilir.

## 3. Rol Siniflandirma (Ust Seviye)

## 3.1 Portal Personelleri

Portal genel operasyonunu yurutur.
- Super Admin
- Platform Operasyon
- Platform Destek

Temel sorumluluk:
- Platform genel izleme, destek yonetimi, sistem duzeyi ayarlar

## 3.2 Stratejik Partner Personeli

Her stratejik partnerin kendi organizasyon personelidir.
- Stratejik Partner Sahibi
- Stratejik Partner Yonetici
- Satin Alma Direktoru
- Satin Alma Yoneticisi
- Satin Alma Uzmani
- Satin Almaci

Temel sorumluluk:
- Kendi stratejik partnerine ait operasyon, departman, teklif ve personel surecleri

## 3.3 Tedarikci Personeli

Tedarikci firma icindeki kullanicilardir.
- Tedarikci Sahibi
- Tedarikci Yonetici
- Tedarikci Personeli

Temel sorumluluk:
- Kendi tedarikci firma teklif/yukleme/yanit operasyonu

## 4. Personeller Sekmesi Bilgi Mimarisi (Hedef)

Personeller alaninda 3 ana sekme olacak:

1. Portal Personelleri
- Acildiginda dogrudan portal personel listesi gelir.
- Satirda rol, durum, son islem, yetki profili gorulur.

2. Stratejik Partner Personeli
- Acildiginda once stratejik partner listesi gelir.
- Her satirda "personel sayisi" zorunlu gosterilir.
- Satira tiklayinca o stratejik partnere ait personel listesi alt panelde/acilir satirda gosterilir.

3. Tedarikci Personeli
- Acildiginda once tedarikci listesi gelir.
- Her satirda "personel sayisi" zorunlu gosterilir.
- Satira tiklayinca o tedarikciye ait personel listesi alt panelde/acilir satirda gosterilir.

## 5. Yetki Modeli (Kademeli)

Yetki hesabi su oncelik sirasiyla calisir:
1. Sistem rol kapsam kurali
2. Rol bazli menu gorunurlugu
3. Rol bazli menu aksiyon yetkisi
4. Kisiye ozel izin override (son karar)

Kural:
- Kisiye ozel override varsa rol varsayimini ezer.
- Acik/Kapali karari menu ve alt menu seviyesinde verilebilir.

## 6. Menu Agaci ve Alt Yetki Modeli

Her menu iki katmanda yetki alir:
- Goruntuleme (menuyu gorebilir mi)
- Islem (olustur/guncelle/sil/onayla/disa aktar)

Ornek menu-agaci:
- Yonetim Ana Sayfasi
  - KPI kartlari goruntuleme
  - Operasyon listesi goruntuleme
- Personeller
  - Liste goruntuleme
  - Olusturma
  - Duzenleme
  - Pasife alma
  - Silme
- Teklif Calisma Alani
  - Liste
  - Olusturma
  - Duzenleme
  - Onaya gonderme
  - Karsilastirma
- Stratejik Partner Yonetimi
  - Liste
  - Detay
  - Duzenleme
- Raporlar
  - Liste
  - Disa aktar

## 7. Kisiye Ozel Izinler (Canli Yetki Onizlemesi)

Kullanici kartinda her izin satirinda toggle olacak:
- Acik durum: yesil onay
- Kapali durum: kirmizi X

Davranis:
- Ust rolde izin acik olsa bile kisi bazli kapatilabilir.
- Ust rolde izin kapaliysa, kisi bazli acma sadece izin delegesi olan ust rollerce yapilabilir.
- Canli Yetki Onizlemesi rol + kisi override sonucunu birlikte gosterir.

## 8. Ust Rol -> Alt Rol Delege Modeli

Yeni yetki sinifi:
- izin_yonetimi.delege

Kurallar:
- Kullanici sadece kendi altindaki roller icin izin duzenleyebilir.
- Sistem kritik izinleri (or: platform ayarlari, super admin aksiyonlari) delege edilemez.
- Delege eden rol hangi izinleri acmissa, alt rolde sadece o izin havuzu icinde ac/kapat yapilabilir.

## 9. Veri Modeli Taslak (Plan)

Eklenmesi planlanan alanlar:
- role_permissions (mevcut): rolun varsayilan izinleri
- user_permission_overrides (yeni)
  - user_id
  - permission_key
  - allowed (true/false)
  - granted_by_user_id
  - updated_at
- role_permission_delegations (yeni)
  - role_id
  - manageable_permission_key
  - can_delegate (true/false)

## 10. API ve UI Is Paketleri

## 10.1 Backend
- permission catalog endpointlerini menu-agaci + alt izin yapisini donecek hale getir
- user permission override CRUD endpointleri ekle
- role delegation endpointleri ekle
- izin hesaplama helper'ini tek merkezde birlestir

## 10.2 Frontend
- Personeller ana sekmesini 3 segmentli bilgi mimarisine cevir
- Partner/tedarikci listelerinde personel sayisi badge'i ekle
- Satir tiklama ile alt personel listesini ac
- Canli Yetki Onizlemesi alanina kisi override toggle'larini ekle
- Menu alt acilimlarini secilebilir hale getir

## 11. Is Akisi Checklist (Takip)

## 11.1 Analiz ve Karar
- [x] Rol/departman/personel izinleri icin tek referans dokuman olusturuldu
- [x] Terminoloji standartlari tanimlandi
- [ ] Menu agaci ve alt yetki katalogu urun ve teknik ekip tarafindan onaylandi

## 11.2 Bilgi Mimarisi
- [x] Personeller ana sayfasi 3 sekmeli yapida wireframe olarak netlestirildi
- [x] Stratejik Partner ve Tedarikci satirlarinda personel sayaci tasarimi netlesti
- [x] Satira tiklama ile alt personel listesi davranisi netlesti

## 11.3 Yetki Motoru
- [ ] Rol bazli goruntuleme ve aksiyon izinleri tek helper'da birlestirildi
- [x] Kisiye ozel izin override veri modeli eklendi
- [x] Kisiye ozel izin override API endpointleri eklendi
- [x] Delege (ust rol -> alt rol) kurallari backendde dogrulandi

## 11.4 UI Uygulama
- [x] Canli Yetki Onizlemesi kisilere ozel toggle ile calisir hale geldi
- [x] Acik/Kapali toggle gorseli yesil onay / kirmizi X olarak tamamlandi
- [x] Menu alt acilimlari icin secilebilir alt izin paneli eklendi
- [ ] Turkce olmayan menu ve izin metinleri temizlendi

## 11.5 Test ve Kapanis
- [ ] Backend authz testleri yeni override/delege modelini kapsiyor
- [ ] Frontend yetki gorunurluk testleri sekme ve menu bazli guncellendi
- [ ] Paket 6 kapanis notu ana plana eklendi

## 12. Durum Notlari

- 2026-04-16: Dokuman olusturuldu, ana plan Paket 6 referansi eklendi.
- 2026-04-16: Personeller sekmesi uygulamada 3 segmentli bilgi mimarisine gecirildi; stratejik partner ve tedarikci listelerinde personel sayisi ve acilir alt personel listesi eklendi.
- 2026-04-16: Kullanici bazli izin override veritabani modeli ve admin API endpointleri eklendi; canli yetki onizlemesine kalici toggle ve alt menu yetki paneli baglandi.
- Sonraki adim: Yetki hesaplama helper'inin backend authz katmanina tam entegrasyonu ve test kapsaminin genisletilmesi.
