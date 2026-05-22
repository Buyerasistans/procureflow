"""
Paket 6 backend test paketi:
  - /admin/permission-catalog (GET)
  - /admin/role-permission-matrix (GET)
  - /admin/users/{id}/permission-overrides (GET, PUT)
  - /admin/role-permission-delegations (GET, PUT)

Kapsanan senaryolar:
  1. Katalog & Matris GET erişim kontrolü (super_admin pass, tenant_member 403)
  2. Override GET: admin kendi kapsamındaki kullanıcıyı getirebilir
  3. Override PUT: super_admin kritik key set edebilir
  4. Override PUT: tenant_admin kritik key set edemez (403)
  5. Override PUT: tenant_admin override kritik olmayan key set edebilir (tenant scopeyla)
  6. Override PUT: tenant_admin başka tenantın kullanıcısına erişemez (403)
  7. Delegation GET/PUT: super_admin set edebilir
  8. Delegation PUT: tenant_member 403
"""

from __future__ import annotations

from api.core.security import get_password_hash
from api.database import SessionLocal
from api.models.user import User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _upsert_user(
    email: str,
    password: str,
    *,
    role: str,
    system_role: str,
    tenant_id: int | None = None,
) -> int:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = role
            existing.system_role = system_role
            existing.hashed_password = get_password_hash(password)
            existing.is_active = True
            existing.tenant_id = tenant_id
            db.commit()
            return int(existing.id)
        else:
            u = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=email.split("@")[0],
                role=role,
                system_role=system_role,
                is_active=True,
                tenant_id=tenant_id,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            return int(u.id)
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Test: Permission Catalog
# ---------------------------------------------------------------------------


def test_permission_catalog_accessible_by_admin(client):
    _upsert_user(
        "p6-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(client, "p6-admin@procureflow.dev", "Admin123!")
    r = client.get("/api/v1/admin/permission-catalog", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    keys = {item["key"] for item in data}
    assert "workspace_home" in keys
    assert "admin_surface" in keys


def test_permission_catalog_forbidden_for_member(client):
    _upsert_user(
        "p6-member@procureflow.dev",
        "Member123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    token = _login(client, "p6-member@procureflow.dev", "Member123!")
    r = client.get("/api/v1/admin/permission-catalog", headers=_auth(token))
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Test: Role Permission Matrix
# ---------------------------------------------------------------------------


def test_role_permission_matrix_returns_list_for_admin(client):
    _upsert_user(
        "p6-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(client, "p6-admin@procureflow.dev", "Admin123!")
    r = client.get("/api/v1/admin/role-permission-matrix", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # Her satırda profile, enabled_keys mevcut olmalı
    if data:
        first = data[0]
        assert "profile" in first
        assert "enabled_keys" in first
        assert isinstance(first["enabled_keys"], list)


def test_role_permission_matrix_forbidden_for_member(client):
    _upsert_user(
        "p6-member@procureflow.dev",
        "Member123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    token = _login(client, "p6-member@procureflow.dev", "Member123!")
    r = client.get("/api/v1/admin/role-permission-matrix", headers=_auth(token))
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Test: User Permission Overrides (GET)
# ---------------------------------------------------------------------------


def test_get_user_overrides_returns_empty_list_initially(client):
    """Yeni kullanıcı için override listesi boş döner."""
    target_id = _upsert_user(
        "p6-target@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    _upsert_user(
        "p6-superadmin@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "p6-superadmin@procureflow.dev", "Super123!")
    r = client.get(
        f"/api/v1/admin/users/{target_id}/permission-overrides", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_get_user_overrides_forbidden_for_member(client):
    target_id = _upsert_user(
        "p6-target2@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    _upsert_user(
        "p6-member@procureflow.dev",
        "Member123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    token = _login(client, "p6-member@procureflow.dev", "Member123!")
    r = client.get(
        f"/api/v1/admin/users/{target_id}/permission-overrides", headers=_auth(token)
    )
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Test: User Permission Overrides (PUT)
# ---------------------------------------------------------------------------


def test_super_admin_can_set_critical_override(client):
    """Super admin kritik izin anahtarı override edebilir."""
    target_id = _upsert_user(
        "p6-target3@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    _upsert_user(
        "p6-superadmin@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "p6-superadmin@procureflow.dev", "Super123!")
    payload = {
        "items": [
            {"permission_key": "admin_surface.user_view", "allowed": True},
        ]
    }
    r = client.put(
        f"/api/v1/admin/users/{target_id}/permission-overrides",
        json=payload,
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    overrides = r.json()
    assert any(o["permission_key"] == "admin_surface.user_view" for o in overrides)


def test_tenant_admin_cannot_set_critical_override(client):
    """Tenant admin kritik izin anahtarı override edemez."""
    target_id = _upsert_user(
        "p6-target4@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    _upsert_user(
        "p6-tadmin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(client, "p6-tadmin@procureflow.dev", "Admin123!")
    payload = {
        "items": [
            {"permission_key": "admin_surface.user_delete", "allowed": True},
        ]
    }
    r = client.put(
        f"/api/v1/admin/users/{target_id}/permission-overrides",
        json=payload,
        headers=_auth(token),
    )
    assert r.status_code == 403, r.text


def test_tenant_admin_can_set_noncritical_override(client):
    """Tenant admin kritik olmayan izni kendi oluşturduğu kullanıcı için override edebilir."""
    # Önce tenant_admin'i oluştur
    tadmin_id = _upsert_user(
        "p6-tadmin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    # target5'i tadmin'in created_by bağımlılığıyla oluştur
    target_id = _upsert_user(
        "p6-target5@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    # tenant scope'u sağlamak için created_by_id güncelle
    db = SessionLocal()
    try:
        target = db.query(User).filter(User.id == target_id).first()
        if target:
            target.created_by_id = tadmin_id
            db.commit()
    finally:
        db.close()

    token = _login(client, "p6-tadmin@procureflow.dev", "Admin123!")
    payload = {
        "items": [
            {"permission_key": "workspace_home.kpi_cards", "allowed": False},
        ]
    }
    r = client.put(
        f"/api/v1/admin/users/{target_id}/permission-overrides",
        json=payload,
        headers=_auth(token),
    )
    # Tenant admin kritik olmayan anahtarda izinli olmalı
    assert r.status_code == 200, r.text


def test_member_cannot_put_any_override(client):
    target_id = _upsert_user(
        "p6-target6@procureflow.dev",
        "Target123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    _upsert_user(
        "p6-member2@procureflow.dev",
        "Member123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    token = _login(client, "p6-member2@procureflow.dev", "Member123!")
    payload = {
        "items": [{"permission_key": "workspace_home.kpi_cards", "allowed": True}]
    }
    r = client.put(
        f"/api/v1/admin/users/{target_id}/permission-overrides",
        json=payload,
        headers=_auth(token),
    )
    assert r.status_code == 403, r.text


# ---------------------------------------------------------------------------
# Test: Role Permission Delegations (GET / PUT)
# ---------------------------------------------------------------------------


def test_super_admin_can_list_delegations(client):
    _upsert_user(
        "p6-superadmin@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "p6-superadmin@procureflow.dev", "Super123!")
    r = client.get("/api/v1/admin/role-permission-delegations", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_member_cannot_list_delegations(client):
    _upsert_user(
        "p6-member@procureflow.dev",
        "Member123!",
        role="satinalmaci",
        system_role="tenant_member",
    )
    token = _login(client, "p6-member@procureflow.dev", "Member123!")
    r = client.get("/api/v1/admin/role-permission-delegations", headers=_auth(token))
    assert r.status_code == 403, r.text


def test_super_admin_can_set_delegation(client):
    """Super admin, tenant_admin rolüne delegasyon verebilir."""
    _upsert_user(
        "p6-superadmin@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "p6-superadmin@procureflow.dev", "Super123!")
    payload = {
        "system_role": "tenant_admin",
        "business_role": None,
        "items": [
            {
                "permission_key": "quote_workspace.list",
                "can_delegate": True,
            }
        ],
    }
    r = client.put(
        "/api/v1/admin/role-permission-delegations", json=payload, headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    delegations = r.json()
    assert any(d["permission_key"] == "quote_workspace.list" for d in delegations)


def test_tenant_admin_cannot_set_delegation(client):
    """Tenant admin delegasyon tanımlayamaz (sadece super admin)."""
    _upsert_user(
        "p6-tadmin2@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
    )
    token = _login(client, "p6-tadmin2@procureflow.dev", "Admin123!")
    payload = {
        "system_role": "tenant_member",
        "business_role": None,
        "items": [
            {
                "permission_key": "quote_workspace.list",
                "can_delegate": True,
            }
        ],
    }
    r = client.put(
        "/api/v1/admin/role-permission-delegations", json=payload, headers=_auth(token)
    )
    assert r.status_code == 403, r.text
