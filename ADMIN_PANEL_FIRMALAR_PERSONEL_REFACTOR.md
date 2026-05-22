# Süper Admin Paneli — Firmalar, Personel ve Tedarikçi Refactor İş Akışı

Talep tarihi: 2026-04-21
Kaynak: Kullanıcı talep özeti (super admin panel restructure)
Durum takibi: Bu dosyada `[ ]` → `[x]` ile işaretlenir.

---

## Alan Renk Kodlaması (Mevcut ve Korunacak)

| Scope / Grup                | Renk Kodu | Görsel Ad                   |
|:----------------------------|:----------|:----------------------------|
| Platform ekibi (portal)     | `#1d4ed8` | Mavi                        |
| Stratejik Ortak (partner)   | `#0f766e` | Yeşil-teal                  |
| Tedarikçi (supplier)        | `#b45309` | Turuncu-amber               |
| İş Ortağı / Kanal (channel) | `#7c3aed` | Mor-violet *(yeni eklenecek)|

---

## 1. Personel Sayfası Güncellemeleri

### 1.1 İş Ortakları (channel scope) Segmenti Ekleme

- [x] **P1** `PersonnelTab.tsx` — `PersonnelSegment` tipine `'channel'` ekle
- [x] **P1** `PersonnelTab.tsx` — `channelPersonnel` useMemo:
`system_role === 'channel_owner' | 'channel_agent'` veya `business_role ===
'channel_*'` ile filtrele
- [x] **P1** `PersonnelTab.tsx` — `channelGroups` useMemo:
channel kullanıcılarını bağlı firma/kanal organizasyonuna göre grupla
- [x] **P1** `PersonnelTab.tsx` — `visibleSegments` listesine
`{ key: 'channel', label: 'İş Ortağı Ekip Üyeleri (...)', color: '#7c3aed' }`
ekle (super admin görünümünde)
- [x] **P1** `PersonnelTab.tsx` — Segment seçici butonuna
channel renk geçişini uygula

### 1.2 Tedarikçi Personeli — Stratejik Ortak Gibi Kart Düzeni

Mevcut durum: Tedarikçi personeli sadece liste; detay/düzenle/aktif-pasif/sil yok.
Hedef: Stratejik Ortak grubundaki kart layout'uyla aynı.

- [x] **P1** `PersonnelTab.tsx` — `supplierGroups` render bloğuna kart başına
aksiyon butonları ekle:
  - **Detay** (detail modal açar)
  - **Düzenle** (edit modal açar)
  - **Aktif/Pasif** (toggle, renkli badge)
  - **Sil** (onay dialog'u ile)
- [x] **P1** `PersonnelTab.tsx` — Tedarikçi kart rengi `#b45309` (turuncu-amber)
ile Stratejik Ortak kartındaki `#0f766e` renk mantığını birebir izlesin
- [x] **P1** `PersonnelTab.tsx` — `updateTenantUser` / `deleteTenantUser`
çağrılarını tedarikçi kullanıcı ID'si ile uygun endpoint'e yönlendir
(`getAdminSupplierUsers` zaten mevcut)

### 1.3 İş Ortakları Personeli — Stratejik Ortak Gibi Kart Düzeni

- [x] **P1** `PersonnelTab.tsx` — Channel segment render bloğunu 1.2 ile aynı
kart layout'uyla yaz:
  - **Detay** / **Düzenle** / **Aktif-Pasif** / **Sil**
  - Renk: `#7c3aed` (mor-violet)
- [x] **P1** Backend: Channel kullanıcıları için `GET /admin/channel-users`
veya benzeri endpoint'in mevcut olup olmadığını kontrol et; yoksa ekle
- [x] **P1** `admin.service.ts` — `getAdminChannelUsers(channelOrgId)`
fonksiyonunu ekle (veya mevcut yapıya entegre et)

---

## 2. "Firmalar" Butonu ve Stratejik Partner Firma Aksiyonları

### 2.1 Buton Adı Düzeltmesi

- [x] **P1** `AdminPage.tsx` — nav item key `"companies"` için `label` değerini:
  - `canViewPlatformGovernance ? "Stratejik Partnerler / Firmalar" :
  "Firma Yapisi"` → `"Firmalar"` (her iki durum için de)

### 2.2 Firma Kartlarına Aksiyon Ekleme

Mevcut durum: Tenant/Firma listesinde kartlar var; üstte genel yönetim
aksiyonları mevcut ama kart başına detay/düzenle/aktif-pasif/sil eksik.

- [x] **P1** `CompaniesTab.tsx`
(veya TenantGovernance bölümü `AdminPage.tsx`) — Her firma kartına:
  - **Detay** butonu (mevcut detail modal veya yeni drawer)
  - **Düzenle** butonu (mevcut edit akışını tetikle)
  - **Aktif / Pasif** toggle (renkli badge, `updateTenant` çağrısı)
  - **Sil** butonu (onay dialog'u + `deleteTenant`)
- [x] **P1** Renk: Stratejik Ortak rengi `#0f766e` teması ile tutarlı

### 2.3 Stratejik Partner → "Firmalar" Altında Tedarikçi ve İş Ortağı Listesi

- [x] **P2** `CompaniesTab.tsx` — Firma detay/genişleme alanına:
  - **Tedarikçiler** alt sekmesi: bu firmaya davet ile gelmiş tedarikçiler
  - **İş Ortakları** alt sekmesi: bu firma ile ilişkili channel kayıtları
- [x] **P2** Her alt sekme için de detay/düzenle/aktif-pasif/sil kart aksiyonları

---

## 3. Menü Restrüktürü — "Tedarikçiler" Butonu

### 3.1 Mevcut Durum

Menüde şu an şunlar var:

- Firmalar           (key: "companies")
- Tedarikciler       (key: "suppliers")   ← KALDIRILACAK
- Platform Tedarikci Havuzu  (key: "platform_suppliers")  ← KORUNACAK / TAŞINACAK
``

### 3.2 Hedef Yapı

``

Firmalar
  ├── Stratejik Ortak / Müşteri Firmaları  (mevcut)
  ├── Tedarikçiler                         (buraya taşınacak)
  │     ├── Firmaya davet ile gelenler     (davet eden firmaya göre gruplu)
  │     └── Platform Tedarikçi Havuzu      (platform geneli, ayrı tutulsun)
  └── İş Ortakları / Kanallar              (channel scope, buraya eklenecek)
``

- [x] **P1** `AdminPage.tsx` — nav items'dan `key: "suppliers"` girişini kaldır
- [x] **P1** `AdminPage.tsx` — `key: "platform_suppliers"` girişini platform
admin menüsünde koru (süper admin görünümünde)
- [x] **P1** `AdminPage.tsx` veya `CompaniesTab.tsx` — "Firmalar" sekmesi içinde
alt sekme / bölüm olarak **Tedarikçiler** bölümünü oluştur
- [x] **P1** `AdminPage.tsx` veya `CompaniesTab.tsx` — "Firmalar" sekmesi içinde
**İş Ortakları** bölümünü oluştur

---

## 4. Tedarikçi-Firma İlişki Modeli

### 4.1 Davet Eden Firma Altında Gösterim

- [x] **P1** `AdminPage.tsx` /
`CompaniesTab.tsx` — Tedarikçi listesinde her tedarikçinin `invited_by_tenant_id`
veya `source_tenant_id` alanına göre ilgili firma altında gösterilmesi
- [x] **P1** Backend: `GET /admin/suppliers` endpoint'ine `source_tenant_id`
veya `invited_by_tenant_id` filtresi yoksa ekle
- [x] **P1** Tedarikçi kart render'ında "Davet Eden: [Firma Adı]" bilgisini göster

### 4.2 Platform Tedarikçi Havuzu — Ayrı Tutuluş

- [x] **P1** Platform tedarikçilerini (`is_platform_supplier = true`
veya ayrı tablo/flag) davet-ile-gelen tedarikçilerden görsel olarak ayır
- [x] **P1** Platform tedarikçisi badge'i / ikonu ekle (örn. "⭐ Platform Tedarikçisi")
- [x] **P2** Platform tedarikçisi açıklama kartı: "Bu tedarikçiler platform
genelinde listelenir. Ücretli listeleme sözleşmesi olan tedarikçilerdir."

### 4.3 Tedarikçi Görünürlük Hakları

- [x] **P2** Platform tedarikçisi:  → Ücret ödüyorsa tüm stratejik ortakların
tekliflerinde (RFQ gönderimi) görünür
- [x] **P2** Davet-ile-gelen tedarikçi: → Yalnızca davet eden firmanın
tekliflerinde görünür; ödeme yaparsa platform tedarikçisi hakkı kazanır
- [x] **P2** Backend: `SendQuoteModal` / teklif gönderimi sırasında tedarikçi
havuzu filtreleme: `is_platform_supplier OR invited_by == current_tenant_id`
- [x] **P2** Bu mantığı `SuppliersTab.tsx` ve `SendQuoteModal.tsx` üzerinde uygula
- [x] **P3** UI'da tedarikçi tipini gösteren etiket:
"Platform Havuzu" vs "Firma Tedarikçisi"

---

## 5. Proje Hiyerarşisi — Firma Altında Gösterim

### 5.1 Proje-Firma İlişkisi

- [x] **P1** Proje listesi render'ında her proje başına bağlı firma adını göster
- [x] **P1** Firma adı gösterimi: `short_name` varsa kullan,
yoksa `legal_name || brand_name`'in ilk 20 karakterini al (bkz. Bölüm 6)
- [x] **P2** `CompaniesTab.tsx` — Firma detay alanında o
firmaya ait projelerin listesini göster
- [x] **P2** Projeye ait firma filtresi / gruplamayı admin proje listesine ekle

### 5.2 Çok Firmalı Stratejik Ortaklar — Ana Firma Mantığı

- [x] **P2** Bir stratejik ortağın birden fazla firması varsa:
ilk kayıt tarihi en eski firma = Ana Firma
- [x] **P2** Diğer firmalar Ana Firma altında gösterilir (hiyerarşik tree / accordion)
- [x] **P2** Proje listesi ve kart başlıklarında **Ana Firma adı** kullanılır
- [x] **P2** Backend: `companies` tablosuna `is_primary` flag veya
`registered_at` sırasına göre belirleme logic'i ekle/düzenle

---

## 6. Firma Adı Kısa Gösterim Kuralı

Sorun: Uzun ünvan/hukuki ad gösterimde kart/başlık alanını bozuyor.

- [x] **P1** Firma adı kısa gösterim yardımcı fonksiyon:
`getShortCompanyName()` — `web/src/utils/companyDisplay.ts`
- [x] **P1** Proje liste kartlarında `getShortCompanyName`
kullan (PersonnelTab grup başlıkları ✅)
- [x] **P1** Personel grupları başlığında `getShortCompanyName` kullan
- [x] **P1** CompaniesTab kart başlıklarında `getShortCompanyName` kullan
- [x] **P2** Backend: `companies` tablosuna `short_name`
alanı yoksa migration ile ekle (nullable, varchar 60)

---

## 7. Test Güncellemeleri

- [x] **P2** `admin-page-tenant-governance.test.tsx` — Channel segment'i
için yeni test: "İş Ortağı Ekip Üyeleri segmenti gösterilir"
- [x] **P2** `admin-page-tenant-governance.test.tsx` — Firma listesinde
detay/düzenle/aktif-pasif/sil butonları testi → `companies-tab.test.tsx`
- [x] **P2** `personnel-tab-permissions.test.tsx` — Channel segment için
segment buton testi ekle
- [x] **P3** `public-pages.test.tsx` — Firma adı kısa gösterim helper unit testi

### 7.1 Kalibrasyon Atamasi (2026-05-01)

Acik maddeler icin owner ve hedef tarih atamasi:

| Madde | Oncelik | Owner | Hedef Tarih | Durum |
| :---- | :------ | :---- | :---------- | :---- |
| Projeye ait firma filtresi / gruplamayi admin proje listesine ekle | P2 | frontend-agent | 2026-05-06 | Tamamlandi (2026-05-17) |
| `public-pages.test.tsx` firma adi kisa gosterim helper unit testi | P3 | test-agent | 2026-05-07 | Tamamlandi (2026-05-17) |

Yurutme notu:

- Teknik koordinasyon: orchestrator-agent
- Cikis kaniti: ilgili test dosyalarinda yesil kosu + bu dokumanda `[ ] -> [x]`

---

## Öncelik Özeti

| Öncelik | Konu                                              | Etkilenen Dosya(lar)                        |
| :------ | :------------------------------------------------ | :------------------------------------------ |
| P1      | PersonnelTab — channel segmenti ekleme            | `PersonnelTab.tsx`                          |
| P1      | PersonnelTab — tedarikçi/iş ortağı kart aksiyonu  | `PersonnelTab.tsx`                          |
| P1      | "Firmalar" buton adı düzeltmesi                   | `AdminPage.tsx`                             |
| P1      | Firma kartlarına aksiyon ekleme                   | `CompaniesTab.tsx` / `AdminPage.tsx`        |
| P1      | "Tedarikçiler" menü butonu kaldırma               | `AdminPage.tsx`                             |
| P1      | Firma adı kısa gösterim helper                    | yeni util + tüm kart render'ları            |
| P2      | Tedarikçi-firma davet ilişkisi görünümü           | `CompaniesTab.tsx` / `admin.service.ts`     |
| P2      | Platform tedarikçisi görünürlük hakları           | `SendQuoteModal.tsx` / `SuppliersTab.tsx`   |
| P2      | Proje-firma hiyerarşisi                           | `CompaniesTab.tsx` / proje liste render     |
| P2      | Çok firmalı ortaklar — ana firma mantığı          | `CompaniesTab.tsx` + backend `companies`    |
| P2      | `short_name` backend migration                    | Alembic migration                           |
| P2      | Test güncellemeleri                               | test dosyaları                              |

---

*Bu dosya; P1 → P2 → P3 sırasıyla ilerlenecek şekilde hazırlanmıştır.  
Her madde tamamlandığında `[ ]` → `[x]` olarak işaretlenir.*
