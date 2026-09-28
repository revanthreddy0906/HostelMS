from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class GenerateRentRequest(BaseModel):
    period: str  # YYYY-MM


class PayFeeRequest(BaseModel):
    amount: float


class FeeOut(BaseModel):
    feeid: int
    studentid: int
    billtype: str
    period: str | None = None
    amountdue: float
    amountpaid: float
    duedate: date
    paymentstatus: str
    txnreference: str | None = None
    latefine: float
    latedays: int | None = None
    totalpayable: float
    balance: float
    paidon: date | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    paymentid: int
    feeid: int
    amount: float
    paidat: datetime
    method: str
    txnreference: str | None = None


class FinanceSummary(BaseModel):
    outstanding: dict[str, float]
    overdue_bills: int
    collected_this_month: float


class SettingsOut(BaseModel):
    values: dict[str, str]


class SettingsUpdate(BaseModel):
    values: dict[str, float]
