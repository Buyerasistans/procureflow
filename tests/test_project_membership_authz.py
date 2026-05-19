from api.database import SessionLocal
from api.models.user import User


def _get_user_id(email: str) -> int:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user.id
    finally:
        db.close()


def test_tenant_member_cannot_assign_user_to_project(client, user_auth_headers):
    target_user_id = _get_user_id("other@procureflow.dev")

    response = client.post(
        f"/api/v1/admin/users/{target_user_id}/projects/1",
        headers=user_auth_headers,
    )

    assert response.status_code == 403, response.text
    assert "admin" in response.json()["detail"].lower()


def test_tenant_member_cannot_remove_user_from_project(client, user_auth_headers):
    target_user_id = _get_user_id("admin@procureflow.dev")

    response = client.delete(
        f"/api/v1/admin/users/{target_user_id}/projects/1",
        headers=user_auth_headers,
    )

    assert response.status_code == 403, response.text
    assert "admin" in response.json()["detail"].lower()
