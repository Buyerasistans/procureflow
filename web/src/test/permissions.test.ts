import { describe, expect, it } from "vitest";

import {
  canAccessProcurementSettings,
  canAccessWorkspacePanel,
  canManageQuoteWorkspace,
  canAssignPrivilegedBusinessRole,
  filterVisibleRoleHierarchy,
  getRoleIcon,
  getWorkspacePanelNavLabel,
  getWorkspaceLabelFallback,
  hasAdminWorkspaceHome,
  isPlatformStaffUser,
  normalizeRoleKey,
  resolveApprovalBusinessRole,
  resolveApprovalRoleLabel,
  resolveDefaultPersonnelSystemRole,
} from "../auth/permissions";

describe("permission helpers", () => {
  it("sadece super admin kullanicinin privileged business role atamasina izin verir", () => {
    expect(
      canAssignPrivilegedBusinessRole({ role: "super_admin", system_role: "super_admin" }),
    ).toBe(true);
    expect(
      canAssignPrivilegedBusinessRole({ role: "admin", system_role: "tenant_admin" }),
    ).toBe(false);
  });

  it("personel system role varsayimini business role ile uyumlu cozer", () => {
    expect(resolveDefaultPersonnelSystemRole("super_admin", "tenant_admin")).toBe("super_admin");
    expect(resolveDefaultPersonnelSystemRole("admin", "platform_support")).toBe("platform_support");
    expect(resolveDefaultPersonnelSystemRole("admin", "super_admin")).toBe("tenant_admin");
    expect(resolveDefaultPersonnelSystemRole("satinalmaci", "tenant_admin")).toBe("");
  });

  it("rol ikonlarini ortak helper uzerinden cozer", () => {
    expect(getRoleIcon("super_admin")).toBe("🛡️");
    expect(getRoleIcon("satinalma_direktoru")).toBe("🧭");
    expect(getRoleIcon("bilinmeyen_rol")).toBe("👤");
  });

  it("rol anahtarini ve gorunur rol hiyerarsisini ortak helper uzerinden cozer", () => {
    const roles = [
      { name: "Super Admin", hierarchy_level: 0 },
      { name: "Admin", hierarchy_level: 1 },
      { name: "Satın Alma Yöneticisi", hierarchy_level: 3 },
      { name: "Satın Alma Uzmanı", hierarchy_level: 4 },
    ];

    expect(normalizeRoleKey("Satın Alma Yöneticisi")).toBe("satin_alma_yoneticisi");
    expect(filterVisibleRoleHierarchy(roles, "satinalma_yoneticisi").map((role) => role.name)).toEqual([
      "Satın Alma Yöneticisi",
      "Satın Alma Uzmanı",
    ]);
    expect(filterVisibleRoleHierarchy(roles, "super_admin")).toEqual(roles);
  });

  it("workspace fallback etiketini system_role semantigine gore ayirir", () => {
    expect(getWorkspaceLabelFallback({ role: "super_admin", system_role: "super_admin" })).toBe("Ana Yonetim");
    expect(getWorkspaceLabelFallback({ role: "admin", system_role: "tenant_owner" })).toBe("Owner Yonetim Alani");
    expect(getWorkspaceLabelFallback({ role: "admin", system_role: "tenant_admin" })).toBe("Yonetim Alani");
    expect(getWorkspaceLabelFallback({ role: "user", system_role: "tenant_member" })).toBe("Personel Girisi");
  });

  it("platform staff helperi super admin ile karistirilmaz", () => {
    expect(isPlatformStaffUser({ role: "super_admin", system_role: "super_admin" })).toBe(false);
    expect(isPlatformStaffUser({ role: "user", system_role: "platform_support" })).toBe(true);
    expect(hasAdminWorkspaceHome({ role: "super_admin", system_role: "super_admin" })).toBe(true);
  });

  it("workspace panel erisimini rol bazli olarak cozer", () => {
    expect(canAccessWorkspacePanel({ role: "manager", system_role: "tenant_member" })).toBe(true);
    expect(canAccessWorkspacePanel({ role: "supplier_user", system_role: "supplier_user" })).toBe(true);
    expect(canAccessWorkspacePanel({ role: "user", system_role: "tenant_member" })).toBe(false);
  });

  it("procurement settings erisimini kisitli ve tam yetkilerle cozer", () => {
    expect(canAccessProcurementSettings({ role: "satinalma_yoneticisi", system_role: "tenant_member" })).toBe(true);
    expect(canAccessProcurementSettings({ role: "admin", system_role: "tenant_admin" })).toBe(true);
    expect(canAccessProcurementSettings({ role: "user", system_role: "tenant_member" })).toBe(false);
  });

  it("workspace panel nav etiketini role gore ayirir", () => {
    expect(getWorkspacePanelNavLabel({ role: "super_admin", system_role: "super_admin" })).toBe("Super Admin");
    expect(getWorkspacePanelNavLabel({ role: "admin", system_role: "tenant_owner" })).toBe("Ortak Admin");
    expect(getWorkspacePanelNavLabel({ role: "manager", system_role: "tenant_member" })).toBe("Yonetici Paneli");
    expect(getWorkspacePanelNavLabel({ role: "channel_agent", system_role: "tenant_member" })).toBe("Kanal Temsilcisi");
  });

  it("quote manage helperi platform staff icin salt okunur kalir", () => {
    expect(canManageQuoteWorkspace({ role: "user", system_role: "platform_support" })).toBe(false);
    expect(canManageQuoteWorkspace({ role: "admin", system_role: "tenant_admin" })).toBe(true);
    expect(canManageQuoteWorkspace({ role: "satinalma_uzmani", system_role: "tenant_member" })).toBe(true);
  });

  it("approval resolverlari canonical alani tek kaynak olarak kullanir", () => {
    expect(resolveApprovalBusinessRole({
      required_business_role: "satinalma_direktoru",
    })).toBe("satinalma_direktoru");

    expect(resolveApprovalBusinessRole({
      required_business_role: "satinalma_uzmani",
    })).toBe("satinalma_uzmani");

    expect(resolveApprovalRoleLabel({
      required_business_role_label: "Satın Alma Direktörü",
    })).toBe("Satın Alma Direktörü");

    expect(resolveApprovalRoleLabel({
      required_business_role_label: "Satın Alma Yöneticisi",
    })).toBe("Satın Alma Yöneticisi");

    expect(resolveApprovalRoleLabel({
      required_business_role: "satinalma_uzmani",
    })).toBe("satinalma_uzmani");
  });
});