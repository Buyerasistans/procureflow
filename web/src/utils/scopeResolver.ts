import type { AdminSupplierListItem, Company, Tenant, TenantUser } from "../services/admin.service";

export type EntityScope = "portal" | "partner" | "supplier" | "channel" | "career";

type TenantScopeMap = Map<number, EntityScope>;

const PLATFORM_SYSTEM_ROLES = new Set([
  "super_admin",
  "platform_support",
  "platform_operator",
  "finance_officer",
  "platform_admin",
]);

const SUPPLIER_TOKENS = ["supplier", "tedarik", "vendor", "satici"];
const CHANNEL_TOKENS = ["channel", "kanal", "is ortagi", "partner program", "workspace"];
const PARTNER_TOKENS = ["partner", "stratejik", "strategic"];
const PLATFORM_TOKENS = ["platform", "poseydon", "buyer asistans", "buyera asistans"];
const CAREER_TOKENS = ["kariyer", "career"];

export function normalizeScopeText(value: string): string {
  const repaired = String(value || "")
    .replace(/Ä±|ı|İ/g, "i")
    .replace(/ÅŸ|ş|Ş/g, "s")
    .replace(/ÄŸ|ğ|Ğ/g, "g")
    .replace(/Ã¼|ü|Ü/g, "u")
    .replace(/Ã¶|ö|Ö/g, "o")
    .replace(/Ã§|ç|Ç/g, "c")
    .replace(/Ã¢|â/g, "a")
    .replace(/Ã®|î/g, "i")
    .replace(/Ã»|û/g, "u")
    .replace(/[\u2019']/g, " ")
    .toLowerCase();

  return repaired
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAnyToken(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => haystack.includes(token));
}

function getTenantTokenBlob(tenant: Tenant): string {
  return normalizeScopeText(
    [
      tenant.category || "",
      tenant.slug || "",
      tenant.legal_name || "",
      tenant.brand_name || "",
      ...(tenant.category_tags || []),
      ...(tenant.target_category_tags || []),
    ].join(" "),
  );
}

function inferTenantScope(tenant: Tenant): EntityScope {
  const category = normalizeScopeText(tenant.category || "");
  // career check must be first — "kariyer" must not fall through to "partner"
  if (containsAnyToken(category, CAREER_TOKENS)) return "career";
  if (containsAnyToken(category, SUPPLIER_TOKENS)) return "supplier";
  if (containsAnyToken(category, CHANNEL_TOKENS)) return "channel";
  if (containsAnyToken(category, PLATFORM_TOKENS)) return "portal";
  if (containsAnyToken(category, PARTNER_TOKENS)) return "partner";

  const blob = getTenantTokenBlob(tenant);
  if (containsAnyToken(blob, CAREER_TOKENS)) return "career";
  if (containsAnyToken(blob, SUPPLIER_TOKENS)) return "supplier";
  if (containsAnyToken(blob, CHANNEL_TOKENS)) return "channel";
  // PARTNER before PLATFORM: a slug like "demo-stratejik-ortak" must win over
  // a legal_name prefix like "Buyera Asistans …" that happens to match PLATFORM_TOKENS.
  if (containsAnyToken(blob, PARTNER_TOKENS)) return "partner";
  if (containsAnyToken(blob, PLATFORM_TOKENS)) return "portal";
  return "partner";
}

export function tenantMatchesScope(scope: EntityScope, tenant: Tenant): boolean {
  if (scope === "portal") return false;

  const blob = getTenantTokenBlob(tenant);
  const hasCareerToken = containsAnyToken(blob, CAREER_TOKENS);
  const hasSupplierToken = containsAnyToken(blob, SUPPLIER_TOKENS);
  const hasChannelToken = containsAnyToken(blob, CHANNEL_TOKENS);
  const hasPartnerToken = containsAnyToken(blob, PARTNER_TOKENS);

  if (scope === "career") return hasCareerToken;
  if (scope === "supplier") return hasSupplierToken && !hasCareerToken;
  if (scope === "channel") return hasChannelToken && !hasSupplierToken && !hasCareerToken;
  return hasPartnerToken && !hasSupplierToken && !hasChannelToken && !hasCareerToken;
}

export function buildTenantScopeMap(
  tenants: Tenant[],
  tenantUsers: TenantUser[] = [],
  suppliers: AdminSupplierListItem[] = [],
  companies: Company[] = [],
): TenantScopeMap {
  const map: TenantScopeMap = new Map();

  for (const tenant of tenants) {
    map.set(tenant.id, inferTenantScope(tenant));
  }

  // Intentionally not overriding tenant scope from the suppliers list.
  // Suppliers in the suppliers table are *external parties invited by a tenant*,
  // not the tenant's own identity. A partner tenant that has linked suppliers
  // must stay classified as "partner", not "supplier".

  // Company names provide strong scope hints when tenant catalog is noisy.
  for (const company of companies) {
    if (typeof company.tenant_id !== "number") continue;
    const companyBlob = normalizeScopeText([company.name || "", company.short_name || ""].join(" "));
    if (containsAnyToken(companyBlob, SUPPLIER_TOKENS)) {
      map.set(company.tenant_id, "supplier");
      continue;
    }
    if (containsAnyToken(companyBlob, CHANNEL_TOKENS)) {
      if (map.get(company.tenant_id) !== "supplier") {
        map.set(company.tenant_id, "channel");
      }
      continue;
    }
    if (company.is_platform_primary || containsAnyToken(companyBlob, PLATFORM_TOKENS)) {
      map.set(company.tenant_id, "portal");
    }
  }

  for (const user of tenantUsers) {
    if (typeof user.tenant_id !== "number") continue;
    const roleBucket = normalizeScopeText([user.role || "", user.business_role || "", user.system_role || ""].join(" "));

    if (
      roleBucket.includes("supplier_")
      || roleBucket.includes("supplier")
      || roleBucket.includes("tedarik")
      || roleBucket.includes("vendor")
    ) {
      map.set(user.tenant_id, "supplier");
      continue;
    }

    if (
      roleBucket.includes("channel_")
      || roleBucket.includes("channel")
      || roleBucket.includes("kanal")
      || roleBucket.includes("is ortagi")
    ) {
      if (map.get(user.tenant_id) !== "supplier") {
        map.set(user.tenant_id, "channel");
      }
      continue;
    }

    if (!map.has(user.tenant_id)) {
      map.set(user.tenant_id, "partner");
    }
  }

  return map;
}

export function resolveCompanyScope(company: Company, tenantScopeMap: TenantScopeMap): EntityScope {
  if (company.is_platform_primary) return "portal";
  const byName = normalizeScopeText([company.name || "", company.short_name || ""].join(" "));
  const hasSupplierHint = containsAnyToken(byName, SUPPLIER_TOKENS);
  const hasChannelHint = containsAnyToken(byName, CHANNEL_TOKENS);
  const hasPlatformHint = containsAnyToken(byName, PLATFORM_TOKENS);
  if (company.tenant_id != null) {
    const mapped = tenantScopeMap.get(company.tenant_id);
    if (mapped) {
      // Company-level supplier/channel hints override stale tenant classification.
      if (hasSupplierHint) return "supplier";
      if (hasChannelHint && mapped !== "supplier") return "channel";
      return mapped;
    }
  }
  if (hasSupplierHint) return "supplier";
  if (hasChannelHint) return "channel";
  if (hasPlatformHint) return "portal";
  if (!company.tenant_id) return "portal";
  return "partner";
}

export function resolvePersonnelScope(
  person: TenantUser,
  tenantScopeMap: TenantScopeMap,
  companiesById: Map<number, Company>,
): EntityScope {
  const systemRole = normalizeScopeText(String(person.system_role || ""));
  const businessRole = normalizeScopeText(String(person.business_role || ""));
  const role = normalizeScopeText(String(person.role || ""));
  const scopeType = normalizeScopeText(String((person as TenantUser & { scope_type?: string | null }).scope_type || ""));

  if (scopeType === "supplier") return "supplier";
  if (scopeType === "channel") return "channel";
  if (scopeType === "platform") return "portal";

  if (
    systemRole.startsWith("supplier_")
    || businessRole.startsWith("supplier_")
    || role.startsWith("supplier_")
    || businessRole.includes("tedarik")
    || role.includes("tedarik")
  ) {
    return "supplier";
  }

  if (
    systemRole.startsWith("channel_")
    || businessRole.startsWith("channel_")
    || role.startsWith("channel_")
    || businessRole.includes("kanal")
    || role.includes("kanal")
    || businessRole.includes("is ortagi")
    || role.includes("is ortagi")
  ) {
    return "channel";
  }

  if (PLATFORM_SYSTEM_ROLES.has(systemRole)) return "portal";

  const assignments = person.company_assignments || [];
  for (const assignment of assignments) {
    const company = assignment.company_id
      ? companiesById.get(assignment.company_id)
      : assignment.company
        ? ({
            id: assignment.company.id,
            name: assignment.company.name,
            color: assignment.company.color,
            is_active: true,
            created_at: "",
            updated_at: "",
          } as Company)
        : null;
    if (company) {
      return resolveCompanyScope(company, tenantScopeMap);
    }
  }

  if (typeof person.tenant_id === "number") {
    const mapped = tenantScopeMap.get(person.tenant_id);
    if (mapped) return mapped;

    const roleHint = normalizeScopeText(
      [person.system_role || "", person.business_role || "", person.role || ""].join(" "),
    );
    if (containsAnyToken(roleHint, SUPPLIER_TOKENS)) return "supplier";
    if (containsAnyToken(roleHint, CHANNEL_TOKENS)) return "channel";
    if (containsAnyToken(roleHint, PARTNER_TOKENS)) return "partner";
    return "portal";
  }

  return "portal";
}
