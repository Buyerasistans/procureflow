from api.main import app
from api.database import SessionLocal
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.models.department import Department
from api.models.role import Permission, Role
from api.models.tenant import Tenant
from api.models.user import User
from api.core.security import get_password_hash
from api.services.email_service import get_email_service


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
        company = (
            db.query(Company)
            .filter(Company.name == name, Company.tenant_id == tenant_id)
            .first()
        )
        if company is None:
            company = Company(
                name=name,
                color="#2563eb",
                is_active=True,
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        return company.id
    finally:
        db.close()


def _upsert_department(name: str, *, tenant_id: int, created_by_id: int) -> int:
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
                created_by_id=created_by_id,
            )
            db.add(department)
            db.commit()
            db.refresh(department)
        return department.id
    finally:
        db.close()


def _grant_reset_password_permission(*, user_id: int, tenant_id: int) -> None:
    db = SessionLocal()
    try:
        role = (
            db.query(Role)
            .filter(
                Role.name == "tenant_admin_reset_password_role",
                Role.tenant_id == tenant_id,
            )
            .first()
        )
        if role is None:
            role = Role(
                name="tenant_admin_reset_password_role",
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
                Company.name == "tenant-admin-reset-company",
                Company.tenant_id == tenant_id,
            )
            .first()
        )
        if company is None:
            company = Company(
                name="tenant-admin-reset-company",
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


def test_tenant_admin_cannot_create_reserved_workspace_role_user(client):
    tenant_id = _create_tenant("tenant-admin-create-guard")
    _upsert_user(
        "tenant-admin-create-guard@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    token = _login(client, "tenant-admin-create-guard@procureflow.dev", "Admin123!")

    response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "reserved-role-user@procureflow.dev",
            "full_name": "Reserved Role User",
            "password": "Temp123!",
            "role": "admin",
            "system_role": "tenant_admin",
            "tenant_id": tenant_id,
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )

    assert response.status_code == 403, response.text
    assert "admin veya super admin" in response.json()["detail"]


def test_super_admin_can_create_invited_user_without_password_field(client):
    tenant_id = _create_tenant("super-admin-create-no-password")
    _upsert_user(
        "super-admin-create-no-password@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
        tenant_id=tenant_id,
    )
    token = _login(
        client, "super-admin-create-no-password@procureflow.dev", "Super123!"
    )

    response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "invited-user-no-password@procureflow.dev",
            "full_name": "Invited User",
            "role": "satinalmaci",
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == "invited-user-no-password@procureflow.dev"
    assert body["invitation_accepted"] is False


def test_starter_plan_blocks_user_creation_after_active_user_limit(client):
    tenant_id = _create_tenant(
        "tenant-user-limit-starter",
        subscription_plan_code="starter",
    )
    _upsert_user(
        "tenant-user-limit-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    for index in range(9):
        _upsert_user(
            f"tenant-user-limit-member-{index}@procureflow.dev",
            "User123!",
            role="satinalmaci",
            system_role="tenant_member",
            tenant_id=tenant_id,
        )

    token = _login(client, "tenant-user-limit-admin@procureflow.dev", "Admin123!")
    response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "tenant-user-limit-blocked@procureflow.dev",
            "full_name": "Blocked Limit User",
            "role": "satinalmaci",
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )

    assert response.status_code == 409, response.text
    assert "aktif kullanici limiti asildi" in response.json()["detail"].lower()


def test_growth_plan_allows_user_creation_above_starter_limit(client):
    tenant_id = _create_tenant(
        "tenant-user-limit-growth",
        subscription_plan_code="growth",
    )
    _upsert_user(
        "tenant-user-growth-admin@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    for index in range(10):
        _upsert_user(
            f"tenant-user-growth-member-{index}@procureflow.dev",
            "User123!",
            role="satinalmaci",
            system_role="tenant_member",
            tenant_id=tenant_id,
        )

    token = _login(client, "tenant-user-growth-admin@procureflow.dev", "Admin123!")
    response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "tenant-user-growth-allowed@procureflow.dev",
            "full_name": "Growth Allowed User",
            "role": "satinalmaci",
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["email"] == "tenant-user-growth-allowed@procureflow.dev"


def test_tenant_admin_cannot_update_admin_managed_account_from_personnel_flow(client):
    tenant_id = _create_tenant("tenant-admin-update-guard")
    _upsert_user(
        "tenant-admin-update-guard@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    target_id = _upsert_user(
        "tenant-owner-target@procureflow.dev",
        "Owner123!",
        role="admin",
        system_role="tenant_owner",
        tenant_id=tenant_id,
    )
    token = _login(client, "tenant-admin-update-guard@procureflow.dev", "Admin123!")

    response = client.put(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Attempted Update"},
    )

    assert response.status_code == 403, response.text
    assert "personel akisindan yonetemez" in response.json()["detail"]


def test_tenant_admin_cannot_escalate_member_system_role_via_user_update(client):
    tenant_id = _create_tenant("tenant-admin-system-role-escalation")
    _upsert_user(
        "tenant-admin-system-role-escalation@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    target_id = _upsert_user(
        "tenant-member-escalation-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    token = _login(
        client, "tenant-admin-system-role-escalation@procureflow.dev", "Admin123!"
    )

    response = client.put(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"system_role": "tenant_owner"},
    )

    assert response.status_code == 403, response.text
    assert "sistem rolune gecis" in response.json()["detail"].lower()


def test_tenant_admin_cannot_move_user_to_other_tenant_via_user_update(client):
    own_tenant_id = _create_tenant("tenant-admin-tenant-move-own")
    other_tenant_id = _create_tenant("tenant-admin-tenant-move-other")
    _upsert_user(
        "tenant-admin-tenant-move@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    target_id = _upsert_user(
        "tenant-member-tenant-move-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    token = _login(client, "tenant-admin-tenant-move@procureflow.dev", "Admin123!")

    response = client.put(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"tenant_id": other_tenant_id},
    )

    assert response.status_code == 403, response.text
    assert "baska tenant" in response.json()["detail"].lower()


def test_tenant_admin_cannot_create_user_with_other_tenant_department(client):
    own_tenant_id = _create_tenant("tenant-admin-create-department-own")
    other_tenant_id = _create_tenant("tenant-admin-create-department-other")
    admin_id = _upsert_user(
        "tenant-admin-create-department@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    other_department_id = _upsert_department(
        "tenant_admin_create_department_other",
        tenant_id=other_tenant_id,
        created_by_id=admin_id,
    )
    token = _login(
        client, "tenant-admin-create-department@procureflow.dev", "Admin123!"
    )

    response = client.post(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": "tenant-admin-create-department-target@procureflow.dev",
            "full_name": "Department Scope Target",
            "role": "satinalmaci",
            "department_id": other_department_id,
            "approval_limit": 100000,
            "is_active": True,
            "hide_location": False,
            "share_on_whatsapp": True,
        },
    )

    assert response.status_code == 403, response.text
    assert "departman" in response.json()["detail"].lower()


def test_tenant_admin_cannot_update_user_with_other_tenant_department(client):
    own_tenant_id = _create_tenant("tenant-admin-update-department-own")
    other_tenant_id = _create_tenant("tenant-admin-update-department-other")
    admin_id = _upsert_user(
        "tenant-admin-update-department@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-update-department-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=own_tenant_id,
    )
    other_department_id = _upsert_department(
        "tenant_admin_update_department_other",
        tenant_id=other_tenant_id,
        created_by_id=admin_id,
    )
    token = _login(
        client, "tenant-admin-update-department@procureflow.dev", "Admin123!"
    )

    response = client.put(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"department_id": other_department_id},
    )

    assert response.status_code == 403, response.text
    assert "departman" in response.json()["detail"].lower()


def test_tenant_admin_cannot_delete_other_tenant_user(client):
    own_tenant_id = _create_tenant("tenant-admin-delete-scope-own")
    other_tenant_id = _create_tenant("tenant-admin-delete-scope-other")
    _upsert_user(
        "tenant-admin-delete-scope@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-delete-scope-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )

    db = SessionLocal()
    try:
        target = db.query(User).filter(User.id == target_id).first()
        assert target is not None
        target.is_active = False
        db.commit()
    finally:
        db.close()

    token = _login(client, "tenant-admin-delete-scope@procureflow.dev", "Admin123!")
    response = client.delete(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "yetkiniz yok" in response.json()["detail"].lower()


def test_tenant_admin_can_archive_inactive_own_tenant_user(client):
    tenant_id = _create_tenant("tenant-admin-delete-own")
    _upsert_user(
        "tenant-admin-delete-own@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    target_email = "tenant-admin-delete-own-target@procureflow.dev"
    target_id = _upsert_user(
        target_email,
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )

    db = SessionLocal()
    try:
        target = db.query(User).filter(User.id == target_id).first()
        assert target is not None
        target.is_active = False
        db.commit()
    finally:
        db.close()

    token = _login(client, "tenant-admin-delete-own@procureflow.dev", "Admin123!")
    response = client.delete(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert "listeden kaldırıldı" in response.json()["message"].lower()

    db = SessionLocal()
    try:
        archived = db.query(User).filter(User.id == target_id).first()
        assert archived is not None
        assert archived.hidden_from_admin is True
        assert archived.deleted_original_email == target_email
        assert archived.department_id is None
        assert archived.email.endswith("@procureflow.local")
    finally:
        db.close()


def test_tenant_admin_can_reset_password_for_own_tenant_user_with_permission(client):
    tenant_id = _create_tenant("tenant-admin-reset-password-own")
    admin_id = _upsert_user(
        "tenant-admin-reset-own@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-reset-own-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    _grant_reset_password_permission(user_id=admin_id, tenant_id=tenant_id)
    token = _login(client, "tenant-admin-reset-own@procureflow.dev", "Admin123!")

    response = client.post(
        f"/api/v1/admin/users/{target_id}/reset-password",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["temp_password"] == "Temp1234!"
    assert "sifresi sifirlandi" in body["message"].lower().replace("ş", "s").replace(
        "ı", "i"
    )


def test_tenant_admin_cannot_reset_password_for_other_tenant_user_even_with_permission(
    client,
):
    own_tenant_id = _create_tenant("tenant-admin-reset-password-scope-own")
    other_tenant_id = _create_tenant("tenant-admin-reset-password-scope-other")
    admin_id = _upsert_user(
        "tenant-admin-reset-scope@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-reset-scope-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    _grant_reset_password_permission(user_id=admin_id, tenant_id=own_tenant_id)
    token = _login(client, "tenant-admin-reset-scope@procureflow.dev", "Admin123!")

    response = client.post(
        f"/api/v1/admin/users/{target_id}/reset-password",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert "yetkiniz yok" in response.json()["detail"].lower()


def test_tenant_admin_can_send_contact_email_for_own_tenant_user(client):
    tenant_id = _create_tenant("tenant-admin-contact-email-own")
    admin_id = _upsert_user(
        "tenant-admin-contact-own@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-contact-own-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=tenant_id,
    )
    _upsert_company(
        "tenant-admin-contact-email-company",
        tenant_id=tenant_id,
        created_by_id=admin_id,
    )
    token = _login(client, "tenant-admin-contact-own@procureflow.dev", "Admin123!")

    calls: list[dict[str, object]] = []

    class FakeEmailService:
        def send_custom_email(self, **kwargs):
            calls.append(kwargs)
            return True

    app.dependency_overrides[get_email_service] = lambda: FakeEmailService()
    try:
        response = client.post(
            f"/api/v1/admin/users/{target_id}/contact-email",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "to_email": "recipient@procureflow.dev",
                "subject": "Tenant Contact",
                "body": "Merhaba",
            },
        )
    finally:
        app.dependency_overrides.pop(get_email_service, None)

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "success"
    assert calls, "email servisi cagirilmalidir"
    assert calls[0]["owner_user_id"] == admin_id
    assert calls[0]["to_email"] == "recipient@procureflow.dev"


def test_tenant_admin_cannot_send_contact_email_for_other_tenant_user(client):
    own_tenant_id = _create_tenant("tenant-admin-contact-email-scope-own")
    other_tenant_id = _create_tenant("tenant-admin-contact-email-scope-other")
    admin_id = _upsert_user(
        "tenant-admin-contact-scope@procureflow.dev",
        "Admin123!",
        role="admin",
        system_role="tenant_admin",
        tenant_id=own_tenant_id,
    )
    target_id = _upsert_user(
        "tenant-admin-contact-scope-target@procureflow.dev",
        "User123!",
        role="satinalmaci",
        system_role="tenant_member",
        tenant_id=other_tenant_id,
    )
    _upsert_company(
        "tenant-admin-contact-scope-company",
        tenant_id=own_tenant_id,
        created_by_id=admin_id,
    )
    token = _login(client, "tenant-admin-contact-scope@procureflow.dev", "Admin123!")

    class FakeEmailService:
        def send_custom_email(self, **kwargs):
            return True

    app.dependency_overrides[get_email_service] = lambda: FakeEmailService()
    try:
        response = client.post(
            f"/api/v1/admin/users/{target_id}/contact-email",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "to_email": "recipient@procureflow.dev",
                "subject": "Tenant Contact",
                "body": "Merhaba",
            },
        )
    finally:
        app.dependency_overrides.pop(get_email_service, None)

    assert response.status_code == 403, response.text
    assert "yetkiniz yok" in response.json()["detail"].lower()
