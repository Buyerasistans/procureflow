# ProcureFlow Stratejik Partner SaaS Donusum Plani

Bu dokuman, ProcureFlow'un Buyera Asistans altinda calisan cok kiracili
satin alma platformuna donusumu icin ana referanstir.

Amac:

- Buyera Asistans'i platform sahibi olarak konumlandirmak
- Musteri sirketleri Stratejik Partner olarak modelllemek
- Stratejik Partner yoneticisi, personel ve tedarikci rollerini net ayirmak
- Satin alma, teklif, proje, onay ve tedarikci akislarini
  Stratejik Partner merkezli hale getirmek
- Yapilanlari isaretleyerek surekli ilerleme kaydi tutmak

Bagli is akisi dosyalari:

- `ADMIN_PANEL_FIRMALAR_PERSONEL_REFACTOR.md` — Süper admin paneli
  Firmalar/Personel/Tedarikci refactor is akisi (2026-04-21)
  Kapsam: PersonnelTab channel segmenti, tedarikci/is ortagi kart aksiyonlari,
  "Firmalar" buton adi, tedarikci-firma iliskisi, platform tedarikci modeli,
  proje hiyerarsisi ve firma adi kisaltma kurali.

Terminoloji karari:

- Is dilinde `tenant` yerine `Stratejik Partner` terimi kullanilir.
- Teknik uyumluluk nedeniyle kod, tablo ve kolon adlarinda `tenant` isimleri korunabilir.
- Kullaniciya gorunen buton, sekme, baslik, aciklama, bos-durum,
  toast ve rapor etiketi metinleri Turkce yazilir.
- Teknik uyumluluk veya geriye donuk entegrasyon gereken API
  alanlari, query parametreleri, migration adlari, tablo ve kolon
  adlari Ingilizce veya mevcut teknik adiyla korunabilir.
- RFQ, API, SMTP, webhook, JSON ve CSV gibi yerlesik teknik veya
  sektor terimleri gerekli oldugu yerde korunabilir; bunlarin
  kullaniciya gorunen aciklama metinleri yine Turkce yazilir.
- Ayrintili karsilik listesi ve tekrar kullanilabilir dil notlari
  Terminoloji_karari.md dosyasinda tutulur.

Rol/departman/personel izinleri referans notu:

- Rol siniflandirma, menu-agaci yetkileri, kisiye ozel izin,
  override kurallari ve personel bilgi mimarisi akisi icin ana
  calisma dosyasi `docs/ROL_DEPARTMAN_PERSONEL_IZINLERI.md` olarak
  tanimlandi.
- Rol/izin veya personel sekmesiyle ilgili yeni bir gelistirme
  yapilacaginda once bu referans dosya guncellenir, sonra kod
  degisikligi uygulanir.

## 0. Nihai Platform Mimarisi (2026-04-16 Mutabik Kalinmis)

### 0.1 Dort Ana Scope

Sistem 4 kanonik scope ile calisir. Her kullanici bu dortluden birine aittir.
Yetki karari: scope -> role_profile -> izin katalogu -> override -> delegation

- platform : Buyera Asistans operasyon ve yonetim ekibi
- partner  : Satinalma operasyonu yuruten stratejik partner sirketleri ve personeli
- supplier : Teklif veren / urun-hizmet satan tedarikci sirketleri ve personeli
- channel  : Platforma partner veya tedarikci getiren; komisyon/
  hakediş/sayi bazli caliṡan is gelistirme ortaklari

### 0.2 Kanonik Profil Tablosu

| Scope    | Profil Kodu                  | Gorsel Ad                        | Hesap Tipi | Ozel Rol Uretir mi |
| :------- | :--------------------------- | :------------------------------- | :--------- | :----------------- |
| platform | platform.super_admin         | Super Admin                      | sistem     | evet               |
| platform | platform.portal_admin        | Portal Admini                    | sistem     | hayir              |
| platform | platform.support_agent       | Destek Temsilcisi                | sistem     | hayir              |
| platform | platform.finance_officer     | Finans Sorumlusu                 | sistem     | hayir              |
| partner  | partner.account_owner        | Partner Ana Yoneticisi           | owner      | evet (sinirli)     |
| partner  | partner.org_admin            | Partner Yoneticisi               | admin      | evet (sinirli)     |
| partner  | partner.procurement_manager  | Satin Alma Muduru                | custom     | hayir              |
| partner  | partner.technical_specialist | Teknik Uzman / Mimar             | custom     | hayir              |
| partner  | partner.auditor              | Denetci / Finansal Izleyici (RO) | custom     | hayir              |
| partner  | partner.custom_role          | Ozel Partner Rolu                | custom     | hayir              |
| supplier | supplier.account_owner       | Tedarikci Ana Yoneticisi         | owner      | evet (sinirli)     |
| supplier | supplier.org_admin           | Tedarikci Yoneticisi             | admin      | evet (sinirli)     |
| supplier | supplier.sales_senior        | Kidemli Satis Temsilcisi         | custom     | hayir              |
| supplier | supplier.pricing_specialist  | Fiyatlandirma / Maliyet Uzmani   | custom     | hayir              |
| supplier | supplier.custom_role         | Ozel Tedarikci Rolu              | custom     | hayir              |
| channel  | channel.account_owner        | Kanal Ana Yoneticisi             | owner      | evet (sinirli)     |
| channel  | channel.team_lead            | Ekip Lideri                      | admin      | hayir              |
| channel  | channel.agent                | Kanal Temsilcisi                 | staff      | hayir              |
| channel  | channel.finance_viewer       | Komisyon / Hakediş Izleyici      | custom     | hayir              |
| channel  | channel.auditor              | Salt Okunur Denetci              | custom     | hayir              |

### 0.2C Stratejik Ortak Rol Hiyerarsisi (En Yetkiliden Asağıya)

Bu liste partner scope icin tek kanonik hiyerarsi olarak uygulanir.

| Sira | Profil Kodu                           | Gorsel Ad                      | Hiyerarsi Duzeyi |
| :--- | :------------------------------------ | :----------------------------- | :--------------- |
| 1    | partner.account_owner                 | Partner Ana Yonetici           | L1               |
| 2    | partner.procurement_admin             | Satin Alma Admin               | L2               |
| 3    | partner.procurement_director          | Satin Alma Direktoru           | L3               |
| 4    | partner.procurement_manager           | Satin Alma Muduru              | L4               |
| 5    | partner.procurement_deputy_manager    | Satin Alma Mudur Yardimcisi    | L5               |
| 6    | partner.procurement_supervisor        | Satin Alma Yoneticisi          | L6               |
| 7    | partner.procurement_senior_specialist | Satin Alma Kidemli Uzmani      | L7               |
| 8    | partner.procurement_specialist        | Satin Alma Uzmani              | L8               |
| 9    | partner.procurement_assistant         | Satin Alma Uzman Yardimcisi    | L9               |
| 10   | partner.procurement_staff             | Satin Alma Personeli           | L10              |
| 11   | partner.technical_specialist          | Teknik Uzman ve Mimar          | L8               |
| 12   | partner.auditor                       | Denetci ve Finansal Izleyici   | L9 (RO)          |

Notlar:

- L1-L6 arasi yonetsel, L7-L10 operasyonel yapidir.
- `partner.technical_specialist` teknik hat boyunca uzman roldur.
  Satin alma hiyerarsisinde L8 ile esit yetki tabanina sahiptir.
- `partner.auditor` salt okunurdur, duzenleme/yazma izni almaz.

### 0.2D Tek Sayfada 4 Ana Bolum (Rol ve Departman Yonetimi)

Super Admin panelinde Rol ve Departman yonetimi ayni sayfada
4 bolum/sekme olarak sunulur:

1. Super Admin ve Personelleri Panel Yonetimi
2. Stratejik Ortak Rolleri
3. Tedarikci Rolleri
4. Is Ortagi Rolleri

Her bolumde ayni bilgi mimarisi korunur:

- Roller
- Departmanlar
- Hiyerarsi Agaci
- Yetki Devri
- Kayit Geçmisi / Denetim

### 0.2E Yonetim Yetki Sinirlari

- Platform (super admin bolumu):
  ekle/duzenle/sil/birlestir = evet.
  Yetkili: super_admin + super_admin tarafindan yetkilendirilmis
  platform personeli.
- Partner (stratejik ortak bolumu):
  ekle/duzenle/sil = evet, birlestir = hayir.
  Yetkili: partner.account_owner, partner.procurement_admin.
- Supplier (tedarikci bolumu):
  ekle/duzenle/sil = evet, birlestir = hayir.
  Yetkili: supplier.account_owner, supplier.org_admin.
- Channel (is ortagi bolumu):
  ekle/duzenle/sil = evet, birlestir = hayir.
  Yetkili: channel.account_owner, channel.team_lead.
- Scope'lar arasi rol birlestirme:
  yalnizca super_admin.

Kurallar:

- Her scope icinde ayni rol adindan yalnizca 1 adet olabilir.
- Teknik benzersizlik anahtari: `scope_type + tenant_id + normalized_role_name`.
- Partner/supplier/channel adminleri duplicate rol olusturamaz.
- Duplicate algilanirsa kayit islemi reddedilir ve mevcut rol secmeye yonlendirilir.

### 0.2F Duplicate Rol Birlestirme (Sadece Super Admin)

Super admin duplicate rolleri secip birlestirebilir:

1. Kaynak rol(ler) secilir.
2. Hedef rol secilir.
3. Tum personel atamalari hedef role tasinir.
4. Kaynak rol pasife cekilir ve audit kaydi yazilir.
5. Birlesme onizleme raporu + geri alma penceresi sunulur.

### 0.2G Departmanlarda Hiyerarsi ve Ayni Yonetim Modeli

Rol hiyerarsisi ile ayni mantik departmanlara da uygulanir:

- Departmanlar `parent_department_id` ile agac yapisinda tanimlanir.
- Her scope icinde ayni departman adindan yalnizca 1 adet olabilir.
- Teknik benzersizlik anahtari: `scope_type + tenant_id + normalized_department_name`.
- Partner/supplier/channel adminleri kendi scope departmanlarini ekler/duzenler/siler.
- Departman birlestirme (duplicate department merge) yalnizca
  super_admin tarafindan yapilir.
- Bir departman birlestiginde personel ve rol baglantilari
  hedef departmana atomik tasinir.

### 0.2B Scope-First Workspace ve Onay Kuyrugu Durumu (2026-04-21)

- Split login ekranlari korunarak ic kullanici ve aktivasyon akislarinda
  dogrudan dashboard yerine `/app` uzerinden scope-aware yonlendirme
  uygulanmistir.
- Auth normalize katmani artik `scope_type` ve `role_profile_code`
  uretir; boylece kullanici paneli scope -> profil mantigiyla acilir.
- Admin workspace icindeki `panel_home`, scope renklerini koruyan ve
  role-profile baglamini gosteren yeni bir scope-first karsilama
  yuzeyine donusturulmustur.
- Rol ve departman olusturma icin dogrudan CRUD yanina ek olarak
  `catalog request` tabanli onay kuyrugu eklenmistir.
- Bu kuyruk hem scope home yuzeyinde hem de Roller / Departmanlar
  sekmelerinde gorunur durumdadir; talep acma ve onaylama aksiyonlari
  ayni backend omurgasina baglanir.

### 0.2A Demo Kurulum Matrisi

Bu profil tablosu esas alinarak demo kurulumunda asagidaki standart uygulanir.

Ortak demo kurali:

- Tum demo hesaplari `@buyerasistans.com.tr` uzantisini kullanir.
- Tum demo hesaplarinin sifresi [REDACTED] (scope_demo_bootstrap DEMO_PASSWORD)
- Hosting tarafinda gercek posta kutusu acilmasi operasyonel is olarak ayridir.
  Uygulama ve seed tarafinda ayni adreslerle hesaplar hazir tutulur.
- Kurulum akisi yalnizca kullanici acmaz; rol, departman, firma ve
  gerekli personel atamalarini da birlikte olusturur.

Demo hesap gruplari:

- platform
  - superadmin [at] buyerasistans.com.tr
  - portaladmin [at] buyerasistans.com.tr
  - support [at] buyerasistans.com.tr
  - finance [at] buyerasistans.com.tr
- partner
  - partner.owner.demo [at] buyerasistans.com.tr
  - partner.admin.demo [at] buyerasistans.com.tr
  - partner.procurement.lead1 [at] buyerasistans.com.tr
  - partner.procurement.lead2 [at] buyerasistans.com.tr
  - partner.tech.demo1 [at] buyerasistans.com.tr
  - partner.tech.demo2 [at] buyerasistans.com.tr
  - partner.audit.demo [at] buyerasistans.com.tr
  - partner.custom.demo [at] buyerasistans.com.tr
- supplier
  - supplier.owner.demo [at] buyerasistans.com.tr
  - supplier.admin.demo [at] buyerasistans.com.tr
  - supplier.sales.demo [at] buyerasistans.com.tr
  - supplier.pricing.demo [at] buyerasistans.com.tr
  - supplier.custom.demo [at] buyerasistans.com.tr
- channel
  - channel.owner.demo [at] buyerasistans.com.tr
  - channel.lead.demo [at] buyerasistans.com.tr
  - channel.agent.demo [at] buyerasistans.com.tr
  - channel.finance.demo [at] buyerasistans.com.tr
  - channel.audit.demo [at] buyerasistans.com.tr

Partner demo kurulumu ile birlikte acilacak departmanlar:

- Yonetim ve Organizasyon
- Satin Alma Operasyonlari
- Teknik Ofis ve Sartname
- Finans ve Denetim

Partner demo kurulumu ile birlikte acilacak rol saplonlari:

- Partner Ana Yonetici
- Satin Alma Admin
- Satin Alma Direktoru
- Satin Alma Muduru
- Satin Alma Mudur Yardimcisi
- Satin Alma Yoneticisi
- Satin Alma Kidemli Uzmani
- Satin Alma Uzmani
- Satin Alma Uzman Yardimcisi
- Satin Alma Personeli
- Teknik Uzman ve Mimar
- Denetci ve Finansal Izleyici
- Ozel Partner Rolu

Personel kural seti:

- Her ana profil icin en az 1 demo hesap bulunur.
- Kritik operasyon profillerinde en az 2 hesap bulunur.
  Ornek: `partner.procurement_manager`, `partner.technical_specialist`
- Partner kullanicilari, ilgili firma + departman + rol atamasi ile birlikte olusur.
- Supplier demo kullanicilari supplier portal modeliyle olusur.
- Channel hesaplari scope-first login ve gorunurluk testleri icin hazir tutulur.

### 0.3 Mevcut Role/System_Role -> Yeni Profil Eslemesi (Gecis Tablosu)

Mevcut role ve system_role alanlari Faz A boyunca korunur.
Yeni role_profile_code ek kolon olarak Faz B ile eklenir.

| business_role        | system_role       | Yeni Profil                  |
| :------------------- | :---------------- | :--------------------------- |
| super_admin          | super_admin       | platform.super_admin         |
| admin                | platform_operator | platform.portal_admin        |
| admin                | platform_support  | platform.support_agent       |
| admin                | tenant_owner      | partner.account_owner        |
| admin                | tenant_admin      | partner.org_admin            |
| satinalma_direktoru  | tenant_member     | partner.procurement_manager  |
| satinalma_yoneticisi | tenant_member     | partner.procurement_manager  |
| satinalma_uzmani     | tenant_member     | partner.technical_specialist |
| satinalmaci          | tenant_member     | partner.custom_role (staff)  |
| supplier             | supplier_user     | supplier.sales_senior        |

### 0.4 Channel Scope Modeli

Channel nedir:
Platforma yeni partner veya tedarikci getiren gercek kisi veya organizasyondur.
Kendi ozel paneli vardir. Partner veya supplier ic is akisini goremez.

Ekip kurma:

- channel.account_owner kendi ekibini kurar ve yonetir.
- Super admin tum kanal organizasyonlarini ve uyeleri gorur.
- Super admin kanal hesabina izin verebilir veya kaldirabilir.
- Super admin yetki verdigi platform personeli de kanal ekranlarini yonetebilir.

Kanal panel modulleri:

- Kanal Dashboard: aktif lead, donusen lead, aktif portfoy, bekleyen hakediş
- Portfoyum: getirdigim partner ve tedarikçiler, durumları
- Lead Yonetimi: aday ekleme, durum izleme, atama
- Ekip Yonetimi: temsilci davet etme, rol verme
- Komisyon / Hakediş: oran, tahakkuk, odeme gecmisi, bekleyen kalemler
- Sozlesmelerim: platform ile calisma ile termleri, oranlar, hedef sayilar
- Raporlar: donusum orani, aktif-pasif portfoy, aylik hakediş ozeti

### 0.5 Hakediş Modeli

Iki hakedis modu:

1. Komisyon modu:
   - Getirilen her partner veya tedarikci icin oran bazli sur komisy
   - Partner komisyonu ve supplier komisyonu birbirinden bagimsiz ayarlanir
   - Abonelik seviyesine gore oran farklilasabilir

2. Sabit + Sayi modu:
   - Belirli sayida partner/tedarikci baglandiginda sabit odeme tetiklenir
   - Sayi sarti sağlanınca ödeme otomatik tahakkuk eder

Ortak kurallar:

- Fiyat ve oranlari super_admin gunceller
- Yetki verilmisse platform.finance_officer veya yetkilendirilmis
  admin de gorur ve yonetir
- Attribution kalicidir: getiren kanalin kaydina baglanir, degismez
- Partner komisyon orani ve supplier komisyon orani bağımsız tanim yapılır

### 0.6 Ozel Liste / Vitrin Modeli

- Platform genel listesinde gorunmek ucretlidir.
- Hakedisini kazanmamis kanal uyesi getirdiklerini sadece kendi portfoyunde gorur.
- Hakediş sarti saglandiktan sonra getirdigi tedarikci/partner
  platform listesinde gorunmeye baslar.
- Stratejik partner teklif aldiginda ozel teklif secenegi aktifse,
  ilgili tedarikci ozel konumda listelenir.
- Bu akis ekstra ucrete tabidir; fiyat super_admin tarafindan yonetilir.

### 0.7 Izin Katalogu Taslagi: Hangi Modullere Hangi Profil Erişir

| Modul                          | platform SA | portal admin | destek | finans | partner owner | partner manager | partner tech | partner RO | supplier owner | supplier sales | channel owner | channel agent |
| :----------------------------- | :---------: | :----------: | :----: | :----: | :-----------: | :-------------: | :----------: | :--------: | :------------: | :------------: | :-----------: | :-----------: |
| Global Dashboard               |      ✓      |      ✓       |   -    |   ✓    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Organizasyon (tenant) Yonetimi |      ✓      |      ✓       |   -    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Global Finans / Faturalama     |      ✓      |      -       |   -    |   ✓    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Sistem Ayarlari                |      ✓      |      -       |   -    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Master Log / Denetim           |      ✓      |      ✓       |   -    |   -    |       -       |        -        |      -       |   ✓ RO     |       -        |       -        |       -       |       -       |
| Merkez Rol Yonetimi            |      ✓      |      -       |   -    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Operasyon Dashboard            |      ✓      |      ✓       |   ✓    |   -    |       ✓       |        -        |      -       |     -      |       ✓        |       -        |       -       |       -       |
| Destek / Ticket                |      ✓      |      ✓       |   ✓    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Ihtilaf / Sikayet              |      ✓      |      ✓       |   ✓    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Personel Yonetimi              |      ✓      |      ✓       |   -    |   -    |       ✓       |        -        |      -       |    RO      |       ✓        |       -        |       ✓       |       -       |
| Rol / Izin Yonetimi            |      ✓      |      ✓       |   -    |   -    |       ✓       |        -        |      -       |     -      |       ✓        |       -        |       ✓       |       -       |
| Butce Yonetimi                 |      ✓      |      -       |   -    |   -    |       ✓       |        -        |      -       |    RO      |       -        |       -        |       -       |       -       |
| Teklif / RFQ                   |      ✓      |      -       |   -    |   -    |       ✓       |        ✓        |  ✓ (teknik)  |    RO      |       ✓        |       ✓        |       -       |       -       |
| Teklif Karsilastirma           |      ✓      |      -       |   -    |   -    |       ✓       |        ✓        |      -       |     -      |       -        |       -        |       -       |       -       |
| AI Pazarlik                    |      ✓      |      -       |   -    |   -    |       ✓       |        ✓        |      -       |     -      |       -        |       -        |       -       |       -       |
| Onay / PO / Sozlesme           |      ✓      |      -       |   -    |   -    |       ✓       |     taslak      |      -       |    RO      |       ✓        |       SO       |       -       |       -       |
| Teknik Dosyalar / CAD-BOM      |      -      |      -       |   -    |   -    |       ✓       |        -        |      ✓       |    RO      |       -        |       -        |       -       |       -       |
| Sartname Kutuphanesi           |      -      |      -       |   -    |   -    |       ✓       |        -        |      ✓       |    RO      |       -        |       -        |       -       |       -       |
| Sirket Profili / Belgeler      |      -      |      -       |   -    |   -    |       ✓       |        -        |      -       |    RO      |       ✓        |       -        |       ✓       |       -       |
| Katalog / Fiyat                |      -      |      -       |   -    |   -    |       -       |        -        |      -       |     -      |       ✓        |       ✓        |       -       |       -       |
| Banka / Cari Hesaplar          |      -      |      -       |   -    |   -    |       -       |        -        |      -       |     -      |       ✓        |       -        |       ✓       |       -       |
| Kanal Dashboard                |      ✓      |      -       |   -    |   ✓    |       -       |        -        |      -       |     -      |       -        |       -        |       ✓       |       ✓       |
| Portfoy / Lead Yonetimi        |      ✓      |      -       |   -    |   -    |       -       |        -        |      -       |     -      |       -        |       -        |       ✓       |       ✓       |
| Komisyon / Hakediş             |      ✓      |      -       |   -    |   ✓    |       -       |        -        |      -       |     -      |       -        |       -        |       ✓       |     ✓ RO      |
| Ozel Liste / Vitrin Yonetimi   |      ✓      |      -       |   -    |   ✓    |       -       |        -        |      -       |     -      |       -        |       -        |       -       |       -       |
| Abonelik / Paket Yonetimi      |      ✓      |      ✓       |   -    |   ✓    |    ✓ kendi    |        -        |      -       |     -      |    ✓ kendi     |       -        |    ✓ kendi    |       -       |

Not: RO = salt okunur, SO = satis siparisi, taslak = nihai onay olmadan

### 0.8 Odeme Platformu (Zorunlu Alt Yapi)

Platformin odeme alabilmesi icin asagidaki entegrasyonlar gereklidir.

Kabul edilecek odeme yontemleri:

- Kredi / banka karti : Iyzico veya Sipay (Turkiye lokali, oncelikli)
- Havale / EFT        : Manuel akis ile baslayip banka API ile otomatize edilecek
- PayTR               : Yedek yerel saglayici
- PayPal              : Uluslararasi odemeler
  (Turkiye'de alici sinirlamasi dikkate alinmali)
- Kripto              : NOWPayments veya CoinPayments; BTC, ETH, USDT baz alinabilir

Oneri mimari:

- Her saglayici icin ayri adaptör
- Merkez payment_transactions tablosu
- Fatura ve makbuz otomasyonu
- Hakediş ve komisyon akisi odeme motoru ile entegre
- Kanal hakedis odemeleri odeme motorundan tetiklenir

Uygulama oncelik sirasi:

1. Iyzico (kredi karti)
2. Havale / EFT (manuel -> API)
3. PayTR (yedek yerel)
4. NOWPayments / CoinPayments (kripto)
5. PayPal (uluslararasi)

Detay is akisi: Paket odeme-infra — Odeme Alt Yapisi ve Entegrasyon

## 1. Hedef Urun Konumu

Buyera Asistans, sirketlerin su ihtiyaclarini yoneten cok kiracili bir
platform olmalidir:

- Tenant onboarding
- Firma yapisi, departman, rol ve personel yonetimi
- Proje, RFQ, teklif toplama, revizyon ve onay akislarinin dijital yonetimi
- Tedarikci yonetimi ve ileride platform tedarikci havuzu
- Paketleme, moduler kullanim ve abonelik bazli hizmet modeli

Referans urunlerden cikan yonler:

- PratisPro: talepten siparise moduler satin alma omurgasi
- Promena: enterprise procurement suite + hizmet modeli
- Ihalebul: dis ihale kesfi ve firsat havuzu mantigi

## 2. Ana Mimari Karar

Temel ilke:

- Admin bir personel tipi degildir.
- Admin, tenant sahibi veya tenant yoneticisi hesabidir.
- Personel, tenant icindeki operasyonel kullanicidir.
- Tedarikci, tenant disi ama sistemle etkilesen ayri aktordur.

Bu nedenle sistemin ana kok varligi artik user degil, tenant olmalidir.

## 3. Hedef Domain Modeli

### 3.1 Platform Katmani

Bu katman Buyera Asistans tarafindan yonetilir.

#### platform_users

- id
- full_name
- email
- password_hash
- role
- is_active
- created_at
- updated_at

Kullanim:

- super_admin
- destek / operasyon ekibi

#### subscription_plans

- id
- code
- name
- tier
- monthly_price
- yearly_price
- max_users
- max_suppliers
- max_projects
- feature_flags_json
- is_active

#### platform_features

- id
- code
- name
- description
- is_active

#### platform_supplier_pool

- id
- legal_name
- display_name
- tax_number
- categories_json
- regions_json
- website
- email
- phone
- onboarding_status
- score
- is_active

#### platform_email_templates

- id
- code
- name
- subject_template
- body_template
- is_active

### 3.2 Tenant Katmani

Bu katman musteri sirket hesabinin kok yapisidir.

#### tenants

- id
- slug
- legal_name
- brand_name
- logo_url
- tax_number
- tax_office
- country
- city
- address
- subscription_plan_id
- owner_user_id
- status
- onboarding_status
- created_at
- updated_at

Not:

- Sistemdeki tum operasyonel kayitlar tenant_id ile ayrismalidir.

#### tenant_settings

- id
- tenant_id
- primary_color
- secondary_color
- smtp_mode
- default_system_email_id
- custom_domain
- support_email
- support_phone
- locale
- timezone
- quote_terms_template
- approval_policy_json
- is_active

#### tenant_modules

- id
- tenant_id
- feature_code
- enabled
- limits_json

### 3.3 Tenant Kimlik ve Organizasyon Katmani

#### tenant_users

- id
- tenant_id
- full_name
- email
- password_hash
- system_role
- is_active
- is_invited
- invitation_token
- invitation_expires_at
- created_by_user_id
- created_at
- updated_at

System roller:

- tenant_owner
- tenant_admin
- tenant_member
- supplier_user

#### tenant_departments

- id
- tenant_id
- name
- description
- parent_department_id
- is_active
- created_by_user_id

#### tenant_roles

- id
- tenant_id
- name
- description
- is_system
- hierarchy_level
- parent_role_id
- is_active
- created_by_user_id

#### tenant_role_permissions

- id
- tenant_role_id
- permission_code

#### tenant_user_assignments

- id
- tenant_user_id
- company_id
- department_id
- role_id
- title
- is_primary
- is_active

### 3.4 Tenant Operasyon Katmani

#### tenant_companies

- id
- tenant_id
- name
- logo_url
- address
- email
- phone
- is_active
- created_by_user_id

## 4. Canli Gecis Notlari

14 Nisan 2026 itibariyla canli veritabani uzerinde asagidaki gecis sirasi
gercek hayatta calistirildi ve dogrulandi:

1. Quote approval gecisi icin `required_business_role` kolonu eklendi.
2. Approval mirror preview calistirildi ve duzeltilecek kayit cikmadi.
3. Final approval migration uygulanarak `required_business_role` zorunlu hale getirildi.
4. Canli DB'de eksik kalan tenant/system_role kolonlari ve tenant tabloları
   idempotent bir foundation adimiyla tamamlandi.
5. Guvenli `system_role` eslestirmeleri audit preview/apply ile veritabanina yazildi.
6. Aktif admin zincirinden tenant bootstrap calistirildi.
7. Ortam tek tenantli oldugu icin kalan legacy tenant-scoped kayitlar ayni
   tenant'a kontrollu sekilde backfill edildi.
8. Final audit sonucu:

   - role/system_role issue: 0
   - quote approval transition issue: 0

Bu nokta itibariyla sistem, tenant_id ve system_role alanlari acisindan canli
veritabani seviyesinde minimum calisir tenant omurgasina ulasmistir.

## 5. Operasyonel Kararlar

- `required_business_role`, approval semantiginin ana kaynagidir.
- `required_role`, compatibility mirror olarak tutulur.
- `system_role`, platform ve tenant yetki sinirlarinin ana kaynagidir.
- `business_role`, satin alma operasyon semantigi icin kullanilir.
- Tek tenantli legacy ortamlarda toplu `tenant_id` backfill yalnizca
  veritabaninda tam olarak 1 tenant varsa guvenli kabul edilir.
- Cok tenantli ortamlarda ayni backfill mantigi otomatik uygulanmamalidir;
  sahiplik ve bagliliklar tenant bazinda tek tek dogrulanmalidir.

Not:

- Kucuk musteri tek firma ile calisabilir.
- Buyuk musteri birden fazla bagli sirket veya sube tutabilir.

### 3.5 Tenant Proje ve Tedarik Katmani

#### tenant_projects

- id
- tenant_id
- company_id
- name
- code
- description
- status
- budget
- currency
- created_by_user_id
- start_date
- end_date

#### tenant_suppliers

- id
- tenant_id
- source_type
- platform_supplier_id
- name
- email
- phone
- tax_number
- category_json
- status
- score
- created_by_user_id

source_type:

- private
- platform_network

#### tenant_rfqs

- id
- tenant_id
- project_id
- company_id
- title
- rfq_type
- status
- revision_no
- deadline_at
- created_by_user_id
- approval_policy_id

#### tenant_rfq_items

- id
- rfq_id
- line_no
- item_name
- quantity
- unit
- spec_text
- target_price

#### tenant_rfq_suppliers

- id
- rfq_id
- supplier_id
- invite_status
- invited_at
- last_response_at

#### tenant_supplier_quotes

- id
- tenant_id
- rfq_id
- supplier_id
- status
- total_amount
- currency
- submitted_at

#### tenant_approvals

- id
- tenant_id
- entity_type
- entity_id
- approval_step
- approver_user_id
- decision
- decided_at
- note

## 4. Mevcut Yapidan Yeni Yapiya Gecis Plani

### Faz 1 - Tenant omurgasi

- [x] tenants tablosunu ekle
- [x] tenant_settings tablosunu ekle
- [x] mevcut admin kullanicilar icin tenant kayitlarini olustur
- [x] mevcut sirketleri tenant ile iliskilendir
- [x] users tablosunu tenant mantigina gore ayir
- [x] departments icin sahiplik alanini baslat
- [x] roles icin sahiplik alanini baslat
- [x] tum kritik tablolara tenant_id ekleme envanterini cikar

### Faz 2 - Kimlik ve yetki ayrimi

- [x] system_role ile business_role ayrimini uygula
- [x] admin kavramini personelden ayir
- [x] tenant_owner ve tenant_admin akisini netlestir
- [x] personel olusturma akisini tenant kullanici olusturma akisina cevir
- [x] supplier_user akisini tenant auth'tan bagimsizlastir

### Faz 3 - Onboarding ve UI

- [x] yeni musteri onboarding akisini tasarla
- [x] plan secimi + tenant olusturma ekranlarini tasarla
- [x] ilk tenant admin hesabi akisini tasarla
- [x] ilk kurulum sihirbazi olustur (self-serve public onboarding `/onboarding`)
- [x] login ekranini platform markasina gore guncelle
- [x] activation ekraninda tenant kimligi goster
- [x] ust bar ve dashboard'da tenant branding goster

### Faz 4 - Operasyonel domain tasinmasi

- [x] projects icin tenant zorunlulugu getir
- [x] suppliers icin tenant zorunlulugu getir
- [x] approvals icin tenant zorunlulugu getir
- [x] quote / rfq domainini tenant-rfq modeline tasi
- [x] private supplier ve platform supplier ayrimini ekle

Uygulanan hizli kapanislar:

- [x] project create akisina tenant bootstrap zorunlulugu icin runtime guard eklendi
- [x] supplier create akisina private supplier tenant guard eklendi
- [x] approval request akisina quote tenant readiness guard eklendi
- [x] AdminPage icinde Onboarding Studio sekmesi ile onboarding iskeleti yayinlandi
- [x] quote / rfq gecisi oncesi tenant tutarliligini olcen
  `api/scripts/audit_tenant_rfq_readiness.py` eklendi

### Faz 5 - Ticari SaaS yetenekleri

- [x] paketler ve moduller ekranini ekle
- [x] tenant kullanim limitlerini uygula
- [x] faturalama / abonelik altyapisini planla
- [x] super admin tenant yonetim panelini ayir

## 5. Migrasyon Stratejisi

### Adim 1 - Veri envanteri

- Mevcut tablolarin hangi tenant'a ait olacagini tek tek haritala
- user, company, department, role, project, supplier, quote,
  approval alanlarini tenant perspektifiyle siniflandir

### Adim 2 - Geriye donuk veri kurallari

- Her mevcut admin icin bir tenant olustur
- Adminin olusturdugu company, project, user, department, role
  kayitlarini o tenant'a bagla
- Eger kayit super_admin tarafindan olusturulmus ama aslinda belli bir
  musteriyi temsil ediyorsa manuel esleme listesi cikar

### Adim 3 - Ikili gecis donemi

- Bir sure hem created_by_id hem tenant_id beraber kullanilsin
- Okuma tarafinda tenant_id varsa onu tercih et
- Eksik eski kayitlar icin fallback kuralini gecici olarak koru

### Adim 4 - Tam gecis

- Tum sorgular tenant_id tabanli hale gelsin
- created_by_id sadece audit amacli kalsin veya uygun tablolardan kaldirilsin
- Admin paneli tenant yonetim paneline donussun

## 6. Ekran Agaci ve Menu Mimarisi

### 6.1 Platform Public Alan

- [x] Ana sayfa
- [x] Cozumler
- [x] Fiyatlandirma
- [x] Demo talebi
- [x] Musteri girisi
- [x] Tedarikci girisi

### 6.2 Musteri Onboarding

- [x] Plan secimi (self-serve akis)
- [x] Tenant kaydi (self-serve akis)
- [x] Ilk admin hesabi olusturma (super admin api + AdminPage)
- [x] E-posta dogrulama (invitation_token sistemi)
- [x] Kurulum sihirbazi (self-serve public wizard)

### 6.3 Tenant Admin Menusu

- [x] Genel Bakis
- [x] Firma Yapisi
- [x] Departmanlar
- [x] Roller ve Yetkiler
- [x] Personeller
- [x] Tedarikciler
- [x] Projeler
- [x] RFQ / Teklifler
- [x] Onay Akislari
- [x] Raporlar
- [x] Ayarlar
- [x] Paket ve Kullanim

### 6.4 Personel Menusu

- [x] Dashboard (QuoteList + proje bazli giris)
- [x] Gorevli oldugu projeler (ProjectsTab filtrelemesi)
- [x] RFQ ve teklif akisleri (QuoteList + QuoteDetailPage)
- [x] Onay bekleyen isler (ApprovalDashboard)
- [x] Tedarikci iletisim kayitlari (SuppliersTab)
- [x] Profil ve bildirim ayarlari (SettingsTab profil)

### 6.5 Super Admin Menusu

- [x] Tenantlar
- [x] Tenant category yakalama, filtreleme ve supplier eslesme ozeti
  (public onboarding + AdminPage tenant governance)
- [x] Planlar ve Moduller
- [x] Platform tedarikci havuzu
- [x] Kampanyalar / landing yonetimi
- [x] SMTP / bildirim altyapisi (tenant_settings.smtp_mode + email_service)
- [x] Kullanici ve destek kayitlari
- [x] Finans / abonelik / faturalama
- [x] Platform analitikleri

## 7. UX ve Iletisim Ilkeleri

Platform sadece teknik olarak guclu degil, kullanirken rahat hissettiren
bir deneyim sunmalidir.

Ilkeler:

- Kullanici sisteme girdiginde ne yapacagini anlamali
- Kritik akislar sihirbaz mantigiyla ilerlemeli
- Hata mesajlari teknik degil yol gosterici olmali
- Tedarikci ve musteri iletisimi sade, sicak ve guven veren bir dille
  kurulmalı
- Yogun satin alma operasyonlari icinde stresi azaltan sade ekran dili kullanilmali

### 7.1 Login Renk Paleti Notu (2026-04-20)

Asagidaki mevcut marka renkleri korunmustur:

- Strategic (korundu): bg `#112a25`, accent `#D4AF37`, cta `#D4AF37`
- Supplier (korundu): bg `#1a3a5c`, accent `#0ea5e9`, cta `#0ea5e9`
- Channel (korundu): bg `#2f1a0d`, accent `#f59e0b`, cta `#f6a609`

Yeni eklenen/duzenlenen renkler:

- Platform (yeni): bg `#2a3f67`, accent `#8fb3da`, cta `#8fb3da`
- Platform login hero gradient: `#2a3f67 -> #4d6489 -> #7391b8`
- Stratejik partner login, onceki platform yesil temasina alinmistir:
  `#16302b -> #21453d -> #294d45`
- Tedarikci login sayfasi: `#1a3a5c -> #1e4f78 -> #0f70a8`
- Is ortagi login sayfasi: `#2f1a0d -> #4b2a12 -> #6b3a14`

Not:

- Public navbar `Sisteme Giris` popup'indaki buton renkleri de bu ayirima
  uygun olacak sekilde role-ozel sabitlenmistir.
- Popup butonlari responsive hale getirildi (`min(340px, 100vw-24px)`),
  metin tasmasi engellendi.
- Platform girisi guvenlik/ayrisma gerekcesiyle gizli erisim akisinda
  tutulur (hizli 3 tik).

### 7.2 Platform Operations Faz-2 Okunabilirlik Notu (2026-04-20)

- Platform Operations ekranina `Odak Modu` eklendi.
- Odak Modu acikken kayitlar oncelik skoruna gore siralanir (0-100).
- `Sadece Kritikleri Goster` secenegi ile kritik seviyedeki Stratejik Ortak
  kayitlari filtrelenebilir.
- Son temas tarihi eskidikce (7/14/21 gun esikleri) risk puani otomatik artar.
- Her kartta asagidaki aciklama bloklari standartlastirildi:
  - Ne yapiyor
  - Neden burada
  - Ne yapmali
- Kullaniciya gorunen metinlerde `tenant` ifadesi yerine
  `Stratejik Ortak` dili kullanilir.
- Teknik ve Ingilizce agirlikli gorunen metinler sade Turkce dile cekildi.

## 8. Hemen Sonraki Uygulama Adimlari

- [x] Hedef tablo envanterini mevcut modellerle birebir eslestir
- [x] tenant modelini ve temel migration dosyalarini hazirla
- [x] auth akislarini tenant_owner / tenant_admin / tenant_member olarak ayir
- [x] AdminPage bilgi mimarisini tenant admin paneli mantigina gore yeniden kur
- [x] super admin ile tenant admin navigasyonunu ayir
- [x] tenant scope envanterini otomatik dogrulayan
  `api/scripts/audit_tenant_scope_inventory.py` scriptini ekle
- [x] `api/scripts/bootstrap_tenants.py` scripti ile mevcut adminlerden
  tenant olusturma, company baglama ve tenant user system_role
  normalizasyonunu tek akista calistirilabilir hale getir

Bugunden sonraki uygulama backlog'u, soyut baslik yerine teslim paketi
mantigiyla izlenmelidir.

### Paket 1 - Auth ve Kimlik Sertlestirme

Durum notu:

- Teknik helper/guard cleanup ve hedefli backend/frontend regresyon
  turlari bu paket icin yesil duruma getirildi.
- Kalan [~] maddeler agirlikli olarak urun semantigi, UX ayrimi veya
  dokumantasyon seviyesindeki tamamlayici isler olarak okunmali.
- Bir sonraki uygulama diliminde Paket 1 altinda yeni auth helper
  dagitimi yerine urun akislarinda kalan owner/admin/member davranis
  farklari veya sonraki paket gecisleri hedeflenebilir.

- [x] login / refresh / me akislari icin role alanini sadece
  compatibility fallback seviyesine indir
- [x] tenant_owner / tenant_admin / tenant_member ayrimini tum auth
  guard, menu ve redirect kararlarinda tamamla
- [x] supplier_user akisini tenant ic kullanici oturumundan net sekilde ayir
- [x] bu paket sonunda auth payload orneklerini README ve test
  fixture'larinda tek formatta sabitle
- [x] tenant_owner branding ve workspace kimligini tenant_admin'den ayri hale getir
- [x] tenant_owner icin tenant kimligi ve temel ayarlar yazma yetkisini
  tenant_admin'den ayir
- [x] tenant governance aksiyonlarini helper ve test seviyesinde
  super_admin odakli sinirla
- [x] backend tenant governance authz helper'ini admin router tenant
  endpointlerinde standartlastir
- [x] sqlite tabanli backend regresyon paketinde tenant governance +
  settings + auth birlikte tekrar yesile dondu
- [x] advanced settings icinde paylasilan SMTP profil yonetimini helper
  bazli hale getir
- [x] advanced settings router icindeki ham admin role kontrollerini
  shared authz helper'larina tasi
- [x] admin ve advanced settings router icindeki tekrar eden rol
  kumelerini shared authz sabitlerinde topla
- [x] report router icindeki quote erisim guard'larini ortak authz
  helper mantigina yaklastir
- [x] supplier router icindeki creator veya super_admin guard
  tekrarlarini yardimci fonksiyonda birlestir
- [x] supplier router icindeki tenant veya creator tabanli query scope
  filtrelerini ortak yardimcida topla
- [x] admin router icindeki proje olusturma ve global gorunum rol
  kumelerini authz helper katmanina tasi
- [x] admin router icindeki son super_admin silme koruma dallarini
  isimli helper'lara ayir
- [x] admin router icindeki kullanici system_role cozumleme ve
  reserved role mantigini authz katmanina tasi
- [x] admin router icindeki admin-managed account ayrimini authz helper
  ve query helper katmanina tasi
- [x] frontend auth helper katmaninda platform workspace label ve
  platform staff ayrimini ortaklastir
- [x] AdminPage icindeki platform staff ayrimini frontend auth helper ile standartlastir
- [x] PersonnelCreateModal icindeki privileged role ve varsayilan
  system_role kararlarini frontend auth helper katmanina tasi
- [x] rol ikonu fallback mantigini frontend auth helper katmaninda ortaklastir
- [x] RolesTab icindeki rol hiyerarsisi ve normalize fallback mantigini
  frontend auth helper katmanina tasi
- [x] frontend auth/route/settings/admin helper refactorlari icin
  genisletilmis Vitest paketi tekrar yesile dondu
- [x] backend auth/settings/governance ve frontend auth/routing/settings/
  admin hedefli dogrulama turlari birlikte tekrar yesile dondu
- [x] sqlite tabanli izole backend authz paketindeki cyclic FK teardown
  warning'i kaldir
- [x] sqlite tabanli daha genis backend auth/settings/authz paketi tekrar
  yesile dondu
- [x] admin router icindeki kalan dusuk seviyeli legacy role guard'lari
  shared authz helper ve sabitlerine bagla
- [x] user profile router icindeki ham admin profile erisim rol kumesini
  shared authz helper'a tasi ve authz testi ekle
- [x] system email router icindeki ham admin erisim rol kumesini shared
  authz helper'a tasi ve authz testi ekle
- [x] approval router icindeki admin bypass kontrolunu ortak authz
  helper'a indir ve pending approval gorunurlugunu test et
- [x] admin router icindeki tekrar eden super_admin veya tenant_admin
  yuzey kontrolunu dar kapsamli authz helper'a tasi
- [x] frontend workspace fallback etiketlerini owner/admin/member
  semantigine yaklastir ve DashboardPage'i ortak helper'a bagla
- [x] frontend auth session katmaninda legacy user payload'larini
  business_role ve system_role fallback'lariyla normalize et
- [x] settings yuzeyinde super_admin, tenant_owner, tenant_admin ve
  platform_support ayrimini backend ve frontend testleriyle sabitle
- [x] admin tenant governance formunu platform support veya operator icin
  gercek salt-okunur moda getir ve super_admin edit akisini koru
- [x] backend tenant governance lifecycle endpointlerinde listeleme
  disinda create ve update guard'larini da super_admin odakli
  testlerle sabitle
- [x] platform staff icin personel sekmesini salt-okunur moda al ve yazma
  aksiyonlarini gizle veya kilitle
- [x] platform staff icin companies, departments ve roles sekmelerini de
  salt-okunur moda getir
- [x] platform staff icin projects sekmesini de salt-okunur moda getir ve
  yeni proje veya silme aksiyonlarini kapat
- [x] platform staff icin suppliers sekmesini de salt-okunur moda getir;
  inceleme akisini koruyup create-delete-user-management aksiyonlarini kapat
- [x] platform staff helper semantiginde super_admin'i ayir ve
  AdvancedSettingsTab icinde tum yazma aksiyonlarini gercek salt-okunur
  moda kilitle

- 2026-04-15 kapanis notu: Paket 1 altindaki kalan owner/admin/member
  semantik maddeleri de hedefli regresyon turlariyla kapatildi.
  Backendte tests/test_auth.py + tests/test_tenant_governance_authz.py
  paketi 20/20 yesil dondu; tenant_owner workspace_label ayrimi,
  tenant identity write izni ve tenant governance endpointlerinin
  super_admin odakli guard'lari tekrar dogrulandi. Frontendte
  src/test/settings-tab.test.tsx + src/test/permissions.test.ts +
  src/test/auth-routing.test.tsx +
  src/test/admin-page-tenant-governance.test.tsx paketi 20/20 yesil
  dondu; boylece menu, redirect, workspace label ve salt-okunur
  governance davranislari tenant_owner/tenant_admin/platform_staff
  ekseninde sabitlendi.

### Paket 2 - Approval Business Role Sonlandirma

- [x] Tum backend okuma/yazma noktalarinda required_business_role birincil olsun
- [x] Frontend approval ekranlarinda required_role fallbackleri sadece
  gecis emniyeti icin kalsin
- [x] Approval endpointleri icin required_role_mirror alaninin
  dokumantasyonunu ve test beklentilerini tamamla
- [x] audit script ile son kez bos veya drift eden approval kaydi olmadigini raporla

### Paket 3 - Tenant Admin Operasyon Akisi

- [x] personel olusturma akisindaki legacy admin/personnel varsayimlarini
  tenant user odakli API kontratina cevir
  - 2026-04-15 ilerleme: backend davetli kullanici olusturma akisinda
    password zorunlulugu kaldirildi. Frontend admin servisinde
    TenantUser alias katmani eklendi. PersonnelCreateModal,
    AdminPage ve PersonnelTab ana akislari create/update/list/write
    tarafinda bu alias'lari kullanmaya basladi. Super admin'in
    platform governance sekmelerinden dusmesi regresyonu da kapatildi.
  - 2026-04-15 ilerleme: tenant-user alias gecisi PersonnelDetailPage,
    ProjectCreateModal, ProjectDetailPage ve QuoteCreatePage okuma
    katmanina genisletildi. Bu ekranlar artik getTenantUsers/
    TenantUser kontratini kullaniyor. Ilgili frontend regresyon paketi
    8/8 yesil kaldi.
  - 2026-04-15 ilerleme: proje sorumlusu atama/kaldirma akisi da
    tenant-user diline yaklastirildi. project.service.ts icine
    addProjectTenantUser/removeProjectTenantUser aliaslari eklendi ve
    ProjectDetailPage bu yeni isimleri kullanmaya basladi. Iliskili
    proje/admin frontend regresyon paketi 6/6 yesil kaldi.
  - 2026-04-15 ilerleme: kullaniciya gorunen admin UI metinleri
    tenant-user semantigine yaklastirildi. PersonnelCreateModal,
    PersonnelTab ve PersonnelDetailPage icindeki temel basliklar,
    bildirimler ve hata mesajlari "Kullanici" diliyle guncellendi.
    Ilgili frontend regresyon paketi 7/7 yesil dondu.
  - 2026-04-15 ilerleme: tenant admin scope sertlestirmesinde proje
    dosya yuzeyi kapatildi. admin.py icindeki proje dosyasi listeleme,
    yukleme ve silme endpointleri _ensure_project_scope +
    _ensure_project_member_or_global guard'larina baglandi. Boylece
    tenant admin baska tenant projesinin dosyalarini goremez veya
    yukleyemez. Ilgili backend paketi 5/5 yesil dondu.
  - 2026-04-15 ilerleme: admin proje uye atama/kaldirma endpointleri
    yalnizca proje uyeligine dayali olmaktan cikarildi.
    /admin/users/{user_id}/projects/{project_id} POST/DELETE
    endpointleri require_admin_user guard'ina baglandi. Artik siradan
    tenant member proje uyesi olsa bile admin yuzeyi uzerinden
    kullanici atayamaz veya cikarmaz. Ilgili backend paketi 7/7
    yesil dondu.
  - 2026-04-15 ilerleme: kullanici firma atamalari listeleme endpointi
    de admin yuzeyi olarak sertlestirildi.
    /admin/users/{user_id}/company-assignments GET endpointi
    require_admin_user guard'ina baglandi. Artik tenant_member admin
    API uzerinden baska kullanicinin firma assignment bilgisini
    cekemez. Ilgili backend paketi 8/8 yesil dondu.
  - 2026-04-15 ilerleme: admin permission, role ve company kataloglari
    da admin guard altina alindi. /admin/permissions, /admin/roles ve
    /admin/companies endpointleri require_admin_user guard'ina
    baglandi. Artik tenant_member bu kataloglari admin API uzerinden
    okuyamaz. Ilgili authz paketleri 9/9, 10/10 ve 11/11 yesil dondu.
  - 2026-04-15 ilerleme: own-tenant scope senaryosu backend tarafinda
    butunlu olarak sabitlendi. tenant_admin_scope_scenario,
    admin_user_management_authz ve ilgili katalog authz paketleri;
    company, role, department ve company-assignment yuzeylerinde
    own-tenant gorunurluk ile cross-tenant denial kontratini dogruladi.
    Bu hat 7/7, 13/13, 17/17 ve 18/18 gibi genisleyen focused paketlerle
    tekrar tekrar yesil kaldı.
  - 2026-04-15 ilerleme: tenant tutarliligi kurallari derinlestirildi.
    Company-assignment create/update akislarinda kullanici, firma,
    rol ve departman referanslarinin ayni tenant kapsaminda olmasi 400
    ile zorunlu hale getirildi. Benzer sekilde user update,
    role parent secimi ve project responsible user seciminde cross-tenant
    payload denemeleri reddedildi.
  - 2026-04-15 ilerleme: benzersizlik ve mutasyon kurallari tenant
    scope'a cekildi. company, department, role ve project code duplicate
    kontrolleri tenant bazli hale getirildi; baska tenant kayitlarini
    guncelleme, silme, atama veya tasima denemeleri senaryo testleriyle
    sabitlendi.
  - 2026-04-15 ilerleme: frontend admin yuzeyleri backend kontratiyla
    hizalandi. PersonnelDetailPage, admin-readonly-tabs, modal workflow
    ve personnel-tab permissions testleri ile tenant_admin icin editable
    akislar; platform staff ve admin-managed hedefler icin read-only
    davranis netlestirildi.
  - 2026-04-15 ilerleme: hassas admin aksiyonlari icin authz kapsamasi
    genisletildi. reset password, contact-email, project membership,
    company logo, project file ve arsivleme yuzeylerinde own-tenant
    disi tum denemeler reddedildi.
  - 2026-04-15 ilerleme: katalog ve workspace yetki modeli ortak bir
    catiya toplandi. admin/departments, admin/users, admin/projects,
    admin/companies, admin/roles ve admin/permissions endpointleri;
    platform_support/operator read-only davranisini koruyup generic
    tenant_member erisimini sinirlayan helper'lara baglandi.
  - 2026-04-15 ilerleme: project ve quote write kontratlari da ayni
    modelle hizalandi. project file, project detail, quote write ve
    comparison report yuzeylerinde platform staff icin salt-okunur akiş,
    procurement rolleri icin own-scope write davranisi testlerle
    sabitlendi.
  - 2026-04-15 ilerleme: Paket 3 kapsamindaki senaryo kuyruğu sonunda
    tenant admin'in kendi tenant'i icinde company, department, role,
    user ve assignment CRUD yapabildigi; baska tenant kaynaklarini ise
    goremedigi, guncelleyemedigi veya silemedigi net bir kontrata
    donustu.
- [x] tenant admin'in yalnizca kendi tenant organizasyonunu yonettigi
  ekran/endpoint kontratini tamamla
- [x] firma, departman, rol ve assignment CRUD akislarinda tenant
  zorunlulugunu kalan kenar durumlarla kapat
- [x] bu paket sonunda tenant admin icin minimum calisir operasyon
  senaryosunu test ile sabitle

- 2026-04-15 kapanis notu: Paket 3 kapsamindaki tenant-admin
  own-tenant kontrati; broad scope senaryosu, user-management authz,
  tenant governance authz ve katalog/project regresyonlariyla ekran ve
  endpoint seviyesinde yeterli kapsama esigine geldi. Company,
  department, role, assignment, user, project ve project-file
  yuzeylerinde hem own-tenant mutasyon hem de cross-tenant denial
  kontratlari testle sabitlendi.

### Paket 4 - Quote/RFQ Domain Ayrisma

- [~] quote modelinin tenant-rfq hedef modeline nasil evrilecegini
  kod seviyesinde parcali migration backlog'una cevir
- [x] project, supplier, approval ve quote baglarinda tenant
  zorunlulugunu kalan fallback sorgulardan temizle
- [x] private supplier ve platform supplier ayrimini domain
  servisleri ve UI filtrelerinde gorunur hale getir
- [x] bu paket sonunda quote import, dispatch, approval ve supplier
  karsilastirma akislarini tenant bazli smoke test ile tekrar dogrula

- 2026-04-15 analiz: quote modelinin tenant-rfq hedefi icin parcali
  migration backlog'u cikarildi. Mevcut quote modeli hem RFQ basligini
  hem legacy quote kolonlarini ayni tabloda tasiyor; supplier teklifleri
  supplier_quotes tablosuna, approval zinciri ise quote_approvals
  tablosuna quote_id uzerinden bagli.

  1. RFQ aggregate sinirini netlestir.
  2. Kimlik ve tenant zorunlulugu icin null veya fallback baglari raporla.
  3. Legacy kolonlari snapshot ve drop adayi olarak siniflandir.
  4. Supplier teklif baglarina tenant tutarlilik guard'i ekle.
  5. Approval baglarini required_business_role eksenine tasi.
  6. Schema ve endpoint katmaninda RFQ alias planini tamamla.
  7. Report ve comparison zincirini tenant-aware join backlog'una bagla.
  8. Audit, backfill, refactor ve final isimlendirme sirasini koru.

  - 2026-04-15 analiz: Paket 4 madde 2 icin fallback sorgu envanteri
    cikarildi. Temel hedef; quotes.py, quote_router.py,
    quote_service.py ve quote_approval_service.py icinde id tabanli
    lookup desenini tenant-scoped helper mantigina tasimak,
    project.tenant_id disindaki fallback kaynaklari kaldirmak ve
    report/supplier zincirini tenant-consistency assert'leriyle
    birlestirmekti.
  - 2026-04-15 ilerleme: Bu scoped lookup/refactor hatti tamamlandi.
    Router katmaninda quote ve project lookup'lari tenant-scoped
    helper'lara toplandi; service katmaninda supplier quote revision ve
    approval akislarina parent-quote temelli scope filtreleri eklendi.
    Ilgili quote regression paketleri 10/10 ve 18/18 yesil dondu.
  - 2026-04-15 ilerleme: Tenant consistency audit/backfill zemini de
    hazirlandi. audit_quote_tenant_consistency.py scripti quotes,
    supplier_quotes, quote_approvals, quote_status_logs ve report
    zincirini tarayip JSON/CSV cikti vermeye basladi. Mevcut veri
    uzerindeki taramada issue_counts bos kaldi; bu da acil bir
    backfill gereksinimi olmadigini gosterdi.
  - 2026-04-15 ilerleme: Supplier source_type ayrimi hem API hem UI
    seviyesinde gorunur hale getirildi. supplier_router tarafinda
    private/platform_network filtreleri ve visible-supplier helper'i
    eklendi; SendQuoteModal, QuoteList ve QuoteTab tarafinda ayni ayrim
    kaynak sekmeleri ve rozetlerle yuzeye tasindi.
  - 2026-04-15 ilerleme: Quote dispatch, approval, supplier secimi ve
    comparison halkasini kapsayan tenant bazli smoke test zinciri
    sabitlendi. Cross-tenant comparison erisimi 403 ile reddedildi ve
    report_router tarafinda tenant-aware scoped quote helper'i ortak
    desen haline getirildi.
  - 2026-04-15 ilerleme: RFQ adapter katmani schema, router, servis ve
    frontend yuzeylerine parcali olarak yayildi. RfqCreate/RfqUpdate/
    RfqOut alias'lari eklendi; response_model ve request katmani RFQ
    sozlugune yaklasti; frontend servisleri ve sayfalari rfq_id
    normalize eden alias fonksiyonlari kullanmaya basladi.
  - 2026-04-15 ilerleme: RFQ gorunurlugu UI metinlerine ve export
    artefaktlarina da tasindi. Quote detail, comparison report ve
    create page basliklari RFQ referansini gostermeye basladi; export
    dosya adlari da rfq_[id] formatina yaklasti.
  - 2026-04-15 ilerleme: Legacy quote kolon temizligi icin model,
    migration ve audit omurgasi hazirlandi. Model ustunde
    LEGACY_MIRROR_COLUMNS ve SNAPSHOT_COLUMNS sabitleri eklendi;
    cleanup plan SQL'i, audit_quote_rfq_legacy_cleanup.py scripti ve
    final drop migration'i hazirlandi. Audit mevcut veri uzerinde temiz
    dondu ve kapanis kriteri final drop migration'in uygun release
    penceresinde uygulanmasina indi.

### Paket 5 - SaaS Ticari Katman

- [x] paketler ve moduller ekranini super admin yuzeyinde ac
- [x] tenant kullanim limitlerini ayar ve olusturma akislarinda
  enforcement seviyesine getir
- [x] abonelik/faturalama altyapisi icin veri modeli ve webhook
  entegrasyon backlog'unu ayir
- [x] platform operasyon rolleri icin super admin disi izleme/destek
  ekranlarini netlestir

  - 2026-04-15 ilerleme: Paket 5 icin ilk calisan dikey acildi.
    subscription-catalog endpoint'i ve AdminPage icindeki
    "Paket ve Kullanim" sekmesi ile starter/growth/enterprise plan
    omurgasi gorunur hale geldi.
  - 2026-04-15 ilerleme: Plan enforcement katmani proje, aktif ic
    kullanici ve aktif private supplier limitlerine runtime seviyesinde
    baglandi. Subscription service tenant create/update akislarini plan
    kodlariyla hizaladi; ilgili enforcement regresyon paketleri 35/35 ve
    43/43 yesil dogrulandi.
  - 2026-04-15 ilerleme: Paket ve Kullanim yuzeyi canli kullanim
    snapshot'i, tenant portfoyu, risk rozetleri, plan/risk filtreleri ve
    KPI kartlari ile derinlestirildi. Super admin artik limit baskisi ve
    limit asimi sinyallerini billing detayina inmeden okuyabiliyor.
  - 2026-04-15 ilerleme: Billing veri modeli ve API omurgasi acildi.
    billing.py modelleri, foundation migration'i, billing_router
    endpointleri ve billing_service ile subscription, webhook ve invoice
    zinciri idempotent bir omurgaya baglandi.
  - 2026-04-15 ilerleme: Billing overview super admin UI'a tasindi.
    Billing Operasyonlari paneli aktif subscription kayitlari, son
    webhook olaylari, acik fatura KPI'lari, tahsilat toplami ve son
    fatura kartlari ile genisletildi; fatura, webhook ve abonelik durum
    filtreleri de eklendi.
  - 2026-04-20 ilerleme: Paket/limit ticari katmani tenant admin ve
    super admin yuzeylerinde gercek write-path ile tamamlandi. Sirket,
    kullanici, proje, teklif ve proje dosyasi limitleri runtime
    enforcement katmanina baglandi; limit asimi mesajlari onerilen ust
    paket ve ilgili ekstra hak isimleriyle dogrudan yonlendirme verir
    hale geldi.
  - 2026-04-20 ilerleme: Public pricing yonetimi JSON fallback'ten form
    tabanli operasyon paneline tasindi. Stratejik partner planlari,
    add-on katalogu, supplier paketleri ve premium feature fiyatlari
    super admin tarafinda form ile create/update/delete akislariyla
    yonetilir hale geldi.

  Etkilenen dosyalar / yuzeyler (2026-04-20):

  - Backend pricing ve enforcement: api/services/subscription_service.py,
    api/services/public_pricing_service.py, api/routers/admin.py,
    api/routers/quotes.py, api/routers/onboarding_saas.py,
    api/schemas/onboarding_saas.py
  - Tenant admin ticari yuzeyi: web/src/pages/AdminPage.tsx,
    web/src/utils/subscriptionLimitErrors.ts
  - Limit asimi write-path UX'i: web/src/components/CompanyCreateModal.tsx,
    web/src/components/ProjectCreateModal.tsx,
    web/src/components/PersonnelCreateModal.tsx,
    web/src/pages/QuoteCreatePage.tsx,
    web/src/pages/ProjectDetailPage.tsx
  - Super admin fiyat yonetimi: web/src/pages/PublicPricingAdminPage.tsx
  - Ticari talep ve add-on satin alma operasyonu:
    api/models/payment.py, api/routers/onboarding_router.py,
    api/routers/admin.py, web/src/pages/DemoRequestPage.tsx,
    web/src/components/PremiumFeaturePurchasePanel.tsx,
    web/src/services/payment.service.ts,
    web/src/services/admin.service.ts

  Kisa release checklist (Paket 5 / 2026-04-20):

  - [x] Stratejik partner plan limitleri tenant kullanim snapshot'i ile
    ayni anahtar setinde hizalandi
  - [x] Sirket, kullanici, proje, teklif ve proje dosyasi write-path
    enforcement akislari aktif edildi
  - [x] Tenant admin limit asimi mesajlari paket ve add-on CTA'lari ile
    yonlendirilebilir hale getirildi
  - [x] Super admin public pricing paneli plan/add-on/premium feature
    icin form tabanli create/update/delete akislarina tasindi
  - [x] Donusum plani Paket 5 notlari etkilenen dosyalar ve teslim
    yuzeyleri ile guncellendi
  - [x] Ticari talep kuyrugu owner atama, durum KPI ve filtreleri ile
    admin packages sekmesinde isletilebilir hale getirildi
  - [x] Subscription add-on haklari icin yenileme, iptal ve bitis tarihi
    yonetimi eklendi
  - [x] Ticari talep create/update olaylari dis webhook ile CRM veya
    ticket sistemlerine dusurulebilir hale getirildi
  - [x] Public ticari talep formu backend'e kalici kayit atar hale
    getirildi ve packages sekmesinde admin kuyrugu olusturuldu
  - [x] Premium feature odeme paneli kapasite add-on satin alma ve
    dogrulama akislarini da kapsayacak sekilde genisletildi
  - [x] Admin packages sekmesine ticari webhook ayari karti ve
    subscription add-on tenant/durum filtreleri eklendi
  - [x] Ticari webhook secret'i admin panelinden rotate veya temizle
    akisi ile yonetilebilir hale getirildi
  - [x] Public demo talebi ile admin packages ticari operasyon
    akislari icin hedefli frontend regresyon testleri guncellendi
  - [x] Discovery Lab kritik hatlarinda frontend test drift'i
    stabilizasyonu tamamlandi; admin governance ve public pages
    hedefli regresyon paketi 72/72 yesil dogrulandi
  - [x] Ikinci axios istemcisinde request interceptor icin headers
    baslatma sertlestirmesi uygulanarak import-time crash riski
    runtime seviyesinde giderildi
  - [x] Paket 5 kapanis notu, Discovery Lab test hizalama ve
    hedefli regresyon sonucu ile dokumante edildi
  - 2026-04-15 ilerleme: Platform Operasyonlari yuzeyi super admin disi
    roller icin acildi. platform_overview ve ayri Platform Operasyonlari
    sekmesi; onboarding kuyrugu, owner atama, branding eksigi, pasif
    tenant KPI'lari ve triage kartlariyla gercek bir izleme/destek
    workspace'i haline geldi.
  - 2026-04-15 ilerleme: Destek workflow'u kalici tenant alanlarina
    baglandi. support_owner_name, support_last_contacted_at,
    support_notes, support_status ve support_resolution_reason alanlari
    ile patch endpoint'i eklendi; platform_support ve platform_operator
    bu workflow alanlarini guncelleyebilir hale geldi.
  - 2026-04-15 ilerleme: Platform Operasyonlari queue'su owner, durum,
    temas tazeligi ve toplu aksiyonlar ile olgunlasti. Filtreler,
    KPI kartlari, "Beni Ata", "Gorunenleri Bana Ata" ve
    "Gorunenleri Isleme Al" quick-action'lari ile triage akisi
    hizlandirildi. AdminPage testleri bu hattı 10/10 yesil sabitledi.

### Paket 6 - Rol/Departman/Personel Izinleri ve Personel IA

- [x] Rol/departman/personel izinleri icin tek referans dokumani
  olustur ve ana plana bagla
- [x] Personeller bilgi mimarisini 3 ana segmente ayir:
  Portal Personelleri, Stratejik Partnerler, Tedarikciler
- [x] Stratejik Partner ve Tedarikci listelerinde satir bazli personel sayaci goster
- [x] Stratejik Partner/Tedarikci satirina tiklayinca alt personel
  listesini acilan detayda goster
- [x] Menu agacini Turkce adlarla kesinlestir
  (tenant/governance gibi metinleri is dilinde kaldir)
- [x] Rol tabanli menu gorunurluk matrisi, aksiyon matrisi ve scope
  kurallarini kodda tek kaynaktan besle
- [x] Kisiye ozel izin override (Acik/Kapali toggle) veri modelini ve
  API kontratini ekle
- [x] Canli yetki onizlemesini kisiye ozel override ile entegre et
  (yesil onay / kirmizi X)
- [x] Menu alt acilimlari icin granular izin secimi ekle (menu bazli alt yetkiler)
- [x] Ust rolun alt roller icin izin ac/kapat yapabildigi delege modeli ekle
- [x] Bu paketi backend + frontend test paketleriyle yesile sabitle

- 2026-04-16 plan notu: Bu paketin detayli is akisi, kararlar, veri
  modeli ve durum takibi docs/ROL_DEPARTMAN_PERSONEL_IZINLERI.md
  dosyasinda yonetilir.
- 2026-04-16 ilerleme: PersonnelTab bilgi mimarisi 3 segmente ayrildi.
  Portal Personelleri mevcut tablo akisiyla; Stratejik Partner ve
  Tedarikci personeli ise grup satiri, personel sayaci ve acilir alt
  liste mantigiyla calisir hale getirildi.
- 2026-04-16 ilerleme: Permission override ve delegation omurgasi
  eklendi. permission_override modeli, admin router endpointleri ve
  PersonnelCreateModal yetki onizlemesi menu/alt-menu bazli
  Acik/Kapali toggle davranisiyla kalici hale getirildi.
- 2026-04-16 ilerleme: Paket 6 test paketi yesile sabitlendi.
  backendte permission override/delegation authz paketi 14/14,
  frontendte permission matrix paketi 13/13 yesil dondu. Override map,
  menu preview ve farkli profil senaryolari sabitlendi.
- 2026-04-16 ilerleme: 4-scope mimari implementasyon baslangici da
  acildi. channel, payment ve user modellerindeki yeni scope yapisi;
  ilgili router ve servislerle birlikte ana uygulamaya baglandi.
- 2026-04-16 ilerleme: Payment provider katalogu iyzico, PayTR,
  ParamPOS, Sipay, Havale/EFT ve PayPal readiness gorunumu ile
  genisletildi.
  /api/v1/payment/providers endpoint'i 200 donuyor. bank_transfer
  akisi uygulanabilir fallback olarak eklendi; PayTR ve Sipay
  adapterlari iskelet seviyesinde hazirlandi.
- 2026-04-16 ilerleme: campaign/referral odul sistemi ilk calisir
  surume geldi. campaign modeli, servis ve admin router hattiyla
  kampanya, kural, event, participant ve reward grant omurgasi
  kuruldu; CampaignsTab uzerinden temel admin akisi smoke test ile
  dogrulandi.

## 8B. Kalan Bilincli Legacy Role Kullanımlari

Bu bolum, system_role gecisi devam ederken bilincli olarak korunan
role bagimliliklarini ayirir.

Gecici ama bilincli korunan alanlar:

- Auth payloadlarinda role alani halen tasiniyor; mevcut istemci ve
  eski token akislariyla uyumluluk icin korunuyor.
- Satin alma onay zinciri ve required_role alanlari halen business
  role mantigiyla calisiyor; bunlar system_role degil operasyonel gorev
  roludur.
- Test/seed verilerinde satinalma_* rolleri halen uretiliyor; bu
  alanlar procurement is akislarini populate etmek icin gerekli.
- Gecis scriptlerinde legacy role kontrolu, eski veriyle geriye
  uyumluluk icin ikinci kaynak olarak korunuyor.

Sonraki temizlik adaylari:

- Auth response ve token tuketen frontend kodunda role alaninin ne
  kadar daha gerekli oldugunu azaltmak.
- [x] Quote approval zincirini business_role semantigine gecis icin
  hazirlamak: required_business_role alani eklendi, payload ve
  migration taslagi olusturuldu.
- [x] legacy role ile system_role birlikteligini raporlayan bir
  migration denetim komutu eklemek. Dosya:
  api/scripts/audit_role_system_role_consistency.py
- [x] role/system_role denetim aracina guvenli auto-fix dry-run/apply modu eklemek.
- [x] denetim aracina JSON ve CSV dosya cikti destegi eklemek;
  terminal cikisi olmasa da workspace icinde rapor alinabilsin.

Required_role kaldirma son faz checklisti:

- [x] Tum backend okuma/yazma noktalarinda required_business_role birincil olsun.
- [x] Frontend approval ekranlarinda required_role fallbackleri sadece
  gecis emniyeti icin kalsin.
- [x] Veritabani denetimi ile required_business_role bos kayit kalmadigi dogrulansin.
- [x] required_role icin yazim durdurulsun, sadece okuma fallbacki kalsin.

- [x] Son-faz migration taslagi hazirlansin: required_business_role
  NOT NULL, required_role nullable compatibility mirror olsun.
- [x] Son migration ile required_role kaldirilsin veya compatibility
  view seviyesine indirilsin.

  - 2026-04-15 ilerleme: Paket 2 icin approval write-path canonical
    alana daraltildi. Yeni approval kayitlari artik required_role
    mirror yazmiyor; sync fonksiyonu yalnizca legacy kayitlardan
    required_business_role backfill etmek icin kullaniliyor. Hedefli
    approval regresyon paketi 14/14 yesil dogrulandi.
  - 2026-04-15 ilerleme: approval transition auditi mevcut veri uzerinde
    temiz dondu. approval-transition-audit JSON/CSV ciktilari;
    total_quote_approvals=6, quote_approvals_with_issues=0 ve
    repair_preview.preview_rows=0 sonucunu verdi. Boylece drift
    dogrulamasi tamamlandi.
  - 2026-04-15 ilerleme: approval endpoint payload sozlesmesi
    sabitlendi. pending approval response'lari required_business_role
    ve label alanlarini birincil, required_role_mirror alanini ise
    compatibility veri olarak dondurur hale geldi. Hedefli regresyon
    paketi tekrar 14/14 yesil dondu.
  - 2026-04-15 ilerleme: final compatibility migration'i hazirlandi.
    cleanup migration'i required_role mirror alanini DB tarafinda
    compatibility seviyesine indirirken, API response'ta bu degeri
    required_business_role uzerinden sentezlemeye devam ediyor.
    Null mirror senaryosuyla hedefli approval paketi 15/15 yesil kaldı.

## 8A. Mevcut Model -> Hedef Model Esleme Envanteri

Bu bolum mevcut kod tabanindaki modellerin yeni tenant mimarisindeki karsiligini
ve uygulanacak donusum tipini tanimlar.

### Kimlik ve Organizasyon

#### users -> platform_users + tenant_users

Mevcut durum:

- Tum ic kullanicilar ayni users tablosunda
- role alani hem sistem erisimini hem is rolunu tasiyor
- created_by_id tenant izini dolayli olarak tasiyor
- invitation_token ve invitation_accepted ic kullanici aktivasyonunda kullaniliyor

Hedef donusum:

- super_admin ve platform operasyon hesaplari platform_users katmanina ayrilacak
- musteri kullanicilari tenant_users yapisina alinacak
- role alani ikiye ayrilacak:
  - system_role: tenant_owner, tenant_admin, tenant_member, supplier_user
  - business_role: satin_alma_direktoru, satin_alma_yoneticisi, finans_onayci vb.

Donusum tipi:

- [ ] tablo bolunmesi
- [ ] auth mantiginin yeniden yazimi
- [ ] eski role verilerinin map edilmesi

#### departments -> tenant_departments

Mevcut durum:

- artik created_by_id var
- isim su an global unique davranisina yakin kurgulanmis

Hedef donusum:

- tenant_id zorunlu olacak
- isim unique olmaktan cikacak, tenant icinde unique olacak
- parent_department_id ile hiyerarsi desteklenecek

Donusum tipi:

- [ ] tenant_id ekle
- [ ] unique indexleri tenant bazina cek

#### roles -> tenant_roles

Mevcut durum:

- artik created_by_id var
- permission iliskileri global role_permissions tablosu ile kurulu
- admin ve super_admin gibi sistem rolleriyle operasyon rolleri ayni kavramda bulusuyor

Hedef donusum:

- tenant_roles sadece tenant icindeki is rollerini tutsun
- sistem rolleri role tablosundan cikarilsin
- permission atamalari capability bazli korunabilir ama tenant bagli hale gelsin

Donusum tipi:

- [ ] sistem rolleri ile is rollerini ayir
- [ ] tenant_id ekle
- [ ] role_permissions iliskisini tenant rollerine bagla

#### company_roles -> tenant_user_assignments

Mevcut durum:

- user, company, role, department baglantisini ayni tabloda tutuyor
- sub_items_json ile departman alt kirilimlari tasiniyor

Hedef donusum:

- tenant_user_assignments ana atama tablosuna donusecek
- title, is_primary ve gerekirse scope alanlari eklenecek

Donusum tipi:

- [ ] tablo yeniden adlandirma veya yeni tabloya tasima
- [ ] tenant_id zincirini company veya user uzerinden dogrulama

### Tenant Varliklari

#### companies -> tenant_companies

Mevcut durum:

- created_by_id var
- user_company ve company_department ile iliski kuruluyor
- musterinin firma kaydi ile tenant kavrami birbirine karismis durumda

Hedef donusum:

- tenant kavrami company ustune binmeyecek
- company tenant icindeki firma/sube kaydi olacak
- tenant ana musteri kimligi, company ise org birimi olacak

Donusum tipi:

- [ ] tenant_id ekle
- [ ] owner mantigini tenant uzerine tasi
- [ ] mevcut ana firma kayitlarini tenant default company olarak esle

#### projects -> tenant_projects

Mevcut durum:

- created_by_id var
- company_id ile bagli
- user_projects ve project_permissions ile operasyonel erisim tanimlaniyor

Hedef donusum:

- tenant_id zorunlu olacak
- company_id tenant icindeki org birimini gosterecek
- proje yetkileri tenant role/capability modeliyle uyumlu hale getirilecek

Donusum tipi:

- [ ] tenant_id ekle
- [ ] project_permissions tablosunu tenant yetki modeline uyarla

#### suppliers -> tenant_suppliers

Mevcut durum:

- created_by_id uzerinden admin sahipligi var
- supplier_users ayri tabloda
- project_suppliers ile projeye baglaniyor

Hedef donusum:

- tenant_suppliers iki kaynagi desteklemeli:
  - private supplier
  - platform network supplier
- supplier_users supplier portal kullanicisi olarak korunmali

Donusum tipi:

- [ ] tenant_id ekle
- [ ] source_type ekle ve platform_supplier_id opsiyonunu tanimla
- [ ] supplier auth portalini tenant bagindan ayri ama iliskili tut

### RFQ / Teklif / Onay Zinciri

#### quotes -> tenant_rfqs

Mevcut durum:

- project_id ve created_by_id bagli
- company alanlari denormalized olarak quote icinde tutuluyor
- durum makinesi RFQ mantigina yakin ama isimlendirme quote merkezli

Hedef donusum:

- quotes yapisi tenant_rfqs olarak yeniden adlandirilmali
- tenant_id, company_id ve project_id ile acik tenant baglanti kurulmalı
 company_name ve contact alanlari zamanla tenant company
  referansina veya snapshot mantigina cekilmeli

Donusum tipi:

- [ ] tablo adlandirma karari ver
- [ ] tenant_id ekle
- [ ] denormalize company alanlari icin snapshot stratejisi belirle

#### quote_items -> tenant_rfq_items

Mevcut durum:

- quote'a bagli satir kalemleri mevcut

Hedef donusum:

- buyuk olcude ayni mantik korunabilir
- sadece tenant_rfq baglantisi uzerinden devam eder

Donusum tipi:

- [ ] isimlendirme ve foreign key guncellemesi

#### supplier_quotes + supplier_quote_items -> tenant_supplier_quotes + tenant_supplier_quote_items

Mevcut durum:

- revize sistemi, skor, ticari alanlar zaten var

Hedef donusum:

- tenant_id eklenecek
- rfq odakli isimlendirme netlestirilecek
- supplier portal akisi korunacak

Donusum tipi:

- [ ] tenant_id ekle
- [ ] rfq tabanli isimlendirme sadeleştirmesi yap

#### quote_approvals -> tenant_approvals

Mevcut durum:

- quote bazli ve supplier_quote opsiyonlu calisiyor
- required_role string alaninda duruyor

Hedef donusum:

- entity_type + entity_id mantigina gecilmeli
- approval_step, approver_user_id, decision ile daha genel bir approval engine kurulmalı

Donusum tipi:

- [ ] generic approval tablosuna gecis
- [ ] role string yerine role/capability veya policy referansi ekle

### Yardimci Modeller

#### system_emails -> tenant_settings + tenant scoped sender accounts

Mevcut durum:

- owner_user_id ile kullanici bazli sahiplik var

Hedef donusum:

- tenant bazli gonderici hesaplari olmali
- super admin default hesaplari ayri kalmali

Donusum tipi:

- [ ] owner_user_id mantigini tenant_id + optional platform scope yapisina cevir

## 8B. Ilk Teknik Uygulama Paketi

Ilk kod fazinda asagidaki teknik isler yapilmali:

- [x] Tenant SQLAlchemy modelini ekle
- [x] tenant_settings modelini ekle
- [x] users tablosuna gecici tenant_id ekleme stratejisini belirle
- [x] companies, projects, suppliers, quotes icin tenant_id migration
  envanterini cikar
- [x] mevcut admin kayitlarindan tenant bootstrap scripti tasarla
- [x] auth response modeline system_role kavramini ekle
- [x] AdminPage'i tenant admin workspace mantigina gore parcala
- [x] super admin ile tenant admin navigasyonunu ayir
- [x] super admin icin temel tenant CRUD yuzeyi baslat
- [x] tenant olustururken ilk tenant admin hesabi kurulumunu ekle
- [x] tenant admin'in personel akisindan admin veya super admin uretmesini engelle
- [x] super admin icin tenant owner yeniden atama ve aktif/pasif
  tenant aksiyonlarini ekle
- [x] frontend permission ve yonlendirme kararlarini system_role
  farkindali hale getir
- [x] admin router icinde temel create/list/update scope'unu
  tenant_id merkezli hale getir
- [x] auth branding katmanini tenant ve tenant settings oncelikli hale getir
- [x] quote ve approval router ana akislarina tenant scope ekle
- [x] supplier router temel CRUD ve yonetim girislerine tenant scope ekle
- [x] quotes.py icindeki ikinci quote akisini tenant-aware hale getir
- [x] super admin tam yetkiyi korurken platform destek/operasyon
  personeli icin system_role omurgasi ekle

## 8C. Aktif Sprint Backlogu (3'lu Icra Batchleri)

16 Nisan 2026 itibariyla aktif odak:

- Paket 2 kapanis sertlestirmesi (required_business_role birincilligi)
- Paket 5 kapanis sertlestirmesi (SaaS ticari katman [~] maddeleri)
- Paket 4 release penceresi hazirligi (final migration + operasyon runbook)

### Batch A - Approval Finalizasyonu (Paket 2)

- [x] Backend endpoint taramasi: approval okuma/yazma yuzeylerinde
  required_business_role disi karar noktalari kalmadi dogrula
- [x] Frontend approval ekranlari: required_role kullanimini
  yalnizca compatibility fallback seviyesinde sinirla
- [x] Kapanis kaniti: hedefli approval regresyon + transition audit
  ciktilarini tek tarihli not ile plana isle

  - 2026-04-16 ilerleme: approval_router ve quotes response/payload
    yuzeylerinde required_business_role birincilligi dogrulandi;
    required_role yalnizca compatibility alan olarak birakildi.
  - 2026-04-16 ilerleme: permissions resolver'lari canonical-first
    mantiga daraltildi; AdminPage approval gorunumleri ve fixture'lar
    required_business_role + required_role_mirror kontratina
    yaklastirildi.
  - 2026-04-16 ilerleme: transition audit yeniden calistirildi ve
    approval-transition-audit-2026-04-16 artefaktlarinda
    quote_approvals_with_issues=0 dogrulandi. Frontend hedefli test
    paketi 57/57 yesil ile kapanis kaniti olarak eklendi.

Tamamlanma kriteri:

- Paket 2 altindaki iki [~] madde [x] olur ve required_role sadece
  compatibility okuma alani olarak kalir.

### Batch B - SaaS Ticari Kapanis (Paket 5)

- [x] Paket/Modul ekrani: super admin operasyonunda plan, limit ve
  billing ozeti tek akisda tutarli hale getir
- [x] Limit enforcement kapsamasi: tenant olusturma/guncelleme ve
  kritik write akislarinda plan-limit ihlali tek policy katmanindan
  uygulanir
- [x] Billing backlog parcalama: webhook, faturalama,
  reconciliation ve hata-iyilestirme adimlarini teslim edilebilir alt
  backlog maddelerine ayir

  - 2026-04-16 backlog parcasi (Paket 5 / Billing): Webhook ingest
    hardening, invoice lifecycle standardizasyonu, reconciliation
    raporu ve operasyonel hata iyilestirme adimlari olarak dorde
    ayrildi.
  - 2026-04-16 ilerleme (Batch B / Adim 1): Billing webhook ingest
    hardening uygulandi. Provider event id cozumleme, stripe signature
    dogrulama ve replay/rejection regresyonlari eklendi; hedefli test
    turu 3/3 yesil dondu.
  - 2026-04-16 ilerleme (Batch B / Adim 2): Invoice lifecycle
    standardizasyonu AdminPage uzerinde tamamlandi. KPI ve filtreler
    normalize lifecycle bucket'lari uzerinden hesaplanir hale geldi;
    hedefli frontend regresyon turu 48/48 yesil dondu.
  - 2026-04-16 ilerleme (Batch B / Adim 3): Reconciliation rapor
    omurgasi eklendi. audit_billing_reconciliation scripti JSON/CSV
    cikti uretir hale geldi; birim test paketi 4/4 yesil ve mevcut
    ortamda issue_counts=0 raporlandi.
  - 2026-04-16 ilerleme (Batch B / Adim 4): Failed webhook eventleri
    icin yeniden-isleme aksiyonu eklendi. retry endpoint'i, admin servis
    cagrisi ve Billing Operasyonlari quick-action butonu baglandi;
    backend 2/2 ve frontend 49/49 yesil dogrulandi.

  - 2026-04-16 kapanis notu: Bu batch altindaki iki acik teslim
    maddesi de tamamlandi. Super admin Paket ve Kullanim sekmesi
    plan/modul matrisi, canli tenant kullanim snapshot'i ve billing
    operasyon panellerini tek akisda birlestiriyor; runtime limit
    enforcement ise ortak policy katmanindan uygulanıyor. Paket 5 ust
    basligindaki dort [~] madde bu nedenle [x] olarak guncellendi.
  - 2026-04-20 kapanis notu: Batch B sonrasi ticari katman UX'i de
    sertlestirildi. Limit asimi durumlarinda kullaniciya paket
    kademeleri bolumune goturen dogrudan CTA eklendi; premium feature
    yonetiminde yeni kayit, silme onayi ve code benzersizlik kontrolu
    form seviyesinde tamamlandi.

Tamamlanma kriteri:

- Paket 5 altindaki dort [~] madde icin en azindan biri [x]
  kapanir, kalanlar icin testli ve tarihli alt-adimlar netlesir.

  - 2026-04-16 kapanis notu: Bu batch altindaki iki acik teslim
    maddesi de tamamlandi. Super admin Paket ve Kullanim sekmesi
    plan/modul matrisi, canli tenant kullanim snapshot'i ve billing
    operasyon panellerini tek akisda birlestiriyor; runtime limit
    enforcement ise ortak policy katmanindan uygulanıyor. Paket 5 ust
    basligindaki dort [~] madde bu nedenle [x] olarak guncellendi.

### Batch C - Release Hazirligi (Paket 4 Son Faz)

- [x] Legacy drop preflight: quote/rfq legacy cleanup ve approval
  compatibility migration'lari icin canli-oncesi kontrol listesini yaz
- [x] Operasyon runbook: apply, rollback, dogrulama ve rapor artefakt
  adimlarini tek dokumanda sabitle
- [x] Release penceresi cikti seti: JSON/CSV audit raporlari + hedefli
  test ciktilarini release notu formatinda toparla

  - 2026-04-16 ilerleme (Batch C): Release hazirligi dokumantasyonu
    tamamlandi. Preflight checklist, runbook ve release-window notlari
    audit artefaktlari ile hedefli test ciktilarini tek bir release
    hazirlik zincirinde sabitledi.

Tamamlanma kriteri:

- Paket 4 kapanisinda teknik riskler dokumante edilir, migration karari
  release penceresinde uygulanabilir hale gelir.

Not:

- Icra sirasi A -> B -> C olarak izlenecek.
- Her batch sonunda ilgili paket satirlari ve bu bolumdeki checklist guncellenecek.

## 8E. Kisaltilmis Icra Plani (7 Gun)

Bu bolum, 30 gunluk genis backlog yerine hemen uygulanacak 7 gunluk daraltilmis
icra odagini tanimlar.

### Hedef

Bu sprintin amaci yeni moduller acmak degil; acik gecis borclarini kapatmak,
teknik dili sadelestirmek ve release-oncesi belirsiz alanlari azaltmaktir.

### Gun 1-2: Approval Legacy Cleanup Kapanisi

- `api/services/quote_approval_service.py` icindeki legacy
  `required_role` fallback kosullarini son kez envanterle
- `api/models/quote_approval.py`, `api/schemas/quote.py`,
  `api/routers/quotes.py`, `api/routers/approval_router.py` icinde
  `required_role` alaninin yalnizca compatibility amacli kaldigini
  dogrula
- `web/src/types/approval.ts` ve `web/src/auth/permissions.ts`
  icinde frontend legacy approval zincirini son temizlige hazir hale
  getir

Tamamlanma cikti:

- `required_role` icin "simdi kalsin / breaking-change sonrasi kaldir"
  tablosu netlesmis olur.

### Gun 3-4: Quote -> RFQ Gecisi Gorev Parcalama

- quote / rfq gecisindeki kalan adapter, alias, endpoint, tip ve UI
  isimlerini dosya bazli alt gorevlere bol
- backend model / router / service ve frontend service / page ayirimini
  tek listede topla
- naming policy karari ver: hangi yuzeylerde `quote`, hangi yuzeylerde
  `rfq` terimi yasamaya devam edecek

Tamamlanma cikti:

- RFQ kapanisi soyut backlog olmaktan cikar, dosya bazli icra
  listesine donusur.

### Gun 5: Runtime Migration ve Seed Borcu

- `api/main.py` startup akisindaki `create_all`, `ALTER TABLE`,
  test-user seed ve permission seed bloklarini siniflandir
- bunlari `alembic`, `script`, `runtime-gecici` olarak uc gruba ayir
- release oncesi kaldirilmasi gereken bloklar icin ayri teknik not cikar

Tamamlanma cikti:

- startup borcunun hangi parcasi kalici, hangi parcasi gecici
  netlesir.

Mevcut envanter:

- `runtime schema patching`: `quotes`, `quote_items`, `system_settings`,
  `supplier_quotes`, `supplier_quote_items`, `users`, `companies`,
  `tenants`, `departments`, `projects`, `roles`, `company_roles`,
  `suppliers`, `quote_approvals`, `email_settings`, `system_emails`
- `demo/test seed`: startup sirasinda gorunur kullanici yoksa acilan
  test kullanicilari (`test@example.com`, satin alma rol varyantlari)
- `permission catalog seed`: startup sirasinda `Permission`
  tablosuna yazilan varsayilan personel, departman, firma, proje, rol
  ve teklif izinleri

Ilk tasnif karari:

- tenant ve approval foundation kolonlari: `alembic` veya idempotent script
- test kullanicilari: yalnizca dev bootstrap script'i
- permission catalog seed: ayri seed komutu veya kontrollu one-shot bootstrap

- 2026-04-19 ilerleme: startup bootstrap mantigi
  `api/services/runtime_bootstrap.py` modulune tasindi ve `api/main.py`
  ince entrypoint haline getirildi. Demo user ile permission catalog
  seed'i varsayilan startup akisindan cikarilarak kontrollu flag'lere
  baglandi; manuel zincir icin `api/scripts/bootstrap_runtime_defaults.py`
  eklendi.
- 2026-04-19 ilerleme: foundation, compat ve quote/supplier uyumluluk
  alanlari runtime patch listesinden ayrilarak idempotent script ve
  migration hattina tasindi. Boylece runtime bootstrap schema
  degisimi yerine yalnizca opsiyonel seed kontrolu yapan bir katmana
  daraltildi.
- 2026-04-19 ilerleme: request-aninda schema tamiri yapan lokal
  kalintilar temizlendi. supplier quote kolon ensure mantigi,
  system_settings JSON ensure mantigi ve price-rules icin request
  path uzerindeki tablo olusturma davranisi kaldirildi.
- 2026-04-19 RFQ delta: cleanup sonrasi RFQ backlog'u dosya bazli hale
  geldi. `api/routers/quotes.py` RFQ-first kontratla calisiyor; sonraki
  odak `api/models/quote.py` icindeki `user_id` ve `amount`
  compatibility mirror'larini breaking-change penceresinde emekliye
  ayirmak.
- 2026-04-19 uygulama delta: RFQ update kontrati canonical
  `total_amount` alanina daraltildi, legacy `amount` ayni alana
  senkronize edilen compatibility katmani olarak tutuldu. Bootstrap
  validation komutu VS Code task olarak da eklendi.
- 2026-04-19 operasyon delta: legacy compatibility endpointleri OpenAPI
  seviyesinde `deprecated` olarak isaretlendi ve
  `api/scripts/audit_quote_mirror_drop_readiness.py` eklendi. Bu gate,
  legacy mirror alanlarinin fiziksel drop migration'inden hemen once
  kosulacak release kontrolune baglandi.

- 2026-04-19 gozlem delta: fiziksel kesim oncesi kisa sureli runtime
  sayaclari ile legacy `quote_router` kullanimi izlendi; bu gecici
  gozlem katmani kesim tamamlandiktan sonra kaldirilacak sekilde
  tasarlandi.
- 2026-04-19 fiziksel daraltma delta: dusuk riskli quote endpointleri ve
  history akisleri canonical `api/routers/quotes.py` altina tasindi;
  legacy `quote_router` kademeli olarak daraltildi.
- 2026-04-19 fiziksel kesim final delta: kalan import, send-to-suppliers
  ve select-supplier akisleri de canonical router'a tasindi; gecici
  telemetry servisi, observation endpointi ve
  `api/routers/quote_router.py` dosyasi kaldirildi. RFQ runtime yuzeyi
  artik yalnizca canonical router uzerinden yasiyor.
- 2026-04-19 drop hazirlik delta:
  `api/scripts/drop_quote_legacy_mirror_columns.py` eklendi. Script,
  `audit_quote_mirror_drop_readiness.py` ile hizayi dogrulayip legacy
  mirror kolonlarinin fiziksel drop planini uretiyor.

### Gun 6: Tenant User Dili ve Admin UI Sadelestirme

- `Personnel`, `Kullanici`, `Tenant User`, `Portal Personeli` ve
  `Stratejik Partner Personeli` ifadelerini tek sozlukte topla
- `web/src/pages/admin/PersonnelTab.tsx`,
  `web/src/components/PersonnelCreateModal.tsx`,
  `web/src/components/PersonnelDetailModal.tsx` ve
  `web/src/admin/workspace-panels.ts` icinde kullanilan urun dilini
  hizala
- tenant admin ve platform personeli ekran ayrimlarinda ayni dilin
  kullanildigini dogrula

  - 2026-04-19 ilerleme: admin workspace terminolojisi gorunur UI
    seviyesinde hizalandi. Karisik `kullanici/personel` dili
    `ekip uyesi` ve `tenant kullanicisi` eksenine daraltildi; segment
    adlari `Platform Ekip Uyeleri`, `Tenant Ekip Uyeleri` ve
    `Tedarikci Ekip Uyeleri` olarak netlestirildi.

Tamamlanma cikti:

- admin yuzeyindeki kullanici/personel dili tutarli hale gelir.

### Gun 7: MVP Siniri ve Canli Checklist

- `api/models/onboarding_saas.py` ve `api/routers/onboarding_saas.py`
  icin "simdi cikacak / sonra cikacak" sinirini belirle
- `BUYER_ASISTANS_PUBLIC_WORKFLOW.md` icindeki acik maddeleri teknik
  checklist haline indir
- haftalik kapanis notu: test, audit, migration ve operasyon
  baglaminda GO / NO-GO ozeti hazirla

  - 2026-04-19 ilerleme: onboarding SaaS kapsami icin
    [docs/release/onboarding-saas-mvp-boundary-2026-04-19.md](docs/release/onboarding-saas-mvp-boundary-2026-04-19.md)
    eklendi. Tenant type/tier katalogu, premium feature omurgasi,
    trial status ve business partner commission rapor yuzeyleri MVP
    kapsaminda tutuldu; provider odeme derinligi ve ledger
    sertlestirmesi sonraki faza birakildi.
  - 2026-04-19 ilerleme: [BUYER_ASISTANS_PUBLIC_WORKFLOW.md](BUYER_ASISTANS_PUBLIC_WORKFLOW.md)
    icindeki acik maddeler SEO/domain, sitemap/robots, analytics KPI,
    marka ve canli-oncesi kapilar basliklariyla teknik checklist'e
    indirildi.
  - 2026-04-19 ilerleme:
    [docs/release/go-no-go-2026-04-19.md](docs/release/go-no-go-2026-04-19.md)
    olusturuldu; karar durumu `CONDITIONAL GO` olarak kaydedildi ve tek
    acik risk olarak telemetry preset senaryosunun genis frontend turunda
    zaman sinirina yakin calismasi not edildi.
  - 2026-04-19 delta-2: approval drop preflight,
    release checklist senkronizasyonu ve public web domain cutover
    artefaktlari da eklendi. Boylece kalan uc onerinin her biri
    operasyonel ciktiya donusturuldu.
  - 2026-04-19 delta-3: public telemetry ingest + admin KPI gorunurlugu
    eklendi; multi-domain robots stratejisi host-intent bazli hale
    getirildi ve Cloudflare apex/cache artefaktlari genisletildi.
  - 2026-04-19 delta-4: public UTM sozlugu sabitlendi, telemetry
    katmaninda slug normalizasyonu eklendi ve public logo varyanti
    `buyer-logo-custom.svg` olarak standardize edildi.
  - 2026-04-19 delta-5: admin analytics ekranina host/event segment
    filtreleri ve CSV export eklendi; public sayfalar icin similarity
    audit script'i calistirilip esik ustu tekrar riski olmadigi raporlandi.
  - 2026-04-19 delta-6: Search Console ve Bing submit checklist'i
    release artefakti olarak eklendi; public analytics export'u backend
    endpointi ve tarih araligi filtresi ile desteklendi.
  - 2026-05-01 delta-7: release kalibrasyon turunda runtime bootstrap,
    quote mirror readiness/plan ve hedefli web regresyon paketi yeniden
    kosuldu; teknik kapilar yesil dogrulandi. Bu guncelleme ile
    [docs/release/go-no-go-2026-04-19.md](docs/release/go-no-go-2026-04-19.md)
    icindeki karar metni `GO (TEKNIK)` olarak revize edildi.
    Canliya alma onayi is/operasyon kapisinda ayri tutulur.

Tamamlanma cikti:

- kisa sprint sonunda hem teknik cleanup hem de urun kapsami
  daraltmasi yapilmis olur.

### Bu Sprintte Bilerek Ertelenenler

- channel scope'un tam urunlestirilmesi
- genisletilmis payment provider derinlestirmesi
- Discovery Lab UX polish backlog'u
- ana akis disindaki buyuk refactor'lar

### Sprint Basari Kriteri

- approval legacy cleanup icin acik maddeler dosya bazli kapanis
  planina baglanmis olur
- RFQ gecisi icin somut gorev listesi cikmis olur
- `api/main.py` icindeki runtime gecis borcu siniflandirilmis olur
- tenant user / personnel dili admin UI'da netlesmis olur
- onboarding + public web icin MVP ve canli checklist siniri belirlenmis olur

## 8D. `required_role` Legacy Cleanup Envanteri

Bu bolum, `required_role` alani icin kalan uyumluluk izlerinin nerede
kaldigini ve ne zaman fiziksel olarak silinebilecegini belgeler.

### Mevcut Durum

| Dosya | Nokta | Aciklama |
| --- | --- | --- |
| `api/models/quote_approval.py` | `required_role` DB kolonu | Drop migration hazir; henuz uygulanmamali |
| `api/scripts/audit_quote_approval_required_role_cleanup.py` | readiness/apply kapisi | Mirror cleanup tamamlandi; DB drop oncesi son kanit olarak korunur |
| `docs/release/approval-required-role-drop-preflight-2026-04-19.md` | call-site envanteri | Fiziksel drop oncesi kaldirilacak son backend/frontend/runtime izleri belgeli |

### Drop Sonrasi Kapanan Noktalar

- [x] `api/models/quote_approval.py` icindeki `required_role` DB kolonu
  fiziksel drop sonrasi emekliye alindi.
  Durum: 2026-04-19 tamamlandi.

- [x] DB migration + ORM drop zinciri uygulandi.
  Durum: 2026-04-19 tamamlandi.
  Kapsam: `api/models/quote_approval.py`, ilgili migration dosyalari
  ve drop preflight/runbook artefaktlari.

### Cleanup Siralama Kurali

1. Tum DB kayitlari `required_business_role` dolu oldugunda audit/apply
   kapisi ile compatibility mirror cleanup durumunu dogrula
2. Runtime sozlesmesini canonical-only hale getir
3. DB drop migration uygula (`required_role` kolonunu kaldir)
4. ORM/model izlerini ve operasyon runbooklarini son kez sadeleştir

- 2026-04-19 ilerleme: readiness/apply kapisi olarak
  `api/scripts/audit_quote_approval_required_role_cleanup.py`
  eklendi. Mirror cleanup durumu operasyonel audit ile dogrulanir hale
  geldi.
- 2026-04-19 ilerleme: runtime breaking-change fazinda legacy approval
  response/fallback alanlari kaldirildi; aktif API ve frontend kontrati
  yalnizca `required_business_role` ve label alanlari uzerinden ilerler
  hale geldi. Hedefli backend approval paketi 11/11 yesil dogrulandi.
- 2026-04-19 ilerleme: fiziksel drop fazi tamamlandi.
  `quote_approvals.required_role` kolonu dusuruldu, audit
  optional-column farkindaligina cekildi ve hedefli pytest paketi 13/13
  yesil tamamlandi.

---

## 8F. Onceliklendirilmis Kalan Is Listesi (2026-04-21)

Bu bolum, dokumandaki acik [ ] ve kismi [~] maddeleri uygulama onceligine gore
tek yerde toplar.

### P1 - Kisa Vadede Kapanacaklar

- [x] RFQ olusturma akisina yayin modeli secimi ekle.
  Referans: Stratejik Partner / Teklif Yayinlama bolumu.
- [x] Paket katalogunu scope bazli limit ailesi ile yeniden tanimla
  (strategic partner, supplier, channel).
  Referans: Super Admin / Paket ve Premium Ozellikler bolumu.
- [x] Paket 3 altindaki tenant-user diline gecis maddesini [~] -> [x]
  kapanisina tasiyacak son API/UX kontrat temizligini tamamla.
  - 2026-04-23 kapanis notu: PersonnelDetailModal.tsx icindeki son
    legacy `Personnel` type anotasyonu `TenantUser`'a cevrildi.
    Personel regresyon paketi 14/14 yesil dogrulandi.

### P2 - Domain ve Veri Modeli Kapanislari

- [ ] Quote -> RFQ hedef modeline gecis backlog'unu migration adimi bazinda
  tamamla ve Paket 4 [~] maddesini kapat.
  - 2026-04-23 operasyon notu: quote legacy mirror drop readiness
    auditi temiz dondu (`drop_ready=true`) ve fiziksel drop plan
    SQL'i uretildi (5 kolon icin ALTER TABLE DROP COLUMN adimlari).
- [ ] Generic approval tablosu gecisini (entity_type + entity_id) ve
  role/capability/policy referans modelini netlestir.
- [ ] Tenant user assignments icin tablo yeniden adlandirma veya yeni tabloya
  tasima kararini netlestir.

### P3 - Buyuk Donusum / Breaking-Change Adaylari

- [ ] users -> platform_users + tenant_users tablo bolunmesi.
- [ ] auth mantiginin tamamen yeni kimlik modeline gecisi.
- [ ] eski role verilerinin final map + temizlik adimi.
- [ ] departments/roles/companies/projects/suppliers zincirindeki envanter [ ]
  maddelerini migration penceresiyle kapat.

Uygulama notu:

- P1 maddeleri tamamlandiginda bu bolumdeki satirlar [x] olacak ve ilgili
  paket satirlarina kapanis notu dusulecek.

## 8G. Rol ve Departman Ortak Katalog Karari (2026-04-22)

Bu bolum, canli DB envanteri ve urun yonetisim kararini tek yerde toplar.

### 8G.1 Canli DB Envanter Ozeti

- Roles: 40
- Permissions: 62
- Departments: 18
- Users: 59

Canli tekrar eden rol adlari (ornek):

- Satin Alma Uzmani
- Satin Alma Yoneticisi
- Satin Alma Muduru
- Satin Alma Direktoru
- Satin Alma Admin
- Satin Alma Mudur Yardimcisi
- Satin Alma Kidemli Uzmani

Canli tekrar eden departman adlari (ornek):

- Endirek Satin Alma
- Ticari Satin Alma
- Teknik Satin Alma
- Hammadde Satin Alma

Not:

- Bu dagilim, ayni anlami tasiyan rol/departman adlarinin tenant bazli
  farkli varyasyonlarla biriktigini gosterir.
- Sonraki fazda ad/sozluk normalizasyonu ve alias mapi uygulanmalidir.

### 8G.2 Ortak Katalog Yonetisim Kurali

- Rol olusturma/guncelleme/silme:
  - Sadece `platform.super_admin`
  - veya `platform.super_admin` tarafindan acik izin verilmis personel
- Departman olusturma/guncelleme/silme:
  - Sadece `platform.super_admin`
  - veya `platform.super_admin` tarafindan acik izin verilmis personel
- Yetki modeli kisi bazli override anahtarlari ile yonetilir:
  - `org_catalog.roles.manage`
  - `org_catalog.departments.manage`
- Bu iki anahtar kritik izindir; super admin disinda role-delegation ile
  dagitilamaz.

### 8G.3 Kanonik Ortak Rol Katalogu (Scope-First)

Varsayilan kaynak: bu dokumanin 0.2 Kanonik Profil Tablosu.

Ortak rol katalogu 4 scope uzerinden tek kaynakta tutulur:

- platform
  - platform.super_admin
  - platform.portal_admin
  - platform.support_agent
  - platform.finance_officer
- partner
  - partner.account_owner
  - partner.org_admin
  - partner.procurement_manager
  - partner.technical_specialist
  - partner.auditor
  - partner.custom_role
- supplier
  - supplier.account_owner
  - supplier.org_admin
  - supplier.sales_senior
  - supplier.pricing_specialist
  - supplier.custom_role
- channel
  - channel.account_owner
  - channel.team_lead
  - channel.agent
  - channel.finance_viewer
  - channel.auditor

### 8G.4 Kanonik Ortak Departman Katalogu

Partner icin ortak varsayilan departman aileleri:

- Yonetim ve Organizasyon
- Satin Alma Operasyonlari
- Teknik Ofis ve Sartname
- Finans ve Denetim

Departman alt basliklari (sub-item) kurali:

- Alt basliklar serbest metin yerine katalog tabanli olacak.
- Ayni adin farkli yazim varyasyonlari yeni kayit acmadan once
  normalize edilecek.
- Yeni ortak departman veya alt baslik acilisi yalnizca super admin
  ve yetkilendirdigi personel tarafindan yapilacak.

### 8G.5 Ad/Sozluk Normalizasyonu - Preview Sonucu (2026-04-22)

Kullanilan script:

## 9. Is Ortagi Profil ve Network Komisyon Donusum Notu (2026-04-23)

Bu bolum sadece ozet not ve durum takibi icindir. Detayli ekran akislari,
veritabani taslagi, komisyon matematigi ve sprint adimlari icin ana takip
dosyasi:

- IS_ORTAGI_NETWORK_WORKFLOW.md

Karar notlari (ozet):

- Is ortagi panelindeki Profilim ekrani, super admin detay ekrani ile ayni
  standarda tasinacak (tek form dili, tek alan semantigi).
- Onay limiti alani kaldirilacak; yerine referral/link bazli komisyon ve
  ekip performansi odakli metrikler eklenecek.
- Channel Account Owner ekip koku olacak; kanal yoneticisi, denetcisi,
  lideri, finans izleyicisi ve temsilcisi ayni ekip hiyerarsisinde
  gosterilecek.
- Is ortagi bireysel (firma yok) veya kurumsal (firma bagli) olabilir;
  iki model tek domain kurallariyla yonetilecek.
- Is ortagi panelindeki personel gorunurlugu, super admin panelindeki veri
  ile birebir tutarli hale getirilecek.
- Komisyon modeli artan performansta kademeli yukselis, dusen performansta
  yumusak dusus mantigiyla calisacak (motivasyon kirici sert dusus yok).

Durum takip (ust seviye):

- [x] Ihtiyac analizi ve hedef urun resmi netlesti
- [x] Detayli workflow dosyasinin olusturulmasi karari alindi
- [x] Detayli workflow dosyasi acildi: IS_ORTAGI_NETWORK_WORKFLOW.md
- [x] Profil ekrani v2 bilgi mimarisi ve bilesen spec'i tamamlandi
- [x] Personel veri gorunurlugu icin frontend segment bugfixi uygulandi
- [x] Backend personel filtreleri (tenant/scope/owner) hizalandi
- [x] Aktif/pasif personel semantigi API seviyesinde standartlastirildi
- [x] Owner/scope bazli backend snapshot testleri eklendi
- [x] Ekip hiyerarsisi ve tek owner altinda grup gorunumu
- [x] Profil/Personel duzenleme ekrani teklestirme
- [x] Onay limiti kaldirma + komisyon metriklerine gecis
- [x] Referral/link altyapisi ve attribution olaylari
- [x] Komisyon motoru v1 (kademeli artis/yumusak dusus)
- [x] Komisyon motoru v1 DB migration taslagi eklendi: migrations/2026_04_23_add_channel_network_commission_v1_draft.sql
- [x] Kampanya ve sosyal baglanti modulu
- [x] Is ortagi ust menu sadeleştirme (Teklifler/Profil sekmeleri)
- [x] Is ortagina ozel dashboard ve kullanim aciklama kartlari

2026-04-23 ilerleme notu:

- Sprint-1 "Profilim v2 temel kartlar" adimi tamamlandi.
- Backend: `GET /api/v1/channel/profile/summary` eklendi.
- Frontend: `ProfilePage` icinde channel scope icin Is Ortagi Ozet Karti
  (ekip, son 30 gun yeni musteri, komisyon metrikleri) yayina alindi.
- Sprint-2 baslangic teslimi: referral_links + referral_events modeli,
  channel profile referral endpointleri ve ProfilePage Link Merkezi/Ag ve
  Donusum kartlari devreye alindi.
- Sprint-2 devam teslimi: komisyon hesaplama servisi referral eventlerden
  commission_ledger kaydi uretiyor; /channel/profile/commission-recalculate
  ve /channel/profile/commission-report endpointleri ile period raporu
  backend/frontend baglandi.
- Sprint-3 devam teslimi: TeamHierarchyTree ve Kampanya Paneli tamamlandi.
  Backend: `GET /api/v1/channel/profile/team-hierarchy` ve
  `GET /api/v1/channel/profile/campaigns` endpointleri eklendi.
- Sprint-3 kapanis teslimi: Sosyal Baglanti Paneli tamamlandi.
  Backend: `GET /api/v1/channel/profile/social-links` endpointi eklendi.
  Frontend: `ProfilePage` icinde sosyal aglara tek tik paylasim paneli yayinda.
- Sprint-4 baslangic teslimi: TeamPerformanceTable ilk surum tamamlandi.
  Backend: `GET /api/v1/channel/profile/team-performance` endpointi eklendi.
  Frontend: `ProfilePage` icinde ekip performans tablosu yayinda.
- Sprint-4 devam teslimi: ConversionFunnelPanel ilk surum tamamlandi.
  Backend: `GET /api/v1/channel/profile/conversion-metrics` funnel oranlari
  ve gunluk trend alanlariyla genisletildi.
  Frontend: `ProfilePage` icinde donusum hunisi paneli yayinda.
- Sprint-4 devam teslimi: PartnerSummaryCard ve CommissionOverviewPanel
  componentizasyonu tamamlandi.
  Frontend: `ProfilePage` icindeki ozet ve komisyon bloklari reusable
  componentlere tasindi.
- Sprint-4 devam teslimi: ReferralLinkCenter componentizasyonu tamamlandi.
  Frontend: `ProfilePage` icindeki Link Merkezi blogu reusable
  `ReferralLinkCenter` componentine tasindi.
- Sprint-4 devam teslimi: ConversionOverviewPanel componentizasyonu
  tamamlandi.
  Frontend: `ProfilePage` icindeki Ag ve Donusum blogu reusable
  `ConversionOverviewPanel` componentine tasindi.
- Sprint-4 devam teslimi: ChannelPrimitives UI kit devreye alindi.
  Frontend: `ChannelPrimitives` (SectionCard/SectionHeader/StatCard)
  olusturuldu ve ozet/link/donusum componentleri bu primitive'lere gecirildi.
- Sprint-4 devam teslimi: Team/Kampanya panel standardizasyonu tamamlandi.
  Frontend: `ProfilePage` icindeki TeamHierarchy, TeamPerformance ve Kampanya
  panelleri `SectionCard/SectionHeader` primitive'lerine gecirildi.
- Sprint-4 devam teslimi: Channel component-level test split tamamlandi.
  Frontend test: `channel-components.test.tsx` eklendi;
  PartnerSummaryCard, ReferralLinkCenter ve ConversionOverviewPanel
  icin ayri coverage saglandi.
- Sprint-4 devam teslimi: Channel test fixture merkezi olusturuldu.
  Frontend test: `channel-test-data.ts` ile ortak mock verisi
  tek kaynaga alindi; page-level ve component-level testler bu fixture
  uzerinden calisacak sekilde sadeleştirildi.
- Sprint-8 teslimi: Is ortagi ust menusu sadeleştirildi.
  Frontend: `navigation.ts` uzerinde channel rolleri icin `Teklifler`
  gizlendi ve `Profil` menusu kaldirildi; profil akisi sag ust `Profilim`
  butonundan devam eder.
- Sprint-8 teslimi: Is ortagina ozel dashboard deneyimi aktif edildi.
  Frontend: `DashboardPage` channel scope'ta teklif listesini gostermez;
  ekip, donusum, komisyon ve seviye kartlari + `Nasil Kullanilir?`
  aciklama blogu ile calisir.

Senkron kurali:

- Bu ust seviye checkbox listesi ile IS_ORTAGI_NETWORK_WORKFLOW.md icindeki
  Milestone-0 listesi ayni status'te tutulur.

- `api/scripts/audit_org_catalog_name_normalization.py`

Uretilen preview artefaktlari:

- `org-catalog-name-normalization-preview-2026-04-22.json`
- `org-catalog-name-normalization-preview-2026-04-22.csv`

Uretilen apply artefaktlari:

- `org-catalog-name-normalization-applied-2026-04-22.json`
- `org-catalog-name-normalization-applied-2026-04-22.csv`

Preview ozeti:

- total_rows: 58
- role_rows: 40
- department_rows: 18
- safe_rename: 5
- merge_required: 8

Issue dagilimi:

- already_canonical: 42
- merge_required_normalized: 8
- no_rule: 3
- safe_rename: 5

Karar:

- `safe_rename` kayitlari apply modunda dogrudan guncellenebilir.
- `merge_required` kayitlari icin alias-map + aktif/pasif birlestirme
  (surviving role/dept secimi) adimi gerekir.

Apply sonucu:

- guncellenen kayit sayisi: 5
- guncellenen id listesi (ilk 100): 13, 18, 19, 20, 9
- apply sonrasi durum: safe_rename=0, merge_required=8

### 8G.6 Merge Uygulamasi ve Post-Merge Dogrulama (2026-04-22)

Rol duplicate merge scripti:

- `api/scripts/merge_org_catalog_role_duplicates.py`

Merge preview artefaktlari:

- `org-catalog-role-duplicate-merge-preview-2026-04-22.json`
- `org-catalog-role-duplicate-merge-preview-2026-04-22.csv`

Merge apply artefaktlari:

- `org-catalog-role-duplicate-merge-applied-2026-04-22.json`
- `org-catalog-role-duplicate-merge-applied-2026-04-22.csv`

Merge apply sonucu:

- updated_pairs: 8
- deactivated_source_ids: 9, 10, 11, 12, 14, 15, 16, 17

Post-merge normalizasyon dogrulamasi:

- `org-catalog-name-normalization-post-merge-2026-04-22.json`
- `org-catalog-name-normalization-post-merge-2026-04-22.csv`
- sonuc: safe_rename=0, merge_required=0
- issue_counts: already_canonical=40, inactive_skipped=14, no_rule=4

No-rule sozluk tamamlama sonrasi final dogrulama:

- `org-catalog-name-normalization-final-2026-04-22.json`
- `org-catalog-name-normalization-final-2026-04-22.csv`
- sonuc: safe_rename=0, merge_required=0
- issue_counts: already_canonical=44, inactive_skipped=14

### 8G.7 Effective Listeleme ve Duplicate Guard (2026-04-22)

Uygulanan backend iyilestirmesi:

- `GET /admin/roles` ve `GET /admin/departments` endpointleri varsayilan olarak
  normalize ada gore tekil liste dondurur.
- `include_duplicates=true` parametresi verilirse ham liste alinabilir.
- Role/department create/update akislarina semantik duplicate kontrolu eklendi
  (Satin/Satin, noktalama ve buyuk-kucuk harf farklari dahil).

Hedef etkisi:

- Super admin ekraninda ayni rol/departmanin tekrarli gorunmesi engellendi.
- Tenant/profile tarafinda acilis gorunumu daha sade ve tekil hale geldi.

## 9. Degisiklik Kaydi

Bu bolum her calisma sonunda guncellenecektir.

- [x] 2026-04-22 Rol ve departman ortak katalog yonetisimi sertlestirildi:
  DB envanter ozetleri 8G bolumune eklendi; ortak katalog write-path'i
  super admin + explicit yetkili personel modeline sabitlendi
  (`org_catalog.roles.manage`, `org_catalog.departments.manage`).

- [x] 2026-04-22 Rol/departman ad normalizasyonu icin conflict-aware
  preview scripti eklendi (`api/scripts/audit_org_catalog_name_normalization.py`);
  preview artefaktlari uretildi ve 8G.5 altinda raporlandi.

- [x] 2026-04-22 Rol/departman ad normalizasyonu safe-rename apply adimi
  tamamlandi (5 kayit guncellendi), DB role/permission/department exportlari
  yeniden uretildi.

- [x] 2026-04-22 Merge-required rol kayitlari conflict-aware merge scripti ile
  birlestirildi (8 cift), source roller pasife cekildi ve post-merge
  normalizasyon raporunda aktif merge-required kayit kalmadi.

- [x] 2026-04-22 no_rule kalan 4 kayit icin sozluk kurali tamamlandi;
  final normalizasyon raporunda no_rule kalmadi.

- [x] 2026-04-22 Admin roles/departments listelemesinde effective tekillestirme
  varsayilan hale getirildi; create/update akislarina semantik duplicate
  engeli eklendi.

- [x] 2026-04-22 Tenant 2 rol merdiveni veri onarimi tamamlandi: yanlislikla
  pasiflesen benzersiz satin alma rolleri (uzman/yonetici/mudur/direktor)
  yeniden aktif edildi, duplicate legacy varyantlar pasif tutuldu ve
  normalizasyon denetiminde aktif merge_required kayit kalmadi.

- [x] 2026-04-22 Rol duplicate merge scriptinde hedef secimi guclendirildi:
  target artik conflict listesinde aktif rol > permission zenginligi > stabil
  dusuk id onceligiyle belirleniyor; pasif hedefe merge kaynakli kayip
  riski azaltildi.

- [x] 2026-04-22 Rol hiyerarsi ve stratejik partner gorunurluk sertlestirmesi:
  /admin/roles endpointine tenant bazli filtre (tenant_id) ve reserved rol
  filtreleme (exclude_reserved) query destegi eklendi; personel olusturma
  modalinde rol lookup tenant-scope + reserved-role dislama ile calisacak
  sekilde guncellendi; RolesTab kartinda ust rol ve alt rol sayisi net
  gosterilmeye baslandi.

- [x] 2026-04-16 BUYER ASISTANS branding, public yeniden duzenleme ve
  domain/SEO config omurgasi tamamlandi.
- [x] 2026-04-16 Public web workflow ve domain-SEO uygulama adimlari
  BUYER_ASISTANS_PUBLIC_WORKFLOW.md altina tasindi.
- [x] 2026-04-19 Public telemetry endpointi, admin KPI kartlari ve
  domain-intent bazli robots stratejisi eklendi; cutover artefaktlari
  apex redirect + sitemap/robots cache kapsami ile genisletildi.
- [x] 2026-04-19 Public UTM naming policy ve logo standardizasyonu
  repo gercegiyle kilitlendi; public login/nav/onboarding yuzeyleri tek
  logo varyantina cekildi.
- [x] 2026-04-19 Public analytics dashboard kapanisi icin segment
  filtreleri, CSV export ve content similarity audit raporu eklendi.
- [x] 2026-04-19 Search Console / Bing submit checklist'i ve backend
  destekli telemetry CSV export + tarih filtresi eklendi.
- [x] 2026-04-20 Frontend sayfa bolme performans calismasi baslatildi:
  `web/src/pages/AdminPage.tsx` icindeki sekme metadata, ikon badge
  renderer ve servis etiketi normalize yardimcilari
  `web/src/pages/admin/adminPageMeta.tsx` dosyasina tasindi.
  Davranis degismeden parse/yukleme karmasikligi azaltildi.
  Sonraki adim: AdminPage icindeki panel bloklarini tab bazli lazy
  bolumlere ayirmak (islev birebir korunacak).
- [x] 2026-04-16 Onboarding, public pages ve admin yeni sekme kapsami
  hedefli Vitest paketleriyle yesil sabitlendi.
- [x] 2026-04-16 Tenant governance, permissions ve auth-routing
  dogrulama paketleri frontendte 63/63, backendte 28/28 yesil tamamlandi.
- [x] 2026-04-16 Self-serve onboarding wizard endpointleri ve public
  onboarding akisi eklendi.
- [x] 2026-04-19 Public onboarding odeme yonetimi operasyonel hale getirildi:
  EFT/dekont yukleme, admin odeme dogrulama, uyelik red-not karari ve
  basvuru sahibine otomatik geri bildirim maili eklendi.
- [x] 2026-04-16 Platform public alan, raporlar, tedarikci havuzu,
  kampanyalar ve analitikler menu kapanislari tamamlandi.
- [x] 2026-04-16 Terminoloji karari Turkce-first urun dili referansi ile
  genisletildi.
- [x] 2026-04-16 Batch C altinda migration copy-paste komutlari, dakika
  bazli checklist, evidence refresh ve release-window cikti seti
  sabitlendi.
- [x] 2026-04-16 Batch B altinda webhook retry, billing reconciliation
  audit ve invoice lifecycle KPI/filtre normalizasyonu tamamlandi.
- [x] 2026-04-16 Batch A altinda approval canonical role birincilligi ve
  transition audit yeniden dogrulandi.
- [x] Frontend build/test ve backend smoke/test paketleri tenant-aware
  auth, quote ve settings kontratlariyla yeniden sabitlendi.
- [x] Test fixture ve beklentileri system_role, quote payload ve yeni
  API prefixleriyle hizalandi.
- [x] Navigation, default yonlendirme ve route guard davranisi
  system_role odakli permission modeline gecirildi.
- [x] Super admin icin platform genel bakis, tenant listeleme,
  olusturma, guncelleme ve owner atama/aktif-pasif aksiyonlari eklendi.
- [x] Tenant olusturma akisina ilk tenant admin davet/kurulum adimi
  eklendi; tenant admin personel akisinda admin/super admin uretimi
  engellendi.
- [x] Admin router, auth branding, quote/approval router ve supplier
  router tenant_id scope modeliyle guclendirildi.
- [x] Platform destek ve operasyon kullanicilari icin system_role
  temeli, admin workspace gorunurlugu ve super admin personel olusturma
  akisi baslatildi.

### 2026-04-14

- [x] Hedef urun konumu yeniden tanimlandi
- [x] Admin'in personelden ayri bir tenant rolu olmasi gerektigi
  netlestirildi
- [x] Tenant-SaaS donusum omurgasi yazili hale getirildi
- [x] Hedef veri modeli tablo bazinda cikarildi
- [x] Eski yapi -> yeni yapi migrasyon plani yazildi
- [x] Ekran agaci ve menu mimarisi belirlendi
- [x] Mevcut model -> hedef tenant model esleme envanteri yazildi
- [x] Tenant ve tenant_settings model omurgasi eklendi
- [x] Ana domain tablolarina tenant_id hazirlik alanlari eklendi
- [x] Mevcut admin kayitlarindan tenant bootstrap scripti eklendi
- [x] Auth response katmanina system_role eklendi
- [x] User modelinde system_role gecis alani eklendi
- [x] AdminPage tenant admin ve super admin icin rol-bilincli
  workspace olarak yeniden kurgulandi
- [x] Tenant admin personel yaratma akisinda admin ve super admin
  rollerine gecis kapatildi
- [x] Super admin tenant yonetiminde owner atama ve tenant lifecycle
  aksiyonlari baslatildi
- [x] Frontend permission katmani tenant_admin ve super_admin icin
  system_role merkezli calisacak sekilde guncellendi
- [x] Backend admin router scoped admin sorgulari created_by
  fallback'i koruyarak tenant_id oncelikli olacak sekilde guncellendi
- [x] Auth branding created_by fallback'inden cikarilip tenant-first mantiga gecirildi
- [x] Quote ve approval giris noktalarinda tenant disi kayitlara
  erisim tenant scope helper'lari ile kapatilmaya baslandi
- [x] Supplier CRUD ve temel supplier management girisleri tenant
  scope helper'i ile guclendirilmeye baslandi
- [x] Tarihsel ikinci quote router yuzeyinde tenant disi erisim ve
  tenant bagsiz yeni quote olusumu sinirlandi; bu yuzey sonradan
  fiziksel olarak kaldirildi
- [x] Super adminin tum yetkileri korunurken platform destek
  personeli icin ayri system_role zemini kod tabanina eklendi
- [x] Frontend regression paketi guncel tenant-aware beklentilerle
  tekrar yesile cekildi (14 dosya, 41 test)
- [x] Backend regression paketi guncel tenant-aware beklentilerle
  tekrar yesile cekildi (11 dosya, 51 test)
- [x] Backend test fixture'lari system_role, proje uyeligi, quote
  zorunlu alanlari ve settings schema beklentileriyle guncellendi
- [x] Workspace panel tasarimcisi hizli link duzenleme ve sekme
  siralama destegi kazandi; yeni rol olusturuldugunda varsayilan panel
  profili otomatik bootstrap ediliyor
  - 2026-04-18 ilerleme: workspace panel profilleri quick_links veri
    modeliyle genisletildi. Hedefli dogrulama: frontend vitest
    admin-page-tenant-governance 61/61 yesil, backend pytest workspace
    panel authz 4/4 yesil.

- [x] 2026-04-19 fiziksel quote mirror cutover tamamlandi; post-cut
  scriptler `ALREADY_DROPPED` davranisina hizalandi, hedefli kalite
  kapilari tekrar yesile cekildi ve release dokumanlari gercek cutover
  durumuna guncellendi
  - 2026-04-19 kapanis delta: demo personel seed'i upsert ve demo
    tenant baglama mantigiyla duzeltildi; hatali ic
    `supplier_user@demo.procureflow.com` kaydi seed'den cikarildi.
    Guncel approval transition audit artefakti 37 kullanici / 0 issue
    ve 6 approval / 0 issue sonucuna dondu.

## 2026-04-19 Yeni Calisma Akisi: Teklif Vitrini, Ozel Listeleme ve Paket Yetkilendirme

Bu bolum, 2026-04-19 tarihinde netlestirilen yeni urun hedefini takip eder.
Amac; dashboard, teklif listeleme, supplier listeleme, ozel vitrin,
paket limiti, odeme-sonrasi ozellik acma ve menu mimarisini ayni omurgada
toplamaktir.

### Hedeflenen Urun Davranisi

- Super admin dashboard'inda platform genel tum teklifleri tek havuz olarak
  gormek yerine, teklifi yayinlayan Stratejik Partner bazli gruplama esas alinir.
- Her teklif kaydi icin en az su alanlar gorunur:
  - hangi Stratejik Partner yayimladi
  - teklif tipi / RFQ tipi
  - yayin modeli: ozel listeleme mi, sadece kendi tedarikcileri mi,
    platform geneli mi
  - kac supplier davet edildi / kac supplier cevap verdi
  - teklif hangi paket veya premium ozellik sayesinde acildi
- Stratejik Partner tarafinda teklif yayin modeli secilebilir olur:
  - sadece kendi tedarikcilerim
  - platform havuzu + uygun supplierlar
  - ozel listeleme / premium vitrin
- Supplier tarafinda da ayni mantigin tersi kurulur:
  - supplier hangi partner RFQ'larini gorebilir
  - platform vitrini, ozel listeleme, kampanya ile acilan firsatlar
  - kendi paketine acik olmayan RFQ turleri kilitli gorunur

### Uygulama Omurgasi

#### 1. Teklif Gorunurluk Modeli

- Teklif/RFQ kaydina yeni bir yayin modeli alan ailesi baglanir:
  - visibility_mode
  - listing_type
  - source_scope
  - published_by_tenant_id
  - published_for_supplier_pool
  - premium_feature_code
- Kanonik listeleme turleri:
  - private_suppliers_only
  - partner_plus_platform_network
  - premium_featured_listing
  - campaign_promoted_listing
- Bu alanlar hem dashboard kartinda hem quote liste API'sinde hem audit
  ekranlarinda ayni semantic ile kullanilir.

#### 2. Super Admin Dashboard Davranisi

- Dashboard anasayfasindaki `Teklifler` alani artik duz legacy liste gibi
  degil, platform operasyon panosu gibi davranir.
- Gorunmesi gereken ana segmentler:
  - Stratejik Partner bazli teklif ozeti
  - Ozel listeleme aktif teklifler
  - Yalnizca kendi supplier havuzuna acik teklifler
  - Platform havuzuna acilan teklifler
  - Kampanya ile one cikarilan teklifler
- Super admin satir bazinda su sorulara cevap alabilmeli:
  - Bu RFQ'yu hangi firma acti?
  - Hangi paket/ozellik buna izin verdi?
  - Su an kimler gorebiliyor?
  - Supplier tarafinda bunun karsiligi hangi vitrinde yer aliyor?

#### 3. Supplier Tarafina Aynalama

- Supplier workspace'te liste mantigi partner tarafinin ayni semantic modeliyle
  calisir.
- Supplier bir firsati gorurken su bilgileri alir:
  - RFQ sahibinin Stratejik Partner markasi
  - RFQ davet tipi
  - kendisinin bu listeye neden dahil oldugu
  - bu gorunurlugun paket, kampanya veya ozel listeleme kaynakli olup olmadigi
- Boylece ileride supplier listeleme ekranlari da partner teklif mantigiyla
  ayni veri modelini kullanir; sadece perspektif degisir.

#### 4. Paket ve Ozellik Gating Modeli

- Paketler sadece kullanici limiti degil, davranis limiti de tasir.
- Her scope icin paket kurallari ayrica tanimlanir:
  - strategic_partner plans
  - supplier plans
  - channel plans
- Paket kurallari asagidaki ailelerde tanimlanir:
  - max_companies
  - max_suppliers
  - max_active_rfqs
  - max_monthly_quote_collection
  - allow_platform_network_access
  - allow_private_supplier_pool_only
  - allow_premium_featured_listing
  - allow_campaign_listing
  - allow_dwg_bom_extraction
  - allow_ai_negotiation
  - allow_ai_discovery_lab
  - allow_advanced_reporting
  - allow_channel_commission_rules
- Premium ozellikler iki kanaldan acilabilir:
  - paket icinden dogrudan
  - ek satin alim / kampanya / urun odemesi ile sonradan

#### 5. Odeme Sonrasi Ozellik Acma

- Super admin, premium vitrin ve kampanya ozelliklerini manuel degil,
  odeme dogrulamasi ve urun aktivasyonu ile acar.
- Bunun icin ayri bir premium aktivasyon akisi gerekir:
  - siparis / odeme kaydi olusur
  - odeme dogrulanir
  - hedef tenant veya supplier hesabina premium feature atanir
  - feature icin baslangic ve bitis tarihi yazilir
  - audit kaydi tutulur
- Bu akis; `ozel listeleme`, `kampanyali one cikarma`, `AI destekli moduller`,
  `DWG/BOM kesif`, `ek supplier kapasitesi`, `ek RFQ limiti` gibi tum
  satisa bagli ozelliklerde ortak kullanilmalidir.

#### 6. Navigasyon Donusumu

- Public ana nav'da `Cozumler` sekmesi yerine `Teklifler` sekmesi gelir.
- Yanina `Tedarikciler` sekmesi eklenir.
- `Cozumler` ve `Fiyatlandirma` icerikleri ust nav'dan cikarilip ilgili
  scope sayfalarina dagitilir:
  - Stratejik Ortaklik sayfasi
  - Tedarikci sayfasi
  - Is Ortagi Programi sayfasi
- Boylece ana nav dogrudan urun akisina baglanir; scope bazli anlatim ise
  kendi program sayfalarinda derinlesir.

### Ekran Donusumleri

#### Super Admin / Dashboard

- [x] Dashboard teklif kutusu tenant-first gorunume alindi
- [x] Teklif satirlarina `yayinlayan firma`, `listeleme tipi`, `gorunurluk kapsami`
      alanlari eklenecek
- [x] `Ozel listeleme` ve `sadece kendi tedarikcileri` icin ayri rozet dili yazildi
- [x] 500 hatasi veren mevcut teklif liste endpoint'i tenant-first veri sozlesmesiyle
      yeniden ele alinacak

#### Stratejik Partner / Teklif Yayinlama

- [~] RFQ olusturma akisina yayin modeli secimi eklenecek
  - 2026-04-21 ilerleme: QuoteCreatePage icine yayin modeli secimi
    eklendi (`private_suppliers_only`, `platform_network_only`,
    `private_and_platform_network`, `premium_featured_listing`).
    Secim, create/import payload'ina `listing_scope_preference`
    olarak baglandi ve backend create/import akislari bu tercihi
    RFQ aciklamasina standart not olarak yazar hale getirildi.
- [x] Partner bazli supplier havuzu ile platform havuzu ayrimi ekranda net gosterilecek
- [x] Ozel listeleme secenegi sadece ilgili paket/premium ozellik aciksa kullanilabilecek

#### Supplier / Firsat Listeleme

- [x] Supplier workspace'te gorunen RFQ kayitlari yayin modeline gore etiketlenecek
- [x] Partner markasi, davet kapsami ve premium kaynak bilgisi supplier
  gorunumune eklenecek
- [x] Paket disi firsatlar `kilitli ozellik` diliyle gosterilecek

#### Super Admin / Paket ve Premium Ozellikler

- [x] Paket katalogu scope bazli limitle yeniden tanimlanacak
  - 2026-04-21 tamamlandi: Plan limit aileleri canonical policy
    anahtarlarina normalize edildi (`max_active_rfqs`,
    `max_monthly_quote_collection`, `allow_campaign_listing`,
    `allow_channel_commission_rules` vb.).
  - Geriye donuk uyum icin legacy anahtar -> canonical alias
    katmani eklendi; addon limit birikimi ve effective limit
    hesaplari canonical anahtarla calisiyor.
  - Paket ekrani/plan kartlari canonical key setini okuyacak sekilde
    guncellendi; policy flag anahtarlari (`allow_*`) ayrik olarak
    acik/kapali gorunur hale getirildi.
- [x] Premium ozellik satin alimi ile sonradan feature atama akisi kuruldu
- [x] Odeme dogrulama -> feature aktivasyon -> audit kaydi zinciri tek akisa baglandi

#### Public Bilgi Mimarisi

- [x] Ana nav `Ana Sayfa | Teklifler | Tedarikciler | Stratejik Ortaklik |
  Is Ortagi Programi | Tedarikci Ol | Demo Talep Et | Sisteme Giris`
  mantigina alinacak
- [x] `Cozumler` ve `Fiyatlandirma` icerikleri scope bazli sayfalara tasindi
- [x] Public sayfalarda paket ve premium ozellik anlatisi scope bazli ayrildi

### Teknik Notlar

- Mevcut ekran goruntusundeki `Request failed with status code 500` durumu,
  super admin dashboard teklif listesinin tenant-first / listing-type aware
  olmayan bir backend veya serializer katmanina carptigini dusunduruyor.
- Kod degisikligine gecmeden once su veri sozlesmesi netlestirilmelidir:
  - quote owner tenant
  - listing visibility type
  - premium feature source
  - supplier reach scope
  - package entitlement source
- Supplier tarafina ayni mantik uygulanacagi icin, teklif ve supplier listeleme
  iki farkli ekran gibi degil, ayni `market visibility` domaininin iki yuzu
  olarak modellenmelidir.

### Takip Durumu

- [x] Istenen yeni urun davranisi analiz edildi ve plan dokumanina baglandi
- [x] Veri sozlesmesi kesinlestirildi
- [x] Dashboard bilgi mimarisi wireframe'i uygulama icinde netlestirildi
- [x] Paket ve premium feature katalog matrisi cikarildi
- [x] Quote visibility domain modeli uygulandi
- [x] Supplier visibility domain modeli uygulandi
- [x] Odeme-sonrasi premium feature aktivasyon akisi uygulandi
- [x] Public nav ve sayfa yeniden dagitimi uygulandi
- [x] Premium feature satin alma baslatma UI'i ve hedefli
  backend/frontend testleri eklendi

Not 2026-04-19:

- Dashboard 500 kok nedeni quote tablosundaki canli kolon uyumsuzluguydu;
  runtime foundation patch ile giderildi.
- Quote API ve supplier quote API paket, premium, listing scope ve
  yayinlayan firma alanlariyla zenginlestirildi.
- Super admin/dashboard/supplier workspace/send modal yuzlerinde
  entitlement mantigi gorunur ve kismen zorlayici hale getirildi.
- Platform Agi supplier gonderimi backend'de plan/premium kontrolu olmadan
  artik acilmiyor.
- Admin paket ekranina stratejik partner bazli premium feature satin alma
  paneli eklendi; odeme initiate istegi tenant baglami ile kaydediliyor ve
  webhook basarisinda aktivasyon hedefli testlerle dogrulandi.
- Tenant owner icin SettingsTab uzerinden self-serve premium satin alma
  akisi eklendi; owner tenant baglami yeni onboarding context endpoint'i ile
  aliniyor.
- Eski `Cozumler` ve `Fiyatlandirma` route'lari artik icerik tasimiyor;
  canonical public sayfalara redirect olarak sadeleştirildi.
- Premium satin alma paneline dekont yukleme ve admin tarafinda manuel odeme
  dogrulama aksiyonu eklendi.
- Onboarding odeme ve aktivasyon onayi tamamlanmadan tenant governance
  tarafindaki aktif/pasif ve temel write aksiyonlari backend ve frontendde
  kilitlendi; erken aktivasyon by-pass'i kapatildi.
- Public onboarding akisi tek kategori alanindan cikartilip coklu faaliyet
  kategorisi, hedef kategori ve yeni kategori talep kuyruğu yapisina tasindi.
- Listede olmayan kategori onerileri onboarding studio icinde destek inceleme
  ve final onay asamasi ile yonetilir hale getirildi; bekleyen kategori talebi
  varken aktivasyon onayi verilmiyor.
- Public onboarding detay adiminda kategori secimi inline chip duzeninden
  popup/modal secicilere tasindi; form yuksekligi kisaltilirken secilen
  faaliyet ve hedef kategoriler ozet chip olarak form uzerinde gorunur kaldı.
- Faaliyet kategorisi icin en az 1 secim ve maksimum 5 kategori kurali,
  telefon zorunlulugu ve hedef kategoride 2 adet ucretsiz limit uygulandi.
- Ucretsiz hedef kategori limitini asan secimler onboarding odeme adimina ek
  tutar olarak yansitiliyor; backend kayit dogrulamasi plan ucreti + ekstra
  hedef kategori slot ucreti toplamı uzerinden yapiliyor.

## 10. Kanal Hesap Sahibi E-posta Ayarlari Genisletmesi (2026-05-01)

Durum: uygulandi

Kanal hesap sahibi panelinde SettingsTab artik yalnizca e-posta odakli calisir:

- Temel Ayarlar sekmesi kaldirildi (channel scope)
- Demo Verileri sekmesi kaldirildi (channel scope)
- Teklif Fiyat Kurallari sekmesi kaldirildi (channel scope)
- API Anahtarlari sekmesi kaldirildi (channel scope)

Kanal scope icin e-posta ayari yazma yetkisi acildi ve 403 ureten gereksiz
advanced-settings cagri zinciri kesildi.

Eklenen 7 yetenek:

1. E-posta sablon yonetimi (teklif daveti, onay, hatirlatma)
2. Imza kutuphanesi (preset olustur, uygula, sil)
3. Gonderim limiti ve gunluk kota ayarlari
4. E-posta saglik gostergesi (7 gun success/bounce/spam)
5. Dogrulanmis domain beyaz liste yonetimi
6. Mailbox fallback politikasi (platform_default / secondary_mailbox / queue_only)
7. Kanal markalama ayarlari (sender alias, logo url, primary color)

Teknik notlar:

- Frontend: channel tercihleri localStorage ile kullanici bazli saklaniyor
  (`channel-email-preferences-v1:{userId}`).
- Backend: `GET /api/v1/advanced-settings/email/health` endpointi eklendi.
  `system_email_messages` verisinden son 7 gun teslimat metriklerini dondurur.
- Frontend: email save akisinda domain whitelist kontrolu uygulaniyor.

Etkilenen dosyalar:

- web/src/components/SettingsTab.tsx
- web/src/components/AdvancedSettingsTab.tsx
- web/src/services/advanced-settings.service.ts
- api/routers/advanced_settings_router.py
