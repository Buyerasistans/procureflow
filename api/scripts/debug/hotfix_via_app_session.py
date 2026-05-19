from sqlalchemy import text
from api.db.session import SessionLocal


def main():
    db = SessionLocal()
    try:
        print("USING =>", db.get_bind().engine.url)
        print(
            "DB =>",
            db.execute(text("select current_database(), current_schema()")).fetchone(),
        )

        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)"))
        db.execute(text("UPDATE users SET role='admin' WHERE role IS NULL"))
        db.execute(text("ALTER TABLE users ALTER COLUMN role SET NOT NULL"))

        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN"))
        db.execute(text("UPDATE users SET is_active=TRUE WHERE is_active IS NULL"))
        db.execute(text("ALTER TABLE users ALTER COLUMN is_active SET NOT NULL"))

        cols = db.execute(
            text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='users'
            ORDER BY ordinal_position
        """)
        ).fetchall()
        print("users columns =>", [c[0] for c in cols])

        db.commit()
        print("OK")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
