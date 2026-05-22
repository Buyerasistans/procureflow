# api\services\auth_service.py
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from api.core.config import REFRESH_TOKEN_EXPIRE_DAYS
from api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from api.core.authz import normalized_system_role
from api.models.refresh_token import RefreshToken
from api.models.user import User
import hashlib


def hash_jti(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def refresh_tokens(db: Session, raw_refresh_token: str) -> dict:
    payload = decode_refresh_token(raw_refresh_token)

    user_id = int(payload["sub"])
    old_jti = payload["jti"]
    old_jti_hash = hash_jti(old_jti)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    if hasattr(user, "is_active") and not user.is_active:
        raise ValueError("User inactive")

    role = getattr(user, "role", None) or payload.get("role", "user")
    system_role = normalized_system_role(user)

    token_row = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.jti_hash == old_jti_hash, RefreshToken.revoked_at.is_(None)
        )
        .first()
    )
    if not token_row:
        raise ValueError("Refresh token revoked or not found")

    token_row.revoked_at = datetime.now(timezone.utc)

    new_refresh = create_refresh_token(
        sub=str(user.id), role=role, system_role=system_role
    )
    new_payload = decode_refresh_token(new_refresh)
    new_jti_hash = hash_jti(new_payload["jti"])

    db.add(
        RefreshToken(
            jti_hash=new_jti_hash,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            revoked_at=None,
        )
    )

    db.commit()

    new_access = create_access_token(
        sub=str(user.id), role=role, system_role=system_role
    )

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


def logout_refresh_token(db: Session, raw_refresh_token: str) -> None:
    payload = decode_refresh_token(raw_refresh_token)
    jti = payload["jti"]
    jti_hash = hash_jti(jti)

    token_row = (
        db.query(RefreshToken)
        .filter(RefreshToken.jti_hash == jti_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )

    if not token_row:
        raise ValueError("Refresh token already revoked or not found")

    token_row.revoked_at = datetime.now(timezone.utc)
    db.commit()
