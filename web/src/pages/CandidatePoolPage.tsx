import { useState } from "react";
import NavBar from "../components/NavBar";
import "./CandidatePoolPage.css";

const MOCK_CANDIDATES = [
  { id: 1, name: "A. Yıldız", title: "Kıdemli Satın Alma Uzmanı", exp: "8 yıl", city: "İstanbul", badges: ["SAP MM", "CPSM"], available: true },
  { id: 2, name: "M. Çelik", title: "Satın Alma Müdür Yardımcısı", exp: "12 yıl", city: "Ankara", badges: ["ERP", "Tedarik Zinciri"], available: true },
  { id: 3, name: "S. Kaya", title: "Satın Alma Yöneticisi", exp: "6 yıl", city: "İzmir", badges: ["RFQ", "Kategori Yönetimi"], available: false },
  { id: 4, name: "E. Demir", title: "Satın Alma Uzmanı", exp: "4 yıl", city: "Bursa", badges: ["CIPS"], available: true },
  { id: 5, name: "B. Arslan", title: "Stratejik Satın Alma Direktörü", exp: "15 yıl", city: "İstanbul", badges: ["CPSM", "ERP", "SAP"], available: false },
  { id: 6, name: "F. Şahin", title: "Teknik Satın Alma Uzmanı", exp: "5 yıl", city: "Kocaeli", badges: ["Mühendislik Alımları"], available: true },
];

const CITIES = ["Tüm Şehirler", "İstanbul", "Ankara", "İzmir", "Bursa", "Kocaeli"];

export default function CandidatePoolPage() {
  const [cityFilter, setCityFilter] = useState("Tüm Şehirler");
  const [availOnly, setAvailOnly] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = MOCK_CANDIDATES.filter((c) => {
    if (cityFilter !== "Tüm Şehirler" && c.city !== cityFilter) return false;
    if (availOnly && !c.available) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="cpp-root">
      <NavBar activePath="/is-arayanlar" />

      <section className="cpp-hero">
        <div className="cpp-hero-inner">
          <div className="cpp-hero-badge">Aday Havuzu</div>
          <h1 className="cpp-hero-h1">Onaylı Satın Alma Uzmanları</h1>
          <p className="cpp-hero-lead">
            Profil doğrulanmış, deneyimli satın alma profesyonellerini keşfedin.
            Açık pozisyonunuz için en uygun adayı bulun.
          </p>
          <a href="/employer/register" className="cpp-hero-cta">İlan Ver / İşveren Kaydı →</a>
        </div>
      </section>

      <div className="cpp-layout">
        <aside className="cpp-filters">
          <div className="cpp-filters__title">Filtrele</div>

          <div className="cpp-filter-group">
            <label className="cpp-filter-label">Arama</label>
            <input
              className="cpp-filter-input"
              placeholder="İsim veya unvan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="cpp-filter-group">
            <label className="cpp-filter-label">Şehir</label>
            <select
              className="cpp-filter-input"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <label className="cpp-filter-check">
            <input type="checkbox" checked={availOnly} onChange={(e) => setAvailOnly(e.target.checked)} />
            <span>Yalnızca müsait adaylar</span>
          </label>

          <div className="cpp-cta-aside">
            <p>İşvereniniz için uygun adayı bulamadınız mı?</p>
            <a href="/demo?audience=strategic&intent=talent" className="cpp-cta-aside-btn">
              Demo & Özel Arama →
            </a>
          </div>
        </aside>

        <main className="cpp-results">
          <div className="cpp-results-header">
            <span className="cpp-results-count">{filtered.length} aday bulundu</span>
            <span className="cpp-results-note">TODO: canlı veri için talent API entegrasyonu</span>
          </div>

          <div className="cpp-card-grid">
            {filtered.map((c) => (
              <article key={c.id} className="cpp-card">
                <div className="cpp-card-top">
                  <div className="cpp-card-avatar">{c.name.charAt(0)}</div>
                  <div>
                    <div className="cpp-card-name">{c.name}</div>
                    <div className="cpp-card-title">{c.title}</div>
                  </div>
                  {c.available && <span className="cpp-badge cpp-badge--avail">Müsait</span>}
                </div>
                <div className="cpp-card-meta">
                  <span>📍 {c.city}</span>
                  <span>💼 {c.exp} deneyim</span>
                </div>
                <div className="cpp-card-badges">
                  {c.badges.map((b) => (
                    <span key={b} className="cpp-badge">{b}</span>
                  ))}
                </div>
                <div className="cpp-card-actions">
                  <a href="/isveren-giris" className="cpp-card-btn cpp-card-btn--primary">İletişime Geç</a>
                  <a href="/employer/register" className="cpp-card-btn cpp-card-btn--ghost">İlan Ver</a>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="cpp-empty">
              Bu filtreyle eşleşen aday bulunamadı. Filtreleri genişletin.
            </div>
          )}
        </main>
      </div>

      <footer className="cpp-footer">
        © {new Date().getFullYear()} BUYER ASISTANS &nbsp;·&nbsp;
        <a href="/is-ilanlari">İş İlanları</a> &nbsp;·&nbsp;
        <a href="/neden-is-arayan">İş Arıyorum</a> &nbsp;·&nbsp;
        <a href="/neden-isveren">İşveren</a>
      </footer>
    </div>
  );
}
