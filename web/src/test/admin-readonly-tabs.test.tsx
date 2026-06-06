import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CompaniesTab } from "../pages/admin/CompaniesTab";
import { DepartmentsTab } from "../pages/admin/DepartmentsTab";
import { RolesTab } from "../components/RolesTab";
import { AuthContext } from "../context/auth-context";

vi.mock("../components/CompanyCreateModal", () => ({
  CompanyCreateModal: () => <div>Company Create Modal Mock</div>,
}));

vi.mock("../components/DepartmentCreateModal", () => ({
  DepartmentCreateModal: () => <div>Department Create Modal Mock</div>,
}));

vi.mock("../services/admin.service", async () => {
  const actual = await vi.importActual<typeof import("../services/admin.service")>("../services/admin.service");
  return {
    ...actual,
    getRoles: vi.fn().mockResolvedValue([
      { id: 1, name: "admin", description: "Admin", is_active: true, hierarchy_level: 1, parent_id: null, permissions: [] },
    ]),
    getPermissions: vi.fn().mockResolvedValue([]),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    deleteDepartment: vi.fn(),
    updateDepartment: vi.fn(),
  };
});

describe("Admin read-only tabs", () => {
  it("CompaniesTab readOnly modda yazma aksiyonlarini kapatir", () => {
    render(
      <MemoryRouter>
        <CompaniesTab
          companies={[{ id: 1, name: "ACME", color: "#000", is_active: true, created_at: "", updated_at: "" }]}
          loadData={vi.fn().mockResolvedValue(undefined)}
          handleDeleteCompany={vi.fn().mockResolvedValue(undefined)}
          readOnly
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /yeni firma/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /detay/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
  });

  it("CompaniesTab tenant admin icin yazma aksiyonlarini acik tutar", () => {
    render(
      <MemoryRouter>
        <CompaniesTab
          companies={[{ id: 1, name: "ACME", color: "#000", is_active: true, created_at: "", updated_at: "" }]}
          loadData={vi.fn().mockResolvedValue(undefined)}
          handleDeleteCompany={vi.fn().mockResolvedValue(undefined)}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /yeni firma/i })).not.toBeDisabled();
    expect(screen.getByLabelText(/duzenle/i)).toBeInTheDocument();
  });

  it("DepartmentsTab readOnly modda yazma aksiyonlarini kapatir", () => {
    render(
      <DepartmentsTab
        departments={[{ id: 1, name: "IT", is_active: true, created_at: "", updated_at: "" }]}
        loadData={vi.fn().mockResolvedValue(undefined)}
        readOnly
      />,
    );

    expect(screen.getByText(/platform personeli departman listesini inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeni departman/i })).toBeDisabled();
    expect(screen.getByTitle(/aktif/i)).toBeDisabled();
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
  });

  it("DepartmentsTab tenant admin icin yazma aksiyonlarini acik tutar", () => {
    render(
      <DepartmentsTab
        departments={[{ id: 1, name: "IT", is_active: true, created_at: "", updated_at: "" }]}
        loadData={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: /yeni departman/i })).not.toBeDisabled();
    expect(screen.getByTitle(/aktif/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /düzenle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sil$/i })).toBeInTheDocument();
  });

  it("RolesTab platform staff icin yazma aksiyonlarini kapatir", async () => {
    render(
      <AuthContext.Provider value={{ user: { id: 1, email: "support@test.com", role: "user", system_role: "platform_support" }, loading: false, login: async () => {}, logout: () => {} }}>
        <RolesTab />
      </AuthContext.Provider>,
    );

    expect(await screen.findByText(/platform personeli rol hiyerarşisini inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeni rol/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
  });

  it("RolesTab tenant admin icin yazma aksiyonlarini acik tutar", async () => {
    render(
      <AuthContext.Provider value={{ user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" }, loading: false, login: async () => {}, logout: () => {} }}>
        <RolesTab />
      </AuthContext.Provider>,
    );

    expect(await screen.findByText(/rol hiyerarşisi/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeni rol/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /düzenle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sil$/i })).toBeInTheDocument();
  });
});