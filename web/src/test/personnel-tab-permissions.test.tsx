import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PersonnelTab } from "../pages/admin/PersonnelTab";

const { mockAdminResetPassword } = vi.hoisted(() => ({
  mockAdminResetPassword: vi.fn(),
}));

vi.mock("../components/PersonnelDetailModal", () => ({
  default: ({ onResetPassword }: { onResetPassword?: (id: number) => void }) => (
    <div>
      <div>Personnel Detail Modal Mock</div>
      {onResetPassword ? (
        <button type="button" onClick={() => onResetPassword(1)}>
          Modal Reset Password
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../components/PersonnelCreateModal", () => ({
  PersonnelCreateModal: () => <div>Personnel Create Modal Mock</div>,
}));

vi.mock("../services/admin.service", async () => {
  const actual = await vi.importActual<typeof import("../services/admin.service")>("../services/admin.service");
  return {
    ...actual,
    getUserCompanyAssignments: vi.fn().mockResolvedValue([]),
    adminResetPassword: mockAdminResetPassword,
  };
});

const personnel = [
  {
    id: 1,
    email: "personel@test.com",
    full_name: "Platform Visible User",
    role: "admin" as const,
    system_role: "platform_support",
    approval_limit: 1000,
    is_active: true,
    company_assignments: [],
  },
];

const roles = [
  {
    id: 1,
    name: "admin",
    description: "Admin",
    is_active: true,
    hierarchy_level: 1,
    permissions: [],
  },
];

describe("PersonnelTab permissions", () => {
  beforeEach(() => {
    mockAdminResetPassword.mockReset();
    mockAdminResetPassword.mockResolvedValue({ temp_password: "Temp123!" });
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("readOnly modda yazma aksiyonlarini kapatir", () => {
    render(
      <PersonnelTab
        personnel={personnel}
        roles={roles}
        loadData={vi.fn().mockResolvedValue(undefined)}
        readOnly
      />,
    );

    expect(screen.getByText(/platform personeli bu alanda kullanıcı listesini inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Yeni Kullanıcı/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /\d+ üye/i }));
    expect(screen.getByRole("button", { name: /platform visible user durum kutusu/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /detay/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /düzenle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sil/i })).not.toBeInTheDocument();
  });

  it("editable modda yazma aksiyonlarini gosterir", () => {
    render(
      <PersonnelTab
        personnel={personnel}
        roles={roles}
        loadData={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: /Yeni Kullanıcı/ })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /\d+ üye/i }));
    expect(screen.getByRole("button", { name: /platform visible user durum kutusu/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /düzenle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sil/i })).toBeInTheDocument();
  });

  it("editable modda detay penceresinden sifre sifirlama aksiyonunu acar", async () => {
    render(
      <PersonnelTab
        personnel={personnel}
        roles={roles}
        loadData={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /\d+ üye/i }));
    fireEvent.click(screen.getByRole("button", { name: /detay/i }));
    expect(await screen.findByRole("button", { name: /modal reset password/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /modal reset password/i }));

    await waitFor(() => {
      expect(mockAdminResetPassword).toHaveBeenCalledWith(1);
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Şifre sıfırlandı"));
    });
  });

  it("readOnly modda detay penceresinde sifre sifirlama aksiyonunu gizler", async () => {
    render(
      <PersonnelTab
        personnel={personnel}
        roles={roles}
        loadData={vi.fn().mockResolvedValue(undefined)}
        readOnly
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /\d+ üye/i }));
    fireEvent.click(screen.getByRole("button", { name: /detay/i }));
    await screen.findByText(/personnel detail modal mock/i);

    expect(screen.queryByRole("button", { name: /modal reset password/i })).not.toBeInTheDocument();
  });
});