from api.database import SessionLocal
from api.models.project import Project
from api.models.project_file import ProjectFile
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


def _create_project(code: str, *, tenant_id: int, created_by_id: int) -> int:
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.code == code).first()
        if project is None:
            project = Project(
                name=f"Project {code}",
                code=code,
                description="authz test project",
                is_active=True,
                project_type="merkez",
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
        else:
            project.tenant_id = tenant_id
            project.created_by_id = created_by_id
            project.is_active = True
            db.commit()
            db.refresh(project)
        return project.id
    finally:
        db.close()


def _create_project_file(project_id: int, *, uploaded_by: int) -> int:
    db = SessionLocal()
    try:
        project_file = ProjectFile(
            project_id=project_id,
            filename="scope-file.txt",
            original_filename="scope-file.txt",
            file_type="text/plain",
            file_size=12,
            file_path="uploads/test/scope-file.txt",
            uploaded_by=uploaded_by,
        )
        db.add(project_file)
        db.commit()
        db.refresh(project_file)
        return project_file.id
    finally:
        db.close()


def _login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_tenant_admin_cannot_list_other_tenant_project_files(client):
    owner_tenant_id = _create_tenant("project-files-owner-tenant")
    outsider_tenant_id = _create_tenant("project-files-outsider-tenant")

    owner_user_id = _upsert_user(
        "project-files-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=owner_tenant_id,
    )
    project_id = _create_project(
        "FILES-SCOPE-LIST",
        tenant_id=owner_tenant_id,
        created_by_id=owner_user_id,
    )

    _upsert_user(
        "project-files-outsider@procureflow.dev",
        "Outsider123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=outsider_tenant_id,
    )
    token = _login(client, "project-files-outsider@procureflow.dev", "Outsider123!")

    response = client.get(
        f"/api/v1/admin/projects/{project_id}/files",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "proje" in response.json()["detail"].lower()


def test_tenant_admin_cannot_upload_file_to_other_tenant_project(client):
    owner_tenant_id = _create_tenant("project-files-upload-owner")
    outsider_tenant_id = _create_tenant("project-files-upload-outsider")

    owner_user_id = _upsert_user(
        "project-files-upload-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=owner_tenant_id,
    )
    project_id = _create_project(
        "FILES-SCOPE-UP",
        tenant_id=owner_tenant_id,
        created_by_id=owner_user_id,
    )

    _upsert_user(
        "project-files-upload-outsider@procureflow.dev",
        "Outsider123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=outsider_tenant_id,
    )
    token = _login(
        client, "project-files-upload-outsider@procureflow.dev", "Outsider123!"
    )

    response = client.post(
        f"/api/v1/admin/projects/{project_id}/files",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("scope-check.txt", b"scope test", "text/plain")},
    )

    assert response.status_code == 403, response.text
    assert "proje" in response.json()["detail"].lower()


def test_platform_support_has_read_only_access_to_project_files(client):
    tenant_id = _create_tenant("project-files-platform-support")
    owner_user_id = _upsert_user(
        "project-files-platform-owner@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    project_id = _create_project(
        "FILES-PLATFORM-RO",
        tenant_id=tenant_id,
        created_by_id=owner_user_id,
    )
    file_id = _create_project_file(project_id, uploaded_by=owner_user_id)

    _upsert_user(
        "project-files-platform-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
        tenant_id=tenant_id,
    )
    token = _login(
        client, "project-files-platform-support@procureflow.dev", "Support123!"
    )
    headers = {"Authorization": f"Bearer {token}"}

    list_response = client.get(
        f"/api/v1/admin/projects/{project_id}/files",
        headers=headers,
    )
    assert list_response.status_code == 200, list_response.text

    upload_response = client.post(
        f"/api/v1/admin/projects/{project_id}/files",
        headers=headers,
        files={"file": ("readonly.txt", b"scope test", "text/plain")},
    )
    assert upload_response.status_code == 403, upload_response.text
    assert "dosyasi yukleme" in upload_response.json()["detail"].lower()

    delete_response = client.delete(
        f"/api/v1/admin/files/{file_id}",
        headers=headers,
    )
    assert delete_response.status_code == 403, delete_response.text
    assert "admin" in delete_response.json()["detail"].lower()
