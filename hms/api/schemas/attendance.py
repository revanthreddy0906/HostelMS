from datetime import date

from pydantic import BaseModel, ConfigDict


class MarkAttendanceRequest(BaseModel):
    studentid: int
    on_date: date
    status: str


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attendanceid: int
    studentid: int
    date: date
    status: str
    markedby: int


class AbsenteeAlert(BaseModel):
    studentid: int
    rollnumber: str
    name: str
    consecutive_absent_days: int
