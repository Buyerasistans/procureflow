"""
Tests for GET /my/applications — candidate application history endpoint.

Covers:
  A) candidate_user receives own applications (200, non-empty list)
  B) user isolation: DB filter is scoped to current_user.id
  C) employer cannot access this endpoint (403)
  D) 200 + [] returned when candidate has no applications

Run:
    cd D:/Projects/procureflow
    api/.venv/Scripts/pytest api/tests/test_job_applications.py -v
"""
from __future__ import annotations

import datetime
from unittest.mock import MagicMock

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(system_role: str, user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.system_role = system_role
    return user


class _FakeApplication:
    """Minimal attribute bag compatible with JobApplicationOut.model_validate (from_attributes=True)."""

    def __init__(self, applicant_user_id: int, app_id: int = 10):
        self.id = app_id
        self.job_id = 42
        self.applicant_user_id = applicant_user_id
        self.talent_profile_id = 1
        self.cover_letter = None
        self.status = "applied"
        self.ai_match_score = None
        self.employer_note = None
        self.reviewed_by_user_id = None
        self.reviewed_at = None
        self.applied_at = datetime.datetime(2026, 5, 27, 12, 0, 0, tzinfo=datetime.timezone.utc)
        self.updated_at = datetime.datetime(2026, 5, 27, 12, 0, 0, tzinfo=datetime.timezone.utc)


def _call_get_my_applications(
    system_role: str = "candidate_user",
    user_id: int = 1,
    db_rows: list | None = None,
):
    """Calls get_my_applications() with mock DB and user directly (no HTTP layer)."""
    from api.routers.job_applications import get_my_applications

    mock_user = _make_user(system_role, user_id)
    mock_db = MagicMock()
    rows = db_rows if db_rows is not None else []
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = rows

    return get_my_applications(current_user=mock_user, db=mock_db)


# ---------------------------------------------------------------------------
# Scenario A — candidate gets own applications (200, list)
# ---------------------------------------------------------------------------

class TestGetMyApplicationsCandidate:

    def test_candidate_user_receives_list(self):
        apps = [_FakeApplication(applicant_user_id=1, app_id=10)]
        result = _call_get_my_applications(system_role="candidate_user", user_id=1, db_rows=apps)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_returned_item_fields_are_correct(self):
        apps = [_FakeApplication(applicant_user_id=1, app_id=10)]
        result = _call_get_my_applications(system_role="candidate_user", user_id=1, db_rows=apps)
        item = result[0]
        assert item.id == 10
        assert item.job_id == 42
        assert item.status == "applied"

    def test_talent_member_role_also_allowed(self):
        apps = [_FakeApplication(applicant_user_id=2, app_id=20)]
        result = _call_get_my_applications(system_role="talent_member", user_id=2, db_rows=apps)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_multiple_applications_all_returned(self):
        apps = [
            _FakeApplication(applicant_user_id=1, app_id=10),
            _FakeApplication(applicant_user_id=1, app_id=11),
        ]
        result = _call_get_my_applications(system_role="candidate_user", user_id=1, db_rows=apps)
        assert len(result) == 2
        ids = [r.id for r in result]
        assert 10 in ids
        assert 11 in ids


# ---------------------------------------------------------------------------
# Scenario B — user isolation: filter is scoped to current_user.id
# ---------------------------------------------------------------------------

class TestGetMyApplicationsIsolation:

    def test_db_query_filter_is_called(self):
        from api.routers.job_applications import get_my_applications

        mock_user = _make_user("candidate_user", user_id=5)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        get_my_applications(current_user=mock_user, db=mock_db)

        mock_db.query.assert_called_once()
        mock_db.query.return_value.filter.assert_called_once()

    def test_empty_list_returned_when_no_matching_rows(self):
        result = _call_get_my_applications(
            system_role="candidate_user", user_id=99, db_rows=[]
        )
        assert result == []


# ---------------------------------------------------------------------------
# Scenario C — employer cannot access (403)
# ---------------------------------------------------------------------------

class TestGetMyApplicationsEmployerForbidden:

    def test_employer_company_admin_raises_403(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_get_my_applications(system_role="employer_company_admin")
        assert exc_info.value.status_code == 403

    def test_employer_recruiter_raises_403(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_get_my_applications(system_role="employer_recruiter")
        assert exc_info.value.status_code == 403

    def test_403_detail_contains_error_code(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _call_get_my_applications(system_role="employer_company_admin")
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("code") == "MY_APPLICATIONS_FORBIDDEN"


# ---------------------------------------------------------------------------
# Scenario D — 200 + [] when no applications exist
# ---------------------------------------------------------------------------

class TestGetMyApplicationsEmptyList:

    def test_returns_empty_list_not_404(self):
        result = _call_get_my_applications(
            system_role="candidate_user", user_id=1, db_rows=[]
        )
        assert result == []
        assert isinstance(result, list)

    def test_empty_result_is_not_none(self):
        result = _call_get_my_applications(
            system_role="candidate_user", user_id=1, db_rows=[]
        )
        assert result is not None


# ---------------------------------------------------------------------------
# Helpers for withdraw tests
# ---------------------------------------------------------------------------

def _call_withdraw(
    system_role: str = "candidate_user",
    user_id: int = 1,
    app_obj=None,
    app_id: int = 10,
):
    """Calls withdraw_application() with mock DB and user directly (no HTTP layer)."""
    from api.routers.job_applications import withdraw_application

    mock_user = _make_user(system_role, user_id)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = app_obj
    return withdraw_application(application_id=app_id, current_user=mock_user, db=mock_db)


# ---------------------------------------------------------------------------
# Scenario A/B/C — withdrawable statuses (200, status=withdrawn)
# ---------------------------------------------------------------------------

class TestWithdrawApplicationSuccess:

    def test_applied_can_be_withdrawn(self):
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "applied"
        result = _call_withdraw(user_id=1, app_obj=app)
        assert result.status == "withdrawn"

    def test_shortlisted_can_be_withdrawn(self):
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "shortlisted"
        result = _call_withdraw(user_id=1, app_obj=app)
        assert result.status == "withdrawn"

    def test_interview_can_be_withdrawn(self):
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "interview"
        result = _call_withdraw(user_id=1, app_obj=app)
        assert result.status == "withdrawn"


# ---------------------------------------------------------------------------
# Scenario D — terminal/invalid statuses → 400
# ---------------------------------------------------------------------------

class TestWithdrawApplicationInvalidStatus:

    def test_offered_raises_400(self):
        from fastapi import HTTPException
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "offered"
        with pytest.raises(HTTPException) as exc_info:
            _call_withdraw(user_id=1, app_obj=app)
        assert exc_info.value.status_code == 400
        assert exc_info.value.detail.get("code") == "WITHDRAW_INVALID_STATUS"

    def test_rejected_raises_400(self):
        from fastapi import HTTPException
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "rejected"
        with pytest.raises(HTTPException) as exc_info:
            _call_withdraw(user_id=1, app_obj=app)
        assert exc_info.value.status_code == 400

    def test_withdrawn_raises_400(self):
        from fastapi import HTTPException
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "withdrawn"
        with pytest.raises(HTTPException) as exc_info:
            _call_withdraw(user_id=1, app_obj=app)
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# Scenario E — other user's application → 403
# ---------------------------------------------------------------------------

class TestWithdrawApplicationOwnership:

    def test_other_users_application_raises_403(self):
        from fastapi import HTTPException
        app = _FakeApplication(applicant_user_id=99, app_id=10)  # owned by user 99
        app.status = "applied"
        with pytest.raises(HTTPException) as exc_info:
            _call_withdraw(user_id=1, app_obj=app)  # user 1 tries to withdraw
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail.get("code") == "WITHDRAW_OWNERSHIP"


# ---------------------------------------------------------------------------
# Scenario F — employer role → 403
# ---------------------------------------------------------------------------

class TestWithdrawApplicationEmployerForbidden:

    def test_employer_raises_403(self):
        from fastapi import HTTPException
        app = _FakeApplication(applicant_user_id=1, app_id=10)
        app.status = "applied"
        with pytest.raises(HTTPException) as exc_info:
            _call_withdraw(user_id=1, system_role="employer_company_admin", app_obj=app)
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail.get("code") == "WITHDRAW_FORBIDDEN"
