"""Payment API router — çoklu sağlayıcı ödeme başlatma ve webhook."""

from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    UploadFile,
    File,
    Form,
    status,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.core.time import utcnow
from api.database import get_db
from api.models.payment import PaymentTransaction, PaymentWebhookEvent
from api.models.tenant import Tenant
from api.services.payment import (
    BankTransferAdapter,
    IyzicoAdapter,
    ParamAdapter,
    PayTRAdapter,
    PaymentRequest,
    SipayAdapter,
)
from api.services.payment.provider_settings_service import list_public_active_providers
from api.services.payment.provider_settings_service import (
    get_provider_credentials_for_runtime,
)
from api.services.onboarding_saas_service import activate_premium_features_for_payment
from api.services.subscription_service import activate_subscription_addons_for_payment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payment", tags=["payment"])


def _append_onboarding_timeline_for_payment(
    db: Session,
    transaction_id: int,
    *,
    action: str,
    note: str | None = None,
):
    tenant = (
        db.query(Tenant)
        .filter(Tenant.onboarding_payment_reference_id == transaction_id)
        .first()
    )
    if not tenant:
        return

    items: list[dict] = []
    raw_timeline = getattr(tenant, "onboarding_decision_timeline_json", None)
    if raw_timeline:
        try:
            parsed = json.loads(raw_timeline)
            if isinstance(parsed, list):
                items = [item for item in parsed if isinstance(item, dict)]
        except (TypeError, ValueError):
            items = []

    items.append(
        {
            "action": action,
            "actor_name": "Basvuru Sahibi",
            "actor_type": "applicant",
            "note": note,
            "at": utcnow().isoformat(),
        }
    )
    tenant.onboarding_decision_timeline_json = json.dumps(items[-20:])
    db.add(tenant)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class InitiatePaymentRequest(BaseModel):
    tenant_id: int | None = None
    provider: str  # iyzico | paytr | sipay | bank_transfer | paypal
    amount: Decimal
    currency: str = "TRY"
    description: str
    buyer_email: str
    buyer_name: str
    transaction_type: str = "subscription"
    reference_id: int | None = None
    reference_type: str | None = None
    extra: dict | None = None


# ---------------------------------------------------------------------------
# Sağlayıcı fabrika
# ---------------------------------------------------------------------------


def _get_adapter(provider: str, db: Session):
    normalized = provider.strip().lower()
    credentials = get_provider_credentials_for_runtime(db, normalized)
    if normalized == "iyzico":
        return IyzicoAdapter(credentials=credentials)
    if normalized == "paytr":
        return PayTRAdapter(credentials=credentials)
    if normalized in {"param", "parampos"}:
        return ParamAdapter(credentials=credentials)
    if normalized == "sipay":
        return SipayAdapter(credentials=credentials)
    if normalized in {"havale", "eft", "bank_transfer"}:
        return BankTransferAdapter(credentials=credentials)
    raise HTTPException(
        status_code=400,
        detail=f"'{provider}' sağlayıcısı henüz desteklenmiyor. Desteklenenler: iyzico, paytr, param, sipay, bank_transfer",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/providers")
def get_payment_providers(db: Session = Depends(get_db)):
    return {"providers": list_public_active_providers(db)}


@router.get("/bank-transfer-instructions")
def get_bank_transfer_instructions(db: Session = Depends(get_db)):
    adapter = _get_adapter("bank_transfer", db)
    if not isinstance(adapter, BankTransferAdapter):
        raise HTTPException(
            status_code=400, detail="Banka havalesi ayarlari bulunamadi"
        )
    preview = adapter.initiate_payment(
        PaymentRequest(
            amount=Decimal("0"),
            currency="TRY",
            description="preview",
            buyer_email="preview@procureflow.local",
            buyer_name="Preview",
            extra={"transfer_reference": "Odeme baslatildiginda olusur"},
        )
    )
    return {"instructions": (preview.raw_response or {}).get("instructions")}


@router.post("/initiate", status_code=status.HTTP_201_CREATED)
def initiate_payment(payload: InitiatePaymentRequest, db: Session = Depends(get_db)):
    normalized_provider = payload.provider.strip().lower()
    canonical_provider = {
        "parampos": "param",
        "havale": "bank_transfer",
        "eft": "bank_transfer",
    }.get(normalized_provider, normalized_provider)
    active_codes = {row["code"] for row in list_public_active_providers(db)}
    if canonical_provider not in active_codes:
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.provider}' pasif durumda veya odeme ekranina acik degil",
        )

    adapter = _get_adapter(payload.provider, db)

    req = PaymentRequest(
        amount=payload.amount,
        currency=payload.currency,
        description=payload.description,
        buyer_email=payload.buyer_email,
        buyer_name=payload.buyer_name,
        extra=payload.extra,
    )
    result = adapter.initiate_payment(req)

    # İşlem kaydını oluştur
    provider_response_payload = {
        "provider_result": result.raw_response,
        "request_context": {
            "provider": payload.provider,
            "transaction_type": payload.transaction_type,
            "reference_id": payload.reference_id,
            "reference_type": payload.reference_type,
            "extra": payload.extra,
        },
    }

    txn = PaymentTransaction(
        tenant_id=payload.tenant_id,
        transaction_type=payload.transaction_type,
        reference_id=payload.reference_id,
        reference_type=payload.reference_type,
        provider=payload.provider,
        provider_transaction_id=result.provider_transaction_id,
        amount=payload.amount,
        currency=payload.currency,
        status="processing" if result.success else "failed",
        failure_reason=result.error_message,
        provider_response_raw=json.dumps(provider_response_payload),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    if not result.success:
        raise HTTPException(
            status_code=402, detail=result.error_message or "Ödeme başlatılamadı."
        )

    return {
        "transaction_id": txn.id,
        "provider": payload.provider,
        "redirect_url": result.redirect_url,
        "provider_transaction_id": result.provider_transaction_id,
        "instructions": (result.raw_response or {}).get("instructions"),
    }


@router.post("/webhook/{provider}")
async def payment_webhook(
    provider: str, request: Request, db: Session = Depends(get_db)
):
    """Sağlayıcıdan gelen webhook bildirimlerini alır ve kaydeder."""
    body = await request.body()
    headers = dict(request.headers)

    try:
        payload_dict = json.loads(body)
    except json.JSONDecodeError:
        payload_dict = {}

    adapter = _get_adapter(provider, db)
    sig_valid = adapter.verify_webhook(headers, body)

    event = PaymentWebhookEvent(
        provider=provider,
        payload_raw=body.decode("utf-8", errors="replace"),
        signature_valid=sig_valid,
        processed=False,
    )
    db.add(event)
    db.flush()

    if sig_valid:
        result = adapter.handle_webhook(payload_dict)
        event.event_type = result.get("status")
        event.processed = True

        # İlgili işlemi güncelle
        txn_pid = result.get("provider_transaction_id")
        if txn_pid:
            txn = (
                db.query(PaymentTransaction)
                .filter(PaymentTransaction.provider_transaction_id == txn_pid)
                .first()
            )
            if txn:
                event.linked_transaction_id = txn.id
                if txn.status == "succeeded":
                    # Idempotency: already processed, skip re-activation
                    logger.info(
                        "Webhook for provider_transaction_id=%s skipped — already succeeded",
                        txn_pid,
                    )
                    event.event_type = "duplicate_ignored"
                else:
                    txn.status = (
                        "succeeded" if result.get("status") == "success" else "failed"
                    )
                    txn.completed_at = utcnow()
                    if txn.status == "succeeded":
                        activate_premium_features_for_payment(db, txn)
                        activate_subscription_addons_for_payment(db, txn)
                        _append_onboarding_timeline_for_payment(
                            db,
                            txn.id,
                            action="payment_succeeded",
                            note="Odeme basariyla tamamlandi",
                        )

    db.commit()
    return {"received": True}


@router.get("/transactions/{txn_id}")
def get_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.get(PaymentTransaction, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="İşlem bulunamadı.")
    return {
        "id": txn.id,
        "provider": txn.provider,
        "amount": str(txn.amount),
        "currency": txn.currency,
        "status": txn.status,
        "receipt_file_url": txn.receipt_file_url,
        "receipt_original_filename": txn.receipt_original_filename,
        "buyer_note": txn.buyer_note,
        "created_at": txn.created_at,
    }


@router.post("/transactions/{txn_id}/receipt")
async def upload_payment_receipt(
    txn_id: int,
    file: UploadFile = File(...),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
):
    txn = db.get(PaymentTransaction, txn_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Odeme islemi bulunamadi")

    upload_dir = Path("uploads") / "onboarding_receipts"
    upload_dir.mkdir(parents=True, exist_ok=True)
    original_filename = (file.filename or "receipt.bin").strip() or "receipt.bin"
    safe_filename = f"txn-{txn.id}-{original_filename.replace(' ', '_')}"
    file_path = upload_dir / safe_filename
    content = await file.read()
    file_path.write_bytes(content)

    previous_receipt_url = txn.receipt_file_url
    txn.receipt_file_url = f"/uploads/onboarding_receipts/{safe_filename}"
    txn.receipt_original_filename = original_filename
    txn.buyer_note = (note or "").strip() or txn.buyer_note
    txn.submitted_at = utcnow()
    if str(txn.status or "").lower() == "processing":
        txn.status = "processing"
    db.add(txn)
    _append_onboarding_timeline_for_payment(
        db,
        txn.id,
        action="receipt_resubmitted" if previous_receipt_url else "receipt_uploaded",
        note=(note or "").strip() or None,
    )
    db.commit()
    db.refresh(txn)

    return {
        "transaction_id": txn.id,
        "status": txn.status,
        "receipt_file_url": txn.receipt_file_url,
        "receipt_original_filename": txn.receipt_original_filename,
        "buyer_note": txn.buyer_note,
    }
