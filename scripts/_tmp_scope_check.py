from pathlib import Path
import psycopg


def load_db_url() -> str:
    env = Path("api/.env").read_text(encoding="utf-8", errors="ignore")
    for line in env.splitlines():
        if line.startswith("DATABASE_URL="):
            return (
                line.split("=", 1)[1]
                .strip()
                .strip('"')
                .strip("'")
                .replace("postgresql+psycopg://", "postgresql://")
            )
    raise RuntimeError("DATABASE_URL not found")


conn = psycopg.connect(load_db_url())
cur = conn.cursor()

cur.execute(
    """
    select column_name
    from information_schema.columns
    where table_name='companies'
    order by ordinal_position
    """
)
print("companies.columns:", [r[0] for r in cur.fetchall()])

cur.execute(
    """
    select column_name
    from information_schema.columns
    where table_name='suppliers'
    order by ordinal_position
    """
)
print("suppliers.columns:", [r[0] for r in cur.fetchall()])

cur.execute(
    """
    select c.name, coalesce(t.category,''), count(*)
    from companies c
    left join tenants t on t.id=c.tenant_id
    where c.is_active=true
    group by 1,2
    order by 1
    """
)
print("companies:")
for row in cur.fetchall():
    print(row)

cur.execute(
    """
    select scope_type, count(*)
    from users
    where is_active=true
    group by scope_type
    order by scope_type
    """
)
print("\nusers_scope:")
for row in cur.fetchall():
    print(row)

cur.execute(
    """
    select c.name, min(r.name), max(r.name), count(*)
    from company_roles cr
    join companies c on c.id = cr.company_id
    join roles r on r.id = cr.role_id
    where cr.is_active=true
    group by c.name
    order by c.name
    """
)
print("\ncompany_role_buckets:")
for row in cur.fetchall():
    print(row)

conn.close()
