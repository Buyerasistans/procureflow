from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

# Mock database (gerçek DB ile değiştirilmeli)
departments_db = {
    1: {"id": 1, "name": "Satın Alma"},
    2: {"id": 2, "name": "Finans"},
}
users_db = {}
department_user_db = []  # [{user_id, department_id}]


class UserCreateRequest(BaseModel):
    name: str
    email: str
    department_ids: List[int]


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    departments: List[int]


@router.post("/users", response_model=UserResponse, tags=["users"])
def create_user(req: UserCreateRequest):
    user_id = len(users_db) + 1
    users_db[user_id] = {"id": user_id, "name": req.name, "email": req.email}
    for dep_id in req.department_ids:
        if dep_id not in departments_db:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Departman bulunamadı: {dep_id}",
            )
        department_user_db.append({"user_id": user_id, "department_id": dep_id})
    return {
        "id": user_id,
        "name": req.name,
        "email": req.email,
        "departments": req.department_ids,
    }
