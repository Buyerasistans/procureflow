from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
roles_db = {
    1: {"id": 1, "name": "Yönetici"},
    2: {"id": 2, "name": "Satın Almacı"},
    3: {"id": 3, "name": "Onaycı"},
}
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
department_role_db = [
    {"user_id": 1, "department_id": 1, "role_id": 1},
    {"user_id": 2, "department_id": 1, "role_id": 2},
    {"user_id": 2, "department_id": 2, "role_id": 3},
]


class DepartmentRoleResponse(BaseModel):
    department_id: int
    department_name: str
    roles: List[str]


@router.get(
    "/departments/{department_id}/roles",
    response_model=DepartmentRoleResponse,
    tags=["departments"],
)
def get_department_roles(department_id: int):
    department = departments_db.get(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Departman bulunamadı."
        )
    roles = [
        roles_db[dr["role_id"]]["name"]
        for dr in department_role_db
        if dr["department_id"] == department_id
    ]
    return {
        "department_id": department_id,
        "department_name": department["name"],
        "roles": roles,
    }
