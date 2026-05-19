from __future__ import annotations

from pathlib import Path

import psycopg


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


def main() -> None:
    with psycopg.connect(load_db_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select coalesce(scope_type,'<null>') as scope, count(*)
                from users
                where is_active=true
                group by 1
                order by 1
                """
            )
            print("users_by_scope:", cur.fetchall())

            cur.execute(
                """
                select column_name
                from information_schema.columns
                where table_name='companies'
                """
            )
            company_cols = {r[0] for r in cur.fetchall()}
            if "scope_type" in company_cols:
                cur.execute(
                    """
                    select coalesce(scope_type,'<null>') as scope, count(*)
                    from companies
                    where is_active=true
                    group by 1
                    order by 1
                    """
                )
                print("companies_by_scope:", cur.fetchall())
            else:
                print("companies_by_scope: <no scope_type column>")

            cur.execute(
                """
                select count(*)
                from users u
                left join company_roles cr
                  on cr.user_id=u.id and cr.is_active=true
                where u.is_active=true and cr.id is null
                """
            )
            print("active_users_without_company_role:", cur.fetchone()[0])

            cur.execute("select count(*) from company_roles where is_active=true")
            print("active_company_roles:", cur.fetchone()[0])

            if "scope_type" in company_cols:
                cur.execute(
                    """
                    select coalesce(c.scope_type,'<null>') as company_scope,
                           coalesce(u.scope_type,'<null>') as user_scope,
                           count(*)
                    from company_roles cr
                    join users u on u.id=cr.user_id and u.is_active=true
                    join companies c on c.id=cr.company_id and c.is_active=true
                    where cr.is_active=true
                    group by 1,2
                    order by 1,2
                    """
                )
                print("company_scope_vs_user_scope:")
                for row in cur.fetchall():
                    print(" ", row)


if __name__ == "__main__":
    main()
