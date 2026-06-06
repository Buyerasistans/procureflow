import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompanyCreateModal } from "../components/CompanyCreateModal";
import { DepartmentCreateModal } from "../components/DepartmentCreateModal";
import { RolesTab } from "../components/RolesTab";
import { AuthContext } from "../context/auth-context";

const mockCreateCompany = vi.fn();
const mockUploadCompanyLogo = vi.fn();
const mockCreateDepartment = vi.fn();
const mockUpdateDepartment = vi.fn();
const mockCreateDepartmentCatalogRequest = vi.fn();
const mockGetRoles = vi.fn();
const mockGetPermissions = vi.fn();
const mockCreateRole = vi.fn();
const mockCreateRoleCatalogRequest = vi.fn();

vi.mock("../services/admin.service", () => ({
  createCompany: (...args: unknown[]) => mockCreateCompany(...args),
  uploadCompanyLogo: (...args: unknown[]) => mockUploadCompanyLogo(...args),
  createDepartment: (...args: unknown[]) => mockCreateDepartment(...args),
  updateDepartment: (...args: unknown[]) => mockUpdateDepartment(...args),
  createDepartmentCatalogRequest: (...args: unknown[]) => mockCreateDepartmentCatalogRequest(...args),
  getRoles: (...args: unknown[]) => mockGetRoles(...args),
  getPermissions: (...args: unknown[]) => mockGetPermissions(...args),
  createRole: (...args: unknown[]) => mockCreateRole(...args),
  createRoleCatalogRequest: (...args: unknown[]) => mockCreateRoleCatalogRequest(...args),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  getCommercialRequests: vi.fn().mockResolvedValue([]),
  getSubscriptionAddons: vi.fn().mockResolvedValue([]),

}));

describe("Admin modal workflows", () => {
  function renderWithSuperAdmin(children: React.ReactNode) {
    return render(
      <AuthContext.Provider value={{ user: { id: 1, email: "super@test.com", role: "super_admin", system_role: "super_admin" }, loading: false, login: async () => {}, logout: () => {} }}>
        {children}
      </AuthContext.Provider>,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRoles.mockResolvedValue([
      { id: 1, name: "admin", description: "Admin", is_active: true, hierarchy_level: 0, parent_id: null, permissions: [] },
    ]);
    mockGetPermissions.mockResolvedValue([
      { id: 11, name: "users.view", description: "Kullanicilari gor", tooltip: "Read access" },
    ]);
  });

  it("CompanyCreateModal basarili submitte createCompany cagirir ve success akisini tamamlar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    mockCreateCompany.mockResolvedValue({ id: 55 });

    renderWithSuperAdmin(<CompanyCreateModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/pizza max ltd/i), "Tenant Admin Test Company");
    await user.click(screen.getByRole("button", { name: /firma oluştur/i }));

    await waitFor(() => expect(mockCreateCompany).toHaveBeenCalledWith(expect.objectContaining({
      name: "Tenant Admin Test Company",
      color: "#3b82f6",
      hide_location: false,
      is_active: true,
    })));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("CompanyCreateModal backend hatasini kullaniciya gosterir", async () => {
    const user = userEvent.setup();
    mockCreateCompany.mockRejectedValue(new Error("Bu firma zaten mevcut"));

    renderWithSuperAdmin(<CompanyCreateModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/pizza max ltd/i), "Duplicate Company");
    await user.click(screen.getByRole("button", { name: /firma oluştur/i }));

    expect(await screen.findByText(/bu firma zaten mevcut/i)).toBeInTheDocument();
  });

  it("DepartmentCreateModal alt acilimlarla createDepartment cagirir", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    mockCreateDepartment.mockResolvedValue({ id: 7 });

    render(<DepartmentCreateModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/satın alma/i), "Satın Alma Operasyon");
    await user.type(screen.getByPlaceholderText(/departman hakkında bilgi/i), "Ana operasyon ekibi");
    await user.type(screen.getByPlaceholderText(/alt açılım veya iş\/hizmet adı/i), "RFQ Yönetimi");
    await user.click(screen.getByRole("button", { name: /^ekle$/i }));
    await user.click(screen.getByRole("button", { name: /departman oluştur|kaydet/i }));

    await waitFor(() => expect(mockCreateDepartment).toHaveBeenCalledWith(expect.objectContaining({
      name: "Satın Alma Operasyon",
      description: expect.stringContaining("RFQ Yönetimi [Aktif]"),
    })));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("DepartmentCreateModal hata aldiginda mesaji gosterir", async () => {
    const user = userEvent.setup();
    mockCreateDepartment.mockRejectedValue(new Error("Bu departman zaten mevcut"));

    render(<DepartmentCreateModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/satın alma/i), "Mükerrer Departman");
    await user.click(screen.getByRole("button", { name: /departman oluştur|kaydet/i }));

    expect(await screen.findByText(/bu departman zaten mevcut/i)).toBeInTheDocument();
  });

  it("DepartmentCreateModal talep modunda createDepartmentCatalogRequest cagirir", async () => {
    const user = userEvent.setup();
    mockCreateDepartmentCatalogRequest.mockResolvedValue({ id: 71 });

    render(
      <DepartmentCreateModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onRequestSubmit={mockCreateDepartmentCatalogRequest}
      />,
    );

    await user.type(screen.getByPlaceholderText(/satın alma/i), "Saha Operasyon Departmani");
    await user.type(screen.getByPlaceholderText(/departman hakkında bilgi/i), "Talep bazli acilacak");
    await user.click(screen.getByRole("button", { name: /onaya gönder|onaya gonder/i }));

    await waitFor(() => expect(mockCreateDepartmentCatalogRequest).toHaveBeenCalledWith(expect.objectContaining({
      name: "Saha Operasyon Departmani",
      description: expect.stringContaining("Talep bazli acilacak"),
    })));
  });

  it("RolesTab tenant admin icin yeni rol formunu submit eder", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockCreateRole.mockResolvedValue({ id: 99 });

    render(
      <AuthContext.Provider value={{ user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" }, loading: false, login: async () => {}, logout: () => {} }}>
        <RolesTab />
      </AuthContext.Provider>,
    );

    await screen.findByText(/rol hiyerarşisi/i);
    await user.click(screen.getByRole("button", { name: /yeni rol/i }));
    await user.type(screen.getByPlaceholderText(/rol adı/i), "Tenant Workflow Role");
    await user.type(screen.getByPlaceholderText(/açıklama/i), "Workflow test role");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /^ekle$/i }));

    await waitFor(() => expect(mockCreateRole).toHaveBeenCalledWith({
      name: "Tenant Workflow Role",
      description: "Workflow test role",
      parent_id: undefined,
      permission_ids: [11],
    }));
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("RolesTab backend hatasini alert ile yansitir", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockCreateRole.mockRejectedValue(new Error("Bu rol zaten mevcut"));

    render(
      <AuthContext.Provider value={{ user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" }, loading: false, login: async () => {}, logout: () => {} }}>
        <RolesTab />
      </AuthContext.Provider>,
    );

    await screen.findByText(/rol hiyerarşisi/i);
    await user.click(screen.getByRole("button", { name: /yeni rol/i }));
    await user.type(screen.getByPlaceholderText(/rol adı/i), "Duplicate Role");
    await user.click(screen.getByRole("button", { name: /^ekle$/i }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/rol ekleme hatası/i)));
    alertSpy.mockRestore();
  });

  it("RolesTab talep akisinda createRoleCatalogRequest cagirir", async () => {
    const user = userEvent.setup();
    mockCreateRoleCatalogRequest.mockResolvedValue({ id: 101 });

    render(
      <AuthContext.Provider value={{ user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" }, loading: false, login: async () => {}, logout: () => {} }}>
        <RolesTab onCreateRoleRequest={mockCreateRoleCatalogRequest} />
      </AuthContext.Provider>,
    );

    await screen.findByText(/rol hiyerarşisi/i);
    await user.click(screen.getByRole("button", { name: /yeni rol/i }));
    await user.type(screen.getByPlaceholderText(/rol adı/i), "Onay Bekleyen Rol");
    await user.type(screen.getByPlaceholderText(/açıklama/i), "Talep ile acilacak rol");
    await user.click(screen.getByRole("button", { name: /onaya gonder/i }));

    await waitFor(() => expect(mockCreateRoleCatalogRequest).toHaveBeenCalledWith({
      name: "Onay Bekleyen Rol",
      description: "Talep ile acilacak rol",
    }));
  });
});
