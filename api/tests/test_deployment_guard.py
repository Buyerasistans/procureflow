"""
PR-1: _require_local_env deny-by-default guard testleri.

Çalıştırmak için:
    cd D:/Projects/procureflow/api
    pytest tests/test_deployment_guard.py -v
"""
from __future__ import annotations

import importlib
from unittest.mock import patch

import pytest
from fastapi import HTTPException


def _guard(app_env_value: str | None) -> None:
    """_require_local_env'i verilen APP_ENV değeriyle çağırır."""
    import api.routers.admin_deployment as mod

    env = {} if app_env_value is None else {"APP_ENV": app_env_value}
    with patch.dict("os.environ", env, clear=app_env_value is None):
        mod._require_local_env()


class TestRequireLocalEnvDenyByDefault:
    def test_unset_raises_403(self):
        """APP_ENV tanımlı değilse 403."""
        with patch.dict("os.environ", {}, clear=True):
            import api.routers.admin_deployment as mod
            with pytest.raises(HTTPException) as exc:
                mod._require_local_env()
        assert exc.value.status_code == 403

    def test_empty_string_raises_403(self):
        """APP_ENV='' ise 403."""
        with patch.dict("os.environ", {"APP_ENV": ""}):
            import api.routers.admin_deployment as mod
            with pytest.raises(HTTPException) as exc:
                mod._require_local_env()
        assert exc.value.status_code == 403

    def test_production_raises_403(self):
        """APP_ENV=production ise 403."""
        with patch.dict("os.environ", {"APP_ENV": "production"}):
            import api.routers.admin_deployment as mod
            with pytest.raises(HTTPException) as exc:
                mod._require_local_env()
        assert exc.value.status_code == 403

    def test_staging_raises_403(self):
        """APP_ENV=staging ise 403 (allowlist dışı)."""
        with patch.dict("os.environ", {"APP_ENV": "staging"}):
            import api.routers.admin_deployment as mod
            with pytest.raises(HTTPException) as exc:
                mod._require_local_env()
        assert exc.value.status_code == 403

    def test_development_passes(self):
        """APP_ENV=development ise guard geçer (istisna yok)."""
        with patch.dict("os.environ", {"APP_ENV": "development"}):
            import api.routers.admin_deployment as mod
            mod._require_local_env()  # istisna fırlatmamalı

    def test_dev_alias_passes(self):
        """APP_ENV=dev ise guard geçer."""
        with patch.dict("os.environ", {"APP_ENV": "dev"}):
            import api.routers.admin_deployment as mod
            mod._require_local_env()

    def test_local_alias_passes(self):
        """APP_ENV=local ise guard geçer."""
        with patch.dict("os.environ", {"APP_ENV": "local"}):
            import api.routers.admin_deployment as mod
            mod._require_local_env()

    def test_case_insensitive(self):
        """APP_ENV=DEVELOPMENT (büyük harf) geçer."""
        with patch.dict("os.environ", {"APP_ENV": "DEVELOPMENT"}):
            import api.routers.admin_deployment as mod
            mod._require_local_env()

    def test_detail_message_contains_hint(self):
        """403 mesajı izin verilen değerleri içermeli."""
        with patch.dict("os.environ", {"APP_ENV": "production"}):
            import api.routers.admin_deployment as mod
            with pytest.raises(HTTPException) as exc:
                mod._require_local_env()
        assert "APP_ENV" in exc.value.detail
