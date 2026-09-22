from datetime import date

from pydantic import BaseModel, ConfigDict


class AutoAllocateRequest(BaseModel):
    studentid: int
    alloc_date: date | None = None


class ManualAllocateRequest(BaseModel):
    studentid: int
    roomid: int
    alloc_date: date | None = None


class ChangeRoomRequest(BaseModel):
    studentid: int
    new_roomid: int
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
