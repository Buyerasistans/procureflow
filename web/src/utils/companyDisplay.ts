/**
 * Firma adı kısa gösterim kuralı:
 * 1. short_name varsa kullan
 * 2. brand_name varsa kullan
 * 3. name ilk 20 karakter (uzunsa "..." ekle)
 * 4. legal_name / trade_name ilk 20 karakter (fallback)
 * 5. Hiçbiri yoksa "İsimsiz Firma"
 */
export interface CompanyLike {
  short_name?: string | null;
  brand_name?: string | null;
  name?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
}

const MAX_LEN = 20;

function truncate(s: string): string {
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN)}...` : s;
}

export function getShortCompanyName(company: CompanyLike): string {
  if (company.short_name) return company.short_name;
  if (company.brand_name) return company.brand_name;
  if (company.name) return truncate(company.name);
  const fallback = company.legal_name || company.trade_name || "";
  if (!fallback) return "İsimsiz Firma";
  return truncate(fallback);
}
