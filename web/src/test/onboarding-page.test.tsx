import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import OnboardingPage from "../pages/OnboardingPage";

function createJsonResponse(payload: unknown, ok: boolean = true, status: number = 200): Response {
  const serialized = JSON.stringify(payload);
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => serialized,
  } as Response;
}

function renderOnboardingPage(initialEntry: string = "/onboarding") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <OnboardingPage />
    </MemoryRouter>
  );
}

function createOnboardingFetchMock(options: {
  plans: unknown[];
  registerResponse?: Response;
  paymentInitiateResponse?: Response;
}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes("/api/v1/onboarding/plans")) {
      return createJsonResponse({ plans: options.plans });
    }

    if (url.includes("/api/v1/payment/providers")) {
      return createJsonResponse({ providers: [] });
    }

    if (url.includes("/api/v1/payment/bank-transfer-instructions")) {
      return createJsonResponse({ instructions: null });
    }

    if (url.includes("/api/v1/onboarding/register")) {
      return options.registerResponse ?? createJsonResponse({ detail: "unexpected register mock" }, false, 500);
    }

    if (url.includes("/api/v1/payment/initiate")) {
      return options.paymentInitiateResponse ?? createJsonResponse({ detail: "unexpected payment mock" }, false, 500);
    }

    return createJsonResponse({}, false, 404);
  });
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tenant_type query ile detay adimini dogrudan acar", async () => {
    createOnboardingFetchMock({
      plans: [
        {
          code: "starter",
          name: "Starter",
          description: "Temel paket",
          audience: "strategic_partner",
          price_monthly: 2500,
          currency: "TRY",
          requires_payment: false,
          is_default: true,
          modules: [
            { code: "rfq_core", name: "RFQ Core", description: "RFQ", enabled: true, limit_value: 5, unit: "proje" },
          ],
        },
        {
          code: "growth",
          name: "Growth",
          description: "Buyuyen ekipler",
          audience: "strategic_partner",
          price_monthly: 4500,
          currency: "TRY",
          requires_payment: false,
          is_default: false,
          modules: [],
        },
      ],
    });

    renderOnboardingPage("/onboarding?tenant_type=strategic_partner");

    expect(await screen.findByText(/firma ve hesap bilgileri/i)).toBeInTheDocument();
    expect(await screen.findByPlaceholderText(/ornek a.s./i)).toBeInTheDocument();
  });

  it("popup kategori secimi ile kayit payloadini dogru gonderir", async () => {
    const fetchMock = createOnboardingFetchMock({
      plans: [
        {
          code: "supplier_free",
          name: "Tedarikci Ucretsiz",
          description: "Temel supplier paketi",
          audience: "supplier",
          price_monthly: 0,
          currency: "TRY",
          requires_payment: false,
          is_default: true,
          included_target_category_limit: 2,
          extra_target_category_slot_price: 3500,
          extra_target_category_slot_currency: "TRY",
          modules: [],
        },
      ],
      registerResponse: createJsonResponse({
        tenant_slug: "ornek-as",
        admin_email: "admin@ornek.com",
        invitation_sent: true,
        message: "Kaydınız alındı. Aktivasyon bağlantısı e-posta adresinize gönderildi.",
      }),
    });

    const user = userEvent.setup();
    renderOnboardingPage("/onboarding?tenant_type=supplier");

    await screen.findByText(/firma ve hesap bilgileri/i);

    await user.type(await screen.findByPlaceholderText(/ornek a.s./i), "Ornek A.S.");
    await user.type(screen.getByPlaceholderText(/opsiyonel/i), "Ornek");
    await user.click(screen.getByRole("button", { name: /^Kategori Sec$/i }));
    await user.click(screen.getByRole("button", { name: "Danismanlik" }));
    await user.click(screen.getByRole("button", { name: "Yazilim" }));
    await user.type(screen.getByPlaceholderText(/kategori adlarini virgulle yazin/i), "Siber Guvenlik");
    await user.click(screen.getByRole("button", { name: /secimi kaydet/i }));
    await user.click(screen.getByRole("button", { name: /^Hedef Kategori Sec$/i }));
    await user.click(screen.getByRole("button", { name: "Lojistik" }));
    await user.type(screen.getByPlaceholderText(/hedef kategori adlarini virgulle yazin/i), "Bulut Altyapisi");
    await user.click(screen.getByRole("button", { name: /secimi kaydet/i }));
    await user.type(screen.getByPlaceholderText(/ahmet yilmaz/i), "Ayse Yilmaz");
    await user.type(screen.getByPlaceholderText(/ahmet@sirket.com.tr/i), "admin@ornek.com");
    await user.type(screen.getByPlaceholderText(/\+90 5xx xxx xx xx/i), "+90 555 000 00 00");

    expect(screen.getByText(/kategori bilgisi gorunurluk ve davet kalitesi icin kullanilir/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /plan secimine devam et/i }));
    await user.click(await screen.findByRole("button", { name: /devam et/i }));

    expect(await screen.findByRole("heading", { name: /kaydiniz alindi/i })).toBeInTheDocument();
    expect(screen.getByText(/gelen kutunuzu kontrol edin/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@ornek.com/i)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/onboarding/register"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_code: "supplier_free",
          legal_name: "Ornek A.S.",
          brand_name: "Ornek",
          category: "Danismanlik",
          categories: ["Danismanlik", "Yazilim"],
          target_categories: ["Lojistik"],
          requested_categories: ["Siber Guvenlik"],
          requested_target_categories: ["Bulut Altyapisi"],
          full_name: "Ayse Yilmaz",
          email: "admin@ornek.com",
          phone: "+90 555 000 00 00",
        }),
      })
    );
  });

  it("2 ucretsiz hedef kategori ustundeki secimlerde liste disi talepleri de ek ucrete dahil eder", async () => {
    const fetchMock = createOnboardingFetchMock({
      plans: [
        {
          code: "starter",
          name: "Starter",
          description: "Temel paket",
          audience: "strategic_partner",
          price_monthly: 2500,
          currency: "TRY",
          requires_payment: true,
          is_default: true,
          included_target_category_limit: 2,
          extra_target_category_slot_price: 3500,
          extra_target_category_slot_currency: "TRY",
          modules: [],
        },
      ],
      paymentInitiateResponse: createJsonResponse({
        transaction_id: 99,
        instructions: { amount: 6000, currency: "TRY", bank_name: "PF Bank", account_name: "ProcureFlow", iban: "TR00 0000 0000 0000", reference: "ONB-REF" },
      }),
      registerResponse: createJsonResponse({
        tenant_slug: "ornek-as",
        admin_email: "admin@ornek.com",
        invitation_sent: false,
        message: "Kaydınız alındı.",
        payment_transaction_id: 99,
      }),
    });

    const user = userEvent.setup();
    renderOnboardingPage("/onboarding?tenant_type=strategic_partner");

    await screen.findByText(/firma ve hesap bilgileri/i);

    await user.type(await screen.findByPlaceholderText(/ornek a.s./i), "Ornek A.S.");
    await user.click(screen.getByRole("button", { name: /^Kategori Sec$/i }));
    await user.click(screen.getByRole("button", { name: "Danismanlik" }));
    await user.click(screen.getByRole("button", { name: /secimi kaydet/i }));
    await user.click(screen.getByRole("button", { name: /^Hedef Kategori Sec$/i }));
    await user.click(screen.getByRole("button", { name: "Yazilim" }));
    await user.click(screen.getByRole("button", { name: "Lojistik" }));
    await user.type(screen.getByPlaceholderText(/hedef kategori adlarini virgulle yazin/i), "Bakim Onarim");
    await user.click(screen.getByRole("button", { name: /secimi kaydet/i }));
    await user.type(screen.getByPlaceholderText(/ahmet yilmaz/i), "Ayse Yilmaz");
    await user.type(screen.getByPlaceholderText(/ahmet@sirket.com.tr/i), "admin@ornek.com");
    await user.type(screen.getByPlaceholderText(/\+90 5xx xxx xx xx/i), "+90 555 000 00 00");

    expect(screen.getByText(/2 hedef kategori dahil/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /plan secimine devam et/i }));
    await user.click(await screen.findByRole("button", { name: /devam et/i }));
    expect(await screen.findByText(/ek hedef kategori ucreti/i)).toBeInTheDocument();
    expect(screen.getByText(/3\.500 try/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.000 try/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /odemeyi baslat ve kaydi tamamla/i }));

    await waitFor(() => {
      const paymentCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/v1/payment/initiate"));
      expect(paymentCall).toBeTruthy();
      const paymentBody = JSON.parse(String((paymentCall?.[1] as RequestInit | undefined)?.body || "{}"));
      expect(paymentBody.amount).toBe(6000);
      expect(paymentBody.extra.extra_target_category_count).toBe(1);
      expect(paymentBody.extra.extra_target_category_fee).toBe(3500);
    });
  });

  it("tedarikci onboarding akisi kategori gorunurluk aciklamasini gosterir", async () => {
    createOnboardingFetchMock({
      plans: [
        {
          code: "supplier_free",
          name: "Tedarikci Ucretsiz",
          description: "Temel supplier paketi",
          audience: "supplier",
          is_default: true,
          modules: [],
        },
      ],
    });

    const user = userEvent.setup();
    renderOnboardingPage("/onboarding?tenant_type=supplier");

    await screen.findByText(/firma ve hesap bilgileri/i);

    expect(await screen.findByText(/mevcut faaliyet kategorileri/i)).toBeInTheDocument();
    expect(screen.getByText(/kategori bilgisi gorunurluk ve davet kalitesi icin kullanilir/i)).toBeInTheDocument();
  });

  it("backend hata dondugunde kullaniciya mesaj gosterir", async () => {
    createOnboardingFetchMock({
      plans: [
        {
          code: "supplier_free",
          name: "Tedarikci Ucretsiz",
          description: "Temel paket",
          audience: "supplier",
          price_monthly: 0,
          currency: "TRY",
          requires_payment: false,
          is_default: true,
          modules: [],
        },
      ],
      registerResponse: createJsonResponse({ detail: "Bu e-posta adresi ile kayitli bir hesap zaten mevcut." }, false, 409),
    });

    const user = userEvent.setup();
    renderOnboardingPage("/onboarding?tenant_type=supplier");

    await screen.findByText(/firma ve hesap bilgileri/i);

    await user.type(await screen.findByPlaceholderText(/ornek a.s./i), "Ornek A.S.");
    await user.click(screen.getByRole("button", { name: /^Kategori Sec$/i }));
    await user.click(screen.getByRole("button", { name: "Danismanlik" }));
    await user.click(screen.getByRole("button", { name: /secimi kaydet/i }));
    await user.type(screen.getByPlaceholderText(/ahmet yilmaz/i), "Ayse Yilmaz");
    await user.type(screen.getByPlaceholderText(/ahmet@sirket.com.tr/i), "admin@ornek.com");
    await user.type(screen.getByPlaceholderText(/\+90 5xx xxx xx xx/i), "+90 555 000 00 00");
    await user.click(screen.getByRole("button", { name: /plan secimine devam et/i }));
    await user.click(await screen.findByRole("button", { name: /devam et/i }));

    await waitFor(() => {
      expect(screen.getByText(/bu e-posta adresi ile kayitli bir hesap zaten mevcut/i)).toBeInTheDocument();
    });
  });
});