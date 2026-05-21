import "./PlatformOverviewDiscoveryLabStats.css";

type PlatformOverviewDiscoveryLabStatsProps = {
  discoveryLabSummary: {
    total_sessions: number;
    locked_sessions: number;
    quote_ready_sessions: number;
    active_project_count: number;
    answer_audit_count: number;
  };
};

const cards = [
  {
    label: "Filtrelenen Oturum",
    valueKey: "total_sessions",
    note: "Secili filtre sonucunda listelenen kayit",
    tone: "teal",
  },
  {
    label: "Teknik Kilit",
    valueKey: "locked_sessions",
    note: "Aktarima gecen oturum",
    tone: "green",
  },
  {
    label: "RFQ Hazir",
    valueKey: "quote_ready_sessions",
    note: "Teklif kaydi baglanan oturum",
    tone: "blue",
  },
  {
    label: "Aktif Proje",
    valueKey: "active_project_count",
    note: "Gorunen proje kapsami",
    tone: "violet",
  },
  {
    label: "Yanit Audit",
    valueKey: "answer_audit_count",
    note: "Kayit altina alinan kullanici cevabi",
    tone: "teal",
  },
] as const;

export function PlatformOverviewDiscoveryLabStats({ discoveryLabSummary }: PlatformOverviewDiscoveryLabStatsProps) {
  return (
    <div className="platform-overview-discovery-lab-stats">
      {cards.map((card) => (
        <div key={card.label} className="platform-overview-discovery-lab-stats__card">
          <div className="platform-overview-discovery-lab-stats__label">{card.label}</div>
          <div
            className={`platform-overview-discovery-lab-stats__value platform-overview-discovery-lab-stats__value--${card.tone}`}
          >
            {discoveryLabSummary[card.valueKey]}
          </div>
          <div className="platform-overview-discovery-lab-stats__note">{card.note}</div>
        </div>
      ))}
    </div>
  );
}
