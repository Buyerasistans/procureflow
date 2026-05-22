from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from api.core.security import get_password_hash
from api.database import SessionLocal
from api.models.project import Project, user_projects
from api.models.supplier import ProjectSupplier, Supplier, SupplierUser
from api.models.tenant import Tenant
from api.models.user import User
from api.routers.supplier_router import (
    _can_bypass_supplier_scope,
    _ensure_supplier_creator_access,
    _get_visible_supplier_or_404,
    _require_private_supplier_tenant_scope,
)


def test_supplier_creator_access_allows_only_super_admin_bypass():
    supplier = SimpleNamespace(created_by_id=10)
    super_admin = SimpleNamespace(role="super_admin", system_role="super_admin", id=1)
    tenant_admin = SimpleNamespace(role="admin", system_role="tenant_admin", id=1)

    assert _can_bypass_supplier_scope(super_admin) is True
    assert _can_bypass_supplier_scope(tenant_admin) is False

    _ensure_supplier_creator_access(
        supplier,
        super_admin,
        detail="forbidden",
    )


def test_supplier_creator_access_blocks_non_creator_without_super_admin_bypass():
    supplier = SimpleNamespace(created_by_id=10)
    tenant_admin = SimpleNamespace(role="admin", system_role="tenant_admin", id=99)

    with pytest.raises(HTTPException) as exc_info:
        _ensure_supplier_creator_access(
            supplier,
            tenant_admin,
            detail="forbidden",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "forbidden"


def test_private_supplier_creation_requires_tenant_scope_for_tenant_users():
    tenant_admin = SimpleNamespace(
        role="admin", system_role="tenant_admin", tenant_id=None
    )

    with pytest.raises(HTTPException) as exc_info:
        _require_private_supplier_tenant_scope(tenant_admin)

    assert exc_info.value.status_code == 400
    assert "tenant bootstrap" in exc_info.value.detail.lower()


def _seed_tenant(
    db: Session, suffix: str, *, subscription_plan_code: str | None = None
) -> Tenant:
    tenant = Tenant(
        slug=f"supplier-auth-{suffix}",
        legal_name=f"Supplier Auth {suffix}",
        brand_name=f"Auth {suffix}",
        subscription_plan_code=subscription_plan_code,
        status="active",
        onboarding_status="active",
        is_active=True,
    )
    db.add(tenant)
    db.flush()
    return tenant


def _seed_user(
    db: Session,
    suffix: str,
    *,
    role: str,
    system_role: str,
    tenant_id: int | None = None,
) -> User:
    user = User(
        email=f"supplier-auth-{suffix}@test.dev",
        hashed_password=get_password_hash("Test123!"),
        full_name=f"Supplier Auth {suffix}",
        role=role,
        system_role=system_role,
        tenant_id=tenant_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _seed_supplier(
    db: Session, suffix: str, *, created_by_id: int, tenant_id: int | None = None
) -> Supplier:
    supplier = Supplier(
        tenant_id=tenant_id,
        created_by_id=created_by_id,
        company_name=f"Supplier {suffix}",
        phone="+90 555 000 00 00",
        email=f"supplier-auth-{suffix}@test.dev",
        is_active=True,
    )
    db.add(supplier)
    db.flush()
    return supplier


def _seed_project(
    db: Session, suffix: str, *, tenant_id: int, created_by_id: int
) -> Project:
    project = Project(
        name=f"Project {suffix}",
        code=f"SUPPLIER-AUTH-{suffix}"[:50],
        description="supplier auth test project",
        is_active=True,
        project_type="merkez",
        tenant_id=tenant_id,
        created_by_id=created_by_id,
    )
    db.add(project)
    db.flush()
    return project


def _cleanup_scope(db: Session, suffix: str) -> None:
    db.execute(
        user_projects.delete().where(
            user_projects.c.project_id.in_(
                db.query(Project.id).filter(
                    Project.code == f"SUPPLIER-AUTH-{suffix}"[:50]
                )
            )
        )
    )
    db.query(ProjectSupplier).filter(
        ProjectSupplier.project_id.in_(
            db.query(Project.id).filter(Project.code == f"SUPPLIER-AUTH-{suffix}"[:50])
        )
    ).delete(synchronize_session=False)
    db.query(SupplierUser).filter(
        SupplierUser.email.like(f"supplier-auth-{suffix}%@test.dev")
    ).delete(synchronize_session=False)
    db.query(Supplier).filter(
        Supplier.email.like(f"supplier-auth-{suffix}%@test.dev")
    ).delete(synchronize_session=False)
    db.query(Project).filter(Project.code == f"SUPPLIER-AUTH-{suffix}"[:50]).delete(
        synchronize_session=False
    )
    db.query(User).filter(User.email.like(f"supplier-auth-{suffix}%@test.dev")).delete(
        synchronize_session=False
    )
    db.query(Tenant).filter(Tenant.slug.like(f"supplier-auth-{suffix}%")).delete(
        synchronize_session=False
    )
    db.commit()


def test_get_visible_supplier_allows_platform_network_for_tenant_usage():
    db = SessionLocal()
    suffix = "platform-visible"
    try:
        tenant = _seed_tenant(db, suffix)
        tenant_user = _seed_user(
            db,
            f"{suffix}-tenant-user",
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
        supplier = _seed_supplier(
            db,
            suffix,
            created_by_id=platform_creator.id,
            tenant_id=None,
        )
        db.commit()

        row = _get_visible_supplier_or_404(
            db,
            supplier.id,
            tenant_user,
            allow_platform_network_for_tenant=True,
        )

        assert row.id == supplier.id
    finally:
        db.rollback()
        _cleanup_scope(db, suffix)
        db.close()


def test_get_visible_supplier_blocks_cross_tenant_private_supplier_usage():
    db = SessionLocal()
    suffix = "cross-tenant-private"
    try:
        tenant = _seed_tenant(db, suffix)
        other_tenant = _seed_tenant(db, f"{suffix}-other")
        tenant_user = _seed_user(
            db,
            f"{suffix}-tenant-user",
            role="admin",
            system_role="tenant_admin",
            tenant_id=tenant.id,
        )
        other_creator = _seed_user(
            db,
            f"{suffix}-other-creator",
            role="admin",
            system_role="tenant_admin",
            tenant_id=other_tenant.id,
        )
        supplier = _seed_supplier(
            db,
            suffix,
            created_by_id=other_creator.id,
            tenant_id=other_tenant.id,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            _get_visible_supplier_or_404(
                db,
                supplier.id,
                tenant_user,
                allow_platform_network_for_tenant=True,
            )

        assert exc_info.value.status_code == 403
    finally:
        db.rollback()
        _cleanup_scope(db, suffix)
        db.close()


def test_project_member_can_resend_invite_for_visible_platform_supplier(client):
    db = SessionLocal()
    suffix = f"resend-platform-visible-{uuid.uuid4().hex[:8]}"
    try:
        tenant = _seed_tenant(db, suffix)
        project_member = _seed_user(
            db,
            f"{suffix}-member",
            role="satinalma_uzmani",
            system_role="tenant_member",
            tenant_id=tenant.id,
        )
        platform_creator = _seed_user(
            db,
            f"{suffix}-platform-creator",
            role="satinalma_direktoru",
            system_role="super_admin",
        )
        project = _seed_project(
            db,
            suffix,
            tenant_id=tenant.id,
            created_by_id=project_member.id,
        )
        project_member.projects.append(project)

        supplier = _seed_supplier(
            db,
            suffix,
            created_by_id=platform_creator.id,
            tenant_id=None,
        )
        db.add(
            ProjectSupplier(
                project_id=project.id,
                supplier_id=supplier.id,
                assigned_by_id=project_member.id,
                is_active=True,
                invitation_sent=True,
            )
        )
        db.add(
            SupplierUser(
                supplier_id=supplier.id,
                name=supplier.company_name,
                email=supplier.email,
                is_active=True,
                password_set=False,
            )
        )
        db.commit()

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": project_member.email, "password": "Test123!"},
        )
        assert login_response.status_code == 200, login_response.text
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        response = client.post(
            f"/api/v1/suppliers/projects/{project.id}/suppliers/{supplier.id}/resend-invite",
            headers=headers,
        )

        assert response.status_code in (200, 207), response.text
        assert response.json()["status"] in {"success", "partial_success"}
    finally:
        db.close()


def test_project_member_cannot_add_cross_tenant_private_supplier_to_project(client):
    db = SessionLocal()
    suffix = f"project-add-cross-tenant-{uuid.uuid4().hex[:8]}"
    try:
        tenant = _seed_tenant(db, suffix)
        other_tenant = _seed_tenant(db, f"{suffix}-other")
        project_member = _seed_user(
            db,
            f"{suffix}-member",
            role="satinalma_uzmani",
            system_role="tenant_member",
            tenant_id=tenant.id,
        )
        other_creator = _seed_user(
            db,
            f"{suffix}-other-creator",
            role="satinalma_uzmani",
            system_role="tenant_member",
            tenant_id=other_tenant.id,
        )
        project = _seed_project(
            db,
            suffix,
            tenant_id=tenant.id,
            created_by_id=project_member.id,
        )
        project_member.projects.append(project)
        supplier = _seed_supplier(
            db,
            suffix,
            created_by_id=other_creator.id,
            tenant_id=other_tenant.id,
        )
        db.commit()

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": project_member.email, "password": "Test123!"},
        )
        assert login_response.status_code == 200, login_response.text
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        response = client.post(
            f"/api/v1/suppliers/projects/{project.id}/suppliers",
            headers=headers,
            json=[supplier.id],
        )

        assert response.status_code == 403, response.text
        assert "tedarikci" in response.json()["detail"].lower()
    finally:
        db.close()


def test_growth_plan_blocks_supplier_creation_after_private_supplier_limit(client):
    db = SessionLocal()
    suffix = f"supplier-limit-growth-{uuid.uuid4().hex[:8]}"
    try:
        tenant = _seed_tenant(db, suffix, subscription_plan_code="growth")
        creator = _seed_user(
            db,
            f"{suffix}-creator",
            role="admin",
            system_role="tenant_admin",
            tenant_id=tenant.id,
        )
        for index in range(250):
            _seed_supplier(
                db,
                f"{suffix}-{index}",
                created_by_id=creator.id,
                tenant_id=tenant.id,
            )
        db.commit()

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": creator.email, "password": "Test123!"},
        )
        assert login_response.status_code == 200, login_response.text
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        response = client.post(
            "/api/v1/suppliers",
            headers=headers,
            json={
                "company_name": "Blocked Supplier",
                "phone": "+90 555 111 22 33",
                "email": f"{suffix}-blocked@test.dev",
            },
        )

        assert response.status_code == 409, response.text
        assert "aktif tedarikci limiti asildi" in response.json()["detail"].lower()
    finally:
        db.close()


def test_enterprise_plan_allows_supplier_creation_above_growth_limit(client):
    db = SessionLocal()
    suffix = f"supplier-limit-enterprise-{uuid.uuid4().hex[:8]}"
    try:
        tenant = _seed_tenant(db, suffix, subscription_plan_code="enterprise")
        creator = _seed_user(
            db,
            f"{suffix}-creator",
            role="admin",
            system_role="tenant_admin",
            tenant_id=tenant.id,
        )
        for index in range(250):
            _seed_supplier(
                db,
                f"{suffix}-{index}",
                created_by_id=creator.id,
                tenant_id=tenant.id,
            )
        db.commit()

        login_response = client.post(
            "/api/v1/auth/login",
            json={"email": creator.email, "password": "Test123!"},
        )
        assert login_response.status_code == 200, login_response.text
        headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

        response = client.post(
            "/api/v1/suppliers",
            headers=headers,
            json={
                "company_name": "Allowed Supplier",
                "phone": "+90 555 444 55 66",
                "email": f"{suffix}-allowed@test.dev",
            },
        )

        assert response.status_code == 200, response.text
        assert response.json()["company_name"] == "Allowed Supplier"
    finally:
        db.close()
