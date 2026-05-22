from api.database import SessionLocal
from api.models.project import Project
from api.models.tenant import Tenant
from api.models.user import User
from api.core.security import get_password_hash


def _create_tenant(slug: str, *, subscription_plan_code: str | None = None) -> int:
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
        if tenant is None:
            tenant = Tenant(
                slug=slug,
                legal_name=f"{slug} Ltd",
                brand_name=slug,
                subscription_plan_code=subscription_plan_code,
                status="active",
                onboarding_status="active",
                is_active=True,
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        elif subscription_plan_code is not None:
            tenant.subscription_plan_code = subscription_plan_code
            db.commit()
            db.refresh(tenant)
        return tenant.id
    finally:
        db.close()


def _upsert_user(
    email: str, password: str, *, role: str, system_role: str, tenant_id: int | None
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
            user.is_active = True
            user.hidden_from_admin = False
            db.commit()
            db.refresh(user)
        return user.id
    finally:
        db.close()


def _upsert_project(
    code: str,
    *,
    tenant_id: int,
    created_by_id: int,
    member_ids: list[int] | None = None,
) -> int:
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.code == code).first()
        if project is None:
            project = Project(
                name=f"Project {code}",
                code=code,
                description="workspace authz test project",
                is_active=True,
                project_type="merkez",
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(project)
            db.flush()
        else:
            project.tenant_id = tenant_id
            project.created_by_id = created_by_id
            project.is_active = True
            project.personnel.clear()
            db.flush()

        if member_ids:
            members = db.query(User).filter(User.id.in_(member_ids)).all()
            for member in members:
                if member not in project.personnel:
                    project.personnel.append(member)

        db.commit()
        db.refresh(project)
        return project.id
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_platform_support_can_list_project_catalog_read_only(client):
    own_tenant_id = _create_tenant("project-catalog-support-own")
    other_tenant_id = _create_tenant("project-catalog-support-other")
    owner_id = _upsert_user(
        "project-catalog-support-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    _upsert_project(
        "SUPPORT-OWN-PROJECT", tenant_id=own_tenant_id, created_by_id=owner_id
    )
    _upsert_project(
        "SUPPORT-OTHER-PROJECT", tenant_id=other_tenant_id, created_by_id=owner_id
    )
    _upsert_user(
        "project-catalog-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
        tenant_id=own_tenant_id,
    )
    token = _login(client, "project-catalog-support@procureflow.dev", "Support123!")

    response = client.get(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    codes = {item["code"] for item in response.json()}
    assert "SUPPORT-OWN-PROJECT" in codes
    assert "SUPPORT-OTHER-PROJECT" in codes


def test_procurement_member_lists_only_assigned_projects(client):
    tenant_id = _create_tenant("project-catalog-procurement-own")
    owner_id = _upsert_user(
        "project-catalog-procurement-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    procurement_id = _upsert_user(
        "project-catalog-procurement@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    _upsert_project(
        "PROC-ASSIGNED-PROJECT",
        tenant_id=tenant_id,
        created_by_id=owner_id,
        member_ids=[procurement_id],
    )
    _upsert_project(
        "PROC-HIDDEN-PROJECT",
        tenant_id=tenant_id,
        created_by_id=owner_id,
        member_ids=[],
    )
    token = _login(client, "project-catalog-procurement@procureflow.dev", "Buyer123!")

    response = client.get(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    codes = {item["code"] for item in response.json()}
    assert "PROC-ASSIGNED-PROJECT" in codes
    assert "PROC-HIDDEN-PROJECT" not in codes


def test_generic_tenant_member_cannot_list_project_catalog(client, user_auth_headers):
    response = client.get(
        "/api/v1/admin/projects",
        headers=user_auth_headers,
    )

    assert response.status_code == 403, response.text
    assert "proje yuzeyi" in response.json()["detail"].lower()


def test_platform_support_cannot_create_update_or_delete_projects(client):
    tenant_id = _create_tenant("project-write-platform-support")
    owner_id = _upsert_user(
        "project-write-platform-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    project_id = _upsert_project(
        "PLATFORM-RO-PROJECT",
        tenant_id=tenant_id,
        created_by_id=owner_id,
    )
    _upsert_user(
        "project-write-platform-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
        tenant_id=tenant_id,
    )
    token = _login(
        client, "project-write-platform-support@procureflow.dev", "Support123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/v1/admin/projects",
        headers=headers,
        json={
            "name": "Platform Support Project",
            "code": "PLATFORM-SUPPORT-CREATE",
            "project_type": "merkez",
        },
    )
    assert create_response.status_code == 403, create_response.text
    assert "proje oluşturma yetkiniz yok" in create_response.json()["detail"].lower()

    update_response = client.put(
        f"/api/v1/admin/projects/{project_id}",
        headers=headers,
        json={"name": "Updated By Support"},
    )
    assert update_response.status_code == 403, update_response.text
    assert "projeyi güncelleme yetkiniz yok" in update_response.json()["detail"].lower()

    delete_response = client.delete(
        f"/api/v1/admin/projects/{project_id}",
        headers=headers,
    )
    assert delete_response.status_code == 403, delete_response.text
    assert "projeyi silme yetkiniz yok" in delete_response.json()["detail"].lower()


def test_procurement_specialist_can_create_update_and_delete_assigned_project(client):
    tenant_id = _create_tenant("project-write-procurement-own")
    owner_id = _upsert_user(
        "project-write-procurement-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    specialist_id = _upsert_user(
        "project-write-procurement@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    assigned_project_id = _upsert_project(
        "PROC-WRITE-ASSIGNED",
        tenant_id=tenant_id,
        created_by_id=owner_id,
        member_ids=[specialist_id],
    )
    token = _login(client, "project-write-procurement@procureflow.dev", "Buyer123!")
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/v1/admin/projects",
        headers=headers,
        json={
            "name": "Procurement Created Project",
            "code": "PROC-SPECIALIST-CREATE",
            "project_type": "merkez",
        },
    )
    assert create_response.status_code == 200, create_response.text
    created_project_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/v1/admin/projects/{assigned_project_id}",
        headers=headers,
        json={"name": "Updated By Specialist"},
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["name"] == "Updated By Specialist"

    delete_response = client.delete(
        f"/api/v1/admin/projects/{created_project_id}",
        headers=headers,
    )
    assert delete_response.status_code == 200, delete_response.text


def test_starter_plan_blocks_project_creation_after_active_project_limit(client):
    tenant_id = _create_tenant(
        "project-limit-starter-own",
        subscription_plan_code="starter",
    )
    owner_id = _upsert_user(
        "project-limit-starter-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    specialist_id = _upsert_user(
        "project-limit-starter@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    for index in range(5):
        _upsert_project(
            f"STARTER-LIMIT-{index}",
            tenant_id=tenant_id,
            created_by_id=owner_id,
            member_ids=[specialist_id],
        )

    token = _login(client, "project-limit-starter@procureflow.dev", "Buyer123!")
    response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Starter Limited Project",
            "code": "STARTER-LIMIT-BLOCKED",
            "project_type": "merkez",
        },
    )

    assert response.status_code == 409, response.text
    assert "aktif proje limiti asildi" in response.json()["detail"].lower()


def test_growth_plan_allows_project_creation_above_starter_limit(client):
    tenant_id = _create_tenant(
        "project-limit-growth-own",
        subscription_plan_code="growth",
    )
    owner_id = _upsert_user(
        "project-limit-growth-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    specialist_id = _upsert_user(
        "project-limit-growth@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    for index in range(5):
        _upsert_project(
            f"GROWTH-LIMIT-{index}",
            tenant_id=tenant_id,
            created_by_id=owner_id,
            member_ids=[specialist_id],
        )

    token = _login(client, "project-limit-growth@procureflow.dev", "Buyer123!")
    response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Growth Extra Project",
            "code": "GROWTH-LIMIT-ALLOWED",
            "project_type": "merkez",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["code"] == "GROWTH-LIMIT-ALLOWED"


def test_tenant_admin_without_tenant_scope_cannot_create_project(client):
    _upsert_user(
        "project-missing-tenant@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=None,
    )
    token = _login(client, "project-missing-tenant@procureflow.dev", "Owner123!")

    response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Tenantless Project",
            "code": "TENANTLESS-PROJECT",
            "project_type": "merkez",
        },
    )

    assert response.status_code == 400, response.text
    assert "tenant bootstrap" in response.json()["detail"].lower()
