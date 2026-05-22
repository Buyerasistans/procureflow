from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.core.authz import can_manage_tenant_governance, can_read_admin_catalog
from api.core.deps import get_current_user, get_db
from api.models.user import User
from api.schemas.payment_provider import (
    PaymentProviderSettingOut,
    PaymentProviderSettingUpdateIn,
)
from api.services.payment.provider_settings_service import (
    list_admin_provider_settings,
    upsert_provider_setting,
)

router = APIRouter(prefix="/admin/payment-providers", tags=["payment-admin"])


def require_provider_reader(current_user: User = Depends(get_current_user)):
    if not can_read_admin_catalog(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu odeme ayarlarini goruntuleme yetkiniz yok",
        )
    return current_user


def require_provider_manager(current_user: User = Depends(get_current_user)):
    if not can_manage_tenant_governance(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Odeme provider ayarlarini sadece super admin guncelleyebilir",
        )
    return current_user


@router.get("", response_model=list[PaymentProviderSettingOut])
def get_payment_provider_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_provider_reader),
):
    return list_admin_provider_settings(db)


@router.put("/{provider_code}", response_model=PaymentProviderSettingOut)
def put_payment_provider_setting(
    provider_code: str,
    payload: PaymentProviderSettingUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_provider_manager),
):
    try:
        upsert_provider_setting(
            db,
            provider_code=provider_code.strip().lower(),
            is_active=payload.is_active,
            credentials=payload.credentials,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    matched = [
        row
        for row in list_admin_provider_settings(db)
        if row["code"] == provider_code.strip().lower()
    ]
    if not matched:
        raise HTTPException(status_code=404, detail="Provider ayari bulunamadi")
    return matched[0]
