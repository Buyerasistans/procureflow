import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { SuppliersTab } from "../components/SuppliersTab";

const mockUseAuth = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../lib/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("SuppliersTab permissions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 10,
        email: "support@buyera.app",
        role: "support",
        system_role: "platform_support",
      },
    });

    const { http } = await import("../lib/http");
    vi.mocked(http.get).mockResolvedValue({
      data: [
        {
          id: 1,
          company_name: "ACME Tedarik",
          email: "hello@acme.test",
          phone: "+90 555 000 00 00",
          category: "Yazılım",
          city: "Istanbul",
          reference_score: 87,
          is_verified: true,
          logo_url: null,
          source_type: "private",
        },
        {
          id: 2,
          company_name: "Platform Network Supplier",
          email: "network@acme.test",
          phone: "+90 555 111 00 00",
          category: "Hizmet",
          city: "Ankara",
          reference_score: 65,
          is_verified: false,
          logo_url: null,
          source_type: "platform_network",
        },
      ],
    } as never);
  });

  it("platform staff icin tedarikci tabini read-only render eder", async () => {
    render(
      <MemoryRouter>
        <SuppliersTab />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/platform personeli tedarikçi portfoyunu inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeni tedarikçi/i })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /tedarikçiyi görüntüle/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^sil$/i })).not.toBeInTheDocument();
  });

  it("kaynak filtrelerini ve supplier etiketlerini gosterir", async () => {
    const user = userEvent.setup();
    const { http } = await import("../lib/http");

    render(
      <MemoryRouter>
        <SuppliersTab />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText(/private supplier/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/platform agi/i).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: /platform agi/i })[0]);

    await waitFor(() =>
      expect(vi.mocked(http.get)).toHaveBeenLastCalledWith("/suppliers", {
        params: { source_type: "platform_network" },
      }),
    );
  });

  it("tenant admin hizli davet popupindan minimum supplier verisi gonderebilir", async () => {
    const user = userEvent.setup();
    const { http } = await import("../lib/http");

    mockUseAuth.mockReturnValue({
      user: {
        id: 11,
        email: "admin@tenant.test",
        role: "admin",
        system_role: "tenant_admin",
      },
    });

    vi.mocked(http.post).mockResolvedValue({ data: { id: 99 } } as never);

    render(
      <MemoryRouter>
        <SuppliersTab />
      </MemoryRouter>,
    );

    await screen.findByText(/tedarikçiler/i);
    await user.click(screen.getByRole("button", { name: /yeni tedarikçi/i }));

    expect(screen.getByText(/hızlı tedarikçi daveti/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/şirket adı/i), "Nova Tedarik");
    await user.type(screen.getByLabelText(/telefon/i), "+90 555 333 22 11");
    await user.type(screen.getByLabelText(/e-posta/i), "nova@test.com");
    const citySelect = document.querySelector('select[aria-label="İl *"]') as HTMLSelectElement | null;
    const districtSelect = document.querySelector('select[aria-label="İlçe *"]') as HTMLSelectElement | null;
    expect(citySelect).not.toBeNull();
    expect(districtSelect).not.toBeNull();
    await user.selectOptions(citySelect as HTMLSelectElement, "İstanbul");
    await user.selectOptions(districtSelect as HTMLSelectElement, "Kadıköy");
    await user.type(screen.getByLabelText(/notlar/i), "Hızlı davet testi");

    await user.click(screen.getByRole("button", { name: /davet oluştur/i }));

    await waitFor(() =>
      expect(vi.mocked(http.post)).toHaveBeenCalledWith("/suppliers", {
        company_name: "Nova Tedarik",
        phone: "+90 555 333 22 11",
        email: "nova@test.com",
        city: "İstanbul",
        address_district: "Kadıköy",
        notes: "Hızlı davet testi",
        category: "",
        partner_category_tags: [],
      }),
    );
  });
});
