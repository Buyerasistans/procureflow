import pytest
from fastapi import HTTPException

from api.database import SessionLocal
from api.models import QuoteApproval
from api.routers.approval_router import _require_quote_tenant_scope


def test_tenant_admin_sees_pending_approvals_without_business_role_filter(
    client, admin_auth_headers
):
    create_response = client.post(
        "/api/v1/quotes/",
        json={
            "project_id": 1,
            "title": "Admin Pending Approval Visibility",
            "company_name": "TestCorp",
            "company_contact_name": "Admin Contact",
            "company_contact_phone": "555-0101",
            "company_contact_email": "admin-visible@test.com",
        },
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    quote_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        db.add(
            QuoteApproval(
                quote_id=quote_id,
                approval_level=1,
                required_business_role="satinalma_uzmani",
                status="beklemede",
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/v1/approvals/user/pending", headers=admin_auth_headers)

    assert response.status_code == 200, response.text
    matching_item = next(
        item for item in response.json() if item["quote_id"] == quote_id
    )
    assert matching_item["required_business_role"] == "satinalma_uzmani"
    assert matching_item["required_role"] == "satinalma_uzmani"
    assert "required_role_mirror" in matching_item


def test_pending_approvals_synthesize_required_role_when_mirror_is_null(
    client, admin_auth_headers
):
    create_response = client.post(
        "/api/v1/quotes/",
        json={
            "project_id": 1,
            "title": "Approval Mirror Null Compatibility",
            "company_name": "TestCorp",
            "company_contact_name": "Admin Contact",
            "company_contact_phone": "555-0103",
            "company_contact_email": "admin-mirror-null@test.com",
        },
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    quote_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        db.add(
            QuoteApproval(
                quote_id=quote_id,
                approval_level=1,
                required_role=None,
                required_business_role="satinalma_uzmani",
                status="beklemede",
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/v1/approvals/user/pending", headers=admin_auth_headers)

    assert response.status_code == 200, response.text
    matching_item = next(
        item for item in response.json() if item["quote_id"] == quote_id
    )
    assert matching_item["required_business_role"] == "satinalma_uzmani"
    assert matching_item["required_role"] == "satinalma_uzmani"
    assert matching_item["required_role_mirror"] is None


def test_tenant_member_pending_approvals_respect_business_role_filter(
    client, admin_auth_headers, user_auth_headers
):
    create_response = client.post(
        "/api/v1/quotes/",
        json={
            "project_id": 1,
            "title": "Member Pending Approval Visibility",
            "company_name": "TestCorp",
            "company_contact_name": "Member Contact",
            "company_contact_phone": "555-0102",
            "company_contact_email": "member-hidden@test.com",
        },
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    quote_id = create_response.json()["id"]

    db = SessionLocal()
    try:
        db.add(
            QuoteApproval(
                quote_id=quote_id,
                approval_level=1,
                required_business_role="satinalma_uzmani",
                status="beklemede",
            )
        )
        db.commit()
    finally:
        db.close()

    response = client.get("/api/v1/approvals/user/pending", headers=user_auth_headers)

    assert response.status_code == 200, response.text
    assert all(item["quote_id"] != quote_id for item in response.json())


def test_request_approval_requires_quote_tenant_scope_for_tenant_user():
    quote = type("QuoteStub", (), {"tenant_id": None})()
    current_user = type("UserStub", (), {"tenant_id": 42})()

    with pytest.raises(HTTPException) as exc_info:
        _require_quote_tenant_scope(quote, current_user)

    assert exc_info.value.status_code == 400
    assert "tenant backfill" in str(exc_info.value.detail).lower()
