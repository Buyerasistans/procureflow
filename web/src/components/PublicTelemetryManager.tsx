import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { resolveHostIntent } from "../lib/public-intent";
import { withPublicApiPrefix } from "../lib/public-api";

function shouldDisableTelemetry() {
  if (typeof window === "undefined") {
    return true;
  }

  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function normalizeUtmValue(value: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 100);

  return normalized || undefined;
}

const PUBLIC_INTENT_BY_PATH: Record<string, "corporate" | "global" | "campaign" | "knowledge"> = {
  "/": "corporate",
  "/cozumler": "corporate",
  "/fiyatlandirma": "corporate",
  "/demo": "campaign",
  "/stratejik-ortaklik": "corporate",
  "/strategic-partner": "global",
  "/tedarikci-ol": "campaign",
  "/become-supplier": "campaign",
  "/is-ortagi-programi": "global",
  "/partner-program": "global",
  "/is-ortagi-basvuru": "campaign",
  "/partner-apply": "campaign",
  "/onboarding": "corporate",
  "/blog": "knowledge",
  "/rehber": "knowledge",
  "/sozluk": "knowledge",
};

function isPublicPath(pathname: string) {
  return pathname in PUBLIC_INTENT_BY_PATH;
}

function getIntent(pathname: string) {
  const byPath = PUBLIC_INTENT_BY_PATH[pathname];
  if (byPath) return byPath;
  return resolveHostIntent(window.location.hostname);
}

function trackPublicEvent(eventType: string, eventName: string, pathname: string, metadata?: Record<string, string>) {
  if (!isPublicPath(pathname) || shouldDisableTelemetry()) {
    return;
  }

  const url = withPublicApiPrefix("/api/v1/public/telemetry");
  const params = new URLSearchParams(window.location.search);
  const payload = {
    host: window.location.host,
    path: pathname,
    intent: getIntent(pathname),
    event_type: eventType,
    event_name: eventName,
    referrer: document.referrer || undefined,
    query_string: window.location.search || undefined,
    utm_source: normalizeUtmValue(params.get("utm_source")),
    utm_medium: normalizeUtmValue(params.get("utm_medium")),
    utm_campaign: normalizeUtmValue(params.get("utm_campaign")),
    metadata: metadata ?? undefined,
  };

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export default function PublicTelemetryManager() {
  const location = useLocation();

  useEffect(() => {
    if (!isPublicPath(location.pathname) || shouldDisableTelemetry()) {
      return;
    }

    trackPublicEvent("page_view", `page:${location.pathname}`, location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!isPublicPath(location.pathname) || shouldDisableTelemetry()) {
      return;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("a,button") : null;
      if (!target) {
        return;
      }

      const label = (target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
      const href = target instanceof HTMLAnchorElement ? target.getAttribute("href") || "" : "";
      trackPublicEvent("cta_click", label || href || "cta", location.pathname, href ? { href } : undefined);
    }

    function handleSubmit(event: Event) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) {
        return;
      }

      const formName = form.getAttribute("data-telemetry-name") || form.getAttribute("name") || `form:${location.pathname}`;
      trackPublicEvent("form_submit", formName, location.pathname);
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, [location.pathname]);

  return null;
}
