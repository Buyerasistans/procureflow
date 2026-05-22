from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CompanyDepartmentSummary(BaseModel):
    id: int
    name: str
    sub_items: list[dict[str, int | str]] = []

    model_config = ConfigDict(from_attributes=True)


class CompanyCreate(BaseModel):
    name: str
    short_name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    color: str = "#3b82f6"
    is_active: bool = True
    is_primary: bool = False
    trade_name: str | None = None
    tax_office: str | None = None
    tax_number: str | None = None
    registration_number: str | None = None
    address: str | None = None
    city: str | None = None
    address_district: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    contact_info: str | None = None
    hide_location: bool = False
    share_on_whatsapp: bool = True


class CompanyUpdate(BaseModel):
    name: str | None = None
    short_name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    color: str | None = None
    is_active: bool | None = None
    is_primary: bool | None = None
    trade_name: str | None = None
    tax_office: str | None = None
    tax_number: str | None = None
    registration_number: str | None = None
    address: str | None = None
    city: str | None = None
    address_district: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    contact_info: str | None = None
    hide_location: bool | None = None
    share_on_whatsapp: bool | None = None


class CompanyOut(BaseModel):
    id: int
    created_by_id: int | None = None
    tenant_id: int | None = None
    name: str
    short_name: str | None = None
    description: str | None
    logo_url: str | None = None
    color: str
    is_active: bool
    is_primary: bool = False
    trade_name: str | None = None
    tax_office: str | None = None
    tax_number: str | None = None
    registration_number: str | None = None
    address: str | None = None
    city: str | None = None
    address_district: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    contact_info: str | None = None
    hide_location: bool = False
    share_on_whatsapp: bool = True
    owner_full_name: str | None = None
    owner_email: str | None = None
    is_platform_primary: bool = False
    quote_count: int = 0
    personnel_count: int = 0
    departments: list[CompanyDepartmentSummary] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
