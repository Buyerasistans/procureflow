/**
 * SupportTicketAdminTab bileşen testleri
 *
 * Sprint-7: Admin destek talep yönetim paneli
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock: admin.service
// ---------------------------------------------------------------------------
const { mockedAdminListSupportTickets, mockedAdminUpdateSupportTicket, mockedGetPersonnel } = vi.hoisted(() => ({
  mockedAdminListSupportTickets: vi.fn(),
  mockedAdminUpdateSupportTicket: vi.fn(),
  mockedGetPersonnel: vi.fn(),
}));

vi.mock("../services/admin.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/admin.service")>();
  return {
    ...original,
    adminListSupportTickets: (...args: unknown[]) => mockedAdminListSupportTickets(...args),
    adminUpdateSupportTicket: (...args: unknown[]) => mockedAdminUpdateSupportTicket(...args),
    getPersonnel: (...args: unknown[]) => mockedGetPersonnel(...args),
  };
});

import { SupportTicketAdminTab } from "../components/admin/SupportTicketAdminTab";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const TICKET_OPEN = {
  id: 1,
  tenant_id: 10,
  created_by_user_id: 100,
  assigned_to_user_id: null,
  subject: "Fatura ödeme sorunu",
  description: "Ödeme yapamıyorum, hata alıyorum.",
  category: "billing",
  priority: "high",
  status: "open",
  source: "help_center",
  resolution_note: null,
  sla_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // ileride
  resolved_at: null,
  is_visible_to_tenant: true,
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-01T10:00:00Z",
  created_by_name: "Ali Veli",
  assigned_to_name: null,
  tenant_name: "Demo Firması",
};

const TICKET_URGENT_BREACHED = {
  ...TICKET_OPEN,
  id: 2,
  subject: "Sistem girişi yok",
  priority: "urgent",
  status: "in_progress",
  sla_due_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // geçmişte
  assigned_to_name: "Destek Personel",
  assigned_to_user_id: 5,
  tenant_name: "Test Tenant",
};

const PLATFORM_USERS = [
  { id: 5, full_name: "Destek Personel", email: "destek@platform.com", role: "super_admin", is_active: true, approval_limit: 0 },
];

// ---------------------------------------------------------------------------
// Testler
// ---------------------------------------------------------------------------
describe("SupportTicketAdminTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPersonnel.mockResolvedValue(PLATFORM_USERS);
  });

  it("yüklenince talepleri listeler", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([TICKET_OPEN, TICKET_URGENT_BREACHED]);

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/Fatura ödeme sorunu/)).toBeInTheDocument();
      expect(screen.getByText(/Sistem girişi yok/)).toBeInTheDocument();
    });

    // Açık ve İşlemde rozetleri (birden fazla yerde görünebilir, en az 1 olmalı)
    expect(screen.getAllByText("Açık").length).toBeGreaterThan(0);
    expect(screen.getAllByText("İşlemde").length).toBeGreaterThan(0);
  });

  it("SLA aşan talep için uyarı gösterir", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([TICKET_URGENT_BREACHED]);

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/⚠ SLA/)).toBeInTheDocument();
    });
  });

  it("özet metrik kartlarını doğru değerle gösterir", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([TICKET_OPEN, TICKET_URGENT_BREACHED]);

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      // Toplam 2 kayıt
      const totalCard = screen.getByText("Toplam").previousElementSibling;
      expect(totalCard?.textContent).toBe("2");
    });
  });

  it("talep satırına tıklayınca inline form açılır", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([TICKET_OPEN]);
    const user = userEvent.setup();

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/Fatura ödeme sorunu/)).toBeInTheDocument();
    });

    // Satıra tıkla → form açılmalı
    await user.click(screen.getByText(/Fatura ödeme sorunu/));

    expect(screen.getByText(/Çözüm Notu/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kaydet/i })).toBeInTheDocument();
  });

  it("kaydet butonu backend'i güncelleme isteğiyle çağırır", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([TICKET_OPEN]);
    mockedAdminUpdateSupportTicket.mockResolvedValue({ ...TICKET_OPEN, status: "in_progress" });
    const user = userEvent.setup();

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/Fatura ödeme sorunu/)).toBeInTheDocument();
    });

    // Satıra tıkla → inline form açılır
    await user.click(screen.getByText(/Fatura ödeme sorunu/));

    // Inline form içindeki "Durum" label'ı bul (getByLabelText)
    const statusSelect = screen.getByLabelText("Durum");
    await user.selectOptions(statusSelect, "in_progress");

    // Kaydet
    await user.click(screen.getByRole("button", { name: /Kaydet/i }));

    await waitFor(() => {
      expect(mockedAdminUpdateSupportTicket).toHaveBeenCalledWith(
        TICKET_OPEN.id,
        expect.objectContaining({ status: "in_progress" }),
      );
    });
  });

  it("API hatası durumunda hata mesajı gösterir", async () => {
    mockedAdminListSupportTickets.mockRejectedValue(new Error("Network error"));

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/Destek talepleri yüklenemedi/)).toBeInTheDocument();
    });
  });

  it("kayıt yoksa boş durum mesajı gösterir", async () => {
    mockedAdminListSupportTickets.mockResolvedValue([]);

    render(<SupportTicketAdminTab />);

    await waitFor(() => {
      expect(screen.getByText(/eşleşen destek talebi bulunamadı/i)).toBeInTheDocument();
    });
  });
});
