from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# Mock database (replace with real DB logic)
departments_db = {
    1: {"id": 1, "name": "Satın Alma", "is_active": True},
    2: {"id": 2, "name": "Finans", "is_active": True},
}


class DepartmentArchiveRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = None


@router.patch("/departments/{department_id}/archive", tags=["departments"])
def archive_department(department_id: int, req: DepartmentArchiveRequest):
    department = departments_db.get(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı."
        )
    department["is_active"] = req.is_active
    # Burada arşivleme/aktif etme işlemi için ek mantık eklenebilir (ör. log, reason kaydı)
    return {
        "id": department_id,
        "is_active": req.is_active,
        "message": "Departman durumu güncellendi.",
    }
