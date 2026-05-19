# Departmanlar arası iş/görev transferi için örnek API (FastAPI/Python)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db

router = APIRouter()


@router.post("/jobs/{job_id}/transfer")
def transfer_job(job_id: int, new_department_id: int, db: Session = Depends(get_db)):
    job = db.execute(
        "SELECT * FROM job WHERE id = :job_id", {"job_id": job_id}
    ).fetchone()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.execute(
        "UPDATE job SET department_id = :new_dep WHERE id = :job_id",
        {"new_dep": new_department_id, "job_id": job_id},
    )
    db.commit()
    return {
        "message": "Job transferred successfully",
        "job_id": job_id,
        "new_department_id": new_department_id,
    }


# Not: Gerçek uygulamada yetkilendirme ve loglama eklenmelidir.
