# api\core\deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from api.db.session import get_db
from api.core.authz import normalized_role
from api.core.security import decode_access_token
from api.models import User, SupplierUser

security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_access_token(creds.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject format",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def get_current_supplier_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> SupplierUser:
    """Tedarikçi kullanıcısını authenticate et (supplier login token)"""
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_access_token(creds.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # Supplier JWT'de role="supplier" ve sub=email kaydediliyor
    role = payload.get("role")
    print(f"[AUTH] Supplier role check: role={role}")
    if role != "supplier":
        print(f"[AUTH] Role mismatch! Expected 'supplier', got '{role}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tedarikçi rolü gerekli",
        )

    email = payload.get("sub")
    print(f"[AUTH] Looking up SupplierUser with email={email}")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing email",
        )

    supplier_user = (
        db.query(SupplierUser)
        .filter(SupplierUser.email == email, SupplierUser.is_active)
        .first()
    )

    print(f"[AUTH] SupplierUser query result: {supplier_user}")
    if supplier_user:
        print(
            f"[AUTH] Found: email={supplier_user.email}, is_active={supplier_user.is_active}"
        )
    else:
        print(f"[AUTH] NOT FOUND or is_active=False for email={email}")

    if not supplier_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tedarikçi kullanıcısı bulunamadı",
        )

    return supplier_user


def get_any_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Hem admin hem de supplier token'ını kabul eden dependency.
    Supplier token'da role='supplier' ve sub=email bulunur.
    Admin token'da sub=user_id (int string) bulunur.
    """
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = decode_access_token(creds.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    role = payload.get("role")

    if role == "supplier":
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing email")
        supplier_user = (
            db.query(SupplierUser)
            .filter(SupplierUser.email == email, SupplierUser.is_active)
            .first()
        )
        if not supplier_user:
            raise HTTPException(
                status_code=401, detail="Tedarikçi kullanıcısı bulunamadı"
            )
        return supplier_user
    else:
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Token missing subject")
        try:
            user_id = int(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid token subject format")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user


def require_role(required_role: str):
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if normalized_role(current_user) != required_role.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{required_role} role required",
            )
        return current_user

    return _checker
