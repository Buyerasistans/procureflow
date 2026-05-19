type PlatformOverviewDiscoveryLabStatsProps = {
  discoveryLabSummary: {
    total_sessions: number;
    locked_sessions: number;
    quote_ready_sessions: number;
    active_project_count: number;
    answer_audit_count: number;
  };
};

export function PlatformOverviewDiscoveryLabStats({ discoveryLabSummary }: PlatformOverviewDiscoveryLabStatsProps) {
  return (
    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
      {[
        { label: "Filtrelenen Oturum", value: discoveryLabSummary.total_sessions, note: "Secili filtre sonucunda listelenen kayit", color: "#0f766e" },
        { label: "Teknik Kilit", value: discoveryLabSummary.locked_sessions, note: "Aktarima gecen oturum", color: "#166534" },
        { label: "RFQ Hazir", value: discoveryLabSummary.quote_ready_sessions, note: "Teklif kaydi baglanan oturum", color: "#1d4ed8" },
        { label: "Aktif Proje", value: discoveryLabSummary.active_project_count, note: "Gorunen proje kapsami", color: "#7c3aed" },
        { label: "Yanit Audit", value: discoveryLabSummary.answer_audit_count, note: "Kayit altina alinan kullanici cevabi", color: "#0f766e" },
      ].map((card) => (
        <div key={card.label} style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", padding: 14, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>{card.label}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>{card.note}</div>
        </div>
      ))}
    </div>
  );
}
