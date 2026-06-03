import type { CSSProperties } from "react";
import PublicBrandLogo from "./PublicBrandLogo";
import "./WorkspaceHeroCard.css";

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
  const cardVars: CSSProperties = {
    "--whc-accent": accentGradient,
    ...(heroTextColor && { "--whc-hero-color": heroTextColor }),
    ...(heroMutedTextColor && { "--whc-muted": heroMutedTextColor }),
    ...(headerBgColor && { "--whc-header-bg": headerBgColor }),
    ...(headerTextColor && { "--whc-header-color": headerTextColor }),
    ...(footerBgColor && { "--whc-footer-bg": footerBgColor }),
    ...(footerTextColor && { "--whc-footer-color": footerTextColor }),
  } as CSSProperties;

  return (
    <section className="whc-card" style={cardVars}>
      {(topNotice || headerInfo || headerBgColor || headerTextColor) ? (
        <div className="whc-header-bar">
          <span>{topNotice || "Ust bilgi alani"}</span>
          <span>{headerInfo || "Header bilgi alani"}</span>
        </div>
      ) : null}
      <section className={`whc-hero${compact ? " whc-hero--compact" : ""}`}>
        <div className="whc-logo-wrap">
          <PublicBrandLogo height={26} maxWidth={145} invert />
        </div>

        <div className="whc-center">
          <div className="whc-eyebrow">{eyebrow}</div>
          <h2 className="whc-title">{title}</h2>
          {subtitle ? <div className="whc-subtitle">{subtitle}</div> : null}
        </div>

        <div className="whc-right">
          <div className="whc-welcome-label">{welcomeLabel}</div>
          <div className="whc-name">{rightTitle || userName || "-"}</div>
          {userEmail ? (
            <div className="whc-email">{userEmail}</div>
          ) : null}
        </div>
      </section>
      {(footerInfo || footerBgColor || footerTextColor) ? (
        <div className="whc-footer-bar">
          {footerInfo || "Footer bilgi alani"}
        </div>
      ) : null}
    </section>
  );
}
