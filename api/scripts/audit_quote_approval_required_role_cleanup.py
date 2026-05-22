from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.database import engine
from api.db.session import SessionLocal


def _normalized(value: object | None) -> str:
    return str(value or "").strip().lower()


def _quote_approval_columns() -> set[str]:
    inspector = inspect(engine)
    return {column["name"] for column in inspector.get_columns("quote_approvals")}


def _load_rows() -> list[dict[str, Any]]:
    columns = _quote_approval_columns()
    required_role_select = (
        "required_role" if "required_role" in columns else "NULL AS required_role"
    )
    with SessionLocal() as db:
        result = db.execute(
            text(
                f"""
                SELECT id, quote_id, approval_level, {required_role_select}, required_business_role, status
                FROM quote_approvals
                ORDER BY id ASC
                """
            )
        )
        return [dict(row) for row in result.mappings().all()]


def build_report(
    rows: list[dict[str, Any]], *, required_role_column_exists: bool
) -> dict[str, Any]:
    issue_counts: dict[str, int] = {}
    cleanup_candidates: list[dict[str, Any]] = []
    blocking_samples: list[dict[str, Any]] = []

    for row in rows:
        issues: list[str] = []
        required_role = _normalized(row.get("required_role"))
        required_business_role = _normalized(row.get("required_business_role"))

        if not required_business_role:
            issues.append("missing_required_business_role")
        elif (
            required_role_column_exists
            and required_role
            and required_role != required_business_role
        ):
            issues.append("required_role_mirror_mismatch")
        elif (
            required_role_column_exists
            and required_role == required_business_role
            and required_role
        ):
            cleanup_candidates.append(
                {
                    "id": row.get("id"),
                    "quote_id": row.get("quote_id"),
                    "approval_level": row.get("approval_level"),
                    "required_role": required_role,
                    "required_business_role": required_business_role,
                    "status": _normalized(row.get("status")),
                }
            )

        for issue in issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1

        if issues and len(blocking_samples) < 25:
            blocking_samples.append(
                {
                    "id": row.get("id"),
                    "quote_id": row.get("quote_id"),
                    "approval_level": row.get("approval_level"),
                    "required_role": required_role or None,
                    "required_business_role": required_business_role or None,
                    "status": _normalized(row.get("status")),
                    "issues": issues,
                }
            )

    compat_cleanup_ready = not issue_counts
    mirror_drop_ready = compat_cleanup_ready and (
        not required_role_column_exists
        or all(not _normalized(row.get("required_role")) for row in rows)
    )
    already_cleaned = compat_cleanup_ready and len(cleanup_candidates) == 0

    return {
        "summary": {
            "total_quote_approvals": len(rows),
            "issue_counts": dict(sorted(issue_counts.items())),
            "compat_cleanup_ready": compat_cleanup_ready,
            "compat_cleanup_candidates": len(cleanup_candidates),
            "already_cleaned": already_cleaned,
            "mirror_drop_ready": mirror_drop_ready,
            "required_role_column_exists": required_role_column_exists,
        },
        "blocking_samples": blocking_samples,
        "cleanup_candidates": cleanup_candidates[:25],
    }


def apply_cleanup(
    rows: list[dict[str, Any]], *, required_role_column_exists: bool
) -> dict[str, Any]:
    report = build_report(rows, required_role_column_exists=required_role_column_exists)
    summary = report["summary"]
    if not summary["compat_cleanup_ready"]:
        raise RuntimeError("APPROVAL_REQUIRED_ROLE_COMPAT_NOT_READY")
    if not required_role_column_exists or summary["compat_cleanup_candidates"] == 0:
        return {"updated_count": 0, "updated_ids": []}

    candidate_ids = [int(row["id"]) for row in report["cleanup_candidates"]]
    with SessionLocal() as db:
        db.execute(
            text(
                """
                UPDATE quote_approvals
                SET required_role = NULL
                WHERE required_business_role IS NOT NULL
                  AND required_role IS NOT NULL
                  AND required_role = required_business_role
                """
            )
        )
        db.commit()

    return {"updated_count": len(candidate_ids), "updated_ids": candidate_ids}


def _write_json(path: str, payload: dict[str, Any]) -> None:
    Path(path).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_csv(path: str, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "id",
        "quote_id",
        "approval_level",
        "required_role",
        "required_business_role",
        "status",
        "issues",
    ]
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            serialized = dict(row)
            serialized["issues"] = ",".join(row.get("issues", []))
            writer.writerow(serialized)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output-json")
    parser.add_argument("--output-csv")
    args = parser.parse_args()

    required_role_column_exists = "required_role" in _quote_approval_columns()
    rows = _load_rows()
    report = build_report(rows, required_role_column_exists=required_role_column_exists)

    if args.apply:
        result = apply_cleanup(
            rows,
            required_role_column_exists=required_role_column_exists,
        )
        report = build_report(
            _load_rows(),
            required_role_column_exists="required_role" in _quote_approval_columns(),
        ) | {"apply_result": result}

    csv_rows = report["blocking_samples"] or report["cleanup_candidates"]
    if args.output_json:
        _write_json(args.output_json, report)
    if args.output_csv:
        _write_csv(args.output_csv, csv_rows)

    print(json.dumps(report["summary"], ensure_ascii=False))
    summary = report["summary"]
    if not summary["compat_cleanup_ready"]:
        print("APPROVAL_REQUIRED_ROLE_COMPAT_NOT_READY")
        return 1
    if not summary["required_role_column_exists"]:
        print("APPROVAL_REQUIRED_ROLE_ALREADY_DROPPED")
        return 0
    if args.apply:
        if report.get("apply_result", {}).get("updated_count", 0) > 0:
            print("APPROVAL_REQUIRED_ROLE_COMPAT_CLEANED")
            return 0
        print("APPROVAL_REQUIRED_ROLE_COMPAT_ALREADY_CLEAN")
        return 0
    if summary["already_cleaned"]:
        print("APPROVAL_REQUIRED_ROLE_COMPAT_ALREADY_CLEAN")
        return 0
    if summary["mirror_drop_ready"]:
        print("APPROVAL_REQUIRED_ROLE_MIRROR_DROP_READY")
        return 0
    print("APPROVAL_REQUIRED_ROLE_COMPAT_CLEANUP_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
