def test_me_with_valid_token(client, auth_headers):
    res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert "email" in body
    assert "role" in body
    assert "business_role" in body
    assert "system_role" in body
    assert body["role"] == body["business_role"]


def test_me_without_token(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code in (401, 403)
