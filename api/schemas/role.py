from pydantic import BaseModel, ConfigDict, Field
from api.schemas.permission import PermissionOut


class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class RoleCreate(RoleBase):
    parent_id: int | None = None
    permission_ids: list[int] = Field(default_factory=list)
    tenant_id: int | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    parent_id: int | None = None
    permission_ids: list[int] | None = None


class RoleOut(RoleBase):
    id: int
    tenant_id: int | None = None
    is_active: bool
    created_by_id: int | None = None
    hierarchy_level: int
    parent_id: int | None = None
    permissions: list[PermissionOut] = []

    model_config = ConfigDict(from_attributes=True)
