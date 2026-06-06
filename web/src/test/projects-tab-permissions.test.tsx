import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ProjectsTab } from "../components/ProjectsTab";

vi.mock("../components/ProjectCreateModal", () => ({
  ProjectCreateModal: () => <div>Project Create Modal Mock</div>,
}));

vi.mock("../services/project.service", () => ({
  getProjects: vi.fn().mockResolvedValue([
    { id: 1, name: "HQ Project", code: "HQ-1", is_active: true, company_id: 1, project_type: "merkez" },
    { id: 2, name: "Supplier Rollout", code: "SUP-9", is_active: true, company_id: 2, project_type: "franchise" },
  ]),
  deleteProject: vi.fn().mockResolvedValue({ message: "ok" }),
}));

vi.mock("../services/admin.service", async () => {
  const actual = await vi.importActual<typeof import("../services/admin.service")>("../services/admin.service");
  return {
    ...actual,
    getCompanies: vi.fn().mockResolvedValue([
      { id: 1, name: "ACME", color: "#2563eb", is_active: true, created_at: "", updated_at: "" },
      { id: 2, name: "BETA", color: "#16a34a", is_active: true, created_at: "", updated_at: "" },
    ]),
  };
});

describe("ProjectsTab permissions", () => {
  it("readOnly modda yazma aksiyonlarini kapatir", async () => {
    render(
      <MemoryRouter>
        <ProjectsTab readOnly />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/platform personeli proje portföyünü inceleyebilir/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yeni proje/i })).toBeDisabled();
    expect(screen.getAllByRole("link", { name: /detaylar/i }).length).toBeGreaterThan(0);
  });

  it("firma filtresi secildiginde yalniz secili firmanin projelerini listeler", async () => {
    render(
      <MemoryRouter>
        <ProjectsTab />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/HQ Project/i)).toBeInTheDocument();
    expect(screen.getByText(/Supplier Rollout/i)).toBeInTheDocument();

    const companyFilter = screen.getByRole("combobox");
    fireEvent.change(companyFilter, { target: { value: "1" } });

    expect(await screen.findByText(/HQ Project/i)).toBeInTheDocument();
    expect(screen.queryByText(/Supplier Rollout/i)).not.toBeInTheDocument();
  });
});
