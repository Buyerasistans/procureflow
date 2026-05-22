import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHttpGet = vi.fn();
const mockHttpPost = vi.fn();

vi.mock("../lib/http", () => ({
  http: {
    get: (...args: unknown[]) => mockHttpGet(...args),
    post: (...args: unknown[]) => mockHttpPost(...args),
  },
}));

import { createRfq, getRfqs } from "../services/quote.service";

describe("quote.service RFQ aliases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getRfqs rfq_id alanini normalize ederek dondurur", async () => {
    mockHttpGet.mockResolvedValue({
      data: {
        items: [
          {
            id: 7,
            rfq_id: 17,
            project_id: 3,
            created_by_id: 11,
            title: "RFQ Alias",
            status: "draft",
            company_name: "ACME",
            company_contact_name: "User",
            company_contact_phone: "555",
            company_contact_email: "user@test.com",
            created_at: "2026-04-15T10:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        size: 10,
      },
    });

    const result = await getRfqs();

    expect(result.items[0].id).toBe(17);
    expect(result.items[0].rfq_id).toBe(17);
  });

  it("createRfq createQuote davranisini ve RFQ normalize sonucunu korur", async () => {
    mockHttpPost.mockResolvedValue({
      data: {
        id: 21,
        rfq_id: 42,
        project_id: 3,
        created_by_id: 11,
        title: "Yeni RFQ",
        status: "draft",
        company_name: "ACME",
        company_contact_name: "User",
        company_contact_phone: "555",
        company_contact_email: "user@test.com",
        created_at: "2026-04-15T10:00:00Z",
      },
    });

    const result = await createRfq({
      title: "Yeni RFQ",
      project_id: 3,
      company_name: "ACME",
      company_contact_name: "User",
      company_contact_phone: "555",
      company_contact_email: "user@test.com",
    });

    expect(result.id).toBe(42);
    expect(result.rfq_id).toBe(42);
    expect(mockHttpPost).toHaveBeenCalledWith("/quotes/", expect.objectContaining({ title: "Yeni RFQ" }));
  });
});