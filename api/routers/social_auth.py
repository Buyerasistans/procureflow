import base64
import json
import os
import secrets
import threading
import time
import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from api.core.config import REFRESH_TOKEN_EXPIRE_DAYS
from api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
)
from api.db.session import get_db
from api.models import User
from api.models.refresh_token import RefreshToken
from api.services.auth_service import hash_jti

router = APIRouter(prefix="/auth/social", tags=["auth"])

_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
_API_URL = os.getenv("API_URL", "http://localhost:8000")

# Google
_GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# LinkedIn
_LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
_LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
_LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
_LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
_LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"

# Short-lived one-time stores — sensitive data never goes into redirect URLs
_TEMP_STORE: dict[str, tuple[dict, float]] = {}
_TEMP_STORE_LOCK = threading.Lock()
_TEMP_TTL = 120.0  # seconds


def _temp_put(payload: dict) -> str:
    code = secrets.token_urlsafe(32)
    expiry = time.monotonic() + _TEMP_TTL
    with _TEMP_STORE_LOCK:
        now = time.monotonic()
        expired = [k for k, (_, exp) in _TEMP_STORE.items() if exp < now]
        for k in expired:
            del _TEMP_STORE[k]
        _TEMP_STORE[code] = (payload, expiry)
    return code


def _temp_pop(code: str) -> dict | None:
    with _TEMP_STORE_LOCK:
        entry = _TEMP_STORE.pop(code, None)
    if entry is None:
        return None
    payload, expiry = entry
    if time.monotonic() > expiry:
        return None
    return payload


def _store_temp_tokens(tokens: dict) -> str:
    return _temp_put({"type": "tokens", **tokens})


def _consume_temp_tokens(code: str) -> dict | None:
    payload = _temp_pop(code)
    if payload is None or payload.get("type") != "tokens":
        return None
    return {k: v for k, v in payload.items() if k != "type"}


# All valid mode values — anything else is rejected and replaced with "login"
_VALID_MODES = frozenset({
    "login", "candidate", "employer",
    "channel_preview", "supplier_preview", "strategic_preview",
})

# All valid error codes passed to the frontend
_VALID_ERROR_CODES = frozenset({
    "access_denied", "not_configured", "token_failed",
    "invalid_profile", "server_error",
})

# Modes that trigger B2B prefill (no account creation)
_B2B_PREVIEW_MODES = {"channel_preview", "supplier_preview", "strategic_preview"}

# B2B prefill landing routes (values are hardcoded paths, not user-controlled)
_B2B_LANDING = {
    "channel_preview": "/is-ortagi-basvuru",
    "supplier_preview": "/supplier/register",
    "strategic_preview": "/employer/register",
}


def _sanitize_mode(mode: str) -> str:
    """Return mode only if it is a known-safe value; otherwise fall back to login."""
    return mode if mode in _VALID_MODES else "login"


def _google_redirect_uri() -> str:
    return f"{_API_URL}/api/v1/auth/social/google/callback"


def _linkedin_redirect_uri() -> str:
    return f"{_API_URL}/api/v1/auth/social/linkedin/callback"


def _callback_error(error: str) -> RedirectResponse:
    safe = error if error in _VALID_ERROR_CODES else "server_error"
    return RedirectResponse(f"{_FRONTEND_URL}/auth/social/callback?error={safe}")


def _encode_state(mode: str) -> str:
    payload = json.dumps({"mode": mode}).encode()
    return base64.urlsafe_b64encode(payload).decode()


def _decode_state(state: str) -> dict:
    try:
        padded = state + "=" * (-len(state) % 4)
        return json.loads(base64.urlsafe_b64decode(padded).decode())
    except Exception:
        return {}


def _create_session(db: Session, user: User) -> dict[str, str]:
    access_token = create_access_token(
        sub=str(user.id), role=user.role, system_role=user.system_role
    )
    refresh_token = create_refresh_token(
        sub=str(user.id), role=user.role, system_role=user.system_role
    )
    payload = decode_refresh_token(refresh_token)
    jti_hash = hash_jti(payload["jti"])
    db.add(
        RefreshToken(
            jti_hash=jti_hash,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            revoked_at=None,
        )
    )
    db.commit()
    return {"access_token": access_token, "refresh_token": refresh_token}


def _find_or_create_social_user(
    db: Session,
    *,
    id_field: str,
    provider_id: str,
    email: str,
    full_name: str,
    photo: str = "",
    system_role: str = "candidate_user",
) -> tuple[User, bool]:
    """Returns (user, is_new). is_new=True when account was just created."""
    user = db.query(User).filter(getattr(User, id_field) == provider_id).first()
    if user:
        return user, False

    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if user:
        setattr(user, id_field, provider_id)
        if photo and not user.photo:
            user.photo = photo
        db.commit()
        db.refresh(user)
        return user, False

    new_user = User(
        email=email.lower().strip(),
        hashed_password=get_password_hash(secrets.token_hex(32)),
        full_name=full_name or email.split("@")[0],
        role="user",
        system_role=system_role,
        is_active=True,
        invitation_accepted=True,
        social_login_only=True,
        photo=photo or None,
    )
    setattr(new_user, id_field, provider_id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user, True


def _b2b_prefill_redirect(mode: str, full_name: str, email: str, picture: str) -> RedirectResponse:
    landing = _B2B_LANDING.get(mode, "/")
    code = _temp_put({"type": "prefill", "name": full_name, "email": email, "picture": picture})
    return RedirectResponse(f"{_FRONTEND_URL}{landing}?prefill_code={code}&mode={mode}")


# ── One-time code exchange — frontend POSTs this to get actual tokens ─────────

@router.post("/exchange")
def exchange_social_code(code: str):
    tokens = _consume_temp_tokens(code)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_code",
        )
    return tokens


@router.get("/prefill")
def get_social_prefill(code: str):
    payload = _temp_pop(code)
    if payload is None or payload.get("type") != "prefill":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_or_expired_code",
        )
    return {"name": payload.get("name", ""), "email": payload.get("email", ""), "picture": payload.get("picture", "")}


# ── Provider status (read-only, no auth required) ────────────────────────────

@router.get("/providers")
def get_social_providers():
    """Hangi sosyal giriş sağlayıcılarının yapılandırıldığını döner."""
    return {
        "google": bool(_GOOGLE_CLIENT_ID),
        "linkedin": bool(_LINKEDIN_CLIENT_ID),
    }


# ── Google ────────────────────────────────────────────────────────────────────

@router.get("/google/start")
def google_start(mode: str = "login"):
    if not _GOOGLE_CLIENT_ID:
        return _callback_error("not_configured")
    state = _encode_state(_sanitize_mode(mode))
    params = "&".join([
        f"client_id={_GOOGLE_CLIENT_ID}",
        f"redirect_uri={urllib.parse.quote(_google_redirect_uri(), safe='')}",
        "response_type=code",
        "scope=openid%20email%20profile",
        "access_type=offline",
        f"state={state}",
    ])
    return RedirectResponse(f"{_GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
def google_callback(
    code: str = "",
    error: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    if error or not code:
        return _callback_error("access_denied")
    if not _GOOGLE_CLIENT_ID:
        return _callback_error("not_configured")

    state_data = _decode_state(state)
    mode = _sanitize_mode(state_data.get("mode", "login"))

    try:
        with httpx.Client(timeout=10.0) as client:
            token_res = client.post(_GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": _GOOGLE_CLIENT_ID,
                "client_secret": _GOOGLE_CLIENT_SECRET,
                "redirect_uri": _google_redirect_uri(),
                "grant_type": "authorization_code",
            })
            access_token = token_res.json().get("access_token")
            if not access_token:
                return _callback_error("token_failed")

            info = client.get(
                _GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            ).json()

        google_id = str(info.get("id", ""))
        email = info.get("email", "")
        if not email or not google_id:
            return _callback_error("invalid_profile")

        given_name = info.get("given_name", "")
        family_name = info.get("family_name", "")
        full_name = info.get("name", "") or f"{given_name} {family_name}".strip()
        picture = info.get("picture", "")

        if mode in _B2B_PREVIEW_MODES:
            return _b2b_prefill_redirect(mode, full_name, email, picture)

        system_role = "employer_recruiter" if mode == "employer" else "candidate_user"
        user, is_new = _find_or_create_social_user(
            db,
            id_field="google_id",
            provider_id=google_id,
            email=email,
            full_name=full_name,
            photo=picture,
            system_role=system_role,
        )
        tokens = _create_session(db, user)
        code = _store_temp_tokens(tokens)
        extra = f"&new_user=1&mode={mode}" if is_new else ""
        return RedirectResponse(
            f"{_FRONTEND_URL}/auth/social/callback?code={code}{extra}"
        )
    except Exception:
        return _callback_error("server_error")


# ── LinkedIn ──────────────────────────────────────────────────────────────────

@router.get("/linkedin/start")
def linkedin_start(mode: str = "login"):
    if not _LINKEDIN_CLIENT_ID:
        return _callback_error("not_configured")
    state = _encode_state(_sanitize_mode(mode))
    params = "&".join([
        "response_type=code",
        f"client_id={_LINKEDIN_CLIENT_ID}",
        f"redirect_uri={urllib.parse.quote(_linkedin_redirect_uri(), safe='')}",
        "scope=openid%20profile%20email",
        f"state={state}",
    ])
    return RedirectResponse(f"{_LINKEDIN_AUTH_URL}?{params}")


@router.get("/linkedin/callback")
def linkedin_callback(
    code: str = "",
    error: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    if error or not code:
        return _callback_error("access_denied")
    if not _LINKEDIN_CLIENT_ID:
        return _callback_error("not_configured")

    state_data = _decode_state(state)
    mode = _sanitize_mode(state_data.get("mode", "login"))

    try:
        with httpx.Client(timeout=10.0) as client:
            token_res = client.post(
                _LINKEDIN_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": _linkedin_redirect_uri(),
                    "client_id": _LINKEDIN_CLIENT_ID,
                    "client_secret": _LINKEDIN_CLIENT_SECRET,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            access_token = token_res.json().get("access_token")
            if not access_token:
                return _callback_error("token_failed")

            info = client.get(
                _LINKEDIN_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            ).json()

        linkedin_id = str(info.get("sub", ""))
        email = info.get("email", "")
        if not email or not linkedin_id:
            return _callback_error("invalid_profile")

        given_name = info.get("given_name", "")
        family_name = info.get("family_name", "")
        full_name = info.get("name", "") or f"{given_name} {family_name}".strip()
        picture = info.get("picture", "")

        if mode in _B2B_PREVIEW_MODES:
            return _b2b_prefill_redirect(mode, full_name, email, picture)

        system_role = "employer_recruiter" if mode == "employer" else "candidate_user"
        user, is_new = _find_or_create_social_user(
            db,
            id_field="linkedin_id",
            provider_id=linkedin_id,
            email=email,
            full_name=full_name,
            photo=picture,
            system_role=system_role,
        )
        tokens = _create_session(db, user)
        code = _store_temp_tokens(tokens)
        extra = f"&new_user=1&mode={mode}" if is_new else ""
        return RedirectResponse(
            f"{_FRONTEND_URL}/auth/social/callback?code={code}{extra}"
        )
    except Exception:
        return _callback_error("server_error")
