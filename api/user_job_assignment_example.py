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
user_job_db = []  # [{user_id, job_id}]


class AssignJobRequest(BaseModel):
    user_id: int
    job_ids: List[int]


@router.post("/users/{user_id}/assign-job", tags=["users"])
def assign_jobs_to_user(user_id: int, req: AssignJobRequest):
    for job_id in req.job_ids:
        # Aynı atama tekrar yapılmasın
        if not any(
            uj
            for uj in user_job_db
            if uj["user_id"] == user_id and uj["job_id"] == job_id
        ):
            user_job_db.append({"user_id": user_id, "job_id": job_id})
    return {"user_id": user_id, "assigned_jobs": req.job_ids}


@router.delete("/users/{user_id}/remove-job/{job_id}", tags=["users"])
def remove_job_from_user(user_id: int, job_id: int):
    before = len(user_job_db)
    user_job_db[:] = [
        uj
        for uj in user_job_db
        if not (uj["user_id"] == user_id and uj["job_id"] == job_id)
    ]
    after = len(user_job_db)
    if before == after:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Atama bulunamadı."
        )
    return {"user_id": user_id, "removed_job": job_id}
