"""Abstract adapter — tüm ödeme sağlayıcıları bu arayüzü uygular."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class PaymentRequest:
    amount: Decimal
    currency: str
    description: str
    buyer_email: str
    buyer_name: str
    # Sağlayıcıya özgü ek alanlar için
    extra: dict | None = None


@dataclass
class PaymentResult:
    success: bool
    provider: str
    provider_transaction_id: str | None
    redirect_url: str | None  # Kart ödemelerinde yönlendirme adresi
    raw_response: dict
    error_message: str | None = None


class BasePaymentAdapter(ABC):
    provider_name: str

    @abstractmethod
    def initiate_payment(self, request: PaymentRequest) -> PaymentResult:
        """Ödeme başlatır. Kart sağlayıcılar redirect_url döner."""
        ...

    @abstractmethod
    def verify_webhook(self, headers: dict, body: bytes) -> bool:
        """Webhook imzasını doğrular."""
        ...

    @abstractmethod
    def handle_webhook(self, payload: dict) -> dict:
        """Webhook payload'ını işler, işlem durumunu döner."""
        ...
