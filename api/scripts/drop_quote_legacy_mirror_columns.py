from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import inspect, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.database import engine
from api.db.session import SessionLocal
from api.scripts.audit_quote_mirror_drop_readiness import (
    build_report_from_rows,
    get_existing_quote_columns,
)


DROP_COLUMNS = ["user_id", "amount", "created_by", "updated_by", "deleted_by"]


def _load_quote_rows() -> list[dict[str, object]]:
    existing_columns = get_existing_quote_columns()
    optional_selects = [
        column_name if column_name in existing_columns else f"NULL AS {column_name}"
        for column_name in DROP_COLUMNS
    ]
    with SessionLocal() as db:
        result = db.execute(
            text(
                f"""
            SELECT
                id,
                tenant_id,
                created_by_id,
                total_amount,
                {", ".join(optional_selects)},
                deleted_at
            FROM quotes
            ORDER BY id ASC
            """
            )
        )
        return [dict(row) for row in result.mappings().all()]


def build_drop_statements(existing_columns: list[str], dialect_name: str) -> list[str]:
    statements: list[str] = []
    for column_name in DROP_COLUMNS:
        if column_name not in existing_columns:
            continue
        statements.append(f"ALTER TABLE quotes DROP COLUMN {column_name}")
    return statements


def ensure_drop_ready() -> dict[str, object]:
    existing_columns = get_existing_quote_columns()
    if not any(column_name in existing_columns for column_name in DROP_COLUMNS):
        return {
            "summary": {
                "quotes": 0,
                "issue_counts": {},
                "drop_ready": True,
            },
            "samples": [],
        }
    report = build_report_from_rows(_load_quote_rows())
    if not report["summary"]["drop_ready"]:
        raise RuntimeError(json.dumps(report["summary"], ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Readiness audit başarılıysa kolonları gerçekten düşür",
    )
    args = parser.parse_args()

    report = ensure_drop_ready()
    inspector = inspect(engine)
    existing_columns = [column["name"] for column in inspector.get_columns("quotes")]
    dialect_name = getattr(engine.dialect, "name", "unknown")
    statements = build_drop_statements(existing_columns, dialect_name)

    print(
        json.dumps(
            {
                "dialect": dialect_name,
                "drop_ready": report["summary"]["drop_ready"],
                "statements": statements,
            },
            ensure_ascii=False,
        )
    )

    if not statements:
        print("QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED")
        return 0

    if not args.apply:
        print("QUOTE_LEGACY_MIRRORS_DROP_PLAN_READY")
        return 0

    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)

    print("QUOTE_LEGACY_MIRRORS_DROPPED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
