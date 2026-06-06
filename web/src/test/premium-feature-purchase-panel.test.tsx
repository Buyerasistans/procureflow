import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PremiumFeaturePurchasePanel from "../components/PremiumFeaturePurchasePanel";

const mockGetPaymentProviders = vi.fn();
const mockGetPremiumFeatures = vi.fn();
const mockInitiatePremiumFeaturePayment = vi.fn();
const mockUploadPaymentReceipt = vi.fn();
const mockVerifyPaymentTransaction = vi.fn();
const mockGetPaymentTransaction = vi.fn();

vi.mock("../services/payment.service", () => ({
  getPaymentProviders: (...args: unknown[]) => mockGetPaymentProviders(...args),
  getPremiumFeatures: (...args: unknown[]) => mockGetPremiumFeatures(...args),
  initiatePremiumFeaturePayment: (...args: unknown[]) => mockInitiatePremiumFeaturePayment(...args),
  uploadPaymentReceipt: (...args: unknown[]) => mockUploadPaymentReceipt(...args),
  verifyPaymentTransaction: (...args: unknown[]) => mockVerifyPaymentTransaction(...args),
  getPaymentTransaction: (...args: unknown[]) => mockGetPaymentTransaction(...args),
}));

describe("Premium feature purchase panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPaymentProviders.mockResolvedValue([
      { code: "bank_transfer", name: "Havale / EFT", ready: true },
    ]);
    mockGetPremiumFeatures.mockResolvedValue([
      {
        id: 7,
        code: "premium_listing",
        name: "Premium Listing",
        description: "Vitrinde one cikma",
        monthly_price: 1250,
      },
    ]);
    mockInitiatePremiumFeaturePayment.mockResolvedValue({
      transaction_id: 41,
      provider: "bank_transfer",
      instructions: {
        bank_name: "Demo Bank",
        iban: "TR00 0000 0000 0000",
        reference: "PF-1-7-1",
      },
    });
    mockUploadPaymentReceipt.mockResolvedValue({ id: 41, status: "processing" });
    mockVerifyPaymentTransaction.mockResolvedValue({ transaction_id: 41, status: "succeeded", activated_feature_count: 1 });
    mockGetPaymentTransaction.mockResolvedValue({ id: 41, status: "processing" });
  });

  it("premium satin alma istegini tenant ve feature baglami ile baslatir", async () => {
    const user = userEvent.setup();
    render(
      <PremiumFeaturePurchasePanel
        tenants={[{ id: 1, name: "Alpha A.S.", contactEmail: "ops@alpha.test" }]}
        defaultTenantId={1}
        buyerName="Platform Ops"
        buyerEmail="platform@procureflow.dev"
      />,
    );

    await screen.findByText(/gercek odeme baslatma paneli/i);
    await user.click(screen.getByRole("button", { name: /Premium Satın Alımını Başlat/ }));

    await waitFor(() =>
      expect(mockInitiatePremiumFeaturePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 1,
          premium_feature_id: 7,
          provider: "bank_transfer",
          amount: 1250,
        }),
      ),
    );
    expect(await screen.findByText(/Banka Havalesi Talimatı/)).toBeInTheDocument();
    expect(screen.getByText(/demo bank/i)).toBeInTheDocument();
  });

  it("admin dogrulama acikken odeme dogrulama aksiyonunu gosterir", async () => {
    const user = userEvent.setup();
    render(
      <PremiumFeaturePurchasePanel
        tenants={[{ id: 1, name: "Alpha A.S.", contactEmail: "ops@alpha.test" }]}
        defaultTenantId={1}
        buyerName="Platform Ops"
        buyerEmail="platform@procureflow.dev"
        allowAdminVerification
      />,
    );

    await screen.findByText(/gercek odeme baslatma paneli/i);
    await user.click(screen.getByRole("button", { name: /Premium Satın Alımını Başlat/ }));
    expect(await screen.findByRole("button", { name: /Ödemeyi Doğrula ve Aktifleştir/ })).toBeInTheDocument();
  });
});