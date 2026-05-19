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
users_db = {
    1: {"id": 1, "name": "Ali Veli", "email": "ali@firma.com"},
    2: {"id": 2, "name": "Ayşe Kaya", "email": "ayse@firma.com"},
}
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
department_role_db = []  # [{user_id, department_id, role_id}]


class RoleAssignRequest(BaseModel):
    user_id: int
    department_id: int
    role_id: int


@router.post("/roles/assign", tags=["roles"])
def assign_role(req: RoleAssignRequest):
    # Aynı atama tekrar yapılmasın
    if any(
        dr
        for dr in department_role_db
        if dr["user_id"] == req.user_id
        and dr["department_id"] == req.department_id
        and dr["role_id"] == req.role_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Bu rol zaten atanmış."
        )
    department_role_db.append(
        {
            "user_id": req.user_id,
            "department_id": req.department_id,
            "role_id": req.role_id,
        }
    )
    return {
        "user_id": req.user_id,
        "department_id": req.department_id,
        "role_id": req.role_id,
        "message": "Rol atandı.",
    }
