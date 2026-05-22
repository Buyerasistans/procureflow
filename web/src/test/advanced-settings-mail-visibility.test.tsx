import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdvancedSettingsTab } from "../components/AdvancedSettingsTab";

const mockState = vi.hoisted(() => ({
  auth: {
    user: {
      id: 999,
      email: "super@procureflow.dev",
      role: "super_admin",
      system_role: "super_admin",
      scope_type: "platform",
    },
  },
  mailVisibilityRows: [
    {
      company_id: 101,
      company_name: "Ana Firma A.S.",
      tenant_id: 10,
      tenant_name: "Tenant A",
      is_primary: true,
      is_active: true,
      enabled: false,
    },
  ],
  updateCompanyMailVisibilityMock: vi
    .fn()
    .mockResolvedValue({ company_id: 101, enabled: true }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockState.auth,
}));

vi.mock("../auth/permissions", () => ({
  canAccessProcurementSettings: () => true,
  canManageSharedEmailProfiles: () => true,
  getUserScopeType: () => "platform",
  isPlatformStaffUser: () => false,
  isSuperAdminUser: () => true,
}));

vi.mock("../services/advanced-settings.service", () => ({
  getEmailSettings: vi.fn().mockResolvedValue({ dashboard_mail_button_enabled: true }),
  getEmailProfiles: vi.fn().mockResolvedValue([]),
  updateEmailSettings: vi.fn().mockResolvedValue({ dashboard_mail_button_enabled: true }),
  testEmailSettings: vi.fn(),
  getLoggingSettings: vi.fn().mockResolvedValue({}),
  updateLoggingSettings: vi.fn(),
  getBackupSettings: vi.fn().mockResolvedValue({}),
  updateBackupSettings: vi.fn(),
  triggerBackupManually: vi.fn(),
  getNotificationSettings: vi.fn().mockResolvedValue({}),
  updateNotificationSettings: vi.fn(),
  getAPIKeys: vi.fn().mockResolvedValue([]),
  createAPIKey: vi.fn(),
  revokeAPIKey: vi.fn(),
  uploadEmailSignatureImage: vi.fn(),
}));

vi.mock("../services/system-email.service", () => ({
  getSystemEmails: vi.fn().mockResolvedValue([]),
  createSystemEmail: vi.fn(),
  updateSystemEmail: vi.fn(),
  deleteSystemEmail: vi.fn(),
}));

vi.mock("../services/mail-center.service", () => ({
  getCompanyMailVisibility: vi.fn().mockResolvedValue(mockState.mailVisibilityRows),
  updateCompanyMailVisibility: (...args: unknown[]) =>
    mockState.updateCompanyMailVisibilityMock(...args),
}));

describe("AdvancedSettingsTab company mail visibility", () => {
  beforeEach(() => {
    mockState.updateCompanyMailVisibilityMock.mockClear();
    mockState.updateCompanyMailVisibilityMock.mockResolvedValue({
      company_id: 101,
      enabled: true,
    });
  });

  it("super admin firma bazli mail gorunurluk tikini gorebilir ve guncelleyebilir", async () => {
    const user = userEvent.setup();
    render(<AdvancedSettingsTab />);

    expect(await screen.findByText(/Firma Bazli Mail Gorunurluk/i)).toBeInTheDocument();
    expect(screen.getByText(/Ana Firma A.S./i)).toBeInTheDocument();
    expect(screen.getByText(/^Pasif$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Ana Firma A.S./i }));

    await waitFor(() => {
      expect(mockState.updateCompanyMailVisibilityMock).toHaveBeenCalledWith(101, true);
      expect(screen.getByText(/^Aktif$/i)).toBeInTheDocument();
    });
  });
});
