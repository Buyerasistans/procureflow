def test_tenant_member_cannot_access_other_user_profile(client, user_auth_headers):
    response = client.get("/api/v1/users/1/profile", headers=user_auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Sadece admin bu işlemi yapabilir"


def test_tenant_admin_can_access_other_user_profile(client, admin_auth_headers):
    response = client.get("/api/v1/users/2/profile", headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "user@procureflow.dev"
