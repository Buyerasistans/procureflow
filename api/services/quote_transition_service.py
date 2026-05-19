from collections.abc import Iterable

from api.app.domain.quote.enums import (
    QuoteStatus as DomainQuoteStatus,
    parse_quote_status,
)
from api.app.domain.quote.permissions import QuotePermission
from api.app.domain.quote.policy import ensure_transition
from api.models.quote import QuoteStatus


_SUBMITTED_LIKE_STATUSES = {QuoteStatus.PENDING, QuoteStatus.RESPONDED}


def to_domain_quote_status(status_value: QuoteStatus | str) -> DomainQuoteStatus:
    if (
        isinstance(status_value, QuoteStatus)
        and status_value in _SUBMITTED_LIKE_STATUSES
    ):
        return DomainQuoteStatus.SUBMITTED

    raw_value = (
        status_value.value
        if isinstance(status_value, QuoteStatus)
        else str(status_value)
    )
    return parse_quote_status(raw_value)


def ensure_model_quote_transition(
    current: QuoteStatus,
    target: QuoteStatus,
    actor_permissions: Iterable[QuotePermission],
    reason: str | None = None,
) -> None:
    ensure_transition(
        current=to_domain_quote_status(current),
        target=to_domain_quote_status(target),
        actor_permissions=actor_permissions,
        reason=reason,
    )
