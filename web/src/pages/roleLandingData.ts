import { SEGMENT_META } from "../admin/segment-colors";

export interface RoleLandingData {
  pageKey: string;
  title: string;
  lead: string;
  color: string;
  colorLight: string;
  colorBg: string;
  registerHref: string;
  registerLabel: string;
  loginHref: string;
  loginLabel: string;
  audience: "strategic" | "supplier" | "channel" | "employer" | "seeker";
  reasons: string[];
  howSteps: { title: string; desc: string }[];
  planNote: string;
  faq: { q: string; a: string }[];
  dualRoleNote?: string;
}

export const ROLE_LANDING_DATA: Record<string, RoleLandingData> = {
  "stratejik-ortak": {
    pageKey: "stratejik-ortak",
    title: "Stratejik Ortak Olmanın Farkı",
    lead: "Kurumsal satın alma sürecinizi standartlaştırın; onay, tedarikçi ve bütçe yönetimini tek platformda yönetin.",
    color: SEGMENT_META.strategic.color,
    colorLight: "#a7f3d0",
    colorBg: "#ecfdf5",
    registerHref: "/onboarding",
    registerLabel: "Stratejik Ortak Başvurusu",
    loginHref: "/strategic-partner-login",
    loginLabel: "Giriş Yap",
    audience: "strategic",
    reasons: [
      "Rol bazlı onay zinciri — kurumsal yönetişime hazır, denetlenebilir iş akışı",
      "Tedarikçi havuzuna erişim — onaylı, performans skorlu tedarikçi listesi",
      "RFQ yönetimi — dakikalar içinde ihale oluştur, teklifleri karşılaştır",
      "KPI panosu — satın alma performansını yönetim kuruluna hazır raporlarla sun",
      "Çift rol yeteneği — aynı hesapta tedarikçi modülü aktifleştirilebilir (izole faturalama)",
    ],
    howSteps: [
      { title: "Başvuru & Onboarding", desc: "Şirket bilgilerini doldur; 48 saat içinde hesabın aktifleşir ve 90 günlük başlangıç planın hazırlanır." },
      { title: "Rol & Süreç Kurulumu", desc: "Onay hiyerarşini tanımla, tedarikçi kategorilerini seç ve satın alma politikasını platforma aktar." },
      { title: "Canlıya Al", desc: "İlk ihalenizi başlatın; tedarikçi teklifleri akar, onay zinciri çalışır, raporlar otomatik oluşur." },
    ],
    planNote: "Kullanım bazlı faturalama: yalnızca işlediğiniz ihale ve onay adımları için ücret ödersiniz. Yanlış veya çift tahsilat olmaz.",
    faq: [
      { q: "Mevcut ERP sistemimizle entegrasyon var mı?", a: "Evet. API entegrasyon rehberi ve sandbox ortamı ücretsiz sunulmaktadır." },
      { q: "Kaç kullanıcı ekleyebiliriz?", a: "Plan kapsamına göre 5'ten başlar; enterprise planında sınırsız kullanıcı tanımlanabilir." },
      { q: "Hem alıcı hem tedarikçi olabilir miyiz?", a: "Evet — çift rol etkinleştirildiğinde aynı hesap, stratejik ortak ve tedarikçi modüllerini izole kullanabilir." },
    ],
    dualRoleNote: "Çift Rol: Aynı kuruluş hem stratejik ortak (alıcı) hem tedarikçi olarak çalışabilir. Roller ve faturalamalar tamamen izole tutulur.",
  },

  "tedarikci": {
    pageKey: "tedarikci",
    title: "Tedarikçi Olarak Büyü",
    lead: "Onaylı alıcılara ulaş, teklif süreçlerini hızlandır, performansını veriyle yönet.",
    color: SEGMENT_META.supplier.color,
    colorLight: "#a5f3fc",
    colorBg: "#ecfeff",
    registerHref: "/supplier/register",
    registerLabel: "Tedarikçi Kaydı",
    loginHref: "/supplier/login",
    loginLabel: "Tedarikçi Girişi",
    audience: "supplier",
    reasons: [
      "Onaylı kurumsal alıcılara doğrudan erişim — soğuk arama, komisyonsuz aracı yok",
      "Performans skoru — rekabette öne çık; iyi hizmet daha fazla davet demek",
      "Teklif otomasyonu — şablon tabanlı RFQ yanıtları ile zamanı %60 kıs",
      "Kategori bazlı görünürlük — doğru alıcıya, doğru zamanda göster",
      "Çift rol: aynı hesapta stratejik ortak modülü açılabilir (izole faturalama)",
    ],
    howSteps: [
      { title: "Kayıt & Profil", desc: "Ürün/hizmet kategorilerini, sertifikasyonları ve portföyü doldur; profil onayı 24 saat içinde." },
      { title: "İhale Daveti Al", desc: "Kategori eşleşmesine göre otomatik bildirim; tek tık ile teklif gönderim sayfasına eriş." },
      { title: "Sözleşme & Ödeme", desc: "Onaylı teklif sözleşmeye dönüşür; hakediş takibi ve performans skoru otomatik güncellenir." },
    ],
    planNote: "Ücretlendirme: yalnızca kabul edilen teklif başına. Kayıt, teklif gönderme ve profil ücretsizdir.",
    faq: [
      { q: "Kayıt ücreti var mı?", a: "Hayır. Kayıt ve teklif gönderme tamamen ücretsizdir; başarılı satış gerçekleştiğinde komisyon uygulanır." },
      { q: "Birden fazla kategoride teklif verebilir miyiz?", a: "Evet, limitin izin verdiği kadar kategori seçilebilir ve her biri için ayrı profil bilgisi eklenir." },
      { q: "Hem tedarikçi hem stratejik ortak olabilir miyiz?", a: "Evet — çift rol etkinleştirildiğinde aynı hesap her iki modülü izole kullanabilir." },
    ],
    dualRoleNote: "Çift Rol: Aynı kuruluş hem tedarikçi hem stratejik ortak (alıcı) rolünde çalışabilir. Roller ve faturalamalar tamamen izole tutulur.",
  },

  "cift-rol": {
    pageKey: "cift-rol",
    title: "Çift Rol: Hem Alıcı Hem Satıcı",
    lead: "Aynı hesapta hem kurumsal satın alma yapın hem tedarikçi olarak teklif verin — roller ve faturalar tamamen izole.",
    color: SEGMENT_META.platform.color,
    colorLight: "#bfdbfe",
    colorBg: "#eff6ff",
    registerHref: "/onboarding",
    registerLabel: "Çift Rol Başvurusu",
    loginHref: "/login",
    loginLabel: "Giriş Yap",
    audience: "strategic",
    reasons: [
      "Tek hesap, iki modül — stratejik ortak (alıcı) + tedarikçi (satıcı) aynı anda aktif",
      "Rol izolasyonu — bir modüldeki işlem diğerini etkilemez; veri, onay ve raporlar ayrı",
      "Faturalama ayrımı — kullanılan modüle göre ayrı fatura kalemi, tek faturalandırma döngüsü",
      "Rekabetçi çıkar çatışması koruması — sistem aynı ihaleye çift taraflı katılımı engeller",
      "Büyük entegratörler ve danışmanlık firmaları için ideal yapı",
    ],
    howSteps: [
      { title: "Ana Rol Seç", desc: "Onboarding sırasında birincil rolünü belirle (stratejik ortak veya tedarikçi)." },
      { title: "İkinci Rolü Aktifleştir", desc: "Panel ayarlarından ikinci modülü talep et; platform ekibi 24 saat içinde onaylar ve izole workspace açılır." },
      { title: "İzole Çalış", desc: "Her modülün kendi dashboard'u, raporları ve faturalandırması vardır; birinden diğerine geçiş bir tık uzağında." },
    ],
    planNote: "Her modül bağımsız olarak kullanım bazlı faturalandırılır. Aktif olmayan modül için ücret alınmaz.",
    faq: [
      { q: "Hangi firmalar çift rol kullanıyor?", a: "Aynı zamanda hem satın alma yapıp hem hizmet/ürün satan holding şirketleri, danışmanlık firmaları ve entegratörler." },
      { q: "Çıkar çatışması nasıl önleniyor?", a: "Sistem, aynı ihaleye hem alıcı hem satıcı olarak katılmayı otomatik engeller; bu kural devre dışı bırakılamaz." },
      { q: "İki modülü aynı ekran üzerinden görebilir miyiz?", a: "Hayır. Roller tamamen izole dashboard'larda çalışır; karışıklığı önlemek için ayrı arayüz zorunludur." },
    ],
  },

  "is-ortagi": {
    pageKey: "is-ortagi",
    title: "İş Ortağı Programı",
    lead: "Getirdiğin partneri ve tedarikçiyi kaydet; her başarılı aktivasyonda attribution tabanlı hakediş kazan.",
    color: SEGMENT_META.channel.color,
    colorLight: "#fed7aa",
    colorBg: "#fff7ed",
    registerHref: "/is-ortagi-basvuru",
    registerLabel: "İş Ortağı Başvurusu",
    loginHref: "/channel/login",
    loginLabel: "İş Ortağı Girişi",
    audience: "channel",
    reasons: [
      "Attribution hakediş — getirdiğin her aktif müşterinin aylık kullanımından pay al",
      "Şeffaf komisyon takibi — hakediş tablosu ve ödeme takvimi panel üzerinden görünür",
      "Ekip paneli — getirdiğin müşterileri, süreç durumlarını ve geliri izle",
      "Çoklu müşteri yönetimi — onlarca firmayı tek panel üzerinden takip et",
      "Eğitim ve sertifikasyon materyalleri ücretsiz sunulur",
    ],
    howSteps: [
      { title: "Başvur & Sözleşme", desc: "İş ortağı formunu doldur; sözleşme ve komisyon oranlarını onayladıktan sonra paneliniz aktifleşir." },
      { title: "Müşteri Getir", desc: "Potansiyel stratejik partner ve tedarikçileri referral linkin veya panel üzerinden platforma yönlendir." },
      { title: "Hakediş Al", desc: "Müşteri platforma aktif olduğunda hakediş sayacı başlar; her ay dilersen banka hesabına ödeme al." },
    ],
    planNote: "Ücret yoktur — yalnızca başarılı aktivasyonlar üzerinden komisyon alırsın. Yanlış veya çift tahsilat olmaz.",
    faq: [
      { q: "Minimum hakediş tutarı var mı?", a: "Evet, aylık ödeme için minimum ₺500 sınırı uygulanır; altı tutarlar bir sonraki döneme taşınır." },
      { q: "Kaç müşteri getirebilirim?", a: "Sınır yoktur. Kendi ekibini kurabilir ve ekip hakediş havuzunu yönetebilirsin." },
      { q: "Kanal partnerim başka bir iş ortağı getirirse?", a: "Çok katmanlı hakediş programında kurallar sözleşmede belirlenir; sistem her seviye attributionu izler." },
    ],
  },

  "isveren": {
    pageKey: "isveren",
    title: "Satın Alma Uzmanı Bul",
    lead: "Onaylı satın alma uzmanı adaylarına ulaş, ilanını 5 dakikada yayınla, İK yöneticilerine özel roller tanımla.",
    color: SEGMENT_META.employer.color,
    colorLight: "#e9d5ff",
    colorBg: "#fdf4ff",
    registerHref: "/employer/register",
    registerLabel: "İşveren Kaydı",
    loginHref: "/isveren-giris",
    loginLabel: "İşveren Girişi",
    audience: "employer",
    reasons: [
      "Onaylı aday havuzu — profil doğrulanmış, deneyimli satın alma uzmanları",
      "Hızlı ilan oluşturma — şablon tabanlı iş ilanı 5 dakikada yayında",
      "İK Yöneticisi rolleri — HR ekibin için özel yetki tanımla, özgeçmiş erişimini kontrol et",
      "Başvuru takibi — tüm adayları tek panelde karşılaştır, not ekle, süreç yönet",
      "Marka görünürlüğü — platform içi firma profili ve kariyer sayfası",
    ],
    howSteps: [
      { title: "Kayıt & Firma Profili", desc: "Firma bilgilerini doldur; firma kariyer profiliniz 24 saat içinde yayınlanır." },
      { title: "İlan Oluştur", desc: "Pozisyon şablonlarından seç veya sıfırdan oluştur; yayın onayı genellikle 2 saat içinde." },
      { title: "Aday Yönet", desc: "Başvurular panele akar; filtrele, not al, mülakata davet et ve süreç kaydını tut." },
    ],
    planNote: "İlk 3 ilan ücretsizdir. Sonraki ilanlar kullanım bazlı; abonelik planlarında sınırsız ilan hakkı mevcuttur.",
    faq: [
      { q: "Özgeçmişlere kimler erişebilir?", a: "Yalnızca ilan veren işveren ve yetkilendirdiği İK Yöneticisi rolündeki kullanıcılar erişebilir." },
      { q: "Adayı doğrudan iletişime geçebilir miyiz?", a: "Evet, aday mesajlaşmayı onayladıktan sonra platform üzerinden güvenli mesaj gönderilebilir." },
      { q: "KVKK uyumu nasıl sağlanıyor?", a: "Tüm aday verileri KVKK kapsamında saklanır; 6 ay işlemsizlikte otomatik anonimleştirme uygulanır." },
    ],
  },

  "is-arayan": {
    pageKey: "is-arayan",
    title: "Satın Alma Kariyerini Hızlandır",
    lead: "Profil oluştur, onaylı işverenlerden iş ilanlarını takip et, başvurularını gerçek zamanlı izle.",
    color: SEGMENT_META.seeker.color,
    colorLight: "#fecdd3",
    colorBg: "#fff1f3",
    registerHref: "/candidate/register",
    registerLabel: "Kariyer Kaydı",
    loginHref: "/is-arayan-giris",
    loginLabel: "Giriş Yap",
    audience: "seeker",
    reasons: [
      "Onaylı işverenler — hileli ilan yok; her şirket profili doğrulanmış",
      "Kişiselleştirilmiş ilanlar — deneyim, lokasyon ve tercihlerine göre filtrelenmiş fırsatlar",
      "CV profili — tek profilden onlarca işverene başvur, her seferinde yeniden doldurma yok",
      "Başvuru takibi — hangi aşamada olduğunu, geri bildirim aldığında anında bildirim al",
      "Kariyer kaynakları — satın alma sektörüne özel rehber ve sertifika bilgileri",
    ],
    howSteps: [
      { title: "Profil Oluştur", desc: "Özgeçmişini yükle veya platform profili doldur; onay 24 saat içinde." },
      { title: "İlanları Keşfet", desc: "Filtrelenmiş ilanlar sana otomatik gelir; beğendiklerine tek tık ile başvur." },
      { title: "Süreci Takip Et", desc: "Başvuru durumunu panelden izle; mülakat davetleri ve geri bildirimler otomatik bildirimle gelir." },
    ],
    planNote: "Tamamen ücretsiz. Profil oluşturma, başvurma ve iletişim özellikleri ücrete tabi değildir.",
    faq: [
      { q: "Profilim işverenlere görünür mü?", a: "Varsayılan olarak görünmez; sen 'keşfedilebilir' modunu açmadıkça yalnızca başvurduğun firmalar görebilir." },
      { q: "Kaç firmaya aynı anda başvurabilirim?", a: "Sınırsız. Aktif başvurularını panelden takip edebilirsin." },
      { q: "Platform ücretli mi?", a: "Hayır, iş arayanlar için tüm özellikler tamamen ücretsizdir." },
    ],
  },
};
