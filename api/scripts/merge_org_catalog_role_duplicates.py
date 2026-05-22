from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.db.session import SessionLocal
from api.models.role import Role


def _pick_merge_target_role_id(db, conflict_ids: list[int]) -> int | None:
    if not conflict_ids:
        return None

    candidates: list[tuple[bool, int, int]] = []
    for role_id in conflict_ids:
        role = db.query(Role).filter(Role.id == int(role_id)).first()
        if role is None:
            continue
        permission_count = _count_rows(
            db,
            "SELECT COUNT(*) FROM role_permissions WHERE role_id = :role_id",
            {"role_id": int(role_id)},
        )
        candidates.append((bool(role.is_active), int(permission_count), int(role.id)))

    if not candidates:
        return None

    # Prefer active targets, then richer permission set, then oldest stable id.
    candidates.sort(key=lambda item: (item[0], item[1], -item[2]), reverse=True)
    return int(candidates[0][2])


def _load_merge_pairs(report_path: Path) -> list[dict[str, int | None]]:
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    actions = payload.get("actions", [])
    pairs: list[dict[str, int | None]] = []

    with SessionLocal() as db:
        for action in actions:
            if action.get("entity_type") != "role":
                continue
            if action.get("action") != "merge_required":
                continue
            conflicts = [int(cid) for cid in (action.get("conflict_with_ids") or [])]
            if not conflicts:
                continue

            target_role_id = _pick_merge_target_role_id(db, conflicts)
            if target_role_id is None:
                continue

            pairs.append(
                {
                    "source_role_id": int(action["id"]),
                    "target_role_id": int(target_role_id),
                    "tenant_id": action.get("tenant_id"),
                }
            )

    return pairs


def _table_exists(db, table_name: str) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": table_name},
    ).first()
    if row:
        return True

    row_sqlite = db.execute(
        text(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = :table_name
            LIMIT 1
            """
        ),
        {"table_name": table_name},
    ).first()
    return bool(row_sqlite)


def _count_rows(db, sql: str, params: dict[str, Any]) -> int:
    return int(db.execute(text(sql), params).scalar() or 0)


def build_preview(report_path: Path) -> dict[str, Any]:
    pairs = _load_merge_pairs(report_path)
    with SessionLocal() as db:
        has_user_company_roles = _table_exists(db, "user_company_roles")
        items: list[dict[str, Any]] = []

        for pair in pairs:
            source_id = int(pair["source_role_id"])
            target_id = int(pair["target_role_id"])

            source = db.query(Role).filter(Role.id == source_id).first()
            target = db.query(Role).filter(Role.id == target_id).first()

            if source is None or target is None:
                items.append(
                    {
                        **pair,
                        "status": "invalid_pair",
                        "company_roles": 0,
                        "children": 0,
                        "role_permissions": 0,
                        "user_company_roles": 0,
                    }
                )
                continue

            company_roles_count = _count_rows(
                db,
                "SELECT COUNT(*) FROM company_roles WHERE role_id = :source_id",
                {"source_id": source_id},
            )
            children_count = _count_rows(
                db,
                "SELECT COUNT(*) FROM roles WHERE parent_id = :source_id",
                {"source_id": source_id},
            )
            role_permissions_count = _count_rows(
                db,
                "SELECT COUNT(*) FROM role_permissions WHERE role_id = :source_id",
                {"source_id": source_id},
            )
            user_company_roles_count = (
                _count_rows(
                    db,
                    "SELECT COUNT(*) FROM user_company_roles WHERE role_id = :source_id",
                    {"source_id": source_id},
                )
                if has_user_company_roles
                else 0
            )

            items.append(
                {
                    **pair,
                    "source_name": source.name,
                    "target_name": target.name,
                    "status": "ready",
                    "company_roles": company_roles_count,
                    "children": children_count,
                    "role_permissions": role_permissions_count,
                    "user_company_roles": user_company_roles_count,
                }
            )

    return {
        "summary": {
            "pairs": len(items),
            "ready_pairs": sum(1 for item in items if item["status"] == "ready"),
            "invalid_pairs": sum(
                1 for item in items if item["status"] == "invalid_pair"
            ),
            "total_company_roles": sum(int(item["company_roles"]) for item in items),
            "total_children": sum(int(item["children"]) for item in items),
            "total_role_permissions": sum(
                int(item["role_permissions"]) for item in items
            ),
            "total_user_company_roles": sum(
                int(item["user_company_roles"]) for item in items
            ),
        },
        "pairs": items,
    }


def apply_merges(report_path: Path) -> dict[str, Any]:
    preview = build_preview(report_path)
    rows = [item for item in preview.get("pairs", []) if item.get("status") == "ready"]
    if not rows:
        return {"updated_pairs": 0, "deactivated_source_ids": []}

    note = f"[MERGED {datetime.now(timezone.utc).isoformat()}]"
    deactivated_ids: list[int] = []

    with SessionLocal() as db:
        has_user_company_roles = _table_exists(db, "user_company_roles")

        for row in rows:
            source_id = int(row["source_role_id"])
            target_id = int(row["target_role_id"])

            db.execute(
                text(
                    """
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT :target_id, rp.permission_id
                    FROM role_permissions rp
                    WHERE rp.role_id = :source_id
                      AND NOT EXISTS (
                        SELECT 1
                        FROM role_permissions rp2
                        WHERE rp2.role_id = :target_id
                          AND rp2.permission_id = rp.permission_id
                      )
                    """
                ),
                {"source_id": source_id, "target_id": target_id},
            )
            db.execute(
                text("DELETE FROM role_permissions WHERE role_id = :source_id"),
                {"source_id": source_id},
            )

            db.execute(
                text(
                    "UPDATE company_roles SET role_id = :target_id WHERE role_id = :source_id"
                ),
                {"source_id": source_id, "target_id": target_id},
            )

            if has_user_company_roles:
                db.execute(
                    text(
                        """
                        INSERT INTO user_company_roles (user_id, company_id, role_id)
                        SELECT ucr.user_id, ucr.company_id, :target_id
                        FROM user_company_roles ucr
                        WHERE ucr.role_id = :source_id
                          AND NOT EXISTS (
                            SELECT 1
                            FROM user_company_roles ucr2
                            WHERE ucr2.user_id = ucr.user_id
                              AND ucr2.company_id = ucr.company_id
                              AND ucr2.role_id = :target_id
                          )
                        """
                    ),
                    {"source_id": source_id, "target_id": target_id},
                )
                db.execute(
                    text("DELETE FROM user_company_roles WHERE role_id = :source_id"),
                    {"source_id": source_id},
                )

            db.execute(
                text(
                    "UPDATE roles SET parent_id = :target_id WHERE parent_id = :source_id"
                ),
                {"source_id": source_id, "target_id": target_id},
            )

            source = db.query(Role).filter(Role.id == source_id).first()
            if source is not None:
                source.is_active = False
                base_description = str(source.description or "").strip()
                source.description = (
                    f"{base_description} {note} merged_into_role_id={target_id}".strip()
                )
                deactivated_ids.append(source_id)

        db.commit()

    return {"updated_pairs": len(rows), "deactivated_source_ids": deactivated_ids}


def _write_json(path: str, payload: dict[str, Any]) -> None:
    Path(path).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _write_csv(path: str, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "source_role_id",
        "target_role_id",
        "tenant_id",
        "source_name",
        "target_name",
        "status",
        "company_roles",
        "children",
        "role_permissions",
        "user_company_roles",
    ]
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--report-json",
        default="org-catalog-name-normalization-applied-2026-04-22.json",
    )
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output-json")
    parser.add_argument("--output-csv")
    args = parser.parse_args()

    report_path = Path(args.report_json)
    preview = build_preview(report_path)

    if args.apply:
        apply_result = apply_merges(report_path)
        payload = build_preview(report_path) | {"apply_result": apply_result}
    else:
        payload = preview

    if args.output_json:
        _write_json(args.output_json, payload)
    if args.output_csv:
        _write_csv(args.output_csv, payload.get("pairs", []))

    print(json.dumps(payload["summary"], ensure_ascii=False))
    if args.apply:
        print("ORG_CATALOG_ROLE_DUPLICATE_MERGE_APPLIED")
    else:
        print("ORG_CATALOG_ROLE_DUPLICATE_MERGE_PREVIEW_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
