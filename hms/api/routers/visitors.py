from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.visitor import SecurityDashboardRow, VisitorLogEntry, VisitorOut
from hms.services.rbac import CurrentUser
from hms.services.visitor_service import VisitorService

router = APIRouter(prefix="/api/visitors", tags=["visitors"])


def _to_out(v) -> VisitorOut:
    return VisitorOut(
        visitorid=v.visitorid,
        visitorname=v.visitorname,
        studentid=v.studentid,
        intime=v.intime,
        outtime=v.outtime,
        contactnumber=v.contactnumber,
    )


@router.get("/dashboard", response_model=list[SecurityDashboardRow])
def security_dashboard(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return VisitorService(db).security_dashboard(current_user)


@router.get("/student/{studentid}", response_model=list[VisitorOut])
def list_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return [_to_out(v) for v in VisitorService(db).list_for_student(current_user, studentid)]


@router.post("", response_model=VisitorOut, status_code=201)
def log_entry(payload: VisitorLogEntry, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    v = VisitorService(db).log_entry(
        current_user, payload.visitorname, payload.studentid, payload.relationship, payload.contactnumber
    )
    return _to_out(v)


@router.post("/{visitorid}/exit", response_model=VisitorOut)
def log_exit(visitorid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    v = VisitorService(db).log_exit(current_user, visitorid)
    return _to_out(v)
