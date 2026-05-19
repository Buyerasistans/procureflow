from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PaymentProviderFieldOut(BaseModel):
    key: str
    label: str
    secret: bool
    required: bool
    placeholder: str | None = None
    value: str | None = None
    has_value: bool = False


class PaymentProviderSettingOut(BaseModel):
    code: str
    name: str
    country: str
    category: str
    integration_level: str
    supports: list[str]
    notes: str
    installed: bool
    ready: bool
    is_active: bool
    fields: list[PaymentProviderFieldOut]


class PaymentProviderSettingUpdateIn(BaseModel):
    is_active: bool | None = None
    credentials: dict[str, str] = Field(default_factory=dict)
    notes: str | None = None


class PaymentProviderPublicOut(BaseModel):
    code: str
    name: str
    country: str
    category: str
    integration_level: str
    supports: list[str]
    installed: bool
    ready: bool


class PaymentProviderRecordOut(BaseModel):
    id: int
    provider_code: str
    is_active: bool
    credentials_json: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
