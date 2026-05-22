from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import inspect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.database import engine
from api.scripts.apply_runtime_compat_columns import (
    main as apply_runtime_compat_columns,
)
from api.scripts.apply_runtime_foundation_columns import (
    main as apply_runtime_foundation_columns,
)
from api.scripts.apply_runtime_quote_compat_columns import (
    main as apply_runtime_quote_compat_columns,
)
from api.scripts.apply_supplier_quote_price_rules_defaults import (
    main as apply_supplier_quote_price_rules_defaults,
)


EXPECTED_COLUMNS: dict[str, set[str]] = {
    "users": {"tenant_id", "system_role", "scope_type"},
    "companies": {"tenant_id", "logo_url"},
    "quotes": {"tenant_id", "department_id", "assigned_to_id"},
    "quote_items": {"vat_rate", "group_key", "is_group_header"},
    "supplier_quotes": {"initial_final_amount", "currency", "revision_number"},
    "system_settings": {
        "vat_rates_json",
        "public_pricing_json",
        "workspace_panels_json",
    },
    "supplier_quote_price_rules": {
        "max_markup_percent",
        "max_discount_percent",
        "tolerance_amount",
        "block_on_violation",
    },
}


def main() -> int:
    apply_runtime_foundation_columns()
    apply_runtime_compat_columns()
    apply_runtime_quote_compat_columns()
    apply_supplier_quote_price_rules_defaults()

    inspector = inspect(engine)
    failures: list[str] = []
    for table_name, expected_columns in EXPECTED_COLUMNS.items():
        existing_columns = {item["name"] for item in inspector.get_columns(table_name)}
        missing_columns = sorted(expected_columns - existing_columns)
        if missing_columns:
            failures.append(f"{table_name}: missing {', '.join(missing_columns)}")

    if failures:
        print("INVALID_RUNTIME_BOOTSTRAP_CHAIN")
        for failure in failures:
            print(failure)
        return 1

    print("VALIDATED_RUNTIME_BOOTSTRAP_CHAIN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
