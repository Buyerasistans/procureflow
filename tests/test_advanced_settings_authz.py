from api.database import SessionLocal
from api.models.user import User
from api.core.security import get_password_hash


def _upsert_user(email: str, password: str, *, role: str, system_role: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.role = role
            existing.system_role = system_role
            existing.hashed_password = get_password_hash(password)
            existing.is_active = True
        else:
            db.add(
                User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    full_name=email.split("@")[0],
                    role=role,
                    system_role=system_role,
                    is_active=True,
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


def test_email_profiles_platform_support_only_sees_personal_profile(client):
    _upsert_user(
        "advanced-support@procureflow.dev",
        "Support123!",
        role="user",
        system_role="platform_support",
    )
    token = _login(client, "advanced-support@procureflow.dev", "Support123!")

    response = client.get(
        "/api/v1/advanced-settings/email/profiles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["kind"] == "personal"
    assert data[0]["label"] == "Kendi SMTP profilim"


def test_email_profiles_super_admin_sees_shared_profiles(client):
    _upsert_user(
        "advanced-super@procureflow.dev",
        "Super123!",
        role="super_admin",
        system_role="super_admin",
    )
    token = _login(client, "advanced-super@procureflow.dev", "Super123!")

    response = client.get(
        "/api/v1/advanced-settings/email/profiles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert any(item["kind"] == "default" for item in data)
