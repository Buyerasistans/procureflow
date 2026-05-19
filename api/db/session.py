from sqlalchemy import text

from api.database import SessionLocal, ensure_runtime_bootstrap


def get_db():
    ensure_runtime_bootstrap()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_db_connection() -> bool:
    ensure_runtime_bootstrap()
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
    finally:
        db.close()
