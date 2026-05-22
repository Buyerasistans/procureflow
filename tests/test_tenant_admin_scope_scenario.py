import io

from api.main import app
from api.database import SessionLocal
from api.models.assignment import CompanyRole
from api.models.department import Department
from api.models.company import Company
from api.models.project import Project
from api.models.project_file import ProjectFile
from api.models.role import Permission, Role
from api.models.tenant import Tenant
from api.models.user import User
from api.core.security import get_password_hash
from api.services.email_service import get_email_service


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
    email: str, password: str, *, role: str, system_role: str, tenant_id: int
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


def _upsert_company(name: str, *, tenant_id: int, created_by_id: int) -> int:
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name == name).first()
        if company is None:
            company = Company(
                name=name,
                color="#3b82f6",
                is_active=True,
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        else:
            company.tenant_id = tenant_id
            company.created_by_id = created_by_id
            company.is_active = True
            db.commit()
            db.refresh(company)
        return company.id
    finally:
        db.close()


def _upsert_role(name: str, *, tenant_id: int, created_by_id: int) -> int:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == name).first()
        if role is None:
            role = Role(
                name=name,
                description=f"{name} description",
                is_active=True,
                hierarchy_level=0,
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(role)
            db.commit()
            db.refresh(role)
        else:
            role.tenant_id = tenant_id
            role.created_by_id = created_by_id
            role.is_active = True
            db.commit()
            db.refresh(role)
        return role.id
    finally:
        db.close()


def _upsert_department(name: str, *, tenant_id: int, created_by_id: int) -> int:
    db = SessionLocal()
    try:
        department = db.query(Department).filter(Department.name == name).first()
        if department is None:
            department = Department(
                name=name,
                description=f"{name} description",
                is_active=True,
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(department)
            db.commit()
            db.refresh(department)
        else:
            department.tenant_id = tenant_id
            department.created_by_id = created_by_id
            department.description = f"{name} description"
            department.is_active = True
            db.commit()
            db.refresh(department)
        return department.id
    finally:
        db.close()


def _upsert_company_assignment(
    *,
    user_id: int,
    company_id: int,
    role_id: int,
    department_id: int | None,
    tenant_id: int,
) -> int:
    db = SessionLocal()
    try:
        assignment = (
            db.query(CompanyRole)
            .filter(
                CompanyRole.user_id == user_id,
                CompanyRole.company_id == company_id,
                CompanyRole.role_id == role_id,
            )
            .first()
        )
        if assignment is None:
            assignment = CompanyRole(
                user_id=user_id,
                company_id=company_id,
                role_id=role_id,
                department_id=department_id,
                tenant_id=tenant_id,
                sub_items_json="[]",
                is_active=True,
            )
            db.add(assignment)
            db.commit()
            db.refresh(assignment)
        else:
            assignment.department_id = department_id
            assignment.tenant_id = tenant_id
            assignment.is_active = True
            db.commit()
            db.refresh(assignment)
        return assignment.id
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
        project = (
            db.query(Project)
            .filter(Project.code == code, Project.tenant_id == tenant_id)
            .first()
        )
        if project is None:
            project = Project(
                name=f"Project {code}",
                code=code,
                description="tenant scope test project",
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


def _upsert_project_file(project_id: int, *, uploaded_by: int) -> int:
    db = SessionLocal()
    try:
        project_file = (
            db.query(ProjectFile)
            .filter(
                ProjectFile.project_id == project_id,
                ProjectFile.original_filename == "tenant-scope-file.txt",
            )
            .first()
        )
        if project_file is None:
            project_file = ProjectFile(
                project_id=project_id,
                filename="tenant-scope-file.txt",
                original_filename="tenant-scope-file.txt",
                file_type="text/plain",
                file_size=16,
                file_path="uploads/test/tenant-scope-file.txt",
                uploaded_by=uploaded_by,
            )
            db.add(project_file)
            db.commit()
            db.refresh(project_file)
        else:
            project_file.uploaded_by = uploaded_by
            db.commit()
            db.refresh(project_file)
        return project_file.id
    finally:
        db.close()


def _grant_reset_password_permission(*, user_id: int, tenant_id: int) -> None:
    db = SessionLocal()
    try:
        role = (
            db.query(Role)
            .filter(
                Role.name == "tenant_scope_reset_password_role",
                Role.tenant_id == tenant_id,
            )
            .first()
        )
        if role is None:
            role = Role(
                name="tenant_scope_reset_password_role",
                description="Reset password permission role",
                is_active=True,
                hierarchy_level=0,
                tenant_id=tenant_id,
                created_by_id=user_id,
            )
            db.add(role)
            db.flush()

        permission = (
            db.query(Permission)
            .filter(Permission.name == "users.reset_password")
            .first()
        )
        if permission is None:
            permission = Permission(
                name="users.reset_password",
                description="Allows admin password reset",
            )
            db.add(permission)
            db.flush()

        if all(existing.id != permission.id for existing in role.permissions):
            role.permissions.append(permission)

        company = (
            db.query(Company)
            .filter(
                Company.name == "tenant-scope-reset-company",
                Company.tenant_id == tenant_id,
            )
            .first()
        )
        if company is None:
            company = Company(
                name="tenant-scope-reset-company",
                color="#0f766e",
                is_active=True,
                tenant_id=tenant_id,
                created_by_id=user_id,
            )
            db.add(company)
            db.flush()

        assignment = (
            db.query(CompanyRole)
            .filter(
                CompanyRole.user_id == user_id,
                CompanyRole.company_id == company.id,
                CompanyRole.role_id == role.id,
            )
            .first()
        )
        if assignment is None:
            db.add(
                CompanyRole(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    company_id=company.id,
                    role_id=role.id,
                    is_active=True,
                    sub_items_json="[]",
                )
            )

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


def test_tenant_admin_lists_only_own_tenant_catalogs_and_users(client):
    own_tenant_id = _create_tenant("tenant-scope-own")
    other_tenant_id = _create_tenant("tenant-scope-other")

    own_admin_id = _upsert_user(
        "tenant-scope-own-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    _upsert_user(
        "tenant-scope-own-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    _upsert_user(
        "tenant-scope-other-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )

    own_company_name = "Tenant Scope Own Company"
    other_company_name = "Tenant Scope Other Company"
    own_role_name = "tenant_scope_own_role"
    other_role_name = "tenant_scope_other_role"
    own_project_code = "TENANT-SCOPE-LIST-OWN-PROJECT"
    other_project_code = "TENANT-SCOPE-LIST-OTHER-PROJECT"

    _upsert_company(
        own_company_name, tenant_id=own_tenant_id, created_by_id=own_admin_id
    )
    _upsert_company(
        other_company_name, tenant_id=other_tenant_id, created_by_id=own_admin_id
    )
    _upsert_role(own_role_name, tenant_id=own_tenant_id, created_by_id=own_admin_id)
    _upsert_role(other_role_name, tenant_id=other_tenant_id, created_by_id=own_admin_id)
    _upsert_project(
        own_project_code,
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_admin_id],
    )
    _upsert_project(
        other_project_code,
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_admin_id],
    )

    token = _login(client, "tenant-scope-own-admin@procureflow.dev", "Admin123!")
    headers = {"Authorization": f"Bearer {token}"}

    companies_response = client.get("/api/v1/admin/companies", headers=headers)
    assert companies_response.status_code == 200, companies_response.text
    company_names = {item["name"] for item in companies_response.json()}
    assert own_company_name in company_names
    assert other_company_name not in company_names

    roles_response = client.get("/api/v1/admin/roles", headers=headers)
    assert roles_response.status_code == 200, roles_response.text
    role_names = {item["name"] for item in roles_response.json()}
    assert own_role_name in role_names
    assert other_role_name not in role_names

    users_response = client.get("/api/v1/admin/users", headers=headers)
    assert users_response.status_code == 200, users_response.text
    user_emails = {item["email"] for item in users_response.json()}
    assert "tenant-scope-own-member@procureflow.dev" in user_emails
    assert "tenant-scope-other-member@procureflow.dev" not in user_emails

    projects_response = client.get("/api/v1/admin/projects", headers=headers)
    assert projects_response.status_code == 200, projects_response.text
    project_codes = {item["code"] for item in projects_response.json()}
    assert own_project_code in project_codes
    assert other_project_code not in project_codes


def test_tenant_admin_cannot_update_other_tenant_company(client):
    own_tenant_id = _create_tenant("tenant-scope-update-own")
    other_tenant_id = _create_tenant("tenant-scope-update-other")

    own_admin_id = _upsert_user(
        "tenant-scope-update-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Forbidden Update Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(client, "tenant-scope-update-admin@procureflow.dev", "Admin123!")
    response = client.put(
        f"/api/v1/admin/companies/{other_company_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"description": "forbidden update"},
    )

    assert response.status_code == 403, response.text
    assert "firma" in response.json()["detail"].lower()


def test_tenant_admin_cannot_delete_other_tenant_company(client):
    own_tenant_id = _create_tenant("tenant-scope-company-delete-own")
    other_tenant_id = _create_tenant("tenant-scope-company-delete-other")

    own_admin_id = _upsert_user(
        "tenant-scope-company-delete-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Forbidden Delete Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-company-delete-admin@procureflow.dev", "Admin123!"
    )
    response = client.delete(
        f"/api/v1/admin/companies/{other_company_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "firma" in response.json()["detail"].lower()


def test_tenant_admin_cannot_upload_logo_to_other_tenant_company(client):
    own_tenant_id = _create_tenant("tenant-scope-company-logo-own")
    other_tenant_id = _create_tenant("tenant-scope-company-logo-other")

    own_admin_id = _upsert_user(
        "tenant-scope-company-logo-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Forbidden Logo Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-company-logo-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        f"/api/v1/admin/companies/{other_company_id}/logo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("logo.png", io.BytesIO(b"fake-png-content"), "image/png")},
    )

    assert response.status_code == 403, response.text
    assert "firma" in response.json()["detail"].lower()


def test_tenant_admin_lists_only_own_tenant_departments(client):
    own_tenant_id = _create_tenant("tenant-scope-dept-own")
    other_tenant_id = _create_tenant("tenant-scope-dept-other")

    own_admin_id = _upsert_user(
        "tenant-scope-dept-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )

    own_department_name = "Tenant Scope Own Department"
    other_department_name = "Tenant Scope Other Department"
    _upsert_department(
        own_department_name,
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_admin_id = _upsert_user(
        "tenant-scope-dept-other-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=other_tenant_id,
    )
    _upsert_department(
        other_department_name,
        tenant_id=other_tenant_id,
        created_by_id=other_admin_id,
    )

    token = _login(client, "tenant-scope-dept-admin@procureflow.dev", "Admin123!")
    response = client.get(
        "/api/v1/admin/departments",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    department_names = {item["name"] for item in response.json()}
    assert own_department_name in department_names
    assert other_department_name not in department_names


def test_tenant_admin_cannot_assign_user_to_other_tenant_company(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_member_id = _upsert_user(
        "tenant-scope-assignment-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )

    own_role_id = _upsert_role(
        "tenant_scope_assignment_own_role",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Assignment Other Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(client, "tenant-scope-assignment-admin@procureflow.dev", "Admin123!")
    response = client.post(
        f"/api/v1/admin/users/{own_member_id}/company-assignments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "company_id": other_company_id,
            "role_id": own_role_id,
            "department_id": None,
            "sub_items": [],
        },
    )

    assert response.status_code == 403, response.text
    assert "firma" in response.json()["detail"].lower()


def test_tenant_admin_cannot_assign_other_tenant_user_to_own_company(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-user-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-user-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-user-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_member_id = _upsert_user(
        "tenant-scope-assignment-user-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )

    own_company_id = _upsert_company(
        "Tenant Scope Assignment Own Company",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    own_role_id = _upsert_role(
        "tenant_scope_assignment_user_own_role",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-assignment-user-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        f"/api/v1/admin/users/{other_member_id}/company-assignments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "company_id": own_company_id,
            "role_id": own_role_id,
            "department_id": None,
            "sub_items": [],
        },
    )

    assert response.status_code == 403, response.text
    assert (
        "kullanici" in response.json()["detail"].lower()
        or "personel" in response.json()["detail"].lower()
    )


def test_tenant_admin_cannot_assign_own_user_with_other_tenant_department(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-department-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-department-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-department-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_member_id = _upsert_user(
        "tenant-scope-assignment-department-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    own_company_id = _upsert_company(
        "Tenant Scope Assignment Department Company",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    own_role_id = _upsert_role(
        "tenant_scope_assignment_department_role",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_department_id = _upsert_department(
        "Tenant Scope Assignment Department Other",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-assignment-department-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        f"/api/v1/admin/users/{own_member_id}/company-assignments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "company_id": own_company_id,
            "role_id": own_role_id,
            "department_id": other_department_id,
            "sub_items": [],
        },
    )

    assert response.status_code == 403, response.text
    assert "departman" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_or_delete_other_tenant_department(client):
    own_tenant_id = _create_tenant("tenant-scope-dept-mutate-own")
    other_tenant_id = _create_tenant("tenant-scope-dept-mutate-other")

    own_admin_id = _upsert_user(
        "tenant-scope-dept-mutate-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_department_id = _upsert_department(
        "Tenant Scope Forbidden Department",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-dept-mutate-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    update_response = client.put(
        f"/api/v1/admin/departments/{other_department_id}",
        headers=headers,
        json={"description": "forbidden update"},
    )
    delete_response = client.delete(
        f"/api/v1/admin/departments/{other_department_id}",
        headers=headers,
    )

    assert update_response.status_code == 403, update_response.text
    assert "departman" in update_response.json()["detail"].lower()
    assert delete_response.status_code == 403, delete_response.text
    assert "departman" in delete_response.json()["detail"].lower()


def test_tenant_admin_cannot_update_or_delete_other_tenant_role(client):
    own_tenant_id = _create_tenant("tenant-scope-role-mutate-own")
    other_tenant_id = _create_tenant("tenant-scope-role-mutate-other")

    own_admin_id = _upsert_user(
        "tenant-scope-role-mutate-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_role_id = _upsert_role(
        "tenant_scope_forbidden_mutate_role",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-role-mutate-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    update_response = client.put(
        f"/api/v1/admin/roles/{other_role_id}",
        headers=headers,
        json={"description": "forbidden update"},
    )
    delete_response = client.delete(
        f"/api/v1/admin/roles/{other_role_id}",
        headers=headers,
    )

    assert update_response.status_code == 403, update_response.text
    assert "rol" in update_response.json()["detail"].lower()
    assert delete_response.status_code == 403, delete_response.text
    assert "rol" in delete_response.json()["detail"].lower()


def test_tenant_admin_cannot_update_or_delete_other_tenant_company_assignment(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-mutate-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-mutate-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-mutate-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_member_id = _upsert_user(
        "tenant-scope-assignment-mutate-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Forbidden Assignment Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    other_role_id = _upsert_role(
        "tenant_scope_assignment_forbidden_role",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    other_department_id = _upsert_department(
        "Tenant Scope Forbidden Assignment Department",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    assignment_id = _upsert_company_assignment(
        user_id=other_member_id,
        company_id=other_company_id,
        role_id=other_role_id,
        department_id=other_department_id,
        tenant_id=other_tenant_id,
    )

    token = _login(
        client, "tenant-scope-assignment-mutate-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    update_response = client.put(
        f"/api/v1/admin/users/{other_member_id}/company-assignments/{assignment_id}",
        headers=headers,
        json={"is_active": False},
    )
    delete_response = client.delete(
        f"/api/v1/admin/users/{other_member_id}/company-assignments/{assignment_id}",
        headers=headers,
    )

    assert update_response.status_code == 403, update_response.text
    assert (
        "kullanici" in update_response.json()["detail"].lower()
        or "personel" in update_response.json()["detail"].lower()
    )
    assert delete_response.status_code == 403, delete_response.text
    assert (
        "kullanici" in delete_response.json()["detail"].lower()
        or "personel" in delete_response.json()["detail"].lower()
    )


def test_tenant_admin_cannot_reset_password_or_send_contact_email_for_other_tenant_user(
    client,
):
    own_tenant_id = _create_tenant("tenant-scope-user-admin-actions-own")
    other_tenant_id = _create_tenant("tenant-scope-user-admin-actions-other")

    own_admin_id = _upsert_user(
        "tenant-scope-user-admin-actions-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_user_id = _upsert_user(
        "tenant-scope-user-admin-actions-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    _grant_reset_password_permission(user_id=own_admin_id, tenant_id=own_tenant_id)
    _upsert_company(
        "Tenant Scope Contact Company",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-user-admin-actions-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    reset_response = client.post(
        f"/api/v1/admin/users/{other_user_id}/reset-password",
        headers=headers,
    )

    class FakeEmailService:
        def send_custom_email(self, **kwargs):
            return True

    app.dependency_overrides[get_email_service] = lambda: FakeEmailService()
    try:
        contact_response = client.post(
            f"/api/v1/admin/users/{other_user_id}/contact-email",
            headers=headers,
            data={
                "to_email": "recipient@procureflow.dev",
                "subject": "Tenant Scope Contact",
                "body": "Merhaba",
            },
        )
    finally:
        app.dependency_overrides.pop(get_email_service, None)

    assert reset_response.status_code == 403, reset_response.text
    assert "yetkiniz yok" in reset_response.json()["detail"].lower()
    assert contact_response.status_code == 403, contact_response.text
    assert "yetkiniz yok" in contact_response.json()["detail"].lower()


def test_tenant_admin_cannot_escalate_user_management_beyond_personnel_flow(client):
    own_tenant_id = _create_tenant("tenant-scope-user-escalation-own")
    other_tenant_id = _create_tenant("tenant-scope-user-escalation-other")

    _upsert_user(
        "tenant-scope-user-escalation-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    owner_user_id = _upsert_user(
        "tenant-scope-user-escalation-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_owner",
        tenant_id=own_tenant_id,
    )
    member_user_id = _upsert_user(
        "tenant-scope-user-escalation-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )

    token = _login(
        client, "tenant-scope-user-escalation-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": "tenant-scope-escalation-created@procureflow.dev",
            "full_name": "Tenant Scope Escalation Created",
            "password": "Temp123!",
            "role": "admin",
            "system_role": "tenant_admin",
            "tenant_id": own_tenant_id,
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )
    owner_update_response = client.put(
        f"/api/v1/admin/users/{owner_user_id}",
        headers=headers,
        json={"full_name": "Attempted Owner Update"},
    )
    system_role_update_response = client.put(
        f"/api/v1/admin/users/{member_user_id}",
        headers=headers,
        json={"system_role": "tenant_owner"},
    )
    tenant_move_response = client.put(
        f"/api/v1/admin/users/{member_user_id}",
        headers=headers,
        json={"tenant_id": other_tenant_id},
    )

    assert create_response.status_code == 403, create_response.text
    assert "admin veya super admin" in create_response.json()["detail"].lower()
    assert owner_update_response.status_code == 403, owner_update_response.text
    assert (
        "personel akisindan yonetemez" in owner_update_response.json()["detail"].lower()
    )
    assert (
        system_role_update_response.status_code == 403
    ), system_role_update_response.text
    assert "sistem rolune gecis" in system_role_update_response.json()["detail"].lower()
    assert tenant_move_response.status_code == 403, tenant_move_response.text
    assert "baska tenant" in tenant_move_response.json()["detail"].lower()


def test_tenant_admin_cannot_list_other_tenant_user_company_assignments(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-list-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-list-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-list-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_member_id = _upsert_user(
        "tenant-scope-assignment-list-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    other_company_id = _upsert_company(
        "Tenant Scope Forbidden Assignment List Company",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    other_role_id = _upsert_role(
        "tenant_scope_assignment_list_role",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    _upsert_company_assignment(
        user_id=other_member_id,
        company_id=other_company_id,
        role_id=other_role_id,
        department_id=None,
        tenant_id=other_tenant_id,
    )

    token = _login(
        client, "tenant-scope-assignment-list-admin@procureflow.dev", "Admin123!"
    )
    response = client.get(
        f"/api/v1/admin/users/{other_member_id}/company-assignments",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert (
        "kullanici" in response.json()["detail"].lower()
        or "personel" in response.json()["detail"].lower()
    )


def test_tenant_admin_cannot_assign_other_tenant_user_to_own_project(client):
    own_tenant_id = _create_tenant("tenant-scope-project-assign-own")
    other_tenant_id = _create_tenant("tenant-scope-project-assign-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-assign-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_user_id = _upsert_user(
        "tenant-scope-project-assign-other-user@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    own_project_id = _upsert_project(
        "TENANT-SCOPE-OWN-PROJECT",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_admin_id],
    )

    token = _login(
        client, "tenant-scope-project-assign-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        f"/api/v1/admin/users/{other_user_id}/projects/{own_project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert (
        "kullanici" in response.json()["detail"].lower()
        or "personel" in response.json()["detail"].lower()
    )


def test_tenant_admin_cannot_update_or_delete_other_tenant_project(client):
    own_tenant_id = _create_tenant("tenant-scope-project-mutate-own")
    other_tenant_id = _create_tenant("tenant-scope-project-mutate-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-mutate-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_project_id = _upsert_project(
        "TENANT-SCOPE-FORBIDDEN-PROJECT",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_admin_id],
    )

    token = _login(
        client, "tenant-scope-project-mutate-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    update_response = client.put(
        f"/api/v1/admin/projects/{other_project_id}",
        headers=headers,
        json={"name": "forbidden update"},
    )
    delete_response = client.delete(
        f"/api/v1/admin/projects/{other_project_id}",
        headers=headers,
    )

    assert update_response.status_code == 403, update_response.text
    assert "proje" in update_response.json()["detail"].lower()
    assert delete_response.status_code == 403, delete_response.text
    assert "proje" in delete_response.json()["detail"].lower()


def test_tenant_admin_cannot_delete_other_tenant_project_file(client):
    own_tenant_id = _create_tenant("tenant-scope-project-file-delete-own")
    other_tenant_id = _create_tenant("tenant-scope-project-file-delete-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-file-delete-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_project_id = _upsert_project(
        "TENANT-SCOPE-OTHER-FILE-DELETE",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    other_file_id = _upsert_project_file(other_project_id, uploaded_by=own_admin_id)

    token = _login(
        client, "tenant-scope-project-file-delete-admin@procureflow.dev", "Admin123!"
    )
    response = client.delete(
        f"/api/v1/admin/files/{other_file_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "proje" in response.json()["detail"].lower()


def test_tenant_admin_cannot_list_or_upload_other_tenant_project_files(client):
    own_tenant_id = _create_tenant("tenant-scope-project-file-access-own")
    other_tenant_id = _create_tenant("tenant-scope-project-file-access-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-file-access-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_project_id = _upsert_project(
        "TENANT-SCOPE-OTHER-FILE-ACCESS",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-project-file-access-admin@procureflow.dev", "Admin123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    list_response = client.get(
        f"/api/v1/admin/projects/{other_project_id}/files",
        headers=headers,
    )
    upload_response = client.post(
        f"/api/v1/admin/projects/{other_project_id}/files",
        headers=headers,
        files={"file": ("scope-check.txt", io.BytesIO(b"scope test"), "text/plain")},
    )

    assert list_response.status_code == 403, list_response.text
    assert "proje" in list_response.json()["detail"].lower()
    assert upload_response.status_code == 403, upload_response.text
    assert "proje" in upload_response.json()["detail"].lower()


def test_tenant_admin_cannot_remove_own_user_from_other_tenant_project(client):
    own_tenant_id = _create_tenant("tenant-scope-project-remove-own")
    other_tenant_id = _create_tenant("tenant-scope-project-remove-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-remove-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_user_id = _upsert_user(
        "tenant-scope-project-remove-own-user@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    other_project_id = _upsert_project(
        "TENANT-SCOPE-OTHER-PROJECT",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_user_id],
    )

    token = _login(
        client, "tenant-scope-project-remove-admin@procureflow.dev", "Admin123!"
    )
    response = client.delete(
        f"/api/v1/admin/users/{own_user_id}/projects/{other_project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "proje" in response.json()["detail"].lower()


def test_tenant_admin_cannot_create_project_with_other_tenant_responsible_user(client):
    own_tenant_id = _create_tenant("tenant-scope-project-create-responsible-own")
    other_tenant_id = _create_tenant("tenant-scope-project-create-responsible-other")

    _upsert_user(
        "tenant-scope-project-create-responsible-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_user_id = _upsert_user(
        "tenant-scope-project-create-responsible-other@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )

    token = _login(
        client,
        "tenant-scope-project-create-responsible-admin@procureflow.dev",
        "Admin123!",
    )
    response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Cross Tenant Responsible Project",
            "code": "CROSS-TENANT-RESP-CREATE",
            "project_type": "merkez",
            "responsible_user_ids": [other_user_id],
        },
    )

    assert response.status_code == 400, response.text
    assert "ayni tenant" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_project_with_other_tenant_responsible_user(client):
    own_tenant_id = _create_tenant("tenant-scope-project-update-responsible-own")
    other_tenant_id = _create_tenant("tenant-scope-project-update-responsible-other")

    own_admin_id = _upsert_user(
        "tenant-scope-project-update-responsible-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_user_id = _upsert_user(
        "tenant-scope-project-update-responsible-other@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    own_project_id = _upsert_project(
        "CROSS-TENANT-RESP-UPDATE",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
        member_ids=[own_admin_id],
    )

    token = _login(
        client,
        "tenant-scope-project-update-responsible-admin@procureflow.dev",
        "Admin123!",
    )
    response = client.put(
        f"/api/v1/admin/projects/{own_project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"responsible_user_ids": [other_user_id]},
    )

    assert response.status_code == 400, response.text
    assert "ayni tenant" in response.json()["detail"].lower()


def test_tenant_admin_can_create_same_project_code_in_different_tenants(client):
    own_tenant_id = _create_tenant("tenant-scope-project-code-own")
    other_tenant_id = _create_tenant("tenant-scope-project-code-other")

    _upsert_user(
        "tenant-scope-project-code-own-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    _upsert_user(
        "tenant-scope-project-code-other-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=other_tenant_id,
    )

    own_token = _login(
        client, "tenant-scope-project-code-own-admin@procureflow.dev", "Admin123!"
    )
    other_token = _login(
        client, "tenant-scope-project-code-other-admin@procureflow.dev", "Admin123!"
    )
    payload = {
        "name": "Scoped Project Code",
        "code": "TENANT-SCOPED-PROJECT-CODE",
        "project_type": "merkez",
    }

    own_response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {own_token}"},
        json=payload,
    )
    other_response = client.post(
        "/api/v1/admin/projects",
        headers={"Authorization": f"Bearer {other_token}"},
        json=payload,
    )

    assert own_response.status_code == 200, own_response.text
    assert other_response.status_code == 200, other_response.text
    assert own_response.json()["id"] != other_response.json()["id"]


def test_tenant_admin_cannot_update_project_code_to_duplicate_within_same_tenant(
    client,
):
    tenant_id = _create_tenant("tenant-scope-project-code-duplicate")
    admin_id = _upsert_user(
        "tenant-scope-project-code-duplicate-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    first_project_id = _upsert_project(
        "TENANT-SCOPE-PROJECT-CODE-FIRST",
        tenant_id=tenant_id,
        created_by_id=admin_id,
        member_ids=[admin_id],
    )
    second_project_id = _upsert_project(
        "TENANT-SCOPE-PROJECT-CODE-SECOND",
        tenant_id=tenant_id,
        created_by_id=admin_id,
        member_ids=[admin_id],
    )

    token = _login(
        client, "tenant-scope-project-code-duplicate-admin@procureflow.dev", "Admin123!"
    )
    response = client.put(
        f"/api/v1/admin/projects/{second_project_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": "TENANT-SCOPE-PROJECT-CODE-FIRST"},
    )

    assert first_project_id != second_project_id
    assert response.status_code == 400, response.text
    assert "proje kodu" in response.json()["detail"].lower()


def test_tenant_admin_can_complete_minimum_own_tenant_operations(client):
    tenant_id = _create_tenant("tenant-scope-minimum-ops")
    _upsert_user(
        "tenant-scope-minimum-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    token = _login(client, "tenant-scope-minimum-admin@procureflow.dev", "Admin123!")
    headers = {"Authorization": f"Bearer {token}"}

    company_response = client.post(
        "/api/v1/admin/companies",
        headers=headers,
        json={"name": "Tenant Scope Minimum Company", "color": "#0f766e"},
    )
    assert company_response.status_code == 200, company_response.text
    company_id = company_response.json()["id"]

    department_response = client.post(
        "/api/v1/admin/departments",
        headers=headers,
        json={
            "name": "Tenant Scope Minimum Department",
            "description": "Operations",
            "is_active": True,
        },
    )
    assert department_response.status_code == 200, department_response.text
    department_id = department_response.json()["id"]

    role_response = client.post(
        "/api/v1/admin/roles",
        headers=headers,
        json={
            "name": "tenant_scope_minimum_role",
            "description": "Ops role",
            "permission_ids": [],
        },
    )
    assert role_response.status_code == 200, role_response.text
    role_id = role_response.json()["id"]

    user_response = client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": "tenant-scope-minimum-member@procureflow.dev",
            "full_name": "Tenant Scope Minimum Member",
            "role": "satinalmaci",
            "system_role": "tenant_member",
            "department_id": department_id,
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )
    assert user_response.status_code == 200, user_response.text
    user_id = user_response.json()["id"]
    assert user_response.json()["tenant_id"] == tenant_id

    assignment_response = client.post(
        f"/api/v1/admin/users/{user_id}/company-assignments",
        headers=headers,
        json={
            "company_id": company_id,
            "role_id": role_id,
            "department_id": department_id,
            "sub_items": ["Main procurement"],
        },
    )
    assert assignment_response.status_code == 201, assignment_response.text
    assignment_id = assignment_response.json()["id"]

    assignment_list_response = client.get(
        f"/api/v1/admin/users/{user_id}/company-assignments",
        headers=headers,
    )
    assert assignment_list_response.status_code == 200, assignment_list_response.text
    assignments = assignment_list_response.json()
    assert any(item["id"] == assignment_id for item in assignments)

    assignment_update_response = client.put(
        f"/api/v1/admin/users/{user_id}/company-assignments/{assignment_id}",
        headers=headers,
        json={"sub_items": ["Main procurement", "Backup procurement"]},
    )
    assert (
        assignment_update_response.status_code == 200
    ), assignment_update_response.text
    assert assignment_update_response.json()["sub_items"] == [
        "Main procurement",
        "Backup procurement",
    ]

    company_update_response = client.put(
        f"/api/v1/admin/companies/{company_id}",
        headers=headers,
        json={"description": "Tenant-owned company"},
    )
    assert company_update_response.status_code == 200, company_update_response.text
    assert company_update_response.json()["description"] == "Tenant-owned company"


def test_tenant_admin_can_reuse_company_department_and_role_names_across_tenants(
    client,
):
    own_tenant_id = _create_tenant("tenant-scope-shared-name-own")
    other_tenant_id = _create_tenant("tenant-scope-shared-name-other")

    _upsert_user(
        "tenant-scope-shared-name-own-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    _upsert_user(
        "tenant-scope-shared-name-other-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=other_tenant_id,
    )

    shared_company_name = "Tenant Scope Shared Company"
    shared_department_name = "Tenant Scope Shared Department"
    shared_role_name = "tenant_scope_shared_role"

    own_headers = {
        "Authorization": f"Bearer {_login(client, 'tenant-scope-shared-name-own-admin@procureflow.dev', 'Admin123!')}"
    }
    other_headers = {
        "Authorization": f"Bearer {_login(client, 'tenant-scope-shared-name-other-admin@procureflow.dev', 'Admin123!')}"
    }

    own_company = client.post(
        "/api/v1/admin/companies",
        headers=own_headers,
        json={"name": shared_company_name, "color": "#1d4ed8"},
    )
    assert own_company.status_code == 200, own_company.text
    other_company = client.post(
        "/api/v1/admin/companies",
        headers=other_headers,
        json={"name": shared_company_name, "color": "#0f766e"},
    )
    assert other_company.status_code == 200, other_company.text

    own_department = client.post(
        "/api/v1/admin/departments",
        headers=own_headers,
        json={"name": shared_department_name, "description": "Own", "is_active": True},
    )
    assert own_department.status_code == 200, own_department.text
    other_department = client.post(
        "/api/v1/admin/departments",
        headers=other_headers,
        json={
            "name": shared_department_name,
            "description": "Other",
            "is_active": True,
        },
    )
    assert other_department.status_code == 200, other_department.text

    own_role = client.post(
        "/api/v1/admin/roles",
        headers=own_headers,
        json={"name": shared_role_name, "description": "Own", "permission_ids": []},
    )
    assert own_role.status_code == 200, own_role.text
    other_role = client.post(
        "/api/v1/admin/roles",
        headers=other_headers,
        json={"name": shared_role_name, "description": "Other", "permission_ids": []},
    )
    assert other_role.status_code == 200, other_role.text


def test_tenant_admin_cannot_create_role_with_other_tenant_parent(client):
    own_tenant_id = _create_tenant("tenant-scope-parent-role-own")
    other_tenant_id = _create_tenant("tenant-scope-parent-role-other")

    own_admin_id = _upsert_user(
        "tenant-scope-parent-role-own-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    _upsert_user(
        "tenant-scope-parent-role-other-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=other_tenant_id,
    )
    other_parent_role_id = _upsert_role(
        "tenant_scope_other_parent_role",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-parent-role-own-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        "/api/v1/admin/roles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "tenant_scope_child_role_forbidden",
            "description": "Forbidden child role",
            "parent_id": other_parent_role_id,
            "permission_ids": [],
        },
    )

    assert response.status_code == 403, response.text
    assert "rol" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_role_with_other_tenant_parent(client):
    own_tenant_id = _create_tenant("tenant-scope-parent-role-update-own")
    other_tenant_id = _create_tenant("tenant-scope-parent-role-update-other")

    own_admin_id = _upsert_user(
        "tenant-scope-parent-role-update-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_role_id = _upsert_role(
        "tenant_scope_parent_role_update_child",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_parent_role_id = _upsert_role(
        "tenant_scope_parent_role_update_other_parent",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )

    token = _login(
        client, "tenant-scope-parent-role-update-admin@procureflow.dev", "Admin123!"
    )
    response = client.put(
        f"/api/v1/admin/roles/{own_role_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"parent_id": other_parent_role_id},
    )

    assert response.status_code == 403, response.text
    assert "rol" in response.json()["detail"].lower()


def test_tenant_admin_can_create_role_with_own_tenant_parent(client):
    tenant_id = _create_tenant("tenant-scope-parent-role-allowed")
    admin_id = _upsert_user(
        "tenant-scope-parent-role-allowed-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    parent_role_id = _upsert_role(
        "tenant_scope_allowed_parent_role",
        tenant_id=tenant_id,
        created_by_id=admin_id,
    )

    token = _login(
        client, "tenant-scope-parent-role-allowed-admin@procureflow.dev", "Admin123!"
    )
    response = client.post(
        "/api/v1/admin/roles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "tenant_scope_allowed_child_role",
            "description": "Allowed child role",
            "parent_id": parent_role_id,
            "permission_ids": [],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["parent_id"] == parent_role_id
    assert body["hierarchy_level"] == 1


def test_super_admin_cannot_create_cross_tenant_mixed_company_assignment(client):
    own_tenant_id = _create_tenant("assignment-mixed-own")
    other_tenant_id = _create_tenant("assignment-mixed-other")

    _upsert_user(
        "assignment-mixed-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
        tenant_id=own_tenant_id,
    )
    own_member_id = _upsert_user(
        "assignment-mixed-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    other_company_id = _upsert_company(
        "Assignment Mixed Other Company",
        tenant_id=other_tenant_id,
        created_by_id=own_member_id,
    )
    own_role_id = _upsert_role(
        "assignment_mixed_own_role",
        tenant_id=own_tenant_id,
        created_by_id=own_member_id,
    )

    token = _login(client, "assignment-mixed-super@procureflow.dev", "Super123!")
    response = client.post(
        f"/api/v1/admin/users/{own_member_id}/company-assignments",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "company_id": other_company_id,
            "role_id": own_role_id,
            "department_id": None,
            "sub_items": [],
        },
    )

    assert response.status_code == 400, response.text
    assert "ayni tenant" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_assignment_with_other_tenant_role(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-update-role-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-update-role-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-update-role-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_member_id = _upsert_user(
        "tenant-scope-assignment-update-role-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    own_company_id = _upsert_company(
        "Tenant Scope Assignment Update Role Company",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    own_role_id = _upsert_role(
        "tenant_scope_assignment_update_role_own",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_role_id = _upsert_role(
        "tenant_scope_assignment_update_role_other",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    assignment_id = _upsert_company_assignment(
        user_id=own_member_id,
        company_id=own_company_id,
        role_id=own_role_id,
        department_id=None,
        tenant_id=own_tenant_id,
    )

    token = _login(
        client, "tenant-scope-assignment-update-role-admin@procureflow.dev", "Admin123!"
    )
    response = client.put(
        f"/api/v1/admin/users/{own_member_id}/company-assignments/{assignment_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"role_id": other_role_id},
    )

    assert response.status_code == 403, response.text
    assert "rol" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_assignment_with_other_tenant_department(client):
    own_tenant_id = _create_tenant("tenant-scope-assignment-update-department-own")
    other_tenant_id = _create_tenant("tenant-scope-assignment-update-department-other")

    own_admin_id = _upsert_user(
        "tenant-scope-assignment-update-department-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    own_member_id = _upsert_user(
        "tenant-scope-assignment-update-department-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    own_company_id = _upsert_company(
        "Tenant Scope Assignment Update Department Company",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    own_role_id = _upsert_role(
        "tenant_scope_assignment_update_department_role",
        tenant_id=own_tenant_id,
        created_by_id=own_admin_id,
    )
    other_department_id = _upsert_department(
        "Tenant Scope Assignment Update Department Other",
        tenant_id=other_tenant_id,
        created_by_id=own_admin_id,
    )
    assignment_id = _upsert_company_assignment(
        user_id=own_member_id,
        company_id=own_company_id,
        role_id=own_role_id,
        department_id=None,
        tenant_id=own_tenant_id,
    )

    token = _login(
        client,
        "tenant-scope-assignment-update-department-admin@procureflow.dev",
        "Admin123!",
    )
    response = client.put(
        f"/api/v1/admin/users/{own_member_id}/company-assignments/{assignment_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"department_id": other_department_id},
    )

    assert response.status_code == 403, response.text
    assert "departman" in response.json()["detail"].lower()


def test_super_admin_cannot_update_company_assignment_with_cross_tenant_role(client):
    tenant_id = _create_tenant("assignment-update-own")
    other_tenant_id = _create_tenant("assignment-update-other")

    _upsert_user(
        "assignment-update-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
        tenant_id=tenant_id,
    )
    member_id = _upsert_user(
        "assignment-update-member@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    company_id = _upsert_company(
        "Assignment Update Own Company",
        tenant_id=tenant_id,
        created_by_id=member_id,
    )
    own_role_id = _upsert_role(
        "assignment_update_own_role",
        tenant_id=tenant_id,
        created_by_id=member_id,
    )
    other_role_id = _upsert_role(
        "assignment_update_other_role",
        tenant_id=other_tenant_id,
        created_by_id=member_id,
    )
    assignment_id = _upsert_company_assignment(
        user_id=member_id,
        company_id=company_id,
        role_id=own_role_id,
        department_id=None,
        tenant_id=tenant_id,
    )

    token = _login(client, "assignment-update-super@procureflow.dev", "Super123!")
    response = client.put(
        f"/api/v1/admin/users/{member_id}/company-assignments/{assignment_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"role_id": other_role_id},
    )

    assert response.status_code == 400, response.text
    assert "ayni tenant" in response.json()["detail"].lower()
