# tests\test_auth.py
from types import SimpleNamespace

from api.core.authz import (
    can_access_admin_surface,
    can_access_procurement_settings,
    can_create_project,
    can_view_all_projects,
    is_admin_managed_account,
    is_global_procurement_manager,
    is_reserved_workspace_role,
    resolve_requested_user_system_role,
)
from api.database import SessionLocal
from api.models.tenant import Tenant
from api.models.user import User
from api.core.security import get_password_hash


def test_login_success(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@procureflow.dev", "password": "Admin123!"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert isinstance(body["access_token"], str) and len(body["access_token"]) > 10
    assert "user" in body
    assert body["user"]["role"] == body["user"]["business_role"]
    assert body["user"]["system_role"] == "tenant_admin"


def test_login_fail(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@procureflow.dev", "password": "wrong-password"},
    )
    # Projende 400/401 olabilir; ikisini de kabul edelim
    assert r.status_code in (400, 401)


def test_me_requires_token(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)


def test_me_with_token(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert data["role"] == data["business_role"]
    assert data["system_role"] == "tenant_admin"
    assert data["workspace_label"]


def test_tenant_owner_workspace_label(client):
    db = SessionLocal()
    try:
        tenant = Tenant(
            slug="owner-workspace-test",
            legal_name="Owner Workspace Test Ltd",
            brand_name="Owner Workspace",
            status="active",
            onboarding_status="active",
            is_active=True,
        )
        db.add(tenant)
        db.flush()

        owner = User(
            email="owner@procureflow.dev",
            hashed_password=get_password_hash("Owner123!"),
            full_name="Tenant Owner",
            role="admin",
            system_role="tenant_owner",
            tenant_id=tenant.id,
            is_active=True,
        )
        db.add(owner)
        db.flush()

        tenant.owner_user_id = owner.id
        db.commit()
    finally:
        db.close()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@procureflow.dev", "password": "Owner123!"},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["user"]["system_role"] == "tenant_owner"
    assert body["user"]["workspace_label"] == "Owner Workspace Owner Yonetim Alani"


def test_global_procurement_manager_covers_tenant_owner_and_admin_compat_role():
    tenant_owner = SimpleNamespace(role="admin", system_role="tenant_owner")
    legacy_admin = SimpleNamespace(role="admin", system_role="")

    assert is_global_procurement_manager(tenant_owner) is True
    assert is_global_procurement_manager(legacy_admin) is True


def test_project_authz_helpers_preserve_procurement_role_boundaries():
    procurement_manager = SimpleNamespace(role="satinalma_direktoru", system_role="")
    procurement_specialist = SimpleNamespace(role="satinalma_uzmani", system_role="")
    buyer = SimpleNamespace(role="satinalmaci", system_role="")

    assert can_view_all_projects(procurement_manager) is True
    assert can_create_project(procurement_manager) is True
    assert can_create_project(procurement_specialist) is True
    assert can_view_all_projects(procurement_specialist) is False
    assert can_create_project(buyer) is False


def test_user_system_role_resolution_keeps_admin_compatibility_rules():
    super_admin = SimpleNamespace(role="super_admin", system_role="super_admin")
    tenant_admin = SimpleNamespace(role="admin", system_role="tenant_admin")

    assert (
        resolve_requested_user_system_role(super_admin, "admin", "platform_support")
        == "platform_support"
    )
    assert (
        resolve_requested_user_system_role(super_admin, "admin", "") == "tenant_admin"
    )
    assert (
        resolve_requested_user_system_role(tenant_admin, "admin", "tenant_owner")
        == "tenant_member"
    )
    assert (
        resolve_requested_user_system_role(super_admin, "super_admin", "tenant_owner")
        == "super_admin"
    )
    assert is_reserved_workspace_role("admin") is True
    assert is_reserved_workspace_role("satinalma_uzmani") is False


def test_admin_managed_account_helper_covers_legacy_and_system_roles():
    tenant_owner = SimpleNamespace(role="admin", system_role="tenant_owner")
    legacy_super_admin = SimpleNamespace(role="super_admin", system_role="")
    regular_member = SimpleNamespace(role="satinalmaci", system_role="tenant_member")

    assert is_admin_managed_account(tenant_owner) is True
    assert is_admin_managed_account(legacy_super_admin) is True
    assert is_admin_managed_account(regular_member) is False


def test_admin_surface_helper_excludes_platform_staff_but_keeps_owner_and_admin():
    tenant_owner = SimpleNamespace(role="admin", system_role="tenant_owner")
    tenant_admin = SimpleNamespace(role="admin", system_role="tenant_admin")
    platform_support = SimpleNamespace(role="user", system_role="platform_support")

    assert can_access_admin_surface(tenant_owner) is True
    assert can_access_admin_surface(tenant_admin) is True
    assert can_access_admin_surface(platform_support) is False


def test_procurement_settings_helper_covers_system_roles_and_procurement_staff():
    tenant_owner = SimpleNamespace(role="admin", system_role="tenant_owner")
    platform_support = SimpleNamespace(role="user", system_role="platform_support")
    procurement_specialist = SimpleNamespace(
        role="satinalma_uzmani", system_role="tenant_member"
    )
    regular_member = SimpleNamespace(role="user", system_role="tenant_member")

    assert can_access_procurement_settings(tenant_owner) is True
    assert can_access_procurement_settings(platform_support) is True
    assert can_access_procurement_settings(procurement_specialist) is True
    assert can_access_procurement_settings(regular_member) is False
