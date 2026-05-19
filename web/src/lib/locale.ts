import { withPublicApiPrefix } from "./public-api";

export type SupportedLocale =
  | "tr"
  | "en"
  | "de"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "ja"
  | "ko"
  | "zh"
  | "ar"
  | "ru";

const LOCALE_STORAGE_KEY = "buyerasistans.locale";

export function isTurkeyPrimaryHost(hostname: string): boolean {
  const host = String(hostname || "").toLowerCase().trim();
  return host.endsWith(".com.tr");
}

function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("it")) return "it";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("nl")) return "nl";
  if (raw.startsWith("pl")) return "pl";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("zh")) return "zh";
  return null;
}

export function resolveHostDefaultLocale(hostname: string): SupportedLocale {
  if (isTurkeyPrimaryHost(hostname)) return "tr";
  const host = String(hostname || "").toLowerCase().trim();
  if (host.endsWith(".com")) return "en";
  return "en";
}

export function resolveBrowserLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  const direct = normalizeLocale(window.navigator.language);
  if (direct) return direct;
  const languages = Array.isArray(window.navigator.languages) ? window.navigator.languages : [];
  for (const item of languages) {
    const resolved = normalizeLocale(item);
    if (resolved) return resolved;
  }
  return null;
}

export function getStoredLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setStoredLocale(locale: SupportedLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures
  }
}

export function resolveInitialLocale(hostname: string): SupportedLocale {
  if (isTurkeyPrimaryHost(hostname)) return "tr";
  const stored = getStoredLocale();
  if (stored) return stored;
  const browser = resolveBrowserLocale();
  if (browser) return browser;
  return resolveHostDefaultLocale(hostname);
}

export async function fetchGeoLocaleHint(): Promise<SupportedLocale | null> {
  if (typeof window === "undefined") return null;
  try {
    const url = withPublicApiPrefix("/api/v1/public/locale-hint");
    const response = await window.fetch(url, { method: "GET" });
    if (!response.ok) return null;
    const payload = await response.json() as { locale?: string };
    return normalizeLocale(payload?.locale) as SupportedLocale | null;
  } catch {
    return null;
  }
}
