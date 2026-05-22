from __future__ import annotations

import json
import sys
from pathlib import Path

from sqlalchemy import inspect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import api.models  # noqa: F401
from api.database import engine


TARGET_TABLES = [
    "users",
    "companies",
    "departments",
    "roles",
    "company_roles",
    "projects",
    "suppliers",
    "quotes",
    "quote_approvals",
    "email_settings",
    "system_emails",
    "tenants",
    "tenant_settings",
]


def main() -> int:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    items: list[dict[str, object]] = []

    for table_name in TARGET_TABLES:
        exists = table_name in existing_tables
        columns = (
            {column["name"] for column in inspector.get_columns(table_name)}
            if exists
            else set()
        )
        items.append(
            {
                "table_name": table_name,
                "exists": exists,
                "has_tenant_id": "tenant_id" in columns,
                "has_created_by_id": "created_by_id" in columns,
                "has_owner_user_id": "owner_user_id" in columns,
                "status": "ready"
                if exists
                and (
                    table_name.startswith("tenant_")
                    or "tenant_id" in columns
                    or table_name == "tenants"
                )
                else "needs_followup",
            }
        )

    summary = {
        "total_tables": len(items),
        "ready_tables": sum(1 for item in items if item["status"] == "ready"),
        "needs_followup_tables": sum(1 for item in items if item["status"] != "ready"),
        "items": items,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
