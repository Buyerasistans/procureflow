CREATE TABLE IF NOT EXISTS commercial_requests (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NULL REFERENCES tenants(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL,
    audience VARCHAR(50) NOT NULL DEFAULT 'strategic',
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    source_surface VARCHAR(100) NULL,
    package_code VARCHAR(50) NULL,
    package_name VARCHAR(150) NULL,
    addon_code VARCHAR(50) NULL,
    addon_name VARCHAR(150) NULL,
    requester_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NULL,
    phone VARCHAR(50) NULL,
    notes TEXT NULL,
    metadata_json TEXT NULL,
    owner_name VARCHAR(255) NULL,
    last_contacted_at TIMESTAMP NULL,
    reviewed_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    review_note TEXT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_commercial_requests_status
    ON commercial_requests(status);
CREATE INDEX IF NOT EXISTS ix_commercial_requests_request_type
    ON commercial_requests(request_type);
CREATE INDEX IF NOT EXISTS ix_commercial_requests_requester_email
    ON commercial_requests(requester_email);
CREATE INDEX IF NOT EXISTS ix_commercial_requests_owner_name
    ON commercial_requests(owner_name);

CREATE TABLE IF NOT EXISTS commercial_request_webhook_deliveries (
    id INTEGER PRIMARY KEY,
    commercial_request_id INTEGER NULL REFERENCES commercial_requests(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    target_url VARCHAR(500) NULL,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    http_status_code INTEGER NULL,
    error_message TEXT NULL,
    payload_raw TEXT NULL,
    response_body TEXT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    last_attempted_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_commercial_request_webhook_deliveries_commercial_request_id
    ON commercial_request_webhook_deliveries(commercial_request_id);
CREATE INDEX IF NOT EXISTS ix_commercial_request_webhook_deliveries_event_type
    ON commercial_request_webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS ix_commercial_request_webhook_deliveries_delivery_status
    ON commercial_request_webhook_deliveries(delivery_status);

CREATE TABLE IF NOT EXISTS tenant_subscription_addons (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_code VARCHAR(50) NOT NULL,
    addon_name VARCHAR(150) NULL,
    limit_key VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    increment_per_unit INTEGER NOT NULL DEFAULT 1,
    total_increment INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    payment_transaction_id INTEGER NULL REFERENCES payment_transactions(id) ON DELETE SET NULL,
    activated_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_tenant_subscription_addons_tenant_id
    ON tenant_subscription_addons(tenant_id);
CREATE INDEX IF NOT EXISTS ix_tenant_subscription_addons_limit_key
    ON tenant_subscription_addons(limit_key);
CREATE INDEX IF NOT EXISTS ix_tenant_subscription_addons_status
    ON tenant_subscription_addons(status);
CREATE INDEX IF NOT EXISTS ix_tenant_subscription_addons_payment_transaction_id
    ON tenant_subscription_addons(payment_transaction_id);

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS commercial_request_webhook_url TEXT;
ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS commercial_request_webhook_secret TEXT;
