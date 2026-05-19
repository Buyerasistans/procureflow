from io import BytesIO

import openpyxl

from api.core.security import get_password_hash
from api.database import SessionLocal
from api.models.project import Project
from api.models.quote import Quote, QuoteItem, QuoteStatus
from api.models.supplier import (
    ProjectSupplier,
    Supplier,
    SupplierQuote,
    SupplierQuoteItem,
)
from api.models.tenant import Tenant
from api.models.user import User


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
    email: str,
    password: str,
    *,
    tenant_id: int,
    role: str = "satinalma_uzmani",
    system_role: str = "tenant_member",
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
        project = (
            db.query(Project)
            .filter(Project.code == code, Project.tenant_id == tenant_id)
            .first()
        )
        if project is None:
            project = Project(
                name=f"Project {code}",
                code=code,
                description="quote router tenant scope test",
                is_active=True,
                project_type="merkez",
                tenant_id=tenant_id,
                created_by_id=created_by_id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
        return project.id
    finally:
        db.close()


def _create_quote_with_item(
    *, tenant_id: int, project_id: int, created_by_id: int, title: str
) -> int:
    db = SessionLocal()
    try:
        quote = Quote(
            tenant_id=tenant_id,
            project_id=project_id,
            created_by_id=created_by_id,
            user_id=created_by_id,
            title=title,
            company_name="Tenant Scope Quote Company",
            company_contact_name="Tenant Scope Contact",
            company_contact_phone="5551234567",
            company_contact_email="tenant-scope-quote@test.dev",
            status=QuoteStatus.DRAFT,
            total_amount=0,
            amount=0,
            is_active=True,
        )
        db.add(quote)
        db.flush()
        db.add(
            QuoteItem(
                quote_id=quote.id,
                line_number="1.1",
                category_code="GEN",
                category_name="Genel",
                description="Kalem",
                unit="adet",
                quantity=1,
                unit_price=10,
                vat_rate=20,
                total_price=10,
                sequence=0,
            )
        )
        db.commit()
        db.refresh(quote)
        return quote.id
    finally:
        db.close()


def _create_supplier_quote(
    *, quote_id: int, tenant_id: int, created_by_id: int, name: str
) -> int:
    db = SessionLocal()
    try:
        supplier = Supplier(
            tenant_id=tenant_id,
            created_by_id=created_by_id,
            company_name=name,
            phone="5550000000",
            email=f"{name.lower().replace(' ', '-')}@procureflow.dev",
            is_active=True,
        )
        db.add(supplier)
        db.flush()

        supplier_quote = SupplierQuote(
            quote_id=quote_id,
            supplier_id=supplier.id,
            revision_number=0,
            is_revised_version=False,
            status="yanıtlandı",
            currency="TRY",
            total_amount=100,
            final_amount=100,
        )
        db.add(supplier_quote)
        db.commit()
        db.refresh(supplier_quote)
        return supplier_quote.id
    finally:
        db.close()


def _create_project_supplier(
    *, project_id: int, tenant_id: int, assigned_by_id: int, name: str
) -> int:
    db = SessionLocal()
    try:
        supplier = Supplier(
            tenant_id=tenant_id,
            created_by_id=assigned_by_id,
            company_name=name,
            phone="5551111111",
            email=f"{name.lower().replace(' ', '-')}@procureflow.dev",
            is_active=True,
        )
        db.add(supplier)
        db.flush()

        project_supplier = ProjectSupplier(
            project_id=project_id,
            supplier_id=supplier.id,
            assigned_by_id=assigned_by_id,
            is_active=True,
        )
        db.add(project_supplier)
        db.commit()
        return supplier.id
    finally:
        db.close()


def _build_import_workbook_bytes() -> bytes:
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    assert worksheet is not None
    worksheet["B9"] = "1.1"
    worksheet["E9"] = "Tenant Smoke Kalemi"
    worksheet["I9"] = "adet"
    worksheet["J9"] = 1

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _login(client, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_quote_router_denies_cross_tenant_project_quote_listing(client):
    owner_tenant_id = _create_tenant("quote-router-project-owner")
    outsider_tenant_id = _create_tenant("quote-router-project-outsider")

    owner_user_id = _upsert_user(
        "quote-router-project-owner@procureflow.dev",
        "Owner123!",
        tenant_id=owner_tenant_id,
    )
    project_id = _create_project(
        "QUOTE-ROUTER-PROJECT-LIST",
        tenant_id=owner_tenant_id,
        created_by_id=owner_user_id,
    )
    _create_quote_with_item(
        tenant_id=owner_tenant_id,
        project_id=project_id,
        created_by_id=owner_user_id,
        title="Owner Tenant Quote",
    )

    _upsert_user(
        "quote-router-project-outsider@procureflow.dev",
        "Outsider123!",
        tenant_id=outsider_tenant_id,
    )
    headers = _login(
        client, "quote-router-project-outsider@procureflow.dev", "Outsider123!"
    )

    response = client.get(f"/api/v1/quotes/project/{project_id}", headers=headers)

    assert response.status_code == 403, response.text
    assert "proje" in response.json()["detail"].lower()


def test_quote_router_denies_cross_tenant_quote_items_access(client):
    owner_tenant_id = _create_tenant("quote-router-items-owner")
    outsider_tenant_id = _create_tenant("quote-router-items-outsider")

    owner_user_id = _upsert_user(
        "quote-router-items-owner@procureflow.dev",
        "Owner123!",
        tenant_id=owner_tenant_id,
    )
    project_id = _create_project(
        "QUOTE-ROUTER-ITEMS-PROJECT",
        tenant_id=owner_tenant_id,
        created_by_id=owner_user_id,
    )
    quote_id = _create_quote_with_item(
        tenant_id=owner_tenant_id,
        project_id=project_id,
        created_by_id=owner_user_id,
        title="Owner Tenant Quote Items",
    )

    _upsert_user(
        "quote-router-items-outsider@procureflow.dev",
        "Outsider123!",
        tenant_id=outsider_tenant_id,
    )
    headers = _login(
        client, "quote-router-items-outsider@procureflow.dev", "Outsider123!"
    )

    get_response = client.get(f"/api/v1/quotes/{quote_id}/items", headers=headers)
    add_response = client.post(
        f"/api/v1/quotes/{quote_id}/items",
        headers=headers,
        json={
            "line_number": "1.2",
            "category_code": "GEN",
            "category_name": "Genel",
            "description": "Yeni Kalem",
            "unit": "adet",
            "quantity": 1,
            "unit_price": 25,
            "vat_rate": 20,
        },
    )

    assert get_response.status_code == 403, get_response.text
    assert "yetkisiz" in get_response.json()["detail"].lower()
    assert add_response.status_code == 403, add_response.text
    assert "yetkisiz" in add_response.json()["detail"].lower()


def test_submit_revision_rejects_supplier_quote_from_different_quote(client):
    tenant_id = _create_tenant("quote-router-revision-parent-check")
    owner_user_id = _upsert_user(
        "quote-router-revision-owner@procureflow.dev",
        "Owner123!",
        tenant_id=tenant_id,
    )
    project_id = _create_project(
        "QUOTE-ROUTER-REVISION-PROJECT",
        tenant_id=tenant_id,
        created_by_id=owner_user_id,
    )
    first_quote_id = _create_quote_with_item(
        tenant_id=tenant_id,
        project_id=project_id,
        created_by_id=owner_user_id,
        title="First Quote",
    )
    second_quote_id = _create_quote_with_item(
        tenant_id=tenant_id,
        project_id=project_id,
        created_by_id=owner_user_id,
        title="Second Quote",
    )
    foreign_supplier_quote_id = _create_supplier_quote(
        quote_id=second_quote_id,
        tenant_id=tenant_id,
        created_by_id=owner_user_id,
        name="Revision Foreign Supplier",
    )

    headers = _login(client, "quote-router-revision-owner@procureflow.dev", "Owner123!")
    response = client.post(
        f"/api/v1/quotes/{first_quote_id}/submit-revision",
        headers=headers,
        json={
            "supplier_quote_id": foreign_supplier_quote_id,
            "revised_prices": [
                {"quote_item_id": 1, "unit_price": 50, "total_price": 50}
            ],
        },
    )

    assert response.status_code == 400, response.text
    assert "orijinal teklif bulunamadı" in response.json()["detail"].lower()


def test_submit_revision_rejects_supplier_quote_with_cross_tenant_supplier(client):
    tenant_id = _create_tenant("quote-router-revision-cross-tenant-supplier")
    other_tenant_id = _create_tenant("quote-router-revision-cross-tenant-foreign")
    owner_user_id = _upsert_user(
        "quote-router-revision-cross-tenant-owner@procureflow.dev",
        "Owner123!",
        tenant_id=tenant_id,
    )
    foreign_user_id = _upsert_user(
        "quote-router-revision-cross-tenant-foreign@procureflow.dev",
        "Foreign123!",
        tenant_id=other_tenant_id,
    )
    project_id = _create_project(
        "QUOTE-ROUTER-REVISION-CROSS-TENANT",
        tenant_id=tenant_id,
        created_by_id=owner_user_id,
    )
    quote_id = _create_quote_with_item(
        tenant_id=tenant_id,
        project_id=project_id,
        created_by_id=owner_user_id,
        title="Cross Tenant Supplier Quote",
    )

    db = SessionLocal()
    try:
        supplier = Supplier(
            tenant_id=other_tenant_id,
            created_by_id=foreign_user_id,
            company_name="Cross Tenant Revision Supplier",
            phone="5550002222",
            email="cross-tenant-revision-supplier@procureflow.dev",
            is_active=True,
        )
        db.add(supplier)
        db.flush()

        supplier_quote = SupplierQuote(
            quote_id=quote_id,
            supplier_id=supplier.id,
            revision_number=0,
            is_revised_version=False,
            status="yanıtlandı",
            currency="TRY",
            total_amount=100,
            final_amount=100,
        )
        db.add(supplier_quote)
        db.commit()
        db.refresh(supplier_quote)
        supplier_quote_id = supplier_quote.id
    finally:
        db.close()

    headers = _login(
        client,
        "quote-router-revision-cross-tenant-owner@procureflow.dev",
        "Owner123!",
    )
    response = client.post(
        f"/api/v1/quotes/{quote_id}/submit-revision",
        headers=headers,
        json={
            "supplier_quote_id": supplier_quote_id,
            "revised_prices": [
                {"quote_item_id": 1, "unit_price": 50, "total_price": 50}
            ],
        },
    )

    assert response.status_code == 400, response.text
    assert "orijinal teklif bulunamadı" in response.json()["detail"].lower()


def test_quote_tenant_smoke_import_approval_dispatch_and_comparison(client):
    tenant_id = _create_tenant("quote-router-tenant-smoke")
    outsider_tenant_id = _create_tenant("quote-router-tenant-smoke-outsider")

    creator_email = "quote-router-smoke-creator@procureflow.dev"
    manager_email = "quote-router-smoke-manager@procureflow.dev"
    director_email = "quote-router-smoke-director@procureflow.dev"
    outsider_email = "quote-router-smoke-outsider@procureflow.dev"

    creator_id = _upsert_user(
        creator_email,
        "Creator123!",
        tenant_id=tenant_id,
        role="satinalma_uzmani",
        system_role="tenant_admin",
    )
    _upsert_user(
        manager_email,
        "Manager123!",
        tenant_id=tenant_id,
        role="satinalma_yoneticisi",
        system_role="tenant_member",
    )
    _upsert_user(
        director_email,
        "Director123!",
        tenant_id=tenant_id,
        role="satinalma_direktoru",
        system_role="tenant_member",
    )
    _upsert_user(
        outsider_email,
        "Outsider123!",
        tenant_id=outsider_tenant_id,
        role="satinalma_uzmani",
        system_role="tenant_member",
    )

    project_id = _create_project(
        "QUOTE-ROUTER-TENANT-SMOKE",
        tenant_id=tenant_id,
        created_by_id=creator_id,
    )
    supplier_id = _create_project_supplier(
        project_id=project_id,
        tenant_id=tenant_id,
        assigned_by_id=creator_id,
        name="Tenant Smoke Supplier",
    )

    creator_headers = _login(client, creator_email, "Creator123!")
    manager_headers = _login(client, manager_email, "Manager123!")
    director_headers = _login(client, director_email, "Director123!")
    outsider_headers = _login(client, outsider_email, "Outsider123!")

    import_response = client.post(
        f"/api/v1/quotes/import/excel/{project_id}",
        headers=creator_headers,
        files={
            "file": (
                "tenant-smoke.xlsx",
                _build_import_workbook_bytes(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        data={
            "company_name": "Tenant Smoke Company",
            "company_contact_name": "Tenant Smoke Contact",
            "company_contact_phone": "5554443322",
            "company_contact_email": "tenant-smoke@test.dev",
        },
    )

    assert import_response.status_code == 200, import_response.text
    quote_id = int(import_response.json()["quote_id"])

    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit",
        headers=creator_headers,
    )
    assert submit_response.status_code == 200, submit_response.text
    assert submit_response.json()["status"] == "submitted"

    first_approval_response = client.post(
        f"/api/v1/approvals/{quote_id}/approve",
        headers=manager_headers,
        json={"comment": "tenant smoke level 1"},
    )
    assert first_approval_response.status_code == 200, first_approval_response.text
    assert first_approval_response.json()["workflow_completed"] is False

    second_approval_response = client.post(
        f"/api/v1/approvals/{quote_id}/approve",
        headers=director_headers,
        json={"comment": "tenant smoke level 2"},
    )
    assert second_approval_response.status_code == 200, second_approval_response.text

    send_response = client.post(
        f"/api/v1/quotes/{quote_id}/send-to-suppliers",
        headers=creator_headers,
        json=[supplier_id],
    )
    assert send_response.status_code == 200, send_response.text
    assert send_response.json()["created_supplier_ids"] == [supplier_id]

    db = SessionLocal()
    try:
        supplier_quote = (
            db.query(SupplierQuote)
            .filter(
                SupplierQuote.quote_id == quote_id,
                SupplierQuote.supplier_id == supplier_id,
            )
            .first()
        )
        assert supplier_quote is not None
        supplier_quote_items = (
            db.query(SupplierQuoteItem)
            .filter(SupplierQuoteItem.supplier_quote_id == supplier_quote.id)
            .order_by(SupplierQuoteItem.id.asc())
            .all()
        )
        assert supplier_quote_items
        submit_payload = {
            "currency": "TRY",
            "total_amount": 1250,
            "discount_percent": 0,
            "discount_amount": 0,
            "final_amount": 1250,
            "delivery_time": 7,
            "payment_terms": "Pesin",
            "warranty": "12 ay",
            "items": [
                {
                    "quote_item_id": item.quote_item_id,
                    "unit_price": 1250,
                    "total_price": 1250,
                }
                for item in supplier_quote_items
            ],
        }
    finally:
        db.close()

    supplier_submit_response = client.post(
        f"/api/v1/supplier-quotes/{supplier_quote.id}/submit",
        headers=creator_headers,
        json=submit_payload,
    )
    assert supplier_submit_response.status_code == 200, supplier_submit_response.text
    assert supplier_submit_response.json()["status"] == "success"

    comparison_response = client.get(
        f"/api/v1/reports/{quote_id}/comparison",
        headers=creator_headers,
    )
    assert comparison_response.status_code == 200, comparison_response.text
    assert comparison_response.json()["quote_id"] == quote_id
    assert comparison_response.json()["metrics"]

    detailed_comparison_response = client.get(
        f"/api/v1/reports/{quote_id}/comparison/detailed",
        headers=creator_headers,
    )
    assert (
        detailed_comparison_response.status_code == 200
    ), detailed_comparison_response.text
    assert detailed_comparison_response.json()["quote"]["rfq_id"] == quote_id

    outsider_comparison_response = client.get(
        f"/api/v1/reports/{quote_id}/comparison",
        headers=outsider_headers,
    )
    assert (
        outsider_comparison_response.status_code == 403
    ), outsider_comparison_response.text
