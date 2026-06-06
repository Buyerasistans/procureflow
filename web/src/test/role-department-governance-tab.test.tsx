import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AuthUser } from "../context/auth-types";
import { RoleDepartmentGovernanceTab } from "../components/admin/RoleDepartmentGovernanceTab";
import { createRole, getCatalogMergePreview, getCompanies, getDepartments, getPermissions, getRoles, getTenantUsers, updateRole, type Company, type Department, type Permission, type Role, type Tenant } from "../services/admin.service";

vi.mock("../services/admin.service", async () => {
  const actual = await vi.importActual<typeof import("../services/admin.service")>("../services/admin.service");
  return {
    ...actual,
    getRoles: vi.fn(),
    getCompanies: vi.fn(),
    getTenantUsers: vi.fn(),
    getDepartments: vi.fn(),
    getPermissions: vi.fn(),
    getCatalogMergePreview: vi.fn(),
    createRole: vi.fn(),
    createDepartment: vi.fn(),
    updateRole: vi.fn(),
    updateDepartment: vi.fn(),
    deleteRole: vi.fn(),
    deleteDepartment: vi.fn(),
    applyCatalogMerge: vi.fn(),
    rollbackCatalogMerge: vi.fn(),
  };
});

const tenants: Tenant[] = [
  {
    id: 11,
    slug: "procureflow-tenant",
    legal_name: "ProcureFlow Tenant",
    brand_name: "ProcureFlow",
    category: "strategic_partner",
    category_tags: ["partner"],
    city: "Istanbul",
    subscription_plan_code: "growth",
    status: "active",
    onboarding_status: "active",
    onboarding_payment_status: "verified",
    onboarding_approval_status: "approved",
    support_status: "active",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
  {
    id: 21,
    slug: "supplier-hub",
    legal_name: "Supplier Tenant",
    brand_name: "Supplier Hub",
    category: "supplier",
    category_tags: ["supplier"],
    city: "Ankara",
    subscription_plan_code: "starter",
    status: "active",
    onboarding_status: "active",
    onboarding_payment_status: "verified",
    onboarding_approval_status: "approved",
    support_status: "active",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
  {
    id: 31,
    slug: "channel-alliance",
    legal_name: "Channel Alliance",
    brand_name: "Alliance",
    category: "channel",
    category_tags: ["channel"],
    city: "Izmir",
    subscription_plan_code: "starter",
    status: "active",
    onboarding_status: "active",
    onboarding_payment_status: "verified",
    onboarding_approval_status: "approved",
    support_status: "active",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
];

const partnerRoles: Role[] = [
  { id: 1, name: "Partner Ana Yonetici", hierarchy_level: 1, parent_id: null, is_active: true, tenant_id: 11, permissions: [] },
  { id: 2, name: "Satin Alma Muduru", hierarchy_level: 4, parent_id: 1, is_active: true, tenant_id: 11, permissions: [] },
  { id: 3, name: "Satin Alma Uzmani", hierarchy_level: 8, parent_id: 2, is_active: true, tenant_id: 11, permissions: [] },
];

const partnerDepartments: Department[] = [
  {
    id: 10,
    name: "Satin Alma Operasyonlari",
    tenant_id: 11,
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
    sub_items: [
      { id: 101, name: "Endirek Satin Alma" },
      { id: 102, name: "Teknik Satin Alma" },
    ],
  },
];

const companies: Company[] = [
  {
    id: 501,
    tenant_id: 11,
    name: "ProcureFlow Demo Tenant Ltd",
    short_name: "PFT",
    color: "#0f172a",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
  {
    id: 601,
    tenant_id: 21,
    name: "Supplier Company",
    color: "#0f172a",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
  {
    id: 701,
    tenant_id: 31,
    name: "Channel Company",
    color: "#0f172a",
    is_active: true,
    created_at: "2026-04-23T08:00:00Z",
    updated_at: "2026-04-23T08:00:00Z",
  },
];

const permissions: Permission[] = [
  { id: 7, name: "roles.manage", description: "Rol Yonetimi", tooltip: "Rol ekleme ve duzenleme" } as Permission,
  { id: 8, name: "departments.view", description: "Departman Goruntuleme", tooltip: "Departman detaylarini gorur" } as Permission,
];

beforeEach(() => {
  vi.mocked(getRoles).mockResolvedValue(partnerRoles);
  vi.mocked(getCompanies).mockResolvedValue(companies);
  vi.mocked(getTenantUsers).mockResolvedValue([]);
  vi.mocked(getDepartments).mockResolvedValue(partnerDepartments);
  vi.mocked(getPermissions).mockResolvedValue(permissions);
  vi.mocked(createRole).mockResolvedValue({
    id: 77,
    name: "Kategori Lideri",
    description: "",
    hierarchy_level: 2,
    parent_id: 1,
    is_active: true,
    tenant_id: 11,
    permissions: [{ id: 7, name: "roles.manage", description: "Rol Yonetimi" } as any],
  });
  vi.mocked(getCatalogMergePreview).mockResolvedValue({ entity_type: "role", groups: [], tenant_id: 11 });
  vi.mocked(updateRole).mockResolvedValue({
    ...partnerRoles[1],
    name: "Satin Alma Muduru",
    permissions: [{ id: 7, name: "roles.manage", description: "Rol Yonetimi" } as any],
  });
});

describe("RoleDepartmentGovernanceTab", () => {
  it("partner kullanicisini kendi scope ve firmasina sinirlar", async () => {
    const user: AuthUser = {
      id: 900,
      email: "partner-admin@test.com",
      role: "admin",
      system_role: "tenant_admin",
      scope_type: "partner",
      organization_name: "ProcureFlow Tenant",
    };

    render(
      <RoleDepartmentGovernanceTab
        tenants={tenants}
        canManage
        isSuperAdmin={false}
        currentUser={user}
      />,
    );

    expect(screen.getByRole("button", { name: /stratejik partner rolleri/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /super admin ve panel personelleri/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tedarikçi Rolleri/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /İş Ortağı Rolleri/ })).not.toBeInTheDocument();

    const companySelector = await screen.findByRole("combobox");
    expect(companySelector).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /procureflow demo tenant ltd/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /supplier company/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier tenant/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getRoles).toHaveBeenCalledWith({ tenantId: 11, includeDuplicates: false });
      expect(getDepartments).toHaveBeenCalledWith({ tenantId: 11, includeDuplicates: false });
    });
  });

  it("rol hiyerarsisi ve departman alt acilimlarini detayli gosterir", async () => {
    const user: AuthUser = {
      id: 901,
      email: "super-admin@test.com",
      role: "super_admin",
      system_role: "super_admin",
      scope_type: "platform",
    };

    vi.mocked(getCatalogMergePreview)
      .mockResolvedValueOnce({ entity_type: "role", groups: [], tenant_id: undefined })
      .mockResolvedValueOnce({ entity_type: "department", groups: [], tenant_id: undefined });

    render(
      <RoleDepartmentGovernanceTab
        tenants={tenants}
        canManage
        isSuperAdmin
        currentUser={user}
      />,
    );

    expect(await screen.findByText(/üst rol: partner ana yonetici/i)).toBeInTheDocument();
    // id/üst/alt rol info is split across elements - check individually
    expect(screen.getByText(/Kök/)).toBeInTheDocument();
    expect(screen.getByText(/endirek satin alma/i)).toBeInTheDocument();
    expect(screen.getByText(/teknik satin alma/i)).toBeInTheDocument();
  });

  it("rol ekleme ve duzenleme icin modal acar ve yetki secimiyle kaydeder", async () => {
    const user = userEvent.setup();
    const currentUser: AuthUser = {
      id: 902,
      email: "super-admin@test.com",
      role: "super_admin",
      system_role: "super_admin",
      scope_type: "platform",
    };

    vi.mocked(getCatalogMergePreview)
      .mockResolvedValueOnce({ entity_type: "role", groups: [], tenant_id: undefined })
      .mockResolvedValueOnce({ entity_type: "department", groups: [], tenant_id: undefined });

    render(
      <RoleDepartmentGovernanceTab
        tenants={tenants}
        canManage
        isSuperAdmin
        currentUser={currentUser}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /yeni rol ekle/i }));
    expect(await screen.findByText(/rol editoru/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/rol adi/i), "Kategori Lideri");
    await user.selectOptions(screen.getByLabelText(/hiyerarsi konumu/i), "1");
    await user.click(screen.getByLabelText(/rol yonetimi/i));
    await user.click(screen.getByRole("button", { name: /Rolü Kaydet/ }));

    await waitFor(() => {
      expect(getPermissions).toHaveBeenCalled();
      expect(createRole).toHaveBeenCalledWith(expect.objectContaining({
        name: "Kategori Lideri",
        parent_id: 1,
        permission_ids: [7],
      }));
    });
  });

  it("super adminde scope degistiginde firma dropdown sadece o scope firmalarini listeler", async () => {
    const user = userEvent.setup();
    const currentUser: AuthUser = {
      id: 903,
      email: "super-admin@test.com",
      role: "super_admin",
      system_role: "super_admin",
      scope_type: "platform",
    };

    vi.mocked(getCatalogMergePreview)
      .mockResolvedValueOnce({ entity_type: "role", groups: [], tenant_id: undefined })
      .mockResolvedValueOnce({ entity_type: "department", groups: [], tenant_id: undefined });

    render(
      <RoleDepartmentGovernanceTab
        tenants={tenants}
        canManage
        isSuperAdmin
        currentUser={currentUser}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Tedarikçi Rolleri/ }));
    const supplierCompanySelect = await screen.findByRole("combobox");
    expect(screen.getByRole("option", { name: /supplier company/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /channel company/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /procureflow demo tenant ltd/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /İş Ortağı Rolleri/ }));
    expect(supplierCompanySelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /channel company/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /supplier company/i })).not.toBeInTheDocument();
  });
});
