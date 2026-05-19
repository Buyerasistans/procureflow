from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
collaborations_db = [
    {
        "from_department": 1,
        "to_department": 2,
        "job_id": 1,
        "status": "tamamlandı",
        "duration": 4,
    },
    {
        "from_department": 2,
        "to_department": 1,
        "job_id": 2,
        "status": "devam ediyor",
        "duration": 2,
    },
]
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
jobs_db = {
    1: {"id": 1, "name": "Teklif Hazırlama"},
    2: {"id": 2, "name": "Satın Alma"},
}


class CollaborationReport(BaseModel):
    from_department: str
    to_department: str
    job_name: str
    status: str
    duration: int


@router.get(
    "/reports/collaboration", response_model=List[CollaborationReport], tags=["reports"]
)
def collaboration_reports():
    return [
        CollaborationReport(
            from_department=departments_db[c["from_department"]]["name"],
            to_department=departments_db[c["to_department"]]["name"],
            job_name=jobs_db[c["job_id"]]["name"],
            status=c["status"],
            duration=c["duration"],
        )
        for c in collaborations_db
    ]
