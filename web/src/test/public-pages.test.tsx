import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getShortCompanyName } from "../utils/companyDisplay";

const { mockedHttpPost } = vi.hoisted(() => ({
  mockedHttpPost: vi.fn(),
}));

vi.mock("../lib/http", () => {
  const mockedHttp = {
    get: vi.fn(),
    post: (...args: unknown[]) => mockedHttpPost(...args),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: {},
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    http: mockedHttp,
  };
});

describe("Public pages", () => {
  it("demo talebi formu backend'e ticari talep kaydi gonderir", async () => {
    const { default: DemoRequestPage } = await import("../pages/DemoRequestPage");
    mockedHttpPost.mockResolvedValueOnce({ data: { id: 1, status: "new", message: "ok" } });
    const user = userEvent.setup();
    const { container } = render(<DemoRequestPage />);

    await user.type(screen.getByPlaceholderText(/ad soyad/i), "Ayse Yilmaz");
    const emailInput = container.querySelector('input[type="email"]');
    expect(emailInput).not.toBeNull();
    await user.type(emailInput as HTMLInputElement, "ayse@test.com");
    await user.type(screen.getByPlaceholderText(/firma/i), "Ornek A.S.");
    await user.type(screen.getByPlaceholderText(/telefon/i), "05551234567");
    await user.type(screen.getByPlaceholderText(/notunuz/i), "Canli demo gormek istiyoruz.");
    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton).not.toBeNull();
    await user.click(submitButton as HTMLButtonElement);

    expect(mockedHttpPost).toHaveBeenCalledWith("/onboarding/commercial-requests", expect.objectContaining({
      request_type: "general_demo",
      requester_name: "Ayse Yilmaz",
      requester_email: "ayse@test.com",
      company_name: "Ornek A.S.",
    }));
    expect(await screen.findByText(/talebiniz alindi/i)).toBeInTheDocument();
  });

  it("ana sayfa stratejik cta linklerini gosterir", async () => {
    const PublicHomePage = (await import("../pages/PublicHomePage")).default;
    const { container } = render(<PublicHomePage />);

    expect(container.querySelector('a[href="/onboarding"]')).not.toBeNull();
    expect(container.querySelector('a[href="/teklifler"]')).not.toBeNull();
    expect(container.querySelector('a[href="/stratejik-ortaklik"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: /kategori bazli eslesme motoru/i })).toBeInTheDocument();
    expect(screen.getByText(/super admin panelinde kategori kapsami, eslesen supplier sayisi ve kategori eksikleri tek bakista izlenir/i)).toBeInTheDocument();
  });

  it("tedarikci ve stratejik partner program sayfalari kategori eslesme aciklamalarini gosterir", async () => {
    const { default: SupplierProgramPage } = await import("../pages/SupplierProgramPage");
    const { default: StrategicPartnerProgramPage } = await import("../pages/StrategicPartnerProgramPage");
    const { rerender } = render(<SupplierProgramPage />);

    expect(screen.getByText(/kategoriye gore gorunurluk/i)).toBeInTheDocument();
    expect(screen.getByText(/size ilgisiz davetleri azaltmak, daha isabetli ihale akisina dahil olmak/i)).toBeInTheDocument();

    rerender(<StrategicPartnerProgramPage />);

    expect(screen.getByText(/kategori destekli onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/supplier uygunlugu ilk gunden gorunur/i)).toBeInTheDocument();
    expect(screen.getByText(/kategori eksigi operasyon kuyruguna donusur/i)).toBeInTheDocument();
  });

  it("cozumler ve fiyatlandirma sayfalari temel icerigi gosterir", async () => {
    const { default: SolutionsPage } = await import("../pages/SolutionsPage");
    const { default: PricingPage } = await import("../pages/PricingPage");
    const { rerender, container } = render(<SolutionsPage />);

    expect(screen.getByRole("heading", { name: /çözümler/i })).toBeInTheDocument();
    expect(screen.getByText(/Teklifler Akışına Git/)).toBeInTheDocument();
    expect(screen.getByText(/Tedarikçiler Sayfasına Git/)).toBeInTheDocument();

    rerender(<PricingPage />);

    expect(screen.getByRole("heading", { name: /fiyatlandırma|fiyatlandirma/i })).toBeInTheDocument();
    expect(screen.getByText(/stratejik partner planlari/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tedarikçi Planları/ })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href*="/teklifler#planlar"]').length).toBeGreaterThan(0);
  });

});

describe("Firm adi kisa gosterim - getShortCompanyName helper", () => {
  it("short_name varsa onun kullaniyor", () => {
    const company = {
      short_name: "ABC Ltd",
      brand_name: "Brand ABC",
      name: "Very Long Company Name That Should Not Be Used",
    };
    expect(getShortCompanyName(company)).toBe("ABC Ltd");
  });

  it("short_name yoksa brand_name kullaniyor", () => {
    const company = {
      brand_name: "Acme Brand",
      name: "Very Long Company Name That Should Not Be Used",
    };
    expect(getShortCompanyName(company)).toBe("Acme Brand");
  });

  it("20 karakterden uzun isim truncate ediyor", () => {
    const company = {
      name: "Very Long Company Name That Should Be Truncated",
    };
    const result = getShortCompanyName(company);
    expect(result).toBe("Very Long Company Na…");
    expect(result.length).toBeLessThanOrEqual(21); // 20 chars + "…"
  });

  it("20 karakter ve altinda ismi aynen kullaniyor", () => {
    const company = {
      name: "Short Company Name",
    };
    expect(getShortCompanyName(company)).toBe("Short Company Name");
  });

  it("legal_name fallback kullaniyor", () => {
    const company = {
      legal_name: "Legal Company Inc.",
      trade_name: "Trade Inc.",
    };
    expect(getShortCompanyName(company)).toBe("Legal Company Inc.");
  });

  it("legal_name yoksa trade_name kullaniyor", () => {
    const company = {
      trade_name: "Trade Company Ltd",
    };
    expect(getShortCompanyName(company)).toBe("Trade Company Ltd");
  });

  it("isim yoksa 'İsimsiz Firma' donderuyor", () => {
    const company = {};
    expect(getShortCompanyName(company)).toBe("İsimsiz Firma");
  });

  it("uzun legal_name/trade_name truncate ediyor", () => {
    const company = {
      legal_name: "Very Long Legal Company Name That Should Be Truncated",
    };
    const result = getShortCompanyName(company);
    expect(result).toBe("Very Long Legal Comp…");
    expect(result.length).toBeLessThanOrEqual(21);
  });
});
