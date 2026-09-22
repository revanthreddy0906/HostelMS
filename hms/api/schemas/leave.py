from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ApplyLeaveRequest(BaseModel):
    startdate: date
    enddate: date
    reason: str


class DecideLeaveRequest(BaseModel):
    approve: bool


class GatePassScanRequest(BaseModel):
    gatepass_code: str
    studentid: int


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    leaveid: int
    studentid: int
    startdate: date
    enddate: date
    reason: str
    status: str
    approvedby: int | None = None
    gatepasscode: str | None = None
    exitlogged: datetime | None = None
    entrylogged: datetime | None = None
