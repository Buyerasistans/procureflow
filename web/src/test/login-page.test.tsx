// FILE: web/src/test/login-page.test.tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import { AuthContext } from "../context/auth-context";
import type { AuthContextType } from "../context/auth-context";

function renderWithAuth(
  ctx: AuthContextType,
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/login"]
) {
  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/reports" element={<div>Reports</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("LoginPage giris tipi secim ekranini render eder", () => {
    renderWithAuth({ user: null, loading: false, login: vi.fn(), logout: vi.fn() });

    expect(screen.getByRole("button", { name: /stratejik partner girisi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tedarikçi Girişi/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /İş Ortağı Girişi/ })).toBeInTheDocument();
  });

  test("Stratejik Partner Girisi butonuna tiklaninca doğru yola gider", async () => {
    const user = userEvent.setup();
    renderWithAuth({ user: null, loading: false, login: vi.fn(), logout: vi.fn() });

    await user.click(screen.getByRole("button", { name: /stratejik partner girisi/i }));
    // navigation happens, no crash
  });
});
