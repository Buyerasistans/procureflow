import { useNavigate } from "react-router-dom";
import "./GizlilikPolitikasiPage.css";

const LAST_UPDATED = "4 Haziran 2026";
const COMPANY_NAME = "Buyer Asistans Teknoloji A.Ş.";
const CONTACT_EMAIL = "kvkk@buyerasistans.com.tr";
const SITE_URL = "https://buyerasistans.com.tr";

const TOC = [
  { id: "s1",  label: "Veri Sorumlusu" },
  { id: "s2",  label: "Topladığımız Kişisel Veriler" },
  { id: "s3",  label: "Sosyal Giriş (Google / LinkedIn)" },
  { id: "s4",  label: "Verilerin Kullanım Amaçları" },
  { id: "s5",  label: "Verilerin Paylaşımı" },
  { id: "s6",  label: "Veri Saklama Süreleri" },
  { id: "s7",  label: "Çerezler ve İzleme Teknolojileri" },
  { id: "s8",  label: "Kullanıcı Hakları (KVKK / GDPR)" },
  { id: "s9",  label: "Veri Güvenliği" },
  { id: "s10", label: "Uluslararası Veri Transferi" },
  { id: "s11", label: "Değişiklikler" },
  { id: "s12", label: "İletişim" },
];

export default function GizlilikPolitikasiPage() {
  const navigate = useNavigate();

  return (
    <div className="gpp-root">
      {/* Header */}
      <header className="gpp-header">
        <a href={SITE_URL} className="gpp-header__logo">
          <span className="gpp-header__logo-mark">BA</span>
          <span className="gpp-header__logo-name">Buyer Asistans</span>
        </a>
        <div className="gpp-header__eyebrow">Yasal Belgeler</div>
        <h1 className="gpp-header__title">Gizlilik Politikası</h1>
        <p className="gpp-header__meta">Son güncellenme: {LAST_UPDATED} · Türkçe</p>
      </header>

      {/* Body */}
      <main className="gpp-body">
        <button className="gpp-back" onClick={() => navigate(-1)}>
          ← Geri dön
        </button>

        {/* İçindekiler */}
        <nav className="gpp-toc" aria-label="İçindekiler">
          <p className="gpp-toc__title">İçindekiler</p>
          <ol className="gpp-toc__list">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>
                  <span className="gpp-toc__num">{i + 1}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="gpp-box">
          Bu Gizlilik Politikası, Buyer Asistans platformunu ve tüm alt hizmetlerini kullanan kişilerin
          kişisel verilerinin nasıl toplandığını, işlendiğini ve korunduğunu açıklar. 6698 sayılı
          Kişisel Verilerin Korunması Kanunu (KVKK) ve Avrupa Birliği Genel Veri Koruma Tüzüğü
          (GDPR) kapsamında hazırlanmıştır.
        </div>

        {/* 1 */}
        <section id="s1" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">1</span>
            <h2 className="gpp-section__title">Veri Sorumlusu</h2>
          </div>
          <div className="gpp-section__body">
            <p>
              Kişisel verilerinizin işlenmesinden sorumlu veri sorumlusu aşağıdaki tüzel kişiliktir:
            </p>
            <div className="gpp-box gpp-box--green">
              <strong>{COMPANY_NAME}</strong><br />
              Platform: <strong>buyerasistans.com.tr</strong> · buyerasistans.com · buyerasistans.info · buyerasistans.online<br />
              KVKK İletişim: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "inherit", fontWeight: 700 }}>{CONTACT_EMAIL}</a>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section id="s2" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">2</span>
            <h2 className="gpp-section__title">Topladığımız Kişisel Veriler</h2>
          </div>
          <div className="gpp-section__body">
            <p>Platformumuzu kullanırken aşağıdaki veriler toplanabilir:</p>
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead>
                  <tr>
                    <th>Veri Kategorisi</th>
                    <th>Örnekler</th>
                    <th>Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Kimlik verileri</strong></td>
                    <td>Ad, soyad, profil fotoğrafı</td>
                    <td>Kayıt formu, sosyal giriş</td>
                  </tr>
                  <tr>
                    <td><strong>İletişim verileri</strong></td>
                    <td>E-posta, iş e-postası, telefon numarası</td>
                    <td>Kayıt formu, profil güncelleme</td>
                  </tr>
                  <tr>
                    <td><strong>Hesap verileri</strong></td>
                    <td>Şifreli parola özeti, oturum tokenleri, rol bilgisi</td>
                    <td>Sistem tarafından oluşturulur</td>
                  </tr>
                  <tr>
                    <td><strong>Kullanım verileri</strong></td>
                    <td>Giriş zamanı, IP adresi, tarayıcı türü, gezilen sayfalar</td>
                    <td>Sunucu logları</td>
                  </tr>
                  <tr>
                    <td><strong>İş verileri</strong></td>
                    <td>Tedarikçi teklifleri, satın alma talepleri, iş ilanları</td>
                    <td>Platform içi işlemler</td>
                  </tr>
                  <tr>
                    <td><strong>Ödeme verileri</strong></td>
                    <td>Fatura adresi, ödeme onay referansı (kart no saklanmaz)</td>
                    <td>Ödeme sağlayıcısı</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section id="s3" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">3</span>
            <h2 className="gpp-section__title">Sosyal Giriş (Google / LinkedIn)</h2>
          </div>
          <div className="gpp-section__body">
            <p>
              Platformumuza <strong>Google</strong> veya <strong>LinkedIn</strong> hesabınızla giriş yapmayı
              tercih ettiğinizde OAuth 2.0 protokolü kullanılır. Bu süreçte:
            </p>
            <ul>
              <li>
                <strong>Google OAuth:</strong> Google'dan yalnızca ad-soyad, e-posta adresi ve profil
                fotoğrafı URL'si alınır. Google şifreniz hiçbir şekilde tarafımıza iletilmez.
              </li>
              <li>
                <strong>LinkedIn OAuth:</strong> LinkedIn'den yalnızca ad-soyad, e-posta adresi ve profil
                kimliği (sub) alınır. LinkedIn şifreniz hiçbir şekilde tarafımıza iletilmez.
              </li>
              <li>
                Sosyal giriş aracılığıyla edinilen veriler yalnızca hesap oluşturma ve kimlik doğrulama
                amacıyla kullanılır; üçüncü taraflarla paylaşılmaz.
              </li>
              <li>
                Bu erişimi dilediğiniz zaman Google Hesap Ayarları veya LinkedIn Uygulama İzinleri
                sayfasından iptal edebilirsiniz.
              </li>
            </ul>
            <div className="gpp-box">
              <strong>Talep ettiğimiz izinler:</strong><br />
              Google: <code>openid</code>, <code>email</code>, <code>profile</code> — yalnızca okuma.<br />
              LinkedIn: <code>openid</code>, <code>profile</code>, <code>email</code> — yalnızca okuma.
            </div>
          </div>
        </section>

        {/* 4 */}
        <section id="s4" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">4</span>
            <h2 className="gpp-section__title">Verilerin Kullanım Amaçları</h2>
          </div>
          <div className="gpp-section__body">
            <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
            <ul>
              <li>Hesap oluşturma, kimlik doğrulama ve oturum yönetimi</li>
              <li>Satın alma süreçleri, teklif yönetimi ve tedarik operasyonları</li>
              <li>Kariyer ilanları ve işe alım süreçlerinin yürütülmesi</li>
              <li>Müşteri desteği ve teknik sorunların giderilmesi</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi (vergi, e-fatura vb.)</li>
              <li>Platform güvenliği, dolandırıcılık önleme ve iç denetim</li>
              <li>Hizmet kalitesinin ölçülmesi ve ürün geliştirme (anonim analizler)</li>
              <li>Açık rızanız dahilinde ticari elektronik ileti gönderimi</li>
            </ul>
            <p>
              Verileriniz hiçbir zaman rızanız olmaksızın reklam amaçlı üçüncü taraf platformlara
              satılmaz veya devredilmez.
            </p>
          </div>
        </section>

        {/* 5 */}
        <section id="s5" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">5</span>
            <h2 className="gpp-section__title">Verilerin Paylaşımı</h2>
          </div>
          <div className="gpp-section__body">
            <p>Kişisel verileriniz aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:</p>
            <ul>
              <li>
                <strong>Hizmet sağlayıcılar:</strong> E-posta altyapısı, bulut barındırma, ödeme işleme
                gibi teknik hizmetleri sunan ve gizlilik sözleşmesi imzalamış iş ortakları.
              </li>
              <li>
                <strong>Yasal zorunluluk:</strong> Mahkeme kararı, idari emir veya yasal düzenleme
                gerektirdiği hallerde yetkili kamu kurumları.
              </li>
              <li>
                <strong>Şirket değişiklikleri:</strong> Birleşme, devir veya satın alma durumlarında,
                aynı gizlilik standartlarının sürdürülmesi koşuluyla.
              </li>
              <li>
                <strong>Açık rızanız:</strong> Onayladığınız belirli bir amaç için.
              </li>
            </ul>
            <div className="gpp-box gpp-box--warn">
              <strong>Önemli:</strong> Tedarikçi veya stratejik ortak rolüyle platformda paylaştığınız
              ticari bilgiler (teklif, katalog, fiyat), platform üzerinden yetkili alıcılarla paylaşılabilir.
              Bu veri akışı hizmetin doğal kapsamındadır.
            </div>
          </div>
        </section>

        {/* 6 */}
        <section id="s6" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">6</span>
            <h2 className="gpp-section__title">Veri Saklama Süreleri</h2>
          </div>
          <div className="gpp-section__body">
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead>
                  <tr>
                    <th>Veri Türü</th>
                    <th>Saklama Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Hesap ve profil verileri</td>
                    <td>Hesap aktif olduğu sürece + hesap kapatmadan itibaren 3 yıl</td>
                  </tr>
                  <tr>
                    <td>İş işlem kayıtları (teklifler, siparişler)</td>
                    <td>10 yıl (Vergi Usul Kanunu gereği)</td>
                  </tr>
                  <tr>
                    <td>Sunucu erişim logları</td>
                    <td>2 yıl</td>
                  </tr>
                  <tr>
                    <td>Oturum tokenleri (JWT)</td>
                    <td>60 dakika (access) / 30 gün (refresh)</td>
                  </tr>
                  <tr>
                    <td>Pazarlama e-posta tercihleri</td>
                    <td>İptal talebine kadar</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 7 */}
        <section id="s7" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">7</span>
            <h2 className="gpp-section__title">Çerezler ve İzleme Teknolojileri</h2>
          </div>
          <div className="gpp-section__body">
            <p>Platform, aşağıdaki amaçlarla çerezler kullanabilir:</p>
            <ul>
              <li><strong>Zorunlu çerezler:</strong> Oturum yönetimi ve güvenlik (devre dışı bırakılamaz).</li>
              <li><strong>Tercih çerezleri:</strong> Dil ve panel ayarlarının hatırlanması.</li>
              <li><strong>Analitik çerezler:</strong> Anonim kullanım istatistikleri (rızanıza bağlı).</li>
            </ul>
            <p>
              Tarayıcı ayarlarınızdan çerezleri yönetebilir veya reddedebilirsiniz. Zorunlu çerezlerin
              reddedilmesi durumunda platform işlevselliği kısıtlanabilir.
            </p>
          </div>
        </section>

        {/* 8 */}
        <section id="s8" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">8</span>
            <h2 className="gpp-section__title">Kullanıcı Hakları (KVKK / GDPR)</h2>
          </div>
          <div className="gpp-section__body">
            <p>
              KVKK madde 11 ve GDPR kapsamında kişisel verilerinizle ilgili aşağıdaki haklara sahipsiniz:
            </p>
            <ul>
              <li><strong>Bilgi edinme:</strong> Hangi verilerinizin işlendiğini öğrenme hakkı.</li>
              <li><strong>Erişim:</strong> İşlenen verilerinizin bir kopyasını talep etme hakkı.</li>
              <li><strong>Düzeltme:</strong> Yanlış veya eksik verilerin güncellenmesini isteme hakkı.</li>
              <li><strong>Silme:</strong> Belirli koşullar altında verilerinizin silinmesini talep etme hakkı ("unutulma hakkı").</li>
              <li><strong>İşlemeyi kısıtlama:</strong> Belirli koşullar altında veri işlemenin durdurulmasını isteme hakkı.</li>
              <li><strong>Taşınabilirlik:</strong> Verilerinizi yapılandırılmış, makine tarafından okunabilir formatta alma hakkı.</li>
              <li><strong>İtiraz:</strong> Meşru menfaat dayanaklı işlemelere itiraz etme hakkı.</li>
              <li><strong>Rıza geri çekme:</strong> Rızaya dayalı işlemler için rızanızı geri çekme hakkı.</li>
            </ul>
            <div className="gpp-box">
              Bu haklarınızı kullanmak için <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "inherit", fontWeight: 700 }}>{CONTACT_EMAIL}</a> adresine
              yazabilirsiniz. Talepler 30 gün içinde yanıtlanır.
            </div>
            <p>
              Yanıt tatmin edici değilse <strong>Kişisel Verileri Koruma Kurumu (KVKK)</strong>'na
              başvurma hakkınız saklıdır.
            </p>
          </div>
        </section>

        {/* 9 */}
        <section id="s9" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">9</span>
            <h2 className="gpp-section__title">Veri Güvenliği</h2>
          </div>
          <div className="gpp-section__body">
            <p>Verilerinizi korumak için uygulanan teknik ve idari tedbirler:</p>
            <ul>
              <li>Tüm veri iletişimi TLS 1.2+ şifrelemesiyle korunur (HTTPS).</li>
              <li>Parolalar bcrypt algoritmasıyla hash'lenerek saklanır; düz metin parola tutulmaz.</li>
              <li>JWT tabanlı oturum yönetimi; tokenler kısa ömürlüdür ve iptal listesi tutulur.</li>
              <li>Veritabanı sunucuları özel ağ segmentinde çalışır, doğrudan internet erişimi kapalıdır.</li>
              <li>Periyodik yedekleme ve şifreli depolama uygulanır.</li>
              <li>Yetki bazlı erişim kontrolü (RBAC) ile rol dışı veri erişimi engellenir.</li>
            </ul>
            <p>
              Güvenlik ihlali tespit edilmesi durumunda etkilenen kullanıcılar ve KVKK Kurumu yasal
              süreler içinde bilgilendirilir.
            </p>
          </div>
        </section>

        {/* 10 */}
        <section id="s10" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">10</span>
            <h2 className="gpp-section__title">Uluslararası Veri Transferi</h2>
          </div>
          <div className="gpp-section__body">
            <p>
              Verileriniz öncelikle Türkiye'de barındırılan sunucularda işlenir. Google ve LinkedIn
              gibi üçüncü taraf OAuth sağlayıcıları kendi gizlilik politikaları kapsamında verileri
              işleyebilir:
            </p>
            <ul>
              <li>
                Google Gizlilik Politikası:{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                  policies.google.com/privacy
                </a>
              </li>
              <li>
                LinkedIn Gizlilik Politikası:{" "}
                <a href="https://www.linkedin.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  linkedin.com/legal/privacy-policy
                </a>
              </li>
            </ul>
            <p>
              AB/AEA kullanıcıları için yurt dışı veri transferleri, GDPR Madde 46 kapsamındaki uygun
              güvencelerle gerçekleştirilir.
            </p>
          </div>
        </section>

        {/* 11 */}
        <section id="s11" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">11</span>
            <h2 className="gpp-section__title">Değişiklikler</h2>
          </div>
          <div className="gpp-section__body">
            <p>
              Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikler kayıtlı
              e-posta adresinize bildirim yoluyla duyurulur. Güncel sürüm her zaman{" "}
              <a href={`${SITE_URL}/gizlilik-politikasi`} target="_blank" rel="noopener noreferrer">
                buyerasistans.com.tr/gizlilik-politikasi
              </a>{" "}
              adresinde yayınlanır. Değişiklikler yayınlandıktan sonra platformu kullanmaya devam
              etmeniz güncel politikayı kabul ettiğiniz anlamına gelir.
            </p>
          </div>
        </section>

        {/* 12 */}
        <section id="s12" className="gpp-section">
          <div className="gpp-section__head">
            <span className="gpp-section__num">12</span>
            <h2 className="gpp-section__title">İletişim</h2>
          </div>
          <div className="gpp-section__body">
            <p>Gizlilik ile ilgili sorularınız için:</p>
            <div className="gpp-box gpp-box--green">
              <strong>{COMPANY_NAME}</strong><br />
              KVKK & Gizlilik Birimi<br />
              E-posta: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "inherit", fontWeight: 700 }}>{CONTACT_EMAIL}</a><br />
              Web: <a href={SITE_URL} style={{ color: "inherit", fontWeight: 700 }}>{SITE_URL}</a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="gpp-footer">
        <div className="gpp-footer__links">
          <a href="/kullanim-kosullari">Kullanım Koşulları</a>
          <a href="/gizlilik-politikasi">Gizlilik Politikası</a>
          <a href="/cerez-politikasi">Çerez Politikası</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>KVKK Başvurusu</a>
        </div>
        <p className="gpp-footer__copy">
          © {new Date().getFullYear()} {COMPANY_NAME} · Tüm hakları saklıdır.
        </p>
      </footer>
    </div>
  );
}
