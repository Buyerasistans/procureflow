-- Quote/RFQ legacy cleanup execution plan
--
-- Purpose:
--   Finalize the Quote -> RFQ transition after adapter layers and tenant scope
--   hardening are already live.
--
-- IMPORTANT:
--   This file is a reviewed execution PLAN, not an auto-run migration.
--   Apply each block only after validating the preflight queries in the target
--   environment.

-- ============================================================================
-- Phase 0 - Preflight audit
-- ============================================================================

-- 0.1 Canonical owner mirror drift
SELECT id, user_id, created_by_id
FROM quotes
WHERE user_id IS DISTINCT FROM created_by_id;

-- 0.2 Canonical amount mirror drift
SELECT id, amount, total_amount
FROM quotes
WHERE amount IS DISTINCT FROM total_amount;

-- 0.3 Missing snapshot columns that are still required by current API payloads
SELECT id
FROM quotes
WHERE company_name IS NULL
   OR company_contact_name IS NULL
   OR company_contact_phone IS NULL
   OR company_contact_email IS NULL;

-- 0.4 Tenant consistency on supplier quote chain
SELECT sq.id, sq.quote_id, sq.supplier_id, q.tenant_id AS quote_tenant_id, s.tenant_id AS supplier_tenant_id
FROM supplier_quotes sq
JOIN quotes q ON q.id = sq.quote_id
JOIN suppliers s ON s.id = sq.supplier_id
WHERE q.tenant_id IS NOT NULL
  AND s.tenant_id IS NOT NULL
  AND q.tenant_id <> s.tenant_id;

-- ============================================================================
-- Phase 1 - Mirror alignment before stricter cleanup
-- ============================================================================

-- 1.1 Align legacy owner mirror to canonical owner.
UPDATE quotes
SET user_id = created_by_id
WHERE user_id IS DISTINCT FROM created_by_id;

-- 1.2 Align legacy amount mirror to canonical RFQ total.
UPDATE quotes
SET amount = total_amount
WHERE amount IS DISTINCT FROM total_amount;

-- ============================================================================
-- Phase 2 - Application switch checkpoints
-- ============================================================================

-- Execute these only after all read/write paths use created_by_id and total_amount
-- as the canonical fields, and snapshot consumers are intentionally preserved.

-- Checkpoint A:
--   Backend/frontend payloads no longer depend on quotes.user_id semantics.

-- Checkpoint B:
--   Backend/frontend writes no longer depend on quotes.amount semantics.

-- Checkpoint C:
--   company_* columns are explicitly retained as RFQ snapshot fields.

-- ============================================================================
-- Phase 3 - Candidate stricter migration actions
-- ============================================================================

-- 3.1 Optional: stop writing legacy owner mirror in app layer before dropping.
-- 3.2 Optional: stop writing legacy amount mirror in app layer before dropping.

-- 3.3 Candidate drop set once production reads confirm zero dependency:
-- ALTER TABLE quotes DROP COLUMN user_id;
-- ALTER TABLE quotes DROP COLUMN amount;

-- 3.4 Audit columns created_by / updated_by / deleted_by stay until a separate
-- actor-history cleanup phase decides whether they remain as lightweight audit
-- mirrors or move to a normalized event log only.

-- ============================================================================
-- Phase 4 - Post migration verification
-- ============================================================================

-- 4.1 Re-run quote tenant audit script.
-- 4.2 Re-run quote API regression package.
-- 4.3 Re-run report comparison and supplier revision regression package.
