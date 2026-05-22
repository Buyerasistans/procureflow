from pydantic import BaseModel, ConfigDict, Field


class PermissionCatalogNode(BaseModel):
    key: str
    label: str
    description: str
    children: list["PermissionCatalogNode"] = Field(default_factory=list)


class UserPermissionOverrideItem(BaseModel):
    permission_key: str = Field(..., min_length=1, max_length=120)
    allowed: bool


class UserPermissionOverrideBulkUpdate(BaseModel):
    items: list[UserPermissionOverrideItem]


class UserPermissionOverrideOut(UserPermissionOverrideItem):
    id: int
    user_id: int
    granted_by_user_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class RolePermissionDelegationItem(BaseModel):
    permission_key: str = Field(..., min_length=1, max_length=120)
    can_delegate: bool = True


class RolePermissionDelegationBulkUpdate(BaseModel):
    system_role: str | None = None
    business_role: str | None = None
    items: list[RolePermissionDelegationItem]


class RolePermissionDelegationOut(RolePermissionDelegationItem):
    id: int
    system_role: str | None = None
    business_role: str | None = None

    model_config = ConfigDict(from_attributes=True)


PermissionCatalogNode.model_rebuild()
