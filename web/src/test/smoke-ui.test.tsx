// FILE: web/src/test/smoke-ui.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PageLoader from "../components/PageLoader";
import ReportsPage from "../pages/ReportsPage";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

describe("smoke ui", () => {
  it("PageLoader render edilir", () => {
    const { container } = render(<PageLoader />);
    expect(container).toBeInTheDocument();
  });

  it("ReportsPage render edilir", () => {
    render(<ReportsPage />);
    expect(
      screen.getAllByRole("heading", { name: /raporlar/i }).length
    ).toBeGreaterThan(0);
  });
});
