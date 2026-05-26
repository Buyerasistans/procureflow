# api\main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import sys

from dotenv import load_dotenv
from api.routers.system_email_router import router as system_email_router

from .routers.health import router as health_router
from .routers.quotes import router as quotes_router
from .routers.auth import router as auth_router
from .routers.admin import router as admin_router
from .routers.files import router as files_router
from .routers.supplier_router import router as supplier_router
from .routers.supplier_portal import router as supplier_portal_router
from .routers.approval_router import router as approval_router
from .routers.supplier_response_router import router as supplier_response_router
from .routers.report_router import router as report_router
from .routers.contract_router import router as contract_router
from .routers.settings_router import router as settings_router
from .routers.user_profile_router import router as user_profile_router
from .routers.advanced_settings_router import router as advanced_settings_router
from .routers.billing_router import router as billing_router
from .routers.ai_lab import router as ai_lab_router
from .routers.onboarding_router import router as onboarding_router
from .routers.onboarding_saas import router as onboarding_saas_router
from .routers.channel import router as channel_router
from .routers.campaign_admin import router as campaign_admin_router
from .routers.payment import router as payment_router
from .routers.payment_admin import router as payment_admin_router
from .routers.public_assets import router as public_assets_router
from .routers.public_telemetry import router as public_telemetry_router
from .routers.public_locale import router as public_locale_router
from .routers.public_translations import router as public_translations_router
from .routers.public_showcase import router as public_showcase_router
from .routers.support_ticket_router import router as support_ticket_router
from .routers.mail_center_router import router as mail_center_router
from .routers.talent import router as talent_router
from .routers.jobs import router as jobs_router
from .routers.job_applications import router as job_applications_router

try:
    from .routers.admin_deployment import router as admin_deployment_router
except SyntaxError as exc:
    # deployment servisinde syntax/indentation hatası varsa health yine çalışsın
    admin_deployment_router = None
    print(f"WARNING: admin_deployment router disabled (import error): {exc}")
from api.database import Base, engine, SessionLocal, ensure_database_schema
import api.models  # noqa: F401  # Ensure all SQLAlchemy models are registered before create_all
from api.services.runtime_bootstrap import (
    apply_runtime_schema_patches,
    seed_runtime_defaults,
)

# CRUD örnek routerlar
from api.department_crud_example import router as department_crud_router
from api.job_crud_example import router as job_crud_router
from api.user_crud_example import router as user_crud_router
from api.role_crud_example import router as role_crud_router

load_dotenv()

print(f"API starting with Python executable: {sys.executable}")
if ".venv" not in sys.executable.lower():
    print(
        "WARNING: API is not running from the local api/.venv virtual environment. "
        "SSH deployment requires the API server and its dependencies to use the same Python environment."
    )


def _build_cors_origins() -> list[str]:
    common_local_origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    }
    app_url = os.getenv("APP_URL", "").strip().rstrip("/")
    if app_url:
        common_local_origins.add(app_url)
    return sorted(common_local_origins)


_CORS_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.1\.\d+)(:\d+)?$"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_database_schema()
    apply_runtime_schema_patches()
    seed_runtime_defaults()

    yield
    # Shutdown
    pass


app = FastAPI(
    title="ProcureFlow API", version="1.1.0", lifespan=lifespan, redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://192.168.1.151:5175",
        "https://buyerasistans.com.tr",
        "https://www.buyerasistans.com.tr",
        "https://buyerasistans.com",
        "https://www.buyerasistans.com",
        "https://buyerasistans.info",
        "https://www.buyerasistans.info",
        "https://buyerasistans.online",
        "https://www.buyerasistans.online",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# Include routers with proper prefixes
# Canonical RFQ CRUD akisi quotes_router uzerinden sunulur.
app.include_router(auth_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")
app.include_router(quotes_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(supplier_router, prefix="/api/v1")
app.include_router(supplier_portal_router, prefix="/api/v1")
app.include_router(approval_router, prefix="/api/v1")
app.include_router(supplier_response_router, prefix="/api/v1")
app.include_router(report_router, prefix="/api/v1")
app.include_router(contract_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(user_profile_router, prefix="/api/v1")
app.include_router(advanced_settings_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(ai_lab_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(onboarding_saas_router, prefix="/api/v1")
app.include_router(channel_router, prefix="/api/v1")
app.include_router(campaign_admin_router, prefix="/api/v1")
app.include_router(payment_router, prefix="/api/v1")
app.include_router(payment_admin_router, prefix="/api/v1")
app.include_router(public_assets_router)
app.include_router(public_telemetry_router, prefix="/api/v1")
app.include_router(public_locale_router, prefix="/api/v1")
app.include_router(public_translations_router, prefix="/api/v1")
app.include_router(public_showcase_router, prefix="/api/v1")
app.include_router(support_ticket_router, prefix="/api/v1")
from api.routers.system_email_router import router as system_email_router

app.include_router(system_email_router, prefix="/api/v1")
app.include_router(talent_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(job_applications_router, prefix="/api/v1")
if admin_deployment_router is not None:
    app.include_router(admin_deployment_router, prefix="/api/v1")
if mail_center_router is not None:
    app.include_router(mail_center_router, prefix="/api/v1")
app.include_router(files_router)
# CRUD örnek routerlar
app.include_router(department_crud_router, prefix="/api/v1")
app.include_router(job_crud_router, prefix="/api/v1")
app.include_router(user_crud_router, prefix="/api/v1")
app.include_router(role_crud_router, prefix="/api/v1")
