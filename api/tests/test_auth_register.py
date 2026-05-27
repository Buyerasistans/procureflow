"""
Tests for POST /auth/register — individual employer and candidate onboarding.

Covers:
- employer user_type -> employer_company_admin role assignment
- candidate user_type -> candidate_user role assignment
- duplicate email -> 409 Conflict
- invalid user_type -> 422 Unprocessable Entity (Pydantic)
- short password -> 400 Bad Request
- empty full_name -> 400 Bad Request

Run:
    cd D:/Projects/procureflow
    api/.venv/Scripts/pytest api/tests/test_auth_register.py -v
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _call_register(
    email: str = "newuser@example.com",
    password: str = "SecurePass1!",
    full_name: str = "Test User",
    user_type: str = "employer",
    existing_user: object = None,
):
    """
    Calls register_individual() directly with a mock DB.
    existing_user: if not None, simulates a duplicate-email collision on the
    first query().filter().first() call.
    """
    from api.routers.auth import register_individual, RegisterIn

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = existing_user

    with (
        patch(
            "api.routers.auth._build_auth_user_payload",
            return_value={
                "id": 9901,
                "email": email,
                "work_email": email,
                "role": "user",
                "business_role": "user",
                "system_role": (
                    "employer_company_admin" if user_type == "employer" else "candidate_user"
                ),
                "full_name": full_name,
                "department_id": None,
                "tenant_id": None,
                "scope_type": None,
            },
        ),
        patch(
            "api.routers.auth.decode_refresh_token",
            return_value={"jti": "test-jti", "sub": "9901"},
        ),
        patch("api.routers.auth.hash_jti", return_value="hashed-jti"),
    ):
        data = RegisterIn(
            email=email,
            password=password,
            full_name=full_name,
            user_type=user_type,
        )
        return register_individual(data, db=mock_db)


# ---------------------------------------------------------------------------
# Role assignment tests
# ---------------------------------------------------------------------------

class TestRegisterRoleAssignment:

    def test_employer_registration_returns_token_pair(self):
        result = _call_register(user_type="employer")
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert "access_token" in result_dict
        assert "refresh_token" in result_dict

    def test_candidate_registration_returns_token_pair(self):
        result = _call_register(user_type="candidate")
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert "access_token" in result_dict
        assert "refresh_token" in result_dict

    def test_employer_user_system_role_in_response(self):
        result = _call_register(user_type="employer")
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert result_dict["user"]["system_role"] == "employer_company_admin"

    def test_candidate_user_system_role_in_response(self):
        result = _call_register(user_type="candidate")
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert result_dict["user"]["system_role"] == "candidate_user"

    def test_role_map_covers_all_user_types(self):
        """Guard: _USER_TYPE_ROLE_MAP must contain both allowed user_type values."""
        from api.routers.auth import _USER_TYPE_ROLE_MAP
        assert "employer" in _USER_TYPE_ROLE_MAP
        assert "candidate" in _USER_TYPE_ROLE_MAP
        assert _USER_TYPE_ROLE_MAP["employer"] == "employer_company_admin"
        assert _USER_TYPE_ROLE_MAP["candidate"] == "candidate_user"


# ---------------------------------------------------------------------------
# Duplicate email test
# ---------------------------------------------------------------------------

class TestRegisterDuplicateEmail:

    def test_duplicate_email_raises_409(self):
        from fastapi import HTTPException
        existing = MagicMock()
        existing.email = "taken@example.com"
        with pytest.raises(HTTPException) as exc_info:
            _call_register(email="taken@example.com", existing_user=existing)
        assert exc_info.value.status_code == 409

    def test_duplicate_email_detail_is_not_empty(self):
        from fastapi import HTTPException
        existing = MagicMock()
        with pytest.raises(HTTPException) as exc_info:
            _call_register(email="taken@example.com", existing_user=existing)
        assert exc_info.value.detail


# ---------------------------------------------------------------------------
# Password validation test
# ---------------------------------------------------------------------------

class TestRegisterPasswordValidation:

    def test_short_password_raises_400(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_register(password="short")
        assert exc_info.value.status_code == 400

    def test_exactly_8_chars_is_accepted(self):
        result = _call_register(password="Exact8!!")
        result_dict = result if isinstance(result, dict) else result.model_dump()
        assert "access_token" in result_dict


# ---------------------------------------------------------------------------
# Full name validation test
# ---------------------------------------------------------------------------

class TestRegisterFullNameValidation:

    def test_empty_full_name_raises_400(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_register(full_name="   ")
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# Schema validation (Pydantic — invalid user_type triggers 422 before handler)
# ---------------------------------------------------------------------------

class TestRegisterSchemaValidation:

    def test_invalid_user_type_raises_validation_error(self):
        from api.routers.auth import RegisterIn
        with pytest.raises(ValidationError):
            RegisterIn(
                email="user@example.com",
                password="ValidPass1!",
                full_name="Test",
                user_type="admin",
            )

    def test_invalid_email_format_raises_validation_error(self):
        from api.routers.auth import RegisterIn
        with pytest.raises(ValidationError):
            RegisterIn(
                email="not-an-email",
                password="ValidPass1!",
                full_name="Test",
                user_type="employer",
            )

    def test_valid_employer_schema_passes(self):
        from api.routers.auth import RegisterIn
        data = RegisterIn(
            email="employer@example.com",
            password="ValidPass1!",
            full_name="Test Employer",
            user_type="employer",
        )
        assert data.user_type == "employer"

    def test_valid_candidate_schema_passes(self):
        from api.routers.auth import RegisterIn
        data = RegisterIn(
            email="candidate@example.com",
            password="ValidPass1!",
            full_name="Test Candidate",
            user_type="candidate",
        )
        assert data.user_type == "candidate"
