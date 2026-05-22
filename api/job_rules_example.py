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
        "rules": {"approval_required": True},
    },
    2: {
        "id": 2,
        "department_id": 2,
        "name": "Satın Alma",
        "description": "Satın alma işlemleri",
        "is_active": True,
        "rules": {"approval_required": False},
    },
}


class JobRuleUpdateRequest(BaseModel):
    job_id: int
    approval_required: Optional[bool] = None
    custom_limit: Optional[float] = None


class JobResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: str
    is_active: bool
    rules: dict


@router.put("/jobs/{job_id}/rules", response_model=JobResponse, tags=["jobs"])
def update_job_rules(job_id: int, req: JobRuleUpdateRequest):
    job = jobs_db.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="İş/görev bulunamadı."
        )
    if req.approval_required is not None:
        job["rules"]["approval_required"] = req.approval_required
    if req.custom_limit is not None:
        job["rules"]["custom_limit"] = req.custom_limit
    return job
