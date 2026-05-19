# Quote (Teklif) Domain Tasarımı

Bu doküman, teklif (quote) domain'inin iş kurallarını, durum akışını,
yetkilendirme modelini, raporlama ve sözleşme üretim süreçlerini tanımlar.

Hedef, sürdürülebilir, test edilebilir, denetlenebilir ve kurumsal
seviyede bir backend temelidir.

---

## 🧭 Durum Panosu (Hızlı Takip)

Bu bölüm, projenin nerede olduğunu tek bakışta gösterir.

- ✅ **DONE**: Tamamlandı
- 🧪 **TESTED**: Test ile doğrulandı
- 👀 **IN_REVIEW**: Gözden geçirme aşamasında
- 🛠 **PLANNED**: Planlandı, henüz başlanmadı
- ⛔ **BLOCKED**: Engelde

|Başlık|Durum|Not|
|---|---|---|
|Status transition matrisi (`draft/submitted/approved/rejected`)|✅ DONE + 🧪 TESTED|Domain policy + API ile hizalı|
|Geçersiz transition HTTP kodu|✅ DONE + 🧪 TESTED|`409 -> 422` güncellendi|
|Status history testleri|✅ DONE + 🧪 TESTED|Workflow senaryoları geçti|
|Deprecation uyarısı temizliği (`UNPROCESSABLE_CONTENT`)|🛠 PLANNED|Teknik temizlik|
|Transition reason/note|🛠 PLANNED|Audit zenginliği|
|Concurrency guard|🛠 PLANNED|Race condition önleme|
|Domain event (`quote.status.changed`)|🛠 PLANNED|Genişleme altyapısı|

---

## 1) Amaç ve Kapsam

Quote domaini aşağıdaki yetenekleri kapsar:

- Teklif oluşturma
- Teklif güncelleme
- Teklif listeleme (filtre + sayfalama)
- Teklif detay görüntüleme
- Durum geçişleri (taslak, gönderildi, onaylandı, reddedildi, iptal)
- Gelişmiş raporlama (Excel + grafik + dışa aktarma)
- Onaylanan teklif için sözleşme üretimi (PDF / DOCX)
- Yazdırma kuyruğuna gönderme
- Tedarikçi bazlı görünürlük ve paylaşım
- Tek tık iletişim (arama / e-posta)
- Dosya ekli tekli veya toplu e-posta gönderimi

Kapsam dışı (ilk faz):

- Çoklu dil desteği (şimdilik öncelik dışı)
- Harici ERP çift yönlü senkronizasyon (ileri faz)

---

## 2) Terimler

- **Teklif (Quote):** Satın alma sürecinde toplanan fiyat/koşul teklifi
  kaydı.
- **Tedarikçi (Vendor):** Teklifi sağlayan firma.
- **Sahip (Owner):** Kaydı oluşturan veya atanan satın alma kullanıcısı.
- **Durum (Status):** Teklifin yaşam döngüsündeki hali.
- **Sözleşme (Contract):** Onaylanan tekliften üretilen resmi belge.
- **Paylaşım (Share):** Bir kaydın seçili kullanıcılara erişim açılması.
- **RBAC:** Role dayalı erişim kontrol modeli.

---

## 3) Durum Modeli (State Machine)

Geçerli durumlar:

- `taslak`
- `gonderildi`
- `onaylandi`
- `reddedildi`
- `iptal`

İzinli geçişler:

1. `taslak -> gonderildi`
2. `gonderildi -> onaylandi`
3. `gonderildi -> reddedildi`
4. `taslak -> iptal`
5. `gonderildi -> iptal`

İzinli olmayan tüm geçişler reddedilir.

Kurallar:

- `onaylandi`, `reddedildi`, `iptal` terminal durumdur.
- Terminal durumdaki teklif içerik alanları güncellenemez.
- `onaylandi` durumunda sözleşme üretimi tetiklenebilir.

### 3.1 Uygulama Durumu

- ✅ DONE + 🧪 TESTED: `draft -> submitted -> approved/rejected` akışı
  doğrulandı.
- ✅ DONE + 🧪 TESTED: Geçersiz direkt geçişler engellendi.
- ✅ DONE + 🧪 TESTED: Geçersiz geçiş HTTP yanıtı `422`.

---

## 4) Rol ve Yetki Modeli (RBAC)

Roller:

- `super_admin`
- `satinalma_direktoru`
- `satinalma_yoneticisi`
- `satinalma_uzmani`
- `satinalmaci`

Not:

- Gecis doneminde auth payload tarafinda `role` alani korunur,
ancak quote approval ve procurement akislari icin operasyonel anlam tasiyan
alan `business_role` / `required_business_role` olarak ayristirilmaya baslanmistir.

Temel prensipler:

- Yetki tanımları yalnızca `super_admin` tarafından yönetilir.
- Roller endpoint değil, **izin setleri** üzerinden değerlendirilir.
- Kayıt erişimi rol + sahiplik + paylaşım kombinasyonu ile belirlenir.

|Rol|Teklif Görme|Teklif Güncelleme|Durum Geçişi|Rapor Görme|Sözleşme Üretme|Yetki Yönetimi|
|---|---|---|---|---|---|---|
|super_admin|Tümü|Tümü|Tümü|Tümü|Tümü|Evet|
|satinalma_direktoru|Tümü|Tümü|Evet|Tümü|Evet|Hayır|
|satinalma_yoneticisi|Ekibi + Paylaşılan|Ekibi + Paylaşılan|Evet|Ekip|Evet|Hayır|
|satinalma_uzmani|Kendi + Paylaşılan|Kendi + Paylaşılan|Sınırlı|Kendi|Sınırlı|Hayır|
|satinalmaci|Kendi + Paylaşılan|Kendi + Paylaşılan|Sınırlı|Kendi|Sınırlı|Hayır|

---

## 5) Tedarikçi Görünürlüğü ve Paylaşım Kuralları

Temel kural:

- Her satın almacı varsayılan olarak yalnızca kendi tedarikçilerini görür.

Paylaşım kuralları:

- Kullanıcı, kaydı seçili kullanıcılara paylaşabilir.
- Paylaşım türleri: `goruntule`, `duzenle`, `yorum`.
- Paylaşım kaydı denetlenir (kim, ne zaman, hangi yetkiyle).
- Paylaşım geri alınabilir.
- Paylaşımla erişim açılmış olsa bile kritik geçişlerde rol kontrolü devam
  eder.

---

## 6) Teklif İş Kuralları

### 6.1 Oluşturma

- Başlık zorunlu.
- Para birimi whitelist içinde olmalıdır (TRY, USD, EUR).
- Son geçerlilik tarihi geçmişte olamaz.
- Kalem listesi en az 1 satır içermelidir.
- Tedarikçi ilişkisi zorunludur.

### 6.2 Güncelleme

- `taslak` durumunda alanlar güncellenebilir.
- `gonderildi` durumunda yalnızca izinli alanlar güncellenebilir
  (ör. notlar).
- Terminal durumda içerik güncellemesi kapalıdır.
- Her değişiklik audit kaydı üretir.

### 6.3 Listeleme

- Varsayılan sıralama `created_at desc`.
- Filtreler: durum, tarih aralığı, tedarikçi, kategori, tutar aralığı.
- Sayfalama zorunludur (`page`, `size` veya cursor).

### 6.4 Silme Politikası

- İlk yaklaşım: soft delete.
- Alanlar: `silindi_mi`, `silinme_tarihi`, `silen_kullanici_id`.
- Silinen kayıtlar varsayılan listede gösterilmez.

---

## 7) Raporlama Modülü (Öncelikli)

Raporlama bu projenin kritik bileşenidir.

### 7.1 Rapor Türleri

- Teklif performans raporu
- Tedarikçi başarı oranı raporu
- Satın almacı bazlı aktivite raporu
- Durum geçiş süreleri raporu (SLA odaklı)
- Onay/red oranı raporu
- Tasarruf analizi (hedeflenen vs gerçekleşen)

### 7.2 Çıktı Formatları

- Excel (`.xlsx`) ana format
- Grafik destekli sayfalar (sütun, çizgi, pasta)
- PDF özet rapor (yönetim sunumu için)

### 7.3 Rapor Özellikleri

- Tarih aralığına göre filtreleme
- Rol bazlı görünürlük
- Zamanlanmış rapor (günlük/haftalık/aylık)
- İndirilebilir ve arşivlenebilir çıktı
- Rapor oluşturma geçmişi (audit)

---

## 8) Sözleşme Üretimi (Onaylanan Firma)

Süreç:

1. Teklif `onaylandi` durumuna gelir.
2. Şablon seçilir (standart, kategori bazlı, özel).
3. Sözleşme verileri tekliften doldurulur.
4. Çıktı üretilir (`PDF` veya `DOCX`).
5. İstenirse yazdırma kuyruğuna gönderilir.

Kurallar:

- Sözleşme versiyonlanır (`v1`, `v2`, ...).
- Üreten kullanıcı ve zaman bilgisi loglanır.
- Nihai sürüm değiştirilemez, revizyon yeni versiyonla açılır.

---

## 9) İletişim Özellikleri (Mobil Entegrasyon Odaklı)

- Tedarikçi kartından tek tıkla telefon araması.
- Tekli e-posta gönderimi.
- Toplu e-posta gönderimi (seçili tedarikçiler).
- Dosya ekleyebilme (teknik şartname, görsel, PDF vb.).
- Kullanıcı kendi e-posta hesabı ile gönderim yapar
  (kişisel SMTP/OAuth kimliği).
- Gönderim kayıtları denetlenir (kim, kime, ne zaman, konu).

---

## 10) API Sözleşme Prensipleri

Kod seviyesinde teknik alan adları İngilizce kalabilir;
ürün dili ve dokümantasyon Türkçe olacaktır.

Önerilen şema adları:

- `QuoteCreate`
- `QuoteUpdate`
- `QuoteOut`
- `QuoteListOut`
- `QuoteStatus`
- `ReportRequest`
- `ReportOut`
- `ContractGenerateRequest`
- `ContractOut`
- `ShareRequest`
- `CommunicationRequest`
- `MessageOut`
- `ErrorOut`

Standart hata modeli:

- `kod`
- `mesaj`
- `detay` (opsiyonel)
- `iz_id` (opsiyonel)

---

## 11) Hata Kodları ve HTTP Eşlemeleri

- `VALIDATION_ERROR` -> 422
- `UNAUTHORIZED` -> 401
- `FORBIDDEN` -> 403
- `NOT_FOUND` -> 404
- `CONFLICT` -> 409
- `INVALID_STATUS_TRANSITION` -> 422
- `ACCESS_SCOPE_VIOLATION` -> 403
- `REPORT_GENERATION_FAILED` -> 500
- `CONTRACT_GENERATION_FAILED` -> 500
- `INTERNAL_ERROR` -> 500

> Not: Status transition ihlalleri domain validation hatası olduğu için
> `422` döner.

---

## 12) Gözlemlenebilirlik ve Denetlenebilirlik

Log alanları:

- `kullanici_id`
- `rol`
- `islem_tipi`
- `entity_id` (quote/report/contract)
- `sonuc`
- `iz_id`

Audit kapsamı:

- Durum geçişleri
- Paylaşım işlemleri
- Rapor üretimleri
- Sözleşme üretimleri
- E-posta gönderimleri

---

## 13) Güvenlik Gereksinimleri

- Tüm kritik işlemlerde yetki kontrolü zorunludur.
- Kayıt seviyesinde erişim kontrolü uygulanır (row-level authorization).
- Dosya eklerinde tip ve boyut doğrulaması yapılır.
- Hassas alanlar loglarda maskelenir.
- E-posta kimlik bilgileri şifreli saklanır.

---

## 14) Test Stratejisi

### 14.1 Servis Katmanı Testleri

- Durum geçiş doğrulamaları
- Rol ve izin kontrolleri
- Paylaşım kapsamı kontrolleri
- Rapor üretim filtre doğruluğu
- Sözleşme üretim kuralları

### 14.2 API Testleri

- Endpoint sözleşme testleri
- HTTP durum kodu doğrulamaları
- Yetkisiz erişim senaryoları
- Dosya ekli iletişim senaryoları

### 14.3 E2E Testler

- Tekliften onaya, onaydan sözleşmeye tam akış
- Rapor üretim ve indirme akışı
- Mobil odaklı iletişim akışı

### 14.4 Mevcut Test Durumu

|Test Alanı|Durum|Not|
|---|---|---|
|Quote workflow (`submit -> approve`)|✅ DONE + 🧪 TESTED|Başarılı|
|Invalid direct transition kontrolü|✅ DONE + 🧪 TESTED|Başarılı|
|Invalid transition HTTP `422`|✅ DONE + 🧪 TESTED|Başarılı|
|Concurrency/race testleri|🛠 PLANNED|Eklenecek|
|Event emit testleri|🛠 PLANNED|Eklenecek|

---

## 15) Faz Planı

### Faz-1 (hemen)

- Temel quote akışları (create/update/list/get)
- Rol + izin altyapısı (RBAC)
- Tedarikçi görünürlüğü ve paylaşım
- Raporlama v1 (Excel + temel grafik)
- Sözleşme üretim v1 (PDF/DOCX)
- İletişim v1 (tekli/toplu e-posta + ek)

### Faz-2

- Yazdırma kuyruğu entegrasyonu
- Zamanlanmış raporlar
- Gelişmiş dashboard metrikleri
- Sözleşme şablon yönetimi

### Faz-3

- ERP/harici sistem entegrasyonları
- Gelişmiş otomasyon kuralları
- Performans ve ölçek iyileştirmeleri

---

## 🗂 Değişiklik Günlüğü (Kısa)

- ✅ DONE + 🧪 TESTED: Quote status transition davranışı güncellendi.
- ✅ DONE + 🧪 TESTED: Invalid status transition HTTP kodu `409` yerine
  `422` yapıldı.
- ✅ DONE + 🧪 TESTED: Kalite kapıları (`pytest`, `ruff`,
  `ruff-format`, `mypy`) başarılı.

---

## 📌 Güncelleme Kuralı (Takım Standardı)

Her teknik commit sonrası bu dosyada ilgili satır güncellenir:

1. Durum etiketi (`🛠 -> ✅`)
2. Test etiketi (`🧪` eklendi mi)
3. Kısa not (gerekirse commit SHA)

Bu disiplin, projede "neredeyiz?" sorusunu 10 saniyede cevaplar.
