import { useState } from "react";

import { useLocale } from "../context/LocaleContext";
import type { SupportedLocale } from "../lib/locale";
import "./LanguageSwitcher.css";

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
    return <div className={`language-switcher language-switcher--locked ${compact ? "language-switcher--compact" : ""} language-switcher__locked`}>TR Türkçe</div>;
  }

  return (
    <div className={`language-switcher ${compact ? "language-switcher--compact" : ""}`}>
      <button
        type="button"
        aria-label="Dil seçimi"
        onClick={() => setOpen((current) => !current)}
        className="language-switcher__trigger"
      >
        <span className="language-switcher__trigger-label">
          <img
            src={getFlagUrl(selected.code)}
            alt=""
            className="language-switcher__flag language-switcher__flag--trigger"
          />
          {selected.label}
        </span>
      </button>
      {open && (
        <div className="language-switcher__menu">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => {
                setLocale(option.code);
                setOpen(false);
              }}
              className={`language-switcher__option ${locale === option.code ? "language-switcher__option--selected" : ""}`}
            >
              <img
                src={getFlagUrl(option.code)}
                alt=""
                className="language-switcher__flag language-switcher__flag--option"
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
