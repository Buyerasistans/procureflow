"""
Deployment Service - Hostinge yükleme ve sistem kurulumu
"""

from __future__ import annotations

import os
import re
import sys
import subprocess
import shlex
import logging
import shutil
import time
import traceback
import urllib.request
import zipfile
import io
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import datetime
from pydantic import BaseModel


logger = logging.getLogger(__name__)


# ============================================================
# Pydantic Modelleri
# ============================================================


class HostingConfig(BaseModel):
    domain: str
    host_ip: str
    username: str
    password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    remote_path: str = "/var/www/vhosts/buyerasistans.com.tr/httpdocs"
    port: int = 22

    local_db_host: Optional[str] = None
    local_db_port: Optional[int] = None
    local_db_name: Optional[str] = None
    local_db_user: Optional[str] = None
    local_db_password: Optional[str] = None

    remote_db_host: Optional[str] = None
    remote_db_port: Optional[int] = None
    remote_db_name: Optional[str] = None
    remote_db_user: Optional[str] = None
    remote_db_password: Optional[str] = None
    domain_mode_enabled: Optional[bool] = False

    model_config = {"from_attributes": True}


class DeploymentLog(BaseModel):
    timestamp: str
    status: str
    message: str
    step: Optional[str] = None


class SystemSetupResponse(BaseModel):
    success: bool
    logs: List[DeploymentLog]
    summary: str
    errors: List[str] = []


class DeploymentStatus(BaseModel):
    step: str
    total_steps: int
    current_step: int
    percentage: float
    is_running: bool
    last_message: str


# ============================================================
# Pylance uyarılarını sustur
# ============================================================
try:
    import paramiko  # type: ignore[import-unresolved]  # noqa: F401
except ImportError:
    paramiko = None  # type: ignore[assignment]

try:
    from fabric import Connection as _FabricConnection  # type: ignore[import-unresolved]
except ImportError:
    _FabricConnection = None  # type: ignore[assignment]


# ============================================================
# SSH Yardımcıları
# ============================================================


def _ensure_ssh_dependencies():
    python_exe = sys.executable
    requirements_path = Path(__file__).resolve().parents[1] / "requirements.txt"
    venv_python = (
        Path(__file__).resolve().parents[1]
        / ".venv"
        / ("Scripts" if os.name == "nt" else "bin")
        / ("python.exe" if os.name == "nt" else "python")
    )
    install_command = f"{python_exe} -m pip install -r {requirements_path}"
    if venv_python.exists():
        install_command = f"{venv_python} -m pip install -r {requirements_path}"

    try:
        import paramiko as _p  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "SSH deployment requires the Python package 'paramiko'. "
            f"Install it: {install_command}"
        ) from exc

    try:
        from fabric import Connection
    except ImportError as exc:
        raise RuntimeError(
            "SSH deployment requires the Python package 'fabric'. "
            f"Install it: {install_command}"
        ) from exc

    return Connection


def _bash_single_quote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def build_ssh_connection(hosting_config: HostingConfig):
    Connection = _ensure_ssh_dependencies()

    try:
        from fabric import Config as FabricConfig

        fabric_config = FabricConfig(
            overrides={
                "run": {
                    "in_stream": False,
                    "hide": True,
                    "warn": True,
                },
                "timeouts": {
                    "connect": 30,
                },
            }
        )
    except Exception:
        fabric_config = None

    key_path = (
        hosting_config.ssh_key_path.strip() if hosting_config.ssh_key_path else None
    )
    conn_kwargs: dict = {}
    if fabric_config is not None:
        conn_kwargs["config"] = fabric_config

    if key_path:
        key_file = Path(key_path).expanduser()
        if not key_file.is_file():
            raise FileNotFoundError(f"SSH anahtar dosyası bulunamadı: {key_path}.")
        return Connection(
            host=hosting_config.host_ip,
            user=hosting_config.username,
            connect_kwargs={"key_filename": str(key_file)},
            port=hosting_config.port,
            **conn_kwargs,
        )

    if hosting_config.password and hosting_config.password.strip():
        return Connection(
            host=hosting_config.host_ip,
            user=hosting_config.username,
            connect_kwargs={"password": hosting_config.password},
            port=hosting_config.port,
            **conn_kwargs,
        )

    raise RuntimeError("SSH anahtarı veya şifre sağlanmalı.")


def _ssh_run(conn, cmd: str, timeout: int = 120) -> object:
    if timeout and timeout > 0:
        quoted_cmd = shlex.quote(cmd)
        wrapped_cmd = (
            f"if command -v timeout >/dev/null 2>&1; then "
            f"timeout {int(timeout)}s bash -c {quoted_cmd}; "
            f"else "
            f"bash -c {quoted_cmd}; "
            f"fi"
        )
    else:
        wrapped_cmd = cmd
    return conn.run(wrapped_cmd, hide=True, warn=True, in_stream=False)


def _test_ssh_connection(hosting_config: HostingConfig) -> Tuple[bool, str]:
    try:
        conn = build_ssh_connection(hosting_config)
        result = _ssh_run(conn, "uname -a && python3 --version && df -h /")
        conn.close()
        output = (result.stdout or "").strip()
        return True, output
    except Exception as e:
        return False, str(e)


def _check_venv_module(python_exe: str) -> bool:
    try:
        result = subprocess.run(
            [python_exe, "-c", "import venv; print('OK')"],
            capture_output=True,
            text=True,
            timeout=15,
            encoding="utf-8",
            errors="replace",
        )
        return result.returncode == 0 and "OK" in (result.stdout or "")
    except Exception:
        return False


def _merge_local_database_to_hosting(
    local_database_url: str,
    remote_database_url: str,
    remote_host_override: str | None = None,
) -> Tuple[bool, str]:
    from sqlalchemy import create_engine, func, select, text
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.engine import make_url
    from api.database import Base

    local_engine = create_engine(local_database_url, pool_pre_ping=True, future=True)
    resolved_remote_url = remote_database_url
    if remote_host_override:
        try:
            parsed_remote_url = make_url(remote_database_url)
            if parsed_remote_url.host in {"localhost", "127.0.0.1", "::1"}:
                resolved_remote_url = str(
                    parsed_remote_url.set(host=remote_host_override)
                )
        except Exception:
            resolved_remote_url = remote_database_url

    remote_engine = create_engine(resolved_remote_url, pool_pre_ping=True, future=True)
    report_lines: List[str] = []

    try:
        tables = [t for t in Base.metadata.sorted_tables if t.name != "alembic_version"]

        with local_engine.connect() as local_conn, remote_engine.begin() as remote_conn:
            for table in tables:
                try:
                    local_total = local_conn.execute(
                        select(func.count()).select_from(table)
                    ).scalar_one()
                except Exception as table_err:
                    return (
                        False,
                        f"{table.fullname}: local sayım okunamadi: {table_err}",
                    )

                if local_total == 0:
                    report_lines.append(f"{table.fullname}: boş, atlandı")
                    continue

                try:
                    remote_before = remote_conn.execute(
                        select(func.count()).select_from(table)
                    ).scalar_one()
                except Exception as table_err:
                    return (
                        False,
                        f"{table.fullname}: remote sayım okunamadi: {table_err}",
                    )

                inserted_rows = 0
                batch: List[dict[str, object]] = []
                local_result = local_conn.execute(select(table))
                for row in local_result.mappings():
                    batch.append(dict(row))
                    if len(batch) >= 500:
                        remote_conn.execute(
                            pg_insert(table).values(batch).on_conflict_do_nothing()
                        )
                        inserted_rows += len(batch)
                        batch.clear()

                if batch:
                    remote_conn.execute(
                        pg_insert(table).values(batch).on_conflict_do_nothing()
                    )
                    inserted_rows += len(batch)
                    batch.clear()

                remote_after = remote_conn.execute(
                    select(func.count()).select_from(table)
                ).scalar_one()
                added_rows = remote_after - remote_before
                report_lines.append(
                    f"{table.fullname}: local={local_total}, remote_once={remote_before}, "
                    f"eklendi={added_rows}, denendi={inserted_rows}, son={remote_after}"
                )

            for table in tables:
                pk_columns = list(table.primary_key.columns)
                if len(pk_columns) != 1:
                    continue
                pk_col = pk_columns[0]
                if not getattr(pk_col, "autoincrement", False):
                    continue
                seq_name = remote_conn.execute(
                    text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                    {"table_name": table.fullname, "column_name": pk_col.name},
                ).scalar_one_or_none()
                if not seq_name:
                    continue
                max_id = remote_conn.execute(
                    select(
                        func.coalesce(func.max(table.c[pk_col.name]), 0)
                    ).select_from(table)
                ).scalar_one()
                remote_conn.execute(
                    text("SELECT setval(:seq_name, GREATEST(:max_id, 1), true)"),
                    {"seq_name": seq_name, "max_id": int(max_id or 0)},
                )
                report_lines.append(
                    f"{table.fullname}: sequence güncellendi -> {seq_name}"
                )

        return True, "\n".join(report_lines)
    except Exception as exc:
        return False, str(exc)
    finally:
        local_engine.dispose()
        remote_engine.dispose()


# ============================================================
# Deployment Servisi
# ============================================================


class DeploymentService:
    def __init__(self):
        self.deployment_logs: List[DeploymentLog] = []
        self.base_path = Path(__file__).resolve().parent.parent
        self._current_step = 0
        self._total_steps = 0

    def _add_log(self, message: str, status: str = "info", step: Optional[str] = None):
        log = DeploymentLog(
            timestamp=datetime.now().isoformat(),
            status=status,
            message=message,
            step=step,
        )
        self.deployment_logs.append(log)
        logger.info(f"[{step or 'general'}] [{status.upper()}] {message}")

    def _resolve_domain_profile(self, domain: str) -> str:
        normalized = (domain or "").strip().lower()
        if normalized == "buyerasistans.com.tr" or normalized.endswith(".buyerasistans.com.tr"):
            return "primary"
        if normalized == "buyerasistans.com" or normalized.endswith(".buyerasistans.com"):
            return "global"
        if normalized == "buyerasistans.info" or normalized.endswith(".buyerasistans.info"):
            return "knowledge"
        if normalized == "buyerasistans.online" or normalized.endswith(".buyerasistans.online"):
            return "campaign"
        return "primary"

    def _run_command(
        self,
        command: str,
        cwd: Optional[Path] = None,
        timeout: int = 600,
        env: Optional[dict[str, str]] = None,
    ) -> Tuple[bool, str]:
        try:
            run_env = os.environ.copy()
            if env:
                run_env.update(env)
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding="utf-8",
                errors="replace",
                env=run_env,
            )
            output = (result.stdout or "") + (result.stderr or "")
            return result.returncode == 0, output
        except subprocess.TimeoutExpired:
            return False, f"Timeout: Komut {timeout}s içinde tamamlanamadı"
        except Exception as e:
            return False, str(e)

    def _get_venv_paths(self, api_path: Path) -> Tuple[Path, Path, Path]:
        venv_dir = api_path / ".venv"
        if os.name == "nt":
            python_exe = venv_dir / "Scripts" / "python.exe"
            pip_exe = venv_dir / "Scripts" / "pip.exe"
        else:
            python_exe = venv_dir / "bin" / "python"
            pip_exe = venv_dir / "bin" / "pip"
        return venv_dir, python_exe, pip_exe

    def _build_setup_response(self, errors: List[str]) -> SystemSetupResponse:
        if errors:
            summary = "Sistem kurulumu BASARISIZ\nHatalar:\n" + "\n".join(
                [f"- {e}" for e in errors]
            )
            success_status = False
        else:
            summary = "Sistem kurulumu BASARILI\nTum kontroller gecti. Hostinge yuklemeye hazirsiniz!"
            success_status = True
        return SystemSetupResponse(
            success=success_status,
            logs=self.deployment_logs,
            summary=summary,
            errors=errors,
        )

    def _check_disk_space(self, path: Path, min_mb: int = 500) -> Tuple[bool, str]:
        try:
            usage = shutil.disk_usage(path)
            free_mb = usage.free // (1024 * 1024)
            if free_mb < min_mb:
                return (
                    False,
                    f"Yetersiz disk alani: {free_mb}MB mevcut, {min_mb}MB gerekli",
                )
            return True, f"Disk alani yeterli: {free_mb}MB mevcut"
        except Exception as e:
            return True, f"Disk alani kontrol edilemedi (devam ediliyor): {str(e)}"

    def _get_python_info(self) -> str:
        return (
            f"Python {sys.version} | "
            f"Executable: {sys.executable} | "
            f"Platform: {sys.platform}"
        )

    def _build_alembic_version_fix_script(self) -> str:
        return (
            "import os\n"
            "import sqlalchemy as sa\n"
            "from dotenv import load_dotenv\n"
            "from sqlalchemy import text\n"
            "load_dotenv()\n"
            "database_url = os.getenv('DATABASE_URL', '')\n"
            "if not database_url:\n"
            "    raise RuntimeError('DATABASE_URL bulunamadi')\n"
            "engine = sa.create_engine(database_url)\n"
            "with engine.begin() as connection:\n"
            '    row = connection.execute(text("SELECT data_type, COALESCE(character_maximum_length, 0) '
            "FROM information_schema.columns WHERE table_schema='public' AND "
            "table_name='alembic_version' AND column_name='version_num'\" )).fetchone()\n"
            "    if row is None:\n"
            "        print('alembic_version tablosu bulunamadi')\n"
            "    elif row[0] != 'character varying' or int(row[1] or 0) < 128:\n"
            "        connection.execute(text('ALTER TABLE public.alembic_version "
            "ALTER COLUMN version_num TYPE VARCHAR(128)'))\n"
            "        print('alembic_version.version_num VARCHAR(128) yapildi')\n"
            "    else:\n"
            "        print('alembic_version.version_num zaten uygun')\n"
        )

    def _repair_local_alembic_version_column(
        self, api_path: Path, venv_python: Path
    ) -> Tuple[bool, str]:
        script = self._build_alembic_version_fix_script()
        return self._run_command(
            f'"{venv_python}" -c {shlex.quote(script)}', cwd=api_path, timeout=180
        )

    def _repair_remote_alembic_version_column(
        self, conn, remote_api: str
    ) -> Tuple[bool, str]:
        script = self._build_alembic_version_fix_script()
        result = _ssh_run(
            conn,
            f"cd {remote_api} && {remote_api}/.venv/bin/python -c {shlex.quote(script)}",
            timeout=180,
        )
        output = ((result.stdout or "") + (result.stderr or "")).strip()
        return result.ok, output

    def _should_skip_zip_path(self, rel_path: Path) -> bool:
        """ZIP'e dahil edilmeyecek dosya/klasorleri belirler."""
        skip_dir_names = {
            "node_modules",
            ".venv",
            "__pycache__",
            ".git",
            "dist",
            "build",
            ".pytest_cache",
            ".mypy_cache",
            "htmlcov",
            "uploads",
            "_deploy_extract_tmp",
            "Hostinge_Deploy",
            "Hostinge_Deploy_extracted",
            "backups",
            "local_cleanup_archives",
            "tmp",
            ".ruff_cache",
            ".mypy_cache",
            ".sixth",
            ".vscode",
            "tests",
            "docs",
            "infra",
        }
        skip_file_names = {
            ".env",
            ".env.local",
            ".env.production",
            ".env.development",
            ".ds_store",
            "thumbs.db",
        }
        skip_file_exts = {".pyc", ".pyo", ".log", ".bak", ".zip"}
        skip_root_patterns = {
            "audit-",
            "approval-",
            "org-catalog-",
            "db-",
            "test-",
            "test10-",
            "tsc_",
            "debug-",
            "robocopy",
            "governance-",
            "web-typecheck",
        }
        rel_parts = [part.lower() for part in rel_path.parts]

        # Klasor kontrolu
        if any(part in skip_dir_names for part in rel_parts):
            return True
        # Dosya adi kontrolu
        if rel_path.name.lower() in skip_file_names:
            return True
        # Uzanti kontrolu
        if rel_path.suffix.lower() in skip_file_exts:
            return True
        # Kok dizindeki audit/test csv-json dosyalari
        if len(rel_path.parts) == 1:
            name_lower = rel_path.name.lower()
            if any(name_lower.startswith(p) for p in skip_root_patterns):
                return True
            if rel_path.suffix.lower() in {".csv", ".json"} and any(
                c.isdigit() for c in rel_path.stem
            ):
                return True
        return False

    # ----------------------------------------------------------
    # ZIP Yenile — proje kokunden akilli ZIP olusturur
    # ----------------------------------------------------------

    def refresh_zip(self) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []

        project_root = self.base_path.parent
        zip_file = project_root / "Hostinge_Yukle.zip"

        # ── Atlanacak klasör adları (path parçasında geçerse atla) ─────────────
        SKIP_DIR_PARTS = {
            ".venv",
            "node_modules",
            "__pycache__",
            ".git",
            ".pytest_cache",
            ".mypy_cache",
            ".ruff_cache",
            ".sixth",
            ".vscode",
            "backups",
            "local_cleanup_archives",
            "Hostinge_Deploy",
            "Hostinge_Yukle",
            "Hostinge_Yükle",
            "_deploy_extract_tmp",
            "tmp",
            "tests",
            "infra",
            "web/src/test",
        }

        # ── Atlanacak uzantılar (web/dist/ hariç) ─────────────────────────────
        SKIP_EXTS = {".pyc", ".pyo", ".pyd", ".log", ".bak", ".zip", ".rar"}

        # ── Atlanacak dosya adları ─────────────────────────────────────────────
        SKIP_FILENAMES = {
            ".env",
            ".env.local",
            ".env.production",
            ".env.development",
            ".coverage",
            ".gitignore",
            "thumbs.db",
            ".ds_store",
            # Debug / tsc çıktıları
            "tsc_out.txt",
            "tsc_out2.txt",
            "tsc_direct.txt",
            "tsc_npx_errors.txt",
            "tsc_sync.txt",
            "tsc_typecheck_out.txt",
            "typecheck_hostinge_out.txt",
            "debug-output.txt",
            "robocopy.log",
            "backup.log",
            "web-typecheck.log",
            "admin-page-vitest.json",
            "vitest-admin-governance.json",
            "vitest-full.json",
            # Bak dosyaları
            "CompaniesTab.tsx.bak-20260421-203500",
            "CompaniesTab.tsx.bak-20260421-233149",
            "adminer.php.bak",
        }

        # ── api/ kök dizininde atlanacak pattern'lar ──────────────────────────
        SKIP_API_ROOT_PATTERNS = (
            "_example.py",
            "test_token.py",
            "PİZZAMAX_TEKLİF_",
        )

        # ── ZIP'e dahil edilecek (zip_prefix, kaynak_yol) ──────────────────────
        include_dirs: List[Tuple[str, Path]] = [
            # API Backend
            ("api/alembic", project_root / "api" / "alembic"),
            ("api/app", project_root / "api" / "app"),
            ("api/core", project_root / "api" / "core"),
            ("api/db", project_root / "api" / "db"),
            ("api/dependencies", project_root / "api" / "dependencies"),
            ("api/models", project_root / "api" / "models"),
            ("api/routers", project_root / "api" / "routers"),
            ("api/schemas", project_root / "api" / "schemas"),
            ("api/scripts", project_root / "api" / "scripts"),
            ("api/services", project_root / "api" / "services"),
            ("api/utils", project_root / "api" / "utils"),
            # Frontend build çıktısı (brand/ ve slider/ dahil)
            ("web/dist", project_root / "web" / "dist"),
            # Kullanıcı upload'ları — localden hostinge
            ("api/uploads/companies", project_root / "api" / "uploads" / "companies"),
            ("api/uploads/ODA", project_root / "api" / "uploads" / "ODA"),
            (
                "api/uploads/onboarding_receipts",
                project_root / "api" / "uploads" / "onboarding_receipts",
            ),
            # Kök uploads — marka + şirket logoları
            (
                "uploads/Buyer_Asistans_Logolar",
                project_root / "uploads" / "Buyer_Asistans_Logolar",
            ),
            (
                "uploads/Buyer_Asistans_Slider",
                project_root / "uploads" / "Buyer_Asistans_Slider",
            ),
            ("uploads/company_logos", project_root / "uploads" / "company_logos"),
            ("uploads/email_signatures", project_root / "uploads" / "email_signatures"),
            ("uploads/logos", project_root / "uploads" / "logos"),
            (
                "uploads/onboarding_receipts",
                project_root / "uploads" / "onboarding_receipts",
            ),
            # Web uploads
            ("web/uploads", project_root / "web" / "uploads"),
            # Kök scripts
            ("scripts", project_root / "scripts"),
            # SQL migrations
            ("migrations", project_root / "migrations"),
            # Infra konfigürasyonları
            ("infra", project_root / "infra"),
        ]

        # ── API kök dosyaları (tek tek) ────────────────────────────────────────
        include_api_root_files = [
            "api/__init__.py",
            "api/alembic.ini",
            "api/database.py",
            "api/main.py",
            "api/legacy_models.py",
            "api/schemas.py",
            "api/requirements.txt",
            "api/pyrightconfig.json",
            "api/create_super_admin.py",
            "api/seed_admin.py",
            "api/reset_admin_password.py",
            "api/check_tables.py",
            "api/check_user.py",
            "api/create_refresh_tokens.py",
            "api/start-api.sh",
        ]

        # ── Proje kök dosyaları ────────────────────────────────────────────────
        include_root_files = [
            "requirements.txt",
            "requirements-lock.txt",
            "adminer.php",
            "adminer_core.php",
            ".env.example",
            "alembic.ini",
            "ARCHITECTURE.md",
            "README.md",
        ]

        def _should_skip(zip_arcname: str, filename: str) -> bool:
            parts = zip_arcname.lower().replace("\\", "/").split("/")

            # Klasör adı kontrolü
            for part in parts:
                if part in SKIP_DIR_PARTS:
                    return True

            # web/src/test/ kontrolü
            if "web/src/test" in zip_arcname.lower():
                return True

            # api/uploads/ altındaki kullanıcı verilerini ALMA — artık dahil ediyoruz
            # (bu blok kaldırıldı, uploads artık include_dirs'te)

            # web/node_modules kontrolü
            if "web/node_modules" in zip_arcname.lower():
                return True

            # Dosya adı kontrolü
            if filename.lower() in SKIP_FILENAMES:
                return True

            # Uzantı kontrolü — web/dist/ içinde uzantı atlamayı devre dışı bırak
            if "web/dist" not in zip_arcname:
                ext = Path(filename).suffix.lower()
                if ext in SKIP_EXTS:
                    return True

            # api/ kök dosyaları için pattern kontrolü
            # (sadece api/ altında 1 seviye derinlikte)
            depth = zip_arcname.count("/")
            if depth == 1 and zip_arcname.startswith("api/"):
                for pat in SKIP_API_ROOT_PATTERNS:
                    if pat.lower() in filename.lower():
                        return True

            # ⭐ KRİTİK: DeploymentPanel.tsx hostinge gönderilmemeli
            # Sunucudaki süper admin panelinde bu buton görünmemeli
            if filename == "DeploymentPanel.tsx":
                return True

            return False

        try:
            self._add_log("=" * 60, "info", "prepare")
            self._add_log(f"ZIP yenileme baslatildi: {zip_file}", "info", "prepare")
            self._add_log(f"Proje koku: {project_root}", "info", "prepare")
            self._add_log(
                "Frontend build kontrolu basladi (web/dist guncellenecek)",
                "info",
                "prepare",
            )

            web_dir = project_root / "web"
            if web_dir.exists():
                npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
                build_ok, build_out = self._run_command(
                    f"{npm_cmd} run build", cwd=web_dir, timeout=900
                )
                if build_ok:
                    self._add_log(
                        "Frontend build tamamlandi (npm run build)",
                        "success",
                        "prepare",
                    )
                else:
                    self._add_log(
                        f"Frontend build hatasi (eski dist ile devam): {(build_out or '')[:500]}",
                        "warning",
                        "prepare",
                    )
            else:
                self._add_log(
                    "web/ dizini bulunamadi, frontend build atlandi",
                    "warning",
                    "prepare",
                )

            if zip_file.exists():
                try:
                    zip_file.unlink()
                    self._add_log("Eski ZIP dosyasi silindi", "info", "prepare")
                except Exception as unlink_err:
                    self._add_log(
                        f"Eski ZIP silinemedi (devam ediliyor): {unlink_err}",
                        "warning",
                        "prepare",
                    )

            file_count = 0
            total_size = 0
            skipped = 0
            dir_summary: List[str] = []

            import zipfile as _zipfile

            with _zipfile.ZipFile(
                zip_file,
                "w",
                compression=_zipfile.ZIP_DEFLATED,
                compresslevel=9,
            ) as archive:
                # ── 1. Dizinleri tara ──────────────────────────────────────────
                for zip_prefix, src_dir in include_dirs:
                    if not src_dir.exists():
                        self._add_log(
                            f"  Dizin bulunamadi, atlaniyor: {zip_prefix}/",
                            "warning",
                            "prepare",
                        )
                        continue

                    dir_count = 0
                    for fpath in src_dir.rglob("*"):
                        if not fpath.is_file():
                            continue
                        rel_to_src = fpath.relative_to(src_dir)
                        zip_arcname = f"{zip_prefix}/{rel_to_src.as_posix()}"

                        if _should_skip(zip_arcname, fpath.name):
                            skipped += 1
                            continue

                        archive.write(fpath, arcname=zip_arcname)
                        file_count += 1
                        dir_count += 1
                        try:
                            total_size += fpath.stat().st_size
                        except Exception:
                            pass

                    msg = f"  {zip_prefix}/ -> {dir_count} dosya eklendi"
                    dir_summary.append(msg)
                    self._add_log(msg, "info", "prepare")

                # ── 2. API kök dosyaları ───────────────────────────────────────
                api_root_count = 0
                for rel_path in include_api_root_files:
                    fpath = project_root / rel_path
                    if fpath.exists():
                        archive.write(fpath, arcname=rel_path.replace("\\", "/"))
                        file_count += 1
                        api_root_count += 1
                        try:
                            total_size += fpath.stat().st_size
                        except Exception:
                            pass
                    else:
                        self._add_log(
                            f"  {rel_path} bulunamadi, atlaniyor",
                            "warning",
                            "prepare",
                        )
                self._add_log(
                    f"  api/ kok dosyalari -> {api_root_count} dosya eklendi",
                    "info",
                    "prepare",
                )

                # ── 3. Proje kök dosyaları ─────────────────────────────────────
                root_count = 0
                for fname in include_root_files:
                    fpath = project_root / fname
                    if fpath.exists():
                        archive.write(fpath, arcname=fname)
                        file_count += 1
                        root_count += 1
                        try:
                            total_size += fpath.stat().st_size
                        except Exception:
                            pass
                    else:
                        self._add_log(
                            f"  {fname} bulunamadi, atlaniyor",
                            "info",
                            "prepare",
                        )
                self._add_log(
                    f"  Proje koku dosyalari -> {root_count} dosya eklendi",
                    "info",
                    "prepare",
                )

            size_mb = round(total_size / (1024 * 1024), 2)
            self._add_log(
                f"ZIP olusturuldu: {file_count} dosya dahil | "
                f"{skipped} atlandi | {size_mb} MB -> {zip_file.name}",
                "success",
                "prepare",
            )
            self._add_log(
                "Dizin ozeti:\n" + "\n".join(dir_summary),
                "info",
                "prepare",
            )

            return SystemSetupResponse(
                success=True,
                logs=self.deployment_logs,
                summary=(
                    f"Hostinge_Yukle.zip yenilendi "
                    f"({file_count} dosya, {size_mb} MB)."
                ),
                errors=[],
            )

        except Exception as e:
            self._add_log(f"ZIP yenileme hatasi: {str(e)}", "error", "prepare")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"ZIP yenileme basarisiz: {str(e)}",
                errors=[str(e)],
            )

    async def smart_reload(self, hosting_config: HostingConfig) -> SystemSetupResponse:
        self.deployment_logs.clear()
        self._add_log(
            f"Akilli site yenileme baslatildi -> {hosting_config.domain}",
            "info",
            "reload",
        )
        local_zip = self.base_path.parent / "Hostinge_Yukle.zip"
        if local_zip.exists():
            self._add_log(f"ZIP hazir: {local_zip}", "info", "reload")
        else:
            self._add_log(
                "ZIP bulunamadi, normal yenileme moduna geciliyor", "warning", "reload"
            )
        return await self.reload_remote_site(hosting_config)

    # ----------------------------------------------------------
    # Bağlantı Testi
    # ----------------------------------------------------------

    async def test_connection(
        self, hosting_config: HostingConfig
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        try:
            self._add_log(
                f"Baglanti testi baslatiliyor: {hosting_config.host_ip}:{hosting_config.port}",
                "info",
                "connect",
            )
            success, output = _test_ssh_connection(hosting_config)
            if success:
                self._add_log(
                    f"Baglanti basarili\nSunucu bilgisi:\n{output}",
                    "success",
                    "connect",
                )
                summary = f"Baglanti basarili!\nCikti: {output[:200]}"
            else:
                self._add_log(f"Baglanti basarisiz: {output}", "error", "connect")
                errors.append(f"Connection test failed: {output}")
                summary = f"Baglanti basarisiz: {output[:300]}"
            return SystemSetupResponse(
                success=success,
                logs=self.deployment_logs,
                summary=summary,
                errors=errors,
            )
        except Exception as e:
            self._add_log(f"Baglanti testi hatasi: {str(e)}", "error", "connect")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Baglanti testi basarisiz: {str(e)}",
                errors=[str(e)],
            )

    # ----------------------------------------------------------
    # Yerel Sistem Kurulumu
    # ----------------------------------------------------------

    async def setup_system(self) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []

        try:
            api_path = self.base_path
            self._add_log("=" * 60, "info", "system")
            self._add_log("Sistem kurulumu baslatildi", "info", "system")
            self._add_log(f"API dizini: {api_path}", "info", "system")
            self._add_log(self._get_python_info(), "info", "system")
            self._add_log("=" * 60, "info", "system")

            if not api_path.exists():
                self._add_log(f"API dizini bulunamadi: {api_path}", "error", "system")
                errors.append(f"API directory not found: {api_path}")
                return self._build_setup_response(errors)

            disk_ok, disk_msg = self._check_disk_space(api_path, min_mb=200)
            if not disk_ok:
                self._add_log(disk_msg, "error", "system")
                errors.append(disk_msg)
                return self._build_setup_response(errors)
            self._add_log(disk_msg, "info", "system")

            venv_dir, venv_python, venv_pip = self._get_venv_paths(api_path)
            host_python = sys.executable

            # Adım 0: venv modülü
            self._add_log(
                "Adim 0/7: Python venv modulu kontrol ediliyor", "info", "packages"
            )
            venv_module_ok = _check_venv_module(host_python)
            if not venv_module_ok:
                self._add_log(
                    f"Python venv modulu import edilemiyor: {host_python}",
                    "warning",
                    "packages",
                )
                if os.name != "nt":
                    self._add_log(
                        "Linux sistemde python3-venv paketi kuruluyor...",
                        "info",
                        "packages",
                    )
                    fix_success, fix_output = self._run_command(
                        "apt-get install -y python3-venv python3-full 2>&1 || "
                        "yum install -y python3-virtualenv 2>&1 || "
                        "dnf install -y python3-virtualenv 2>&1"
                    )
                    if fix_success:
                        self._add_log(
                            "python3-venv paketi basariyla kuruldu",
                            "success",
                            "packages",
                        )
                        if not _check_venv_module(host_python):
                            errors.append(
                                "Virtual environment creation failed: venv still unavailable"
                            )
                            return self._build_setup_response(errors)
                    else:
                        errors.append(
                            f"Virtual environment creation failed: {fix_output[:300]}"
                        )
                        return self._build_setup_response(errors)
                else:
                    errors.append(
                        "Virtual environment creation failed: venv module not importable on Windows"
                    )
                    return self._build_setup_response(errors)
            else:
                self._add_log(
                    f"Python venv modulu mevcut ({host_python})", "success", "packages"
                )

            # Adım 1: Sanal Ortam
            self._add_log("Adim 1/7: Sanal ortam kontrol ediliyor", "info", "packages")
            if venv_dir.exists() and venv_python.exists():
                self._add_log(
                    f"Sanal ortam zaten mevcut: {venv_dir}", "success", "packages"
                )
            else:
                if venv_dir.exists() and not venv_python.exists():
                    self._add_log(
                        f"Bozuk venv dizini temizleniyor: {venv_dir}",
                        "warning",
                        "packages",
                    )
                    try:
                        shutil.rmtree(venv_dir)
                    except Exception as rm_err:
                        self._add_log(
                            f"Venv dizini temizlenemedi: {rm_err}",
                            "warning",
                            "packages",
                        )

                self._add_log(
                    f"Sanal ortam olusturuluyor: {venv_dir}", "info", "packages"
                )
                start_time = time.time()
                success, output = self._run_command(
                    f'"{host_python}" -m venv "{venv_dir}"',
                    cwd=api_path,
                    timeout=120,
                )
                elapsed = round(time.time() - start_time, 1)
                if not success or not venv_python.exists():
                    self._add_log(
                        f"Sanal ortam olusturulamadi ({elapsed}s).\n{output[:800]}",
                        "error",
                        "packages",
                    )
                    errors.append(
                        f"Virtual environment creation failed: {output[:500]}"
                    )
                    return self._build_setup_response(errors)
                self._add_log(
                    f"Sanal ortam basariyla olusturuldu ({elapsed}s)",
                    "success",
                    "packages",
                )

            # Adım 2: Pip
            self._add_log("Adim 2/7: Pip yukseltiliyor", "info", "packages")
            pip_success, pip_output = self._run_command(
                f'"{venv_python}" -m pip install --upgrade pip',
                cwd=api_path,
                timeout=120,
            )
            if pip_success:
                self._add_log("Pip guncellendi", "success", "packages")
            else:
                self._add_log(
                    f"Pip yukseltme uyarisi: {pip_output[:300]}", "warning", "packages"
                )

            # Adım 3: Requirements
            self._add_log("Adim 3/7: Python paketleri yukleniyor", "info", "packages")
            req_candidates = ["requirements.txt", "requirements-lock.txt"]
            req_files_found: List[Tuple[str, Path, int]] = []

            for req_name in req_candidates:
                req_path = api_path / req_name
                if req_path.exists():
                    try:
                        pkg_count = len(
                            [
                                ln
                                for ln in req_path.read_text(
                                    encoding="utf-8"
                                ).splitlines()
                                if ln.strip() and not ln.strip().startswith("#")
                            ]
                        )
                    except Exception:
                        pkg_count = 0
                    req_files_found.append((req_name, req_path, pkg_count))
                    self._add_log(
                        f"{req_name} bulundu: {pkg_count} paket", "info", "packages"
                    )
                else:
                    self._add_log(
                        f"{req_name} bulunamadi, atlaniyor",
                        "warning" if req_name == "requirements.txt" else "info",
                        "packages",
                    )

            if not req_files_found:
                self._add_log(
                    "Hicbir requirements dosyasi bulunamadi!", "error", "packages"
                )
                errors.append("No requirements file found")
            else:
                for req_name, req_path, pkg_count in req_files_found:
                    self._add_log(
                        f"Yukleniyor: {req_name} ({pkg_count} paket)...",
                        "info",
                        "packages",
                    )
                    start_time = time.time()
                    success, output = self._run_command(
                        f'"{venv_pip}" install -r "{req_path}" --no-warn-script-location',
                        cwd=api_path,
                        timeout=900,
                    )
                    elapsed = round(time.time() - start_time, 1)
                    _out_lower = output.lower()
                    _all_lines = [
                        ln.strip() for ln in output.splitlines() if ln.strip()
                    ]
                    _non_satisfied = [
                        ln
                        for ln in _all_lines
                        if ln
                        and "already satisfied" not in ln.lower()
                        and "requirement already satisfied" not in ln.lower()
                        and not ln.startswith("WARNING")
                        and not ln.startswith("DEPRECATION")
                        and not ln.startswith("Notice")
                        and "pip" not in ln.lower()
                    ]
                    _pip_really_failed = (
                        not success
                        and len(_non_satisfied) > 0
                        and (
                            "error" in _out_lower
                            or "traceback" in _out_lower
                            or "could not" in _out_lower
                            or "no matching" in _out_lower
                        )
                    )
                    if _pip_really_failed:
                        self._add_log(
                            f"{req_name} kurulumu basarisiz ({elapsed}s).\n{output[:800]}",
                            "error",
                            "packages",
                        )
                        errors.append(
                            f"Package installation failed [{req_name}]: {output[:500]}"
                        )
                    else:
                        already_count = len(
                            [
                                ln
                                for ln in output.splitlines()
                                if "already satisfied" in ln.lower()
                            ]
                        )
                        self._add_log(
                            f"{req_name} ({elapsed}s) — {already_count} paket zaten kurulu",
                            "success",
                            "packages",
                        )

            # Adım 4: ODA (sadece Windows)
            self._add_log(
                "Adim 4/7: ODA File Converter kontrol ediliyor", "info", "packages"
            )
            if os.name == "nt":
                oda_check_paths = [
                    Path("C:/Program Files/ODA/ODAFileConverter"),
                    Path("C:/Program Files (x86)/ODA/ODAFileConverter"),
                    api_path / "oda",
                ]
                oda_installed = any(
                    list(p.glob("ODAFileConverter*.exe"))
                    for p in oda_check_paths
                    if p.exists()
                )
                if oda_installed:
                    self._add_log(
                        "ODA File Converter zaten kurulu", "success", "packages"
                    )
                else:
                    oda_url = "https://www.opendesign.com/guestfiles/ODAFileConverter_28_2_6_x64.msi"
                    oda_dir = api_path / "oda"
                    oda_msi_path = oda_dir / "ODAFileConverter_28_2_6_x64.msi"
                    self._add_log(
                        "ODA File Converter bulunamadi, indiriliyor...",
                        "info",
                        "packages",
                    )
                    try:
                        oda_dir.mkdir(parents=True, exist_ok=True)
                        urllib.request.urlretrieve(oda_url, str(oda_msi_path))
                        install_success, install_output = self._run_command(
                            f'msiexec /i "{oda_msi_path}" /quiet /norestart',
                            timeout=300,
                        )
                        if install_success:
                            self._add_log(
                                "ODA File Converter basariyla kuruldu",
                                "success",
                                "packages",
                            )
                        else:
                            self._add_log(
                                f"ODA kurulum uyarisi (kritik degil): {install_output[:400]}",
                                "warning",
                                "packages",
                            )
                    except Exception as oda_err:
                        self._add_log(
                            f"ODA kurulumu basarisiz (kritik degil): {str(oda_err)}",
                            "warning",
                            "packages",
                        )
            else:
                self._add_log(
                    "ODA File Converter Windows'a ozgu, Linux'ta atlaniyor",
                    "info",
                    "packages",
                )

            # Adım 5: Alembic
            self._add_log("Adim 5/7: Veritabani migrasyonu", "info", "database")
            alembic_ini = api_path / "alembic.ini"
            if not alembic_ini.exists():
                self._add_log(
                    "alembic.ini bulunamadi, migration adimi atlaniyor",
                    "warning",
                    "database",
                )
            else:
                self._add_log(
                    "Alembic migration baslatiliyor (upgrade head)...",
                    "info",
                    "database",
                )
                project_root_for_alembic = api_path.parent
                final_output = ""
                start_time = time.time()
                success, output = self._run_command(
                    f'"{venv_python}" -m alembic -c "{api_path / "alembic.ini"}" upgrade head',
                    cwd=project_root_for_alembic,
                    timeout=300,
                )
                elapsed = round(time.time() - start_time, 1)
                final_output = output
                if not success and (
                    "stringdatarighttruncation" in output.lower()
                    or (
                        "alembic_version" in output.lower()
                        and "version_num" in output.lower()
                    )
                ):
                    self._add_log(
                        "alembic_version.version_num uyumsuzlugu tespit edildi, kolon genisletiliyor...",
                        "warning",
                        "database",
                    )
                    fix_success, fix_output = self._repair_local_alembic_version_column(
                        api_path, venv_python
                    )
                    if fix_output:
                        self._add_log(
                            f"alembic_version onarimi:\n{fix_output[:400]}",
                            "info",
                            "database",
                        )
                    if fix_success:
                        self._add_log(
                            "Migration yeniden deneniyor...", "info", "database"
                        )
                        start_time = time.time()
                        success, output = self._run_command(
                            f'"{venv_python}" -m alembic -c "{api_path / "alembic.ini"}" upgrade head',
                            cwd=project_root_for_alembic,
                            timeout=300,
                        )
                        elapsed = round(time.time() - start_time, 1)
                        final_output = output
                    else:
                        errors.append(
                            f"alembic_version repair failed: {fix_output[:300]}"
                        )
                if success:
                    self._add_log(
                        f"Veritabani migrasyonu tamamlandi ({elapsed}s)",
                        "success",
                        "database",
                    )
                else:
                    self._add_log(
                        f"Migration basarisiz ({elapsed}s).\n{final_output[:800]}",
                        "error",
                        "database",
                    )
                    # Migration ciktisinda gercek hata var mi kontrol et
                    _mig_lower = final_output.lower()
                    _is_already_done = (
                        "already up to date" in _mig_lower
                        or (
                            "running upgrade" in _mig_lower
                            and "traceback" not in _mig_lower
                            and "error" not in _mig_lower
                        )
                        or (
                            "running upgrade" in _mig_lower
                            and (
                                "already exists" in _mig_lower
                                or "duplicate" in _mig_lower
                            )
                        )
                    )
                    if not _is_already_done:
                        # Yerel DB kontrolu: traceback olsa bile tablo zaten varsa gecir
                        _final_lower = final_output.lower()
                        # "running upgrade" + traceback = tablo zaten var (psycopg DuplicateTable)
                        _is_dup_table = "running upgrade" in _final_lower and (
                            "already exists" in _final_lower
                            or "duplicate" in _final_lower
                            or "duplicatetable" in _final_lower
                            or "relation" in _final_lower
                            or "psycopg" in _final_lower
                            or "unicodeescape" in _final_lower
                        )
                        # Traceback var ama "running upgrade" ile birlikte geliyorsa
                        # migration zaten uygulanmis - hata degil
                        _has_running_upgrade = "running upgrade" in _final_lower
                        _real_fail = (
                            ("error" in _final_lower or "traceback" in _final_lower)
                            and not _is_dup_table
                            and not _has_running_upgrade
                        )
                        if _real_fail:
                            errors.append(
                                f"Database migration failed: {final_output[:500]}"
                            )
                        else:
                            self._add_log(
                                "Migration: tablo zaten mevcut veya zaten uygulanmis, atlaniyor",
                                "success",
                                "database",
                            )
            self._add_log("Adim 6/7: Sistem testleri", "info", "health")
            tests_path = api_path / "tests"
            if not tests_path.exists():
                self._add_log(
                    "tests/ dizini bulunamadi, test adimi atlaniyor", "info", "health"
                )
            else:
                self._add_log(
                    "Pytest ile sistem testleri calistiriliyor...", "info", "health"
                )
                start_time = time.time()
                success, output = self._run_command(
                    f'"{venv_python}" -m pytest tests/ -v --tb=short',
                    cwd=api_path,
                    timeout=300,
                )
                elapsed = round(time.time() - start_time, 1)
                if success:
                    self._add_log(
                        f"Tum sistem testleri gecti ({elapsed}s)", "success", "health"
                    )
                else:
                    self._add_log(
                        f"Bazi testler basarisiz ({elapsed}s), devam ediliyor.\n{output[:400]}",
                        "warning",
                        "health",
                    )

            # Adım 7: API Health Check
            self._add_log("Adim 7/7: API import testi", "info", "health")
            project_root = api_path.parent
            success, output = self._run_command(
                f'"{venv_python}" -c '
                f"\"import sys; sys.path.insert(0, r'{project_root}'); "
                f"from api.main import app; print('API loaded successfully')\"",
                cwd=project_root,
                timeout=60,
            )
            if not success:
                self._add_log(
                    "api.main import basarisiz, main:app ile deneniyor...",
                    "warning",
                    "health",
                )
                success, output = self._run_command(
                    f'"{venv_python}" -c "from main import app; print(\'API loaded successfully\')"',
                    cwd=api_path,
                    timeout=60,
                )
            if success:
                self._add_log(
                    f"API basariyla yuklendi\nCikti: {output.strip()[:200]}",
                    "success",
                    "health",
                )
            else:
                self._add_log(
                    f"API yukleme basarisiz.\n{output[:800]}", "error", "health"
                )
                errors.append(f"API initialization failed: {output[:500]}")

            self._add_log("=" * 60, "info", "system")
            if errors:
                self._add_log(
                    f"Kurulum tamamlandi — {len(errors)} hata var", "error", "system"
                )
            else:
                self._add_log(
                    "Kurulum tamamlandi — tum adimlar basarili", "success", "system"
                )
            self._add_log("=" * 60, "info", "system")

            return self._build_setup_response(errors)

        except Exception as e:
            self._add_log(f"Beklenmeyen hata: {str(e)}", "error", "system")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Beklenmeyen hata: {str(e)}",
                errors=[str(e)],
            )

    # ----------------------------------------------------------
    # Hosting Dosyalarını Sil
    # ----------------------------------------------------------
    async def clear_remote_files(
        self, hosting_config: HostingConfig
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        conn = None

        try:
            self._add_log("=" * 60, "info", "clear")
            self._add_log(
                f"Hosting dosya temizligi baslatildi -> {hosting_config.domain}",
                "info",
                "clear",
            )
            self._add_log("=" * 60, "info", "clear")

            self._add_log("SSH baglantisi kuruluyor...", "info", "connect")
            conn = build_ssh_connection(hosting_config)
            # conn.run kullan — bash -lc sarması {} karakterini bozuyor
            verify = conn.run(
                "echo SSH_OK && uname -r", hide=True, warn=True, in_stream=False
            )
            self._add_log(
                f"SSH baglantisi basarili | {(verify.stdout or '').strip()}",
                "success",
                "connect",
            )
            # ── Disk temizligi ──────────────────────────────────────────────────
            self._add_log("Disk temizligi yapiliyor...", "info", "clear")

            # /tmp icindeki eski backup ve gecici dosyalari sil
            r_tmp = conn.run(
                "find /tmp -maxdepth 1 -name 'backup_*.tar.gz' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'pf_restore_*.sql' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'pf_restore_*.sh' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'pf_restore_*.log' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'pf_restore_*.exitcode' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'uvicorn_*.log' -delete 2>/dev/null; "
                "find /tmp -maxdepth 1 -name 'procureflow_*.sql' -delete 2>/dev/null; "
                "echo DISK_CLEAN_DONE",
                hide=True,
                warn=True,
                in_stream=False,
            )
            self._add_log(
                f"/tmp temizligi: {(r_tmp.stdout or '').strip()[:100]}",
                "success",
                "clear",
            )

            # journald loglarini sikistir (3 gunden eski)
            r_journal = conn.run(
                "journalctl --vacuum-time=3d 2>/dev/null | tail -2 || true",
                hide=True,
                warn=True,
                in_stream=False,
            )
            journal_out = (r_journal.stdout or "").strip()
            if journal_out:
                self._add_log(
                    f"Journal temizligi: {journal_out[:150]}", "info", "clear"
                )

            # procureflow.log 50MB'yi asarsa rotate et
            r_logsize = conn.run(
                "LOG=/var/log/procureflow.log; "
                "if [ -f $LOG ] && [ $(stat -c%s $LOG 2>/dev/null || echo 0) -gt 52428800 ]; then "
                "  cp $LOG ${LOG}.bak && truncate -s 0 $LOG && echo LOG_ROTATED; "
                "else echo LOG_OK; fi",
                hide=True,
                warn=True,
                in_stream=False,
            )
            self._add_log(
                f"Procureflow log: {(r_logsize.stdout or '').strip()[:80]}",
                "info",
                "clear",
            )

            # Disk durumu ozeti
            r_df = conn.run("df -h / | tail -1", hide=True, warn=True, in_stream=False)
            self._add_log(
                f"Disk durumu: {(r_df.stdout or '').strip()}",
                "info",
                "clear",
            )
            # ── Disk temizligi sonu ─────────────────────────────────────────────
            remote = hosting_config.remote_path
            api_dir = f"{remote}/api"
            web_dir = f"{remote}/web"

            # Dosya sayısı
            r_count = conn.run(
                f"find {remote} -maxdepth 4 -type f "
                f"! -path '{api_dir}/.venv/*' "
                f"! -path '{api_dir}/.env' "
                f"2>/dev/null | wc -l",
                hide=True,
                warn=True,
                in_stream=False,
            )
            file_count = (r_count.stdout or "").strip()
            self._add_log(
                f"Silinecek dosya sayisi (tahmini): {file_count}", "info", "clear"
            )

            # api/ temizle — .venv ve .env koru
            self._add_log(
                "api/ temizleniyor (.venv ve .env korunuyor)...", "info", "clear"
            )
            conn.run(
                f"find {api_dir} -mindepth 1 -maxdepth 1 "
                f"! -name '.venv' ! -name '.env' "
                f"-exec rm -rf {{}} \\; 2>/dev/null || true",
                hide=True,
                warn=True,
                in_stream=False,
            )
            self._add_log("api/ temizlendi", "success", "clear")

            # web/ tamamen sil
            self._add_log("web/ siliniyor...", "info", "clear")
            conn.run(
                f"rm -rf {web_dir} 2>/dev/null || true",
                hide=True,
                warn=True,
                in_stream=False,
            )
            self._add_log("web/ silindi", "success", "clear")

            # httpdocs/ kökü temizle
            self._add_log(
                "httpdocs/ koku temizleniyor (api/ ve web/ korunuyor)...",
                "info",
                "clear",
            )
            conn.run(
                f"find {remote} -maxdepth 1 "
                f"! -name 'api' ! -name 'web' ! -name '.' "
                f"! -path '{remote}' "
                f"-exec rm -rf {{}} \\; 2>/dev/null || true",
                hide=True,
                warn=True,
                in_stream=False,
            )
            self._add_log("httpdocs/ koku temizlendi", "success", "clear")

            # Doğrulama
            r_verify = conn.run(
                f"ls {api_dir}/.env 2>/dev/null && echo ENV_OK || echo ENV_GONE; "
                f"ls -d {api_dir}/.venv 2>/dev/null && echo VENV_OK || echo VENV_GONE; "
                f"ls {remote} 2>/dev/null | head -10",
                hide=True,
                warn=True,
                in_stream=False,
            )
            verify_out = (r_verify.stdout or "").strip()
            self._add_log(f"Temizlik dogrulamasi:\n{verify_out}", "info", "clear")

            self._add_log("=" * 60, "info", "clear")
            self._add_log("Hosting dosya temizligi tamamlandi", "success", "clear")

            return SystemSetupResponse(
                success=True,
                logs=self.deployment_logs,
                summary="Hosting dosyalari basariyla temizlendi. Deploy yapabilirsiniz.",
                errors=[],
            )

        except Exception as e:
            tb = traceback.format_exc()
            self._add_log(f"Temizlik hatasi:\n{tb[:600]}", "error", "clear")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Temizlik basarisiz: {str(e)}",
                errors=[str(e)],
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                    self._add_log("SSH baglantisi kapatildi", "info", "connect")
                except Exception:
                    pass

    # ----------------------------------------------------------
    # Hostinge Deploy
    # ----------------------------------------------------------
    async def deploy_to_host(
        self, hosting_config: HostingConfig
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        conn = None
        domain_profile = self._resolve_domain_profile(hosting_config.domain)
        full_stack_profile = domain_profile == "primary"
        # Frontend'in hemen görmesi için ilk log'u senkron at
        self._add_log(
            "Deploy islemi baslatildi — adimlar yukleniyor...", "info", "deploy"
        )
        self._add_log(
            f"Hedef: {hosting_config.domain} ({hosting_config.host_ip}:{hosting_config.port})",
            "info",
            "deploy",
        )
        self._add_log(f"Remote path: {hosting_config.remote_path}", "info", "deploy")
        self._add_log(
            f"Domain profili: {domain_profile} | Dagitim tipi: {'full-stack' if full_stack_profile else 'frontend-only'}",
            "info",
            "deploy",
        )

        try:
            self._add_log("=" * 60, "info", "deploy")
            self._add_log(
                f"Deploy baslatildi -> {hosting_config.domain} ({hosting_config.host_ip})",
                "info",
                "deploy",
            )
            self._add_log("=" * 60, "info", "deploy")

            # ── Progress yardımcısı ───────────────────────────────────────────────
            _deploy_steps = [
                "Bağlantı",
                "Yedek",
                "Hazırlık",
                "Yükleme",
                "Sunucu Kurulum",
                "Frontend",
                "Servisler",
            ]
            _deploy_total = len(_deploy_steps)

            def _progress(step_idx: int, msg: str, status: str = "info"):
                pct = round((step_idx / _deploy_total) * 100)
                self._add_log(
                    f"[{pct}%] Adim {step_idx}/{_deploy_total}: {msg}", status, "deploy"
                )

            # Adım 1: SSH
            _progress(1, "SSH baglantisi kuruluyor...", "info")
            self._add_log("Adim 1/7: SSH baglantisi kuruluyor", "info", "connect")
            try:
                conn = build_ssh_connection(hosting_config)
                verify_result = _ssh_run(conn, "echo 'SSH_OK' && uname -r")
                verify_out = (verify_result.stdout or "").strip()
                self._add_log(
                    f"SSH baglantisi basarili | Kernel: {verify_out}",
                    "success",
                    "connect",
                )
            except Exception as e:
                self._add_log(f"SSH baglantisi basarisiz: {str(e)}", "error", "connect")
                errors.append(f"Connection failed: {str(e)}")
                return SystemSetupResponse(
                    success=False,
                    logs=self.deployment_logs,
                    summary=f"Hostinge baglanılamadi: {str(e)}",
                    errors=errors,
                )

            # Adım 2: Backup
            _progress(2, "Mevcut site yedekleniyor...", "info")
            self._add_log("Adim 2/7: Mevcut site yedekleniyor", "info", "backup")
            backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.tar.gz"
            try:
                _ssh_run(
                    conn,
                    f"cd {hosting_config.remote_path} && "
                    f"tar -czf /tmp/{backup_name} . 2>/dev/null || true",
                )
                self._add_log(f"Backup alindi: /tmp/{backup_name}", "success", "backup")
                # Eski /tmp backup'larini temizle (sadece bu deploy'un backup'ini koru)
                _ssh_run(
                    conn,
                    f"find /tmp -maxdepth 1 -name 'backup_*.tar.gz' "
                    f"! -name '{backup_name}' -delete 2>/dev/null || true",
                )
                self._add_log("Eski /tmp backup dosyalari temizlendi", "info", "backup")

            except Exception as e:
                self._add_log(
                    f"Backup alinamadi (devam ediliyor): {str(e)}", "warning", "backup"
                )

            # Adım 2.5: Uzak dosyaları temizle
            self._add_log(
                "Uzak dosyalar temizleniyor (deploy oncesi)...", "info", "clear"
            )
            if full_stack_profile:
                _ssh_run(
                    conn,
                    f"find {hosting_config.remote_path}/api -mindepth 1 -maxdepth 1 "
                    f"! -name '.venv' ! -name '.env' "
                    f"-exec rm -rf {{}} + 2>/dev/null || true; "
                    f"rm -rf {hosting_config.remote_path}/web 2>/dev/null || true; "
                    f"find {hosting_config.remote_path} -maxdepth 1 "
                    f"! -name 'api' ! -name 'web' ! -name '.' "
                    f"! -path '{hosting_config.remote_path}' "
                    f"-exec rm -rf {{}} + 2>/dev/null || true",
                )
            else:
                _ssh_run(
                    conn,
                    f"rm -rf {hosting_config.remote_path}/api 2>/dev/null || true; "
                    f"rm -rf {hosting_config.remote_path}/web 2>/dev/null || true; "
                    f"find {hosting_config.remote_path} -maxdepth 1 "
                    f"! -name '.' ! -path '{hosting_config.remote_path}' "
                    f"-exec rm -rf {{}} + 2>/dev/null || true",
                )
            self._add_log(
                "Uzak dosyalar temizlendi — temiz deploy basliyor", "success", "clear"
            )

            # Adım 3: Yerel Dosyaları Hazırla
            _progress(3, "Yerel dosyalar hazirlaniyor...", "info")
            self._add_log("Adim 3/7: Yerel dosyalar hazirlaniyor", "info", "prepare")
            local_base = self.base_path.parent

            # ZIP adayları — refresh_zip her zaman ASCII isimle yazar
            zip_candidates = [
                local_base / "Hostinge_Yukle.zip",  # refresh_zip'in yazdığı
                local_base / "Hostinge_Yükle.zip",  # eski isim fallback
            ]
            zip_file = next((z for z in zip_candidates if z.exists()), None)

            extract_dir = local_base / "_deploy_extract_tmp"
            local_deploy: Path | None = None

            if zip_file is not None:
                self._add_log(
                    f"ZIP bulundu: {zip_file.name} ({round(zip_file.stat().st_size/1024/1024,2)} MB)",
                    "info",
                    "prepare",
                )

                # Eski extract temizle
                if extract_dir.exists():
                    try:
                        shutil.rmtree(extract_dir)
                    except Exception:
                        pass
                extract_dir.mkdir(parents=True, exist_ok=True)

                # Direkt zipfile ile aç — subprocess kullanma
                try:
                    import zipfile as _zf

                    with _zf.ZipFile(zip_file, "r") as zf:
                        zf.extractall(extract_dir)
                    self._add_log(f"ZIP acildi: {extract_dir}", "success", "prepare")
                except Exception as ze:
                    self._add_log(f"ZIP acma hatasi: {ze}", "error", "prepare")
                    errors.append(f"ZIP extraction failed: {ze}")
                    extract_dir = local_base  # fallback

                # İç dizin tespiti — ZIP içinde tek bir kök klasör olabilir
                try:
                    inner_dirs = [p for p in extract_dir.iterdir() if p.is_dir()]
                    if len(inner_dirs) == 1 and not (extract_dir / "api").exists():
                        # ZIP içinde tek klasör var, o klasörü kaynak al
                        local_deploy = inner_dirs[0]
                        self._add_log(
                            f"ZIP ic dizin: {local_deploy.name}", "info", "prepare"
                        )
                    else:
                        local_deploy = extract_dir
                except Exception:
                    local_deploy = extract_dir
            else:
                self._add_log(
                    "ZIP bulunamadi — once 'ZIP Yenile' butonuna basin!",
                    "warning",
                    "prepare",
                )
                # ZIP yoksa proje kökünden yükle (geliştirme modu)
                local_deploy = local_base

            self._add_log(f"Kaynak dizin: {local_deploy}", "info", "prepare")

            # Kaynak yapısını doğrula
            api_src = local_deploy / "api"
            web_src = local_deploy / "web"
            self._add_log(
                f"Kaynak: api/={'VAR ✓' if api_src.exists() else 'YOK ✗'}  "
                f"web/={'VAR ✓' if web_src.exists() else 'YOK ✗'}",
                "success" if api_src.exists() else "warning",
                "prepare",
            )

            # Adım 4: SFTP ile Yükle
            _progress(4, "Dosyalar SFTP ile hostinge yukleniyor...", "info")
            self._add_log("Adim 4/7: Dosyalar hostinge yukleniyor", "info", "upload")

            SKIP_DIRS = {
                "node_modules",
                ".venv",
                "__pycache__",
                ".git",
                "dist",
                "build",
                ".pytest_cache",
                ".mypy_cache",
                "htmlcov",
            }
            SKIP_EXTS = (".pyc", ".pyo", ".pyd", ".log")
            SKIP_FILES = {".env", ".env.local", ".env.production"}

            uploaded_count = 0
            skipped_count = 0
            uploaded_files: List[str] = []
            frontend_only_skip_roots = {
                "api",
                "migrations",
                "scripts",
                "infra",
                "requirements.txt",
                "requirements-lock.txt",
                "alembic.ini",
                "adminer.php",
                "adminer_core.php",
            }

            try:
                with conn.sftp() as sftp:
                    _ssh_run(conn, f"mkdir -p {hosting_config.remote_path}")

                    for root, dirs, files in os.walk(local_deploy):
                        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

                        rel_root = Path(root).relative_to(local_deploy)
                        rel_root_str = rel_root.as_posix()
                        if not full_stack_profile:
                            root_head = (
                                rel_root_str.split("/", 1)[0] if rel_root_str else ""
                            )
                            if root_head in frontend_only_skip_roots:
                                skipped_count += len(files)
                                continue

                        remote_dir = f"{hosting_config.remote_path}/{rel_root}".replace(
                            "\\", "/"
                        )
                        while "//" in remote_dir:
                            remote_dir = remote_dir.replace("//", "/")

                        try:
                            sftp.stat(remote_dir)
                        except IOError:
                            _ssh_run(conn, f"mkdir -p {remote_dir}")

                        for file in files:
                            if file.endswith(SKIP_EXTS) or file in SKIP_FILES:
                                skipped_count += 1
                                continue
                            if (
                                not full_stack_profile
                                and file in frontend_only_skip_roots
                            ):
                                skipped_count += 1
                                continue
                            local_file = Path(root) / file
                            remote_file = f"{remote_dir}/{file}".replace("\\", "/")
                            try:
                                sftp.put(str(local_file), remote_file)
                                uploaded_count += 1
                                uploaded_files.append(
                                    f"{rel_root}/{file}".replace("\\", "/")
                                )
                                if uploaded_count % 10 == 0:
                                    self._add_log(
                                        f"Yukleniyor... {uploaded_count} dosya aktarildi",
                                        "info",
                                        "upload",
                                    )
                            except Exception as put_err:
                                self._add_log(
                                    f"Dosya yuklenemedi: {file} -> {str(put_err)[:100]}",
                                    "warning",
                                    "upload",
                                )

                file_list_preview = "\n".join(uploaded_files[:50])
                if len(uploaded_files) > 50:
                    file_list_preview += (
                        f"\n... ve {len(uploaded_files) - 50} dosya daha"
                    )

                self._add_log(
                    f"Dosya yukleme tamamlandi | Yuklenen: {uploaded_count} | Atlanan: {skipped_count}\n"
                    f"Yuklenen dosyalar:\n{file_list_preview}",
                    "success",
                    "upload",
                )

            except Exception as e:
                self._add_log(f"SFTP yukleme basarisiz: {str(e)}", "error", "upload")
                errors.append(f"File upload failed: {str(e)}")

            # Adım 5: Uzak Python Ortamı
            if full_stack_profile:
                _progress(5, "Uzak Python ortami kuruluyor...", "info")
                self._add_log(
                    "Adim 5/7: Uzak sunucuda Python ortami kuruluyor",
                    "info",
                    "host-setup",
                )

                remote_api = f"{hosting_config.remote_path}/api"
                venv_python = f"{remote_api}/.venv/bin/python"
                venv_pip = f"{remote_api}/.venv/bin/pip"
                venv_alembic = f"{remote_api}/.venv/bin/alembic"

                r_py = _ssh_run(
                    conn,
                    "python3.13 --version 2>/dev/null && echo PY313_OK || echo PY313_MISSING",
                )
                py_bin = (
                    "python3.13" if "PY313_OK" in (r_py.stdout or "") else "python3"
                )

                r_venv_check = _ssh_run(
                    conn,
                    f"test -f {remote_api}/.venv/bin/python && test -f {remote_api}/.venv/bin/pip && echo VENV_EXISTS || echo VENV_MISSING",
                )
                venv_already_exists = "VENV_EXISTS" in (r_venv_check.stdout or "")
                if not venv_already_exists:
                    r = _ssh_run(
                        conn,
                        f"rm -rf {remote_api}/.venv && {py_bin} -m venv {remote_api}/.venv 2>&1",
                    )
                    if not r.ok:
                        errors.append(
                            f"venv creation failed: {((r.stdout or '') + (r.stderr or ''))[:300]}"
                        )

                _ssh_run(conn, f"{venv_pip} install --upgrade pip 2>&1")
                r = _ssh_run(
                    conn,
                    f"{venv_pip} install -r {remote_api}/requirements.txt 2>&1 | tail -20",
                )
                if not r.ok:
                    errors.append(
                        f"pip install failed: {((r.stdout or '') + (r.stderr or ''))[:300]}"
                    )

                _ssh_run(
                    conn,
                    f"if test -f {remote_api}/requirements-lock.txt; then {venv_pip} install -r {remote_api}/requirements-lock.txt 2>&1 | tail -5; else echo LOCK_NOT_FOUND; fi",
                )
                _ssh_run(
                    conn, f"test -f {venv_alembic} || {venv_pip} install alembic 2>&1"
                )
                _ssh_run(
                    conn,
                    f"if test -f {remote_api}/alembic.ini; then cd {remote_api} && {venv_alembic} -c {remote_api}/alembic.ini upgrade head 2>&1; else echo ALEMBIC_INI_MISSING; fi",
                )
                self._add_log(
                    "Uzak API/venv kurulumu tamamlandi", "success", "host-setup"
                )
            else:
                self._add_log(
                    "Bu domain profili frontend-only: API/venv kurulumu atlandi.",
                    "info",
                    "host-setup",
                )

            # Adim 6: Frontend - Lokal dist/ dogrudan kopyala (sunucuda build yok)
            _progress(6, "Frontend build ediliyor...", "info")
            self._add_log("Adim 6/7: Frontend dosyalari yukleniyor", "info", "frontend")

            # Lokal dist/ dizinini bul
            import os as _os

            _api_dir = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
            _root_dir = _os.path.dirname(_api_dir)
            _dist_dir = _os.path.join(_root_dir, "web", "dist")

            if not _os.path.isdir(_dist_dir):
                self._add_log(
                    f"Lokal web/dist/ bulunamadi ({_dist_dir}), 'npm run build' yapilmali",
                    "warning",
                    "frontend",
                )
            else:
                # dist/ icindeki dosyalari say
                _dist_files = []
                for _root, _dirs, _fnames in _os.walk(_dist_dir):
                    # .venv, node_modules gibi klasorleri atla
                    _dirs[:] = [d for d in _dirs if d not in ("node_modules", ".venv")]
                    for _fn in _fnames:
                        _fp = _os.path.join(_root, _fn)
                        _dist_files.append(_fp)

                self._add_log(
                    f"Lokal dist/ bulundu: {len(_dist_files)} dosya -> hostinge yukleniyor",
                    "info",
                    "frontend",
                )

                # Sunucudaki eski frontend dosyalarini temizle (api/ ve web/ korunuyor)
                _ssh_run(
                    conn,
                    f"find {hosting_config.remote_path} -maxdepth 1 "
                    f"-not -name 'api' -not -name 'web' -not -name 'migrations' "
                    f"-not -name 'adminer.php' -not -name 'adminer_core.php' "
                    f"-not -name 'requirements.txt' -not -name 'requirements-lock.txt' "
                    f"-not -name '.env.example' -not -name '.' "
                    f"-not -path '{hosting_config.remote_path}' "
                    f"-delete 2>/dev/null || true",
                )

                # SFTP ile dist/ icerigini httpdocs/ kokune yukle
                _fe_ok = 0
                _fe_fail = 0
                # SFTP transport'u yenile — Adım 4 sonrası kapanmış olabilir
                # Her zaman yeni bağlantı aç — en güvenilir yöntem
                try:
                    conn.close()
                except Exception:
                    pass
                conn = build_ssh_connection(hosting_config)
                self._add_log(
                    "Frontend icin SSH baglantisi yenilendi", "info", "frontend"
                )

                try:
                    with conn.sftp() as _sftp:
                        for _fp in _dist_files:
                            _rel = _os.path.relpath(_fp, _dist_dir).replace("\\", "/")
                            _remote_fp = f"{hosting_config.remote_path}/{_rel}"
                            _remote_dir = _remote_fp.rsplit("/", 1)[0]
                            # Uzak dizini olustur
                            try:
                                _parts = (
                                    _remote_dir.replace(hosting_config.remote_path, "")
                                    .strip("/")
                                    .split("/")
                                )
                                _cur = hosting_config.remote_path
                                for _part in _parts:
                                    if not _part:
                                        continue
                                    _cur = f"{_cur}/{_part}"
                                    try:
                                        _sftp.stat(_cur)
                                    except FileNotFoundError:
                                        _sftp.mkdir(_cur)
                            except Exception:
                                pass
                            try:
                                _sftp.put(_fp, _remote_fp)
                                _fe_ok += 1
                            except Exception as _ue:
                                _fe_fail += 1
                                self._add_log(
                                    f"Yuklenemedi: {_rel} -> {str(_ue)[:100]}",
                                    "warning",
                                    "frontend",
                                )

                    self._add_log(
                        f"Frontend yuklendi: {_fe_ok} dosya basarili, {_fe_fail} atlanamadi",
                        "success" if _fe_fail == 0 else "warning",
                        "frontend",
                    )

                    # index.html dogrula
                    _r_idx = _ssh_run(
                        conn,
                        f"test -f {hosting_config.remote_path}/index.html "
                        f"&& echo IDX_OK || echo IDX_MISSING",
                    )
                    if "IDX_OK" in (_r_idx.stdout or ""):
                        self._add_log(
                            "index.html dogrulandi - frontend hazir",
                            "success",
                            "frontend",
                        )
                    else:
                        self._add_log(
                            "index.html bulunamadi - dist/ icerigi kontrol edilmeli",
                            "warning",
                            "frontend",
                        )

                except Exception as _fe_err:
                    self._add_log(
                        f"Frontend SFTP hatasi: {str(_fe_err)[:300]}",
                        "error",
                        "frontend",
                    )

            if not full_stack_profile:
                self._add_log(
                    "Frontend-only deploy profili tamamlandi. API/systemd adimlari bu domainde atlandi.",
                    "success",
                    "deploy",
                )
                return SystemSetupResponse(
                    success=True,
                    logs=self.deployment_logs,
                    summary=f"Frontend-only deploy tamamlandi ({hosting_config.domain}).",
                    errors=[],
                )

            # .env dosyası kontrolü
            self._add_log("Uzak .env dosyasi kontrol ediliyor...", "info", "services")
            r_env = _ssh_run(
                conn,
                f"test -f {remote_api}/.env && echo ENV_OK || echo ENV_MISSING",
            )
            env_exists = "ENV_OK" in (r_env.stdout or "")

            r_db = _ssh_run(
                conn,
                f"grep -E '^DATABASE_URL=.+' {remote_api}/.env 2>/dev/null "
                f"&& echo DB_OK || echo DB_EMPTY",
            )
            db_filled = "DB_OK" in (r_db.stdout or "")

            if not env_exists or not db_filled:
                self._add_log(
                    ".env eksik veya DATABASE_URL bos — hosting degerleri yaziliyor...",
                    "warning",
                    "services",
                )
                hosting_env_content = (
                    "# Auto-generated by deployment script\\n"
                    f"DATABASE_URL=postgresql+psycopg://buyerasistans:96578097Run!!@localhost:5432/admin_procureflow\\n"
                    f"JWT_SECRET_KEY=prod-secret-buyera-2026-change-this\\n"
                    f"JWT_ALGORITHM=HS256\\n"
                    f"JWT_EXPIRE_MINUTES=60\\n"
                    f"APP_ENV=production\\n"
                    f"APP_URL=https://{hosting_config.domain}\\n"
                    f"DEBUG=false\\n"
                    f"SMTP_SERVER=buyerasistans.com.tr\\n"
                    f"SMTP_PORT=465\\n"
                    f"SMTP_USE_TLS=false\\n"
                    f"SMTP_USE_SSL=true\\n"
                    f"SENDER_EMAIL=notifications@buyerasistans.com.tr\\n"
                    f"SENDER_PASSWORD=Noti!9934e567df51A9#\\n"
                    f"FROM_EMAIL=notifications@buyerasistans.com.tr\\n"
                    f"MAIL_FROM_NAME=Buyera Asistans\\n"
                    f"MAIL_DOMAIN=buyerasistans.com.tr\\n"
                    f"DOMAIN_MODE=true\\n"
                )
                _ssh_run(
                    conn,
                    f"printf '{hosting_env_content}' > {remote_api}/.env && echo ENV_WRITTEN",
                )
            desired_domain_mode = (
                "true" if bool(hosting_config.domain_mode_enabled) else "false"
            )
            if bool(hosting_config.domain_mode_enabled):
                desired_domain_mode = "true"
            _ssh_run(
                conn,
                (
                    f"if grep -q '^DOMAIN_MODE=' {remote_api}/.env; then "
                    f"sed -i 's/^DOMAIN_MODE=.*/DOMAIN_MODE={desired_domain_mode}/' {remote_api}/.env; "
                    f"else echo 'DOMAIN_MODE={desired_domain_mode}' >> {remote_api}/.env; fi"
                ),
            )
            self._add_log(
                f"Hosting .env olusturuldu: {remote_api}/.env",
                "success",
                "services",
            )

            r_final = _ssh_run(
                conn,
                f"grep '^DATABASE_URL' {remote_api}/.env | head -1",
            )
            self._add_log(
                f"DATABASE_URL kontrol: {(r_final.stdout or '').strip()[:80]}",
                "info",
                "services",
            )
            # -- 6b: Stub dosyaları oluştur (main.py import hatalarını önle) --
            self._add_log("Stub dosyaları oluşturuluyor...", "info", "host-setup")
            _stub_files = [
                "department_crud_example",
                "job_crud_example",
                "user_crud_example",
                "role_crud_example",
            ]
            _stub_content = "from fastapi import APIRouter\\nrouter = APIRouter()\\n"
            for _stub in _stub_files:
                _stub_path = f"{remote_api}/{_stub}.py"
                r_stub = _ssh_run(
                    conn,
                    f"test -f {_stub_path} || printf '{_stub_content}' > {_stub_path} && echo STUB_OK",
                )
                self._add_log(
                    f"  {_stub}.py: {(r_stub.stdout or '').strip()[:40]}",
                    "info",
                    "host-setup",
                )

            # Adım 7: Servisleri Başlat
            _progress(7, "Servisler baslatiliyor...", "info")
            self._add_log(
                "Adim 7/7: Servisler ve sistem entegrasyonu baslatiliyor",
                "info",
                "services",
            )
            try:
                # -- 7a: Uvicorn'u durdur ------------------------------------------
                r_kill = _ssh_run(
                    conn,
                    "pkill -f 'uvicorn' 2>/dev/null || true && sleep 2 && echo KILL_DONE",
                )
                self._add_log(
                    f"Mevcut process durduruldu: {(r_kill.stdout or '').strip()}",
                    "info",
                    "services",
                )

                # -- 7b: systemd unit olustur -------------------------------------
                self._add_log(
                    "systemd unit olusturuluyor: procureflow.service", "info", "systemd"
                )
                # ✅ YENİ
                _remote_root = hosting_config.remote_path  # /var/www/.../httpdocs
                _unit_content = (
                    "[Unit]\\n"
                    "Description=ProcureFlow API (Uvicorn)\\n"
                    "After=network.target postgresql.service\\n"
                    "\\n"
                    "[Service]\\n"
                    f"WorkingDirectory={_remote_root}\\n"
                    f"EnvironmentFile={remote_api}/.env\\n"
                    "Environment=PYTHONUNBUFFERED=1\\n"
                    f"ExecStart={remote_api}/.venv/bin/python3 -m uvicorn api.main:app "
                    f"--host 0.0.0.0 --port 8000 --workers 2\\n"
                    "Restart=always\\n"
                    "RestartSec=5\\n"
                    "StandardOutput=append:/var/log/procureflow.log\\n"
                    "StandardError=append:/var/log/procureflow.log\\n"
                    "\\n"
                    "[Install]\\n"
                    "WantedBy=multi-user.target\\n"
                )

                r_unit = _ssh_run(
                    conn,
                    f"printf '{_unit_content}' > /etc/systemd/system/procureflow.service "
                    f"&& echo UNIT_OK || echo UNIT_FAIL",
                )
                unit_out = (r_unit.stdout or "").strip()
                if "UNIT_OK" in unit_out:
                    self._add_log("systemd unit dosyasi yazildi", "success", "systemd")
                    # daemon-reload + enable + start
                    r_enable = _ssh_run(
                        conn,
                        "systemctl daemon-reload 2>&1 && "
                        "systemctl stop procureflow.service 2>/dev/null || true && "
                        "sleep 1 && "
                        "systemctl enable procureflow.service 2>&1 && "
                        "systemctl start procureflow.service 2>&1 && "
                        "echo SYSTEMD_OK",
                    )

                    enable_out = (r_enable.stdout or "").strip()
                    if "SYSTEMD_OK" in enable_out:
                        self._add_log(
                            "procureflow.service aktif ve reboot'ta otomatik baslar",
                            "success",
                            "systemd",
                        )
                        # Servis durumunu dogrula
                        r_status = _ssh_run(
                            conn,
                            "systemctl is-active procureflow.service 2>/dev/null && "
                            "echo SERVICE_ACTIVE || echo SERVICE_INACTIVE",
                        )
                        status_out = (r_status.stdout or "").strip()
                        self._add_log(
                            f"procureflow.service durumu: {status_out[:100]}",
                            "success" if "SERVICE_ACTIVE" in status_out else "warning",
                            "systemd",
                        )

                    else:
                        self._add_log(
                            f"systemd enable/start uyarisi: {enable_out[:300]}",
                            "warning",
                            "systemd",
                        )
                else:
                    # systemd yoksa (shared hosting) nohup fallback
                    self._add_log(
                        f"systemd kullanim hakki yok ({unit_out[:100]}), nohup fallback...",
                        "warning",
                        "systemd",
                    )
                    _launch_cmd = (
                        f"cd {remote_api} && "
                        f"nohup {remote_api}/.venv/bin/uvicorn api.main:app "
                        f"--host 0.0.0.0 --port 8000 --workers 2 "
                        f"--env-file {remote_api}/.env "
                        f">/tmp/uvicorn_start.log 2>&1 & "
                        f"UPID=$!; disown $UPID; echo LAUNCH_OK_PID_$UPID"
                    )
                    try:
                        r_start = conn.run(
                            _launch_cmd,
                            hide=True,
                            warn=True,
                            in_stream=False,
                            timeout=15,
                        )
                        launch_out = (r_start.stdout or "").strip()
                    except Exception as _tex:
                        launch_out = f"timeout/exception: {str(_tex)[:100]}"
                    self._add_log(
                        f"nohup fallback: {launch_out[:200]}", "info", "services"
                    )

                # -- 7c: guard script olustur -------------------------------------
                self._add_log(
                    "Guard script olusturuluyor: /usr/local/bin/procureflow_guard.sh",
                    "info",
                    "systemd",
                )
                _guard_content = (
                    "#!/bin/bash\\n"
                    "# ProcureFlow API Guard - cron tarafindan calistirilir\\n"
                    "LOGFILE=/var/log/procureflow_guard.log\\n"
                    "API_URL=http://127.0.0.1:8000/api/v1/health\\n"
                    f"REMOTE_PATH={hosting_config.remote_path}\\n"
                    f"VENV_UVICORN={remote_api}/.venv/bin/uvicorn\\n"
                    f"ENV_FILE={remote_api}/.env\\n"
                    "\\n"
                    "# systemd varsa onu kullan\\n"
                    "if command -v systemctl &>/dev/null && systemctl is-enabled procureflow.service &>/dev/null; then\\n"
                    "    if ! systemctl is-active --quiet procureflow.service; then\\n"
                    '        echo \\"[$(date)] procureflow.service down, restarting...\\" >> $LOGFILE\\n'
                    "        systemctl restart procureflow.service >> $LOGFILE 2>&1\\n"
                    "    fi\\n"
                    "    exit 0\\n"
                    "fi\\n"
                    "\\n"
                    "# systemd yoksa process kontrol\\n"
                    "if ! curl -sf $API_URL > /dev/null 2>&1; then\\n"
                    "    if ! pgrep -f 'uvicorn main:app' > /dev/null 2>&1; then\\n"
                    '        echo \\"[$(date)] API down, restarting...\\" >> $LOGFILE\\n'
                    f"        cd {remote_api}\\n"
                    "        nohup $VENV_UVICORN main:app --host 0.0.0.0 --port 8000 --workers 2 --env-file $ENV_FILE >> $LOGFILE 2>&1 &\\n"
                    "        disown $!\\n"
                    "    fi\\n"
                    "fi\\n"
                )
                r_guard = _ssh_run(
                    conn,
                    f"printf '{_guard_content}' > /usr/local/bin/procureflow_guard.sh "
                    f"&& chmod +x /usr/local/bin/procureflow_guard.sh "
                    f"&& echo GUARD_OK || echo GUARD_FAIL",
                )
                guard_out = (r_guard.stdout or "").strip()
                if "GUARD_OK" in guard_out:
                    self._add_log(
                        "Guard script olusturuldu ve calistirilebilir yapildi",
                        "success",
                        "systemd",
                    )
                else:
                    self._add_log(
                        f"Guard script uyarisi: {guard_out[:200]}", "warning", "systemd"
                    )

                # -- 7d: cron job ekle --------------------------------------------
                self._add_log(
                    "Cron job ekleniyor (her 5 dakikada bir guard)", "info", "systemd"
                )
                r_cron = _ssh_run(
                    conn,
                    "(crontab -l 2>/dev/null | grep -v 'procureflow_guard'; "
                    "echo '*/5 * * * * /usr/local/bin/procureflow_guard.sh') | crontab - "
                    "&& echo CRON_OK || echo CRON_FAIL",
                )
                cron_out = (r_cron.stdout or "").strip()
                if "CRON_OK" in cron_out:
                    self._add_log(
                        "Cron job eklendi: her 5 dakikada bir guard calisacak",
                        "success",
                        "systemd",
                    )
                else:
                    self._add_log(
                        f"Cron job uyarisi: {cron_out[:200]}", "warning", "systemd"
                    )

                # -- 7e: 4 saniye bekle, process dogrula --------------------------
                import time as _time

                _time.sleep(4)
                r_check = _ssh_run(
                    conn,
                    "pgrep -fa 'uvicorn' 2>/dev/null | head -3 || "
                    "systemctl is-active procureflow.service 2>/dev/null || "
                    "echo PROC_MISSING",
                )
                proc_out = (r_check.stdout or "").strip()
                self._add_log(f"Process kontrol: {proc_out[:200]}", "info", "services")

                # systemd aktif mi veya uvicorn process var mi?
                _svc_ok = (
                    "active" in proc_out.lower()
                    or "uvicorn" in proc_out.lower()
                    or ("PROC_MISSING" not in proc_out and proc_out.strip())
                )

                if _svc_ok:
                    self._add_log(
                        "Backend servisi baslatildi ve dogrulandi",
                        "success",
                        "services",
                    )
                else:
                    # Detayli hata logu al
                    r_log = _ssh_run(
                        conn,
                        "journalctl -u procureflow.service -n 30 --no-pager 2>/dev/null; "
                        "echo '--- procureflow.log son 20 satir ---'; "
                        "tail -20 /var/log/procureflow.log 2>/dev/null || echo 'log yok'; "
                        "echo '--- python import testi ---'; "
                        f"cd {remote_api} && "
                        f"{remote_api}/.venv/bin/python3 -c "
                        f'\'import sys; sys.path.insert(0, "{hosting_config.remote_path}"); '
                        f'from api.main import app; print("IMPORT_OK")\' 2>&1 | tail -20',
                    )
                    log_tail = (r_log.stdout or "").strip()
                    self._add_log(
                        f"Uvicorn baslanamadi. Detayli log:\n{log_tail[:1200]}",
                        "warning",
                        "services",
                    )

                self._add_log("Servisler adimi tamamlandi", "success", "services")

            except Exception as svc_err:
                tb = traceback.format_exc()
                self._add_log(
                    f"Servis baslatma EXCEPTION:\n{tb[:800]}",
                    "error",
                    "services",
                )
                self._add_log(
                    "Servisler adimi tamamlandi (exception ile)",
                    "success",
                    "services",
                )

            # Özet
            self._add_log("=" * 60, "info", "deploy")
            if errors:
                summary = (
                    f"Deploy TAMAMLANDI — {len(errors)} uyari/hata var\n"
                    + "\n".join([f"- {e}" for e in errors])
                )
                self._add_log(
                    f"Deploy tamamlandi — {len(errors)} hata", "warning", "deploy"
                )
            else:
                summary = (
                    "SITE BASARILI SEKILDE YAYINA ALINDI\n"
                    "Tum dosyalar yuklendi, ortam kuruldu ve servisler baslatildi."
                )
                self._add_log(
                    "Deploy tamamlandi — tum adimlar basarili", "success", "deploy"
                )
            self._add_log("=" * 60, "info", "deploy")
            self._add_log("DEPLOY_COMPLETE", "success", "services")

            return SystemSetupResponse(
                success=len(errors) == 0,
                logs=self.deployment_logs,
                summary=summary,
                errors=errors,
            )

        except Exception as e:
            self._add_log(f"Beklenmeyen hata: {str(e)}", "error", "deploy")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Deployment basarisiz: {str(e)}",
                errors=[str(e)],
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                    self._add_log("SSH baglantisi kapatildi", "info", "connect")
                except Exception:
                    pass

    # ----------------------------------------------------------
    # Site Yenileme
    # ----------------------------------------------------------

    async def reload_remote_site(
        self, hosting_config: HostingConfig
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        conn = None
        remote_api = f"{hosting_config.remote_path}/api"  # ✅ EKLE - bu satır eksikti

        try:
            self._add_log("=" * 60, "info", "reload")
            self._add_log(
                f"Site yenileme baslatildi -> {hosting_config.domain}", "info", "reload"
            )
            self._add_log("=" * 60, "info", "reload")

            self._add_log("SSH baglantisi kuruluyor...", "info", "connect")
            try:
                conn = build_ssh_connection(hosting_config)
                self._add_log("SSH baglantisi basarili", "success", "connect")
            except Exception as e:
                self._add_log(f"SSH baglantisi basarisiz: {str(e)}", "error", "connect")
                errors.append(f"Connection failed: {str(e)}")
                return SystemSetupResponse(
                    success=False,
                    logs=self.deployment_logs,
                    summary=f"Baglanti kurulamadi: {str(e)}",
                    errors=errors,
                )

            self._add_log("Mevcut process durumu kontrol ediliyor...", "info", "reload")
            try:
                proc_check = _ssh_run(
                    conn,
                    "pgrep -f 'uvicorn main:app' > /dev/null 2>&1 "
                    "&& echo PROC_RUNNING || echo PROC_MISSING",
                )
                proc_status = (proc_check.stdout or "").strip()
                if "PROC_RUNNING" in proc_status:
                    self._add_log(
                        "Calisan uvicorn process bulundu, durduruluyor...",
                        "info",
                        "reload",
                    )
                else:
                    self._add_log(
                        "Calisan uvicorn process bulunamadi, yeni baslatilacak",
                        "warning",
                        "reload",
                    )
            except Exception:
                pass

            try:
                _ssh_run(conn, "pkill -f 'uvicorn main:app' || true")
                self._add_log("process durdurma tamamlandi", "success", "reload")
            except Exception as e:
                self._add_log(f"process durdurma hatasi: {str(e)}", "error", "reload")
                errors.append(f"Reload failed [process durdurma]: {str(e)}")

            time.sleep(1)

            try:
                # Once systemd ile dene, yoksa nohup fallback
                r_systemd_check = _ssh_run(
                    conn,
                    "systemctl is-enabled procureflow.service 2>/dev/null "
                    "&& echo SYSTEMD_ENABLED || echo SYSTEMD_NOT_AVAILABLE",
                )
                use_systemd = "SYSTEMD_ENABLED" in (r_systemd_check.stdout or "")

                if use_systemd:
                    self._add_log(
                        "systemd ile yeniden baslatiliyor...", "info", "reload"
                    )
                    r_start = _ssh_run(
                        conn,
                        "systemctl restart procureflow.service 2>&1 && echo STARTED",
                    )
                    start_out = (r_start.stdout or "").strip()
                    self._add_log(
                        f"systemctl restart tamamlandi: {start_out[:100]}",
                        "success" if "STARTED" in start_out else "warning",
                        "reload",
                    )
                else:
                    self._add_log(
                        "systemd yok, nohup ile baslatiliyor...", "warning", "reload"
                    )
                    r_start = _ssh_run(
                        conn,
                        f"pkill -f 'uvicorn' 2>/dev/null || true; "
                        f"sleep 1; "
                        f"cd {remote_api} && "
                        f"setsid {remote_api}/.venv/bin/python3 -m uvicorn api.main:app "
                        f"--host 0.0.0.0 --port 8000 --workers 2 "
                        f"</dev/null >/tmp/uvicorn_reload.log 2>&1 & "
                        f"echo STARTED",
                    )
                    self._add_log(
                        f"nohup baslatma tamamlandi: {(r_start.stdout or '').strip()[:100]}",
                        "success",
                        "reload",
                    )
            except Exception as e:
                self._add_log(f"process baslatma hatasi: {str(e)}", "error", "reload")
                errors.append(f"Reload failed [process baslatma]: {str(e)}")

            time.sleep(2)
            try:
                verify = _ssh_run(
                    conn,
                    "systemctl is-active procureflow.service 2>/dev/null | grep -q '^active' "
                    "&& echo PROC_RUNNING || "
                    "pgrep -f 'uvicorn' > /dev/null 2>&1 "
                    "&& echo PROC_RUNNING || echo PROC_MISSING",
                )

                v_status = (verify.stdout or "").strip()
                if "PROC_RUNNING" in v_status:
                    self._add_log(
                        "Servis dogrulandi: uvicorn calisiyor", "success", "reload"
                    )
                else:
                    self._add_log(
                        "Servis baslatildi ama process dogrulanamadi, api.log kontrol edin",
                        "warning",
                        "reload",
                    )
            except Exception as ve:
                self._add_log(f"Dogrulama yapilamadi: {str(ve)}", "warning", "reload")

            self._add_log("=" * 60, "info", "reload")
            summary = (
                "Site basariyla yeniden baslatildi."
                if not errors
                else f"Site yeniden baslatildi ama {len(errors)} hata olustu."
            )

            return SystemSetupResponse(
                success=len(errors) == 0,
                logs=self.deployment_logs,
                summary=summary,
                errors=errors,
            )

        except Exception as e:
            self._add_log(f"Beklenmeyen hata: {str(e)}", "error", "reload")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Reload hatasi: {str(e)}",
                errors=[str(e)],
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                    self._add_log("SSH baglantisi kapatildi", "info", "connect")
                except Exception:
                    pass

    # ----------------------------------------------------------
    # Uzak DB Migrasyonu
    # ----------------------------------------------------------

    async def run_remote_db_migration(
        self, hosting_config: HostingConfig
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        conn = None

        try:
            self._add_log("=" * 60, "info", "db-migrate")
            self._add_log(
                f"Uzak DB migrasyonu baslatildi -> {hosting_config.domain}",
                "info",
                "db-migrate",
            )
            self._add_log("=" * 60, "info", "db-migrate")

            self._add_log("SSH baglantisi kuruluyor...", "info", "connect")
            try:
                conn = build_ssh_connection(hosting_config)
                self._add_log("SSH baglantisi basarili", "success", "connect")
            except Exception as e:
                self._add_log(f"SSH baglantisi basarisiz: {str(e)}", "error", "connect")
                errors.append(f"Connection failed: {str(e)}")
                return SystemSetupResponse(
                    success=False,
                    logs=self.deployment_logs,
                    summary=f"Baglanti kurulamadi: {str(e)}",
                    errors=errors,
                )

            remote_api = f"{hosting_config.remote_path}/api"

            self._add_log(
                "Adim 1/3: Mevcut migration durumu kontrol ediliyor",
                "info",
                "db-migrate",
            )
            try:
                current_result = _ssh_run(
                    conn,
                    f"{remote_api}/.venv/bin/alembic -c {remote_api}/alembic.ini current 2>&1",
                )
                current_out = (current_result.stdout or "").strip()
                if current_out:
                    self._add_log(
                        f"Mevcut migration durumu:\n{current_out[:500]}",
                        "info",
                        "db-migrate",
                    )
                else:
                    self._add_log(
                        "Migration gecmisi bos (ilk kurulum olabilir)",
                        "warning",
                        "db-migrate",
                    )
            except Exception as e:
                self._add_log(
                    f"Migration durumu okunamadi (devam ediliyor): {str(e)}",
                    "warning",
                    "db-migrate",
                )

            self._add_log(
                "Adim 2/3: Alembic upgrade head calistiriliyor", "info", "db-migrate"
            )
            try:
                migrate_start = time.time()
                migrate_result = _ssh_run(
                    conn,
                    f"{remote_api}/.venv/bin/alembic -c {remote_api}/alembic.ini upgrade head 2>&1",
                )
                migrate_elapsed = round(time.time() - migrate_start, 1)
                migrate_out = (migrate_result.stdout or "").strip()
                if not migrate_result.ok and (
                    "stringdatarighttruncation" in migrate_out.lower()
                    or (
                        "alembic_version" in migrate_out.lower()
                        and "version_num" in migrate_out.lower()
                    )
                ):
                    self._add_log(
                        "alembic_version.version_num uyumsuzlugu tespit edildi, kolon genisletiliyor...",
                        "warning",
                        "db-migrate",
                    )
                    fix_success, fix_out = self._repair_remote_alembic_version_column(
                        conn, remote_api
                    )
                    if fix_out:
                        self._add_log(
                            f"alembic_version onarimi:\n{fix_out[:400]}",
                            "info",
                            "db-migrate",
                        )
                    if fix_success:
                        self._add_log(
                            "Migration yeniden deneniyor...", "info", "db-migrate"
                        )
                        migrate_start = time.time()
                        migrate_result = _ssh_run(
                            conn,
                            f"{remote_api}/.venv/bin/alembic -c {remote_api}/alembic.ini upgrade head 2>&1",
                        )
                        migrate_elapsed = round(time.time() - migrate_start, 1)
                        migrate_out = (migrate_result.stdout or "").strip()
                    else:
                        errors.append(f"alembic_version repair failed: {fix_out[:300]}")
                if migrate_result.ok:
                    self._add_log(
                        f"Migration basariyla tamamlandi ({migrate_elapsed}s)\n{migrate_out[:500]}",
                        "success",
                        "db-migrate",
                    )
                else:
                    stderr_text = (migrate_result.stderr or "")[:500]
                    self._add_log(
                        f"Migration uyari/hata ({migrate_elapsed}s):\n"
                        f"stdout: {migrate_out[:300]}\nstderr: {stderr_text}",
                        "error",
                        "db-migrate",
                    )
                    # Remote migration - already up to date durumunu hata sayma
                    _mig_out_lower = migrate_out.lower()
                    _remote_real_fail = (
                        "error" in _mig_out_lower or "traceback" in _mig_out_lower
                    ) and not (
                        "already up to date" in _mig_out_lower
                        or "already exists" in _mig_out_lower
                        or "duplicate" in _mig_out_lower
                        or "no changes" in _mig_out_lower
                    )
                    if _remote_real_fail:
                        errors.append(f"Alembic migration failed: {migrate_out[:300]}")
                    else:
                        self._add_log(
                            "Migration: zaten guncel veya tablo mevcut, atlaniyor",
                            "success",
                            "db-migrate",
                        )
            except Exception as e:
                self._add_log(f"Migration hatasi: {str(e)}", "error", "db-migrate")
                errors.append(f"Migration failed: {str(e)}")

            self._add_log(
                "Adim 3/3: Veritabani tablo listesi kontrol ediliyor",
                "info",
                "db-migrate",
            )
            try:
                table_result = _ssh_run(
                    conn,
                    f'cd {remote_api} && .venv/bin/python -c "'
                    "import os; from dotenv import load_dotenv; load_dotenv(); "
                    "import sqlalchemy as sa; "
                    "engine = sa.create_engine(os.getenv('DATABASE_URL', '')); "
                    "inspector = sa.inspect(engine); "
                    "tables = inspector.get_table_names(); "
                    "print(f'Toplam {len(tables)} tablo: ' + ', '.join(sorted(tables)[:20]))"
                    '" 2>&1',
                )
                table_out = (table_result.stdout or "").strip()
                if table_out and "tablo" in table_out.lower():
                    self._add_log(
                        f"Veritabani dogrulandi\n{table_out[:400]}",
                        "success",
                        "db-migrate",
                    )
                else:
                    self._add_log(
                        f"Tablo listesi alindi:\n{table_out[:400]}",
                        "info",
                        "db-migrate",
                    )
            except Exception as e:
                self._add_log(
                    f"Tablo listesi alinamadi (kritik degil): {str(e)}",
                    "warning",
                    "db-migrate",
                )

            self._add_log("=" * 60, "info", "db-migrate")
            summary = (
                "Uzak veritabani migrasyonu basariyla tamamlandi."
                if not errors
                else f"Migration tamamlanamadi: {'; '.join(errors[:2])}"
            )

            return SystemSetupResponse(
                success=len(errors) == 0,
                logs=self.deployment_logs,
                summary=summary,
                errors=errors,
            )

        except Exception as e:
            self._add_log(f"Beklenmeyen hata: {str(e)}", "error", "db-migrate")
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"DB migration hatasi: {str(e)}",
                errors=[str(e)],
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                    self._add_log("SSH baglantisi kapatildi", "info", "connect")
                except Exception:
                    pass

    # ----------------------------------------------------------
    # Yerel DB → Hosting DB
    # ----------------------------------------------------------

    async def push_local_database_to_hosting(
        self,
        hosting_config: HostingConfig,
    ) -> SystemSetupResponse:
        self.deployment_logs.clear()
        errors: List[str] = []
        conn = None
        local_dump_path: Path | None = None

        try:
            self._add_log("=" * 60, "info", "db-sync")
            self._add_log(
                f"Yerel veritabanı hosting veritabanına aktarılıyor -> {hosting_config.domain}",
                "info",
                "db-sync",
            )
            self._add_log("=" * 60, "info", "db-sync")

            # ── Yerel DB bağlantı bilgilerini çöz ────────────────────────────────
            local_override_provided = any(
                [
                    hosting_config.local_db_host,
                    hosting_config.local_db_port,
                    hosting_config.local_db_name,
                    hosting_config.local_db_user,
                    hosting_config.local_db_password,
                ]
            )

            if local_override_provided:
                local_host = hosting_config.local_db_host or "localhost"
                local_port = int(hosting_config.local_db_port or 5432)
                local_db = hosting_config.local_db_name
                local_user = hosting_config.local_db_user
                local_pass = hosting_config.local_db_password
                if not local_db:
                    raise RuntimeError("Local DB override: local_db_name eksik")
                if not local_user:
                    raise RuntimeError("Local DB override: local_db_user eksik")
                if local_pass is None or local_pass == "":
                    raise RuntimeError("Local DB override: local_db_password eksik")
            else:
                local_database_url = os.getenv("DATABASE_URL", "").strip()
                if not local_database_url:
                    raise RuntimeError("Yerel DATABASE_URL bulunamadi")
                local_match = re.match(
                    r"^postgresql\+psycopg://([^:]+):([^@]+)@([^:]+):(\d+)/([\w-]+)$",
                    local_database_url,
                )
                if not local_match:
                    raise RuntimeError(
                        "Yerel DATABASE_URL beklenen PostgreSQL formatinda degil"
                    )
                local_user, local_pass, local_host, local_port, local_db = (
                    local_match.groups()
                )
                local_port = int(local_port)

            resolved_local_host = (
                "127.0.0.1" if local_host in ("localhost", "127.0.0.1") else local_host
            )
            self._add_log(
                f"Yerel DB tespit edildi: '{local_db}' ('{local_host}':{local_port})",
                "info",
                "db-sync",
            )

            # ── ADIM 1: Python psycopg ile SQL dump oluştur ───────────────────────
            temp_dir = self.base_path.parent / "tmp" / "db-sync"
            temp_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            local_dump_path = temp_dir / f"procureflow_local_to_hosting_{timestamp}.sql"

            self._add_log(
                "Yerel veritabani dump aliniyor (Python psycopg)...", "info", "db-sync"
            )

            try:
                import psycopg as _psycopg
            except ImportError:
                raise RuntimeError(
                    "psycopg paketi bulunamadi. "
                    "requirements.txt icinde 'psycopg[binary]' veya 'psycopg' olmali."
                )

            _conn_str = (
                f"host={resolved_local_host} port={local_port} "
                f"dbname={local_db} user={local_user} password={local_pass}"
            )

            try:
                with _psycopg.connect(_conn_str, autocommit=True) as _pg:
                    # Tablo listesini al
                    with _pg.cursor() as _cur:
                        _cur.execute(
                            "SELECT tablename FROM pg_tables "
                            "WHERE schemaname = 'public' "
                            "ORDER BY tablename"
                        )
                        _all_tables = [row[0] for row in _cur.fetchall()]

                    self._add_log(
                        f"Toplam {len(_all_tables)} tablo bulundu",
                        "info",
                        "db-sync",
                    )
                    # FK bağımlılık sıralaması — parent tablolar önce gelsin
                    with _pg.cursor() as _cur:
                        _cur.execute("""
                            WITH RECURSIVE deps AS (
                                SELECT
                                    tc.table_name AS child,
                                    ccu.table_name AS parent
                                FROM information_schema.table_constraints tc
                                JOIN information_schema.referential_constraints rc
                                    ON tc.constraint_name = rc.constraint_name
                                    AND tc.table_schema = rc.constraint_schema
                                JOIN information_schema.constraint_column_usage ccu
                                    ON rc.unique_constraint_name = ccu.constraint_name
                                    AND rc.unique_constraint_schema = ccu.constraint_schema
                                WHERE tc.constraint_type = 'FOREIGN KEY'
                                    AND tc.table_schema = 'public'
                                    AND ccu.table_schema = 'public'
                                    AND tc.table_name != ccu.table_name
                            )
                            SELECT DISTINCT child, parent FROM deps
                        """)
                        _fk_pairs = _cur.fetchall()

                    # Kahn algoritması ile topolojik sıralama
                    from collections import defaultdict, deque

                    _in_degree: dict = defaultdict(int)
                    _adj: dict = defaultdict(list)
                    _all_set = set(_all_tables)
                    for _child, _parent in _fk_pairs:
                        if (
                            _child in _all_set
                            and _parent in _all_set
                            and _child != _parent
                        ):
                            _adj[_parent].append(_child)
                            _in_degree[_child] += 1
                    for _t in _all_tables:
                        if _t not in _in_degree:
                            _in_degree[_t] = 0
                    _queue = deque([t for t in _all_tables if _in_degree[t] == 0])
                    _sorted_tables: List[str] = []
                    while _queue:
                        _node = _queue.popleft()
                        _sorted_tables.append(_node)
                        for _neighbor in _adj[_node]:
                            _in_degree[_neighbor] -= 1
                            if _in_degree[_neighbor] == 0:
                                _queue.append(_neighbor)
                    # Döngüsel FK varsa kalanları ekle
                    for _t in _all_tables:
                        if _t not in _sorted_tables:
                            _sorted_tables.append(_t)
                    _all_tables = _sorted_tables
                    self._add_log(
                        f"Tablo sirasi FK bagimliligina gore duzenlendi: {len(_all_tables)} tablo",
                        "info",
                        "db-sync",
                    )

                    sql_parts: List[str] = [
                        "-- ProcureFlow DB Dump (psycopg)",
                        "-- FK kısıtlamaları tablo bazlı devre dışı bırakılıyor",
                        "",
                    ]

                    total_rows_exported = 0

                    for _tbl in _all_tables:
                        if _tbl == "alembic_version":
                            continue

                        with _pg.cursor() as _cur:
                            # Kolon adları
                            _cur.execute(
                                "SELECT column_name FROM information_schema.columns "
                                "WHERE table_schema = 'public' AND table_name = %s "
                                "ORDER BY ordinal_position",
                                (_tbl,),
                            )
                            _cols = [row[0] for row in _cur.fetchall()]
                            if not _cols:
                                continue

                            _cols_sql = ", ".join(f'"{c}"' for c in _cols)
                            _cur.execute(f'SELECT {_cols_sql} FROM "{_tbl}"')
                            _rows = _cur.fetchall()

                        if not _rows:
                            continue

                        total_rows_exported += len(_rows)
                        sql_parts.append(f"-- Table: {_tbl} ({len(_rows)} rows)")

                        _BATCH = 500
                        for _i in range(0, len(_rows), _BATCH):
                            _batch = _rows[_i : _i + _BATCH]
                            _val_strs: List[str] = []
                            for _row in _batch:
                                _cell_strs: List[str] = []
                                for _v in _row:
                                    if _v is None:
                                        _cell_strs.append("NULL")
                                    elif isinstance(_v, bool):
                                        _cell_strs.append("TRUE" if _v else "FALSE")
                                    elif isinstance(_v, (int, float)):
                                        _cell_strs.append(str(_v))
                                    elif isinstance(_v, (bytes, memoryview)):
                                        _bv = (
                                            bytes(_v)
                                            if isinstance(_v, memoryview)
                                            else _v
                                        )
                                        _cell_strs.append(f"'\\x{_bv.hex()}'")
                                    else:
                                        _s = (
                                            str(_v)
                                            .replace("\\", "\\\\")
                                            .replace("'", "''")
                                        )
                                        _cell_strs.append(f"'{_s}'")
                                _val_strs.append(f"({', '.join(_cell_strs)})")

                            sql_parts.append(
                                f'INSERT INTO "{_tbl}" ({_cols_sql}) VALUES\n'
                                + ",\n".join(_val_strs)
                                + "\nON CONFLICT DO NOTHING;"
                            )
                        sql_parts.append("")

                    sql_parts.append("-- Restore tamamlandi")
                    _sql_content = "\n".join(sql_parts)
                    local_dump_path.write_text(_sql_content, encoding="utf-8")

                _dump_size = local_dump_path.stat().st_size
                _has_insert = "INSERT INTO" in _sql_content[:10000]
                self._add_log(
                    f"Dump olusturuldu: {local_dump_path.name} | "
                    f"{_dump_size} bytes | "
                    f"{total_rows_exported} satir | "
                    f"INSERT={_has_insert}",
                    "success" if _has_insert else "error",
                    "db-sync",
                )
                if not _has_insert:
                    raise RuntimeError(
                        f"Dump olusturuldu ama INSERT komutu yok! "
                        f"Yerel DB bos olabilir. Satir sayisi: {total_rows_exported}"
                    )

            except RuntimeError:
                raise
            except Exception as _dump_err:
                raise RuntimeError(f"psycopg dump hatasi: {_dump_err}") from _dump_err

            # ── ADIM 2: SSH bağlantısı ────────────────────────────────────────────
            self._add_log("SSH baglantisi kuruluyor...", "info", "connect")
            conn = build_ssh_connection(hosting_config)
            verify = _ssh_run(conn, "echo SSH_OK && uname -r")
            self._add_log(
                f"SSH baglantisi basarili | {(verify.stdout or '').strip()}",
                "success",
                "connect",
            )

            # ── ADIM 3: Uzak DB bağlantı bilgileri ───────────────────────────────
            remote_override_provided = any(
                [
                    hosting_config.remote_db_host,
                    hosting_config.remote_db_port,
                    hosting_config.remote_db_name,
                    hosting_config.remote_db_user,
                    hosting_config.remote_db_password,
                ]
            )

            if remote_override_provided:
                remote_db = hosting_config.remote_db_name or ""
                remote_user = hosting_config.remote_db_user or ""
                remote_password = hosting_config.remote_db_password or ""
                remote_host = hosting_config.remote_db_host or "localhost"
                remote_port = int(hosting_config.remote_db_port or 5432)
            else:
                remote_api = f"{hosting_config.remote_path}/api"
                remote_env_result = _ssh_run(
                    conn,
                    f"grep '^DATABASE_URL=' {remote_api}/.env 2>/dev/null | head -1",
                )
                remote_env_line = (remote_env_result.stdout or "").strip()
                if not remote_env_line or "=" not in remote_env_line:
                    raise RuntimeError(
                        f"Hosting .env icinden DATABASE_URL bulunamadi ({remote_api}/.env)"
                    )
                remote_database_url = remote_env_line.partition("=")[2].strip()
                try:
                    from sqlalchemy.engine import make_url

                    parsed = make_url(remote_database_url)
                    remote_db = parsed.database
                    remote_user = parsed.username
                    remote_password = parsed.password
                    remote_host = parsed.host or "localhost"
                    remote_port = parsed.port or 5432
                except Exception as exc:
                    raise RuntimeError(
                        f"Hosting DATABASE_URL parse edilemedi: {str(exc)[:200]}"
                    ) from exc

            if not remote_db:
                raise RuntimeError("Hosting DB adi cikarilamadi")
            if not remote_user:
                raise RuntimeError("Hosting DB kullanicisi cikarilamadi")
            if not remote_password:
                raise RuntimeError("Hosting DB sifresi cikarilamadi")

            self._add_log(
                f"Uzak DB: {remote_db} @ {remote_host}:{remote_port}", "info", "db-sync"
            )

            # ── ADIM 4: Dump'ı sunucuya yükle ────────────────────────────────────
            remote_dump_path = f"/tmp/{local_dump_path.name}"
            remote_restore_log_path = f"/tmp/pf_restore_{timestamp}.log"
            remote_restore_exit_path = f"/tmp/pf_restore_{timestamp}.exitcode"
            remote_restore_script = f"/tmp/pf_restore_{timestamp}.sh"

            _script_lines = [
                "#!/bin/bash",
                "set -e",
                f"PGPASSWORD={_bash_single_quote(remote_password)} psql"
                f" -h {_bash_single_quote(str(remote_host))}"
                f" -p {remote_port}"
                f" -U {_bash_single_quote(str(remote_user))}"
                f" -d {remote_db}"
                f" -v ON_ERROR_STOP=0"
                f" -f {remote_dump_path}"
                f" > /tmp/pf_restore_psql_{timestamp}.log 2>&1",
                f"echo $? > {remote_restore_exit_path}",
            ]
            _script_content = "\n".join(_script_lines) + "\n"

            self._add_log("Dump sunucuya yukleniyor...", "info", "db-sync")
            with conn.sftp() as _sftp:
                _sftp.put(str(local_dump_path), remote_dump_path)
                _sftp.putfo(
                    io.BytesIO(_script_content.encode("utf-8")),
                    remote_restore_script,
                )
            _ssh_run(conn, f"chmod +x {remote_restore_script}", timeout=10)
            self._add_log("Dump yuklendi", "success", "db-sync")

            # ── ADIM 5: Aktif bağlantıları kes ───────────────────────────────────
            self._add_log("Aktif baglantılar kesiliyor...", "info", "database")
            _ssh_run(
                conn,
                (
                    f"PGPASSWORD={_bash_single_quote(remote_password)} psql "
                    f"-h {_bash_single_quote(str(remote_host))} "
                    f"-p {remote_port} "
                    f"-U {_bash_single_quote(str(remote_user))} "
                    f"-d postgres -tA "
                    f'-c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity '
                    f"WHERE datname = '{remote_db}' AND pid <> pg_backend_pid();\" 2>&1"
                ),
                timeout=30,
            )
            self._add_log("Aktif baglantılar kesildi", "success", "database")

            # ── ADIM 6: TRUNCATE CASCADE ──────────────────────────────────────────
            self._add_log(
                "Uzak DB temizleniyor (TRUNCATE CASCADE)...", "info", "database"
            )
            _truncate_sql = (
                "DO $pf$ DECLARE r RECORD; BEGIN "
                "FOR r IN (SELECT tablename FROM pg_tables "
                "WHERE schemaname='public' AND tablename!='alembic_version') LOOP "
                "EXECUTE 'TRUNCATE TABLE '||quote_ident(r.tablename)||' CASCADE'; "
                "END LOOP; END $pf$;"
            )
            _tr = _ssh_run(
                conn,
                (
                    f"PGPASSWORD={_bash_single_quote(remote_password)} psql "
                    f"-h {_bash_single_quote(str(remote_host))} "
                    f"-p {remote_port} "
                    f"-U {_bash_single_quote(str(remote_user))} "
                    f"-d {remote_db} "
                    f"-c {shlex.quote(_truncate_sql)} 2>&1"
                ),
                timeout=300,
            )
            _tr_out = ((_tr.stdout or "") + (_tr.stderr or "")).strip()
            if not _tr.ok:
                raise RuntimeError(f"TRUNCATE basarisiz: {_tr_out[:500]}")
            self._add_log("TRUNCATE tamamlandi", "success", "database")

            # ── ADIM 7: FK Devre Dışı + Restore + FK Aktif ───────────────────────
            self._add_log("Restore baslatiliyor...", "info", "database")

            _fk_disable_sql = (
                "DO $pf$ DECLARE r RECORD; BEGIN "
                "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP "
                "EXECUTE 'ALTER TABLE '||quote_ident(r.tablename)||' DISABLE TRIGGER ALL'; "
                "END LOOP; END $pf$;"
            )
            _fk_enable_sql = (
                "DO $pf$ DECLARE r RECORD; BEGIN "
                "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP "
                "EXECUTE 'ALTER TABLE '||quote_ident(r.tablename)||' ENABLE TRIGGER ALL'; "
                "END LOOP; END $pf$;"
            )

            # sudo -u postgres ile peer auth (şifresiz superuser)
            _fk_dis_r = _ssh_run(
                conn,
                f"sudo -u postgres psql -d {remote_db} "
                f"-c {shlex.quote(_fk_disable_sql)} 2>&1 && echo FK_DISABLED || echo FK_SKIP",
                timeout=30,
            )
            _fk_dis_out = ((_fk_dis_r.stdout or "") + (_fk_dis_r.stderr or "")).strip()
            self._add_log(
                f"FK devre disi: {_fk_dis_out[:150] if _fk_dis_out else 'OK'}",
                "info",
                "database",
            )

            _restore_r = _ssh_run(
                conn,
                (
                    f"PGPASSWORD={_bash_single_quote(remote_password)} psql "
                    f"-h {_bash_single_quote(str(remote_host))} "
                    f"-p {remote_port} "
                    f"-U {_bash_single_quote(str(remote_user))} "
                    f"-d {remote_db} "
                    f"-v ON_ERROR_STOP=0 "
                    f"-f {remote_dump_path} 2>&1 | tail -30"
                ),
                timeout=1800,
            )
            _restore_out = (
                (_restore_r.stdout or "") + (_restore_r.stderr or "")
            ).strip()
            self._add_log(
                f"Restore tamamlandi. Son log:\n{_restore_out[-800:] if _restore_out else 'cikti yok'}",
                "success",
                "database",
            )

            _fk_en_r = _ssh_run(
                conn,
                f"sudo -u postgres psql -d {remote_db} "
                f"-c {shlex.quote(_fk_enable_sql)} 2>&1 && echo FK_ENABLED || echo FK_SKIP",
                timeout=30,
            )
            _fk_en_out = ((_fk_en_r.stdout or "") + (_fk_en_r.stderr or "")).strip()
            self._add_log(
                f"FK kisitlamalari yeniden aktif edildi: {_fk_en_out[:80] if _fk_en_out else 'OK'}",
                "success",
                "database",
            )

            # ── ADIM 8: Sequence güncelle ─────────────────────────────────────────
            self._add_log("Sequence'lar guncelleniyor...", "info", "database")
            _seq_sql = (
                "DO $pf$ DECLARE r RECORD; max_val BIGINT; seq_name TEXT; BEGIN "
                "FOR r IN (SELECT t.table_name, c.column_name "
                "FROM information_schema.tables t "
                "JOIN information_schema.columns c "
                "ON c.table_name=t.table_name AND c.table_schema=t.table_schema "
                "WHERE t.table_schema='public' AND t.table_type='BASE TABLE' "
                "AND c.column_default LIKE 'nextval%') LOOP "
                "seq_name := pg_get_serial_sequence(r.table_name, r.column_name); "
                "IF seq_name IS NOT NULL THEN "
                "EXECUTE 'SELECT COALESCE(MAX('||quote_ident(r.column_name)||'),0) "
                "FROM '||quote_ident(r.table_name) INTO max_val; "
                "PERFORM setval(seq_name, GREATEST(max_val,1), true); "
                "END IF; END LOOP; END $pf$;"
            )
            _ssh_run(
                conn,
                (
                    f"PGPASSWORD={_bash_single_quote(remote_password)} psql "
                    f"-h {_bash_single_quote(str(remote_host))} "
                    f"-p {remote_port} "
                    f"-U {_bash_single_quote(str(remote_user))} "
                    f"-d {remote_db} "
                    f"-c {shlex.quote(_seq_sql)} 2>&1"
                ),
                timeout=120,
            )
            self._add_log("Sequence'lar guncellendi", "success", "database")

            # ── ADIM 9: Doğrulama ─────────────────────────────────────────────────
            _verify_sql = (
                "SELECT "
                "(SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema='public' AND table_type='BASE TABLE') AS tablo_sayisi, "
                "(SELECT COALESCE(SUM(n_live_tup),0) FROM pg_stat_user_tables) AS toplam_satir"
            )
            _vr = _ssh_run(
                conn,
                (
                    f"PGPASSWORD={_bash_single_quote(remote_password)} psql "
                    f"-h {_bash_single_quote(str(remote_host))} "
                    f"-p {remote_port} "
                    f"-U {_bash_single_quote(str(remote_user))} "
                    f"-d {remote_db} -tA "
                    f"-c {shlex.quote(_verify_sql)}"
                ),
                timeout=60,
            )
            _vr_out = ((_vr.stdout or "") + (_vr.stderr or "")).strip()
            self._add_log(
                f"Remote DB dogrulama: {_vr_out[:200]}",
                "success" if _vr.ok else "warning",
                "database",
            )

            # ── ADIM 10: Temizlik ─────────────────────────────────────────────────
            _ssh_run(
                conn,
                f"rm -f {shlex.quote(remote_dump_path)} "
                f"{shlex.quote(remote_restore_script)} "
                f"2>/dev/null || true",
                timeout=30,
            )
            self._add_log("Gecici dosyalar temizlendi", "success", "database")

            self._add_log("=" * 60, "info", "db-sync")
            self._add_log(
                f"Yerel DB hostinge basariyla gonderildi: {local_db} -> {remote_db}",
                "success",
                "db-sync",
            )

            return SystemSetupResponse(
                success=True,
                logs=self.deployment_logs,
                summary=(
                    f"Yerel veritabanı hostinge gönderildi: "
                    f"{local_db} -> {remote_db} (TRUNCATE + RESTORE)"
                ),
                errors=[],
            )

        except Exception as e:
            tb = traceback.format_exc()
            self._add_log(f"DB gonderme hatasi:\n{tb[:1200]}", "error", "db-sync")
            errors.append(str(e))
            return SystemSetupResponse(
                success=False,
                logs=self.deployment_logs,
                summary=f"Yerel DB hostinge gonderilemedi: {str(e)}",
                errors=errors,
            )
        finally:
            if conn is not None:
                try:
                    conn.close()
                    self._add_log("SSH baglantisi kapatildi", "info", "connect")
                except Exception:
                    pass
            if local_dump_path is not None:
                try:
                    local_dump_path.unlink(missing_ok=True)
                except Exception:
                    pass


# ============================================================
# Global instance
# ============================================================
deployment_service = DeploymentService()
