import PublicBrandLogo from "../../components/PublicBrandLogo";

interface Props {
  panelTitle: string;
  userName: string;
  /** Opsiyonel override: bu prop verilmezse CSS var(--panel-accent) devreye girer. */
  accentBackground?: string;
}

export default function PanelTopHeader({ panelTitle, userName, accentBackground }: Props) {
  return (
    <header
      className="as-panel-top"
      style={accentBackground ? { background: accentBackground } : undefined}
      data-has-override={accentBackground ? "true" : undefined}
    >
      <div className="as-panel-top__brand">
        <PublicBrandLogo height={52} maxWidth={200} invert />
      </div>
      <div className="as-panel-top__center">
        <h1 className="as-panel-top__title">{panelTitle}</h1>
        <span className="as-panel-top__ver">v3.4</span>
      </div>
      <div className="as-panel-top__welcome">
        <span className="as-panel-top__hi">Hoş geldiniz</span>
        <b className="as-panel-top__name">{userName}</b>
      </div>
    </header>
  );
}
