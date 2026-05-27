# api\database.py

from __future__ import annotations

import os
from pathlib import Path
from threading import Lock

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ✅ Çalışma dizininden bağımsız olarak .env'i bul ve yükle
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(
        str(_env_path),
        override=os.getenv("PROCUREFLOW_SKIP_DOTENV_OVERRIDE", "").strip() != "1",
    )

# Artık DATABASE_URL güvenle okunabilir
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL tanımlı değil (.env dosyasını kontrol et)")

if "@host:" in DATABASE_URL or "user:password" in DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL placeholder görünüyor. api/.env dosyasını gerçek değerlerle güncelle."
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

_SCHEMA_BOOTSTRAP_LOCK = Lock()
_SCHEMA_BOOTSTRAPPED = False
_RUNTIME_BOOTSTRAP_LOCK = Lock()
_RUNTIME_BOOTSTRAPPED = False


def ensure_database_schema() -> None:
    global _SCHEMA_BOOTSTRAPPED

    if _SCHEMA_BOOTSTRAPPED:
        return

    with _SCHEMA_BOOTSTRAP_LOCK:
        if _SCHEMA_BOOTSTRAPPED:
            return

        # Model kayıtlarını garanti et; create_all yalnızca kayıtlı modelleri oluşturur.
        import api.models  # noqa: F401

        Base.metadata.create_all(bind=engine)
        _SCHEMA_BOOTSTRAPPED = True


def ensure_runtime_bootstrap() -> None:
    global _RUNTIME_BOOTSTRAPPED

    if _RUNTIME_BOOTSTRAPPED:
        return

    with _RUNTIME_BOOTSTRAP_LOCK:
        if _RUNTIME_BOOTSTRAPPED:
            return

        ensure_database_schema()

        from api.services.runtime_bootstrap import seed_runtime_defaults

        seed_runtime_defaults()
        _RUNTIME_BOOTSTRAPPED = True


def get_db():
    """Dependency: Database session düsür"""
    ensure_runtime_bootstrap()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
