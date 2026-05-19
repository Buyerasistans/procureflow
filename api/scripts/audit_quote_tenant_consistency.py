from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import text
from sqlalchemy.orm import Session

from api.db.session import SessionLocal


def _normalized(value: object | None) -> str:
    return str(value or "").strip()


def _load_rows(db: Session, sql: str) -> list[dict[str, Any]]:
    result = db.execute(text(sql))
    return [dict(row) for row in result.mappings().all()]


def _quote_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT q.id, q.tenant_id, q.project_id, p.tenant_id AS project_tenant_id,
               q.created_by_id, u.tenant_id AS creator_tenant_id
        FROM quotes q
        LEFT JOIN projects p ON p.id = q.project_id
        LEFT JOIN users u ON u.id = q.created_by_id
        ORDER BY q.id ASC
        """,
    )


def _supplier_quote_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT sq.id, sq.quote_id, q.tenant_id AS quote_tenant_id,
               sq.supplier_id, s.tenant_id AS supplier_tenant_id,
               sq.supplier_user_id, su.supplier_id AS supplier_user_supplier_id,
               sq.revision_of_id, parent.quote_id AS revision_parent_quote_id
        FROM supplier_quotes sq
        LEFT JOIN quotes q ON q.id = sq.quote_id
        LEFT JOIN suppliers s ON s.id = sq.supplier_id
        LEFT JOIN supplier_users su ON su.id = sq.supplier_user_id
        LEFT JOIN supplier_quotes parent ON parent.id = sq.revision_of_id
        ORDER BY sq.id ASC
        """,
    )


def _quote_approval_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT qa.id, qa.tenant_id, qa.quote_id, q.tenant_id AS quote_tenant_id,
               qa.supplier_quote_id, sq.quote_id AS supplier_quote_parent_quote_id
        FROM quote_approvals qa
        LEFT JOIN quotes q ON q.id = qa.quote_id
        LEFT JOIN supplier_quotes sq ON sq.id = qa.supplier_quote_id
        ORDER BY qa.id ASC
        """,
    )


def _quote_status_log_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT qsl.id, qsl.quote_id, q.tenant_id AS quote_tenant_id,
               qsl.changed_by, u.tenant_id AS changed_by_tenant_id
        FROM quote_status_logs qsl
        LEFT JOIN quotes q ON q.id = qsl.quote_id
        LEFT JOIN users u ON u.id = qsl.changed_by
        ORDER BY qsl.id ASC
        """,
    )


def _report_rows(db: Session) -> list[dict[str, Any]]:
    return _load_rows(
        db,
        """
        SELECT 'quote_comparisons' AS table_name, qc.id, qc.quote_id,
               q.tenant_id AS quote_tenant_id,
               qc.winner_supplier_id AS supplier_id,
               s.tenant_id AS supplier_tenant_id,
               NULL::INTEGER AS supplier_quote_id,
               NULL::INTEGER AS supplier_quote_parent_quote_id
        FROM quote_comparisons qc
        LEFT JOIN quotes q ON q.id = qc.quote_id
        LEFT JOIN suppliers s ON s.id = qc.winner_supplier_id
        UNION ALL
        SELECT 'supplier_ratings' AS table_name, sr.id, sr.quote_id,
               q.tenant_id AS quote_tenant_id,
               sr.supplier_id,
               s.tenant_id AS supplier_tenant_id,
               NULL::INTEGER AS supplier_quote_id,
               NULL::INTEGER AS supplier_quote_parent_quote_id
        FROM supplier_ratings sr
        LEFT JOIN quotes q ON q.id = sr.quote_id
        LEFT JOIN suppliers s ON s.id = sr.supplier_id
        UNION ALL
        SELECT 'price_analyses' AS table_name, pa.id, pa.quote_id,
               q.tenant_id AS quote_tenant_id,
               pa.cheapest_supplier_id AS supplier_id,
               cs.tenant_id AS supplier_tenant_id,
               NULL::INTEGER AS supplier_quote_id,
               NULL::INTEGER AS supplier_quote_parent_quote_id
        FROM price_analyses pa
        LEFT JOIN quotes q ON q.id = pa.quote_id
        LEFT JOIN suppliers cs ON cs.id = pa.cheapest_supplier_id
        UNION ALL
        SELECT 'contracts' AS table_name, c.id, c.quote_id,
               q.tenant_id AS quote_tenant_id,
               c.supplier_id,
               s.tenant_id AS supplier_tenant_id,
               c.supplier_quote_id,
               sq.quote_id AS supplier_quote_parent_quote_id
        FROM contracts c
        LEFT JOIN quotes q ON q.id = c.quote_id
        LEFT JOIN suppliers s ON s.id = c.supplier_id
        LEFT JOIN supplier_quotes sq ON sq.id = c.supplier_quote_id
        ORDER BY table_name, id ASC
        """,
    )


def _add_issue(
    samples: list[dict[str, Any]], row: dict[str, Any], issue: str, limit: int = 25
) -> None:
    if len(samples) >= limit:
        return
    sample = dict(row)
    sample["issue"] = issue
    samples.append(sample)


def _audit_quotes(db: Session) -> dict[str, Any]:
    rows = _quote_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        tenant_id = row.get("tenant_id")
        project_tenant_id = row.get("project_tenant_id")
        creator_tenant_id = row.get("creator_tenant_id")

        if tenant_id is None:
            issue_counts.update(["quote_missing_tenant_id"])
            _add_issue(samples, row, "quote_missing_tenant_id")
        if (
            tenant_id is not None
            and project_tenant_id is not None
            and tenant_id != project_tenant_id
        ):
            issue_counts.update(["quote_project_tenant_mismatch"])
            _add_issue(samples, row, "quote_project_tenant_mismatch")
        if (
            tenant_id is not None
            and creator_tenant_id is not None
            and tenant_id != creator_tenant_id
        ):
            issue_counts.update(["quote_creator_tenant_mismatch"])
            _add_issue(samples, row, "quote_creator_tenant_mismatch")

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def _audit_supplier_quotes(db: Session) -> dict[str, Any]:
    rows = _supplier_quote_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        quote_tenant_id = row.get("quote_tenant_id")
        supplier_tenant_id = row.get("supplier_tenant_id")
        supplier_user_supplier_id = row.get("supplier_user_supplier_id")
        supplier_id = row.get("supplier_id")
        revision_parent_quote_id = row.get("revision_parent_quote_id")
        quote_id = row.get("quote_id")

        if quote_tenant_id is None:
            issue_counts.update(["supplier_quote_parent_quote_missing_tenant"])
            _add_issue(samples, row, "supplier_quote_parent_quote_missing_tenant")
        if (
            quote_tenant_id is not None
            and supplier_tenant_id is not None
            and quote_tenant_id != supplier_tenant_id
        ):
            issue_counts.update(["supplier_quote_supplier_tenant_mismatch"])
            _add_issue(samples, row, "supplier_quote_supplier_tenant_mismatch")
        if (
            supplier_user_supplier_id is not None
            and supplier_id is not None
            and supplier_user_supplier_id != supplier_id
        ):
            issue_counts.update(["supplier_quote_supplier_user_mismatch"])
            _add_issue(samples, row, "supplier_quote_supplier_user_mismatch")
        if (
            revision_parent_quote_id is not None
            and quote_id is not None
            and revision_parent_quote_id != quote_id
        ):
            issue_counts.update(["supplier_quote_revision_parent_mismatch"])
            _add_issue(samples, row, "supplier_quote_revision_parent_mismatch")

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def _audit_quote_approvals(db: Session) -> dict[str, Any]:
    rows = _quote_approval_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        tenant_id = row.get("tenant_id")
        quote_tenant_id = row.get("quote_tenant_id")
        supplier_quote_parent_quote_id = row.get("supplier_quote_parent_quote_id")
        quote_id = row.get("quote_id")

        if quote_tenant_id is None:
            issue_counts.update(["quote_approval_parent_quote_missing_tenant"])
            _add_issue(samples, row, "quote_approval_parent_quote_missing_tenant")
        if tenant_id is None:
            issue_counts.update(["quote_approval_missing_tenant_id"])
            _add_issue(samples, row, "quote_approval_missing_tenant_id")
        elif quote_tenant_id is not None and tenant_id != quote_tenant_id:
            issue_counts.update(["quote_approval_tenant_mismatch"])
            _add_issue(samples, row, "quote_approval_tenant_mismatch")
        if (
            supplier_quote_parent_quote_id is not None
            and quote_id is not None
            and supplier_quote_parent_quote_id != quote_id
        ):
            issue_counts.update(["quote_approval_supplier_quote_parent_mismatch"])
            _add_issue(samples, row, "quote_approval_supplier_quote_parent_mismatch")

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def _audit_quote_status_logs(db: Session) -> dict[str, Any]:
    rows = _quote_status_log_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        quote_tenant_id = row.get("quote_tenant_id")
        changed_by_tenant_id = row.get("changed_by_tenant_id")

        if quote_tenant_id is None:
            issue_counts.update(["quote_status_log_parent_quote_missing_tenant"])
            _add_issue(samples, row, "quote_status_log_parent_quote_missing_tenant")
        if (
            quote_tenant_id is not None
            and changed_by_tenant_id is not None
            and quote_tenant_id != changed_by_tenant_id
        ):
            issue_counts.update(["quote_status_log_actor_tenant_mismatch"])
            _add_issue(samples, row, "quote_status_log_actor_tenant_mismatch")

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def _audit_report_chain(db: Session) -> dict[str, Any]:
    rows = _report_rows(db)
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []

    for row in rows:
        quote_tenant_id = row.get("quote_tenant_id")
        supplier_tenant_id = row.get("supplier_tenant_id")
        supplier_quote_id = row.get("supplier_quote_id")
        supplier_quote_parent_quote_id = row.get("supplier_quote_parent_quote_id")
        quote_id = row.get("quote_id")

        if quote_tenant_id is None:
            issue_counts.update(["report_parent_quote_missing_tenant"])
            _add_issue(samples, row, "report_parent_quote_missing_tenant")
        if (
            supplier_tenant_id is not None
            and quote_tenant_id is not None
            and supplier_tenant_id != quote_tenant_id
        ):
            issue_counts.update(["report_supplier_tenant_mismatch"])
            _add_issue(samples, row, "report_supplier_tenant_mismatch")
        if (
            supplier_quote_id is not None
            and supplier_quote_parent_quote_id is not None
            and quote_id is not None
            and supplier_quote_parent_quote_id != quote_id
        ):
            issue_counts.update(["report_supplier_quote_parent_mismatch"])
            _add_issue(samples, row, "report_supplier_quote_parent_mismatch")

    return {
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def build_report(db: Session) -> dict[str, Any]:
    sections = {
        "quotes": _audit_quotes(db),
        "supplier_quotes": _audit_supplier_quotes(db),
        "quote_approvals": _audit_quote_approvals(db),
        "quote_status_logs": _audit_quote_status_logs(db),
        "report_chain": _audit_report_chain(db),
    }
    total_issue_counts: Counter[str] = Counter()
    total_problem_rows = 0

    for section in sections.values():
        total_issue_counts.update(section.get("issue_counts", {}))
        total_problem_rows += len(section.get("samples", []))

    return {
        "summary": {
            "section_count": len(sections),
            "issue_counts": dict(sorted(total_issue_counts.items())),
            "problem_sample_rows": total_problem_rows,
        },
        "sections": sections,
    }


def _write_json(report: dict[str, Any], path: Path) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_csv(report: dict[str, Any], path: Path) -> None:
    rows: list[dict[str, Any]] = []
    for section_name, section in report.get("sections", {}).items():
        for sample in section.get("samples", []):
            row = {"section": section_name}
            for key, value in sample.items():
                row[key] = (
                    json.dumps(value, ensure_ascii=False)
                    if isinstance(value, (dict, list))
                    else value
                )
            rows.append(row)

    fieldnames: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in fieldnames:
                fieldnames.append(key)

    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames or ["section"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit quote tenant consistency across RFQ chain"
    )
    parser.add_argument("--json-out", type=str, help="JSON rapor yolu")
    parser.add_argument("--csv-out", type=str, help="CSV rapor yolu")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_report(db)
    finally:
        db.close()

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))

    if args.json_out:
        _write_json(report, Path(args.json_out))
        print(f"JSON rapor yazildi: {_normalized(args.json_out)}")

    if args.csv_out:
        _write_csv(report, Path(args.csv_out))
        print(f"CSV rapor yazildi: {_normalized(args.csv_out)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
