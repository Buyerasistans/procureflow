# schemas/assignment.py
"""Firma-Kullanıcı atama (CompanyRole) şemaları"""

from pydantic import BaseModel, ConfigDict


class CompanyAssignmentCreate(BaseModel):
    company_id: int
    role_id: int
    department_id: int | None = None
    sub_items: list[str] = []


class CompanyAssignmentUpdate(BaseModel):
    role_id: int | None = None
    department_id: int | None = None
    sub_items: list[str] | None = None
    is_active: bool | None = None


class CompanyBrief(BaseModel):
    id: int
    name: str
    color: str = "#3b82f6"
    model_config = ConfigDict(from_attributes=True)


class RoleBrief(BaseModel):
    id: int
    name: str
    hierarchy_level: int = 0
    model_config = ConfigDict(from_attributes=True)


class DepartmentBrief(BaseModel):
    id: int
    name: str
    sub_items: list[dict[str, int | str]] = []
    model_config = ConfigDict(from_attributes=True)


class CompanyAssignmentOut(BaseModel):
    id: int
    user_id: int
    company_id: int
    role_id: int
    department_id: int | None = None
    is_active: bool
    sub_items: list[str] = []
    company: CompanyBrief | None = None
    role: RoleBrief | None = None
    department: DepartmentBrief | None = None

    model_config = ConfigDict(from_attributes=True)
