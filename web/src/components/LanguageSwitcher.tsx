import { useState } from "react";

import { useLocale } from "../context/LocaleContext";
import type { SupportedLocale } from "../lib/locale";

type LanguageSwitcherProps = {
  compact?: boolean;
};

type LanguageOption = {
  code: SupportedLocale;
  label: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "tr", label: "TR Türkçe" },
  { code: "en", label: "GB English" },
  { code: "de", label: "DE Deutsch" },
  { code: "fr", label: "FR Français" },
  { code: "es", label: "ES Español" },
  { code: "it", label: "IT Italiano" },
  { code: "pt", label: "PT Português" },
  { code: "nl", label: "NL Nederlands" },
  { code: "pl", label: "PL Polski" },
  { code: "ja", label: "JP 日本語" },
  { code: "ko", label: "KR 한국어" },
  { code: "zh", label: "CN 中文" },
  { code: "ar", label: "SA العربية" },
  { code: "ru", label: "RU Русский" },
];

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, lockedToTurkish } = useLocale();
  const [open, setOpen] = useState(false);
  const selected = LANGUAGE_OPTIONS.find((option) => option.code === locale) || LANGUAGE_OPTIONS[0];

  if (lockedToTurkish) {
    return (
      <div
        style={{
          display: "inline-flex",
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          color: "#fff",
          padding: compact ? "5px 8px" : "6px 10px",
          fontSize: compact ? 11 : 12,
          fontWeight: 800,
        }}
      >
        TR Türkçe
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="Dil seçimi"
        onClick={() => setOpen((current) => !current)}
        style={{
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          color: "#fff",
          padding: compact ? "5px 8px" : "6px 10px",
          fontSize: compact ? 11 : 12,
          fontWeight: 800,
          cursor: "pointer",
          minWidth: compact ? 80 : 120,
          textAlign: "left",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <img
            src={getFlagUrl(selected.code)}
            alt=""
            width={compact ? 14 : 16}
            height={compact ? 10 : 12}
            style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
          />
          {selected.label}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 300,
            minWidth: compact ? 170 : 210,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid #dbe3ee",
            background: "#fff",
            boxShadow: "0 12px 24px rgba(15, 23, 42, 0.2)",
            padding: 6,
          }}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => {
                setLocale(option.code);
                setOpen(false);
              }}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 8,
                background: locale === option.code ? "#eff6ff" : "#fff",
                color: "#0f172a",
                padding: "7px 9px",
                fontSize: 13,
                fontWeight: locale === option.code ? 800 : 600,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <img
                src={getFlagUrl(option.code)}
                alt=""
                width={16}
                height={12}
                style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getFlagUrl(locale: SupportedLocale): string {
  const localeToCountry: Record<SupportedLocale, string> = {
    tr: "tr",
    en: "gb",
    de: "de",
    fr: "fr",
    es: "es",
    it: "it",
    pt: "pt",
    nl: "nl",
    pl: "pl",
    ja: "jp",
    ko: "kr",
    zh: "cn",
    ar: "sa",
    ru: "ru",
  };
  return `https://flagcdn.com/w20/${localeToCountry[locale]}.png`;
}

