import { useEffect } from "react";
import { useLocale } from "../context/LocaleContext";
import type { SupportedLocale } from "../lib/locale";
import "./AutoTranslateManager.css";

type GoogleTranslateApi = {
  translate?: {
    TranslateElement: new (
      options: {
        pageLanguage: string;
        autoDisplay: boolean;
        includedLanguages: string;
      },
      containerId: string,
    ) => void;
  };
};

declare global {
  interface Window {
    google?: GoogleTranslateApi;
    googleTranslateElementInit?: () => void;
  }
}

const GOOGLE_LANG_BY_LOCALE: Record<SupportedLocale, string> = {
  tr: "tr",
  en: "en",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  pl: "pl",
  ja: "ja",
  ko: "ko",
  zh: "zh-CN",
  ar: "ar",
  ru: "ru",
};

let scriptLoaded = false;

function ensureScript() {
  if (scriptLoaded) return;
  scriptLoaded = true;
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.head.appendChild(script);
}

function applyLocale(locale: SupportedLocale) {
  const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
  const target = GOOGLE_LANG_BY_LOCALE[locale];
  if (!combo || !target) return false;
  if (combo.value !== target) {
    combo.value = target;
    combo.dispatchEvent(new Event("change"));
  }
  return true;
}

function forceHideTranslateBanner() {
  const frames = Array.from(document.querySelectorAll("iframe.goog-te-banner-frame, .goog-te-banner-frame"));
  for (const frame of frames) {
    const element = frame as HTMLElement;
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("height", "0", "important");
  }
  document.body.style.setProperty("top", "0px", "important");
  document.documentElement.style.setProperty("margin-top", "0px", "important");
}

export default function AutoTranslateManager() {
  const { locale, lockedToTurkish } = useLocale();

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      const container = document.getElementById("google_translate_element");
      if (!container || container.childElementCount > 0) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "tr",
          autoDisplay: false,
          includedLanguages: "en,de,fr,es,it,pt,nl,pl,ja,ko,zh-CN,ar,ru,tr",
        },
        "google_translate_element",
      );
    };
    ensureScript();
  }, []);

  useEffect(() => {
    forceHideTranslateBanner();
    const observer = new MutationObserver(() => {
      forceHideTranslateBanner();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = window.setInterval(forceHideTranslateBanner, 700);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (lockedToTurkish) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      const ok = applyLocale(locale);
      if (ok || count > 40) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [locale, lockedToTurkish]);

  return (
    <>
      <style>{`
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        iframe.goog-te-banner-frame { display: none !important; }
        .skiptranslate iframe { display: none !important; }
        .goog-te-balloon-frame { display: none !important; }
        body { top: 0 !important; }
        html { margin-top: 0 !important; }
      `}</style>
      <div id="google_translate_element" className="auto-translate-manager__container" aria-hidden />
    </>
  );
}
