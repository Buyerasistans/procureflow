def test_tenant_member_cannot_list_permission_catalog_from_admin_api(
    client, user_auth_headers
):
    response = client.get(
        "/api/v1/admin/permissions",
        headers=user_auth_headers,
    )

    assert response.status_code == 403, response.text
    assert "admin" in response.json()["detail"].lower()
