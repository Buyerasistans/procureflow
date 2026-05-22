# Platform Operasyonları & Aktivasyon Sonrası Yönlendirme Yol Haritası

**Tarih:** 2026-04-21  
**Kapsam:** Tüm platform tipleri (Stratejik Ortak / Tedarikçi / İş Ortağı)

---

## Paket A — UI Temizlik (PlatformOperationsTab)

**Sorun:** Platform Ops kart içlerinde "Stratejik Ortak Yönetimine Git" ve "Paketlere Git" gibi global navigasyon butonları kafa karıştırıyordu.  
**Çözüm:**
- Her queue kartının altındaki global navigasyon butonları (`setActiveTab` + `navigateAdminTab` tetikleyen) kaldırıldı.
- "Sorumlu Kişi" serbest metin girişinden `<select>` listesine (platform personeli) dönüştürüldü.
- `platformOpsDefaultOwner` = "Platform Destek" yerine gerçek oturum sahibi kullanıcıya bağlandı.
- Owner kavramı netleştirildi:  
  - **Müşteri Yetkilisi** → `owner_user_id` FK'dan gelen ödeme yapan kayıt sahibi (onboardingde girilen kişi)
  - **İç Operasyon Sorumlusu** → `support_owner_name`: platform ekibinin kendi içi atama alanı

---

## Paket B — Erişim Reddi Düzeltmesi (CompanyDetailPage)

**Sorun:** `if (!isSuperAdminUser(user))` koşulu `tenant_admin` ve `platform_support` rollerini tamamen engelliyordu.  
**Çözüm:**
- Guard `canAccessAdminSurface(user)` ile değiştirildi.
- Super admin dışı kullanıcılar için salt-okunur mod eklendi (düzenleme butonları gizlendi).
- `useEffect` içindeki veri çekme de aynı şekilde genişletildi.

---

## Paket C — Destek Talebi (Ticket) Altyapısı

**Sorun:** Mevcut sistemde yalnızca `Tenant` tablosunda flat alanlar (`support_status`, `support_owner_name` vb.) vardı; gerçek bir ticket sistemi yoktu.

**Backend:**
- Yeni model: `api/models/support_ticket.py` → `support_tickets` tablosu
  - `id`, `tenant_id`, `created_by_user_id`, `assigned_to_user_id`
  - `subject`, `category` (billing/onboarding/technical/general), `priority` (low/medium/high/urgent)
  - `status` (open/in_progress/waiting_response/resolved/closed)
  - `description`, `resolution_note`
  - `source` (tenant_portal/platform_ops/post_activation)
  - `sla_due_at`, `resolved_at`, `created_at`, `updated_at`
- Yeni endpoint'ler: `api/routers/support_ticket_router.py`
  - `POST /support/tickets` → Ticket oluştur (tenant kullanıcısı)
  - `GET /support/tickets` → Kendi ticket listesi
  - `GET /support/tickets/{id}` → Detay
  - `POST /admin/support/tickets` → Tüm ticket'ları listele (platform ops)
  - `PATCH /admin/support/tickets/{id}` → Atama / durum güncelle

**Migration:** `migrations/2026_04_21_add_support_tickets.sql`

---

## Paket D — Aktivasyon Sonrası Yönlendirme Sistemi

**Hedef:** Kullanıcı aktivasyon mailini alıp giriş yaptıktan sonra, eksik bilgilerini tamamlamak için adım adım balon/rehber çıksın; platform personelini boşa uğraştırmadan tamamlasın.

**Mantık:**
1. Kullanıcı aktivasyon linkine tıklar → şifre belirler → giriş yapar
2. Dashboard'da `OnboardingChecklist` bileşeni görünür
3. Platforma göre farklı adım listesi:

**Stratejik Ortak adımları:**
- [ ] Şirket bilgilerini tamamla (vergi no, adres)
- [ ] Yetkili imza sahibini kaydet
- [ ] Logo yükle
- [ ] Kullanıcı davetleri gönder (departman yöneticileri)
- [ ] İlk tedarikçi listeni oluştur
- [ ] İlk satın alma talebini oluştur

**Tedarikçi adımları:**
- [ ] Profil bilgilerini tamamla (iletişim, banka bilgileri)
- [ ] Hizmet/ürün kategorilerini seç
- [ ] Belgeleri yükle (vergi levhası, imza sirküleri)
- [ ] İlk teklif talebini kabul et

**İş Ortağı adımları:**
- [ ] Profil bilgilerini tamamla
- [ ] Program koşullarını onayla
- [ ] Referans müşteri bilgisini ekle

**Teknik tasarım:**
- `web/src/components/OnboardingChecklist.tsx` — platform tipine göre adım listesi
- Adımlar localStorage'da `checklist_{userId}` key'i ile kalıcı tutulur
- Her adımın yanında "Nasıl yaparım?" linki → `buyerasistans.info/docs/{slug}`
- Tüm adımlar tamamlanınca banner kaybolur
- İsteğe bağlı "Sonraya bırak" → 7 gün gizlenir, 8. gün tekrar görünür

---

## Paket E — Bilgi Kütüphanesi (HelpCenter)

**Hedef:** Kullanıcılar sorularının cevabına `buyerasistans.info` adresindeki bilgi tabanında ulaşabilsin; bulamazlarsa platform destek personeline ticket açabilsin.

**Bileşen:** `web/src/components/HelpCenter.tsx`
- Sağ alt köşede sabit "?" yardım butonu (floating)
- Tıklandığında slide-in panel:
  - Arama kutusu
  - Kategoriler: Başlangıç, Satın Alma, Tedarikçiler, Faturalar, Hesap, Teknik
  - Her makale başlığı → `buyerasistans.info/docs/{slug}` target="_blank"
  - Buton: "Cevabı bulamadım → Destek Talebi Oluştur" → ticket formu açılır

**URL yapısı** (`buyerasistans.info` için önerilen):
```
/docs/                       → Ana rehber
/docs/stratejik-ortak/       → Stratejik Ortak kılavuzu
/docs/tedarikci/             → Tedarikçi kılavuzu
/docs/is-ortagi/             → İş Ortağı kılavuzu
/docs/aktivasyon/            → Aktivasyon adımları
/docs/fatura/                → Fatura & ödeme
/docs/destek/                → Destek talebi nasıl açılır
```

---

## Uygulama Sırası

| # | Paket | Dosyalar | Durum |
|---|-------|----------|-------|
| A | UI Temizlik | PlatformOperationsTab.tsx | ✅ Tamamlandı |
| B | Erişim Düzeltmesi | CompanyDetailPage.tsx | ✅ Tamamlandı |
| C | Ticket Backend | support_ticket.py, support_ticket_router.py, migration SQL | ✅ Tamamlandı |
| C | Ticket Frontend | SupportTicketWidget.tsx, admin.service.ts | ✅ Tamamlandı |
| D | Aktivasyon Yönlendirme | OnboardingChecklist.tsx, DashboardPage.tsx | ✅ Tamamlandı |
| E | HelpCenter | HelpCenter.tsx, App.tsx | ✅ Tamamlandı |
