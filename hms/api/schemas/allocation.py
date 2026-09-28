from datetime import date

from pydantic import BaseModel, ConfigDict


class AutoAllocateRequest(BaseModel):
    studentid: int
    alloc_date: date | None = None


class ManualAllocateRequest(BaseModel):
    studentid: int
    roomid: int
    bedid: int | None = None
    alloc_date: date | None = None


class ChangeRoomRequest(BaseModel):
    studentid: int
    new_roomid: int
    bedid: int | None = None
    change_date: date | None = None


class VacateRequest(BaseModel):
    vacate_date: date | None = None


class AllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    allocationid: int
    studentid: int
    roomid: int
    allocationdate: date
    vacatedate: date | None = None
    status: str
    bedid: int | None = None
    bednumber: int | None = None


class SettleRequest(BaseModel):
    deduction: float = 0
    reason: str | None = None
    vacate_date: date | None = None


class SettlementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    settlementid: int
    allocationid: int
    studentid: int
    vacatedate: date
    depositheld: float
    pendingdues: float
    deduction: float
    deductionreason: str | None = None
    refund: float
    balanceowed: float
