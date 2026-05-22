from __future__ import annotations

import os
import sys

from sqlalchemy import or_
from sqlalchemy.orm import Session

from api.core.security import get_password_hash
from api.database import SessionLocal, engine
from api.models import Permission, User
from api.scripts.apply_runtime_compat_columns import (
    main as apply_runtime_compat_columns,
)
from api.scripts.apply_runtime_foundation_columns import (
    main as apply_runtime_foundation_columns,
)
from api.scripts.apply_runtime_quote_compat_columns import (
    main as apply_runtime_quote_compat_columns,
)
from api.scripts.apply_supplier_quote_price_rules_defaults import (
    main as apply_supplier_quote_price_rules_defaults,
)


RUNTIME_SCHEMA_PATCHES: list[str] = []

# Runtime schema patch listesi artik bos tutulur.
# Tenant foundation alanlari apply_runtime_foundation_columns.py,
# profil / support / branding alanlari apply_runtime_compat_columns.py,
# quote / supplier uyumluluk alanlari ise apply_runtime_quote_compat_columns.py
# uzerinden idempotent bootstrap akisina tasinmistir.


TEST_USERS = [
    ("test@example.com", "Test1234!", "Test User", "super_admin"),
    ("satinalmaci@example.com", "Test1234!", "Satın Almacı", "satinalmaci"),
    (
        "satinalmauzmani@example.com",
        "Test1234!",
        "Satın Alma Uzmanı",
        "satinalma_uzmani",
    ),
    (
        "satinalmayoneticisi@example.com",
        "Test1234!",
        "Satın Alma Yöneticisi",
        "satinalma_yoneticisi",
    ),
    (
        "satinalmadirektoru@example.com",
        "Test1234!",
        "Satın Alma Direktörü",
        "satinalma_direktoru",
    ),
]

CANONICAL_SUPER_ADMIN_EMAIL = "superadmin@buyerasistans.com.tr"
LEGACY_SUPER_ADMIN_EMAILS = ("superadmin@procureflow.com",)


def _get_super_admin_password() -> str:
    """SUPER_ADMIN_PASSWORD env zorunlu — boş veya eksikse uygulama başlamaz."""
    pwd = os.environ.get("SUPER_ADMIN_PASSWORD", "").strip()
    if not pwd:
        raise RuntimeError(
            "SUPER_ADMIN_PASSWORD ortam degiskeni zorunludur. "
            "api/.env dosyasina SUPER_ADMIN_PASSWORD=<guclu-sifre> ekleyip "
            "uygulamayi yeniden baslatin."
        )
    return pwd


def ensure_runtime_super_admin(db: Session) -> None:
    is_pytest = "pytest" in sys.modules
    hidden_from_admin_value = True if is_pytest else False
    user = db.query(User).filter(User.email == CANONICAL_SUPER_ADMIN_EMAIL).first()
    if user is None:
        user = (
            db.query(User)
            .filter(or_(User.system_role == "super_admin", User.role == "super_admin"))
            .order_by(User.id.asc())
            .first()
        )
        if user is not None and user.email in LEGACY_SUPER_ADMIN_EMAILS:
            user.email = CANONICAL_SUPER_ADMIN_EMAIL

    if user is None:
        user = User(
            email=CANONICAL_SUPER_ADMIN_EMAIL,
            work_email=CANONICAL_SUPER_ADMIN_EMAIL,
            full_name="Super Admin",
            hashed_password=get_password_hash(_get_super_admin_password()),
            role="super_admin",
            system_role="super_admin",
            approval_limit=999999999,
            is_active=True,
            hidden_from_admin=hidden_from_admin_value,
            invitation_accepted=True,
        )
        db.add(user)
    else:
        user.email = CANONICAL_SUPER_ADMIN_EMAIL
        user.work_email = CANONICAL_SUPER_ADMIN_EMAIL
        user.full_name = "Super Admin"
        user.hashed_password = get_password_hash(_get_super_admin_password())
        user.role = "super_admin"
        user.system_role = "super_admin"
        user.approval_limit = 999999999
        user.tenant_id = None
        user.created_by_id = None
        user.is_active = True
        user.hidden_from_admin = hidden_from_admin_value
        user.deleted_original_email = None
        user.invitation_token = None
        user.invitation_token_expires = None
        user.invitation_accepted = True
        user.scope_type = "platform"
        user.role_profile_code = "platform.super_admin"
        db.add(user)

    db.commit()
    print(f"[OK] Runtime super admin ensured: {CANONICAL_SUPER_ADMIN_EMAIL}")


PERMISSION_SEED_DATA = [
    (
        "create:personnel",
        "Personel Oluştur",
        "global",
        "Yeni personel kaydı oluşturma",
        "Yeni bir personel kayıtlamak için kullanılır",
    ),
    (
        "read:personnel",
        "Personel Görüntüle",
        "global",
        "Personel bilgisi okuma",
        "Personel detaylarını görmek için kullanılır",
    ),
    (
        "update:personnel",
        "Personel Düzenle",
        "global",
        "Personel bilgisi güncelleme",
        "Personel bilgilerini değiştirmek için kullanılır",
    ),
    (
        "delete:personnel",
        "Personel Sil",
        "global",
        "Personel kaydı silme",
        "Personel kaydını sistemden silmek için kullanılır",
    ),
    (
        "create:department",
        "Departman Oluştur",
        "global",
        "Yeni departman oluşturma",
        "Yeni bir departman oluşturmak için kullanılır",
    ),
    (
        "read:department",
        "Departman Görüntüle",
        "global",
        "Departman bilgisi okuma",
        "Departman detaylarını görmek için kullanılır",
    ),
    (
        "update:department",
        "Departman Düzenle",
        "global",
        "Departman bilgisi güncelleme",
        "Departman bilgilerini değiştirmek için kullanılır",
    ),
    (
        "delete:department",
        "Departman Sil",
        "global",
        "Departman kaydı silme",
        "Departman kaydını sistemden silmek için kullanılır",
    ),
    (
        "create:company",
        "Firma Oluştur",
        "global",
        "Yeni firma oluşturma",
        "Yeni bir firma kaydı oluşturmak için kullanılır",
    ),
    (
        "read:company",
        "Firma Görüntüle",
        "global",
        "Firma bilgisi okuma",
        "Firma detaylarını görmek için kullanılır",
    ),
    (
        "update:company",
        "Firma Düzenle",
        "global",
        "Firma bilgisi güncelleme",
        "Firma bilgilerini değiştirmek için kullanılır",
    ),
    (
        "delete:company",
        "Firma Sil",
        "global",
        "Firma kaydı silme",
        "Firma kaydını sistemden silmek için kullanılır",
    ),
    (
        "create:project",
        "Proje Oluştur",
        "project",
        "Yeni proje oluşturma",
        "Yeni bir proje oluşturmak için kullanılır",
    ),
    (
        "read:project",
        "Proje Görüntüle",
        "project",
        "Proje bilgisi okuma",
        "Proje detaylarını görmek için kullanılır",
    ),
    (
        "update:project",
        "Proje Düzenle",
        "project",
        "Proje bilgisi güncelleme",
        "Proje bilgilerini değiştirmek için kullanılır",
    ),
    (
        "delete:project",
        "Proje Sil",
        "project",
        "Proje kaydı silme",
        "Proje kaydını sistemden silmek için kullanılır",
    ),
    (
        "create:role",
        "Rol Oluştur",
        "global",
        "Yeni rol oluşturma",
        "Yeni bir rol tanımlamak için kullanılır",
    ),
    (
        "read:role",
        "Rol Görüntüle",
        "global",
        "Rol bilgisi okuma",
        "Rol detaylarını görmek için kullanılır",
    ),
    (
        "update:role",
        "Rol Düzenle",
        "global",
        "Rol bilgisi güncelleme",
        "Rol parametrelerini değiştirmek için kullanılır",
    ),
    (
        "delete:role",
        "Rol Sil",
        "global",
        "Rol kaydı silme",
        "Rol kaydını sistemden silmek için kullanılır",
    ),
    (
        "create:quote",
        "Teklif Oluştur",
        "project",
        "Yeni teklif oluşturma",
        "Satıcılardan yeni teklif talep etmek için kullanılır",
    ),
    (
        "read:quote",
        "Teklif Görüntüle",
        "project",
        "Teklif bilgisi okuma",
        "Gelen teklifleri incelemek için kullanılır",
    ),
    (
        "update:quote",
        "Teklif Düzenle",
        "project",
        "Teklif bilgisi güncelleme",
        "Teklif detaylarını değiştirmek için kullanılır",
    ),
    (
        "delete:quote",
        "Teklif Sil",
        "project",
        "Teklif kaydı silme",
        "Teklif kaydını iptal etmek için kullanılır",
    ),
    (
        "approve:quote",
        "Teklif Onayla",
        "project",
        "Teklif onaylama",
        "Teklifi onaylamak ve sözleşme aşamasına geçmek için kullanılır",
    ),
]


def apply_runtime_schema_patches() -> None:
    if engine.dialect.name == "sqlite":
        print(
            "[OK] Runtime schema patch skipped on sqlite; metadata.create_all is sufficient"
        )
        return

    apply_runtime_foundation_columns()
    apply_runtime_compat_columns()
    apply_runtime_quote_compat_columns()
    apply_supplier_quote_price_rules_defaults()

    if not RUNTIME_SCHEMA_PATCHES:
        print("[OK] Runtime schema patch applied via bootstrap scripts")
        return

    from sqlalchemy import text as _text

    session = SessionLocal()
    try:
        for patch_sql in RUNTIME_SCHEMA_PATCHES:
            try:
                session.execute(_text(patch_sql))
                session.commit()
            except Exception:
                session.rollback()
    finally:
        session.close()


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def seed_demo_users(db: Session) -> None:
    if db.query(User).filter(User.hidden_from_admin.is_(False)).count() != 0:
        print("[OK] Test user seed skipped: visible users already exist")
        return

    for email, password, full_name, role in TEST_USERS:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"[OK] Test user already exists: {email}")
            continue

        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=role,
            system_role="super_admin" if role == "super_admin" else "tenant_member",
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.commit()
        print(f"[OK] Test user created: {email} / {password}")


def seed_permission_catalog(db: Session) -> None:
    for perm_code, perm_name, category, perm_desc, tooltip in PERMISSION_SEED_DATA:
        existing = db.query(Permission).filter(Permission.name == perm_code).first()
        if existing:
            continue

        perm = Permission(
            name=perm_code,
            description=perm_desc,
            category=category,
            tooltip=tooltip,
        )
        db.add(perm)

    db.commit()
    print("[OK] Permissions and roles seeded successfully")


def seed_runtime_defaults() -> None:
    enable_demo_users = _env_flag("PF_ENABLE_RUNTIME_DEMO_USERS", default=False)
    enable_permission_seed = _env_flag(
        "PF_ENABLE_RUNTIME_PERMISSION_SEED", default=False
    )

    db = SessionLocal()
    try:
        ensure_runtime_super_admin(db)

        if not enable_demo_users and not enable_permission_seed:
            print("[OK] Runtime seed skipped: no optional runtime seed flag enabled")
            return

        if enable_demo_users:
            seed_demo_users(db)
        else:
            print("[OK] Demo user seed disabled by PF_ENABLE_RUNTIME_DEMO_USERS")

        if enable_permission_seed:
            seed_permission_catalog(db)
        else:
            print(
                "[OK] Permission catalog seed disabled by PF_ENABLE_RUNTIME_PERMISSION_SEED"
            )
    except Exception as exc:
        print(f"[ERROR] Seeding error: {exc}")
        db.rollback()
    finally:
        db.close()
