// web/src/services/quotes.service.ts
import { http } from "../lib/http";
import { normalizeQuote, normalizeQuotes } from "../types/quote";
import type { Quote } from "../types/quote";

export type Rfq = Quote;

export interface QuoteListResponse {
  count: number;
  page: number;
  size: number;
  items: Quote[];
}

export type RfqListResponse = QuoteListResponse;

const MAX_QUOTES_PAGE_SIZE = 100;

export async function getQuotes(
  page: number = 1,
  size: number = 100,
  statusFilter?: "draft" | "submitted" | "sent" | "pending" | "responded" | "approved" | "rejected"
): Promise<Quote[]> {
  const safeSize = Math.max(1, Math.min(size, MAX_QUOTES_PAGE_SIZE));
  const params = new URLSearchParams({
    page: page.toString(),
    size: safeSize.toString(),
  });

  if (statusFilter) {
    params.append("status_filter", statusFilter);
  }

  const res = await http.get<QuoteListResponse>(`/quotes?${params.toString()}`);
  return normalizeQuotes(res.data.items);
}

export async function getRfqs(
  page: number = 1,
  size: number = 100,
  statusFilter?: "draft" | "submitted" | "sent" | "pending" | "responded" | "approved" | "rejected"
): Promise<Rfq[]> {
  return getQuotes(page, size, statusFilter);
}

export async function createQuote(data: {
  title: string;
  amount: number;
  project_id?: number;
}): Promise<Quote> {
  const res = await http.post<Quote>("/quotes", data);
  return normalizeQuote(res.data);
}

export async function createRfq(data: {
  title: string;
  amount: number;
  project_id?: number;
}): Promise<Rfq> {
  return createQuote(data);
}

export async function updateQuote(id: number, data: Partial<Quote>): Promise<Quote> {
  const res = await http.put<Quote>(`/quotes/${id}`, data);
  return normalizeQuote(res.data);
}

export async function updateRfq(id: number, data: Partial<Rfq>): Promise<Rfq> {
  return updateQuote(id, data);
}

export async function deleteQuote(id: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/quotes/${id}`);
  return res.data;
}

export async function deleteRfq(id: number): Promise<{ message: string }> {
  return deleteQuote(id);
}

export async function approveQuote(id: number): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/approve`, {});
  return normalizeQuote(res.data);
}

export async function approveRfq(id: number): Promise<Rfq> {
  return approveQuote(id);
}

export async function rejectQuote(id: number, reason?: string): Promise<Quote> {
  const res = await http.post<Quote>(`/quotes/${id}/reject`, { reason });
  return normalizeQuote(res.data);
}

export async function rejectRfq(id: number, reason?: string): Promise<Rfq> {
  return rejectQuote(id, reason);
}
