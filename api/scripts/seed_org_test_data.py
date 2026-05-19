"""
Organizasyon hiyerarsisi ve test personel verisi seed scripti.

Calistirma:
  python -m api.scripts.seed_org_test_data
"""

from __future__ import annotations

import os
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from api.db.session import SessionLocal
from api.core.security import get_password_hash
from api.models.company import Company
from api.models.department import Department
from api.models.role import Role
from api.models.user import User
from api.models.assignment import CompanyRole


CANONICAL_ROLES = [
    {
        "name": "SUPER_ADMIN",
        "description": "Tam yetkili sistem yoneticisi",
        "hierarchy_level": 0,
        "parent": None,
        "aliases": [
            "super_admin",
            "super admin",
            "superadmin",
            "süper admin",
            "süper adimin",
        ],
    },
    {
        "name": "ADMIN",
        "description": "Sistem yoneticisi",
        "hierarchy_level": 1,
        "parent": "SUPER_ADMIN",
        "aliases": ["admin", "admi̇n"],
    },
    {
        "name": "SATIN ALAMA DIREKTORU",
        "description": "Satin alma stratejik karar ve finansal onay",
        "hierarchy_level": 2,
        "parent": "ADMIN",
        "aliases": [
            "satinalma_direktoru",
            "satın alma direktörü",
            "satın alma direktoru",
            "satinalma direktoru",
        ],
    },
    {
        "name": "SATIN ALAMA MUDURU",
        "description": "Satin alma surec yonetimi",
        "hierarchy_level": 3,
        "parent": "SATIN ALAMA DIREKTORU",
        "aliases": ["satinalma_muduru", "satın alma müdürü", "satın alma muduru"],
    },
    {
        "name": "SATIN ALAMA YONETICISI",
        "description": "Satin alma operasyon yonetimi",
        "hierarchy_level": 4,
        "parent": "SATIN ALAMA MUDURU",
        "aliases": [
            "satinalma_yoneticisi",
            "satın alma yöneticisi",
            "satın alma yoneticisi",
        ],
    },
    {
        "name": "SATIN ALAMA UZMANI",
        "description": "Satin alma uzmanligi",
        "hierarchy_level": 5,
        "parent": "SATIN ALAMA YONETICISI",
        "aliases": ["satinalma_uzmani", "satın alma uzmanı", "satın alma uzmani"],
    },
    {
        "name": "SATIN ALAMA",
        "description": "Temel seviye satin alma personeli",
        "hierarchy_level": 6,
        "parent": "SATIN ALAMA UZMANI",
        "aliases": ["satinalmaci", "satın almacı", "satın almaci", "satın alama"],
    },
]

DEPARTMENTS = [
    (
        "GIDA SATIN ALAMA",
        "Gida satin alma: salca alimi, bakliyat alimi, yag alimi gibi surecler",
    ),
    (
        "AMBALAJ SATIN ALAMA",
        "Ambalaj satin alma: kutu, koli, etiket, shrink gibi surecler",
    ),
    (
        "ENDIREK SATIN ALAMA",
        "Endirek satin alma: ofis sarf, hizmet alimlari, genel giderler",
    ),
    (
        "TEKNIK SATIN ALAMA",
        "Teknik satin alma: makina ekipman, yedek parca, teknik malzeme",
    ),
]

TEST_USERS = [
    {
        "full_name": "SATIN ALAMA",
        "email": "satinalma@example.com",
        "user_role": "satinalmaci",
        "assignment_role": "SATIN ALAMA",
    },
    {
        "full_name": "SATIN ALAMA UZMANI",
        "email": "satinalmauzmani@example.com",
        "user_role": "satinalma_uzmani",
        "assignment_role": "SATIN ALAMA UZMANI",
    },
    {
        "full_name": "SATIN ALAMA YONETICISI",
        "email": "satinalmayoneticisi@example.com",
        "user_role": "satinalma_yoneticisi",
        "assignment_role": "SATIN ALAMA YONETICISI",
    },
    {
        "full_name": "SATIN ALAMA MUDURU",
        "email": "satinalmamuduru@example.com",
        "user_role": "admin",
        "assignment_role": "SATIN ALAMA MUDURU",
    },
    {
        "full_name": "SATIN ALAMA DIREKTORU",
        "email": "satinalmadirektoru@example.com",
        "user_role": "satinalma_direktoru",
        "assignment_role": "SATIN ALAMA DIREKTORU",
    },
]

APPROVAL_LIMITS = {
    "satinalmaci": 100000,
    "satinalma_uzmani": 200000,
    "satinalma_yoneticisi": 300000,
    "admin": 600000,
    "satinalma_direktoru": 1000000,
}


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("_", " ").strip()
    return " ".join(text.split())


def _ensure_companies(db) -> list[Company]:
    companies = db.query(Company).filter(Company.is_active.is_(True)).all()
    if companies:
        return companies

    defaults = [
        ("TEST FIRMA 1", "Test firma 1", "#2563eb"),
        ("TEST FIRMA 2", "Test firma 2", "#059669"),
    ]
    created = []
    for name, desc, color in defaults:
        row = Company(name=name, description=desc, color=color, is_active=True)
        db.add(row)
        db.flush()
        created.append(row)
    print(f"+ {len(created)} test firma olusturuldu")
    return created


def main() -> None:
    db = SessionLocal()
    try:
        print("=== Organizasyon test verisi seed basladi ===")

        # 1) Role canonicalization
        all_roles = db.query(Role).all()
        role_by_norm = {_norm(r.name): r for r in all_roles}
        canonical_map: dict[str, Role] = {}

        for rc in CANONICAL_ROLES:
            canonical = role_by_norm.get(_norm(rc["name"]))
            if not canonical:
                canonical = Role(
                    name=rc["name"],
                    description=rc["description"],
                    hierarchy_level=rc["hierarchy_level"],
                    is_active=True,
                )
                db.add(canonical)
                db.flush()
                print(f"+ Rol olusturuldu: {canonical.name}")
            canonical.is_active = True
            canonical.description = rc["description"]
            canonical.hierarchy_level = rc["hierarchy_level"]
            canonical_map[rc["name"]] = canonical

        db.flush()

        # Parent baglari
        for rc in CANONICAL_ROLES:
            role = canonical_map[rc["name"]]
            parent_name = rc["parent"]
            role.parent_id = canonical_map[parent_name].id if parent_name else None

        # Alias role migration
        canonical_ids = {r.id for r in canonical_map.values()}
        alias_norm_to_canonical: dict[str, Role] = {}
        for rc in CANONICAL_ROLES:
            target = canonical_map[rc["name"]]
            for alias in rc["aliases"]:
                alias_norm_to_canonical[_norm(alias)] = target
            alias_norm_to_canonical[_norm(rc["name"])] = target

        for role in db.query(Role).all():
            target = alias_norm_to_canonical.get(_norm(role.name))
            if not target:
                role.is_active = False
                continue

            if role.id == target.id:
                continue

            # assignment role_id tasima
            db.query(CompanyRole).filter(CompanyRole.role_id == role.id).update(
                {CompanyRole.role_id: target.id}, synchronize_session=False
            )

            # permission birlestirme
            merged_permissions = {p.id: p for p in target.permissions}
            for p in role.permissions:
                merged_permissions[p.id] = p
            target.permissions = list(merged_permissions.values())

            role.is_active = False
            if role.id not in canonical_ids:
                print(f"~ Eski rol pasiflesti: {role.name}")

        # 2) Departments
        dept_rows: list[Department] = []
        for name, desc in DEPARTMENTS:
            row = db.query(Department).filter(Department.name == name).first()
            if not row:
                row = Department(name=name, description=desc, is_active=True)
                db.add(row)
                db.flush()
                print(f"+ Departman olusturuldu: {name}")
            row.description = desc
            row.is_active = True
            dept_rows.append(row)

        # 3) Companies
        companies = _ensure_companies(db)

        # 4) Users + assignments
        password_hash = get_password_hash("Test123!")

        for idx, u in enumerate(TEST_USERS):
            dept = dept_rows[idx % len(dept_rows)]
            company = companies[idx % len(companies)]
            role_row = canonical_map[u["assignment_role"]]

            user = db.query(User).filter(User.email == u["email"]).first()
            if not user:
                user = User(
                    email=u["email"],
                    full_name=u["full_name"],
                    hashed_password=password_hash,
                    role=u["user_role"],
                    approval_limit=APPROVAL_LIMITS.get(u["user_role"], 100000),
                    department_id=dept.id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                print(f"+ Personel olusturuldu: {u['email']}")
            else:
                user.full_name = u["full_name"]
                user.hashed_password = password_hash
                user.role = u["user_role"]
                user.approval_limit = APPROVAL_LIMITS.get(u["user_role"], 100000)
                user.department_id = dept.id
                user.is_active = True
                print(f"~ Personel guncellendi: {u['email']}")

            assignment = (
                db.query(CompanyRole)
                .filter(
                    CompanyRole.user_id == user.id,
                    CompanyRole.company_id == company.id,
                )
                .first()
            )
            if not assignment:
                assignment = CompanyRole(
                    user_id=user.id,
                    company_id=company.id,
                    role_id=role_row.id,
                    department_id=dept.id,
                    is_active=True,
                )
                db.add(assignment)
                print(f"+ Atama eklendi: {u['full_name']} -> {company.name}")
            else:
                assignment.role_id = role_row.id
                assignment.department_id = dept.id
                assignment.is_active = True

        db.commit()
        print("=== Seed tamamlandi ===")

    except Exception as exc:
        db.rollback()
        print(f"[HATA] Seed basarisiz: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
