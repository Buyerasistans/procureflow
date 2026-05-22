"""
Iyzico ödeme adaptörü.

Kurulum: pip install iyzipay
API belgeleri: https://dev.iyzipay.com/tr

Ortam değişkenleri:
  IYZICO_API_KEY     — Iyzico panel API anahtarı
  IYZICO_SECRET_KEY  — Iyzico panel gizli anahtar
  IYZICO_BASE_URL    — https://sandbox.iyzipay.com (test) veya
                       https://api.iyzipay.com (prod)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from decimal import Decimal

from api.services.payment.base import BasePaymentAdapter, PaymentRequest, PaymentResult

logger = logging.getLogger(__name__)


class IyzicoAdapter(BasePaymentAdapter):
    provider_name = "iyzico"

    def __init__(self, credentials: dict[str, str] | None = None) -> None:
        credentials = credentials or {}
        self.api_key = credentials.get("api_key") or os.getenv("IYZICO_API_KEY", "")
        self.secret_key = credentials.get("secret_key") or os.getenv(
            "IYZICO_SECRET_KEY", ""
        )
        self.base_url = credentials.get("base_url") or os.getenv(
            "IYZICO_BASE_URL", "https://sandbox.iyzipay.com"
        )

        if not self.api_key or not self.secret_key:
            logger.warning(
                "Iyzico kimlik bilgileri eksik. "
                "IYZICO_API_KEY ve IYZICO_SECRET_KEY ortam değişkenlerini ayarlayın."
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """
        Iyzico CheckoutFormInitialize çağrısı yapar.
        Gerçek entegrasyon için iyzipay paketi kurulmalı ve
        buyer/billing_address/basket_items alanları tamamlanmalıdır.
        """
        try:
            import iyzipay  # type: ignore[import]
        except ImportError:
            return PaymentResult(
                success=False,
                provider=self.provider_name,
                provider_transaction_id=None,
                redirect_url=None,
                raw_response={},
                error_message="iyzipay paketi kurulu değil. `pip install iyzipay` çalıştırın.",
            )

        options = {
            "api_key": self.api_key,
            "secret_key": self.secret_key,
            "base_url": self.base_url,
        }

        extra = request.extra or {}
        request_payload = {
            "locale": extra.get("locale", "tr"),
            "conversationId": extra.get("conversation_id", ""),
            "price": str(request.amount),
            "paidPrice": str(request.amount),
            "currency": request.currency,
            "basketId": extra.get("basket_id", ""),
            "paymentGroup": extra.get("payment_group", "PRODUCT"),
            "callbackUrl": extra.get("callback_url", ""),
            "enabledInstallments": extra.get("enabled_installments", [2, 3, 6, 9]),
            "buyer": extra.get(
                "buyer",
                {
                    "id": "USER_ID",
                    "name": request.buyer_name.split()[0] if request.buyer_name else "",
                    "surname": " ".join(request.buyer_name.split()[1:])
                    if request.buyer_name
                    else "",
                    "gsmNumber": extra.get("buyer_phone", ""),
                    "email": request.buyer_email,
                    "identityNumber": extra.get("identity_number", "11111111111"),
                    "registrationAddress": extra.get("address", request.description),
                    "ip": extra.get("ip", ""),
                    "city": extra.get("city", ""),
                    "country": extra.get("country", "Turkey"),
                },
            ),
            "shippingAddress": extra.get(
                "shipping_address",
                {
                    "contactName": request.buyer_name,
                    "city": extra.get("city", ""),
                    "country": extra.get("country", "Turkey"),
                    "address": extra.get("address", ""),
                },
            ),
            "billingAddress": extra.get(
                "billing_address",
                {
                    "contactName": request.buyer_name,
                    "city": extra.get("city", ""),
                    "country": extra.get("country", "Turkey"),
                    "address": extra.get("address", ""),
                },
            ),
            "basketItems": extra.get(
                "basket_items",
                [
                    {
                        "id": "ITEM_ID",
                        "name": request.description,
                        "category1": "Abonelik",
                        "itemType": "VIRTUAL",
                        "price": str(request.amount),
                    }
                ],
            ),
        }

        response = iyzipay.CheckoutFormInitialize().create(request_payload, options)
        result_raw: dict = json.loads(response.read().decode("utf-8"))

        if result_raw.get("status") == "success":
            return PaymentResult(
                success=True,
                provider=self.provider_name,
                provider_transaction_id=result_raw.get("token"),
                redirect_url=result_raw.get("paymentPageUrl"),
                raw_response=result_raw,
            )
        else:
            return PaymentResult(
                success=False,
                provider=self.provider_name,
                provider_transaction_id=None,
                redirect_url=None,
                raw_response=result_raw,
                error_message=result_raw.get("errorMessage", "Iyzico hatası"),
            )

    # ------------------------------------------------------------------
    # Webhook
    # ------------------------------------------------------------------

    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        """
        Iyzico, webhook için standart HMAC imzası kullanmaz.
        Gelen token ve checkoutForm retrieve ile doğrulama yapılır.
        Bu metot şimdilik True döner; callback endpoint'inde
        token retrieve ile zaten doğrulama yapılmaktadır.
        """
        return True

    def handle_webhook(self, payload: dict) -> dict:
        """
        Iyzico callback payload'ını işler.
        payload["token"] ile CheckoutFormRetrieve çağrısı yapılmalıdır.
        """
        token = payload.get("token", "")
        if not token:
            return {"status": "error", "message": "token eksik"}

        try:
            import iyzipay  # type: ignore[import]
        except ImportError:
            return {"status": "error", "message": "iyzipay paketi kurulu değil"}

        options = {
            "api_key": self.api_key,
            "secret_key": self.secret_key,
            "base_url": self.base_url,
        }
        retrieve_request = {"locale": "tr", "token": token}
        response = iyzipay.CheckoutForm().retrieve(retrieve_request, options)
        result_raw: dict = json.loads(response.read().decode("utf-8"))

        payment_status = result_raw.get("paymentStatus", "")
        return {
            "status": "success" if payment_status == "SUCCESS" else "failed",
            "provider": self.provider_name,
            "provider_transaction_id": token,
            "raw": result_raw,
        }
