import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthContext } from "../context/auth-context";
import { SettingsContext } from "../context/SettingsContext";
import type { AuthContextType } from "../context/auth-context";
import type { SettingsContextType } from "../context/settings-types";
import { SettingsTab } from "../components/SettingsTab";

vi.mock("../components/AdvancedSettingsTab", () => ({
  AdvancedSettingsTab: () => <div>Advanced Settings Mock</div>,
}));

vi.mock("../components/DemoDataTab", () => ({
  DemoDataTab: () => <div>Demo Data Mock</div>,
}));

vi.mock("../services/admin.service", () => ({
  getQuotePriceRules: vi.fn(),
  updateQuotePriceRules: vi.fn(),
  getCommercialRequests: vi.fn().mockResolvedValue([]),
  getSubscriptionAddons: vi.fn().mockResolvedValue([]),

}));

const mockGetMyTenantPremiumPurchaseContext = vi.fn();

vi.mock("../services/payment.service", () => ({
  getMyTenantPremiumPurchaseContext: (...args: unknown[]) => mockGetMyTenantPremiumPurchaseContext(...args),
}));

vi.mock("../components/PremiumFeaturePurchasePanel", () => ({
  default: () => <div>Premium Feature Purchase Panel Mock</div>,
}));

function renderSettingsTab(user: AuthContextType["user"]) {
  const authValue: AuthContextType = {
    user,
    loading: false,
    login: async () => {},
    logout: () => {},
  };

  const settingsValue: SettingsContextType = {
    settings: {
      id: 1,
      app_name: "ProcureFlow",
      maintenance_mode: false,
      vat_rates: [1, 10, 20],
      updated_by_id: 1,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    loading: false,
    error: null,
    updateSettings: async () => {},
    refreshSettings: async () => {},
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <SettingsContext.Provider value={settingsValue}>
          <SettingsTab />
        </SettingsContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("SettingsTab tenant identity permissions", () => {
  it("tenant owner icin premium satin alma panelini gosterir", async () => {
    mockGetMyTenantPremiumPurchaseContext.mockResolvedValue({
      tenant_id: 77,
      tenant_name: "Owner Tenant A.S.",
      tenant_slug: "owner-tenant",
      active_feature_codes: ["premium_listing"],
    });

    renderSettingsTab({
      id: 11,
      email: "tenant-owner@test.com",
      role: "admin",
      business_role: "admin",
      system_role: "tenant_owner",
      full_name: "Tenant Owner",
    });

    expect(await screen.findByText(/premium özellikler/i)).toBeInTheDocument();
    expect(await screen.findByText(/owner tenant a.s./i)).toBeInTheDocument();
    expect(await screen.findByText(/premium feature purchase panel mock/i)).toBeInTheDocument();
  });

  it("super admin icin temel ayarlari düzenlenebilir gosterir", () => {
    renderSettingsTab({
      id: 9,
      email: "super-admin@test.com",
      role: "super_admin",
      business_role: "super_admin",
      system_role: "super_admin",
    });

    expect(
      screen.queryByText(/tenant kimliği ve temel ayarlar salt okunur gösterilir/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/uygulama adı/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/maintenance modu/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /değişiklikleri kaydet/i })).not.toBeDisabled();
  });

  it("tenant admin icin temel ayarlari salt okunur gosterir", () => {
    renderSettingsTab({
      id: 10,
      email: "tenant-admin@test.com",
      role: "admin",
      business_role: "admin",
      system_role: "tenant_admin",
    });

    expect(
      screen.getByText(/tenant kimliği ve temel ayarlar salt okunur gösterilir/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/uygulama adı/i)).toBeDisabled();
    expect(screen.getByLabelText(/maintenance modu/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /değişiklikleri kaydet/i })).toBeDisabled();
  });

  it("tenant owner icin temel ayarlari düzenlenebilir gosterir", () => {
    renderSettingsTab({
      id: 11,
      email: "tenant-owner@test.com",
      role: "admin",
      business_role: "admin",
      system_role: "tenant_owner",
    });

    expect(
      screen.queryByText(/tenant kimliği ve temel ayarlar salt okunur gösterilir/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/uygulama adı/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/maintenance modu/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /değişiklikleri kaydet/i })).not.toBeDisabled();
  });

  it("platform support icin temel ayarlari salt okunur gosterir", () => {
    renderSettingsTab({
      id: 12,
      email: "platform-support@test.com",
      role: "user",
      business_role: "user",
      system_role: "platform_support",
    });

    expect(
      screen.getByText(/tenant kimliği ve temel ayarlar salt okunur gösterilir/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/uygulama adı/i)).toBeDisabled();
    expect(screen.getByLabelText(/maintenance modu/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /değişiklikleri kaydet/i })).toBeDisabled();
  });
});

describe("SettingsTab channel scope e-posta ayarlari", () => {
  const channelOwnerUser: AuthContextType["user"] = {
    id: 20,
    email: "channel@example.com",
    role: "channel_owner",
    business_role: "channel_owner",
    system_role: "tenant_member",
    full_name: "Kanal Sahibi",
    scope_type: "channel",
  };

  it("channel scope icin baslik 'E-posta Ayarlari' gosterir", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.getByText("E-posta Ayarlari")).toBeInTheDocument();
  });

  it("channel scope icin aciklama metni mail odakli gosterilir", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.getByText(/mail gonderim profilinizi/i)).toBeInTheDocument();
  });

  it("channel scope icin 'Temel Ayarlar' sekmesi gorunmez", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.queryByText(/temel ayarlar/i)).not.toBeInTheDocument();
  });

  it("channel scope icin 'Demo Verileri' sekmesi gorunmez", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.queryByText(/demo verileri/i)).not.toBeInTheDocument();
  });

  it("channel scope icin 'Teklif Fiyat Kurallari' sekmesi gorunmez", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.queryByText(/teklif fiyat kuralları/i)).not.toBeInTheDocument();
  });

  it("channel scope icin e-posta ayarlari sekmesi gorulur ve aktif", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.getByRole("button", { name: /e-posta ayarlari/i })).toBeInTheDocument();
  });

  it("channel scope icin tenant kimlik salt-okunur uyarisi gorunmez", () => {
    renderSettingsTab(channelOwnerUser);
    expect(
      screen.queryByText(/tenant kimliği ve temel ayarlar salt okunur gösterilir/i)
    ).not.toBeInTheDocument();
  });

  it("channel scope icin advanced settings mock render edilir", () => {
    renderSettingsTab(channelOwnerUser);
    expect(screen.getByText(/advanced settings mock/i)).toBeInTheDocument();
  });
});
