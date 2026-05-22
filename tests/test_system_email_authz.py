def test_tenant_member_cannot_list_system_emails(client, user_auth_headers):
    response = client.get("/api/v1/system-emails", headers=user_auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin yetkisi gerekli"


def test_tenant_admin_can_list_system_emails(client, admin_auth_headers):
    response = client.get("/api/v1/system-emails", headers=admin_auth_headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)
