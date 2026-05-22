from __future__ import annotations

from pathlib import Path
from typing import Iterable

import psycopg


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


def looks_mojibake(value: str) -> bool:
    return any(token in value for token in ("Ã", "Å", "Ä", "\ufffd", "?"))


def decode_mojibake(value: str) -> str:
    current = value
    for _ in range(2):
        try:
            raw = bytes((ord(ch) & 0xFF) for ch in current)
            decoded = raw.decode("utf-8", errors="strict")
        except Exception:
            break
        if not decoded or decoded == current:
            break
        current = decoded
    return current


def fix_table_text(cur: psycopg.Cursor, table: str, id_col: str, text_col: str) -> int:
    cur.execute(
        f"select {id_col}, {text_col} from {table} where {text_col} is not null"
    )
    rows: Iterable[tuple[int, str]] = cur.fetchall()
    updates = 0
    for row_id, value in rows:
        if not value:
            continue
        if not looks_mojibake(value):
            continue
        repaired = decode_mojibake(value)
        if repaired != value:
            cur.execute(
                f"update {table} set {text_col}=%s where {id_col}=%s",
                (repaired, row_id),
            )
            updates += cur.rowcount
    return updates


def enforce_platform_assignments(cur: psycopg.Cursor) -> int:
    cur.execute("select id from companies where name='BUYER ASISTANS PLATFORM' limit 1")
    platform_company = cur.fetchone()
    if not platform_company:
        return 0
    platform_company_id = int(platform_company[0])

    cur.execute(
        """
        select id
        from users
        where is_active=true
          and (
            scope_type='platform'
            or lower(coalesce(email, ''))='superadmin@buyerasistans.com.tr'
          )
        """
    )
    user_ids = [int(r[0]) for r in cur.fetchall()]
    if not user_ids:
        return 0

    cur.execute(
        """
        update company_roles
        set company_id=%s, tenant_id=null, updated_at=now()
        where is_active=true
          and user_id = any(%s)
        """,
        (platform_company_id, user_ids),
    )
    return cur.rowcount


def print_summary(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        select scope_type, count(*)
        from users
        where is_active=true
        group by scope_type
        order by scope_type
        """
    )
    print("active_scope_counts:", cur.fetchall())

    cur.execute(
        """
        select count(*)
        from users u
        left join company_roles cr on cr.user_id=u.id and cr.is_active=true
        where u.is_active=true and cr.id is null
        """
    )
    print("active_without_company_role:", cur.fetchone()[0])


def main() -> None:
    conn = psycopg.connect(load_db_url())
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                updates = {
                    "roles.name": fix_table_text(cur, "roles", "id", "name"),
                    "roles.description": fix_table_text(
                        cur, "roles", "id", "description"
                    ),
                    "departments.name": fix_table_text(
                        cur, "departments", "id", "name"
                    ),
                    "departments.description": fix_table_text(
                        cur, "departments", "id", "description"
                    ),
                    "users.full_name": fix_table_text(cur, "users", "id", "full_name"),
                    "companies.name": fix_table_text(cur, "companies", "id", "name"),
                    "companies.short_name": fix_table_text(
                        cur, "companies", "id", "short_name"
                    ),
                    "tenants.brand_name": fix_table_text(
                        cur, "tenants", "id", "brand_name"
                    ),
                    "tenants.legal_name": fix_table_text(
                        cur, "tenants", "id", "legal_name"
                    ),
                }
                platform_reassigned = enforce_platform_assignments(cur)
                print("text_repairs:", updates)
                print("platform_reassigned_company_roles:", platform_reassigned)
                print_summary(cur)
        print("db_repair_utf8_and_scope_cleanup: committed")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
