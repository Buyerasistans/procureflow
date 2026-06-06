import { useEffect, useMemo, useState } from "react";
import { withPublicApiPrefix } from "../lib/public-api";

type TranslationResponse = {
  namespace: string;
  locale: string;
  values: Record<string, string>;
  source: string;
};

export function usePublicTranslations(namespace: string, locale: string, defaults: Record<string, string>) {
  const [values, setValues] = useState<Record<string, string>>(defaults);

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let cancelled = false;
    async function load() {
      try {
        const url = withPublicApiPrefix(`/api/v1/public/translations/${encodeURIComponent(namespace)}?locale=${encodeURIComponent(locale)}`);
        const res = await fetch(url);
        if (!res.ok) return;
        const payload = (await res.json()) as TranslationResponse;
        if (cancelled) return;
        setValues((current) => ({ ...current, ...(payload.values || {}) }));
      } catch {
        // fallback to defaults
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [namespace, locale]);

  return useMemo(() => values, [values]);
}
