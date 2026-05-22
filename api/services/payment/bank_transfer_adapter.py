from __future__ import annotations

from api.services.payment.base import BasePaymentAdapter, PaymentRequest, PaymentResult


class BankTransferAdapter(BasePaymentAdapter):
    provider_name = "bank_transfer"

    def __init__(self, credentials: dict[str, str] | None = None) -> None:
        self.credentials = credentials or {}

    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        instructions = {
            "bank_name": self.credentials.get("bank_name") or "Demo Tahsilat Hesabi",
            "iban": self.credentials.get("iban") or "TR00 0000 0000 0000 0000 0000 00",
            "account_name": self.credentials.get("account_name") or "",
            "reference": (request.extra or {}).get(
                "transfer_reference", "MANUAL-TRANSFER"
            ),
            "amount": str(request.amount),
            "currency": request.currency,
        }
        return PaymentResult(
            success=True,
            provider=self.provider_name,
            provider_transaction_id=instructions["reference"],
            redirect_url=None,
            raw_response={"instructions": instructions},
        )

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        return True

    def handle_webhook(self, payload: dict) -> dict:
        return {
            "status": "success",
            "provider": self.provider_name,
            "provider_transaction_id": payload.get("reference"),
            "raw": payload,
        }
