# tests\conftest.py
import os
import re
from pathlib import Path
from uuid import uuid4

import pytest
from dotenv import dotenv_values, load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.schema import DropTable


ROOT_DIR = Path(__file__).resolve().parents[1]
SQLITE_TEST_DB_PATH = ROOT_DIR / "tests" / ".runtime" / "procureflow_test.sqlite3"
NO_DROP_TEST_DB_PATH = (
    ROOT_DIR / "tests" / ".runtime" / f"procureflow_nodrop_{os.getpid()}_{uuid4().hex}.sqlite3"
)
load_dotenv(ROOT_DIR / "api" / ".env")
ENV_FILE_VALUES = dotenv_values(ROOT_DIR / "api" / ".env")


def _is_no_drop_profile() -> bool:
    return os.getenv("PYTEST_NO_DROP", "").strip().lower() in {"1", "true", "yes"}


def _build_test_database_url() -> str:
    if _is_no_drop_profile():
        NO_DROP_TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{NO_DROP_TEST_DB_PATH.as_posix()}"

    explicit = ENV_FILE_VALUES.get("TEST_DATABASE_URL")
    if explicit:
        return str(explicit)

    primary = ENV_FILE_VALUES.get("DATABASE_URL") or os.getenv("DATABASE_URL")
    if primary:
        url = make_url(primary)
        database_name = url.database
        if database_name and not database_name.endswith("_test"):
            return str(url.set(database=f"{database_name}_test"))
        return str(primary)

    return "postgresql+psycopg://postgres:postgres@localhost:5432/procureflow_test"


def _ensure_test_database_exists(database_url: str) -> None:
    url = make_url(database_url)
    database_name = url.database
    if url.get_backend_name() != "postgresql" or not database_name:
        return

    if not re.fullmatch(r"[A-Za-z0-9_]+", database_name):
        raise RuntimeError(f"Guvensiz test veritabani adi: {database_name}")

    admin_database = os.getenv("POSTGRES_ADMIN_DB", "postgres")
    admin_url = url.set(database=admin_database)
    admin_engine = create_engine(
        admin_url.render_as_string(hide_password=False),
        isolation_level="AUTOCOMMIT",
        future=True,
    )
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
                {"db_name": database_name},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{database_name}"'))
    finally:
        admin_engine.dispose()


def _prepare_test_database_url() -> str:
    database_url = _build_test_database_url()
    try:
        _ensure_test_database_exists(database_url)
        return database_url
    except OperationalError:
        SQLITE_TEST_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{SQLITE_TEST_DB_PATH.as_posix()}"


# 1) Test DB
os.environ["DATABASE_URL"] = _prepare_test_database_url()
if _is_no_drop_profile():
    os.environ["PROCUREFLOW_SKIP_DOTENV_OVERRIDE"] = "1"

# 2) App import (env set edildikten sonra)
from api.main import app
from api.database import Base, engine, SessionLocal
from api.models.department import Department
from api.models.project import Project
from api.models.user import User
from api.core.security import get_password_hash


def _drop_all_test_tables() -> None:
    if engine.dialect.name != "sqlite":
        with engine.begin() as connection:
            table_names = inspect(connection).get_table_names()
            for table_name in table_names:
                connection.exec_driver_sql(
                    f'DROP TABLE IF EXISTS "{table_name}" CASCADE'
                )
        return

    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
        for table in reversed(list(Base.metadata.tables.values())):
            connection.execute(DropTable(table, if_exists=True))
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # temiz başlangıç
    if not _is_no_drop_profile():
        _drop_all_test_tables()
    Base.metadata.create_all(bind=engine)

    # admin + user seed
    db = SessionLocal()
    try:
        department = (
            db.query(Department).filter(Department.name == "Test Department").first()
        )
        if not department:
            department = Department(
                name="Test Department",
                description="Pytest seeded department",
                is_active=True,
            )
            db.add(department)
            db.flush()

        project = db.query(Project).filter(Project.code == "TEST-PROJECT").first()
        if not project:
            project = Project(
                name="Test Project",
                code="TEST-PROJECT",
                description="Pytest seeded project",
                is_active=True,
                project_type="merkez",
            )
            db.add(project)
            db.flush()

        admin = db.query(User).filter(User.email == "admin@procureflow.dev").first()
        if not admin:
            admin = User(
                email="admin@procureflow.dev",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Admin User",
                role="admin",
                system_role="tenant_admin",
                is_active=True,
            )
            db.add(admin)
        else:
            admin.system_role = "tenant_admin"

        user = db.query(User).filter(User.email == "user@procureflow.dev").first()
        if not user:
            user = User(
                email="user@procureflow.dev",
                hashed_password=get_password_hash("User123!"),
                full_name="Normal User",
                role="user",
                system_role="tenant_member",
                is_active=True,
            )
            db.add(user)
        else:
            user.system_role = "tenant_member"
        user.department_id = department.id

        other = db.query(User).filter(User.email == "other@procureflow.dev").first()
        if not other:
            other = User(
                email="other@procureflow.dev",
                hashed_password=get_password_hash("Other123!"),
                full_name="Other User",
                role="user",
                system_role="tenant_member",
                is_active=True,
            )
            db.add(other)
        else:
            other.system_role = "tenant_member"
        other.department_id = department.id

        db.flush()

        for seeded_user in (admin, user):
            if all(
                existing_project.id != project.id
                for existing_project in seeded_user.projects
            ):
                seeded_user.projects.append(project)

        db.commit()
    finally:
        db.close()

    yield

    # test sonrası temizlik
    if not _is_no_drop_profile():
        _drop_all_test_tables()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_auth_headers(client):
    payload = {"email": "admin@procureflow.dev", "password": "Admin123!"}
    r = client.post("/api/v1/auth/login", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "admin"
    assert body["user"]["business_role"] == "admin"
    assert body["user"]["system_role"] == "tenant_admin"
    token = body["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def user_auth_headers(client):
    payload = {"email": "user@procureflow.dev", "password": "User123!"}
    r = client.post("/api/v1/auth/login", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "user"
    assert body["user"]["business_role"] == "user"
    assert body["user"]["system_role"] == "tenant_member"
    token = body["access_token"]
    return {"Authorization": f"Bearer {token}"}


# backward compatibility (eski testler kırılmasın)
@pytest.fixture(scope="session")
def auth_headers(admin_auth_headers):
    return admin_auth_headers


@pytest.fixture(scope="session")
def other_user_auth_headers(client):
    payload = {"email": "other@procureflow.dev", "password": "Other123!"}
    r = client.post("/api/v1/auth/login", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "user"
    assert body["user"]["business_role"] == "user"
    assert body["user"]["system_role"] == "tenant_member"
    token = body["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def quote_payload():
    def _build(title: str, *, description: str | None = None) -> dict:
        return {
            "project_id": 1,
            "title": title,
            "description": description or f"{title} description",
            "company_name": "ProcureFlow Test Company",
            "company_contact_name": "Test Contact",
            "company_contact_phone": "+905551112233",
            "company_contact_email": "contact@procureflow.test",
        }

    return _build
