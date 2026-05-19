from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.db.session import SessionLocal
from api.models.department import Department
from api.models.role import Role


TRANSLATION_TABLE = str.maketrans(
    {
        "c": "c",
        "g": "g",
        "i": "i",
        "o": "o",
        "s": "s",
        "u": "u",
        "C": "c",
        "G": "g",
        "I": "i",
        "O": "o",
        "S": "s",
        "U": "u",
        "\u00e7": "c",
        "\u011f": "g",
        "\u0131": "i",
        "\u00f6": "o",
        "\u015f": "s",
        "\u00fc": "u",
        "\u00c7": "c",
        "\u011e": "g",
        "\u0130": "i",
        "\u00d6": "o",
        "\u015e": "s",
        "\u00dc": "u",
    }
)


ROLE_CANONICAL_RULES = {
    "super admin": "Super Admin",
    "super_admin": "Super Admin",
    "superadmin": "Super Admin",
    "admin": "Satin Alma Admin",
    "satin alma admin": "Satin Alma Admin",
    "satin alama direktor": "Satin Alma Direktoru",
    "satin alama direktoru": "Satin Alma Direktoru",
    "satin alma direktor": "Satin Alma Direktoru",
    "satin alma direktoru": "Satin Alma Direktoru",
    "satinalma direktoru": "Satin Alma Direktoru",
    "satinalma_direktoru": "Satin Alma Direktoru",
    "satin alama muduru": "Satin Alma Muduru",
    "satin alma muduru": "Satin Alma Muduru",
    "satinalma muduru": "Satin Alma Muduru",
    "satin alma md yrd": "Satin Alma Mudur Yardimcisi",
    "satin alma mudur yardimcisi": "Satin Alma Mudur Yardimcisi",
    "satinalma yoneticisi": "Satin Alma Yoneticisi",
    "satinalma_yoneticisi": "Satin Alma Yoneticisi",
    "satin alama yoneticisi": "Satin Alma Yoneticisi",
    "satin alma yoneticisi": "Satin Alma Yoneticisi",
    "satin alama uzmani": "Satin Alma Uzmani",
    "satin alma uzmani": "Satin Alma Uzmani",
    "satinalma uzmani": "Satin Alma Uzmani",
    "satinalma_uzmani": "Satin Alma Uzmani",
    "satinalma uzman": "Satin Alma Uzmani",
    "satin alama uzm yrd": "Satin Alma Uzman Yardimcisi",
    "satin alma uzm yrd": "Satin Alma Uzman Yardimcisi",
    "satin alma uzman yardimcisi": "Satin Alma Uzman Yardimcisi",
    "satin alma kidemli uzman": "Satin Alma Kidemli Uzmani",
    "satin alma kidemli uzmani": "Satin Alma Kidemli Uzmani",
    "satinalmaci": "Satin Almaci",
    "satin almaci": "Satin Almaci",
    "satin alma personeli": "Satin Alma Personeli",
    "partner ana yonetici": "Partner Ana Yonetici",
    "partner yoneticisi": "Partner Yoneticisi",
    "satin alma muduru": "Satin Alma Muduru",
    "teknik uzman ve mimar": "Teknik Uzman ve Mimar",
    "denetci ve finansal izleyici": "Denetci ve Finansal Izleyici",
    "ozel partner rolu": "Ozel Partner Rolu",
}


DEPARTMENT_CANONICAL_RULES = {
    "hammadde satin alma": "Hammadde Satin Alma",
    "endirek satin alama": "Endirek Satin Alma",
    "endirek satin alma": "Endirek Satin Alma",
    "ticari satin alma": "Ticari Satin Alma",
    "teknik satin alma": "Teknik Satin Alma",
    "yonetim ve organizasyon": "Yonetim ve Organizasyon",
    "satin alma operasyonlari": "Satin Alma Operasyonlari",
    "teknik ofis ve sartname": "Teknik Ofis ve Sartname",
    "finans ve denetim": "Finans ve Denetim",
    "lavas": "Lavas",
    "gobek marul": "Gobek Marul",
}


def _normalize_name(value: object | None) -> str:
    text = str(value or "").translate(TRANSLATION_TABLE).strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _suggest_role_name(current_name: str) -> str | None:
    normalized = _normalize_name(current_name)
    return ROLE_CANONICAL_RULES.get(normalized)


def _suggest_department_name(current_name: str) -> str | None:
    normalized = _normalize_name(current_name)
    return DEPARTMENT_CANONICAL_RULES.get(normalized)


def _build_index(
    rows: list[dict[str, Any]],
) -> tuple[
    dict[tuple[int | None, str], list[int]], dict[tuple[int | None, str], list[int]]
]:
    by_exact: dict[tuple[int | None, str], list[int]] = defaultdict(list)
    by_normalized: dict[tuple[int | None, str], list[int]] = defaultdict(list)
    for row in rows:
        tenant_id = row.get("tenant_id")
        row_id = int(row["id"])
        current_name = str(row.get("name") or "")
        by_exact[(tenant_id, current_name)].append(row_id)
        by_normalized[(tenant_id, _normalize_name(current_name))].append(row_id)
    return by_exact, by_normalized


def _evaluate_rows(entity_type: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_exact, by_normalized = _build_index(rows)
    actions: list[dict[str, Any]] = []
    issue_counts: Counter[str] = Counter()

    for row in rows:
        row_id = int(row["id"])
        tenant_id = row.get("tenant_id")
        current_name = str(row.get("name") or "")
        is_active = bool(row.get("is_active", True))

        if not is_active:
            issue_counts.update(["inactive_skipped"])
            continue

        suggested_name = (
            _suggest_role_name(current_name)
            if entity_type == "role"
            else _suggest_department_name(current_name)
        )

        if not suggested_name:
            issue_counts.update(["no_rule"])
            continue

        if _normalize_name(current_name) == _normalize_name(suggested_name):
            issue_counts.update(["already_canonical"])
            continue

        exact_conflicts = [
            conflict_id
            for conflict_id in by_exact.get((tenant_id, suggested_name), [])
            if conflict_id != row_id
        ]
        if exact_conflicts:
            issue_counts.update(["merge_required_exact"])
            actions.append(
                {
                    "entity_type": entity_type,
                    "id": row_id,
                    "tenant_id": tenant_id,
                    "current_name": current_name,
                    "suggested_name": suggested_name,
                    "action": "merge_required",
                    "reason": "exact_target_exists",
                    "conflict_with_ids": exact_conflicts,
                }
            )
            continue

        normalized_conflicts = [
            conflict_id
            for conflict_id in by_normalized.get(
                (tenant_id, _normalize_name(suggested_name)), []
            )
            if conflict_id != row_id
        ]
        if normalized_conflicts:
            issue_counts.update(["merge_required_normalized"])
            actions.append(
                {
                    "entity_type": entity_type,
                    "id": row_id,
                    "tenant_id": tenant_id,
                    "current_name": current_name,
                    "suggested_name": suggested_name,
                    "action": "merge_required",
                    "reason": "normalized_target_exists",
                    "conflict_with_ids": normalized_conflicts,
                }
            )
            continue

        issue_counts.update(["safe_rename"])
        actions.append(
            {
                "entity_type": entity_type,
                "id": row_id,
                "tenant_id": tenant_id,
                "current_name": current_name,
                "suggested_name": suggested_name,
                "action": "safe_rename",
                "reason": "rule_match",
                "conflict_with_ids": [],
            }
        )

    return {
        "entity_type": entity_type,
        "total_rows": len(rows),
        "issue_counts": dict(sorted(issue_counts.items())),
        "actions": actions,
    }


def build_report() -> dict[str, Any]:
    with SessionLocal() as db:
        role_rows = [
            {
                "id": role.id,
                "tenant_id": role.tenant_id,
                "name": role.name,
                "is_active": bool(role.is_active),
            }
            for role in db.query(Role).order_by(Role.id.asc()).all()
        ]
        department_rows = [
            {
                "id": department.id,
                "tenant_id": department.tenant_id,
                "name": department.name,
                "is_active": bool(department.is_active),
            }
            for department in db.query(Department).order_by(Department.id.asc()).all()
        ]

    role_report = _evaluate_rows("role", role_rows)
    department_report = _evaluate_rows("department", department_rows)

    all_actions = role_report["actions"] + department_report["actions"]
    all_issue_counts: Counter[str] = Counter(role_report["issue_counts"])
    all_issue_counts.update(department_report["issue_counts"])

    summary = {
        "total_rows": role_report["total_rows"] + department_report["total_rows"],
        "role_rows": role_report["total_rows"],
        "department_rows": department_report["total_rows"],
        "safe_rename": sum(
            1 for item in all_actions if item["action"] == "safe_rename"
        ),
        "merge_required": sum(
            1 for item in all_actions if item["action"] == "merge_required"
        ),
        "issue_counts": dict(sorted(all_issue_counts.items())),
    }

    return {
        "summary": summary,
        "role": role_report,
        "department": department_report,
        "actions": all_actions,
    }


def apply_safe_renames(report: dict[str, Any]) -> dict[str, Any]:
    safe_renames = [
        item
        for item in report.get("actions", [])
        if item.get("action") == "safe_rename"
    ]
    if not safe_renames:
        return {"updated": 0, "updated_ids": []}

    updated_ids: list[int] = []
    with SessionLocal() as db:
        for item in safe_renames:
            entity_type = str(item["entity_type"])
            row_id = int(item["id"])
            suggested_name = str(item["suggested_name"])

            if entity_type == "role":
                row = db.query(Role).filter(Role.id == row_id).first()
            else:
                row = db.query(Department).filter(Department.id == row_id).first()

            if row is None:
                continue
            if _normalize_name(row.name) == _normalize_name(suggested_name):
                continue

            row.name = suggested_name
            updated_ids.append(row_id)

        db.commit()

    return {"updated": len(updated_ids), "updated_ids": updated_ids[:100]}


def _write_json(path: str, payload: dict[str, Any]) -> None:
    Path(path).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _write_csv(path: str, rows: list[dict[str, Any]]) -> None:
    fieldnames = [
        "entity_type",
        "id",
        "tenant_id",
        "current_name",
        "suggested_name",
        "action",
        "reason",
        "conflict_with_ids",
    ]
    with Path(path).open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            serialized = dict(row)
            serialized["conflict_with_ids"] = ",".join(
                str(item) for item in row.get("conflict_with_ids", [])
            )
            writer.writerow(serialized)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output-json")
    parser.add_argument("--output-csv")
    args = parser.parse_args()

    report = build_report()
    if args.apply:
        report["apply_result"] = apply_safe_renames(report)
        report = build_report() | {"apply_result": report["apply_result"]}

    if args.output_json:
        _write_json(args.output_json, report)
    if args.output_csv:
        _write_csv(args.output_csv, report.get("actions", []))

    print(json.dumps(report["summary"], ensure_ascii=False))
    if args.apply:
        updated = int(report.get("apply_result", {}).get("updated", 0))
        if updated > 0:
            print("ORG_CATALOG_NAME_NORMALIZATION_APPLIED")
        else:
            print("ORG_CATALOG_NAME_NORMALIZATION_NO_CHANGES")
    else:
        print("ORG_CATALOG_NAME_NORMALIZATION_PREVIEW_READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
