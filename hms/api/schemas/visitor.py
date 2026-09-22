from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VisitorLogEntry(BaseModel):
    visitorname: str
    studentid: int
    relationship: str
    contactnumber: str | None = None


class VisitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    visitorid: int
    visitorname: str
    studentid: int
    intime: datetime
    outtime: datetime | None = None
    contactnumber: str | None = None


class SecurityDashboardRow(BaseModel):
    visitorid: int
    visitorname: str
    studentid: int
    intime: datetime
    hours_in: float
    overstaying: bool
