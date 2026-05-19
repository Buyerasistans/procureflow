from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter()

roles_db = {}


class RoleCreateRequest(BaseModel):
    name: str
    permissions: List[str]


class RoleResponse(BaseModel):
    id: int
    name: str
    permissions: List[str]


@router.post("/roles", response_model=RoleResponse, tags=["roles"])
def create_role(req: RoleCreateRequest):
    role_id = len(roles_db) + 1
    role = {"id": role_id, "name": req.name, "permissions": req.permissions}
    roles_db[role_id] = role
    return role
