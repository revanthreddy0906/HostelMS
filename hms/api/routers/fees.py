from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from hms.api.deps import get_current_user, get_db
from hms.api.schemas.fee import FeeOut, FeeStructureRequest, GenerateFeesRequest, PayFeeRequest
from hms.services.fee_service import FeeService
from hms.services.rbac import CurrentUser

router = APIRouter(prefix="/api/fees", tags=["fees"])


@router.post("/structure")
def set_fee_structure(payload: FeeStructureRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    fs = FeeService(db).set_fee_structure(current_user, payload.roomtype, payload.amount, payload.semester)
    return {"id": fs.id, "roomtype": fs.roomtype, "amount": float(fs.amount), "effective_semester": fs.effective_semester}


@router.post("/generate", response_model=list[FeeOut])
def generate_fees(payload: GenerateFeesRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).generate_fees_for_active_allocations(current_user, payload.semester, payload.duedate)


@router.get("/student/{studentid}", response_model=list[FeeOut])
def list_fees_for_student(studentid: int, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).list_fees_for_student(studentid)


@router.get("/me", response_model=list[FeeOut])
def my_fees(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).list_fees_for_student(current_user.entity_id)


@router.post("/{feeid}/pay", response_model=FeeOut)
def pay_fee(feeid: int, payload: PayFeeRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    return FeeService(db).pay_fee(current_user, feeid, payload.amount)


@router.post("/mark-overdue")
def mark_overdue(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    count = FeeService(db).mark_overdue(current_user)
    return {"marked_overdue": count}
