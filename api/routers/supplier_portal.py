"""Tedarikçi Portal - Kaydolma ve Giriş (Açık Endpoint'ler)"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, EmailStr

from api.database import get_db
from api.models import SupplierUser, Supplier
from api.routers.auth import create_access_token
from api.core.security import get_password_hash, verify_password

router = APIRouter(prefix="/supplier", tags=["supplier-portal"])


# ============ SCHEMAS ============


class SupplierRegisterRequest(BaseModel):
    """Supplier kaydolma formu"""

    token: str
    password: str

    model_config = ConfigDict(from_attributes=True)


class SupplierRegisterValidateResponse(BaseModel):
    """Magic link validation sonucu"""

    valid: bool
    supplier_user_name: str | None = None
    supplier_name: str | None = None
    email: str | None = None
    expires_at: datetime | None = None
    message: str | None = None


class SupplierLoginRequest(BaseModel):
    """Supplier login formu"""

    email: EmailStr
    password: str

    model_config = ConfigDict(from_attributes=True)


class SupplierLoginResponse(BaseModel):
    """Login sonucu"""

    access_token: str
    token_type: str = "bearer"
    supplier_user: dict


# ============ ENDPOINTS ============


@router.get("/register/validate")
def validate_magic_link(
    token: str, db: Session = Depends(get_db)
) -> SupplierRegisterValidateResponse:
    """Magic link'i doğrula (Kayıt formunu göstermeden önce)"""

    supplier_user = (
        db.query(SupplierUser).filter(SupplierUser.magic_token == token).first()
    )

    if not supplier_user:
        return SupplierRegisterValidateResponse(valid=False, message="Geçersiz link")

    # Token expired mi kontrol et
    if supplier_user.magic_token_expires:
        expires = supplier_user.magic_token_expires
        expires_naive = (
            expires.replace(tzinfo=None)
            if hasattr(expires, "tzinfo") and expires.tzinfo
            else expires
        )
        if datetime.now() > expires_naive:
            return SupplierRegisterValidateResponse(
                valid=False, message="Bağlantının süresi dolmuş. Yeni bir davet isteyin"
            )

    # Zaten registered mi kontrol et
    if supplier_user.password_set:
        return SupplierRegisterValidateResponse(
            valid=False, message="Bu kullanıcı zaten kayıtlı"
        )

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )

    return SupplierRegisterValidateResponse(
        valid=True,
        supplier_user_name=supplier_user.name,
        supplier_name=supplier.company_name if supplier else None,
        email=supplier_user.email,
        expires_at=supplier_user.magic_token_expires,
    )


@router.post("/register")
def register_supplier_user(
    register_data: SupplierRegisterRequest, db: Session = Depends(get_db)
):
    """Tedarikçi kullanıcı kaydı tamamla (Şifre belirle)"""

    print("[REGISTER] POST /supplier/register called")
    print(f"[REGISTER] Token from request: {register_data.token[:30]}...")

    supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.magic_token == register_data.token)
        .first()
    )

    if not supplier_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Geçersiz bağlantı"
        )

    # Token expired mi?
    if supplier_user.magic_token_expires:
        expires = supplier_user.magic_token_expires
        expires_naive = (
            expires.replace(tzinfo=None)
            if hasattr(expires, "tzinfo") and expires.tzinfo
            else expires
        )
        if datetime.now() > expires_naive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kaydolma bağlantısının süresi dolmuş",
            )

    # Zaten registered mi?
    if supplier_user.password_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Bu hesap zaten kayıtlı"
        )

    # Password'u hash et
    hashed_password = get_password_hash(register_data.password)

    # Supplier user'ı update et
    supplier_user.hashed_password = hashed_password
    supplier_user.password_set = True
    supplier_user.email_verified = True
    supplier_user.magic_token = None  # Magic token'ı sil
    supplier_user.magic_token_expires = None
    supplier_user.updated_at = datetime.now(ZoneInfo("UTC"))

    db.commit()
    db.refresh(supplier_user)

    print("[REGISTER] SupplierUser after update:")
    print(f"  Email: {supplier_user.email}")
    print(f"  is_active: {supplier_user.is_active}")
    print(f"  password_set: {supplier_user.password_set}")
    print(f"  email_verified: {supplier_user.email_verified}")

    # JWT token oluştur (otomatik giriş)
    access_token = create_access_token(sub=str(supplier_user.email), role="supplier")

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )

    return {
        "status": "success",
        "message": "Kaydınız tamamlandı. Hoş geldiniz!",
        "access_token": access_token,
        "token_type": "bearer",
        "supplier_user": {
            "id": supplier_user.id,
            "name": supplier_user.name,
            "email": supplier_user.email,
            "work_email": supplier_user.work_email,
            "supplier_id": supplier_user.supplier_id,
            "supplier_name": supplier.company_name if supplier else None,
            "email_verified": supplier_user.email_verified,
        },
    }


@router.post("/login", response_model=SupplierLoginResponse)
def supplier_login(login_data: SupplierLoginRequest, db: Session = Depends(get_db)):
    """Tedarikçi giriş"""

    normalized_email = login_data.email.strip().lower()

    supplier_user = (
        db.query(SupplierUser)
        .filter(
            func.lower(SupplierUser.email) == normalized_email, SupplierUser.is_active
        )
        .first()
    )

    if not supplier_user or not supplier_user.password_set:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail veya şifre hatalı"
        )

    # Password verify
    if not supplier_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail veya şifre hatalı"
        )
    if not verify_password(login_data.password, supplier_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail veya şifre hatalı"
        )

    # JWT token oluştur
    access_token = create_access_token(sub=str(supplier_user.email), role="supplier")

    supplier = (
        db.query(Supplier).filter(Supplier.id == supplier_user.supplier_id).first()
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "supplier_user": {
            "id": supplier_user.id,
            "name": supplier_user.name,
            "email": supplier_user.email,
            "work_email": supplier_user.work_email,
            "supplier_id": supplier_user.supplier_id,
            "supplier_name": supplier.company_name if supplier else None,
            "email_verified": supplier_user.email_verified,
        },
    }
