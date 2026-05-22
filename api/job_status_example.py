from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

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
        "department_id": 1,
        "name": "Satın Alma",
        "description": "Satın alma işlemleri",
        "is_active": False,
    },
}


class JobStatusUpdateRequest(BaseModel):
    description: Optional[str] = None
    is_active: bool


class JobResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: Optional[str]
    is_active: bool


@router.put("/jobs/{job_id}/status", response_model=JobResponse, tags=["jobs"])
def update_job_status(job_id: int, req: JobStatusUpdateRequest):
    job = jobs_db.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="İş/görev bulunamadı."
        )
    if req.description is not None:
        job["description"] = req.description
    job["is_active"] = req.is_active
    return job
