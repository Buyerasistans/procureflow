import type { DiscoveryLabSessionSummary, DiscoveryLabAnswerAuditSummary } from "../../services/admin.service";
import "./PlatformOverviewDiscoveryLabPanel.css";

interface PlatformOverviewDiscoveryLabPanelProps {
  discoveryLabSessions: DiscoveryLabSessionSummary[];
  expandedDiscoverySessionId: string | null;
  setExpandedDiscoverySessionId: (fn: (current: string | null) => string | null) => void;
  discoveryLabAnswerAudits: DiscoveryLabAnswerAuditSummary[];
  expandedDiscoveryAuditId: number | null;
  setExpandedDiscoveryAuditId: (fn: (current: number | null) => number | null) => void;
  discoveryLabAuditDecisionFilter: "all" | "approved" | "ignored" | "needs_review";
  setDiscoveryLabAuditDecisionFilter: (value: "all" | "approved" | "ignored" | "needs_review") => void;
}

export function PlatformOverviewDiscoveryLabPanel({
  discoveryLabSessions,
  expandedDiscoverySessionId,
  setExpandedDiscoverySessionId,
  discoveryLabAnswerAudits,
  expandedDiscoveryAuditId,
  setExpandedDiscoveryAuditId,
  discoveryLabAuditDecisionFilter,
  setDiscoveryLabAuditDecisionFilter,
}: PlatformOverviewDiscoveryLabPanelProps) {
  return (
    <>
      <div className="platform-overview-discovery-lab-panel">
        {discoveryLabSessions.length === 0 ? (
          <div className="platform-overview-discovery-lab-panel__empty">
            Henuz izlenecek Discovery Lab oturumu bulunmuyor.
          </div>
        ) : (
          discoveryLabSessions.map((session) => (
            <div key={session.session_id} className="platform-overview-discovery-lab-panel__session">
              <div className="platform-overview-discovery-lab-panel__session-header">
                <div className="platform-overview-discovery-lab-panel__session-title">{session.source_filename || session.session_id}</div>
                <span className={`platform-overview-discovery-lab-panel__session-pill ${session.status === "technical_locked" ? "platform-overview-discovery-lab-panel__session-pill--locked" : "platform-overview-discovery-lab-panel__session-pill--open"}`}>
                  {session.status}
                </span>
              </div>
              <div className="platform-overview-discovery-lab-panel__session-detail">
                {session.latest_event_title} · {session.latest_actor || "Discovery Lab"}
              </div>
              <div className="platform-overview-discovery-lab-panel__session-meta">
                <span>Proje: {session.project_name || "Secim bekliyor"}</span>
                <span>Teklif: {session.quote_id || "Olusmadi"}</span>
                <span>Olusturan: {session.created_by_email || "Bilinmiyor"}</span>
                <span>Onaylayan: {session.confirmed_by_email || "Beklemede"}</span>
              </div>
              <div className="platform-overview-discovery-lab-panel__session-footer">
                <div className="platform-overview-discovery-lab-panel__session-meta">Session: {session.session_id}</div>
                <button
                  type="button"
                  onClick={() => setExpandedDiscoverySessionId((current) => current === session.session_id ? null : session.session_id)}
                  className="platform-overview-discovery-lab-panel__button"
                >
                  {expandedDiscoverySessionId === session.session_id ? "Detayı Gizle" : "Detayı Göster"}
                </button>
              </div>
              {expandedDiscoverySessionId === session.session_id && (
                <div className="platform-overview-discovery-lab-panel__session-expanded">
                  <span>Son olay: {session.latest_event_title}</span>
                  <span>Aktör: {session.latest_actor || "Discovery Lab"}</span>
                  <span>Güncellenme: {String(session.updated_at || "")}</span>
                  <span>Proje No: {session.project_id || "-"}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="platform-overview-discovery-lab-panel">
        <div className="platform-overview-discovery-lab-panel__filter-row">
          <div className="platform-overview-discovery-lab-panel__session-title">Son Kullanıcı Yanıtları</div>
          <div className="platform-overview-discovery-lab-panel__filter-group">
            {[
              { key: "all", label: "Tum Kararlar" },
              { key: "needs_review", label: "İnceleme" },
              { key: "approved", label: "Onay" },
              { key: "ignored", label: "Pas" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDiscoveryLabAuditDecisionFilter(item.key as "all" | "approved" | "ignored" | "needs_review")}
                className={`platform-overview-discovery-lab-panel__filter-button ${discoveryLabAuditDecisionFilter === item.key ? "platform-overview-discovery-lab-panel__filter-button--selected" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {discoveryLabAnswerAudits.length === 0 ? (
          <div className="platform-overview-discovery-lab-panel__empty">
            Filtreye uyan kullanıcı yanıtı kaydı bulunmuyor.
          </div>
        ) : (
          discoveryLabAnswerAudits.slice(0, 5).map((audit) => (
            <div key={`audit-${audit.id}`} className="platform-overview-discovery-lab-panel__audit">
              <div className="platform-overview-discovery-lab-panel__audit-header">
                <div className="platform-overview-discovery-lab-panel__audit-title">{audit.question_text || `Soru ${audit.question_id}`}</div>
                <span className="platform-overview-discovery-lab-panel__audit-status">
                  {audit.decision || "answered"}
                </span>
              </div>
              <div className="platform-overview-discovery-lab-panel__audit-detail">{audit.answer_text}</div>
              {audit.rationale ? <div className="platform-overview-discovery-lab-panel__audit-meta">Gerekçe: {audit.rationale}</div> : null}
              <div className="platform-overview-discovery-lab-panel__audit-meta">
                <span>Session: {audit.session_id || "-"}</span>
                <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                <span>Dosya: {audit.source_filename || "-"}</span>
                <span>Aktör: {audit.created_by_email || "Bilinmiyor"}</span>
              </div>
              <div className="platform-overview-discovery-lab-panel__audit-footer">
                <div />
                <button
                  type="button"
                  onClick={() => setExpandedDiscoveryAuditId((current) => current === audit.id ? null : audit.id)}
                  className="platform-overview-discovery-lab-panel__button"
                >
                  {expandedDiscoveryAuditId === audit.id ? "Detayı Gizle" : "Detayı Göster"}
                </button>
              </div>
              {expandedDiscoveryAuditId === audit.id && (
                <div className="platform-overview-discovery-lab-panel__audit-expanded">
                  <span>Question ID: {audit.question_id}</span>
                  <span>Session: {audit.session_id || "-"}</span>
                  <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                  <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                  <span>Quote/RFQ: {audit.quote_id || "-"}</span>
                  <span>Karar: {audit.decision || "answered"}</span>
                  <span>Kayıt Zamanı: {String(audit.created_at || "")}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
