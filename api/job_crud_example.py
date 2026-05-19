from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

jobs_db = {}


class JobCreateRequest(BaseModel):
    department_id: int
    name: str
    description: str
    is_active: bool = True


class JobResponse(BaseModel):
    id: int
    department_id: int
    name: str
    description: str
    is_active: bool


@router.post("/jobs", response_model=JobResponse, tags=["jobs"])
def create_job(req: JobCreateRequest):
    job_id = len(jobs_db) + 1
    job = {
        "id": job_id,
        "department_id": req.department_id,
        "name": req.name,
        "description": req.description,
        "is_active": req.is_active,
    }
    jobs_db[job_id] = job
    return job
