import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProjectFilesPage from "../pages/ProjectFilesPage";

const mockUseAuth = vi.fn();
const mockGetProjects = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetProjectFiles = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../services/project.service", () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  getProjectFiles: (...args: unknown[]) => mockGetProjectFiles(...args),
  deleteProjectFile: vi.fn(),
}));

vi.mock("../services/admin.service", () => ({
  getCompanies: (...args: unknown[]) => mockGetCompanies(...args),
}));

vi.mock("../lib/token", () => ({
  getAccessToken: () => "token",
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/projects/42/files"]}>
      <Routes>
        <Route path="/admin/projects/:id/files" element={<ProjectFilesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectFilesPage permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue([
      {
        id: 42,
        name: "Readonly Project",
        code: "READONLY-FILES-42",
        company_id: 7,
        project_type: "merkez",
        is_active: true,
      },
    ]);
    mockGetCompanies.mockResolvedValue([{ id: 7, name: "Readonly Company", color: "#2563eb" }]);
    mockGetProjectFiles.mockResolvedValue([
      {
        id: 1,
        filename: "plan.pdf",
        original_filename: "plan.pdf",
        file_type: "application/pdf",
        file_size: 1024,
      },
      {
        id: 2,
        filename: "photo.png",
        original_filename: "photo.png",
        file_type: "image/png",
        file_size: 2048,
      },
    ]);
  });

  it("platform staff icin dosya sayfasini read-only tutar", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: "support@test.com", role: "user", system_role: "platform_support" },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/readonly company/i)).toBeInTheDocument());
    expect(screen.getByText(/salt okunur/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sil/i })).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.textContent?.includes("İndir")),
    ).toHaveLength(2);
  });
});