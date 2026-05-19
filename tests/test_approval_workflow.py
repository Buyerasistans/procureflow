from api.database import SessionLocal
from api.models import QuoteApproval


def _quote_payload(title: str) -> dict:
    return {
        "project_id": 1,
        "title": title,
        "description": "Approval workflow test quote",
        "company_name": "ProcureFlow Test Company",
        "company_contact_name": "Test Contact",
        "company_contact_phone": "+905551112233",
        "company_contact_email": "contact@procureflow.test",
    }


def _seed_pending_approvals(quote_id: int, levels: int) -> None:
    db = SessionLocal()
    try:
        for level in range(1, levels + 1):
            db.add(
                QuoteApproval(
                    quote_id=quote_id,
                    approval_level=level,
                    required_business_role="*",
                    status="beklemede",
                )
            )
        db.commit()
    finally:
        db.close()


def test_intermediate_approval_keeps_quote_submitted(
    client, setup_test_db, admin_auth_headers, other_user_auth_headers
):
    create_response = client.post(
        "/api/v1/quotes/",
        json=_quote_payload("Approval Stage Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    quote_id = create_response.json()["id"]

    submit_response = client.post(
        f"/api/v1/quotes/{quote_id}/submit", headers=admin_auth_headers
    )
    assert submit_response.status_code == 200, submit_response.text

    _seed_pending_approvals(quote_id, levels=2)

    approve_response = client.post(
        f"/api/v1/approvals/{quote_id}/approve",
        json={"comment": "İlk onay tamamlandı"},
        headers=other_user_auth_headers,
    )
    assert approve_response.status_code == 200, approve_response.text

    quote_response = client.get(
        f"/api/v1/quotes/{quote_id}", headers=admin_auth_headers
    )
    assert quote_response.status_code == 200, quote_response.text
    assert quote_response.json()["status"] == "submitted"


def test_final_approval_and_reject_follow_domain_transitions(
    client, setup_test_db, admin_auth_headers, other_user_auth_headers
):
    create_response = client.post(
        "/api/v1/quotes/",
        json=_quote_payload("Final Approval Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    approved_quote_id = create_response.json()["id"]

    submit_response = client.post(
        f"/api/v1/quotes/{approved_quote_id}/submit", headers=admin_auth_headers
    )
    assert submit_response.status_code == 200, submit_response.text

    _seed_pending_approvals(approved_quote_id, levels=1)

    approve_response = client.post(
        f"/api/v1/approvals/{approved_quote_id}/approve",
        json={"comment": "Final onay"},
        headers=other_user_auth_headers,
    )
    assert approve_response.status_code == 200, approve_response.text

    approved_quote_response = client.get(
        f"/api/v1/quotes/{approved_quote_id}", headers=admin_auth_headers
    )
    assert approved_quote_response.status_code == 200, approved_quote_response.text
    assert approved_quote_response.json()["status"] == "submitted"

    create_response = client.post(
        "/api/v1/quotes/",
        json=_quote_payload("Final Reject Quote"),
        headers=admin_auth_headers,
    )
    assert create_response.status_code == 201, create_response.text
    rejected_quote_id = create_response.json()["id"]

    submit_response = client.post(
        f"/api/v1/quotes/{rejected_quote_id}/submit", headers=admin_auth_headers
    )
    assert submit_response.status_code == 200, submit_response.text

    _seed_pending_approvals(rejected_quote_id, levels=1)

    reject_response = client.post(
        f"/api/v1/approvals/{rejected_quote_id}/reject",
        json={"comment": "Red nedeni"},
        headers=other_user_auth_headers,
    )
    assert reject_response.status_code == 200, reject_response.text

    rejected_quote_response = client.get(
        f"/api/v1/quotes/{rejected_quote_id}", headers=admin_auth_headers
    )
    assert rejected_quote_response.status_code == 200, rejected_quote_response.text
    assert rejected_quote_response.json()["status"] == "draft"
