from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.db.session import SessionLocal


def _has_table(db: Session, table_name: str) -> bool:
    inspector = sa.inspect(db.bind)
    return table_name in inspector.get_table_names()


def _load_rows(db: Session, sql: str) -> list[dict[str, Any]]:
    result = db.execute(text(sql))
    return [dict(row) for row in result.mappings().all()]


def _subscription_rows(db: Session) -> list[dict[str, Any]]:
    if not _has_table(db, "tenant_subscriptions"):
        return []
    return _load_rows(
        db,
        """
        SELECT ts.id,
               ts.tenant_id,
               ts.subscription_plan_code,
               t.subscription_plan_code AS tenant_plan_code,
               ts.status,
               ts.billing_provider,
               ts.provider_subscription_id
        FROM tenant_subscriptions ts
        LEFT JOIN tenants t ON t.id = ts.tenant_id
        ORDER BY ts.id ASC
        """,
    )


def _invoice_rows(db: Session) -> list[dict[str, Any]]:
    if not _has_table(db, "billing_invoices"):
        return []
    return _load_rows(
        db,
        """
        SELECT bi.id,
               bi.tenant_id,
               bi.tenant_subscription_id,
               bi.status,
               bi.total_amount,
               bi.currency,
               ts.tenant_id AS subscription_tenant_id,
               ts.status AS subscription_status,
               ts.subscription_plan_code AS subscription_plan_code
        FROM billing_invoices bi
        LEFT JOIN tenant_subscriptions ts ON ts.id = bi.tenant_subscription_id
        ORDER BY bi.id ASC
        """,
    )


def _webhook_rows(db: Session) -> list[dict[str, Any]]:
    if not _has_table(db, "billing_webhook_events"):
        return []
    return _load_rows(
        db,
        """
        SELECT bwe.id,
               bwe.tenant_id,
               bwe.tenant_subscription_id,
               bwe.provider,
               bwe.event_type,
               bwe.provider_event_id,
               bwe.processing_status,
               bwe.error_message,
               ts.tenant_id AS subscription_tenant_id,
               ts.status AS subscription_status,
               ts.subscription_plan_code AS subscription_plan_code
        FROM billing_webhook_events bwe
        LEFT JOIN tenant_subscriptions ts ON ts.id = bwe.tenant_subscription_id
        ORDER BY bwe.id ASC
        """,
    )


def _collect_subscription_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    tenant_id = row.get("tenant_id")
    subscription_plan_code = (
        str(row.get("subscription_plan_code") or "").strip().lower()
    )
    tenant_plan_code = str(row.get("tenant_plan_code") or "").strip().lower()

    if tenant_id is None:
        issues.append("subscription_missing_tenant")
    if not subscription_plan_code:
        issues.append("subscription_missing_plan_code")
    if (
        subscription_plan_code
        and tenant_plan_code
        and subscription_plan_code != tenant_plan_code
    ):
        issues.append("subscription_tenant_plan_mismatch")
    return issues


def _collect_invoice_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    tenant_id = row.get("tenant_id")
    tenant_subscription_id = row.get("tenant_subscription_id")
    subscription_tenant_id = row.get("subscription_tenant_id")

    if tenant_id is None:
        issues.append("invoice_missing_tenant")
    if tenant_subscription_id is None:
        issues.append("invoice_missing_subscription")
    if tenant_subscription_id is not None and subscription_tenant_id is None:
        issues.append("invoice_subscription_not_found")
    if (
        tenant_id is not None
        and subscription_tenant_id is not None
        and tenant_id != subscription_tenant_id
    ):
        issues.append("invoice_subscription_tenant_mismatch")
    return issues


def _collect_webhook_issues(row: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    tenant_id = row.get("tenant_id")
    tenant_subscription_id = row.get("tenant_subscription_id")
    subscription_tenant_id = row.get("subscription_tenant_id")
    processing_status = str(row.get("processing_status") or "").strip().lower()
    error_message = str(row.get("error_message") or "").strip()

    if not str(row.get("provider_event_id") or "").strip():
        issues.append("webhook_missing_provider_event_id")
    if tenant_subscription_id is not None and subscription_tenant_id is None:
        issues.append("webhook_subscription_not_found")
    if tenant_id is None and tenant_subscription_id is not None:
        issues.append("webhook_missing_tenant")
    if (
        tenant_id is not None
        and subscription_tenant_id is not None
        and tenant_id != subscription_tenant_id
    ):
        issues.append("webhook_subscription_tenant_mismatch")
    if processing_status == "failed" and not error_message:
        issues.append("webhook_failed_without_error_message")
    return issues


def _collect_section_report(
    rows: list[dict[str, Any]],
    issue_collector: Any,
    *,
    section_name: str,
) -> dict[str, Any]:
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, Any]] = []
    problem_rows = 0

    for row in rows:
        issues = issue_collector(row)
        if not issues:
            continue
        problem_rows += 1
        issue_counts.update(issues)
        if len(samples) < 25:
            sample = dict(row)
            sample["issues"] = issues
            sample["section"] = section_name
            samples.append(sample)

    return {
        "total_rows": len(rows),
        "problem_rows": problem_rows,
        "issue_counts": dict(sorted(issue_counts.items())),
        "samples": samples,
    }


def build_report(db: Session) -> dict[str, Any]:
    subscription_report = _collect_section_report(
        _subscription_rows(db),
        _collect_subscription_issues,
        section_name="tenant_subscriptions",
    )
    invoice_report = _collect_section_report(
        _invoice_rows(db),
        _collect_invoice_issues,
        section_name="billing_invoices",
    )
    webhook_report = _collect_section_report(
        _webhook_rows(db),
        _collect_webhook_issues,
        section_name="billing_webhook_events",
    )

    total_issue_counts: Counter[str] = Counter()
    for section in (subscription_report, invoice_report, webhook_report):
        total_issue_counts.update(section.get("issue_counts", {}))

    return {
        "summary": {
            "section_count": 3,
            "issue_counts": dict(sorted(total_issue_counts.items())),
            "problem_rows": (
                subscription_report["problem_rows"]
                + invoice_report["problem_rows"]
                + webhook_report["problem_rows"]
            ),
        },
        "sections": {
            "tenant_subscriptions": subscription_report,
            "billing_invoices": invoice_report,
            "billing_webhook_events": webhook_report,
        },
    }


def _write_json(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_csv(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    for section_name, section in report.get("sections", {}).items():
        for sample in section.get("samples", []):
            row = {"section": section_name}
            for key, value in sample.items():
                row[key] = ",".join(value) if isinstance(value, list) else value
            rows.append(row)

    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)

    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=fieldnames or ["section"], extrasaction="ignore"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit billing reconciliation consistency"
    )
    parser.add_argument("--json-out", type=str, help="JSON rapor dosya yolu")
    parser.add_argument("--csv-out", type=str, help="CSV rapor dosya yolu")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        report = build_report(db)
    finally:
        db.close()

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if args.json_out:
        _write_json(report, Path(args.json_out))
        print(f"JSON rapor yazildi: {args.json_out}")
    if args.csv_out:
        _write_csv(report, Path(args.csv_out))
        print(f"CSV rapor yazildi: {args.csv_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
