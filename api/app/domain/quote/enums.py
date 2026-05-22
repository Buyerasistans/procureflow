# api\app\domain\quote\enums.py
from enum import StrEnum


class QuoteStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


_LEGACY_STATUS_ALIASES: dict[str, str] = {
    "sent": QuoteStatus.SUBMITTED.value,
}


def parse_quote_status(value: QuoteStatus | str) -> QuoteStatus:
    raw = value.value if isinstance(value, QuoteStatus) else str(value).strip().lower()
    # Handle malformed input like "quotestatus.submitted" or "QuoteStatus.SUBMITTED"
    if "." in raw:
        raw = raw.split(".")[-1]
    normalized = _LEGACY_STATUS_ALIASES.get(raw, raw)
    try:
        return QuoteStatus(normalized)
    except ValueError:
        # Fallback to DRAFT if value cannot be parsed
        return QuoteStatus.DRAFT


def to_public_quote_status(value: QuoteStatus | str) -> str:
    return parse_quote_status(value).value


def to_turkish_quote_status(value: QuoteStatus | str) -> str:
    """Convert quote status to Turkish display name"""
    status = parse_quote_status(value)
    mapping = {
        QuoteStatus.DRAFT: "Taslak",
        QuoteStatus.SUBMITTED: "Gönderildi",
        QuoteStatus.APPROVED: "Onaylandı",
        QuoteStatus.REJECTED: "Reddedildi",
    }
    return mapping.get(status, status.value)
