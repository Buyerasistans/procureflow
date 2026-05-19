from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from api.database import engine
from api.db.session import SessionLocal
from api.models import QuoteApproval, User

PLATFORM_SYSTEM_ROLES = {"super_admin", "platform_support", "platform_operator"}
TENANT_SYSTEM_ROLES = {"tenant_owner", "tenant_admin", "tenant_member"}
AUTO_FIXABLE_ISSUES = {
    "missing_system_role",
    "super_admin_role_mismatch",
    "admin_role_mismatch",
    "unexpected_non_admin_mapping",
}


def _normalized(value: object | None) -> str:
    return str(value or "").strip().lower()


def _quote_approval_columns() -> set[str]:
    inspector = inspect(engine)
    return {column["name"] for column in inspector.get_columns("quote_approvals")}


def _expected_system_role_from_role(role: str) -> str:
    if role == "super_admin":
        return "super_admin"
    if role == "admin":
        return "tenant_admin"
    return "tenant_member"


def _collect_issues(user: User) -> list[str]:
    issues: list[str] = []
    role = _normalized(user.role)
    system_role = _normalized(user.system_role)
    expected_system_role = _expected_system_role_from_role(role)

    if not system_role:
        issues.append("missing_system_role")
        return issues

    if role == "super_admin" and system_role != "super_admin":
        issues.append("super_admin_role_mismatch")
    elif role == "admin" and system_role not in {"tenant_admin", "tenant_owner"}:
        issues.append("admin_role_mismatch")
    elif role not in {"admin", "super_admin"} and system_role in {
        "tenant_admin",
        "tenant_owner",
    }:
        issues.append("tenant_admin_without_legacy_admin_role")

    if system_role == "super_admin" and role != "super_admin":
        issues.append("system_super_admin_without_legacy_super_admin_role")

    if system_role in PLATFORM_SYSTEM_ROLES and user.tenant_id is not None:
        issues.append("platform_role_has_tenant_id")

    if (
        system_role in {"tenant_admin", "tenant_owner", "tenant_member"}
        and user.tenant_id is None
    ):
        issues.append("tenant_role_missing_tenant_id")

    if system_role == "supplier_user":
        issues.append("internal_user_marked_as_supplier_user")

    if (
        role not in {"admin", "super_admin"}
        and system_role != expected_system_role
        and system_role not in PLATFORM_SYSTEM_ROLES
    ):
        issues.append("unexpected_non_admin_mapping")

    return issues


def _suggested_system_role(user: User) -> str:
    return _expected_system_role_from_role(_normalized(user.role))


def _apply_fix(user: User) -> list[str]:
    fixes: list[str] = []
    issues = _collect_issues(user)
    fixable = [issue for issue in issues if issue in AUTO_FIXABLE_ISSUES]
    if not fixable:
        return fixes

    suggested = _suggested_system_role(user)
    if _normalized(user.system_role) != suggested:
        user.system_role = suggested
        fixes.append(f"set_system_role:{suggested}")

    return fixes


def _summarize_fix_preview(rows: list[dict[str, object]]) -> dict[str, object]:
    by_target_role: Counter[str] = Counter()
    by_fix_type: Counter[str] = Counter()

    for row in rows:
        new_system_role = str(row.get("new_system_role") or "")
        if new_system_role:
            by_target_role.update([new_system_role])
        fixes = row.get("fixes")
        if isinstance(fixes, list):
            by_fix_type.update(str(item) for item in fixes)

    return {
        "target_system_role_counts": dict(sorted(by_target_role.items())),
        "fix_type_counts": dict(sorted(by_fix_type.items())),
        "preview_rows": len(rows),
    }


def _load_quote_approval_rows(db: Session) -> list[dict[str, object]]:
    columns = _quote_approval_columns()
    required_role_select = (
        "required_role" if "required_role" in columns else "NULL AS required_role"
    )
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


def _collect_quote_approval_transition_report(db: Session) -> dict[str, object]:
    approvals = _load_quote_approval_rows(db)
    required_role_column_exists = "required_role" in _quote_approval_columns()
    issue_counts: Counter[str] = Counter()
    samples: list[dict[str, object]] = []

    for approval in approvals:
        issues: list[str] = []
        required_role = _normalized(approval.get("required_role"))
        required_business_role = _normalized(approval.get("required_business_role"))

        if not required_business_role:
            issues.append("missing_required_business_role")
        if (
            required_role_column_exists
            and required_business_role
            and required_role
            and required_business_role != required_role
        ):
            issues.append("required_role_mirror_mismatch")
        if not required_business_role and (
            not required_role_column_exists or not required_role
        ):
            issues.append("approval_role_missing_both_fields")

        if not issues:
            continue

        issue_counts.update(issues)
        if len(samples) < 25:
            samples.append(
                {
                    "id": approval.get("id"),
                    "quote_id": approval.get("quote_id"),
                    "approval_level": approval.get("approval_level"),
                    "tenant_id": None,
                    "required_role": required_role,
                    "required_business_role": required_business_role,
                    "status": _normalized(approval.get("status")),
                    "issues": issues,
                }
            )

    return {
        "total_quote_approvals": len(approvals),
        "quote_approvals_with_issues": sum(issue_counts.values())
        if issue_counts
        else 0,
        "issue_counts": dict(sorted(issue_counts.items())),
        "required_role_column_exists": required_role_column_exists,
        "samples": samples,
        "repair_preview": _build_quote_approval_repair_preview(approvals),
    }


def _build_quote_approval_repair_preview(
    approvals: list[dict[str, object]],
) -> dict[str, object]:
    required_role_column_exists = "required_role" in _quote_approval_columns()
    fix_type_counts: Counter[str] = Counter()
    preview_rows: list[dict[str, object]] = []

    for approval in approvals:
        required_role = _normalized(approval.get("required_role"))
        required_business_role = _normalized(approval.get("required_business_role"))
        fixes: list[str] = []
        next_required_role = required_role
        next_required_business_role = required_business_role

        if required_role_column_exists and required_role and not required_business_role:
            next_required_business_role = required_role
            fixes.append("copy_required_role_to_required_business_role")

        if (
            required_role_column_exists
            and required_business_role
            and required_role
            and required_business_role != required_role
        ):
            next_required_role = required_business_role
            fixes.append("sync_required_role_to_required_business_role")

        if required_role_column_exists and required_business_role and not required_role:
            next_required_role = required_business_role
            fixes.append("backfill_required_role_from_required_business_role")

        if not fixes:
            continue

        fix_type_counts.update(fixes)
        preview_rows.append(
            {
                "id": approval.get("id"),
                "quote_id": approval.get("quote_id"),
                "approval_level": approval.get("approval_level"),
                "tenant_id": None,
                "old_required_role": required_role,
                "old_required_business_role": required_business_role,
                "new_required_role": next_required_role,
                "new_required_business_role": next_required_business_role,
                "fixes": fixes,
            }
        )

    return {
        "preview_rows": len(preview_rows),
        "fix_type_counts": dict(sorted(fix_type_counts.items())),
        "samples": preview_rows[:25],
    }


def build_report(db: Session) -> dict[str, object]:
    users = db.query(User).order_by(User.id.asc()).all()
    issue_counts: Counter[str] = Counter()
    mismatches: list[dict[str, object]] = []

    for user in users:
        issues = _collect_issues(user)
        if not issues:
            continue

        issue_counts.update(issues)
        mismatches.append(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": _normalized(user.role),
                "system_role": _normalized(user.system_role),
                "tenant_id": user.tenant_id,
                "created_by_id": user.created_by_id,
                "is_active": bool(user.is_active),
                "issues": issues,
            }
        )

    return {
        "total_users": len(users),
        "users_with_issues": len(mismatches),
        "issue_counts": dict(sorted(issue_counts.items())),
        "mismatches": mismatches,
        "quote_approval_transition": _collect_quote_approval_transition_report(db),
    }


def apply_fixes(db: Session, commit: bool) -> dict[str, object]:
    users = db.query(User).order_by(User.id.asc()).all()
    updated: list[dict[str, object]] = []

    for user in users:
        old_system_role = _normalized(user.system_role)
        fixes = _apply_fix(user)
        if not fixes:
            continue
        updated.append(
            {
                "id": user.id,
                "email": user.email,
                "role": _normalized(user.role),
                "old_system_role": old_system_role,
                "new_system_role": _normalized(user.system_role),
                "fixes": fixes,
            }
        )

    if commit:
        db.commit()
    else:
        db.rollback()

    return {
        "updated_count": len(updated),
        "updated_users": updated,
        "committed": commit,
        "summary": _summarize_fix_preview(updated),
    }


def apply_quote_approval_fixes(db: Session, commit: bool) -> dict[str, object]:
    approvals = _load_quote_approval_rows(db)
    required_role_column_exists = "required_role" in _quote_approval_columns()
    updated: list[dict[str, object]] = []

    for approval in approvals:
        approval_id = int(approval["id"])
        old_required_role = _normalized(approval.get("required_role"))
        old_required_business_role = _normalized(approval.get("required_business_role"))
        fixes: list[str] = []
        new_required_role = old_required_role
        new_required_business_role = old_required_business_role

        if (
            required_role_column_exists
            and old_required_role
            and not old_required_business_role
        ):
            new_required_business_role = old_required_role
            fixes.append("copy_required_role_to_required_business_role")

        if (
            required_role_column_exists
            and new_required_business_role
            and new_required_role != new_required_business_role
        ):
            new_required_role = new_required_business_role
            fixes.append("sync_required_role_to_required_business_role")

        if not fixes:
            continue

        if required_role_column_exists:
            db.execute(
                text(
                    """
                    UPDATE quote_approvals
                    SET required_role = :required_role,
                        required_business_role = :required_business_role
                    WHERE id = :approval_id
                    """
                ),
                {
                    "approval_id": approval_id,
                    "required_role": new_required_role or None,
                    "required_business_role": new_required_business_role or None,
                },
            )
        else:
            db.execute(
                text(
                    """
                    UPDATE quote_approvals
                    SET required_business_role = :required_business_role
                    WHERE id = :approval_id
                    """
                ),
                {
                    "approval_id": approval_id,
                    "required_business_role": new_required_business_role or None,
                },
            )

        updated.append(
            {
                "id": approval_id,
                "quote_id": approval.get("quote_id"),
                "approval_level": approval.get("approval_level"),
                "tenant_id": None,
                "old_required_role": old_required_role,
                "old_required_business_role": old_required_business_role,
                "new_required_role": new_required_role,
                "new_required_business_role": new_required_business_role,
                "fixes": fixes,
            }
        )

    if commit:
        db.commit()
    else:
        db.rollback()

    fix_type_counts: Counter[str] = Counter()
    for row in updated:
        fix_type_counts.update(row["fixes"])

    return {
        "updated_count": len(updated),
        "updated_approvals": updated,
        "committed": commit,
        "summary": {
            "preview_rows": len(updated),
            "fix_type_counts": dict(sorted(fix_type_counts.items())),
        },
    }


def _print_human(report: dict[str, object]) -> None:
    summary = report.get("summary")
    if isinstance(summary, dict):
        print("Role/System Role Fix Önizlemesi")
        print(f"- Etkilenen kayıt: {summary.get('preview_rows', 0)}")
        target_counts = summary.get("target_system_role_counts")
        if isinstance(target_counts, dict) and target_counts:
            print("- Hedef system_role dağılımı:")
            for role, count in target_counts.items():
                print(f"  - {role}: {count}")
        fix_type_counts = summary.get("fix_type_counts")
        if isinstance(fix_type_counts, dict) and fix_type_counts:
            print("- Uygulanacak düzeltmeler:")
            for fix_type, count in fix_type_counts.items():
                print(f"  - {fix_type}: {count}")

    print("Role/System Role Tutarlılık Raporu")
    if "total_users" in report:
        print(f"- Toplam kullanıcı: {report['total_users']}")
    if "users_with_issues" in report:
        print(f"- Sorunlu kullanıcı: {report['users_with_issues']}")

    issue_counts = report.get("issue_counts")
    if isinstance(issue_counts, dict) and issue_counts:
        print("- Sorun dağılımı:")
        for issue, count in issue_counts.items():
            print(f"  - {issue}: {count}")

    quote_approval_transition = report.get("quote_approval_transition")
    if isinstance(quote_approval_transition, dict):
        print("Quote Approval Geçiş Raporu")
        print(
            f"- Toplam approval kaydı: {quote_approval_transition.get('total_quote_approvals', 0)}"
        )
        print(
            f"- Sorunlu approval kaydı: {quote_approval_transition.get('quote_approvals_with_issues', 0)}"
        )
        approval_issue_counts = quote_approval_transition.get("issue_counts")
        if isinstance(approval_issue_counts, dict) and approval_issue_counts:
            print("- Approval sorun dağılımı:")
            for issue, count in approval_issue_counts.items():
                print(f"  - {issue}: {count}")
        approval_samples = quote_approval_transition.get("samples")
        if isinstance(approval_samples, list) and approval_samples:
            print("- İlk 25 approval örneği:")
            for row in approval_samples[:25]:
                print(
                    "  - "
                    f"id={row['id']} quote_id={row['quote_id']} level={row['approval_level']} "
                    f"required_role={row['required_role']} required_business_role={row['required_business_role']} "
                    f"issues={','.join(row.get('issues') or [])}"
                )
        repair_preview = quote_approval_transition.get("repair_preview")
        if isinstance(repair_preview, dict):
            print("Quote Approval Repair Preview")
            print(
                f"- Etkilenecek approval kaydı: {repair_preview.get('preview_rows', 0)}"
            )
            repair_fix_type_counts = repair_preview.get("fix_type_counts")
            if isinstance(repair_fix_type_counts, dict) and repair_fix_type_counts:
                print("- Olası approval düzeltmeleri:")
                for fix_type, count in repair_fix_type_counts.items():
                    print(f"  - {fix_type}: {count}")
            repair_samples = repair_preview.get("samples")
            if isinstance(repair_samples, list) and repair_samples:
                print("- İlk 25 repair preview örneği:")
                for row in repair_samples[:25]:
                    print(
                        "  - "
                        f"id={row['id']} quote_id={row['quote_id']} level={row['approval_level']} "
                        f"old_required_role={row['old_required_role']} "
                        f"old_required_business_role={row['old_required_business_role']} "
                        f"fixes={','.join(row.get('fixes') or [])}"
                    )

    mismatches = report.get("mismatches") or report.get("updated_users")
    if isinstance(mismatches, list) and mismatches:
        print("- İlk 25 sorunlu kayıt:")
        for row in mismatches[:25]:
            print(
                "  - "
                f"id={row['id']} email={row['email']} role={row['role']} "
                f"system_role={row.get('system_role') or row.get('old_system_role')} "
                f"tenant_id={row.get('tenant_id')} "
                f"issues={','.join(row.get('issues') or row.get('fixes') or [])}"
            )


def _write_json_report(report: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_csv_report(report: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = (
        report.get("mismatches")
        or report.get("updated_users")
        or report.get("updated_approvals")
        or []
    )
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "email",
                "full_name",
                "role",
                "system_role",
                "old_system_role",
                "new_system_role",
                "quote_id",
                "approval_level",
                "old_required_role",
                "old_required_business_role",
                "new_required_role",
                "new_required_business_role",
                "tenant_id",
                "created_by_id",
                "is_active",
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
        description="Legacy role ile system_role tutarlılığını denetler"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Raporu JSON olarak yazdır",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Güvenli auto-fix adaylarını uygular",
    )
    parser.add_argument(
        "--fix-approvals",
        action="store_true",
        help="Quote approval required_role / required_business_role alanlarını hizalar",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="--fix veya --fix-approvals ile birlikte kullanılır; değişiklikleri veritabanına kaydeder",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        help="Raporu belirtilen JSON dosyasına yazar",
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        help="Raporu belirtilen CSV dosyasına yazar",
    )
    args = parser.parse_args()

    if args.apply and not (args.fix or args.fix_approvals):
        parser.error(
            "--apply yalnızca --fix veya --fix-approvals ile birlikte kullanılabilir"
        )

    if args.fix and args.fix_approvals:
        parser.error("--fix ve --fix-approvals aynı anda kullanılamaz")

    db = SessionLocal()
    try:
        if args.fix:
            report = apply_fixes(db, commit=args.apply)
        elif args.fix_approvals:
            report = apply_quote_approval_fixes(db, commit=args.apply)
        else:
            report = build_report(db)
    finally:
        db.close()

    if args.output_json:
        _write_json_report(report, Path(args.output_json))

    if args.output_csv:
        _write_csv_report(report, Path(args.output_csv))

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif not args.output_json and not args.output_csv:
        _print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
