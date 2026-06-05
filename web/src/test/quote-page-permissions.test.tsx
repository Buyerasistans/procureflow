import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import QuoteCreatePage from "../pages/QuoteCreatePage";
import QuoteDetailPage from "../pages/QuoteDetailPage";
import QuoteList from "../components/QuoteList";
import QuoteComparisonReportPage from "../pages/QuoteComparisonReportPage";

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();
const mockGetQuotes = vi.fn();
const mockHttpGet = vi.fn();
const mockGetProjects = vi.fn();
const mockGetDepartments = vi.fn();
const mockGetTenantUsers = vi.fn();
const mockGetUserCompanyAssignments = vi.fn();
const mockGetSettings = vi.fn();
const mockGetQuote = vi.fn();
const mockGetQuoteHistory = vi.fn();
const mockGetQuoteAuditTrail = vi.fn();
const mockGetQuotePendingApprovals = vi.fn();
const mockGetSupplierQuotesGrouped = vi.fn();
const mockGetSupplierQuoteById = vi.fn();
const mockGetQuoteComparisonDetailedReport = vi.fn();
const mockDownloadQuoteComparisonXlsx = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../lib/http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
  },
}));

vi.mock("../services/admin.service", () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  getDepartments: (...args: unknown[]) => mockGetDepartments(...args),
  getTenantUsers: (...args: unknown[]) => mockGetTenantUsers(...args),
  getUserCompanyAssignments: (...args: unknown[]) => mockGetUserCompanyAssignments(...args),
  getWorkspacePanelConfig: vi.fn().mockResolvedValue({ profiles: [] }),
  getCommercialRequests: vi.fn().mockResolvedValue([]),
  getSubscriptionAddons: vi.fn().mockResolvedValue([]),

}));

vi.mock("../services/settings.service", () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
}));

vi.mock("../lib/token", () => ({
  getAccessToken: () => "token",
}));

vi.mock("../services/quote.service", async () => {
  const actual = await vi.importActual<typeof import("../services/quote.service")>("../services/quote.service");
  return {
    ...actual,
    getQuotes: (...args: unknown[]) => mockGetQuotes(...args),
    deleteQuote: vi.fn(),
    createQuote: vi.fn(),
    updateQuoteItems: vi.fn(),
    getQuote: (...args: unknown[]) => mockGetQuote(...args),
    updateQuote: vi.fn(),
    submitQuote: vi.fn(),
    approveQuoteWorkflow: vi.fn(),
    rejectQuoteWorkflow: vi.fn(),
    getQuotePendingApprovals: (...args: unknown[]) => mockGetQuotePendingApprovals(...args),
    getQuoteHistory: (...args: unknown[]) => mockGetQuoteHistory(...args),
    getQuoteAuditTrail: (...args: unknown[]) => mockGetQuoteAuditTrail(...args),
    getSupplierQuotesGrouped: (...args: unknown[]) => mockGetSupplierQuotesGrouped(...args),
    getSupplierQuoteById: (...args: unknown[]) => mockGetSupplierQuoteById(...args),
    getQuoteComparisonDetailedReport: (...args: unknown[]) => mockGetQuoteComparisonDetailedReport(...args),
    getRfqComparisonDetailedReport: (...args: unknown[]) => mockGetQuoteComparisonDetailedReport(...args),
    requestQuoteRevision: vi.fn(),
    submitRevisionedQuote: vi.fn(),
    approveSupplierQuote: vi.fn(),
    downloadQuoteComparisonXlsx: (...args: unknown[]) => mockDownloadQuoteComparisonXlsx(...args),
    getRfqs: (...args: unknown[]) => mockGetQuotes(...args),
    getRfq: (...args: unknown[]) => mockGetQuote(...args),
    createRfq: vi.fn(),
    updateRfqItems: vi.fn(),
    updateRfq: vi.fn(),
    deleteRfq: vi.fn(),
    submitRfq: vi.fn(),
    approveRfqWorkflow: vi.fn(),
    rejectRfqWorkflow: vi.fn(),
    getRfqPendingApprovals: (...args: unknown[]) => mockGetQuotePendingApprovals(...args),
  };
});

vi.mock("../components/SendQuoteModal", () => ({
  default: () => <div>Send Quote Modal Mock</div>,
}));

vi.mock("../components/SupplierQuotesGroupedView", () => ({
  SupplierQuotesGroupedView: () => <div>Tedarikçi Teklifleri Mock</div>,
}));

vi.mock("../components/ReviseRequestModal", () => ({
  ReviseRequestModal: () => null,
}));

vi.mock("../components/ReviseSubmitModal", () => ({
  ReviseSubmitModal: () => null,
}));

function renderQuoteList() {
  return render(
    <MemoryRouter>
      <QuoteList />
    </MemoryRouter>,
  );
}

function renderQuoteCreatePage() {
  return render(
    <MemoryRouter initialEntries={["/quotes/create?projectId=1"]}>
      <Routes>
        <Route path="/quotes/create" element={<QuoteCreatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderQuoteDetailPage(route: string = "/quotes/5") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/quotes/:id" element={<QuoteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderQuoteComparisonReportPage(route: string = "/quotes/5/comparison") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/quotes/:id/comparison" element={<QuoteComparisonReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Quote page permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadQuoteComparisonXlsx.mockResolvedValue(new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    mockGetQuotes.mockResolvedValue({
      items: [
        {
          id: 5,
          project_id: 7,
          created_by_id: 11,
          title: "Readonly Quote",
          company_name: "ACME",
          company_contact_name: "User",
          company_contact_phone: "555",
          company_contact_email: "user@test.com",
          status: "draft",
          amount: 1000,
          total_amount: 1000,
          created_at: "2026-04-15T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      size: 10,
    });
    mockHttpGet.mockResolvedValue({ data: [] });
    mockGetProjects.mockResolvedValue([{ id: 1, name: "Project One", code: "P1" }]);
    mockGetDepartments.mockResolvedValue([{ id: 4, name: "Satin Alma" }]);
    mockGetTenantUsers.mockResolvedValue([{ id: 11, full_name: "Readonly User", role: "user", department_id: 4 }]);
    mockGetUserCompanyAssignments.mockResolvedValue([]);
    mockGetSettings.mockResolvedValue({ vat_rates: [1, 10, 20] });
    mockGetQuote.mockResolvedValue({
      id: 5,
      rfq_id: 5,
      project_id: 7,
      created_by_id: 11,
      title: "Readonly Quote",
      description: "Detay",
      company_name: "ACME",
      company_contact_name: "User",
      company_contact_phone: "555",
      company_contact_email: "user@test.com",
      status: "draft",
      amount: 1000,
      total_amount: 1000,
      currency: "TRY",
      version: 1,
      created_at: "2026-04-15T10:00:00Z",
      items: [],
    });
    mockGetQuoteHistory.mockResolvedValue([]);
    mockGetQuoteAuditTrail.mockResolvedValue(null);
    mockGetQuotePendingApprovals.mockResolvedValue([]);
    mockGetSupplierQuotesGrouped.mockResolvedValue([]);
    mockGetSupplierQuoteById.mockResolvedValue(null);
    mockGetQuoteComparisonDetailedReport.mockResolvedValue({
      quote: { id: 5, rfq_id: 5, title: "Readonly Quote" },
      suppliers: [
        {
          supplier_quote_id: 101,
          supplier_name: "Alpha Tedarik",
          revision_number: 0,
          total_amount: 1000,
          discount_amount: 50,
          final_amount: 950,
          delivery_time: 7,
          status: "yanıtlandı",
          approved: false,
        },
      ],
      items: [
        {
          quote_item_id: 1,
          line_number: "1.1",
          description: "Kalem 1",
          detail: "Detay",
          is_group_header: false,
          unit: "adet",
          quantity: 2,
          base_unit_price: 100,
          supplier_prices: {
            "101": { unit_price: 95, total_price: 190 },
          },
        },
      ],
    });
  });

  it("platform staff icin quote list aksiyonlarini read-only tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteList();

    expect(await screen.findByText(/platform personeli teklif portfoyunu inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByText(/readonly quote/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /goruntule/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /yeni teklif/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gönder/i })).not.toBeInTheDocument();
  });

  it("platform staff icin quote create sayfasini kapatir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteCreatePage();

    expect(screen.getByText("Yeni RFQ / Teklif Talebi")).toBeInTheDocument();
    expect(await screen.findByText(/yeni teklif olusturma akisi bu hesaplar icin kapatildi/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /kaydet/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/baslik/i)).not.toBeInTheDocument();
  });

  it("platform staff icin quote detail yazma aksiyonlarini gizler", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteDetailPage();

    await waitFor(() => expect(screen.getByText(/readonly quote/i)).toBeInTheDocument());
    expect(screen.getByText("RFQ #5 • Teklif ID: 5 • V1")).toBeInTheDocument();
    expect(screen.getByText(/salt okunur modda kapatildi/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /onaya gonder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
  });

  it("tenant admin icin quote list write aksiyonlarini acik tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });

    renderQuoteList();

    expect(await screen.findByRole("button", { name: /yeni teklif/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /goruntule/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /karsilastirma/i })).toBeInTheDocument();
  });

  it("quote create read-only ekraninda geri dugmesi calisir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteCreatePage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /geri/i }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("tenant admin icin quote create ekraninda RFQ gecis metnini gosterir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });

    renderQuoteCreatePage();

    expect(await screen.findByText("Yeni RFQ / Teklif Talebi")).toBeInTheDocument();
    expect(screen.getByText(/rfq adapter gecisi aktif/i)).toBeInTheDocument();
  });

  it("departman secildiginde company assignment uzerinden bagli personeli sorumlu kisi listesinde gosterir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetDepartments.mockResolvedValue([
      { id: 4, name: "Satin Alma" },
      { id: 8, name: "Teknik Ofis" },
    ]);
    mockGetProjects.mockResolvedValue([
      { id: 1, name: "Project One", code: "P1", personnel: [{ id: 21, full_name: "Departman Atamali Kullanici" }] },
    ]);
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 21,
        full_name: "Departman Atamali Kullanici",
        role: "user",
        department_id: null,
        company_assignments: [
          {
            id: 501,
            user_id: 21,
            company_id: 44,
            role_id: 7,
            department_id: 8,
            is_active: true,
          },
        ],
      },
      {
        id: 22,
        full_name: "Baska Departman",
        role: "user",
        department_id: 4,
        company_assignments: [],
      },
    ]);
    mockGetUserCompanyAssignments.mockImplementation(async (userId: number) => {
      if (userId === 21) {
        return [{ id: 501, user_id: 21, company_id: 44, role_id: 7, department_id: 8, is_active: true }];
      }
      return [];
    });

    renderQuoteCreatePage();

    await screen.findByText("Yeni RFQ / Teklif Talebi");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Departman"), "8");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /departman atamali kullanici/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: /baska departman/i })).not.toBeInTheDocument();
  });

  it("tum departmanlar atamasi olan kullaniciyi secili departmanda da sorumlu kisi listesinde gosterir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetDepartments.mockResolvedValue([
      { id: 4, name: "Satin Alma" },
      { id: 8, name: "Teknik Ofis" },
    ]);
    mockGetProjects.mockResolvedValue([
      { id: 1, name: "Project One", code: "P1", personnel: [{ id: 31, full_name: "Tum Departmanlar Kullanici" }] },
    ]);
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 31,
        full_name: "Tum Departmanlar Kullanici",
        role: "admin",
        department_id: null,
        company_assignments: [
          {
            id: 601,
            user_id: 31,
            company_id: 44,
            role_id: 7,
            department_id: null,
            is_active: true,
            sub_items: ["__ALL_DEPARTMENTS__"],
          },
        ],
      },
    ]);
    mockGetUserCompanyAssignments.mockResolvedValue([
      {
        id: 601,
        user_id: 31,
        company_id: 44,
        role_id: 7,
        department_id: null,
        is_active: true,
        sub_items: ["__ALL_DEPARTMENTS__"],
      },
    ]);

    renderQuoteCreatePage();

    await screen.findByText("Yeni RFQ / Teklif Talebi");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Departman"), "8");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /tum departmanlar kullanici/i })).toBeInTheDocument();
    });
  });

  it("departman secildiginde ilk uygun sorumlu kisiyi otomatik secer", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetDepartments.mockResolvedValue([
      { id: 4, name: "Satin Alma" },
      { id: 8, name: "Hammadde Satin Alma" },
    ]);
    mockGetProjects.mockResolvedValue([
      { id: 1, name: "Project One", code: "P1", personnel: [{ id: 31, full_name: "Ilk Uygun Kisi" }] },
    ]);
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 31,
        full_name: "Ilk Uygun Kisi",
        role: "user",
        department_id: null,
        company_assignments: [
          { id: 601, user_id: 31, company_id: 44, role_id: 7, department_id: 8, is_active: true },
        ],
      },
      {
        id: 32,
        full_name: "Diger Kisi",
        role: "user",
        department_id: 4,
        company_assignments: [],
      },
    ]);
    mockGetUserCompanyAssignments.mockImplementation(async (userId: number) => {
      if (userId === 31) {
        return [{ id: 601, user_id: 31, company_id: 44, role_id: 7, department_id: 8, is_active: true }];
      }
      return [];
    });

    renderQuoteCreatePage();

    await screen.findByText("Yeni RFQ / Teklif Talebi");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Departman"), "8");

    await waitFor(() => {
      expect(screen.getByLabelText("Sorumlu Kişi")).toHaveValue("31");
    });
  });

  it("proje olusturan kisi personnel listesinde donmese bile sorumlu kisi olarak secilebilir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });
    mockGetDepartments.mockResolvedValue([
      { id: 8, name: "Hammadde Satin Alma" },
    ]);
    mockGetProjects.mockResolvedValue([
      {
        id: 1,
        name: "Project One",
        code: "P1",
        created_by_id: 41,
        personnel: [{ id: 42, full_name: "Baska Proje Personeli" }],
      },
    ]);
    mockGetTenantUsers.mockResolvedValue([
      {
        id: 41,
        full_name: "Proje Olusturan",
        role: "satinalma_yoneticisi",
        department_id: null,
        company_assignments: [],
      },
      {
        id: 42,
        full_name: "Baska Proje Personeli",
        role: "user",
        department_id: 4,
        company_assignments: [],
      },
    ]);
    mockGetUserCompanyAssignments.mockImplementation(async (userId: number) => {
      if (userId === 41) {
        return [{ id: 701, user_id: 41, company_id: 44, role_id: 3, department_id: 8, is_active: true }];
      }
      return [];
    });

    renderQuoteCreatePage();

    await screen.findByText("Yeni RFQ / Teklif Talebi");
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Departman"), "8");

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /proje olusturan/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Sorumlu Kişi")).toHaveValue("41");
  });

  it("platform staff icin comparison report write aksiyonlarini gizler", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteComparisonReportPage();

    expect(await screen.findByText(/karsilastirma raporu/i)).toBeInTheDocument();
    expect(screen.getByText("Readonly Quote • RFQ #5 • Teklif #5")).toBeInTheDocument();
    expect(screen.getByText(/salt okunur modda kapatildi/i)).toBeInTheDocument();
    expect(screen.queryByText(/işlem/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /iş onayı ver/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("quote detail deep-link ile history ve audit trail bolumlerini odaklar", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 11,
        email: "platform@test.com",
        role: "user",
        system_role: "platform_support",
      },
    });
    mockGetQuoteHistory.mockResolvedValue([
      {
        id: 1,
        quote_id: 5,
        from_status: "Taslak",
        to_status: "Onaya Gönderildi",
        changed_by_name: "Readonly User",
        created_at: "2026-04-15T10:00:00Z",
        approval_details: [],
      },
    ]);
    mockGetQuoteAuditTrail.mockResolvedValue({
      quote_id: 5,
      quote_title: "Readonly Quote",
      current_status: "submitted",
      total_events: 1,
      timeline: [
        {
          type: "STATUS_CHANGE",
          title: "Durum Değişti",
          timestamp: "2026-04-15T10:00:00Z",
        },
      ],
    });

    renderQuoteDetailPage("/quotes/5?insight=status-history");
    expect(await screen.findByText(/deep-link odagi: durum gecisi gecmisi/i)).toBeInTheDocument();

    renderQuoteDetailPage("/quotes/5?insight=full-audit-trail");
    expect(await screen.findByText(/deep-link odagi: tam audit trail/i)).toBeInTheDocument();
  });

  it("quote detail admin odagina geri donus linkini korur", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteDetailPage("/quotes/5?insight=status-history&adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant%20One&projectFocusName=Merkez%20Projesi&quoteFocusId=5&quoteInsight=status-history");

    const link = await screen.findByRole("link", { name: /admin odagina don/i });
    expect(link).toHaveAttribute("href", "/admin?tab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=5");
  });

  it("comparison report admin odagina geri donus linkini korur", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderQuoteComparisonReportPage("/quotes/5/comparison?adminTab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant%20One&projectFocusName=Merkez%20Projesi&quoteFocusId=5");

    const link = await screen.findByRole("link", { name: /admin odagina don/i });
    expect(link).toHaveAttribute("href", "/admin?tab=discovery_lab_operations&tenantFocusId=1&tenantFocusName=Tenant+One&projectFocusName=Merkez+Projesi&quoteFocusId=5");
  });

  it("tenant admin icin comparison report write aksiyonlarini acik tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });

    renderQuoteComparisonReportPage();

    await screen.findAllByText(/alpha tedarik/i);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText(/karşılaştırma raporu/i)).toBeInTheDocument();
  });

  it("comparison export dosya adinda rfq kimligini kullanir", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: "tenant-admin@test.com", role: "admin", system_role: "tenant_admin" },
    });

    const createObjectUrlSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:rfq-export");
    const revokeObjectUrlSpy = vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    let createdDownloadName = "";
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "download", {
          get() {
            return createdDownloadName;
          },
          set(value) {
            createdDownloadName = String(value);
          },
          configurable: true,
        });
      }
      return element;
    }) as typeof document.createElement);

    renderQuoteComparisonReportPage();

    await screen.findByText("Readonly Quote • RFQ #5 • Teklif #5");
    await userEvent.setup().click(screen.getByRole("button", { name: "Excel Olarak İndir" }));

    expect(mockDownloadQuoteComparisonXlsx).toHaveBeenCalledWith(5);
    expect(createdDownloadName).toBe("rfq_5_karsilastirma_raporu.xlsx");

    createElementSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });
});