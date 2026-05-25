import { describe, expect, it } from "vitest";
import type { AdminSupplierListItem, Company, Tenant, TenantUser } from "../services/admin.service";
import { buildTenantScopeMap, resolveCompanyScope } from "../utils/scopeResolver";

function makeTenant(overrides: Partial<Tenant> & { id: number; slug: string; legal_name: string }): Tenant {
  return {
    status: "active",
    onboarding_status: "completed",
    is_active: true,
    ...overrides,
  } as Tenant;
}

function makeCompany(overrides: Partial<Company> & { id: number; name: string }): Company {
  return {
    color: "#3b82f6",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Company;
}

function makeSupplier(overrides: Partial<AdminSupplierListItem> & { id: number; company_name: string }): AdminSupplierListItem {
  return { is_active: true, ...overrides };
}

// ─── Bug 1: Supplier override erasing partner scope ───────────────────────────
// A partner tenant that has invited suppliers to its RFQs was being
// reclassified as "supplier" because buildTenantScopeMap iterated the
// suppliers list and called map.set(tenant_id, "supplier").
describe("buildTenantScopeMap — supplier override bug (Bug 1)", () => {
  const yorpas = makeTenant({ id: 2, slug: "pi-zza-max", legal_name: "YÖRPAŞ A.Ş." });
  const olimpos = makeTenant({ id: 14, slug: "oli-mpos-teknoloji", legal_name: "OLİMPOS TEKNOLOJİ A.Ş.", category: "Danismanlik" });

  const suppliersForYorpas: AdminSupplierListItem[] = [
    makeSupplier({ id: 1, company_name: "Tedarikci 1", tenant_id: 2 }),
    makeSupplier({ id: 2, company_name: "Tedarikci 2", tenant_id: 2 }),
    makeSupplier({ id: 3, company_name: "Tedarikci 3", tenant_id: 14 }),
  ];

  it("partner tenant with linked suppliers stays partner", () => {
    const map = buildTenantScopeMap([yorpas, olimpos], [], suppliersForYorpas);
    expect(map.get(2)).toBe("partner");
    expect(map.get(14)).toBe("partner");
  });

  it("partner companies resolve to partner segment", () => {
    const map = buildTenantScopeMap([yorpas, olimpos], [], suppliersForYorpas);
    const yorpasAna = makeCompany({ id: 1, name: "YÖRPAŞ AŞ.", tenant_id: 2, is_primary: true });
    const yorpasAlt = makeCompany({ id: 5, name: "PIZZA MAX", tenant_id: 2, is_primary: false });
    const olimposAna = makeCompany({ id: 8, name: "OLİMPOS TEKNOLOJİ", tenant_id: 14, is_primary: true });
    expect(resolveCompanyScope(yorpasAna, map)).toBe("partner");
    expect(resolveCompanyScope(yorpasAlt, map)).toBe("partner");
    expect(resolveCompanyScope(olimposAna, map)).toBe("partner");
  });
});

// ─── Bug 2: PLATFORM token priority over PARTNER in blob section ───────────────
// Tenant "Buyera Asistans Demo Stratejik Ortak A.S." had "buyera asistans"
// (PLATFORM_TOKEN) matched before "stratejik" (PARTNER_TOKEN) in the blob
// section of inferTenantScope, routing the tenant to "portal" instead of "partner".
describe("inferTenantScope via buildTenantScopeMap — platform-before-partner bug (Bug 2)", () => {
  const demoOrtak = makeTenant({
    id: 17,
    slug: "demo-stratejik-ortak",
    legal_name: "Buyera Asistans Demo Stratejik Ortak A.S.",
  });

  it("tenant with 'stratejik' in slug/name resolves to partner, not portal", () => {
    const map = buildTenantScopeMap([demoOrtak]);
    expect(map.get(17)).toBe("partner");
  });

  it("companies under demo-stratejik-ortak tenant resolve to partner", () => {
    const map = buildTenantScopeMap([demoOrtak]);
    const merkez = makeCompany({ id: 12, name: "BA Demo Merkez", tenant_id: 17, is_primary: true });
    const ofis = makeCompany({ id: 13, name: "BA Demo Proje Ofisi", tenant_id: 17 });
    expect(resolveCompanyScope(merkez, map)).toBe("partner");
    expect(resolveCompanyScope(ofis, map)).toBe("partner");
  });
});

// ─── Channel tenants still resolve correctly after fix ─────────────────────────
describe("channel tenant scope — regression", () => {
  const kanalTenant = makeTenant({
    id: 18,
    slug: "kanal-ana-yonetici-demo-kisisel-is-ortagi-workspace",
    legal_name: "Kanal Ana Yönetici Demo İs Ortagi Workspace",
    category: "Bireysel Is Ortagi",
  });

  it("channel tenant resolves to channel", () => {
    const map = buildTenantScopeMap([kanalTenant]);
    expect(map.get(18)).toBe("channel");
  });

  it("channel company resolves to channel", () => {
    const map = buildTenantScopeMap([kanalTenant]);
    const kanalCo = makeCompany({ id: 14, name: "Kanal Ana Yönetici Demo Workspace", tenant_id: 18 });
    expect(resolveCompanyScope(kanalCo, map)).toBe("channel");
  });
});

// ─── Platform company with no tenant_id still resolves to portal ───────────────
describe("platform company scope — regression", () => {
  it("company named 'BUYER ASISTANS PLATFORM' with no tenant_id is portal", () => {
    const map = buildTenantScopeMap([]);
    const platformCo = makeCompany({ id: 11, name: "BUYER ASISTANS PLATFORM", tenant_id: undefined });
    expect(resolveCompanyScope(platformCo, map)).toBe("portal");
  });
});
