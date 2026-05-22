from logging.config import fileConfig
from pathlib import Path
import sys
import os

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# ✅ alembic.ini'nin yanındaki .env'i yükle
_env_file = Path(__file__).resolve().parent.parent / "api" / ".env"
if _env_file.exists():
    load_dotenv(str(_env_file), override=True)

# --- Paths ---
# .../procureflow/api/alembic/env.py
API_DIR = Path(__file__).resolve().parents[1]  # .../procureflow/api
PROJECT_ROOT = API_DIR.parent  # .../procureflow

# Python path'e proje kökünü ekle ki "api.*" importları her yerden çalışsın
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# .env yükle (api/.env)
load_dotenv(API_DIR / ".env")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Tek kaynak: api.database
from api.database import Base  # noqa: E402

# Model metadata'yı Alembic görsün
from api.models import User, Quote  # noqa: F401,E402

# DATABASE_URL'i env'den al; yoksa alembic.ini'deki default'u kullan
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
