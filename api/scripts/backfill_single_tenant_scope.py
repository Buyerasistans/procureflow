from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.db.session import SessionLocal


TABLES = [
    "companies",
    "departments",
    "projects",
    "roles",
    "suppliers",
    "quotes",
    "quote_approvals",
    "company_roles",
    "email_settings",
    "system_emails",
]

TENANT_USER_SYSTEM_ROLES = ["tenant_owner", "tenant_admin", "tenant_member"]


def _scalar(db, sql: str, params: dict[str, object] | None = None) -> int:
    return int(db.execute(text(sql), params or {}).scalar() or 0)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill legacy records into the sole tenant"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Degisiklikleri veritabanina yaz"
    )
    parser.add_argument("--dry-run", action="store_true", help="Sadece preview goster")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    db = SessionLocal()
    try:
        tenant_rows = (
            db.execute(text("SELECT id, slug FROM tenants ORDER BY id ASC"))
            .mappings()
            .all()
        )
        if len(tenant_rows) != 1:
            print(f"Beklenen 1 tenant, bulunan: {len(tenant_rows)}")
            return 1

        tenant_id = int(tenant_rows[0]["id"])
        tenant_slug = str(tenant_rows[0]["slug"])
        print(f"Tek tenant bulundu: id={tenant_id} slug={tenant_slug}")

        user_preview = _scalar(
            db,
            """
            SELECT COUNT(*)
            FROM users
            WHERE tenant_id IS NULL
              AND system_role = ANY(:system_roles)
            """,
            {"system_roles": TENANT_USER_SYSTEM_ROLES},
        )
        print(f"- users: {user_preview}")

        table_counts: dict[str, int] = {}
        for table_name in TABLES:
            count = _scalar(
                db, f"SELECT COUNT(*) FROM {table_name} WHERE tenant_id IS NULL"
            )
            table_counts[table_name] = count
            print(f"- {table_name}: {count}")

        if args.dry_run:
            db.rollback()
            print("Dry-run tamamlandi. Herhangi bir degisiklik kaydedilmedi.")
            return 0

        db.execute(
            text(
                """
                UPDATE users
                SET tenant_id = :tenant_id
                WHERE tenant_id IS NULL
                  AND system_role = ANY(:system_roles)
                """
            ),
            {"tenant_id": tenant_id, "system_roles": TENANT_USER_SYSTEM_ROLES},
        )

        for table_name in TABLES:
            db.execute(
                text(
                    f"UPDATE {table_name} SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
                ),
                {"tenant_id": tenant_id},
            )

        db.commit()
        print("Single-tenant backfill tamamlandi ve kaydedildi.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
