-- Quote/RFQ legacy mirror kolonlarini kaldiran final faz.
-- Bu migration ancak su kosullar saglandiginda calistirilmalidir:
-- 1. api/scripts/audit_quote_rfq_legacy_cleanup.py raporu mirror drift vermemeli.
-- 2. Uygulama katmani created_by_id ve total_amount alanlarini tek canonical kaynak olarak kullanmali.
-- 3. company_* alanlari RFQ snapshot alanlari olarak korunmaya devam etmelidir.

UPDATE quotes
SET user_id = created_by_id
WHERE user_id IS DISTINCT FROM created_by_id;

UPDATE quotes
SET amount = total_amount
WHERE amount IS DISTINCT FROM total_amount;

ALTER TABLE quotes
DROP COLUMN user_id;

ALTER TABLE quotes
DROP COLUMN amount;

DROP INDEX IF EXISTS ix_quotes_user_id;

-- Not:
-- 1. Bu migration uygulanmadan hemen once quote API regresyon paketi yeniden kosulmalidir.
-- 2. created_by / updated_by / deleted_by kolonlari bu fazda bilerek korunur.