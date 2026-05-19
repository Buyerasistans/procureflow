// FILE: web/src/test/auth-provider.test.tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../context/AuthProvider";
import { AuthContext } from "../context/auth-context";
import type { AuthUser } from "../context/auth-types";

// --- Mocks
vi.mock("../lib/token", () => ({
  getAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  clearAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
}));

vi.mock("../lib/session", () => ({
  shouldUseSupplierSession: vi.fn(),
}));

vi.mock("../services/auth.service", () => ({
  loginRequest: vi.fn(),
  meRequest: vi.fn(),
  logoutRequest: vi.fn(),
}));

import { getAccessToken, clearAccessToken } from "../lib/token";
import { meRequest } from "../services/auth.service";
import { shouldUseSupplierSession } from "../lib/session";

function Consumer() {
  return (
    <AuthContext.Consumer>
      {(ctx) => (
        <div>
          <div data-testid="loading">{String(ctx?.loading)}</div>
          <div data-testid="user">{ctx?.user ? (ctx.user as AuthUser).email : "null"}</div>
          <button onClick={() => ctx?.logout()}>logout</button>
        </div>
      )}
    </AuthContext.Consumer>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(shouldUseSupplierSession).mockReturnValue(false);
  });

  test("token yoksa user null, loading false", async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(meRequest).not.toHaveBeenCalled();
  });

  test("token varsa meRequest ile user hydrate olur", async () => {
    vi.mocked(getAccessToken).mockReturnValue("token_123");
    vi.mocked(meRequest).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
      role: "admin",
    } as AuthUser);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(meRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("admin@example.com");
  });

  test("meRequest fail olursa token temizlenir ve user null olur", async () => {
    vi.mocked(getAccessToken).mockReturnValue("expired_token");
    vi.mocked(meRequest).mockRejectedValue(new Error("401"));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(clearAccessToken).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  test("supplier session root yolunda admin hydrate atlanir", async () => {
    vi.mocked(shouldUseSupplierSession).mockReturnValue(true);
    vi.mocked(getAccessToken).mockReturnValue(null);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(meRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});
