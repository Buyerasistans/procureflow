-- Migration: 2026-04-21 — Destek talebi (support_tickets) tablosu oluştur
-- Bu tablo tenant kullanıcılarının platform personeline ilettiği destek taleplerini saklar.

CREATE TABLE IF NOT EXISTS support_tickets (
    id                   SERIAL PRIMARY KEY,
    tenant_id            INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by_user_id   INTEGER NOT NULL REFERENCES users(id),
    assigned_to_user_id  INTEGER REFERENCES users(id),

    subject              VARCHAR(255) NOT NULL,
    description          TEXT,

    -- billing | onboarding | technical | account | general
    category             VARCHAR(50) NOT NULL DEFAULT 'general',
    -- low | medium | high | urgent
    priority             VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- open | in_progress | waiting_response | resolved | closed
    status               VARCHAR(30) NOT NULL DEFAULT 'open',
    -- tenant_portal | platform_ops | post_activation | help_center
    source               VARCHAR(50) NOT NULL DEFAULT 'tenant_portal',

    resolution_note      TEXT,
    sla_due_at           TIMESTAMP,
    resolved_at          TIMESTAMP,
    is_visible_to_tenant BOOLEAN NOT NULL DEFAULT TRUE,

    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS ix_support_tickets_created_by_user_id ON support_tickets(created_by_user_id);
CREATE INDEX IF NOT EXISTS ix_support_tickets_assigned_to_user_id ON support_tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS ix_support_tickets_status ON support_tickets(status);
