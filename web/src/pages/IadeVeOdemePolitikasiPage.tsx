import { useNavigate } from "react-router-dom";
import "./GizlilikPolitikasiPage.css";

const LAST_UPDATED = "4 Haziran 2026";
const COMPANY_NAME = "Buyer Asistans Teknoloji A.Ş.";
const CONTACT_EMAIL = "finans@buyerasistans.com.tr";
const SITE_URL = "https://buyerasistans.com.tr";

const TOC = [
  { id: "s1",  label: "Ödeme Yöntemleri" },
  { id: "s2",  label: "Faturalama ve Fatura Dönemleri" },
  { id: "s3",  label: "Otomatik Yenileme" },
  { id: "s4",  label: "Fiyat Değişiklikleri" },
  { id: "s5",  label: "İptal Politikası" },
  { id: "s6",  label: "İade Koşulları" },
  { id: "s7",  label: "Ücret İtirazı ve Şikayet" },
  { id: "s8",  label: "Başarısız Ödemeler" },
  { id: "s9",  label: "Kurumsal Faturalama" },
  { id: "s10", label: "İletişim" },
];

export default function IadeVeOdemePolitikasiPage() {
  const navigate = useNavigate();
  return (
    <div className="gpp-root">
      <header className="gpp-header">
        <a href={SITE_URL} className="gpp-header__logo">
          <span className="gpp-header__logo-mark">BA</span>
          <span className="gpp-header__logo-name">Buyer Asistans</span>
        </a>
        <div className="gpp-header__eyebrow">Yasal Belgeler</div>
        <h1 className="gpp-header__title">İade ve Ödeme Politikası</h1>
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
          Bu politika, Buyer Asistans platformuna ilişkin ödeme, faturalama ve iade koşullarını düzenler.
          Abonelik satın alarak bu politikayı kabul etmiş sayılırsınız.
        </div>

        <section id="s1" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">1</span><h2 className="gpp-section__title">Ödeme Yöntemleri</h2></div>
          <div className="gpp-section__body">
            <p>Platform aşağıdaki ödeme yöntemlerini desteklemektedir:</p>
            <ul>
              <li><strong>Kredi / Banka Kartı:</strong> Visa, Mastercard, American Express (3D Secure ile korunan)</li>
              <li><strong>Banka Havalesi / EFT:</strong> Kurumsal abonelikler için, fatura gönderimi sonrası 5 iş günü ödeme süresi</li>
              <li><strong>Dijital Cüzdan:</strong> Desteklenen sağlayıcılar panel üzerinden görüntülenebilir</li>
            </ul>
            <div className="gpp-box">
              Kart bilgileriniz tarafımızda saklanmaz. Tüm ödeme işlemleri PCI-DSS sertifikalı ödeme altyapısı üzerinden gerçekleşir. Kart numaranız yalnızca ödeme sağlayıcısının güvenli ortamında tutulur.
            </div>
          </div>
        </section>

        <section id="s2" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">2</span><h2 className="gpp-section__title">Faturalama ve Fatura Dönemleri</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Abonelik Türü</th><th>Fatura Dönem Başı</th><th>Fatura Teslimi</th></tr></thead>
                <tbody>
                  <tr><td>Aylık abonelik</td><td>Aktivasyon tarihi + her ay aynı gün</td><td>Ödeme gününde e-posta ile</td></tr>
                  <tr><td>Yıllık abonelik</td><td>Aktivasyon tarihi + yıl dönümü</td><td>Ödeme gününde e-posta ile</td></tr>
                  <tr><td>Kurumsal / özel plan</td><td>Sözleşmede belirtilen tarih</td><td>Sözleşme koşullarına göre</td></tr>
                </tbody>
              </table>
            </div>
            <p>Faturalar, kayıtlı e-posta adresinize PDF olarak iletilir. Fatura kopyasına ayrıca platform hesabınızın <strong>Ayarlar → Fatura Geçmişi</strong> bölümünden ulaşabilirsiniz.</p>
            <p>Türkiye'deki kullanıcılara e-fatura / e-arşiv fatura düzenlenir. Şirket adına fatura almak istiyorsanız vergi kimlik bilgilerinizi profil ayarlarından güncelleyiniz.</p>
          </div>
        </section>

        <section id="s3" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">3</span><h2 className="gpp-section__title">Otomatik Yenileme</h2></div>
          <div className="gpp-section__body">
            <p>Abonelikler aksi talep edilmedikçe dönem sonunda <strong>otomatik olarak yenilenir</strong>.</p>
            <ul>
              <li>Yenileme öncesinde e-posta ile hatırlatma gönderilir (en az 3 gün öncesinde).</li>
              <li>Otomatik yenilemeyi iptal etmek için dönem sonu tarihinden en az <strong>24 saat önce</strong> panel üzerinden işlem yapmanız gerekmektedir.</li>
              <li>Yenileme başarısız olursa önce 3 gün, ardından 7 gün sonra tekrar denenir; her iki deneme de başarısız olursa hesap askıya alınır.</li>
            </ul>
          </div>
        </section>

        <section id="s4" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">4</span><h2 className="gpp-section__title">Fiyat Değişiklikleri</h2></div>
          <div className="gpp-section__body">
            <ul>
              <li>Abonelik fiyatı değişikliklerinde <strong>en az 30 gün önceden</strong> e-posta bildirimi yapılır.</li>
              <li>Bildirim süresinde herhangi bir eylemde bulunmazsanız yeni dönemde güncel fiyat uygulanır.</li>
              <li>Fiyat değişikliğini kabul etmiyorsanız bildirim tarihinden itibaren 30 gün içinde aboneliğinizi iptal edebilirsiniz.</li>
              <li>Yıllık plan sahipleri mevcut yıllık dönem boyunca eski fiyattan yararlanır.</li>
            </ul>
          </div>
        </section>

        <section id="s5" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">5</span><h2 className="gpp-section__title">İptal Politikası</h2></div>
          <div className="gpp-section__body">
            <p>Aboneliğinizi <strong>Ayarlar → Abonelik → Aboneliği İptal Et</strong> yolunu izleyerek veya <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresine yazılı talep göndererek iptal edebilirsiniz.</p>
            <div className="gpp-table-wrap">
              <table className="gpp-table">
                <thead><tr><th>Abonelik Türü</th><th>İptal Sonrası Erişim</th><th>Faturalama</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Aylık</td>
                    <td>Mevcut dönem sonuna kadar (tam ay)</td>
                    <td>Sonraki dönem tahsil edilmez</td>
                  </tr>
                  <tr>
                    <td>Yıllık</td>
                    <td>Mevcut yıllık dönem sonuna kadar</td>
                    <td>Sonraki yıl tahsil edilmez</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>İptal sonrası dönem kapandığında hesap donuk moda geçer; verileriniz 30 gün boyunca saklanır ve indirilebilir durumdadır.</p>
          </div>
        </section>

        <section id="s6" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">6</span><h2 className="gpp-section__title">İade Koşulları</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-box gpp-box--green">
              <strong>14 Günlük Koşulsuz İade Güvencesi:</strong> Aboneliğinizin ilk aktivasyonundan itibaren 14 gün içinde iptal talebinde bulunursanız öğe 7'de belirtilen kanallardan tam iade yapılır.
            </div>
            <p><strong>14 günlük süre dolduktan sonra iade aşağıdaki koşullarda değerlendirilir:</strong></p>
            <ul>
              <li><strong>Teknik arıza:</strong> Platform erişim kesintisinin aylık SLA'yı (%99,5) aşması durumunda etkilenen süreye oransal ücret iadesi veya kredi.</li>
              <li><strong>Yanlış ücretlendirme:</strong> Teknik hata nedeniyle fazladan alınan tutarlar tam olarak iade edilir.</li>
              <li><strong>Yıllık plan — orantılı iade:</strong> Yıllık aboneliğin 14. günden sonra 60. güne kadar iptal edilmesi durumunda kullanılmayan ay sayısı üzerinden proration uygulanır (özel inceleme ile).</li>
            </ul>
            <div className="gpp-box gpp-box--warn">
              Aşağıdaki durumlarda iade yapılmaz: Kullanım koşulları ihlali nedeniyle hesabın askıya alınması; ücretsiz deneme süresi sonunda otomatik yenileme gerçekleşmişse ve hizmet aktif kullanılmışsa; dijital içerik veya raporlara erişilmiş ise.
            </div>
            <p><strong>İade süreci:</strong> Onaylanan iadeler 5–10 iş günü içinde orijinal ödeme yöntemine aktarılır. Banka havalesi ile yapılan ödemelerde IBAN bilgisi talep edilir.</p>
          </div>
        </section>

        <section id="s7" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">7</span><h2 className="gpp-section__title">Ücret İtirazı ve Şikayet</h2></div>
          <div className="gpp-section__body">
            <p>Faturanızda hata olduğunu düşünüyorsanız:</p>
            <ul>
              <li><strong>1. Adım:</strong> Fatura tarihinden itibaren <strong>30 gün içinde</strong> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> adresine fatura numarasını içeren itiraz mailinizi gönderin.</li>
              <li><strong>2. Adım:</strong> Ekibimiz 3 iş günü içinde incelemeye başlar ve 10 iş günü içinde sonuçlandırır.</li>
              <li><strong>3. Adım:</strong> Hata teyit edilirse fatura iptali veya iade işlemi başlatılır.</li>
            </ul>
            <p>İtiraz süreci sonuçlanana kadar itiraz edilen tutara ilişkin hesap erişiminiz kısıtlanmaz.</p>
            <p>Çözümsüz kalan şikayetler için <strong>Tüketici Hakem Heyeti</strong> veya <strong>E-Ticaret Bilgi Sistemi (ETBİS)</strong> üzerinden başvuru hakkınız saklıdır.</p>
          </div>
        </section>

        <section id="s8" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">8</span><h2 className="gpp-section__title">Başarısız Ödemeler</h2></div>
          <div className="gpp-section__body">
            <ul>
              <li>Ödeme başarısız olduğunda e-posta ile bildirim gönderilir.</li>
              <li>İlk başarısız denemeden sonra 3 gün ve 7 gün sonra iki kez daha otomatik deneme yapılır.</li>
              <li>3 denemenin tamamı başarısız olursa hesap <strong>donuk moda</strong> geçer: veriler korunur, işlem yapılamaz.</li>
              <li>Donuk modda iken ödeme güncellenerek abonelik yeniden aktif edilebilir.</li>
              <li>30 gün içinde ödeme yapılmaması durumunda hesap iptal sürecine girer ve veri saklama politikası devreye alır.</li>
            </ul>
          </div>
        </section>

        <section id="s9" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">9</span><h2 className="gpp-section__title">Kurumsal Faturalama</h2></div>
          <div className="gpp-section__body">
            <p>Kurumsal (Enterprise) planlar için özel faturalama koşulları geçerlidir:</p>
            <ul>
              <li>Aylık veya çeyreklik fatura düzenlenebilir.</li>
              <li>30 veya 60 günlük vade seçeneği müzakere edilebilir.</li>
              <li>Çok şubeli veya çok kullanıcılı kurumsal lisanslar için merkezi faturalama desteği sunulur.</li>
              <li>Kurumsal plan teklifi için <a href="mailto:satis@buyerasistans.com.tr">satis@buyerasistans.com.tr</a> adresine ulaşabilirsiniz.</li>
            </ul>
          </div>
        </section>

        <section id="s10" className="gpp-section">
          <div className="gpp-section__head"><span className="gpp-section__num">10</span><h2 className="gpp-section__title">İletişim</h2></div>
          <div className="gpp-section__body">
            <div className="gpp-box gpp-box--green">
              <strong>{COMPANY_NAME}</strong> — Finans ve Faturalama Birimi<br />
              E-posta: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "inherit", fontWeight: 700 }}>{CONTACT_EMAIL}</a><br />
              Web: <a href={SITE_URL} style={{ color: "inherit", fontWeight: 700 }}>{SITE_URL}</a><br />
              Yanıt süresi: En fazla 2 iş günü
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
