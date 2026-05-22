"""
Seed default permissions and roles with hierarchy.

Usage:
    python -m api.scripts.seed_permissions

Rolls out:
  - Standard permissions across all modules
  - 5 default roles with correct hierarchy and permission sets
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from api.db.session import SessionLocal
from api.models.role import Role, Permission


# ---------------------------------------------------------------------------
# Permission catalogue
# ---------------------------------------------------------------------------

PERMISSIONS: list[dict] = [
    # QUOTES
    {"name": "quotes.create", "category": "quotes", "description": "Teklif oluştur"},
    {
        "name": "quotes.read",
        "category": "quotes",
        "description": "Teklifleri görüntüle",
    },
    {"name": "quotes.update", "category": "quotes", "description": "Teklif güncelle"},
    {"name": "quotes.delete", "category": "quotes", "description": "Teklif sil"},
    {
        "name": "quotes.send_to_supplier",
        "category": "quotes",
        "description": "Tedarikçiye teklif gönder",
    },
    {"name": "quotes.approve", "category": "quotes", "description": "Teklif onayla"},
    {"name": "quotes.reject", "category": "quotes", "description": "Teklif reddet"},
    {
        "name": "quotes.revise",
        "category": "quotes",
        "description": "Teklif revize iste",
    },
    # USERS
    {"name": "users.read", "category": "users", "description": "Personeli görüntüle"},
    {"name": "users.create", "category": "users", "description": "Personel ekle"},
    {"name": "users.update", "category": "users", "description": "Personel güncelle"},
    {"name": "users.delete", "category": "users", "description": "Personel sil"},
    {
        "name": "users.reset_password",
        "category": "users",
        "description": "Personel şifresini sıfırla",
    },
    # COMPANIES
    {
        "name": "companies.read",
        "category": "companies",
        "description": "Firmaları görüntüle",
    },
    {"name": "companies.create", "category": "companies", "description": "Firma ekle"},
    {
        "name": "companies.update",
        "category": "companies",
        "description": "Firma güncelle",
    },
    {"name": "companies.delete", "category": "companies", "description": "Firma sil"},
    # DEPARTMENTS
    {
        "name": "departments.read",
        "category": "departments",
        "description": "Departmanları görüntüle",
    },
    {
        "name": "departments.create",
        "category": "departments",
        "description": "Departman ekle",
    },
    {
        "name": "departments.update",
        "category": "departments",
        "description": "Departman güncelle",
    },
    {
        "name": "departments.delete",
        "category": "departments",
        "description": "Departman sil",
    },
    # PROJECTS
    {
        "name": "projects.read",
        "category": "projects",
        "description": "Projeleri görüntüle",
    },
    {"name": "projects.create", "category": "projects", "description": "Proje ekle"},
    {
        "name": "projects.update",
        "category": "projects",
        "description": "Proje güncelle",
    },
    {"name": "projects.delete", "category": "projects", "description": "Proje sil"},
    # ROLES
    {"name": "roles.read", "category": "roles", "description": "Rolleri görüntüle"},
    {"name": "roles.create", "category": "roles", "description": "Rol ekle"},
    {"name": "roles.update", "category": "roles", "description": "Rol güncelle"},
    {"name": "roles.delete", "category": "roles", "description": "Rol sil"},
    # SUPPLIERS
    {
        "name": "suppliers.read",
        "category": "suppliers",
        "description": "Tedarikçileri görüntüle",
    },
    {
        "name": "suppliers.create",
        "category": "suppliers",
        "description": "Tedarikçi ekle",
    },
    {
        "name": "suppliers.update",
        "category": "suppliers",
        "description": "Tedarikçi güncelle",
    },
    {
        "name": "suppliers.delete",
        "category": "suppliers",
        "description": "Tedarikçi sil",
    },
    # REPORTS
    {
        "name": "reports.read",
        "category": "reports",
        "description": "Raporları görüntüle",
    },
    {
        "name": "reports.export",
        "category": "reports",
        "description": "Rapor dışa aktar",
    },
    # SETTINGS
    {
        "name": "settings.read",
        "category": "settings",
        "description": "Ayarları görüntüle",
    },
    {
        "name": "settings.update",
        "category": "settings",
        "description": "Ayarları güncelle",
    },
]

# ---------------------------------------------------------------------------
# Role definitions with permission sets
# All lower-level roles inherit ALL permissions of higher roles above them.
# ---------------------------------------------------------------------------

ROLES: list[dict] = [
    {
        "name": "super_admin",
        "description": "Tam yetkili sistem yöneticisi",
        "hierarchy_level": 0,
        "parent": None,
        "permissions": [p["name"] for p in PERMISSIONS],  # tümü
    },
    {
        "name": "satinalma_direktoru",
        "description": "Satın Alma Direktörü — onay limitsiz, strateji ve finansal kararlar",
        "hierarchy_level": 1,
        "parent": "super_admin",
        "permissions": [
            "quotes.create",
            "quotes.read",
            "quotes.update",
            "quotes.delete",
            "quotes.send_to_supplier",
            "quotes.approve",
            "quotes.reject",
            "quotes.revise",
            "users.read",
            "users.reset_password",
            "companies.read",
            "departments.read",
            "projects.read",
            "projects.create",
            "projects.update",
            "suppliers.read",
            "suppliers.create",
            "suppliers.update",
            "reports.read",
            "reports.export",
            "settings.read",
        ],
    },
    {
        "name": "satinalma_yoneticisi",
        "description": "Satın Alma Yöneticisi — operasyonel onay, ekip yönetimi",
        "hierarchy_level": 2,
        "parent": "satinalma_direktoru",
        "permissions": [
            "quotes.create",
            "quotes.read",
            "quotes.update",
            "quotes.send_to_supplier",
            "quotes.approve",
            "quotes.reject",
            "quotes.revise",
            "users.read",
            "companies.read",
            "departments.read",
            "projects.read",
            "projects.create",
            "projects.update",
            "suppliers.read",
            "suppliers.create",
            "reports.read",
            "settings.read",
        ],
    },
    {
        "name": "satinalma_uzmani",
        "description": "Satın Alma Uzmanı — teklif oluşturma ve tedarikçi iletişimi",
        "hierarchy_level": 3,
        "parent": "satinalma_yoneticisi",
        "permissions": [
            "quotes.create",
            "quotes.read",
            "quotes.update",
            "quotes.send_to_supplier",
            "quotes.revise",
            "companies.read",
            "departments.read",
            "projects.read",
            "suppliers.read",
            "reports.read",
        ],
    },
    {
        "name": "satinalmaci",
        "description": "Satın Almacı — temel teklif oluşturma ve izleme",
        "hierarchy_level": 4,
        "parent": "satinalma_uzmani",
        "permissions": [
            "quotes.create",
            "quotes.read",
            "projects.read",
            "suppliers.read",
        ],
    },
]


def seed(db) -> None:
    # 1. Ensure all permissions exist
    perm_map: dict[str, Permission] = {}
    for p_data in PERMISSIONS:
        existing = (
            db.query(Permission).filter(Permission.name == p_data["name"]).first()
        )
        if existing:
            perm_map[p_data["name"]] = existing
        else:
            perm = Permission(
                name=p_data["name"],
                description=p_data.get("description"),
                category=p_data.get("category", "general"),
            )
            db.add(perm)
            db.flush()
            perm_map[p_data["name"]] = perm
            print(f"  + İzin eklendi: {p_data['name']}")

    db.flush()

    # 2. Ensure all roles exist with hierarchy and permissions
    role_map: dict[str, Role] = {}
    for r_data in ROLES:
        existing = db.query(Role).filter(Role.name == r_data["name"]).first()
        if existing:
            role_obj = existing
            print(f"  ~ Mevcut rol güncelleniyor: {r_data['name']}")
        else:
            role_obj = Role(
                name=r_data["name"],
                description=r_data.get("description"),
                hierarchy_level=r_data["hierarchy_level"],
                is_active=True,
            )
            db.add(role_obj)
            db.flush()
            print(f"  + Rol eklendi: {r_data['name']}")

        # Set parent
        if r_data["parent"] and r_data["parent"] in role_map:
            role_obj.parent_id = role_map[r_data["parent"]].id

        # Assign permissions
        role_obj.permissions = [
            perm_map[pname] for pname in r_data["permissions"] if pname in perm_map
        ]

        role_map[r_data["name"]] = role_obj

    db.commit()
    print("\nSeeding tamamlandı.")
    print(f"  {len(perm_map)} izin, {len(role_map)} rol işlendi.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("=== İzin ve Rol Seeding Başlıyor ===\n")
        seed(db)
    finally:
        db.close()
