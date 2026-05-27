import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createJob, extractJobsError } from "../services/jobs.service";
import "./JobCreatePage.css";

function canPostJob(systemRole: string | null | undefined, businessRole?: string | null): boolean {
  const sr = (systemRole ?? "").toLowerCase();
  const br = (businessRole ?? "").toLowerCase();
  const allowedSystemRoles = new Set([
    "employer_company_admin",
    "employer_recruiter",
    "super_admin",
    "tenant_admin",
    "tenant_owner",
    "platform_support",
    "platform_operator",
    "finance_officer",
  ]);
  const hrRoles = new Set(["ik_yoneticisi", "ik_uzmani", "hr_manager", "hr_specialist"]);
  return allowedSystemRoles.has(sr) || hrRoles.has(br);
}

export default function JobCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [locationType, setLocationType] = useState("remote");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Türkiye");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("TRY");
  const [salaryPeriod, setSalaryPeriod] = useState("monthly");
  const [skillsRaw, setSkillsRaw] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [jobStatus, setJobStatus] = useState<"draft" | "published">("draft");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = user ? canPostJob(user.system_role, user.role) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Başlık en az 3 karakter olmalıdır.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Açıklama en az 10 karakter olmalıdır.");
      return;
    }

    setSubmitting(true);
    try {
      const skills = skillsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await createJob({
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
        employment_type: employmentType,
        location_type: locationType,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        salary_min: salaryMin ? Number(salaryMin) : undefined,
        salary_max: salaryMax ? Number(salaryMax) : undefined,
        salary_currency: salaryCurrency || "TRY",
        salary_period: salaryPeriod,
        required_skills: skills,
        min_experience_years: minExperience ? Number(minExperience) : undefined,
        status: jobStatus,
        application_deadline: deadline || undefined,
      });

      navigate("/jobs");
    } catch (err) {
      setError(extractJobsError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canPost) {
    return (
      <div className="job-create__forbidden">
        <p>Bu sayfaya erişim yetkiniz yok.</p>
        <Link to="/jobs" className="job-create__back-link">← İlanlara Dön</Link>
      </div>
    );
  }

  return (
    <div className="job-create">
      <div className="job-create__header">
        <Link to="/jobs" className="job-create__back-link">← İlanlara Dön</Link>
        <h1 className="job-create__title">Yeni İş İlanı</h1>
      </div>

      {error && (
        <div className="job-create__error" role="alert">
          {error}
        </div>
      )}

      <form className="job-create__form" onSubmit={handleSubmit} noValidate>
        {/* ---- Zorunlu Alanlar ---- */}
        <section className="job-create__section">
          <h2 className="job-create__section-title">Temel Bilgiler</h2>

          <div className="job-create__field">
            <label className="job-create__label" htmlFor="jc-title">
              İlan Başlığı <span aria-hidden="true">*</span>
            </label>
            <input
              id="jc-title"
              type="text"
              className="job-create__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="örn. Kıdemli Satın Alma Uzmanı"
              maxLength={255}
              required
            />
          </div>

          <div className="job-create__field">
            <label className="job-create__label" htmlFor="jc-description">
              Açıklama <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="jc-description"
              className="job-create__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="İş tanımı, sorumluluklar, gereksinimler..."
              rows={8}
              required
            />
          </div>

          <div className="job-create__row">
            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-category">Kategori</label>
              <input
                id="jc-category"
                type="text"
                className="job-create__input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="örn. Tedarik Zinciri"
              />
            </div>

            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-employment-type">Çalışma Tipi</label>
              <select
                id="jc-employment-type"
                className="job-create__select"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="full_time">Tam Zamanlı</option>
                <option value="part_time">Yarı Zamanlı</option>
                <option value="contract">Sözleşmeli</option>
                <option value="freelance">Freelance</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---- Konum ---- */}
        <section className="job-create__section">
          <h2 className="job-create__section-title">Konum</h2>

          <div className="job-create__row">
            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-location-type">Çalışma Yeri</label>
              <select
                id="jc-location-type"
                className="job-create__select"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
              >
                <option value="remote">Uzaktan</option>
                <option value="onsite">Ofis</option>
                <option value="hybrid">Hibrit</option>
              </select>
            </div>

            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-city">Şehir</label>
              <input
                id="jc-city"
                type="text"
                className="job-create__input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="İstanbul"
              />
            </div>

            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-country">Ülke</label>
              <input
                id="jc-country"
                type="text"
                className="job-create__input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---- Maaş ---- */}
        <section className="job-create__section">
          <h2 className="job-create__section-title">Maaş (Opsiyonel)</h2>

          <div className="job-create__row">
            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-salary-min">Min. Maaş</label>
              <input
                id="jc-salary-min"
                type="number"
                className="job-create__input"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>

            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-salary-max">Maks. Maaş</label>
              <input
                id="jc-salary-max"
                type="number"
                className="job-create__input"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>

            <div className="job-create__field job-create__field--narrow">
              <label className="job-create__label" htmlFor="jc-salary-currency">Para Birimi</label>
              <input
                id="jc-salary-currency"
                type="text"
                className="job-create__input"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                maxLength={10}
              />
            </div>

            <div className="job-create__field job-create__field--narrow">
              <label className="job-create__label" htmlFor="jc-salary-period">Dönem</label>
              <select
                id="jc-salary-period"
                className="job-create__select"
                value={salaryPeriod}
                onChange={(e) => setSalaryPeriod(e.target.value)}
              >
                <option value="monthly">Aylık</option>
                <option value="annual">Yıllık</option>
                <option value="daily">Günlük</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---- Aday Kriterleri ---- */}
        <section className="job-create__section">
          <h2 className="job-create__section-title">Aday Kriterleri (Opsiyonel)</h2>

          <div className="job-create__row">
            <div className="job-create__field job-create__field--grow">
              <label className="job-create__label" htmlFor="jc-skills">
                Aranan Beceriler
              </label>
              <input
                id="jc-skills"
                type="text"
                className="job-create__input"
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
                placeholder="ERP, SAP, tedarik zinciri (virgülle ayırın)"
              />
            </div>

            <div className="job-create__field job-create__field--narrow">
              <label className="job-create__label" htmlFor="jc-experience">Min. Deneyim (yıl)</label>
              <input
                id="jc-experience"
                type="number"
                className="job-create__input"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                placeholder="0"
                min={0}
                max={60}
              />
            </div>
          </div>
        </section>

        {/* ---- Yayın Ayarları ---- */}
        <section className="job-create__section">
          <h2 className="job-create__section-title">Yayın Ayarları</h2>

          <div className="job-create__row">
            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-deadline">Son Başvuru Tarihi</label>
              <input
                id="jc-deadline"
                type="date"
                className="job-create__input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="job-create__field">
              <label className="job-create__label" htmlFor="jc-status">Durum</label>
              <select
                id="jc-status"
                className="job-create__select"
                value={jobStatus}
                onChange={(e) => setJobStatus(e.target.value as "draft" | "published")}
              >
                <option value="draft">Taslak — Şimdi kaydet, sonra yayınla</option>
                <option value="published">Yayında — Hemen yayınla</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---- Gönder ---- */}
        <div className="job-create__actions">
          <Link to="/jobs" className="job-create__btn job-create__btn--cancel">
            İptal
          </Link>
          <button
            type="submit"
            className="job-create__btn job-create__btn--submit"
            disabled={submitting}
          >
            {submitting ? "Kaydediliyor..." : jobStatus === "published" ? "Yayınla" : "Taslak Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
