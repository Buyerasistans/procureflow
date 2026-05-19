-- Tenant-SaaS gecisinde company/department/role isim benzersizligi global degil tenant bazli olmalidir.
-- Mevcut global unique kisitlari kaldirir ve tenant_id + name/code bilesik unique indexleri ekler.

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_key;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_code_key;

DROP INDEX IF EXISTS uq_companies_tenant_name;
DROP INDEX IF EXISTS uq_departments_tenant_name;
DROP INDEX IF EXISTS uq_roles_tenant_name;
DROP INDEX IF EXISTS uq_projects_tenant_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tenant_name
ON companies (tenant_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_departments_tenant_name
ON departments (tenant_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_name
ON roles (tenant_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_tenant_code
ON projects (tenant_id, code);
