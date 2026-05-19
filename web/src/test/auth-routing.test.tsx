// FILE: web/src/test/auth-routing.test.tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../pages/DashboardPage", () => ({
  default: () => <h1>Tenant Dashboard Workspace</h1>,
}));

vi.mock("../pages/AdminPage", () => ({
  default: () => <h1>Tenant Admin Workspace</h1>,
}));

vi.mock("../config/navigation", () => ({
  getVisibleNavItems: (user: { role?: string | null; system_role?: string | null }) => {
    const systemRole = String(user?.system_role || "").toLowerCase();
    const role = String(user?.role || "").toLowerCase();
    const canSeePanel = ["tenant_admin", "tenant_owner", "super_admin"].includes(systemRole)
      || role === "admin"
      || role === "super_admin"
      || role === "manager";

    const panelLabel = role === "super_admin" || systemRole === "super_admin"
      ? "Super Admin"
      : systemRole === "tenant_owner"
        ? "Ortak Admin"
        : role === "admin" || systemRole === "tenant_admin"
          ? "Admin"
          : role === "manager"
            ? "Yonetici Paneli"
            : "Panel";

    return [
      { to: "/dashboard", label: "Dashboard", permission: "view:dashboard" },
      ...(canSeePanel ? [{ to: "/admin", label: panelLabel, permission: "view:workspace-panel" }] : []),
    ];
  },
}));

import App from "../App";
import { AuthContext, type AuthContextType } from "../context/auth-context";

type Role = "admin" | "user" | "manager" | "buyer" | "super_admin";

function renderWithAuth(initialPath: string, role: Role | null, systemRole?: string | null) {
  const value: AuthContextType = {
    user: role
      ? {
          id: 1,
          email: `${role}@example.com`,
          role,
          system_role: systemRole ?? (role === "admin" ? "tenant_admin" : "tenant_member"),
        }
      : null,
    loading: false,
    login: async () => {},
    logout: () => {},
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("Auth + Permission routing", () => {
  test("user /admin -> 403", async () => {
    renderWithAuth("/admin", "user");
    expect(await screen.findByRole("heading", { name: /403 - Yetkisiz Erişim/i })).toBeInTheDocument();
  });

  test("admin /admin -> admin panel", async () => {
    renderWithAuth("/admin", "admin");
    expect(await screen.findByRole("heading", { name: /Tenant Admin Workspace/i })).toBeInTheDocument();
  });

  test("user menüde Admin linki görmez", async () => {
    renderWithAuth("/dashboard", "user");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /^Admin$/i })
    ).not.toBeInTheDocument();
  });

  test("admin menüde Admin linki görür", async () => {
    renderWithAuth("/dashboard", "admin");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /^Admin$/i })
    ).toBeInTheDocument();
  });

  test("tenant owner menüde Ortak Admin linki görür", async () => {
    renderWithAuth("/dashboard", "user", "tenant_owner");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /^Ortak Admin$/i })
    ).toBeInTheDocument();
  });

  test("super admin menüde Super Admin linki görür", async () => {
    renderWithAuth("/dashboard", "super_admin", "super_admin");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Super Admin$/i })
    ).toBeInTheDocument();
  });

  test("manager menüde Yonetici Paneli linki görür", async () => {
    renderWithAuth("/dashboard", "manager", "tenant_member");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Yonetici Paneli$/i })
    ).toBeInTheDocument();
  });
});
