export type PublicIntent = "corporate" | "global" | "campaign" | "knowledge";

const HOST_TO_INTENT: Record<string, PublicIntent> = {
  "buyerasistans.com.tr": "corporate",
  "www.buyerasistans.com.tr": "corporate",
  "buyerasistans.com": "global",
  "www.buyerasistans.com": "global",
  "buyerasistans.online": "campaign",
  "www.buyerasistans.online": "campaign",
  "buyerasistans.info": "knowledge",
  "www.buyerasistans.info": "knowledge",
};

export function resolveHostIntent(hostname: string): PublicIntent {
  const key = (hostname || "").toLowerCase().trim();
  return HOST_TO_INTENT[key] ?? "corporate";
}

export function resolveRootLandingByHost(hostname: string): string {
  const intent = resolveHostIntent(hostname);
  if (intent === "campaign") return "/demo";
  if (intent === "knowledge") return "/blog";
  if (intent === "global") return "/";
  return "/";
}
