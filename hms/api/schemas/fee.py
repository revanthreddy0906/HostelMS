from datetime import date

from pydantic import BaseModel, ConfigDict


class FeeStructureRequest(BaseModel):
    roomtype: str
    amount: float
    semester: str


class GenerateFeesRequest(BaseModel):
    semester: str
    duedate: date


class PayFeeRequest(BaseModel):
    amount: float


class FeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    feeid: int
    studentid: int
    amountdue: float
    amountpaid: float
    duedate: date
    paymentstatus: str
    txnreference: str | None = None
