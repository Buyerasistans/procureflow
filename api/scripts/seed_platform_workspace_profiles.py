from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.core.security import get_password_hash
from api.db.session import SessionLocal
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.models.role import Role
from api.models.settings import SystemSettings
from api.models.user import User
from api.scripts.apply_runtime_compat_columns import (
    main as apply_runtime_compat_columns,
)


PLATFORM_PRIMARY_COMPANY = {
    "name": "BUYERA ASISTANS PLATFORM A.S.",
    "description": "Platformun yasal faturalandirma, tahsilat ve resmi operasyon firmasi.",
    "trade_name": "Buyera Asistans",
    "color": "#1d4ed8",
    "is_active": True,
}

PLATFORM_DEMO_USERS = [
    (
        "portaladmin1@buyeraasistans.local",
        "Portal Admini 1",
        "admin",
        "platform_operator",
    ),
    (
        "portaladmin2@buyeraasistans.local",
        "Portal Admini 2",
        "admin",
        "platform_operator",
    ),
    (
        "destek1@buyeraasistans.local",
        "Destek Temsilcisi 1",
        "admin",
        "platform_support",
    ),
    (
        "destek2@buyeraasistans.local",
        "Destek Temsilcisi 2",
        "admin",
        "platform_support",
    ),
    ("finans1@buyeraasistans.local", "Finans Sorumlusu 1", "admin", "finance_officer"),
    ("finans2@buyeraasistans.local", "Finans Sorumlusu 2", "admin", "finance_officer"),
]

DEMO_SUPER_ADMIN_EMAILS = {
    "super_admin@demo.procureflow.com",
}

DEMO_DIRECT_PASSWORD = "Aa1234!!"

ROLE_ALIASES = {
    "SUPER_ADMIN": {"super admin", "super_admin", "superadmin", "süper admin"},
    "SATIN ALMA ADMIN": {"satın alma admin", "satin alma admin", "admin"},
}

ALL_DEPARTMENTS_MARKER = "__ALL_DEPARTMENTS__"


def _normalize(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace(".", " ")
        .replace("-", " ")
        .replace("ı", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
    )


def _ensure_settings(db) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if settings is None:
        settings = SystemSettings(app_name="ProcureFlow")
        db.add(settings)
        db.flush()
    return settings


def _ensure_platform_company(db) -> Company:
    company = (
        db.query(Company)
        .filter(Company.name == PLATFORM_PRIMARY_COMPANY["name"])
        .first()
    )
    if company is None:
        company = Company(**PLATFORM_PRIMARY_COMPANY)
        db.add(company)
        db.flush()
    else:
        for key, value in PLATFORM_PRIMARY_COMPANY.items():
            setattr(company, key, value)
    settings = _ensure_settings(db)
    settings.platform_primary_company_id = company.id
    db.add(settings)
    return company


def _resolve_role(db, canonical_name: str) -> Role:
    normalized_targets = {_normalize(canonical_name)} | {
        _normalize(alias) for alias in ROLE_ALIASES.get(canonical_name, set())
    }
    for role in db.query(Role).filter(Role.is_active.is_(True)).all():
        if _normalize(role.name) in normalized_targets:
            return role

    role = Role(
        name=canonical_name,
        description=f"{canonical_name} otomatik platform seed rolu",
        is_active=True,
        hierarchy_level=0 if canonical_name == "SUPER_ADMIN" else 1,
    )
    db.add(role)
    db.flush()
    return role


def _ensure_company_assignment(db, user: User, company: Company, role: Role) -> None:
    assignment = (
        db.query(CompanyRole)
        .filter(
            CompanyRole.user_id == user.id,
            CompanyRole.company_id == company.id,
            CompanyRole.is_active.is_(True),
        )
        .first()
    )
    if assignment is None:
        assignment = CompanyRole(
            user_id=user.id,
            company_id=company.id,
            role_id=role.id,
            department_id=None,
            tenant_id=None,
            sub_items_json='["__ALL_DEPARTMENTS__"]',
            is_active=True,
        )
        db.add(assignment)
        return

    assignment.role_id = role.id
    assignment.department_id = None
    assignment.tenant_id = None
    assignment.sub_items_json = '["__ALL_DEPARTMENTS__"]'
    assignment.is_active = True


def _ensure_user(
    db, *, email: str, full_name: str, role: str, system_role: str
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(DEMO_DIRECT_PASSWORD),
            role=role,
            system_role=system_role,
            tenant_id=None,
            approval_limit=0,
            invitation_token=None,
            invitation_token_expires=None,
            invitation_accepted=True,
            is_active=True,
            created_by_id=None,
        )
        db.add(user)
        db.flush()
        return user

    user.full_name = full_name
    user.hashed_password = get_password_hash(DEMO_DIRECT_PASSWORD)
    user.role = role
    user.system_role = system_role
    user.tenant_id = None
    user.approval_limit = 0
    user.invitation_token = None
    user.invitation_token_expires = None
    user.invitation_accepted = True
    user.is_active = True
    return user


def _activate_demo_super_admins(db, company: Company, super_admin_role: Role) -> None:
    for email in DEMO_SUPER_ADMIN_EMAILS:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            continue
        user.hashed_password = get_password_hash(DEMO_DIRECT_PASSWORD)
        user.tenant_id = None
        user.approval_limit = 0
        user.invitation_token = None
        user.invitation_token_expires = None
        user.invitation_accepted = True
        user.is_active = True
        _ensure_company_assignment(db, user, company, super_admin_role)


def main() -> int:
    apply_runtime_compat_columns()
    db = SessionLocal()
    try:
        company = _ensure_platform_company(db)
        super_admin_role = _resolve_role(db, "SUPER_ADMIN")
        admin_role = _resolve_role(db, "SATIN ALMA ADMIN")

        super_admin_users = (
            db.query(User).filter(User.system_role == "super_admin").all()
        )
        for user in super_admin_users:
            user.hashed_password = get_password_hash(DEMO_DIRECT_PASSWORD)
            user.invitation_token = None
            user.invitation_token_expires = None
            user.invitation_accepted = True
            user.is_active = True
            user.tenant_id = None
            user.approval_limit = 0
            _ensure_company_assignment(db, user, company, super_admin_role)

        _activate_demo_super_admins(db, company, super_admin_role)

        for email, full_name, business_role, system_role in PLATFORM_DEMO_USERS:
            user = _ensure_user(
                db,
                email=email,
                full_name=full_name,
                role=business_role,
                system_role=system_role,
            )
            _ensure_company_assignment(db, user, company, admin_role)

        db.commit()
        print("SEEDED_PLATFORM_WORKSPACE_PROFILES password=<redacted>")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
