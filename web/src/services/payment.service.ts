import { http } from "../lib/http";

export interface PaymentProviderItem {
  code: string;
  name: string;
  country: string;
  category: string;
  integration_level: string;
  installed: boolean;
  ready: boolean;
  supports: string[];
}

export interface PremiumFeatureCatalogItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  available_for_tenant_types?: string | null;
  monthly_price?: number | null;
  annual_price?: number | null;
  display_order?: number;
}

export interface InitiatePremiumFeaturePaymentInput {
  tenant_id: number;
  premium_feature_id: number;
  provider: string;
  amount: number;
  currency?: string;
  buyer_email: string;
  buyer_name: string;
  description?: string;
}

export interface SubscriptionAddonCatalogItem {
  code: string;
  name: string;
  description?: string | null;
  price_monthly?: number | null;
  currency?: string | null;
  increment?: number | null;
  unit?: string | null;
}

export interface InitiateSubscriptionAddonPaymentInput {
  tenant_id: number;
  addon_code: string;
  addon_name: string;
  provider: string;
  amount: number;
  quantity: number;
  currency?: string;
  buyer_email: string;
  buyer_name: string;
  description?: string;
}

export interface InitiatedPaymentResult {
  transaction_id: number;
  provider: string;
  redirect_url?: string | null;
  provider_transaction_id?: string | null;
  instructions?: {
    bank_name?: string;
    iban?: string;
    account_name?: string;
    reference?: string;
    amount?: string;
    currency?: string;
  } | null;
}

export interface PaymentTransactionSummary {
  id: number;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  receipt_file_url?: string | null;
  receipt_original_filename?: string | null;
  buyer_note?: string | null;
  created_at?: string;
}

export interface TenantPremiumPurchaseContext {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  active_feature_codes: string[];
}

export async function getPaymentProviders(): Promise<PaymentProviderItem[]> {
  const response = await http.get<{ providers: PaymentProviderItem[] }>("/payment/providers");
  return Array.isArray(response.data?.providers) ? response.data.providers : [];
}

export async function getPremiumFeatures(tenantTypeCode?: string): Promise<PremiumFeatureCatalogItem[]> {
  const response = await http.get<PremiumFeatureCatalogItem[]>("/onboarding/premium-features", {
    params: tenantTypeCode ? { tenant_type_code: tenantTypeCode } : undefined,
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function initiatePremiumFeaturePayment(
  input: InitiatePremiumFeaturePaymentInput,
): Promise<InitiatedPaymentResult> {
  const response = await http.post<InitiatedPaymentResult>("/payment/initiate", {
    tenant_id: input.tenant_id,
    provider: input.provider,
    amount: input.amount,
    currency: input.currency || "TRY",
    description: input.description || "Premium feature satin alimi",
    buyer_email: input.buyer_email,
    buyer_name: input.buyer_name,
    transaction_type: "premium_feature",
    reference_type: "premium_feature",
    reference_id: input.premium_feature_id,
    extra: {
      premium_feature_id: input.premium_feature_id,
      tenant_id: input.tenant_id,
      transfer_reference: `PF-${input.tenant_id}-${input.premium_feature_id}-${Date.now()}`,
    },
  });
  return response.data;
}

export async function initiateSubscriptionAddonPayment(
  input: InitiateSubscriptionAddonPaymentInput,
): Promise<InitiatedPaymentResult> {
  const response = await http.post<InitiatedPaymentResult>("/payment/initiate", {
    tenant_id: input.tenant_id,
    provider: input.provider,
    amount: input.amount,
    currency: input.currency || "TRY",
    description: input.description || "Subscription add-on satin alimi",
    buyer_email: input.buyer_email,
    buyer_name: input.buyer_name,
    transaction_type: "subscription_addon",
    reference_type: "subscription_addon",
    reference_id: input.addon_code,
    extra: {
      addon_code: input.addon_code,
      addon_name: input.addon_name,
      tenant_id: input.tenant_id,
      quantity: input.quantity,
      transfer_reference: `ADDON-${input.tenant_id}-${input.addon_code}-${Date.now()}`,
    },
  });
  return response.data;
}

export async function uploadPaymentReceipt(
  transactionId: number,
  file: File,
  note?: string,
): Promise<PaymentTransactionSummary> {
  const formData = new FormData();
  formData.append("file", file);
  if (note?.trim()) {
    formData.append("note", note.trim());
  }
  const response = await http.post<PaymentTransactionSummary>(`/payment/transactions/${transactionId}/receipt`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getPaymentTransaction(transactionId: number): Promise<PaymentTransactionSummary> {
  const response = await http.get<PaymentTransactionSummary>(`/payment/transactions/${transactionId}`);
  return response.data;
}

export async function verifyPaymentTransaction(transactionId: number): Promise<{
  transaction_id: number;
  status: string;
  tenant_id?: number | null;
  activated_feature_count: number;
  activated_addon_count: number;
  receipt_file_url?: string | null;
}> {
  const response = await http.post<{
    transaction_id: number;
    status: string;
    tenant_id?: number | null;
    activated_feature_count: number;
    activated_addon_count: number;
    receipt_file_url?: string | null;
  }>(`/admin/payment-transactions/${transactionId}/verify`);
  return response.data;
}

export async function getMyTenantPremiumPurchaseContext(): Promise<TenantPremiumPurchaseContext> {
  const response = await http.get<TenantPremiumPurchaseContext>("/onboarding/my-tenant-premium-context");
  return response.data;
}