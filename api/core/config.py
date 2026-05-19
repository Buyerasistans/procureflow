# api/core/config.py
"""
Merkezi konfigürasyon — LOCAL ve HOSTING ortamlarını otomatik algılar.
PostgreSQL ve MySQL desteklenir.
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# ── .env yükle — çalışma dizininden bağımsız ────────────────
BASE_DIR = Path(__file__).resolve().parents[1]  # api/
_env_path = BASE_DIR / ".env"
if _env_path.exists():
    load_dotenv(str(_env_path), override=True)

# ── Ortam algılama ───────────────────────────────────────────
IS_PRODUCTION = os.getenv("APP_ENV", "development").lower() == "production"

# ── Veritabanı ───────────────────────────────────────────────
# Öncelik sırası:
# 1. DATABASE_URL env değişkeni (varsa direkt kullan)
# 2. Ayrı DB_* değişkenlerinden oluştur
# 3. Local default

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "procureflow")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASS", "96578097")
DB_TYPE = os.getenv("DB_TYPE", "postgresql")  # postgresql | mysql

# DB_TYPE'a göre driver seç
_DRIVER_MAP = {
    "postgresql": "postgresql+psycopg",
    "postgres": "postgresql+psycopg",
    "mysql": "mysql+pymysql",
    "mariadb": "mysql+pymysql",
}
_driver = _DRIVER_MAP.get(DB_TYPE.lower(), "postgresql+psycopg")
_default_port = "3306" if "mysql" in DB_TYPE.lower() else "5432"

_fallback_url = (
    f"{_driver}://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT or _default_port}/{DB_NAME}"
)

DATABASE_URL: str = os.getenv("DATABASE_URL") or _fallback_url

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# ── Uygulama ─────────────────────────────────────────────────
APP_URL = os.getenv("APP_URL", "http://localhost:5175")
APP_NAME = os.getenv("APP_NAME", "Buyera Asistans")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ── Email ────────────────────────────────────────────────────
SMTP_SERVER = os.getenv("SMTP_SERVER", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "true").lower() == "true"
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SENDER_EMAIL)
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", APP_NAME)
MAIL_DOMAIN = os.getenv("MAIL_DOMAIN", "")
MAIL_REPLY_TO = os.getenv("MAIL_REPLY_TO", "")
MAIL_BOUNCE_EMAIL = os.getenv("MAIL_BOUNCE_EMAIL", "")
MAILBOX_SUPPORT_EMAIL = os.getenv("MAILBOX_SUPPORT_EMAIL", "")
MAILBOX_PROVIDER_URL = os.getenv("MAILBOX_PROVIDER_URL", "")
MAILBOX_PROVIDER_API_URL = os.getenv("MAILBOX_PROVIDER_API_URL", "")

# ── Hosting Deployment ───────────────────────────────────────
HOSTING_DOMAIN = os.getenv("HOSTING_DOMAIN", "")
HOSTING_IP = os.getenv("HOSTING_IP", "")
HOSTING_USERNAME = os.getenv("HOSTING_USERNAME", "root")
HOSTING_PASSWORD = os.getenv("HOSTING_PASSWORD", "")
HOSTING_SSH_KEY_PATH = os.getenv("HOSTING_SSH_KEY_PATH", "")
HOSTING_REMOTE_PATH = os.getenv(
    "HOSTING_REMOTE_PATH",
    "/var/www/vhosts/buyerasistans.com.tr/httpdocs",
)
HOSTING_PORT: int = int(os.getenv("HOSTING_PORT", "22"))
