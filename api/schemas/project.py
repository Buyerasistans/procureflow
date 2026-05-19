# schemas/project.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ProjectFileOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    code: str
    budget: float | None = None
    company_id: int | None = None
    project_type: str = "merkez"  # merkez | franchise
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    manager_name: str | None = None
    manager_phone: str | None = None
    manager_email: str | None = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    responsible_user_ids: list[int] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    code: str | None = None
    budget: float | None = None
    company_id: int | None = None
    project_type: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    manager_name: str | None = None
    manager_phone: str | None = None
    manager_email: str | None = None
    is_active: bool | None = None
    responsible_user_ids: list[int] | None = None


class ProjectPersonnelOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class ProjectOut(ProjectBase):
    id: int
    created_by_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    project_files: list[ProjectFileOut] = []
    personnel: list[ProjectPersonnelOut] = []

    model_config = ConfigDict(from_attributes=True)
