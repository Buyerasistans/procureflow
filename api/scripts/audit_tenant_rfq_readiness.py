from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.db.session import SessionLocal


def _load_rows(db: Session, sql: str) -> list[dict[str, Any]]:
    result = db.execute(text(sql))
    return [dict(row) for row in result.mappings().all()]


def main() -> int:
    db = SessionLocal()
    try:
        quotes = _load_rows(
            db,
            """
            SELECT q.id, q.tenant_id, q.project_id, p.tenant_id AS project_tenant_id
            FROM quotes q
            LEFT JOIN projects p ON p.id = q.project_id
            ORDER BY q.id ASC
            """,
        )
        approvals = _load_rows(
            db,
            """
            SELECT qa.id, qa.tenant_id, qa.quote_id, q.tenant_id AS quote_tenant_id
            FROM quote_approvals qa
            LEFT JOIN quotes q ON q.id = qa.quote_id
            ORDER BY qa.id ASC
            """,
        )
        supplier_quotes = _load_rows(
            db,
            """
            SELECT sq.id, sq.quote_id, q.tenant_id AS quote_tenant_id,
                   sq.supplier_id, s.tenant_id AS supplier_tenant_id
            FROM supplier_quotes sq
            LEFT JOIN quotes q ON q.id = sq.quote_id
            LEFT JOIN suppliers s ON s.id = sq.supplier_id
            ORDER BY sq.id ASC
            """,
        )

        summary = {
            "quotes_missing_tenant": sum(
                1 for row in quotes if row.get("tenant_id") is None
            ),
            "quotes_project_tenant_mismatch": sum(
                1
                for row in quotes
                if row.get("tenant_id") is not None
                and row.get("project_tenant_id") is not None
                and row.get("tenant_id") != row.get("project_tenant_id")
            ),
            "approvals_missing_tenant": sum(
                1 for row in approvals if row.get("tenant_id") is None
            ),
            "approvals_quote_tenant_mismatch": sum(
                1
                for row in approvals
                if row.get("tenant_id") is not None
                and row.get("quote_tenant_id") is not None
                and row.get("tenant_id") != row.get("quote_tenant_id")
            ),
            "supplier_quotes_quote_supplier_mismatch": sum(
                1
                for row in supplier_quotes
                if row.get("quote_tenant_id") is not None
                and row.get("supplier_tenant_id") is not None
                and row.get("quote_tenant_id") != row.get("supplier_tenant_id")
            ),
            "supplier_quotes_platform_network_count": sum(
                1 for row in supplier_quotes if row.get("supplier_tenant_id") is None
            ),
        }
        summary["rfq_transition_ready"] = all(
            value == 0
            for key, value in summary.items()
            if key != "supplier_quotes_platform_network_count"
        )
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
