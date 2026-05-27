import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  applyToJob,
  createJob,
  extractJobsError,
  fetchJobs,
  type JobCreatePayload,
  type ProcurementJob,
} from "../services/jobs.service";
import "./JobsPage.css";

// ---------------------------------------------------------------------------
// Role helpers (local — avoids touching permissions.ts)
// ---------------------------------------------------------------------------

function isEmployerAdmin(systemRole: string | null | undefined): boolean {
  const sr = (systemRole || "").toLowerCase();
  return sr === "employer_company_admin" || sr === "employer_recruiter" || sr === "super_admin" || sr === "tenant_admin";
}

function isTalentMember(systemRole: string | null | undefined): boolean {
  const sr = (systemRole || "").toLowerCase();
  return sr === "talent_member" || sr === "candidate_user" || sr === "referral_partner" || sr === "super_admin";
}

// ---------------------------------------------------------------------------
// Create Job Form (employer)
// ---------------------------------------------------------------------------

interface CreateJobFormProps {
  onSuccess: (job: ProcurementJob) => void;
  onCancel: () => void;
}

function CreateJobForm({ onSuccess, onCancel }: CreateJobFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [locationType, setLocationType] = useState("remote");
  const [status, setStatus] = useState("draft");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || title.trim().length < 3) {
      setError("Başlık en az 3 karakter olmalıdır.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Açıklama en az 10 karakter olmalıdır.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: JobCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
        employment_type: employmentType,
        location_type: locationType,
        status,
      };
      const job = await createJob(payload);
      onSuccess(job);
    } catch (err) {
      setError(extractJobsError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="jobs-form" onSubmit={handleSubmit}>
      <p className="jobs-form__title">Yeni İş İlanı Oluştur</p>
      {error && <div className="jobs-page__error">{error}</div>}
      <div className="jobs-form__grid">
        <div className="jobs-form__field jobs-form__field--full">
          <label className="jobs-form__label">Başlık *</label>
          <input
            className="jobs-form__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ör. Kıdemli Satın Alma Uzmanı"
            required
          />
        </div>
        <div className="jobs-form__field jobs-form__field--full">
          <label className="jobs-form__label">Açıklama *</label>
          <textarea
            className="jobs-form__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Pozisyon hakkında detaylı bilgi..."
            required
          />
        </div>
        <div className="jobs-form__field">
          <label className="jobs-form__label">Kategori</label>
          <input
            className="jobs-form__input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ör. Kategori Yönetimi"
          />
        </div>
        <div className="jobs-form__field">
          <label className="jobs-form__label">Çalışma Tipi</label>
          <select className="jobs-form__select" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
            <option value="full_time">Tam Zamanlı</option>
            <option value="part_time">Yarı Zamanlı</option>
            <option value="contract">Sözleşmeli</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>
        <div className="jobs-form__field">
          <label className="jobs-form__label">Konum</label>
          <select className="jobs-form__select" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
            <option value="remote">Uzaktan</option>
            <option value="onsite">Ofis</option>
            <option value="hybrid">Hibrit</option>
          </select>
        </div>
        <div className="jobs-form__field">
          <label className="jobs-form__label">Durum</label>
          <select className="jobs-form__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Taslak</option>
            <option value="published">Yayınla</option>
          </select>
        </div>
      </div>
      <div className="jobs-form__actions">
        <button type="submit" className="jobs-page__btn jobs-page__btn--primary" disabled={submitting}>
          {submitting ? "Kaydediliyor..." : "İlanı Kaydet"}
        </button>
        <button type="button" className="jobs-page__btn jobs-page__btn--secondary" onClick={onCancel}>
          İptal
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Apply Form (talent)
// ---------------------------------------------------------------------------

interface ApplyFormProps {
  job: ProcurementJob;
  onSuccess: () => void;
  onCancel: () => void;
}

function ApplyForm({ job, onSuccess, onCancel }: ApplyFormProps) {
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [profileLinkRequired, setProfileLinkRequired] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProfileLinkRequired(false);
    setSubmitting(true);
    try {
      await applyToJob(job.id, { cover_letter: coverLetter.trim() || undefined });
      setSuccess(true);
      setTimeout(onSuccess, 1200);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { code?: string; message?: string } } } })?.response?.data?.detail;
      if (detail?.code === "DUPLICATE_APPLICATION") {
        setError("Bu iş ilanına zaten başvurdunuz.");
      } else if (detail?.code === "TALENT_PROFILE_REQUIRED") {
        setProfileLinkRequired(true);
        setError("Başvuru için önce talent profilinizi oluşturmalısınız.");
      } else if (detail?.code === "JOB_NOT_PUBLISHED") {
        setError("Bu ilan artık başvuruya kapalı.");
      } else {
        setError(extractJobsError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <div className="jobs-page__success">Başvurunuz iletildi!</div>;
  }

  return (
    <form className="apply-form" onSubmit={handleApply}>
      {error && (
        <div className="jobs-page__error">
          {error}
          {profileLinkRequired && (
            <>
              {" "}
              <Link className="jobs-page__error-link" to="/talent/profile">
                Profil oluştur →
              </Link>
            </>
          )}
        </div>
      )}
      <label className="apply-form__label">Ön Yazı (opsiyonel)</label>
      <textarea
        className="apply-form__textarea"
        value={coverLetter}
        onChange={(e) => setCoverLetter(e.target.value)}
        placeholder={`${job.title} pozisyonu için neden başvuruyorsunuz?`}
      />
      <div className="jobs-form__actions" style={{ marginTop: 10 }}>
        <button type="submit" className="jobs-page__btn jobs-page__btn--primary" disabled={submitting}>
          {submitting ? "Gönderiliyor..." : "Başvur"}
        </button>
        <button type="button" className="jobs-page__btn jobs-page__btn--secondary" onClick={onCancel}>
          İptal
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Job Card
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: ProcurementJob;
  canEmployer: boolean;
  canTalent: boolean;
  applyingJobId: number | null;
  onApplyClick: (job: ProcurementJob) => void;
  onApplySuccess: () => void;
  onApplyCancel: () => void;
}

function JobCard({ job, canEmployer, canTalent, applyingJobId, onApplyClick, onApplySuccess, onApplyCancel }: JobCardProps) {
  const statusBadgeClass =
    job.status === "published" ? "job-card__badge--published"
    : job.status === "draft" ? "job-card__badge--draft"
    : "job-card__badge--closed";

  const employmentLabel: Record<string, string> = {
    full_time: "Tam Zamanlı", part_time: "Yarı Zamanlı",
    contract: "Sözleşmeli", freelance: "Freelance",
  };
  const locationLabel: Record<string, string> = {
    remote: "Uzaktan", onsite: "Ofis", hybrid: "Hibrit",
  };

  const isApplying = applyingJobId === job.id;

  return (
    <div className="job-card">
      <p className="job-card__title">{job.title}</p>
      <div className="job-card__meta">
        <span className={`job-card__badge ${statusBadgeClass}`}>{job.status}</span>
        <span className="job-card__badge">{employmentLabel[job.employment_type] ?? job.employment_type}</span>
        <span className="job-card__badge">{locationLabel[job.location_type] ?? job.location_type}</span>
        {job.category && <span className="job-card__badge">{job.category}</span>}
        {(job.city || job.country) && (
          <span className="job-card__badge">{[job.city, job.country].filter(Boolean).join(", ")}</span>
        )}
        <span style={{ color: "#94a3b8", fontSize: 12 }}>{job.application_count} başvuru</span>
      </div>
      <p className="job-card__desc">{job.description}</p>
      <div className="job-card__actions">
        {canTalent && job.status === "published" && !isApplying && (
          <button className="jobs-page__btn jobs-page__btn--primary" onClick={() => onApplyClick(job)}>
            Başvur
          </button>
        )}
        {canEmployer && (
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {new Date(job.created_at).toLocaleDateString("tr-TR")}
          </span>
        )}
      </div>
      {isApplying && (
        <ApplyForm job={job} onSuccess={onApplySuccess} onCancel={onApplyCancel} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobsPage — main export
// ---------------------------------------------------------------------------

export default function JobsPage() {
  const { user } = useAuth();
  const systemRole = user?.system_role ?? null;
  const canEmployer = isEmployerAdmin(systemRole);
  const canTalent = isTalentMember(systemRole);

  const [jobs, setJobs] = useState<ProcurementJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobs(page, PAGE_SIZE);
      setJobs(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(extractJobsError(err));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  function handleCreateSuccess(job: ProcurementJob) {
    setShowCreateForm(false);
    setSuccessMsg(`"${job.title}" ilanı oluşturuldu.`);
    void loadJobs();
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  function handleApplySuccess() {
    setApplyingJobId(null);
    setSuccessMsg("Başvurunuz başarıyla iletildi!");
    void loadJobs();
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="jobs-page">
      <div className="jobs-page__header">
        <h1 className="jobs-page__title">
          {canEmployer && !canTalent ? "İş İlanları (İşveren)" : "İş İlanları"}
        </h1>
        {canEmployer && (
          <button
            className="jobs-page__btn jobs-page__btn--primary"
            onClick={() => { setShowCreateForm((v) => !v); setError(null); }}
          >
            {showCreateForm ? "Kapat" : "+ Yeni İlan"}
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateJobForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {successMsg && <div className="jobs-page__success">{successMsg}</div>}
      {error && <div className="jobs-page__error">{error}</div>}

      {loading ? (
        <div className="jobs-page__empty">Yükleniyor...</div>
      ) : jobs.length === 0 ? (
        <div className="jobs-page__empty">
          {canEmployer ? "Henüz ilan oluşturulmadı." : "Şu anda açık bir ilan bulunmuyor."}
        </div>
      ) : (
        jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            canEmployer={canEmployer}
            canTalent={canTalent}
            applyingJobId={applyingJobId}
            onApplyClick={(j) => setApplyingJobId(j.id)}
            onApplySuccess={handleApplySuccess}
            onApplyCancel={() => setApplyingJobId(null)}
          />
        ))
      )}

      {totalPages > 1 && (
        <div className="jobs-pagination">
          <button
            className="jobs-page__btn jobs-page__btn--secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ‹ Önceki
          </button>
          <span>{page} / {totalPages} ({total} ilan)</span>
          <button
            className="jobs-page__btn jobs-page__btn--secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Sonraki ›
          </button>
        </div>
      )}
    </div>
  );
}
