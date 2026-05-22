import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProjectDetailPage from "../pages/ProjectDetailPage";

const mockUseAuth = vi.fn();
const mockGetProjects = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetTenantUsers = vi.fn();
const mockGetProjectFiles = vi.fn();
const mockGetProjectSuppliers = vi.fn();
const mockGetRfqs = vi.fn();
const mockGetSupplierQuotesGrouped = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../services/project.service", () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  getProjectFiles: (...args: unknown[]) => mockGetProjectFiles(...args),
  uploadProjectFile: vi.fn(),
  deleteProjectFile: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  getProjectSuppliers: (...args: unknown[]) => mockGetProjectSuppliers(...args),
  addProjectTenantUser: vi.fn(),
  removeProjectTenantUser: vi.fn(),
}));

vi.mock("../services/admin.service", () => ({
  getCompanies: (...args: unknown[]) => mockGetCompanies(...args),
  getTenantUsers: (...args: unknown[]) => mockGetTenantUsers(...args),
}));

vi.mock("../services/quotes.service", () => ({
  getRfqs: (...args: unknown[]) => mockGetRfqs(...args),
}));

vi.mock("../services/quote.service", () => ({
  getSupplierQuotesGrouped: (...args: unknown[]) => mockGetSupplierQuotesGrouped(...args),
}));

vi.mock("../components/QuoteTab", () => ({
  QuoteTab: ({ readOnly }: { readOnly?: boolean }) => (
    <div>
      <div>Quote Tab Mock</div>
      {!readOnly && (
        <>
          <button type="button">+ Yeni Teklif</button>
          <button type="button">Düzenle</button>
          <button type="button">Gönder</button>
          <button type="button">Sil</button>
        </>
      )}
    </div>
  ),
}));

vi.mock("../components/ProjectSuppliersModal", () => ({
  ProjectSuppliersModal: () => <div>Project Suppliers Modal Mock</div>,
}));

vi.mock("../lib/token", () => ({
  getAccessToken: () => "token",
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/projects/42"]}>
      <Routes>
        <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue([
      {
        id: 42,
        name: "Readonly Project",
        code: "READ-ONLY-42",
        company_id: 7,
        project_type: "franchise",
        manager_name: "Project Owner",
        manager_phone: "05550001122",
        address: "Istanbul",
        is_active: true,
        personnel: [{ id: 11, full_name: "Assigned User" }],
      },
    ]);
    mockGetCompanies.mockResolvedValue([{ id: 7, name: "Readonly Company", color: "#2563eb" }]);
    mockGetTenantUsers.mockResolvedValue([{ id: 11, full_name: "Assigned User", role: "satinalmaci" }]);
    mockGetProjectFiles.mockResolvedValue([
      { id: 1, original_filename: "plan.pdf", file_type: "application/pdf", file_size: 1024 },
    ]);
    mockGetProjectSuppliers.mockResolvedValue([
      { id: 91, supplier_id: 501, supplier_name: "Readonly Supplier", is_active: true },
    ]);
    mockGetRfqs.mockResolvedValue([
      { id: 301, project_id: 42, title: "Approved Franchise Quote", status: "APPROVED", amount: 15000, description: "Approved", created_at: "2026-04-15T10:00:00Z" },
    ]);
    mockGetSupplierQuotesGrouped.mockResolvedValue([
      {
        supplier_id: 501,
        supplier_name: "Readonly Supplier",
        quotes: [
          {
            id: 601,
            revision_number: 1,
            status: "APPROVED",
            currency: "TRY",
            total_amount: 14500,
            initial_final_amount: 15000,
            submitted_at: "2026-04-15T12:00:00Z",
            profitability_amount: null,
            profitability_percent: null,
            revisions: [],
          },
        ],
      },
    ]);
  });

  it("platform staff icin sayfayi read-only tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/readonly company/i)).toBeInTheDocument());
    expect(screen.getByText(/salt okunur/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sil/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/projeye tedarikçi ekle/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dosya yükle/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /yeni teklif/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gönder/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aç/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revize/i })).not.toBeInTheDocument();
  });

  it("tenant admin icin proje sorumlusu listesinde firma assignment uyumlu personeli gosterir", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetTenantUsers.mockResolvedValue([
      { id: 11, full_name: "Assigned User", role: "satinalmaci", company_assignments: [] },
      {
        id: 12,
        full_name: "Firma Uyumlu Kullanici",
        role: "satinalma_yoneticisi",
        department_id: null,
        company_assignments: [
          { id: 701, user_id: 12, company_id: 7, role_id: 3, department_id: 18, is_active: true },
        ],
      },
      {
        id: 13,
        full_name: "Baska Firma Kullanici",
        role: "satinalma_yoneticisi",
        department_id: null,
        company_assignments: [
          { id: 702, user_id: 13, company_id: 99, role_id: 3, department_id: 21, is_active: true },
        ],
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/readonly company/i)).toBeInTheDocument());
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: /firma uyumlu kullanici/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /baska firma kullanici/i })).not.toBeInTheDocument();
  });
});
