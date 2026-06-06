// services/admin.service.ts
import { http } from "../lib/http";
import type { ProjectFile } from "../types/project";

export interface Permission {
  id: number;
  name: string;
  description?: string;
  category?: string;
  tooltip?: string;
}

export interface PermissionCatalogNode {
  key: string;
  label: string;
  description: string;
  children: PermissionCatalogNode[];
}

export interface UserPermissionOverrideItem {
  permission_key: string;
  allowed: boolean;
}

export interface UserPermissionOverride extends UserPermissionOverrideItem {
  id: number;
  user_id: number;
  granted_by_user_id?: number | null;
}

export interface RolePermissionDelegationItem {
  permission_key: string;
  can_delegate: boolean;
}

export interface RolePermissionDelegation extends RolePermissionDelegationItem {
  id: number;
  system_role?: string | null;
  business_role?: string | null;
}

export interface WorkspacePanelProfile {
  business_role: string;
  system_role?: string | null;
  title: string;
  nav_label: string;
  workspace_label: string;
  description: string;
  hero_title: string;
  hero_description: string;
  top_notice?: string | null;
  header_info?: string | null;
  footer_info?: string | null;
  header_bg_color?: string | null;
  header_text_color?: string | null;
  footer_bg_color?: string | null;
  footer_text_color?: string | null;
  hero_text_color?: string | null;
  hero_muted_text_color?: string | null;
  allow_user_self_customization?: boolean | null;
  restricted_customization_sections?: string[] | null;
  menu_style?: "pill" | "accordion" | "drawer" | "tabs" | null;
  allowed_tabs: string[];
  quick_links: Array<{
    label: string;
    href: string;
    description: string;
  }>;
  icon?: string | null;
  accent_color?: string | null;
  secondary_accent_color?: string | null;
  accent_opacity?: number | null;
  secondary_accent_opacity?: number | null;
  primary_accent_stop?: number | null;
  secondary_accent_start?: number | null;
  glow_intensity?: number | null;
  // İki renkli chrome (navbar + üst başlık) — Faz 1
  color2?: string | null;       // 2. renk · parıltı; varsayılan = segment.secondary ?? accent
  color2Mix?: number | null;    // 0–0.6 parıltı oranı; varsayılan = 0.18
  syncTopbar?: boolean | null;  // true → navbar+başlık bu profil rengiyle boyanır
  selfEdit?: boolean | null;    // true → rol sahibi kendi panelini düzenleyebilir
  vitrinEdit?: boolean | null;  // true → panel admini vitrin sayfalarını düzenler
}

export interface WorkspacePanelUserOverride {
  user_id?: number | null;
  user_email?: string | null;
  profile_key: string;
  note?: string | null;
}

export interface WorkspacePanelConfig {
  version: number;
  profiles: WorkspacePanelProfile[];
  user_overrides?: WorkspacePanelUserOverride[];
}

export interface CommercialRequestWebhookSettings {
  webhook_url?: string | null;
  has_webhook_secret: boolean;
}

export interface CommercialRequestWebhookDelivery {
  id: number;
  commercial_request_id?: number | null;
  commercial_request_company_name?: string | null;
  commercial_request_requester_email?: string | null;
  event_type: string;
  target_url?: string | null;
  delivery_status: string;
  http_status_code?: number | null;
  error_message?: string | null;
  payload_raw?: string | null;
  response_body?: string | null;
  attempt_count: number;
  delivered_at?: string | null;
  last_attempted_at?: string | null;
  created_at: string;
}

export interface PaymentProviderCatalogItem {
  code: string;
  name: string;
  country: string;
  category: string;
  integration_level: string;
  installed: boolean;
  ready: boolean;
  supports: string[];
  notes?: string;
}

export interface PaymentProviderField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string | null;
  value?: string | null;
  has_value: boolean;
}

export interface PaymentProviderSettingItem extends PaymentProviderCatalogItem {
  notes: string;
  is_active: boolean;
  fields: PaymentProviderField[];
}

export interface CampaignRule {
  id?: number;
  threshold_count: number;
  reward_type: string;
  reward_value_json?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CampaignParticipant {
  id: number;
  owner_type: string;
  owner_id: number;
  progress_count: number;
  last_event_at?: string | null;
  last_evaluated_at?: string | null;
}

export interface CampaignRewardGrant {
  id: number;
  campaign_id: number;
  rule_id: number;
  owner_type: string;
  owner_id: number;
  reward_type: string;
  reward_value_json?: string | null;
  status: string;
  application_note?: string | null;
  granted_at: string;
  applied_at?: string | null;
}

export interface CampaignProgram {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  audience_type: string;
  trigger_event: string;
  status: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  rules: CampaignRule[];
  participants: CampaignParticipant[];
  grants: CampaignRewardGrant[];
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  tenant_id?: number | null;
  is_active: boolean;
  hierarchy_level: number;
  parent_id?: number | null;
  permissions: Permission[];
}

export interface Department {
  id: number;
  tenant_id?: number | null;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sub_items?: { id: number; name: string }[];
}

export interface CatalogMergeItem {
  id: number;
  name: string;
  tenant_id?: number | null;
  is_active: boolean;
}

export interface CatalogMergePreviewGroup {
  normalized_name: string;
  item_count: number;
  impacted_assignment_count: number;
  items: CatalogMergeItem[];
}

export interface CatalogMergePreview {
  entity_type: "role" | "department";
  tenant_id?: number | null;
  groups: CatalogMergePreviewGroup[];
}

export interface CatalogMergeApplyResult {
  entity_type: "role" | "department";
  tenant_id?: number | null;
  target_id: number;
  merged_source_ids: number[];
  moved_assignment_count: number;
  rollback_token: string;
  rollback_expires_at: string;
}

export interface CatalogMergeRollbackResult {
  entity_type: "role" | "department";
  tenant_id?: number | null;
  target_id: number;
  restored_source_ids: number[];
  restored_assignment_count: number;
  rolled_back_at: string;
}

export interface CatalogRequest {
  id: number;
  entity_type: "role" | "department";
  tenant_id?: number | null;
  requested_by_user_id: number;
  requested_by_name?: string | null;
  requested_by_email?: string | null;
  review_status: string;
  proposed_name: string;
  proposed_description?: string | null;
  proposed_parent_id?: number | null;
  proposed_permission_ids: number[];
  decision_note?: string | null;
  approved_entity_id?: number | null;
  reviewed_by_user_id?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  code: string;
  budget?: number;
  company_id?: number;
  manager_name?: string | null;
  created_by_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  personnel?: Array<{ id: number; full_name: string; email?: string; role?: string }>;
}

export interface Personnel {
  id: number;
  email: string;
  work_email?: string | null;
  full_name: string;
  role: "satinalmaci" | "satinalma_uzmani" | "satinalma_yoneticisi" | "satinalma_direktoru" | "admin" | "super_admin" | "channel_owner" | "channel_agent" | "channel_user";
  business_role?: string | null;
  system_role?: string | null;
  tenant_id?: number | null;
  approval_limit: number;
  department_id?: number;
  photo?: string | null;
  personal_phone?: string | null;
  company_phone?: string | null;
  company_phone_short?: string | null;
  address?: string | null;
  hide_location?: boolean;
  share_on_whatsapp?: boolean;
  is_active: boolean;
  company_assignments?: CompanyAssignment[];
  invitation_email_sent?: boolean;
  invitation_accepted?: boolean;
  created_at?: string | null;
}

export type TenantUser = Personnel;

export interface CompanyAssignment {
  id: number;
  user_id: number;
  company_id: number;
  role_id: number;
  department_id?: number | null;
  is_active: boolean;
  sub_items?: string[];
  company?: { id: number; name: string; color: string } | null;
  role?: { id: number; name: string; hierarchy_level: number } | null;
  department?: { id: number; name: string; sub_items?: { id: number; name: string }[] } | null;
}

export interface Company {
  id: number;
  created_by_id?: number | null;
  tenant_id?: number | null;
  name: string;
  short_name?: string | null;
  description?: string;
  logo_url?: string | null;
  color: string;
  is_active: boolean;
  is_primary?: boolean;
  trade_name?: string | null;
  tax_office?: string | null;
  tax_number?: string | null;
  registration_number?: string | null;
  address?: string | null;
  city?: string | null;
  address_district?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  contact_info?: string | null;
  owner_full_name?: string | null;
  owner_email?: string | null;
  hide_location?: boolean;
  share_on_whatsapp?: boolean;
  is_platform_primary?: boolean;
  quote_count?: number;
  personnel_count?: number;
  departments?: Department[];
  created_at: string;
  updated_at: string;
}

export interface AdminSupplierListItem {
  id: number;
  company_name: string;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  category?: string | null;
  category_tags?: string[];
  partner_category_tags?: string[];
  effective_category_tags?: string[];
  source_type?: string;
  is_active?: boolean;
  created_by_id?: number | null;
  tenant_id?: number | null;
  tenant_name?: string | null;
  inviter_company_name?: string | null;
  special_listing_active?: boolean;
  dual_role_status?: string | null;
  linked_tenant_id?: number | null;
}

export interface AdminSupplierUserListItem {
  id: number;
  supplier_id: number;
  name: string;
  email: string;
  phone?: string | null;
  is_active?: boolean;
}

export interface AdminDemoWorkspaceItem {
  key: string;
  workspace_type: "supplier_demo" | "strategic_demo" | "partner_demo";
  title: string;
  scenario: string;
  starts_at?: string | null;
  ends_at?: string | null;
  commission_preview?: string | null;
  related_company_count: number;
  related_supplier_count: number;
  is_active: boolean;
}

export interface Tenant {
  id: number;
  slug: string;
  legal_name: string;
  brand_name?: string | null;
  category?: string | null;
  category_tags?: string[];
  target_category_tags?: string[];
  category_requests?: Array<{
    name: string;
    applies_to?: string | null;
    status: string;
    support_reviewer_name?: string | null;
    support_reviewed_at?: string | null;
    final_reviewer_name?: string | null;
    final_reviewed_at?: string | null;
    note?: string | null;
  }>;
  logo_url?: string | null;
  tax_number?: string | null;
  tax_office?: string | null;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  subscription_plan_code?: string | null;
  owner_user_id?: number | null;
  status: string;
  onboarding_status: string;
  onboarding_payment_status: string;
  onboarding_payment_method?: string | null;
  onboarding_payment_reference_id?: number | null;
  onboarding_payment_verified_at?: string | null;
  onboarding_payment_receipt_url?: string | null;
  onboarding_payment_receipt_name?: string | null;
  onboarding_payment_note?: string | null;
  onboarding_approval_status: string;
  onboarding_rejected_at?: string | null;
  onboarding_rejected_by_user_id?: number | null;
  onboarding_approved_at?: string | null;
  onboarding_approved_by_user_id?: number | null;
  onboarding_approved_by_name?: string | null;
  onboarding_rejected_by_name?: string | null;
  onboarding_activation_notes?: string | null;
  onboarding_tracking_expires_at?: string | null;
  onboarding_decision_timeline?: Array<{
    action: string;
    actor_name: string;
    actor_type: string;
    note?: string | null;
    at: string;
  }>;
  support_status: string;
  is_active: boolean;
  owner_email?: string | null;
  owner_full_name?: string | null;
  initial_admin_invitation_accepted?: boolean;
  activation_delivery_status?: string | null;
  support_owner_name?: string | null;
  support_notes?: string | null;
  support_resolution_reason?: string | null;
  support_last_contacted_at?: string | null;
  initial_admin_email_sent?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionModule {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  limit_key?: string | null;
  limit_value?: number | null;
  unit?: string | null;
}

export interface SubscriptionPlan {
  code: string;
  name: string;
  description: string;
  audience: string;
  is_default?: boolean;
  modules: SubscriptionModule[];
}

export interface SubscriptionCatalog {
  plans: SubscriptionPlan[];
}

export interface SubscriptionTenantUsageMetric {
  key: string;
  label: string;
  used: number;
  limit?: number | null;
  unit?: string | null;
}

export interface SubscriptionTenantUsage {
  tenant_id: number;
  tenant_name: string;
  plan_code: string;
  plan_name: string;
  status: string;
  is_active: boolean;
  metrics: SubscriptionTenantUsageMetric[];
}

export interface SubscriptionCatalogSnapshot {
  catalog: SubscriptionCatalog;
  tenant_usage: SubscriptionTenantUsage[];
}

export interface TenantSubscription {
  id: number;
  tenant_id: number;
  subscription_plan_id?: number | null;
  subscription_plan_code: string;
  billing_provider?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  status: string;
  billing_cycle: string;
  seats_purchased: number;
  trial_ends_at?: string | null;
  current_period_starts_at?: string | null;
  current_period_ends_at?: string | null;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  metadata_json?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingWebhookEvent {
  id: number;
  tenant_id?: number | null;
  tenant_subscription_id?: number | null;
  provider: string;
  event_type: string;
  provider_event_id: string;
  processing_status: string;
  processed_at?: string | null;
  error_message?: string | null;
  received_at: string;
}

export interface BillingInvoice {
  id: number;
  tenant_id: number;
  tenant_subscription_id?: number | null;
  provider_invoice_id?: string | null;
  invoice_number?: string | null;
  status: string;
  currency: string;
  subtotal_amount?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  due_at?: string | null;
  paid_at?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingOverview {
  subscriptions: TenantSubscription[];
  invoices: BillingInvoice[];
  recent_webhook_events: BillingWebhookEvent[];
}

export interface CommercialRequestItem {
  id: number;
  tenant_id?: number | null;
  tenant_name?: string | null;
  request_type: string;
  audience: string;
  status: string;
  source_surface?: string | null;
  package_code?: string | null;
  package_name?: string | null;
  addon_code?: string | null;
  addon_name?: string | null;
  requester_name: string;
  requester_email: string;
  company_name?: string | null;
  phone?: string | null;
  owner_name?: string | null;
  last_contacted_at?: string | null;
  notes?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface SubscriptionAddonAdminItem {
  id: number;
  tenant_id: number;
  tenant_name?: string | null;
  addon_code: string;
  addon_name?: string | null;
  limit_key: string;
  quantity: number;
  increment_per_unit: number;
  total_increment: number;
  status: string;
  payment_transaction_id?: number | null;
  activated_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

export interface BillingWebhookRetryResult {
  id: number;
  provider: string;
  provider_event_id: string;
  event_type: string;
  processing_status: string;
  tenant_id?: number | null;
  tenant_subscription_id?: number | null;
  retried: boolean;
  error_message?: string | null;
}

export interface DiscoveryLabSessionSummary {
  session_id: string;
  source_filename?: string | null;
  status: string;
  quote_id?: number | null;
  project_id?: number | null;
  project_name?: string | null;
  created_by_email?: string | null;
  confirmed_by_email?: string | null;
  created_at: string;
  updated_at: string;
  latest_event_title: string;
  latest_actor?: string | null;
}

export interface DiscoveryLabSummary {
  total_sessions: number;
  locked_sessions: number;
  quote_ready_sessions: number;
  active_project_count: number;
  answer_audit_count: number;
}

export interface DiscoveryLabAnswerAuditSummary {
  id: number;
  session_id?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  quote_id?: number | null;
  quote_status?: string | null;
  tenant_id?: number | null;
  tenant_name?: string | null;
  question_id: number;
  question_text?: string | null;
  answer_text: string;
  decision?: string | null;
  rationale?: string | null;
  created_by_email?: string | null;
  created_at: string;
  source_filename?: string | null;
}

export interface OnboardingStudioSummary {
  tenant_count: number;
  onboarding_queue_count: number;
  owner_pending_count: number;
  branding_pending_count: number;
  new_membership_count: number;
  payment_review_count: number;
  information_requested_count: number;
  activation_approval_waiting_count: number;
  approved_membership_count: number;
  recent_memberships: Tenant[];
  rfq_readiness: {
    quotes_missing_tenant: number;
    approvals_quote_tenant_mismatch: number;
    approvals_missing_tenant: number;
    quotes_project_tenant_mismatch: number;
    supplier_quote_scope_mismatch: number;
    supplier_quotes_platform_network_count: number;
    transition_ready: boolean;
  };
  supplier_mix: {
    private_count: number;
    platform_network_count: number;
  };
}

export interface TenantInitialAdminPayload {
  full_name: string;
  email: string;
  personal_phone?: string;
  company_phone?: string;
  company_phone_short?: string;
}

export interface TenantCreatePayload {
  legal_name: string;
  brand_name?: string;
  category?: string;
  slug?: string;
  logo_url?: string;
  tax_number?: string;
  tax_office?: string;
  country?: string;
  city?: string;
  address?: string;
  subscription_plan_code?: string;
  owner_user_id?: number;
  initial_admin?: TenantInitialAdminPayload;
  status?: string;
  onboarding_status?: string;
  is_active?: boolean;
}

export type TenantUpdatePayload = Partial<TenantCreatePayload>;

export interface TenantSupportWorkflowUpdatePayload {
  support_status?: string | null;
  support_owner_name?: string | null;
  support_notes?: string | null;
  support_resolution_reason?: string | null;
  support_last_contacted_at?: string | null;
}

export async function getTenants(): Promise<Tenant[]> {
  const res = await http.get<Tenant[]>("/admin/tenants");
  return res.data;
}

export async function createTenant(data: TenantCreatePayload): Promise<Tenant> {
  const res = await http.post<Tenant>("/admin/tenants", data);
  return res.data;
}

export async function updateTenant(id: number, data: TenantUpdatePayload): Promise<Tenant> {
  const res = await http.put<Tenant>(`/admin/tenants/${id}`, data);
  return res.data;
}

export async function deleteTenant(id: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/admin/tenants/${id}`);
  return res.data;
}

export async function updateTenantSupportWorkflow(id: number, data: TenantSupportWorkflowUpdatePayload): Promise<Tenant> {
  const res = await http.patch<Tenant>(`/admin/tenants/${id}/support-workflow`, data);
  return res.data;
}

export async function getSubscriptionCatalog(): Promise<SubscriptionCatalogSnapshot> {
  const res = await http.get<SubscriptionCatalogSnapshot>("/admin/subscription-catalog");
  return res.data;
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const res = await http.get<BillingOverview>("/billing/overview");
  return res.data;
}

export async function getCommercialRequests(): Promise<CommercialRequestItem[]> {
  const res = await http.get<CommercialRequestItem[]>("/admin/commercial-requests");
  return res.data;
}

export async function updateCommercialRequestStatus(
  requestId: number,
  payload: { status: string; note?: string; owner_name?: string; mark_contacted_now?: boolean },
): Promise<{ id: number; status: string; review_note?: string | null; owner_name?: string | null; last_contacted_at?: string | null; reviewed_at?: string | null }> {
  const res = await http.post<{ id: number; status: string; review_note?: string | null; owner_name?: string | null; last_contacted_at?: string | null; reviewed_at?: string | null }>(`/admin/commercial-requests/${requestId}/status`, payload);
  return res.data;
}

export async function getSubscriptionAddons(): Promise<SubscriptionAddonAdminItem[]> {
  const res = await http.get<SubscriptionAddonAdminItem[]>("/admin/subscription-addons");
  return res.data;
}

export async function updateSubscriptionAddonLifecycle(
  addonId: number,
  payload: { action: string; expires_at?: string; extension_days?: number },
): Promise<{ id: number; status: string; expires_at?: string | null }> {
  const res = await http.post<{ id: number; status: string; expires_at?: string | null }>(`/admin/subscription-addons/${addonId}/lifecycle`, payload);
  return res.data;
}

export async function retryBillingWebhookEvent(eventId: number): Promise<BillingWebhookRetryResult> {
  const res = await http.post<BillingWebhookRetryResult>(`/billing/webhooks/events/${eventId}/retry`);
  return res.data;
}

// COMPANIES
export async function getCompanies(): Promise<Company[]> {
  const res = await http.get<Company[]>("/admin/companies");
  return res.data;
}

export async function createCompany(data: { name: string; description?: string; logo_url?: string; is_active?: boolean; color?: string; trade_name?: string; tax_office?: string; tax_number?: string; registration_number?: string; address?: string; city?: string; address_district?: string; postal_code?: string; phone?: string; contact_info?: string; hide_location?: boolean; share_on_whatsapp?: boolean }): Promise<Company> {
  const res = await http.post<Company>("/admin/companies", data);
  return res.data;
}

export async function uploadCompanyLogo(companyId: number, file: File): Promise<{ status: string; logo_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await http.post<{ status: string; logo_url: string }>(`/admin/companies/${companyId}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function updateCompany(id: number, data: Partial<Company>): Promise<Company> {
  const res = await http.put<Company>(`/admin/companies/${id}`, data);
  return res.data;
}

export interface CandidateOwner {
  id: number;
  full_name: string;
  email: string;
  system_role: string;
}

export async function getCompanyCandidateOwners(companyId: number): Promise<CandidateOwner[]> {
  const res = await http.get<CandidateOwner[]>(`/admin/companies/${companyId}/candidate-owners`);
  return res.data;
}

export async function createCompanyOwner(
  companyId: number,
  data: { full_name: string; email: string; password: string },
): Promise<{ id: number; email: string; full_name: string; system_role: string; message: string }> {
  const res = await http.post<{ id: number; email: string; full_name: string; system_role: string; message: string }>(
    `/admin/companies/${companyId}/create-owner`,
    data,
  );
  return res.data;
}

export async function setCompanyResponsible(
  companyId: number,
  userId: number,
): Promise<{ message: string; owner_full_name: string; owner_email: string }> {
  const res = await http.patch<{ message: string; owner_full_name: string; owner_email: string }>(
    `/admin/companies/${companyId}/responsible`,
    { user_id: userId },
  );
  return res.data;
}

export async function reactivateUser(
  userId: number,
): Promise<{ message: string; email: string; temp_password: string }> {
  const res = await http.post<{ message: string; email: string; temp_password: string }>(
    `/admin/users/${userId}/reactivate`,
    {},
  );
  return res.data;
}

export interface ProvisionResult {
  summary: {
    total_companies: number;
    already_ok: number;
    created: number;
    assigned_existing: number;
  };
  created_users: { company_id: number; company: string; email: string; password: string }[];
  assigned_users: { company_id: number; company: string; email: string }[];
}

export async function provisionMissingOwners(): Promise<ProvisionResult> {
  const res = await http.post<ProvisionResult>("/admin/companies/provision-missing-owners", {});
  return res.data;
}

export async function deleteCompany(id: number): Promise<void> {
  await http.delete(`/admin/companies/${id}`);
}

// ROLES
export async function getRoles(params?: {
  tenantId?: number;
  includeDuplicates?: boolean;
  excludeReserved?: boolean;
}): Promise<Role[]> {
  const query = new URLSearchParams();
  if (typeof params?.tenantId === "number") {
    query.set("tenant_id", String(params.tenantId));
  }
  if (params?.includeDuplicates) {
    query.set("include_duplicates", "true");
  }
  if (params?.excludeReserved) {
    query.set("exclude_reserved", "true");
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await http.get<Role[]>(`/admin/roles${suffix}`);
  return res.data;
}

export async function createRole(data: {
  name: string;
  description?: string;
  parent_id?: number;
  permission_ids?: number[];
  tenant_id?: number;
}): Promise<Role> {
  const res = await http.post<Role>("/admin/roles", data);
  return res.data;
}

export async function updateRole(id: number, data: {
  name?: string;
  description?: string;
  parent_id?: number | null;
  is_active?: boolean;
  permission_ids?: number[];
}): Promise<Role> {
  const res = await http.put<Role>(`/admin/roles/${id}`, data);
  return res.data;
}

export async function deleteRole(id: number): Promise<void> {
  await http.delete(`/admin/roles/${id}`);
}

export async function getCatalogRequests(params?: { entityType?: string; statusFilter?: string }): Promise<CatalogRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.entityType) {
    searchParams.set("entity_type", params.entityType);
  }
  if (params?.statusFilter) {
    searchParams.set("status_filter", params.statusFilter);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const res = await http.get<CatalogRequest[]>(`/admin/catalog-requests${suffix}`);
  return res.data;
}

export async function createRoleCatalogRequest(data: {
  name: string;
  description?: string;
  parent_id?: number;
  permission_ids?: number[];
}): Promise<CatalogRequest> {
  const res = await http.post<CatalogRequest>("/admin/catalog-requests/roles", data);
  return res.data;
}

export async function createDepartmentCatalogRequest(data: { name: string; description?: string }): Promise<CatalogRequest> {
  const res = await http.post<CatalogRequest>("/admin/catalog-requests/departments", data);
  return res.data;
}

export async function reviewCatalogRequest(id: number, data: { decision: "approved" | "rejected"; note?: string }): Promise<CatalogRequest> {
  const res = await http.post<CatalogRequest>(`/admin/catalog-requests/${id}/review`, data);
  return res.data;
}

export async function getPermissions(): Promise<Permission[]> {
  const res = await http.get<Permission[]>("/admin/permissions");
  return res.data;
}

export async function getPermissionCatalog(): Promise<PermissionCatalogNode[]> {
  const res = await http.get<PermissionCatalogNode[]>("/admin/permission-catalog");
  return res.data;
}

export interface RolePermissionMatrixRow {
  profile: string;
  business_role: string;
  system_role: string;
  enabled_keys: string[];
}

export async function getRolePermissionMatrix(): Promise<RolePermissionMatrixRow[]> {
  const res = await http.get<RolePermissionMatrixRow[]>("/admin/role-permission-matrix");
  return res.data;
}

export async function getWorkspacePanelConfig(): Promise<WorkspacePanelConfig> {
  const res = await http.get<WorkspacePanelConfig>("/admin/workspace-panels");
  return res.data;
}

export async function updateWorkspacePanelConfig(
  payload: WorkspacePanelConfig,
): Promise<WorkspacePanelConfig> {
  const res = await http.put<WorkspacePanelConfig>("/admin/workspace-panels", payload);
  return res.data;
}

export async function getCommercialRequestWebhookSettings(): Promise<CommercialRequestWebhookSettings> {
  const res = await http.get<CommercialRequestWebhookSettings>("/admin/commercial-request-webhook-settings");
  return res.data;
}

export async function updateCommercialRequestWebhookSettings(
  payload: { webhook_url?: string | null; webhook_secret?: string | null; clear_webhook_secret?: boolean },
): Promise<CommercialRequestWebhookSettings> {
  const res = await http.put<CommercialRequestWebhookSettings>("/admin/commercial-request-webhook-settings", payload);
  return res.data;
}

export async function getCommercialRequestWebhookDeliveries(): Promise<CommercialRequestWebhookDelivery[]> {
  const res = await http.get<CommercialRequestWebhookDelivery[]>("/admin/commercial-request-webhook-deliveries");
  return res.data;
}

export async function retryCommercialRequestWebhookDelivery(deliveryId: number): Promise<CommercialRequestWebhookDelivery> {
  const res = await http.post<CommercialRequestWebhookDelivery>(`/admin/commercial-request-webhook-deliveries/${deliveryId}/retry`);
  return res.data;
}

export async function getPaymentProviders(): Promise<{ providers: PaymentProviderCatalogItem[] }> {
  const res = await http.get<{ providers: PaymentProviderCatalogItem[] }>("/payment/providers");
  return res.data;
}

export async function getPaymentProviderSettings(): Promise<PaymentProviderSettingItem[]> {
  const res = await http.get<PaymentProviderSettingItem[]>("/admin/payment-providers");
  return res.data;
}

export async function updatePaymentProviderSetting(
  providerCode: string,
  payload: {
    is_active?: boolean | null;
    credentials?: Record<string, string>;
    notes?: string | null;
  },
): Promise<PaymentProviderSettingItem> {
  const res = await http.put<PaymentProviderSettingItem>(`/admin/payment-providers/${providerCode}`, payload);
  return res.data;
}

export async function getCampaignPrograms(): Promise<CampaignProgram[]> {
  const res = await http.get<CampaignProgram[]>("/admin/campaigns");
  return res.data;
}

export async function createCampaignProgram(data: {
  code: string;
  name: string;
  description?: string;
  audience_type: string;
  trigger_event: string;
  status?: string;
  is_public?: boolean;
  rules: CampaignRule[];
}): Promise<CampaignProgram> {
  const res = await http.post<CampaignProgram>("/admin/campaigns", data);
  return res.data;
}

export async function recordCampaignEvent(data: {
  campaign_id: number;
  owner_type: string;
  owner_id: number;
  event_type: string;
  quantity?: number;
  source_reference?: string;
  metadata_json?: string;
}): Promise<{ campaign_id: number; owner_type: string; owner_id: number; progress_count: number; new_grant_ids: number[] }> {
  const res = await http.post<{ campaign_id: number; owner_type: string; owner_id: number; progress_count: number; new_grant_ids: number[] }>("/admin/campaigns/events", data);
  return res.data;
}

export async function applyCampaignGrant(grant_id: number): Promise<CampaignRewardGrant> {
  const res = await http.post<CampaignRewardGrant>("/admin/campaigns/apply-grant", { grant_id });
  return res.data;
}

// DEPARTMENTS
export async function getDepartments(params?: {
  tenantId?: number;
  includeDuplicates?: boolean;
}): Promise<Department[]> {
  const query = new URLSearchParams();
  if (typeof params?.tenantId === "number") {
    query.set("tenant_id", String(params.tenantId));
  }
  if (params?.includeDuplicates) {
    query.set("include_duplicates", "true");
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await http.get<Department[]>(`/admin/departments${suffix}`);
  return res.data;
}

export async function createDepartment(data: { name: string; description?: string; tenant_id?: number }): Promise<Department> {
  const res = await http.post<Department>("/admin/departments", data);
  return res.data;
}

export async function updateDepartment(id: number, data: Partial<Department>): Promise<Department> {
  const res = await http.put<Department>(`/admin/departments/${id}`, data);
  return res.data;
}

export async function deleteDepartment(id: number): Promise<void> {
  await http.delete(`/admin/departments/${id}`);
}

export async function getCatalogMergePreview(params: {
  entityType: "role" | "department";
  tenantId?: number | null;
}): Promise<CatalogMergePreview> {
  const searchParams = new URLSearchParams();
  searchParams.set("entity_type", params.entityType);
  if (typeof params.tenantId === "number") {
    searchParams.set("tenant_id", String(params.tenantId));
  }
  const res = await http.get<CatalogMergePreview>(`/admin/catalog-merges/preview?${searchParams.toString()}`);
  return res.data;
}

export async function applyCatalogMerge(data: {
  entity_type: "role" | "department";
  source_ids: number[];
  target_id: number;
}): Promise<CatalogMergeApplyResult> {
  const res = await http.post<CatalogMergeApplyResult>("/admin/catalog-merges/apply", data);
  return res.data;
}

export async function rollbackCatalogMerge(rollbackToken: string): Promise<CatalogMergeRollbackResult> {
  const res = await http.post<CatalogMergeRollbackResult>("/admin/catalog-merges/rollback", { rollback_token: rollbackToken });
  return res.data;
}

// PROJECTS
export async function getProjects(): Promise<Project[]> {
  const res = await http.get<Project[]>("/admin/projects");
  return res.data;
}

export async function getDiscoveryLabSessions(params?: {
  limit?: number;
  statusFilter?: string;
  projectQuery?: string;
  userQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<DiscoveryLabSessionSummary[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 6));
  if (params?.statusFilter) {
    searchParams.set("status_filter", params.statusFilter);
  }
  if (params?.projectQuery) {
    searchParams.set("project_query", params.projectQuery);
  }
  if (params?.userQuery) {
    searchParams.set("user_query", params.userQuery);
  }
  if (params?.dateFrom) {
    searchParams.set("date_from", params.dateFrom);
  }
  if (params?.dateTo) {
    searchParams.set("date_to", params.dateTo);
  }
  if (params?.search) {
    searchParams.set("search", params.search);
  }
  const res = await http.get<{ items: DiscoveryLabSessionSummary[] }>(`/ai-lab/admin/sessions?${searchParams.toString()}`);
  return res.data.items;
}

export async function getDiscoveryLabSummary(params?: {
  statusFilter?: string;
  projectQuery?: string;
  userQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<DiscoveryLabSummary> {
  const searchParams = new URLSearchParams();
  if (params?.statusFilter) {
    searchParams.set("status_filter", params.statusFilter);
  }
  if (params?.projectQuery) {
    searchParams.set("project_query", params.projectQuery);
  }
  if (params?.userQuery) {
    searchParams.set("user_query", params.userQuery);
  }
  if (params?.dateFrom) {
    searchParams.set("date_from", params.dateFrom);
  }
  if (params?.dateTo) {
    searchParams.set("date_to", params.dateTo);
  }
  if (params?.search) {
    searchParams.set("search", params.search);
  }
  const suffix = searchParams.toString();
  const res = await http.get<DiscoveryLabSummary>(`/ai-lab/admin/summary${suffix ? `?${suffix}` : ""}`);
  return res.data;
}

export async function getDiscoveryLabAnswerAudits(params?: {
  limit?: number;
  sessionId?: string;
  projectQuery?: string;
  userQuery?: string;
  decision?: string;
  search?: string;
}): Promise<DiscoveryLabAnswerAuditSummary[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit ?? 8));
  if (params?.sessionId) {
    searchParams.set("session_id", params.sessionId);
  }
  if (params?.projectQuery) {
    searchParams.set("project_query", params.projectQuery);
  }
  if (params?.userQuery) {
    searchParams.set("user_query", params.userQuery);
  }
  if (params?.decision) {
    searchParams.set("decision", params.decision);
  }
  if (params?.search) {
    searchParams.set("search", params.search);
  }
  const res = await http.get<{ items: DiscoveryLabAnswerAuditSummary[] }>(`/ai-lab/admin/answers?${searchParams.toString()}`);
  return res.data.items;
}

export async function getOnboardingStudioSummary(): Promise<OnboardingStudioSummary> {
  const res = await http.get<OnboardingStudioSummary>("/admin/onboarding-studio/summary");
  return res.data;
}

export async function verifyTenantOnboardingPayment(id: number): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/verify-onboarding-payment`);
  return res.data;
}

export async function approveTenantOnboardingActivation(id: number): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/approve-onboarding-activation`);
  return res.data;
}

export async function forceApproveTenantOnboardingActivation(id: number): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/approve-onboarding-activation-force`);
  return res.data;
}

export async function rejectTenantOnboardingActivation(id: number, note?: string): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/reject-onboarding-activation`, { note });
  return res.data;
}

export async function requestTenantOnboardingInfo(id: number, note?: string): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/request-onboarding-info`, { note });
  return res.data;
}

export async function reviewTenantCategoryRequest(
  id: number,
  payload: { category_name: string; decision: string; note?: string }
): Promise<Tenant> {
  const res = await http.post<Tenant>(`/admin/tenants/${id}/category-requests/review`, payload);
  return res.data;
}

export async function createProject(data: {
  name: string;
  code: string;
  description?: string;
  budget?: number;
  company_id?: number;
  project_type?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  manager_name?: string;
  manager_phone?: string;
  is_active?: boolean;
}): Promise<Project> {
  const res = await http.post<Project>("/admin/projects", data);
  return res.data;
}

export async function updateProject(id: number, data: Partial<Project>): Promise<Project> {
  const res = await http.put<Project>(`/admin/projects/${id}`, data);
  return res.data;
}

export async function deleteProject(id: number): Promise<void> {
  await http.delete(`/admin/projects/${id}`);
}

// PERSONNEL/USERS
export type AdminUsersScopeFilter = "all" | "portal" | "partner" | "channel" | "supplier";
export type AdminUsersStatusFilter = "all" | "active" | "passive";

export interface TenantUsersQueryParams {
  scope?: AdminUsersScopeFilter;
  statusFilter?: AdminUsersStatusFilter;
  ownerUserId?: number;
}

export async function getPersonnel(params?: TenantUsersQueryParams): Promise<Personnel[]> {
  const searchParams = new URLSearchParams();
  if (params?.scope) {
    searchParams.set("scope", params.scope);
  }
  if (params?.statusFilter) {
    searchParams.set("status_filter", params.statusFilter);
  }
  if (params?.ownerUserId != null) {
    searchParams.set("owner_user_id", String(params.ownerUserId));
  }

  const query = searchParams.toString();
  const endpoint = query ? `/admin/users?${query}` : "/admin/users";
  const res = await http.get<Personnel[]>(endpoint);
  return res.data;
}

export async function getTenantUsers(params?: TenantUsersQueryParams): Promise<TenantUser[]> {
  return getPersonnel(params);
}

export async function getAdminChannelUsers(channelOrgId?: number): Promise<TenantUser[]> {
  const res = await http.get<TenantUser[]>("/admin/channel-users", {
    params: channelOrgId === undefined ? undefined : { channel_org_id: channelOrgId },
  });
  return res.data;
}

export async function getAdminDemoWorkspaces(): Promise<AdminDemoWorkspaceItem[]> {
  const res = await http.get<AdminDemoWorkspaceItem[]>("/admin/demo-workspaces");
  return res.data;
}


export interface PersonnelCreatePayload {
  email: string;
  work_email?: string;
  full_name: string;
  password?: string;
  role: string;
  system_role?: string;
  tenant_id?: number;
  approval_limit?: number;
  department_id?: number;
  photo?: string | null;
  personal_phone?: string;
  company_phone?: string;
  company_phone_short?: string;
  address?: string;
  hide_location?: boolean;
  share_on_whatsapp?: boolean;
}

export type TenantUserCreatePayload = PersonnelCreatePayload;

export async function createPersonnel(data: PersonnelCreatePayload): Promise<Personnel> {
  const res = await http.post<Personnel>("/admin/users", data);
  return res.data;
}

export async function createTenantUser(data: TenantUserCreatePayload): Promise<TenantUser> {
  return createPersonnel(data);
}


export interface PersonnelUpdatePayload extends Partial<PersonnelCreatePayload> {
  is_active?: boolean;
}

export type TenantUserUpdatePayload = PersonnelUpdatePayload;

export async function updatePersonnel(id: number, data: PersonnelUpdatePayload): Promise<Personnel> {
  const res = await http.put<Personnel>(`/admin/users/${id}`, data);
  return res.data;
}

export async function updateTenantUser(id: number, data: TenantUserUpdatePayload): Promise<TenantUser> {
  return updatePersonnel(id, data);
}

export async function deletePersonnel(id: number): Promise<void> {
  await http.delete(`/admin/users/${id}`);
}

export async function deleteTenantUser(id: number): Promise<void> {
  await deletePersonnel(id);
}

export async function resendUserInvitation(userId: number): Promise<{ status: string; message: string; invitation_email_sent: boolean }> {
  const res = await http.post<{ status: string; message: string; invitation_email_sent: boolean }>(`/users/${userId}/resend-invitation`);
  return res.data;
}

export async function adminResetPassword(userId: number): Promise<{ message: string; temp_password: string }> {
  const res = await http.post<{ message: string; temp_password: string }>(`/admin/users/${userId}/reset-password`, {});
  return res.data;
}

export async function resendTenantUserInvitation(userId: number): Promise<{ status: string; message: string; invitation_email_sent: boolean }> {
  const res = await http.post<{ status: string; message: string; invitation_email_sent: boolean }>(`/admin/users/${userId}/resend-invitation`, {});
  return res.data;
}

export async function sendAdminUserEmail(
  userId: number,
  payload: {
    to_email: string;
    subject: string;
    body: string;
    cc?: string;
    system_email_id?: number;
    attachments?: File[];
  },
): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("to_email", payload.to_email);
  form.append("subject", payload.subject);
  form.append("body", payload.body);
  if (payload.cc) form.append("cc", payload.cc);
  if (payload.system_email_id !== undefined) form.append("system_email_id", String(payload.system_email_id));
  for (const file of payload.attachments || []) {
    form.append("attachments", file);
  }
  const res = await http.post<{ status: string; message: string }>(
    `/admin/users/${userId}/contact-email`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

// COMPANY ASSIGNMENTS
export async function getUserCompanyAssignments(userId: number): Promise<CompanyAssignment[]> {
  const res = await http.get<CompanyAssignment[]>(`/admin/users/${userId}/company-assignments`);
  return res.data;
}

export async function addUserCompanyAssignment(
  userId: number,
  data: { company_id: number; role_id: number; department_id?: number | null; sub_items?: string[] }
): Promise<CompanyAssignment> {
  const res = await http.post<CompanyAssignment>(`/admin/users/${userId}/company-assignments`, data);
  return res.data;
}

export async function updateUserCompanyAssignment(
  userId: number,
  assignmentId: number,
  data: { role_id?: number; department_id?: number | null; sub_items?: string[] }
): Promise<CompanyAssignment> {
  const res = await http.put<CompanyAssignment>(`/admin/users/${userId}/company-assignments/${assignmentId}`, data);
  return res.data;
}

export async function removeUserCompanyAssignment(userId: number, assignmentId: number): Promise<void> {
  await http.delete(`/admin/users/${userId}/company-assignments/${assignmentId}`);
}

export async function getUserPermissionOverrides(userId: number): Promise<UserPermissionOverride[]> {
  const res = await http.get<UserPermissionOverride[]>(`/admin/users/${userId}/permission-overrides`);
  return res.data;
}

export async function replaceUserPermissionOverrides(
  userId: number,
  items: UserPermissionOverrideItem[],
): Promise<UserPermissionOverride[]> {
  const res = await http.put<UserPermissionOverride[]>(`/admin/users/${userId}/permission-overrides`, { items });
  return res.data;
}

export async function getRolePermissionDelegations(params?: {
  system_role?: string;
  business_role?: string;
}): Promise<RolePermissionDelegation[]> {
  const searchParams = new URLSearchParams();
  if (params?.system_role) searchParams.set("system_role", params.system_role);
  if (params?.business_role) searchParams.set("business_role", params.business_role);
  const suffix = searchParams.toString();
  const res = await http.get<RolePermissionDelegation[]>(`/admin/role-permission-delegations${suffix ? `?${suffix}` : ""}`);
  return res.data;
}

export async function replaceRolePermissionDelegations(payload: {
  system_role?: string;
  business_role?: string;
  items: RolePermissionDelegationItem[];
}): Promise<RolePermissionDelegation[]> {
  const res = await http.put<RolePermissionDelegation[]>("/admin/role-permission-delegations", payload);
  return res.data;
}

export async function assignPersonnelToProject(userId: number, projectId: number): Promise<{ message: string }> {
  const res = await http.post<{ message: string }>(`/admin/users/${userId}/projects/${projectId}`, {});
  return res.data;
}

export async function assignTenantUserToProject(userId: number, projectId: number): Promise<{ message: string }> {
  return assignPersonnelToProject(userId, projectId);
}

export async function removePersonnelFromProject(userId: number, projectId: number): Promise<{ message: string }> {
  const res = await http.delete<{ message: string }>(`/admin/users/${userId}/projects/${projectId}`);
  return res.data;
}

export async function removeTenantUserFromProject(userId: number, projectId: number): Promise<{ message: string }> {
  return removePersonnelFromProject(userId, projectId);
}

// PROJECT FILES
export async function uploadProjectFile(projectId: number, file: File): Promise<ProjectFile> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await http.post(`/admin/projects/${projectId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

export async function getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  const res = await http.get(`/admin/projects/${projectId}/files`);
  return res.data;
}

export async function deleteProjectFile(fileId: number): Promise<{ message: string }> {
  const res = await http.delete(`/admin/files/${fileId}`);
  return res.data;
}

export interface AdminSupplierPaymentAccount {
  id?: number;
  bank_key?: string | null;
  bank_name: string;
  iban: string;
  account_type: "tl" | "doviz";
}

export interface AdminSupplierGuarantee {
  id: number;
  title: string;
  guarantee_type: string;
  amount?: number | null;
  currency?: string;
  issued_at?: string | null;
  expires_at?: string | null;
  status: string;
}

export type AdminSupplierDocCategory = "certificates" | "company_docs" | "personnel_docs" | "guarantee_docs";

export interface AdminSupplierDocumentItem {
  id: number;
  category: AdminSupplierDocCategory;
  original_filename: string;
  stored_filename?: string;
  file_url: string;
  file_size?: number;
  content_type?: string;
  created_at?: string;
}

export interface AdminSupplierUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  email_verified: boolean;
  password_set?: boolean;
  is_default: boolean;
}

export interface SupplierFinanceContractItem {
  id: number;
  quote_id: number;
  contract_number: string;
  status: string;
  final_amount: number;
  signed_at?: string | null;
  created_at?: string;
}

export interface SupplierFinanceInvoiceItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  amount: number;
  currency: string;
  file_url?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SupplierFinancePaymentItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  payment_date?: string | null;
  amount: number;
  currency: string;
  method?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SupplierFinancePhotoItem {
  id: number;
  supplier_id: number;
  contract_id?: number | null;
  title: string;
  file_url: string;
  description?: string | null;
  created_at?: string;
}

export interface SupplierFinanceSummary {
  contracts: SupplierFinanceContractItem[];
  invoices: SupplierFinanceInvoiceItem[];
  payments: SupplierFinancePaymentItem[];
  photos: SupplierFinancePhotoItem[];
  totals: {
    contract_total: number;
    invoice_total: number;
    payment_total: number;
    delta_invoice_vs_contract: number;
    delta_payment_vs_contract: number;
    delta_payment_vs_invoice: number;
  };
  alerts: string[];
}

export interface AdminSupplierManagementResponse {
  supplier: {
    id: number;
    is_active?: boolean;
    company_name: string;
    company_title?: string | null;
    tax_number?: string | null;
    registration_number?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    address_district?: string | null;
    postal_code?: string | null;
    invoice_name?: string | null;
    invoice_address?: string | null;
    invoice_city?: string | null;
    invoice_district?: string | null;
    invoice_postal_code?: string | null;
    tax_office?: string | null;
    notes?: string | null;
    category?: string | null;
    category_tags: string[];
    partner_category_tags: string[];
    effective_category_tags: string[];
    logo_url?: string | null;
    payment_accounts: AdminSupplierPaymentAccount[];
    accepts_checks: boolean;
    preferred_check_term?: string | null;
  };
  users: AdminSupplierUser[];
  users_count: number;
  default_user_id?: number | null;
  guarantees: AdminSupplierGuarantee[];
}

export async function getAdminSupplierManagementDetail(supplierId: number): Promise<AdminSupplierManagementResponse> {
  const res = await http.get<AdminSupplierManagementResponse>(`/suppliers/${supplierId}/management`);
  return res.data;
}

export async function getAdminSuppliers(params?: { filter_active?: boolean; source_type?: string }): Promise<AdminSupplierListItem[]> {
  const res = await http.get<AdminSupplierListItem[]>('/suppliers', { params });
  return res.data;
}

export async function seedRoleCatalogs(): Promise<{ message: string; created: Record<string, number>; updated: Record<string, number> }> {
  const res = await http.post('/admin/seed-role-catalogs', {});
  return res.data;
}

export async function resetRoleCatalogs(): Promise<{ message: string; deleted: Record<string, number>; created: Record<string, number>; updated: Record<string, number> }> {
  const res = await http.post('/admin/reset-role-catalogs', {});
  return res.data;
}

export async function getAdminSupplierUsers(supplierId: number): Promise<AdminSupplierUserListItem[]> {
  const res = await http.get<AdminSupplierUserListItem[]>(`/suppliers/${supplierId}/users`);
  return res.data;
}

export async function deleteAdminSupplier(supplierId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}`);
  return res.data;
}

export async function getAdminTenantSuppliers(tenantId: number): Promise<AdminSupplierListItem[]> {
  const res = await http.get<AdminSupplierListItem[]>(`/admin/tenants/${tenantId}/suppliers`);
  return res.data;
}

export async function updateAdminSupplierManagementDetail(supplierId: number, payload: Partial<AdminSupplierManagementResponse["supplier"]>): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/management`, payload);
  return res.data;
}

export async function createAdminSupplierGuarantee(
  supplierId: number,
  payload: {
    title: string;
    guarantee_type: string;
    amount?: number | null;
    currency?: string;
    issued_at?: string | null;
    expires_at?: string | null;
  },
): Promise<{ status: string; message: string }> {
  const res = await http.post<{ status: string; message: string }>(`/suppliers/${supplierId}/guarantees`, payload);
  return res.data;
}

export async function updateAdminSupplierGuarantee(
  supplierId: number,
  guaranteeId: number,
  payload: {
    title: string;
    guarantee_type: string;
    amount?: number | null;
    currency?: string;
    issued_at?: string | null;
    expires_at?: string | null;
    status?: string;
  },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/guarantees/${guaranteeId}`, payload);
  return res.data;
}

export async function deleteAdminSupplierGuarantee(supplierId: number, guaranteeId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/guarantees/${guaranteeId}`);
  return res.data;
}

export async function updateAdminSupplierUser(
  supplierId: number,
  userId: number,
  payload: { name?: string; email?: string; phone?: string; is_active?: boolean },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/users/${userId}`, payload);
  return res.data;
}

export async function deleteAdminSupplierUser(supplierId: number, userId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/users/${userId}`);
  return res.data;
}

export async function setAdminSupplierDefaultUser(supplierId: number, userId: number): Promise<{ status: string; message: string }> {
  const res = await http.post<{ status: string; message: string }>(`/suppliers/${supplierId}/users/${userId}/set-default`);
  return res.data;
}

export async function createAdminSupplierUser(
  supplierId: number,
  payload: { name: string; email: string; phone?: string },
): Promise<{ id: number; name: string; email: string }> {
  const res = await http.post<{ id: number; name: string; email: string }>(`/suppliers/${supplierId}/users`, payload);
  return res.data;
}

export async function resendAdminSupplierMagicLink(
  supplierId: number,
  userId: number,
): Promise<{ status: string; message: string; magic_link_sent: boolean }> {
  const res = await http.post<{ status: string; message: string; magic_link_sent: boolean }>(`/suppliers/${supplierId}/users/${userId}/resend-magic-link`, {});
  return res.data;
}

export async function listAdminSupplierDocuments(
  supplierId: number,
  category?: AdminSupplierDocCategory,
): Promise<AdminSupplierDocumentItem[]> {
  const res = await http.get<{ documents: AdminSupplierDocumentItem[] }>(`/suppliers/${supplierId}/documents`, {
    params: category ? { category } : undefined,
  });
  return res.data.documents ?? [];
}

export async function deleteAdminSupplierDocument(
  supplierId: number,
  documentId: number,
): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/documents/${documentId}`);
  return res.data;
}

export async function uploadAdminSupplierDocument(
  supplierId: number,
  category: AdminSupplierDocCategory,
  file: File,
): Promise<AdminSupplierDocumentItem> {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post<{ status: string; document: AdminSupplierDocumentItem }>(
    `/suppliers/${supplierId}/documents/${category}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.document;
}

export async function sendAdminSupplierEmail(
  supplierId: number,
  payload: {
    to_email: string;
    subject: string;
    body: string;
    cc?: string;
    attachments?: File[];
  },
): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("to_email", payload.to_email);
  form.append("subject", payload.subject);
  form.append("body", payload.body);
  if (payload.cc) {
    form.append("cc", payload.cc);
  }
  for (const file of payload.attachments || []) {
    form.append("attachments", file);
  }
  const res = await http.post<{ status: string; message: string }>(
    `/suppliers/${supplierId}/contact-email`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function getAdminSupplierFinanceSummary(
  supplierId: number,
  params?: { query?: string; date_from?: string; date_to?: string },
): Promise<SupplierFinanceSummary> {
  const res = await http.get<SupplierFinanceSummary>(`/suppliers/${supplierId}/finance-summary`, { params });
  return res.data;
}

export async function createAdminSupplierFinanceInvoice(
  supplierId: number,
  payload: {
    title: string;
    amount: number;
    contract_id?: number;
    invoice_number?: string;
    invoice_date?: string;
    currency?: string;
    notes?: string;
    file?: File;
  },
): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("title", payload.title);
  form.append("amount", String(payload.amount));
  if (payload.contract_id) form.append("contract_id", String(payload.contract_id));
  if (payload.invoice_number) form.append("invoice_number", payload.invoice_number);
  if (payload.invoice_date) form.append("invoice_date", payload.invoice_date);
  if (payload.currency) form.append("currency", payload.currency);
  if (payload.notes) form.append("notes", payload.notes);
  if (payload.file) form.append("file", payload.file);

  const res = await http.post<{ status: string; message: string }>(
    `/suppliers/${supplierId}/finance/invoices`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function createAdminSupplierFinancePayment(
  supplierId: number,
  payload: {
    title: string;
    amount: number;
    contract_id?: number;
    payment_date?: string;
    currency?: string;
    method?: string;
    notes?: string;
  },
): Promise<{ status: string; message: string }> {
  const res = await http.post<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/payments`, payload);
  return res.data;
}

export async function createAdminSupplierFinancePhoto(
  supplierId: number,
  payload: {
    title: string;
    contract_id?: number;
    description?: string;
    file: File;
  },
): Promise<{ status: string; message: string }> {
  const form = new FormData();
  form.append("title", payload.title);
  if (payload.contract_id) form.append("contract_id", String(payload.contract_id));
  if (payload.description) form.append("description", payload.description);
  form.append("file", payload.file);

  const res = await http.post<{ status: string; message: string }>(
    `/suppliers/${supplierId}/finance/photos`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function updateAdminSupplierFinanceInvoice(
  supplierId: number,
  invoiceId: number,
  payload: { title?: string; invoice_number?: string; invoice_date?: string; amount?: number; currency?: string; notes?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/invoices/${invoiceId}`, payload);
  return res.data;
}

export async function deleteAdminSupplierFinanceInvoice(supplierId: number, invoiceId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/invoices/${invoiceId}`);
  return res.data;
}

export async function updateAdminSupplierFinancePayment(
  supplierId: number,
  paymentId: number,
  payload: { title?: string; payment_date?: string; amount?: number; currency?: string; method?: string; notes?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/payments/${paymentId}`, payload);
  return res.data;
}

export async function deleteAdminSupplierFinancePayment(supplierId: number, paymentId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/payments/${paymentId}`);
  return res.data;
}

export async function updateAdminSupplierFinancePhoto(
  supplierId: number,
  photoId: number,
  payload: { title?: string; description?: string },
): Promise<{ status: string; message: string }> {
  const res = await http.put<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/photos/${photoId}`, payload);
  return res.data;
}

export async function deleteAdminSupplierFinancePhoto(supplierId: number, photoId: number): Promise<{ status: string; message: string }> {
  const res = await http.delete<{ status: string; message: string }>(`/suppliers/${supplierId}/finance/photos/${photoId}`);
  return res.data;
}

export async function getFinanceMismatches(limit = 10): Promise<{
  items: Array<{
    supplier_id: number;
    supplier_name: string;
    alerts: string[];
    totals: {
      contract_total: number;
      invoice_total: number;
      payment_total: number;
      delta_invoice_vs_contract: number;
      delta_payment_vs_contract: number;
      delta_payment_vs_invoice: number;
    };
  }>;
}> {
  const res = await http.get(`/suppliers/finance-mismatches`, { params: { limit } });
  return res.data;
}

export interface QuotePriceRules {
  max_markup_percent: number;
  max_discount_percent: number;
  tolerance_amount: number;
  block_on_violation: boolean;
  updated_at?: string | null;
}

export async function getQuotePriceRules(): Promise<QuotePriceRules> {
  const res = await http.get<QuotePriceRules>("/supplier-quotes/price-rules");
  return res.data;
}

// ---------------------------------------------------------------------------
// Destek Talebi (Support Tickets)
// ---------------------------------------------------------------------------

export interface SupportTicket {
  id: number;
  tenant_id: number;
  created_by_user_id: number;
  assigned_to_user_id: number | null;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  source: string;
  resolution_note: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  is_visible_to_tenant: boolean;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  assigned_to_name: string | null;
  tenant_name: string | null;
}

export interface TicketCreatePayload {
  subject: string;
  description?: string;
  category?: string;
  priority?: string;
  source?: string;
}

export interface TicketAdminUpdatePayload {
  status?: string;
  assigned_to_user_id?: number | null;
  resolution_note?: string;
  priority?: string;
}

export async function createSupportTicket(data: TicketCreatePayload): Promise<SupportTicket> {
  const res = await http.post<SupportTicket>("/support/tickets", data);
  return res.data;
}

export async function getMySupportTickets(statusFilter?: string): Promise<SupportTicket[]> {
  const params = statusFilter ? { status: statusFilter } : undefined;
  const res = await http.get<SupportTicket[]>("/support/tickets", { params });
  return res.data;
}

export async function getSupportTicketDetail(id: number): Promise<SupportTicket> {
  const res = await http.get<SupportTicket>(`/support/tickets/${id}`);
  return res.data;
}

export async function adminListSupportTickets(params?: {
  tenant_id?: number;
  status?: string;
  category?: string;
  priority?: string;
  limit?: number;
}): Promise<SupportTicket[]> {
  const res = await http.get<SupportTicket[]>("/admin/support/tickets", { params });
  return res.data;
}

export async function adminUpdateSupportTicket(
  id: number,
  data: TicketAdminUpdatePayload,
): Promise<SupportTicket> {
  const res = await http.patch<SupportTicket>(`/admin/support/tickets/${id}`, data);
  return res.data;
}

export async function updateQuotePriceRules(payload: Omit<QuotePriceRules, "updated_at">): Promise<QuotePriceRules> {
  const res = await http.put<QuotePriceRules>("/supplier-quotes/price-rules", payload);
  return res.data;
}
