# schemas/department.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class DepartmentBase(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True


class DepartmentCreate(DepartmentBase):
    tenant_id: int | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class DepartmentOut(DepartmentBase):
    id: int
    tenant_id: int | None = None
    created_by_id: int | None = None
    created_at: datetime
    updated_at: datetime
    sub_items: list[dict[str, int | str]] = []
    model_config = ConfigDict(from_attributes=True)
