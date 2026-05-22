from api.database import SessionLocal
from api.models.user import User
from api.core.security import get_password_hash


def _create_user(email: str, password: str, *, role: str, system_role: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = role
            existing.system_role = system_role
            existing.hashed_password = get_password_hash(password)
            existing.is_active = True
            existing.hidden_from_admin = False
        else:
            db.add(
                User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    full_name=email.split("@")[0],
                    role=role,
                    system_role=system_role,
                    is_active=True,
                    hidden_from_admin=False,
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


def test_delete_user_blocks_last_visible_super_admin(client):
    _create_user(
        "delete-super-admin-caller@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    _create_user(
        "delete-super-admin-target@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )

    token = _login(client, "delete-super-admin-caller@procureflow.dev", "Super123!")

    db = SessionLocal()
    try:
        caller = (
            db.query(User)
            .filter(User.email == "delete-super-admin-caller@procureflow.dev")
            .first()
        )
        target = (
            db.query(User)
            .filter(User.email == "delete-super-admin-target@procureflow.dev")
            .first()
        )
        assert caller is not None
        assert target is not None

        caller.hidden_from_admin = True
        target.is_active = False
        target.hidden_from_admin = False
        db.commit()
        target_id = target.id
    finally:
        db.close()

    response = client.delete(
        f"/api/v1/admin/users/{target_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] == "Son super admin kaydı kaldırılamaz."
