-- DRAFT MIGRATION
-- Channel network/referral + commission v1 schema (taslak)
-- Created: 2026-04-23
-- NOTE: This script is intentionally additive and keeps existing channel/commission
-- tables intact to avoid breaking live flows.

CREATE TABLE IF NOT EXISTS channel_referral_links (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id INTEGER NULL,
    link_code VARCHAR(80) NOT NULL,
    short_url VARCHAR(500) NULL,
    landing_path VARCHAR(255) NULL,
    target_type VARCHAR(30) NOT NULL DEFAULT 'mixed',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    metadata_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_referral_links_link_code
    ON channel_referral_links(link_code);
CREATE INDEX IF NOT EXISTS ix_channel_referral_links_owner_user_id
    ON channel_referral_links(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_channel_referral_links_campaign_id
    ON channel_referral_links(campaign_id);

CREATE TABLE IF NOT EXISTS channel_referral_events (
    id INTEGER PRIMARY KEY,
    referral_link_id INTEGER NOT NULL REFERENCES channel_referral_links(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_company_id INTEGER NULL REFERENCES companies(id) ON DELETE SET NULL,
    source_scope VARCHAR(30) NULL,
    target_scope VARCHAR(30) NULL,
    amount_base NUMERIC(14, 2) NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_channel_referral_events_link_id
    ON channel_referral_events(referral_link_id);
CREATE INDEX IF NOT EXISTS ix_channel_referral_events_type_time
    ON channel_referral_events(event_type, occurred_at);

CREATE TABLE IF NOT EXISTS channel_commission_plans_v1 (
    id INTEGER PRIMARY KEY,
    plan_code VARCHAR(50) NOT NULL,
    plan_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    base_rate NUMERIC(8, 5) NOT NULL DEFAULT 0.04000,
    grace_period_cycles INTEGER NOT NULL DEFAULT 2,
    max_drop_per_cycle NUMERIC(8, 5) NOT NULL DEFAULT 0.00300,
    config_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_commission_plans_v1_code
    ON channel_commission_plans_v1(plan_code);

CREATE TABLE IF NOT EXISTS channel_commission_plan_tiers_v1 (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES channel_commission_plans_v1(id) ON DELETE CASCADE,
    min_customers INTEGER NOT NULL,
    max_customers INTEGER NULL,
    bonus_rate NUMERIC(8, 5) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_channel_commission_plan_tiers_v1_plan_id
    ON channel_commission_plan_tiers_v1(plan_id);

CREATE TABLE IF NOT EXISTS channel_commission_ledger_v1 (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    beneficiary_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_event_id INTEGER NULL REFERENCES channel_referral_events(id) ON DELETE SET NULL,
    commission_plan_id INTEGER NULL REFERENCES channel_commission_plans_v1(id) ON DELETE SET NULL,
    level_index INTEGER NOT NULL DEFAULT 1,
    role_multiplier NUMERIC(8, 5) NOT NULL DEFAULT 1.00000,
    performance_factor NUMERIC(8, 5) NOT NULL DEFAULT 1.00000,
    commission_rate NUMERIC(8, 5) NOT NULL,
    gross_amount NUMERIC(14, 2) NOT NULL,
    net_amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    period_key VARCHAR(20) NOT NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS ix_channel_commission_ledger_v1_owner_period
    ON channel_commission_ledger_v1(owner_user_id, period_key);
CREATE INDEX IF NOT EXISTS ix_channel_commission_ledger_v1_status
    ON channel_commission_ledger_v1(status);
CREATE INDEX IF NOT EXISTS ix_channel_commission_ledger_v1_event
    ON channel_commission_ledger_v1(referral_event_id);

CREATE TABLE IF NOT EXISTS channel_partner_scores_v1 (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_key VARCHAR(20) NOT NULL,
    star_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    performance_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
    direct_customer_count INTEGER NOT NULL DEFAULT 0,
    network_customer_count INTEGER NOT NULL DEFAULT 0,
    total_net_commission NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_partner_scores_v1_owner_period
    ON channel_partner_scores_v1(owner_user_id, period_key);

CREATE TABLE IF NOT EXISTS channel_campaigns_v1 (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    campaign_name VARCHAR(200) NOT NULL,
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    bonus_type VARCHAR(20) NOT NULL DEFAULT 'rate',
    bonus_value NUMERIC(12, 4) NOT NULL DEFAULT 0,
    eligibility_json TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_channel_campaigns_v1_owner
    ON channel_campaigns_v1(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_channel_campaigns_v1_active_dates
    ON channel_campaigns_v1(is_active, start_at, end_at);

CREATE TABLE IF NOT EXISTS channel_social_connections_v1 (
    id INTEGER PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    account_handle VARCHAR(255) NULL,
    profile_url VARCHAR(500) NULL,
    access_status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
    metadata_json TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_channel_social_connections_v1_owner
    ON channel_social_connections_v1(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_channel_social_connections_v1_provider
    ON channel_social_connections_v1(provider);
