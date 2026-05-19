from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List
from fastapi import Path

router = APIRouter()

departments_db = {}


class DepartmentCreateRequest(BaseModel):
    name: str
    description: str
    is_active: bool = True
    settings: dict = {}


class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: str
    is_active: bool
    settings: dict


@router.post("/departments", response_model=DepartmentResponse, tags=["departments"])
def create_department(req: DepartmentCreateRequest):
    dep_id = len(departments_db) + 1
    department = {
        "id": dep_id,
        "name": req.name,
        "description": req.description,
        "is_active": req.is_active,
        "settings": req.settings,
    }
    departments_db[dep_id] = department
    return department


@router.post("/departments/{department_id}/archive", tags=["departments"])
def archive_department(
    department_id: int = Path(..., description="Arşivlenecek departman ID'si"),
):
    dep = departments_db.get(department_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Departman bulunamadı.")
    dep["is_active"] = False
    return {"message": "Departman arşivlendi.", "department": dep}
