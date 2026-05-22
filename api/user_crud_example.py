from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

users_db = {}


class UserCreateRequest(BaseModel):
    name: str
    email: str
    department_ids: List[int]
    job_ids: List[int]


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    department_ids: List[int]
    job_ids: List[int]


@router.post("/users", response_model=UserResponse, tags=["users"])
def create_user(req: UserCreateRequest):
    user_id = len(users_db) + 1
    user = {
        "id": user_id,
        "name": req.name,
        "email": req.email,
        "department_ids": req.department_ids,
        "job_ids": req.job_ids,
    }
    users_db[user_id] = user
    return user
