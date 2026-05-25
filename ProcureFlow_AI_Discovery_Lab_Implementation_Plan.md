# ProcureFlow AI Kesif Laboratuvari Uygulama Plani

Bu dokuman, mimari projelerin yuklenmesi, CAD metadata ozutlemesi,
AI destekli teknik denetim ve recete bazli BOM uretilmesi icin
hedeflenen yol haritasini ve mevcut uygulama durumunu takip eder.

## Mevcut Durum Ozeti

- Canli upload ve analiz endpointi aktif: `/api/v1/ai-lab/analyze`
- Discovery Lab frontend, mock yerine gercek backend upload akisini kullaniyor
- `ezdxf` tabanli metadata extractor aktif, INSERT virtual-entity yorumunu da
kapsayacak sekilde gelistirildi ve test kapsami mevcut
- AI denetimi icin fallback mantigi calisiyor; harici LLM
entegrasyonu opsiyonel durumda
- BOM uretimi icin servis kati hazir ve frontend visualizer
katman bazli gruplu gorunume tasindi

## 1. Mimari Prensipler

- Hafif veri transferi: CAD dosyasi sunucuda islenir,
AI katmanina yalnizca metadata ve ozet JSON gonderilir.
- Gorev ayrimi: Teknik denetim Discovery Lab tarafinda biter,
satin alma akisina yalnizca onayli veri aktarilir.
- Recete bazli genisletme: Ana katmanlardan sarf ve alt malzeme kalemleri turetilir.
- Guvenli fallback: Harici AI bagimliligi yoksa
sistem kural bazli teknik rapor uretebilir.

## 2. Uygulama Paketleri

### Paket 1: Backend ve Veri Ozetleme

- [x] DXF/DWG upload endpointi ve gecici dosya isleme akisi
- [~] `PF_` katmanlari ve bloklari icin metadata extractor
- [x] Minha algoritmasinin net duvar metrajina etkisinin hesaplanmasi
- [~] Katman bazli BOM/recete motoru

### Paket 2: AI Gateway ve Teknik Denetci

- [~] Teknik denetci prompt ve fallback rapor mantigi
- [~] Mantiksal tutarlilik kontrolleri
- [~] Karar destek sorulari uretimi
- [x] Kullanici yanitlari icin audit log sistemi

### Paket 3: Laboratuvar Arayuzu

- [x] Interactive upload zone ve durum gosterimi
- [~] AI technical sidebar
- [~] BOM visualizer / tree view
- [x] Teknik kilit ve satin alma modulu aktarimi

## 3. Takip Cizelgesi

| Faz | Islem Tanimi | Durum |
| :-- | :-- | :--: |
| 1.1 | CAD dosyasindan JSON metadata uretimi | [~] |
| 1.2 | Teknik recete ve BOM motoru | [~] |
| 2.1 | AI Gateway ve analiz modulu | [~] |
| 2.2 | Mantiksal hata ve karar destek algoritmasi | [~] |
| 3.1 | Mimar interaktif kesif ve onay ekrani | [~] |
| 3.2 | Onayli verinin satin alma modulune transferi | [x] |

## 4. Son Uygulanan Dilimler

1. Gercek upload endpointi ile Discovery Lab frontend entegrasyonu tamamlandi.
2. `api/routers/ai_lab.py` upload kontrati ile metadata ve AI raporu donmeye basladi.
3. `api/services/extractor.py` daha dayanikli hale getirildi ve test ile dogrulandi.
4. AI ve BOM servisleri fallback destekli olacak sekilde sertlestirildi.
5. Discovery Lab ekraninda ilk BOM visualizer karti ve
canli BOM listeleme akisi eklendi.
6. BOM visualizer katman bazli gruplu gorunume tasinarak
tree-view gecisi icin temel hazirlandi.
7. BOM katman gruplari acilir/kapanir hale getirilerek ilk tree-view davranisi eklendi.
8. BOM alt kalemlerine secim ve teknik onay durumu
eklenerek inceleme akisi bir adim ileri tasindi.
9. BOM secimleri, AI karar aksiyonlari ve
teknik kilit onayi backend endpointleri ile kayit altina alindi.
10. Teknik onay butonu satin alma aktarim kuyrugu olusturan
canli confirm endpointine baglandi.
11. Teknik onay sonrasi mevcut RFQ domainine quote ve quote item kaydi
olusturan gercek procurement baglantisi eklendi.
12. Discovery Lab audit olaylari sayfa icinde timeline olarak gorunur hale getirildi.
13. Minha dusumu extractor seviyesinde net duvar metrajina uygulanmaya baslandi.
14. Discovery Lab istekleri kimlikli kullanici tokeni ile calisacak sekilde
guvenceye alindi ve confirm akisi zorunlu proje secimine baglandi.
15. Admin paneli platform genel bakisinda son Discovery Lab oturumlarini
gosteren yonetim karti eklendi.
16. Minha dusumu, blok scale bilgisi ve en yakin duvar katmani sinirlarina gore
daha geometri-duyarli dagitilmaya baslandi.
17. Discovery Lab session modeli olusturan kullanici ve secilen proje bilgisini
dogrudan kolon bazinda saklayacak sekilde genisletildi.
18. Admin panelindeki Discovery Lab izleme kartina durum, proje ve serbest metin
filtreleri ile detay ac/kapat davranisi eklendi.
19. AdminPage tenant governance regresyon testi Discovery Lab izleme kartini da
kapsayacak sekilde stabilize edildi.
20. Admin Discovery Lab kartina kullanici filtresi, tarih araligi alanlari ve
hizli tarih presetleri eklendi.
21. Discovery Lab confirm sonrasi olusan RFQ kaydi icin derin link, opsiyonel
otomatik yonlendirme ve localStorage tabanli kalici tercih eklendi.
22. Minha hesabi block rotation ve aciklik yonune gore yatay/dikey
olcek secerek daha hassas hale getirildi.
23. Minha hesabinda block tanimindan okunan width/height extents bilgisi
kullanilarak aciklik kesiti daha dogrudan hesaplanmaya baslandi.
24. Admin Discovery Lab kartina aktif filtre sonucunu anlik
ozetleyen KPI kartlari eklendi.
25. Discovery Lab KPI kartlari filtreye ayni sekilde cevap veren ayri backend
summary endpointi ile limitten bagimsiz hale getirildi.
26. Discovery Lab session context kolonlari icin Alembic zincirine bagli
resmi migration dosyasi eklendi.
27. Minha hesabinda INSERT `virtual_entities()` uzerinden en uzun aciklik eksenini
okuyan ileri geometri yorumu eklendi ve extractor birim testleri ile dogrulandi.
28. Discovery Lab kullanici yanitlari icin ayri audit tablo/modeli, endpoint ve
timeline kaydi eklendi.
29. Virtual-entity extractor, ARC yaylarini ornekleyip cok parcali aciklik
bloklarinda toplam eksen spanini kullanacak sekilde genisletildi.
30. SendQuoteModal ve ProjectSuppliersModal icin kaynak filtreleri ile
gonderim akislarini dogrulayan component testleri eklendi.
31. Discovery Lab AI teknik sidebar icine kullanici yaniti, gerekce ve audit
kararini backend answer endpointine kaydeden form baglandi.
32. Admin platform genel bakisina Discovery Lab kullanici yanitlarini gosteren
audit listesi ve answer-audit KPI karti eklendi.
33. Virtual-entity extractor, ELLIPSE ve SPLINE tabanli aciklik geometrilerini
de yorumlayacak sekilde genisletildi ve birim testleri eklendi.
34. Discovery Lab answer audit listesi proje, kullanici, arama ve karar durumuna
gore filtrelenebilir detay gorunumuyle admin platform genel bakisinda genisletildi.
35. Discovery Lab timeline karti user_answer olaylari icin soru, yanit, gerekce
ve aktor e-postasi detaylarini gosterecek sekilde zenginlestirildi.
36. Virtual-entity extractor icin ELLIPSE ve SPLINE karisik aciklik geometri
senaryolarini dogrulayan ek birim testi eklendi.
37. Admin paneline Discovery Lab answer audit kayitlarini tenant ve RFQ baglantilariyla
ayri operasyon sekmesinde gosteren detayli bir operasyon merkezi eklendi.
38. Discovery Lab answer audit serializer ve admin listeleri, tenant bilgisi ile
olusan quote/RFQ baglantisini caprazlayacak sekilde genisletildi.
39. Virtual-entity extractor, lineer ve egri geometri karisiminda eksen uzunlugunu
daha secici agirliklandiracak sekilde guncellendi.
40. Discovery Lab operasyon kartlarina tenant yonetimi ve proje akisina gecis butonlari
ile RFQ durum etiketi, RFQ detay/karsilastirma/duzenleme baglantilari eklendi.
41. Discovery Lab operasyon kartindaki RFQ insight paneli, status history icindeki
approval adimlari ile audit trail summary ve event detail alanlarini gosterecek
sekilde derinlestirildi.
42. Discovery Lab audit kartindan Tenant Yonetimi sekmesine geciste ilgili tenant
icin odak filtresi otomatik tasinip governance tablosu tek-tenant baglaminda
acilir hale getirildi.
43. Tenant governance odagi URL query paramlarina tasinarak deep-link ile yeniden
acildiginda ayni tenant baglaminin korunmasi saglandi.
44. RFQ insight paneline current quote transition reason ve pending approval ozeti
eklenerek karar baglami audit panelinde tek bakista okunabilir hale getirildi.
45. Discovery Lab operasyon kartindaki RFQ aksiyonlarina status-history ve full-audit-trail
icin quote detail sayfasina query-param tabanli derin baglantilar eklendi; quote
detail bu parametrelerle ilgili bolumu vurgulayip odakli acilir hale getirildi.
46. URL tabanli odak modeli projectFocusName ve onboardingPlanFocus parametreleriyle
proje ve onboarding sekmelerine tasinarak ayni baglamin paylasilabilir deep-link
olarak korunmasi saglandi.
47. projectFocusName odagi ProjectsTab icindeki gercek arama state'ine baglanarak
proje sekmesinin sadece banner degil, alt liste filtresi de odak
baglamiyla acilmasi saglandi.
48. Quote detail sayfasi, adminTab ve focus parametrelerini okuyup
Discovery Lab operasyon baglamina geri donus linki uretir hale getirilerek
admin <-> quote round-trip navigasyonu korundu.
49. Discovery Lab operasyon kartlarindaki comparison, edit ve insight deep-linkleri
quoteFocusId ve quoteInsight parametreleriyle zenginlestirilip admin'e geri donuste
son incelenen RFQ panelinin otomatik yeniden acilmasi saglandi; comparison report
sayfasi da ayni admin geri donus baglamini korur hale getirildi.
50. Admin Discovery Lab operasyon merkezinde quoteInsight parametresi ikinci seviye
restore davranisina baglanarak geri donus sonrasinda RFQ paneli icindeki status
history veya audit trail bolumu banner, vurgu stili ve otomatik kaydirma ile
hedefli acilir hale getirildi.
51. Discovery Lab operasyon merkezindeki quoteFocusId ve quoteInsight query parametreleri
tek seferlik consume edilip URL'den temizlenecek sekilde guncellendi; boylece
geri donus odagi ilk render'da uygulanirken kullanici manuel gezintiye gectiginde
banner ve highlight durumu kalici URL state'e donusmeden
sonlandirilabilir hale geldi.
52. Discovery Lab operasyon merkezindeki geri donus banner'ina manuel Odagi
Temizle aksiyonu eklenerek kullanicinin restore edilen RFQ status-history veya
audit-trail vurgusunu tek tikla kapatabilmesi saglandi.
53. Discovery Lab operasyon merkezindeki geri donus baglami, hedef RFQ kartinda
sabit odak etiketi ve kart highlight'i ile gorunur hale getirildi; ayrica sayfa
ustune gecici restore toast'i ve toast icinden RFQ kart odagina hizli git
aksiyonu eklenerek geri donus baglaminin ilk bakista fark edilmesi saglandi.
54. Discovery Lab restore toast'ina otomatik kapanis ilerleme gostergesi eklendi,
restore edilen RFQ karti gecici olarak audit listesinin en ustune tasindi ve
kullanici admin sekmeleri arasinda gecis yaptiginda restore odagi
discovery_lab_operations sekmesine geri donuste korunacak sekilde genisletildi.
55. Discovery Lab restore toast'i hover ve klavye odaginda duraklayacak sekilde
gelistirildi; restore edilen RFQ kart basligina pending approval, transition reason
ve son olay bilgisini gosteren mini ozet satiri eklendi; ayrıca restore odagi localStorage
uzerinden kisa sureli saklanip sert sayfa yenilemesinden sonra tek seferlik
olarak yeniden yuklenebilir hale getirildi.
56. Restore toast'i klavye ve pointer etkileşimlerinde duraklatilabilir hale getirilip
aksiyon penceresi uzatildi; RFQ kart basligindaki mini ozet satiri oncelikli karar
baglamini tek bakista gosterecek sekilde sabitlendi; localStorage tabanli tek-seferlik
restore ile sert yenileme sonrasi ayni RFQ odagi tekrar yakalanabilir hale getirildi
ve admin regresyon testi 25 senaryoya cikarildi.
57. Discovery Lab restore toast'i gorunur oldugu anda klavye odagi alacak ve
Escape ile kapanabilecek sekilde erisilebilir hale getirildi; restore edilen
RFQ kartindaki mini ozet renk kodlu risk badge'lerine cevrildi; restore yasam
dongusu hafif bir debug timeline paneliyle gorunur kilindi ve admin regresyon
testi 26 senaryoya cikarildi.
58. Restore debug timeline paneline event tipi filtreleri eklendi ve restore,
aksiyon, lifecycle olaylari ayri gorunur hale getirildi; timeline uzerinden tek
tikla restore replay aksiyonu eklenerek son RFQ odaginin yeniden tetiklenmesi
saglandi; tenant, onboarding, projects ve RFQ geri donus durumlari ortak admin
focus banner bileseninde birlestirildi ve admin regresyon testi 27 senaryoya cikarildi.
59. Admin focus banner bileseni kaynak etiketi ve zaman damgasi ile zenginlestirildi;
restore debug timeline olaylari localStorage uzerinden kisa sureli saklanip sert
yenileme sonrasinda da gorunur hale getirildi; restore replay aksiyonuna status
history ve audit trail hedef secimi eklendi ve admin regresyon
testi 28 senaryoya cikarildi.
60. Restore debug timeline'a tekil satir aksiyonlari ve timeline temizleme kontrolu
eklendi; replay hedef secimine gore replay butonu, toast ve RFQ focus banner metinleri
daha dinamik hale getirildi; ortak admin focus banner helper'i platform overview
derin link odaklarina da tasindi ve admin regresyon testi 30 senaryoya cikarildi.
61. Restore debug timeline aksiyonlari gorunur ve tiklanabilir hale getirilerek
operasyon ekraninda etkileşim dili genisletildi; replay hedef secimine gore buton
etiketi ve replay log metni dinamiklestirildi; platform overview odaklari ortak
admin focus banner helper'i uzerinden yonlendirilebilir hale getirildi ve admin
regresyon testi 30 senaryoda stabilize edildi.
62. Restore debug timeline satirlarina olay tipi ve onem seviyesi rozetleri
eklenerek operasyon okunurlugu artirildi; platform overview deep-link banner'ina
Discovery Lab, tenant governance ve onboarding sekmelerine dogrudan jump aksiyonlari
eklendi; ortak admin focus banner helper'i platform operations ve packages sekmelerindeki
aktif filtre odaklarini da ozetleyecek sekilde yayginlastirildi ve admin regresyon
testi 30 senaryoda yesil tutuldu.
63. Restore debug timeline paneline serbest metin arama ve sadece son replay zincirini
gosteren ikincil filtre eklendi; platform operations ve packages focus banner
aksiyonlari sekme icindeki ilgili kuyruk veya plan/kullanim kartina kaydiracak
sekilde derinlestirildi; platform overview, filtre odaklari ve restore baglamlarini
birlestiren export edilebilir Admin Focus Telemetry paneli eklendi ve admin regresyon
testi 30 senaryoda korundu.
64. Admin Focus Telemetry paneline kaynak, zaman penceresi ve serbest metin filtreleri
eklenerek export kapsamı daraltilabilir hale getirildi; ayni panel JSON yanina
CSV ozet uretecek sekilde genisletildi; replay zinciri filtresi aktifken ilgili
RFQ karti ekstra vurgu ve badge ile capraz isaretlenerek restore zinciri ile
audit listesi arasindaki bag kuvvetlendirildi ve admin regresyon
testi 30 senaryoda yesil kaldi.
65. Admin Focus Telemetry filtreleri telemetrySource, telemetryWindow ve
telemetrySearch query paramlarina tasinarak paylasilabilir deep-link haline getirildi;
telemetry export alani JSON/CSV icin kopyala ve indir aksiyonlariyla operasyonel
paylasima hazirlandi; replay zinciri seciliyken hedef RFQ kartinin ilgili alt bolumu
otomatik acilacak sekilde restore davranisi derinlestirildi ve RFQ kartindan telemetry
paneline geri donus gezintisi eklenerek iki yonlu bag kuruldu; admin regresyon
testi 30 senaryoda korunarak yesil tamamlandi.
66. Telemetry filtreleri sekmeler arasi merkezi admin navigasyon yardimcisi ile
korunarak platform overview-discovery-projects gecislerinde deep-link baglami
kaybetmeyecek hale getirildi; platform overview telemetry paneli query param
yoksa son kayitli filtre snapshot'ini localStorage
uzerinden geri yukleyerek otomatik restore
davranisi kazandi; telemetry export paketleri zaman damgali dosya adlari, filtre/olay
sayisi ozet basliklari ve satir-bazli section rozetleri ile zenginlestirilip admin
regresyon testi 34 senaryoda yesil tamamlandi.
67. Telemetry paneline secilebilir event ve replay zinciri fallback'i ile beslenen
Telemetry Quick Actions katmani eklenerek platform overview uzerinden hedef RFQ
status history veya audit trail aksiyonlari icin daha deterministik bir odak akisi
hazirlandi; telemetry export ozetleri kaynak bazli event dagilimi ve replay summary
satirlariyla genisletildi; kullaniciya bagli isimlendirilmis telemetry presetleri
localStorage tabanli kaydet/yukle butonlariyla panele tasinip admin regresyon
testi 35 senaryoda yesil tamamlandi.
68. Telemetry presetleri yeniden adlandirma ve silme aksiyonlariyla yonetilebilir
hale getirilerek panel icindeki filtre preset dongusu tamamlandi; secili telemetry
hedefi hem satir seviyesinde hem de RFQ audit kartinda Telemetry Secimi rozet ve
highlight'i ile cift yonlu gorunur kilindi; JSON/CSV
copy-download aksiyonlari gecici durum etiketiy leoperasyonel geri bildirim vermey
 basladi ve admin regresyon testi 35 senaryoda
yeniden yesil dogrulandi.
69. Telemetry presetleri icin paylasilabilir JSON paket hazirlama ve ice aktarma
akisi eklendi; preset paket textarea'si uzerinden takim ici kopyala-yapistir
aktarimi desteklenip admin regresyon testi 38 senaryoda yesil korundu.
70. Telemetry export aksiyonlari success/error durumlarini ayri gosterecek sekilde
sertlestirildi; bos icerik, clipboard ve indirme hatalari operatora ayri mesajlarla
doner hale getirildi ve hedef suite yeniden yesil dogrulandi.
71. Telemetry secimi Discovery Lab sekmesine geri donuldugunde ilgili RFQ kartini
otomatik acip hedef alt bolume kaydiran cift yonlu gezinme eklendi; tek-seferlik
reveal guard ile render dongusu riski kapatildi.
72. Preset paketleri icin versiyon ve metadata uyumluluk preview ozetleri eklendi;
import oncesinde kabul edilecek preset sayisi, exportedAt bilgisi ve uyari listesi
panelde gorunur hale getirildi.
73. Telemetry export, preset ve navigation aksiyonlari icin filtrelenebilir
aksiyon tarihcesi paneli eklendi; operator son hareketlerini
scope bazli ayirip inceleyebilir hale geldi.
74. Discovery Lab'de telemetry kaynakli otomatik odak icin gecici pulse/vurgu
animasyonu eklendi; secili RFQ karti kisa sureli guclu highlight ile one
cikarildi ve admin regresyon testi 39 senaryoda yesil tamamlandi.
75. Telemetry preset paketleri source workspace, operator ve preset hash
metadata'si il zenginlestirildi; import preview paneli artik bu alanlari ve
mevcut preset isimleriyle olusan override/cakisma sayisini
gosterecek sekilde derinlestirildi.
76. Telemetry aksiyon tarihcesi localStorage tabanli kisa sureli kaliciliga
tasinarak platform overview'e geri donuslerde ve sekmeler arasi gecislerde korunur
hale getirildi; admin regresyon testi tarihce restore senaryosunu kapsayacak
sekilde 41 senaryoya cikarildi.
77. Discovery Lab pulse odagi kart geneli yerine hedef alt bolum seviyesine indirildi
RFQ Status History ve RFQ Audit Trail bloklari telemetry kaynakli otomatik odakta
ayrik test-id ve daha hassas animasyonla vurgulanir hale getirildi.
78. Preset paket import preview'i override edilecek mevcut preset isimlerini ayri
rozetlerle gosterecek ve her preset icin kaynak/zaman/arama farklarini satir bazli
ozetleyecek sekilde derinlestirildi.
79. Telemetry aksiyon tarihcesine zaman penceresi ve serbest metin arama filtreleri
eklenerek operatorun son 30 dakika veya 24 saat icindeki preset/export/navigation
hareketlerini hizla daraltabilmesi saglandi.
80. Discovery Lab alt bolum pulse vurgusuna otomatik temizlenen aciklama etiketi
eklenerek telemetry seciminin neden status history veya audit trail bolumune
odaklandigi section seviyesinde gorunur hale getirildi.
81. Preset paket import preview'i yeni eklenecek presetleri override bloklarindan
ayri yesil rozet grubu ile gostererek import etkisini ilk bakista
ayristirir hale getirildi.
82. Telemetry aksiyon tarihcesi filtre kombinasyonlari localStorage uzerinden
saklanip platform overview'e geri donuste otomatik restore edilerek operatorun ayni
inceleme baglamina kaldigi yerden devam etmesi saglandi.
83. Discovery Lab pulse aciklama etiketine ilgili telemetry event satirina geri
donus ve secimi temizleme aksiyonlari eklenerek cift yonlu odak akisi section
seviyesinde tamamlandi.
84. Preset paket preview'indeki filter diff satirlari yeni kayit ve override
bazinda kartlara gruplanarak uzun paketlerde hangi presetin nasil degistigi
daha taranabilir hale getirildi.
85. Telemetry aksiyon tarihcesi filtre snapshot'i telemetryHistoryScope,
telemetryHistoryWindow ve telemetryHistorySearch query param'larina tasinarak
paylasilabilir deep-link davranisi kazandi.
86. Pulse etiketinden telemetry paneline geri donus sonrasi ilgili event karti
gecici highlight ve rozet ile isaretlenerek iki yonlu odak izlenebilirligi kuvvetlendirildi.
87. Preset import preview'ine aktif telemetry filtrelerinin mevcut durumu ile ilk
import referans preset arasindaki once/sonra ozetini gosteren tek satirlik ust
blok eklendi.
88. Telemetry action history query-param filtreleri merkezi admin navigation helper'ina
baglanarak platform overview disindaki sekmelere geciste de korunur hale getirildi.
89. Telemetry eventine geri donuste ilgili event karti otomatik scroll ile merkeze
getirildi ve kisa sureli scale highlight animasyonuyla gozden kacmasi engellendi.
90. Preset import preview'inde birden fazla preset oldugunda once/sonra aktif
filtre ozetini secilebilir referans preset bazinda degistiren kontrol eklendi;
operator artik hangi import presetinin filtre referansi alinacagini secerek
etkiyi karsilastirabiliyor.
91. Telemetry action history query filtreleri JSON/CSV export metadata'sine dahil
edilerek paylasilan telemetry raporlarinda operatorun inceleme baglami da
tasinmaya baslandi.
92. Geri donus highlight badge'ine fade-out aktif etiketi ve azalan sure/progress
gostergesi eklenerek vurgunun gecici oldugu kart seviyesinde daha acik anlatildi.
93. Preset import preview'inde secili referans preset grouped diff kartlari
listenin ustune alinip "Secili referans" etiketiyle belirginlestirildi; aktif
filtre ozet metni referans preset adini da icerecek sekilde lokalize edildi.
94. Telemetry export metadata'si, history filtrelerinin yanina secili history
gorunumu icin kayit sayisi ve scope dagilimini da ekleyecek sekilde genisletildi;
ayni bilgiler JSON ve CSV export akislarina tasindi.
95. Geri donus fade-out gostergesi event kartinda hover/focus ile duraklatilabilir
hale getirildi; kalan sure metni ve durum etiketi (aktif/duraklatildi) operator
incelemesi icin gorunur kilindi.

## 5. Siradaki Teknik Adimlar

1. Preset import preview kartlarina secili referans icin "yalnizca farklar"
gorunumu ekleyip uzun paketlerde satir yogunlugunu azaltmak.
2. Telemetry export metadata'sina history dagiliminin yanina son aksiyon zamani
ve secili pencereye gore tazelik (fresh/stale) etiketi eklemek.
3. Geri donus fade-out gostergesine manuel "2 sn uzat" aksiyonu ekleyerek operatorun
inceleme suresini kontrollu sekilde artirabilmesini saglamak.

## 6. %100 Tamamlanma Sonrasi Gecis Notu

- Telemetry/Discovery workstream adimlari %100 tamamlandiginda bir sonraki gelistirme
fazi `TENANT_SAAS_TRANSFORMATION_PLAN.md` uzerinden yuruturecek.
- Bu plana gecis aninda son telemetry/discovery regression sonucu,
tamamlanan madde numaralari ve acik teknik borclar tek bir kapanis
notu olarak bu dokumana eklenecek.

## 7. Hotfix Kapanis Notu — 2026-05-25

Discovery Lab hotfix fazı kapatıldı. Aşağıdaki kritikler giderildi ve release gate geçildi.

**Kapatılan kritikler:**

- K-1 Converter preflight NameError — commit `eb639b6`
- K-2 Teknik exception UI'a sızma — commit `9d24ab3`
- K-3 Test profili DB drop ediyordu — commit `f51755f`
- K-4 Converter durumu diagnose edilemiyordu — commit `4b2fc1b`

**Release gate:** PASS — pytest (nodrop), vitest (discovery-lab), type-check, build

**Kalan non-blocker borçlar (D-1..D-7):**
Detay: `docs/runbooks/discovery-lab-closure-note.md`

Sonraki faz `TENANT_SAAS_TRANSFORMATION_PLAN.md` üzerinden yürütülecek.
Non-blocker borçlar o planin ilk sprint'ine tasinacak.
