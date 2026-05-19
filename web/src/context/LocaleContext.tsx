import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchGeoLocaleHint, getStoredLocale, isTurkeyPrimaryHost, resolveInitialLocale, setStoredLocale, type SupportedLocale } from "../lib/locale";

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
  lockedToTurkish: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const lockedToTurkish = isTurkeyPrimaryHost(window.location.hostname);
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveInitialLocale(window.location.hostname));
  const effectiveLocale: SupportedLocale = lockedToTurkish ? "tr" : locale;

  useEffect(() => {
    document.documentElement.setAttribute("lang", effectiveLocale);
    document.documentElement.setAttribute("dir", effectiveLocale === "ar" ? "rtl" : "ltr");
    setStoredLocale(effectiveLocale);
  }, [effectiveLocale]);

  useEffect(() => {
    if (getStoredLocale()) return;
    if (lockedToTurkish) return;
    let cancelled = false;
    void fetchGeoLocaleHint().then((hint) => {
      if (cancelled || !hint) return;
      setLocaleState(hint);
    });
    return () => {
      cancelled = true;
    };
  }, [lockedToTurkish]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: effectiveLocale,
      setLocale: (next) => {
        if (lockedToTurkish) {
          return;
        }
        setLocaleState(next);
      },
      lockedToTurkish,
    }),
    [effectiveLocale, lockedToTurkish],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    const fallback = resolveInitialLocale(typeof window !== "undefined" ? window.location.hostname : "");
    return {
      locale: fallback,
      setLocale: () => {
        // no-op fallback for isolated mounts/tests without provider
      },
      lockedToTurkish: false,
    };
  }
  return ctx;
}
