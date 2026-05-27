-- MIGRATION: Dual-Role Supplier ↔ Tenant köprüsü
-- Tarih: 2026-05-28
-- Açıklama: Bir firma hem Tedarikçi hem Stratejik Partner olabilsin.
--   Supplier.linked_tenant_id → tenants.id  (opsiyonel, platform onayı ile aktif)
--   Supplier.dual_role_status → NULL | 'pending' | 'active' | 'rejected'

-- SQLite / SQLite3 uyumlu (NULL = dual role yok, foreign key opsiyonel)
ALTER TABLE suppliers ADD COLUMN linked_tenant_id INTEGER NULL REFERENCES tenants(id);
ALTER TABLE suppliers ADD COLUMN dual_role_status VARCHAR(20) NULL;

CREATE INDEX IF NOT EXISTS ix_suppliers_linked_tenant_id ON suppliers(linked_tenant_id);
