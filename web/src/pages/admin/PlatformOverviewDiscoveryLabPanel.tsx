import type { DiscoveryLabSessionSummary, DiscoveryLabAnswerAuditSummary } from "../../services/admin.service";

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
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {discoveryLabSessions.length === 0 ? (
          <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
            Henuz izlenecek Discovery Lab oturumu bulunmuyor.
          </div>
        ) : (
          discoveryLabSessions.map((session) => (
            <div key={session.session_id} style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{session.source_filename || session.session_id}</div>
                <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: session.status === "technical_locked" ? "#dcfce7" : "#dbeafe", color: session.status === "technical_locked" ? "#166534" : "#1d4ed8", fontSize: 11, fontWeight: 700 }}>
                  {session.status}
                </span>
              </div>
              <div style={{ color: "#334155", fontSize: 13 }}>
                {session.latest_event_title} · {session.latest_actor || "Discovery Lab"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                <span>Proje: {session.project_name || "Secim bekliyor"}</span>
                <span>Teklif: {session.quote_id || "Olusmadi"}</span>
                <span>Olusturan: {session.created_by_email || "Bilinmiyor"}</span>
                <span>Onaylayan: {session.confirmed_by_email || "Beklemede"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Session: {session.session_id}</div>
                <button
                  type="button"
                  onClick={() => setExpandedDiscoverySessionId((current) => current === session.session_id ? null : session.session_id)}
                  style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                >
                  {expandedDiscoverySessionId === session.session_id ? "Detayi Gizle" : "Detayi Goster"}
                </button>
              </div>
              {expandedDiscoverySessionId === session.session_id && (
                <div style={{ borderRadius: 12, border: "1px solid #dbeafe", background: "#f8fbff", padding: "10px 12px", display: "grid", gap: 6, color: "#334155", fontSize: 12 }}>
                  <span>Son olay: {session.latest_event_title}</span>
                  <span>Aktor: {session.latest_actor || "Discovery Lab"}</span>
                  <span>Guncellenme: {String(session.updated_at || "")}</span>
                  <span>Proje No: {session.project_id || "-"}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Son Kullanici Yanitlari</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "Tum Kararlar" },
              { key: "needs_review", label: "Inceleme" },
              { key: "approved", label: "Onay" },
              { key: "ignored", label: "Pas" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDiscoveryLabAuditDecisionFilter(item.key as "all" | "approved" | "ignored" | "needs_review")}
                style={{ padding: "6px 10px", borderRadius: 999, border: discoveryLabAuditDecisionFilter === item.key ? "1px solid #0369a1" : "1px solid #dbe3ee", background: discoveryLabAuditDecisionFilter === item.key ? "#e0f2fe" : "white", color: discoveryLabAuditDecisionFilter === item.key ? "#0369a1" : "#475569", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {discoveryLabAnswerAudits.length === 0 ? (
          <div style={{ borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", color: "#64748b" }}>
            Filtreye uyan kullanici yaniti kaydi bulunmuyor.
          </div>
        ) : (
          discoveryLabAnswerAudits.slice(0, 5).map((audit) => (
            <div key={`audit-${audit.id}`} style={{ borderRadius: 14, background: "#f8fbff", border: "1px solid #dbeafe", padding: "12px 14px", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{audit.question_text || `Soru ${audit.question_id}`}</div>
                <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: "#e0f2fe", color: "#0369a1", fontSize: 11, fontWeight: 700 }}>
                  {audit.decision || "answered"}
                </span>
              </div>
              <div style={{ color: "#334155", fontSize: 13 }}>{audit.answer_text}</div>
              {audit.rationale ? <div style={{ color: "#64748b", fontSize: 12 }}>Gerekce: {audit.rationale}</div> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
                <span>Session: {audit.session_id || "-"}</span>
                <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                <span>Dosya: {audit.source_filename || "-"}</span>
                <span>Aktor: {audit.created_by_email || "Bilinmiyor"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setExpandedDiscoveryAuditId((current) => current === audit.id ? null : audit.id)}
                  style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}
                >
                  {expandedDiscoveryAuditId === audit.id ? "Detayi Gizle" : "Detayi Goster"}
                </button>
              </div>
              {expandedDiscoveryAuditId === audit.id && (
                <div style={{ borderRadius: 12, border: "1px solid #dbeafe", background: "white", padding: "10px 12px", display: "grid", gap: 6, color: "#334155", fontSize: 12 }}>
                  <span>Question ID: {audit.question_id}</span>
                  <span>Session: {audit.session_id || "-"}</span>
                  <span>Tenant: {audit.tenant_name || audit.tenant_id || "-"}</span>
                  <span>Proje: {audit.project_name || audit.project_id || "-"}</span>
                  <span>Quote/RFQ: {audit.quote_id || "-"}</span>
                  <span>Karar: {audit.decision || "answered"}</span>
                  <span>Kayit Zamanı: {String(audit.created_at || "")}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
