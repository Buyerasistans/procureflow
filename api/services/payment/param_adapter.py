from __future__ import annotations

import os

from api.services.payment.base import BasePaymentAdapter, PaymentRequest, PaymentResult


class ParamAdapter(BasePaymentAdapter):
    provider_name = "param"

    def __init__(self, credentials: dict[str, str] | None = None) -> None:
        credentials = credentials or {}
        self.client_code = credentials.get("client_code") or os.getenv(
            "PARAM_CLIENT_CODE", ""
        )
        self.username = credentials.get("username") or os.getenv("PARAM_USERNAME", "")
        self.guid = credentials.get("guid") or os.getenv("PARAM_GUID", "")

    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        if not all([self.client_code, self.username, self.guid]):
            return PaymentResult(
                success=False,
                provider=self.provider_name,
                provider_transaction_id=None,
                redirect_url=None,
                raw_response={},
                error_message="ParamPOS kimlik bilgileri eksik. PARAM_CLIENT_CODE / USERNAME / GUID gerekli.",
            )
        return PaymentResult(
            success=False,
            provider=self.provider_name,
            provider_transaction_id=None,
            redirect_url=None,
            raw_response={},
            error_message="ParamPOS adapter iskeleti hazir; SOAP/REST odeme oturumu sonraki adimda tamamlanacak.",
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        return bool(self.client_code and self.username and self.guid)

    def handle_webhook(self, payload: dict) -> dict:
        return {
            "status": "failed",
            "provider": self.provider_name,
            "provider_transaction_id": payload.get("dekont_id")
            or payload.get("islem_id"),
            "raw": payload,
        }
