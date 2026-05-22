# Gelişmiş Özellikler için örnek FastAPI endpoint
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class JobShareRequest(BaseModel):
    job_id: int
    from_department_id: int
    to_department_id: int


@router.post("/departments/share-job", tags=["departments"])
def share_job_between_departments(req: JobShareRequest):
    # TODO: İş/görev paylaşım mantığı
    return {"message": "İş başarıyla paylaşıldı."}
