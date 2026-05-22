-- Quote approval required_role compatibility mirror temizligi.
-- Bu faz fiziksel kolon drop'u yapmaz; required_role alanini compatibility seviyesine indirir.
-- Uygulama katmani required_role response alanini required_business_role uzerinden sentezlemeye devam eder.

-- Preflight: canonical alan bos kalmis kayit olmamali.
SELECT id, quote_id, approval_level
FROM quote_approvals
WHERE required_business_role IS NULL;

-- Preflight: mirror alani canonical ile farkli ise once audit/fix araci calistirilmalidir.
SELECT id, quote_id, approval_level, required_role, required_business_role
FROM quote_approvals
WHERE required_role IS NOT NULL
  AND required_role IS DISTINCT FROM required_business_role;

-- Compatibility cleanup:
-- DB seviyesinde legacy mirror'u bosalt, API response'lari ise required_business_role uzerinden
-- sentetik required_role / required_role_label alanlarini donmeye devam etsin.
UPDATE quote_approvals
SET required_role = NULL
WHERE required_business_role IS NOT NULL
  AND (required_role IS NULL OR required_role = required_business_role);

-- Not:
-- 1. Fiziksel DROP COLUMN adimi ancak ORM/model ve audit araclari required_role kolonundan tamamen arindirildiktan sonra yapilmalidir.
-- 2. Bu migration sonrasi required_role_mirror API alaninin null donmesi beklenen davranistir.