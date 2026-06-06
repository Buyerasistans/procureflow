import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { http } from "../lib/http";
import "./TrialStatusWidget.css";

interface TrialStatus {
  tenant_id: number;
  trial_start_date: string;
  trial_end_date: string;
  days_remaining: number;
  is_trial_active: boolean;
  trial_limits: {
    suppliers: number;
    projects: number;
    users: number;
  };
  post_trial_limits: {
    suppliers: number;
    projects: number;
    users: number;
  };
}

interface TrialStatusWidgetProps {
  tenantId: number;
  onTrialEnding?: () => void;
}

export function TrialStatusWidget({ tenantId, onTrialEnding }: TrialStatusWidgetProps) {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrialStatus();
  }, [tenantId]);

  const loadTrialStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get(`/api/v1/onboarding/trial-status/${tenantId}`);
      const data = response.data;
      setTrialStatus(data);

      // Trigger callback if trial ending soon
      if (data.days_remaining <= 3 && onTrialEnding) {
        onTrialEnding();
      }
    } catch (err) {
      console.error("Trial status yüklenemedi:", err);
      setError("Trial durumu yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="tsw-loading">Yükleniyor...</div>;
  }

  if (error || !trialStatus) {
    return <div className="tsw-error">{error || "Trial durumu gösterilemiyor"}</div>;
  }

  if (!trialStatus.is_trial_active) {
    return <div className="tsw-inactive">Trial dönemini tamamladınız. Aboneliğiniz aktif durumda.</div>;
  }

  const progressPercent = (
    (Math.max(0, 30 - trialStatus.days_remaining) / 30) *
    100
  );
  const isEnding = trialStatus.days_remaining <= 3;
  const isVeryEnding = trialStatus.days_remaining <= 1;

  const cardClass = `tsw-card${isVeryEnding ? " tsw-card--very-ending" : isEnding ? " tsw-card--ending" : ""}`;
  const daysClass = `tsw-days-count${isVeryEnding ? " tsw-days-count--very-ending" : isEnding ? " tsw-days-count--ending" : ""}`;
  const fillClass = `tsw-progress-fill${isVeryEnding ? " tsw-progress-fill--very-ending" : isEnding ? " tsw-progress-fill--ending" : ""}`;

  return (
    <div className={cardClass}>
      <div className="tsw-header">
        <div>
          <h3 className="tsw-header__title">🎉 Trial Dönem</h3>
          <p className="tsw-header__dates">
            {trialStatus.trial_start_date} - {trialStatus.trial_end_date}
          </p>
        </div>
        <div className="tsw-header__right">
          <div className={daysClass}>{trialStatus.days_remaining}</div>
          <div className="tsw-days-label">gün kaldı</div>
        </div>
      </div>

      {isVeryEnding && (
        <div className="tsw-warn tsw-warn--urgent">
          <span>⚠️</span>
          <span>Trial dönemi sona geliyor. Lütfen ödeme yönteminizi güncelleyin.</span>
        </div>
      )}
      {isEnding && !isVeryEnding && (
        <div className="tsw-warn tsw-warn--ending">
          <span>ℹ️</span>
          <span>{trialStatus.days_remaining} günde trial bitecek ve abonelik başlayacak.</span>
        </div>
      )}

      <div className="tsw-progress-wrap">
        <div className="tsw-progress-track">
          <div
            className={fillClass}
            style={{ "--tsw-fill-w": `${progressPercent}%` } as CSSProperties}
          />
        </div>
      </div>

      <div className="tsw-limits">
        <h4 className="tsw-limits__title">Trial Süresi Limitler</h4>
        <div className="tsw-limits__grid">
          {Object.entries(trialStatus.trial_limits).map(([key, value]) => (
            <div key={key} className="tsw-limit-card">
              <div className="tsw-limit-card__value">{value}</div>
              <div className="tsw-limit-card__label">
                {key === "suppliers" ? "Tedarikçi" : key === "projects" ? "Proje" : "Kullanıcı"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tsw-section">
        <h4 className="tsw-limits__title">Abonelik Sonrası Limitler</h4>
        <div className="tsw-limits__grid">
          {Object.entries(trialStatus.post_trial_limits).map(([key, value]) => (
            <div key={key} className="tsw-limit-card tsw-limit-card--post">
              <div className="tsw-limit-card__value tsw-limit-card__value--post">
                {value === Infinity ? "∞" : value}
              </div>
              <div className="tsw-limit-card__label">
                {key === "suppliers" ? "Tedarikçi" : key === "projects" ? "Proje" : "Kullanıcı"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tsw-section--top">
        <button className="tsw-cta-btn">
          → Premium Özellik Satın Al
        </button>
      </div>
    </div>
  );
}
