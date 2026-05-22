# schemas/user.py
from __future__ import annotations
from pydantic import BaseModel, ConfigDict, EmailStr
from api.schemas.assignment import CompanyAssignmentOut


class UserBase(BaseModel):
    email: str
    work_email: str | None = None
    full_name: str
    role: str = "satinalmaci"
    system_role: str = "tenant_member"
    tenant_id: int | None = None
    approval_limit: int = 100000
    department_id: int | None = None
    photo: str | None = None
    personal_phone: str | None = None
    company_phone: str | None = None
    company_phone_short: str | None = None
    address: str | None = None
    hide_location: bool = False
    share_on_whatsapp: bool = True
    is_active: bool = True


class UserCreate(UserBase):
    email: EmailStr
    password: str | None = None


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    work_email: EmailStr | None = None
    full_name: str | None = None
    role: str | None = None
    system_role: str | None = None
    tenant_id: int | None = None
    approval_limit: int | None = None
    department_id: int | None = None
    photo: str | None = None
    personal_phone: str | None = None
    company_phone: str | None = None
    company_phone_short: str | None = None
    address: str | None = None
    hide_location: bool | None = None
    share_on_whatsapp: bool | None = None
    is_active: bool | None = None


class UserOut(UserBase):
    id: int
    scope_type: str | None = None
    company_assignments: list[CompanyAssignmentOut] = []
    invitation_email_sent: bool = False
    invitation_accepted: bool = False
    model_config = ConfigDict(from_attributes=True)


class ProfileOut(BaseModel):
    """Kullanıcı profil bilgisi"""

    id: int
    email: str
    work_email: str | None = None
    full_name: str
    role: str
    system_role: str
    tenant_id: int | None = None
    is_active: bool
    department_id: int | None = None
    approval_limit: int
    photo: str | None = None
    personal_phone: str | None = None
    company_phone: str | None = None
    company_phone_short: str | None = None
    address: str | None = None
    hide_location: bool = False
    share_on_whatsapp: bool = True

    model_config = ConfigDict(from_attributes=True)


class ChangePasswordRequest(BaseModel):
    """Şifre değişimi isteği"""

    old_password: str
    new_password: str


class ProfileUpdate(BaseModel):
    """Profil güncellemesi (kişi kendi profilini update eder)"""

    full_name: str | None = None
    work_email: EmailStr | None = None

    model_config = ConfigDict(from_attributes=True)
