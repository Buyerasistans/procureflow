from __future__ import annotations

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
from api.services.runtime_bootstrap import (
    apply_runtime_schema_patches,
    seed_runtime_defaults,
)


def main() -> None:
    apply_runtime_foundation_columns()
    apply_runtime_compat_columns()
    apply_runtime_quote_compat_columns()
    apply_supplier_quote_price_rules_defaults()
    apply_runtime_schema_patches()
    seed_runtime_defaults()


if __name__ == "__main__":
    main()
