import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SendQuoteModal from "../components/SendQuoteModal";
import { ProjectSuppliersModal } from "../components/ProjectSuppliersModal";

vi.mock("../lib/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("Supplier selection modals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SendQuoteModal kaynak kartlariyla filtreler ve secili supplierlari gonderir", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSent = vi.fn();
    const { http } = await import("../lib/http");

    vi.mocked(http.get)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: [] } as never);
    vi.mocked(http.post).mockResolvedValue({ data: {} } as never);

    render(
      <SendQuoteModal
        quote={{
          platform_network_listing_enabled: true,
          package_plan_code: "growth",
          package_plan_name: "Buyume",
          active_premium_feature_codes: [],
        }}
        quoteId={11}
        projectId={9}
        onClose={onClose}
        onSent={onSent}
        suppliers={[
          { id: 1, supplier_id: 101, supplier_name: "Atlas", supplier_email: "atlas@test.com", category: "Yazılım", effective_category_tags: ["Yazılım", "ERP"], source_type: "private", is_active: true },
          { id: 2, supplier_id: 202, supplier_name: "Networker", supplier_email: "network@test.com", category: "Hizmet", effective_category_tags: ["Hizmet", "Saha Operasyon"], source_type: "platform_network", is_active: true },
          { id: 3, supplier_id: 303, supplier_name: "Pasif", supplier_email: "passive@test.com", category: "Hizmet", source_type: "private", is_active: false },
        ]}
      />,
    );

    expect(await screen.findByText(/tum kaynaklar/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /platform agi/i })).toBeInTheDocument();
    expect(screen.getAllByText("ERP").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /platform agi/i }));
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
    expect(screen.getByText("Networker")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /gönder \(1\)/i }));

    await waitFor(() => expect(vi.mocked(http.post)).toHaveBeenCalledWith("/quotes/11/send-to-suppliers", [202]));
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ProjectSuppliersModal source filtre istegini yollar ve secili supplierlari projeye ekler", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { http } = await import("../lib/http");

    vi.mocked(http.get)
      .mockResolvedValueOnce({
        data: [
          { id: 1, company_name: "Atlas", email: "atlas@test.com", phone: "+90 555 000 00 00", category: "Yazılım", effective_category_tags: ["Yazılım", "ERP"], is_active: true, source_type: "private" },
          { id: 2, company_name: "Networker", email: "network@test.com", phone: "+90 555 111 00 00", category: "Hizmet", effective_category_tags: ["Hizmet", "Saha Operasyon"], is_active: true, source_type: "platform_network" },
          { id: 3, company_name: "Passive", email: "passive@test.com", phone: "+90 555 222 00 00", category: "Yazılım", is_active: false, source_type: "private" },
        ],
      } as never)
      .mockResolvedValueOnce({
        data: [
          { id: 2, company_name: "Networker", email: "network@test.com", phone: "+90 555 111 00 00", category: "Hizmet", effective_category_tags: ["Hizmet", "Saha Operasyon"], is_active: true, source_type: "platform_network" },
        ],
      } as never);
    vi.mocked(http.post).mockResolvedValue({ data: { message: "1 tedarikçi eklendi" } } as never);

    render(<ProjectSuppliersModal projectId={44} onClose={onClose} onSuccess={onSuccess} />);

    expect(await screen.findByText(/projeye tedarikçi ekle/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /tumü \(2\)|tümü \(2\)/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /platform ağı \(1\)/i }));

    await waitFor(() =>
      expect(vi.mocked(http.get)).toHaveBeenLastCalledWith("/suppliers", {
        params: { source_type: "platform_network" },
      }),
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /davetiye gönder \(1\)/i }));

    await waitFor(() =>
      expect(vi.mocked(http.post)).toHaveBeenCalledWith("/suppliers/projects/44/suppliers", [2]),
    );
    expect(screen.getByText(/1 tedarikçi eklendi/i)).toBeInTheDocument();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});