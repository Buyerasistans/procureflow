import { useState, useMemo } from "react";
import NavBar from "./NavBar";
import "./KariyerListingsLayout.css";

export type KariyerMode = "employer" | "candidate";

// ─── Job types (employer mode) ───────────────────────────────────────────────

interface Job {
  id: number;
  company: string;
  daysAgo: number;
  title: string;
  city: string | null;
  locationType: "remote" | "onsite" | "hybrid";
  employmentTypeKey: string;
  employmentType: string;
  category: string;
  salaryMin: number | null;
  salaryMax: number | null;
}

const SAMPLE_JOBS: Job[] = [
  { id: 1, company: "ABC Tedarik A.Ş.", daysAgo: 3, title: "Kıdemli Satın Alma Uzmanı", city: "İstanbul", locationType: "onsite", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Hammadde & Ambalaj", salaryMin: 35000, salaryMax: 45000 },
  { id: 2, company: "Delta Endüstri A.Ş.", daysAgo: 1, title: "Tedarik Zinciri Müdürü", city: "Ankara", locationType: "hybrid", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Otomotiv", salaryMin: 55000, salaryMax: 75000 },
  { id: 3, company: "Sigma Gıda Ltd.", daysAgo: 5, title: "Satın Alma Müdürü", city: "İzmir", locationType: "onsite", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Gıda & İçecek", salaryMin: 45000, salaryMax: 60000 },
  { id: 4, company: "TechProcure", daysAgo: 2, title: "IT Satın Alma Uzmanı", city: null, locationType: "remote", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Teknoloji", salaryMin: 40000, salaryMax: 55000 },
  { id: 5, company: "Mega İnşaat A.Ş.", daysAgo: 7, title: "Satın Alma Uzman Yardımcısı", city: "İstanbul", locationType: "onsite", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "İnşaat & Yapı", salaryMin: 25000, salaryMax: 35000 },
  { id: 6, company: "Global Tedarik Danışmanlık", daysAgo: 10, title: "Tedarikçi Geliştirme Uzmanı", city: "Bursa", locationType: "hybrid", employmentTypeKey: "contract", employmentType: "Sözleşmeli", category: "Danışmanlık", salaryMin: 30000, salaryMax: 45000 },
  { id: 7, company: "Anadolu Holding", daysAgo: 4, title: "Satın Alma Direktörü", city: "İstanbul", locationType: "onsite", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Perakende", salaryMin: 80000, salaryMax: 110000 },
  { id: 8, company: "EkoLojistik", daysAgo: 6, title: "Lojistik ve Satın Alma Uzmanı", city: null, locationType: "remote", employmentTypeKey: "full_time", employmentType: "Tam Zamanlı", category: "Lojistik", salaryMin: 32000, salaryMax: 42000 },
];

// ─── Professional types (candidate mode) ─────────────────────────────────────

interface Professional {
  id: number;
  initials: string;
  role: string;
  daysAgo: number;
  experienceYears: number;
  sector: string;
  city: string | null;
  locationType: "remote" | "onsite" | "hybrid";
  specialization: string;
  skills: string;
  salaryExpectation: string;
}

const SAMPLE_PROFESSIONALS: Professional[] = [
  { id: 1, initials: "A.K.", role: "Satın Alma Müdürü", daysAgo: 2, experienceYears: 12, sector: "FMCG & Üretim Sektörü", city: "Ankara", locationType: "hybrid", specialization: "Danışmanlık", skills: "ERP: SAP · Oracle", salaryExpectation: "Proje bazlı · Müzakereye açık" },
  { id: 2, initials: "M.Y.", role: "Tedarik Zinciri Uzmanı", daysAgo: 5, experienceYears: 8, sector: "Otomotiv", city: null, locationType: "remote", specialization: "Tedarikçi Yönetimi", skills: "SAP MM · Lean Supply Chain", salaryExpectation: "75.000 – 90.000 TL · Aylık" },
  { id: 3, initials: "B.S.", role: "Kıdemli Satın Alma Uzmanı", daysAgo: 3, experienceYears: 6, sector: "Gıda & İçecek", city: "İstanbul", locationType: "onsite", specialization: "Hammadde Tedariki", skills: "Oracle ERP · SAP Ariba", salaryExpectation: "50.000 – 65.000 TL · Aylık" },
  { id: 4, initials: "E.D.", role: "Satın Alma Direktörü", daysAgo: 1, experienceYears: 16, sector: "İnşaat & Yapı", city: "İstanbul", locationType: "onsite", specialization: "Stratejik Satın Alma", skills: "SAP · Kategori Yönetimi", salaryExpectation: "Müzakereye açık" },
  { id: 5, initials: "C.Ö.", role: "IT Satın Alma Uzmanı", daysAgo: 7, experienceYears: 4, sector: "Teknoloji", city: null, locationType: "remote", specialization: "Yazılım & Donanım Tedariki", skills: "SAP SRM · MS Excel İleri", salaryExpectation: "45.000 – 58.000 TL · Aylık" },
  { id: 6, initials: "F.A.", role: "Satın Alma Uzman Yardımcısı", daysAgo: 10, experienceYears: 2, sector: "Tekstil", city: "İzmir", locationType: "hybrid", specialization: "Hammadde & Ambalaj", skills: "SAP · Excel · Tedarikçi İlişkileri", salaryExpectation: "28.000 – 35.000 TL · Aylık" },
  { id: 7, initials: "H.T.", role: "Lojistik ve Satın Alma Uzmanı", daysAgo: 4, experienceYears: 5, sector: "Lojistik", city: "Bursa", locationType: "onsite", specialization: "İthalat & Gümrük", skills: "Oracle · WMS · İngilizce İleri", salaryExpectation: "40.000 – 52.000 TL · Aylık" },
  { id: 8, initials: "N.K.", role: "Tedarik Zinciri Koordinatörü", daysAgo: 8, experienceYears: 3, sector: "Perakende", city: "İstanbul", locationType: "hybrid", specialization: "Envanter Yönetimi", skills: "SAP · Power BI · Excel", salaryExpectation: "35.000 – 45.000 TL · Aylık" },
];

// ─── Sidebar data ─────────────────────────────────────────────────────────────

const EMPLOYER_SIDEBAR = [
  { company: "Alfa Tedarik Ltd.", position: "Satın Alma Uzmanı", daysAgo: 5 },
  { company: "Beta Holding", position: "Tedarik Zinciri Müdürü", daysAgo: 12 },
  { company: "Gamma Üretim A.Ş.", position: "Satın Alma Müdürü", daysAgo: 18 },
  { company: "Delta İnşaat Ltd.", position: "Satın Alma Direktörü", daysAgo: 25 },
  { company: "Omega Gıda A.Ş.", position: "Kıdemli Satın Alma Uzmanı", daysAgo: 31 },
];

const CANDIDATE_SIDEBAR = [
  { initials: "A.K.", role: "Satın Alma Müdürü", company: "DEF A.Ş.", daysAgo: 8 },
  { initials: "M.Y.", role: "Tedarik Zinciri Uzmanı", company: "XYZ Holding", daysAgo: 15 },
  { initials: "B.S.", role: "Kıdemli Satın Alma Uzmanı", company: "Sigma Gıda", daysAgo: 22 },
  { initials: "E.D.", role: "Satın Alma Direktörü", company: "Omega Ltd.", daysAgo: 30 },
  { initials: "C.Ö.", role: "Tedarik Uzmanı", company: "Alpha Tekstil", daysAgo: 38 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function locationLabel(city: string | null, locationType: "remote" | "onsite" | "hybrid"): string {
  if (locationType === "remote") return "Uzaktan";
  if (locationType === "hybrid") return city ? `${city} / Hibrit` : "Hibrit";
  return city ?? "Belirtilmemiş";
}

function locationIcon(lt: "remote" | "onsite" | "hybrid"): string {
  if (lt === "remote") return "💻";
  if (lt === "hybrid") return "🔄";
  return "📍";
}

function salaryText(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${min.toLocaleString("tr-TR")} – ${max.toLocaleString("tr-TR")} TL`;
  if (min) return `${min.toLocaleString("tr-TR")} TL+`;
  return null;
}

function daysAgoText(n: number): string {
  if (n === 0) return "Bugün";
  if (n === 1) return "1 gün önce";
  return `${n} gün önce`;
}

function expBand(years: number): string {
  if (years < 3) return "0-3";
  if (years < 7) return "3-7";
  if (years < 12) return "7-12";
  return "12+";
}

// ─── Job card components ──────────────────────────────────────────────────────

function JobCard({ job, mode }: { job: Job; mode: KariyerMode }) {
  const salary = salaryText(job.salaryMin, job.salaryMax);
  const isEmployer = mode === "employer";
  return (
    <div className="kl-card">
      <div className="kl-card__header">
        <span className="kl-card__name">{job.company}</span>
        <span className="kl-card__days">{daysAgoText(job.daysAgo)}</span>
      </div>
      <h3 className="kl-card__title">{job.title}</h3>
      <div className="kl-card__meta">
        <span>{locationIcon(job.locationType)} {locationLabel(job.city, job.locationType)}</span>
        <span>💼 {job.employmentType}</span>
      </div>
      <div className="kl-card__tag">🎯 Kategori: {job.category}</div>
      {salary && <div className="kl-card__salary">🥇 {salary}</div>}
      <div className="kl-card__actions">
        <a href={isEmployer ? `/jobs/${job.id}` : "/candidate/register"} className="kl-btn kl-btn--primary">
          {isEmployer ? "Başvur" : "Profil Oluştur"}
        </a>
        <a href={`/jobs/${job.id}`} className="kl-btn kl-btn--secondary">Detay Gör</a>
      </div>
    </div>
  );
}

function JobListRow({ job, mode }: { job: Job; mode: KariyerMode }) {
  const salary = salaryText(job.salaryMin, job.salaryMax);
  const isEmployer = mode === "employer";
  return (
    <div className="kl-row">
      <div className="kl-row__main">
        <span className="kl-row__title">{job.title}</span>
        <span className="kl-row__sub">{job.company}</span>
        <span className="kl-row__meta">
          {locationIcon(job.locationType)} {locationLabel(job.city, job.locationType)} · 💼 {job.employmentType} · 🎯 {job.category}{salary ? ` · 🥇 ${salary}` : ""}
        </span>
      </div>
      <div className="kl-row__right">
        <span className="kl-card__days">{daysAgoText(job.daysAgo)}</span>
        <div className="kl-row__actions">
          <a href={isEmployer ? `/jobs/${job.id}` : "/candidate/register"} className="kl-btn kl-btn--primary kl-btn--sm">
            {isEmployer ? "Başvur" : "Profil"}
          </a>
          <a href={`/jobs/${job.id}`} className="kl-btn kl-btn--secondary kl-btn--sm">Detay</a>
        </div>
      </div>
    </div>
  );
}

// ─── Professional card components ─────────────────────────────────────────────

function ProfCard({ pro }: { pro: Professional }) {
  return (
    <div className="kl-card">
      <div className="kl-card__header">
        <span className="kl-card__name">
          <span className="kl-pro-avatar">{pro.initials}</span>
          {pro.role}
        </span>
        <span className="kl-card__days">{daysAgoText(pro.daysAgo)}</span>
      </div>
      <div className="kl-card__exp">
        <strong>{pro.experienceYears} yıl</strong> · {pro.sector}
      </div>
      <div className="kl-card__meta">
        <span>{locationIcon(pro.locationType)} {locationLabel(pro.city, pro.locationType)}</span>
        <span>🎯 {pro.specialization}</span>
      </div>
      <div className="kl-card__tag">✅ {pro.skills}</div>
      <div className="kl-card__salary">🥇 {pro.salaryExpectation}</div>
      <div className="kl-card__actions">
        <a href="/employer/register" className="kl-btn kl-btn--primary">İletişime Geç</a>
        <a href={`/talent/${pro.id}`} className="kl-btn kl-btn--secondary">Profil Gör</a>
      </div>
    </div>
  );
}

function ProfListRow({ pro }: { pro: Professional }) {
  return (
    <div className="kl-row">
      <div className="kl-row__main">
        <span className="kl-row__title">{pro.initials} – {pro.role}</span>
        <span className="kl-row__sub">{pro.experienceYears} yıl · {pro.sector}</span>
        <span className="kl-row__meta">
          {locationIcon(pro.locationType)} {locationLabel(pro.city, pro.locationType)} · 🎯 {pro.specialization} · ✅ {pro.skills}
        </span>
      </div>
      <div className="kl-row__right">
        <span className="kl-card__days">{daysAgoText(pro.daysAgo)}</span>
        <div className="kl-row__actions">
          <a href="/employer/register" className="kl-btn kl-btn--primary kl-btn--sm">İletişim</a>
          <a href={`/talent/${pro.id}`} className="kl-btn kl-btn--secondary kl-btn--sm">Profil</a>
        </div>
      </div>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

interface Props {
  mode: KariyerMode;
}

export default function KariyerListingsLayout({ mode }: Props) {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [q, setQ] = useState("");
  const [locationType, setLocationType] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  const isEmployer = mode === "employer";

  const filteredJobs = useMemo(() => {
    if (!isEmployer) return [];
    return SAMPLE_JOBS.filter((job) => {
      if (q) {
        const ql = q.toLowerCase();
        if (!job.title.toLowerCase().includes(ql) && !job.company.toLowerCase().includes(ql) && !job.category.toLowerCase().includes(ql)) return false;
      }
      if (locationType && job.locationType !== locationType) return false;
      if (employmentType && job.employmentTypeKey !== employmentType) return false;
      return true;
    });
  }, [isEmployer, q, locationType, employmentType]);

  const filteredPros = useMemo(() => {
    if (isEmployer) return [];
    return SAMPLE_PROFESSIONALS.filter((pro) => {
      if (q) {
        const ql = q.toLowerCase();
        if (
          !pro.role.toLowerCase().includes(ql) &&
          !pro.sector.toLowerCase().includes(ql) &&
          !pro.specialization.toLowerCase().includes(ql) &&
          !pro.skills.toLowerCase().includes(ql)
        ) return false;
      }
      if (locationType && pro.locationType !== locationType) return false;
      if (experienceLevel && expBand(pro.experienceYears) !== experienceLevel) return false;
      return true;
    });
  }, [isEmployer, q, locationType, experienceLevel]);

  const count = isEmployer ? filteredJobs.length : filteredPros.length;

  return (
    <div className="kl-page">
      <NavBar variant="neutral" activePath="" />

      {/* CTA bar */}
      <div className={`kl-cta-bar ${isEmployer ? "kl-cta-bar--employer" : "kl-cta-bar--candidate"}`}>
        <div className="kl-cta-bar__inner">
          <p className="kl-cta-bar__text">
            {isEmployer
              ? "Satın alma ve tedarik zinciri uzmanlarına ulaşın. İlanınızı yayınlayın, en nitelikli adaylarla tanışın."
              : "Kariyerinizi sergileyin, satın alma uzmanı arayan şirketler sizi bulsun."}
          </p>
          <a
            href={isEmployer ? "/employer/register" : "/candidate/register"}
            className={`kl-cta-bar__btn ${isEmployer ? "kl-cta-bar__btn--employer" : "kl-cta-bar__btn--candidate"}`}
          >
            {isEmployer ? "İşveren Kaydı" : "Profilinizi Oluşturun"}
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="kl-body">
        {/* Main column */}
        <div className="kl-main">
          {/* Filter */}
          <div className="kl-filter">
            <input
              className="kl-filter__search"
              type="text"
              placeholder={isEmployer ? "Pozisyon, şirket veya kategori ara..." : "Rol, sektör veya beceri ara..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="kl-filter__selects">
              <select title="Konum filtresi" className="kl-filter__select" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                <option value="">Tüm Konumlar</option>
                <option value="remote">💻 Uzaktan</option>
                <option value="onsite">📍 Ofis</option>
                <option value="hybrid">🔄 Hibrit</option>
              </select>
              {isEmployer ? (
                <select title="Çalışma tipi filtresi" className="kl-filter__select" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  <option value="">Tüm Çalışma Tipleri</option>
                  <option value="full_time">Tam Zamanlı</option>
                  <option value="part_time">Yarı Zamanlı</option>
                  <option value="contract">Sözleşmeli</option>
                  <option value="freelance">Freelance</option>
                </select>
              ) : (
                <select title="Deneyim seviyesi filtresi" className="kl-filter__select" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  <option value="">Tüm Deneyim Seviyeleri</option>
                  <option value="0-3">0 – 3 yıl (Junior)</option>
                  <option value="3-7">3 – 7 yıl (Mid-level)</option>
                  <option value="7-12">7 – 12 yıl (Senior)</option>
                  <option value="12+">12+ yıl (Direktör / Danışman)</option>
                </select>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="kl-toolbar">
            <span className="kl-toolbar__count">
              <strong>{count}</strong> {isEmployer ? "ilan" : "profesyonel"} bulundu
            </span>
            <div className="kl-view-toggle">
              <button
                type="button"
                className={`kl-view-toggle__btn ${viewMode === "card" ? "kl-view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("card")}
              >
                🔲 Kart
              </button>
              <button
                type="button"
                className={`kl-view-toggle__btn ${viewMode === "list" ? "kl-view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                ≡ Liste
              </button>
            </div>
          </div>

          {/* Listings */}
          {count === 0 ? (
            <div className="kl-empty">Aramanızla eşleşen kayıt bulunamadı.</div>
          ) : isEmployer ? (
            viewMode === "card" ? (
              <div className="kl-cards-grid">
                {filteredJobs.map((j) => <JobCard key={j.id} job={j} mode={mode} />)}
              </div>
            ) : (
              <div className="kl-list">
                {filteredJobs.map((j) => <JobListRow key={j.id} job={j} mode={mode} />)}
              </div>
            )
          ) : (
            viewMode === "card" ? (
              <div className="kl-cards-grid">
                {filteredPros.map((p) => <ProfCard key={p.id} pro={p} />)}
              </div>
            ) : (
              <div className="kl-list">
                {filteredPros.map((p) => <ProfListRow key={p.id} pro={p} />)}
              </div>
            )
          )}
        </div>

        {/* Sidebar */}
        <aside className="kl-sidebar">
          <div className="kl-sidebar__section">
            <h3 className="kl-sidebar__title">
              {isEmployer ? "🏢 Çalışma Arkadaşını Bulan Firmalar" : "⭐ Kariyerine Devam Eden Yetenekler"}
            </h3>
            <ul className="kl-sidebar__list">
              {isEmployer
                ? EMPLOYER_SIDEBAR.map((s, i) => (
                  <li key={i} className="kl-sidebar__item">
                    <span className="kl-sidebar__item-name">{s.company}</span>
                    <span className="kl-sidebar__item-detail">{s.position}</span>
                    <span className="kl-sidebar__item-badge">✓ {daysAgoText(s.daysAgo)}</span>
                  </li>
                ))
                : CANDIDATE_SIDEBAR.map((s, i) => (
                  <li key={i} className="kl-sidebar__item">
                    <span className="kl-sidebar__item-name">{s.initials} – {s.role}</span>
                    <span className="kl-sidebar__item-detail">{s.company}</span>
                    <span className="kl-sidebar__item-badge">✓ {daysAgoText(s.daysAgo)}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="kl-sidebar__section kl-sidebar__section--alt">
            <h3 className="kl-sidebar__title">
              {isEmployer ? "📈 Platform İstatistikleri" : "📊 Platform İstatistikleri"}
            </h3>
            <ul className="kl-sidebar__stats">
              {isEmployer ? (
                <>
                  <li><strong>127</strong> aktif ilan</li>
                  <li><strong>43</strong> şirket</li>
                  <li><strong>8</strong> yeni bu hafta</li>
                </>
              ) : (
                <>
                  <li><strong>2.4K+</strong> kayıtlı profesyonel</li>
                  <li><strong>127</strong> açık pozisyon</li>
                  <li><strong>89%</strong> eşleşme oranı</li>
                </>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
