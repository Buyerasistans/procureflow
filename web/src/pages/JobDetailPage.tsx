import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  applyToJob,
  fetchJob,
  extractJobsError,
  type ProcurementJob,
} from "../services/jobs.service";
import "./JobDetailPage.css";

// ---------------------------------------------------------------------------
// Role helpers (same logic as JobsPage — inline, no shared module yet)
// ---------------------------------------------------------------------------

function isEmployerAdmin(systemRole: string | null | undefined): boolean {
  const sr = (systemRole || "").toLowerCase();
  return (
    sr === "employer_company_admin" ||
    sr === "employer_recruiter" ||
    sr === "super_admin" ||
    sr === "tenant_admin"
  );
}

function isTalentMember(systemRole: string | null | undefined): boolean {
  const sr = (systemRole || "").toLowerCase();
  return (
    sr === "talent_member" ||
    sr === "candidate_user" ||
    sr === "referral_partner" ||
    sr === "super_admin"
  );
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Tam Zamanlı",
  part_time: "Yarı Zamanlı",
  contract: "Sözleşmeli",
  freelance: "Freelance",
};

const LOCATION_LABELS: Record<string, string> = {
  remote: "Uzaktan",
  onsite: "Ofis",
  hybrid: "Hibrit",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);

  const { user } = useAuth();
  const systemRole = user?.system_role ?? null;
  const canEmployer = isEmployerAdmin(systemRole);
  const canTalent = isTalentMember(systemRole);

  // Job fetch state
  const [job, setJob] = useState<ProcurementJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply state
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [profileLinkRequired, setProfileLinkRequired] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    if (!id || isNaN(jobId) || jobId <= 0) {
      setError("Geçersiz ilan numarası.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchJob(jobId)
      .then(setJob)
      .catch((err) => setError(extractJobsError(err)))
      .finally(() => setLoading(false));
  }, [id, jobId]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!job) return;
    setApplyError(null);
    setProfileLinkRequired(false);
    setApplying(true);
    try {
      await applyToJob(job.id, { cover_letter: coverLetter.trim() || undefined });
      setApplySuccess(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: { code?: string; message?: string } } } })
        ?.response?.data?.detail;
      if (detail?.code === "DUPLICATE_APPLICATION") {
        setApplyError("Bu iş ilanına zaten başvurdunuz.");
      } else if (detail?.code === "TALENT_PROFILE_REQUIRED") {
        setProfileLinkRequired(true);
        setApplyError("Başvuru için önce talent profilinizi oluşturmalısınız.");
      } else if (detail?.code === "JOB_NOT_PUBLISHED") {
        setApplyError("Bu ilan artık başvuruya kapalı.");
      } else {
        setApplyError(extractJobsError(err));
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <div className="job-detail__loading">Yükleniyor...</div>;
  }

  if (error) {
    return <div className="job-detail__error">{error}</div>;
  }

  if (!job) {
    return <div className="job-detail__error">İlan bulunamadı.</div>;
  }

  return (
    <div className="job-detail">
      <p className="job-detail__title">{job.title}</p>
      <div className="job-detail__meta">
        <span className={`job-detail__badge job-detail__badge--${job.status}`}>
          {job.status}
        </span>
        <span className="job-detail__badge">
          {EMPLOYMENT_LABELS[job.employment_type] ?? job.employment_type}
        </span>
        <span className="job-detail__badge">
          {LOCATION_LABELS[job.location_type] ?? job.location_type}
        </span>
        {job.category && <span className="job-detail__badge">{job.category}</span>}
        {(job.city || job.country) && (
          <span className="job-detail__badge">
            {[job.city, job.country].filter(Boolean).join(", ")}
          </span>
        )}
        <span className="job-detail__meta-count">
          {job.application_count} başvuru · {job.view_count} görüntülenme
        </span>
      </div>
      <p className="job-detail__desc">{job.description}</p>

      {canTalent && !canEmployer && job.status === "published" && (
        <div className="job-detail__apply">
          {applySuccess ? (
            <div className="job-detail__apply-success">Başvurunuz iletildi!</div>
          ) : (
            <form onSubmit={(e) => void handleApply(e)}>
              {applyError && (
                <div className="job-detail__apply-error">
                  {applyError}
                  {profileLinkRequired && (
                    <>
                      {" "}
                      <Link className="job-detail__apply-error-link" to="/talent/profile">
                        Profil oluştur →
                      </Link>
                    </>
                  )}
                </div>
              )}
              <label className="job-detail__apply-label">Ön Yazı (opsiyonel)</label>
              <textarea
                className="job-detail__apply-textarea"
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder={`${job.title} pozisyonu için neden başvuruyorsunuz?`}
              />
              <div className="job-detail__apply-actions">
                <button
                  type="submit"
                  className="job-detail__apply-btn job-detail__apply-btn--primary"
                  disabled={applying}
                >
                  {applying ? "Gönderiliyor..." : "Başvur"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
