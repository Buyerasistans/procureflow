import { useNavigate } from "react-router-dom";
import "./GizlilikPolitikasiPage.css";

const LAST_UPDATED = "4 Haziran 2026";
const COMPANY_NAME = "Buyer Asistans Teknoloji A.Ş.";
const CONTACT_EMAIL = "kvkk@buyerasistans.com.tr";
const SITE_URL = "https://buyerasistans.com.tr";

const TOC = [
  { id: "s1", label: "Çerez Nedir?" },
  { id: "s2", label: "Kullandığımız Çerez Türleri" },
  { id: "s3", label: "Zorunlu Çerezler" },
  { id: "s4", label: "Analitik ve Performans Çerezleri" },
  { id: "s5", label: "Üçüncü Taraf Çerezleri" },
  { id: "s6", label: "Çerez Yönetimi ve Tercih Ayarları" },
  { id: "s7", label: "Yerel Depolama (LocalStorage)" },
  { id: "s8", label: "İletişim" },
];

export default function CerezPolitikasiPage() {
  const navigate = useNavigate();
  return (
    <div className="gpp-root">
      <header className="gpp-header">
        <a href={SITE_URL} className="gpp-header__logo">
          <span className="gpp-header__logo-mark">BA</span>
          <span className="gpp-header__logo-name">Buyer Asistans</span>
        </a>
        <div className="gpp-header__eyebrow">Yasal Belgeler</div>
        <h1 className="gpp-header__title">Çerez Politikası</h1>
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
          Bu politika, Buyer Asistans platformunun çerez (cookie) ve benzer izleme teknolojilerini
          nasıl kullandığını açıklar. KVKK ve 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında
          Kanun uyarınca hazırlanmıştır.
        </div>

        <section id="s1" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">1</span><h2 className="gpp-section__title">Çerez Nedir?</h2></div>
          <div className="gpp-section__body">
            <p>Çerezler, tarayıcınız aracılığıyla cihazınıza yerleştirilen küçük metin dosyalarıdır. Web siteleri çerezleri; oturum yönetimi, kullanıcı tercihlerini hatırlama ve platform kullanımını analiz etme gibi amaçlarla kullanır.</p>
            <p>Çerezler, içerik veya kişisel verilerinize erişim sağlamaz; yalnızca cihazınızı ve oturumunuzu tanımlamaya yarar.</p>
          </div>
        </section>

        <section id="s2" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">2</span><h2 className="gpp-section__title">Kullandığımız Çerez Türleri</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Tür</th><th>Amaç</th><th>Rıza Gerekli mi?</th></tr></thead>
                <tbody>
                  <tr><td><strong>Zorunlu</strong></td><td>Oturum, kimlik doğrulama, güvenlik</td><td>Hayır (hizmet için vazgeçilmez)</td></tr>
                  <tr><td><strong>Tercih</strong></td><td>Dil, tema, panel ayarları</td><td>Hayır (işlevsellik için gerekli)</td></tr>
                  <tr><td><strong>Analitik</strong></td><td>Anonim kullanım istatistikleri</td><td>Evet</td></tr>
                  <tr><td><strong>Pazarlama</strong></td><td>Hedefli içerik (şu an kullanılmıyor)</td><td>Evet</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="s3" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">3</span><h2 className="gpp-section__title">Zorunlu Çerezler</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Çerez Adı</th><th>Amaç</th><th>Süre</th></tr></thead>
                <tbody>
                  <tr><td><code>ba_access_token</code></td><td>Kullanıcı oturum JWT tokeni</td><td>60 dakika</td></tr>
                  <tr><td><code>ba_refresh_token</code></td><td>Oturum yenileme tokeni (HttpOnly)</td><td>30 gün</td></tr>
                  <tr><td><code>ba_locale</code></td><td>Seçilen dil ayarı</td><td>1 yıl</td></tr>
                  <tr><td><code>ba_session_id</code></td><td>Oturum kimlik tanımlayıcısı</td><td>Oturum süresi</td></tr>
                </tbody>
              </table>
            </div>
            <p>Bu çerezler platformun temel işlevleri için zorunludur ve reddedilemez. Tarayıcıdan engellenmeleri durumunda giriş yapılamaz.</p>
          </div>
        </section>

        <section id="s4" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">4</span><h2 className="gpp-section__title">Analitik ve Performans Çerezleri</h2></div>
          <div className="gpp-section__body">
            <p>Rızanıza bağlı olarak anonim kullanım istatistikleri toplanabilir. Bu veriler:</p>
            <ul>
              <li>Hangi sayfaların en çok ziyaret edildiği</li>
              <li>Platform üzerinde harcanan ortalama süre</li>
              <li>Hata oranları ve performans metrikleri</li>
            </ul>
            <p>Bu veriler hiçbir şekilde bireysel kimlik bilgisiyle ilişkilendirilmez ve üçüncü taraflarla paylaşılmaz.</p>
            <p>Rızanızı dilediğiniz zaman <strong>Hesap Ayarları → Gizlilik</strong> bölümünden geri çekebilirsiniz.</p>
          </div>
        </section>

        <section id="s5" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">5</span><h2 className="gpp-section__title">Üçüncü Taraf Çerezleri</h2></div>
          <div className="gpp-section__body">
            <p>Google veya LinkedIn ile sosyal giriş kullandığınızda bu sağlayıcılar kendi çerezlerini yerleştirebilir:</p>
            <ul>
              <li><strong>Google:</strong> OAuth akışı sırasında oturum çerezleri. <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer">Google Çerez Politikası</a></li>
              <li><strong>LinkedIn:</strong> OAuth akışı sırasında oturum çerezleri. <a href="https://www.linkedin.com/legal/cookie-policy" target="_blank" rel="noopener noreferrer">LinkedIn Çerez Politikası</a></li>
            </ul>
            <p>Bu çerezler ilgili sağlayıcıların politikaları kapsamında yönetilir; tarafımızca kontrol edilemez.</p>
          </div>
        </section>

        <section id="s6" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">6</span><h2 className="gpp-section__title">Çerez Yönetimi ve Tercih Ayarları</h2></div>
          <div className="gpp-section__body">
            <p>Çerez tercihlerinizi aşağıdaki yollarla yönetebilirsiniz:</p>
            <ul>
              <li><strong>Platform içinden:</strong> Hesap Ayarları → Gizlilik → Çerez Tercihleri</li>
              <li><strong>Tarayıcı ayarları:</strong></li>
            </ul>
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Tarayıcı</th><th>Çerez Ayarları</th></tr></thead>
                <tbody>
                  <tr><td>Chrome</td><td>Ayarlar → Gizlilik ve Güvenlik → Çerezler</td></tr>
                  <tr><td>Firefox</td><td>Seçenekler → Gizlilik ve Güvenlik → Çerezler</td></tr>
                  <tr><td>Safari</td><td>Tercihler → Gizlilik → Çerezleri Yönet</td></tr>
                  <tr><td>Edge</td><td>Ayarlar → Gizlilik, Arama ve Hizmetler → Çerezler</td></tr>
                </tbody>
              </table>
            </div>
            <div className="gpp-box gpp-box--warn">
              Zorunlu çerezleri tarayıcıdan engellerseniz platforma giriş yapamaz veya bazı işlevler çalışmayabilir.
            </div>
          </div>
        </section>

        <section id="s7" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">7</span><h2 className="gpp-section__title">Yerel Depolama (LocalStorage / SessionStorage)</h2></div>
          <div className="gpp-section__body">
            <p>Çerezlere ek olarak tarayıcının yerel depolama alanı şu amaçlarla kullanılır:</p>
            <ul>
              <li>Panel düzeni ve kullanıcı arayüzü tercihleri</li>
              <li>Erişim tokeni (oturum süresi boyunca)</li>
              <li>Çevrimdışı kullanım için önbelleğe alınan veriler</li>
            </ul>
            <p>Bu veriler yalnızca cihazınızda tutulur, sunuculara otomatik iletilmez ve hesap çıkışı yapıldığında temizlenir.</p>
          </div>
        </section>

        <section id="s8" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">8</span><h2 className="gpp-section__title">İletişim</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-box gpp-box--green">
              <strong>{COMPANY_NAME}</strong> — KVKK & Gizlilik Birimi<br />
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
