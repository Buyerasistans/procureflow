from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
jobs_db = {
    1: {
        "id": 1,
        "department_id": 1,
        "name": "Teklif Hazırlama",
        "duration": 5,
        "status": "tamamlandı",
    },
    2: {
        "id": 2,
        "department_id": 2,
        "name": "Satın Alma",
        "duration": 3,
        "status": "devam ediyor",
    },
    3: {
        "id": 3,
        "department_id": 1,
        "name": "Onay",
        "duration": 2,
        "status": "tamamlandı",
    },
}


class JobPerformanceReport(BaseModel):
    job_id: int
    job_name: str
    department_id: int
    duration: int
    status: str


@router.get(
    "/reports/job-performance",
    response_model=List[JobPerformanceReport],
    tags=["reports"],
)
def job_performance_reports():
    return [
        JobPerformanceReport(
            job_id=job["id"],
            job_name=job["name"],
            department_id=job["department_id"],
            duration=job["duration"],
            status=job["status"],
        )
        for job in jobs_db.values()
    ]
