function normalizeBase(raw: string | undefined): string {
  return String(raw || "").trim().replace(/\/+$/, "");
}

export function resolvePublicApiBase(): string {
  if (typeof window === "undefined") return normalizeBase(import.meta.env.VITE_API_URL);
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");
  if (isLocal) {
    return normalizeBase(import.meta.env.VITE_API_URL);
  }
  // Non-primary domains run frontend-only; API backbone is com.tr
  if (!host.endsWith(".com.tr")) {
    return "https://buyerasistans.com.tr";
  }
  return "";
}

export function withPublicApiPrefix(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = resolvePublicApiBase();
  return `${base}${normalizedPath}`;
}
