# health.py
from fastapi import APIRouter

from api.db.session import test_db_connection

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health():
    return {"status": "ok"}


@router.get("/db")
def health_db():
    return {"database": "ok" if test_db_connection() else "down"}
