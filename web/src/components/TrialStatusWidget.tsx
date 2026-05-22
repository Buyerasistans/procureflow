import { useState, useEffect } from "react";
import { http } from "../lib/http";

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
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#f3f4f6",
          color: "#6b7280",
          textAlign: "center",
        }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (error || !trialStatus) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#fee2e2",
          color: "#991b1b",
          fontSize: "14px",
        }}
      >
        {error || "Trial durumu gösterilemiyor"}
      </div>
    );
  }

  if (!trialStatus.is_trial_active) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "8px",
          backgroundColor: "#dbeafe",
          color: "#0c4a6e",
          fontSize: "14px",
        }}
      >
        Trial dönemini tamamladınız. Aboneliğiniz aktif durumda.
      </div>
    );
  }

  const progressPercent = (
    (Math.max(0, 30 - trialStatus.days_remaining) / 30) *
    100
  );
  const isEnding = trialStatus.days_remaining <= 3;
  const isVeryEnding = trialStatus.days_remaining <= 1;

  return (
    <div
      style={{
        borderRadius: "8px",
        backgroundColor: isVeryEnding ? "#fef2f2" : isEnding ? "#fffbeb" : "#f0fdf4",
        border: `1px solid ${
          isVeryEnding ? "#fecaca" : isEnding ? "#fde68a" : "#bbf7d0"
        }`,
        padding: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: "12px",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
            }}
          >
            🎉 Trial Dönem
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
            {trialStatus.trial_start_date} - {trialStatus.trial_end_date}
          </p>
        </div>
        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: isVeryEnding ? "#dc2626" : isEnding ? "#d97706" : "#16a34a",
              margin: "0 0 4px 0",
            }}
          >
            {trialStatus.days_remaining}
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            gün kaldı
          </div>
        </div>
      </div>

      {/* Warning Messages */}
      {isVeryEnding && (
        <div
          style={{
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "#fee2e2",
            borderRadius: "4px",
            color: "#991b1b",
            fontSize: "13px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <span>⚠️</span>
          <span>
            Trial dönemi sona geliyor. Lütfen ödeme yönteminizi güncelleyin.
          </span>
        </div>
      )}
      {isEnding && !isVeryEnding && (
        <div
          style={{
            marginBottom: "12px",
            padding: "8px 12px",
            backgroundColor: "#fef3c7",
            borderRadius: "4px",
            color: "#92400e",
            fontSize: "13px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <span>ℹ️</span>
          <span>
            {trialStatus.days_remaining} günde trial bitecek ve abonelik başlayacak.
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            height: "6px",
            backgroundColor: "#e5e7eb",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              backgroundColor: isVeryEnding ? "#dc2626" : isEnding ? "#d97706" : "#10b981",
              width: `${progressPercent}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Current Limits */}
      <div style={{ marginBottom: "12px" }}>
        <h4
          style={{
            margin: "0 0 8px 0",
            fontSize: "13px",
            fontWeight: "600",
            color: "#1f2937",
            textTransform: "uppercase",
          }}
        >
          Trial Süresi Limitler
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {Object.entries(trialStatus.trial_limits).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: "8px",
                backgroundColor: "#f3f4f6",
                borderRadius: "4px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1f2937",
                  margin: "0 0 4px 0",
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                {key === "suppliers"
                  ? "Tedarikçi"
                  : key === "projects"
                    ? "Proje"
                    : "Kullanıcı"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post-Trial Limits Preview */}
      <div style={{ paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
        <h4
          style={{
            margin: "0 0 8px 0",
            fontSize: "13px",
            fontWeight: "600",
            color: "#1f2937",
            textTransform: "uppercase",
          }}
        >
          Abonelik Sonrası Limitler
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {Object.entries(trialStatus.post_trial_limits).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: "8px",
                backgroundColor: "#f0fdf4",
                borderRadius: "4px",
                textAlign: "center",
                border: "1px solid #bbf7d0",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#16a34a",
                  margin: "0 0 4px 0",
                }}
              >
                {value === Infinity ? "∞" : value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                {key === "suppliers"
                  ? "Tedarikçi"
                  : key === "projects"
                    ? "Proje"
                    : "Kullanıcı"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.1)" }}>
        <button
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#4338ca";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#4f46e5";
          }}
        >
          → Premium Özellik Satın Al
        </button>
      </div>
    </div>
  );
}
