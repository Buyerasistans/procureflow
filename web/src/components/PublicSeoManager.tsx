import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { resolveHostIntent, type PublicIntent } from "../lib/public-intent";

type PublicSeoConfig = {
  title: string;
  description: string;
  intent: PublicIntent;
};

const HOST_BY_INTENT: Record<PublicSeoConfig["intent"], string> = {
  corporate: "https://buyerasistans.com.tr",
  global: "https://buyerasistans.com",
  campaign: "https://buyerasistans.online",
  knowledge: "https://buyerasistans.info",
};

const DEFAULT_SEO: PublicSeoConfig = {
  title: "BUYER ASISTANS",
  description:
    "Stratejik partnerler ve tedarikçiler için RFQ, onay ve tedarik operasyonlarını tek omurgada yönetin.",
  intent: "corporate",
};

const SEO_BY_PATH: Record<string, PublicSeoConfig> = {
  "/": {
    title: "BUYER ASISTANS | Stratejik Partner ve Tedarikçi Platformu",
    description:
      "Stratejik partner, tedarikçi ve satın alma ekipleri için RFQ, onay ve operasyon akışlarını tek platformda birleştirin.",
    intent: "corporate",
  },
  "/cozumler": {
    title: "Çözümler | BUYER ASISTANS",
    description:
      "RFQ, onay, denetim izi ve tenant uyumlu satın alma operasyonları için modüler çözümleri inceleyin.",
    intent: "corporate",
  },
  "/fiyatlandirma": {
    title: "Fiyatlandırma | BUYER ASISTANS",
    description:
      "Stratejik partner ve tedarikçi planlarını, modülleri ve kullanım limitlerini tek ekranda karşılaştırın.",
    intent: "corporate",
  },
  "/demo": {
    title: "Demo Talebi | BUYER ASISTANS",
    description:
      "Platformu stratejik partner veya tedarikçi perspektifinden demo talebiyle inceleyin.",
    intent: "campaign",
  },
  "/stratejik-ortaklik": {
    title: "Stratejik Partnerlik Programı | BUYER ASISTANS",
    description:
      "Stratejik partner onboarding, tenant kurulumu ve satın alma operasyon modelini özetleyen program sayfası.",
    intent: "corporate",
  },
  "/strategic-partner": {
    title: "Strategic Partner Program | BUYER ASISTANS",
    description:
      "Strategic partner onboarding, tenant setup and procurement operations model overview.",
    intent: "global",
  },
  "/tedarikci-ol": {
    title: "Tedarikçi Ol | BUYER ASISTANS",
    description:
      "Tedarikçi onboarding, teklif toplama ve supplier workspace akışlarını inceleyin.",
    intent: "campaign",
  },
  "/become-supplier": {
    title: "Become a Supplier | BUYER ASISTANS",
    description:
      "Review supplier onboarding, quote response and supplier workspace flows.",
    intent: "campaign",
  },
  "/is-ortagi-programi": {
    title: "İş Ortağı Programı | BUYER ASISTANS",
    description:
      "Kanal ve iş ortağı programının operasyon modelini, komisyon ve yönlendirme akışlarını özetler.",
    intent: "global",
  },
  "/partner-program": {
    title: "Partner Program | BUYER ASISTANS",
    description:
      "Channel and partner model including commission and referral flows.",
    intent: "global",
  },
  "/is-ortagi-basvuru": {
    title: "İş Ortağı Başvuru | BUYER ASISTANS",
    description:
      "Kanal ve iş ortağı başvurusunu başlatmak için gerekli temel bilgileri gönderin.",
    intent: "campaign",
  },
  "/onboarding": {
    title: "Onboarding | BUYER ASISTANS",
    description:
      "Tenant tipi, plan seçimi ve ilk kurulum akışlarını yöneten onboarding giriş sayfası.",
    intent: "corporate",
  },
  "/partner-apply": {
    title: "Partner Application | BUYER ASISTANS",
    description:
      "Submit the required information to start your channel partner application.",
    intent: "campaign",
  },
  "/blog": {
    title: "Blog | BUYER ASISTANS Bilgi Merkezi",
    description:
      "Satın alma operasyonları, tedarikçi yönetimi ve platform uygulamalarına dair güncel bilgi merkezi yazıları.",
    intent: "knowledge",
  },
  "/rehber": {
    title: "Rehber | BUYER ASISTANS Bilgi Merkezi",
    description:
      "Onboarding, RFQ, onay ve operasyon standartları için adım adım uygulama rehberleri.",
    intent: "knowledge",
  },
  "/sozluk": {
    title: "Sözlük | BUYER ASISTANS Bilgi Merkezi",
    description:
      "Platform, rol, yetki ve satın alma süreçlerinde kullanılan kavramların ortak tanımları.",
    intent: "knowledge",
  },
};

function ensureMetaTag(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function ensureLinkTag(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let tag = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    if (hreflang) {
      tag.setAttribute("hreflang", hreflang);
    }
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function resolveAltHosts(pathname: string, intent: PublicIntent) {
  return {
    tr: `${HOST_BY_INTENT.corporate}${pathname}`,
    en: `${HOST_BY_INTENT.global}${pathname}`,
    xDefault: `${HOST_BY_INTENT[intent]}${pathname}`,
  };
}

function isPublicRoute(pathname: string) {
  return pathname in SEO_BY_PATH;
}

export default function PublicSeoManager() {
  const location = useLocation();
  const seo = useMemo(() => SEO_BY_PATH[location.pathname] || DEFAULT_SEO, [location.pathname]);

  useEffect(() => {
    if (!isPublicRoute(location.pathname)) {
      return;
    }

    const pathname = location.pathname;
    const hostIntent = resolveHostIntent(window.location.hostname);
    const effectiveIntent = hostIntent || seo.intent;
    const altHosts = resolveAltHosts(pathname, effectiveIntent);
    const canonicalUrl = `${HOST_BY_INTENT[effectiveIntent]}${pathname}`;
    const htmlLang = effectiveIntent === "global" ? "en" : "tr";

    document.title = seo.title;
    document.documentElement.setAttribute("lang", htmlLang);
    document.documentElement.setAttribute("data-domain-intent", effectiveIntent);

    ensureMetaTag("description", seo.description);
    ensureMetaTag("x-domain-intent", effectiveIntent);
    ensureLinkTag("canonical", canonicalUrl);
    ensureLinkTag("alternate", altHosts.tr, "tr-TR");
    ensureLinkTag("alternate", altHosts.en, "en");
    ensureLinkTag("alternate", altHosts.xDefault, "x-default");
  }, [location.pathname, seo]);

  return null;
}
