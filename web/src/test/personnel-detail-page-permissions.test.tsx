import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PersonnelDetailPage from "../pages/PersonnelDetailPage";

const mockUseAuth = vi.fn();
const mockGetTenantUsers = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../services/admin.service", () => ({
  getTenantUsers: (...args: unknown[]) => mockGetTenantUsers(...args),
  updateTenantUser: vi.fn(),
  getDepartments: vi.fn().mockResolvedValue([]),
  getCompanies: vi.fn().mockResolvedValue([]),
  getRoles: vi.fn().mockResolvedValue([]),
  getUserCompanyAssignments: vi.fn().mockResolvedValue([]),
  addUserCompanyAssignment: vi.fn(),
  updateUserCompanyAssignment: vi.fn(),
  removeUserCompanyAssignment: vi.fn(),
  adminResetPassword: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/personnel/42"]}>
      <Routes>
        <Route path="/personnel/:id" element={<PersonnelDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PersonnelDetailPage permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tenant admin icin tenant member kaydinda duzenleme aksiyonlarini gosterir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 42,
        email: "member@test.com",
        full_name: "Tenant Member",
        role: "satinalmaci",
        system_role: "tenant_member",
        approval_limit: 1000,
        is_active: true,
        company_assignments: [],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/temel bilgiler/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /düzenle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /firma ekle/i })).toBeInTheDocument();
    expect(screen.queryByText(/yalnizca goruntulenebilir/i)).not.toBeInTheDocument();
  });

  it("platform staff icin sayfayi read-only tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "admin", system_role: "platform_support" },
    });
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 42,
        email: "member@test.com",
        full_name: "Tenant Member",
        role: "satinalmaci",
        system_role: "tenant_member",
        approval_limit: 1000,
        is_active: true,
        company_assignments: [],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/temel bilgiler/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /firma ekle/i })).not.toBeInTheDocument();
    expect(screen.getByText(/yalnizca goruntulenebilir/i)).toBeInTheDocument();
  });

  it("tenant admin icin admin-managed hedefi read-only tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 3, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 42,
        email: "owner@test.com",
        full_name: "Tenant Owner",
        role: "admin",
        system_role: "tenant_owner",
        approval_limit: 1000,
        is_active: true,
        company_assignments: [],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/temel bilgiler/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /firma ekle/i })).not.toBeInTheDocument();
    expect(screen.getByText(/yalnizca goruntulenebilir/i)).toBeInTheDocument();
  });
});
