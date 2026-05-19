# Departman içi roller ve iş akışı yönetimi için örnek FastAPI endpoint
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()


class DepartmentRoleWorkflowRequest(BaseModel):
    department_id: int
    roles: List[str]
    workflow: dict


@router.post("/departments/{department_id}/workflow", tags=["departments"])
def set_department_workflow(department_id: int, req: DepartmentRoleWorkflowRequest):
    # TODO: Departman iş akışı ve rollerini kaydet
    return {"message": "İş akışı ve roller kaydedildi."}
