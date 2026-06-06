import { useNavigate } from "react-router-dom";
import "./GizlilikPolitikasiPage.css";

const LAST_UPDATED = "4 Haziran 2026";
const COMPANY_NAME = "Buyer Asistans Teknoloji A.Ş.";
const CONTACT_EMAIL = "hukuk@buyerasistans.com.tr";
const SITE_URL = "https://buyerasistans.com.tr";

const TOC = [
  { id: "s1",  label: "Hizmetin Tanımı ve Kapsam" },
  { id: "s2",  label: "Hesap Oluşturma ve Güvenlik" },
  { id: "s3",  label: "Kullanım Kuralları ve Yasaklar" },
  { id: "s4",  label: "Abonelik ve Ücretlendirme" },
  { id: "s5",  label: "Fikri Mülkiyet Hakları" },
  { id: "s6",  label: "Sorumluluk Sınırlamaları" },
  { id: "s7",  label: "Hizmet Seviyesi (SLA)" },
  { id: "s8",  label: "Hesap Askıya Alma ve Kapatma" },
  { id: "s9",  label: "Gizlilik" },
  { id: "s10", label: "Uygulanacak Hukuk ve Uyuşmazlık" },
  { id: "s11", label: "Değişiklikler" },
  { id: "s12", label: "İletişim" },
];

export default function KullanimKosullariPage() {
  const navigate = useNavigate();
  return (
    <div className="gpp-root">
      <header className="gpp-header">
        <a href={SITE_URL} className="gpp-header__logo">
          <span className="gpp-header__logo-mark">BA</span>
          <span className="gpp-header__logo-name">Buyer Asistans</span>
        </a>
        <div className="gpp-header__eyebrow">Yasal Belgeler</div>
        <h1 className="gpp-header__title">Kullanım Koşulları</h1>
        <p className="gpp-header__meta">Son güncellenme: {LAST_UPDATED} · Türkçe</p>
      </header>

      <main className="gpp-body">
        <button className="gpp-back" onClick={() => navigate(-1)}>← Geri dön</button>

        <nav className="gpp-toc" aria-label="İçindekiler">
          <p className="gpp-toc__title">İçindekiler</p>
          <ol className="gpp-toc__list">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>
                  <span className="gpp-toc__num">{i + 1}</span>{item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="gpp-box">
          Platforma erişerek veya hesap oluşturarak bu Kullanım Koşullarını kabul etmiş sayılırsınız.
          Koşulları kabul etmiyorsanız platformu kullanmayınız.
        </div>

        <section id="s1" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">1</span><h2 className="gpp-section__title">Hizmetin Tanımı ve Kapsam</h2></div>
          <div className="gpp-section__body">
            <p><strong>{COMPANY_NAME}</strong> ("Şirket", "biz"), <strong>Buyer Asistans</strong> adıyla faaliyet gösteren B2B satın alma yönetimi, tedarik zinciri, kariyer ve iş ortağı platformunu işletmektedir. Platform şu hizmetleri kapsar:</p>
            <ul>
              <li>Stratejik partner satın alma ve tedarik yönetimi</li>
              <li>Tedarikçi portal ve teklif yönetimi</li>
              <li>İş ortağı (kanal) referans ve komisyon programı</li>
              <li>Satın alma kariyeri ilanları ve aday yönetimi</li>
              <li>Platform yöneticileri için operasyon ve analitik araçları</li>
            </ul>
            <p>Hizmet; <strong>buyerasistans.com.tr</strong>, buyerasistans.com, buyerasistans.info ve buyerasistans.online alan adları üzerinden sunulmaktadır.</p>
          </div>
        </section>

        <section id="s2" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">2</span><h2 className="gpp-section__title">Hesap Oluşturma ve Güvenlik</h2></div>
          <div className="gpp-section__body">
            <ul>
              <li>Hesap açmak için en az 18 yaşında olmanız veya yasal temsilcinizin onayı gerekmektedir.</li>
              <li>Kurumsal hesaplar için şirketi temsil etme yetkisine sahip olduğunuzu beyan edersiniz.</li>
              <li>Hesap bilgilerinizin (özellikle parolanızın) gizliliğinden ve hesabınızda gerçekleşen tüm işlemlerden yalnızca siz sorumlusunuz.</li>
              <li>Hesabınızda yetkisiz erişim tespit ederseniz derhal <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresini bilgilendirmeniz gerekmektedir.</li>
              <li>Tek bir gerçek kişi veya tüzel kişi adına yalnızca bir aktif hesap açılabilir; aksi durumda tüm hesaplar askıya alınabilir.</li>
            </ul>
          </div>
        </section>

        <section id="s3" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">3</span><h2 className="gpp-section__title">Kullanım Kuralları ve Yasaklar</h2></div>
          <div className="gpp-section__body">
            <p>Platform yalnızca meşru ticari amaçlarla kullanılabilir. Aşağıdaki eylemler kesinlikle yasaktır:</p>
            <ul>
              <li>Yanıltıcı, sahte veya üçüncü taraf kimliğine bürünerek hesap oluşturma</li>
              <li>Spam, phishing veya kötü amaçlı yazılım içeren içerik yayma</li>
              <li>Platform güvenliğini tehdit eden saldırı, penetrasyon veya scraping girişimleri</li>
              <li>Telif hakkı veya ticari marka ihlali oluşturan içerik yükleme</li>
              <li>Rakip ticari amaçlarla veri toplama veya platform verilerini izinsiz kopyalama</li>
              <li>Diğer kullanıcıları taciz etmek, tehdit etmek veya zarara uğratmak</li>
              <li>Yasal olmayan ürün veya hizmet teklifinde bulunma</li>
            </ul>
            <div className="gpp-box gpp-box--warn">
              Bu kurallara aykırı davranış hesabın derhal askıya alınmasına ve yasal işlem başlatılmasına neden olabilir.
            </div>
          </div>
        </section>

        <section id="s4" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">4</span><h2 className="gpp-section__title">Abonelik ve Ücretlendirme</h2></div>
          <div className="gpp-section__body">
            <p>Ücretli plan koşulları:</p>
            <ul>
              <li><strong>Faturalama:</strong> Abonelikler aylık veya yıllık olarak peşin faturalandırılır. Fatura, dönem başında kayıtlı ödeme yöntemine otomatik tahsil edilir.</li>
              <li><strong>Fiyat değişikliği:</strong> Fiyat değişikliklerinde kullanıcılar en az 30 gün önceden bildirim alır. Bildirim sonrası yenileme gerçekleşirse yeni fiyat geçerli olur.</li>
              <li><strong>Yükseltme / düşürme:</strong> Plan değişikliği anlık etki eder; kalan süre orantılı olarak hesaplanır (proration).</li>
              <li><strong>Vergi:</strong> Belirtilen fiyatlara KDV dahildir. Yurt dışı işlemlerde yerel vergi mevzuatı geçerlidir.</li>
            </ul>
            <div className="gpp-box">
              İade koşulları için ayrıca yayınlanan <a href="/iade-ve-odeme-politikasi" style={{ color: "inherit", fontWeight: 700 }}>İade ve Ödeme Politikası</a> belgesini inceleyiniz.
            </div>
          </div>
        </section>

        <section id="s5" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">5</span><h2 className="gpp-section__title">Fikri Mülkiyet Hakları</h2></div>
          <div className="gpp-section__body">
            <p>Platform yazılımı, tasarımı, logosu, içerikleri ve tüm bileşenleri {COMPANY_NAME}'ye aittir ve Türk Fikir ve Sanat Eserleri Kanunu ile uluslararası telif hukuku kapsamında korunmaktadır.</p>
            <p><strong>Kullanıcı içeriği:</strong> Platforma yüklediğiniz belgeler, teklifler ve veriler size aittir. Platforma bu içeriklerin işlenmesi ve depolanması için sınırlı bir lisans vermiş olursunuz. Bu lisans hesabınız kapandığında sona erer.</p>
            <p>Platform içeriğini izinsiz kopyalamak, dağıtmak, değiştirmek veya türev eser oluşturmak yasaktır.</p>
          </div>
        </section>

        <section id="s6" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">6</span><h2 className="gpp-section__title">Sorumluluk Sınırlamaları</h2></div>
          <div className="gpp-section__body">
            <ul>
              <li>Platform "olduğu gibi" (as-is) sunulur; kesintisiz veya hatasız çalışacağı garanti edilmez.</li>
              <li>Şirket, dolaylı, arızi veya sonuçsal zararlardan (veri kaybı, kâr kaybı, iş kesintisi dahil) sorumlu tutulamaz.</li>
              <li>Toplam sorumluluğumuz, zararın oluştuğu dönemde ödediğiniz abonelik bedeliyle sınırlıdır.</li>
              <li>Üçüncü taraf entegrasyonları (ödeme, OAuth sağlayıcıları vb.) kendi kullanım koşulları kapsamındadır.</li>
            </ul>
          </div>
        </section>

        <section id="s7" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">7</span><h2 className="gpp-section__title">Hizmet Seviyesi (SLA)</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Metrik</th><th>Hedef</th><th>Ölçüm Periyodu</th></tr></thead>
                <tbody>
                  <tr><td>Platform erişilebilirliği</td><td>%99,5</td><td>Aylık</td></tr>
                  <tr><td>Planlı bakım bildirimi</td><td>En az 48 saat önceden</td><td>Her bakım öncesi</td></tr>
                  <tr><td>Kritik hata yanıt süresi</td><td>4 iş saati</td><td>Bilet başına</td></tr>
                  <tr><td>Veri yedekleme sıklığı</td><td>Günlük</td><td>Sürekli</td></tr>
                </tbody>
              </table>
            </div>
            <p>SLA ihlali durumunda hak kazanılan hizmet kredileri için destek ekibiyle iletişime geçiniz.</p>
          </div>
        </section>

        <section id="s8" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">8</span><h2 className="gpp-section__title">Hesap Askıya Alma ve Kapatma</h2></div>
          <div className="gpp-section__body">
            <p><strong>Kullanıcı tarafından kapatma:</strong> Hesabınızı istediğiniz zaman panel ayarlarından veya yazılı talep yoluyla kapatabilirsiniz. Kapatma tarihine kadar olan dönem faturalandırılır; ileriki dönemler için ödeme alınmaz.</p>
            <p><strong>Şirket tarafından askıya alma:</strong> Kullanım koşullarının ihlali, ödeme gecikmesi (14 günü aşan) veya yasal zorunluluk halinde hesap önceden bildirim yapılmaksızın askıya alınabilir.</p>
            <p><strong>Veri erişimi:</strong> Hesap kapatıldıktan sonra verilerinize 30 gün içinde erişim ve dışa aktarma talebinde bulunabilirsiniz. 30 gün sonunda veriler silinir.</p>
          </div>
        </section>

        <section id="s9" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">9</span><h2 className="gpp-section__title">Gizlilik</h2></div>
          <div className="gpp-section__body">
            <p>Kişisel verilerinizin işlenmesi ayrıca yayınlanan <a href="/gizlilik-politikasi" style={{ color: "#1d4ed8", fontWeight: 700 }}>Gizlilik Politikası</a> belgesine tabidir. Bu belge, Kullanım Koşullarının ayrılmaz bir parçasıdır.</p>
          </div>
        </section>

        <section id="s10" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">10</span><h2 className="gpp-section__title">Uygulanacak Hukuk ve Uyuşmazlık</h2></div>
          <div className="gpp-section__body">
            <p>Bu sözleşme Türk Hukuku'na tabidir. Uyuşmazlıklarda önce tarafların anlaşması yoluyla çözüm aranır; çözüm sağlanamazsa <strong>İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri</strong> münhasıran yetkilidir.</p>
            <p>AB/AEA'daki tüketiciler, GDPR kapsamındaki uyuşmazlıklar için yerel veri koruma kurumlarına başvurabilir.</p>
          </div>
        </section>

        <section id="s11" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">11</span><h2 className="gpp-section__title">Değişiklikler</h2></div>
          <div className="gpp-section__body">
            <p>Koşullar değiştiğinde kayıtlı e-posta adresinize bildirim gönderilir ve güncel metin <a href={`${SITE_URL}/kullanim-kosullari`} style={{ color: "#1d4ed8" }}>buyerasistans.com.tr/kullanim-kosullari</a> adresinde yayınlanır. Değişiklik tarihinden sonra platformu kullanmaya devam etmek yeni koşulları kabul anlamına gelir.</p>
          </div>
        </section>

        <section id="s12" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">12</span><h2 className="gpp-section__title">İletişim</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-box gpp-box--green">
              <strong>{COMPANY_NAME}</strong> — Hukuk Birimi<br />
              E-posta: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "inherit", fontWeight: 700 }}>{CONTACT_EMAIL}</a><br />
              Web: <a href={SITE_URL} style={{ color: "inherit", fontWeight: 700 }}>{SITE_URL}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="gpp-footer">
        <div className="gpp-footer__links">
          <a href="/kullanim-kosullari">Kullanım Koşulları</a>
          <a href="/gizlilik-politikasi">Gizlilik Politikası</a>
          <a href="/cerez-politikasi">Çerez Politikası</a>
          <a href="/iade-ve-odeme-politikasi">İade ve Ödeme Politikası</a>
        </div>
        <p className="gpp-footer__copy">© {new Date().getFullYear()} {COMPANY_NAME} · Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
