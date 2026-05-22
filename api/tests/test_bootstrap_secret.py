"""
PR-2: _get_super_admin_password env-zorunlu testleri.

Çalıştırmak için:
    cd D:/Projects/procureflow/api
    pytest tests/test_bootstrap_secret.py -v
"""
from __future__ import annotations

from unittest.mock import patch

import pytest


def _call_under(env_override: dict[str, str]) -> str:
    """
    dotenv yüklemesini bypass ederek _get_super_admin_password'ü çağırır.
    patch.dict önce uygulanır, import sonra gerçekleşir (module cache'siz).
    """
    import importlib
    import sys

    # Modülü önbellekten temizle (dotenv yan etkisini sıfırla)
    for key in list(sys.modules.keys()):
        if "runtime_bootstrap" in key:
            del sys.modules[key]

    with patch.dict("os.environ", env_override, clear=True), \
         patch("dotenv.load_dotenv"):          # dotenv re-load'ı engelle
        import api.services.runtime_bootstrap as mod  # noqa: F401
        return mod._get_super_admin_password()


class TestGetSuperAdminPassword:
    def test_missing_raises_runtime_error(self):
        """SUPER_ADMIN_PASSWORD env'de yoksa RuntimeError."""
        with pytest.raises(RuntimeError, match="SUPER_ADMIN_PASSWORD"):
            _call_under({})

    def test_empty_string_raises_runtime_error(self):
        """SUPER_ADMIN_PASSWORD='' ise RuntimeError."""
        with pytest.raises(RuntimeError, match="SUPER_ADMIN_PASSWORD"):
            _call_under({"SUPER_ADMIN_PASSWORD": ""})

    def test_whitespace_only_raises_runtime_error(self):
        """SUPER_ADMIN_PASSWORD='   ' ise RuntimeError (strip sonrası boş)."""
        with pytest.raises(RuntimeError, match="SUPER_ADMIN_PASSWORD"):
            _call_under({"SUPER_ADMIN_PASSWORD": "   "})

    def test_valid_password_returned(self):
        """Geçerli şifre olduğunda değeri döndürür."""
        result = _call_under({"SUPER_ADMIN_PASSWORD": "S3cur3P@ssw0rd!"})
        assert result == "S3cur3P@ssw0rd!"

    def test_password_not_logged(self, capsys):
        """Şifre stdout'a yazılmamalı."""
        _call_under({"SUPER_ADMIN_PASSWORD": "S3cur3P@ssw0rd!"})
        captured = capsys.readouterr()
        assert "S3cur3P@ssw0rd!" not in captured.out
        assert "S3cur3P@ssw0rd!" not in captured.err

    def test_hardcoded_value_gone(self):
        """'Aa1234!!' string'i runtime_bootstrap.py kaynak kodunda olmamalı."""
        import inspect
        import importlib
        import sys
        for key in list(sys.modules.keys()):
            if "runtime_bootstrap" in key:
                del sys.modules[key]
        with patch("dotenv.load_dotenv"), \
             patch.dict("os.environ", {"SUPER_ADMIN_PASSWORD": "placeholder"}):
            import api.services.runtime_bootstrap as mod
        src = inspect.getsource(mod)
        assert "Aa1234!!" not in src, "Hardcoded şifre hâlâ kaynak kodda!"
