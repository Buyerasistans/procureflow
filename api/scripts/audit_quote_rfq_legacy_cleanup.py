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


AUTO_FIXABLE_ISSUES = {
    "quote_created_by_mirror_mismatch",
    "quote_total_amount_mirror_mismatch",
}

LEGACY_OPTIONAL_COLUMNS = {
    "user_id",
    "amount",
}


def _normalized(value: object | None) -> str:
    return str(value or "").strip()


def _load_rows(db: Session, sql: str) -> list[dict[str, Any]]:
    result = db.execute(text(sql))
    return [dict(row) for row in result.mappings().all()]


def _quote_columns() -> set[str]:
    inspector = inspect(engine)
    return {column["name"] for column in inspector.get_columns("quotes")}


def _quote_rows(db: Session) -> list[dict[str, Any]]:
    existing_columns = _quote_columns()
    user_id_select = (
        "q.user_id AS user_id" if "user_id" in existing_columns else "NULL AS user_id"
    )
    amount_select = (
        "q.amount AS amount" if "amount" in existing_columns else "NULL AS amount"
    )
    return _load_rows(
        db,
        f"""
        SELECT q.id, q.tenant_id, q.project_id, p.tenant_id AS project_tenant_id,
               {user_id_select}, q.created_by_id,
               {amount_select}, q.total_amount,
               q.company_name, q.company_contact_name,
               q.company_contact_phone, q.company_contact_email
        FROM quotes q
        LEFT JOIN projects p ON p.id = q.project_id
        ORDER BY q.id ASC
        """,
    )


def _supplier_quote_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT sq.id, sq.quote_id, q.tenant_id AS quote_tenant_id,
               sq.supplier_id, s.tenant_id AS supplier_tenant_id,
               sq.revision_of_id, parent.quote_id AS revision_parent_quote_id
        FROM supplier_quotes sq
        LEFT JOIN quotes q ON q.id = sq.quote_id
        LEFT JOIN suppliers s ON s.id = sq.supplier_id
        LEFT JOIN supplier_quotes parent ON parent.id = sq.revision_of_id
        ORDER BY sq.id ASC
        """,
    )


def _collect_quote_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    existing_columns = _quote_columns()
    user_id = row.get("user_id")
    created_by_id = row.get("created_by_id")
    amount = row.get("amount")
    total_amount = row.get("total_amount")

    if "user_id" in existing_columns and user_id is None and created_by_id is not None:
        issues.append("quote_missing_legacy_user_id")
    elif (
        "user_id" in existing_columns and user_id is not None and created_by_id is None
    ):
        issues.append("quote_missing_canonical_created_by_id")
    elif (
        "user_id" in existing_columns
        and user_id is not None
        and created_by_id is not None
        and user_id != created_by_id
    ):
        issues.append("quote_created_by_mirror_mismatch")

    if "amount" in existing_columns and amount is None and total_amount is not None:
        issues.append("quote_missing_legacy_amount")
    elif "amount" in existing_columns and amount is not None and total_amount is None:
        issues.append("quote_missing_canonical_total_amount")
    elif (
        "amount" in existing_columns
        and amount is not None
        and total_amount is not None
        and amount != total_amount
    ):
        issues.append("quote_total_amount_mirror_mismatch")

    if row.get("tenant_id") is None:
        issues.append("quote_missing_tenant_id")
    elif row.get("project_tenant_id") is not None and row.get("tenant_id") != row.get(
        "project_tenant_id"
    ):
        issues.append("quote_project_tenant_mismatch")

    missing_snapshot_fields = [
        field
        for field in (
            "company_name",
            "company_contact_name",
            "company_contact_phone",
            "company_contact_email",
        )
        if not _normalized(row.get(field))
    ]
    if missing_snapshot_fields:
        issues.append("quote_missing_company_snapshot")

    return issues


def _build_quote_fix_preview(rows: list[dict[str, Any]]) -> dict[str, object]:
    fix_type_counts: Counter[str] = Counter()
    preview_rows: list[dict[str, Any]] = []

    for row in rows:
        issues = _collect_quote_issues(row)
        fixes: list[str] = []
        new_user_id = row.get("user_id")
        new_created_by_id = row.get("created_by_id")
        new_amount = row.get("amount")
        new_total_amount = row.get("total_amount")

        if "quote_created_by_mirror_mismatch" in issues:
            new_user_id = row.get("created_by_id")
            fixes.append("sync_user_id_from_created_by_id")
        elif "quote_missing_legacy_user_id" in issues:
            new_user_id = row.get("created_by_id")
            fixes.append("backfill_user_id_from_created_by_id")

        if "quote_total_amount_mirror_mismatch" in issues:
            new_amount = row.get("total_amount")
            fixes.append("sync_amount_from_total_amount")
        elif "quote_missing_legacy_amount" in issues:
            new_amount = row.get("total_amount")
            fixes.append("backfill_amount_from_total_amount")

        if not fixes:
            continue

        fix_type_counts.update(fixes)
        preview_rows.append(
            {
                "id": row.get("id"),
                "tenant_id": row.get("tenant_id"),
                "project_id": row.get("project_id"),
                "old_user_id": row.get("user_id"),
                "old_created_by_id": row.get("created_by_id"),
                "new_user_id": new_user_id,
                "new_created_by_id": new_created_by_id,
                "old_amount": row.get("amount"),
                "old_total_amount": row.get("total_amount"),
                "new_amount": new_amount,
                "new_total_amount": new_total_amount,
                "fixes": fixes,
            }
        )

    return {
        "preview_rows": len(preview_rows),
        "fix_type_counts": dict(sorted(fix_type_counts.items())),
        "samples": preview_rows[:25],
    }


def _audit_quotes(db: Session) -> dict[str, object]:
    rows = _quote_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        issues = _collect_quote_issues(row)
        if not issues:
            continue
        issue_counts.update(issues)
        if len(samples) < 25:
            sample = dict(row)
            sample["issues"] = issues
            samples.append(sample)

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
        "repair_preview": _build_quote_fix_preview(rows),
    }


def _audit_supplier_quotes(db: Session) -> dict[str, object]:
    rows = _supplier_quote_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        issues: list[str] = []
        quote_tenant_id = row.get("quote_tenant_id")
        supplier_tenant_id = row.get("supplier_tenant_id")
        revision_parent_quote_id = row.get("revision_parent_quote_id")
        quote_id = row.get("quote_id")

        if quote_tenant_id is None:
            issues.append("supplier_quote_parent_quote_missing_tenant")
        if (
            quote_tenant_id is not None
            and supplier_tenant_id is not None
            and quote_tenant_id != supplier_tenant_id
        ):
            issues.append("supplier_quote_supplier_tenant_mismatch")
        if (
            revision_parent_quote_id is not None
            and quote_id is not None
            and revision_parent_quote_id != quote_id
        ):
            issues.append("supplier_quote_revision_parent_mismatch")

        if not issues:
            continue
        issue_counts.update(issues)
        if len(samples) < 25:
            sample = dict(row)
            sample["issues"] = issues
            samples.append(sample)

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def build_report(db: Session) -> dict[str, object]:
    sections = {
        "quotes": _audit_quotes(db),
        "supplier_quotes": _audit_supplier_quotes(db),
    }
    issue_counts: Counter[str] = Counter()

    for section in sections.values():
        issue_counts.update(section.get("issue_counts", {}))

    return {
        "summary": {
            "section_count": len(sections),
            "issue_counts": dict(sorted(issue_counts.items())),
        },
        "sections": sections,
    }


def apply_fixes(db: Session, commit: bool) -> dict[str, object]:
    existing_columns = _quote_columns()
    rows = _quote_rows(db)
    updated_rows: list[dict[str, Any]] = []

    for row in rows:
        issues = _collect_quote_issues(row)
        if not issues:
            continue

        fixes: list[str] = []
        new_user_id = row.get("user_id")
        new_amount = row.get("amount")

        if (
            "quote_created_by_mirror_mismatch" in issues
            or "quote_missing_legacy_user_id" in issues
        ):
            if row.get("created_by_id") is not None:
                new_user_id = row.get("created_by_id")
                fixes.append("sync_user_id_from_created_by_id")

        if (
            "quote_total_amount_mirror_mismatch" in issues
            or "quote_missing_legacy_amount" in issues
        ):
            if row.get("total_amount") is not None:
                new_amount = row.get("total_amount")
                fixes.append("sync_amount_from_total_amount")

        if not fixes:
            continue

        assignments: list[str] = []
        params: dict[str, Any] = {"quote_id": row.get("id")}
        if "user_id" in existing_columns:
            assignments.append("user_id = :user_id")
            params["user_id"] = new_user_id
        if "amount" in existing_columns:
            assignments.append("amount = :amount")
            params["amount"] = new_amount

        if assignments:
            db.execute(
                text(
                    f"""
                    UPDATE quotes
                    SET {", ".join(assignments)}
                    WHERE id = :quote_id
                    """
                ),
                params,
            )

        updated_rows.append(
            {
                "id": row.get("id"),
                "tenant_id": row.get("tenant_id"),
                "project_id": row.get("project_id"),
                "old_user_id": row.get("user_id"),
                "new_user_id": new_user_id,
                "old_amount": row.get("amount"),
                "new_amount": new_amount,
                "fixes": fixes,
            }
        )

    if commit:
        db.commit()
    else:
        db.rollback()

    fix_type_counts: Counter[str] = Counter()
    for row in updated_rows:
        fix_type_counts.update(row.get("fixes") or [])

    return {
        "updated_count": len(updated_rows),
        "updated_quotes": updated_rows,
        "committed": commit,
        "summary": {
            "preview_rows": len(updated_rows),
            "fix_type_counts": dict(sorted(fix_type_counts.items())),
        },
    }


def _print_human(report: dict[str, object]) -> None:
    summary = report.get("summary")
    if isinstance(summary, dict):
        print("Quote/RFQ Legacy Cleanup Raporu")
        print(f"- Bölüm sayısı: {summary.get('section_count', 0)}")
        issue_counts = summary.get("issue_counts")
        if isinstance(issue_counts, dict) and issue_counts:
            print("- Sorun dağılımı:")
            for issue, count in issue_counts.items():
                print(f"  - {issue}: {count}")

    sections = report.get("sections")
    if isinstance(sections, dict):
        quotes = sections.get("quotes")
        if isinstance(quotes, dict):
            print(f"- RFQ/quote satırı: {quotes.get('total_rows', 0)}")
            repair_preview = quotes.get("repair_preview")
            if isinstance(repair_preview, dict):
                print(f"- Güvenli fix adayı: {repair_preview.get('preview_rows', 0)}")
                fix_type_counts = repair_preview.get("fix_type_counts")
                if isinstance(fix_type_counts, dict) and fix_type_counts:
                    print("- Fix türleri:")
                    for fix_type, count in fix_type_counts.items():
                        print(f"  - {fix_type}: {count}")

    rows = report.get("updated_quotes")
    if not isinstance(rows, list):
        rows = (
            ((sections or {}).get("quotes") or {}).get("samples")
            if isinstance(sections, dict)
            else []
        )
    if isinstance(rows, list) and rows:
        print("- İlk 25 kayıt:")
        for row in rows[:25]:
            print(
                "  - "
                f"id={row.get('id')} tenant_id={row.get('tenant_id')} project_id={row.get('project_id')} "
                f"issues={','.join(row.get('issues') or row.get('fixes') or [])}"
            )


def _write_json_report(report: dict[str, object], output_path: Path) -> None:
    def _normalize(value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, dict):
            return {key: _normalize(item) for key, item in value.items()}
        if isinstance(value, list):
            return [_normalize(item) for item in value]
        return value

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(_normalize(report), ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _write_csv_report(report: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    if isinstance(report.get("updated_quotes"), list):
        rows = report["updated_quotes"]  # type: ignore[index]
    else:
        sections = report.get("sections")
        if isinstance(sections, dict):
            quotes = sections.get("quotes")
            if isinstance(quotes, dict) and isinstance(quotes.get("samples"), list):
                rows = quotes["samples"]  # type: ignore[index]

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "tenant_id",
                "project_id",
                "user_id",
                "created_by_id",
                "old_user_id",
                "new_user_id",
                "amount",
                "total_amount",
                "old_amount",
                "new_amount",
                "company_name",
                "company_contact_name",
                "company_contact_phone",
                "company_contact_email",
                "issues",
                "fixes",
            ],
            extrasaction="ignore",
        )
        writer.writeheader()
        for row in rows:
            normalized_row = dict(row)
            for key in ("issues", "fixes"):
                value = normalized_row.get(key)
                if isinstance(value, list):
                    normalized_row[key] = ",".join(str(item) for item in value)
            writer.writerow(normalized_row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Quote/RFQ legacy mirror alanlari ve tenant tutarliligini denetler"
    )
    parser.add_argument("--json", action="store_true", help="Raporu JSON olarak yazdir")
    parser.add_argument(
        "--fix", action="store_true", help="Guvenli mirror fix adaylarini uygular"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Fix calistiginda transaction'i commit eder",
    )
    parser.add_argument("--json-output", type=Path, help="JSON rapor dosya yolu")
    parser.add_argument("--csv-output", type=Path, help="CSV rapor dosya yolu")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.fix:
            report = apply_fixes(db, commit=args.apply)
        else:
            report = build_report(db)
    finally:
        db.close()

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        _print_human(report)

    if args.json_output:
        _write_json_report(report, args.json_output)
    if args.csv_output:
        _write_csv_report(report, args.csv_output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
