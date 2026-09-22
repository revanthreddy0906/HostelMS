from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.leave import ApplyLeaveRequest, DecideLeaveRequest, GatePassScanRequest, LeaveOut
from hms.services.leave_service import LeaveService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


@router.get("/pending", response_model=list[LeaveOut])
def list_pending(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).list_pending()


@router.get("/me", response_model=list[LeaveOut])
def my_leaves(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).list_for_student(current_user.entity_id)


@router.get("/student/{studentid}", response_model=list[LeaveOut])
def list_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).list_for_student(studentid)


@router.post("", response_model=LeaveOut, status_code=201)
def apply_leave(payload: ApplyLeaveRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).apply_leave(current_user, payload.startdate, payload.enddate, payload.reason)


@router.post("/{leaveid}/decide", response_model=LeaveOut)
def decide_leave(
    leaveid: int, payload: DecideLeaveRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)
):
    return LeaveService(db).decide_leave(current_user, leaveid, payload.approve)


@router.get("/{leaveid}/gatepass-qr")
def get_gatepass_qr(leaveid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    png_bytes = LeaveService(db).get_gatepass_qr(leaveid)
    return Response(content=png_bytes, media_type="image/png")


@router.post("/security/exit", response_model=LeaveOut)
def log_exit(payload: GatePassScanRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).log_exit(current_user, payload.gatepass_code, payload.studentid)


@router.post("/security/entry", response_model=LeaveOut)
def log_entry(payload: GatePassScanRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return LeaveService(db).log_entry(current_user, payload.gatepass_code, payload.studentid)
