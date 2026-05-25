"""
Auth login regression tests.

Root cause documented (2026-05-22): DB wiped during restore drill; only
super_admin was bootstrapped via ensure_runtime_super_admin(). Normal users
were absent → login returned 401 (user not found, indistinguishable from
wrong-password response). Re-seeding via bootstrap_scope_demo_data fixed it.

These tests guard against silent auth breakage: wrong hash, missing user,
inactive state, and alias resolution must all behave predictably.

Run:
    cd D:/Projects/procureflow
    api/.venv/Scripts/pytest api/tests/test_auth_login.py -v
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from api.core.security import get_password_hash, verify_password


# ---------------------------------------------------------------------------
# Unit: verify_password / get_password_hash
# ---------------------------------------------------------------------------

class TestVerifyPassword:
    def test_correct_password_returns_true(self):
        h = get_password_hash("MyP@ss1234")
        assert verify_password("MyP@ss1234", h) is True

    def test_wrong_password_returns_false(self):
        h = get_password_hash("MyP@ss1234")
        assert verify_password("wrongpass", h) is False

    def test_empty_password_returns_false(self):
        h = get_password_hash("MyP@ss1234")
        assert verify_password("", h) is False

    def test_unknown_hash_returns_false(self):
        assert verify_password("anything", "not-a-valid-hash") is False

    def test_hash_differs_from_plaintext(self):
        pw = "MyP@ss1234"
        assert get_password_hash(pw) != pw

    def test_two_hashes_of_same_password_differ(self):
        """pbkdf2_sha256 uses a random salt per call."""
        pw = "MyP@ss1234"
        assert get_password_hash(pw) != get_password_hash(pw)


# ---------------------------------------------------------------------------
# Unit: _resolve_login_user alias resolution
# ---------------------------------------------------------------------------

class TestResolveLoginUser:
    """Tests _resolve_login_user without hitting a real DB."""

    def _make_db(self, user_map: dict[str, object]) -> MagicMock:
        """Build a mock Session whose query().filter().first() looks up by email."""
        db = MagicMock()

        def _first_side_effect(*args, **kwargs):
            # Capture the filter value by inspecting the call chain
            return None

        query_mock = MagicMock()
        filter_mock = MagicMock()
        filter_mock.first.return_value = None
        query_mock.filter.return_value = filter_mock
        db.query.return_value = query_mock
        return db

    def test_canonical_email_found(self):
        from api.routers.auth import _resolve_login_user

        user = MagicMock()
        user.email = "superadmin@buyerasistans.com.tr"

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = user

        result = _resolve_login_user(db, "superadmin@buyerasistans.com.tr")
        assert result is user

    def test_unknown_email_returns_none(self):
        from api.routers.auth import _resolve_login_user

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        result = _resolve_login_user(db, "nobody@example.com")
        assert result is None

    def test_empty_email_returns_none(self):
        from api.routers.auth import _resolve_login_user

        db = MagicMock()
        result = _resolve_login_user(db, "")
        assert result is None

    def test_alias_resolution_legacy_to_canonical(self):
        """Login with superadmin@procureflow.com must resolve via alias."""
        from api.routers.auth import _resolve_login_user, LOGIN_EMAIL_COMPATIBILITY_ALIASES

        assert "superadmin@procureflow.com" in LOGIN_EMAIL_COMPATIBILITY_ALIASES, (
            "Legacy alias must remain in LOGIN_EMAIL_COMPATIBILITY_ALIASES"
        )

        canonical_user = MagicMock()
        canonical_user.email = "superadmin@buyerasistans.com.tr"

        call_count = {"n": 0}

        def first_side_effect():
            call_count["n"] += 1
            if call_count["n"] == 1:
                return None  # first try (legacy email) → not found
            return canonical_user  # second try (canonical alias) → found

        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = first_side_effect

        result = _resolve_login_user(db, "superadmin@procureflow.com")
        assert result is canonical_user


# ---------------------------------------------------------------------------
# Integration: login handler logic via mock DB
# Tests the login() function directly, bypassing HTTP transport and
# DB setup complexity while still exercising the real auth code path.
# ---------------------------------------------------------------------------

def _make_user(
    email: str = "user@example.com",
    password: str = "TestPass#9876",
    is_active: bool = True,
    hidden_from_admin: bool = False,
    system_role: str = "satinalmaci",
    role: str = "satinalmaci",
) -> MagicMock:
    u = MagicMock()
    u.id = 1
    u.email = email
    u.work_email = email
    u.full_name = "Test User"
    u.role = role
    u.system_role = system_role
    u.is_active = is_active
    u.hidden_from_admin = hidden_from_admin
    u.hashed_password = get_password_hash(password)
    u.tenant_id = None
    u.scope_type = None
    u.department_id = None
    u.invitation_accepted = True
    return u


def _call_login(email: str, password: str, db_user: object | None):
    """
    Calls the login() endpoint function directly with a mock DB session.
    Returns the response dict on success, or re-raises the HTTPException.
    """
    from api.routers.auth import login, LoginIn
    from api.core.security import create_access_token, create_refresh_token

    mock_db = MagicMock()

    with (
        patch("api.routers.auth._resolve_login_user", return_value=db_user),
        patch("api.routers.auth._build_auth_user_payload", return_value={
            "id": getattr(db_user, "id", 1),
            "email": email,
            "work_email": email,
            "role": getattr(db_user, "role", "satinalmaci"),
            "business_role": getattr(db_user, "role", "satinalmaci"),
            "system_role": getattr(db_user, "system_role", "satinalmaci"),
            "full_name": "Test",
            "department_id": None,
            "tenant_id": None,
            "scope_type": None,
        }),
        patch("api.routers.auth.decode_refresh_token", return_value={"jti": "test-jti", "sub": "1"}),
        patch("api.routers.auth.hash_jti", return_value="hashed-jti"),
        patch.object(mock_db, "add"),
        patch.object(mock_db, "commit"),
    ):
        return login(LoginIn(email=email, password=password), db=mock_db)


class TestLoginHandler:
    TEST_PW = "TestPass#9876"

    def test_valid_login_returns_token_pair(self):
        user = _make_user(password=self.TEST_PW)
        result = _call_login("user@example.com", self.TEST_PW, user)
        # login() returns a TokenPairResponse (Pydantic model or dict depending on serialization)
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert "access_token" in result_dict
        assert "refresh_token" in result_dict

    def test_wrong_password_raises_401(self):
        from fastapi import HTTPException
        user = _make_user(password=self.TEST_PW)
        with pytest.raises(HTTPException) as exc_info:
            _call_login("user@example.com", "wrongpassword", user)
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid credentials"

    def test_user_not_found_raises_401(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_login("nobody@example.com", "anything", None)
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid credentials"

    def test_inactive_user_raises_403(self):
        from fastapi import HTTPException
        user = _make_user(password=self.TEST_PW, is_active=False)
        with pytest.raises(HTTPException) as exc_info:
            _call_login("user@example.com", self.TEST_PW, user)
        assert exc_info.value.status_code == 403

    def test_empty_password_raises_401(self):
        from fastapi import HTTPException
        user = _make_user(password=self.TEST_PW)
        with pytest.raises(HTTPException) as exc_info:
            _call_login("user@example.com", "", user)
        assert exc_info.value.status_code == 401

    def test_wrong_and_notfound_return_identical_detail(self):
        """Prevent user enumeration: both 401 paths must expose the same detail string."""
        from fastapi import HTTPException
        user = _make_user(password=self.TEST_PW)
        with pytest.raises(HTTPException) as exc_wrong:
            _call_login("user@example.com", "badpassword", user)
        with pytest.raises(HTTPException) as exc_notfound:
            _call_login("nobody@example.com", "badpassword", None)
        assert exc_wrong.value.detail == exc_notfound.value.detail
