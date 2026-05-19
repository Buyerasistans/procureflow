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
    url = load_db_url()
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select count(*) from users where full_name like '%?%' or full_name ilike '%Ã%' or full_name ilike '%Ä%'"
            )
            print("bad_user_names:", cur.fetchone()[0])

            cur.execute(
                "select count(*) from roles where name like '%?%' or name ilike '%Ã%' or name ilike '%Ä%'"
            )
            print("bad_role_names:", cur.fetchone()[0])

            cur.execute(
                """
                select id, full_name, email
                from users
                where full_name like '%?%' or full_name ilike '%Ã%' or full_name ilike '%Ä%'
                order by id
                limit 40
                """
            )
            rows = cur.fetchall()
            print("sample_bad_users:", len(rows))
            for row in rows:
                print(row)


if __name__ == "__main__":
    main()
