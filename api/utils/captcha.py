import os
import httpx

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(token: str | None) -> bool:
    secret_key = os.getenv("TURNSTILE_SECRET_KEY", "")
    if not secret_key:
        return True  # dev mode — no key configured, skip verification
    if not token:
        return False
    try:
        response = httpx.post(
            TURNSTILE_VERIFY_URL,
            data={"secret": secret_key, "response": token},
            timeout=5.0,
        )
        result = response.json()
        return bool(result.get("success", False))
    except Exception:
        return False
