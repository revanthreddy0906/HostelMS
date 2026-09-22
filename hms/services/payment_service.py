"""
Mocked payment gateway service.

No real payment gateway credentials (Razorpay/Stripe/etc.) are available in
this environment, so this service simulates a successful synchronous charge
and returns a fake transaction reference. Real integration only requires
swapping this class behind the same interface.
"""
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PaymentResult:
    success: bool
    txn_reference: str
    message: str


class PaymentGatewayService(ABC):
    @abstractmethod
    def charge(self, amount: float, payer_reference: str) -> PaymentResult:
        ...


class MockPaymentGatewayService(PaymentGatewayService):
    def charge(self, amount: float, payer_reference: str) -> PaymentResult:
        if amount <= 0:
            return PaymentResult(success=False, txn_reference="", message="Invalid amount")
        txn_reference = f"MOCK-{uuid.uuid4().hex[:12].upper()}"
        print(f"[MOCK PAYMENT] Charged {amount:.2f} for {payer_reference}: {txn_reference}")
        return PaymentResult(success=True, txn_reference=txn_reference, message="Payment successful (mocked)")


default_payment_service: PaymentGatewayService = MockPaymentGatewayService()
