import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchJob, extractJobsError, type ProcurementJob } from "../services/jobs.service";
import "./JobDetailPage.css";

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
  const [job, setJob] = useState<ProcurementJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
