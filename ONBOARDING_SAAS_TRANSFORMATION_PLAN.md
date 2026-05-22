# 3-Tier Onboarding & SaaS Transformation Plan

**Tamamlama Tarihi:** 17 Nisan 2026  
**Durum:** Tasarım Aşaması (Implementation'a Hazır)

---

## 1. İŞ MODELI AÇIKLAMASI

### 1.1 Üç Customer Type'ı

```
STRATEJIK ORTAKLIQ (Strategic Partner)
├─ 3 Tier (Başlangıç / Gelişim / Kurumsal)
├─ Kota-Bazlı Limitler (Tedarikçi / Proje / Kullanıcı / İşlem)
├─ İlk 15 Gün ÜCRETSIZ (Farklı Limitlerle)
├─ Kart Doğrulaması (10-20 TL çekip iade)
├─ 15 Gün Sonra Limitler Düşer & Ödeme Başlar
└─ Premium Özellikler (DWG, Özel Tedarikçiler, Listeleme)

TEDARIKÇI (Supplier)
├─ 2 Tier (Başlangıç / Profesyonel)
├─ Sınırlı Teklif Sayısı (Başlangıçta)
├─ İlk 7 Gün ÜCRETSIZ + Kart Doğrulaması
├─ 7 Gün Sonra Ödeme Başlar
└─ Premium Özellikler (Analitik, Teknik Destek)

İŞ ORTAĞI (Business Partner / Channel Partner)
├─ Getirdikleri Tedarikçiye Göre Komisyon (İlk 90 Gün Yüksek %)
├─ 90 Gün Sonra Komisyon Normalize Düşer
├─ Kampanya Tanımlama (Bonus Komisyon Dönemleri)
└─ Performans Bonus (Aylık / Üç Aylık)
```

---

## 2. TEKNIK MODELLER

### 2.1 Mevcut DB Schema (Existing)

```
subscription_plans (Code: starter, professional, enterprise)
└─ Genel subscription model

tenant_subscriptions (Her tenant'ın subscription durumu)
└─ Status: trialing, active, paused, canceled
```

### 2.2 Yeni Tables Gerekli

#### **A) tenant_type** (Tenant tipi belirleme)
```sql
CREATE TABLE tenant_types (
    id INT PRIMARY KEY,
    code VARCHAR(50) UNIQUE (strategic_partner, supplier, business_partner),
    name VARCHAR(100),
    
    -- 15 gün / 7 gün / vb
    trial_days INT,              
    
    -- Kart doğrulama tutarı (10-20 TL)
    card_verification_amount NUMERIC(10,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **B) subscription_plan_tiers** (Her customer type için tier'lar)
```sql
CREATE TABLE subscription_plan_tiers (
    id INT PRIMARY KEY,
    tenant_type_id INT FK → tenant_types,
    tier_code VARCHAR(50) (başlangıç, gelişim, kurumsal),
    tier_name VARCHAR(100),
    
    -- Pricing
    trial_days INT,              -- İlk 15/7 gün
    trial_daily_price NUMERIC(10,2) DEFAULT 0,
    post_trial_daily_price NUMERIC(10,2),
    
    -- Trial dönem bitince limit değişimi
    trial_supplier_limit INT,
    trial_project_limit INT,
    trial_user_limit INT,
    trial_transaction_limit INT,
    
    post_trial_supplier_limit INT,
    post_trial_project_limit INT,
    post_trial_user_limit INT,
    post_trial_transaction_limit INT,
    
    -- Sıra
    display_order INT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **C) premium_features** (Ekstra ödemeye tabi özellikler)
```sql
CREATE TABLE premium_features (
    id INT PRIMARY KEY,
    code VARCHAR(50) UNIQUE (
        dwg_import,
        exclusive_suppliers,
        special_listing,
        advanced_analytics,
        api_access,
        custom_branding,
        priority_support
    ),
    name VARCHAR(100),
    description TEXT,
    
    -- Kimin kullanabileceği
    available_for_tenant_types VARCHAR(500), -- JSON: ["strategic_partner", "supplier"]
    
    -- Pricing
    monthly_price NUMERIC(10,2),
    annual_price NUMERIC(10,2),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **D) tenant_premium_features** (Tenant'ın aktif premium'ları)
```sql
CREATE TABLE tenant_premium_features (
    id INT PRIMARY KEY,
    tenant_id INT FK → tenants,
    premium_feature_id INT FK → premium_features,
    
    activated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,  -- NULL = lifetime
    
    billing_status VARCHAR(50) (active, pending_payment, expired),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **E) card_verification** (Kart doğrulama kayıtları)
```sql
CREATE TABLE card_verification_transactions (
    id INT PRIMARY KEY,
    tenant_id INT FK → tenants,
    tier_id INT FK → subscription_plan_tiers,
    
    -- 10-20 TL transaction
    verification_amount NUMERIC(10,2),
    payment_provider_code VARCHAR(50), -- paytr, iyzico, vb
    provider_transaction_id VARCHAR(150),
    
    status VARCHAR(50) (pending, captured, refunded, failed),
    
    -- Otomatik iade için
    refund_scheduled_at TIMESTAMP,
    refund_completed_at TIMESTAMP,
    refund_transaction_id VARCHAR(150),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **F) tenant_trial_period** (Trial dönemi takip)
```sql
CREATE TABLE tenant_trial_periods (
    id INT PRIMARY KEY,
    tenant_id INT FK → tenants,
    subscription_plan_tier_id INT FK → subscription_plan_tiers,
    
    trial_started_at TIMESTAMP DEFAULT NOW(),
    trial_ends_at TIMESTAMP,
    trial_extended_until TIMESTAMP,  -- Extension için
    
    -- Limitler (snapshot)
    trial_supplier_limit INT,
    trial_project_limit INT,
    trial_user_limit INT,
    
    post_trial_supplier_limit INT,
    post_trial_project_limit INT,
    post_trial_user_limit INT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) (active, completed, canceled),
    
    -- Trial sonrası ne olacak?
    action_on_completion VARCHAR(50) (activate_plan, send_reminder, cancel),
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **G) business_partner_commission** (İş ortağı komisyon)
```sql
CREATE TABLE business_partner_commissions (
    id INT PRIMARY KEY,
    business_partner_tenant_id INT FK → tenants,
    referred_supplier_tenant_id INT FK → tenants,
    
    -- Commission rates
    initial_commission_percent NUMERIC(5,2), -- İlk 90 gün (ör: 15%)
    post_90days_commission_percent NUMERIC(5,2), -- Sonra (ör: 5%)
    
    -- Dates
    commission_started_at TIMESTAMP DEFAULT NOW(),
    commission_upgraded_at TIMESTAMP,  -- 90 gün bittiğinde
    
    -- Campaign bonus
    active_campaign_bonus_percent NUMERIC(5,2) DEFAULT 0,
    campaign_bonus_started_at TIMESTAMP,
    campaign_bonus_ends_at TIMESTAMP,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **H) business_partner_ledger** (Komisyon hesaplama)
```sql
CREATE TABLE business_partner_ledger (
    id INT PRIMARY KEY,
    business_partner_tenant_id INT FK → tenants,
    transaction_id INT FK → payment_transactions,
    
    commission_amount NUMERIC(12,2),
    commission_percent NUMERIC(5,2),
    
    transaction_date TIMESTAMP,
    billing_period_month VARCHAR(7), -- 2026-04
    
    status VARCHAR(50) (pending, calculated, invoiced, paid),
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. API ENDPOINTS (Backend)

### 3.1 Onboarding Flow

```
POST /api/v1/onboarding/select-tenant-type
├─ Payload: { tenant_type_code: "strategic_partner" | "supplier" | "business_partner" }
├─ Response: { tenant_type_id, available_tiers }
└─ Purpose: Kullanıcı tipini seç

POST /api/v1/onboarding/select-plan-tier
├─ Payload: { tenant_type_code, tier_code: "başlangıç", plan_name, logo, tax_no, vb }
├─ Response: { tenant_id, tier, trial_days, verification_required: true, amount: 10-20 }
└─ Purpose: Plan seç → Tenant oluştur

POST /api/v1/onboarding/verify-card
├─ Payload: { tenant_id, card_token, amount }
├─ Response: { transaction_id, status: "pending", refund_scheduled_at }
└─ Purpose: Kart doğrulaması (10-20 TL)

POST /api/v1/onboarding/activate-tenant
├─ Payload: { tenant_id, card_verification_transaction_id }
├─ Response: { tenant_id, status: "active", trial_ends_at }
└─ Purpose: Tenant'ı aktif et + Trial başlat

GET /api/v1/onboarding/trial-status/{tenant_id}
├─ Response: { trial_days_remaining, current_limits, post_trial_limits }
└─ Purpose: Trial durumu kontrol
```

### 3.2 Premium Features

```
GET /api/v1/premium-features
├─ Response: [ { code, name, price, available_for_types } ]
└─ Purpose: Premium özellikler listesi

POST /api/v1/premium-features/activate
├─ Payload: { tenant_id, feature_code }
├─ Response: { feature_id, activated_at, expires_at, invoice_id }
└─ Purpose: Premium feature satın al

GET /api/v1/tenant/{tenant_id}/premium-features
├─ Response: [ { feature_code, activated_at, expires_at } ]
└─ Purpose: Tenant'ın aktif premium'ları
```

### 3.3 Business Partner (Channel)

```
POST /api/v1/business-partner/refer-supplier
├─ Payload: { business_partner_tenant_id, supplier_email, supplier_name }
├─ Response: { referral_link, commission_percent }
└─ Purpose: Tedarikçi davet et + Commission bağla

GET /api/v1/business-partner/commission-ledger
├─ Response: [ { supplier_name, transaction_amount, commission_amount, date } ]
└─ Purpose: Komisyon raporu

POST /api/v1/business-partner/create-campaign-bonus
├─ Payload: { business_partner_tenant_id, bonus_percent, starts_at, ends_at }
├─ Response: { campaign_id, bonus_percent }
└─ Purpose: Campaign bonus tanımla
```

---

## 4. FRONTEND UI AKIŞI

### 4.1 Onboarding Steps

```
Step 1: Siz Kimsiniz?
├─ [ ] Stratejik Ortaklık (B2B Platform)
├─ [ ] Tedarikçi (Supplier)
└─ [ ] İş Ortağı (Channel Partner)

↓

Step 2: Plan Seçimi
├─ Stratejik Ortaklık:
│  ├─ Başlangıç (15 gün ücretsiz) - 10 tedarikçi, 5 proje, 3 kullanıcı
│  ├─ Gelişim (29.99 TL/ay) - 100 tedarikçi, 50 proje, 15 kullanıcı
│  └─ Kurumsal (149.99 TL/ay) - Sınırsız
│
├─ Tedarikçi:
│  ├─ Başlangıç (7 gün ücretsiz) - 10 teklif/ay
│  └─ Profesyonel (19.99 TL/ay) - 500 teklif/ay
│
└─ İş Ortağı:
   └─ Bedava (1%+ commission)

↓

Step 3: Firma Bilgileri
├─ Şirket Adı
├─ Logo Upload
├─ Vergi Numarası
├─ Başlıca İletişim
└─ Admin Kullanıcı

↓

Step 4: Kart Doğrulaması
├─ "Kredi kartınızı doğrulamak için 10 TL çekeceğiz ve iade edeceğiz"
├─ [ Kart Bilgilerini Gir ]
└─ [ Doğrula ve Devam Et ]

↓

Step 5: Onay & Aktivasyon
├─ "Tebrikler! Hesabınız aktif."
├─ "Trial Dönemi: 15 gün kalan"
└─ [ Panele Git ]
```

### 4.2 Trial Dönemi Gösterimi

```
Dashboard Header (Daima görülecek):
┌────────────────────────────────────────┐
│ ⏱️ Trial Dönemi: 12 gün kalan            │
│ 15 Nisan → 30 Nisan Saat 23:59         │
│                                         │
│ Geçerli Limitler (Trial):               │
│ • Tedarikçi: 10 / 10                   │
│ • Proje: 5 / 5                         │
│ • Kullanıcı: 3 / 3                     │
│                                         │
│ ⚠️ 15 Nisan'da limitler düşecek        │
│    & ödeme başlayacak (29.99 TL/ay)    │
│                                         │
│ [ Premium Özellikleri Keşfet ]         │
└────────────────────────────────────────┘
```

---

## 5. İŞ AKIŞI (Business Logic)

### 5.1 Stratejik Ortaklık Örneği

```
1. Kullanıcı "Başlangıç" planını seçer
   ↓
2. Firma bilgilerini dolduruç
   ↓
3. "10 TL Kart Doğrulaması" başlar
   ↓
4. Ödeme başarılı → 10 TL iade planlanır (72 saat içinde)
   ↓
5. Tenant AKTIF olur, Trial başlar (15 Nisan - 30 Nisan)
   ↓
6. 15 Nisan Saat 00:00'de otomatik olarak:
   ├─ Limitler güncellenir (10→100 tedarikçi vs)
   ├─ Ödeme başlar (29.99 TL/ay)
   ├─ İlk Invoice oluşturulur (Pro-rate: 30 Nisan'a kadar)
   └─ Email bilgilendirmesi gönderilir
```

### 5.2 Business Partner Commission Örneği

```
1. Business Partner "A" Tedarikçi "B"'yi refere eder
   ↓
2. Tedarikçi "B" kaydolur
   ↓
3. Commission Contract oluşturulur:
   ├─ 90 gün boyunca: 15% komisyon
   └─ 90 gün sonra: 5% komisyon
   ↓
4. Tedarikçi "B" bir işlem yapar (1000 TL)
   ↓
5. Sistem hesaplar & ledger'a yazar:
   ├─ İlk 90 gün → Commission: 150 TL (15%)
   ├─ Sonra → Commission: 50 TL (5%)
   └─ Aylık invoice'da göster
```

---

## 6. IMPLEMENTATION TIMELINE

### **Aşama 1: DB Schema (2-3 saat)**
- [ ] Yeni tables oluştur
- [ ] Migration scripts oluştur
- [ ] Test verisi insert et

### **Aşama 2: Backend APIs (4-5 saat)**
- [ ] Onboarding endpoints
- [ ] Trial tracking services
- [ ] Premium features endpoints
- [ ] Business partner commission logic

### **Aşama 3: Frontend (3-4 saat)**
- [ ] Onboarding flow sayfaları
- [ ] Trial göstergesi
- [ ] Premium features marketplace
- [ ] Commission dashboard (Business Partners)

### **Aşama 4: Testing (2-3 saat)**
- [ ] Smoke tests (happy path)
- [ ] Edge cases (trial expiry, payment failure, refund)
- [ ] Integration tests

---

## 7. ÖDEME FLOW'LARI (Payment Integration)

### 7.1 Kart Doğrulaması (First Payment)

```
Amount: 10-20 TL
Process:
  1. Ödeme Gateway'e gönder (PayTR / iyzico)
  2. Card token'ı al
  3. 10-20 TL'lik charge yaz
  4. Status: captured
  5. 72 saat sonra REFUND zamanla

  If successful:
    - card_verification_transaction.status = "refunded"
    - tenant.status = "active"
    - trial_period.is_active = true

  If failed:
    - card_verification_transaction.status = "failed"
    - tenant.onboarding_status = "payment_failed"
    - Email: "Ödeme başarısız oldu. Tekrar deneyin."
```

### 7.2 Düzenli Ödeme (Recurring Billing)

```
After Trial Ends (Day 15 for Strategic Partner):
  1. billing_invoices POST oluşturulur
  2. PDF generate edilir (hosting URL)
  3. Recurring charge başlar (29.99 TL/ay)
  4. Webhook'tan status güncellenir

  Every month for active tenant:
    - New  invoice generated
    - Payment attempted
    - Status tracked (paid, failed, retry)
```

---

## 8. NOTLAR & FUTURE

- **Card verification otomasyonu**: 72 saat sonra refund otomatik zamanlanmalı
- **Trial reminders**: 3 gün kala, 1 gün kala email gönder
- **Upsell Logic**: Trial bitarken premium features öner
- **Churn Prevention**: Ödeme başarısız olursa retry + support email

---

**Status:** ✅ Tasarım Tamamlandı - İmplementasyon'a Hazır

Next: Aşama 1'e geçiyoruz (DB Schema & Migrations)
