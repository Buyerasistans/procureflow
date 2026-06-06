import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import AppLayout from "../components/AppLayout"

const mockLogout = vi.fn()
const mockNavigate = vi.fn()
const mockUseAuth = vi.fn()

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("../lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../services/admin.service", () => ({
  getWorkspacePanelConfig: vi.fn().mockResolvedValue({ profiles: [] }),
}))

vi.mock("../services/mail-center.service", () => ({
  getMailCenterAccounts: vi.fn().mockResolvedValue([]),
  getDashboardMailButtonConfig: vi.fn().mockResolvedValue({ dashboard_mail_button_enabled: true }),
}))

vi.mock("../services/profile.service", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}))

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: {
        email: "admin@pf.com",
        role: "admin",
        system_role: "tenant_admin",
        platform_name: "Buyera Asistans",
      },
      logout: mockLogout,
    })
  })

  it("Outlet içeriğini render eder", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>İçerik</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("İçerik")).toBeInTheDocument()
    expect(screen.getByText(/Buyera Asistans/i)).toBeInTheDocument()
  })

  it("Çıkış Yap tıklanınca logout + navigate çalışır", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: /admin@pf.com/i }))
    await user.click(screen.getByRole("button", { name: /çıkış yap/i }))

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true })
  })

  it("platform support kullanıcısı için workspace fallback etiketini gösterir", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "support@pf.com",
        role: "admin",
        system_role: "platform_support",
        platform_name: "Buyera Asistans",
      },
      logout: mockLogout,
    })

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>İçerik</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Platform Operasyon Alan/)).toBeInTheDocument()
  })

  it("tenant owner kullanıcısı için owner workspace fallback etiketini gösterir", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "owner@pf.com",
        role: "admin",
        system_role: "tenant_owner",
        platform_name: "Buyera Asistans",
      },
      logout: mockLogout,
    })

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>İçerik</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Owner Y.netim Alan/)).toBeInTheDocument()
  })
})
