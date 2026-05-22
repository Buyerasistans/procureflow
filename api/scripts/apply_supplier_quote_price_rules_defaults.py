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


POSTGRES_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS supplier_quote_price_rules (
    id BIGSERIAL PRIMARY KEY,
    max_markup_percent DOUBLE PRECISION NOT NULL DEFAULT 25,
    max_discount_percent DOUBLE PRECISION NOT NULL DEFAULT 35,
    tolerance_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    block_on_violation BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
)
"""


SQLITE_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS supplier_quote_price_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    max_markup_percent REAL NOT NULL DEFAULT 25,
    max_discount_percent REAL NOT NULL DEFAULT 35,
    tolerance_amount REAL NOT NULL DEFAULT 0,
    block_on_violation INTEGER NOT NULL DEFAULT 1,
    updated_by INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
"""


def main() -> int:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        dialect_name = getattr(getattr(db.bind, "dialect", None), "name", None)
        create_sql = (
            POSTGRES_CREATE_TABLE
            if dialect_name == "postgresql"
            else SQLITE_CREATE_TABLE
        )
        db.execute(text(create_sql))

        row = db.execute(
            text("SELECT id FROM supplier_quote_price_rules ORDER BY id DESC LIMIT 1")
        ).first()
        if not row:
            if dialect_name == "postgresql":
                db.execute(
                    text(
                        """
                        INSERT INTO supplier_quote_price_rules (
                            max_markup_percent,
                            max_discount_percent,
                            tolerance_amount,
                            block_on_violation
                        ) VALUES (25, 35, 0, TRUE)
                        """
                    )
                )
            else:
                db.execute(
                    text(
                        """
                        INSERT INTO supplier_quote_price_rules (
                            max_markup_percent,
                            max_discount_percent,
                            tolerance_amount,
                            block_on_violation
                        ) VALUES (25, 35, 0, 1)
                        """
                    )
                )
        db.commit()
    finally:
        db.close()

    print("APPLIED_SUPPLIER_QUOTE_PRICE_RULES_DEFAULTS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
