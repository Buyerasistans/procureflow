"""Tedarikçi (Supplier) Şemaları"""

from pydantic import BaseModel, ConfigDict, Field, EmailStr
from datetime import datetime
from typing import Optional


# ============ SUPPLIER USER SCHEMAS ============


class SupplierUserCreate(BaseModel):
    """Tedarikçi firma kullanıcısı oluştur"""

    name: str
    email: EmailStr
    work_email: Optional[EmailStr] = None
    phone: Optional[str] = None


class SupplierUserUpdate(BaseModel):
    """Tedarikçi firma kullanıcısı güncelle"""

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    work_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierUserOut(SupplierUserCreate):
    """Tedarikçi firma kullanıcısı çıktı"""

    id: int
    supplier_id: int
    is_active: bool
    email_verified: bool
    password_set: bool
    is_default: bool = False

    model_config = ConfigDict(from_attributes=True)


# ============ SUPPLIER SCHEMAS ============


class SupplierCreate(BaseModel):
    """Tedarikçi oluştur"""

    company_name: str = Field(min_length=1, max_length=255)
    company_title: Optional[str] = None
    tax_number: Optional[str] = None
    registration_number: Optional[str] = None
    phone: str
    email: EmailStr
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    address_district: Optional[str] = None
    postal_code: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None  # e.g., "Yazılım", "Donanım", "Hizmet"
    category_tags: list[str] = Field(default_factory=list)
    partner_category_tags: list[str] = Field(default_factory=list)


class SupplierUpdate(BaseModel):
    """Tedarikçi güncelle"""

    company_name: Optional[str] = None
    company_title: Optional[str] = None
    email: Optional[EmailStr] = None
    tax_number: Optional[str] = None
    registration_number: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    address_district: Optional[str] = None
    postal_code: Optional[str] = None
    invoice_name: Optional[str] = None
    invoice_address: Optional[str] = None
    invoice_city: Optional[str] = None
    invoice_district: Optional[str] = None
    invoice_postal_code: Optional[str] = None
    reference_score: Optional[float] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    category_tags: list[str] | None = None
    partner_category_tags: list[str] | None = None
    is_verified: Optional[bool] = None
    logo_url: Optional[str] = None


class SupplierOut(SupplierCreate):
    """Tedarikçi çıktı"""

    id: int
    created_by_id: int
    reference_score: float
    notes: Optional[str] = None
    is_active: bool
    is_verified: bool
    logo_url: Optional[str] = None
    category_tags: list[str] = Field(default_factory=list)
    partner_category_tags: list[str] = Field(default_factory=list)
    effective_category_tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None
    source_type: str = "private"
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    inviter_company_name: Optional[str] = None
    special_listing_active: bool = False

    # Invoice fields
    invoice_name: Optional[str] = None
    invoice_address: Optional[str] = None
    invoice_city: Optional[str] = None
    invoice_district: Optional[str] = None
    invoice_postal_code: Optional[str] = None
    registration_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============ SUPPLIER QUOTE SCHEMAS ============


class SupplierQuoteItemCreate(BaseModel):
    """Tedarikçi teklif kalemi oluştur"""

    quote_item_id: int
    unit_price: float
    total_price: float
    notes: Optional[str] = None


class SupplierQuoteItemOut(SupplierQuoteItemCreate):
    """Tedarikçi teklif kalemi çıktı"""

    id: int
    supplier_quote_id: int

    model_config = ConfigDict(from_attributes=True)


class SupplierQuoteCreate(BaseModel):
    """Tedarikçi teklifi oluştur"""

    quote_id: int
    supplier_id: int
    total_amount: float
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    final_amount: float
    payment_terms: Optional[str] = None
    delivery_time: Optional[int] = None
    warranty: Optional[str] = None
    notes: Optional[str] = None


class SupplierQuoteOut(SupplierQuoteCreate):
    """Tedarikçi teklifi çıktı"""

    id: int
    supplier_user_id: Optional[int] = None
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: list[SupplierQuoteItemOut] = []

    model_config = ConfigDict(from_attributes=True)
