import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  applyToJob,
  createJob,
  extractJobsError,
  fetchJobs,
  getMyApplications,
  listApplications,
  updateApplicationStatus,
  updateJob,
  type JobApplicationOut,
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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  applied:     ["shortlisted", "rejected"],
  shortlisted: ["interview",   "rejected"],
  interview:   ["offered",     "rejected"],
  offered:     ["rejected"],
  rejected:    [],
  withdrawn:   [],
};

const TRANSITION_LABELS: Record<string, string> = {
  shortlisted: "Listele",
  interview:   "Mülakata Al",
  offered:     "Teklif Ver",
  rejected:    "Reddet",
};

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
  updatingJobId: number | null;
  openApplicationsJobId: number | null;
  applicationsMap: Partial<Record<number, JobApplicationOut[]>>;
  loadingApplicationsJobId: number | null;
  updatingApplicationId: number | null;
  onApplyClick: (job: ProcurementJob) => void;
  onApplySuccess: () => void;
  onApplyCancel: () => void;
  onStatusUpdate: (jobId: number, status: string) => void;
  onToggleApplications: (jobId: number) => void;
  onUpdateApplicationStatus: (appId: number, newStatus: string, jobId: number) => void;
}

function JobCard({ job, canEmployer, canTalent, applyingJobId, updatingJobId, openApplicationsJobId, applicationsMap, loadingApplicationsJobId, updatingApplicationId, onApplyClick, onApplySuccess, onApplyCancel, onStatusUpdate, onToggleApplications, onUpdateApplicationStatus }: JobCardProps) {
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
  const isUpdating = updatingJobId === job.id;

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
      {canEmployer && !canTalent && job.status === "published" && (
        <div className="job-card__status-actions">
          <button
            type="button"
            className="jobs-page__btn jobs-page__btn--status-close"
            disabled={isUpdating}
            onClick={() => onStatusUpdate(job.id, "closed")}
          >
            {isUpdating ? "Güncelleniyor..." : "Kapat"}
          </button>
          <button
            type="button"
            className="jobs-page__btn jobs-page__btn--status-fill"
            disabled={isUpdating}
            onClick={() => onStatusUpdate(job.id, "filled")}
          >
            {isUpdating ? "Güncelleniyor..." : "Dolu İşaretle"}
          </button>
        </div>
      )}
      {canEmployer && !canTalent && (
        <>
          <button
            type="button"
            className="jobs-page__btn jobs-page__btn--secondary job-card__applications-toggle"
            onClick={() => onToggleApplications(job.id)}
          >
            {openApplicationsJobId === job.id ? "Başvuruları Gizle" : `Başvurular (${job.application_count})`}
          </button>
          {openApplicationsJobId === job.id && (
            <div className="job-card__applications">
              {loadingApplicationsJobId === job.id ? (
                <p className="job-card__applications-empty">Yükleniyor...</p>
              ) : (applicationsMap[job.id] ?? []).length === 0 ? (
                <p className="job-card__applications-empty">Henüz başvuru yok.</p>
              ) : (
                (applicationsMap[job.id] ?? []).map((app) => {
                  const transitions = STATUS_TRANSITIONS[app.status] ?? [];
                  const isUpdatingApp = updatingApplicationId === app.id;
                  return (
                    <div key={app.id} className="application-row">
                      <div className="application-row__info">
                        <span className="application-row__applicant">Aday #{app.applicant_user_id}</span>
                        <span className={`application-status-badge application-status-badge--${app.status}`}>
                          {app.status}
                        </span>
                        <span className="application-row__date">
                          {new Date(app.applied_at).toLocaleDateString("tr-TR")}
                        </span>
                        {app.employer_note && (
                          <span className="application-row__note">{app.employer_note}</span>
                        )}
                      </div>
                      {transitions.length > 0 && (
                        <div className="application-actions">
                          {transitions.map((target) => (
                            <button
                              key={target}
                              type="button"
                              className={`jobs-page__btn application-actions__btn application-actions__btn--${target === "rejected" ? "reject" : "advance"}`}
                              disabled={isUpdatingApp}
                              onClick={() => onUpdateApplicationStatus(app.id, target, job.id)}
                            >
                              {isUpdatingApp ? "..." : TRANSITION_LABELS[target]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
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
  const [updatingJobId, setUpdatingJobId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [openApplicationsJobId, setOpenApplicationsJobId] = useState<number | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Partial<Record<number, JobApplicationOut[]>>>({});
  const [loadingApplicationsJobId, setLoadingApplicationsJobId] = useState<number | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState<number | null>(null);
  const [myApplications, setMyApplications] = useState<JobApplicationOut[]>([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(false);
  const [myApplicationsError, setMyApplicationsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!canTalent || canEmployer) return;
    setMyApplicationsLoading(true);
    void getMyApplications()
      .then((apps) => setMyApplications(apps))
      .catch((err) => setMyApplicationsError(extractJobsError(err)))
      .finally(() => setMyApplicationsLoading(false));
  }, [canTalent, canEmployer]);

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

  async function handleStatusUpdate(jobId: number, newStatus: string) {
    setUpdatingJobId(jobId);
    try {
      const updated = await updateJob(jobId, { status: newStatus });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      const label = newStatus === "closed" ? "Kapatıldı" : "Dolu İşaretlendi";
      setSuccessMsg(`İlan "${label}" olarak güncellendi.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(extractJobsError(err));
    } finally {
      setUpdatingJobId(null);
    }
  }

  async function handleToggleApplications(jobId: number) {
    if (openApplicationsJobId === jobId) {
      setOpenApplicationsJobId(null);
      return;
    }
    setOpenApplicationsJobId(jobId);
    if (applicationsMap[jobId] !== undefined) return;
    setLoadingApplicationsJobId(jobId);
    try {
      const apps = await listApplications(jobId);
      setApplicationsMap((prev) => ({ ...prev, [jobId]: apps }));
    } catch (err) {
      setError(extractJobsError(err));
      setOpenApplicationsJobId(null);
    } finally {
      setLoadingApplicationsJobId(null);
    }
  }

  async function handleUpdateApplicationStatus(applicationId: number, newStatus: string, jobId: number) {
    setUpdatingApplicationId(applicationId);
    try {
      const updated = await updateApplicationStatus(applicationId, { status: newStatus });
      setApplicationsMap((prev) => ({
        ...prev,
        [jobId]: (prev[jobId] ?? []).map((a) => (a.id === updated.id ? updated : a)),
      }));
    } catch (err) {
      setError(extractJobsError(err));
    } finally {
      setUpdatingApplicationId(null);
    }
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

      {canTalent && !canEmployer && (
        <section className="jobs-page__my-applications">
          <h2 className="jobs-page__my-applications-title">Başvurularım</h2>
          {myApplicationsLoading ? (
            <p className="jobs-page__my-applications-empty">Yükleniyor...</p>
          ) : myApplicationsError ? (
            <div className="jobs-page__error">{myApplicationsError}</div>
          ) : myApplications.length === 0 ? (
            <p className="jobs-page__my-applications-empty">Henüz başvurunuz bulunmuyor.</p>
          ) : (
            myApplications.map((app) => (
              <div key={app.id} className="my-application-row">
                <div className="my-application-row__info">
                  <span className="my-application-row__job">İlan #{app.job_id}</span>
                  <span className={`application-status-badge application-status-badge--${app.status}`}>
                    {app.status}
                  </span>
                  <span className="my-application-row__date">
                    {new Date(app.applied_at).toLocaleDateString("tr-TR")}
                  </span>
                  {app.updated_at && (
                    <span className="my-application-row__date">
                      Güncellendi: {new Date(app.updated_at).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                </div>
                {app.employer_note && (
                  <p className="my-application-row__note">{app.employer_note}</p>
                )}
              </div>
            ))
          )}
        </section>
      )}

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
            updatingJobId={updatingJobId}
            openApplicationsJobId={openApplicationsJobId}
            applicationsMap={applicationsMap}
            loadingApplicationsJobId={loadingApplicationsJobId}
            updatingApplicationId={updatingApplicationId}
            onApplyClick={(j) => setApplyingJobId(j.id)}
            onApplySuccess={handleApplySuccess}
            onApplyCancel={() => setApplyingJobId(null)}
            onStatusUpdate={handleStatusUpdate}
            onToggleApplications={handleToggleApplications}
            onUpdateApplicationStatus={handleUpdateApplicationStatus}
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
