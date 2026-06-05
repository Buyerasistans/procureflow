// FILE: web/src/services/profile.service.ts
import { http } from "../lib/http";

export interface UserProfile {
  id: number;
  email: string;
  work_email?: string | null;
  full_name: string;
  role: string;
  system_role: string;
  is_active: boolean;
  tenant_id?: number | null;
  department_id?: number | null;
  approval_limit: number;
  photo?: string | null;
  personal_phone?: string | null;
  company_phone?: string | null;
  company_phone_short?: string | null;
  address?: string | null;
  hide_location?: boolean;
  share_on_whatsapp?: boolean;
  totp_enabled?: boolean;
  login_notifications?: boolean;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface ProfileUpdate {
  full_name?: string;
  work_email?: string | null;
  personal_phone?: string | null;
  company_phone?: string | null;
  company_phone_short?: string | null;
  address?: string | null;
  hide_location?: boolean;
  share_on_whatsapp?: boolean;
  photo?: string | null;
  login_notifications?: boolean;
}

export interface SessionInfo {
  id: number;
  created_at: string | null;
  expires_at: string;
}

export interface TwoFaSetupResult {
  secret: string;
  qr_data_url: string;
}

export interface ChannelProfileSummary {
  owner_user_id: number;
  partner_type: string;
  display_name: string;
  level_code: string;
  star_score: number;
  performance_score: number;
  total_team_size: number;
  active_team_size: number;
  last_30d_new_customers: number;
  commission_pending: number;
  commission_approved: number;
  commission_paid: number;
  commission_net_current_month: number;
}

export interface ChannelReferralLink {
  link_id: number;
  link_code: string;
  short_url: string | null;
  qr_url: string | null;
  campaign_id: number | null;
  target_type: string;
  is_active: boolean;
}

export interface ChannelReferralLinkCreatePayload {
  campaign_id?: number | null;
  target_type?: "mixed" | "partner" | "supplier";
  landing_path?: string | null;
  short_url?: string | null;
}

export interface ChannelConversionMetrics {
  clicks: number;
  signups: number;
  activations: number;
  converted_partner_count: number;
  converted_supplier_count: number;
  supplier_to_partner_count: number;
  funnel_ratio_click_to_signup: number;
  funnel_ratio_signup_to_activation: number;
  funnel_ratio_activation_to_partner: number;
  referral_breakdown: {
    link_code: string;
    target_type: string | null;
    clicks: number;
    signups: number;
    activations: number;
    net_commission: number;
  }[];
  daily_trend: {
    day: string;
    clicks: number;
    signups: number;
    activations: number;
  }[];
}

export interface ChannelCommissionReportTotals {
  pending: number;
  approved: number;
  paid: number;
  net: number;
}

export interface ChannelCommissionByEvent {
  event_type: string;
  amount: number;
}

export interface ChannelCommissionDailyTrend {
  day: string;
  net_amount: number;
}

export interface ChannelCommissionReport {
  period: string;
  totals: ChannelCommissionReportTotals;
  by_event_type: ChannelCommissionByEvent[];
  daily_trend: ChannelCommissionDailyTrend[];
  entry_count: number;
}

export interface ChannelCommissionRecalculateResponse {
  period: string;
  generated_entries: number;
  skipped_existing: number;
  skipped_missing_amount: number;
  skipped_missing_contract: number;
}

export interface TeamHierarchyNode {
  user_id: number;
  display_name: string;
  email: string;
  role_profile_code: string;
  depth: number;
  parent_user_id: number | null;
  is_active: boolean;
  joined_at: string;
  referral_count: number;
}

export interface TeamHierarchy {
  root_user_id: number;
  total_members: number;
  active_members: number;
  nodes: TeamHierarchyNode[];
}

/**
 * Kendi profilimi getir
 */
export async function getMyProfile(): Promise<UserProfile> {
  const res = await http.get<UserProfile>("/users/profile");
  return res.data;
}

/**
 * Kendi profilimi güncelle
 */
export async function updateMyProfile(
  payload: ProfileUpdate
): Promise<UserProfile> {
  const res = await http.put<UserProfile>("/users/profile", payload);
  return res.data;
}

/**
 * Şifre değiştir
 */
export async function changePassword(
  old_password: string,
  new_password: string
): Promise<{ message: string }> {
  const res = await http.post<{ message: string }>(
    "/users/profile/change-password",
    { old_password, new_password }
  );
  return res.data;
}

/**
 * Admin: Kullanıcı profilini getir
 */
export async function getUserProfile(userId: number): Promise<UserProfile> {
  const res = await http.get<UserProfile>(`/users/${userId}/profile`);
  return res.data;
}

/**
 * Admin: Kullanıcı profilini güncelle
 */
export async function updateUserProfile(
  userId: number,
  payload: ProfileUpdate
): Promise<UserProfile> {
  const res = await http.put<UserProfile>(`/users/${userId}/profile`, payload);
  return res.data;
}

/**
 * Is ortagi profilim v2 ozet kart verisi
 */
export async function getChannelProfileSummary(): Promise<ChannelProfileSummary> {
  const res = await http.get<ChannelProfileSummary>("/channel/profile/summary");
  return res.data;
}

/**
 * Is ortagi referral link merkezi
 */
export async function getChannelReferralLinks(): Promise<ChannelReferralLink[]> {
  const res = await http.get<ChannelReferralLink[]>("/channel/profile/referral-links");
  return res.data;
}

export async function createChannelReferralLink(
  payload: ChannelReferralLinkCreatePayload
): Promise<ChannelReferralLink> {
  const res = await http.post<ChannelReferralLink>("/channel/profile/referral-links", payload);
  return res.data;
}

/**
 * Is ortagi donusum metrikleri
 */
export async function getChannelConversionMetrics(period = "30d"): Promise<ChannelConversionMetrics> {
  const res = await http.get<ChannelConversionMetrics>("/channel/profile/conversion-metrics", {
    params: { period },
  });
  return res.data;
}

/**
 * Is ortagi komisyon period raporu
 */
export async function getChannelCommissionReport(period = "30d"): Promise<ChannelCommissionReport> {
  const res = await http.get<ChannelCommissionReport>("/channel/profile/commission-report", {
    params: { period },
  });
  return res.data;
}

/**
 * Is ortagi komisyon hesaplamayi period icin calistir
 */
export async function recalculateChannelCommissions(
  period = "30d"
): Promise<ChannelCommissionRecalculateResponse> {
  const res = await http.post<ChannelCommissionRecalculateResponse>(
    "/channel/profile/commission-recalculate",
    null,
    {
      params: { period },
    }
  );
  return res.data;
}

/**
 * Is ortagi ekip hiyerarsisi
 */
export async function getChannelTeamHierarchy(): Promise<TeamHierarchy> {
  const res = await http.get<TeamHierarchy>("/channel/profile/team-hierarchy");
  return res.data;
}

export interface CampaignRule {
  id: number;
  threshold_count: number;
  reward_type: string;
  reward_value_json: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CampaignChannel {
  id: number;
  code: string;
  name: string;
  description: string | null;
  audience_type: string;
  trigger_event: string;
  status: string;
  is_public: boolean;
  starts_at: string | null;
  ends_at: string | null;
  rules: CampaignRule[];
  my_progress_count: number;
  my_last_event_at: string | null;
  my_grants: string[];
}

export interface ChannelCampaignList {
  total: number;
  active_count: number;
  joined_count: number;
  campaigns: CampaignChannel[];
}

export interface SocialShareItem {
  channel: string;
  label: string;
  share_url: string;
}

export interface ChannelSocialLinks {
  source_link_code: string | null;
  source_short_url: string | null;
  share_message: string;
  items: SocialShareItem[];
}

export interface TeamPerformanceRow {
  user_id: number;
  display_name: string;
  role_profile_code: string;
  is_active: boolean;
  referral_count: number;
  referral_last_30d: number;
  commission_total: number;
  score_last_30d: number;
}

export interface TeamPerformance {
  period: string;
  total_members: number;
  rows: TeamPerformanceRow[];
}

/**
 * Is ortagi kampanya paneli
 */
export async function getChannelCampaigns(): Promise<ChannelCampaignList> {
  const res = await http.get<ChannelCampaignList>("/channel/profile/campaigns");
  return res.data;
}

/**
 * Is ortagi sosyal baglanti paneli
 */
export async function getChannelSocialLinks(): Promise<ChannelSocialLinks> {
  const res = await http.get<ChannelSocialLinks>("/channel/profile/social-links");
  return res.data;
}

/**
 * Is ortagi ekip performans tablosu
 */
export async function getChannelTeamPerformance(period = "30d"): Promise<TeamPerformance> {
  const res = await http.get<TeamPerformance>("/channel/profile/team-performance", {
    params: { period },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Sprint-5: Gamification
// ---------------------------------------------------------------------------

export interface ChannelBadge {
  code: string;
  label: string;
  earned: boolean;
}

export interface ChannelGamification {
  owner_user_id: number;
  level_code: string;
  level_index: number;
  star_score: number;
  performance_score: number;
  performance_factor: number;
  grace_period_remaining: number;
  total_referrals: number;
  active_team_size: number;
  badges: ChannelBadge[];
}

export async function getChannelGamification(): Promise<ChannelGamification> {
  const res = await http.get<ChannelGamification>("/channel/profile/gamification");
  return res.data;
}

// ---------------------------------------------------------------------------
// Sprint-5: Admin komisyon onay + dashboard
// ---------------------------------------------------------------------------

export interface AdminLedgerItem {
  id: number;
  channel_org_id: number;
  org_name: string | null;
  event_type: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface AdminLedgerList {
  total: number;
  items: AdminLedgerItem[];
}

export interface AdminCommissionDashboard {
  total_pending: number;
  total_approved: number;
  total_paid: number;
  total_cancelled: number;
  org_breakdown: {
    org_id: number;
    org_name: string | null;
    pending: number;
    approved: number;
    paid: number;
    cancelled: number;
  }[];
  referral_breakdown: {
    org_id: number | null;
    org_name: string | null;
    owner_user_id: number;
    link_code: string;
    campaign_id: number | null;
    campaign_name: string | null;
    target_type: string | null;
    clicks: number;
    signups: number;
    activations: number;
    net_commission: number;
  }[];
}

export async function getAdminCommissionLedger(params?: {
  status_filter?: string;
  org_id?: number;
  limit?: number;
}): Promise<AdminLedgerList> {
  const res = await http.get<AdminLedgerList>("/admin/channel/commission-ledger", { params });
  return res.data;
}

export async function approveLedgerEntry(
  ledgerId: number,
  newStatus: "approved" | "paid" | "cancelled"
): Promise<{ id: number; status: string }> {
  const res = await http.post<{ id: number; status: string }>(
    `/admin/channel/commission-ledger/${ledgerId}/approve`,
    null,
    { params: { new_status: newStatus } }
  );
  return res.data;
}

export async function bulkApproveLedger(
  ledgerIds: number[],
  newStatus: "approved" | "paid" | "cancelled"
): Promise<{ updated: number }> {
  const res = await http.post<{ updated: number }>(
    "/admin/channel/commission-ledger/bulk-approve",
    { ledger_ids: ledgerIds, new_status: newStatus }
  );
  return res.data;
}

export async function getAdminCommissionDashboard(): Promise<AdminCommissionDashboard> {
  const res = await http.get<AdminCommissionDashboard>("/admin/channel/commission-dashboard");
  return res.data;
}

// ---------------------------------------------------------------------------
// Sprint-5: Public referral landing
// ---------------------------------------------------------------------------

export interface PublicReferralInfo {
  link_code: string;
  is_active: boolean;
  org_name: string | null;
  target_type: string | null;
  landing_path: string | null;
}

export async function getPublicReferralInfo(linkCode: string): Promise<PublicReferralInfo> {
  const res = await http.get<PublicReferralInfo>(`/channel/public/r/${linkCode}`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getMySessions(): Promise<SessionInfo[]> {
  const res = await http.get<SessionInfo[]>("/users/sessions");
  return res.data;
}

export async function revokeSession(sessionId: number): Promise<void> {
  await http.delete(`/users/sessions/${sessionId}`);
}

// ---------------------------------------------------------------------------
// 2FA
// ---------------------------------------------------------------------------

export async function setup2FA(): Promise<TwoFaSetupResult> {
  const res = await http.post<TwoFaSetupResult>("/users/2fa/setup");
  return res.data;
}

export async function verify2FA(code: string): Promise<{ enabled: boolean }> {
  const res = await http.post<{ enabled: boolean }>("/users/2fa/verify", { code });
  return res.data;
}

export async function disable2FA(): Promise<{ enabled: boolean }> {
  const res = await http.delete<{ enabled: boolean }>("/users/2fa/disable");
  return res.data;
}
