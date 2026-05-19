from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import inspect

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.database import engine
from api.scripts.audit_quote_approval_required_role_cleanup import (
    build_report,
    _load_rows,
)


DROP_COLUMN = "required_role"


def _columns() -> list[str]:
    inspector = inspect(engine)
    return [column["name"] for column in inspector.get_columns("quote_approvals")]


def build_drop_statements(existing_columns: list[str]) -> list[str]:
    if DROP_COLUMN not in existing_columns:
        return []
    return [f"ALTER TABLE quote_approvals DROP COLUMN {DROP_COLUMN}"]


def ensure_drop_ready() -> dict[str, object]:
    existing_columns = _columns()
    if DROP_COLUMN not in existing_columns:
        return {
            "summary": {
                "total_quote_approvals": 0,
                "issue_counts": {},
                "compat_cleanup_ready": True,
                "compat_cleanup_candidates": 0,
                "already_cleaned": True,
                "mirror_drop_ready": True,
                "required_role_column_exists": False,
            },
            "blocking_samples": [],
            "cleanup_candidates": [],
        }
    report = build_report(_load_rows(), required_role_column_exists=True)
    if not report["summary"]["mirror_drop_ready"]:
        raise RuntimeError(json.dumps(report["summary"], ensure_ascii=False))
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    report = ensure_drop_ready()
    existing_columns = _columns()
    statements = build_drop_statements(existing_columns)

    print(
        json.dumps(
            {
                "drop_ready": report["summary"]["mirror_drop_ready"],
                "statements": statements,
            },
            ensure_ascii=False,
        )
    )

    if not statements:
        print("APPROVAL_REQUIRED_ROLE_ALREADY_DROPPED")
        return 0

    if not args.apply:
        print("APPROVAL_REQUIRED_ROLE_DROP_PLAN_READY")
        return 0

    with engine.begin() as connection:
        for statement in statements:
            connection.exec_driver_sql(statement)

    print("APPROVAL_REQUIRED_ROLE_DROPPED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
