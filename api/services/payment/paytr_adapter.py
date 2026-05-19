from __future__ import annotations

import os

from api.services.payment.base import BasePaymentAdapter, PaymentRequest, PaymentResult


class PayTRAdapter(BasePaymentAdapter):
    provider_name = "paytr"

    def __init__(self, credentials: dict[str, str] | None = None) -> None:
        credentials = credentials or {}
        self.merchant_id = credentials.get("merchant_id") or os.getenv(
            "PAYTR_MERCHANT_ID", ""
        )
        self.merchant_key = credentials.get("merchant_key") or os.getenv(
            "PAYTR_MERCHANT_KEY", ""
        )
        self.merchant_salt = credentials.get("merchant_salt") or os.getenv(
            "PAYTR_MERCHANT_SALT", ""
        )

    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        if not all([self.merchant_id, self.merchant_key, self.merchant_salt]):
            return PaymentResult(
                success=False,
                provider=self.provider_name,
                provider_transaction_id=None,
                redirect_url=None,
                raw_response={},
                error_message="PayTR kimlik bilgileri eksik. PAYTR_MERCHANT_ID / KEY / SALT gerekli.",
            )
        return PaymentResult(
            success=False,
            provider=self.provider_name,
            provider_transaction_id=None,
            redirect_url=None,
            raw_response={},
            error_message="PayTR adapter iskeleti hazir; token olusturma entegrasyonu sonraki adimda tamamlanacak.",
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        return bool(self.merchant_key and self.merchant_salt)

    def handle_webhook(self, payload: dict) -> dict:
        return {
            "status": "failed",
            "provider": self.provider_name,
            "provider_transaction_id": payload.get("merchant_oid"),
            "raw": payload,
        }
