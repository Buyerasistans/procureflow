# Aktif/pasif departman ve iş/görev yönetimi için örnek FastAPI endpoint
from fastapi import APIRouter

router = APIRouter()

departments_db = {}
jobs_db = {}


@router.post("/departments/{department_id}/archive", tags=["departments"])
def archive_department(department_id: int):
    # TODO: Departmanı arşivle
    return {"message": "Departman arşivlendi."}


@router.post("/jobs/{job_id}/archive", tags=["jobs"])
def archive_job(job_id: int):
    # TODO: İşi arşivle
    return {"message": "İş arşivlendi."}
