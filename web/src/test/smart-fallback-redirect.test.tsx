// FILE: web/src/test/smart-fallback-redirect.test.tsx
import { describe, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthContext } from "../context/auth-context";
import type { AuthContextType, AuthUser } from "../context/auth-types";
import SmartFallbackRedirect from "../routes/SmartFallbackRedirect";

function renderWithAuth(
  ui: ReactNode,
  {
    route = "/",
    user = null,
    loading = false,
  }: {
    route?: string;
    user?: AuthUser | null;
    loading?: boolean;
  } = {}
) {
  const value: AuthContextType = {
    user,
    loading,
    login: async () => {},
    logout: async () => {},
  };

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("SmartFallbackRedirect", () => {
  it("anon kullanıcıyı /login'e yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      { route: "/", user: null, loading: false }
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("admin kullanıcıyı varsayılan rota olan /admin'e yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/admin" element={<div>Dashboard Page</div>} />
      </Routes>,
      { route: "/", user: { id: 1, email: "admin@test.com", role: "admin", system_role: "tenant_admin" }, loading: false }
    );

    expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
  });

  it("manager kullanıcıyı mevcut davranışta /dashboard'a yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>,
      { route: "/", user: { id: 2, email: "manager@test.com", role: "manager", system_role: "tenant_member" }, loading: false }
    );

    expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
  });

  it("buyer/user kullanıcıyı /dashboard'a yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>,
      { route: "/", user: { id: 3, email: "buyer@test.com", role: "buyer", system_role: "tenant_member" }, loading: false }
    );

    expect(await screen.findByText("Dashboard Page")).toBeInTheDocument();
  });

  it("platform support kullanicisini /admin'e yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/admin" element={<div>Admin Page</div>} />
      </Routes>,
      {
        route: "/",
        user: {
          id: 4,
          email: "support@test.com",
          role: "user",
          system_role: "platform_support",
        },
        loading: false,
      }
    );

    expect(await screen.findByText("Admin Page")).toBeInTheDocument();
  });

  it("tenant owner kullanicisini /admin'e yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/admin" element={<div>Admin Page</div>} />
      </Routes>,
      {
        route: "/",
        user: {
          id: 5,
          email: "owner@test.com",
          role: "user",
          system_role: "tenant_owner",
        },
        loading: false,
      }
    );

    expect(await screen.findByText("Admin Page")).toBeInTheDocument();
  });

  it("super admin kullanicisini /admin'e yönlendirir", async () => {
    renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
        <Route path="/admin" element={<div>Admin Page</div>} />
      </Routes>,
      {
        route: "/",
        user: {
          id: 6,
          email: "super@test.com",
          role: "super_admin",
          system_role: "super_admin",
        },
        loading: false,
      }
    );

    expect(await screen.findByText("Admin Page")).toBeInTheDocument();
  });

  it("loading true iken fallback bileşeni içerik render etmez", () => {
    const { container } = renderWithAuth(
      <Routes>
        <Route path="/" element={<SmartFallbackRedirect />} />
      </Routes>,
      { route: "/", user: null, loading: true }
    );

    expect(container).toBeEmptyDOMElement();
  });
});
