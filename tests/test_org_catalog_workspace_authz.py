from api.database import SessionLocal
from api.models.department import Department
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


def _upsert_department(name: str, *, tenant_id: int) -> int:
    db = SessionLocal()
    try:
        department = (
            db.query(Department)
            .filter(Department.name == name, Department.tenant_id == tenant_id)
            .first()
        )
        if department is None:
            department = Department(
                name=name,
                description=f"{name} description",
                is_active=True,
                tenant_id=tenant_id,
            )
            db.add(department)
            db.commit()
            db.refresh(department)
        return department.id
    finally:
        db.close()


def _upsert_user(
    email: str,
    password: str,
    *,
    role: str,
    system_role: str,
    tenant_id: int,
    department_id: int | None = None,
) -> int:
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
                department_id=department_id,
                is_active=True,
                hidden_from_admin=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.hashed_password = get_password_hash(password)
            user.role = role
            user.system_role = system_role
            user.tenant_id = tenant_id
            user.department_id = department_id
            user.is_active = True
            user.hidden_from_admin = False
            db.commit()
            db.refresh(user)
        return user.id
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_tenant_member_without_procurement_role_cannot_list_org_catalogs(client):
    response = client.get(
        "/api/v1/admin/users",
        headers={
            "Authorization": _bearer(_login(client, "user@procureflow.dev", "User123!"))
        },
    )

    assert response.status_code == 403, response.text
    assert "katalog" in response.json()["detail"].lower()

    departments_response = client.get(
        "/api/v1/admin/departments",
        headers={
            "Authorization": _bearer(_login(client, "user@procureflow.dev", "User123!"))
        },
    )

    assert departments_response.status_code == 403, departments_response.text
    assert "katalog" in departments_response.json()["detail"].lower()


def test_procurement_user_can_list_only_own_tenant_org_catalogs(client):
    own_tenant_id = _create_tenant("org-catalog-own")
    other_tenant_id = _create_tenant("org-catalog-other")

    own_department_id = _upsert_department(
        "Org Catalog Own Department", tenant_id=own_tenant_id
    )
    _upsert_department("Org Catalog Other Department", tenant_id=other_tenant_id)

    _upsert_user(
        "org-catalog-procurement@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
        department_id=own_department_id,
    )
    _upsert_user(
        "org-catalog-own-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
        department_id=own_department_id,
    )
    _upsert_user(
        "org-catalog-other-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )

    token = _login(client, "org-catalog-procurement@procureflow.dev", "Buyer123!")
    headers = {"Authorization": _bearer(token)}

    users_response = client.get("/api/v1/admin/users", headers=headers)
    assert users_response.status_code == 200, users_response.text
    user_emails = {item["email"] for item in users_response.json()}
    assert "org-catalog-procurement@procureflow.dev" in user_emails
    assert "org-catalog-own-member@procureflow.dev" in user_emails
    assert "org-catalog-other-member@procureflow.dev" not in user_emails

    departments_response = client.get("/api/v1/admin/departments", headers=headers)
    assert departments_response.status_code == 200, departments_response.text
    department_names = {item["name"] for item in departments_response.json()}
    assert "Org Catalog Own Department" in department_names
    assert "Org Catalog Other Department" not in department_names


def _bearer(token: str) -> str:
    return f"Bearer {token}"
