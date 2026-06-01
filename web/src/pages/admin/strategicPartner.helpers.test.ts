// ============================================================================
// strategicPartner.helpers.test.ts  (vitest)
// Hedef konum:  web/src/pages/admin/strategicPartner.helpers.test.ts
// Çalıştırma:   cd web && npm run test   (veya vitest)
// ============================================================================

import { describe, it, expect } from "vitest";
import type { Tenant, Company } from "../../services/admin.service";
import {
  groupCompaniesByTenant,
  deriveOrigin,
  deriveDualRole,
  deriveStatus,
  deriveHealth,
  buildPartnerRows,
  initials,
  type PartnerSupplier,
} from "./strategicPartner.helpers";

// --- Mini fabrikalar (yalnız gerekli alanlar; gerisi cast) ------------------
function tenant(p: Partial<Tenant>): Tenant {
  return {
    id: 1, slug: "t", legal_name: "Test A.Ş.", status: "active",
    onboarding_status: "completed", onboarding_payment_status: "not_required",
    onboarding_approval_status: "not_required", support_status: "new",
    is_active: true, created_at: "", updated_at: "",
    ...p,
  } as Tenant;
}
function company(p: Partial<Company>): Company {
  return {
    id: 1, name: "Firma", color: "#000", is_active: true,
    created_at: "", updated_at: "",
    ...p,
  } as Company;
}
function supplier(p: Partial<PartnerSupplier>): PartnerSupplier {
  return { id: 1, company_name: "Tedarikçi", ...p } as PartnerSupplier;
}

describe("initials", () => {
  it("ilk 3 kelimenin baş harfini büyük döndürür", () => {
    expect(initials("Atlas Yapı A.Ş.")).toBe("AYA");
    expect(initials("EgePet")).toBe("E");
  });
});

describe("groupCompaniesByTenant", () => {
  it("aynı tenant_id'leri gruplar; is_primary ana firma olur", () => {
    const companies = [
      company({ id: 1, name: "Ana", tenant_id: 10, is_primary: true }),
      company({ id: 2, name: "Alt1", tenant_id: 10, is_primary: false }),
      company({ id: 3, name: "Alt2", tenant_id: 10, is_primary: false }),
      company({ id: 4, name: "Başka", tenant_id: 20, is_primary: true }),
    ];
    const m = groupCompaniesByTenant(companies);
    expect(m.get(10)!.primary!.name).toBe("Ana");
    expect(m.get(10)!.subs.map((c) => c.name)).toEqual(["Alt1", "Alt2"]);
    expect(m.get(20)!.subs).toHaveLength(0);
  });

  it("tenant_id null olanları yok sayar", () => {
    const m = groupCompaniesByTenant([company({ id: 1, tenant_id: null })]);
    expect(m.size).toBe(0);
  });

  it("ana firma yoksa primary undefined kalır", () => {
    const m = groupCompaniesByTenant([
      company({ id: 1, tenant_id: 10, is_primary: false }),
    ]);
    expect(m.get(10)!.primary).toBeUndefined();
    expect(m.get(10)!.subs).toHaveLength(1);
  });
});

describe("deriveDualRole / deriveOrigin", () => {
  it("linked_tenant_id eşleşen aktif tedarikçi → dualRole 'active' + origin 'supplier'", () => {
    const sups = [supplier({ linked_tenant_id: 10, dual_role_status: "active" })];
    expect(deriveDualRole(10, sups)).toBe("active");
    expect(deriveOrigin(10, sups).origin).toBe("supplier");
  });

  it("pending çift rol de algılanır", () => {
    const sups = [supplier({ linked_tenant_id: 10, dual_role_status: "pending" })];
    expect(deriveDualRole(10, sups)).toBe("pending");
  });

  it("rejected çift rol rozeti vermez", () => {
    const sups = [supplier({ linked_tenant_id: 10, dual_role_status: "rejected" })];
    expect(deriveDualRole(10, sups)).toBeNull();
  });

  it("kanal bağlantısı → origin 'channel' + kanal adı", () => {
    const res = deriveOrigin(10, [], [{ tenant_id: 10, organization_name: "Vektör" }]);
    expect(res.origin).toBe("channel");
    expect(res.channel).toBe("Vektör");
  });

  it("hiçbir sinyal yoksa origin 'direct'", () => {
    expect(deriveOrigin(10).origin).toBe("direct");
    expect(deriveDualRole(10)).toBeNull();
  });

  it("çift rol, kanaldan önce gelir (öncelik)", () => {
    const sups = [supplier({ linked_tenant_id: 10, dual_role_status: "active" })];
    const res = deriveOrigin(10, sups, [{ tenant_id: 10, organization_name: "X" }]);
    expect(res.origin).toBe("supplier");
  });
});

describe("deriveStatus", () => {
  it("is_active=false → paused", () => {
    expect(deriveStatus(tenant({ is_active: false }))).toBe("paused");
  });
  it("trial", () => {
    expect(deriveStatus(tenant({ status: "trial" }))).toBe("trial");
    expect(deriveStatus(tenant({ status: "active", onboarding_status: "trial" }))).toBe("trial");
  });
  it("active (tamamlanmış onboarding)", () => {
    expect(deriveStatus(tenant({ status: "active", onboarding_status: "completed" }))).toBe("active");
  });
  it("kurulum aşaması → setup", () => {
    expect(deriveStatus(tenant({ status: "active", onboarding_status: "draft" }))).toBe("setup");
  });
  it("dış sinyaller önceliklidir", () => {
    expect(deriveStatus(tenant({}), { pastDue: true })).toBe("past-due");
    expect(deriveStatus(tenant({}), { churnRisk: true })).toBe("churn-risk");
  });
});

describe("deriveHealth", () => {
  it("aktif + açık ticket yok → yüksek", () => {
    expect(deriveHealth("active", 0)).toBe(100);
  });
  it("açık ticket sağlığı düşürür (en çok 4 sayılır)", () => {
    expect(deriveHealth("active", 2)).toBe(88);
    expect(deriveHealth("active", 10)).toBe(76); // 4*6
  });
  it("paused en düşük; alt sınır 4", () => {
    expect(deriveHealth("paused", 4)).toBeGreaterThanOrEqual(4);
  });
});

describe("buildPartnerRows", () => {
  const tenants = [
    tenant({ id: 10, legal_name: "Demir Çelik Holding A.Ş.", brand_name: "Demir Çelik", city: "Karabük", subscription_plan_code: "growth", status: "active", onboarding_status: "completed", owner_email: "o@demir.com" }),
    tenant({ id: 20, legal_name: "Ege Gıda Grup A.Ş.", status: "trial", onboarding_status: "trial" }),
  ];
  const companies = [
    company({ id: 1, name: "Demir Sanayi", tenant_id: 10, is_primary: true, color: "#1d4ed8", personnel_count: 12, trade_name: "Demir Sanayi A.Ş.", city: "Karabük" }),
    company({ id: 2, name: "Demir Döküm", tenant_id: 10, is_primary: false, personnel_count: 5 }),
    company({ id: 3, name: "Ege Üretim", tenant_id: 20, is_primary: true, personnel_count: 3 }),
  ];
  const suppliers: PartnerSupplier[] = [
    supplier({ id: 1, linked_tenant_id: 10, dual_role_status: "active" }),
  ];
  const planByCode = { growth: { name: "Gelişim", monthly_price: 4990 } };

  it("ana→alt hiyerarşi, grup kullanıcı toplamı, plan, köken doğru", () => {
    const rows = buildPartnerRows({ tenants, companies, suppliers, planByCode });
    const demir = rows.find((r) => r.id === 10)!;
    expect(demir.name).toBe("Demir Çelik");          // brand_name tercih
    expect(demir.subs.map((s) => s.name)).toEqual(["Demir Döküm"]);
    expect(demir.users).toBe(17);                     // 12 + 5
    expect(demir.plan).toBe("Gelişim");
    expect(demir.mrr).toBe(4990);
    expect(demir.origin).toBe("supplier");            // çift rol
    expect(demir.dualRole).toBe("active");

    const ege = rows.find((r) => r.id === 20)!;
    expect(ege.status).toBe("trial");
    expect(ege.origin).toBe("direct");
    expect(ege.subs).toHaveLength(0);
  });

  it("eksik/boş veriyle çökmez", () => {
    const rows = buildPartnerRows({ tenants: [tenant({ id: 99 })], companies: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].subs).toEqual([]);
    expect(rows[0].users).toBe(0);
    expect(rows[0].origin).toBe("direct");
    expect(rows[0].plan).toBe("—");
  });
});
