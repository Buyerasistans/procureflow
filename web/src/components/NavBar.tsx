import { useEffect, useRef, useState } from "react";
import { BRAND_COLORS } from "./nav-brand-colors";
import PublicBrandLogo from "./PublicBrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";

type NavVariant = "platform" | "strategic" | "supplier" | "channel" | "neutral";

interface NavBarProps {
  variant?: NavVariant;
  activePath?: string;
}

export default function NavBar({ variant = "neutral", activePath = "" }: NavBarProps) {
  const c = BRAND_COLORS[variant];
  const { locale } = useLocale();
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);

  const isTurkish = locale === "tr";
  const defaultCopy = isTurkish
    ? {
      home: "Ana Sayfa",
      offers: "Acik Ihaleler",
      suppliers: "Tedarikci Havuzu",
      strategic: "Stratejik Partnerlerimiz",
      partnerProgram: "Basarili Is Ortaklarimiz",
      signIn: "Sisteme Giris",
      supplierLogin: "Tedarikci Girisi",
      partnerLogin: "Is Ortagi Girisi",
      chooseLogin: "Giris Secin",
      strategicLogin: "Stratejik Partner Girisi",
      close: "Kapat",
    }
    : {
      home: "Home",
      offers: "Open Tenders",
      suppliers: "Supplier Pool",
      strategic: "Strategic Partners",
      partnerProgram: "Top Channel Partners",
      signIn: "Sign In",
      supplierLogin: "Supplier Login",
      partnerLogin: "Partner Login",
      chooseLogin: "Choose Login",
      strategicLogin: "Strategic Partner Login",
      close: "Close",
    };
  const copy = usePublicTranslations("public_core", locale, defaultCopy);

  const links: { href: string; label: string }[] = isTurkish
    ? [
      { href: "/", label: copy.home },
      { href: "/teklifler", label: copy.offers },
      { href: "/tedarikciler", label: copy.suppliers },
      { href: "/stratejik-ortaklik", label: copy.strategic },
      { href: "/is-ortagi-programi", label: copy.partnerProgram },
    ]
    : [
      { href: "/", label: copy.home },
      { href: "/offers", label: copy.offers },
      { href: "/suppliers", label: copy.suppliers },
      { href: "/strategic-partner", label: copy.strategic },
      { href: "/partner-program", label: copy.partnerProgram },
    ];

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  function handleSystemLoginClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    clickCountRef.current += 1;

    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
    }, 600);

    // Gizli platform gecisi: 600ms icinde 3 tik
    if (clickCountRef.current >= 3) {
      window.location.href = "/platform-login";
      return;
    }

    setShowLoginPopup(true);
  }

  return (
    <nav
      style={{
        background: c.bg,
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* Logo -> Ana Sayfa */}
      <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
        <PublicBrandLogo invert height={36} maxWidth={160} />
      </a>

      {/* Navigasyon Linkleri */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap", justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
        {links.map((l) => {
          const isActive = activePath === l.href;
          return (
            <a
              key={l.href}
              href={l.href}
              style={{
                color: isActive ? c.accent ?? "#D4AF37" : "rgba(255,255,255,0.75)",
                textDecoration: "none",
                fontWeight: isActive ? 800 : 600,
                fontSize: 12,
                padding: "6px 8px",
                borderRadius: 6,
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                borderBottom: isActive ? `2px solid ${c.accent ?? "#D4AF37"}` : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {l.label}
            </a>
          );
        })}

        {/* Sag CTA butonlari */}
        <div style={{ marginLeft: 8, display: "flex", gap: 6, position: "relative", flexShrink: 0 }}>
          {variant === "supplier" ? (
            <a href="/supplier/login" style={ctaBtn(BRAND_COLORS.supplier)}>
              {copy.supplierLogin}
            </a>
          ) : variant === "channel" ? (
            <a href="/channel/login" style={ctaBtn(BRAND_COLORS.channel)}>
              {copy.partnerLogin}
            </a>
          ) : (
            <button
              type="button"
              onClick={handleSystemLoginClick}
              style={{
                ...ctaBtn(BRAND_COLORS.strategic),
                border: "none",
                cursor: "pointer",
              }}
            >
              {copy.signIn}
            </button>
          )}
          <LanguageSwitcher compact />

          {showLoginPopup && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: "min(340px, calc(100vw - 24px))",
                background: "#ffffff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                boxShadow: "0 18px 36px rgba(15, 23, 42, 0.2)",
                padding: 12,
                zIndex: 250,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                {copy.chooseLogin}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <a href="/strategic-partner-login" style={popupBtn("#21453d", "#ffffff")}>{copy.strategicLogin}</a>
                <a href="/supplier/login" style={popupBtn("#0284c7", "#ffffff")}>{copy.supplierLogin}</a>
                <a href="/channel/login" style={popupBtn("#f59e0b", "#2f1a0d")}>{copy.partnerLogin}</a>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginPopup(false)}
                style={{
                  width: "100%",
                  marginTop: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  borderRadius: 8,
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {copy.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function ctaBtn(c: { ctaBg: string; ctaText: string }) {
  return {
    background: c.ctaBg,
    color: c.ctaText,
    padding: "7px 14px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 13,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  } as const;
}

function popupBtn(bg: string, color: string) {
  return {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    background: bg,
    color,
    borderRadius: 8,
    textDecoration: "none",
    padding: "10px 12px",
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.25,
    whiteSpace: "normal" as const,
    overflowWrap: "anywhere" as const,
  };
}
