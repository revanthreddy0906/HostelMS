from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.attendance import AbsenteeAlert, AttendanceOut, MarkAttendanceRequest
from hms.services.attendance_service import AttendanceService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/date/{on_date}", response_model=list[AttendanceOut])
def list_for_date(on_date: date, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AttendanceService(db).list_for_date(current_user, on_date)


@router.post("", response_model=AttendanceOut)
def mark_attendance(payload: MarkAttendanceRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AttendanceService(db).mark_attendance(current_user, payload.studentid, payload.on_date, payload.status)


@router.get("/alerts", response_model=list[AbsenteeAlert])
def consecutive_absentee_alerts(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return AttendanceService(db).consecutive_absentee_alerts(current_user)
