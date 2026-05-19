from api.database import SessionLocal
from api.models.tenant import Tenant
from api.models.user import User
from api.core.security import get_password_hash


def _create_tenant(slug: str) -> int:
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
        if tenant is None:
            tenant = Tenant(
                slug=slug,
                legal_name=f"{slug} Ltd",
                brand_name=slug,
                status="active",
                onboarding_status="active",
                is_active=True,
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        return tenant.id
    finally:
        db.close()


def _upsert_user(
    email: str, password: str, *, role: str, system_role: str, tenant_id: int | None
) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=email.split("@")[0],
                role=role,
                system_role=system_role,
                tenant_id=tenant_id,
                is_active=True,
                hidden_from_admin=False,
            )
            db.add(user)
        else:
            user.hashed_password = get_password_hash(password)
            user.role = role
            user.system_role = system_role
            user.tenant_id = tenant_id
            user.is_active = True
            user.hidden_from_admin = False
        db.commit()
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_platform_support_can_read_admin_catalogs_in_read_only_mode(client):
    tenant_id = _create_tenant("platform-support-readonly-catalog")
    _upsert_user(
        "platform-support-readonly@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
        tenant_id=tenant_id,
    )
    token = _login(client, "platform-support-readonly@procureflow.dev", "Support123!")
    headers = {"Authorization": f"Bearer {token}"}

    companies_response = client.get("/api/v1/admin/companies", headers=headers)
    roles_response = client.get("/api/v1/admin/roles", headers=headers)
    permissions_response = client.get("/api/v1/admin/permissions", headers=headers)
    users_response = client.get("/api/v1/admin/users", headers=headers)
    departments_response = client.get("/api/v1/admin/departments", headers=headers)

    assert companies_response.status_code == 200, companies_response.text
    assert roles_response.status_code == 200, roles_response.text
    assert permissions_response.status_code == 200, permissions_response.text
    assert users_response.status_code == 200, users_response.text
    assert departments_response.status_code == 200, departments_response.text
