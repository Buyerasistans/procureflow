-- Paket 5 faturalama / abonelik omurgasi.
-- Bu migration billing provider entegrasyonundan once cekirdek veri modelini hazirlar.

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'starter',
    billing_provider VARCHAR(50),
    billing_price_id_monthly VARCHAR(120),
    billing_price_id_yearly VARCHAR(120),
    monthly_price NUMERIC(12, 2),
    yearly_price NUMERIC(12, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    limits_json TEXT,
    feature_flags_json TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_subscription_plans_code ON subscription_plans (code);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
    subscription_plan_code VARCHAR(50) NOT NULL,
    billing_provider VARCHAR(50),
    provider_customer_id VARCHAR(120),
    provider_subscription_id VARCHAR(120),
    status VARCHAR(50) NOT NULL DEFAULT 'trialing',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    seats_purchased INTEGER NOT NULL DEFAULT 1,
    trial_ends_at TIMESTAMP,
    current_period_starts_at TIMESTAMP,
    current_period_ends_at TIMESTAMP,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMP,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_tenant_subscriptions_tenant_id ON tenant_subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS ix_tenant_subscriptions_plan_code ON tenant_subscriptions (subscription_plan_code);
CREATE INDEX IF NOT EXISTS ix_tenant_subscriptions_customer_id ON tenant_subscriptions (provider_customer_id);
CREATE INDEX IF NOT EXISTS ix_tenant_subscriptions_subscription_id ON tenant_subscriptions (provider_subscription_id);

CREATE TABLE IF NOT EXISTS billing_invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tenant_subscription_id INTEGER REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
    provider_invoice_id VARCHAR(120) UNIQUE,
    invoice_number VARCHAR(120),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    subtotal_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    total_amount NUMERIC(12, 2),
    due_at TIMESTAMP,
    paid_at TIMESTAMP,
    hosted_invoice_url VARCHAR(500),
    invoice_pdf_url VARCHAR(500),
    raw_payload_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_billing_invoices_tenant_id ON billing_invoices (tenant_id);
CREATE INDEX IF NOT EXISTS ix_billing_invoices_subscription_id ON billing_invoices (tenant_subscription_id);
CREATE INDEX IF NOT EXISTS ix_billing_invoices_status ON billing_invoices (status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_subscription_id INTEGER REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    provider_event_id VARCHAR(120) NOT NULL UNIQUE,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMP,
    error_message TEXT,
    payload_json TEXT,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_billing_webhook_events_tenant_id ON billing_webhook_events (tenant_id);
CREATE INDEX IF NOT EXISTS ix_billing_webhook_events_subscription_id ON billing_webhook_events (tenant_subscription_id);
CREATE INDEX IF NOT EXISTS ix_billing_webhook_events_type ON billing_webhook_events (event_type);
CREATE INDEX IF NOT EXISTS ix_billing_webhook_events_processing_status ON billing_webhook_events (processing_status);

INSERT INTO subscription_plans (
    code,
    name,
    tier,
    monthly_price,
    yearly_price,
    currency,
    limits_json,
    feature_flags_json,
    is_active
)
SELECT
    'starter',
    'Starter',
    'starter',
    0,
    0,
    'TRY',
    '{"active_projects": 5, "active_internal_users": 10}',
    '{"rfq_core": true, "supplier_portal": true}',
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'starter');

INSERT INTO subscription_plans (
    code,
    name,
    tier,
    monthly_price,
    yearly_price,
    currency,
    limits_json,
    feature_flags_json,
    is_active
)
SELECT
    'growth',
    'Growth',
    'growth',
    0,
    0,
    'TRY',
    '{"active_private_suppliers": 250, "active_internal_users": 50}',
    '{"advanced_reports": true, "approval_automation": true}',
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'growth');

INSERT INTO subscription_plans (
    code,
    name,
    tier,
    monthly_price,
    yearly_price,
    currency,
    limits_json,
    feature_flags_json,
    is_active
)
SELECT
    'enterprise',
    'Enterprise',
    'enterprise',
    0,
    0,
    'TRY',
    '{"active_approval_workflows": 999}',
    '{"api_access": true, "tenant_branding": true}',
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'enterprise');

INSERT INTO tenant_subscriptions (
    tenant_id,
    subscription_plan_id,
    subscription_plan_code,
    status,
    billing_cycle,
    seats_purchased,
    created_at,
    updated_at
)
SELECT
    tenants.id,
    subscription_plans.id,
    COALESCE(tenants.subscription_plan_code, 'starter'),
    CASE WHEN tenants.is_active THEN 'active' ELSE 'paused' END,
    'monthly',
    GREATEST(1, (SELECT COUNT(*) FROM users WHERE users.tenant_id = tenants.id AND users.hidden_from_admin IS FALSE)),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tenants
LEFT JOIN subscription_plans
    ON subscription_plans.code = COALESCE(tenants.subscription_plan_code, 'starter')
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_subscriptions WHERE tenant_subscriptions.tenant_id = tenants.id
);