# api\routers\auth.py
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from api.core.config import REFRESH_TOKEN_EXPIRE_DAYS
from api.core.authz import normalized_system_role
from api.core.deps import get_current_user
from api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from api.db.session import get_db
from api.models import User
from api.models.refresh_token import RefreshToken
from api.schemas.auth import (
    LogoutRequest,
    MessageResponse,
    TokenPairResponse,
    TokenRefreshRequest,
)
from api.services.user_department_service import resolve_effective_department_id
from api.services.auth_service import hash_jti, logout_refresh_token, refresh_tokens
from api.services.email_service import get_email_service
from api.services.work_mailbox_service import ensure_user_work_mailbox
from api.models.assignment import CompanyRole
from api.models.company import Company
from api.models.tenant import Tenant


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _resolve_workspace_branding(db: Session, user: User) -> dict[str, str | None]:
    platform_name = "Buyera Asistans"
    platform_domain = "buyerasistans.com.tr"
    system_role = _resolve_system_role(user)

    if system_role == "super_admin":
        return {
            "organization_name": platform_name,
            "organization_logo_url": None,
            "workspace_label": "Ana Yönetim",
            "platform_name": platform_name,
            "platform_domain": platform_domain,
        }

    tenant = None
    if getattr(user, "tenant_id", None):
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

    company = (
        db.query(Company)
        .join(CompanyRole, CompanyRole.company_id == Company.id)
        .filter(CompanyRole.user_id == user.id, CompanyRole.is_active.is_(True))
        .order_by(Company.id.asc())
        .first()
    )

    if company is None and user.created_by_id:
        company = (
            db.query(Company)
            .filter(
                Company.created_by_id == user.created_by_id, Company.is_active.is_(True)
            )
            .order_by(Company.id.asc())
            .first()
        )

    if tenant is not None:
        tenant_name = tenant.brand_name or tenant.legal_name
        tenant_domain = platform_domain
        if tenant.settings and tenant.settings.custom_domain:
            tenant_domain = tenant.settings.custom_domain

        workspace_label = (
            f"{tenant_name} Owner Yönetim Alanı"
            if system_role == "tenant_owner"
            else (
                f"{tenant_name} Yönetim Alanı"
                if system_role == "tenant_admin"
                else f"{tenant_name} Personel Girisi"
            )
        )

        return {
            "organization_name": tenant_name,
            "organization_logo_url": tenant.logo_url
            or (company.logo_url if company else None),
            "workspace_label": workspace_label,
            "platform_name": platform_name,
            "platform_domain": tenant_domain,
        }

    organization_name = company.name if company else platform_name
    workspace_label = (
        f"{organization_name} Owner Yönetim Alanı"
        if system_role == "tenant_owner"
        else (
            f"{organization_name} Calisma Alani"
            if system_role == "tenant_admin"
            else f"{organization_name} Personel Girisi"
        )
    )

    return {
        "organization_name": organization_name,
        "organization_logo_url": company.logo_url if company else None,
        "workspace_label": workspace_label,
        "platform_name": platform_name,
        "platform_domain": platform_domain,
    }


def _resolve_system_role(user: User) -> str:
    return normalized_system_role(user)


def _build_auth_user_payload(db: Session, user: User) -> dict[str, str | int | None]:
    effective_department_id = resolve_effective_department_id(db, user)
    branding = _resolve_workspace_branding(db, user)
    return {
        "id": user.id,
        "email": user.email,
        "work_email": user.work_email,
        "role": user.role,
        "business_role": user.role,
        "system_role": _resolve_system_role(user),
        "full_name": user.full_name,
        "department_id": effective_department_id,
        "tenant_id": getattr(user, "tenant_id", None),
        "scope_type": getattr(user, "scope_type", None),
        **branding,
    }


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ActivationVerifyIn(BaseModel):
    token: str


class ActivationCompleteIn(BaseModel):
    token: str
    password: str


LOGIN_EMAIL_COMPATIBILITY_ALIASES: dict[str, tuple[str, ...]] = {
    "superadmin@buyerasistans.com.tr": ("superadmin@procureflow.com",),
    "superadmin@procureflow.com": ("superadmin@buyerasistans.com.tr",),
}


def _resolve_login_user(db: Session, email: str) -> User | None:
    normalized_email = str(email or "").strip().lower()
    if not normalized_email:
        return None

    candidate_emails = [normalized_email]
    candidate_emails.extend(LOGIN_EMAIL_COMPATIBILITY_ALIASES.get(normalized_email, ()))

    for candidate_email in candidate_emails:
        user = db.query(User).filter(User.email == candidate_email).first()
        if user is not None:
            return user

    return None


@router.post("/login", response_model=TokenPairResponse)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = _resolve_login_user(db, data.email)

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı pasif durumda",
        )

    # hidden_from_admin admin surface'te görünmeyi engeller; super_admin yine de giriş yapabilmelidir.
    if (
        getattr(user, "hidden_from_admin", False)
        and normalized_system_role(user) != "super_admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı pasif durumda",
        )

    print(f"[DEBUG] Login: user_id={user.id}, email={user.email}, role={user.role}")
    auth_user = _build_auth_user_payload(db, user)
    access_token = create_access_token(
        sub=str(user.id), role=user.role, system_role=str(auth_user["system_role"])
    )
    refresh_token = create_refresh_token(
        sub=str(user.id), role=user.role, system_role=str(auth_user["system_role"])
    )

    # Refresh token'ı DB'ye kaydet

    payload = decode_refresh_token(refresh_token)
    jti_hash = hash_jti(payload["jti"])

    db_refresh = RefreshToken(
        jti_hash=jti_hash,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked_at=None,
    )
    db.add(db_refresh)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": auth_user,
    }


@router.post("/activate/verify")
def verify_activation_token(data: ActivationVerifyIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.invitation_token == data.token).first()

    if not user or not user.is_active or getattr(user, "hidden_from_admin", False):
        raise HTTPException(status_code=404, detail="Geçersiz aktivasyon bağlantısı")

    expires = user.invitation_token_expires
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410, detail="Aktivasyon bağlantısının süresi dolmuş"
        )

    return {
        "valid": True,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "business_role": user.role,
        "system_role": _resolve_system_role(user),
        "accepted": bool(getattr(user, "invitation_accepted", False)),
        **_resolve_workspace_branding(db, user),
    }


@router.post("/activate", response_model=TokenPairResponse)
def activate_internal_user(
    data: ActivationCompleteIn,
    db: Session = Depends(get_db),
    email_service=Depends(get_email_service),
):
    user = db.query(User).filter(User.invitation_token == data.token).first()

    if not user or not user.is_active or getattr(user, "hidden_from_admin", False):
        raise HTTPException(status_code=404, detail="Geçersiz aktivasyon bağlantısı")

    expires = user.invitation_token_expires
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410, detail="Aktivasyon bağlantısının süresi dolmuş"
        )

    if len((data.password or "").strip()) < 8:
        raise HTTPException(status_code=400, detail="Şifre en az 8 karakter olmalı")

    user.hashed_password = get_password_hash(data.password)
    user.invitation_accepted = True
    user.invitation_token = None
    user.invitation_token_expires = None

    work_mailbox_credentials = None
    try:
        work_mailbox_credentials = ensure_user_work_mailbox(db, user)
    except Exception:
        logger.exception("[AUTH_ACTIVATE] Auto work mailbox provisioning failed")

    db.commit()
    db.refresh(user)

    if work_mailbox_credentials is not None:
        try:
            email_service.send_custom_email(
                to_email=user.email,
                subject="ProcureFlow İş Maili Bilgileriniz",
                body=(
                    "Merhaba,\n\n"
                    "Hesabınız aktifleştirildi. Platform varsayılan SMTP/POP3/IMAP ayarları için otomatik bir iş maili oluşturuldu.\n\n"
                    f"İş maili: {work_mailbox_credentials['work_email']}\n"
                    f"Sifre: {work_mailbox_credentials['password']}\n\n"
                    "Not: Sisteme giriş her zaman üye olduğunuz kişisel e-posta ve şifreniz ile yapılır.\n"
                    "Isterseniz profilinizde ozel SMTP/POP3/IMAP ayarlari tanimlayarak kendi kurum e-postanizi varsayilan yapabilirsiniz."
                ),
                owner_user_id=user.id,
            )
        except Exception:
            logger.exception("[AUTH_ACTIVATE] Work mailbox credential email failed")

    auth_user = _build_auth_user_payload(db, user)
    access_token = create_access_token(
        sub=str(user.id), role=user.role, system_role=str(auth_user["system_role"])
    )
    refresh_token = create_refresh_token(
        sub=str(user.id), role=user.role, system_role=str(auth_user["system_role"])
    )

    payload = decode_refresh_token(refresh_token)
    jti_hash = hash_jti(payload["jti"])

    db_refresh = RefreshToken(
        jti_hash=jti_hash,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked_at=None,
    )
    db.add(db_refresh)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": auth_user,
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_user = _build_auth_user_payload(db, current_user)
    db.commit()
    return auth_user


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_token(payload: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        return refresh_tokens(db, payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout", response_model=MessageResponse)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    try:
        logout_refresh_token(db, payload.refresh_token)
        return {"message": "Logged out successfully"}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
