from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import api.models  # noqa: F401
from api.database import Base, engine
from api.db.session import SessionLocal


STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) DEFAULT 'tenant_member' NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id INTEGER",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_by_id INTEGER",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE departments ADD COLUMN IF NOT EXISTS created_by_id INTEGER",
    "ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_id INTEGER",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by_id INTEGER",
    "ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS category_tags_json TEXT",
    "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS partner_category_tags_json TEXT",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id INTEGER",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2)",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by INTEGER",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_by INTEGER",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_by INTEGER",
    "ALTER TABLE quote_approvals ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE quote_approvals ADD COLUMN IF NOT EXISTS required_business_role VARCHAR(100)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS owner_user_id INTEGER",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS tenant_id INTEGER",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS owner_user_id INTEGER",
]


def _apply_postgres_role_constraint_fix(db: SessionLocal) -> None:
    if getattr(engine.dialect, "name", None) != "postgresql":
        return

    stale_constraint_exists = db.execute(
        text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'roles'
              AND c.contype = 'u'
              AND c.conname = 'roles_name_key'
            """
        )
    ).scalar()
    if stale_constraint_exists:
        db.execute(text("ALTER TABLE roles DROP CONSTRAINT roles_name_key"))

    tenant_constraint_exists = db.execute(
        text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'roles'
              AND c.contype = 'u'
              AND c.conname = 'uq_roles_tenant_name'
            """
        )
    ).scalar()
    if not tenant_constraint_exists:
        db.execute(
            text(
                "ALTER TABLE roles ADD CONSTRAINT uq_roles_tenant_name UNIQUE (tenant_id, name)"
            )
        )


def _apply_postgres_department_constraint_fix(db: SessionLocal) -> None:
    if getattr(engine.dialect, "name", None) != "postgresql":
        return

    stale_constraint_exists = db.execute(
        text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'departments'
              AND c.contype = 'u'
              AND c.conname = 'departments_name_key'
            """
        )
    ).scalar()
    if stale_constraint_exists:
        db.execute(text("ALTER TABLE departments DROP CONSTRAINT departments_name_key"))

    tenant_constraint_exists = db.execute(
        text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'departments'
              AND c.contype = 'u'
              AND c.conname = 'uq_departments_tenant_name'
            """
        )
    ).scalar()
    if not tenant_constraint_exists:
        db.execute(
            text(
                "ALTER TABLE departments ADD CONSTRAINT uq_departments_tenant_name UNIQUE (tenant_id, name)"
            )
        )


def main() -> int:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        for statement in STATEMENTS:
            db.execute(text(statement))
        db.execute(
            text(
                "UPDATE quotes SET user_id = created_by_id WHERE user_id IS NULL AND created_by_id IS NOT NULL"
            )
        )
        db.execute(
            text(
                "UPDATE quotes SET amount = total_amount WHERE amount IS NULL AND total_amount IS NOT NULL"
            )
        )
        db.execute(
            text(
                "UPDATE quotes SET created_by = created_by_id WHERE created_by IS NULL AND created_by_id IS NOT NULL"
            )
        )
        _apply_postgres_role_constraint_fix(db)
        _apply_postgres_department_constraint_fix(db)
        db.commit()
    finally:
        db.close()

    print("APPLIED_RUNTIME_FOUNDATION_COLUMNS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
