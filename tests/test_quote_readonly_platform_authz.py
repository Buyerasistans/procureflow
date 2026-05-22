from api.core.security import get_password_hash
from api.database import SessionLocal
from api.models import QuoteApproval
from api.models.project import Project
from api.models.supplier import Supplier
from api.models.user import User


def _upsert_user(email: str, password: str, *, role: str, system_role: str) -> int:
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
                department_id=1,
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
            user.department_id = 1
            user.is_active = True
            user.hidden_from_admin = False
            db.commit()
            db.refresh(user)
        return user.id
    finally:
        db.close()


def _assign_project_member(project_id: int, user_id: int) -> None:
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        assert project is not None
        assert user is not None
        if all(member.id != user.id for member in project.personnel):
            project.personnel.append(user)
            db.commit()
    finally:
        db.close()


def _create_supplier(name: str) -> int:
    db = SessionLocal()
    try:
        supplier = Supplier(
            created_by_id=1,
            company_name=name,
            phone="5550000000",
            email=f"{name.lower().replace(' ', '-')}@test.com",
            is_active=True,
        )
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        return supplier.id
    finally:
        db.close()


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_quote(client, headers: dict[str, str], title: str) -> int:
    response = client.post(
        "/api/v1/quotes/",
        headers=headers,
        json={
            "project_id": 1,
            "title": title,
            "company_name": "Quote Authz Test",
            "company_contact_name": "ProcureFlow",
            "company_contact_phone": "5551234567",
            "company_contact_email": "quote-authz@test.com",
        },
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def test_platform_support_cannot_write_quote_workspace(client, admin_auth_headers):
    support_user_id = _upsert_user(
        "quote-platform-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    _assign_project_member(1, support_user_id)
    support_headers = _login(
        client, "quote-platform-support@procureflow.dev", "Support123!"
    )

    create_response = client.post(
        "/api/v1/quotes/",
        headers=support_headers,
        json={
            "project_id": 1,
            "title": "Platform Support Create",
            "company_name": "Quote Authz Test",
            "company_contact_name": "ProcureFlow",
            "company_contact_phone": "5551234567",
            "company_contact_email": "quote-authz@test.com",
        },
    )
    assert create_response.status_code == 403, create_response.text
    assert "salt-okunur" in create_response.json()["detail"].lower()

    quote_id = _create_quote(client, admin_auth_headers, "Support Read Only Quote")

    update_response = client.put(
        f"/api/v1/quotes/{quote_id}",
        headers=support_headers,
        json={"title": "Updated By Support"},
    )
    assert update_response.status_code == 403, update_response.text
    assert "salt-okunur" in update_response.json()["detail"].lower()

    delete_response = client.delete(
        f"/api/v1/quotes/{quote_id}",
        headers=support_headers,
    )
    assert delete_response.status_code == 403, delete_response.text
    assert "salt-okunur" in delete_response.json()["detail"].lower()


def test_platform_support_cannot_submit_approve_or_send_quote(
    client, admin_auth_headers
):
    support_user_id = _upsert_user(
        "quote-platform-support-ops@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    _assign_project_member(1, support_user_id)
    support_headers = _login(
        client, "quote-platform-support-ops@procureflow.dev", "Support123!"
    )

    quote_id = _create_quote(client, admin_auth_headers, "Platform Support Ops Quote")

    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit",
        headers=support_headers,
    )
    assert submit_response.status_code == 403, submit_response.text
    assert "salt-okunur" in submit_response.json()["detail"].lower()

    db = SessionLocal()
    try:
        db.add(
            QuoteApproval(
                quote_id=quote_id,
                approval_level=1,
                required_business_role="*",
                status="approved",
            )
        )
        db.commit()
    finally:
        db.close()

    admin_submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit",
        headers=admin_auth_headers,
    )
    assert admin_submit_response.status_code == 200, admin_submit_response.text

    approve_response = client.post(
        f"/api/v1/quotes/{quote_id}/approve",
        headers=support_headers,
    )
    assert approve_response.status_code == 403, approve_response.text

    supplier_id = _create_supplier("Platform Support Send Supplier")
    send_response = client.post(
        f"/api/v1/quotes/{quote_id}/send-to-suppliers",
        headers=support_headers,
        json=[supplier_id],
    )
    assert send_response.status_code == 403, send_response.text
    assert "salt-okunur" in send_response.json()["detail"].lower()


def test_procurement_member_can_still_create_and_submit_own_quote(client):
    procurement_user_id = _upsert_user(
        "quote-procurement-member@procureflow.dev",
        "Buyer123!",
        role="satinalma_uzmani",
        system_role="tenant_member",
    )
    _assign_project_member(1, procurement_user_id)
    procurement_headers = _login(
        client, "quote-procurement-member@procureflow.dev", "Buyer123!"
    )

    create_response = client.post(
        "/api/v1/quotes/",
        headers=procurement_headers,
        json={
            "project_id": 1,
            "title": "Procurement Quote",
            "company_name": "Quote Authz Test",
            "company_contact_name": "ProcureFlow",
            "company_contact_phone": "5551234567",
            "company_contact_email": "quote-authz@test.com",
        },
    )
    assert create_response.status_code in (200, 201), create_response.text
    quote_id = create_response.json()["id"]

    items_response = client.put(
        f"/api/v1/quotes/{quote_id}/items",
        headers=procurement_headers,
        json=[
            {
                "line_number": "1.1",
                "category_code": "GEN",
                "category_name": "Genel",
                "description": "Kalem",
                "unit": "adet",
                "quantity": 1,
                "unit_price": 50,
                "vat_rate": 20,
            }
        ],
    )
    assert items_response.status_code == 200, items_response.text

    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit",
        headers=procurement_headers,
    )
    assert submit_response.status_code == 200, submit_response.text
    assert submit_response.json()["status"] == "submitted"
