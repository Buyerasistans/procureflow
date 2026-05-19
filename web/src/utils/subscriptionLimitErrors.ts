type LimitKey =
  | "active_companies"
  | "active_internal_users"
  | "active_projects"
  | "active_private_suppliers"
  | "active_quotes"
  | "project_files_total"
  | "project_file_size_mb";

const NEXT_PLAN_BY_CODE: Record<string, string | null> = {
  starter: "Buyume",
  growth: "Kurumsal",
  enterprise: null,
};

const ADDON_NAME_BY_LIMIT: Record<LimitKey, string> = {
  active_companies: "Ek Firma Limiti",
  active_internal_users: "Ek Kullanici Limiti",
  active_projects: "Ek Proje Limiti",
  active_private_suppliers: "Ek Tedarikci Limiti",
  active_quotes: "Ek Teklif Limiti",
  project_files_total: "Ek Dosya Yukleme Limiti",
  project_file_size_mb: "Kurumsal paket dosya boyutu artisi",
};

const ADDON_KEY_BY_NAME: Record<string, string> = {
  "ek firma limiti": "company_slot",
  "ek kullanici limiti": "user_slot",
  "ek proje limiti": "project_slot",
  "ek tedarikci limiti": "supplier_slot",
  "ek teklif limiti": "quote_slot",
  "ek dosya yukleme limiti": "file_slot",
};

export const SUBSCRIPTION_UPGRADE_CTA_HREF = "/admin?tab=panel_home&focus=subscription-upgrade#subscription-upgrade";
export const SUBSCRIPTION_UPGRADE_CTA_LABEL = "Paket Kademelerine Git";
export const SUBSCRIPTION_ADDON_CTA_LABEL = "Ek Hak Kartina Git";

const PLAN_CODE_BY_NAME: Record<string, string> = {
  baslangic: "starter",
  buyume: "growth",
  kurumsal: "enterprise",
};

export function hasSubscriptionUpgradeGuidance(message: string | null | undefined): boolean {
  return String(message || "").includes("Paket yukseltme veya ekstra hak satin alma seceneklerini");
}

export function getSubscriptionUpgradeHref(message: string | null | undefined): string {
  const text = String(message || "");
  const planMatch = text.match(/Onerilen ust paket:\s*([A-Za-zçğıöşüÇĞİÖŞÜ]+)/i);
  const planName = planMatch?.[1]?.trim().toLowerCase();
  const planCode = planName ? PLAN_CODE_BY_NAME[planName] : undefined;
  if (!planCode) return SUBSCRIPTION_UPGRADE_CTA_HREF;
  return `/admin?tab=panel_home&focus=subscription-upgrade&packagePlan=${planCode}#subscription-upgrade`;
}

export function getSubscriptionAddonHref(message: string | null | undefined): string {
  const text = String(message || "");
  const addonMatch = text.match(/Onerilen ek hak:\s*([A-Za-zçğıöşüÇĞİÖŞÜ\s]+)/i);
  const addonName = addonMatch?.[1]?.trim().toLowerCase();
  const addonKey = addonName ? ADDON_KEY_BY_NAME[addonName] : undefined;
  if (!addonKey) return "/admin?tab=panel_home&focus=subscription-addon#subscription-addon";
  return `/admin?tab=panel_home&focus=subscription-addon&addonKey=${addonKey}#subscription-addon`;
}

function buildSuggestionText(planCode: string | undefined, limitKey: LimitKey): string {
  const nextPlanName = planCode ? NEXT_PLAN_BY_CODE[planCode.toLowerCase()] : undefined;
  const addonName = ADDON_NAME_BY_LIMIT[limitKey];
  const planSuggestion = nextPlanName
    ? ` Onerilen ust paket: ${nextPlanName}.`
    : "";
  const addonSuggestion = addonName
    ? ` Onerilen ek hak: ${addonName}.`
    : "";
  return `${planSuggestion}${addonSuggestion}`;
}

export function getSubscriptionLimitGuidanceMessage(input: unknown, fallback: string): string {
  const raw = typeof input === "string"
    ? input
    : input instanceof Error
      ? input.message
      : fallback;

  const message = String(raw || fallback).trim();
  const lower = message.toLowerCase();
  const planMatch = message.match(/Mevcut plan:\s*([\w-]+)/i);
  const limitMatch = message.match(/Limit:\s*(\d+)\s*([A-Za-zçğıöşüÇĞİÖŞÜ]+)/i);
  const planCode = planMatch?.[1]?.trim();
  const planText = planMatch ? ` Mevcut paket: ${planMatch[1]}.` : "";
  const limitText = limitMatch ? ` Tanimli ust sinir: ${limitMatch[1]} ${limitMatch[2]}.` : "";
  const actionText = " Paket yukseltme veya ekstra hak satin alma seceneklerini admin ana sayfasindaki paket alanindan inceleyin.";

  if (lower.includes("aktif firma limiti")) {
    return `Firma limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "active_companies")}${actionText}`;
  }
  if (lower.includes("aktif kullanici limiti")) {
    return `Kullanici limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "active_internal_users")}${actionText}`;
  }
  if (lower.includes("aktif proje limiti")) {
    return `Proje limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "active_projects")}${actionText}`;
  }
  if (lower.includes("aktif tedarikci limiti")) {
    return `Tedarikci limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "active_private_suppliers")}${actionText}`;
  }
  if (lower.includes("teklif limiti")) {
    return `Teklif olusturma limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "active_quotes")}${actionText}`;
  }
  if (lower.includes("proje dosya limiti")) {
    return `Bu proje icin dosya yukleme limitiniz doldu.${planText}${limitText}${buildSuggestionText(planCode, "project_files_total")}${actionText}`;
  }
  if (lower.includes("dosya boyutu plan limitini asiyor")) {
    return `Yuklemeye calistiginiz dosya paketinizin izin verdigi boyutu asiyor.${planText}${limitText}${buildSuggestionText(planCode, "project_file_size_mb")}${actionText}`;
  }

  return message || fallback;
}