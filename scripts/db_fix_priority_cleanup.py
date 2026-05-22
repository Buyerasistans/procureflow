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


def get_role_id(cur: psycopg.Cursor, role_name: str) -> int:
    cur.execute("select id from roles where name=%s order by id limit 1", (role_name,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Role not found: {role_name}")
    return int(row[0])


def upsert_active_company_role(
    cur: psycopg.Cursor,
    *,
    user_id: int,
    company_id: int,
    role_id: int,
    tenant_id: int | None,
) -> None:
    cur.execute(
        """
        select id
        from company_roles
        where user_id=%s and is_active=true
        order by id
        """,
        (user_id,),
    )
    rows = cur.fetchall()
    if rows:
        cur.execute(
            """
            update company_roles
            set company_id=%s,
                role_id=%s,
                tenant_id=%s,
                department_id=null,
                updated_at=now()
            where user_id=%s and is_active=true
            """,
            (company_id, role_id, tenant_id, user_id),
        )
    else:
        cur.execute(
            """
            insert into company_roles (user_id, company_id, role_id, is_active, tenant_id, created_at, updated_at)
            values (%s, %s, %s, true, %s, now(), now())
            """,
            (user_id, company_id, role_id, tenant_id),
        )


def normalize_generated_names(cur: psycopg.Cursor) -> int:
    cur.execute(
        """
        update users u
        set full_name = r.name
        from company_roles cr
        join roles r on r.id = cr.role_id
        where cr.user_id = u.id
          and cr.is_active = true
          and u.is_active = true
          and u.email ~ '^c[0-9]+\\.'
          and u.email like '%@buyerasistans.com.tr'
          and u.scope_type in ('partner', 'supplier')
          and coalesce(u.full_name, '') <> r.name
        """
    )
    return cur.rowcount


def assign_unmapped_channel_users(cur: psycopg.Cursor) -> int:
    channel_owner_role_id = get_role_id(cur, "Kanal Hesap Sahibi")
    channel_agent_role_id = get_role_id(cur, "Kanal Temsilcisi")

    cur.execute(
        """
        select id, tenant_id
        from companies
        where name='Kanal Ana Yönetici Demo Workspace'
        order by id
        limit 1
        """
    )
    company = cur.fetchone()
    if not company:
        raise RuntimeError("Kanal Ana Yönetici Demo Workspace company not found")

    channel_company_id = int(company[0])
    channel_tenant_id = company[1]

    cur.execute(
        """
        select u.id, u.role
        from users u
        left join company_roles cr on cr.user_id=u.id and cr.is_active=true
        where u.is_active=true
          and u.scope_type='channel'
          and cr.id is null
        order by u.id
        """
    )
    rows = cur.fetchall()
    for user_id, role in rows:
        role_id = (
            channel_owner_role_id if role == "channel_owner" else channel_agent_role_id
        )
        upsert_active_company_role(
            cur,
            user_id=int(user_id),
            company_id=channel_company_id,
            role_id=role_id,
            tenant_id=channel_tenant_id,
        )
    return len(rows)


def summary(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        select coalesce(scope_type,'<null>'), count(*)
        from users
        where is_active=true
        group by 1
        order by 1
        """
    )
    print("active_by_scope:", cur.fetchall())

    cur.execute(
        """
        select u.scope_type, count(*)
        from users u
        left join company_roles cr on cr.user_id=u.id and cr.is_active=true
        where u.is_active=true and cr.id is null
        group by u.scope_type
        order by u.scope_type
        """
    )
    print("active_without_company_role:", cur.fetchall())


def main() -> None:
    conn = psycopg.connect(load_db_url())
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                normalized = normalize_generated_names(cur)
                channel_assigned = assign_unmapped_channel_users(cur)
                summary(cur)
                print("normalized_names:", normalized)
                print("channel_users_assigned:", channel_assigned)
        print("db_fix_priority_cleanup: committed")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
