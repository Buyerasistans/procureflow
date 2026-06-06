import { useState, useEffect } from "react";
import { getMyAddonStatus, submitAddonRequest, type AddonStatus } from "../services/payment.service";
import "./DualRoleAddonPanel.css";

export function DualRoleAddonPanel() {
  const [status, setStatus] = useState<AddonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMyAddonStatus()
      .then((data) => { if (mounted) setStatus(data); })
      .catch(() => { if (mounted) setError("Addon durumu alınamadı."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitAddonRequest(notes || undefined);
      setSuccess("Başvurunuz alındı. Platform ekibi inceleyip sizinle iletişime geçecek.");
      setStatus((prev) => prev ? { ...prev, request_pending: true } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="drap-loading">Yükleniyor…</div>;

  return (
    <div className="drap">
      <div className="drap-hero">
        <div className="drap-hero__icon">🔗</div>
        <div>
          <h3 className="drap-hero__title">Tedarikçi Portalı Yeteneği</h3>
          <p className="drap-hero__desc">
            Firmanızı aynı zamanda tedarikçi olarak kaydedin. Admin ve Direktör rolleri her iki tarafı tek hesaptan yönetir.
          </p>
        </div>
        <div className="drap-hero__badge-wrap">
          {status?.addon_status === "active" && <span className="drap-badge drap-badge--active">Aktif</span>}
          {!status?.addon_status && status?.request_pending && <span className="drap-badge drap-badge--pending">Başvuru Beklemede</span>}
          {!status?.addon_status && !status?.request_pending && <span className="drap-badge drap-badge--none">Aktif Değil</span>}
        </div>
      </div>

      <div className="drap-features">
        {[
          "Firmayı hem stratejik partner hem tedarikçi olarak kaydetme",
          "Admin + Direktör hesabından çift taraflı profil görüntüleme",
          "Tedarikçi portalı erişimi — teklif, RFQ, kampanya",
        ].map((f) => (
          <div key={f} className="drap-feature">
            <span className="drap-feature__check">✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {status?.addon_status === "active" && (
        <div className="drap-active-msg">
          Tedarikçi Portalı Yeteneği aktif. Tedarikçi profilinize <b>Tedarikçi Profili</b> sekmesinden ulaşabilirsiniz.
        </div>
      )}

      {!status?.addon_status && status?.request_pending && (
        <div className="drap-pending-msg">
          Başvurunuz platform ekibinin incelemesinde. Onaylandığında e-posta ile bilgilendirileceksiniz.
        </div>
      )}

      {!status?.addon_status && !status?.request_pending && (
        <form className="drap-form" onSubmit={handleSubmit}>
          <p className="drap-form__label">
            Tedarikçi Portalı Yeteneği başvurusunda bulunmak için formu gönderin. Platform ekibi 1-2 iş günü içinde sizinle iletişime geçecek.
          </p>
          <div className="drap-form__group">
            <label className="drap-form__field-label" htmlFor="drap-notes">Ek Not (isteğe bağlı)</label>
            <textarea
              id="drap-notes"
              className="drap-form__textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kullanım amacınızı veya ek bilgilerinizi paylaşabilirsiniz"
            />
          </div>
          {error && <div className="drap-alert drap-alert--error">{error}</div>}
          {success && <div className="drap-alert drap-alert--success">{success}</div>}
          <button type="submit" className="drap-btn" disabled={submitting}>
            {submitting ? "Gönderiliyor…" : "Tedarikçi Portalı İçin Başvur"}
          </button>
        </form>
      )}

      {success && (
        <div className="drap-alert drap-alert--success">{success}</div>
      )}
    </div>
  );
}
