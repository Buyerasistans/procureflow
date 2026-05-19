from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, UTC
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT_ROOT / "scripts" / "auto_full_backup.ps1"
SQL_BACKUP_SCRIPT_PATH = PROJECT_ROOT / "scripts" / "backup_postgres_sql.ps1"
DEFAULT_BACKUP_ROOT = PROJECT_ROOT.parent / "procureflow_full_backups" / "scheduled"
API_ENV_PATH = PROJECT_ROOT / "api" / ".env"
RETENTION_DAYS = 2


def get_database_url() -> str | None:
    load_dotenv(API_ENV_PATH)
    return os.getenv("DATABASE_URL")


def load_backup_root(database_url: str | None) -> tuple[Path, object | None]:
    if not database_url:
        return DEFAULT_BACKUP_ROOT, None

    try:
        engine = create_engine(database_url, future=True)
        with engine.connect() as conn:
            table_exists = conn.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema='public' AND table_name='backup_settings'
                    )
                """)
            ).scalar()
            if not table_exists:
                return DEFAULT_BACKUP_ROOT, engine

            configured_location = conn.execute(
                text(
                    "SELECT backup_location FROM backup_settings ORDER BY id DESC LIMIT 1"
                )
            ).scalar()
            configured_location = (configured_location or "").strip()
            if configured_location in {"", "/backups", "\\backups"}:
                return DEFAULT_BACKUP_ROOT, engine

            return Path(configured_location), engine
    except Exception:
        return DEFAULT_BACKUP_ROOT, None


def update_last_backup(engine: object | None) -> None:
    if engine is None:
        return

    timestamp = datetime.now(UTC).isoformat()
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE backup_settings
                    SET last_backup_at = :timestamp
                    WHERE id = (SELECT id FROM backup_settings ORDER BY id DESC LIMIT 1)
                    """
                ),
                {"timestamp": timestamp},
            )
    except Exception:
        return


def cleanup_old_backups(
    backup_root: Path, retention_days: int = RETENTION_DAYS
) -> None:
    cutoff = datetime.now(UTC).timestamp() - (retention_days * 24 * 60 * 60)

    # Remove old full backup directories (backup_YYYYMMDD_HHMMSS)
    for backup_dir in backup_root.glob("backup_*"):
        if not backup_dir.is_dir():
            continue
        try:
            if backup_dir.stat().st_mtime < cutoff:
                shutil.rmtree(backup_dir, ignore_errors=False)
                print(f"CLEANUP_REMOVED_DIR={backup_dir}")
        except Exception as exc:
            print(f"CLEANUP_DIR_ERROR={backup_dir}::{exc}")

    # Remove old SQL artifacts in backup_root/sql
    sql_dir = backup_root / "sql"
    if sql_dir.exists() and sql_dir.is_dir():
        for pattern in ("*.sql", "*.rar"):
            for sql_file in sql_dir.glob(pattern):
                try:
                    if sql_file.stat().st_mtime < cutoff:
                        sql_file.unlink(missing_ok=True)
                        print(f"CLEANUP_REMOVED_SQL={sql_file}")
                except Exception as exc:
                    print(f"CLEANUP_SQL_ERROR={sql_file}::{exc}")


def main() -> int:
    if not SCRIPT_PATH.exists():
        print(
            json.dumps(
                {"success": False, "error": f"Backup script not found: {SCRIPT_PATH}"}
            )
        )
        return 1

    database_url = get_database_url()
    backup_root, engine = load_backup_root(database_url)
    backup_root.mkdir(parents=True, exist_ok=True)

    command = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(SCRIPT_PATH),
        "-Source",
        str(PROJECT_ROOT),
        "-BackupRoot",
        str(backup_root),
    ]

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.strip(), file=sys.stderr)
        return result.returncode

    if SQL_BACKUP_SCRIPT_PATH.exists():
        sql_backup_command = [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(SQL_BACKUP_SCRIPT_PATH),
            "-ProjectRoot",
            str(PROJECT_ROOT),
            "-BackupRoot",
            str(backup_root),
        ]
        sql_result = subprocess.run(
            sql_backup_command, capture_output=True, text=True, check=False
        )
        if sql_result.stdout:
            print(sql_result.stdout.strip())
        if sql_result.returncode != 0 and sql_result.stderr:
            print(sql_result.stderr.strip(), file=sys.stderr)

    cleanup_old_backups(backup_root)

    update_last_backup(engine)
    print(f"DATABASE_URL={database_url}" if database_url else "DATABASE_URL=")
    print(f"BACKUP_ROOT={backup_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
