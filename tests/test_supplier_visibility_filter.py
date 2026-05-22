from __future__ import annotations

import uuid
from types import SimpleNamespace

from api.core.security import get_password_hash
from api.database import SessionLocal
from api.models.supplier import Supplier
from api.models.tenant import Tenant
from api.models.user import User
from api.routers.supplier_router import _apply_supplier_visibility_filter


def _seed_tenant(db, suffix: str) -> Tenant:
    tenant = Tenant(
        slug=f"supplier-filter-{suffix}",
        legal_name=f"Supplier Filter {suffix}",
        brand_name=f"Filter {suffix}",
        status="active",
        onboarding_status="active",
        is_active=True,
    )
    db.add(tenant)
    db.flush()
    return tenant


def _seed_user(
    db, suffix: str, *, role: str, system_role: str, tenant_id: int | None = None
) -> User:
    user = User(
        email=f"supplier-filter-{suffix}@test.local",
        hashed_password=get_password_hash("Test123!"),
        full_name=f"Supplier Filter {suffix}",
        role=role,
        system_role=system_role,
        tenant_id=tenant_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _seed_supplier(
    db, suffix: str, *, created_by_id: int, tenant_id: int | None = None
) -> Supplier:
    supplier = Supplier(
        tenant_id=tenant_id,
        created_by_id=created_by_id,
        company_name=f"Supplier {suffix}",
        phone="+90 555 000 00 00",
        email=f"supplier-{suffix}@test.local",
        is_active=True,
    )
    db.add(supplier)
    db.flush()
    return supplier


def test_supplier_visibility_filter_prefers_tenant_scope_and_creator_fallback():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    try:
        tenant = _seed_tenant(db, suffix)
        other_tenant = _seed_tenant(db, f"{suffix}-other")

        tenant_admin = _seed_user(
            db,
            f"{suffix}-tenant-admin",
            role="admin",
            system_role="tenant_admin",
            tenant_id=tenant.id,
        )
        creator = _seed_user(
            db,
            f"{suffix}-creator",
            role="user",
            system_role="tenant_member",
        )
        other_creator = _seed_user(
            db,
            f"{suffix}-other-creator",
            role="user",
            system_role="tenant_member",
        )

        visible_tenant_supplier = _seed_supplier(
            db,
            f"{suffix}-tenant-visible",
            created_by_id=tenant_admin.id,
            tenant_id=tenant.id,
        )
        _seed_supplier(
            db,
            f"{suffix}-tenant-hidden",
            created_by_id=tenant_admin.id,
            tenant_id=other_tenant.id,
        )
        visible_creator_supplier = _seed_supplier(
            db,
            f"{suffix}-creator-visible",
            created_by_id=creator.id,
            tenant_id=None,
        )
        _seed_supplier(
            db,
            f"{suffix}-creator-hidden",
            created_by_id=other_creator.id,
            tenant_id=None,
        )
        db.commit()

        tenant_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            tenant_admin,
        ).all()
        creator_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            creator,
        ).all()

        assert {row.id for row in tenant_rows} == {visible_tenant_supplier.id}
        assert {row.id for row in creator_rows} == {visible_creator_supplier.id}
    finally:
        db.rollback()
        db.query(Supplier).filter(
            Supplier.email.like(f"supplier-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.query(User).filter(
            User.email.like(f"supplier-filter-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.query(Tenant).filter(Tenant.slug.like(f"supplier-filter-{suffix}%")).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()


def test_supplier_visibility_filter_supports_private_and_platform_split_for_tenant_users():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    try:
        tenant = _seed_tenant(db, suffix)
        other_tenant = _seed_tenant(db, f"{suffix}-other")

        tenant_admin = _seed_user(
            db,
            f"{suffix}-tenant-admin",
            role="admin",
            system_role="tenant_admin",
            tenant_id=tenant.id,
        )
        platform_creator = _seed_user(
            db,
            f"{suffix}-platform-creator",
            role="satinalma_direktoru",
            system_role="super_admin",
        )

        private_supplier = _seed_supplier(
            db,
            f"{suffix}-private",
            created_by_id=tenant_admin.id,
            tenant_id=tenant.id,
        )
        platform_supplier = _seed_supplier(
            db,
            f"{suffix}-platform",
            created_by_id=platform_creator.id,
            tenant_id=None,
        )
        _seed_supplier(
            db,
            f"{suffix}-other-private",
            created_by_id=tenant_admin.id,
            tenant_id=other_tenant.id,
        )
        db.commit()

        private_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            tenant_admin,
            source_type="private",
        ).all()
        platform_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            tenant_admin,
            source_type="platform_network",
        ).all()
        all_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            tenant_admin,
            source_type="all",
        ).all()

        assert {row.id for row in private_rows} == {private_supplier.id}
        assert {row.id for row in platform_rows} >= {platform_supplier.id}
        assert {row.id for row in all_rows} >= {
            private_supplier.id,
            platform_supplier.id,
        }
    finally:
        db.rollback()
        db.query(Supplier).filter(
            Supplier.email.like(f"supplier-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.query(User).filter(
            User.email.like(f"supplier-filter-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.query(Tenant).filter(Tenant.slug.like(f"supplier-filter-{suffix}%")).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()


def test_supplier_visibility_filter_allows_global_manager_unscoped_when_requested():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    try:
        creator = _seed_user(
            db,
            f"{suffix}-creator",
            role="user",
            system_role="tenant_member",
        )
        global_manager = SimpleNamespace(
            id=999,
            role="satinalma_direktoru",
            system_role="tenant_member",
            tenant_id=None,
        )
        first = _seed_supplier(db, f"{suffix}-one", created_by_id=creator.id)
        second = _seed_supplier(db, f"{suffix}-two", created_by_id=creator.id)
        db.commit()

        scoped_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            global_manager,
            allow_global_manager_unscoped=False,
        ).all()
        unscoped_rows = _apply_supplier_visibility_filter(
            db.query(Supplier),
            global_manager,
            allow_global_manager_unscoped=True,
        ).all()

        assert scoped_rows == []
        assert {row.id for row in unscoped_rows} >= {first.id, second.id}
    finally:
        db.rollback()
        db.query(Supplier).filter(
            Supplier.email.like(f"supplier-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.query(User).filter(
            User.email.like(f"supplier-filter-{suffix}%@test.local")
        ).delete(synchronize_session=False)
        db.commit()
        db.close()
