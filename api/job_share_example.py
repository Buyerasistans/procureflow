from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
jobs_db = {
    1: {
        "id": 1,
        "department_id": 1,
        "name": "Teklif Hazırlama",
        "description": "Teklifleri hazırla",
        "is_active": True,
    },
    2: {
        "id": 2,
        "department_id": 2,
        "name": "Satın Alma",
        "description": "Satın alma işlemleri",
        "is_active": True,
    },
}


class JobShareRequest(BaseModel):
    job_id: int
    target_department_id: int


class JobResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: str
    is_active: bool


@router.post("/jobs/share", response_model=JobResponse, tags=["jobs"])
def share_job_between_departments(req: JobShareRequest):
    job = jobs_db.get(req.job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="İş/görev bulunamadı."
        )
    # Yeni departmana aynı işi kopyala (gerçek sistemde referans veya paylaşım mantığı eklenebilir)
    new_job_id = max(jobs_db.keys()) + 1
    new_job = job.copy()
    new_job["id"] = new_job_id
    new_job["department_id"] = req.target_department_id
    jobs_db[new_job_id] = new_job
    return new_job
