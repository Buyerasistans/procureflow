from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
jobs_db = {}
departments_db = {
    1: {"id": 1, "name": "Satın Alma", "is_active": True, "jobs": []},
    2: {"id": 2, "name": "Finans", "is_active": True, "jobs": []},
}


class JobCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class JobResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: Optional[str]
    is_active: bool


@router.post(
    "/departments/{department_id}/jobs", response_model=JobResponse, tags=["jobs"]
)
def add_job_to_department(department_id: int, req: JobCreateRequest):
    department = departments_db.get(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı."
        )
    job_id = len(jobs_db) + 1
    job = {
        "id": job_id,
        "department_id": department_id,
        "name": req.name,
        "description": req.description,
        "is_active": req.is_active,
    }
    jobs_db[job_id] = job
    department["jobs"].append(job_id)
    return job


@router.put("/jobs/{job_id}", response_model=JobResponse, tags=["jobs"])
def update_job(job_id: int, req: JobCreateRequest):
    job = jobs_db.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="İş/görev bulunamadı."
        )
    job.update(
        {"name": req.name, "description": req.description, "is_active": req.is_active}
    )
    return job


@router.delete("/jobs/{job_id}", tags=["jobs"])
def delete_job(job_id: int):
    job = jobs_db.pop(job_id, None)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="İş/görev bulunamadı."
        )
    # Departmandan da sil
    dept = departments_db.get(job["department_id"])
    if dept and job_id in dept["jobs"]:
        dept["jobs"].remove(job_id)
    return {"message": "İş/görev silindi."}


@router.get(
    "/departments/{department_id}/jobs", response_model=List[JobResponse], tags=["jobs"]
)
def list_jobs_of_department(department_id: int):
    department = departments_db.get(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı."
        )
    return [jobs_db[jid] for jid in department["jobs"] if jid in jobs_db]
