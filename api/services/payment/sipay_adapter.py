from __future__ import annotations

import os

from api.services.payment.base import BasePaymentAdapter, PaymentRequest, PaymentResult


class SipayAdapter(BasePaymentAdapter):
    provider_name = "sipay"

    def __init__(self, credentials: dict[str, str] | None = None) -> None:
        credentials = credentials or {}
        self.api_key = credentials.get("api_key") or os.getenv("SIPAY_API_KEY", "")
        self.api_secret = credentials.get("api_secret") or os.getenv(
            "SIPAY_API_SECRET", ""
        )

    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        if not self.api_key or not self.api_secret:
            return PaymentResult(
                success=False,
                provider=self.provider_name,
                provider_transaction_id=None,
                redirect_url=None,
                raw_response={},
                error_message="Sipay kimlik bilgileri eksik. SIPAY_API_KEY ve SIPAY_API_SECRET gerekli.",
            )
        return PaymentResult(
            success=False,
            provider=self.provider_name,
            provider_transaction_id=None,
            redirect_url=None,
            raw_response={},
            error_message="Sipay adapter iskeleti hazir; odeme oturumu entegrasyonu sonraki adimda tamamlanacak.",
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        return bool(self.api_key and self.api_secret)

    def handle_webhook(self, payload: dict) -> dict:
        return {
            "status": "failed",
            "provider": self.provider_name,
            "provider_transaction_id": payload.get("transaction_id"),
            "raw": payload,
        }
