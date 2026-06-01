// Buyer Asistans — 5 Audience Registration Config
// Converted from design_handoff_registration_flows/kayit/data.jsx

export type AudienceCode = 'strategic' | 'supplier' | 'channel' | 'employer' | 'candidate';

export type Plan = {
  code: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  currency: string;
  badge: string | null;
  features: string[];
  limits: Record<string, string | number>;
};

export type Addon = {
  code: string;
  name: string;
  desc: string;
  price: number;
  unit: string;
};

export type StepDef = {
  key: string;
  label: string;
  hint: string;
};

export type CategoryOption = {
  code: string;
  label: string;
  group?: string;
};

export type CommissionTier = {
  code: string;
  name: string;
  rate: number;
  threshold: string;
  desc: string;
};

export type PartnerType = {
  code: 'referrer' | 'reseller' | 'alliance';
  name: string;
  desc: string;
  margin: string;
};

export type AudienceConfig = {
  code: AudienceCode;
  label: string;
  short: string;
  eyebrow: string;
  title: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  accentTint: string;
  onAccent: string;
  rail: string;
  page: string;
  pageTint: string;
  bullet: string;
  bulletLabel: string;
  steps: StepDef[];
  plans?: Plan[];
  addons?: Addon[];
  commissionTiers?: CommissionTier[];
  partnerTypes?: PartnerType[];
  categoryOptions?: CategoryOption[];
  initialData: Record<string, unknown>;
  nextSteps: string[];
};

// ── Shared lookup lists ───────────────────────────────────────────────────────

export const EMPLOYEE_RANGES = ['1–10', '11–50', '51–200', '200–500', '500–2000', '2000+'];
export const PROCUREMENT_RANGES = ['₺10M altı', '₺10M – ₺50M', '₺50M – ₺200M', '₺200M – ₺500M', '₺500M+'];
export const SALARY_RANGES = ['₺40K – ₺60K', '₺60K – ₺80K', '₺80K – ₺110K', '₺110K – ₺140K', '₺140K – ₺180K', '₺180K+'];
export const CAPACITY_RANGES = ['₺10M altı', '₺10M – ₺50M', '₺50M – ₺200M', '₺200M – ₺500M', '₺500M+'];
export const REGIONS = ['Tüm Türkiye', 'Marmara & Ege', 'İç Anadolu', 'Akdeniz', 'Güneydoğu', 'Karadeniz', 'Doğu Anadolu', 'Uluslararası'];
export const EXPERIENCE_RANGES = ['0–1', '1–3', '3–5', '5–8', '8–12', '12+'];
export const AVAILABILITY_OPTIONS = ['Hemen', '2 hafta içinde', '1 ay içinde', '3 ay içinde', 'Sadece doğru fırsatla'];
export const MONTHLY_DEALS_OPTIONS = ['1–5 lead/ay', '5–15 lead/ay', '15–50 lead/ay', '50+ lead/ay'];

export type WorkModeOption = { code: string; label: string };
export const WORK_MODES: WorkModeOption[] = [
  { code: 'fulltime',  label: 'Tam zamanlı' },
  { code: 'parttime',  label: 'Yarı zamanlı' },
  { code: 'freelance', label: 'Freelance' },
  { code: 'hybrid',    label: 'Hibrit' },
  { code: 'remote',    label: 'Uzaktan' },
  { code: 'onsite',    label: 'Ofis' },
];

export type PaymentMethod = { code: string; label: string; desc: string; icon: string; note?: string };
export const PAYMENT_METHODS: PaymentMethod[] = [
  { code: 'card',      label: 'Kredi / Banka Kartı', desc: 'Anında onay. PCI-DSS Level 1 iyzico altyapısı.',                                   icon: '💳' },
  { code: 'eft',       label: 'EFT / Havale',         desc: 'Dekont yükle, süper admin 1 iş gününde doğrulasın.',                               icon: '🏦' },
  { code: 'corporate', label: 'Kurumsal Fatura',       desc: 'Yıllık sözleşme + 30 gün vadeli e-fatura. Onaylı şirketler için.',                 icon: '📄', note: 'Süreç süper admin onayıyla ilerler.' },
];

// ── Supplier category options ─────────────────────────────────────────────────

export const SUPPLIER_CATEGORY_OPTIONS: CategoryOption[] = [
  { code: 'cnc',         label: 'CNC işleme',                 group: 'Üretim' },
  { code: 'kompresor',   label: 'Endüstriyel kompresör',      group: 'Üretim' },
  { code: 'hidrolik',    label: 'Hidrolik sistemler',         group: 'Üretim' },
  { code: 'pnomatik',    label: 'Pnömatik sistemler',         group: 'Üretim' },
  { code: 'enjeksiyon',  label: 'Plastik enjeksiyon kalıbı',  group: 'Üretim' },
  { code: 'sac',         label: 'Sac metal işleme',           group: 'Üretim' },
  { code: 'lazer',       label: 'Lazer kesim',                group: 'Üretim' },
  { code: 'yag',         label: 'Endüstriyel yağ & gres',     group: 'Tüketim malzeme' },
  { code: 'pano',        label: 'Elektrik panoları',          group: 'Elektrik' },
  { code: 'rulman',      label: 'Rulman & güç aktarma',       group: 'Otomotiv' },
  { code: 'plc',         label: 'PLC & otomasyon',            group: 'Otomasyon' },
  { code: 'sensor',      label: 'Endüstriyel sensör',         group: 'Otomasyon' },
  { code: 'kimya',       label: 'Endüstriyel kimyasallar',    group: 'Kimya' },
  { code: 'ambalaj',     label: 'Ambalaj & paketleme',        group: 'Lojistik' },
  { code: 'lojistik',    label: 'Lojistik & nakliye hizmeti', group: 'Lojistik' },
  { code: 'tasit',       label: 'Tedarik filo araçları',      group: 'Lojistik' },
  { code: 'tekstil',     label: 'Endüstriyel tekstil',        group: 'Tekstil' },
  { code: 'guvenlik',    label: 'Güvenlik & CCTV',            group: 'Tesis hizmetleri' },
  { code: 'temizlik',    label: 'Endüstriyel temizlik',       group: 'Tesis hizmetleri' },
  { code: 'iletisim',    label: 'IT & ağ donanımı',           group: 'IT' },
];

export const EMPLOYER_CATEGORY_OPTIONS: CategoryOption[] = [
  { code: 'endustriyel', label: 'Endüstriyel üretim'   },
  { code: 'otomotiv',    label: 'Otomotiv'             },
  { code: 'lojistik',    label: 'Lojistik & nakliye'   },
  { code: 'it',          label: 'IT & yazılım'         },
  { code: 'finans',      label: 'Finans & danışmanlık' },
  { code: 'saglik',      label: 'Sağlık & ilaç'        },
  { code: 'tekstil',     label: 'Tekstil & ambalaj'    },
  { code: 'gida',        label: 'Gıda & tarım'         },
  { code: 'insaat',      label: 'İnşaat'               },
  { code: 'enerji',      label: 'Enerji & altyapı'     },
  { code: 'perakende',   label: 'Perakende'            },
  { code: 'turizm',      label: 'Turizm & otelcilik'   },
];

// ── AUDIENCES config ──────────────────────────────────────────────────────────

export const AUDIENCES: Record<AudienceCode, AudienceConfig> = {

  strategic: {
    code: 'strategic',
    label: 'Stratejik Partner',
    short: 'Stratejik',
    eyebrow: 'Kurumsal Alıcı Kaydı',
    title: 'Tedarik operasyonunu birlikte standardize edelim.',
    tagline: '~5 dakika · Sözleşme öncesi tahsilat alınmaz',
    accent: '#112a25',
    accentSoft: '#20463e',
    accentTint: '#D4AF37',
    onAccent: '#f0fdf4',
    rail: 'linear-gradient(135deg,#112a25 0%,#173630 52%,#20463e 100%)',
    page: 'radial-gradient(circle at top left, rgba(212,175,55,0.20), transparent 30%), linear-gradient(135deg, #f7f1e7 0%, #dfe8e2 48%, #eef4f7 100%)',
    pageTint: '#f7f5ef',
    bullet: 'Stratejik partnerler ortalama <b>%18 satınalma tasarrufu</b> rapor ediyor; RFQ süresi <b>11 günden 3 güne</b> iniyor.',
    bulletLabel: 'Neden stratejik partner olmalıyım?',
    steps: [
      { key: 'company',  label: 'Şirket Bilgisi',    hint: 'Yasal + adres + logo' },
      { key: 'owner',    label: 'Hesap Sahibi',      hint: 'Tenant Sahibi rolü' },
      { key: 'profile',  label: 'Operasyon Profili', hint: 'Kategori + ölçek' },
      { key: 'plan',     label: 'Plan Seçimi',       hint: 'Paketi seç' },
      { key: 'extras',   label: 'Ekstra Haklar',     hint: 'İhtiyacın varsa ekle' },
      { key: 'payment',  label: 'Ödeme',             hint: 'Kart / EFT' },
      { key: 'confirm',  label: 'Onay & Gönder',     hint: 'Son kontrol' },
    ],
    plans: [
      {
        code: 'starter', name: 'Başlangıç', tagline: 'Tek lokasyon, küçük ekip',
        priceMonthly: 1490, currency: '₺', badge: null,
        features: [
          'Tek firma · 5 personel · 50 RFQ / ay',
          'Temel modüller: RFQ, teklif toplama, onay zinciri',
          'Platform tedarikçi havuzuna erişim',
          'Aylık fatura · standart e-posta desteği',
          'Temel rapor ekranları',
        ],
        limits: { firma: 1, personel: 5, rfq: 50, supplier: '∞' },
      },
      {
        code: 'growth', name: 'Gelişim', tagline: 'Çok firmalı, büyüyen ekip',
        priceMonthly: 4990, currency: '₺', badge: 'En Popüler',
        features: [
          '5 firma · 25 personel · 200 RFQ / ay',
          'Başlangıç + onay akış otomasyonu, finans uyarıları',
          'Kategori scorecard + KPI export',
          'Custom domain + marka katmanı',
          'Aylık fatura · öncelikli destek (Slack + e-posta)',
        ],
        limits: { firma: 5, personel: 25, rfq: 200, supplier: '∞' },
      },
      {
        code: 'enterprise', name: 'Kurumsal', tagline: 'Holding ve şirketler topluluğu',
        priceMonthly: 14900, currency: '₺', badge: null,
        features: [
          'Sınırsız firma · sınırsız personel · sınırsız RFQ',
          'Gelişim + ERP entegrasyonu (SAP / Logo / Netsis)',
          'SSO/SAML · özel SLA (%99.95) · dedicated CSM',
          'Çoklu domain · audit log export',
          'Yıllık fatura · ödeme planı esnek',
        ],
        limits: { firma: '∞', personel: '∞', rfq: '∞', supplier: '∞' },
      },
    ],
    addons: [
      { code: 'firma10',    name: '+10 firma slotu',        desc: 'Mevcut paket sınırının üzerine firma ekleme hakkı.',                   price: 790,  unit: '/ay' },
      { code: 'personel50', name: '+50 personel slotu',     desc: 'Ek kullanıcı koltuğu — onay yöneticisi veya talep sahibi rollerinde.', price: 590,  unit: '/ay' },
      { code: 'rfq50',      name: '+50 RFQ kotası',         desc: 'Aylık RFQ kotasını arttırır; ay sonunda kullanılmayan kota devretmez.', price: 390,  unit: '/ay' },
      { code: 'domain',     name: 'Custom domain',          desc: 'satinalma.firmaniz.com gibi alt alan adı + SSL sertifikası.',           price: 990,  unit: '/ay' },
      { code: 'api',        name: 'API + Webhook erişimi',  desc: 'ERP / muhasebe / lojistik sistemlerinle çift yönlü veri akışı.',        price: 1490, unit: '/ay' },
      { code: 'csm',        name: 'Dedicated CSM',          desc: 'Aylık business review, eğitim oturumları, öncelikli destek hattı.',     price: 2990, unit: '/ay' },
    ],
    initialData: {
      legalName: '', brandName: '', logoUploaded: false,
      taxId: '', taxOffice: '', tradeRegistry: '',
      address: '', city: '', district: '', postalCode: '', phone: '',
      ownerName: '', ownerEmail: '', ownerPhone: '', ownerRole: 'tenant_owner',
      categories: [], interestCategories: [],
      employeeCount: '', annualProcurement: '',
      planCode: 'growth', addons: [],
      paymentMethod: 'card',
      cardNumber: '', cardHolder: '', cardMonth: '', cardYear: '', cvv: '',
      eftReceiptUploaded: false,
    },
    nextSteps: [
      'Sözleşme imza için PDF e-postana gönderildi (KEP ile iletilir).',
      'Ekip arkadaşlarını davet et, onay zincirini birlikte kuralım.',
      'Tedarikçi havuzunu ihtiyaçlarına göre kategorize et.',
      'İlk RFQ ile başla — 3 gün içinde teklif almaya başlarsın.',
    ],
  },

  supplier: {
    code: 'supplier',
    label: 'Tedarikçi',
    short: 'Tedarikçi',
    eyebrow: 'Tedarikçi Kaydı',
    title: 'Doğru alıcılarla buluş, RFQ davetlerinde sıralamaya gir.',
    tagline: '~5 dakika · Ücretsiz pakette başla · İnceleme 1 iş günü',
    accent: '#0284c7',
    accentSoft: '#0ea5e9',
    accentTint: '#0ea5e9',
    onAccent: '#f0f9ff',
    rail: 'linear-gradient(135deg,#1a3a5c 0%, #1d4f7a 60%, #2563eb 100%)',
    page: 'radial-gradient(circle at top left, rgba(14,165,233,0.20), transparent 30%), linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 56%, #f8fafc 100%)',
    pageTint: '#f0f9ff',
    bullet: 'Aktif tedarikçiler ortalama ayda <b>12 RFQ daveti</b> alıyor; ücretsiz pakette bile bul-eşleş profili çalışıyor.',
    bulletLabel: 'Neden tedarikçi olmalıyım?',
    steps: [
      { key: 'company',     label: 'Şirket Bilgisi',         hint: 'Yasal + adres + logo' },
      { key: 'payment_info',label: 'Ödeme Bilgileri',        hint: 'IBAN(lar)' },
      { key: 'categories',  label: 'Kategoriler',            hint: 'Ne tedarik veriyorsun?' },
      { key: 'docs_refs',   label: 'Belgeler & Referanslar', hint: 'Vergi + sicil + müşteri' },
      { key: 'plan',        label: 'Plan Seçimi',            hint: 'Ücretsizden başla' },
      { key: 'extras',      label: 'Ekstra Haklar',          hint: 'İhtiyacın varsa' },
      { key: 'payment',     label: 'Ödeme',                  hint: 'Free ise atlanır' },
      { key: 'confirm',     label: 'Onay & Gönder',          hint: 'İnceleme 1 iş günü' },
    ],
    plans: [
      {
        code: 'free', name: 'Tedarikçi Ücretsiz', tagline: 'Bul-eşleş profili, ücretsiz',
        priceMonthly: 0, currency: '₺', badge: 'Ücretsiz',
        features: [
          'Profil oluşturma + platformda görünürlük',
          'Ayda 5 RFQ davetine yanıt verme hakkı',
          'Aylık performans özeti',
          'Standart yanıt sırası',
          'Temel destek (e-posta · 48 saat yanıt)',
        ],
        limits: { davet: '5/ay', user: 1 },
      },
      {
        code: 'prime', name: 'Tedarikçi Prime', tagline: 'Sınırsız davet, profil öne çıkar',
        priceMonthly: 290, currency: '₺', badge: 'En Popüler',
        features: [
          'Ücretsiz pakettekilerin tümü',
          'Sınırsız RFQ daveti yanıtlama',
          'Profil "Doğrulanmış" rozetiyle öne çıkar',
          'Kategori bazlı performans raporu + rakip kıyaslama',
          'Çoklu kullanıcı (3 koltuğa kadar)',
          'Öncelikli destek (canlı sohbet)',
        ],
        limits: { davet: '∞', user: 3 },
      },
      {
        code: 'premium', name: 'Tedarikçi Premium', tagline: 'Kategori sponsorluğu + erken erişim',
        priceMonthly: 790, currency: '₺', badge: null,
        features: [
          'Prime + RFQ erken erişim (alıcı yayınlamadan 6 saat önce)',
          '1 kategoride sponsorluk pozisyonu',
          'Çoklu kullanıcı (10 koltuğa kadar)',
          'API + webhook erişimi',
          'Dedicated success manager',
        ],
        limits: { davet: '∞', user: 10 },
      },
    ],
    addons: [
      { code: 'sponsor', name: 'Ek kategori sponsorluğu',  desc: 'Belirli kategoride üst sıralarda görünürlük + öne çıkar rozeti.',    price: 490, unit: '/ay/kategori' },
      { code: 'user',    name: '+1 ek kullanıcı koltuğu', desc: 'Ekipten ek kullanıcı ekleme (yetki yöneticisi tarafından atanır).',  price: 190, unit: '/ay' },
      { code: 'video',   name: 'Profil tanıtım videosu',   desc: '1 dakikalık profesyonel çekim — platform stüdyosundan organize.',    price: 240, unit: '/tek seferlik' },
      { code: 'verify',  name: 'Doğrulama hızlandırma',    desc: '1 iş gününü 4 saate düşürür · KEP üzerinden hızlı evrak teyidi.',    price: 390, unit: '/tek seferlik' },
    ],
    categoryOptions: SUPPLIER_CATEGORY_OPTIONS,
    initialData: {
      legalName: '', brandName: '', logoUploaded: false,
      taxId: '', taxOffice: '', tradeRegistry: '',
      address: '', city: '', district: '', postalCode: '', phone: '',
      ibans: [],
      categories: [], capacity: '', region: '',
      references: [],
      documents: { trade: false, tax: false, iso9001: false, capability: false },
      planCode: 'free', addons: [],
      paymentMethod: 'card',
      cardNumber: '', cardHolder: '', cardMonth: '', cardYear: '', cvv: '',
      eftReceiptUploaded: false,
    },
    nextSteps: [
      'Belge incelemesi 1 iş gününde tamamlanır.',
      'Onay sonrası kategorinde RFQ davetleri gelmeye başlar.',
      'İlk teklifte performans skorun hesaplanmaya başlar.',
      'Profil sayfanda referanslarını "doğrula" ile puan + rozet kazan.',
    ],
  },

  channel: {
    code: 'channel',
    label: 'İş Ortağı',
    short: 'İş Ortağı',
    eyebrow: 'İş Ortağı Programı',
    title: 'Yönlendir, sat veya birlikte çözüm üret — ömür boyu komisyon kazan.',
    tagline: '~4 dakika · KYC + sözleşme · Plan yok',
    accent: '#9a4d0f',
    accentSoft: '#c2410c',
    accentTint: '#f59e0b',
    onAccent: '#fff7ed',
    rail: 'linear-gradient(135deg,#2f1a0d 0%, #4a2914 55%, #7a4520 100%)',
    page: 'radial-gradient(circle at top left, rgba(245,158,11,0.20), transparent 30%), linear-gradient(135deg, #fff7ed 0%, #ffedd5 48%, #fef3c7 100%)',
    pageTint: '#fff7ed',
    bullet: 'Yönlendirdiğin müşteri Buyer Asistans\'ı kullandığı sürece <b>ömür boyu komisyon</b>; senin cirona göre otomatik kademe açılır.',
    bulletLabel: 'Program nasıl çalışır?',
    steps: [
      { key: 'partner',      label: 'Ortak Profili',  hint: 'Bireysel / Kurumsal' },
      { key: 'partner_type', label: 'Ortaklık Tipi',  hint: 'Çalışma modeli' },
      { key: 'kyc',          label: 'KYC & Ödeme',    hint: 'Kimlik + IBAN' },
      { key: 'contract',     label: 'Sözleşme Onayı', hint: 'Hukuki çerçeve' },
      { key: 'confirm',      label: 'Tamamla',        hint: 'KYC için gönder' },
    ],
    commissionTiers: [
      { code: 'starter', name: 'Starter',  rate: 15, threshold: 'Başlangıç kademe',
        desc: 'İlk müşterinden itibaren brüt abonelik gelirinden %15 komisyon. Aylık ₺500 üzeri birikim IBAN\'a yatırılır.' },
      { code: 'growth',  name: 'Growth',   rate: 25, threshold: 'Yıllık ₺250.000+ ciro sonrası',
        desc: 'Yıllık 250K eşiği aştığında otomatik açılır. Co-marketing fırsatları + quarterly business review.' },
      { code: 'premier', name: 'Premier',  rate: 35, threshold: 'Yıllık ₺1.000.000+ ciro sonrası',
        desc: 'Premier seviyede co-branded ürün, joint roadmap etkisi, dedicated partner manager, haftalık ödeme.' },
    ],
    partnerTypes: [
      { code: 'referrer',
        name: 'Yönlendirici (Referrer)',
        desc: 'Müşteri adayını sisteme yönlendirirsin, satış sürecini Buyer Asistans yürütür. En kolay başlangıç.',
        margin: '%15 — %35 (kademeye göre)' },
      { code: 'reseller',
        name: 'Satış Ortağı (Reseller)',
        desc: 'Müşteriye sen satarsın, faturayı sen kesersin. Buyer Asistans sana toptan fiyat verir, marj sende.',
        margin: '%20 — %40 (toptan iskonto)' },
      { code: 'alliance',
        name: 'Stratejik İşbirliği (Alliance)',
        desc: 'Buyer Asistans + senin ürünün/hizmetin birlikte sunulur. Joint go-to-market, co-branded teklif.',
        margin: 'Vakaya özel (sözleşmeyle)' },
    ],
    initialData: {
      partnerType: 'company',
      legalName: '', brandName: '', taxId: '', taxOffice: '', tradeRegistry: '',
      address: '', city: '', district: '', postalCode: '', website: '',
      logoUploaded: false,
      contactName: '', contactSurname: '', tcId: '', contactRole: '', contactEmail: '', contactPhone: '',
      partnership: 'referrer', monthlyDeals: '',
      tcIdImageUploaded: false, invoiceImageUploaded: false,
      taxPlateUploaded: false, tradeRegistryUploaded: false,
      activityCertUploaded: false, signatureCircularUploaded: false, poaUploaded: false,
      iban: '', bankName: '',
      acceptTerms: false, acceptNDA: false, acceptTaxNote: false,
    },
    nextSteps: [
      'KYC ekibimiz 2 iş gününde başvurunu doğrular.',
      'Onay sonrası iş ortağı dashboard\'una eriş — lead\'leri ekle.',
      'İlk lead "yönlendirildi" durumuna geçince co-pilot kuralı ile sana atanır.',
      'Her ay 1\'inde önceki ayın hak edişin (vergiler düşülerek) IBAN\'ına yatırılır.',
    ],
  },

  employer: {
    code: 'employer',
    label: 'İşveren',
    short: 'İşveren',
    eyebrow: 'Personel Arayan — İşveren Kaydı',
    title: 'Doğru yeteneği daha hızlı bul.',
    tagline: '~4 dakika · Kayıt sonrası ilan aç',
    accent: '#4338ca',
    accentSoft: '#6366f1',
    accentTint: '#a5b4fc',
    onAccent: '#eef2ff',
    rail: 'linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)',
    page: 'radial-gradient(circle at top left, rgba(99,102,241,0.20), transparent 30%), linear-gradient(135deg, #eef2ff 0%, #e0e7ff 56%, #f5f3ff 100%)',
    pageTint: '#eef2ff',
    bullet: 'Buyer Asistans havuzundaki <b>2.400+ kayıtlı profesyonel</b> ile ilanını eşleştir. Ortalama dolum süresi <b>14 gün</b>.',
    bulletLabel: 'Neden Buyer Asistans Kariyer?',
    steps: [
      { key: 'company', label: 'Şirket Bilgisi',       hint: 'Yasal + adres + logo' },
      { key: 'about',   label: 'Hakkımızda & Sektör',  hint: 'Kim olduğunu anlat' },
      { key: 'plan',    label: 'Plan Seçimi',           hint: 'İlan kontenjanı' },
      { key: 'extras',  label: 'Ekstra Haklar',         hint: 'Featured / boost' },
      { key: 'payment', label: 'Ödeme',                 hint: 'Free ise atlanır' },
      { key: 'confirm', label: 'Tamamla',               hint: 'İlk ilana başla' },
    ],
    plans: [
      {
        code: 'free', name: 'Ücretsiz', tagline: '1 aktif ilan',
        priceMonthly: 0, currency: '₺', badge: 'Ücretsiz',
        features: [
          'Aynı anda 1 aktif ilan yayını',
          '30 günlük yayın süresi',
          'Temel başvuru görüntüleme',
          'Manuel başvuru takibi',
        ],
        limits: { ilan: 1, sure: '30 gün' },
      },
      {
        code: 'pro', name: 'Profesyonel', tagline: 'Aktif işe alım yapanlar',
        priceMonthly: 990, currency: '₺', badge: 'En Popüler',
        features: [
          'Aynı anda 10 aktif ilan',
          '60 günlük yayın süresi',
          'Başvuru Yönetim Sistemi (ATS)',
          'İlanlar "Öne çıkar" rozetiyle yayınlanır',
          'Aday filtreleme + notlama + ekip değerlendirmesi',
        ],
        limits: { ilan: 10, sure: '60 gün' },
      },
      {
        code: 'enterprise', name: 'Kurumsal', tagline: 'Holdingler ve ajanslar',
        priceMonthly: 3490, currency: '₺', badge: null,
        features: [
          'Sınırsız aktif ilan',
          '90 günlük yayın süresi',
          'Ekip çalışma alanı (çoklu İK kullanıcısı)',
          'ATS API + ekosistem entegrasyonu',
          'Aday havuzuna doğrudan erişim',
          'Dedicated account manager',
        ],
        limits: { ilan: '∞', sure: '90 gün' },
      },
    ],
    addons: [
      { code: 'featured', name: 'Featured ilan',        desc: 'İlanı üst sıralarda + altın çerçeveyle yayınlar; 3× görüntülenme.',  price: 290, unit: '/ilan' },
      { code: 'extend',   name: '90 gün uzatma',        desc: 'Mevcut ilanın yayın süresine 90 gün ekler.',                          price: 190, unit: '/ilan' },
      { code: 'pool',     name: 'Aday havuzu erişimi',  desc: 'Başvuru beklemeden doğrudan aday profillerine eriş, mesaj gönder.',   price: 590, unit: '/ay' },
      { code: 'social',   name: 'Sosyal medya boost',   desc: 'İlanı LinkedIn + Twitter + Instagram\'da hedefli reklam ile yay.',    price: 390, unit: '/ilan' },
    ],
    categoryOptions: EMPLOYER_CATEGORY_OPTIONS,
    initialData: {
      legalName: '', brandName: '', logoUploaded: false,
      taxId: '', taxOffice: '', tradeRegistry: '',
      address: '', city: '', district: '', postalCode: '', phone: '', website: '',
      contactName: '', contactSurname: '', contactRole: '', contactEmail: '', contactPhone: '',
      aboutText: '', sectorCategories: [], operationCities: [], teamSize: '',
      planCode: 'free', addons: [],
      paymentMethod: 'card',
      cardNumber: '', cardHolder: '', cardMonth: '', cardYear: '', cvv: '',
      eftReceiptUploaded: false,
    },
    nextSteps: [
      'İlk ilanını yayınla — adaylar başvurmaya başlar.',
      'Ekip arkadaşlarını davet et, ortak değerlendirme yapın.',
      'ATS\'de boru hattını kur: başvuru → mülakat → teklif.',
      'Profesyonel pakette Featured rozeti 3× görüntülenme sağlar.',
    ],
  },

  candidate: {
    code: 'candidate',
    label: 'Aday',
    short: 'Aday',
    eyebrow: 'İş Arayan — Aday Kaydı',
    title: 'Doğru fırsatlar seninle bulsun. 90 saniye sürer.',
    tagline: '~2 dakika · Detay profil panelinden zenginleştirilir',
    accent: '#15803d',
    accentSoft: '#16a34a',
    accentTint: '#86efac',
    onAccent: '#f0fdf4',
    rail: 'linear-gradient(135deg, #064e3b 0%, #15803d 55%, #16a34a 100%)',
    page: 'radial-gradient(circle at top left, rgba(34,197,94,0.20), transparent 30%), linear-gradient(135deg, #f0fdf4 0%, #dcfce7 56%, #ecfeff 100%)',
    pageTint: '#f0fdf4',
    bullet: 'Hızlı kayıttan sonra panelde profilini tamamladıkça eşleşme oranın artar. Doğrulanmış profillerin yanıt oranı <b>3× daha yüksek</b>.',
    bulletLabel: 'Önce kayıt, sonra profil',
    steps: [
      { key: 'basic',       label: 'Temel Bilgi',      hint: 'Tanışalım' },
      { key: 'preferences', label: 'Tercihler',        hint: 'Ne arıyorsun?' },
      { key: 'plan',        label: 'Görünürlük',       hint: 'Free / Boost / Premium' },
      { key: 'extras',      label: 'Ekstra Hizmetler', hint: 'CV review, vb' },
      { key: 'contract',    label: 'Sözleşme',         hint: 'KVKK + kullanım' },
      { key: 'payment',     label: 'Ödeme',            hint: 'Free + ekstra yoksa atlanır' },
      { key: 'confirm',     label: 'Tamamla',          hint: 'Profilin yayına alınır' },
    ],
    plans: [
      {
        code: 'free', name: 'Ücretsiz', tagline: 'Standart profil',
        priceMonthly: 0, currency: '₺', badge: 'Önerilen',
        features: [
          'Profil tüm işverenlere açık',
          'Sınırsız başvuru hakkı',
          'Bildirim: e-posta + push',
          'Standart arama sıralaması',
        ],
        limits: {},
      },
      {
        code: 'boost', name: 'Öne Çıkar (Boost)', tagline: 'Profilin görünür olsun',
        priceMonthly: 99, currency: '₺', badge: null,
        features: [
          'Ücretsizdekilerin tümü',
          'Arama sonuçlarında ilk 3\'te listelenme',
          '"Doğrulanmış aday" rozeti',
          'Profil görüntülenme analitikleri',
          'Haftalık eşleşme önerisi e-postası',
        ],
        limits: {},
      },
      {
        code: 'premium', name: 'Premium', tagline: 'Aktif iş arayanlar için',
        priceMonthly: 199, currency: '₺', badge: null,
        features: [
          'Boost dahil tümü',
          'İnsan editörden CV review (yılda 2 kez)',
          'Premium başvuru kuyruğu (24 saat işveren yanıt garantisi)',
          'Mülakat hazırlık kaynaklarına erişim',
          'İşverene doğrudan mesaj atma hakkı',
        ],
        limits: {},
      },
    ],
    addons: [
      { code: 'cvreview',  name: 'CV review (tek sefer)',        desc: 'Sektör uzmanı editör CV\'ni okur, yapılandırılmış geri bildirim verir.', price: 149, unit: '/tek seferlik' },
      { code: 'photoshot', name: 'Profesyonel profil çekimi',    desc: 'Anlaşmalı stüdyo + retouching. Boost paketle %30 indirim.',               price: 590, unit: '/tek seferlik' },
      { code: 'mock',      name: 'Mülakat simülasyonu (1 saat)', desc: 'Sektör uzmanıyla canlı pratik mülakat; kayıt + ses geri bildirim.',        price: 240, unit: '/sefer' },
    ],
    initialData: {
      fullName: '', email: '', phone: '', city: '', photoUploaded: false,
      title: '', years: '',
      sectorCategories: [],
      desiredSalary: '', workModes: [], operationCities: [], availability: '',
      planCode: 'free', addons: [],
      acceptTerms: false, acceptKVKK: false,
      paymentMethod: 'card',
      cardNumber: '', cardHolder: '', cardMonth: '', cardYear: '', cvv: '',
    },
    nextSteps: [
      'Profilin yayında. Şimdi paneline gir, "Profilini tamamla" akışıyla %0 → %100.',
      'Öğrenim · deneyim · sertifika · diploma · beceriler — panelde adım adım eklersin.',
      'Profili %80+ olan adaylar 5× daha fazla görüntüleniyor.',
      'Doğrulanmış belgelerin (diploma/sertifika no\'ları gizlenerek) işverenlere gösterilir.',
    ],
  },
};

export const AUDIENCE_LIST: AudienceCode[] = ['strategic', 'supplier', 'channel', 'employer', 'candidate'];
