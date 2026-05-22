def test_tenant_member_cannot_list_department_catalog_from_admin_api(
    client, user_auth_headers
):
    response = client.get(
        "/api/v1/admin/departments",
        headers=user_auth_headers,
    )

    assert response.status_code == 403, response.text
    assert "katalog" in response.json()["detail"].lower()
