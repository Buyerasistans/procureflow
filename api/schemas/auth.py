# api\schemas\auth.py
from pydantic import BaseModel, Field
from typing import Optional


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class UserLoginResponse(BaseModel):
    id: int
    email: str
    work_email: Optional[str] = None
    role: str = Field(
        ...,
        description="Compatibility role mirror. Clients should prefer business_role for operational semantics.",
    )
    business_role: Optional[str] = Field(
        default=None,
        description="Primary operational role for procurement and approval workflows.",
    )
    system_role: str = Field(
        default="tenant_member",
        description="Primary platform/tenant authorization role.",
    )
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    organization_name: Optional[str] = None
    organization_logo_url: Optional[str] = None
    workspace_label: Optional[str] = None
    platform_name: str = "Buyera Asistans"
    platform_domain: str = "buyerasistans.com.tr"


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[UserLoginResponse] = None


class LogoutRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str
