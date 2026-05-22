-- Quote approval business-role geçişinin sıkılaştırılmış fazı.
-- Bu migration, audit scripti ve --fix-approvals uygulandıktan sonra çalıştırılmalıdır.

UPDATE quote_approvals
SET required_business_role = required_role
WHERE required_business_role IS NULL
  AND required_role IS NOT NULL;

UPDATE quote_approvals
SET required_role = required_business_role
WHERE required_business_role IS NOT NULL
  AND (required_role IS NULL OR required_role <> required_business_role);

ALTER TABLE quote_approvals
ALTER COLUMN required_business_role SET NOT NULL;

ALTER TABLE quote_approvals
ALTER COLUMN required_role DROP NOT NULL;

-- Not:
-- 1. Uygulama katmani required_business_role alanini birincil kaynak olarak kullanmaya devam etmelidir.
-- 2. required_role bu fazdan sonra sadece compatibility mirror olarak nullable sekilde tutulur.