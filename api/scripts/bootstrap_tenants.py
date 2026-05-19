"""
Mevcut admin kullanicilarindan tenant omurgasi olusturur.

Calistirma:
  python -m api.scripts.bootstrap_tenants --dry-run
  python -m api.scripts.bootstrap_tenants --apply

Script davranisi:
- tenant_owner, tenant_admin veya legacy role='admin' olan aktif kullanicilar icin tenant kaydi olusturur
- admin kullanicisinin tenant_id alanini gunceller
- created_by_id zinciriyle bagli user, company, department, role, project, supplier,
  quote, approval, company_role, email_settings ve system_email kayitlarina tenant_id yazar
- mumkun olan yerlerde adminin bagli oldugu ilk firmayi tenant branding kaynagi olarak kullanir
- istenirse tek tenantli legacy ortamlarda kalan tenant_id bosluklarini kontrollu sekilde doldurur
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import unicodedata
from collections.abc import Iterable
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from api.db.session import SessionLocal
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.models.department import Department
from api.models.email_settings import EmailSettings
from api.models.project import Project
from api.models.quote import Quote
from api.models.quote_approval import QuoteApproval
from api.models.role import Role
from api.models.supplier import Supplier
from api.models.system_email import SystemEmail
from api.models.tenant import Tenant, TenantSettings
from api.models.user import User

BACKFILL_TABLES = [
    "companies",
    "departments",
    "projects",
    "roles",
    "suppliers",
    "quotes",
    "quote_approvals",
    "company_roles",
    "email_settings",
    "system_emails",
]
TENANT_USER_SYSTEM_ROLES = ["tenant_owner", "tenant_admin", "tenant_member"]
PLATFORM_SYSTEM_ROLES = {"super_admin", "platform_support", "platform_operator"}
TENANT_FOUNDATION_STATEMENTS = [
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_status VARCHAR(50) DEFAULT 'new' NOT NULL",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_owner_name VARCHAR(255)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_notes TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_resolution_reason TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_last_contacted_at TIMESTAMP",
]


def _normalized(value: object | None) -> str:
    return str(value or "").strip().lower()


def _ensure_tenant_foundation_columns(db: Session) -> None:
    for statement in TENANT_FOUNDATION_STATEMENTS:
        db.execute(text(statement))
    db.flush()


def _resolve_target_system_role(user: User, owner_user_id: int) -> str | None:
    current_system_role = _normalized(user.system_role)
    current_role = _normalized(user.role)

    if (
        current_system_role in PLATFORM_SYSTEM_ROLES
        or current_system_role == "supplier_user"
    ):
        return None
    if user.id == owner_user_id:
        return "tenant_owner"
    if current_role == "admin" or current_system_role in {
        "tenant_owner",
        "tenant_admin",
    }:
        return "tenant_admin"
    return "tenant_member"


def _normalize_tenant_users(
    users: Iterable[User], owner_user_id: int, tenant_id: int
) -> int:
    count = 0
    for user in users:
        target_system_role = _resolve_target_system_role(user, owner_user_id)
        changed = False

        if (
            getattr(user, "tenant_id", None) != tenant_id
            and target_system_role is not None
        ):
            user.tenant_id = tenant_id
            changed = True
        if (
            target_system_role is not None
            and getattr(user, "system_role", None) != target_system_role
        ):
            user.system_role = target_system_role
            changed = True

        if changed:
            count += 1
    return count


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    ascii_value = ascii_value.lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return ascii_value or "tenant"


def _iter_admin_scoped_users(db: Session) -> Iterable[User]:
    return (
        db.query(User)
        .filter(
            or_(
                User.system_role.in_(["tenant_owner", "tenant_admin"]),
                User.role == "admin",
            ),
            User.is_active.is_(True),
            User.hidden_from_admin.is_(False),
        )
        .order_by(User.id.asc())
        .all()
    )


def _pick_primary_company(db: Session, admin_user: User) -> Company | None:
    company = (
        db.query(Company)
        .filter(Company.created_by_id == admin_user.id, Company.is_active.is_(True))
        .order_by(Company.id.asc())
        .first()
    )
    if company:
        return company

    assignment = (
        db.query(CompanyRole)
        .filter(CompanyRole.user_id == admin_user.id, CompanyRole.is_active.is_(True))
        .order_by(CompanyRole.id.asc())
        .first()
    )
    if assignment:
        return db.query(Company).filter(Company.id == assignment.company_id).first()
    return None


def _ensure_unique_slug(
    db: Session, base_slug: str, current_tenant_id: int | None = None
) -> str:
    slug = base_slug
    counter = 2
    while True:
        existing = db.query(Tenant).filter(Tenant.slug == slug).first()
        if not existing or existing.id == current_tenant_id:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def _upsert_tenant_for_admin(db: Session, admin_user: User) -> Tenant:
    primary_company = _pick_primary_company(db, admin_user)
    legal_name = (
        primary_company.trade_name or primary_company.name
        if primary_company
        else f"{admin_user.full_name} Organizasyonu"
    )
    brand_name = primary_company.name if primary_company else admin_user.full_name
    slug_seed = (
        primary_company.name if primary_company else admin_user.email.split("@")[0]
    )
    logo_url = primary_company.logo_url if primary_company else None
    tax_number = primary_company.tax_number if primary_company else None
    tax_office = primary_company.tax_office if primary_company else None
    city = primary_company.city if primary_company else None
    address = primary_company.address if primary_company else None

    tenant = db.query(Tenant).filter(Tenant.owner_user_id == admin_user.id).first()
    if tenant is None and admin_user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == admin_user.tenant_id).first()

    base_slug = _slugify(slug_seed)

    if tenant is None:
        tenant = Tenant(
            slug=_ensure_unique_slug(db, base_slug),
            legal_name=legal_name,
            brand_name=brand_name,
            logo_url=logo_url,
            tax_number=tax_number,
            tax_office=tax_office,
            city=city,
            address=address,
            owner_user_id=admin_user.id,
            subscription_plan_code="starter",
            status="active",
            onboarding_status="bootstrap_completed",
            is_active=True,
        )
        db.add(tenant)
        db.flush()
    else:
        tenant.slug = _ensure_unique_slug(db, base_slug, tenant.id)
        tenant.legal_name = legal_name
        tenant.brand_name = brand_name
        tenant.logo_url = logo_url
        tenant.tax_number = tax_number
        tenant.tax_office = tax_office
        tenant.city = city
        tenant.address = address
        tenant.owner_user_id = admin_user.id
        tenant.status = "active"
        tenant.onboarding_status = "bootstrap_completed"
        tenant.is_active = True

    if tenant.settings is None:
        tenant.settings = TenantSettings(
            tenant_id=tenant.id,
            smtp_mode="tenant_owned",
            support_email=admin_user.email,
            locale="tr-TR",
            timezone="Europe/Istanbul",
            is_active=True,
        )

    return tenant


def _assign_tenant_id(
    rows: Iterable[object], tenant_id: int, field_name: str = "tenant_id"
) -> int:
    count = 0
    for row in rows:
        if getattr(row, field_name, None) != tenant_id:
            setattr(row, field_name, tenant_id)
            count += 1
    return count


def _apply_tenant_scope(
    db: Session, admin_user: User, tenant: Tenant
) -> dict[str, int]:
    tenant_id = tenant.id
    stats: dict[str, int] = {}

    tenant_scoped_users = (
        db.query(User)
        .filter((User.id == admin_user.id) | (User.created_by_id == admin_user.id))
        .all()
    )
    stats["users"] = _normalize_tenant_users(
        tenant_scoped_users, admin_user.id, tenant_id
    )
    stats["companies"] = _assign_tenant_id(
        db.query(Company).filter(Company.created_by_id == admin_user.id).all(),
        tenant_id,
    )
    stats["departments"] = _assign_tenant_id(
        db.query(Department).filter(Department.created_by_id == admin_user.id).all(),
        tenant_id,
    )
    stats["roles"] = _assign_tenant_id(
        db.query(Role).filter(Role.created_by_id == admin_user.id).all(), tenant_id
    )
    stats["projects"] = _assign_tenant_id(
        db.query(Project).filter(Project.created_by_id == admin_user.id).all(),
        tenant_id,
    )
    stats["suppliers"] = _assign_tenant_id(
        db.query(Supplier).filter(Supplier.created_by_id == admin_user.id).all(),
        tenant_id,
    )
    stats["quotes"] = _assign_tenant_id(
        db.query(Quote).filter(Quote.created_by_id == admin_user.id).all(), tenant_id
    )
    stats["approvals"] = _assign_tenant_id(
        db.query(QuoteApproval)
        .join(Quote, QuoteApproval.quote_id == Quote.id)
        .filter(Quote.created_by_id == admin_user.id)
        .all(),
        tenant_id,
    )
    stats["company_roles"] = _assign_tenant_id(
        db.query(CompanyRole)
        .join(User, CompanyRole.user_id == User.id)
        .filter(
            (CompanyRole.user_id == admin_user.id)
            | (User.created_by_id == admin_user.id)
        )
        .all(),
        tenant_id,
    )
    stats["email_settings"] = _assign_tenant_id(
        db.query(EmailSettings)
        .filter(EmailSettings.owner_user_id == admin_user.id)
        .all(),
        tenant_id,
    )
    stats["system_emails"] = _assign_tenant_id(
        db.query(SystemEmail).filter(SystemEmail.owner_user_id == admin_user.id).all(),
        tenant_id,
    )

    owned_company = _pick_primary_company(db, admin_user)
    if owned_company and tenant.brand_name != owned_company.name:
        tenant.brand_name = owned_company.name

    if tenant.settings:
        first_system_email = (
            db.query(SystemEmail)
            .filter(
                SystemEmail.owner_user_id == admin_user.id,
                SystemEmail.is_active.is_(True),
            )
            .order_by(SystemEmail.id.asc())
            .first()
        )
        if first_system_email:
            tenant.settings.default_system_email_id = first_system_email.id

    return stats


def _scalar(db: Session, sql: str, params: dict[str, object] | None = None) -> int:
    return int(db.execute(text(sql), params or {}).scalar() or 0)


def _preview_single_tenant_backfill(
    db: Session,
) -> tuple[int | None, str | None, dict[str, int]]:
    tenant_rows = (
        db.execute(text("SELECT id, slug FROM tenants ORDER BY id ASC"))
        .mappings()
        .all()
    )
    if len(tenant_rows) != 1:
        return None, None, {}

    tenant_id = int(tenant_rows[0]["id"])
    tenant_slug = str(tenant_rows[0]["slug"])
    stats = {
        "users": _scalar(
            db,
            """
            SELECT COUNT(*)
            FROM users
            WHERE tenant_id IS NULL
              AND system_role = ANY(:system_roles)
            """,
            {"system_roles": TENANT_USER_SYSTEM_ROLES},
        )
    }

    for table_name in BACKFILL_TABLES:
        stats[table_name] = _scalar(
            db, f"SELECT COUNT(*) FROM {table_name} WHERE tenant_id IS NULL"
        )

    return tenant_id, tenant_slug, stats


def _apply_single_tenant_backfill(db: Session, tenant_id: int) -> None:
    db.execute(
        text(
            """
            UPDATE users
            SET tenant_id = :tenant_id
            WHERE tenant_id IS NULL
              AND system_role = ANY(:system_roles)
            """
        ),
        {"tenant_id": tenant_id, "system_roles": TENANT_USER_SYSTEM_ROLES},
    )

    for table_name in BACKFILL_TABLES:
        db.execute(
            text(
                f"UPDATE {table_name} SET tenant_id = :tenant_id WHERE tenant_id IS NULL"
            ),
            {"tenant_id": tenant_id},
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bootstrap tenant records from existing admins"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Degisiklikleri veritabanina yaz"
    )
    parser.add_argument("--dry-run", action="store_true", help="Sadece rapor uret")
    parser.add_argument(
        "--backfill-single-tenant",
        action="store_true",
        help="Tam olarak 1 tenant varsa kalan tenant_id bosluklarini ayni tenant'a baglar",
    )
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    db = SessionLocal()
    try:
        _ensure_tenant_foundation_columns(db)
        admins = list(_iter_admin_scoped_users(db))
        print(f"Tenant bootstrap aday admin sayisi: {len(admins)}")
        total_stats: dict[str, int] = {}

        for admin_user in admins:
            tenant = _upsert_tenant_for_admin(db, admin_user)
            stats = _apply_tenant_scope(db, admin_user, tenant)
            print(
                f"- admin={admin_user.email} tenant={tenant.slug} tenant_id={tenant.id}"
            )
            for key, value in stats.items():
                total_stats[key] = total_stats.get(key, 0) + value
                print(f"  {key}: {value}")

        if args.backfill_single_tenant:
            tenant_id, tenant_slug, backfill_stats = _preview_single_tenant_backfill(db)
            if tenant_id is None:
                print("- backfill: atlandi (tek tenant bulunamadi)")
            else:
                print(f"- backfill tenant={tenant_slug} tenant_id={tenant_id}")
                for key, value in backfill_stats.items():
                    total_stats[f"backfill_{key}"] = value
                    print(f"  backfill_{key}: {value}")
                if args.apply:
                    _apply_single_tenant_backfill(db, tenant_id)

        if args.dry_run:
            db.rollback()
            print("Dry-run tamamlandi. Herhangi bir degisiklik kaydedilmedi.")
        else:
            db.commit()
            print("Tenant bootstrap tamamlandi ve kaydedildi.")

        print("Toplam guncellenen kayitlar:")
        for key in sorted(total_stats):
            print(f"- {key}: {total_stats[key]}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
