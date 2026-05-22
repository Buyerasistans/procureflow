from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
jobs_db = {
    1: {"id": 1, "department_id": 1, "name": "Teklif Hazırlama"},
    2: {"id": 2, "department_id": 2, "name": "Satın Alma"},
    3: {"id": 3, "department_id": 1, "name": "Onay"},
}
quotes_db = [
    {"id": 1, "department_id": 1, "amount": 10000, "status": "onaylandı"},
    {"id": 2, "department_id": 1, "amount": 5000, "status": "beklemede"},
    {"id": 3, "department_id": 2, "amount": 20000, "status": "onaylandı"},
]


class DepartmentReport(BaseModel):
    department_id: int
    department_name: str
    total_quote_amount: float
    approved_count: int
    pending_count: int
    job_count: int


@router.get(
    "/reports/department", response_model=List[DepartmentReport], tags=["reports"]
)
def department_reports():
    reports = []
    for dep_id, dep in departments_db.items():
        dep_quotes = [q for q in quotes_db if q["department_id"] == dep_id]
        total_amount = sum(q["amount"] for q in dep_quotes)
        approved = sum(1 for q in dep_quotes if q["status"] == "onaylandı")
        pending = sum(1 for q in dep_quotes if q["status"] == "beklemede")
        job_count = sum(1 for j in jobs_db.values() if j["department_id"] == dep_id)
        reports.append(
            {
                "department_id": dep_id,
                "department_name": dep["name"],
                "total_quote_amount": total_amount,
                "approved_count": approved,
                "pending_count": pending,
                "job_count": job_count,
            }
        )
    return reports
