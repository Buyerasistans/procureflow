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

  test("user menüde Yönetim Alanı linki görmez", async () => {
    renderWithAuth("/dashboard", "user");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /Yönetim Alanı/ })
    ).not.toBeInTheDocument();
  });

  test("admin menüde Yönetim Alanı linki görür", async () => {
    renderWithAuth("/dashboard", "admin");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Yönetim Alanı/ })
    ).toBeInTheDocument();
  });

  test("tenant owner menüde Yönetim Alanı linki görür", async () => {
    renderWithAuth("/dashboard", "user", "tenant_owner");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Yönetim Alanı/ })
    ).toBeInTheDocument();
  });

  test("super admin menüde Yönetim Alanı linki görür", async () => {
    renderWithAuth("/dashboard", "super_admin", "super_admin");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Yönetim Alanı/ })
    ).toBeInTheDocument();
  });

  test("manager menüde Yönetim Alanı linki görür", async () => {
    renderWithAuth("/dashboard", "manager", "tenant_member");

    expect(await screen.findByRole("heading", { name: /Tenant Dashboard Workspace/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Yönetim Alanı/ })
    ).toBeInTheDocument();
  });
});
