import PublicBrandLogo from "./PublicBrandLogo";

interface WorkspaceHeroCardProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  welcomeLabel?: string;
  userName?: string;
  userEmail?: string;
  rightTitle?: string;
  accentGradient?: string;
  topNotice?: string | null;
  headerInfo?: string | null;
  footerInfo?: string | null;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  footerBgColor?: string | null;
  footerTextColor?: string | null;
  heroTextColor?: string | null;
  heroMutedTextColor?: string | null;
  compact?: boolean;
}

export default function WorkspaceHeroCard({
  title,
  subtitle,
  eyebrow = "Platform Yönetim Alanı",
  welcomeLabel = "Hoş geldiniz",
  userName,
  userEmail,
  rightTitle,
  accentGradient = "linear-gradient(120deg, #112a25 0%, #173630 62%, #7aa56f 100%)",
  topNotice,
  headerInfo,
  footerInfo,
  headerBgColor,
  headerTextColor,
  footerBgColor,
  footerTextColor,
  heroTextColor,
  heroMutedTextColor,
  compact = true,
}: WorkspaceHeroCardProps) {
  return (
    <section
      style={{
        marginBottom: 20,
        borderRadius: 22,
        overflow: "hidden",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "white",
        boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
      }}
    >
      {(topNotice || headerInfo || headerBgColor || headerTextColor) ? (
        <div style={{ padding: "8px 14px", background: headerBgColor || "#0f172acc", color: headerTextColor || "#f8fafc", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>{topNotice || "Ust bilgi alani"}</span>
          <span>{headerInfo || "Header bilgi alani"}</span>
        </div>
      ) : null}
      <section
        style={{
        minHeight: compact ? 78 : 96,
        padding: compact ? "14px 22px" : "16px 24px",
        background: accentGradient,
        color: heroTextColor || "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 14,
          padding: "8px 10px",
          width: "fit-content",
          background: "rgba(10, 30, 26, 0.22)",
          flexShrink: 0,
        }}
      >
        <PublicBrandLogo height={26} maxWidth={145} invert />
      </div>

      <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2.2,
            textTransform: "uppercase",
              color: heroMutedTextColor || "#d1fae5",
            marginBottom: 2,
          }}
        >
          {eyebrow}
        </div>
          <h2 style={{ margin: 0, fontSize: compact ? 28 : 32, lineHeight: 1.02, fontWeight: 900, color: heroTextColor || "#f8fafc" }}>{title}</h2>
          {subtitle ? <div style={{ marginTop: 2, fontSize: 14, color: heroMutedTextColor || "#e2e8f0" }}>{subtitle}</div> : null}
      </div>

      <div style={{ textAlign: "right", minWidth: 112, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: heroMutedTextColor || "rgba(255,255,255,0.72)", marginBottom: 2 }}>{welcomeLabel}</div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: heroTextColor || "#f8fafc" }}>{rightTitle || userName || "-"}</div>
        {userEmail ? (
            <div style={{ marginTop: 2, fontSize: 11, color: heroMutedTextColor || "#c7d2fe", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</div>
        ) : null}
      </div>
      </section>
        {(footerInfo || footerBgColor || footerTextColor) ? (
          <div style={{ padding: "8px 14px", background: footerBgColor || "#0f172a99", color: footerTextColor || "#e2e8f0", fontSize: 12, fontWeight: 700 }}>
            {footerInfo || "Footer bilgi alani"}
          </div>
        ) : null}
      </section>
  );
}