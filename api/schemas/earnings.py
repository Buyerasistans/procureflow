from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# EarningsLedger
# ---------------------------------------------------------------------------


class EarningsLedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    talent_profile_id: int
    event_type: str
    amount: Decimal
    currency: str
    balance_after: Decimal
    reference_type: str | None
    reference_id: int | None
    notes: str | None
    created_by_user_id: int | None
    created_at: datetime


class PaginatedEarningsOut(BaseModel):
    total: int
    page: int
    size: int
    items: list[EarningsLedgerOut]


# ---------------------------------------------------------------------------
# PayoutRequest
# ---------------------------------------------------------------------------


class PayoutRequestCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    currency: str = Field(default="TRY", max_length=10)
    payment_method: str = Field(
        default="bank_transfer",
        pattern="^(bank_transfer|iban)$",
    )
    bank_details: dict | None = Field(
        default=None,
        description="Banka bilgileri — response'ta maskelenmiş döner",
    )


class PayoutRequestStatusUpdate(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    rejection_reason: str | None = None


class PayoutRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    talent_profile_id: int
    amount: Decimal
    currency: str
    payment_method: str
    bank_details_masked: dict | None = None
    status: str
    reviewer_user_id: int | None
    reviewed_at: datetime | None
    paid_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _mask_bank(cls, data: object) -> object:
        if hasattr(data, "__dict__"):
            raw = getattr(data, "bank_details_json", None)
            d = {
                **{k: v for k, v in data.__dict__.items() if not k.startswith("_")},
                "bank_details_masked": _mask_bank_details(raw),
            }
            return d
        if isinstance(data, dict):
            data = dict(data)
            data.setdefault(
                "bank_details_masked",
                _mask_bank_details(data.pop("bank_details_json", None)),
            )
        return data


class PaginatedPayoutRequestsOut(BaseModel):
    total: int
    page: int
    size: int
    items: list[PayoutRequestOut]


# ---------------------------------------------------------------------------
# Masking helper — IBAN ve benzeri alanlar: son 4 hane görünür
# ---------------------------------------------------------------------------


def _mask_bank_details(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    masked: dict = {}
    for k, v in data.items():
        if isinstance(v, str) and len(v) > 4:
            masked[k] = "*" * (len(v) - 4) + v[-4:]
        else:
            masked[k] = v
    return masked
