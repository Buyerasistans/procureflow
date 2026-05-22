// FILE: web/src/test/forbidden-page.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import ForbiddenPage from "../pages/ForbiddenPage"
import { AuthContext } from "../context/auth-context"
import type { AuthContextType } from "../context/auth-context"

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
  }),
}))

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe("ForbiddenPage", () => {
  const authValue: AuthContextType = {
    user: { id: 1, email: "user@example.com", role: "user" },
    loading: false,
    login: async () => {},
    logout: () => {},
  }

  it("sayfayı render eder", () => {
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <ForbiddenPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(screen.getByText(/yetkiniz yok|forbidden|403/i)).toBeInTheDocument()
  })

  it("geri dön aksiyonu navigate çağırır", async () => {
    const user = userEvent.setup()
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <ForbiddenPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    const btn = screen.getByRole("button", { name: /geri dön/i })
    await user.click(btn)

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
