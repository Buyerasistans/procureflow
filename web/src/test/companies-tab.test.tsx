import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CompaniesTab } from "../pages/admin/CompaniesTab";
import type { AdminSupplierListItem, Company } from "../services/admin.service";

const { mockDeleteAdminSupplier } = vi.hoisted(() => ({
  mockDeleteAdminSupplier: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/admin.service", async () => {
  const actual = await vi.importActual<typeof import("../services/admin.service")>("../services/admin.service");
  return {
    ...actual,
    updateCompany: vi.fn().mockResolvedValue({}),
    deleteAdminSupplier: mockDeleteAdminSupplier,
  };
});

vi.mock("../components/CompanyCreateModal", () => ({
  CompanyCreateModal: () => <div>Company Create Modal Mock</div>,
}));

const activeCompany: Company = {
  id: 1,
  name: "Aktif Firma A.S.",
  color: "#3b82f6",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const passiveCompany: Company = {
  id: 2,
  name: "Pasif Firma Ltd.",
  color: "#6b7280",
  is_active: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderTab(companies: Company[], opts: { readOnly?: boolean; suppliers?: AdminSupplierListItem[] } = {}) {
  return render(
    <MemoryRouter>
      <CompaniesTab
        companies={companies}
        loadData={vi.fn().mockResolvedValue(undefined)}
        handleDeleteCompany={vi.fn().mockResolvedValue(undefined)}
        readOnly={opts.readOnly}
        suppliers={opts.suppliers}
      />
    </MemoryRouter>,
  );
}

const activeSupplier: AdminSupplierListItem = {
  id: 10,
  company_name: "Aktif Tedarikci AS",
  is_active: true,
  tenant_id: null,
  tenant_name: null,
};

const passiveSupplier: AdminSupplierListItem = {
  id: 11,
  company_name: "Pasif Tedarikci Ltd",
  is_active: false,
  tenant_id: null,
  tenant_name: null,
};

function renderSupplierTab(suppliers: AdminSupplierListItem[], opts: { readOnly?: boolean } = {}) {
  window.sessionStorage.setItem("procureflow.companies.segment", "supplier");
  return render(
    <MemoryRouter>
      <CompaniesTab
        companies={[]}
        loadData={vi.fn().mockResolvedValue(undefined)}
        handleDeleteCompany={vi.fn().mockResolvedValue(undefined)}
        readOnly={opts.readOnly}
        suppliers={suppliers}
      />
    </MemoryRouter>,
  );
}

describe("CompaniesTab firma kart aksiyonlari", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  function expandPortalGroups() {
    screen.getAllByRole("button", { name: /\d+ firma/i }).forEach((btn) => fireEvent.click(btn));
  }

  it("her firma icin Detay butonu render eder", () => {
    renderTab([activeCompany, passiveCompany]);
    expandPortalGroups();
    expect(screen.getAllByRole("button", { name: /detay/i })).toHaveLength(2);
  });

  it("Detay butonuna basinca popup acar", () => {
    renderTab([activeCompany]);
    expandPortalGroups();
    fireEvent.click(screen.getByRole("button", { name: /detay.*aktif firma/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTitle("company-1-modal")).toBeInTheDocument();
  });

  it("Duzenle butonuna basinca popup acar", () => {
    renderTab([activeCompany]);
    expandPortalGroups();
    fireEvent.click(screen.getByRole("button", { name: /duzenle.*aktif firma/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTitle("company-1-modal")).toBeInTheDocument();
  });

  it("readOnly modda Duzenle butonu gosterilmez", () => {
    renderTab([activeCompany], { readOnly: true });
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
  });

  it("aktif firmada durum butonu 'Aktif' gosterir", () => {
    renderTab([activeCompany]);
    expandPortalGroups();
    expect(screen.getByRole("button", { name: /✓ aktif/i })).toBeInTheDocument();
  });

  it("pasif firmada durum butonu 'Pasif' gosterir", () => {
    renderTab([passiveCompany]);
    expandPortalGroups();
    expect(screen.getByRole("button", { name: /✗ pasif/i })).toBeInTheDocument();
  });

  it("aktif firmada Sil butonu disabled", () => {
    renderTab([activeCompany]);
    expandPortalGroups();
    const silBtn = screen.getByRole("button", { name: /sil.*aktif firma/i });
    expect(silBtn).toBeDisabled();
  });

  it("pasif firmada Sil butonu aktif ve tiklanabilir", () => {
    renderTab([passiveCompany]);
    expandPortalGroups();
    const silBtn = screen.getByRole("button", { name: /sil.*pasif firma/i });
    expect(silBtn).not.toBeDisabled();
  });

  it("durum butonuna tiklaninca updateCompany cagirilir", async () => {
    const { updateCompany } = await import("../services/admin.service");
    renderTab([activeCompany]);
    expandPortalGroups();
    fireEvent.click(screen.getByRole("button", { name: /✓ aktif/i }));
    await waitFor(() => {
      expect(updateCompany).toHaveBeenCalledWith(1, { is_active: false });
    });
  });

  it("readOnly modda durum butonu disabled ve Sil butonu gosterilmez", () => {
    renderTab([activeCompany], { readOnly: true });
    expandPortalGroups();
    const durumBtn = screen.getByRole("button", { name: /✓ aktif/i });
    expect(durumBtn).toBeDisabled();
    expect(screen.queryByRole("button", { name: /sil/i })).not.toBeInTheDocument();
  });
});

describe("CompaniesTab tedarikci segment aksiyonlari", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    mockDeleteAdminSupplier.mockClear();
  });

  afterEach(() => {
    window.sessionStorage.removeItem("procureflow.companies.segment");
  });

  function expandSupplierGroup() {
    const groupBtn = screen.getByRole("button", { name: /buyera asistans özel tedarikçi/i });
    fireEvent.click(groupBtn);
  }

  it("her tedarikci icin Detay butonu render eder", () => {
    renderSupplierTab([activeSupplier, passiveSupplier]);
    expandSupplierGroup();
    const detayButtons = screen.getAllByRole("button", { name: /detay/i });
    expect(detayButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("tedarikci Detay butonuna basinca popup acar", () => {
    renderSupplierTab([activeSupplier]);
    expandSupplierGroup();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`detay.*${activeSupplier.company_name}`, "i") }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTitle("supplier-10-modal")).toBeInTheDocument();
  });

  it("tedarikci Duzenle butonuna basinca popup acar", () => {
    renderSupplierTab([activeSupplier]);
    expandSupplierGroup();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`duzenle.*${activeSupplier.company_name}`, "i") }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTitle("supplier-10-modal")).toBeInTheDocument();
  });

  it("readOnly modda tedarikci Duzenle butonu gosterilmez", () => {
    renderSupplierTab([activeSupplier], { readOnly: true });
    expect(screen.queryByRole("button", { name: /duzenle/i })).not.toBeInTheDocument();
  });

  it("readOnly modda tedarikci Sil butonu gosterilmez", () => {
    renderSupplierTab([activeSupplier], { readOnly: true });
    expect(screen.queryByRole("button", { name: /sil.*tedarikci/i })).not.toBeInTheDocument();
  });

  it("aktif tedarikci Sil butonu disabled", () => {
    renderSupplierTab([activeSupplier]);
    expandSupplierGroup();
    const silBtn = screen.getByRole("button", { name: new RegExp(`sil.*${activeSupplier.company_name}`, "i") });
    expect(silBtn).toBeDisabled();
  });

  it("pasif tedarikci Sil butonuna tiklaninca deleteAdminSupplier cagirilir", async () => {
    renderSupplierTab([passiveSupplier]);
    expandSupplierGroup();
    const silBtn = screen.getByRole("button", { name: new RegExp(`sil.*${passiveSupplier.company_name}`, "i") });
    fireEvent.click(silBtn);
    await waitFor(() => {
      expect(mockDeleteAdminSupplier).toHaveBeenCalledWith(passiveSupplier.id);
    });
  });

  it("tedarikci segmentinde grup acilinca firma satiri gorunur", () => {
    renderSupplierTab([activeSupplier]);
    expandSupplierGroup();
    expect(screen.getByText(/aktif tedarikci as/i)).toBeInTheDocument();
  });

  it("grup basligi tedarikci sayisini gosterir", () => {
    renderSupplierTab([activeSupplier, passiveSupplier]);
    expect(screen.getByText(/Buyera Asistans Özel Tedarikçi/)).toBeInTheDocument();
  });
});
