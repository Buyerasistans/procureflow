-- Quote approval semantiğini system_role'dan ayırmak için business role alanı eklenir.
-- Geçiş dönemi boyunca required_role korunur; yeni alan mevcut veriden doldurulur.

ALTER TABLE quote_approvals
ADD COLUMN IF NOT EXISTS required_business_role VARCHAR(100);

UPDATE quote_approvals
SET required_business_role = required_role
WHERE required_business_role IS NULL;

-- Geçiş tamamlanana kadar nullable bırakılır; uygulama katmanı iki alanı paralel taşır.
