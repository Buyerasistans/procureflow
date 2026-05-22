from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from api.database import engine
from api.db.session import SessionLocal


LEGACY_OPTIONAL_COLUMNS = (
    "user_id",
    "amount",
    "created_by",
    "updated_by",
    "deleted_by",
)


def get_existing_quote_columns() -> set[str]:
    inspector = inspect(engine)
    return {column["name"] for column in inspector.get_columns("quotes")}


def _load_rows(db: Session, existing_columns: set[str]) -> list[dict[str, Any]]:
    optional_selects = [
        column_name if column_name in existing_columns else f"NULL AS {column_name}"
        for column_name in LEGACY_OPTIONAL_COLUMNS
    ]
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


def _collect_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []

    if row.get("created_by_id") is None:
        issues.append("missing_created_by_id")
    elif row.get("user_id") is not None and row.get("user_id") != row.get(
        "created_by_id"
    ):
        issues.append("legacy_user_id_mismatch")

    if row.get("total_amount") is None:
        issues.append("missing_total_amount")
    elif row.get("amount") is not None and row.get("amount") != row.get("total_amount"):
        issues.append("legacy_amount_mismatch")

    if row.get("created_by") is not None and row.get("created_by") != row.get(
        "created_by_id"
    ):
        issues.append("legacy_created_by_mismatch")

    if row.get("deleted_at") is None and row.get("deleted_by") is not None:
        issues.append("deleted_by_without_deleted_at")

    return issues


def build_report_from_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        issues = _collect_issues(row)
        if not issues:
            continue
        issue_counts.update(issues)
        if len(samples) < 25:
            sample = dict(row)
            sample["issues"] = issues
            samples.append(sample)

    return {
        "summary": {
            "quotes": len(rows),
            "issue_counts": dict(sorted(issue_counts.items())),
            "drop_ready": not issue_counts,
        },
        "samples": samples,
    }


def _normalize_for_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _normalize_for_json(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize_for_json(item) for item in value]
    return value


def _write_json(path: str, payload: dict[str, Any]) -> None:
    Path(path).write_text(
        json.dumps(_normalize_for_json(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_csv(path: str, samples: list[dict[str, Any]]) -> None:
    fieldnames = [
        "id",
        "tenant_id",
        "user_id",
        "created_by_id",
        "amount",
        "total_amount",
        "created_by",
        "updated_by",
        "deleted_by",
        "deleted_at",
        "issues",
    ]
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in samples:
            serialized = _normalize_for_json(dict(row))
            serialized["issues"] = ",".join(row.get("issues", []))
            writer.writerow(serialized)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-json")
    parser.add_argument("--output-csv")
    args = parser.parse_args()

    existing_columns = get_existing_quote_columns()
    with SessionLocal() as db:
        report = build_report_from_rows(_load_rows(db, existing_columns))

    if args.output_json:
        _write_json(args.output_json, report)
    if args.output_csv:
        _write_csv(args.output_csv, report["samples"])

    print(json.dumps(report["summary"], ensure_ascii=False))
    if report["summary"]["drop_ready"]:
        if not any(
            column_name in existing_columns for column_name in LEGACY_OPTIONAL_COLUMNS
        ):
            print("QUOTE_LEGACY_MIRRORS_ALREADY_DROPPED")
            return 0
        print("QUOTE_LEGACY_MIRRORS_DROP_READY")
        return 0
    print("QUOTE_LEGACY_MIRRORS_NOT_READY")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
