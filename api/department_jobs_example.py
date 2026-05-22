from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
jobs_db = {
    1: {"id": 1, "department_id": 1, "name": "Teklif Hazırlama"},
    2: {"id": 2, "department_id": 2, "name": "Satın Alma"},
    3: {"id": 3, "department_id": 1, "name": "Onay"},
}
department_user_db = [
    {"user_id": 1, "department_id": 1},
    {"user_id": 1, "department_id": 2},
    {"user_id": 2, "department_id": 1},
]


class DepartmentJobsResponse(BaseModel):
    department_id: int
    jobs: List[dict]


@router.get(
    "/departments/{department_id}/jobs",
    response_model=DepartmentJobsResponse,
    tags=["departments"],
)
def list_jobs_for_department(department_id: int):
    jobs = [job for job in jobs_db.values() if job["department_id"] == department_id]
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Departmanda iş/görev bulunamadı.",
        )
    return {"department_id": department_id, "jobs": jobs}
