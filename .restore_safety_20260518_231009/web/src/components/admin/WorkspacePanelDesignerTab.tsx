import type { WorkspacePanelConfig } from "../../admin/workspace-panels";

type WorkspacePanelDesignerTabProps = {
  config: WorkspacePanelConfig;
  saving?: boolean;
  onSave: (config: WorkspacePanelConfig) => void | Promise<void>;
};

export function WorkspacePanelDesignerTab({ config, saving = false, onSave }: WorkspacePanelDesignerTabProps) {
  return (
    <section style={{ borderRadius: 20, border: "1px solid #dbe3ee", background: "#ffffff", padding: 18, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: "#0369a1" }}>Panel tasarimi</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rol panel profilleri</div>
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
          Kayitli profil sayisi: {config.profiles.length}
        </div>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void onSave(config)}
        style={{
          justifySelf: "start",
          borderRadius: 12,
          border: "none",
          background: saving ? "#93c5fd" : "#0284c7",
          color: "#fff",
          fontWeight: 900,
          padding: "10px 14px",
          cursor: saving ? "wait" : "pointer",
        }}
      >
        {saving ? "Kaydediliyor..." : "Panel ayarlarini kaydet"}
      </button>
    </section>
  );
}
