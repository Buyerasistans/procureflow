# Departman özel ayarları ve kuralları için örnek FastAPI endpoint
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

department_settings_db = {}


class DepartmentSettingRequest(BaseModel):
    department_id: int
    settings: dict


@router.post("/departments/{department_id}/settings", tags=["departments"])
def update_department_settings(department_id: int, req: DepartmentSettingRequest):
    department_settings_db[department_id] = req.settings
    return {"message": "Ayarlar güncellendi."}
