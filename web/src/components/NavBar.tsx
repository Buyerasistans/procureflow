import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { BRAND_COLORS } from "./nav-brand-colors";
import PublicBrandLogo from "./PublicBrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";
import {
  PUBLIC_TOP_NAV_POLICY_ITEMS,
  PUBLIC_NAV_CONTEXT,
  resolveVisibleNavItems,
} from "../config/navigation-policy";
import "./NavBar.css";

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
  const loginContainerRef = useRef<HTMLDivElement>(null);

  const isTurkish = locale === "tr";
  const defaultCopy = isTurkish
    ? {
      home: "Ana Sayfa",
      offers: "Açık İhaleler",
      suppliers: "Tedarikçi Havuzu",
      strategic: "Stratejik Partnerlerimiz",
      partnerProgram: "Başarılı İş Ortaklarımız",
      signIn: "Sisteme Giriş",
      supplierLogin: "Tedarikçi Girişi",
      partnerLogin: "İş Ortağı Girişi",
      chooseLogin: "Giriş Seçin",
      strategicLogin: "Stratejik Partner Girişi",
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

  const PUBLIC_NAV_LOCALE_MAP: Record<string, { href: string; label: string }> = isTurkish
    ? {
      "top_nav.public.home": { href: "/", label: copy.home },
      "top_nav.public.offers": { href: "/teklifler", label: copy.offers },
      "top_nav.public.suppliers": { href: "/tedarikciler", label: copy.suppliers },
      "top_nav.public.strategic": { href: "/stratejik-ortaklik", label: copy.strategic },
      "top_nav.public.partner_program": { href: "/is-ortagi-programi", label: copy.partnerProgram },
      "top_nav.public.job_listings": { href: "/is-ilanlari", label: "İş İlanları" },
      "top_nav.public.candidates": { href: "/is-arayanlar", label: "Aday Havuzu" },
      "top_nav.public.employer_register": { href: "/employer/register", label: "İşveren Kaydı" },
      "top_nav.public.candidate_register": { href: "/candidate/register", label: "İş Arıyorum" },
    }
    : {
      "top_nav.public.home": { href: "/", label: copy.home },
      "top_nav.public.offers": { href: "/offers", label: copy.offers },
      "top_nav.public.suppliers": { href: "/suppliers", label: copy.suppliers },
      "top_nav.public.strategic": { href: "/strategic-partner", label: copy.strategic },
      "top_nav.public.partner_program": { href: "/partner-program", label: copy.partnerProgram },
      "top_nav.public.job_listings": { href: "/is-ilanlari", label: "Job Listings" },
      "top_nav.public.candidates": { href: "/is-arayanlar", label: "Candidate Pool" },
      "top_nav.public.employer_register": { href: "/employer/register", label: "For Employers" },
      "top_nav.public.candidate_register": { href: "/candidate/register", label: "Find Jobs" },
    };

  const REGISTER_CTA_KEYS = new Set([
    "top_nav.public.employer_register",
    "top_nav.public.candidate_register",
  ]);

  const allVisible = resolveVisibleNavItems(PUBLIC_TOP_NAV_POLICY_ITEMS, PUBLIC_NAV_CONTEXT);

  const links = allVisible
    .filter((item) => !REGISTER_CTA_KEYS.has(item.key))
    .map((item) => PUBLIC_NAV_LOCALE_MAP[item.key])
    .filter((link): link is { href: string; label: string } => link !== undefined);


  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showLoginPopup) return;
    function handleOutsideClick(e: MouseEvent) {
      if (loginContainerRef.current && !loginContainerRef.current.contains(e.target as Node)) {
        setShowLoginPopup(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showLoginPopup]);

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

  const navVars = {
    "--nb-bg": c.bg,
    "--nb-accent": c.accent,
  } as CSSProperties;

  return (
    <nav className="nb-nav" style={navVars}>
      {/* Logo -> Ana Sayfa */}
      <a href="/" className="nb-logo-link">
        <PublicBrandLogo invert height={36} maxWidth={160} />
      </a>

      {/* Navigasyon Linkleri */}
      <div className="nb-links-wrap">
        {links.map((l) => {
          const isActive = activePath === l.href;
          return (
            <a
              key={l.href}
              href={l.href}
              className={`nb-nav-link${isActive ? " nb-nav-link--active" : ""}`}
            >
              {l.label}
            </a>
          );
        })}

        {/* Kariyer CTA */}
        <a href="/satin-alma-kariyerim" className="public-nav-cta public-nav-cta--career">
          <span className="public-nav-cta__line">{isTurkish ? "Satın Alma" : "Procurement"}</span>
          <span className="public-nav-cta__line">{isTurkish ? "Kariyerim" : "Career"}</span>
        </a>

        {/* Sag CTA butonlari */}
        <div ref={loginContainerRef} className="nb-cta-wrap">
          <button
            type="button"
            onClick={handleSystemLoginClick}
            className="nb-cta-btn nb-cta-btn--system"
            style={{ "--nb-cta-bg": BRAND_COLORS.strategic.ctaBg, "--nb-cta-text": BRAND_COLORS.strategic.ctaText } as CSSProperties}
          >
            <span>{isTurkish ? "Sisteme" : "System"}</span>
            <span>{isTurkish ? "Giriş" : "Login"}</span>
          </button>
          <LanguageSwitcher compact />

          {showLoginPopup && (
            <div className="nb-popup">
              <div className="nb-popup__title">{copy.chooseLogin}</div>
              <div className="nb-popup__grid-8">
                <a href="/strategic-partner-login" className="nb-popup-btn nb-popup-btn--strategic">{copy.strategicLogin}</a>
                <a href="/supplier/login" className="nb-popup-btn nb-popup-btn--supplier">{copy.supplierLogin}</a>
                <a href="/channel/login" className="nb-popup-btn nb-popup-btn--channel">{copy.partnerLogin}</a>
              </div>
              <div className="nb-popup__section">
                <div className="nb-popup__section-label">
                  {isTurkish ? "İşveren & Kariyer" : "Employer & Career"}
                </div>
                <div className="nb-popup__grid-6">
                  <a href="/isveren-giris" className="nb-popup-btn nb-popup-btn--employer">
                    {isTurkish ? "İşveren Giriş" : "Employer Login"}
                  </a>
                  <a href="/is-arayan-giris" className="nb-popup-btn nb-popup-btn--jobseeker">
                    {isTurkish ? "İş Arıyorum Giriş" : "Job Seeker Login"}
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginPopup(false)}
                className="nb-popup__close-btn"
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
