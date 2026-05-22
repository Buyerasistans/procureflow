export const channelPartnerSummaryMock = {
  owner_user_id: 7,
  partner_type: "individual",
  display_name: "Acente A",
  level_code: "channel.account_owner",
  star_score: 3.2,
  performance_score: 64,
  total_team_size: 11,
  active_team_size: 8,
  last_30d_new_customers: 5,
  commission_pending: 1200,
  commission_approved: 900,
  commission_paid: 700,
  commission_net_current_month: 1600,
};

export const channelReferralLinksMock = [
  {
    link_id: 10,
    link_code: "CH-AAA111",
    short_url: "https://pf.io/ref/ch-aaa111",
    qr_url: null,
    campaign_id: null,
    target_type: "mixed",
    is_active: true,
  },
];

export const channelConversionMetricsMock = {
  clicks: 44,
  signups: 16,
  activations: 9,
  converted_partner_count: 5,
  converted_supplier_count: 4,
  supplier_to_partner_count: 2,
  funnel_ratio_click_to_signup: 36.4,
  funnel_ratio_signup_to_activation: 56.2,
  funnel_ratio_activation_to_partner: 55.6,
  referral_breakdown: [
    {
      link_code: "CH-AAA111",
      target_type: "mixed",
      clicks: 44,
      signups: 16,
      activations: 9,
      net_commission: 1600,
    },
  ],
  daily_trend: [{ day: "2026-04-20", clicks: 5, signups: 2, activations: 1 }],
};

export const channelCommissionReportMock = {
  period: "30d",
  totals: {
    pending: 1200,
    approved: 900,
    paid: 700,
    net: 1600,
  },
  by_event_type: [
    { event_type: "partner_signup", amount: 900 },
    { event_type: "supplier_signup", amount: 700 },
  ],
  daily_trend: [{ day: "2026-04-20", net_amount: 200 }],
  entry_count: 6,
};

export const channelGamificationMock = {
  owner_user_id: 7,
  level_code: "L2",
  level_index: 2,
  star_score: 3.5,
  performance_score: 70.0,
  performance_factor: 0.8,
  grace_period_remaining: 0,
  total_referrals: 25,
  active_team_size: 8,
  badges: [
    { code: "first_referral", label: "Ilk Referans", earned: true },
    { code: "referral_10", label: "10 Referans", earned: true },
    { code: "referral_25", label: "25 Referans", earned: true },
    { code: "team_builder", label: "Ekip Kurucusu", earned: true },
    { code: "top_performer", label: "En Iyi Performans", earned: false },
  ],
};

export const adminLedgerMock = {
  total: 2,
  items: [
    {
      id: 1,
      channel_org_id: 3,
      org_name: "Acente A",
      event_type: "partner_signup",
      amount: 500,
      currency: "TRY",
      status: "pending",
      note: null,
      created_at: "2026-04-20T10:00:00",
      paid_at: null,
    },
    {
      id: 2,
      channel_org_id: 3,
      org_name: "Acente A",
      event_type: "supplier_signup",
      amount: 350,
      currency: "TRY",
      status: "approved",
      note: null,
      created_at: "2026-04-21T10:00:00",
      paid_at: null,
    },
  ],
};

export const adminCommissionDashboardMock = {
  total_pending: 500,
  total_approved: 350,
  total_paid: 0,
  total_cancelled: 0,
  org_breakdown: [
    {
      org_id: 3,
      org_name: "Acente A",
      pending: 500,
      approved: 350,
      paid: 0,
      cancelled: 0,
    },
  ],
  referral_breakdown: [
    {
      org_id: 3,
      org_name: "Acente A",
      owner_user_id: 7,
      link_code: "CH-AAA111",
      campaign_id: 5,
      campaign_name: "Yeni Ortak Getir 2026",
      target_type: "supplier",
      clicks: 44,
      signups: 16,
      activations: 9,
      net_commission: 1600,
    },
  ],
};

export const channelTeamHierarchyMock = {
  root_user_id: 7,
  total_members: 2,
  active_members: 2,
  nodes: [
    {
      user_id: 7,
      display_name: "Acente A",
      email: "owner@example.com",
      role_profile_code: "channel.account_owner",
      depth: 0,
      parent_user_id: null,
      is_active: true,
      joined_at: "2026-01-01T00:00:00",
      referral_count: 3,
    },
    {
      user_id: 99,
      display_name: "Alt Temsilci",
      email: "agent@example.com",
      role_profile_code: "channel.agent",
      depth: 2,
      parent_user_id: 7,
      is_active: true,
      joined_at: "2026-02-01T00:00:00",
      referral_count: 1,
    },
  ],
};

export const channelCampaignsMock = {
  total: 1,
  active_count: 1,
  joined_count: 0,
  campaigns: [
    {
      id: 5,
      code: "yeni-ortak-2026",
      name: "Yeni Ortak Getir 2026",
      description: "Yeni is ortagi getiren temsilcilere ozel odullu kampanya",
      audience_type: "channel",
      trigger_event: "partner_referral_activated",
      status: "active",
      is_public: true,
      starts_at: null,
      ends_at: null,
      rules: [
        {
          id: 10,
          threshold_count: 3,
          reward_type: "quote_bonus",
          reward_value_json: null,
          sort_order: 0,
          is_active: true,
        },
      ],
      my_progress_count: 0,
      my_last_event_at: null,
      my_grants: [],
    },
  ],
};

export const channelSocialLinksMock = {
  source_link_code: "CH-AAA111",
  source_short_url: "https://pf.io/ref/ch-aaa111",
  share_message: "ProcureFlow agima katilmak icin linkimi kullanabilirsiniz.",
  items: [
    {
      channel: "whatsapp",
      label: "WhatsApp",
      share_url: "https://wa.me/?text=test",
    },
  ],
};

export const channelTeamPerformanceMock = {
  period: "30d",
  total_members: 2,
  rows: [
    {
      user_id: 7,
      display_name: "Acente A",
      role_profile_code: "channel.account_owner",
      is_active: true,
      referral_count: 5,
      referral_last_30d: 2,
      commission_total: 1400,
      score_last_30d: 31.5,
    },
    {
      user_id: 99,
      display_name: "Alt Temsilci",
      role_profile_code: "channel.agent",
      is_active: true,
      referral_count: 2,
      referral_last_30d: 1,
      commission_total: 300,
      score_last_30d: 11.5,
    },
  ],
};

export const channelEmptyConversionMetricsMock = {
  clicks: 0,
  signups: 0,
  activations: 0,
  converted_partner_count: 0,
  converted_supplier_count: 0,
  supplier_to_partner_count: 0,
  funnel_ratio_click_to_signup: 0,
  funnel_ratio_signup_to_activation: 0,
  funnel_ratio_activation_to_partner: 0,
  referral_breakdown: [],
  daily_trend: [],
};

export const channelEmptyCommissionReportMock = {
  period: "30d",
  totals: {
    pending: 0,
    approved: 0,
    paid: 0,
    net: 0,
  },
  by_event_type: [],
  daily_trend: [],
  entry_count: 0,
};
