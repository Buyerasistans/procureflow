from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import api.models  # noqa: F401
from api.database import Base, engine
from api.db.session import SessionLocal


STATEMENTS = [
    # Quote / RFQ uyumluluk alanlari
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS department_id INTEGER",
    "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER",
    "ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 20 NOT NULL",
    "ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS group_key VARCHAR(50)",
    "ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS is_group_header BOOLEAN DEFAULT FALSE NOT NULL",
    # System settings JSON alanlari
    "ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS vat_rates_json TEXT DEFAULT '[1,10,20]' NOT NULL",
    'ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS public_pricing_json TEXT DEFAULT \'{"strategic_partner":{"plans":[]},"supplier":{"plans":[]}}\' NOT NULL',
    'ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS workspace_panels_json TEXT DEFAULT \'{"version":1,"profiles":[]}\' NOT NULL',
    # Supplier quote revision / fiyat uyumluluk alanlari
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS initial_final_amount REAL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS discount_percent REAL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS discount_amount REAL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255)",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS delivery_time INTEGER",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS warranty VARCHAR(255)",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0 NOT NULL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS is_revised_version BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS revision_of_id INTEGER",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS profitability_amount REAL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS profitability_percent REAL",
    "ALTER TABLE supplier_quotes ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TRY' NOT NULL",
    "ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS revision_prices TEXT",
    "ALTER TABLE supplier_quote_items ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0 NOT NULL",
]


def main() -> int:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        conn = db.connection()
        for statement in STATEMENTS:
            conn.exec_driver_sql(statement)
        db.commit()
    finally:
        db.close()

    print("APPLIED_RUNTIME_QUOTE_COMPAT_COLUMNS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
