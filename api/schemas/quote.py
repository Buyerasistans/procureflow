"""Quote ve Teklif İsteği (RFQ) Şemaları"""

from enum import Enum

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)
from datetime import datetime
from typing import Optional

from api.app.domain.quote.enums import to_public_quote_status


# ============ QUOTE ITEM SCHEMAS ============


class QuoteItemCreate(BaseModel):
    """Teklif kalemi oluştur"""

    line_number: str
    category_code: str = ""
    category_name: str = ""
    description: str
    unit: str
    quantity: float
    unit_price: Optional[float] = None
    vat_rate: float = 20
    group_key: Optional[str] = None
    is_group_header: bool = False
    notes: Optional[str] = None


class QuoteItemOut(QuoteItemCreate):
    """Teklif kalemi çıktı"""

    id: int
    quote_id: int
    total_price: Optional[float] = None
    sequence: int

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def rfq_id(self) -> int:
        return self.quote_id


# ============ QUOTE SCHEMAS ============


class QuoteCreate(BaseModel):
    """Teklif oluştur"""

    project_id: int
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    company_name: str = Field(min_length=1, max_length=255)
    company_contact_name: str
    company_contact_phone: str
    company_contact_email: str
    department_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    listing_scope_preference: Optional[str] = None

    @field_validator("listing_scope_preference")
    @classmethod
    def validate_listing_scope_preference(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not normalized:
            return None
        allowed = {
            "private_suppliers_only",
            "platform_network_only",
            "private_and_platform_network",
            "premium_featured_listing",
        }
        if normalized not in allowed:
            raise ValueError("Gecersiz listing_scope_preference degeri")
        return normalized


class QuoteUpdate(BaseModel):
    """Teklif güncelle"""

    title: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    total_amount: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = None
    company_name: Optional[str] = None
    company_contact_name: Optional[str] = None
    company_contact_phone: Optional[str] = None
    company_contact_email: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sync_amount_fields(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value

        data = dict(value)
        if data.get("total_amount") is None and data.get("amount") is not None:
            data["total_amount"] = data["amount"]
        elif data.get("amount") is None and data.get("total_amount") is not None:
            data["amount"] = data["total_amount"]
        return data


class QuoteOut(BaseModel):
    """Teklif çıktı"""

    id: int
    project_id: int
    created_by_id: int
    title: str
    description: Optional[str] = None
    status: str
    company_name: str
    company_contact_name: str
    company_contact_phone: str
    company_contact_email: str
    tenant_id: Optional[int] = None
    published_by_tenant_name: Optional[str] = None
    listing_scope: Optional[str] = None
    listing_scope_label: Optional[str] = None
    private_supplier_count: int = 0
    platform_network_supplier_count: int = 0
    invited_supplier_count: int = 0
    responded_supplier_count: int = 0
    package_plan_code: Optional[str] = None
    package_plan_name: Optional[str] = None
    active_premium_feature_codes: list[str] = []
    entitlement_status: Optional[str] = None
    entitlement_summary: Optional[str] = None
    platform_network_listing_enabled: bool = False
    premium_listing_enabled: bool = False
    total_amount: float
    currency: str
    version: Optional[int] = None
    transition_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    is_active: bool
    department_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    items: list[QuoteItemOut] = []

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def rfq_id(self) -> int:
        return self.id

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> str:
        if value is None:
            return "draft"
        if isinstance(value, Enum):
            raw_value = value.value
        else:
            raw_value = str(value)
        return to_public_quote_status(raw_value)


# Uyumluluk için eski şemalar
class QuoteCreateOld(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    amount: float = Field(ge=0)
    project_id: int | None = None


class QuoteUpdateOld(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    amount: float | None = Field(default=None, ge=0)


class QuoteListOut(BaseModel):
    count: int
    page: int
    size: int
    items: list[QuoteOut]


class MessageOut(BaseModel):
    message: str


# ============ APPROVAL SCHEMAS ============


class QuoteApprovalCreate(BaseModel):
    """Onay isteği oluştur"""

    quote_id: int
    approval_level: int
    required_business_role: Optional[str] = None


class QuoteApprovalOut(BaseModel):
    """Onay çıktı"""

    id: int
    quote_id: int
    approval_level: int
    required_business_role: Optional[str] = None
    status: str
    comment: Optional[str] = None
    requested_at: datetime
    completed_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def rfq_id(self) -> int:
        return self.quote_id


class RfqCreate(QuoteCreate):
    """RFQ oluşturma alias'ı; mevcut QuoteCreate sözleşmesi ile uyumludur."""


class RfqUpdate(QuoteUpdate):
    """RFQ güncelleme alias'ı; mevcut QuoteUpdate sözleşmesi ile uyumludur."""


class RfqOut(QuoteOut):
    """RFQ çıktı alias'ı; mevcut QuoteOut sözleşmesi ile uyumludur."""


class RfqListOut(BaseModel):
    count: int
    page: int
    size: int
    items: list[RfqOut]
