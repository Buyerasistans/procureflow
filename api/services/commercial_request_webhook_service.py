from __future__ import annotations

import json
import logging
import os
from urllib import request as urllib_request
from urllib.error import URLError, HTTPError

from sqlalchemy.orm import Session

from api.core.time import utcnow
from api.models.payment import CommercialRequest, CommercialRequestWebhookDelivery
from api.services.system_settings_runtime import get_or_create_system_settings

logger = logging.getLogger(__name__)


def _build_payload(commercial_request: CommercialRequest, *, event_type: str) -> dict:
    return {
        "event_type": event_type,
        "request": {
            "id": commercial_request.id,
            "tenant_id": commercial_request.tenant_id,
            "request_type": commercial_request.request_type,
            "audience": commercial_request.audience,
            "status": commercial_request.status,
            "source_surface": commercial_request.source_surface,
            "package_code": commercial_request.package_code,
            "package_name": commercial_request.package_name,
            "addon_code": commercial_request.addon_code,
            "addon_name": commercial_request.addon_name,
            "requester_name": commercial_request.requester_name,
            "requester_email": commercial_request.requester_email,
            "company_name": commercial_request.company_name,
            "phone": commercial_request.phone,
            "owner_name": commercial_request.owner_name,
            "last_contacted_at": commercial_request.last_contacted_at.isoformat()
            if commercial_request.last_contacted_at
            else None,
            "notes": commercial_request.notes,
            "review_note": commercial_request.review_note,
            "created_at": commercial_request.created_at.isoformat()
            if commercial_request.created_at
            else None,
            "updated_at": commercial_request.updated_at.isoformat()
            if commercial_request.updated_at
            else None,
        },
    }


def _send_webhook_request(
    *,
    target_url: str,
    shared_secret: str,
    payload: dict,
) -> tuple[str, int | None, str | None, str | None]:
    body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "ProcureFlow-CommercialRequest-Webhook/1.0",
    }
    if shared_secret:
        headers["X-Webhook-Secret"] = shared_secret

    outbound_request = urllib_request.Request(
        target_url,
        data=body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib_request.urlopen(outbound_request, timeout=5) as response:
            status_code = int(getattr(response, "status", 200))
            response_body = response.read().decode("utf-8", errors="replace") or None
            if status_code >= 300:
                return ("failed", status_code, f"HTTP {status_code}", response_body)
            return ("delivered", status_code, None, response_body)
    except HTTPError as exc:
        error_body = None
        try:
            error_body = exc.read().decode("utf-8", errors="replace") or None
        except Exception:
            error_body = None
        return ("failed", exc.code, str(exc), error_body)
    except (URLError, TimeoutError) as exc:
        return ("failed", None, str(exc), None)


def dispatch_commercial_request_event(
    db: Session,
    commercial_request: CommercialRequest,
    *,
    event_type: str,
) -> CommercialRequestWebhookDelivery | None:
    settings = get_or_create_system_settings(db)
    target_url = (
        str(getattr(settings, "commercial_request_webhook_url", "") or "").strip()
        or os.getenv("COMMERCIAL_REQUEST_WEBHOOK_URL", "").strip()
    )
    if not target_url:
        return None

    shared_secret = (
        str(getattr(settings, "commercial_request_webhook_secret", "") or "").strip()
        or os.getenv("COMMERCIAL_REQUEST_WEBHOOK_SECRET", "").strip()
    )

    payload = _build_payload(commercial_request, event_type=event_type)
    delivery = CommercialRequestWebhookDelivery(
        commercial_request_id=commercial_request.id,
        event_type=event_type,
        target_url=target_url,
        delivery_status="pending",
        payload_raw=json.dumps(payload, ensure_ascii=True),
        attempt_count=1,
        last_attempted_at=utcnow(),
    )
    delivery_status, http_status_code, error_message, response_body = (
        _send_webhook_request(
            target_url=target_url,
            shared_secret=shared_secret,
            payload=payload,
        )
    )
    delivery.delivery_status = delivery_status
    delivery.http_status_code = http_status_code
    delivery.error_message = error_message
    delivery.response_body = response_body
    if delivery_status == "delivered":
        delivery.delivered_at = utcnow()
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    if delivery_status != "delivered":
        logger.warning(
            "Commercial request webhook delivery failed: %s",
            error_message,
            extra={"commercial_request_id": commercial_request.id, "url": target_url},
        )
    return delivery


def retry_commercial_request_webhook_delivery(
    db: Session,
    delivery: CommercialRequestWebhookDelivery,
) -> CommercialRequestWebhookDelivery:
    commercial_request = delivery.commercial_request
    if commercial_request is None:
        raise ValueError("Linked commercial request not found")

    settings = get_or_create_system_settings(db)
    target_url = (
        str(getattr(settings, "commercial_request_webhook_url", "") or "").strip()
        or str(delivery.target_url or "").strip()
    )
    if not target_url:
        raise ValueError("Webhook URL not configured")

    shared_secret = (
        str(getattr(settings, "commercial_request_webhook_secret", "") or "").strip()
        or os.getenv("COMMERCIAL_REQUEST_WEBHOOK_SECRET", "").strip()
    )
    payload = _build_payload(commercial_request, event_type=delivery.event_type)
    delivery.target_url = target_url
    delivery.payload_raw = json.dumps(payload, ensure_ascii=True)
    delivery.attempt_count = int(delivery.attempt_count or 0) + 1
    delivery.last_attempted_at = utcnow()
    delivery_status, http_status_code, error_message, response_body = (
        _send_webhook_request(
            target_url=target_url,
            shared_secret=shared_secret,
            payload=payload,
        )
    )
    delivery.delivery_status = delivery_status
    delivery.http_status_code = http_status_code
    delivery.error_message = error_message
    delivery.response_body = response_body
    if delivery_status == "delivered":
        delivery.delivered_at = utcnow()
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    return delivery
